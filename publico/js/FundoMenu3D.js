/**
 * @fileoverview Fundo 3D animado do menu principal (three.js).
 *
 * Renderiza uma malha de pontos luminosos ondulando como um "oceano
 * de grid" — uma referencia visual a arena do jogo — com leve parallax
 * seguindo o mouse. Estetica inspirada nas landing pages do three.js:
 * profundidade, neblina e brilho aditivo sobre o tema escuro.
 *
 * Carregado como ES module (three.js 0.185 so distribui builds ESM).
 * Se WebGL nao estiver disponivel ou algo falhar, marca
 * window.__fundoMenu3D = false e o menu cai de volta para o fundo 2D
 * de particulas original (definido inline no index.html).
 *
 * Acessibilidade: com "prefers-reduced-motion" ativo, renderiza um
 * unico quadro estatico (sem loop de animacao).
 */

import * as THREE from '/js/vendor/three.module.min.js';

function iniciarFundo3D() {
  const canvas = document.getElementById('canvas-fundo');
  if (!canvas) return false;

  const reduzirMovimento = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const cena = new THREE.Scene();
  cena.fog = new THREE.FogExp2(0x0a0b1e, 0.055);

  const camera = new THREE.PerspectiveCamera(
    60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 3.2, 9);
  camera.lookAt(0, 0, 0);

  /* --- Malha de pontos (o "oceano de grid" da arena) --- */

  const ehTelaPequena = window.innerWidth < 700;
  const LADO = ehTelaPequena ? 46 : 72;   // Pontos por lado
  const ESPACO = 0.42;                    // Distancia entre pontos
  const total = LADO * LADO;

  const posicoes = new Float32Array(total * 3);
  const cores = new Float32Array(total * 3);

  // Paleta do jogo: verde dominante + acentos ocasionais
  const corPrimaria = new THREE.Color('#00ff88');
  const acentos = ['#ff4488', '#4499ff', '#ffaa00', '#bb55ff']
    .map(c => new THREE.Color(c));

  let i3 = 0;
  for (let x = 0; x < LADO; x++) {
    for (let z = 0; z < LADO; z++) {
      posicoes[i3]     = (x - LADO / 2) * ESPACO;
      posicoes[i3 + 1] = 0;
      posicoes[i3 + 2] = (z - LADO / 2) * ESPACO;

      // ~6% dos pontos ganham cor de acento (como comidas espalhadas)
      const cor = Math.random() < 0.06
        ? acentos[Math.floor(Math.random() * acentos.length)]
        : corPrimaria;
      const brilho = 0.35 + Math.random() * 0.65;
      cores[i3]     = cor.r * brilho;
      cores[i3 + 1] = cor.g * brilho;
      cores[i3 + 2] = cor.b * brilho;

      i3 += 3;
    }
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  geometria.setAttribute('color', new THREE.BufferAttribute(cores, 3));

  const material = new THREE.PointsMaterial({
    size: 0.055,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const pontos = new THREE.Points(geometria, material);
  cena.add(pontos);

  /* --- Interacao e animacao --- */

  const mouse = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (reduzirMovimento) renderer.render(cena, camera);
  });

  const atributoPos = geometria.getAttribute('position');

  function ondular(tempo) {
    // Ondas senoidais cruzadas: o grid "respira" como um oceano
    for (let p = 0; p < total; p++) {
      const ix = p * 3;
      const x = atributoPos.array[ix];
      const z = atributoPos.array[ix + 2];
      atributoPos.array[ix + 1] =
        Math.sin(x * 0.55 + tempo * 0.9) * 0.32 +
        Math.cos(z * 0.48 + tempo * 0.65) * 0.28;
    }
    atributoPos.needsUpdate = true;
  }

  function quadro(ms) {
    const tempo = ms * 0.001;
    ondular(tempo);

    // Parallax suave da camera em direcao ao mouse
    camera.position.x += (mouse.x * 1.4 - camera.position.x) * 0.03;
    camera.position.y += (3.2 - mouse.y * 0.8 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    pontos.rotation.y = tempo * 0.02;

    renderer.render(cena, camera);
    requestAnimationFrame(quadro);
  }

  if (reduzirMovimento) {
    ondular(1.5);
    renderer.render(cena, camera);
  } else {
    requestAnimationFrame(quadro);
  }

  return true;
}

try {
  window.__fundoMenu3D = iniciarFundo3D();
} catch (erro) {
  console.warn('[FundoMenu3D] WebGL indisponível, usando fundo 2D:', erro);
  window.__fundoMenu3D = false;
}
