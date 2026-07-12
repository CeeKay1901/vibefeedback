// Paste-Override-Test: eigenes Bild aus der Zwischenablage ersetzt den Auto-Screenshot.
// Testet index.html (📋-Button + Strg+V-Pfad) und layer.js (📋-Button).
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const VF = path.join(__dirname, "..");
const OUT = path.join(__dirname, "test_artifacts");
fs.mkdirSync(OUT, { recursive: true });

function startServer(dir, port) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const urlPath = req.url.split("?")[0];
      let fp = urlPath === "/modern-screenshot.js" ? path.join(dir, "node_modules/modern-screenshot/dist/index.js")
        : urlPath === "/html2canvas.min.js" ? path.join(dir, "node_modules/html2canvas/dist/html2canvas.min.js")
        : path.join(dir, urlPath);
      if (fp.endsWith("/")) fp += "index.html";
      try {
        const body = fs.readFileSync(fp);
        const mime = { ".html": "text/html", ".js": "application/javascript", ".svg": "image/svg+xml" }[path.extname(fp)] || "text/plain";
        res.writeHead(200, { "Content-Type": mime, "Access-Control-Allow-Origin": "*" });
        res.end(body);
      } catch (e) { res.writeHead(404); res.end(); }
    });
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}

// Magenta-Testbild in die echte Zwischenablage schreiben (im Seitenkontext)
const WRITE_CLIPBOARD = `(async () => {
  const c = document.createElement("canvas"); c.width = 320; c.height = 200;
  const x = c.getContext("2d");
  x.fillStyle = "#ff00aa"; x.fillRect(0, 0, 320, 200);
  x.fillStyle = "#fff"; x.font = "bold 28px sans-serif"; x.fillText("EIGENER SHOT", 30, 105);
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  return true;
})()`;

const ok = [], bad = [];
const check = (cond, label) => { (cond ? ok : bad).push(label); console.log(`  ${cond ? "✓" : "✗"} ${label}`); };

