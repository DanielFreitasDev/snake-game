/**
 * @fileoverview Sistema de particulas para efeitos visuais no jogo Snake.
 *
 * Gerencia a criacao, atualizacao e renderizacao de particulas que
 * proporcionam feedback visual atraente em diversas acoes do jogo:
 * - Explosao ao coletar comida (cores variam conforme o tipo)
 * - Trilha de particulas atras da cobra em alta velocidade
 * - Explosao ao colidir/morrer
 * - Brilhos ao ganhar pontos
 *
 * Padrao utilizado: Object Pool Pattern - particulas sao reutilizadas
 * para evitar alocacoes excessivas de memoria (garbage collection).
 *
 * @class SistemaDeParticulas
 */

class SistemaDeParticulas {
  /**
   * Cria o sistema de particulas.
   * @param {CanvasRenderingContext2D} contexto - Contexto 2D do canvas.
   */
  constructor(contexto) {
    /** @type {CanvasRenderingContext2D} Contexto de renderizacao */
    this.ctx = contexto;

    /** @type {Array<object>} Pool de particulas ativas */
    this.particulas = [];

    /** @type {number} Limite maximo de particulas simultaneas */
    this.limiteParticulas = 500;

    /** @type {Array<object>} Textos flutuantes (pontuacao, etc) */
    this.textosFlutuantes = [];
  }

  /* =========================================================================
   * CRIACAO DE EFEITOS
   * ======================================================================= */

  /**
   * Cria uma explosao de particulas em uma posicao (ao coletar comida).
   * As particulas se espalham radialmente com velocidades e tamanhos variados.
   * @param {number} x - Posicao X em pixels no canvas.
   * @param {number} y - Posicao Y em pixels no canvas.
   * @param {string} cor - Cor principal das particulas (hex).
   * @param {number} [quantidade=15] - Numero de particulas a criar.
   */
  criarExplosao(x, y, cor, quantidade = 15) {
    for (let i = 0; i < quantidade; i++) {
      if (this.particulas.length >= this.limiteParticulas) break;

      // Angulo aleatorio para distribuir em circulo
      const angulo = Math.random() * Math.PI * 2;
      const velocidade = 1 + Math.random() * 4;

      this.particulas.push({
        x,
        y,
        velocidadeX: Math.cos(angulo) * velocidade,
        velocidadeY: Math.sin(angulo) * velocidade,
        tamanho: 2 + Math.random() * 4,
        cor,
        opacidade: 1,
        decaimento: 0.015 + Math.random() * 0.025, // Taxa de desaparecimento
        gravidade: 0.05,                             // Leve queda
        tipo: 'circulo',
      });
    }
  }

  /**
   * Cria uma explosao maior e mais dramatica (para mortes/eliminacoes).
   * Usa mais particulas, maiores e com brilho.
   * @param {number} x - Posicao X em pixels.
   * @param {number} y - Posicao Y em pixels.
   * @param {string} cor - Cor das particulas.
   */
  criarExplosaoGrande(x, y, cor) {
    // Particulas grandes centrais
    this.criarExplosao(x, y, cor, 30);

    // Anel externo de particulas menores
    for (let i = 0; i < 12; i++) {
      if (this.particulas.length >= this.limiteParticulas) break;

      const angulo = (Math.PI * 2 / 12) * i;
      const velocidade = 3 + Math.random() * 2;

      this.particulas.push({
        x,
        y,
        velocidadeX: Math.cos(angulo) * velocidade,
        velocidadeY: Math.sin(angulo) * velocidade,
        tamanho: 3 + Math.random() * 3,
        cor: '#ffffff',
        opacidade: 0.8,
        decaimento: 0.02,
        gravidade: 0,
        tipo: 'circulo',
      });
    }
  }

