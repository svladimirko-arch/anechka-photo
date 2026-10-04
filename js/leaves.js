/* Лёгкий декоративный слой: редкие осенние листья летят по всему сайту.
   Canvas над контентом (pointer-events:none — клики проходят насквозь),
   под шапкой и лайтбоксом. Отключается при prefers-reduced-motion
   и когда вкладка не видна, чтобы не тратить батарею. */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'falling-leaves';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  /* пастельная осенняя палитра сайта: пудра, охра, олива, терракота */
  var COLORS = ['#D6B3A0', '#C98F6F', '#D9A967', '#9AA07A', '#C7A184'];

  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var isMobile = function () { return window.innerWidth < 720; };

  var W = 0, H = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeLeaf(fromTop) {
    return {
      x: rand(-40, W + 40),
      y: fromTop ? rand(-80, -20) : rand(-H, H),
      size: rand(9, isMobile() ? 15 : 20),
      speedY: rand(12, 26),      // px/с — медленное падение
      dir: Math.random() < 0.5 ? 1 : -1,
      speedX: rand(4, 14),       // лёгкий ветер в обе стороны
      swayAmp: rand(18, 46),     // размах покачивания
      swayFreq: rand(0.4, 0.9),
      phase: rand(0, Math.PI * 2),
      rot: rand(0, Math.PI * 2),
      rotSpeed: rand(-0.5, 0.5),
      flutterFreq: rand(0.6, 1.2),
      color: COLORS[(Math.random() * COLORS.length) | 0],
      alpha: rand(0.22, 0.4),    // полупрозрачность: текст остаётся читаемым
    };
  }

  var leaves = [];
  function seed() {
    var count = isMobile() ? 6 : 9;
    leaves = [];
    for (var i = 0; i < count; i++) leaves.push(makeLeaf(false));
  }

  /* контур листа: вытянутый овал с кончиками + прожилка */
  function drawLeaf(l, t) {
    var swayX = Math.sin(t * l.swayFreq + l.phase) * l.swayAmp;
    var flutter = Math.sin(t * l.flutterFreq + l.phase); // «кувырок» относительно зрителя
    ctx.save();
    ctx.translate(l.x + swayX, l.y);
    ctx.rotate(l.rot);
    ctx.scale(0.55 + 0.45 * Math.abs(flutter), 1);
    ctx.globalAlpha = l.alpha * (0.75 + 0.25 * Math.abs(flutter));
    ctx.fillStyle = l.color;

    var s = l.size;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.85, -s * 0.45, 0, s);
    ctx.quadraticCurveTo(-s * 0.85, -s * 0.45, 0, -s);
    ctx.fill();

    ctx.globalAlpha *= 0.45;
    ctx.strokeStyle = '#8a6a4f';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.8);
    ctx.lineTo(0, s * 0.85);
    ctx.stroke();
    ctx.restore();
  }

  var last = 0;
  var running = true;

  function frame(ts) {
    if (!running) return;
    var dt = Math.min((ts - last) / 1000 || 0.016, 0.05);
    last = ts;

    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < leaves.length; i++) {
      var l = leaves[i];
      l.y += l.speedY * dt;
      l.x += l.speedX * dt * l.dir;
      l.rot += l.rotSpeed * dt;
      if (l.y > H + 40 || l.x > W + 80 || l.x < -80) {
        leaves[i] = makeLeaf(true);
        continue;
      }
      drawLeaf(l, ts / 1000);
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', function () {
    resize();
    seed();
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });

  resize();
  seed();
  requestAnimationFrame(frame);
})();
