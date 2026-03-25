/**
 * @fileoverview Sistema de efeitos sonoros procedurais para o Snakis.
 *
 * Gera todos os sons em tempo real usando a Web Audio API,
 * sem necessidade de arquivos de audio externos. Sons estilo
 * retro/8-bit com osciladores, sweeps de frequencia e envelopes.
 *
 * O AudioContext eh criado/resumido no primeiro gesto do usuario
 * (click/keydown) para respeitar a politica de autoplay dos navegadores.
 *
 * @class SistemaDeSom
 */

class SistemaDeSom {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;

    /** @type {boolean} Mudo global */
    this.mudo = false;

    /** @type {number} Volume master (0 a 1) */
    this.volume = 0.25;

    /** @type {boolean} Se o AudioContext ja foi inicializado */
    this._inicializado = false;

    // Restaurar preferencia de mudo do localStorage
    try {
      const salvo = localStorage.getItem('snake_som_mudo');
      if (salvo === 'true') this.mudo = true;
    } catch {}

    // Inicializar no primeiro gesto do usuario
    this._aguardarGesto();
  }

  /* =========================================================================
   * INICIALIZACAO
   * ======================================================================= */

  /**
   * Aguarda um gesto do usuario (click ou tecla) para criar o AudioContext.
   * Navegadores bloqueiam audio antes de interacao do usuario.
   * @private
   */
  _aguardarGesto() {
    const iniciar = () => {
      if (!this._inicializado) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._inicializado = true;
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      document.removeEventListener('click', iniciar);
      document.removeEventListener('keydown', iniciar);
      document.removeEventListener('touchstart', iniciar);
    };

    document.addEventListener('click', iniciar);
    document.addEventListener('keydown', iniciar);
    document.addEventListener('touchstart', iniciar);
  }

  /* =========================================================================
   * CONTROLE
   * ======================================================================= */

  /**
   * Alterna o estado mudo e salva no localStorage.
   * @returns {boolean} Novo estado (true = mudo).
   */
  alternarMudo() {
    this.mudo = !this.mudo;
    try {
      localStorage.setItem('snake_som_mudo', String(this.mudo));
    } catch {}
    return this.mudo;
  }

  /* =========================================================================
   * PRIMITIVAS DE AUDIO
   * ======================================================================= */

  /**
   * Toca um tom simples com sweep de frequencia e decay de volume.
   * @param {number} freq - Frequencia inicial (Hz).
   * @param {string} tipo - Tipo do oscilador ('sine'|'square'|'sawtooth'|'triangle').
   * @param {number} duracao - Duracao em segundos.
   * @param {number} [freqFim] - Frequencia final (Hz) para sweep.
   * @param {number} [vol] - Volume (0 a 1). Usa this.volume se omitido.
   * @private
   */
  _tocarTom(freq, tipo, duracao, freqFim, vol) {
    if (this.mudo || !this.ctx) return;

    const agora = this.ctx.currentTime;
    const v = (vol !== undefined ? vol : this.volume);

    const osc = this.ctx.createOscillator();
    const ganho = this.ctx.createGain();

    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, agora);
    if (freqFim && freqFim > 0) {
      osc.frequency.exponentialRampToValueAtTime(freqFim, agora + duracao);
    }

    ganho.gain.setValueAtTime(v, agora);
    ganho.gain.exponentialRampToValueAtTime(0.001, agora + duracao);

    osc.connect(ganho);
    ganho.connect(this.ctx.destination);
    osc.start(agora);
    osc.stop(agora + duracao);
  }

  /**
   * Toca uma sequencia de notas com timing.
   * @param {Array<{freq:number, tipo:string, duracao:number, atraso:number, vol?:number}>} notas
   * @private
   */
  _tocarSequencia(notas) {
    if (this.mudo || !this.ctx) return;

    for (const nota of notas) {
      const agora = this.ctx.currentTime + nota.atraso;
      const v = nota.vol !== undefined ? nota.vol : this.volume;

      const osc = this.ctx.createOscillator();
      const ganho = this.ctx.createGain();

      osc.type = nota.tipo;
      osc.frequency.setValueAtTime(nota.freq, agora);

      ganho.gain.setValueAtTime(v, agora);
      ganho.gain.exponentialRampToValueAtTime(0.001, agora + nota.duracao);

      osc.connect(ganho);
      ganho.connect(this.ctx.destination);
      osc.start(agora);
      osc.stop(agora + nota.duracao);
    }
  }

  /**
   * Gera um burst de ruido branco (para explosoes e impactos).
   * @param {number} duracao - Duracao em segundos.
   * @param {number} [vol] - Volume (0 a 1).
   * @private
   */
  _tocarRuido(duracao, vol) {
    if (this.mudo || !this.ctx) return;

    const agora = this.ctx.currentTime;
    const v = vol !== undefined ? vol : this.volume * 0.4;
    const tamanho = Math.floor(this.ctx.sampleRate * duracao);
    const buffer = this.ctx.createBuffer(1, tamanho, this.ctx.sampleRate);
    const dados = buffer.getChannelData(0);

    for (let i = 0; i < tamanho; i++) {
      dados[i] = Math.random() * 2 - 1;
    }

    const fonte = this.ctx.createBufferSource();
    fonte.buffer = buffer;

    const ganho = this.ctx.createGain();
    ganho.gain.setValueAtTime(v, agora);
    ganho.gain.exponentialRampToValueAtTime(0.001, agora + duracao);

    fonte.connect(ganho);
    ganho.connect(this.ctx.destination);
    fonte.start(agora);
    fonte.stop(agora + duracao);
  }

  /* =========================================================================
   * EFEITOS SONOROS DO JOGO
   * ======================================================================= */

  // ---- Comida ----

  /**
   * Som ao comer comida normal: blip curto ascendente.
   */
  comerNormal() {
    this._tocarTom(523, 'square', 0.08, 1047, this.volume * 0.5);
  }

  /**
   * Som ao comer comida dourada: arpejo brilhante ascendente (3 notas).
   */
  comerDourada() {
    this._tocarSequencia([
      { freq: 784, tipo: 'square', duracao: 0.1, atraso: 0, vol: this.volume * 0.45 },
      { freq: 988, tipo: 'square', duracao: 0.1, atraso: 0.07, vol: this.volume * 0.5 },
      { freq: 1319, tipo: 'square', duracao: 0.15, atraso: 0.14, vol: this.volume * 0.55 },
    ]);
  }

  /**
   * Som ao comer velocidade: sweep rapido ascendente (sawtooth).
   */
  comerVelocidade() {
    this._tocarTom(300, 'sawtooth', 0.12, 1800, this.volume * 0.4);
  }

  /**
   * Som ao comer vida extra: chime melodico de duas notas (sine).
   */
  comerVida() {
    this._tocarSequencia([
      { freq: 659, tipo: 'sine', duracao: 0.15, atraso: 0, vol: this.volume * 0.5 },
      { freq: 880, tipo: 'sine', duracao: 0.25, atraso: 0.12, vol: this.volume * 0.55 },
    ]);
  }

  /**
   * Som ao comer escudo: tom metalico com reverb curto (triangle).
   */
  comerEscudo() {
    this._tocarSequencia([
      { freq: 880, tipo: 'triangle', duracao: 0.08, atraso: 0, vol: this.volume * 0.5 },
      { freq: 1100, tipo: 'triangle', duracao: 0.12, atraso: 0.06, vol: this.volume * 0.45 },
      { freq: 1320, tipo: 'triangle', duracao: 0.18, atraso: 0.12, vol: this.volume * 0.4 },
    ]);
  }

  // ---- Colisao e Morte ----

  /**
   * Som de colisao/morte: sweep descendente com ruido.
   */
  morrer() {
    this._tocarTom(440, 'square', 0.3, 55, this.volume * 0.5);
    this._tocarRuido(0.2, this.volume * 0.25);
  }

  /**
   * Som de game over: frase triste descendente (4 notas).
   */
  gameOver() {
    this._tocarSequencia([
      { freq: 392, tipo: 'square', duracao: 0.2, atraso: 0, vol: this.volume * 0.45 },
      { freq: 330, tipo: 'square', duracao: 0.2, atraso: 0.2, vol: this.volume * 0.4 },
      { freq: 277, tipo: 'square', duracao: 0.2, atraso: 0.4, vol: this.volume * 0.35 },
      { freq: 220, tipo: 'square', duracao: 0.4, atraso: 0.6, vol: this.volume * 0.3 },
    ]);
    this._tocarRuido(0.15, this.volume * 0.15);
  }

  /**
   * Som de escudo bloqueando colisao: ding metalico deflector.
   */
  escudoBloqueou() {
    this._tocarTom(1500, 'triangle', 0.12, 2200, this.volume * 0.5);
    this._tocarTom(1800, 'sine', 0.08, 2500, this.volume * 0.3);
  }

  // ---- Respawn e Inicio ----

  /**
   * Som de respawn: arpejo rapido ascendente (power-up).
   */
  respawnar() {
    this._tocarSequencia([
      { freq: 330, tipo: 'square', duracao: 0.08, atraso: 0, vol: this.volume * 0.4 },
      { freq: 440, tipo: 'square', duracao: 0.08, atraso: 0.06, vol: this.volume * 0.45 },
      { freq: 554, tipo: 'square', duracao: 0.08, atraso: 0.12, vol: this.volume * 0.5 },
      { freq: 659, tipo: 'square', duracao: 0.12, atraso: 0.18, vol: this.volume * 0.55 },
    ]);
  }

  /**
   * Som de inicio de jogo: fanfarra animada ascendente.
   */
  iniciarJogo() {
    this._tocarSequencia([
      { freq: 523, tipo: 'square', duracao: 0.1, atraso: 0, vol: this.volume * 0.4 },
      { freq: 659, tipo: 'square', duracao: 0.1, atraso: 0.1, vol: this.volume * 0.45 },
      { freq: 784, tipo: 'square', duracao: 0.1, atraso: 0.2, vol: this.volume * 0.5 },
      { freq: 1047, tipo: 'square', duracao: 0.2, atraso: 0.3, vol: this.volume * 0.55 },
    ]);
  }

  /**
   * Som de novo recorde: fanfarra triunfal com harmonias.
   */
  novoRecorde() {
    this._tocarSequencia([
      { freq: 523, tipo: 'square', duracao: 0.12, atraso: 0, vol: this.volume * 0.4 },
      { freq: 659, tipo: 'square', duracao: 0.12, atraso: 0.1, vol: this.volume * 0.45 },
      { freq: 784, tipo: 'square', duracao: 0.12, atraso: 0.2, vol: this.volume * 0.5 },
      { freq: 1047, tipo: 'square', duracao: 0.15, atraso: 0.3, vol: this.volume * 0.5 },
      { freq: 784, tipo: 'square', duracao: 0.1, atraso: 0.45, vol: this.volume * 0.45 },
      { freq: 1047, tipo: 'square', duracao: 0.3, atraso: 0.55, vol: this.volume * 0.55 },
    ]);
    // Harmonia em oitava paralela
    this._tocarSequencia([
      { freq: 1047, tipo: 'sine', duracao: 0.15, atraso: 0.3, vol: this.volume * 0.2 },
      { freq: 1568, tipo: 'sine', duracao: 0.1, atraso: 0.45, vol: this.volume * 0.15 },
      { freq: 2093, tipo: 'sine', duracao: 0.3, atraso: 0.55, vol: this.volume * 0.2 },
    ]);
  }

  // ---- Multiplayer ----

  /**
   * Som de eliminacao no multiplayer: impacto forte.
   */
  eliminacao() {
    this._tocarTom(200, 'sawtooth', 0.15, 60, this.volume * 0.45);
    this._tocarRuido(0.12, this.volume * 0.3);
  }

  /**
   * Som de segmento removido: hit rapido.
   */
  segmentoRemovido() {
    this._tocarTom(300, 'square', 0.08, 100, this.volume * 0.35);
  }

  /**
   * Som de alerta: arena encolhendo (sirene curta).
   */
  arenaEncolhendo() {
    this._tocarSequencia([
      { freq: 600, tipo: 'sawtooth', duracao: 0.15, atraso: 0, vol: this.volume * 0.3 },
      { freq: 800, tipo: 'sawtooth', duracao: 0.15, atraso: 0.15, vol: this.volume * 0.35 },
      { freq: 600, tipo: 'sawtooth', duracao: 0.15, atraso: 0.3, vol: this.volume * 0.3 },
      { freq: 800, tipo: 'sawtooth', duracao: 0.15, atraso: 0.45, vol: this.volume * 0.35 },
    ]);
  }

  /**
   * Som de partida finalizada no multiplayer: resultado.
   */
  partidaFinalizada() {
    this._tocarSequencia([
      { freq: 523, tipo: 'square', duracao: 0.15, atraso: 0, vol: this.volume * 0.4 },
      { freq: 659, tipo: 'square', duracao: 0.15, atraso: 0.15, vol: this.volume * 0.45 },
      { freq: 784, tipo: 'square', duracao: 0.15, atraso: 0.3, vol: this.volume * 0.5 },
      { freq: 1047, tipo: 'square', duracao: 0.4, atraso: 0.45, vol: this.volume * 0.55 },
    ]);
  }
}

/* =========================================================================
 * INSTANCIA GLOBAL
 * Singleton acessivel por JogoSolo e ClienteMultijogador.
 * ======================================================================= */
window.som = new SistemaDeSom();