  /**
   * Cria particulas de trilha atras da cobra (efeito de velocidade).
   * Particulas menores e mais sutis, sem gravidade.
   * @param {number} x - Posicao X em pixels.
   * @param {number} y - Posicao Y em pixels.
   * @param {string} cor - Cor da trilha.
   */
  criarTrilha(x, y, cor) {
    if (this.particulas.length >= this.limiteParticulas) return;

    this.particulas.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      velocidadeX: (Math.random() - 0.5) * 0.5,
      velocidadeY: (Math.random() - 0.5) * 0.5,
      tamanho: 1 + Math.random() * 3,
      cor,
      opacidade: 0.6,
      decaimento: 0.03,
      gravidade: 0,
      tipo: 'circulo',
    });
  }

  /**
   * Cria particulas de brilho (efeito de escudo ativo ou invulnerabilidade).
   * Particulas que orbitam ao redor de uma posicao.
   * @param {number} x - Posicao X central.
   * @param {number} y - Posicao Y central.
   * @param {string} cor - Cor do brilho.
   */
  criarBrilho(x, y, cor) {
    for (let i = 0; i < 3; i++) {
      if (this.particulas.length >= this.limiteParticulas) break;

      this.particulas.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        velocidadeX: (Math.random() - 0.5) * 1.5,
        velocidadeY: -0.5 - Math.random() * 1.5, // Sobe
        tamanho: 1 + Math.random() * 2,
        cor,
        opacidade: 0.7,
        decaimento: 0.02,
        gravidade: -0.02, // Antigravidade (sobe)
        tipo: 'circulo',
      });
    }
  }

  /**
   * Cria um texto flutuante que sobe e desaparece (ex: "+10").
   * @param {number} x - Posicao X em pixels.
   * @param {number} y - Posicao Y em pixels.
   * @param {string} texto - Texto a exibir.
   * @param {string} cor - Cor do texto.
   */
  criarTextoFlutuante(x, y, texto, cor) {
    this.textosFlutuantes.push({
      x,
      y,
      texto,
      cor,
      opacidade: 1,
      velocidadeY: -2,
      decaimento: 0.02,
    });
  }

  /* =========================================================================
   * ATUALIZACAO E RENDERIZACAO
   * ======================================================================= */

  /**
   * Atualiza todas as particulas: posicao, opacidade e remove as expiradas.
   * Deve ser chamado a cada frame de renderizacao.
   */
  atualizar() {
    // Atualizar particulas
    for (let i = this.particulas.length - 1; i >= 0; i--) {
      const p = this.particulas[i];

      // Aplicar fisica
      p.x += p.velocidadeX;
      p.y += p.velocidadeY;
      p.velocidadeY += p.gravidade;

      // Reduzir opacidade (fade out)
      p.opacidade -= p.decaimento;

      // Reduzir tamanho gradualmente
      p.tamanho *= 0.98;

      // Remover particulas expiradas
      if (p.opacidade <= 0 || p.tamanho < 0.5) {
        this.particulas.splice(i, 1);
      }
    }

    // Atualizar textos flutuantes
    for (let i = this.textosFlutuantes.length - 1; i >= 0; i--) {
      const t = this.textosFlutuantes[i];
      t.y += t.velocidadeY;
      t.opacidade -= t.decaimento;

      if (t.opacidade <= 0) {
        this.textosFlutuantes.splice(i, 1);
      }
    }
  }

  /**
   * Renderiza todas as particulas e textos flutuantes no canvas.
   * Utiliza composicao 'lighter' para efeito de brilho aditivo.
   */
  renderizar() {
    const ctx = this.ctx;

    // Salvar estado do canvas
    ctx.save();

    // Usar composicao aditiva para efeito de brilho
    ctx.globalCompositeOperation = 'lighter';

    // Desenhar particulas
    for (const p of this.particulas) {
      ctx.globalAlpha = Math.max(0, p.opacidade);
      ctx.fillStyle = p.cor;

      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.tamanho), 0, Math.PI * 2);
      ctx.fill();
    }

    // Restaurar composicao normal para textos
    ctx.globalCompositeOperation = 'source-over';

    // Desenhar textos flutuantes
    for (const t of this.textosFlutuantes) {
      ctx.globalAlpha = Math.max(0, t.opacidade);
      ctx.fillStyle = t.cor;
      ctx.font = 'bold 14px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = t.cor;
      ctx.shadowBlur = 6;
      ctx.fillText(t.texto, t.x, t.y);
      ctx.shadowBlur = 0;
    }

    // Restaurar estado
    ctx.restore();
  }

  /**
   * Remove todas as particulas e textos (limpar ao reiniciar jogo).
   */
  limpar() {
    this.particulas = [];
    this.textosFlutuantes = [];
  }
}

/* Disponibilizar globalmente para uso nos scripts do jogo */
if (typeof window !== 'undefined') {
  window.SistemaDeParticulas = SistemaDeParticulas;
}
