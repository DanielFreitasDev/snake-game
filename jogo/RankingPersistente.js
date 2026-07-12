/**
 * @fileoverview Ranking persistente do multiplayer (Hall da Fama).
 *
 * Acumula estatisticas de jogadores humanos entre partidas e persiste
 * em disco (JSON), sobrevivendo a reinicios do servidor. Cada jogador
 * eh identificado pelo apelido (normalizado em minusculas) — nao ha
 * sistema de contas, entao o apelido eh a identidade possivel em uma
 * rede local.
 *
 * A gravacao eh atomica: escreve em arquivo temporario e renomeia,
 * evitando corromper o ranking se o processo cair no meio da escrita.
 * As escritas sao serializadas em uma fila de promises para que duas
 * partidas terminando juntas nao gravem simultaneamente.
 */

const fs = require('fs');
const path = require('path');

/** Maximo de jogadores mantidos no arquivo (poda os mais antigos) */
const MAX_JOGADORES_ARQUIVO = 500;

class RankingPersistente {
  /**
   * @param {string} [arquivo] - Caminho do JSON de dados (padrao: dados/ranking.json).
   */
  constructor(arquivo) {
    /** @type {string} Caminho absoluto do arquivo de dados */
    this.arquivo = arquivo || path.join(__dirname, '..', 'dados', 'ranking.json');

    /** @type {Map<string, object>} apelido normalizado -> estatisticas */
    this.jogadores = new Map();

    /** @type {Promise<void>} Fila de escritas (serializa gravacoes) */
    this._filaEscrita = Promise.resolve();

    this._carregar();
  }

  /**
   * Carrega o ranking do disco. Arquivo ausente ou corrompido resulta
   * em ranking vazio (o jogo nunca deixa de subir por causa disso).
   * @private
   */
  _carregar() {
    try {
      const bruto = fs.readFileSync(this.arquivo, 'utf8');
      const dados = JSON.parse(bruto);
      if (Array.isArray(dados.jogadores)) {
        for (const registro of dados.jogadores) {
          if (registro && typeof registro.apelido === 'string') {
            this.jogadores.set(this._chave(registro.apelido), {
              apelido: registro.apelido,
              vitorias: Number(registro.vitorias) || 0,
              partidas: Number(registro.partidas) || 0,
              pontuacaoTotal: Number(registro.pontuacaoTotal) || 0,
              melhorPontuacao: Number(registro.melhorPontuacao) || 0,
              eliminacoes: Number(registro.eliminacoes) || 0,
              ultimaPartida: registro.ultimaPartida || null,
            });
          }
        }
      }
      console.log(`[Ranking] ${this.jogadores.size} jogador(es) carregado(s) de ${this.arquivo}`);
    } catch (erro) {
      if (erro.code !== 'ENOENT') {
        console.error('[Ranking] Falha ao carregar (comecando vazio):', erro.message);
      }
    }
  }

  /**
   * Normaliza o apelido para servir de chave de identidade.
   * @param {string} apelido
   * @returns {string}
   * @private
   */
  _chave(apelido) {
    return String(apelido).trim().toLowerCase();
  }

  /**
   * Registra o resultado de uma partida finalizada.
   * Bots sao ignorados: o Hall da Fama eh so de humanos.
   * @param {Array<{posicao:number, apelido:string, pontuacao:number,
   *                eliminacoes:number, ehBot:boolean}>} ranking - Ranking final da partida.
   */
  registrarPartida(ranking) {
    if (!Array.isArray(ranking)) return;

    const humanos = ranking.filter(r => r && !r.ehBot && typeof r.apelido === 'string');
    if (humanos.length === 0) return;

    const agora = new Date().toISOString();

    for (const resultado of humanos) {
      const chave = this._chave(resultado.apelido);
      const registro = this.jogadores.get(chave) || {
        apelido: resultado.apelido,
        vitorias: 0,
        partidas: 0,
        pontuacaoTotal: 0,
        melhorPontuacao: 0,
        eliminacoes: 0,
        ultimaPartida: null,
      };

      registro.apelido = resultado.apelido; // Mantem a grafia mais recente
      registro.partidas++;
      registro.pontuacaoTotal += Number(resultado.pontuacao) || 0;
      registro.melhorPontuacao = Math.max(registro.melhorPontuacao, Number(resultado.pontuacao) || 0);
      registro.eliminacoes += Number(resultado.eliminacoes) || 0;
      registro.ultimaPartida = agora;
      if (resultado.posicao === 1) registro.vitorias++;

      this.jogadores.set(chave, registro);
    }

    this._podar();
    this._salvar();
  }

  /**
   * Retorna os melhores jogadores para exibicao no Hall da Fama.
   * Ordena por vitorias, depois pontuacao acumulada, depois melhor partida.
   * @param {number} [limite] - Quantidade maxima de posicoes (padrao 10).
   * @returns {Array<object>} Lista ordenada de estatisticas.
   */
  obterTop(limite = 10) {
    const maximo = Math.max(1, Math.min(50, Number(limite) || 10));
    return [...this.jogadores.values()]
      .sort((a, b) =>
        (b.vitorias - a.vitorias) ||
        (b.pontuacaoTotal - a.pontuacaoTotal) ||
        (b.melhorPontuacao - a.melhorPontuacao))
      .slice(0, maximo)
      .map((r, indice) => ({ posicao: indice + 1, ...r }));
  }

  /**
   * Remove os registros mais antigos quando o arquivo passa do limite.
   * @private
   */
  _podar() {
    if (this.jogadores.size <= MAX_JOGADORES_ARQUIVO) return;

    const ordenados = [...this.jogadores.entries()]
      .sort((a, b) => String(b[1].ultimaPartida).localeCompare(String(a[1].ultimaPartida)));
    this.jogadores = new Map(ordenados.slice(0, MAX_JOGADORES_ARQUIVO));
  }

  /**
   * Agenda uma gravacao atomica do ranking em disco.
   * @returns {Promise<void>} Promise da escrita agendada (util em testes).
   * @private
   */
  _salvar() {
    const conteudo = JSON.stringify({
      versao: 1,
      atualizadoEm: new Date().toISOString(),
      jogadores: [...this.jogadores.values()],
    }, null, 2);

    this._filaEscrita = this._filaEscrita.then(async () => {
      const temporario = `${this.arquivo}.${process.pid}.tmp`;
      await fs.promises.mkdir(path.dirname(this.arquivo), { recursive: true });
      await fs.promises.writeFile(temporario, conteudo, 'utf8');
      await fs.promises.rename(temporario, this.arquivo);
    }).catch((erro) => {
      console.error('[Ranking] Falha ao salvar:', erro.message);
    });

    return this._filaEscrita;
  }
}

module.exports = RankingPersistente;
