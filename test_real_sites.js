// Kernfeature-Matrix gegen ECHTE Seiten (Live-Test, nicht Teil von `npm test`).
// Pro Seite: Laden → Klick → Kommentar speichern → Auto-Screenshot → Badge →
// Subpage-Navigation → Markdown/ZIP-Export → Dashboard-Eintrag.
// Aufruf: node test_real_sites.js
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const VF = __dirname;
const OUT = path.join(VF, "test_artifacts", "real_sites");

const SITES = [
  { name: "kippflix",      url: "https://www.kippflix.com/" },
  { name: "ideen-hangar",  url: "https://ceekay1901.github.io/ideen-hangar/" },
  { name: "skillmarkt",    url: "https://ceekay1901.github.io/pilot-skillmarkt/" },
  { name: "wochenplaner",  url: "https://ceekay1901.github.io/WochenplanerAnna/" },
  { name: "cv",            url: "https://ceekay1901.github.io/cv/" },
];
const NO_CORS_SITE = { name: "example.com (Fehlerpfad)", url: "https://example.com/" };

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
  while (Date.now() - t0 < timeout) {
    const v = await fn();
    if (v) return v;
    await sleep(step);
  }
  return null;
}

async function testSite(ctx, port, site) {
  const r = { name: site.name, url: site.url, errors: [], warns: [] };
  const page = await ctx.newPage();
  page.on("pageerror", e => r.errors.push(e.message.slice(0, 160)));
  page.on("console", m => { if (m.type() !== "log" && /\[vf\]/.test(m.text())) r.warns.push(m.text().slice(0, 160)); });

  try {
    await page.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${port}/modern-screenshot.js";`);
    await page.addInitScript(() => localStorage.setItem("vibefeedback:v2:author", "Matrix"));
    await page.goto(`http://127.0.0.1:${port}/index.html?src=${encodeURIComponent(site.url)}&owner=1&__vftest=1`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.locator(".coach button").click({ timeout: 4000 }).catch(() => {});

    // A: Laden
    const loaded = await waitFor(() => page.evaluate(() => {
      const f = document.querySelector("#frame");
      const err = document.querySelector("#errbox");
      if (err && !err.classList.contains("hidden")) return "error";
      const len = f?.contentDocument?.body?.innerText?.trim().length || 0;
      return len > 40 ? "ok" : null;
    }).catch(() => null), 30000);
    r.load = loaded === "ok";
    if (!r.load) { r.loadDetail = loaded || "timeout"; await page.screenshot({ path: path.join(OUT, `${site.name}_loadfail.png`) }); await page.close(); return r; }

    // B: Klick auf ein Element → Kommentar-Bar
    r.click = !!(await page.evaluate(() => {
      const doc = document.querySelector("#frame")?.contentDocument;
      if (!doc) return false;
      const target = ["h1", "h2", ".card", "main p", "p", "button"].map(s => doc.querySelector(s))
        .find(el => el && el.getBoundingClientRect().width > 20);
      if (!target) return false;
      target.scrollIntoView({ block: "center" });
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView }));
      return true;
    }).catch(() => false));
    r.cbar = !!(await waitFor(() => page.locator(".cbar").isVisible().catch(() => false), 8000));
    if (!r.cbar) { await page.screenshot({ path: path.join(OUT, `${site.name}_nocbar.png`) }); await page.close(); return r; }

    // C/D: Auto-Screenshot abwarten, dann speichern
    const shotReady = await waitFor(() => page.evaluate(() => {
      const t = document.querySelector(".cbar-thumb:not([hidden])");
      const cv = document.querySelector(".cbar .annot .stage canvas");
      return !!(t || cv);
    }).catch(() => false), 30000, 1000);
    r.autoShotUi = !!shotReady;

    const saved = await page.evaluate(async () => {
      const ta = document.querySelector(".cbar textarea[data-role='text']");
      if (ta) { ta.value = "Matrix-Testkommentar"; ta.dispatchEvent(new Event("input")); }
      const btn = document.querySelector(".cbar [data-act='save']");
      if (!btn) return { err: "kein Save-Button" };
      btn.click();
      await new Promise(res => setTimeout(res, 2500));
      const c = (typeof STATE !== "undefined" && STATE.comments[0]) || null;
      return c ? { n: STATE.comments.length, shot: (c.screenshot || "").slice(0, 30), bytes: (c.screenshot || "").length, full: c.screenshot || null } : { err: "kein Kommentar" };
    }).catch(e => ({ err: e.message }));
    r.save = !saved.err && saved.n === 1;
    r.saveDetail = saved.err || "";
    r.screenshot = !!(saved.shot || "").startsWith("data:image/");
    r.shotBytes = saved.bytes || 0;
    if (saved.full) {
      const m = saved.full.match(/^data:image\/(\w+);base64,(.+)$/);
      if (m) fs.writeFileSync(path.join(OUT, `${site.name}_shot.${m[1] === "jpeg" ? "jpg" : m[1]}`), Buffer.from(m[2], "base64"));
    }

    // E: Badge im iframe
    r.badge = !!(await page.evaluate(() => !!document.querySelector("#frame")?.contentDocument?.querySelector(".__vf_badge")).catch(() => false));

    // F: Subpage-Navigation (nur wenn die Seite interne Links hat)
    const link = await page.evaluate(src => {
      const doc = document.querySelector("#frame")?.contentDocument;
      if (!doc) return null;
      const base = new URL(src);
      for (const a of doc.querySelectorAll("a[href]")) {
        try {
          const u = new URL(a.getAttribute("href"), src);
          if (u.host === base.host && u.pathname !== base.pathname && !a.target) return u.href;
        } catch (e) {}
      }
      return null;
    }, site.url).catch(() => null);
    if (!link) { r.subpage = "n/a"; }
    else {
      await page.evaluate(href => {
        const doc = document.querySelector("#frame").contentDocument;
        const a = [...doc.querySelectorAll("a[href]")].find(x => { try { return new URL(x.getAttribute("href"), location.href).pathname === new URL(href).pathname || x.href === href; } catch (e) { return false; } })
          || [...doc.querySelectorAll("a[href]")].find(x => !x.target);
        a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView }));
      }, link).catch(() => {});
      const nav = await waitFor(() => page.evaluate(src => (typeof STATE !== "undefined" && STATE.currentUrl !== src) ? STATE.currentUrl : null, site.url).catch(() => null), 12000, 1000);
      r.subpage = nav ? "ok" : "FAIL";
      r.subpageDetail = nav || "";
    }

    // G: Markdown-Export
    const md = await page.evaluate(() => window.__vftest.buildMarkdown()).catch(() => "");
    r.exportMd = md.includes("Matrix-Testkommentar");

    // H: ZIP-Export (echter Download)
    const zipBtnVisible = await page.locator("#btn-export-zip").isVisible().catch(() => false);
    if (!zipBtnVisible) { r.exportZip = false; r.zipDetail = "Button nicht sichtbar"; }
    else {
      try {
        const [dl] = await Promise.all([
          page.waitForEvent("download", { timeout: 20000 }),
          page.locator("#btn-export-zip").click()
        ]);
        r.exportZip = /\.zip$/.test(dl.suggestedFilename());
      } catch (e) { r.exportZip = false; r.zipDetail = e.message.slice(0, 80); }
    }

    // I: Dashboard kennt das Projekt
    await page.goto(`http://127.0.0.1:${port}/dashboard.html`, { waitUntil: "networkidle" });
    await sleep(500);
    r.dashboard = !!(await page.evaluate(host => [...document.querySelectorAll(".proj-card")].some(c => c.textContent.includes(host)), new URL(site.url).host).catch(() => false));
  } catch (e) {
    r.errors.push("HARNESS: " + e.message.slice(0, 160));
  }
  await page.close();
  return r;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const PORT = 18110;
  const srv = await startServer(PORT);
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });

  const results = [];
  for (const site of SITES) {
    console.log(`\n━━ ${site.name} — ${site.url}`);
    const r = await testSite(ctx, PORT, site);
    results.push(r);
    const fmt = v => v === true ? "✓" : v === false ? "✗" : v;
    console.log(`  Laden ${fmt(r.load)}${r.loadDetail ? " (" + r.loadDetail + ")" : ""} · Klick ${fmt(r.click)} · Bar ${fmt(r.cbar)} · Save ${fmt(r.save)}${r.saveDetail ? " (" + r.saveDetail + ")" : ""}`);
    console.log(`  Screenshot ${fmt(r.screenshot)} (${r.shotBytes} B, UI ${fmt(r.autoShotUi)}) · Badge ${fmt(r.badge)} · Subpage ${fmt(r.subpage)}${r.subpageDetail ? " → " + r.subpageDetail : ""}`);
    console.log(`  Markdown ${fmt(r.exportMd)} · ZIP ${fmt(r.exportZip)}${r.zipDetail ? " (" + r.zipDetail + ")" : ""} · Dashboard ${fmt(r.dashboard)}`);
    if (r.errors.length) console.log(`  PAGEERR: ${r.errors.slice(0, 3).join(" | ")}`);
    if (r.warns.length) console.log(`  WARN: ${[...new Set(r.warns)].slice(0, 3).join(" | ")}`);
  }

  // Fehlerpfad: Seite ohne CORS muss die Fehlerbox mit Fallback zeigen
  console.log(`\n━━ ${NO_CORS_SITE.name} — ${NO_CORS_SITE.url}`);
  const ep = await ctx.newPage();
  await ep.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(NO_CORS_SITE.url)}&owner=1`, { waitUntil: "domcontentloaded" });
  const errShown = await waitFor(() => ep.evaluate(() => {
    const b = document.querySelector("#errbox");
    return b && !b.classList.contains("hidden") && /CORS|nicht geladen/i.test(b.textContent);
  }).catch(() => false), 20000);
  const pasteBtn = errShown ? await ep.locator("#btn-paste").isVisible().catch(() => false) : false;
  console.log(`  Fehlerbox ${errShown ? "✓" : "✗"} · HTML-einfügen-Fallback ${pasteBtn ? "✓" : "✗"}`);
  results.push({ name: NO_CORS_SITE.name, errbox: !!errShown, fallback: !!pasteBtn });
  await ep.close();

  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\nErgebnisse + Screenshots: ${OUT}`);
  await browser.close();
  srv.close();
})();
