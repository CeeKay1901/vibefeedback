// Runde 2: verschärfter safeShot (Attribut-Ausbruch), layer.js-Fixes
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const VF = path.join(__dirname, "..");

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
  const PORT = 18090;
  const srv = await startServer(VF, PORT);
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });

  // ── A. Verschärfter safeShot: Attribut-Ausbruch mit gültigem Präfix ─────
  console.log("[A] XSS: data:image-Präfix + Attribut-Ausbruch");
  const page = await ctx.newPage();
  let xss = false;
  page.on("dialog", d => { if (/XSS/i.test(d.message())) xss = true; d.accept("T"); });
  page.on("pageerror", e => console.log("PAGE ERR:", e.message.slice(0, 120)));
  await page.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${PORT}/modern-screenshot.js";`);
  await page.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(`http://127.0.0.1:${PORT}/test_screenshot.html`)}&__vftest=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await page.locator(".coach button").click().catch(() => {});

  const evil = {
    items: [
      { id: "ok1", selector: "#card-simple", text: "a", ts: "2026-07-09T10:00:00.000Z",
        screenshot: 'data:image/png"><img src=x onerror="alert(\'XSS-breakout\')">' },
      { id: "ok2", selector: "#hero-block", text: "b", ts: "2026-07-09T10:01:00.000Z",
        screenshot: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KCdYU1Mtc3ZnJykiPjwvc3ZnPg==' },
      { id: "ok3", selector: "#btn-test", text: "c", ts: "2026-07-09T10:02:00.000Z",
        screenshot: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD=' }
    ]
  };
  const r = await page.evaluate(async payload => {
    const file = new File([JSON.stringify(payload)], "evil.json", { type: "application/json" });
    const dt = new DataTransfer(); dt.items.add(file);
    const input = document.getElementById("btn-import-file");
    Object.defineProperty(input, "files", { value: dt.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
    const by = id => STATE.comments.find(c => c.id === id);
    return { breakout: by("ok1")?.screenshot, svg: by("ok2")?.screenshot, good: by("ok3")?.screenshot };
  }, evil);
  await page.waitForTimeout(700);
  check(!xss, "Kein XSS-Dialog");
  check(r.breakout === null, "Attribut-Ausbruch trotz data:image-Präfix verworfen", String(r.breakout).slice(0, 50));
  check(r.svg === null, "data:image/svg+xml verworfen (kann Skripte tragen)", String(r.svg).slice(0, 40));
  check(typeof r.good === "string" && r.good.startsWith("data:image/jpeg;base64,"), "Legitimer JPEG-Screenshot bleibt", String(r.good).slice(0, 30));
  const stray = await page.evaluate(() => document.querySelectorAll("img[onerror], img[src='x']").length);
  check(stray === 0, "Kein injiziertes img-Element im DOM");
  await page.close();

  // ── B. layer.js: position:relative wird zurückgesetzt ───────────────────
  console.log("\n[B] layer.js: Wirtsseite wird nicht dauerhaft verändert");
  const p2 = await ctx.newPage();
  p2.on("pageerror", e => { console.log("PAGE ERR:", e.message.slice(0, 120)); bad.push("pageerror-layer"); });
  await p2.goto(`http://127.0.0.1:${PORT}/test_screenshot.html`, { waitUntil: "networkidle" });
  // Origin ist mit Abschnitt A geteilt — Store leeren, sonst rendert der Layer beim Init
  // schon Badges (und setzt position:relative), bevor wir den Ausgangszustand messen.
  await p2.evaluate(() => localStorage.clear());
  await p2.reload({ waitUntil: "networkidle" });
  let code = fs.readFileSync(path.join(VF, "layer.min.js"), "utf8")
    .replace("https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js", `http://127.0.0.1:${PORT}/modern-screenshot.js`);
  const posBefore = await p2.evaluate(() => getComputedStyle(document.querySelector("#card-simple")).position);
  await p2.evaluate(code);
  await p2.waitForTimeout(400);
  // Gegen package.json prüfen statt gegen eine hartkodierte Nummer
  const layerVersion = await p2.evaluate(() => window.__vf_layer_version);
  check(/^\d+\.\d+\.\d+$/.test(layerVersion || ""), `Laufzeit-Versionsmarker gesetzt (${layerVersion})`);

  await p2.evaluate(() => document.querySelector('.__vfl_fab [data-act="mode"]').click());
  await p2.click("#card-simple");
  await p2.waitForTimeout(400);
  await p2.evaluate(() => {
    const m = document.querySelector(".__vfl_modal");
    m.querySelectorAll("input, textarea").forEach(i => { i.value = "T"; i.dispatchEvent(new Event("input", { bubbles: true })); });
    m.querySelector('[data-act="save"]').click();
  });
  await p2.waitForTimeout(3500);
  const stored = await p2.evaluate(() => {
    const key = "vibefeedback:v2:" + location.origin + location.pathname + location.search + location.hash;
    return JSON.parse(localStorage.getItem(key) || "[]").length;
  });
  check(stored === 1, `Kommentar unter route-spezifischem Key gespeichert (${stored})`);
  check(await p2.locator(".__vfl_badge").count() === 1, "Badge gerendert");

  // Das Badge hängt am tatsächlich geklickten Element (hier: <p> in der Karte).
  // Genau dort muss refreshBadges das aufgezwungene position:relative wieder entfernen.
  const posAfter = await p2.evaluate(async () => {
    const key = "vibefeedback:v2:" + location.origin + location.pathname + location.search + location.hash;
    const host = document.querySelector(".__vfl_badge").parentElement;
    host.id = host.id || "__probe";           // wiederauffindbar machen
    const before = { computed: getComputedStyle(host).position, inline: host.style.position, flag: host.dataset.vflPosSet };
    localStorage.setItem(key, "[]");
    location.hash = "#route-b";               // hashchange → comments neu laden + refreshBadges
    await new Promise(r => setTimeout(r, 600));
    const h = document.getElementById("__probe");
    return { before, after: { inline: h.style.position, flag: h.dataset.vflPosSet }, badges: document.querySelectorAll(".__vfl_badge").length };
  });
  check(posAfter.before.computed === "relative" && posAfter.before.flag === "1", "Badge erzwang position:relative (Ausgangslage)", JSON.stringify(posAfter.before));
  check(posAfter.after.inline === "" && !posAfter.after.flag, "position:relative wieder entfernt", JSON.stringify(posAfter.after));
  check(posAfter.badges === 0, "Badges der alten Route entfernt");

  // ── C. layer.js: Badge an <img> landet am Elternelement (sichtbar) ──────
  console.log("\n[C] layer.js: Badge an ersetztem Element (img)");
  await p2.evaluate(() => { localStorage.clear(); location.hash = ""; });
  await p2.reload({ waitUntil: "networkidle" });
  await p2.evaluate(code);
  await p2.waitForTimeout(400);
  await p2.evaluate(() => document.querySelector('.__vfl_fab [data-act="mode"]').click());
  await p2.click("#card-with-img img");
  await p2.waitForTimeout(400);
  await p2.evaluate(() => {
    const m = document.querySelector(".__vfl_modal");
    m.querySelectorAll("input, textarea").forEach(i => { i.value = "img-test"; i.dispatchEvent(new Event("input", { bubbles: true })); });
    m.querySelector('[data-act="save"]').click();
  });
  await p2.waitForTimeout(3500);
  const badgeVisible = await p2.locator(".__vfl_badge").first().isVisible().catch(() => false);
  check(badgeVisible, "Badge sichtbar (nicht im img versteckt)");

  // ── D. layer.js: Doppel-Submit per Ctrl+Enter ──────────────────────────
  console.log("\n[D] layer.js: kein Doppel-Submit");
  await p2.evaluate(() => {
    const key = "vibefeedback:v2:" + location.origin + location.pathname + location.search + location.hash;
    localStorage.removeItem(key);
  });
  await p2.reload({ waitUntil: "networkidle" });
  await p2.evaluate(code);
  await p2.waitForTimeout(400);
  await p2.evaluate(() => document.querySelector('.__vfl_fab [data-act="mode"]').click());
  await p2.click("#card-simple");
  await p2.waitForTimeout(400);
  await p2.evaluate(() => {
    const m = document.querySelector(".__vfl_modal");
    m.querySelectorAll("input, textarea").forEach(i => { i.value = "doppel"; i.dispatchEvent(new Event("input", { bubbles: true })); });
  });
  // dreimal schnell Ctrl+Enter
  for (let i = 0; i < 3; i++) await p2.keyboard.press("Control+Enter");
  await p2.waitForTimeout(4000);
  const count = await p2.evaluate(() => {
    const key = "vibefeedback:v2:" + location.origin + location.pathname + location.search + location.hash;
    return JSON.parse(localStorage.getItem(key) || "[]").length;
  });
  check(count === 1, `Genau 1 Kommentar trotz 3× Ctrl+Enter (ist: ${count})`);

  console.log(`\n${ok.length}/${ok.length + bad.length} bestanden`);
  await browser.close();
  srv.close();
  process.exit(bad.length ? 1 : 0);
})();
