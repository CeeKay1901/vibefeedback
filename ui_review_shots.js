// UI-Review-Sweep: Screenshots aller drei Oberflächen (Landing, Tool+cbar, Dashboard)
// in Desktop (1280) und Mobile (390). Erzeugt reale Daten über den echten Tool-Flow,
// damit das Dashboard befüllt ist. Aufruf: node ui_review_shots.js
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const VF = __dirname;
const OUT = path.join(VF, "test_artifacts", "ui_review");
const PORT = 18133;

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
async function waitFor(fn, t, step = 400) { const t0 = Date.now(); while (Date.now() - t0 < t) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
const base = `http://127.0.0.1:${PORT}`;
const demoSrc = `${base}/demo.html`;

const COMMENTS = [
  { pick: `doc.querySelector("button, .btn, [role=button]")`, cat: "bug", pri: "must",
    tpl: { expected: "Klick öffnet die Detailansicht.", actual: "Nichts passiert sichtbar.", steps: "1. Startseite\n2. Button klicken\n3. Warten" }, text: "Tritt auch auf dem Handy auf." },
  { pick: `doc.querySelector("h1, h2, .hero, header")`, cat: "feature", pri: "should",
    tpl: { role: "wiederkehrender Nutzer", want: "eine Merkliste per Herz-Icon", benefit: "ich finde Titel beim nächsten Besuch wieder" }, text: "Ohne Login, localStorage." },
  { pick: `doc.querySelector("p, .card, li")`, cat: "design", pri: "could",
    tpl: { issue: "Kontrast der Überschrift zu gering, Zeilen zu eng.", suggestion: "Dunklerer Ton, line-height 1.3, mehr Abstand." }, text: "" },
];

async function addComment(page, c) {
  const clicked = await page.evaluate(({ pick }) => {
    const doc = document.querySelector("#frame")?.contentDocument; if (!doc) return false;
    const el = eval(pick); if (!el) return false;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    return true;
  }, c).catch(() => false);
  if (!clicked) return false;
  if (!await waitFor(() => page.locator(".cbar").isVisible().catch(() => false), 8000)) return false;
  await page.locator(`.cbar [data-role=cats] .pick[data-cat="${c.cat}"]`).click().catch(() => {});
  await sleep(150);
  await page.locator(`.cbar [data-role=prios] .pick[data-p="${c.pri}"]`).click().catch(() => {});
  await page.locator(`.cbar [data-act=toggle-expand]`).click().catch(() => {});
  await sleep(150);
  await page.evaluate(({ tpl, text }) => {
    for (const [k, v] of Object.entries(tpl)) { const i = document.querySelector(`.cbar [data-tpl="${k}"]`); if (i) { i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); } }
    const ta = document.querySelector(".cbar [data-role=text]"); if (ta && text) { ta.value = text; ta.dispatchEvent(new Event("input", { bubbles: true })); }
  }, c).catch(() => {});
  await waitFor(() => page.evaluate(() => !!(document.querySelector(".cbar-thumb:not([hidden])") || document.querySelector(".cbar .annot .stage canvas"))).catch(() => false), 20000, 800);
  const before = await page.evaluate(() => STATE.comments.length).catch(() => 0);
  await page.locator(".cbar [data-act=save]").click().catch(() => {});
  return !!await waitFor(() => page.evaluate(n => STATE.comments.length > n, before).catch(() => false), 8000, 400);
}

