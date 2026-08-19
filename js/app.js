/* =========================================================
   PÉGASO — app.js
   Partículas (Three.js) · Scrolltelling (GSAP) · Rolagem (Lenis)
   ========================================================= */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  if (REDUCED) root.classList.add('no-motion');

  // Resolvido no boot: neste ponto as bibliotecas ainda não foram executadas.
  var hasGSAP = false;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  var BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  /* =======================================================
     ( 00 ) PORTÃO DO HARAS
     ======================================================= */
  function gate() {
    var el = $('#gate'), num = $('#gateCount'), bar = $('#gateBar');
    if (!el) { root.classList.add('is-ready'); return; }
    document.body.classList.add('is-locked');

    var value = 0, loaded = false, start = performance.now();
    var CAP = 4000;   // teto duro: o portão abre mesmo com fotos ou CDN pendentes
    window.addEventListener('load', function () { loaded = true; });

    function open() {
      el.classList.add('is-open');
      document.body.classList.remove('is-locked');
      root.classList.add('is-ready');
      setTimeout(function () {
        el.setAttribute('hidden', '');
        if (hasGSAP) ScrollTrigger.refresh();
      }, 950);
    }

    function tick(now) {
      var elapsed = now - start;
      if (elapsed >= CAP) {
        value = 100;
      } else {
        var free = loaded || elapsed >= CAP;
        var ceiling = free ? 100 : Math.min(88, elapsed / 14);
        value = Math.min(ceiling, value + Math.max(free ? 2.8 : 0.9, (ceiling - value) * 0.12));
      }
      var shown = Math.floor(value);
      num.textContent = ('00' + shown).slice(-3);
      bar.style.width = value.toFixed(1) + '%';
      if (shown >= 100) { setTimeout(open, 200); return; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* =======================================================
     ROLAGEM SUAVE (LENIS)
     ======================================================= */
  var lenis = null;
  function smoothScroll() {
    if (REDUCED || typeof window.Lenis === 'undefined' || !hasGSAP) return;
    lenis = new Lenis({ duration: 1.15, lerp: 0.095, wheelMultiplier: 1, touchMultiplier: 1.6 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function anchors() {
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id === '#') return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        if (lenis) lenis.scrollTo(target, { offset: -64 });
        else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  /* =======================================================
     NAVEGAÇÃO FIXA
     ======================================================= */
  function nav() {
    var el = $('#nav'); if (!el) return;
    var on = false;
    function upd() {
      var should = window.scrollY > 40;
      if (should !== on) { on = should; el.classList.toggle('is-stuck', should); }
    }
    upd();
    window.addEventListener('scroll', upd, { passive: true });
  }

  /* =======================================================
     ( 01 ) ANATOMIA — CAVALO DE SELA, FORMATO "QUADRADO"
     -------------------------------------------------------
     Proporções de referência, com a altura da cernelha H = 468:
       corpo (ponta da espádua → nádega) ≈ H     → formato quadrado
       solo → cotovelo ≈ H/2                     → membros longos
       cabeça ≈ 0,40 H  ·  pescoço (nuca → cernelha) ≈ 1,5 cabeças
       profundidade do tronco (cernelha → ventre) ≈ H/2
     A cernelha é um pico acima da linha do dorso, o dorso é curto e
     levemente côncavo e a garupa sobe de novo: é esse "S" do perfil
     dorsal que separa o cavalo do asinino, cujo dorso é plano.
     ======================================================= */
  var ANAT = {
    W: 1000, H: 700, GROUND: 658,
    // membros: origem, comprimentos dos segmentos e larguras nas juntas
    fore: { len: [138, 104, 34], w: [52, 28, 20, 16] },
    hind: { len: [154, 110, 34], w: [88, 32, 21, 16] },
    // A origem fica DENTRO do tronco (escápula / coxa), não na borda:
    // assim o topo do membro nunca abre fenda contra a linha do peito.
    // [perto, longe] — o pequeno desvio sugere profundidade
    foreAt: [[358, 386], [334, 392]],
    hindAt: [[736, 372], [764, 370]],
    // ângulos de repouso de cada cadeia (0 = a pino, positivo = à frente)
    foreRest: [0.02, 0.00, 0.50],
    hindRest: [-0.30, 0.16, 0.50]
  };

  // Cadeia cinemática direta: devolve as posições das juntas.
  function chain(origin, lens, angles) {
    var pts = [[origin[0], origin[1]]];
    for (var i = 0; i < lens.length; i++) {
      pts.push([
        pts[i][0] - Math.sin(angles[i]) * lens[i],
        pts[i][1] + Math.cos(angles[i]) * lens[i]
      ]);
    }
    return pts;
  }

  // Assenta o casco no chão girando só a quartela — evita o pé
  // "flutuando" nos extremos do apoio, quando o membro está inclinado.
  function plant(pts, lenLast, ground) {
    var f = pts[pts.length - 2];
    var dy = ground - f[1];
    if (dy <= 0 || dy >= lenLast) return pts;
    var a = Math.acos(clamp(dy / lenLast, -1, 1));
    pts[pts.length - 1] = [f[0] - Math.sin(a) * lenLast, ground];
    return pts;
  }

  /* --- ciclo de marcha ------------------------------------
     Marcha é andamento de 4 tempos sem suspensão: o apoio ocupa
     ~62% do ciclo de cada membro, o que produz os momentos de
     tríplice apoio que o laudo mede. Fases dos quatro membros na
     ordem da marcha batida (posterior → diagonal anterior).      */
  var STANCE = 0.62;
  var LEG_PHASE = [0.65, 0.15, 0.00, 0.50]; // ant.perto, ant.longe, post.perto, post.longe

  function swingEase(v) { return v * v * (3 - 2 * v); }

  function foreAngles(p) {
    var REACH = 0.36, TRAIL = -0.30, th1, fold = 0;
    if (p < STANCE) {
      th1 = REACH + (TRAIL - REACH) * (p / STANCE);
    } else {
      var v = (p - STANCE) / (1 - STANCE);
      th1 = TRAIL + (REACH - TRAIL) * swingEase(v);
      fold = Math.sin(Math.PI * v) * 1.15;
    }
    return [th1, th1 * 0.9 - fold, th1 * 0.9 - fold + 0.42];
  }

  function hindAngles(p) {
    var REACH = 0.34, TRAIL = -0.32, r = ANAT.hindRest, d, fold = 0;
    if (p < STANCE) {
      d = REACH + (TRAIL - REACH) * (p / STANCE);
    } else {
      var v = (p - STANCE) / (1 - STANCE);
      d = TRAIL + (REACH - TRAIL) * swingEase(v);
      fold = Math.sin(Math.PI * v) * 1.05;
    }
    return [r[0] + d, r[1] + d * 0.8 + fold, r[2] + d * 0.5 + fold * 0.5];
  }

  // Juntas de um membro (0..3) na fase global t do ciclo. `bob` desloca
  // a origem junto com o tronco — sem isso o membro descola do corpo.
  function legJoints(i, t, bob) {
    var p = (t + LEG_PHASE[i]) % 1;
    if (p < 0) p += 1;
    var fore = i < 2;
    var cfg = fore ? ANAT.fore : ANAT.hind;
    var a0 = (fore ? ANAT.foreAt : ANAT.hindAt)[i % 2];
    var at = [a0[0], a0[1] + (bob || 0)];
    var pts = chain(at, cfg.len, fore ? foreAngles(p) : hindAngles(p));
    if (p < STANCE) plant(pts, cfg.len[2], ANAT.GROUND);
    return { pts: pts, w: cfg.w, phase: p };
  }

  // Oscilação vertical do tronco: dois ciclos por passada, discreta.
  function bodyBob(t) { return Math.sin(t * Math.PI * 4) * 3.2; }

  /* --- desenho da silhueta -------------------------------- */

  // Segmento afilado + junta arredondada: dá o "osso" do membro.
  function bone(ctx, a, b, wa, wb) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    var nx = -dy / L, ny = dx / L;
    ctx.beginPath();
    ctx.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2);
    ctx.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2);
    ctx.lineTo(b[0] - nx * wb / 2, b[1] - ny * wb / 2);
    ctx.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); ctx.arc(b[0], b[1], wb / 2, 0, Math.PI * 2); ctx.fill();
  }

  function drawLeg(ctx, leg) {
    var p = leg.pts, w = leg.w;
    for (var i = 0; i < 3; i++) bone(ctx, p[i], p[i + 1], w[i], w[i + 1]);
    // casco pequeno, alinhado com a quartela para não se soltar do membro
    var h = p[3], d = [p[3][0] - p[2][0], p[3][1] - p[2][1]];
    var L = Math.hypot(d[0], d[1]) || 1, ang = Math.atan2(d[1], d[0]);
    ctx.beginPath();
    ctx.ellipse(h[0] - d[0] / L * 4, h[1] - d[1] / L * 4, 13, 9, ang, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tronco, pescoço e cabeça — um só contorno fechado.
  function drawTrunk(ctx) {
    ctx.beginPath();
    ctx.moveTo(96, 258);
    ctx.bezierCurveTo(128, 200, 158, 150, 190, 104);   // chanfro
    ctx.bezierCurveTo(252, 98, 330, 132, 392, 202);    // crista arqueada
    ctx.bezierCurveTo(408, 196, 422, 176, 448, 184);   // CERNELHA: pico nítido
    ctx.bezierCurveTo(496, 200, 530, 230, 578, 238);   // dorso curto e côncavo
    ctx.bezierCurveTo(624, 244, 664, 224, 700, 206);   // lombo subindo
    ctx.bezierCurveTo(728, 197, 750, 200, 768, 214);   // garupa longa
    ctx.bezierCurveTo(778, 221, 792, 246, 796, 286);   // nádega
    ctx.bezierCurveTo(800, 330, 788, 366, 762, 392);   // ísquio
    ctx.bezierCurveTo(738, 410, 716, 414, 694, 408);   // soldra
    ctx.bezierCurveTo(650, 416, 596, 430, 534, 434);   // ventre
    ctx.bezierCurveTo(470, 436, 410, 430, 358, 420);   // ventre → cotovelo
    ctx.bezierCurveTo(332, 414, 314, 398, 308, 374);   // peito
    ctx.bezierCurveTo(300, 334, 284, 288, 262, 234);   // pescoço, borda inferior
    ctx.bezierCurveTo(256, 220, 248, 208, 242, 198);   // garganta
    ctx.bezierCurveTo(240, 224, 234, 248, 220, 266);   // ganacha
    ctx.bezierCurveTo(194, 286, 158, 298, 126, 299);   // mandíbula
    ctx.bezierCurveTo(106, 299, 92, 288, 90, 272);     // focinho, base
    ctx.bezierCurveTo(89, 264, 92, 259, 96, 258);
    ctx.closePath();
    ctx.fill();
  }

  // Só tronco + orelhas: é a máscara da parte "corpo" na amostragem.
  function drawTrunkOnly(ctx) { drawTrunk(ctx); drawEars(ctx); }

  function drawEars(ctx) {
    [[[180, 112], [166, 60], [198, 100]], [[204, 102], [214, 52], [228, 104]]]
      .forEach(function (e) {
        ctx.beginPath();
        ctx.moveTo(e[0][0], e[0][1]);
        ctx.lineTo(e[1][0], e[1][1]);
        ctx.lineTo(e[2][0], e[2][1]);
        ctx.closePath();
        ctx.fill();
      });
  }

  // Crina: um espessamento suave da crista, com a borda superior
  // ondulada. Decisão deliberada — mechas destacadas na silhueta
  // sempre leem como espinhos; o vento vive na ANIMAÇÃO das
  // partículas (onda que corre da nuca à cernelha), não no contorno.
  function drawMane(ctx, sway) {
    var s = sway || 0;
    ctx.beginPath();
    ctx.moveTo(192, 98);
    ctx.bezierCurveTo(214, 74 - s * 2, 254, 70 - s * 3, 286, 84 - s * 3);
    ctx.bezierCurveTo(316, 106 - s * 2, 350, 142, 384, 192);
    ctx.lineTo(392, 204);
    ctx.bezierCurveTo(336, 144, 258, 108, 190, 112);                // volta por DENTRO da crista
    ctx.closePath();
    ctx.fill();
    // topete curto entre as orelhas
    ctx.beginPath();
    ctx.moveTo(196, 98);
    ctx.quadraticCurveTo(180, 114, 172, 142);
    ctx.quadraticCurveTo(186, 120, 212, 106);
    ctx.closePath();
    ctx.fill();
  }

  // Cauda de inserção alta: nasce dentro da garupa, quase no nível
  // dela, e desce cheia até afinar na ponta. Um contorno só — mechas
  // desenhadas ao lado abrem frestas escuras e viram leque listrado.
  var TAIL_SPINE = [[732, 226], [806, 222], [858, 262], [900, 332], [926, 414], [938, 494], [934, 554]];
  var TAIL_W = [44, 54, 60, 56, 44, 26, 8];

  function drawTail(ctx, sway) {
    var s = sway || 0, n = TAIL_SPINE.length;
    function at(i) {
      var k = i / (n - 1), p = TAIL_SPINE[i];
      return [p[0] + s * 12 * k * k, p[1] - s * 5 * k * k];
    }
    var left = [], right = [];
    for (var i = 0; i < n; i++) {
      var a = at(i), b = at(Math.min(i + 1, n - 1)), c = at(Math.max(i - 1, 0));
      var dx = b[0] - c[0], dy = b[1] - c[1], L = Math.hypot(dx, dy) || 1;
      var nx = -dy / L * TAIL_W[i] / 2, ny = dx / L * TAIL_W[i] / 2;
      left.push([a[0] + nx, a[1] + ny]);
      right.unshift([a[0] - nx, a[1] - ny]);
    }
    // contorno suavizado: quadráticas pelos pontos médios, para a cauda
    // não ficar com cara de tábua recortada
    var ring = left.concat(right);
    ctx.beginPath();
    var m0 = [(ring[0][0] + ring[ring.length - 1][0]) / 2, (ring[0][1] + ring[ring.length - 1][1]) / 2];
    ctx.moveTo(m0[0], m0[1]);
    for (var k = 0; k < ring.length; k++) {
      var cur = ring[k], nxt = ring[(k + 1) % ring.length];
      ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + nxt[0]) / 2, (cur[1] + nxt[1]) / 2);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Silhueta completa. `t` é a fase do ciclo de marcha (0..1).
  function drawHorse(ctx, W, H, t) {
    var phase = t || 0;
    ctx.save();
    ctx.scale(W / ANAT.W, H / ANAT.H);
    ctx.fillStyle = '#fff';
    var bob = bodyBob(phase);
    // membros do lado oposto primeiro: ficam atrás na leitura
    drawLeg(ctx, legJoints(1, phase));
    drawLeg(ctx, legJoints(3, phase));
    ctx.save();
    ctx.translate(0, bob);
    drawTail(ctx, Math.sin(phase * Math.PI * 2) * 1.2);
    drawTrunk(ctx);
    drawEars(ctx);
    drawMane(ctx, Math.sin(phase * Math.PI * 2 + 0.7) * 1.2);
    ctx.restore();
    drawLeg(ctx, legJoints(0, phase));
    drawLeg(ctx, legJoints(2, phase));
    ctx.restore();
  }

  // Amostra a silhueta e devolve listas de pontos internos e de contorno.
  function sampleSilhouette() {
    var W = 1000, H = 700;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    drawHorse(ctx, W, H);
    var data = ctx.getImageData(0, 0, W, H).data;
    var at = function (x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return 0;
      return data[(y * W + x) * 4 + 3];
    };
    var inside = [], edge = [], step = 2, e = 4;
    for (var y = 0; y < H; y += step) {
      for (var x = 0; x < W; x += step) {
        if (at(x, y) < 128) continue;
        var isEdge = at(x + e, y) < 128 || at(x - e, y) < 128 || at(x, y + e) < 128 || at(x, y - e) < 128;
        (isEdge ? edge : inside).push(x, y);
      }
    }
    return { inside: inside, edge: edge, W: W, H: H };
  }

  /* =======================================================
     ( 02 ) ASA — geometria das asas de Pégaso
     ======================================================= */
  // A asa precisa subir MUITO acima da linha do dorso, senão o leque se
  // confunde com a garupa e a cauda. Por isso ela vive numa tela própria,
  // mais alta, deslocada por OY — o espaço de 700px do cavalo não cabe
  // uma envergadura que se erga de verdade.
  var WING = { W: 1100, H: 1120, OY: 430, ROOT: [432, 216] };

  var WING_FEATHERS = [
    [[470, 150], [498, 336], 30], [[520, 68], [598, 306], 30],
    [[574, -12], [688, 258], 29], [[628, -92], [772, 196], 28],
    [[682, -168], [842, 124], 26], [[732, -228], [890, 44], 24],
    [[778, -278], [922, -44], 21]
  ];

  function drawWing(ctx) {
    ctx.save();
    ctx.translate(0, WING.OY);
    ctx.fillStyle = '#fff';
    // membrana: sobe da espádua, arqueia para trás e para cima
    ctx.beginPath();
    ctx.moveTo(430, 232);
    ctx.bezierCurveTo(474, 120, 566, -30, 682, -150);
    ctx.bezierCurveTo(736, -206, 790, -262, 812, -276);
    ctx.bezierCurveTo(830, -286, 838, -268, 818, -232);
    ctx.bezierCurveTo(776, -156, 706, -54, 628, 44);
    ctx.bezierCurveTo(556, 134, 486, 214, 442, 254);
    ctx.bezierCurveTo(418, 274, 412, 262, 430, 232);
    ctx.closePath();
    ctx.fill();
    // rêmiges: lâminas afiladas que ultrapassam a membrana
    WING_FEATHERS.forEach(function (f) {
      var a = f[0], b = f[1], w = f[2];
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      var nx = -dy / L, ny = dx / L;
      ctx.beginPath();
      ctx.moveTo(a[0] + nx * w / 2, a[1] + ny * w / 2);
      ctx.quadraticCurveTo(a[0] + dx * 0.55 + nx * w * 0.42, a[1] + dy * 0.55 + ny * w * 0.42, b[0], b[1]);
      ctx.quadraticCurveTo(a[0] + dx * 0.55 - nx * w * 0.42, a[1] + dy * 0.55 - ny * w * 0.42,
                           a[0] - nx * w / 2, a[1] - ny * w / 2);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  /* =======================================================
     ( 03 ) AMOSTRAGEM DE MÁSCARAS
     ======================================================= */
  function maskOf(draw, W, H) {
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    draw(ctx);
    var d = ctx.getImageData(0, 0, W, H).data;
    var inside = [], edge = [], e = 4;
    function at(x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return 0;
      return d[((y | 0) * W + (x | 0)) * 4 + 3];
    }
    for (var y = 0; y < H; y += 2) {
      for (var x = 0; x < W; x += 2) {
        if (at(x, y) < 128) continue;
        var isEdge = at(x + e, y) < 128 || at(x - e, y) < 128 || at(x, y + e) < 128 || at(x, y - e) < 128;
        (isEdge ? edge : inside).push(x, y);
      }
    }
    return { inside: inside, edge: edge };
  }

  // Sorteia n pontos de uma máscara, com peso extra no contorno.
  function pick(mask, n, edgeShare, out) {
    var hasEdge = mask.edge.length > 1, hasIn = mask.inside.length > 1;
    if (!hasEdge && !hasIn) return 0;
    for (var i = 0; i < n; i++) {
      var useEdge = hasEdge && (!hasIn || Math.random() < edgeShare);
      var pool = useEdge ? mask.edge : mask.inside;
      var k = (Math.random() * (pool.length / 2)) | 0;
      out.push(pool[k * 2] + (Math.random() - 0.5) * 2.2,
               pool[k * 2 + 1] + (Math.random() - 0.5) * 2.2,
               useEdge ? 1 : 0);
    }
    return n;
  }

  /* =======================================================
     ( 04 ) ALVOS DA METAMORFOSE — RAIO E CONSTELAÇÃO
     ======================================================= */
  function boltMask() {
    return maskOf(function (ctx) {
      ctx.beginPath();
      ctx.moveTo(592, 24); ctx.lineTo(352, 356); ctx.lineTo(496, 356);
      ctx.lineTo(400, 682); ctx.lineTo(762, 270); ctx.lineTo(592, 270);
      ctx.lineTo(760, 24);
      ctx.closePath(); ctx.fill();
    }, ANAT.W, ANAT.H);
  }

  // Asterismo de Pégaso: o Grande Quadrado, o pescoço até Enif e as
  // patas dianteiras. Coordenadas normalizadas de uma carta celeste.
  var PEG_STARS = [
    [0.30, 0.20, 2.4], [0.72, 0.16, 2.1], [0.33, 0.60, 2.5], [0.74, 0.60, 2.8],
    [0.18, 0.72, 3.4], [0.10, 0.63, 3.5], [0.02, 0.82, 2.4],
    [0.19, 0.05, 2.9], [0.10, 0.10, 3.5], [0.14, 0.16, 3.9], [0.02, 0.02, 3.8]
  ];
  var PEG_EDGES = [[0, 1], [1, 3], [3, 2], [2, 0], [2, 4], [4, 5], [5, 6], [0, 7], [7, 9], [9, 10], [7, 8]];

  function starXY(i) {
    return [120 + PEG_STARS[i][0] * 760, 60 + PEG_STARS[i][1] * 560];
  }

  function constellationPoint() {
    var r = Math.random();
    if (r < 0.18) {                                  // aglomerado nas estrelas
      var s = (Math.random() * PEG_STARS.length) | 0;
      var p = starXY(s), spread = 1.6 + PEG_STARS[s][2] * 0.7;
      return [p[0] + (Math.random() - 0.5) * spread, p[1] + (Math.random() - 0.5) * spread, 1];
    }
    if (r < 0.86) {                                  // pó ao longo das linhas
      var e = PEG_EDGES[(Math.random() * PEG_EDGES.length) | 0];
      var a = starXY(e[0]), b = starXY(e[1]), t = Math.random();
      return [a[0] + (b[0] - a[0]) * t + (Math.random() - 0.5) * 9,
              a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * 9, 0];
    }
    return [Math.random() * ANAT.W, Math.random() * ANAT.H, 0];   // céu de fundo
  }

  /* =======================================================
     ( 05 ) NUVEM: CORPO AMOSTRADO + MEMBROS COM ESQUELETO
     ======================================================= */
  var PART = { BODY: 0, MANE: 1, TAIL: 2, LEG: 3 };
  var SCALE = 0.118;

  function toWorld(x, y) { return [(x - 500) * SCALE, -(y - 350) * SCALE]; }

  // Sementes dos membros: cada partícula guarda em que membro, em que
  // segmento e onde dentro dele ela vive. A pose recalcula só isso.
  function legSeeds(total) {
    var seeds = [], weights = [];
    var i, j;
    for (i = 0; i < 4; i++) {
      var cfg = i < 2 ? ANAT.fore : ANAT.hind;
      for (j = 0; j < 3; j++) weights.push(cfg.len[j] * (cfg.w[j] + cfg.w[j + 1]) / 2);
    }
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    for (var k = 0; k < total; k++) {
      var r = Math.random() * sum, acc = 0, idx = 0;
      for (var m = 0; m < weights.length; m++) { acc += weights[m]; if (r <= acc) { idx = m; break; } }
      var leg = (idx / 3) | 0, seg = idx % 3;
      var t = Math.random();
      // metade das partículas encostada na borda: dá nitidez ao osso
      var u = Math.random() < 0.5 ? (Math.random() < 0.5 ? -0.5 : 0.5) * (0.86 + Math.random() * 0.14)
                                  : (Math.random() - 0.5) * 0.9;
      seeds.push(leg, seg, t, u);
    }
    return seeds;
  }

  function buildClouds(budget) {
    var maskBody = maskOf(function (c) { drawTrunkOnly(c); }, ANAT.W, ANAT.H);
    var maskMane = maskOf(function (c) { drawMane(c, 0); }, ANAT.W, ANAT.H);
    var maskTail = maskOf(function (c) { drawTail(c, 0); }, ANAT.W, ANAT.H);
    var maskBolt = boltMask();

    var n = budget;
    var nBody = Math.round(n * 0.54), nMane = Math.round(n * 0.08);
    var nTail = Math.round(n * 0.16), nLeg = n - nBody - nMane - nTail;

    var raw = [];
    pick(maskBody, nBody, 0.52, raw);
    pick(maskMane, nMane, 0.55, raw);
    pick(maskTail, nTail, 0.50, raw);

    var count = n;
    var position = new Float32Array(count * 3);
    var aColor = new Float32Array(count * 3);
    var aBolt = new Float32Array(count * 3);
    var aStar = new Float32Array(count * 3);
    var aSize = new Float32Array(count);
    var aSeed = new Float32Array(count);
    var aPart = new Float32Array(count);
    var aRoot = new Float32Array(count);

    var GOLD = [0.788, 0.635, 0.153], CHAMP = [0.902, 0.784, 0.478], BRONZE = [0.549, 0.416, 0.184];
    var seeds = legSeeds(nLeg);

    function paint(i, isEdge, star) {
      var t = Math.random();
      var c = isEdge
        ? [lerp(GOLD[0], CHAMP[0], t), lerp(GOLD[1], CHAMP[1], t), lerp(GOLD[2], CHAMP[2], t)]
        : [lerp(BRONZE[0], GOLD[0], 0.45 + t * 0.55), lerp(BRONZE[1], GOLD[1], 0.45 + t * 0.55),
           lerp(BRONZE[2], GOLD[2], 0.45 + t * 0.55)];
      if (star) c = CHAMP;
      aColor[i * 3] = c[0]; aColor[i * 3 + 1] = c[1]; aColor[i * 3 + 2] = c[2];
      aSize[i] = (isEdge ? 1.55 + Math.random() * 1.3 : 1.05 + Math.random() * 1.0) * (star ? 1.5 : 1);
      aSeed[i] = Math.random();
    }

    var i, w, bp, cp;
    var nSampled = nBody + nMane + nTail;
    for (i = 0; i < nSampled; i++) {
      var px = raw[i * 3], py = raw[i * 3 + 1], isEdge = raw[i * 3 + 2] === 1;
      w = toWorld(px, py);
      position[i * 3] = w[0];
      position[i * 3 + 1] = w[1];
      position[i * 3 + 2] = (Math.random() * 2 - 1) * (isEdge ? 3.4 : 8.4);
      if (i < nBody) { aPart[i] = PART.BODY; aRoot[i] = 0; }
      else if (i < nBody + nMane) {
        aPart[i] = PART.MANE;
        aRoot[i] = clamp((px - 190) / 210, 0, 1);
      } else {
        aPart[i] = PART.TAIL;
        aRoot[i] = clamp((px - 740) / 200, 0, 1);
      }
      paint(i, isEdge, false);
    }
    for (i = nSampled; i < count; i++) {
      var s = (i - nSampled) * 4;
      aPart[i] = PART.LEG;
      aRoot[i] = 0;
      position[i * 3 + 2] = (Math.random() * 2 - 1) * 3.2;
      paint(i, Math.abs(seeds[s + 3]) > 0.4, false);
    }

    // alvos: raio e constelação, para toda a nuvem
    var boltRaw = [];
    pick(maskBolt, count, 0.40, boltRaw);
    for (i = 0; i < count; i++) {
      bp = toWorld(boltRaw[i * 3], boltRaw[i * 3 + 1]);
      aBolt[i * 3] = bp[0]; aBolt[i * 3 + 1] = bp[1];
      aBolt[i * 3 + 2] = (Math.random() * 2 - 1) * 4;
      var st = constellationPoint();
      cp = toWorld(st[0], st[1]);
      aStar[i * 3] = cp[0]; aStar[i * 3 + 1] = cp[1];
      aStar[i * 3 + 2] = (Math.random() * 2 - 1) * 6;
    }

    return {
      count: count, nSampled: nSampled, nLeg: nLeg, seeds: seeds,
      position: position, aColor: aColor, aSize: aSize, aSeed: aSeed,
      aPart: aPart, aRoot: aRoot, aBolt: aBolt, aStar: aStar
    };
  }

  function buildWings(budget) {
    var mask = maskOf(drawWing, WING.W, WING.H);
    var raw = [];
    pick(mask, budget, 0.5, raw);
    var count = budget;
    var position = new Float32Array(count * 3);   // alvo aberto
    var aFold = new Float32Array(count * 3);      // dobrada, junto à espádua
    var aColor = new Float32Array(count * 3);
    var aSize = new Float32Array(count);
    var aSeed = new Float32Array(count);
    var aOrder = new Float32Array(count);
    var CHAMP = [0.902, 0.784, 0.478], GOLD = [0.788, 0.635, 0.153];
    var root = toWorld(WING.ROOT[0], WING.ROOT[1]);
    for (var i = 0; i < count; i++) {
      var px = raw[i * 3], py = raw[i * 3 + 1] - WING.OY, isEdge = raw[i * 3 + 2] === 1;
      var far = i % 5 === 0;                       // asa oposta: menor e mais discreta
      var w = toWorld(px, py);
      var k = far ? 0.79 : 1;
      position[i * 3] = root[0] + (w[0] - root[0]) * k + (far ? -8 : 0);
      position[i * 3 + 1] = root[1] + (w[1] - root[1]) * k + (far ? -4 : 0);
      position[i * 3 + 2] = far ? -9 - Math.random() * 4 : (Math.random() * 2 - 1) * 3.5;
      aFold[i * 3] = root[0] + (Math.random() - 0.5) * 5;
      aFold[i * 3 + 1] = root[1] + (Math.random() - 0.5) * 4;
      aFold[i * 3 + 2] = (Math.random() * 2 - 1) * 3;
      // ordem de revelação: da raiz para a ponta, pena a pena
      aOrder[i] = clamp(Math.hypot(px - WING.ROOT[0], py - WING.ROOT[1]) / 620, 0, 1);
      var t = Math.random();
      var c = isEdge ? CHAMP : [lerp(GOLD[0], CHAMP[0], t), lerp(GOLD[1], CHAMP[1], t), lerp(GOLD[2], CHAMP[2], t)];
      aColor[i * 3] = c[0]; aColor[i * 3 + 1] = c[1]; aColor[i * 3 + 2] = c[2];
      aSize[i] = (isEdge ? 1.4 + Math.random() * 1.1 : 0.9 + Math.random() * 0.9) * (far ? 0.8 : 1);
      aSeed[i] = Math.random();
    }
    return { count: count, position: position, aFold: aFold, aColor: aColor,
             aSize: aSize, aSeed: aSeed, aOrder: aOrder };
  }

  /* =======================================================
     ( 06 ) SHADERS
     ======================================================= */
  var HORSE_VERT = [
    'attribute float aSize; attribute float aSeed; attribute float aPart; attribute float aRoot;',
    'attribute vec3 aColor; attribute vec3 aBolt; attribute vec3 aStar;',
    'uniform float uTime; uniform float uPixel; uniform float uScale; uniform float uBob;',
    'uniform float uSway; uniform float uBolt; uniform float uStar; uniform float uDim; uniform float uPulse;',
    'varying vec3 vColor; varying float vAlpha;',
    'void main(){',
    '  vec3 p = position;',
    '  float mane = step(0.5, aPart) * step(aPart, 1.5);',
    '  float tail = step(1.5, aPart) * step(aPart, 2.5);',
    '  float leg  = step(2.5, aPart);',
    '  float trunk = 1.0 - mane - tail - leg;',
    '  p.y += uBob * (trunk + mane + tail);',
    '  float ph = uTime * 2.0 - aRoot * 3.6;',
    '  float k = aRoot * aRoot * (0.55 + aSeed * 1.5);',
    '  p.x += (mane * 1.6 + tail * 3.2) * k * sin(ph) * uSway;',
    '  p.y += (mane * 0.8 + tail * 1.7) * k * cos(ph) * uSway;',
    '  p += normalize(p + vec3(0.001)) * uPulse * 0.9 * aSeed;',
    '  p = mix(p, aBolt, uBolt);',
    '  p = mix(p, aStar, uStar);',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_PointSize = aSize * uPixel * uScale * (170.0 / max(-mv.z, 1.0)) * (1.0 + uPulse * 0.6);',
    '  gl_Position = projectionMatrix * mv;',
    '  vColor = mix(aColor, vec3(0.902, 0.784, 0.478), uStar * 0.35 + uBolt * 0.30);',
    '  vAlpha = (0.55 + 0.45 * aSeed) * uDim * (1.0 + uPulse * 0.45);',
    '}'
  ].join('\n');

  var WING_VERT = [
    'attribute float aSize; attribute float aSeed; attribute float aOrder;',
    'attribute vec3 aColor; attribute vec3 aFold;',
    'uniform float uTime; uniform float uPixel; uniform float uScale; uniform float uBob;',
    'uniform float uWing; uniform float uBeat; uniform float uDim; uniform float uBolt; uniform vec2 uRoot;',
    'varying vec3 vColor; varying float vAlpha;',
    'void main(){',
    '  float t = clamp((uWing - aOrder * 0.55) / 0.45, 0.0, 1.0);',
    '  t = t * t * (3.0 - 2.0 * t);',
    '  vec3 p = mix(aFold, position, t);',
    '  float a = uBeat * 0.62 * (0.3 + aOrder);',
    '  vec2 r = p.xy - uRoot;',
    '  p.xy = uRoot + vec2(r.x * cos(a) - r.y * sin(a), r.x * sin(a) + r.y * cos(a));',
    '  p.y += uBob + sin(uTime * 1.3 + aOrder * 3.0) * aOrder * 1.5;',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_PointSize = aSize * uPixel * uScale * (170.0 / max(-mv.z, 1.0));',
    '  gl_Position = projectionMatrix * mv;',
    '  vColor = aColor;',
    '  vAlpha = (0.40 + 0.60 * aSeed) * uDim * t * (1.0 - uBolt);',
    '}'
  ].join('\n');

  var DUST_VERT = [
    'attribute float aSize; attribute float aLife;',
    'uniform float uPixel; uniform float uScale; uniform float uDim;',
    'varying vec3 vColor; varying float vAlpha;',
    'void main(){',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_PointSize = aSize * uPixel * uScale * (170.0 / max(-mv.z, 1.0)) * (0.4 + aLife * 0.6);',
    '  gl_Position = projectionMatrix * mv;',
    '  vColor = vec3(0.788, 0.635, 0.153);',
    '  vAlpha = aLife * aLife * 0.55 * uDim;',
    '}'
  ].join('\n');

  var POINT_FRAG = [
    'varying vec3 vColor; varying float vAlpha;',
    'void main(){',
    '  vec2 uv = gl_PointCoord - 0.5;',
    '  float d = dot(uv, uv);',
    '  if (d > 0.25) discard;',
    '  gl_FragColor = vec4(vColor, smoothstep(0.25, 0.02, d) * vAlpha);',
    '}'
  ].join('\n');

  /* =======================================================
     ( 07 ) PÉGASO — O OBJETO QUE ATRAVESSA A PÁGINA
     ======================================================= */
  function pegasus() {
    var canvas = $('#horseCanvas'), stage = $('#stage'), glow = $('#stageGlow');
    if (!canvas || !stage) return;
    if (REDUCED) { showEmblem(); return; }

    var gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias: true, alpha: true }) ||
           canvas.getContext('experimental-webgl');
    } catch (err) { gl = null; }
    if (!gl || typeof window.THREE === 'undefined') { fallbackFlat(canvas, stage); return; }

    var narrow = window.matchMedia('(max-width: 900px)').matches;
    // Orçamento medido: 11k + 3k asas roda a 60fps em GPU real e mantém
    // o contorno legível; abaixo de 900px a metade basta para a leitura.
    var cloud = buildClouds(narrow ? 7500 : 16000);
    var wings = buildWings(narrow ? 1800 : 3400);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(DPR);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, 1, 1, 900);
    camera.position.set(0, 0, 150);

    var outer = new THREE.Group(), inner = new THREE.Group();
    outer.add(inner); scene.add(outer);

    function attr(a, n) { return new THREE.BufferAttribute(a, n); }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', attr(cloud.position, 3));
    geo.setAttribute('aColor', attr(cloud.aColor, 3));
    geo.setAttribute('aBolt', attr(cloud.aBolt, 3));
    geo.setAttribute('aStar', attr(cloud.aStar, 3));
    geo.setAttribute('aSize', attr(cloud.aSize, 1));
    geo.setAttribute('aSeed', attr(cloud.aSeed, 1));
    geo.setAttribute('aPart', attr(cloud.aPart, 1));
    geo.setAttribute('aRoot', attr(cloud.aRoot, 1));
    geo.attributes.position.setUsage(THREE.DynamicDrawUsage);

    var U = {
      uTime: { value: 0 }, uPixel: { value: DPR }, uScale: { value: 1 }, uBob: { value: 0 },
      uSway: { value: 1 }, uBolt: { value: 0 }, uStar: { value: 0 }, uDim: { value: 1 }, uPulse: { value: 0 }
    };
    var horsePts = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: U, vertexShader: HORSE_VERT, fragmentShader: POINT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    inner.add(horsePts);

    var wgeo = new THREE.BufferGeometry();
    wgeo.setAttribute('position', attr(wings.position, 3));
    wgeo.setAttribute('aFold', attr(wings.aFold, 3));
    wgeo.setAttribute('aColor', attr(wings.aColor, 3));
    wgeo.setAttribute('aSize', attr(wings.aSize, 1));
    wgeo.setAttribute('aSeed', attr(wings.aSeed, 1));
    wgeo.setAttribute('aOrder', attr(wings.aOrder, 1));
    var rootW = toWorld(WING.ROOT[0], WING.ROOT[1]);
    var WU = {
      uTime: U.uTime, uPixel: U.uPixel, uScale: U.uScale, uBob: U.uBob,
      uWing: { value: 0 }, uBeat: { value: 0 }, uDim: U.uDim, uBolt: U.uBolt,
      uRoot: { value: new THREE.Vector2(rootW[0], rootW[1]) }
    };
    var wingPts = new THREE.Points(wgeo, new THREE.ShaderMaterial({
      uniforms: WU, vertexShader: WING_VERT, fragmentShader: POINT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    inner.add(wingPts);

    // poeira dourada sob os cascos
    var DUST = narrow ? 120 : 240;
    var dPos = new Float32Array(DUST * 3), dLife = new Float32Array(DUST);
    var dSize = new Float32Array(DUST), dVel = new Float32Array(DUST * 2), dCur = 0;
    for (var q = 0; q < DUST; q++) { dSize[q] = 0.7 + Math.random() * 1.5; dPos[q * 3 + 2] = -2; }
    var dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute('position', attr(dPos, 3));
    dgeo.setAttribute('aLife', attr(dLife, 1));
    dgeo.setAttribute('aSize', attr(dSize, 1));
    dgeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
    dgeo.attributes.aLife.setUsage(THREE.DynamicDrawUsage);
    var dustPts = new THREE.Points(dgeo, new THREE.ShaderMaterial({
      uniforms: { uPixel: U.uPixel, uScale: U.uScale, uDim: U.uDim },
      vertexShader: DUST_VERT, fragmentShader: POINT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    inner.add(dustPts);

    // linhas do asterismo, reveladas junto com a constelação
    var lpos = new Float32Array(PEG_EDGES.length * 6);
    PEG_EDGES.forEach(function (e, i) {
      var a = toWorld(starXY(e[0])[0], starXY(e[0])[1]);
      var b = toWorld(starXY(e[1])[0], starXY(e[1])[1]);
      lpos[i * 6] = a[0]; lpos[i * 6 + 1] = a[1]; lpos[i * 6 + 2] = 0;
      lpos[i * 6 + 3] = b[0]; lpos[i * 6 + 4] = b[1]; lpos[i * 6 + 5] = 0;
    });
    var lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', attr(lpos, 3));
    var lmat = new THREE.LineBasicMaterial({ color: 0xE6C87A, transparent: true, opacity: 0 });
    inner.add(new THREE.LineSegments(lgeo, lmat));

    /* --- estado dirigido pela rolagem ------------------- */
    var S = { x: 0.30, y: 0.03, scale: 1, gait: 1, sway: 1, wing: 0, dim: 1, pulse: 0, rear: 0, beat: 0, bolt: 0, star: 0 };
    var T = {}; for (var kk in S) T[kk] = S[kk];
    if (window.PEGASO) { window.PEGASO.S = S; window.PEGASO.T = T; window.PEGASO.counts = { cloud: cloud.count, legs: cloud.nLeg, wings: wings.count }; }

    // Cada cena entra quando o topo do seu elemento cruza uma linha da
    // viewport, e vale a ÚLTIMA cena cruzada. É monótono na rolagem e
    // determinístico — com um gatilho por seção, um salto de rolagem
    // dispara vários onEnter e o último a chegar vencia por acaso
    // (era isso que apagava as asas no Olimpo).
    var SCENES = [
      ['#inicio', 0.95, { x: 0.30, y: 0.03, scale: 1.00, gait: 1.0, wing: 0, dim: 1.00, pulse: 0 }],
      ['.gait', 0.68, { x: 0.02, y: 0.02, scale: 1.16, gait: 1.0, wing: 0, dim: 0.30, pulse: 1 }],
      ['#olimpo', 0.88, { x: 0.55, y: 0.28, scale: 0.80, gait: 0.5, wing: 1, dim: 0.95, pulse: 0 }],
      ['.gallery', 0.60, { x: 0.36, y: 0.06, scale: 0.56, gait: 0.4, wing: 1, dim: 0.22, pulse: 0 }],
      ['#comparativo', 0.68, { x: 0.37, y: 0.06, scale: 0.54, gait: 0.4, wing: 1, dim: 0.20, pulse: 0 }],
      ['#planos', 0.68, { x: -0.38, y: 0.06, scale: 0.52, gait: 0.4, wing: 1, dim: 0.17, pulse: 0 }],
      ['.creds', 0.68, { x: 0.38, y: 0.04, scale: 0.52, gait: 0.4, wing: 1, dim: 0.17, pulse: 0 }],
      ['.says', 0.68, { x: -0.37, y: 0.04, scale: 0.54, gait: 0.4, wing: 1, dim: 0.17, pulse: 0 }],
      ['#faq', 0.68, { x: 0.37, y: 0.02, scale: 0.58, gait: 0.4, wing: 1, dim: 0.19, pulse: 0 }],
      ['#contato', 0.80, { x: 0.20, y: 0.04, scale: 1.02, gait: 0.2, wing: 1, dim: 0.72, pulse: 0 }]
    ];
    var sceneEls = [];
    SCENES.forEach(function (sc) { var el = $(sc[0]); if (el) sceneEls.push({ el: el, line: sc[1], v: sc[2] }); });
    var lastScene = -1;
    function pickScene() {
      var vp = window.innerHeight, best = 0;
      for (var i = 0; i < sceneEls.length; i++) {
        if (sceneEls[i].el.getBoundingClientRect().top <= vp * sceneEls[i].line) best = i;
      }
      if (best !== lastScene) { lastScene = best; assign(sceneEls[best].v); }
    }

    if (hasGSAP) {
      // Final: a seção é fixada para a metamorfose ter espaço de cena —
      // empinar, uma batida de asa, o raio e a constelação não cabem nos
      // ~600px de rolagem que a seção teria solta.
      var end = $('#contato');
      if (end) {
        var conf = {
          scrub: 0.7,
          onUpdate: function (self) {
            var p = self.progress;
            var st = clamp((p - 0.70) / 0.22, 0, 1);
            T.rear = clamp(p / 0.18, 0, 1) * (1 - clamp((p - 0.34) / 0.14, 0, 1));
            T.beat = Math.sin(clamp((p - 0.16) / 0.20, 0, 1) * Math.PI);
            T.bolt = clamp((p - 0.44) / 0.16, 0, 1);   // fecha em 0,60 e segura
            T.star = st;
            T.gait = 0.20 * (1 - clamp(p / 0.18, 0, 1));
            T.x = 0.20 * (1 - clamp((p - 0.38) / 0.22, 0, 1));
            T.y = 0.04 - st * 0.03;
            // a constelação cresce e emoldura o manifesto
            T.scale = 1.02 + st * 1.30;
            T.dim = 0.72 + 0.28 * clamp((p - 0.58) / 0.22, 0, 1);
          }
        };
        ScrollTrigger.create(Object.assign({ trigger: end, start: 'top top', end: 'bottom bottom' }, conf));
      }
    }
    function assign(o) { for (var k in o) T[k] = o[k]; }

    /* --- enquadramento ---------------------------------- */
    var vw = 0, vh = 0, baseScale = 1, dimFactor = 1, renderScale = 1;
    function resize() {
      var w = stage.clientWidth || window.innerWidth;
      var h = stage.clientHeight || window.innerHeight;
      // O buffer pode render a menos que o tamanho em CSS: o CSS reamplia.
      // Como as partículas são manchas suaves, a perda é imperceptível e o
      // custo de preenchimento cai com o quadrado da escala.
      renderer.setSize(w * renderScale, h * renderScale, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      vh = 2 * Math.tan(20 * Math.PI / 180) * camera.position.z;
      vw = vh * camera.aspect;
      var span = ANAT.W * SCALE;                       // largura do cavalo em unidades
      var want = camera.aspect < 0.9 ? 0.86 : 0.46;    // fração da largura da tela
      baseScale = Math.min(vw * want / span, vh * 0.62 / (ANAT.H * SCALE));
      // Em tela estreita o Pégaso ocupa quase toda a largura e fica ATRÁS
      // do texto: precisa recuar bastante para não disputar a leitura.
      dimFactor = w < 900 ? 0.42 : 1;
    }
    resize();
    window.addEventListener('resize', resize);

    var visible = true;
    document.addEventListener('visibilitychange', function () { visible = !document.hidden; });

    /* --- membros por esqueleto -------------------------- */
    var posArr = geo.attributes.position.array, base3 = cloud.nSampled * 3;
    function updateLegs(phase, bob) {
      var ch = [legJoints(0, phase, bob), legJoints(1, phase, bob),
                legJoints(2, phase, bob), legJoints(3, phase, bob)];
      for (var i = 0; i < cloud.nLeg; i++) {
        var s = i * 4, c = ch[cloud.seeds[s]], seg = cloud.seeds[s + 1];
        var t = cloud.seeds[s + 2], u = cloud.seeds[s + 3];
        var a = c.pts[seg], b = c.pts[seg + 1];
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        var wd = (c.w[seg] + (c.w[seg + 1] - c.w[seg]) * t) * u;
        var j = base3 + i * 3;
        posArr[j] = ((a[0] + dx * t) - dy / L * wd - 500) * SCALE;
        posArr[j + 1] = -((a[1] + dy * t) + dx / L * wd - 350) * SCALE;
      }
      geo.attributes.position.updateRange.offset = base3;
      geo.attributes.position.updateRange.count = cloud.nLeg * 3;
      geo.attributes.position.needsUpdate = true;
      return ch;
    }

    /* --- poeira ----------------------------------------- */
    var FOOTFALL = [1 - LEG_PHASE[0], 1 - LEG_PHASE[1], 1 - LEG_PHASE[2], 1 - LEG_PHASE[3]];
    function spawnDust(hoof) {
      for (var n = 0; n < 9; n++) {
        var i = dCur = (dCur + 1) % DUST;
        dPos[i * 3] = (hoof[0] - 500) * SCALE + (Math.random() - 0.5) * 1.5;
        dPos[i * 3 + 1] = -(hoof[1] - 350) * SCALE;
        dVel[i * 2] = (0.6 + Math.random() * 1.6) * 2.2;
        dVel[i * 2 + 1] = (0.4 + Math.random()) * 1.9;
        dLife[i] = 1;
      }
    }
    function updateDust(dt) {
      for (var i = 0; i < DUST; i++) {
        if (dLife[i] <= 0) continue;
        dLife[i] -= dt * 1.15;
        dPos[i * 3] += dVel[i * 2] * dt;
        dPos[i * 3 + 1] += dVel[i * 2 + 1] * dt;
        dVel[i * 2 + 1] -= dt * 1.6;
        dVel[i * 2] *= 0.985;
        if (dLife[i] < 0) dLife[i] = 0;
      }
      dgeo.attributes.position.needsUpdate = true;
      dgeo.attributes.aLife.needsUpdate = true;
    }

    /* --- laço ------------------------------------------- */
    var t0 = performance.now(), prev = t0, phase = 0, prevPhase = 0, tickN = 0;
    var fpsAcc = 0, fpsN = 0;
    var SPEED = 0.55;   // passadas por segundo: solene, não frenético
    var pivot = toWorld(760, ANAT.GROUND);

    (function frame(now) {
      requestAnimationFrame(frame);
      if (!visible) { prev = now; return; }
      var dt = Math.min((now - prev) / 1000, 0.05); prev = now;
      tickN = (tickN + 1) % 3;
      if (tickN === 0) pickScene();
      var e = 1 - Math.pow(0.0015, dt);
      for (var k in S) S[k] += (T[k] - S[k]) * e;

      prevPhase = phase;
      phase = (phase + dt * SPEED * S.gait) % 1;

      var bob = bodyBob(phase) * S.gait;
      var chains = updateLegs(phase, bob);

      // batida no ritmo dos quatro tempos da marcha
      var beat = 0;
      for (var f = 0; f < 4; f++) {
        var d = Math.abs(((phase - FOOTFALL[f]) % 1 + 1.5) % 1 - 0.5);
        beat = Math.max(beat, Math.exp(-d * d * 900));
        if (S.gait > 0.25 && prevPhase < FOOTFALL[f] && phase >= FOOTFALL[f]) {
          spawnDust(chains[f].pts[3]);
        }
      }
      if (phase < prevPhase) prevPhase = phase;   // volta do ciclo
      updateDust(dt);

      // Guarda de quadro: se a placa não sustenta 60fps, o buffer encolhe
      // até voltar; em GPU capaz ele volta sozinho para a resolução cheia.
      fpsAcc += dt; fpsN++;
      if (fpsAcc >= 1) {
        var fps = fpsN / fpsAcc;
        if (fps < 50 && renderScale > 0.6) { renderScale = Math.max(0.6, renderScale - 0.12); resize(); }
        else if (fps > 57 && renderScale < 1) { renderScale = Math.min(1, renderScale + 0.06); resize(); }
        fpsAcc = 0; fpsN = 0;
      }

      var t = (now - t0) / 1000;
      U.uTime.value = t;
      U.uBob.value = bob * SCALE * -1;
      U.uSway.value = 0.35 + S.gait * 0.8;
      U.uDim.value = S.dim * dimFactor;
      U.uPulse.value = S.pulse * beat * 0.5;
      U.uBolt.value = S.bolt;
      U.uStar.value = S.star;
      // O ponto acompanha só parte da escala do grupo: assim o Pégaso
      // recuado continua legível e a constelação não vira bolotas.
      U.uScale.value = baseScale * (0.55 + 0.45 * S.scale) * (1 - 0.22 * S.wing);
      WU.uWing.value = S.wing;
      WU.uBeat.value = S.beat;
      lmat.opacity = S.star * 0.5;

      // Asa aberta muda a envergadura E o centro visual do conjunto: o
      // bloco alado tem o centro ~166 unidades de tela acima do centro do
      // cavalo. Recuar a escala e recentrar por cálculo evita cortar a
      // ponta da asa em qualquer viewport.
      var sc = baseScale * S.scale * (1 - 0.30 * S.wing);
      var xf = camera.aspect < 1.1 ? 0.45 : 1;
      outer.scale.setScalar(sc);
      outer.position.set(S.x * xf * vw * 0.5,
                         S.y * vh * 0.5 - 166 * SCALE * sc * S.wing, 0);
      var rot = -S.rear * 0.44;
      inner.rotation.z = rot;
      var c = Math.cos(rot), sn = Math.sin(rot);
      inner.position.set(pivot[0] - (pivot[0] * c - pivot[1] * sn),
                         pivot[1] - (pivot[0] * sn + pivot[1] * c), 0);
      if (glow) glow.style.opacity = (0.25 + S.bolt * 0.75 * (1 - S.star)).toFixed(3);

      renderer.render(scene, camera);
    })(t0);
  }

  /* =======================================================
     ( 08 ) ALTERNATIVAS — EMBLEMA E CANVAS 2D
     ======================================================= */
  function showEmblem() {
    var em = $('#emblem'), st = $('#stage');
    if (st) st.setAttribute('hidden', '');
    if (em) em.removeAttribute('hidden');
  }

  // Sem WebGL: a mesma silhueta corrigida, estática, em pontos dourados.
  function fallbackFlat(canvas, stage) {
    var ctx = canvas.getContext('2d');
    if (!ctx) { showEmblem(); return; }
    var mask = maskOf(function (c) { drawHorse(c, ANAT.W, ANAT.H, 0); }, ANAT.W, ANAT.H);
    var raw = [];
    pick(mask, window.matchMedia('(max-width: 900px)').matches ? 2200 : 4200, 0.55, raw);
    var DPR = Math.min(window.devicePixelRatio || 1, 2), w = 0, h = 0;
    function draw() {
      w = stage.clientWidth; h = stage.clientHeight;
      canvas.width = w * DPR; canvas.height = h * DPR;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var k = Math.min(w * 0.46 / ANAT.W, h * 0.62 / ANAT.H);
      if (w < 900) k = Math.min(w * 0.92 / ANAT.W, h * 0.5 / ANAT.H);
      var ox = w * (w < 900 ? 0.5 : 0.72) - ANAT.W * k / 2, oy = h * 0.5 - ANAT.H * k / 2;
      for (var i = 0; i < raw.length; i += 3) {
        ctx.globalAlpha = 0.25 + Math.random() * 0.5;
        ctx.fillStyle = raw[i + 2] === 1 ? '#E6C87A' : '#C9A227';
        ctx.fillRect(ox + raw[i] * k, oy + raw[i + 1] * k, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }
    draw();
    window.addEventListener('resize', draw);
  }

  /* =======================================================
     ( 09 ) CENA DA MARCHA — PIN + SCRUB
     ======================================================= */
  function gaitScene() {
    var section = $('.gait'), pin = $('.gait__pin');
    if (!section || !pin) return;

    var counters = $$('.counter');
    var fills = $$('.rep__track i');
    var prog = $('#repProgress'), pnum = $('#repPercent');
    var status = $('#repStatus'), verdict = $('#repVerdict');
    var joints = $$('#gaitJoints circle');
    var replaying = false;

    function render(p) {
      p = clamp(p, 0, 1);
      counters.forEach(function (el, i) {
        var to = parseFloat(el.getAttribute('data-to')) || 0;
        var local = clamp((p - i * 0.06) / 0.55, 0, 1);
        var shown = Math.round(to * easeOut(local));
        // Só toca no nó de texto quando o número muda: com scrub a 60fps
        // isso evitava reescrever o mesmo dígito dezenas de vezes por segundo.
        if (el.__v !== shown) { el.__v = shown; el.textContent = shown; }
      });
      fills.forEach(function (el, i) {
        var to = parseFloat(el.getAttribute('data-fill')) || 0;
        var local = clamp((p - 0.08 - i * 0.07) / 0.5, 0, 1);
        el.style.width = (to * easeOut(local)).toFixed(1) + '%';
      });
      joints.forEach(function (j, n) {
        var local = clamp((p - 0.10 - n * 0.045) / 0.22, 0, 1);
        j.style.opacity = local.toFixed(2);
      });
      var pct = Math.round(clamp((p - 0.04) / 0.72, 0, 1) * 100);
      if (prog) prog.style.width = pct + '%';
      if (pnum) pnum.textContent = pct + '%';
      if (status) status.textContent = pct < 100 ? 'PROCESSANDO QUADROS…' : 'LAUDO PRONTO — 4 ANDAMENTOS';
      if (verdict) {
        verdict.style.opacity = pct < 100 ? '.35' : '1';
        verdict.textContent = pct < 100 ? 'ANALISANDO…' : 'MARCHA BATIDA';
      }
    }

    render(0);

    if (REDUCED || !hasGSAP) {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en, obs) {
          if (en[0].isIntersecting) { render(1); obs.disconnect(); }
        }, { threshold: 0.25 }).observe(section);
      } else { render(1); }
    } else {
      var upd = function (self) { if (!replaying) render(self.progress); };
      var mm = gsap.matchMedia();
      // Acima de 1024px a seção é fixada com scrub. Abaixo disso o layout vira
      // uma coluna e não cabe em 100svh —
      // o mesmo scrub roda ao longo da própria seção, sem travar a rolagem.
      mm.add('(min-width: 1025px)', function () {
        ScrollTrigger.create({
          trigger: section, start: 'top top', end: '+=170%',
          pin: pin, pinSpacing: true, scrub: 0.6, onUpdate: upd
        });
      });
      mm.add('(max-width: 1024px)', function () {
        ScrollTrigger.create({
          trigger: section, start: 'top 82%', end: 'bottom 62%',
          scrub: 0.6, onUpdate: upd
        });
      });
    }

    var btn = $('#replayBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        if (replaying) return;
        replaying = true;
        var dur = REDUCED ? 1 : 1900, t0 = performance.now();
        render(0);
        (function step(now) {
          var t = clamp((now - t0) / dur, 0, 1);
          render(t);
          if (t < 1) requestAnimationFrame(step);
          else setTimeout(function () { replaying = false; }, 400);
        })(t0);
      });
    }
  }

  /* =======================================================
     ( 03 ) LETREIRO INFINITO
     ======================================================= */
  function marquee() {
    var row = $('#marquee'); if (!row) return;
    var list = row.firstElementChild; if (!list) return;
    var clone = list.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    row.appendChild(clone);
    if (REDUCED || !hasGSAP) return;
    gsap.to(row, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
  }

  /* =======================================================
     ( 04 ) OLIMPO — GALERIA E QR CODE
     ======================================================= */
  function gallery() {
    var track = $('#galTrack'); if (!track) return;
    var slides = $$('.slide', track);
    var idxEl = $('#galIdx');
    var i = 0;

    function go(n) {
      i = (n + slides.length) % slides.length;
      track.style.transform = 'translateX(' + (-i * 100) + '%)';
      if (idxEl) idxEl.textContent = ('0' + (i + 1)).slice(-2);
      slides.forEach(function (s, k) { s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
    }
    go(0);

    var prev = $('#galPrev'), next = $('#galNext');
    if (prev) prev.addEventListener('click', function () { go(i - 1); });
    if (next) next.addEventListener('click', function () { go(i + 1); });

    track.parentElement.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') go(i - 1);
      if (e.key === 'ArrowRight') go(i + 1);
    });

    // arrasto horizontal no toque
    var sx = 0, dx = 0, dragging = false;
    track.addEventListener('pointerdown', function (e) { dragging = true; sx = e.clientX; dx = 0; });
    track.addEventListener('pointermove', function (e) { if (dragging) dx = e.clientX - sx; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      track.addEventListener(ev, function () {
        if (!dragging) return;
        dragging = false;
        if (Math.abs(dx) > 50) go(dx < 0 ? i + 1 : i - 1);
      });
    });
  }

  function qrCode() {
    var el = $('#qrCode'); if (!el) return;
    var N = 21, seed = 20260819;
    var rnd = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

    function isFinder(x, y) {
      var zones = [[0, 0], [N - 7, 0], [0, N - 7]];
      for (var z = 0; z < zones.length; z++) {
        var ox = zones[z][0], oy = zones[z][1];
        if (x >= ox && x < ox + 7 && y >= oy && y < oy + 7) {
          var lx = x - ox, ly = y - oy;
          var ring = (lx === 0 || lx === 6 || ly === 0 || ly === 6);
          var core = (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
          return { dark: ring || core };
        }
      }
      return null;
    }

    var frag = document.createDocumentFragment();
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var f = isFinder(x, y);
        var dark = f ? f.dark : (y === 6 || x === 6 ? (x + y) % 2 === 0 : rnd() > 0.48);
        var cell = document.createElement('i');
        cell.style.background = dark ? '#0B0D10' : 'transparent';
        frag.appendChild(cell);
      }
    }
    el.appendChild(frag);
  }

  function pdfButton() {
    var btn = $('#pdfBtn'); if (!btn) return;
    btn.addEventListener('click', function () {
      if (btn.dataset.busy) return;
      btn.dataset.busy = '1';
      var original = btn.dataset.label || btn.textContent;
      btn.textContent = 'GERANDO LAUDO…';
      setTimeout(function () {
        btn.textContent = 'PDF PRONTO ✓';
        setTimeout(function () { btn.textContent = original; delete btn.dataset.busy; }, 1800);
      }, 1100);
    });
  }

  /* =======================================================
     ( 05 ) COMPARATIVO — NÚMEROS
     ======================================================= */
  function versusNumbers() {
    var nodes = $$('[data-count]');
    if (!nodes.length) return;

    function run(el) {
      var to = parseFloat(el.getAttribute('data-count')) || 0;
      var suffix = el.getAttribute('data-suffix') || '';
      if (REDUCED) { el.textContent = to + suffix; return; }
      var dur = 1500, t0 = performance.now();
      (function step(now) {
        var t = clamp((now - t0) / dur, 0, 1);
        el.textContent = Math.round(to * easeOut(t)) + suffix;
        if (t < 1) requestAnimationFrame(step);
      })(t0);
    }

    if (!('IntersectionObserver' in window)) { nodes.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.5 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* =======================================================
     ( 06 ) CALCULADORA DE VALORIZAÇÃO
     ======================================================= */
  function calculator() {
    var form = $('#calcForm'); if (!form) return;
    var animais = $('#animais'), valor = $('#valor');
    var animaisOut = $('#animaisOut'), valorOut = $('#valorOut');
    var out = $('#calcValue'), base = $('#calcBase');
    var chips = $$('.chip', form);
    var uplift = 0.12;

    function paint(input) {
      var pct = (input.value - input.min) / (input.max - input.min) * 100;
      input.style.backgroundImage =
        'linear-gradient(90deg, #E6C87A 0%, #E6C87A ' + pct + '%, rgba(242,237,228,.14) ' + pct + '%, rgba(242,237,228,.14) 100%)';
      input.style.backgroundSize = '100% 1px';
      input.style.backgroundRepeat = 'no-repeat';
      input.style.backgroundPosition = '0 50%';
    }

    function update() {
      var n = parseInt(animais.value, 10);
      var v = parseInt(valor.value, 10);
      var total = n * v;
      animaisOut.textContent = n;
      valorOut.textContent = BRL.format(v);
      base.textContent = BRL.format(total);
      out.textContent = BRL.format(Math.round(total * uplift));
      paint(animais); paint(valor);
    }

    [animais, valor].forEach(function (i) {
      i.addEventListener('input', update);
      i.addEventListener('change', update);
    });

    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (o) { o.classList.remove('is-on'); o.setAttribute('aria-pressed', 'false'); });
        c.classList.add('is-on'); c.setAttribute('aria-pressed', 'true');
        uplift = parseFloat(c.getAttribute('data-uplift')) || 0.1;
        update();
      });
    });

    form.addEventListener('submit', function (e) { e.preventDefault(); });
    update();
  }

  /* =======================================================
     ( 09 ) FAQ — ABERTURA SUAVE
     ======================================================= */
  function faq() {
    $$('.faq details').forEach(function (d) {
      var body = $('.faq__a', d);
      if (!body) return;
      d.addEventListener('toggle', function () {
        if (REDUCED || !hasGSAP) return;
        if (d.open) {
          gsap.fromTo(body, { height: 0, opacity: 0 },
            { height: 'auto', opacity: 1, duration: .45, ease: 'power2.out',
              onComplete: function () { body.style.height = ''; if (hasGSAP) ScrollTrigger.refresh(); } });
        }
      });
    });
  }

  /* =======================================================
     REVELAÇÃO AO ROLAR
     ======================================================= */
  function reveals() {
    var sel = '.sec__head, .dossie, .gallery, .dossie__foot, .vs__card, .vs__close, ' +
              '.calc__intro, .calc__panel, .cred, .say, .faq__head, .faq__list, .end__inner, .foot__card';
    var nodes = $$(sel);
    if (!nodes.length) return;
    if (REDUCED || !('IntersectionObserver' in window)) return;

    nodes.forEach(function (n) { n.classList.add('reveal'); n.style.transition = 'opacity .9s cubic-bezier(.22,.61,.36,1), transform .9s cubic-bezier(.22,.61,.36,1)'; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en, k) {
        if (!en.isIntersecting) return;
        var el = en.target;
        setTimeout(function () { el.classList.add('is-in'); }, Math.min(k, 4) * 90);
        io.unobserve(el);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* =======================================================
     BOOT
     ======================================================= */
  function boot() {
    hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
    if (hasGSAP) gsap.registerPlugin(ScrollTrigger);
    smoothScroll();
    anchors();
    nav();
    gaitScene();
    pegasus();
    marquee();
    gallery();
    qrCode();
    pdfButton();
    versusNumbers();
    calculator();
    faq();
    reveals();
    if (hasGSAP) setTimeout(function () { ScrollTrigger.refresh(); }, 700);
  }

  // Gancho de inspeção da anatomia: só existe com ?debug na URL.
  if (/[?&]debug/.test(location.search)) {
    window.PEGASO = { drawHorse: drawHorse, drawWing: drawWing, legJoints: legJoints, ANAT: ANAT };
  }

  // O portão sobe na hora, independentemente das bibliotecas.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gate);
  else gate();

  // O resto espera o DOMContentLoaded, que só dispara depois de todos os "defer".
  if (document.readyState === 'complete') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
