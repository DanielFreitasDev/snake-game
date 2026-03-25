/**
 * @fileoverview Inteligencia Artificial dos bots para o modo multiplayer.
 *
 * Cada bot avalia as direcoes possiveis a cada tick e escolhe a melhor
 * com base em: seguranca (evitar paredes, cobras), proximidade de comida
 * e espaco disponivel adiante (look-ahead de 1 passo).
 */

const CONSTANTES = require('../publico/js/constantes');

/** Nomes aleatorios e divertidos para os bots */
const NOMES_BOTS = [
  'BotNaldo', 'CobriaNinja', 'ZigZague', 'Robonaldo',
  'SerpentIA', 'AnaCondIA', 'BotElho', 'Jararabot',
  'SucuriBot', 'CobrinhaIA', 'ViboRobo', 'NajaRobo',
  'BotBecue', 'BoaBot', 'Python Jr', 'Fofossauro',
  'TrouxaBot', 'RoboCobra', 'Cobra Cega', 'Bot do Mal',
  'Cobra Maluca', 'SnakeBot Jr', 'Cobrao IA', 'Botossauro',
];

const TODAS_DIRECOES = ['cima', 'baixo', 'esquerda', 'direita'];

class BotIA {
  /**
   * Sorteia um nome divertido que ainda nao esteja em uso na sala.
   * @param {string[]} nomesUsados - Nomes ja utilizados na sala.
   * @returns {string}
   */
  static sortearNome(nomesUsados) {
    const disponiveis = NOMES_BOTS.filter(n => !nomesUsados.includes(n));
    if (disponiveis.length === 0) {
      return `Bot #${Math.floor(Math.random() * 999)}`;
    }
    return disponiveis[Math.floor(Math.random() * disponiveis.length)];
  }

  /**
   * Decide a melhor direcao para o bot se mover.
   * Estrategia: avaliar cada direcao possivel (exceto a oposta),
   * pontuar por seguranca, proximidade de comida e espaco disponivel.
   *
   * @param {object} bot - Dados do jogador-bot.
   * @param {object[]} todosJogadores - Array com todos os jogadores da sala.
   * @param {object[]} comidas - Array de comidas no mapa.
   * @param {number} largura - Largura do grid.
   * @param {number} altura - Altura do grid.
   * @returns {string} Direcao escolhida.
   */
  static decidirDirecao(bot, todosJogadores, comidas, largura, altura) {
    if (!bot.vivo || bot.cobra.length === 0) return bot.direcao;

    const cabeca = bot.cobra[0];
    const oposta = CONSTANTES.DIRECAO_OPOSTA[bot.direcao];
    const possiveisDirecoes = TODAS_DIRECOES.filter(d => d !== oposta);

    const avaliacoes = possiveisDirecoes.map(direcao => {
      const vetor = CONSTANTES.DIRECOES[direcao];
      const pos = { x: cabeca.x + vetor.x, y: cabeca.y + vetor.y };

      // Verificar parede
      if (pos.x < 0 || pos.x >= largura || pos.y < 0 || pos.y >= altura) {
        return { direcao, seguro: false, pontuacao: -1000 };
      }

      // Verificar colisao com o proprio corpo
      if (bot.cobra.some(s => s.x === pos.x && s.y === pos.y)) {
        return { direcao, seguro: false, pontuacao: -1000 };
      }

      // Verificar colisao com outras cobras
      for (const j of todosJogadores) {
        if (j.id === bot.id || !j.vivo) continue;
        if (j.cobra.some(s => s.x === pos.x && s.y === pos.y)) {
          return { direcao, seguro: false, pontuacao: -1000 };
        }
      }

      // --- Direcao segura, calcular pontuacao ---
      let pontuacao = 0;

      // Proximidade da comida mais perto
      if (comidas.length > 0) {
        let menorDist = Infinity;
        for (const c of comidas) {
          const d = Math.abs(c.posicao.x - pos.x) + Math.abs(c.posicao.y - pos.y);
          if (d < menorDist) menorDist = d;
        }
        pontuacao -= menorDist;
      }

      // Penalidade por proximidade de parede
      const distParede = Math.min(pos.x, pos.y, largura - 1 - pos.x, altura - 1 - pos.y);
      if (distParede <= 1) pontuacao -= 10;
      else if (distParede <= 3) pontuacao -= 3;

      // Look-ahead: quantas saidas seguras existem a partir da nova posicao
      let saidasSeguras = 0;
      for (const d2 of TODAS_DIRECOES) {
        if (d2 === CONSTANTES.DIRECAO_OPOSTA[direcao]) continue;
        const v2 = CONSTANTES.DIRECOES[d2];
        const p2 = { x: pos.x + v2.x, y: pos.y + v2.y };

        if (p2.x < 0 || p2.x >= largura || p2.y < 0 || p2.y >= altura) continue;
        if (bot.cobra.some(s => s.x === p2.x && s.y === p2.y)) continue;

        let bloqueado = false;
        for (const j of todosJogadores) {
          if (j.id === bot.id || !j.vivo) continue;
          if (j.cobra.some(s => s.x === p2.x && s.y === p2.y)) { bloqueado = true; break; }
        }
        if (!bloqueado) saidasSeguras++;
      }

      if (saidasSeguras === 0) pontuacao -= 50;
      else pontuacao += saidasSeguras * 2;

      // Evitar cabecas de outros jogadores (risco de colisao frontal)
      for (const j of todosJogadores) {
        if (j.id === bot.id || !j.vivo || j.cobra.length === 0) continue;
        const outraCabeca = j.cobra[0];
        const dist = Math.abs(outraCabeca.x - pos.x) + Math.abs(outraCabeca.y - pos.y);
        if (dist <= 2) pontuacao -= 8;
      }

      return { direcao, seguro: true, pontuacao };
    });

    // Escolher a melhor direcao segura
    const seguros = avaliacoes.filter(a => a.seguro);

    if (seguros.length > 0) {
      seguros.sort((a, b) => b.pontuacao - a.pontuacao);
      return seguros[0].direcao;
    }

    // Sem saida segura, manter direcao atual
    return bot.direcao;
  }
}

module.exports = BotIA;
