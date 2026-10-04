/* Анечка Дмитриева — лендинг семейного фотографа.
   Vanilla JS: меню, параллакс hero, появление блоков, слайдер акций,
   выбор услуги, валидация формы, подключение карусели-портфолио. */

(function () {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- шапка: бургер + фон при прокрутке ---------- */

  const header = $('#header');
  const burger = $('#burger');
  const nav = $('#nav');

  const onScrollHeader = () => {
    header.classList.toggle('scrolled', window.scrollY > 24);
  };
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, { passive: true });

  const closeNav = () => {
    nav.classList.remove('nav--open');
    burger.setAttribute('aria-expanded', 'false');
  };

  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('nav--open');
    burger.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (ev) => {
    if (ev.target.closest('a')) closeNav(); // переход по якорю закрывает меню
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeNav();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 900) closeNav();
  });

  /* ---------- появление блоков при скролле ---------- */

  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* ---------- лёгкий параллакс фона hero ---------- */

  const heroBg = $('.hero__bg');
  if (heroBg && !prefersReducedMotion) {
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      if (y < window.innerHeight * 1.2) {
        heroBg.style.transform = 'translateY(' + (y * 0.28).toFixed(1) + 'px)';
      }
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
  }

  /* ---------- прайс: «Выбрать» → форма с подставленной услугой ---------- */

  const form = $('#booking-form');
  const msgField = $('#f-msg');

  $$('.price-card__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!form || !msgField) return;
      const service = btn.dataset.service || '';
      const greeting = 'Здравствуйте! Хочу записаться на съёмку: «' + service + '».';
      const extra = msgField.value.trim();
      msgField.value = extra && !msgField.dataset.touched
        ? extra + ' ' + greeting
        : greeting;
      msgField.dataset.touched = 'yes';
      $('#f-name').focus({ preventScroll: true });
      form.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    });
  });

  /* ---------- слайдер акций ---------- */

  const slider = $('#promo-slider');
  if (slider) {
    const slides = $$('.promo-slide', slider);
    const dotsBox = $('.promo__dots', slider);
    const prevBtn = $('#promo-prev');
    const nextBtn = $('#promo-next');
    let current = 0;
    let timer = null;
    const DELAY = 6000;

    const dots = slides.map((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'promo__dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', 'Акция ' + (i + 1));
      dot.addEventListener('click', () => { goTo(i); restart(); });
      dotsBox.appendChild(dot);
      return dot;
    });

    function goTo(i) {
      current = (i + slides.length) % slides.length;
      slides.forEach((slide, k) => slide.classList.toggle('is-active', k === current));
      dots.forEach((dot, k) => dot.classList.toggle('is-active', k === current));
    }

    const restart = () => {
      clearInterval(timer);
      if (!prefersReducedMotion) timer = setInterval(() => goTo(current + 1), DELAY);
    };

    prevBtn.addEventListener('click', () => { goTo(current - 1); restart(); });
    nextBtn.addEventListener('click', () => { goTo(current + 1); restart(); });

    // пауза при наведении / фокусе
    ['pointerenter', 'focusin'].forEach((ev) =>
      slider.addEventListener(ev, () => clearInterval(timer)));
    ['pointerleave', 'focusout'].forEach((ev) =>
      slider.addEventListener(ev, restart));

    // свайп на тач-экранах
    let startX = null;
    slider.addEventListener('touchstart', (ev) => { startX = ev.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', (ev) => {
      if (startX === null) return;
      const dx = ev.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 44) goTo(current + (dx < 0 ? 1 : -1));
      startX = null;
      restart();
    }, { passive: true });

    restart();
  }

  /* ---------- форма обратной связи ---------- */

  if (form) {
    const nameField = $('#f-name');
    const phoneField = $('#f-phone');
    const success = $('.form__success', form);

    const setError = (input, show) => {
      input.closest('.form__field').classList.toggle('has-error', show);
      const err = input.closest('.form__field').querySelector('.form__error');
      if (err) err.hidden = !show;
    };

    [nameField, phoneField].forEach((input) =>
      input.addEventListener('input', () => setError(input, false)));

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();

      const nameOk = nameField.value.trim().length >= 2;
      const digits = phoneField.value.replace(/\D/g, '');
      const phoneOk = digits.length >= 10;
      setError(nameField, !nameOk);
      setError(phoneField, !phoneOk);
      if (!nameOk || !phoneOk) return;

      /* Здесь отправка данных на бэкенд (fetch → ваш обработчик /
         Telegram-бот / Email-сервис). Пока — демо-режим: */
      success.hidden = false;
      form.reset();
      setTimeout(() => { success.hidden = true; }, 6000);
    });
  }

  /* ---------- портфолио: карусель «осенний вихрь» ---------- */

  const mountPortfolio = () => {
    if (!window.LeafCarousel) return;
    const slides = [];
    for (let i = 1; i <= 10; i++) {
      const n = String(i).padStart(2, '0');
      slides.push({
        leaf: 'vendor/leaf-carousel/assets/leaves/leaf-' + n + '.png',
        photo: 'vendor/leaf-carousel/assets/leaves/leaf-' + n + '(1).jpg',
        url: '#',
      });
    }

    window.LeafCarousel.mount('#portfolio-carousel', {
      // bg и libs подхватятся из vendor/leaf-carousel/ автоматически
      slides: slides,
    }).catch(() => {
      // не поднялось (страница открыта как file:// без сервера, нет сети и т.п.) —
      // убираем полу-собранную сцену виджета и показываем фото простой сеткой
      const box = $('#portfolio-carousel');
      if (!box) return;
      box.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'portfolio-fallback';
      slides.forEach((s) => {
        const img = document.createElement('img');
        img.src = s.photo;
        img.alt = 'Пример работы — семейная фотография';
        img.loading = 'lazy';
        grid.appendChild(img);
      });
      box.appendChild(grid);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountPortfolio);
  } else {
    mountPortfolio();
  }

  /* ---------- год в копирайте ---------- */

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
