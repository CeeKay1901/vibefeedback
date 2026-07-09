/*!
 * VibeFeedback Layer — läuft auf jeder Seite via Bookmarklet.
 * Umgeht CORS/Iframe-Beschränkungen, indem er direkt in die Zielseite injiziert wird.
 * Speichert Kommentare in localStorage (Origin der Zielseite) und exportiert als Markdown.
 */
(function () {
  if (window.__vf_layer_active) {
    document.dispatchEvent(new CustomEvent("__vf_layer_toggle_sidebar"));
    return;
  }
  window.__vf_layer_active = true;

  var VF_VERSION = "0.8.0";
  window.__vf_layer_version = VF_VERSION;   // Laufzeit-Marker: veraltetes Bookmarklet erkennbar
  // search/hash mit einbeziehen: SPAs mit Hash-Router (#/seite-a) hätten sonst einen
  // gemeinsamen Store für alle Routen → Badges landen auf falschen Elementen.
  // Als Funktion, weil sich die Route zur Laufzeit ändert.
  function storeKey() {
    return "vibefeedback:v2:" + location.origin + location.pathname + location.search + location.hash;
  }
  var LEGACY_STORE_KEY = "vibefeedback:v2:" + location.origin + location.pathname;
  var AUTHOR_KEY = "vibefeedback:v2:author";   // gleicher Key wie im Haupttool
  var LEGACY_AUTHOR_KEY = "vibefeedback:author";

  // ---------- utils ----------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function truncate(s, n) { s = s || ""; return s.length <= n ? s : s.slice(0, n) + "…"; }
  function toast(msg, ms) {
    $$(".__vfl_toast").forEach(function (t) { t.remove(); });
    var t = document.createElement("div");
    t.className = "__vfl_toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 2200);
  }

  var CATEGORIES = [
    { id: "bug",      label: "Bug",     emoji: "🐛", color: "#e35f5f", sub: "Etwas funktioniert nicht" },
    { id: "feature",  label: "Feature", emoji: "✨", color: "#ffe05e", sub: "Idee / Wunsch" },
    { id: "design",   label: "Design",  emoji: "🎨", color: "#62c12d", sub: "Sieht nicht richtig aus" },
    { id: "copy",     label: "Copy",    emoji: "📝", color: "#e6ca55", sub: "Text / Formulierung" },
    { id: "question", label: "Frage",   emoji: "❓", color: "#5c8fbf", sub: "Ich verstehe nicht..." },
    { id: "praise",   label: "Lob",     emoji: "❤️", color: "#c67ba0", sub: "Das gefällt mir" },
  ];
  var CAT_MAP = {}; CATEGORIES.forEach(function (c) { CAT_MAP[c.id] = c; });
  var PRIORITIES = [
    { id: "must", label: "Muss" },
    { id: "should", label: "Sollte" },
    { id: "could", label: "Könnte" },
    { id: "nice", label: "Nice" },
  ];
  var PRI_MAP = {}; PRIORITIES.forEach(function (p) { PRI_MAP[p.id] = p; });
  var TEMPLATES = {
    bug: { fields: [
      { key: "expected", label: "Erwartetes Verhalten", placeholder: "Was sollte passieren?", rows: 2 },
      { key: "actual", label: "Tatsächliches Verhalten", placeholder: "Was passiert stattdessen?", rows: 2 },
      { key: "steps", label: "Schritte zum Reproduzieren", placeholder: "1. …\n2. …\n3. …", rows: 3 },
    ]},
    feature: { fields: [
      { key: "role", label: "Als …", placeholder: "z. B. neuer Nutzer", rows: 1 },
      { key: "want", label: "möchte ich …", placeholder: "welche Funktion?", rows: 2 },
      { key: "benefit", label: "damit …", placeholder: "welcher Nutzen?", rows: 2 },
    ]},
    design: { fields: [
      { key: "issue", label: "Was stört visuell?", placeholder: "Kontrast, Spacing, Farbe…", rows: 2 },
      { key: "suggestion", label: "Vorschlag", placeholder: "Wie sollte es aussehen?", rows: 2 },
    ]},
    copy: { fields: [
      { key: "current", label: "Aktueller Text", placeholder: "Copy&paste den Text", rows: 2 },
      { key: "suggestion", label: "Vorschlag", placeholder: "Wie besser?", rows: 2 },
    ]},
    question: { fields: [] },
    praise: { fields: [] },
  };

  // ---------- selector / element info ----------
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return "";
    var isUnique = function (s) { try { return document.querySelectorAll(s).length === 1; } catch (e) { return false; } };
    var clean = function (n) {
      return (typeof n.className === "string" ? n.className : "")
        .trim().split(/\s+/).filter(function (c) { return c && !/^__vfl?_/.test(c); });
    };
    var partFor = function (n) {
      if (!n || n.nodeType !== 1) return "";
      var t = n.tagName.toLowerCase();
      if (n.id) { var s = "#" + CSS.escape(n.id); if (isUnique(s)) return s; }
      var cs = clean(n).slice(0, 2).map(function (c) { return "." + CSS.escape(c); }).join("");
      var base = t + cs;
      var p = n.parentNode;
      if (!p || p.nodeType !== 1) return base;
      var siblings = [].slice.call(p.children).filter(function (s) { return s.tagName === n.tagName; });
      if (siblings.length > 1) base += ":nth-of-type(" + (siblings.indexOf(n) + 1) + ")";
      return base;
    };
    var parts = [];
    var cur = el;
    while (cur && cur.nodeType === 1 && cur.tagName.toLowerCase() !== "html") {
      var seg = partFor(cur);
      parts.unshift(seg);
      var candidate = parts.join(" > ");
      if (isUnique(candidate)) return candidate;
      cur = cur.parentNode;
      if (parts.length > 8) break;
    }
    return parts.join(" > ");
  }
  function shortHtml(el, max) {
    if (!el) return "";
    max = max || 400;
    var clone = el.cloneNode(true);
    clone.querySelectorAll && clone.querySelectorAll(".__vfl_badge, .__vfl_hover, .__vfl_selected").forEach(function (n) { n.remove(); });
    var s = clone.outerHTML || "";
    return s.length > max ? s.slice(0, max) + "…" : s;
  }
  function elementInfo(el) {
    if (!el || el.nodeType !== 1) return null;
    var rect = el.getBoundingClientRect();
    var cs = window.getComputedStyle(el);
    return {
      role: (el.getAttribute && el.getAttribute("role")) || el.tagName.toLowerCase(),
      id: el.id || null,
      text: (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 220) || null,
      attrs: {
        href: el.getAttribute && el.getAttribute("href") || null,
        alt: el.getAttribute && el.getAttribute("alt") || null,
        ariaLabel: el.getAttribute && el.getAttribute("aria-label") || null,
      },
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      style: { color: cs.color, backgroundColor: cs.backgroundColor, fontSize: cs.fontSize },
    };
  }

  // ---------- screenshot ----------
  // Engine 1: modern-screenshot (SVG foreignObject) — der Browser rendert den Klon selbst,
  // Bilder und Webfonts werden per fetch (CORS) als dataURL eingebettet. Das zeigt, was
  // der Nutzer wirklich sieht. Engine 2 (Legacy): naiver Klon ohne Asset-Inlining —
  // Fallback, falls die CSP der Zielseite das CDN blockt.
  var MS_CDN = "https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js";
  var SHOT_PLACEHOLDER = "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#ececec"/><path d="M0 0l48 48M48 0L0 48" stroke="#d0d0d0" stroke-width="1"/></svg>');
  var _msLoading = null;
  function loadMs() {
    if (window.modernScreenshot && window.modernScreenshot.domToCanvas) return Promise.resolve(true);
    if (_msLoading) return _msLoading;
    _msLoading = new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = MS_CDN;
      s.onload = function () { resolve(!!(window.modernScreenshot && window.modernScreenshot.domToCanvas)); };
      s.onerror = function () { _msLoading = null; s.remove(); resolve(false); };
      document.head.appendChild(s);
    });
    return _msLoading;
  }
  function effectiveBackground(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      try {
        var bg = window.getComputedStyle(node).backgroundColor;
        if (bg && bg !== "transparent" && !/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(bg)) return bg;
      } catch (e) { break; }
      node = node.parentElement;
    }
    return "#ffffff";
  }
  function absolutizeCssUrls(css, baseHref) {
    if (!baseHref) return css;
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (m, q, u) {
      if (/^(data:|https?:|\/\/)/i.test(u)) return m;
      try { return 'url("' + new URL(u, baseHref).href + '")'; } catch (e) { return m; }
    });
  }
  function extractFontFaces(cssText, baseHref) {
    var blocks = cssText.match(/@font-face\s*\{[^}]*\}/g) || [];
    return blocks.filter(function (b) {
      return !/unicode-range/i.test(b) || b.indexOf("U+0000-00FF") !== -1 || /U\+0-/.test(b);
    }).map(function (b) { return absolutizeCssUrls(b, baseHref); }).join("\n");
  }
  // Erst aus dem Cache; scheitert das, frischer Request mit cache:"reload" — CDNs wie
  // image.tmdb.org senden CORS-Header nur bei Anfragen mit Origin-Header, gecachte
  // <img>-Antworten haben deshalb keine Freigabe.
  // Ein hängender Host darf nicht die ganze Capture-Kette blockieren
  function withTimeout(p, ms, fallback) {
    return Promise.race([p, new Promise(function (r) { setTimeout(function () { r(fallback); }, ms); })]);
  }
  function fetchAsDataUrl(u) {
    function attempt(cache) {
      return fetch(u, { mode: "cors", cache: cache }).then(function (res) {
        if (!res.ok) throw new Error("http " + res.status);
        return res.blob().then(function (blob) {
          return new Promise(function (ok, fail) {
            var fr = new FileReader();
            fr.onload = function () { ok(fr.result); };
            fr.onerror = fail;
            fr.readAsDataURL(blob);
          });
        });
      });
    }
    return attempt("force-cache").catch(function () { return attempt("reload"); }).catch(function () { return false; });
  }
  function inlineFontData(css) {
    var URL_RE = /url\(\s*(['"]?)(https?:[^'")]+)\1\s*\)/g;
    var unique = [], m2;
    while ((m2 = URL_RE.exec(css))) { if (unique.indexOf(m2[2]) === -1) unique.push(m2[2]); }
    unique = unique.slice(0, 24);
    var resolved = {};
    return Promise.all(unique.map(function (u) {
      return fetchAsDataUrl(u).then(function (d) { if (d) resolved[u] = d; });
    })).then(function () {
      return css.replace(/url\(\s*(['"]?)(https?:[^'")]+)\1\s*\)/g, function (m, q, u) {
        return resolved[u] ? 'url("' + resolved[u] + '")' : m;
      });
    });
  }
  var _fontCssP = null;
  function collectFontCss() {
    if (_fontCssP) return _fontCssP;
    _fontCssP = (function () {
      var css = "", fetches = [];
      [].slice.call(document.styleSheets || []).forEach(function (sheet) {
        var rules = null;
        try { rules = sheet.cssRules; } catch (e) {}
        if (!rules) {
          // Timeout: ein stallender Stylesheet-Host dürfte sonst jeden Screenshot der
          // Session blockieren (das Ergebnis wird gecacht).
          if (sheet.href) fetches.push(withTimeout(fetch(sheet.href, { mode: "cors" }).then(function (res) {
            return res.ok ? res.text().then(function (t) { css += extractFontFaces(t, sheet.href) + "\n"; }) : null;
          }).catch(function () {}), 5000, null));
          return;
        }
        [].slice.call(rules).forEach(function (r) {
          if (r.type === CSSRule.FONT_FACE_RULE) css += absolutizeCssUrls(r.cssText, sheet.href || document.baseURI) + "\n";
        });
      });
      return Promise.all(fetches).then(function () { return withTimeout(inlineFontData(css), 8000, css); });
    })();
    // Leeres/gescheitertes Ergebnis nicht dauerhaft cachen
    return _fontCssP.then(function (r) { if (!r) _fontCssP = null; return r; });
  }
  function stripLayerArtifacts(el) {
    var CLASSES = ["__vfl_hover", "__vfl_selected", "__vfl_marked"];
    var touched = [];
    [el].concat($$("." + CLASSES.join(", ."), el)).forEach(function (n) {
      if (!n.classList) return;
      var had = CLASSES.filter(function (c) { return n.classList.contains(c); });
      if (had.length) { n.classList.remove.apply(n.classList, had); touched.push([n, had]); }
    });
    var modalOpen = document.body.classList.contains("__vfl_modal-open");
    if (modalOpen) document.body.classList.remove("__vfl_modal-open");
    return function () {
      touched.forEach(function (t) { t[0].classList.add.apply(t[0].classList, t[1]); });
      if (modalOpen) document.body.classList.add("__vfl_modal-open");
    };
  }
  function captureElement(el) {
    if (!el || el.nodeType !== 1) return Promise.resolve(null);
    var rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return Promise.resolve(null);
    return loadMs().then(function (ok) {
      if (!ok) return captureElementLegacy(el);
      var restore = stripLayerArtifacts(el);
      return withTimeout(collectFontCss().catch(function () { return ""; }), 8000, "").then(function (fontCss) {
        var opts = {
          scale: Math.min(2, window.devicePixelRatio || 1),
          backgroundColor: effectiveBackground(el),
          timeout: 8000,
          filter: function (n) {
            return !(n.nodeType === 1 && typeof n.className === "string" && n.className.indexOf("__vfl_") !== -1);
          },
          fetch: { requestInit: { cache: "force-cache" }, placeholderImage: SHOT_PLACEHOLDER },
          fetchFn: fetchAsDataUrl
        };
        if (fontCss) opts.font = { cssText: fontCss };
        return window.modernScreenshot.domToCanvas(el, opts).then(function (canvas) {
          var MAX = 1400;
          if (canvas.width > MAX || canvas.height > MAX) {
            var f = Math.min(MAX / canvas.width, MAX / canvas.height);
            var out = document.createElement("canvas");
            out.width = Math.round(canvas.width * f);
            out.height = Math.round(canvas.height * f);
            out.getContext("2d").drawImage(canvas, 0, 0, out.width, out.height);
            canvas = out;
          }
          return canvas.toDataURL("image/jpeg", 0.82);
        });
      }).then(function (r) { restore(); return r; }, function (e) {
        restore();
        return captureElementLegacy(el);
      });
    });
  }
  // Eingefügten Screenshot normalisieren: lange Kante begrenzen, als JPEG kodieren —
  // Vollbild-Screenshots würden sonst den localStorage sprengen.
  function normalizePastedImage(blob) {
    return new Promise(function (resolve) {
      if (!blob) return resolve(null);
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var MAX_EDGE = 1400;
        var f = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round((img.naturalWidth || 1) * f));
        c.height = Math.max(1, Math.round((img.naturalHeight || 1) * f));
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }
  function captureElementLegacy(el) {
    return new Promise(function (resolve) {
      if (!el || el.nodeType !== 1) return resolve(null);
      try {
        var rect = el.getBoundingClientRect();
        var pad = 10;
        var w = Math.max(1, Math.ceil(rect.width + pad * 2));
        var h = Math.max(1, Math.ceil(rect.height + pad * 2));
        var MAX = 1400, scale = 1;
        if (w > MAX || h > MAX) { scale = Math.min(MAX / w, MAX / h); w = Math.round(w * scale); h = Math.round(h * scale); }
        var clone = el.cloneNode(true);
        function inline(src, dst) {
          if (!src || !dst || dst.nodeType !== 1) return;
          var s = window.getComputedStyle(src), str = "";
          for (var i = 0; i < s.length; i++) str += s[i] + ":" + s.getPropertyValue(s[i]) + ";";
          dst.setAttribute("style", str);
          dst.removeAttribute("class");
          var sk = src.children, dk = dst.children;
          for (var j = 0; j < sk.length && j < dk.length; j++) inline(sk[j], dk[j]);
        }
        inline(el, clone);
        var wrap = document.createElement("div");
        wrap.style.cssText = "padding:" + pad + "px;box-sizing:border-box;background:#fff;display:inline-block;transform-origin:top left;transform:scale(" + scale + ")";
        wrap.appendChild(clone);
        var inner = new XMLSerializer().serializeToString(wrap);
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">' + inner + "</div></foreignObject></svg>";
        var blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var img = new Image();
        var timeout = setTimeout(function () { URL.revokeObjectURL(url); resolve(null); }, 4000);
        img.onload = function () {
          clearTimeout(timeout);
          try {
            var dpr = Math.min(2, window.devicePixelRatio || 1);
            var canvas = document.createElement("canvas");
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            var ctx = canvas.getContext("2d");
            ctx.scale(dpr, dpr);
            ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.78));
          } catch (e) { resolve(null); }
          URL.revokeObjectURL(url);
        };
        img.onerror = function () { clearTimeout(timeout); URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      } catch (e) { resolve(null); }
    });
  }

  // ---------- storage ----------
  function readStore(key) {
    try { var v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  var comments = readStore(storeKey());
  // Migration: Kommentare, die unter dem alten (hash-losen) Key liegen, übernehmen
  if (!comments.length && storeKey() !== LEGACY_STORE_KEY) comments = readStore(LEGACY_STORE_KEY);
  function saveComments() {
    try { localStorage.setItem(storeKey(), JSON.stringify(comments)); return true; }
    catch (e) { toast("Storage voll — Kommentar nicht gespeichert."); return false; }
  }
  function getAuthor() {
    try { return localStorage.getItem(AUTHOR_KEY) || localStorage.getItem(LEGACY_AUTHOR_KEY) || ""; }
    catch (e) { return ""; }
  }
  function setAuthor(v) { try { v ? localStorage.setItem(AUTHOR_KEY, v) : localStorage.removeItem(AUTHOR_KEY); } catch (e) {} }

  // Hash-Router: Route gewechselt → Kommentare der neuen Route laden
  window.addEventListener("hashchange", function () {
    comments = readStore(storeKey());
    refreshBadges();
    renderSide();
    updateFabCount();
  });

  // ---------- styles ----------
  var style = document.createElement("style");
  style.textContent = [
    ".__vfl_root, .__vfl_root *, .__vfl_modal, .__vfl_modal * { box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }",
    ".__vfl_hover { outline:2px dashed #262626 !important; outline-offset:2px; cursor:crosshair !important; }",
    ".__vfl_selected { outline:3px solid #262626 !important; outline-offset:3px; box-shadow:0 0 0 8px rgba(255,224,94,.55) !important; }",
    ".__vfl_marked { outline:2px solid var(--vfl-c,#ffe05e) !important; outline-offset:1px; }",
    ".__vfl_badge { position:absolute; top:-11px; left:-11px; background:var(--vfl-c,#ffe05e); color:#262626; border:1px solid #262626; border-radius:99px; min-width:22px; height:22px; padding:0 5px; font:700 11px/1 system-ui,sans-serif; display:inline-flex; align-items:center; justify-content:center; z-index:2147483645; pointer-events:none; box-shadow:0 2px 6px rgba(38,38,38,.35); }",
    "body.__vfl_modal-open::after { content:''; position:fixed; inset:0; background:rgba(38,38,38,.35); z-index:2147483640; pointer-events:none; }",
    ".__vfl_fab { position:fixed; bottom:20px; right:20px; z-index:2147483646; display:flex; flex-direction:column; gap:8px; align-items:flex-end; }",
    ".__vfl_fab button { background:#262626; color:#ffe05e; border:1px solid #262626; border-radius:99px; padding:10px 16px; font:600 13px/1 system-ui,sans-serif; cursor:pointer; box-shadow:0 6px 20px rgba(38,38,38,.35); display:inline-flex; align-items:center; gap:6px; }",
    ".__vfl_fab button:hover { background:#ffe05e; color:#262626; }",
    ".__vfl_fab button.__vfl_active { background:#ffe05e; color:#262626; }",
    ".__vfl_fab .__vfl_count { background:#e35f5f; color:#fff; border-radius:99px; padding:1px 8px; font-size:11px; margin-left:6px; }",
    ".__vfl_side { position:fixed; top:0; right:0; bottom:0; width:min(400px,100vw); background:#fcfcfc; color:#262626; border-left:1px solid #e3e1d6; box-shadow:-6px 0 24px rgba(38,38,38,.15); z-index:2147483644; display:flex; flex-direction:column; transform:translateX(100%); transition:transform .22s ease; font-size:14px; }",
    ".__vfl_side.__vfl_on { transform:translateX(0); }",
    ".__vfl_side header { padding:14px 16px; border-bottom:1px solid #e3e1d6; display:flex; align-items:center; gap:10px; }",
    ".__vfl_side header .__vfl_brand { font-weight:700; font-size:15px; flex:1; display:flex; align-items:center; gap:8px; }",
    ".__vfl_side header .__vfl_brand img { height:22px; }",
    ".__vfl_side header button { background:transparent; border:0; font-size:18px; cursor:pointer; padding:2px 6px; color:#7b7a71; }",
    ".__vfl_side .__vfl_tools { padding:10px 12px; border-bottom:1px solid #e3e1d6; display:flex; gap:8px; flex-wrap:wrap; }",
    ".__vfl_side .__vfl_tools button { background:#f1f1ec; color:#262626; border:1px solid #e3e1d6; border-radius:8px; padding:6px 12px; font-size:12.5px; cursor:pointer; font-weight:500; }",
    ".__vfl_side .__vfl_tools button:hover { border-color:#262626; background:#ffe05e; }",
    ".__vfl_list { flex:1; overflow-y:auto; padding:6px; }",
    ".__vfl_empty { padding:40px 20px; color:#7b7a71; font-size:13px; text-align:center; }",
    ".__vfl_item { background:#f1f1ec; border:1px solid #e3e1d6; border-left-width:3px; border-radius:8px; padding:10px 12px; margin:6px 4px; cursor:pointer; }",
    ".__vfl_item:hover { border-color:#262626; background:#e8e6da; }",
    ".__vfl_item .__vfl_row { display:flex; gap:6px; align-items:center; margin-bottom:4px; }",
    ".__vfl_item .__vfl_num { background:#262626; color:#ffe05e; border-radius:99px; width:22px; height:22px; font-size:11px; display:grid; place-items:center; font-weight:700; }",
    ".__vfl_item .__vfl_cat { padding:1px 8px; border-radius:99px; font-size:10.5px; font-weight:600; }",
    ".__vfl_item .__vfl_del { margin-left:auto; background:transparent; border:0; cursor:pointer; color:#7b7a71; padding:2px 6px; font-size:14px; }",
    ".__vfl_item .__vfl_del:hover { color:#e35f5f; }",
    ".__vfl_item .__vfl_txt { font-size:13px; white-space:pre-wrap; word-break:break-word; margin-top:4px; }",
    ".__vfl_item .__vfl_thumb { margin-top:8px; border:1px solid #e3e1d6; border-radius:6px; overflow:hidden; background:#fff; max-height:120px; text-align:center; }",
    ".__vfl_item .__vfl_thumb img { max-width:100%; max-height:120px; display:inline-block; }",
    ".__vfl_modal-bg { position:fixed; inset:0; background:rgba(38,38,38,.35); backdrop-filter:blur(4px); z-index:2147483647; display:grid; place-items:center; padding:12px; }",
    ".__vfl_modal { background:#fff; border:1px solid #e3e1d6; border-radius:16px; width:100%; max-width:520px; padding:14px; box-shadow:0 20px 48px rgba(38,38,38,.2); max-height:calc(100dvh - 24px); overflow-y:auto; }",
    ".__vfl_modal h3 { margin:0 0 8px; font-size:15px; color:#262626; display:flex; align-items:center; gap:8px; }",
    ".__vfl_modal h3 .__vfl_tag { background:#262626; color:#ffe05e; padding:2px 8px; border-radius:6px; font-family:ui-monospace,monospace; font-size:12px; }",
    ".__vfl_modal .__vfl_field { margin-bottom:7px; }",
    ".__vfl_modal label { display:block; font-size:11px; color:#7b7a71; margin-bottom:3px; text-transform:uppercase; letter-spacing:.6px; font-weight:600; }",
    ".__vfl_modal input, .__vfl_modal textarea { width:100%; background:#fff; border:1px solid #e3e1d6; color:#262626; padding:7px 9px; border-radius:8px; font:13px inherit; outline:none; }",
    ".__vfl_modal input:focus, .__vfl_modal textarea:focus { border-color:#262626; box-shadow:0 0 0 3px rgba(255,224,94,.35); }",
    ".__vfl_modal textarea { min-height:44px; resize:vertical; line-height:1.5; }",
    ".__vfl_modal .__vfl_chips { display:flex; gap:6px; flex-wrap:wrap; }",
    ".__vfl_modal .__vfl_chips .__vfl_pick { background:#f1f1ec; border:1px solid #e3e1d6; color:#3b3b3b; padding:6px 11px; border-radius:99px; font-size:12.5px; cursor:pointer; font-weight:500; }",
    ".__vfl_modal .__vfl_chips .__vfl_pick[data-a='1'] { background:#ffe05e; border-color:#262626; color:#262626; font-weight:700; }",
    ".__vfl_modal .__vfl_actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }",
    ".__vfl_modal .__vfl_shotrow { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }",
    ".__vfl_modal .__vfl_shotrow button { background:#f1f1ec; border:1px solid #e3e1d6; color:#3b3b3b; padding:6px 11px; border-radius:99px; font-size:12.5px; cursor:pointer; font-weight:500; }",
    ".__vfl_modal .__vfl_shotrow button:hover { border-color:#262626; }",
    ".__vfl_modal .__vfl_shothint { font-size:11px; color:#7b7a71; }",
    ".__vfl_modal .__vfl_shotrow img { max-width:100%; max-height:110px; border:1px solid #e3e1d6; border-radius:8px; display:block; }",
    ".__vfl_modal .__vfl_actions button { padding:9px 14px; border-radius:9px; border:1px solid #e3e1d6; background:#f1f1ec; color:#262626; font:600 13px inherit; cursor:pointer; }",
    ".__vfl_modal .__vfl_actions button.__vfl_primary { background:#262626; border-color:#262626; color:#fcfcfc; }",
    ".__vfl_modal .__vfl_actions button.__vfl_primary:hover { background:#ffe05e; color:#262626; }",
    ".__vfl_toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#262626; color:#fcfcfc; padding:10px 16px; border-radius:10px; box-shadow:0 6px 20px rgba(38,38,38,.35); z-index:2147483647; font:13px system-ui; }",
    ".__vfl_modal .__vfl_chips .__vfl_pick .__vfl_sub { display:block; font-size:10px; font-weight:400; opacity:.65; margin-top:1px; }",
    ".__vfl_modal .__vfl_author-hint { font-size:11px; color:#5c8fbf; margin-top:3px; }",
    ".__vfl_export-bar { position:fixed; bottom:0; left:0; right:0; z-index:2147483647; background:#ffe05e; border-top:2px solid #262626; padding:12px 16px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; box-shadow:0 -4px 20px rgba(38,38,38,.18); font:600 13px/1.4 system-ui,sans-serif; color:#262626; }",
    ".__vfl_export-bar button { background:#262626; color:#ffe05e; border:1px solid #262626; border-radius:8px; padding:8px 14px; font:600 13px/1 system-ui,sans-serif; cursor:pointer; white-space:nowrap; }",
    ".__vfl_export-bar button:hover { background:#1a1a1a; }",
    ".__vfl_export-bar .__vfl_eb-dismiss { background:transparent; border:0; color:#262626; font-size:16px; padding:6px; cursor:pointer; margin-left:auto; flex-shrink:0; }",
    "@media(max-width:600px){ .__vfl_side { width:100vw; } .__vfl_fab { bottom:12px; right:12px; } .__vfl_fab button { padding:8px 12px; font-size:12px; } }",
  ].join("\n");
  document.head.appendChild(style);

  // ---------- state ----------
  var mode = "off"; // "off" | "select"
  var hoverEl = null;

  // ---------- Export Reminder ----------
  var EXPORT_REMINDED_KEY = "vibefeedback:layer:export-reminded:" + location.origin + location.pathname;
  function showExportReminder() {
    if (document.querySelector(".__vfl_export-bar")) return;
    var bar = document.createElement("div");
    bar.className = "__vfl_export-bar";
    var n = comments.length;
    bar.innerHTML =
      '<span style="flex:1;min-width:160px">💬 Du hast <strong>' + n + ' Kommentar' + (n === 1 ? "" : "e") + '</strong>. Fertig? Exportiere dein Feedback!</span>' +
      '<button data-act="er-md">⬇ Als Markdown</button>' +
      '<button data-act="er-dismiss" class="__vfl_eb-dismiss" aria-label="Schließen">✕</button>';
    document.body.appendChild(bar);
    bar.querySelector('[data-act="er-md"]').addEventListener("click", function () { exportMarkdown(); bar.remove(); });
    bar.querySelector('[data-act="er-dismiss"]').addEventListener("click", function () { bar.remove(); });
  }
  function maybeShowExportReminder() {
    if (comments.length > 0 && !localStorage.getItem(EXPORT_REMINDED_KEY)) {
      localStorage.setItem(EXPORT_REMINDED_KEY, "1");
      showExportReminder();
    }
  }
  // Show reminder when user comes back to the tab after commenting
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") maybeShowExportReminder();
  });

  // ---------- FAB ----------
  var fab = document.createElement("div");
  fab.className = "__vfl_fab";
  fab.innerHTML =
    '<button data-act="mode" title="Kommentiermodus umschalten">🎯 Kommentieren</button>' +
    '<button data-act="side">💬 Liste <span class="__vfl_count">' + comments.length + "</span></button>";
  document.body.appendChild(fab);

  function setMode(m) {
    mode = m;
    var btn = fab.querySelector('[data-act="mode"]');
    if (m === "select") {
      btn.classList.add("__vfl_active");
      btn.textContent = "✕ Modus aus";
      document.body.style.cursor = "crosshair";
    } else {
      btn.classList.remove("__vfl_active");
      btn.textContent = "🎯 Kommentieren";
      document.body.style.cursor = "";
      if (hoverEl) { hoverEl.classList.remove("__vfl_hover"); hoverEl = null; }
    }
  }
  fab.querySelector('[data-act="mode"]').addEventListener("click", function () {
    setMode(mode === "select" ? "off" : "select");
  });
  fab.querySelector('[data-act="side"]').addEventListener("click", function () { toggleSide(); });

  // ---------- Sidebar ----------
  var side = document.createElement("div");
  side.className = "__vfl_side";
  side.innerHTML =
    '<header>' +
      '<div class="__vfl_brand"><span>💬</span>VibeFeedback</div>' +
      '<button data-act="close" title="Schließen">✕</button>' +
    '</header>' +
    '<div class="__vfl_tools">' +
      '<button data-act="export-md" title="Markdown-Datei herunterladen">📄 Markdown</button>' +
      '<button data-act="export-json" title="JSON-Datei herunterladen">💾 JSON</button>' +
      '<button data-act="export-zip" title="Markdown + Screenshots als Bilddateien in einem ZIP">🗜 ZIP</button>' +
      '<button data-act="done" title="Feedback fertig — Markdown herunterladen" style="background:#262626;color:#ffe05e;border-color:#262626;font-weight:700">✅ Fertig</button>' +
      '<button data-act="clear" title="Alle Kommentare löschen" style="margin-left:auto">Alle löschen</button>' +
    '</div>' +
    '<div class="__vfl_list"></div>';
  document.body.appendChild(side);

  function toggleSide(force) {
    var on = typeof force === "boolean" ? force : !side.classList.contains("__vfl_on");
    side.classList.toggle("__vfl_on", on);
    if (on) { renderSide(); }
  }
  document.addEventListener("__vf_layer_toggle_sidebar", function () { toggleSide(true); });
  side.querySelector('[data-act="close"]').addEventListener("click", function () { toggleSide(false); });
  side.querySelector('[data-act="export-md"]').addEventListener("click", exportMarkdown);
  side.querySelector('[data-act="export-json"]').addEventListener("click", exportJSON);
  side.querySelector('[data-act="export-zip"]').addEventListener("click", exportZip);
  side.querySelector('[data-act="done"]').addEventListener("click", function () {
    if (!comments.length) { toast("Noch keine Kommentare."); return; }
    exportMarkdown();
    toast("Markdown heruntergeladen. Feedback abgeschlossen!");
  });
  side.querySelector('[data-act="clear"]').addEventListener("click", function () {
    if (!comments.length) return;
    if (!confirm("Alle Kommentare für diese Seite löschen?")) return;
    comments = []; saveComments(); renderSide(); refreshBadges(); updateFabCount();
  });

  function updateFabCount() {
    var c = fab.querySelector(".__vfl_count");
    if (c) c.textContent = comments.length;
  }
  function renderSide() {
    var list = side.querySelector(".__vfl_list");
    if (!comments.length) {
      list.innerHTML = '<div class="__vfl_empty">Noch keine Kommentare.<br>Klick oben auf 🎯 Kommentieren und dann auf ein Element.</div>';
      updateFabCount(); return;
    }
    list.innerHTML = comments.map(function (c, i) {
      var cat = CAT_MAP[c.category] || CAT_MAP.feature;
      var summary = commentSummary(c);
      return '<div class="__vfl_item" data-id="' + esc(c.id) + '" style="border-left-color:' + cat.color + '">' +
        '<div class="__vfl_row">' +
          '<div class="__vfl_num">' + (i + 1) + '</div>' +
          '<span class="__vfl_cat" style="background:' + cat.color + '22;color:#262626">' + cat.emoji + " " + esc(cat.label) + '</span>' +
          '<button class="__vfl_del" data-del="' + esc(c.id) + '" title="Löschen">✕</button>' +
        '</div>' +
        '<div class="__vfl_txt">' + esc(truncate(summary, 200)) + '</div>' +
        (c.screenshot ? '<div class="__vfl_thumb"><img src="' + c.screenshot + '" alt=""></div>' : "") +
        '</div>';
    }).join("");
    $$(".__vfl_item", list).forEach(function (it) {
      it.addEventListener("click", function (e) {
        if (e.target.closest("[data-del]")) return;
        var c = comments.find(function (x) { return x.id === it.dataset.id; });
        if (c) focusComment(c);
      });
    });
    $$("[data-del]", list).forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        comments = comments.filter(function (c) { return c.id !== b.dataset.del; });
        saveComments(); renderSide(); refreshBadges(); updateFabCount();
      });
    });
    updateFabCount();
  }
  function commentSummary(c) {
    if (c.structured && Object.keys(c.structured).length) {
      var tpl = TEMPLATES[c.category];
      if (tpl && tpl.fields.length) {
        var parts = tpl.fields.map(function (f) {
          return c.structured[f.key] ? f.label + ": " + c.structured[f.key].replace(/\s+/g, " ") : null;
        }).filter(Boolean);
        var joined = parts.join(" · ");
        return joined + (c.text ? " · Notiz: " + c.text.replace(/\s+/g, " ") : "");
      }
    }
    return c.text || "";
  }

  // ---------- fingerprint fallback ----------
  function resolveEl(c) {
    try { var el = document.querySelector(c.selector); if (el) return el; } catch (e) {}
    var info = c.info; var tag = c.tag || "*";
    if (!info) return null;
    if (info.id) { var byId = document.getElementById(info.id); if (byId) return byId; }
    try { if (info.attrs && info.attrs.ariaLabel) { var byAria = document.querySelector('[aria-label="' + info.attrs.ariaLabel.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]'); if (byAria) return byAria; } } catch (e2) {}
    try { if (info.attrs && info.attrs.href) { var byHref = document.querySelector('a[href="' + info.attrs.href.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]'); if (byHref) return byHref; } } catch (e3) {}
    if (info.text) {
      var needle = info.text.trim().slice(0, 80);
      if (needle.length >= 4) {
        var all = [].slice.call(document.querySelectorAll(tag));
        var exact = all.filter(function (el) { return (el.innerText || el.textContent || "").trim().slice(0, 80) === needle; })[0];
        if (exact) return exact;
        if (needle.length >= 20) {
          var pfx = needle.slice(0, 40);
          var partial = all.filter(function (el) { return (el.innerText || el.textContent || "").trim().indexOf(pfx) !== -1; })[0];
          if (partial) return partial;
        }
      }
    }
    return null;
  }

  // ---------- Badges ----------
  function refreshBadges() {
    $$(".__vfl_badge").forEach(function (n) { n.remove(); });
    $$(".__vfl_marked").forEach(function (n) { n.classList.remove("__vfl_marked"); n.style.removeProperty("--vfl-c"); });
    // Aufgezwungenes position:relative zurücknehmen — sonst verändert der Layer den
    // Stacking-Kontext der Wirtsseite dauerhaft (absolut positionierte Kinder verrutschen).
    $$("[data-vfl-pos-set]").forEach(function (n) { n.style.removeProperty("position"); delete n.dataset.vflPosSet; });
    comments.forEach(function (c, i) {
      var el = resolveEl(c);
      if (!el) return;
      var cat = CAT_MAP[c.category] || CAT_MAP.feature;
      el.classList.add("__vfl_marked");
      el.style.setProperty("--vfl-c", cat.color);
      // Void-/Replaced-Elemente (img, input, svg) können keine Kinder rendern —
      // Badge dann ans Elternelement hängen, sonst wäre er unsichtbar.
      var host = /^(img|input|svg|video|canvas|iframe|br|hr)$/i.test(el.tagName) ? el.parentElement : el;
      if (!host) return;
      if (getComputedStyle(host).position === "static") { host.style.position = "relative"; host.dataset.vflPosSet = "1"; }
      var b = document.createElement("span");
      b.className = "__vfl_badge";
      b.style.setProperty("--vfl-c", cat.color);
      b.textContent = cat.emoji + " " + (i + 1);
      host.appendChild(b);
    });
  }
  function focusComment(c) {
    var el = resolveEl(c);
    if (!el) { toast("Element nicht im DOM."); return; }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.animate([
      { boxShadow: "0 0 0 0 rgba(255,224,94,.95)" },
      { boxShadow: "0 0 0 14px rgba(255,224,94,0)" }
    ], { duration: 900 });
  }

  // ---------- click capture ----------
  function isInternal(el) {
    while (el) {
      if (el.classList && (el.classList.contains("__vfl_side") || el.classList.contains("__vfl_fab") || el.classList.contains("__vfl_modal-bg") || el.classList.contains("__vfl_toast"))) return true;
      el = el.parentNode;
    }
    return false;
  }
  document.addEventListener("mouseover", function (e) {
    if (mode !== "select") return;
    if (isInternal(e.target)) return;
    if (hoverEl && hoverEl !== e.target) hoverEl.classList.remove("__vfl_hover");
    hoverEl = e.target;
    hoverEl.classList.add("__vfl_hover");
  }, true);
  document.addEventListener("mouseout", function (e) {
    if (mode !== "select") return;
    if (e.target && e.target.classList) e.target.classList.remove("__vfl_hover");
  }, true);
  document.addEventListener("click", function (e) {
    if (mode !== "select") return;
    if (isInternal(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    var el = e.target;
    if (hoverEl) { hoverEl.classList.remove("__vfl_hover"); hoverEl = null; }
    setMode("off");
    openModal(el);
  }, true);

  // ---------- Modal ----------
  function openModal(el, existing) {
    var isEdit = !!existing;
    var currentEl = el || null;
    var selector = existing ? existing.selector : cssPath(currentEl);
    var snippet = existing ? existing.snippet : shortHtml(currentEl);
    var tag = existing ? existing.tag : currentEl.tagName.toLowerCase();
    var info = existing ? existing.info : elementInfo(currentEl);
    var currentCat = (existing && existing.category) || "feature";
    var currentPri = (existing && existing.priority) || "could";
    var structured = existing && existing.structured ? Object.assign({}, existing.structured) : {};
    if (currentEl && !isEdit) currentEl.classList.add("__vfl_selected");
    document.body.classList.add("__vfl_modal-open");

    var bg = document.createElement("div");
    bg.className = "__vfl_modal-bg";
    bg.innerHTML =
      '<div class="__vfl_modal" role="dialog">' +
        '<h3>' + (isEdit ? "Kommentar bearbeiten" : "Kommentar") + ' <span class="__vfl_tag">&lt;' + esc(tag) + '&gt;</span></h3>' +
        '<div class="__vfl_field"><label>Kategorie</label><div class="__vfl_chips" data-r="cats">' +
          CATEGORIES.map(function (c) { return '<span class="__vfl_pick" data-cat="' + c.id + '" data-a="' + (c.id === currentCat ? 1 : 0) + '" title="' + esc(c.sub || "") + '">' + c.emoji + " " + esc(c.label) + (c.sub ? '<span class="__vfl_sub">' + esc(c.sub) + '</span>' : '') + '</span>'; }).join("") +
        '</div></div>' +
        '<div class="__vfl_field"><label>Priorität</label><div class="__vfl_chips" data-r="prios">' +
          PRIORITIES.map(function (p) { return '<span class="__vfl_pick" data-p="' + p.id + '" data-a="' + (p.id === currentPri ? 1 : 0) + '">' + esc(p.label) + '</span>'; }).join("") +
        '</div></div>' +
        '<div class="__vfl_field"><label>Von</label><input type="text" data-r="author" placeholder="Dein Name (wird gespeichert)">' + (!getAuthor() ? '<span class="__vfl_author-hint">Einmalig eingeben — wird für nächste Kommentare gemerkt.</span>' : '') + '</div>' +
        '<div data-r="tpl"></div>' +
        '<div class="__vfl_field"><label data-r="text-label">Kommentar</label><textarea data-r="text" placeholder="Was ist dir aufgefallen?"></textarea></div>' +
        '<div class="__vfl_field"><label>Screenshot</label><div class="__vfl_shotrow">' +
          '<button type="button" data-act="paste-shot" title="Eigenen Screenshot aus der Zwischenablage einfügen (oder Strg+V)">📋 Aus Zwischenablage</button>' +
          '<span class="__vfl_shothint" data-r="shot-hint">' + (isEdit ? "leer = vorhandener bleibt" : "leer = automatisch") + '</span>' +
          '<img data-r="shot-preview" alt="Screenshot-Vorschau" hidden>' +
        '</div></div>' +
        '<div class="__vfl_actions">' +
          '<button data-act="cancel">Abbrechen</button>' +
          '<button class="__vfl_primary" data-act="save">' + (isEdit ? "Aktualisieren" : "Speichern") + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bg);

    var textArea = bg.querySelector('[data-r="text"]');
    var authorInput = bg.querySelector('[data-r="author"]');
    var textLabel = bg.querySelector('[data-r="text-label"]');
    var tplWrap = bg.querySelector('[data-r="tpl"]');
    authorInput.value = (existing && existing.author) || getAuthor();
    if (isEdit) textArea.value = existing.text || "";

    // Eigener Screenshot aus der Zwischenablage — für Edge-Cases, in denen der
    // Auto-Screenshot nicht stimmt (Canvas/WebGL, CORS-gesperrte Bilder, Video-Frames).
    var pastedShot = null;
    function applyPastedShot(blob) {
      normalizePastedImage(blob).then(function (dataUrl) {
        if (!dataUrl) { toast("Bild konnte nicht gelesen werden."); return; }
        pastedShot = dataUrl;
        var prev = bg.querySelector('[data-r="shot-preview"]');
        prev.src = dataUrl; prev.hidden = false;
        bg.querySelector('[data-r="shot-hint"]').textContent = "eigener Screenshot wird verwendet";
        toast("Eigener Screenshot übernommen.");
      });
    }
    bg.querySelector('[data-act="paste-shot"]').addEventListener("click", function () {
      if (!(navigator.clipboard && navigator.clipboard.read)) { toast("Zwischenablage nicht verfügbar — nutze Strg+V.", 3500); return; }
      navigator.clipboard.read().then(function (items) {
        for (var i = 0; i < items.length; i++) {
          var type = null;
          for (var j = 0; j < items[i].types.length; j++) if (items[i].types[j].indexOf("image/") === 0) type = items[i].types[j];
          if (type) return items[i].getType(type).then(applyPastedShot);
        }
        toast("Kein Bild in der Zwischenablage — erst Screenshot kopieren, dann 📋.", 3500);
      }).catch(function () { toast("Zugriff auf Zwischenablage nicht erlaubt — nutze Strg+V.", 3500); });
    });
    bg.addEventListener("paste", function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image/") === 0) { e.preventDefault(); applyPastedShot(items[i].getAsFile()); return; }
      }
    });

    function renderTpl() {
      var tpl = TEMPLATES[currentCat];
      var has = tpl && tpl.fields.length;
      tplWrap.innerHTML = has ? tpl.fields.map(function (f) {
        return '<div class="__vfl_field"><label>' + esc(f.label) + '</label><textarea data-tpl="' + esc(f.key) + '" rows="' + (f.rows || 2) + '" placeholder="' + esc(f.placeholder || "") + '">' + esc(structured[f.key] || "") + '</textarea></div>';
      }).join("") : "";
      $$("[data-tpl]", tplWrap).forEach(function (inp) {
        inp.addEventListener("input", function () { structured[inp.dataset.tpl] = inp.value; });
      });
      textLabel.textContent = has ? "Notiz (optional)" : "Kommentar";
      textArea.placeholder = has ? "Kontext, Nebenaspekte…" : "Was ist dir aufgefallen?";
    }
    renderTpl();
    setTimeout(function () { ($("[data-tpl]", tplWrap) || textArea).focus(); }, 40);

    $$("[data-r=cats] .__vfl_pick", bg).forEach(function (p) {
      p.addEventListener("click", function () {
        currentCat = p.dataset.cat;
        $$("[data-r=cats] .__vfl_pick", bg).forEach(function (x) { x.dataset.a = (x === p ? 1 : 0); });
        renderTpl();
      });
    });
    $$("[data-r=prios] .__vfl_pick", bg).forEach(function (p) {
      p.addEventListener("click", function () {
        currentPri = p.dataset.p;
        $$("[data-r=prios] .__vfl_pick", bg).forEach(function (x) { x.dataset.a = (x === p ? 1 : 0); });
      });
    });

    var saving = false;    // Doppel-Submit-Guard (Ctrl+Enter umgeht das Button-Disable)
    var aborted = false;   // Esc während "Speichere…" → Ergebnis verwerfen
    function cleanup() {
      aborted = true;
      bg.remove();
      document.body.classList.remove("__vfl_modal-open");
      if (currentEl) currentEl.classList.remove("__vfl_selected");
      document.removeEventListener("keydown", onKey, true);
    }
    function save() {
      if (saving) return;
      var txt = textArea.value.trim();
      var tpl = TEMPLATES[currentCat];
      var struct = {}; var has = false;
      if (tpl && tpl.fields.length) tpl.fields.forEach(function (f) {
        var v = (structured[f.key] || "").trim(); if (v) { struct[f.key] = v; has = true; }
      });
      if (!txt && !has) { textArea.focus(); toast("Kommentar darf nicht leer sein."); return; }
      var author = authorInput.value.trim(); setAuthor(author);
      var btn = bg.querySelector('[data-act="save"]');
      saving = true;
      btn.disabled = true; btn.textContent = "Speichere…";
      var shotP = pastedShot ? Promise.resolve(pastedShot)
        : (!isEdit && currentEl) ? captureElement(currentEl)
        : Promise.resolve(existing ? existing.screenshot : null);
      shotP.then(function (shot) {
        if (aborted) return;   // Nutzer hat mit Esc abgebrochen, während der Screenshot lief
        if (isEdit) {
          var backup = Object.assign({}, existing);   // für Rollback bei Quota-Fehler
          Object.assign(existing, { text: txt, structured: has ? struct : null, author: author || null, category: currentCat, priority: currentPri, updatedAt: new Date().toISOString() });
          if (pastedShot) existing.screenshot = pastedShot;
          if (saveComments()) { renderSide(); refreshBadges(); cleanup(); toast("Aktualisiert."); toggleSide(true); }
          else {
            Object.assign(existing, backup);   // In-Memory-Stand zurückdrehen
            saving = false; btn.disabled = false; btn.textContent = "Aktualisieren";
          }
          return;
        }
        comments.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          selector: selector, snippet: snippet, tag: tag, info: info,
          pageUrl: location.origin + location.pathname + location.search + location.hash,
          text: txt, structured: has ? struct : null,
          screenshot: shot || null,
          author: author || null,
          category: currentCat, priority: currentPri,
          ts: new Date().toISOString(),
        });
        if (saveComments()) { renderSide(); refreshBadges(); cleanup(); toast("Gespeichert."); toggleSide(true); }
        else { comments.pop(); saving = false; btn.disabled = false; btn.textContent = "Speichern"; }
      }).catch(function () {
        if (aborted) return;
        saving = false; btn.disabled = false; btn.textContent = isEdit ? "Aktualisieren" : "Speichern";
        toast("Fehler beim Speichern.");
      });
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); cleanup(); }
      else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); }
    }
    document.addEventListener("keydown", onKey, true);
    bg.querySelector('[data-act="cancel"]').addEventListener("click", cleanup);
    bg.querySelector('[data-act="save"]').addEventListener("click", save);
    bg.addEventListener("click", function (e) { if (e.target === bg) cleanup(); });
  }

  // ---------- exports ----------
  // opts.screenshotPath(comment, index) → relativer Pfad statt data-URL (ZIP-Export)
  function buildMarkdown(opts) {
    opts = opts || {};
    var now = new Date().toLocaleString("de-DE");
    var priOrder = { must: 0, should: 1, could: 2, nice: 3 };
    var sorted = comments.slice().sort(function (a, b) { return (priOrder[a.priority] || 9) - (priOrder[b.priority] || 9); });
    var md = "# Feedback zu " + location.href + "\n\n";
    md += "> " + comments.length + " Kommentar(e), exportiert " + now + ". Erzeugt via VibeFeedback Bookmarklet.\n\n";
    var byCat = {}; CATEGORIES.forEach(function (k) { byCat[k.id] = []; });
    sorted.forEach(function (c) { (byCat[c.category] || (byCat[c.category] = [])).push(c); });
    CATEGORIES.forEach(function (cat) {
      var list = byCat[cat.id] || []; if (!list.length) return;
      md += "## " + cat.emoji + " " + cat.label + " (" + list.length + ")\n\n";
      list.forEach(function (c, i) {
        var pri = PRI_MAP[c.priority] || PRI_MAP.could;
        md += "### " + (i + 1) + ". `<" + c.tag + ">` — Priorität: " + pri.label + "\n\n";
        md += "- **CSS-Selector:** `" + c.selector + "`\n";
        if (c.author) md += "- **Von:** " + c.author + "\n";
        md += "- **Zeitstempel:** " + new Date(c.ts).toLocaleString("de-DE") + "\n\n";
        md += "**HTML-Auszug:**\n\n```html\n" + c.snippet + "\n```\n\n";
        if (c.screenshot) {
          var shotRef = opts.screenshotPath ? opts.screenshotPath(c, i) : c.screenshot;
          if (shotRef) md += "<details><summary>📷 Screenshot</summary>\n\n![Screenshot](" + shotRef + ")\n\n</details>\n\n";
        }
        if (c.structured && Object.keys(c.structured).length) {
          var tpl = TEMPLATES[c.category];
          md += "**Feedback:**\n\n";
          (tpl.fields || []).forEach(function (f) {
            var v = c.structured[f.key]; if (!v) return;
            md += "- **" + f.label + ":**\n" + v.split("\n").map(function (l) { return "  > " + l; }).join("\n") + "\n";
          });
          if (c.text) md += "- **Notiz:**\n" + c.text.split("\n").map(function (l) { return "  > " + l; }).join("\n") + "\n";
          md += "\n---\n\n";
        } else {
          md += "**Feedback:**\n\n" + (c.text || "").split("\n").map(function (l) { return "> " + l; }).join("\n") + "\n\n---\n\n";
        }
      });
    });
    return md;
  }
  function download(name, content, type) {
    var blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }
  // ---------- ZIP-Export (ohne Abhängigkeit) ----------
  // Minimaler ZIP-Writer, Methode "store" (unkomprimiert) — Screenshots sind bereits JPEG.
  var _crcTable = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = _crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function dosDateTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }
  function buildZip(files) {
    var enc = new TextEncoder();
    var dt = dosDateTime(new Date());
    var chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var nameBytes = enc.encode(f.name), data = f.data, crc = crc32(data);
      var local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true);   // UTF-8 Dateinamen
      local.setUint16(8, 0, true);        // store
      local.setUint16(10, dt.time, true);
      local.setUint16(12, dt.date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), nameBytes, data);

      var cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, dt.time, true);
      cd.setUint16(14, dt.date, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, nameBytes.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), nameBytes);
      offset += 30 + nameBytes.length + data.length;
    });
    var centralSize = central.reduce(function (n, c) { return n + c.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob(chunks.concat(central, [new Uint8Array(end.buffer)]), { type: "application/zip" });
  }
  function dataUrlToBytes(dataUrl) {
    var comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    var meta = dataUrl.slice(0, comma);
    if (!/;base64/i.test(meta)) return null;
    var bin = atob(dataUrl.slice(comma + 1));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    var m = meta.match(/^data:image\/(\w+)/i);
    return { bytes: out, ext: ((m && m[1]) || "jpg").replace("jpeg", "jpg") };
  }
  function slugify(str, max) {
    return (str || "").toLowerCase()
      .replace(/[äöüß]/g, function (m) { return { "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" }[m]; })
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max || 32) || "element";
  }
  function exportZip() {
    if (!comments.length) { toast("Keine Kommentare."); return; }
    try {
      var enc = new TextEncoder();
      var shots = [];
      var md = buildMarkdown({
        // Laufende Nummer über alle Kategorien — der Markdown-Index ist kategorie-lokal
        screenshotPath: function (c) {
          var parsed = c.screenshot ? dataUrlToBytes(c.screenshot) : null;
          if (!parsed) return null;
          var label = slugify((c.info && c.info.text) || c.tag || "element", 32);
          var name = "screenshots/" + String(shots.length + 1).padStart(2, "0") + "-" + label + "." + parsed.ext;
          shots.push({ name: name, data: parsed.bytes });
          return name;
        }
      });
      var json = JSON.stringify({ url: location.href, exportedAt: new Date().toISOString(), count: comments.length, comments: comments }, null, 2);
      var readme = [
        "# VibeFeedback-Export",
        "",
        "- **feedback.md** — Feedback zum Lesen und als Prompt-Grundlage; Screenshots sind als Bilddateien verlinkt.",
        "- **feedback.json** — vollständige Daten inkl. eingebetteter Screenshots; in VibeFeedback re-importierbar.",
        "- **screenshots/** — ein Bild je kommentiertem Element.",
        "",
        "Quelle: " + location.href,
        "Exportiert: " + new Date().toLocaleString("de-DE") + " · " + comments.length + " Kommentar(e)",
        ""
      ].join("\n");

      var files = [
        { name: "feedback.md", data: enc.encode(md) },
        { name: "feedback.json", data: enc.encode(json) },
        { name: "README.md", data: enc.encode(readme) }
      ].concat(shots);

      var blob = buildZip(files);
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "vibefeedback-" + new Date().toISOString().slice(0, 10) + ".zip";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 500);
      toast("ZIP heruntergeladen — " + shots.length + " Screenshot(s).", 3000);
    } catch (e) {
      console.warn("[vfl] zip", e);
      toast("ZIP-Export fehlgeschlagen.");
    }
  }
  function exportMarkdown() {
    if (!comments.length) { toast("Keine Kommentare."); return; }
    var stamp = new Date().toISOString().slice(0, 10);
    download("vibefeedback-" + stamp + ".md", buildMarkdown(), "text/markdown;charset=utf-8");
    toast("Markdown heruntergeladen.");
  }
  function exportJSON() {
    if (!comments.length) { toast("Keine Kommentare."); return; }
    var stamp = new Date().toISOString().slice(0, 10);
    download("vibefeedback-" + stamp + ".json", JSON.stringify({ url: location.href, exportedAt: new Date().toISOString(), comments: comments }, null, 2), "application/json");
    toast("JSON heruntergeladen.");
  }

  // ---------- init ----------
  refreshBadges();
  updateFabCount();
  if (comments.length) {
    toggleSide(true);
    toast("VibeFeedback Layer — " + comments.length + " Kommentar(e) geladen.");
  } else {
    toast("VibeFeedback Layer aktiv — klick auf 🎯 Kommentieren und dann auf ein Element.", 3500);
  }
})();
