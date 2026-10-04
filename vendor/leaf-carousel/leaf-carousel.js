/*!
 * Leaf Carousel — блок портфолио «осенний вихрь за окном»
 * Переиспользуемый виджет: Three.js + GSAP, без зависимостей сборки.
 *
 * Подключение:
 *   <div id="portfolio"></div>
 *   <script src="leaf-carousel.js"></script>
 *   <script>
 *     LeafCarousel.mount('#portfolio', {
 *       bg: 'assets/bg-window.png',
 *       slides: [
 *         { leaf: 'assets/leaves/leaf-01.png', photo: 'assets/leaves/leaf-01(1).jpg', url: '#' },
 *         // ...
 *       ],
 *     });
 *   </script>
 *
 * Опции (все необязательны кроме bg и slides):
 *   bg       — картинка окна (по умолчанию './assets/bg-window.png' относительно скрипта)
 *   slides   — массив { leaf, photo?, url? } (leaf — PNG листа с фото)
 *   libs     — { three?, gsap? } пути к библиотекам (по умолчанию ./libs/… рядом со скриптом)
 *   labels   — { view?, prev?, next?, close?, dialog? } — тексты UI
 *   onChange — колбэк (index, slide)
 *
 * API: { next(), prev(), goTo(i), openPhoto(), closePhoto(), destroy() }
 * Возвращает Promise, который резолвится API после загрузки библиотек и текстур.
 */
