/**
 * @fileoverview Servidor principal do jogo Snake multiplayer.
 *
 * Este modulo configura o Express para servir os arquivos estaticos da
 * interface e o Socket.IO para comunicacao em tempo real. Gerencia
 * a criacao/destruicao de salas de jogo e o roteamento de eventos
 * entre os clientes conectados.
 *
 * Padrao utilizado: Mediator Pattern - o servidor atua como mediador
 * central de comunicacao entre os clientes, encaminhando mensagens
 * e coordenando o estado das salas.
 *
 * Uso: node servidor.js
 * O servidor escuta na porta definida pela variavel de ambiente PORTA
 * ou na porta 3000 por padrao.
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const SalaDeJogo = require('./jogo/SalaDeJogo');

/* =========================================================================
 * INICIALIZACAO DO SERVIDOR
 * ======================================================================= */

const aplicacao = express();
const servidorHttp = createServer(aplicacao);

/**
 * Configuracao do Socket.IO com CORS liberado para permitir
 * conexoes de qualquer origem na rede local.
 */
const io = new Server(servidorHttp, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

/** Porta do servidor (variavel de ambiente ou padrao 3000) */
const PORTA = process.env.PORTA || 3000;

/** Servir arquivos estaticos da pasta 'publico' */
aplicacao.use(express.static(path.join(__dirname, 'publico')));

/* =========================================================================
 * GERENCIAMENTO DE SALAS E JOGADORES
 * ======================================================================= */

/** @type {Map<string, SalaDeJogo>} Mapa de codigo da sala -> instancia */
const salas = new Map();

/** @type {Map<string, string>} Mapa de socketId do jogador -> codigo da sala */
const jogadorParaSala = new Map();

/**
 * Gera um codigo alfanumerico aleatorio para identificar uma sala.
 * O codigo eh curto o suficiente para ser compartilhado verbalmente.
 * @returns {string} Codigo de 5 caracteres em maiusculas.
 */
function gerarCodigoSala() {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sem I/1/O/0 para evitar confusao
  let codigo = '';
  for (let i = 0; i < 5; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  // Verificar unicidade (colisao eh improvavel, mas prevenir nao custa)
  return salas.has(codigo) ? gerarCodigoSala() : codigo;
}

/**
 * Obtem o endereco IP local da maquina na rede (IPv4, nao-loopback).
 * Usado para exibir o endereco de acesso na rede local.
 * @returns {string} Endereco IP local ou 'localhost' se nao encontrado.
 */
function obterIpLocal() {
  const interfaces = os.networkInterfaces();
  for (const nome of Object.keys(interfaces)) {
    for (const iface of interfaces[nome]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Garante que o callback de um evento seja sempre uma funcao chamavel.
 * Clientes maliciosos podem omitir o callback ou enviar outro tipo —
 * chamar algo que nao eh funcao derrubaria o handler.
 * @param {*} callback - Valor recebido do cliente.
 * @returns {Function} Callback seguro.
 */
function callbackSeguro(callback) {
  return typeof callback === 'function' ? callback : () => {};
}

/**
 * Envolve um handler de evento em try/catch para que nenhuma excecao
 * (payload inesperado, bug interno) derrube o processo do servidor.
 * @param {string} nome - Nome do evento (para log).
 * @param {Function} handler - Handler original.
 * @returns {Function} Handler protegido.
 */
function handlerSeguro(nome, handler) {
  return (...args) => {
    try {
      handler(...args);
    } catch (erro) {
      console.error(`[Erro] Evento "${nome}" falhou:`, erro.message);
    }
  };
}

/* =========================================================================
 * EVENTOS DO SOCKET.IO
 * Cada evento corresponde a uma acao do cliente. O servidor valida
 * a acao e atualiza o estado conforme necessario.
 * ======================================================================= */

io.on('connection', (socket) => {
  console.log(`[Conexao] Jogador conectado: ${socket.id}`);

  /** Registra um evento com protecao automatica contra excecoes */
  const registrar = (nome, handler) => socket.on(nome, handlerSeguro(nome, handler));

  /* -----------------------------------------------------------------------
   * LOBBY: Listar, criar e entrar em salas
   * --------------------------------------------------------------------- */

  /**
   * Retorna a lista de salas disponiveis para o lobby do multiplayer.
   * Filtra apenas salas que ainda estao aguardando jogadores.
   */
  registrar('listar-salas', (callback) => {
    const responder = callbackSeguro(callback);
    const listaSalas = [];
    for (const [codigo, sala] of salas) {
      if (sala.estado === 'aguardando') {
        listaSalas.push({
          codigo,
          jogadores: sala.obterQuantidadeJogadores(),
          maxJogadores: sala.maxJogadores,
          estado: sala.estado,
        });
      }
    }
    responder(listaSalas);
  });

  /**
   * Cria uma nova sala de jogo e adiciona o jogador como primeiro participante.
   * Retorna o codigo da sala criada para que outros possam entrar.
   */
  registrar('criar-sala', (dados, callback) => {
    const responder = callbackSeguro(callback);
    const apelido = dados && dados.apelido;

    // Se ja esta em uma sala, sair primeiro
    _sairDaSalaAtual(socket);

    const codigo = gerarCodigoSala();
    const sala = new SalaDeJogo(codigo, io);
    salas.set(codigo, sala);

    // Entrar na room do Socket.IO e registrar o jogador
    socket.join(codigo);
    sala.adicionarJogador(socket.id, apelido);
    jogadorParaSala.set(socket.id, codigo);

    console.log(`[Sala] "${apelido}" criou a sala ${codigo}`);
    responder({ sucesso: true, codigo });

    // Notificar todos os participantes da sala sobre a atualizacao
    io.to(codigo).emit('sala-atualizada', sala.obterInfoSala());
  });

  /**
   * Adiciona o jogador a uma sala existente identificada pelo codigo.
   * Valida se a sala existe, esta aberta e tem vagas.
   */
  registrar('entrar-sala', (dados, callback) => {
    const responder = callbackSeguro(callback);
    const codigo = dados && dados.codigo;
    const apelido = dados && dados.apelido;

    if (typeof codigo !== 'string') {
      responder({ sucesso: false, erro: 'Código inválido.' });
      return;
    }

    _sairDaSalaAtual(socket);

    const codigoNormalizado = codigo.toUpperCase().trim();
    const sala = salas.get(codigoNormalizado);

    if (!sala) {
      responder({ sucesso: false, erro: 'Sala não encontrada.' });
      return;
    }

    if (sala.estado !== 'aguardando') {
      responder({ sucesso: false, erro: 'A partida já está em andamento.' });
      return;
    }

    if (sala.obterQuantidadeJogadores() >= sala.maxJogadores) {
      responder({ sucesso: false, erro: 'A sala está cheia.' });
      return;
    }

    socket.join(codigoNormalizado);
    sala.adicionarJogador(socket.id, apelido);
    jogadorParaSala.set(socket.id, codigoNormalizado);

    console.log(`[Sala] "${apelido}" entrou na sala ${codigoNormalizado}`);
    responder({ sucesso: true, codigo: codigoNormalizado });

    io.to(codigoNormalizado).emit('sala-atualizada', sala.obterInfoSala());
  });

  /* -----------------------------------------------------------------------
   * SALA: Prontidao e inicio de partida
   * --------------------------------------------------------------------- */

  /**
   * Alterna o estado de "pronto" do jogador na sala.
   * Quando todos estiverem prontos, o jogo pode ser iniciado.
   */
  registrar('jogador-pronto', () => {
    const codigo = jogadorParaSala.get(socket.id);
    if (!codigo) return;

    const sala = salas.get(codigo);
    if (!sala) return;

    sala.marcarPronto(socket.id);
    io.to(codigo).emit('sala-atualizada', sala.obterInfoSala());
  });

  /**
   * Inicia a partida se todas as condicoes forem atendidas.
   * Qualquer jogador pode solicitar o inicio.
   */
  registrar('iniciar-partida', () => {
    const codigo = jogadorParaSala.get(socket.id);
    if (!codigo) return;

    const sala = salas.get(codigo);
    if (!sala) return;

    if (sala.podeIniciar()) {
      sala.iniciarJogo();
      io.to(codigo).emit('partida-iniciada');
      console.log(`[Jogo] Partida iniciada na sala ${codigo}`);
    }
  });

  /* -----------------------------------------------------------------------
   * JOGO: Movimentacao
   * --------------------------------------------------------------------- */

  /**
   * Recebe a mudanca de direcao de um jogador e encaminha para a sala.
   * A validacao da direcao (anti-180°) eh feita na SalaDeJogo.
   */
  registrar('mudar-direcao', (direcao) => {
    const codigo = jogadorParaSala.get(socket.id);
    if (!codigo) return;

    const sala = salas.get(codigo);
    if (!sala) return;

    sala.mudarDirecao(socket.id, direcao);
  });

  /* -----------------------------------------------------------------------
   * SALA: Gerenciamento de bots
   * --------------------------------------------------------------------- */

  /**
   * Adiciona um bot a sala do jogador.
   */
  registrar('adicionar-bot', (callback) => {
    const responder = callbackSeguro(callback);
    const codigo = jogadorParaSala.get(socket.id);
    if (!codigo) return responder({ sucesso: false, erro: 'Você não está em uma sala.' });

    const sala = salas.get(codigo);
    if (!sala) return responder({ sucesso: false, erro: 'Sala não encontrada.' });

    if (sala.estado !== 'aguardando') {
      return responder({ sucesso: false, erro: 'A partida já está em andamento.' });
    }

    const resultado = sala.adicionarBot();
    responder(resultado);

    if (resultado.sucesso) {
      io.to(codigo).emit('sala-atualizada', sala.obterInfoSala());
    }
  });

  /**
   * Remove o ultimo bot da sala do jogador.
   */
  registrar('remover-bot', (callback) => {
    const responder = callbackSeguro(callback);
    const codigo = jogadorParaSala.get(socket.id);
    if (!codigo) return responder({ sucesso: false, erro: 'Você não está em uma sala.' });

    const sala = salas.get(codigo);
    if (!sala) return responder({ sucesso: false, erro: 'Sala não encontrada.' });

    if (sala.estado !== 'aguardando') {
      return responder({ sucesso: false, erro: 'A partida já está em andamento.' });
    }

    const resultado = sala.removerBot();
    responder(resultado);

    if (resultado.sucesso) {
      io.to(codigo).emit('sala-atualizada', sala.obterInfoSala());
    }
  });

  /**
   * Altera o tempo da partida.
   */
  registrar('alterar-tempo-partida', (segundos, callback) => {
    const responder = callbackSeguro(callback);
    const codigo = jogadorParaSala.get(socket.id);
    if (!codigo) return responder({ sucesso: false });

    const sala = salas.get(codigo);
    if (!sala || sala.estado !== 'aguardando') return responder({ sucesso: false });

    sala.alterarTempoPartida(segundos);
    responder({ sucesso: true });
    io.to(codigo).emit('sala-atualizada', sala.obterInfoSala());
  });

  /**
   * Altera a dificuldade dos bots na sala.
   */
  registrar('alterar-dificuldade-bots', (nivel, callback) => {
    const responder = callbackSeguro(callback);
    const codigo = jogadorParaSala.get(socket.id);
    if (!codigo) return responder({ sucesso: false });

    const sala = salas.get(codigo);
    if (!sala || sala.estado !== 'aguardando') return responder({ sucesso: false });

    sala.alterarDificuldadeBots(nivel);
    responder({ sucesso: true });
    io.to(codigo).emit('sala-atualizada', sala.obterInfoSala());
  });

  /**
   * Revanche: reabre a sala finalizada para uma nova partida,
   * mantendo jogadores, bots e configurações.
   */
  registrar('voltar-sala', (callback) => {
    const responder = callbackSeguro(callback);
    const codigo = jogadorParaSala.get(socket.id);
    if (!codigo) return responder({ sucesso: false, erro: 'Você não está em uma sala.' });

    const sala = salas.get(codigo);
    if (!sala) return responder({ sucesso: false, erro: 'Sala não encontrada.' });

    if (!sala.reiniciarParaLobby()) {
      return responder({ sucesso: false, erro: 'A partida ainda está em andamento.' });
    }

    responder({ sucesso: true, codigo });
    io.to(codigo).emit('sala-atualizada', sala.obterInfoSala());
  });

  /* -----------------------------------------------------------------------
   * SALA: Sair e voltar ao lobby
   * --------------------------------------------------------------------- */

  /**
   * Jogador solicita sair da sala voluntariamente.
   */
  registrar('sair-sala', () => {
    _sairDaSalaAtual(socket);
  });

  /* -----------------------------------------------------------------------
   * DESCONEXAO
   * --------------------------------------------------------------------- */

  /**
   * Limpa os dados do jogador ao desconectar (fechar aba, perder conexao).
   */
  registrar('disconnect', () => {
    console.log(`[Conexao] Jogador desconectado: ${socket.id}`);
    _sairDaSalaAtual(socket);
  });
});

/* =========================================================================
 * FUNCOES AUXILIARES
 * ======================================================================= */

/**
 * Remove o jogador da sala em que esta atualmente (se estiver em alguma).
 * Limpa a sala caso fique vazia.
 * @param {import('socket.io').Socket} socket - Socket do jogador.
 */
function _sairDaSalaAtual(socket) {
  const codigo = jogadorParaSala.get(socket.id);
  if (!codigo) return;

  const sala = salas.get(codigo);
  if (sala) {
    sala.removerJogador(socket.id);
    socket.leave(codigo);

    // Notificar demais jogadores
    io.to(codigo).emit('sala-atualizada', sala.obterInfoSala());

    // Limpar sala quando nao houver mais jogadores humanos
    if (sala.obterQuantidadeHumanos() === 0) {
      sala.parar();
      salas.delete(codigo);
      console.log(`[Sala] Sala ${codigo} removida (vazia)`);
    }
  }

  jogadorParaSala.delete(socket.id);
}

/* =========================================================================
 * INICIAR O SERVIDOR
 * ======================================================================= */

servidorHttp.listen(PORTA, '0.0.0.0', () => {
  const ipLocal = obterIpLocal();

  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║       🐍  SNAKIS - Servidor Rastejando!      ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║  Local:  http://localhost:${PORTA}              ║`);
  console.log(`  ║  Rede:   http://${ipLocal}:${PORTA}          ║`);
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log('  ║  Compartilhe o endereco de rede com seus     ║');
  console.log('  ║  amigos e descubra quem e a cobra suprema!   ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});
