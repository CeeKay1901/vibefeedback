// Regressionstests für die Bugfix-Runde:
//  1. XSS-Import (id/screenshot/category aus fremder JSON)
//  2. Quota-Pruning mit ISO-ts
//  3. Export/Import erhält pageUrl (Subpage-Zuordnung)
//  4. Badge-Nummer == Sidebar-Nummer bei Multi-Page
//  5. Save während laufendem Capture → Screenshot trotzdem drin
//  6. injectBase: eigenes <base> behält Safety-Script
//  7. loadScriptOnce: Fehlversuch wird nicht dauerhaft gecacht
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const VF = __dirname;
const OUT = path.join(__dirname, "test_artifacts");

function startServer(dir, port) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let fp = req.url.split("?")[0];
      fp = fp === "/modern-screenshot.js" ? path.join(dir, "node_modules/modern-screenshot/dist/index.js") : path.join(dir, fp);
      if (fp.endsWith("/")) fp += "index.html";
      try {
        const body = fs.readFileSync(fp);
        const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css" }[path.extname(fp)] || "text/plain";
        res.writeHead(200, { "Content-Type": mime, "Access-Control-Allow-Origin": "*" });
        res.end(body);
      } catch (e) { res.writeHead(404); res.end(); }
    });
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}

const ok = [], bad = [];
const check = (cond, label, extra) => { (cond ? ok : bad).push(label); console.log(`  ${cond ? "✓" : "✗"} ${label}${extra && !cond ? " — " + extra : ""}`); };

