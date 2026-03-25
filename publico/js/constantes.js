/**
 * @fileoverview Constantes compartilhadas entre servidor e cliente do jogo Snake.
 *
 * Este modulo define todas as configuracoes do jogo: dimensoes do tabuleiro,
 * tipos de comida, cores das cobras, direcoes, parametros do modo solo e
 * multiplayer. Utiliza o padrao Universal Module Definition (UMD) para
 * funcionar tanto no Node.js (servidor) quanto no navegador (cliente).
 */

const CONSTANTES = {

  /* =========================================================================
   * CONFIGURACOES DO TABULEIRO
   * Define as dimensoes do grid para cada modo de jogo e o tamanho visual
   * de cada celula em pixels.
   * ======================================================================= */
  TABULEIRO: {
    LARGURA_SOLO: 30,       // Colunas do grid no modo solo
    ALTURA_SOLO: 30,        // Linhas do grid no modo solo
    LARGURA_MULTI: 40,      // Colunas do grid no multiplayer
    ALTURA_MULTI: 30,       // Linhas do grid no multiplayer
    TAMANHO_CELULA: 20,     // Tamanho em pixels de cada celula do grid
  },

  /* =========================================================================
   * CONFIGURACOES DA COBRA
   * Parametros iniciais para cada cobra ao comecar uma partida.
   * ======================================================================= */
  COBRA: {
    TAMANHO_INICIAL: 4,     // Quantidade de segmentos ao nascer
    VIDAS_INICIAIS: 3,      // Vidas no inicio de cada partida
    VELOCIDADE_BASE: 4,     // Ticks entre cada movimento (maior = mais lento)
    VELOCIDADE_RAPIDA: 2,   // Ticks entre movimentos com boost de velocidade
  },

  /* =========================================================================
   * TIPOS DE COMIDA
   * Cada tipo possui propriedades unicas: cor, pontuacao, efeito e
   * probabilidade de aparecer no mapa. A probabilidade eh usada para
   * sortear qual tipo de comida sera gerado.
   * ======================================================================= */
  TIPOS_COMIDA: {
    /** Comida padrao: aumenta a cobra em 1 segmento */
    NORMAL: {
      tipo: 'normal',
      cor: '#44ff44',
      brilho: '#22cc22',
      pontos: 10,
      segmentos: 1,
      probabilidade: 0.45,
      descricao: 'Maçã',
    },
    /** Boost de velocidade temporario */
    VELOCIDADE: {
      tipo: 'velocidade',
      cor: '#ffee00',
      brilho: '#ccbb00',
      pontos: 15,
      segmentos: 0,
      duracao: 5000,
      probabilidade: 0.20,
      descricao: 'Raio',
    },
    /** Comida premium: aumenta a cobra em 3 segmentos */
    DOURADA: {
      tipo: 'dourada',
      cor: '#ffd700',
      brilho: '#cca800',
      pontos: 30,
      segmentos: 3,
      probabilidade: 0.15,
      descricao: 'Estrela',
    },
    /** Concede uma vida extra ao jogador */
    VIDA: {
      tipo: 'vida',
      cor: '#ff4488',
      brilho: '#cc2266',
      pontos: 25,
      segmentos: 0,
      probabilidade: 0.10,
      descricao: 'Coração',
    },
    /** Escudo temporario: protege contra colisoes */
    ESCUDO: {
      tipo: 'escudo',
      cor: '#00ffff',
      brilho: '#00bbbb',
      pontos: 20,
      segmentos: 0,
      duracao: 4000,
      probabilidade: 0.10,
      descricao: 'Escudo',
    },
  },

  /* =========================================================================
   * CORES DAS COBRAS (MULTIPLAYER)
   * Cada jogador recebe uma cor diferente ao entrar na sala.
   * ======================================================================= */
  CORES_COBRAS: [
    { principal: '#00ff88', secundaria: '#00cc66', nome: 'Verde' },
    { principal: '#ff4488', secundaria: '#cc2266', nome: 'Rosa' },
    { principal: '#4499ff', secundaria: '#2277cc', nome: 'Azul' },
    { principal: '#ffaa00', secundaria: '#cc8800', nome: 'Laranja' },
    { principal: '#bb55ff', secundaria: '#8833cc', nome: 'Roxo' },
    { principal: '#ff6644', secundaria: '#cc4422', nome: 'Vermelho' },
  ],

  /* =========================================================================
   * DIRECOES DE MOVIMENTO
   * Vetores de deslocamento no grid para cada direcao.
   * ======================================================================= */
  DIRECOES: {
    cima:      { x:  0, y: -1 },
    baixo:     { x:  0, y:  1 },
    esquerda:  { x: -1, y:  0 },
    direita:   { x:  1, y:  0 },
  },

  /** Mapa de direcoes opostas para impedir giro de 180 graus */
  DIRECAO_OPOSTA: {
    cima: 'baixo',
    baixo: 'cima',
    esquerda: 'direita',
    direita: 'esquerda',
  },

  /* =========================================================================
   * CONFIGURACOES DO MULTIPLAYER
   * ======================================================================= */
  MULTI: {
    MAX_JOGADORES: 6,
    MIN_JOGADORES_PARA_INICIAR: 2,
    QUANTIDADE_COMIDA: 10,
    TICKS_POR_SEGUNDO: 20,
    TEMPO_INVULNERAVEL: 3000,   // ms de invulnerabilidade apos respawn
    TEMPO_PARTIDA: 180,         // segundos (3 minutos por partida)
  },

  /* =========================================================================
   * CONFIGURACOES DO MODO SOLO
   * ======================================================================= */
  SOLO: {
    QUANTIDADE_COMIDA: 3,       // Comidas simultaneas no mapa
    TICKS_POR_SEGUNDO: 15,      // Taxa de atualizacao do jogo solo
  },

  /* =========================================================================
   * PONTUACAO POR ACOES ESPECIAIS (MULTIPLAYER)
   * ======================================================================= */
  PONTUACAO: {
    REMOVER_SEGMENTO: 5,        // Pontos ao remover segmento de outro jogador
    ELIMINAR_JOGADOR: 50,       // Pontos ao eliminar outro jogador
  },
};

/* ---------------------------------------------------------------------------
 * Exportacao universal (UMD)
 * No Node.js: module.exports = CONSTANTES
 * No navegador: a variavel CONSTANTES fica disponivel globalmente
 * ------------------------------------------------------------------------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTES;
}
