/**
 * @fileoverview Animacoes de interface do Snakis, construidas sobre o
 * anime.js v4 (vendorizado em /js/vendor/anime.umd.min.js).
 *
 * Todas as funcoes degradam com elegancia: se o anime.js nao carregar
 * (ou o usuario preferir menos movimento), a interface simplesmente
 * aparece sem animacao — nunca quebra.
 *
 * Uso: AnimacoesUI.telaEntrou(elemento), AnimacoesUI.listaEmCascata(...)
 */

const AnimacoesUI = (() => {
  /** Detecta anime.js v4 carregado (global `anime` com .animate) */
  function temAnime() {
    return typeof window.anime === 'object' &&
           typeof window.anime.animate === 'function';
  }

  /** Respeita a preferencia do usuario por menos movimento */
  function reduzirMovimento() {
    return window.matchMedia &&
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function podeAnimar() {
    return temAnime() && !reduzirMovimento();
  }

  return {
    /**
     * Entrada suave de uma tela inteira (fade + leve subida).
     * @param {HTMLElement} elemento - Container da tela recem-exibida.
     */
    telaEntrou(elemento) {
      if (!elemento || !podeAnimar()) return;
      window.anime.animate(elemento, {
        opacity: [0, 1],
        y: [14, 0],
        duration: 380,
        ease: 'outQuad',
      });
    },

    /**
     * Revela os itens de uma lista em cascata (stagger).
     * @param {HTMLElement} container - Elemento pai da lista.
     * @param {string} seletor - Seletor dos itens (ex: '.ranking-item').
     */
    listaEmCascata(container, seletor) {
      if (!container || !podeAnimar()) return;
      const itens = container.querySelectorAll(seletor);
      if (itens.length === 0) return;
      window.anime.animate(itens, {
        opacity: [0, 1],
        x: [-18, 0],
        duration: 420,
        delay: window.anime.stagger(70),
        ease: 'outQuad',
      });
    },

    /**
     * Pulso rapido de destaque (ex: novo recorde, vitoria).
     * @param {HTMLElement} elemento
     */
    pulso(elemento) {
      if (!elemento || !podeAnimar()) return;
      window.anime.animate(elemento, {
        scale: [1, 1.08, 1],
        duration: 550,
        ease: 'inOutQuad',
      });
    },

    /**
     * Conta um numero de 0 ate o valor final dentro do elemento.
     * Implementado a mao (requestAnimationFrame): funciona mesmo
     * sem anime.js e formata em pt-BR.
     * @param {HTMLElement} elemento - Onde escrever o numero.
     * @param {number} valorFinal - Valor a atingir.
     * @param {number} [duracao] - Duracao em ms (padrao 900).
     */
    contarAte(elemento, valorFinal, duracao = 900) {
      if (!elemento) return;
      const final = Number(valorFinal) || 0;

      if (reduzirMovimento() || final === 0) {
        elemento.textContent = final.toLocaleString('pt-BR');
        return;
      }

      const inicio = performance.now();
      const passo = (agora) => {
        const t = Math.min(1, (agora - inicio) / duracao);
        const suave = 1 - Math.pow(1 - t, 3); // easeOutCubic
        elemento.textContent = Math.round(final * suave).toLocaleString('pt-BR');
        if (t < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    },
  };
})();

window.AnimacoesUI = AnimacoesUI;
