// Kernfeature-Realitätscheck: erzeugt einen ECHTEN Export mit drei Kommentaren
// (Bug, Feature, Design) inkl. Auto-Screenshots gegen eine echte Live-Seite und
// legt Markdown + Screenshots + JSON ab — Grundlage zur Bewertung als LLM-Input.
// Aufruf: node test_export_quality.js
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const VF = __dirname;
const OUT = path.join(VF, "test_artifacts", "export_quality");
const TARGET = "https://www.kippflix.com/";

function startServer(port) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let fp = req.url.split("?")[0];
      fp = fp === "/modern-screenshot.js" ? path.join(VF, "node_modules/modern-screenshot/dist/index.js") : path.join(VF, fp);
      if (fp.endsWith("/")) fp += "index.html";
      try {
        const body = fs.readFileSync(fp);
        const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml" }[path.extname(fp)] || "text/plain";
        res.writeHead(200, { "Content-Type": mime, "Access-Control-Allow-Origin": "*" });
        res.end(body);
      } catch (e) { res.writeHead(404); res.end(); }
    });
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, timeout, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { const v = await fn(); if (v) return v; await sleep(step); }
  return null;
}

// Die drei Kommentare: je ein Zielelement + Kategorie + Priorität + Template-Felder + Freitext.
const COMMENTS = [
  {
    label: "BUG",
    // ein Button / interaktives Element
    pick: `doc.querySelector("button, [role=button], .btn, a[href]")`,
    cat: "bug", pri: "must",
    tpl: {
      expected: "Nach Klick auf den Button öffnet sich sofort die Detailansicht des Films.",
      actual: "Nichts passiert sichtbar — der Button reagiert optisch, aber es lädt keine neue Ansicht.",
      steps: "1. Startseite öffnen\n2. Auf den ersten Button/Karten-Link klicken\n3. Warten — es erscheint keine Detailseite",
    },
    text: "Tritt auch nach mehrfachem Klicken auf; auf dem Handy genauso.",
  },
  {
    label: "FEATURE",
    pick: `doc.querySelector("h1, h2, header, .hero")`,
    cat: "feature", pri: "should",
    tpl: {
      role: "wiederkehrender Nutzer",
      want: "eine Merkliste / Watchlist, auf die ich Filme per Herz-Icon direkt aus der Übersicht legen kann",
      benefit: "ich muss mir interessante Titel nicht extern notieren und finde sie beim nächsten Besuch sofort wieder",
    },
    text: "Idealerweise ohne Login, im localStorage gespeichert — passend zum leichtgewichtigen Charakter der Seite.",
  },
  {
    label: "DESIGN",
    pick: `doc.querySelector("h1, h2, .title, p")`,
    cat: "design", pri: "could",
    tpl: {
      issue: "Die Überschrift hat zu wenig Kontrast zum Hintergrund und wirkt gedrängt — die Zeilenhöhe ist eng.",
      suggestion: "Dunkleren/kräftigeren Farbwert für den Titel, etwas mehr Zeilenabstand (line-height ~1.3) und Abstand nach unten.",
    },
    text: "",
  },
];