(function (global) {
  'use strict';

  var BASE = (function () {
    try {
      return new URL('.', document.currentScript.src).href;
    } catch (e) {
      return './';
    }
  })();

  var DEFAULTS = {
    bg: BASE + 'assets/bg-window.png',
    libs: { three: BASE + 'libs/three.module.js', gsap: BASE + 'libs/gsap.min.js' },
    labels: {
      view: 'Смотреть фото',
      prev: 'Предыдущий проект',
      next: 'Следующий проект',
      close: 'Закрыть просмотр',
      dialog: 'Просмотр фото',
      bgAlt: 'Вид из комнаты через окно на осеннюю аллею',
      photoAlt: 'Фото портфолио крупно',
    },
  };

  /* ---------- геометрия окна (доли блока; согласована с фоновой картинкой) ---------- */

  var BG_ZOOM = 1.3;          // окно «ближе» к зрителю
  var RAW_PANE = { left: 0.28, right: 0.99, top: 0.0, bottom: 0.78 };
  var STUCK_Z = 1.0;          // плоскость стекла
  var STUCK_APPARENT = 0.78;  // прилипший лист целиком в окне
  var STUCK_TOP_MARGIN = 0.02;
  var VORTEX_RECT = { left: 0.25, right: 0.75, top: 0.12, bottom: 0.62 };
  var CLIP_R = 81;            // край стекла у правой рамы, % блока

  function zoomFrac(f) { return 0.5 + (f - 0.5) * BG_ZOOM; }
  var PANE = {
    left: zoomFrac(RAW_PANE.left), right: zoomFrac(RAW_PANE.right),
    top: zoomFrac(RAW_PANE.top), bottom: zoomFrac(RAW_PANE.bottom),
  };

  var CSS = [
    '.lc-stage{position:relative;width:100%;aspect-ratio:2560/1441;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55);background:#1a140f;}',
    '.lc-stage,.lc-stage *{box-sizing:border-box;}',
    '.lc-bg{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:cover;user-select:none;will-change:transform;}',
    '.lc-canvas{position:absolute;inset:0;z-index:2;width:100%;height:100%;display:block;}',
    '.lc-glass{position:absolute;inset:0;z-index:3;pointer-events:none;background:',
    'linear-gradient(112deg,transparent 28%,rgba(255,246,230,.06) 36%,rgba(255,246,230,.16) 45%,rgba(255,246,230,.05) 53%,transparent 60%),',
    'linear-gradient(112deg,transparent 62%,rgba(255,250,240,.045) 67%,rgba(255,250,240,.09) 71%,transparent 76%),',
    'radial-gradient(140% 100% at 88% 96%,rgba(18,9,4,.2),transparent 55%);}',
    '.lc-ui{position:absolute;inset:0;z-index:4;pointer-events:none;}',
    '.lc-arrow{position:absolute;bottom:6.9%;pointer-events:auto;width:52px;height:52px;border-radius:50%;',
    'border:1px solid rgba(255,240,220,.35);background:rgba(25,14,8,.38);color:#ffeed6;font-size:22px;line-height:1;cursor:pointer;',
    'display:grid;place-items:center;backdrop-filter:blur(6px);',
    'transition:background .25s,color .25s,border-color .25s,transform .15s,opacity .2s;font-family:inherit;}',
    '.lc-arrow--prev{left:calc(50% - 176px);} .lc-arrow--next{right:calc(50% - 176px);}',
    '.lc-arrow:hover:not(:disabled){background:rgba(255,238,214,.92);color:#37200f;border-color:transparent;transform:scale(1.06);}',
    '.lc-arrow:active:not(:disabled){transform:scale(.96);} .lc-arrow:disabled{opacity:.35;cursor:default;}',
    '.lc-counter{position:absolute;left:0;right:0;bottom:4.4%;margin:0 auto;width:max-content;display:flex;gap:.6em;',
    'font-size:13px;letter-spacing:.18em;font-variant-numeric:tabular-nums;color:rgba(255,240,220,.85);text-shadow:0 1px 8px rgba(10,5,0,.7);font-family:inherit;}',
    '.lc-counter-sep{opacity:.55;}',
    '.lc-caption{position:absolute;left:0;right:0;top:88%;margin:0 auto;width:max-content;max-width:70%;z-index:4;text-align:center;pointer-events:none;opacity:0;font-family:inherit;}',
    '.lc-caption-link{pointer-events:auto;display:inline-block;padding:8px 18px;border:1px solid rgba(255,233,200,.45);',
    'border-radius:999px;background:rgba(30,18,10,.35);backdrop-filter:blur(4px);color:#ffe9c8;text-decoration:none;',
    'font-size:clamp(11px,1vw,13px);font-weight:500;letter-spacing:.06em;text-transform:uppercase;',
    'text-shadow:0 1px 8px rgba(10,5,0,.6);transition:background .25s,color .25s;}',
    '.lc-caption-link:hover{background:rgba(255,233,200,.92);color:#3a2410;}',
    '.lc-fallback{position:absolute;inset:0;z-index:5;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));',
    'gap:12px;padding:16px;overflow:auto;align-content:start;background:rgba(16,11,8,.94);}',
    '.lc-fallback[hidden]{display:none;} .lc-fallback img{width:100%;height:auto;display:block;border-radius:8px;}',
    '.lc-lightbox{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(10,6,3,.88);',
    'backdrop-filter:blur(6px);cursor:zoom-out;font-family:inherit;}',
    '.lc-lightbox[hidden]{display:none;}',
    '.lc-lightbox img{max-width:92vw;max-height:90vh;object-fit:contain;filter:drop-shadow(0 24px 60px rgba(0,0,0,.6));cursor:default;}',
    '.lc-lightbox-close{position:absolute;top:24px;right:24px;width:48px;height:48px;border-radius:50%;',
    'border:1px solid rgba(255,240,220,.35);background:rgba(25,14,8,.5);color:#ffeed6;font-size:19px;line-height:1;cursor:pointer;',
    'display:grid;place-items:center;backdrop-filter:blur(6px);transition:background .25s,color .25s,transform .15s;}',
    '.lc-lightbox-close:hover{background:rgba(255,238,214,.92);color:#37200f;transform:scale(1.06);}',
    '@media (max-width:640px){',
    '.lc-arrow{width:62px;height:62px;font-size:26px;bottom:5.5%;}',
    '.lc-arrow--prev{left:calc(50% - 148px);} .lc-arrow--next{right:calc(50% - 148px);}',
    '.lc-counter{font-size:11px;bottom:4%;} .lc-caption{top:87%;}',
    '.lc-lightbox-close{width:56px;height:56px;top:16px;right:16px;font-size:22px;}',
    '.lc-lightbox img{max-width:94vw;max-height:88vh;}}',
  ].join('');

  /* ---------- загрузка зависимостей ---------- */

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Не загрузился ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureLibs(libs) {
    var gsapReady = global.gsap ? Promise.resolve() : loadScript(libs.gsap);
    // ES-модуль не грузится при открытии страницы как file:// (без сервера) —
    // в этом случае берём классическую сборку Three.js (window.THREE)
    var threeReady;
    try {
      threeReady = import(libs.three);
    } catch (e) {
      threeReady = Promise.reject(e);
    }
    threeReady = threeReady.catch(function () {
      return loadScript(BASE + 'libs/three.classic.js').then(function () { return global.THREE; });
    });
    return Promise.all([gsapReady, threeReady]).then(function (r) { return r[1]; });
  }

  /* ---------- сцена (Three.js) ---------- */

  function createScene(THREE, canvas, bgEl) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, 10);
    scene.add(new THREE.AmbientLight(0xfff1e0, 0.9));
    var sun = new THREE.DirectionalLight(0xffe6c4, 1.1);
    sun.position.set(-4, 6, 8);
    scene.add(sun);

    var clock = new THREE.Clock();
    var leaves = [];
    var pointer = { x: 0, y: 0 };
    var bgShift = { x: 0, y: 0 };
    var dead = false;

    // тень на стекле (генерируется один раз)
    (function () {
      var c = document.createElement('canvas');
      c.width = c.height = 128;
      var ctx = c.getContext('2d');
      var g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
      g.addColorStop(0, 'rgba(22,12,5,0.55)');
      g.addColorStop(0.6, 'rgba(22,12,5,0.28)');
      g.addColorStop(1, 'rgba(22,12,5,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      scene.userData.shadowTexture = new THREE.CanvasTexture(c);
    })();

    function worldSize() {
      var h0 = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 10;
      return { w0: h0 * camera.aspect, h0: h0 };
    }
    function vortexBox() {
      var w = worldSize();
      return {
        halfW: ((VORTEX_RECT.right - VORTEX_RECT.left) / 2) * w.w0,
        halfH: ((VORTEX_RECT.bottom - VORTEX_RECT.top) / 2) * w.h0,
      };
    }
    function stuckHeightWorld() {
      return STUCK_APPARENT * worldSize().h0 * ((10 - STUCK_Z) / 10);
    }
    function stuckPos(target) {
      var h0 = worldSize().h0;
      var yFrac = STUCK_TOP_MARGIN + STUCK_APPARENT / 2 - 0.5;
      return (target || new THREE.Vector3()).set(0, yFrac * h0, STUCK_Z);
    }

    // приближение окна и окклюзия рамы/букета
    if (bgEl) bgEl.style.transform = 'scale(' + BG_ZOOM + ')';
    var L = Math.max(0, PANE.left) * 100;
    var B = Math.min(1, PANE.bottom) * 100;
    canvas.style.clipPath = 'polygon(' + L + '% 0%,' + CLIP_R + '% 0%,' + CLIP_R + '% ' + B + '%,' +
      L + '% ' + B + '%,' + L + '% 80%,23.5% 70%,26% 58%,28.5% 46%,30% 36%,30% 28%,28.5% 24%,' + L + '% 24%)';

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function loadLeaf(url, i, n) {
      return new Promise(function (resolve, reject) {
        new THREE.TextureLoader().load(url, function (tex) {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          var aspect = tex.image.width / tex.image.height;
          var mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
          );
          var shadowMat = new THREE.MeshBasicMaterial({
            map: scene.userData.shadowTexture, transparent: true, opacity: 0, depthWrite: false,
          });
          var shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
          shadow.position.set(0.06, -0.09, -0.35);
          shadow.scale.set(1.3, 1.3, 1);
          var group = new THREE.Group();
          group.add(mesh, shadow);
          scene.add(group);
          var leaf = {
            group: group, mesh: mesh, shadowMat: shadowMat, aspect: aspect,
            state: 'orbit', timeLag: 0,
            orbit: {
              angle0: (i / n) * Math.PI * 2 + rnd(0, 0.6),
              speed: rnd(0.2, 0.46),
              rxFrac: rnd(0.3, 0.72), ryFrac: rnd(0.1, 0.22), yBaseFrac: rnd(-0.38, 0.38),
              zAmp: rnd(0.7, 1.4), zBase: -0.6, phase: rnd(0, Math.PI * 2),
              tumble: {
                sx: rnd(0.5, 1.2), sy: rnd(0.4, 1.1), sz: rnd(0.25, 0.65),
                px: rnd(0, 6.28), py: rnd(0, 6.28), pz: rnd(0, 6.28),
              },
            },
            sizeFrac: rnd(0.1, 0.15),
          };
          leaves.push(leaf);
          resolve(leaf);
        }, undefined, reject);
      });
    }

    function orbitPos(leaf, t, target) {
      var tt = t - leaf.timeLag;
      var o = leaf.orbit;
      var a = o.angle0 + tt * o.speed;
      var box = vortexBox();
      var h0 = worldSize().h0;
      return (target || new THREE.Vector3()).set(
        Math.cos(a) * o.rxFrac * box.halfW + Math.cos(tt * 0.8 + o.phase) * 0.012 * h0,
        o.yBaseFrac * box.halfH + Math.sin(a) * o.ryFrac * box.halfH + Math.sin(tt * 1.5 + o.phase) * 0.018 * h0,
        o.zBase + Math.cos(a * 1.3 + o.phase) * o.zAmp
      );
    }
    function tumbleRot(leaf, t) {
      var tt = t - leaf.timeLag;
      var tb = leaf.orbit.tumble;
      return {
        x: Math.sin(tt * tb.sx + tb.px) * 0.9,
        y: Math.cos(tt * tb.sy + tb.py) * 1.1,
        z: Math.sin(tt * tb.sz + tb.pz) * 0.55,
      };
    }
    function orbitHeightWorld(leaf) { return leaf.sizeFrac * worldSize().h0; }
    function applyScale(leaf, worldH) { leaf.group.scale.set(worldH * leaf.aspect, worldH, 1); }

    function attachParallax(el) {
      el.addEventListener('pointermove', function (ev) {
        var r = el.getBoundingClientRect();
        pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = ((ev.clientY - r.top) / r.height) * 2 - 1;
      });
      el.addEventListener('pointerleave', function () { pointer.x = 0; pointer.y = 0; });
    }

    function resize() {
      var p = canvas.parentElement;
      if (!p || !p.clientWidth) return;
      renderer.setSize(p.clientWidth, p.clientHeight, false);
      camera.aspect = p.clientWidth / p.clientHeight;
      camera.updateProjectionMatrix();
    }
    resize();
    if (global.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement);

    renderer.setAnimationLoop(function () {
      if (dead) return;
      var dt = Math.min(clock.getDelta(), 0.05);
      var t = clock.elapsedTime;
      leaves.forEach(function (leaf) {
        if (leaf.state === 'orbit') {
          orbitPos(leaf, t, leaf.group.position);
          var r = tumbleRot(leaf, t);
          leaf.group.rotation.set(r.x, r.y, r.z);
          applyScale(leaf, orbitHeightWorld(leaf));
        } else if (leaf.state === 'stuck') {
          applyScale(leaf, stuckHeightWorld());
        }
      });
      var k = 1 - Math.exp(-4 * dt);
      camera.position.x += (pointer.x * 0.12 - camera.position.x) * k;
      camera.position.y += (-pointer.y * 0.09 - camera.position.y) * k;
      var paneY = ((PANE.top + PANE.bottom) / 2 - 0.5) * worldSize().h0;
      camera.lookAt(0, paneY, STUCK_Z * 0.5);
      if (bgEl) {
        var h0 = worldSize().h0;
        var s = renderer.domElement.clientHeight || 1;
        var fx = (-camera.position.x / h0) * s * 0.55;
        var fy = (camera.position.y / h0) * s * 0.55;
        if (Math.abs(fx - bgShift.x) > 0.05 || Math.abs(fy - bgShift.y) > 0.05) {
          bgShift.x = fx; bgShift.y = fy;
          bgEl.style.transform = 'translate(' + fx.toFixed(2) + 'px,' + fy.toFixed(2) + 'px) scale(' + BG_ZOOM + ')';
        }
      }
      renderer.render(scene, camera);
    });

    return {
      loadLeaf: loadLeaf,
      orbitPos: orbitPos,
      tumbleRot: tumbleRot,
      orbitHeightWorld: orbitHeightWorld,
      stuckHeightWorld: stuckHeightWorld,
      stuckPos: stuckPos,
      applyScale: applyScale,
      attachParallax: attachParallax,
      elapsed: function () { return clock.elapsedTime; },
      get leaves() { return leaves; },
      destroy: function () {
        dead = true;
        renderer.setAnimationLoop(null);
        renderer.dispose();
      },
    };
  }

  /* ---------- карусель (GSAP) ---------- */

  function createCarousel(THREE, gsap, scene, opts, ui) {
    var current = -1;
    var busy = false;
    var leaves = [];
    var slides = opts.slides;

    function goTo(dir) {
      if (busy || current < 0) return;
      var next = (current + dir + leaves.length) % leaves.length;
      if (next === current) return;
      busy = true;
      ui.setBusy(true);
      returnToVortex(leaves[current]);
      flyToGlass(leaves[next], function () {
        busy = false;
        ui.setBusy(false);
      });
      current = next;
      ui.setSlide(next, 0.8);
      if (opts.onChange) opts.onChange(next, slides[next]);
    }

    function stickImmediately(leaf) {
      leaf.state = 'stuck';
      scene.stuckPos(leaf.group.position);
      leaf.group.rotation.set(0, 0, -0.04);
      scene.applyScale(leaf, scene.stuckHeightWorld());
      leaf.shadowMat.opacity = 0.35;
      gsap.fromTo(leaf.group.rotation, { z: -0.12 }, { z: -0.04, duration: 1.6, ease: 'elastic.out(1,0.5)', delay: 0.2 });
    }

    function flyToGlass(leaf, onComplete) {
      var P0 = leaf.group.position.clone();
      var R0 = { x: leaf.group.rotation.x, y: leaf.group.rotation.y, z: leaf.group.rotation.z };
      var hStart = leaf.group.scale.y;
      var side = P0.x >= 0 ? 1 : -1;
      var zEnd = -0.04 - side * 0.1;
      var curve = new THREE.CatmullRomCurve3([
        P0,
        new THREE.Vector3(P0.x * 1.3, P0.y * 0.55 - 0.1, P0.z - 1.2),
        new THREE.Vector3(side * 1.1, 0.15, 0.6),
        scene.stuckPos(new THREE.Vector3()),
      ]);
      leaf.state = 'flying';
      var st = { e: 0 };
      gsap.to(st, {
        e: 1, duration: 1.35, ease: 'power3.inOut',
        onUpdate: function () {
          var e = st.e;
          curve.getPoint(e, leaf.group.position);
          leaf.group.rotation.x = R0.x * (1 - e);
          leaf.group.rotation.y = R0.y * (1 - e);
          leaf.group.rotation.z = THREE.MathUtils.lerp(R0.z, zEnd, e) + Math.sin(e * Math.PI) * side * 0.2;
          var h = THREE.MathUtils.lerp(hStart, scene.stuckHeightWorld(), Math.pow(e, 1.3));
          scene.applyScale(leaf, h);
        },
        onComplete: function () {
          leaf.state = 'stuck';
          leaf.group.rotation.set(0, 0, zEnd);
          scene.stuckPos(leaf.group.position);
          gsap.to(leaf.group.rotation, { z: -0.04, duration: 1.5, ease: 'elastic.out(1,0.5)' });
          gsap.to(leaf.shadowMat, { opacity: 0.38, duration: 0.45 });
          if (onComplete) onComplete();
        },
      });
    }

    function returnToVortex(leaf) {
      var T = 1.0;
      var tEnd = scene.elapsed() + T;
      var P0 = leaf.group.position.clone();
      var R0 = { x: leaf.group.rotation.x, y: leaf.group.rotation.y, z: leaf.group.rotation.z };
      var hStart = leaf.group.scale.y;
      var E = scene.orbitPos(leaf, tEnd);
      var R1 = scene.tumbleRot(leaf, tEnd);
      var hEnd = scene.orbitHeightWorld(leaf);
      var side = P0.x >= 0 ? 1 : -1;
      var curve = new THREE.CatmullRomCurve3([
        P0,
        new THREE.Vector3(P0.x + side * 0.4, P0.y + 0.25, P0.z - 1.8),
        new THREE.Vector3(E.x + side * 0.7, E.y + 0.45, E.z - 0.7),
        E,
      ]);
      leaf.state = 'returning';
      gsap.to(leaf.shadowMat, { opacity: 0, duration: 0.15 });
      var st = { e: 0 };
      gsap.to(st, {
        e: 1, duration: T, ease: 'power2.in',
        onUpdate: function () {
          var e = st.e;
          curve.getPoint(e, leaf.group.position);
          leaf.group.rotation.x = THREE.MathUtils.lerp(R0.x, R1.x, e);
          leaf.group.rotation.y = THREE.MathUtils.lerp(R0.y, R1.y, e);
          leaf.group.rotation.z = THREE.MathUtils.lerp(R0.z, R1.z, e);
          var h = THREE.MathUtils.lerp(hStart, hEnd, 1 - Math.pow(1 - e, 1.8));
          scene.applyScale(leaf, h);
        },
        onComplete: function () {
          leaf.timeLag = scene.elapsed() - tEnd;
          leaf.state = 'orbit';
        },
      });
    }

    return {
      start: function (loaded) {
        leaves = loaded.slice();
        stickImmediately(leaves[0]);
        current = 0;
        ui.setSlide(0, 0.6);
      },
      goTo: goTo,
      next: function () { goTo(1); },
      prev: function () { goTo(-1); },
      get current() { return current; },
    };
  }

  /* ---------- UI ---------- */

  function createUI(gsap, stage, slides, labels, onNavigate) {
    var prevBtn = stage.querySelector('.lc-arrow--prev');
    var nextBtn = stage.querySelector('.lc-arrow--next');
    var counterCurrent = stage.querySelector('.lc-counter-cur');
    var counterTotal = stage.querySelector('.lc-counter-total');
    var caption = stage.querySelector('.lc-caption');
    var captionLink = stage.querySelector('.lc-caption-link');

    counterTotal.textContent = String(slides.length).padStart(2, '0');

    prevBtn.addEventListener('click', function () { onNavigate(-1); });
    nextBtn.addEventListener('click', function () { onNavigate(1); });

    var lightbox = document.querySelector('.lc-lightbox');
    var lightboxImg = lightbox.querySelector('img');
    var lightboxClose = lightbox.querySelector('.lc-lightbox-close');

    function onKey(ev) {
      if (!lightbox.hidden) {
        if (ev.key === 'Escape') closeLightbox();
        return;
      }
      if (ev.key === 'ArrowRight') onNavigate(1);
      else if (ev.key === 'ArrowLeft') onNavigate(-1);
    }
    global.addEventListener('keydown', onKey);

    var current = -1;
    var swapTimer = null;

    function showCaption(i) {
      captionLink.href = (slides[i] && slides[i].url) || '#';
      gsap.fromTo(caption, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
    }
    function openLightbox() {
      if (current < 0) return;
      var slide = slides[current];
      lightboxImg.src = (slide && slide.photo) || slide.leaf;
      lightbox.hidden = false;
      gsap.fromTo(lightbox, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo(lightboxImg, { scale: 0.85, y: 24 }, { scale: 1, y: 0, duration: 0.45, ease: 'power3.out' });
    }
    function closeLightbox() {
      gsap.to(lightbox, {
        opacity: 0, duration: 0.22, ease: 'power2.in',
        onComplete: function () { lightbox.hidden = true; },
      });
    }
    captionLink.addEventListener('click', function (ev) { ev.preventDefault(); openLightbox(); });
    lightbox.addEventListener('click', function (ev) { if (ev.target === lightbox) closeLightbox(); });
    lightboxClose.addEventListener('click', closeLightbox);

    return {
      setSlide: function (i, delay) {
        counterCurrent.textContent = String(i + 1).padStart(2, '0');
        if (i === current) return;
        current = i;
        if (swapTimer) { swapTimer.kill(); swapTimer = null; }
        if (!caption.style.opacity || caption.style.opacity === '0') {
          swapTimer = gsap.delayedCall(delay || 0, function () { showCaption(i); });
        } else {
          gsap.to(caption, {
            opacity: 0, duration: 0.22, ease: 'power1.out',
            onComplete: function () {
              swapTimer = gsap.delayedCall(Math.max(0, (delay || 0) - 0.22), function () { showCaption(i); });
            },
          });
        }
      },
      setBusy: function (busy) { prevBtn.disabled = busy; nextBtn.disabled = busy; },
      openPhoto: openLightbox,
      closePhoto: closeLightbox,
      destroy: function () { global.removeEventListener('keydown', onKey); },
    };
  }

  /* ---------- разметка + монтирование ---------- */

  var LC_ID = 0;

  function injectStyles() {
    if (document.getElementById('lc-styles')) return;
    var st = document.createElement('style');
    st.id = 'lc-styles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function ensureLightbox(labels) {
    var lb = document.querySelector('.lc-lightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.className = 'lc-lightbox';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', labels.dialog);
    lb.innerHTML = '<button class="lc-lightbox-close" type="button" aria-label="' + labels.close + '">&#10005;</button>' +
      '<img alt="' + labels.photoAlt + '">';
    document.body.appendChild(lb);
    return lb;
  }

  function buildStage(root, opts, labels, id) {
    root.classList.add('lc-stage');
    root.innerHTML =
      '<img class="lc-bg" alt="' + labels.bgAlt + '" draggable="false">' +
      '<canvas class="lc-canvas" aria-hidden="true"></canvas>' +
      '<div class="lc-glass" aria-hidden="true"></div>' +
      '<div class="lc-caption"><a class="lc-caption-link" href="#" target="_blank" rel="noopener">' + labels.view + '</a></div>' +
      '<div class="lc-ui">' +
      '<button class="lc-arrow lc-arrow--prev" type="button" aria-label="' + labels.prev + '">&#8592;</button>' +
      '<div class="lc-counter"><span class="lc-counter-cur">01</span><span class="lc-counter-sep">/</span><span class="lc-counter-total">10</span></div>' +
      '<button class="lc-arrow lc-arrow--next" type="button" aria-label="' + labels.next + '">&#8594;</button>' +
      '</div>' +
      '<div class="lc-fallback" hidden></div>';
    root.querySelector('.lc-bg').src = opts.bg;
  }

  function mount(target, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    opts.libs = Object.assign({}, DEFAULTS.libs, (options && options.libs) || {});
    opts.labels = Object.assign({}, DEFAULTS.labels, (options && options.labels) || {});
    var slides = opts.slides || [];
    if (!slides.length) return Promise.reject(new Error('LeafCarousel: передайте массив slides'));

    var root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) return Promise.reject(new Error('LeafCarousel: не найден контейнер ' + target));

    injectStyles();
    ensureLightbox(opts.labels);

    var id = ++LC_ID;
    buildStage(root, opts, opts.labels, id);
    var canvas = root.querySelector('.lc-canvas');
    var bgEl = root.querySelector('.lc-bg');

    var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var webglOk = (function () {
      try {
        var c = document.createElement('canvas');
        return !!(global.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
      } catch (e) { return false; }
    })();

    // prefers-reduced-motion больше не включает фолбэк: вихрь медленный,
    // он и есть содержимое блока портфолио (решение владельца сайта).
    // Фолбэк-сетка остаётся только на случай отсутствия WebGL.
    if (!webglOk) {
      var fb = root.querySelector('.lc-fallback');
      fb.hidden = false;
      slides.forEach(function (s) {
        var img = document.createElement('img');
        img.src = s.photo || s.leaf;
        img.alt = s.title || '';
        img.loading = 'lazy';
        fb.appendChild(img);
      });
      return Promise.resolve({ fallback: true, slides: slides });
    }

    return ensureLibs(opts.libs).then(function (THREE) {
      var gsap = global.gsap;
      var scene = createScene(THREE, canvas, bgEl);
      scene.attachParallax(root);

      var ui = createUI(gsap, root, slides, opts.labels, function (dir) { carousel.goTo(dir); });
      var carousel = createCarousel(THREE, gsap, scene, opts, ui);

      return Promise.all(slides.map(function (s, i) { return scene.loadLeaf(s.leaf, i, slides.length); }))
        .then(function (loaded) {
          carousel.start(loaded);
          return {
            next: function () { carousel.next(); },
            prev: function () { carousel.prev(); },
            goTo: function (i) { /* прямой переход — последовательными шагами */ 
              var steps = (i - carousel.current + slides.length) % slides.length;
              var step = function () {
                if (steps-- > 0) { carousel.next(); setTimeout(step, 1600); }
              };
              step();
            },
            openPhoto: ui.openPhoto,
            closePhoto: ui.closePhoto,
            get current() { return carousel.current; },
            destroy: function () {
              ui.destroy();
              scene.destroy();
              root.innerHTML = '';
            },
          };
        })
        .catch(function (e) {
          console.error('LeafCarousel: не загрузились текстуры листьев', e);
          throw e;
        });
    });
  }

  var LeafCarousel = { mount: mount, version: '1.0.0' };
  global.LeafCarousel = LeafCarousel;

  // автозапуск: <div data-leaf-carousel data-bg="..." > — слайды из JSON в data-slides
  if (typeof document !== 'undefined') {
    var boot = function () {
      document.querySelectorAll('[data-leaf-carousel]').forEach(function (el) {
        var dataSlides = [];
        try { dataSlides = JSON.parse(el.getAttribute('data-slides') || '[]'); } catch (e) { /* пусто */ }
        mount(el, {
          bg: el.getAttribute('data-bg') || undefined,
          slides: dataSlides,
          onChange: function () {},
        });
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(window);
