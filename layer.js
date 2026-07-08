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

  var VF_VERSION = "0.4.0";
  var STORE_KEY = "vibefeedback:v2:" + location.origin + location.pathname;
  var AUTHOR_KEY = "vibefeedback:author";

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
    { id: "bug", label: "Bug", emoji: "🐛", color: "#e35f5f" },
    { id: "feature", label: "Feature", emoji: "✨", color: "#ffe05e" },
    { id: "design", label: "Design", emoji: "🎨", color: "#62c12d" },
    { id: "copy", label: "Copy", emoji: "📝", color: "#e6ca55" },
    { id: "question", label: "Frage", emoji: "❓", color: "#5c8fbf" },
    { id: "praise", label: "Lob", emoji: "❤️", color: "#c67ba0" },
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

  // ---------- screenshot (SVG foreignObject → canvas) ----------
  function captureElement(el) {
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
  var comments = [];
  try { comments = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch (e) { comments = []; }
  function saveComments() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(comments)); return true; }
    catch (e) { toast("Storage voll — Kommentar nicht gespeichert."); return false; }
  }
  function getAuthor() { try { return localStorage.getItem(AUTHOR_KEY) || ""; } catch (e) { return ""; } }
  function setAuthor(v) { try { v ? localStorage.setItem(AUTHOR_KEY, v) : localStorage.removeItem(AUTHOR_KEY); } catch (e) {} }

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
    ".__vfl_modal .__vfl_actions button { padding:9px 14px; border-radius:9px; border:1px solid #e3e1d6; background:#f1f1ec; color:#262626; font:600 13px inherit; cursor:pointer; }",
    ".__vfl_modal .__vfl_actions button.__vfl_primary { background:#262626; border-color:#262626; color:#fcfcfc; }",
    ".__vfl_modal .__vfl_actions button.__vfl_primary:hover { background:#ffe05e; color:#262626; }",
    ".__vfl_toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#262626; color:#fcfcfc; padding:10px 16px; border-radius:10px; box-shadow:0 6px 20px rgba(38,38,38,.35); z-index:2147483647; font:13px system-ui; }",
  ].join("\n");
  document.head.appendChild(style);

  // ---------- state ----------
  var mode = "off"; // "off" | "select"
  var hoverEl = null;

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
      '<button data-act="export-md">📄 Markdown</button>' +
      '<button data-act="export-json">💾 JSON</button>' +
      '<button data-act="clear">Alle löschen</button>' +
    '</div>' +
    '<div class="__vfl_list"></div>';
  document.body.appendChild(side);

  function toggleSide(force) {
    var on = typeof force === "boolean" ? force : !side.classList.contains("__vfl_on");
    side.classList.toggle("__vfl_on", on);
    if (on) renderSide();
  }
  document.addEventListener("__vf_layer_toggle_sidebar", function () { toggleSide(true); });
  side.querySelector('[data-act="close"]').addEventListener("click", function () { toggleSide(false); });
  side.querySelector('[data-act="export-md"]').addEventListener("click", exportMarkdown);
  side.querySelector('[data-act="export-json"]').addEventListener("click", exportJSON);
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
    comments.forEach(function (c, i) {
      var el = resolveEl(c);
      if (!el) return;
      var cat = CAT_MAP[c.category] || CAT_MAP.feature;
      el.classList.add("__vfl_marked");
      el.style.setProperty("--vfl-c", cat.color);
      if (getComputedStyle(el).position === "static") { el.style.position = "relative"; el.dataset.vflPosSet = "1"; }
      var b = document.createElement("span");
      b.className = "__vfl_badge";
      b.style.setProperty("--vfl-c", cat.color);
      b.textContent = cat.emoji + " " + (i + 1);
      el.appendChild(b);
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
          CATEGORIES.map(function (c) { return '<span class="__vfl_pick" data-cat="' + c.id + '" data-a="' + (c.id === currentCat ? 1 : 0) + '">' + c.emoji + " " + esc(c.label) + '</span>'; }).join("") +
        '</div></div>' +
        '<div class="__vfl_field"><label>Priorität</label><div class="__vfl_chips" data-r="prios">' +
          PRIORITIES.map(function (p) { return '<span class="__vfl_pick" data-p="' + p.id + '" data-a="' + (p.id === currentPri ? 1 : 0) + '">' + esc(p.label) + '</span>'; }).join("") +
        '</div></div>' +
        '<div class="__vfl_field"><label>Von (optional)</label><input type="text" data-r="author" placeholder="Dein Name"></div>' +
        '<div data-r="tpl"></div>' +
        '<div class="__vfl_field"><label data-r="text-label">Kommentar</label><textarea data-r="text" placeholder="Was ist dir aufgefallen?"></textarea></div>' +
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

    function cleanup() {
      bg.remove();
      document.body.classList.remove("__vfl_modal-open");
      if (currentEl) currentEl.classList.remove("__vfl_selected");
      document.removeEventListener("keydown", onKey, true);
    }
    function save() {
      var txt = textArea.value.trim();
      var tpl = TEMPLATES[currentCat];
      var struct = {}; var has = false;
      if (tpl && tpl.fields.length) tpl.fields.forEach(function (f) {
        var v = (structured[f.key] || "").trim(); if (v) { struct[f.key] = v; has = true; }
      });
      if (!txt && !has) { textArea.focus(); toast("Kommentar darf nicht leer sein."); return; }
      var author = authorInput.value.trim(); setAuthor(author);
      var btn = bg.querySelector('[data-act="save"]');
      btn.disabled = true; btn.textContent = "Speichere…";
      var shotP = (!isEdit && currentEl) ? captureElement(currentEl) : Promise.resolve(existing ? existing.screenshot : null);
      shotP.then(function (shot) {
        if (isEdit) {
          Object.assign(existing, { text: txt, structured: has ? struct : null, author: author || null, category: currentCat, priority: currentPri, updatedAt: new Date().toISOString() });
        } else {
          comments.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            selector: selector, snippet: snippet, tag: tag, info: info,
            pageUrl: location.origin + location.pathname,
            text: txt, structured: has ? struct : null,
            screenshot: shot || null,
            author: author || null,
            category: currentCat, priority: currentPri,
            ts: new Date().toISOString(),
          });
        }
        if (saveComments()) { renderSide(); refreshBadges(); cleanup(); toast(isEdit ? "Aktualisiert." : "Gespeichert."); toggleSide(true); }
        else if (!isEdit) { comments.pop(); btn.disabled = false; btn.textContent = "Speichern"; }
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
  function buildMarkdown() {
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
        if (c.screenshot) md += "<details><summary>📷 Screenshot</summary>\n\n![Screenshot](" + c.screenshot + ")\n\n</details>\n\n";
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
  if (comments.length) toggleSide(true);
  toast("VibeFeedback Layer v" + VF_VERSION + " geladen.");
})();