async function shoot(page, name, full = true) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log("  📸", name);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await startServer(PORT);
  const browser = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true });

  // ---------- LANDING (Desktop + Mobile) ----------
  for (const [vp, tag] of [[{ width: 1280, height: 900 }, "desktop"], [{ width: 390, height: 844 }, "mobile"]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await p.goto(`${base}/index.html`, { waitUntil: "networkidle" });
    await sleep(600);
    await shoot(p, `landing_${tag}`);
    // Setup-Result: URL eingeben + Link erzeugen
    const inp = p.locator("input[type=url], #src-input, input[placeholder*='http'], input").first();
    if (await inp.isVisible().catch(() => false)) {
      await inp.fill(demoSrc).catch(() => {});
      await p.keyboard.press("Enter").catch(() => {});
      await sleep(600);
      await shoot(p, `landing_${tag}_setup-result`);
    }
    await ctx.close();
  }

  // ---------- TOOL (Desktop) — echte Kommentare + cbar-Zustände ----------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(`window.__VF_MS_OVERRIDE="${base}/modern-screenshot.js";`);
  await ctx.addInitScript(() => localStorage.setItem("vibefeedback:v2:author", "Christopher"));
  const tp = await ctx.newPage();
  await tp.goto(`${base}/index.html?src=${encodeURIComponent(demoSrc)}&owner=1&__vftest=1`, { waitUntil: "domcontentloaded" });
  await tp.locator(".coach button").click({ timeout: 3000 }).catch(() => {});
  await waitFor(() => tp.evaluate(() => (document.querySelector("#frame")?.contentDocument?.body?.innerText?.trim().length || 0) > 40).catch(() => false), 20000);
  await sleep(500);
  await shoot(tp, "tool_desktop_loaded", false);

  // cbar offen (compact) — ersten Kommentar bis vor dem Speichern zeigen
  await tp.evaluate(() => {
    const doc = document.querySelector("#frame").contentDocument;
    const el = doc.querySelector("button, .btn, [role=button]") || doc.querySelector("h1,h2");
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  }).catch(() => {});
  await waitFor(() => tp.locator(".cbar").isVisible().catch(() => false), 8000);
  await sleep(600);
  await shoot(tp, "tool_desktop_cbar-compact", false);
  // expandiert (Templates + Annotator)
  await tp.locator(".cbar [data-cat='bug']").click().catch(() => {});
  await tp.locator(".cbar [data-act=toggle-expand]").click().catch(() => {});
  await sleep(700);
  await shoot(tp, "tool_desktop_cbar-expanded", false);
  // abbrechen, dann echte Kommentare anlegen für Sidebar + Dashboard
  await tp.locator(".cbar [data-act=cancel]").click().catch(() => {});
  await sleep(300);
  let n = 0;
  for (const c of COMMENTS) { if (await addComment(tp, c)) n++; await sleep(300); }
  console.log("  Kommentare angelegt:", n);
  await sleep(500);
  await shoot(tp, "tool_desktop_sidebar", false);
  await ctx.close();

  // ---------- TOOL (Mobile) ----------
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mctx.addInitScript(`window.__VF_MS_OVERRIDE="${base}/modern-screenshot.js";`);
  await mctx.addInitScript(() => localStorage.setItem("vibefeedback:v2:author", "Christopher"));
  const mp = await mctx.newPage();
  await mp.goto(`${base}/index.html?src=${encodeURIComponent(demoSrc)}&owner=1&__vftest=1`, { waitUntil: "domcontentloaded" });
  await mp.locator(".coach button").click({ timeout: 3000 }).catch(() => {});
  await waitFor(() => mp.evaluate(() => (document.querySelector("#frame")?.contentDocument?.body?.innerText?.trim().length || 0) > 40).catch(() => false), 20000);
  await sleep(500);
  await shoot(mp, "tool_mobile_loaded", false);
  await mp.evaluate(() => { const doc = document.querySelector("#frame").contentDocument; const el = doc.querySelector("button,.btn,h1,h2"); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); }).catch(() => {});
  await waitFor(() => mp.locator(".cbar").isVisible().catch(() => false), 8000);
  await sleep(600);
  await shoot(mp, "tool_mobile_cbar", false);
  await mctx.close();

  // ---------- DASHBOARD (Desktop + Mobile) — nutzt die im Tool-Flow erzeugten Daten ----------
  // Daten via eigener Context/localStorage neu erzeugen (Tool-Context war origin-gleich, aber geschlossen).
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await dctx.addInitScript(`window.__VF_MS_OVERRIDE="${base}/modern-screenshot.js";`);
  await dctx.addInitScript(() => localStorage.setItem("vibefeedback:v2:author", "Christopher"));
  const seed = await dctx.newPage();
  await seed.goto(`${base}/index.html?src=${encodeURIComponent(demoSrc)}&owner=1&__vftest=1`, { waitUntil: "domcontentloaded" });
  await seed.locator(".coach button").click({ timeout: 3000 }).catch(() => {});
  await waitFor(() => seed.evaluate(() => (document.querySelector("#frame")?.contentDocument?.body?.innerText?.trim().length || 0) > 40).catch(() => false), 20000);
  let sn = 0; for (const c of COMMENTS) { if (await addComment(seed, c)) sn++; await sleep(300); }
  console.log("  Dashboard-Seed Kommentare:", sn);
  // einen Status auf „doing" setzen für Vielfalt
  await seed.evaluate(() => { if (STATE.comments[0]) { STATE.comments[0].status = "doing"; STATE.comments[1] && (STATE.comments[1].status = "done"); localStorage.setItem("vibefeedback:v2:" + STATE.src, JSON.stringify(STATE.comments)); } }).catch(() => {});
  await seed.close();

  for (const [vp, tag] of [[{ width: 1280, height: 900 }, "desktop"], [{ width: 390, height: 844 }, "mobile"]]) {
    const c2 = tag === "desktop" ? dctx : await browser.newContext({ viewport: vp, storageState: await dctx.storageState() });
    if (tag === "desktop") await c2.pages()[0]?.close?.().catch(() => {});
    const dp = await c2.newPage();
    await dp.goto(`${base}/dashboard.html`, { waitUntil: "networkidle" });
    await sleep(700);
    await shoot(dp, `dashboard_${tag}_overview`);
    // Detail öffnen (erste Projektkarte)
    const card = dp.locator(".proj-card, [class*='proj']").first();
    const openBtn = dp.locator("a,button").filter({ hasText: /Im Tool öffnen|öffnen|Detail|▶/ }).first();
    let opened = false;
    if (await card.isVisible().catch(() => false)) {
      // per Hash direkt in Detail
      const src = await dp.evaluate(() => (window.__vftest?.PROJECTS?.[0]?.src) || null).catch(() => null);
      if (src) { await dp.evaluate(s => location.hash = "#p=" + encodeURIComponent(s), src); await sleep(800); opened = true; }
    }
    if (opened) await shoot(dp, `dashboard_${tag}_detail`);
    if (tag !== "desktop") await c2.close();
  }
  await dctx.close();

  console.log("\nScreenshots:", OUT);
  console.log(fs.readdirSync(OUT).filter(f => f.endsWith(".png")).join("\n"));
  await browser.close();
  srv.close();
})();
