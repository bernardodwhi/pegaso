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
    window.addEventListener('load', function () { loaded = true; });
    setTimeout(function () { loaded = true; }, 4500);

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
      var ceiling = loaded ? 100 : Math.min(92, elapsed / 22);
      value = Math.min(ceiling, value + Math.max(0.6, (ceiling - value) * 0.06));
      var shown = Math.floor(value);
      num.textContent = ('00' + shown).slice(-3);
      bar.style.width = value.toFixed(1) + '%';
      if (shown >= 100) { setTimeout(open, 260); return; }
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
     ( 01 ) CAVALO EM PARTÍCULAS
     ======================================================= */

  // Silhueta de um cavalo em marcha, desenhada em canvas offscreen.
  function drawHorse(ctx, W, H) {
    ctx.save();
    ctx.scale(W / 1000, H / 700);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // --- cabeça, pescoço, tronco ---
    ctx.beginPath();
    ctx.moveTo(150, 262);
    ctx.bezierCurveTo(139, 279, 147, 297, 176, 303);   // focinho
    ctx.bezierCurveTo(215, 301, 261, 255, 292, 200);   // ganacha até a fauce
    ctx.bezierCurveTo(320, 262, 366, 331, 414, 392);   // goela até o peito
    ctx.bezierCurveTo(438, 412, 454, 430, 472, 448);   // peito / braço
    ctx.bezierCurveTo(528, 470, 608, 478, 686, 470);   // ventre
    ctx.bezierCurveTo(748, 464, 796, 446, 838, 404);   // flanco até a soldra
    ctx.bezierCurveTo(866, 376, 884, 330, 886, 282);   // nádega
    ctx.bezierCurveTo(884, 250, 866, 232, 840, 228);   // garupa
    ctx.bezierCurveTo(772, 220, 690, 246, 596, 224);   // dorso até a cernelha
    ctx.bezierCurveTo(510, 178, 392, 132, 300, 120);   // crista arqueada do pescoço
    ctx.bezierCurveTo(282, 116, 264, 113, 250, 116);   // nuca
    ctx.bezierCurveTo(224, 158, 186, 214, 150, 262);   // chanfro
    ctx.closePath();
    ctx.fill();

    // --- orelhas ---
    [[[248, 118], [237, 72], [268, 108]], [[272, 115], [289, 74], [301, 111]]].forEach(function (ear) {
      ctx.beginPath();
      ctx.moveTo(ear[0][0], ear[0][1]);
      ctx.lineTo(ear[1][0], ear[1][1]);
      ctx.lineTo(ear[2][0], ear[2][1]);
      ctx.closePath();
      ctx.fill();
    });

    // --- membros: polilinhas espessas que afinam até o casco ---
    function limb(pts, widths) {
      for (var i = 0; i < pts.length - 1; i++) {
        ctx.beginPath();
        ctx.lineWidth = widths[i];
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.stroke();
      }
      var hoof = pts[pts.length - 1];
      ctx.beginPath();
      ctx.ellipse(hoof[0], hoof[1], 15, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    limb([[452, 400], [410, 505], [372, 592], [350, 640]], [58, 32, 19]);              // anterior avançado
    limb([[494, 412], [540, 515], [585, 592], [618, 634]], [52, 28, 17]);              // anterior recuado
    limb([[812, 344], [760, 455], [800, 530], [790, 600], [782, 646]], [82, 46, 26, 17]); // posterior sob o corpo
    limb([[852, 358], [872, 458], [884, 548], [890, 634]], [70, 38, 22]);              // posterior recuado

    // --- cauda ---
    var tail = [[874, 246], [930, 288], [958, 358], [972, 440], [978, 520]];
    var tailW = [34, 25, 17, 10];
    for (var t = 0; t < tail.length - 1; t++) {
      ctx.beginPath();
      ctx.lineWidth = tailW[t];
      ctx.moveTo(tail[t][0], tail[t][1]);
      ctx.lineTo(tail[t + 1][0], tail[t + 1][1]);
      ctx.stroke();
    }

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

  var VERT = [
    'attribute float aSize;',
    'attribute float aSeed;',
    'attribute vec3 aColor;',
    'uniform float uTime;',
    'uniform float uPixel;',
    'uniform float uDisperse;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'void main(){',
    '  vec3 p = position;',
    '  float ph = aSeed * 6.2831;',
    '  p.y += sin(uTime * 0.85 + ph) * 1.15;',
    '  p.x += sin(uTime * 0.55 + p.y * 0.035 + ph) * 0.9;',
    '  p += normalize(p + vec3(0.001)) * uDisperse * (12.0 + aSeed * 26.0);',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_PointSize = aSize * uPixel * (170.0 / max(-mv.z, 1.0));',
    '  gl_Position = projectionMatrix * mv;',
    '  vColor = aColor;',
    '  vAlpha = (0.46 + 0.54 * aSeed) * (1.0 - uDisperse * 0.55);',
    '}'
  ].join('\n');

  var FRAG = [
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'void main(){',
    '  vec2 uv = gl_PointCoord - 0.5;',
    '  float d = dot(uv, uv);',
    '  if (d > 0.25) discard;',
    '  float a = smoothstep(0.25, 0.02, d) * vAlpha;',
    '  gl_FragColor = vec4(vColor, a);',
    '}'
  ].join('\n');

  function horseParticles() {
    var canvas = $('#horseCanvas');
    if (!canvas) return;
    var stage = canvas.parentElement;

    var gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias: true, alpha: true }) ||
           canvas.getContext('experimental-webgl');
    } catch (err) { gl = null; }

    if (!gl || typeof window.THREE === 'undefined') { fallbackSphere(canvas); return; }

    var mobile = window.matchMedia('(max-width: 680px)').matches;
    var TOTAL = mobile ? 7500 : 15000;
    var EDGE_SHARE = 0.54;

    var sil = sampleSilhouette();
    if (!sil.inside.length) { fallbackSphere(canvas); return; }

    var positions = new Float32Array(TOTAL * 3);
    var colors = new Float32Array(TOTAL * 3);
    var sizes = new Float32Array(TOTAL);
    var seeds = new Float32Array(TOTAL);

    var GOLD = [0.788, 0.635, 0.153];      // #C9A227
    var CHAMP = [0.902, 0.784, 0.478];     // #E6C87A
    var BRONZE = [0.549, 0.416, 0.184];    // #8C6A2F
    var SCALE = 0.118;

    for (var i = 0; i < TOTAL; i++) {
      var useEdge = sil.edge.length > 0 && Math.random() < EDGE_SHARE;
      var pool = useEdge ? sil.edge : sil.inside;
      var k = (Math.random() * (pool.length / 2)) | 0;
      var px = pool[k * 2] + (Math.random() - 0.5) * 2.2;
      var py = pool[k * 2 + 1] + (Math.random() - 0.5) * 2.2;

      var depth = useEdge ? 3.4 : 8.4;
      positions[i * 3] = (px - 500) * SCALE;
      positions[i * 3 + 1] = -(py - 350) * SCALE;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * depth;

      var t = Math.random();
      var c = useEdge
        ? [lerp(GOLD[0], CHAMP[0], t), lerp(GOLD[1], CHAMP[1], t), lerp(GOLD[2], CHAMP[2], t)]
        : [lerp(BRONZE[0], GOLD[0], 0.45 + t * 0.55), lerp(BRONZE[1], GOLD[1], 0.45 + t * 0.55), lerp(BRONZE[2], GOLD[2], 0.45 + t * 0.55)];
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];

      sizes[i] = useEdge ? 1.45 + Math.random() * 1.25 : 0.95 + Math.random() * 1.0;
      seeds[i] = Math.random();
    }

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    var DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(DPR);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, 1, 1, 600);
    camera.position.set(0, 0, 155);

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixel: { value: DPR },
        uDisperse: { value: 0 }
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    var points = new THREE.Points(geo, mat);
    scene.add(points);

    function resize() {
      var w = stage.clientWidth || window.innerWidth;
      var h = stage.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Enquadra o cavalo inteiro: ajusta pela largura E pela altura.
      var hw = 1000 * SCALE, hh = 700 * SCALE;
      var needH = Math.max(hh * 1.18, (hw * 1.06) / camera.aspect);
      var z = needH / (2 * Math.tan((40 * Math.PI / 180) / 2));
      camera.position.z = clamp(z, 130, 430);
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    var mouse = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    if (!REDUCED) {
      window.addEventListener('pointermove', function (e) {
        mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; },
        { rootMargin: '160px' }).observe(canvas);
    }

    if (REDUCED) { renderer.render(scene, camera); return; }

    var t0 = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!visible) return;
      var t = (now - t0) / 1000;
      mat.uniforms.uTime.value = t;
      cur.x = lerp(cur.x, mouse.x, 0.045);
      cur.y = lerp(cur.y, mouse.y, 0.045);
      points.rotation.y = Math.sin(t * 0.16) * 0.19 + cur.x * 0.13;
      points.rotation.x = Math.sin(t * 0.11) * 0.045 - cur.y * 0.06;
      renderer.render(scene, camera);
    })(t0);
  }

  // Sem WebGL: esfera de partículas em Canvas 2D.
  function fallbackSphere(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var stage = canvas.parentElement;
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var N = window.matchMedia('(max-width: 680px)').matches ? 700 : 1400;
    var pts = [];
    for (var i = 0; i < N; i++) {
      var u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pts.push({ x: r * Math.cos(a), y: u, z: r * Math.sin(a), s: 0.5 + Math.random() * 1.3, c: Math.random() });
    }
    var w = 0, h = 0;
    function resize() {
      w = stage.clientWidth || window.innerWidth;
      h = stage.clientHeight || window.innerHeight;
      canvas.width = w * DPR; canvas.height = h * DPR;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function frame(rot) {
      ctx.clearRect(0, 0, w, h);
      var R = Math.min(w, h) * 0.34, cx = w / 2, cy = h / 2;
      var cos = Math.cos(rot), sin = Math.sin(rot);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var x = p.x * cos - p.z * sin, z = p.x * sin + p.z * cos;
        var k = 1.9 / (1.9 + z);
        ctx.globalAlpha = clamp(0.18 + k * 0.55, 0, 1);
        ctx.fillStyle = p.c > 0.5 ? '#E6C87A' : '#C9A227';
        ctx.beginPath();
        ctx.arc(cx + x * R * k, cy + p.y * R * k, p.s * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (REDUCED) { frame(0.6); return; }
    var t0 = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      frame((now - t0) / 6000);
    })(t0);
  }

  /* =======================================================
     ( 02 ) CENA DA MARCHA — PIN + SCRUB
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
        el.textContent = Math.round(to * easeOut(local));
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
     ( 10 ) CONSTELAÇÃO DE ENCERRAMENTO
     ======================================================= */
  function constellation() {
    var canvas = $('#constCanvas'); if (!canvas) return;
    var ctx = canvas.getContext('2d'); if (!ctx) return;
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, stars = [];
    var COUNT = window.matchMedia('(max-width: 680px)').matches ? 60 : 130;

    function build() {
      var host = canvas.parentElement;
      w = host.clientWidth; h = host.clientHeight;
      canvas.width = w * DPR; canvas.height = h * DPR;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      stars = [];
      for (var i = 0; i < COUNT; i++) {
        stars.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.16, vy: (Math.random() - 0.5) * 0.16,
          r: 0.5 + Math.random() * 1.4, a: 0.25 + Math.random() * 0.6
        });
      }
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (!REDUCED) {
          s.x += s.vx; s.y += s.vy;
          if (s.x < -10) s.x = w + 10; if (s.x > w + 10) s.x = -10;
          if (s.y < -10) s.y = h + 10; if (s.y > h + 10) s.y = -10;
        }
        for (var j = i + 1; j < stars.length; j++) {
          var o = stars[j], dx = s.x - o.x, dy = s.y - o.y, d2 = dx * dx + dy * dy;
          if (d2 < 15000) {
            ctx.globalAlpha = (1 - d2 / 15000) * 0.10;
            ctx.strokeStyle = '#E6C87A';
            ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(o.x, o.y); ctx.stroke();
          }
        }
        ctx.globalAlpha = s.a;
        ctx.fillStyle = '#E6C87A';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    build();
    window.addEventListener('resize', function () { build(); frame(); });

    if (REDUCED) { frame(); return; }
    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; },
        { rootMargin: '120px' }).observe(canvas);
    }
    (function loop() { requestAnimationFrame(loop); if (visible) frame(); })();
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
    horseParticles();
    gaitScene();
    marquee();
    gallery();
    qrCode();
    pdfButton();
    versusNumbers();
    calculator();
    faq();
    constellation();
    reveals();
    if (hasGSAP) setTimeout(function () { ScrollTrigger.refresh(); }, 700);
  }

  // O portão sobe na hora, independentemente das bibliotecas.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gate);
  else gate();

  // O resto espera o DOMContentLoaded, que só dispara depois de todos os "defer".
  if (document.readyState === 'complete') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
