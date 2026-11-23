# Сайт ТОЧКА (3D)

- `index.html` — готовый сайт, один файл (шрифты, 3D и стили внутри). Загрузите на любой хостинг (GitHub Pages, Netlify, Cloudflare Pages) и подключите домен.
- `brand/` — логотипы в SVG: светлый, тёмный, отдельная пуговица-знак.
- `source/` — исходники. Пересборка: `npm install three esbuild @fontsource/unbounded @fontsource/onest`, затем
  `BOT_URL=https://t.me/ваш_бот MAIN_URL=https://tocchhka.pro/ TG_URL=https://t.me/pluuuto node build.mjs` (файл появится в `dist/index.html`).

Ссылка на бота-стилиста сейчас ведёт на раздел «Стилист» (`#stylist`). Когда бот будет создан, подставьте её через `BOT_URL` при сборке.

Ссылка на основную ТОЧКУ (меню, блок контактов, подвал) задаётся через `MAIN_URL`.