async function addComment(page, c, idx) {
  const r = { label: c.label, ok: false };
  // 1. Element im iframe finden + anklicken
  const clicked = await page.evaluate(({ pick }) => {
    const doc = document.querySelector("#frame")?.contentDocument;
    if (!doc) return false;
    const el = eval(pick);
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
    return true;
  }, c).catch(() => false);
  r.clicked = clicked;
  if (!clicked) return r;

  const cbar = await waitFor(() => page.locator(".cbar").isVisible().catch(() => false), 8000);
  r.cbar = !!cbar;
  if (!cbar) return r;

  // 2. Expand aufklappen — Kategorie/Priorität/Template-Felder liegen jetzt dort
  await page.locator(`.cbar [data-act=toggle-expand]`).first().click().catch(() => {});
  await sleep(200);
  // 3. Kategorie wählen (löst renderTemplate aus)
  await page.locator(`.cbar-expanded [data-role=cats] .pick[data-cat="${c.cat}"]`).click().catch(() => {});
  await sleep(200);
  // 4. Priorität
  await page.locator(`.cbar-expanded [data-role=prios] .pick[data-p="${c.pri}"]`).click().catch(() => {});

  // 5. Template-Felder + Freitext füllen
  await page.evaluate(({ tpl, text }) => {
    for (const [k, v] of Object.entries(tpl)) {
      const inp = document.querySelector(`.cbar [data-tpl="${k}"]`);
      if (inp) { inp.value = v; inp.dispatchEvent(new Event("input", { bubbles: true })); }
    }
    const ta = document.querySelector(".cbar [data-role=text]");
    if (ta && text) { ta.value = text; ta.dispatchEvent(new Event("input", { bubbles: true })); }
  }, c).catch(() => {});

  // 6. Auto-Screenshot abwarten (thumb sichtbar ODER Annotator-Canvas)
  r.shot = !!(await waitFor(() => page.evaluate(() =>
    !!(document.querySelector(".cbar-thumb:not([hidden])") || document.querySelector(".cbar .annot .stage canvas"))
  ).catch(() => false), 30000, 1000));

  // 7. Speichern
  const before = await page.evaluate(() => STATE.comments.length).catch(() => 0);
  await page.locator(".cbar [data-act=save]").click().catch(() => {});
  const grew = await waitFor(() => page.evaluate(n => STATE.comments.length > n, before).catch(() => false), 8000, 500);
  r.saved = !!grew;
  r.ok = r.saved;
  return r;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const PORT = 18122;
  const srv = await startServer(PORT);
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("  PAGEERR:", e.message.slice(0, 160)));

  await page.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${PORT}/modern-screenshot.js";`);
  await page.addInitScript(() => localStorage.setItem("vibefeedback:v2:author", "Christopher (Tester)"));
  console.log("→ lade", TARGET);
  await page.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(TARGET)}&owner=1&__vftest=1`,
    { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator(".coach button").click({ timeout: 4000 }).catch(() => {});

  const loaded = await waitFor(() => page.evaluate(() => {
    const f = document.querySelector("#frame");
    return (f?.contentDocument?.body?.innerText?.trim().length || 0) > 40 ? "ok" : null;
  }).catch(() => null), 30000);
  console.log("  geladen:", loaded || "TIMEOUT");
  if (!loaded) { await browser.close(); srv.close(); return; }

  const results = [];
  for (let i = 0; i < COMMENTS.length; i++) {
    const r = await addComment(page, COMMENTS[i], i);
    results.push(r);
    console.log(`  [${r.label}] geklickt=${r.clicked} bar=${r.cbar} shot=${r.shot} gespeichert=${r.saved}`);
    await sleep(400);
  }

  // ECHTER Markdown-Export (mit eingebetteten Screenshots) — wie „In Zwischenablage/Download"
  const md = await page.evaluate(() => window.__vftest.buildMarkdown()).catch(e => "ERR:" + e.message);

  // Screenshots als Dateien ablegen + im Markdown durch Dateiref ersetzen (lesbare Variante)
  const shots = await page.evaluate(() => STATE.comments.map((c, i) => ({ i, cat: c.category, shot: c.screenshot || null })))
    .catch(() => []);
  let readable = md;
  shots.forEach(s => {
    if (!s.shot) return;
    const m = s.shot.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) return;
    const ext = m[1] === "jpeg" ? "jpg" : m[1];
    const fname = `shot_${s.cat}_${s.i}.${ext}`;
    fs.writeFileSync(path.join(OUT, fname), Buffer.from(m[2], "base64"));
    readable = readable.split(s.shot).join(fname);
  });

  fs.writeFileSync(path.join(OUT, "feedback.md"), md);
  fs.writeFileSync(path.join(OUT, "feedback.readable.md"), readable);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ target: TARGET, results, shots: shots.map(s => ({ i: s.i, cat: s.cat, hasShot: !!s.shot, bytes: (s.shot || "").length })) }, null, 2));

  console.log(`\nMarkdown: ${md.length} Zeichen · Screenshots: ${shots.filter(s => s.shot).length}/${shots.length}`);
  console.log("Artefakte:", OUT);
  await browser.close();
  srv.close();
})();