(async () => {
  const PORT = 18086;
  const srv = await startServer(VF, PORT);
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("PAGE ERR:", e.message.slice(0, 140)));
  await page.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${PORT}/modern-screenshot.js"; window.__VF_H2C_OVERRIDE = "http://127.0.0.1:${PORT}/html2canvas.min.js";`);

  // ── Teil 1: index.html — 📋-Button ────────────────────────────────────────
  console.log("[1] index.html: Auto-Capture, dann 📋-Override");
  await page.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(`http://127.0.0.1:${PORT}/test_screenshot.html`)}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.locator(".coach button").click().catch(() => {});
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const doc = document.querySelector("#frame").contentDocument;
    doc.querySelector("#card-simple").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView }));
  });
  await page.waitForTimeout(600);
  check(await page.locator(".cbar").isVisible(), "Kommentar-Bar offen");
  // Screenshot ist opt-in: standardmäßig KEIN Auto-Screenshot im Thumb
  check(await page.locator(".cbar-thumb").getAttribute("hidden") !== null, "Standard: kein Auto-Screenshot (Thumb verborgen)");

  check(await page.evaluate(WRITE_CLIPBOARD).catch(e => { console.log("  clipboard write:", e.message); return false; }), "Testbild in Zwischenablage geschrieben");
  await page.locator(".cbar [data-act='paste-shot']").click();
  await page.waitForTimeout(1200);
  const pastedThumb = await page.locator(".cbar-thumb").getAttribute("src");
  check(!!pastedThumb, "Thumb zeigt eigenen Screenshot nach Einfügen");

  await page.locator(".cbar textarea[data-role='text']").fill("Paste-Test");
  page.once("dialog", d => d.accept("Tester"));
  await page.locator(".cbar [data-act='save']").click();
  await page.waitForTimeout(1500);
  const saved = await page.evaluate(() => {
    const c = STATE.comments[STATE.comments.length - 1];
    return c ? { len: (c.screenshot || "").length, shot: c.screenshot } : null;
  });
  check(saved && saved.len > 500, `Screenshot gespeichert (${saved && saved.len} bytes)`);
  if (saved && saved.shot) fs.writeFileSync(path.join(OUT, "paste_saved_index.jpg"), Buffer.from(saved.shot.split(",")[1], "base64"));

  // ── Teil 2: index.html — Strg+V-Pfad (synthetisches Paste-Event) ─────────
  console.log("[2] index.html: Paste-Event (Strg+V)");
  await page.evaluate(() => {
    const doc = document.querySelector("#frame").contentDocument;
    doc.querySelector("#hero-block").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView }));
  });
  await page.waitForTimeout(2500);
  const beforePaste = await page.locator(".cbar-thumb").getAttribute("src");
  await page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 200; c.height = 100;
    const x = c.getContext("2d"); x.fillStyle = "#00ccff"; x.fillRect(0, 0, 200, 100);
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "shot.png", { type: "image/png" }));
    const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
    document.querySelector(".cbar textarea[data-role='text']").dispatchEvent(ev);
  });
  await page.waitForTimeout(1200);
  const afterPaste = await page.locator(".cbar-thumb").getAttribute("src");
  check(afterPaste && afterPaste !== beforePaste, "Strg+V ersetzt Screenshot");
  await page.locator(".cbar [data-act='cancel']").click().catch(() => {});

  // ── Teil 3: layer.js Bookmarklet — 📋-Button im Modal ────────────────────
  console.log("[3] layer.js: 📋 im Modal");
  const page2 = await ctx.newPage();
  page2.on("pageerror", e => console.log("PAGE ERR:", e.message.slice(0, 140)));
  await page2.goto(`http://127.0.0.1:${PORT}/test_screenshot.html`, { waitUntil: "networkidle" });
  let code = fs.readFileSync(path.join(VF, "layer.min.js"), "utf8");
  code = code.replace("https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js", `http://127.0.0.1:${PORT}/modern-screenshot.js`);
  await page2.evaluate(code);
  await page2.waitForTimeout(400);
  await page2.evaluate(() => document.querySelector('.__vfl_fab [data-act="mode"]').click());
  await page2.click("#card-simple");
  await page2.waitForTimeout(400);
  check(await page2.locator(".__vfl_modal").isVisible(), "Bookmarklet-Modal offen");

  check(await page2.evaluate(WRITE_CLIPBOARD).catch(() => false), "Testbild in Zwischenablage (Bookmarklet-Seite)");
  await page2.locator('.__vfl_modal [data-act="paste-shot"]').click();
  await page2.waitForTimeout(1200);
  check(await page2.locator('.__vfl_modal [data-r="shot-preview"]').isVisible(), "Vorschau des eigenen Screenshots sichtbar");

  await page2.evaluate(() => {
    const m = document.querySelector(".__vfl_modal");
    m.querySelectorAll("input, textarea").forEach(i => { i.value = "Paste-Layer"; i.dispatchEvent(new Event("input", { bubbles: true })); });
    m.querySelector('[data-act="save"]').click();
  });
  await page2.waitForTimeout(1500);
  const layerSaved = await page2.evaluate(() => {
    const key = "vibefeedback:v2:" + location.origin + location.pathname;
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    const c = arr[arr.length - 1];
    return c ? { len: (c.screenshot || "").length, shot: c.screenshot } : null;
  });
  check(layerSaved && layerSaved.len > 500, `Bookmarklet: eigener Screenshot gespeichert (${layerSaved && layerSaved.len} bytes)`);
  if (layerSaved && layerSaved.shot) fs.writeFileSync(path.join(OUT, "paste_saved_layer.jpg"), Buffer.from(layerSaved.shot.split(",")[1], "base64"));

  console.log(`\n${ok.length}/${ok.length + bad.length} bestanden`);
  await browser.close();
  srv.close();
  process.exit(bad.length ? 1 : 0);
})();