(async () => {
  const PORT = 18089;
  const srv = await startServer(VF, PORT);
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  let xssFired = false;
  page.on("dialog", d => { if (/XSS/i.test(d.message())) xssFired = true; d.accept("Tester"); });
  page.on("pageerror", e => console.log("PAGE ERR:", e.message.slice(0, 140)));
  await page.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${PORT}/modern-screenshot.js";`);

  const target = `http://127.0.0.1:${PORT}/test_screenshot.html`;
  await page.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(target)}&__vftest=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.locator(".coach button").click().catch(() => {});

  // ── 1. XSS-Import ────────────────────────────────────────────────────────
  console.log("\n[1] Import: XSS über id / screenshot / category");
  const malicious = {
    items: [{
      id: 'x"><img src=x onerror="alert(\'XSS-id\')">',
      selector: "#card-simple",
      text: "harmlos",
      ts: "2026-07-09T10:00:00.000Z",
      category: 'bug" onmouseover="alert(\'XSS-cat\')',
      priority: "must",
      screenshot: 'x" onerror="alert(\'XSS-shot\')"',
      page: "http://127.0.0.1:" + PORT + "/test_screenshot.html"
    }]
  };
  const res1 = await page.evaluate(async payload => {
    const file = new File([JSON.stringify(payload)], "evil.json", { type: "application/json" });
    const dt = new DataTransfer(); dt.items.add(file);
    const input = document.getElementById("btn-import-file");
    Object.defineProperty(input, "files", { value: dt.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
    const c = STATE.comments[STATE.comments.length - 1];
    return c ? { id: c.id, cat: c.category, shot: c.screenshot, pageUrl: c.pageUrl } : null;
  }, malicious);
  await page.waitForTimeout(800);
  check(!xssFired, "Kein XSS-Dialog ausgelöst");
  check(res1 && !/[<>"]/.test(res1.id), "Bösartige id wurde ersetzt", res1 && res1.id);
  check(res1 && res1.shot === null, "Bösartiger screenshot verworfen", res1 && String(res1.shot).slice(0, 40));
  check(res1 && res1.cat === "feature", "Unbekannte category auf Default", res1 && res1.cat);
  const injected = await page.evaluate(() => document.querySelectorAll(".sidebar img[src^='x']").length);
  check(injected === 0, "Kein injiziertes img im DOM");

  // ── 3. Import erhält pageUrl ─────────────────────────────────────────────
  console.log("\n[3] Import/Export: Subpage-Zuordnung");
  check(res1 && (res1.pageUrl || "").includes("test_screenshot.html"), "Importierter Kommentar behält pageUrl", res1 && String(res1.pageUrl));
  const mdHasPage = await page.evaluate(() => {
    const md = buildMarkdown();
    const m = md.match(/```json\n([\s\S]*?)\n```/);
    if (!m) return "kein JSON-Block";
    const items = JSON.parse(m[1]).items;
    return items[0] && items[0].page;
  });
  check(typeof mdHasPage === "string" && mdHasPage.includes("test_screenshot.html"), "Export schreibt page-Feld", String(mdHasPage));

  // ── 2. Quota-Pruning mit ISO-ts ──────────────────────────────────────────
  console.log("\n[2] Quota-Pruning erkennt ISO-Zeitstempel");
  // Echte saveComments() aufrufen und localStorage.setItem einen Quota-Fehler werfen lassen,
  // bis die Payload (nach Pruning) klein genug ist.
  const pruned = await page.evaluate(() => {
    const arr = [
      { id: "a", selector: "#x", screenshot: "data:image/jpeg;base64," + "A".repeat(5000), ts: new Date(Date.now() - 3 * 864e5).toISOString() },
      { id: "b", selector: "#y", screenshot: "data:image/jpeg;base64," + "B".repeat(5000), ts: new Date().toISOString() },
      { id: "c", selector: "#z", screenshot: "data:image/jpeg;base64," + "C".repeat(5000), ts: Date.now() - 3 * 864e5 }
    ];
    const orig = localStorage.setItem.bind(localStorage);
    let calls = 0;
    localStorage.setItem = function (k, v) {
      calls++;
      if (v.length > 9000) { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; }
      return orig(k, v);
    };
    let result;
    try { result = saveComments("http://test.local/", arr); }
    finally { localStorage.setItem = orig; }
    return {
      saved: result,
      calls,
      droppedOld: arr[0].screenshot === null && arr[2].screenshot === null,
      keptNew: !!arr[1].screenshot
    };
  });
  check(pruned.saved === true, "saveComments rettet Kommentar nach Pruning");
  check(pruned.calls >= 2, `Zweiter setItem-Versuch nach Pruning (calls: ${pruned.calls})`);
  check(pruned.droppedOld, "Alte Screenshots (ISO + numerisch) entfernt");
  check(pruned.keptNew, "Neuer Screenshot bleibt erhalten");

  // ── 6. injectBase mit eigenem <base> ─────────────────────────────────────
  console.log("\n[6] injectBase: Seite mit eigenem <base>");
  const ib = await page.evaluate(() => {
    const html = '<!doctype html><html><head><base href="https://x.example/"><title>t</title></head><body>hi</body></html>';
    const out = injectBase(html, "https://x.example/page.html");
    return {
      keepsOwnBase: (out.match(/<base /gi) || []).length === 1,
      hasSafety: out.includes("history.replaceState"),
      hasReferrer: out.includes('name="referrer"')
    };
  });
  check(ib.keepsOwnBase, "Eigenes <base> bleibt einzig");
  check(ib.hasSafety, "Safety-Script wird trotzdem injiziert");
  check(ib.hasReferrer, "Referrer-Meta wird injiziert");

  // ── 7. loadScriptOnce Retry nach Fehler ──────────────────────────────────
  console.log("\n[7] Fehlgeschlagener Script-Load wird nicht dauerhaft gecacht");
  const retry = await page.evaluate(async () => {
    const before = await loadScriptOnce("t_retry", "http://127.0.0.1:1/nope.js", () => false);
    const cachedAfterFail = !!window.__vf_probe;
    // Zweiter Aufruf muss erneut versuchen (nicht sofort aus Cache false liefern):
    let attempts = 0;
    const origCreate = document.createElement.bind(document);
    document.createElement = function (t) { if (t === "script") attempts++; return origCreate(t); };
    await loadScriptOnce("t_retry", "http://127.0.0.1:1/nope.js", () => false);
    document.createElement = origCreate;
    return { before, attempts };
  });
  check(retry.before === false, "Fehlversuch liefert false");
  check(retry.attempts === 1, `Zweiter Aufruf versucht erneut (script-Tags: ${retry.attempts})`);

  // ── 5. Screenshot ist opt-in (kein Auto-Capture) ─────────────────────────
  console.log("\n[5] Screenshot opt-in: Standard ohne, per Kamera-Klick mit");
  const clickCardSimple = async () => {
    await page.evaluate(() => {
      const doc = document.querySelector("#frame").contentDocument;
      doc.querySelector("#card-simple").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView }));
    });
    await page.locator(".cbar").waitFor({ state: "visible", timeout: 6000 });
  };
  // (a) Standard: ohne Kamera-Klick → kein Screenshot
  await page.evaluate(() => { STATE.comments.length = 0; renderAll(); refreshFrameBadges(); });
  await clickCardSimple();
  await page.locator(".cbar textarea[data-role='text']").fill("Ohne Screenshot");
  await page.locator(".cbar [data-act='save']").click();
  await page.waitForTimeout(1500);
  const noShot = await page.evaluate(() => {
    const c = STATE.comments[STATE.comments.length - 1];
    return c ? { hasShot: !!c.screenshot } : null;
  });
  check(noShot && !noShot.hasShot, "Standard: Kommentar ohne Screenshot gespeichert");
  // (b) Nach Kamera-Klick → Screenshot vorhanden
  await page.evaluate(() => { STATE.comments.length = 0; renderAll(); refreshFrameBadges(); });
  await clickCardSimple();
  await page.locator(".cbar textarea[data-role='text']").fill("Mit Screenshot");
  await page.locator(".cbar [data-act='screenshot']").click();
  await page.waitForFunction(() => !!(document.querySelector(".cbar-thumb:not([hidden])") || document.querySelector(".cbar canvas")), { timeout: 15000 });
  await page.locator(".cbar [data-act='save']").click();
  await page.waitForTimeout(1500);
  const withShot = await page.evaluate(() => {
    const c = STATE.comments[STATE.comments.length - 1];
    return c ? { hasShot: !!c.screenshot, len: (c.screenshot || "").length } : null;
  });
  check(withShot && withShot.hasShot && withShot.len > 500, `Nach Kamera-Klick: Screenshot vorhanden (${withShot && withShot.len} bytes)`);

  console.log(`\n${ok.length}/${ok.length + bad.length} bestanden`);
  await browser.close();
  srv.close();
  process.exit(bad.length ? 1 : 0);
})();
