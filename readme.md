# ⚡ DashConnect — API Dashboard

I built **DashConnect** to showcase everything I learned in the JavaScript unit: DOM manipulation, `fetch`, async/await, and working with multiple public APIs on one cohesive page. Each card is a tiny app, and the whole UI is vanilla HTML/CSS/JS—no frameworks or chart libs.

---

## 🎯 What it does

* 🐶 **Random Dog** (Dog CEO API)
* 🐱 **Random Cat** (TheCatAPI)
* 🌤️ **Weather by ZIP** (Zippopotam.us → Open-Meteo current weather)
* 💱 **Currency converter** (exchangerate.host with a Frankfurter fallback)
* 🧑‍💻 **GitHub user lookup** (GitHub REST API)
* 😂 **Safe jokes** (JokeAPI)
* 🎬 **Movies** (TMDB trending with API key, plus Studio Ghibli fallback)
* 🎨 **Color palettes** (Colormind; apply/revert palette to the site theme)

I also auto-detect the user’s **ZIP from IP** (US only) with `ipapi.co`, and fall back to a default ZIP if that fails.

---

## 🚀 Quick start

1. Download or clone the project.
2. Open `index.html` in any modern browser.

   * Colormind is **HTTP**; some browsers block it on secure contexts. If that happens, the app falls back to a safe local palette.
3. Trending movies use my TMDB key (in code). You can also click **Ghibli** (no key).

---

## 📂 Files

* `index.html` — dashboard structure
* `styles.css` — responsive styles (Subframe-inspired; credit below)
* `app.js` — all fetch logic, DOM updates, palette apply/revert, and helpers

---

## 💡 Highlights I’m proud of

* **Clean async flows** with graceful errors in every card.
* **ZIP enforcement**: only 5 digits allowed as you type.
* **IP bootstrap**: try `ipapi.co` for ZIP; fall back to a default.
* **Two-provider currency**: exchangerate.host, then Frankfurter.
* **Palette → Theme**: map 5 generated colors into CSS gradient variables; **Apply** and **Revert** work instantly.
* **Clipboard UX**: click a swatch to copy its hex (📋 → ✅ feedback).

---

## 🔌 How each mini-app works (API references)

### 🐶 Dog
* Endpoint: `https://dog.ceo/api/breeds/image/random`  
* Docs: [https://dog.ceo/dog-api/](https://dog.ceo/dog-api/)

### 🐱 Cat
* Endpoint: `https://api.thecatapi.com/v1/images/search?size=small`  
* Docs: [https://docs.thecatapi.com/](https://docs.thecatapi.com/)

### 🌤️ Weather (ZIP → current)
1. ZIP → lat/lon with Zippopotam.us  
   * `https://api.zippopotam.us/us/{zip}`  

2. Current weather with Open-Meteo  
   * `https://api.open-meteo.com/v1/forecast?...`  

Docs linked above.

### 💱 Currency
* **Primary:** exchangerate.host  
* **Fallback:** Frankfurter  

### 🧑‍💻 GitHub user
* `https://api.github.com/users/{username}`  

### 😂 Joke (safe mode)
* `https://v2.jokeapi.dev/joke/Any?safe-mode`  

### 🎬 Movies
* **TMDB Trending:** requires API key  
* **Studio Ghibli (fallback):** free, no key  

### 🌎 IP → ZIP
* `https://ipapi.co/json/` (primary)  
* `https://ipinfo.io/json` (backup)  

### 🎨 Colormind palette
* `http://colormind.io/api/` (HTTP only, fallback handled)

---

## 📚 Algorithms & helper references

* **RGB → HSL conversion** — [Wikipedia](https://en.wikipedia.org/wiki/HSL_and_HSV) • [W3C](https://www.w3.org/TR/css-color-4/#the-hsl-notation)  
* **Clipboard API** — [MDN Docs](https://developer.mozilla.org/docs/Web/API/Clipboard_API)  
* **Fetch / async** — [MDN Docs](https://developer.mozilla.org/docs/Web/API/Fetch_API)  
* **Responsive media (`object-fit`, `aspect-ratio`)** — [MDN Docs](https://developer.mozilla.org/)  
* **`toLocaleString` formatting** — [MDN Docs](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number/toLocaleString)

---

## ♿ Accessibility & UX notes

* Visible labels + emoji only (no icon libs).  
* Copy-to-clipboard shows success feedback.  
* Explicit units (°C, m/s, USD/EUR).  
* Input guards (ZIP restricted to 5 digits).  

---

## ⚠️ Known limitations

* **Colormind** is HTTP-only (blocked on HTTPS).  
* **TMDB** requires a personal key.  
* Some APIs throttle anonymous usage; I show graceful errors.  

---

## 🙌 Credits

* **Style inspiration:** Subframe — “CSS Dashboard Examples”  
* **Google Font (Poppins)** — [Google Fonts](https://fonts.google.com/specimen/Poppins)  
* **APIs used:** Dog CEO • TheCatAPI • Zippopotam.us • Open-Meteo • exchangerate.host • Frankfurter • GitHub • JokeAPI • TMDB • Studio Ghibli • ipapi • ipinfo • Colormind  

---

## 👨‍💻 Author

**Austin Carlson**  
[![GitHub](https://img.shields.io/badge/GitHub-@growthwithcoding-181717?style=flat-square&logo=github)](https://github.com/growthwithcoding)  

💬 *“Building cool stuff, one commit at a time.”*  

---

## 📜 License

Educational/portfolio use. Each API has its own terms — please review before use.  
Design inspired by Subframe’s examples; CSS handcrafted.  

---