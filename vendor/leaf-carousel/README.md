# Leaf Carousel — блок портфолио «осенний вихрь за окном»

Переиспользуемый блок-карусель: вид из комнаты через окно, за стеклом кружит
вихрь осенних листьев с фото, по стрелке лист «прилипает» к стеклу, кнопка
«Смотреть фото» открывает оригинал в лайтбоксе.

Стек: Three.js (r160) + GSAP (3.12) — обе библиотеки лежат в `libs/`, виджет
подгружает их сам. Сборка не нужна.

## Состав

```
portfolio-carousel-block/
  leaf-carousel.js   — виджет (один файл: стили, разметка, сцена, логика)
  index.html         — демо-страница
  README.md          — этот файл
  assets/
    bg-window.png    — фон: комната + окно
    leaves/          — leaf-NN.png (листья с фото) и leaf-NN(1).jpg (оригиналы)
  libs/
    three.module.js, gsap.min.js
```

## Быстрый просмотр

Нужен любой локальный HTTP-сервер (ES-модули не работают с `file://`):

```
cd portfolio-carousel-block
python -m http.server 8000
# открыть http://127.0.0.1:8000/
```

## Подключение в свой проект

1. Скопируйте папку целиком (или только `leaf-carousel.js` + `libs/` + `assets/`).

2. В разметку добавьте контейнер и подключите скрипт:

```html
<div id="portfolio"></div>

<script src="путь/до/leaf-carousel.js"></script>
<script>
  LeafCarousel.mount('#portfolio', {
    bg: 'путь/до/assets/bg-window.png',
    slides: [
      { leaf: 'путь/до/assets/leaves/leaf-01.png',
        photo: 'путь/до/assets/leaves/leaf-01(1).jpg',
        url: 'https://example.com/case-1' },
      // … столько слайдов, сколько нужно
    ],
  });
</script>
```

3. Размер блока задаёт обёртка — виджет занимает 100% ширины контейнера
   и держит пропорцию 16:9. Пример:

```css
.my-wrapper { width: min(96vw, 1200px); margin: 0 auto; }
```

## Опции mount()

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `bg` | string | `./assets/bg-window.png` относительно скрипта | фоновая картинка окна |
| `slides` | array | — (обязательно) | `{ leaf, photo?, url?, title? }`; `leaf` — PNG листа, `photo` — оригинал для лайтбокса |
| `libs.three`, `libs.gsap` | string | `./libs/…` рядом со скриптом | пути к библиотекам (можно CDN) |
| `labels` | object | русские подписи | тексты: `view`, `prev`, `next`, `close`, `dialog` |
| `onChange` | function | — | колбэк `(index, slide)` при смене слайда |

Пример с CDN и английскими подписями:

```html
<script>
  LeafCarousel.mount('#portfolio', {
    bg: 'img/window.png',
    slides: [ { leaf: 'img/leaf-1.png', photo: 'img/photo-1.jpg', url: '/works/1' } ],
    libs: {
      three: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
      gsap: 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
    },
    labels: { view: 'View photo', prev: 'Previous', next: 'Next', close: 'Close', dialog: 'Photo viewer' },
  });
</script>
```

## API

`mount()` возвращает Promise c объектом:

- `next()` / `prev()` / `goTo(i)` — управление каруселью;
- `openPhoto()` / `closePhoto()` — лайтбокс;
- `current` — индекс текущего слайда;
- `destroy()` — полная очистка (события, WebGL, разметка).

## Автозапуск (без JS-кода)

```html
<div data-leaf-carousel
     data-bg="assets/bg-window.png"
     data-slides='[{"leaf":"assets/leaves/leaf-01.png","photo":"assets/leaves/leaf-01(1).jpg","url":"#"}]'></div>
```

## Особенности поведения

- Стрелки/кнопка/счётчик работают мышью и клавиатурой (← → Esc).
- `prefers-reduced-motion` и отсутствие WebGL → статичная сетка фото.
- Все стили виджета изолированы префиксом `.lc-` и не конфликтуют со стилями проекта.
- Лайтбокс добавляется в `<body>` один раз на страницу (несколько блоков на странице допустимы).

## Замена контента

- Фото в вихре: положите свои PNG-листья (прозрачный фон, фото внутри) и передайте пути в `slides[].leaf`.
- Оригиналы для лайтбокса: `slides[].photo`.
- Фон: любая картинка «окно из комнаты» ~16:9; геометрия стекла в коде
  (`RAW_PANE`, `CLIP_R` в начале `leaf-carousel.js`) согласована с текущей картинкой —
  при другом кадре их стоит подстроить.
