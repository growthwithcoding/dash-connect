/* DashConnect — API Dashboard
   - Cat placeholder avoidance + robust fallback chain (TheCatAPI → CATAAS → PlaceKitten)
   - Image probing: only accept URLs that actually load
   - Dog fallback to random.dog (filtered)
   - Mood/temperature/vibe palette titles (kept)
   - 
   - Weather: dynamic graphic above details based on weather_code (+day/night)
*/
(() => {
  "use strict";

  // ---------- helpers ----------
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => [...el.querySelectorAll(s)];
  const el = (t, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(t), props);
    for (const k of kids) n.append(k?.nodeType ? k : document.createTextNode(k ?? ""));
    return n;
  };

  const toHex = ([r, g, b]) =>
    "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join("").toUpperCase();

  const hexToRgb = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return [0, 0, 0];
    const int = parseInt(m[1], 16);
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  };

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const mix = (a, b, t) => Math.round(a + (b - a) * clamp01(t));
  const mixHex = (hexA, hexB, t) => {
    const [ar, ag, ab] = hexToRgb(hexA);
    const [br, bg, bb] = hexToRgb(hexB);
    return "#" + [mix(ar, br, t), mix(ag, bg, t), mix(ab, bb, t)]
      .map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  };

  const luminance = (hex) => {
    const [r, g, b] = hexToRgb(hex).map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrastOn = (hex) => (luminance(hex) > 0.55 ? "#1a202c" : "#ffffff");

  // RGB -> HSL
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s, l];
  }

  // ---------- Palette titles: Mood + Temperature + Vibe ----------
  function titleFromPalette(colors) {
    const hsl = colors.map(hex => {
      const [r, g, b] = hexToRgb(hex);
      const [h, s, l] = rgbToHsl(r, g, b);
      return { h: (h + 360) % 360, s, l };
    });

    const avgS = hsl.reduce((a, c) => a + c.s, 0) / hsl.length;
    const avgL = hsl.reduce((a, c) => a + c.l, 0) / hsl.length;
    const hues = hsl.map(o => o.h);

    const mood =
      avgS < 0.22 ? "Muted" :
      avgS < 0.48 ? "Soft"  :
      avgS < 0.72 ? "Vivid" : "Electric";

    const tone =
      avgL < 0.25 ? "Night" :
      avgL < 0.45 ? "Dusk"  :
      avgL < 0.70 ? "Day"   : "Glow";

    const warm = (h) => (h >= 350 || h < 60);
    const cool = (h) => (h >= 160 && h < 260);
    const warmRatio = hues.filter(warm).length / hues.length;
    const coolRatio = hues.filter(cool).length / hues.length;
    const temperature = warmRatio > 0.45 ? "Warm" : coolRatio > 0.45 ? "Cool" : "Balanced";

    const paletteKey = colors.join("");
    const hash = [...paletteKey].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
    const vibes = ["Aurora","Ember","Breeze","Prism","Pulse","Drift","Horizon","Twilight","Lagoon","Noir","Oasis","Nova","Echo","Grove","Nebula","Storm"];
    const vibe = vibes[hash % vibes.length];

    return `${temperature} ${mood} ${tone} ${vibe}`;
  }

  // ---------- image helpers ----------
  function testImage(url, timeoutMs = 8000) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const t = setTimeout(() => {
        if (!done) { done = true; resolve(false); }
      }, timeoutMs);
      img.onload = () => { if (!done) { done = true; clearTimeout(t); resolve(true); } };
      img.onerror = () => { if (!done) { done = true; clearTimeout(t); resolve(false); } };
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.src = url + (url.includes("?") ? "&" : "?") + "cb=" + Date.now();
    });
  }

  async function setBoxImage(box, url, alt, fallbackFn) {
    box.classList.add("skeleton");
    box.replaceChildren();
    const ok = await testImage(url);
    if (!ok) {
      if (typeof fallbackFn === "function") return fallbackFn();
      box.classList.remove("skeleton");
      box.append(el("div", { className: "muted" }, `${alt || "Image"} failed to load.`));
      return;
    }
    const img = el("img", {
      src: url,
      alt: alt || "",
      style: "width:100%;height:100%;object-fit:cover;object-position:center center;display:block;"
    });
    box.classList.remove("skeleton");
    box.replaceChildren(img);
  }

  // ---------- DOG (with fallback) ----------
  const TMDB_KEY = "93e67578345f8de97c427b513c71a651";

  async function loadDog(retries = 5) {
    const box = qs("#dog-img");
    if (!box) return;

    try {
      const res = await fetch("https://dog.ceo/api/breeds/image/random", { cache: "no-store" });
      const d = await res.json();
      if (!res.ok || !d?.message) throw new Error("Dog API failed");
      await setBoxImage(box, d.message, "Random dog", async () => {
        if (retries > 1) return loadDog(retries - 1);
        try {
          const r2 = await fetch("https://random.dog/woof.json?filter=mp4,webm", { cache: "no-store" });
          const j2 = await r2.json();
          const url = j2?.url || "";
          if (url && /\.(jpg|jpeg|png|gif)$/i.test(url)) {
            await setBoxImage(box, url, "Random dog");
            return;
          }
        } catch {}
        box.classList.remove("skeleton");
        box.replaceChildren(el("div", { className: "muted" }, "Dog image failed."));
      });
      return;
    } catch {
      if (retries > 1) return loadDog(retries - 1);
      box.classList.remove("skeleton");
      box.replaceChildren(el("div", { className: "muted" }, "Dog error: could not fetch"));
    }
  }

  // ---------- CAT (avoid Tumblr placeholder; multi-source fallback) ----------
  const isBadCatUrl = (url = "") => {
    const u = url.toLowerCase();
    return (
      u.includes("tumblr.com") ||
      u.includes("violat") ||
      u.includes("removed") ||
      u.includes("placeholder")
    );
  };

  async function fetchValidCatUrl(tries = 10) {
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch("https://api.thecatapi.com/v1/images/search?size=small&mime_types=jpg,png&order=RANDOM", { cache: "no-store" });
        const d = await r.json();
        const url = d?.[0]?.url || "";
        if (!url) continue;
        if (isBadCatUrl(url)) continue;
        if (await testImage(url)) return url;
      } catch {}
    }
    try {
      const url = "https://cataas.com/cat?type=square";
      if (await testImage(url)) return url;
    } catch {}
    const w = 800, h = 500;
    return `https://placekitten.com/${w}/${h}?cb=${Date.now()}`;
  }

  async function loadCat(retries = 10) {
    const box = qs("#cat-img");
    if (!box) return;
    try {
      const url = await fetchValidCatUrl(Math.max(3, retries));
      await setBoxImage(box, url, "Random cat", async () => {
        if (retries > 1) return loadCat(retries - 1);
        box.classList.remove("skeleton");
        box.replaceChildren(el("div", { className: "muted" }, "Cat image failed."));
      });
    } catch (e) {
      box.classList.remove("skeleton");
      box.replaceChildren(el("div", { className: "muted" }, `Cat error: ${e.message}`));
    }
  }

  // ---------- WEATHER ----------
  const WMO = {
    0:"Clear",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
    45:"Fog",48:"Rime fog",
    51:"Light drizzle",53:"Drizzle",55:"Dense drizzle",
    56:"Freezing drizzle",57:"Freezing drizzle",
    61:"Slight rain",63:"Rain",65:"Heavy rain",
    66:"Freezing rain",67:"Freezing rain",
    71:"Slight snow",73:"Snow",75:"Heavy snow",
    77:"Snow grains",
    80:"Rain showers",81:"Rain showers",82:"Heavy showers",
    85:"Snow showers",86:"Heavy snow showers",
    95:"Thunderstorm",96:"Thunderstorm w/ hail",99:"Thunderstorm w/ hail"
  };

  function weatherGraphicSVG(code, isDay) {
    // simple scenes: sky gradient + sun/moon + clouds/raindrops/bolt/snow
    const daySky = "#87CEFA";
    const nightSky = "#1e2a4a";
    const sun = "#FDB813";
    const moon = "#E6E6FA";
    const cloud = "#ffffff";
    const rain = "#4aa3df";
    const snow = "#e5f2ff";
    const bolt = "#ffd000";

    const sky = isDay ? daySky : nightSky;
    const disk = isDay ? sun : moon;

    const hasCloud = [1,2,3,45,48,51,53,55,61,63,65,80,81,82,95,96,99,71,73,75,85,86].includes(code);
    const hasRain  = [51,53,55,61,63,65,80,81,82].includes(code);
    const hasSnow  = [71,73,75,85,86,77].includes(code);
    const hasBolt  = [95,96,99].includes(code);

    return `
<svg class="wg-svg" viewBox="0 0 320 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Weather graphic">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sky}" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
    <filter id="blur" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" />
    </filter>
  </defs>
  <rect x="0" y="0" width="320" height="110" fill="url(#sky)"/>
  <!-- sun/moon -->
  <circle cx="${isDay ? 50 : 260}" cy="32" r="18" fill="${disk}" />
  <!-- clouds -->
  ${hasCloud ? `
    <g fill="${cloud}" filter="url(#blur)" opacity="${isDay ? 0.95 : 0.85}">
      <ellipse cx="120" cy="52" rx="28" ry="16"/>
      <ellipse cx="145" cy="48" rx="26" ry="14"/>
      <ellipse cx="168" cy="52" rx="30" ry="18"/>
    </g>` : ``}
  <!-- rain -->
  ${hasRain ? `
    <g stroke="${rain}" stroke-width="3" stroke-linecap="round">
      ${Array.from({length:12}).map((_,i)=>`<line x1="${90+i*10}" y1="66" x2="${86+i*10}" y2="82"/>`).join("")}
    </g>` : ``}
  <!-- snow -->
  ${hasSnow ? `
    <g fill="${snow}">
      ${Array.from({length:16}).map((_,i)=>`<circle cx="${90+i*10}" cy="${75+(i%2)*8}" r="3"/>`).join("")}
    </g>` : ``}
  <!-- lightning -->
  ${hasBolt ? `
    <polygon points="190,58 178,84 196,74 188,98 214,66 198,72" fill="${bolt}" />` : ``}
</svg>`;
  }

  function setWeatherGraphic(code, isDay, tempC) {
    const host = qs("#weather-graphic");
    if (!host) return;
    host.innerHTML = ""; // clear
    // fallback to a large emoji for super-fast feedback
    const emoji = (c => {
      if ([0,1].includes(c)) return "☀️";
      if ([2].includes(c)) return "🌤️";
      if ([3].includes(c)) return "☁️";
      if ([45,48].includes(c)) return "🌫️";
      if ([61,63,65,80,81,82,51,53,55].includes(c)) return "🌧️";
      if ([95,96,99].includes(c)) return "⛈️";
      if ([71,73,75,85,86,77].includes(c)) return "🌨️";
      return isDay ? "🌥️" : "🌙";
    })(code);
    const wrap = el("div", { className: "wg-emoji", style: "font-size:44px;line-height:1" }, emoji);
    host.append(wrap);

    // async swap-in with the SVG scene
    try {
      const svg = weatherGraphicSVG(code, isDay);
      host.innerHTML = svg;
    } catch {
      // keep emoji if SVG fails for any reason
    }
  }

  async function getWeather() {
    const zip = qs("#weather-zip")?.value?.trim();
    const box = qs("#weather-content");
    if (!box) return;
    if (!zip || !/^\d{5}$/.test(zip)) {
      box.innerHTML = '<div class="muted">Enter a valid 5-digit US ZIP.</div>';
      return;
    }
    box.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    const gfx = qs("#weather-graphic");
    if (gfx) gfx.innerHTML = '<div class="skeleton" style="height:110px;width:100%"></div>';

    try {
      const zr = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!zr.ok) throw new Error("ZIP not found");
      const z = await zr.json();
      const p = z.places?.[0];
      const lat = parseFloat(p.latitude), lon = parseFloat(p.longitude);

      // include is_day if available from Open-Meteo v1 "current"
      const wr = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weather_code,wind_speed_10m,is_day`
      );
      const w = await wr.json();
      const cur = w?.current;
      if (!cur) throw new Error("No weather data");

      const desc = WMO[cur.weather_code] || "—";
      // Render graphic above details
      setWeatherGraphic(cur.weather_code ?? 2, (cur.is_day ?? 1) === 1, Number(cur.temperature_2m));

      box.replaceChildren(
        el("div", { className: "list" },
          el("div", { className: "list-item" }, `📍 ZIP ${zip} — ${p["place name"]}, ${p["state abbreviation"]}`),
          el("div", { className: "list-item" }, `🌡️ ${Number(cur.temperature_2m).toFixed(1)} °C • ${desc}`),
          el("div", { className: "list-item" }, `🌬️ Wind: ${Number(cur.wind_speed_10m).toFixed(1)} m/s`)
        )
      );
    } catch (e) {
      box.innerHTML = `<div class="muted" style="color:#ff6b6b">Weather error: ${e.message}</div>`;
      if (gfx) gfx.innerHTML = "";
    }
  }

  // numeric-only ZIP
  const zipInput = qs("#weather-zip");
  if (zipInput) {
    zipInput.addEventListener("input", () => (zipInput.value = zipInput.value.replace(/\D/g, "").slice(0, 5)));
  }

  async function prefillZipAndLoad() {
    const input = qs("#weather-zip");
    if (!input) return;
    try {
      let zip = "";
      try {
        const r = await fetch("https://ipapi.co/json/");
        zip = (await r.json())?.postal || "";
      } catch {}
      if (!/^\d{5}$/.test(zip)) {
        try {
          const r2 = await fetch("https://ipinfo.io/json?token=af2b0b2c5b4a66");
          zip = (await r2.json())?.postal || "";
        } catch {}
      }
      zip = (zip || "").toString().replace(/\D/g, "").slice(0, 5);
      input.value = /^\d{5}$/.test(zip) ? zip : "84604";
    } finally {
      getWeather();
    }
  }

  // ---------- CURRENCY ----------
  async function convertCurrency() {
    const amount = parseFloat(qs("#cur-amount").value || "0");
    const from = qs("#cur-from").value.trim().toUpperCase();
    const to = qs("#cur-to").value.trim().toUpperCase();
    const out = qs("#currency-content");
    if (!out) return;

    out.textContent = "Converting...";

    if (!amount || amount < 0) {
      out.innerHTML = '<div class="muted">Enter a valid amount.</div>';
      return;
    }
    if (from === to) {
      const same = amount.toLocaleString();
      out.replaceChildren(
        el("div", { className: "list" },
          el("div", { className: "list-item" }, `Rate: 1 ${from} = 1 ${to}`),
          el("div", { className: "list-item" }, `${same} ${from} → ${same} ${to}`)
        )
      );
      return;
    }

    try {
      const r = await fetch(`https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${amount}`);
      const d = await r.json();
      if (!r.ok || d.result == null) throw new Error("No rate");
      const rate = d.info?.rate ?? (d.result / amount);
      render(rate);
      return;
    } catch {}

    try {
      const r = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`);
      const d = await r.json();
      const conv = d?.rates?.[to];
      if (!conv) throw new Error("No rate");
      const rate = conv / amount;
      render(rate);
      return;
    } catch (e) {
      out.innerHTML = `<div class="muted" style="color:#ff6b6b">Currency error: ${e.message}</div>`;
    }

    function render(rate) {
      const converted = rate * amount;
      out.replaceChildren(
        el("div", { className: "list" },
          el("div", { className: "list-item" }, `Rate: 1 ${from} = ${rate.toFixed(6)} ${to}`),
          el("div", { className: "list-item" },
            `${amount.toLocaleString()} ${from} → ${converted.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${to}`)
        )
      );
    }
  }
  qs("#cur-swap")?.addEventListener("click", () => {
    const a = qs("#cur-from"), b = qs("#cur-to");
    const t = a.value; a.value = b.value; b.value = t;
    convertCurrency();
  });

  // ---------- GITHUB ----------
  async function fetchGitHub() {
    const user = qs("#gh-user").value.trim();
    const box = qs("#github-content");
    if (!user) { box.innerHTML = `<div class="muted">Type a username to search.</div>`; return; }
    box.innerHTML = '<div class="skeleton" style="height:104px"></div>';
    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}`);
      if (res.status === 404) throw new Error("User not found");
      const d = await res.json();
      const card = el("div", {},
        el("div", { style: "display:flex;align-items:center;gap:.75rem;justify-content:center;flex-wrap:wrap;" },
          el("img", {
            src: d.avatar_url, alt: `${d.login} avatar`,
            style: "width:72px;height:72px;border-radius:50%;object-fit:cover;border:1px solid var(--border-color)"
          }),
          el("div", {},
            el("div", { style: "font-weight:700" }, d.name || d.login),
            el("div", { className: "muted" }, `@${d.login}`),
            el("a", { href: d.html_url, target: "_blank", rel: "noopener" }, "View Profile")
          )
        ),
        el("div", { className: "list", style: "margin-top:.5rem" },
          el("div", { className: "list-item" }, `📦 Public repos: ${d.public_repos}`),
          el("div", { className: "list-item" }, `Followers: ${d.followers} • Following: ${d.following}`)
        ),
        d.bio ? el("p", { className: "muted", style: "margin-top:.5rem" }, d.bio) : null
      );
      box.replaceChildren(card);
    } catch (err) {
      box.innerHTML = `<div class="muted" style="color:#ff6b6b">GitHub error: ${err.message}</div>`;
    }
  }

  // ---------- JOKE ----------
  async function getJoke() {
    const box = qs("#joke-content");
    box.innerHTML = '<div class="skeleton" style="height:64px"></div>';
    try {
      const res = await fetch("https://v2.jokeapi.dev/joke/Any?safe-mode");
      const j = await res.json();
      const text = j.type === "single" ? j.joke : `${j.setup}\n\n${j.delivery}`;
      box.replaceChildren(el("div", { className: "list-item" }, text));
    } catch (e) {
      box.innerHTML = `<div class="muted" style="color:#ff6b6b">Joke error: ${e.message}</div>`;
    }
  }

  // ---------- COLORMIND + Theming ----------
  let lastPalette = null;
  const themeMsgEl = () => qs("#theme-msg");

  const defaults = (() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      primary: cs.getPropertyValue("--primary-gradient").trim(),
      secondary: cs.getPropertyValue("--secondary-gradient").trim(),
      accent: cs.getPropertyValue("--accent-gradient").trim(),
      border: cs.getPropertyValue("--border-color").trim() || "rgba(226,232,240,.8)",
      link: cs.getPropertyValue("--link-fg").trim() || "#6e48aa",
      header: cs.getPropertyValue("--header-fg").trim() || "#4a5568",
      footer: cs.getPropertyValue("--footer-fg").trim() || "#718096",
    };
  })();

  async function fetchColormind() {
    const candidates = [
      "https://colormind.io/api/",
      "https://www.colormind.io/api/",
      "http://colormind.io/api/",
      "https://cors.isomorphic-git.org/http://colormind.io/api/",
      "https://corsproxy.io/?http://colormind.io/api/"
    ];
    const isHttps = location.protocol === "https:";
    const list = isHttps ? candidates.filter(u => !u.startsWith("http://")) : candidates;

    for (const url of list) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "default" }),
          mode: "cors",
          cache: "no-store",
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (Array.isArray(j?.result) && j.result.length === 5) return j.result.map(toHex);
      } catch {}
    }
    return null;
  }

  function fallbackPalette() {
    const base = Math.random();
    const hsl2hex = (h, s, l) => {
      h = ((h % 1) + 1) % 1;
      const a = s * Math.min(l, 1 - l);
      const f = (n) => {
        const k = (n + h * 12) % 12;
        const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
        return Math.round(255 * c).toString(16).padStart(2, "0");
      };
      return ("#" + f(0) + f(8) + f(4)).toUpperCase();
    };
    return [
      hsl2hex(base + 0.00, 0.55, 0.58),
      hsl2hex(base + 0.08, 0.60, 0.52),
      hsl2hex(base + 0.16, 0.62, 0.47),
      hsl2hex(base + 0.24, 0.58, 0.42),
      hsl2hex(base + 0.40, 0.52, 0.64)
    ];
  }

  async function fetchPalette() {
    const list = qs("#palette-list");
    list.innerHTML = '<div class="skeleton" style="height:120px"></div>';

    let colors = await fetchColormind();
    if (!colors) {
      colors = fallbackPalette();
      themeMsgEl().textContent = "Colormind unreachable — using a generated palette.";
    } else {
      themeMsgEl().textContent = "";
    }

    lastPalette = colors.slice(0, 5);
    renderPalette(lastPalette);
  }

  function renderPalette(colors) {
    const title = titleFromPalette(colors);
    const list = qs("#palette-list");

    const card = el("div", { className: "palette-card" },
      el("div", { className: "palette-title" }, title),
      el("div", { className: "swatches" },
        ...colors.map(hex => {
          const s = el("div", { className: "swatch", style: `background:${hex}` },
            el("span", { className: "copy", title: "Copy" }, "⧉")
          );
          s.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(hex);
              const c = s.querySelector(".copy");
              const prev = c.textContent;
              c.textContent = "✓";
              setTimeout(() => (c.textContent = prev), 900);
            } catch {}
          });
          return s;
        })
      ),
      el("div", { className: "hex" }, colors.join(" • "))
    );
    list.replaceChildren(card);
    themeMsgEl().textContent = "";
  }

  function applyTheme(palette = lastPalette) {
    if (!palette || palette.length < 5) return;
    const [c1, c2, c3, c4, c5] = palette;

    const primaryGrad   = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
    const secondaryGrad = `linear-gradient(135deg, ${c3} 0%, ${c4} 100%)`;
    const accentGrad    = `linear-gradient(135deg, ${c4} 0%, ${c5} 100%)`;
    const root = document.documentElement.style;
    root.setProperty("--primary-gradient", primaryGrad);
    root.setProperty("--secondary-gradient", secondaryGrad);
    root.setProperty("--accent-gradient", accentGrad);

    document.body.style.background = `linear-gradient(160deg,
      ${mixHex(c1, "#FFFFFF", 0.20)} 0%,
      ${mixHex(c2, "#FFFFFF", 0.20)} 30%,
      ${mixHex(c3, "#FFFFFF", 0.22)} 60%,
      ${mixHex(c5, "#FFFFFF", 0.24)} 100%)`;

    const border = mixHex("#E2E8F0", c3, 0.28);
    root.setProperty("--border-color", border);
    root.setProperty("--link-fg", c1);

    const headerFg = mixHex(c1, "#1a202c", 0.15);
    const footerFg = mixHex(c3, "#1a202c", 0.25);
    root.setProperty("--header-fg", headerFg);
    root.setProperty("--footer-fg", footerFg);

    const primaryText = contrastOn(mixHex(c1, c2, 0.5));
    const altText     = contrastOn(mixHex(c3, c4, 0.5));
    root.setProperty("--btn-primary-fg", primaryText);
    root.setProperty("--btn-alt-fg", altText);

    qs("#palette-apply")?.classList.add("applied");
    themeMsgEl().textContent = "Theme applied ✅";
  }

  function revertTheme() {
    const root = document.documentElement.style;
    root.setProperty("--primary-gradient", defaults.primary);
    root.setProperty("--secondary-gradient", defaults.secondary);
    root.setProperty("--accent-gradient", defaults.accent);
    root.setProperty("--border-color", defaults.border);
    root.setProperty("--link-fg", defaults.link);
    root.setProperty("--header-fg", defaults.header);
    root.setProperty("--footer-fg", defaults.footer);
    document.body.style.background = "";
    root.removeProperty("--btn-primary-fg");
    root.removeProperty("--btn-alt-fg");
    qs("#palette-apply")?.classList.remove("applied");
    themeMsgEl().textContent = "Theme reverted ✅";
  }

  // ---------- MOVIES ----------
  let moviesMode = "trending"; // 'trending' | 'ghibli'
  let moviesQty  = 4;          // initial count 4

  function updateMovieButtons() {
    const t = qs("#btn-trending");
    const g = qs("#btn-ghibli");
    if (!t || !g) return;
    t.classList.remove("primary","alt");
    g.classList.remove("primary","alt");
    // Per spec: trending = alt (green), ghibli = primary (purple)
    if (moviesMode === "trending") { t.classList.add("alt"); g.classList.add("primary"); }
    else { g.classList.add("alt"); t.classList.add("primary"); }
  }

  async function loadTrendingMovies() {
    const box = qs("#movies-content");
    if (!box) return;
    box.innerHTML = '<div class="skeleton" style="height:180px"></div>';
    try {
      const r = await fetch(`https://api.themoviedb.org/3/trending/movie/day?api_key=${encodeURIComponent(TMDB_KEY)}`);
      if (!r.ok) { const t = await r.text(); throw new Error(`TMDB ${r.status}: ${t}`); }
      const d = await r.json();
      const items = (d.results || []).slice(0, 4);
      if (!items.length) throw new Error("No trending movies found");
      const grid = el("div", { className: "movies" });
      for (const m of items) {
        const img = m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "";
        grid.append(
          el("article", { className: "movie-card" },
            img ? el("img", { src: img, alt: m.title }) : el("div", { className: "skeleton", style: "height:180px" }),
            el("div", { className: "mc-body" }, `${m.title} ${m.release_date ? `(${m.release_date.slice(0, 4)})` : ""}`)
          )
        );
      }
      box.replaceChildren(grid);
    } catch (e) {
      box.innerHTML = `<div class="muted" style="color:#ff6b6b">TMDB error: ${e.message}</div>`;
    }
  }

  async function loadGhibliMovies() {
    const box = qs("#movies-content");
    if (!box) return;
    box.innerHTML = '<div class="skeleton" style="height:180px"></div>';
    try {
      const res = await fetch("https://ghibliapi.vercel.app/films");
      const films = await res.json();
      const items = films.slice(0, 4);
      const grid = el("div", { className: "movies" });
      for (const f of items) {
        const img = f.image || f.movie_banner || "";
        grid.append(
          el("article", { className: "movie-card" },
            img ? el("img", { src: img, alt: f.title }) : el("div", { className: "skeleton", style: "height:180px" }),
            el("div", { className: "mc-body" }, `${f.title} ${f.release_date ? `(${f.release_date})` : ""}`)
          )
        );
      }
      box.replaceChildren(grid);
    } catch (e) {
      box.innerHTML = `<div class="muted" style="color:#ff6b6b">Ghibli error: ${e.message}</div>`;
    }
  }

  function renderMovies() {
    if (moviesMode === "trending") loadTrendingMovies();
    else loadGhibliMovies();
    updateMovieButtons();
  }

  // ---------- WIRE UP ----------
  qs("#dog-btn")?.addEventListener("click", () => loadDog());
  qs("#cat-btn")?.addEventListener("click", () => loadCat());
  qs("#weather-btn")?.addEventListener("click", getWeather);
  qs("#cur-btn")?.addEventListener("click", convertCurrency);
  qs("#gh-btn")?.addEventListener("click", fetchGitHub);
  qs("#joke-btn")?.addEventListener("click", getJoke);

  qs("#palette-refresh")?.addEventListener("click", fetchPalette);
  qs("#palette-apply")?.addEventListener("click", () => applyTheme());
  qs("#palette-revert")?.addEventListener("click", revertTheme);

  qs("#btn-trending")?.addEventListener("click", () => { moviesMode = "trending"; renderMovies(); });
  qs("#btn-ghibli")?.addEventListener("click", () => { moviesMode = "ghibli"; renderMovies(); });

  // ---------- ON LOAD ----------
  document.addEventListener("DOMContentLoaded", async () => {
    await prefillZipAndLoad();

    loadDog();
    loadCat();

    // Currency default: USD -> EUR
    qs("#cur-from").value = "USD";
    qs("#cur-to").value = "EUR";
    convertCurrency();

    // GitHub default
    const ghInput = qs("#gh-user");
    if (ghInput) { ghInput.value = "growthwithcoding"; fetchGitHub(); }

    // Movies default 
    renderMovies();

    // Palette preview (no auto-apply)
    await fetchPalette();

    // Joke
    getJoke();
  });
})();
