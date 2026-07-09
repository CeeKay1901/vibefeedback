// ZIP-Export: Datei wird wirklich erzeugt, ist ein gültiges ZIP (von unzip/python lesbar),
// enthält feedback.md + feedback.json + README.md + Screenshot-Bilder,
// und das Markdown referenziert die Bilddateien statt riesiger data-URLs.
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

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
const check = (c, l, e) => { (c ? ok : bad).push(l); console.log(`  ${c ? "✓" : "✗"} ${l}${e && !c ? " — " + e : ""}`); };

(async () => {
  const PORT = 18094;
  const srv = await startServer(VF, PORT);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGE ERR:", e.message.slice(0, 140)); bad.push("pageerror"); });
  await page.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${PORT}/modern-screenshot.js";`);

  const target = `http://127.0.0.1:${PORT}/test_screenshot.html`;
  await page.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(target)}&__vftest=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.locator(".coach button").click().catch(() => {});

  // ── CRC32 gegen bekannte Referenzwerte ─────────────────────────────────
  const crc = await page.evaluate(() => {
    const enc = new TextEncoder();
    return { empty: crc32(enc.encode("")), abc: crc32(enc.encode("abc")), check: crc32(enc.encode("123456789")) };
  });
  check(crc.empty === 0, `CRC32("") === 0 (${crc.empty})`);
  check(crc.abc === 0x352441c2, `CRC32("abc") === 0x352441c2 (0x${crc.abc.toString(16)})`);
  check(crc.check === 0xcbf43926, `CRC32("123456789") === 0xcbf43926 (0x${crc.check.toString(16)})`);

  // ── Zwei Kommentare mit echten Screenshots anlegen ──────────────────────
  const comment = async (sel, text) => {
    await page.evaluate(s => {
      const d = document.querySelector("#frame").contentDocument;
      d.querySelector(s).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: d.defaultView }));
    }, sel);
    await page.waitForTimeout(2500);
    await page.locator(".cbar textarea[data-role='text']").fill(text);
    page.once("dialog", d => d.accept("Tester"));
    await page.locator(".cbar [data-act='save']").click();
    await page.waitForTimeout(1600);
  };
  await comment("#card-simple", "Erster Kommentar");
  await comment("#hero-block", "Zweiter Kommentar");
  const nShots = await page.evaluate(() => STATE.comments.filter(c => c.screenshot).length);
  check(nShots === 2, `2 Kommentare mit Screenshot (${nShots})`);

  // ── ZIP herunterladen ──────────────────────────────────────────────────
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.locator("#btn-export-zip").click()
  ]);
  const zipPath = path.join(OUT, "export.zip");
  await download.saveAs(zipPath);
  check(fs.existsSync(zipPath) && fs.statSync(zipPath).size > 1000, `ZIP heruntergeladen (${fs.statSync(zipPath).size} bytes)`);
  check(/^vibefeedback-\d{4}-\d{2}-\d{2}\.zip$/.test(download.suggestedFilename()), `Dateiname: ${download.suggestedFilename()}`);

  // ── Von echten ZIP-Tools lesbar? ───────────────────────────────────────
  let unzipOk = false, listing = "";
  try { listing = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" }); unzipOk = true; }
  catch (e) { listing = String(e.stdout || e.message); }
  check(unzipOk, "`unzip -l` liest das Archiv ohne Fehler", listing.slice(0, 200));

  let testOk = false;
  try { execFileSync("unzip", ["-t", zipPath], { encoding: "utf8" }); testOk = true; } catch (e) {}
  check(testOk, "`unzip -t` bestätigt CRC-Integrität aller Einträge");

  const extractDir = path.join(OUT, "zip_extract");
  fs.rmSync(extractDir, { recursive: true, force: true });
  execFileSync("unzip", ["-q", "-o", zipPath, "-d", extractDir]);

  const md = path.join(extractDir, "feedback.md");
  const json = path.join(extractDir, "feedback.json");
  const readme = path.join(extractDir, "README.md");
  const shotDir = path.join(extractDir, "screenshots");
  check(fs.existsSync(md), "feedback.md enthalten");
  check(fs.existsSync(json), "feedback.json enthalten");
  check(fs.existsSync(readme), "README.md enthalten");
  check(fs.existsSync(shotDir), "screenshots/ enthalten");

  const shotFiles = fs.existsSync(shotDir) ? fs.readdirSync(shotDir) : [];
  check(shotFiles.length === 2, `2 Screenshot-Dateien (${shotFiles.join(", ")})`);

  // Sind die extrahierten Bilder gültige JPEGs (SOI-Marker) und byte-identisch mit dem Original?
  const jpegOk = shotFiles.every(f => {
    const b = fs.readFileSync(path.join(shotDir, f));
    return b[0] === 0xFF && b[1] === 0xD8 && b.length > 500;
  });
  check(jpegOk, "Extrahierte Bilder sind gültige JPEGs");

  const inState = await page.evaluate(() => STATE.comments.map(c => c.screenshot.length));
  const onDisk = shotFiles.map(f => fs.statSync(path.join(shotDir, f)).size);
  check(onDisk.every(sz => sz > 1000), `Bilddateien nicht leer (${onDisk.join(", ")} bytes)`);

  const mdText = fs.readFileSync(md, "utf8");
  check(!mdText.includes("data:image/"), "Markdown enthält KEINE data-URLs mehr");
  check(/!\[Screenshot\]\(screenshots\/01-[^)]+\.jpg\)/.test(mdText), "Markdown verlinkt screenshots/01-….jpg");
  const linked = [...mdText.matchAll(/!\[Screenshot\]\((screenshots\/[^)]+)\)/g)].map(m => m[1]);
  check(linked.length === 2 && linked.every(l => fs.existsSync(path.join(extractDir, l))), `Alle ${linked.length} verlinkten Bilder existieren`);

  const jsonData = JSON.parse(fs.readFileSync(json, "utf8"));
  check(jsonData.count === 2 && jsonData.comments.length === 2, "feedback.json enthält beide Kommentare");
  check(jsonData.comments.every(c => (c.screenshot || "").startsWith("data:image/")), "JSON behält eingebettete Screenshots (re-importierbar)");

  // ── Re-Import des feedback.json in eine frische Session ────────────────
  const page2 = await ctx.newPage();
  await page2.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${PORT}/modern-screenshot.js";`);
  await page2.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(target + "?fresh=1")}&__vftest=1`, { waitUntil: "networkidle" });
  await page2.waitForTimeout(1500);
  await page2.locator(".coach button").click().catch(() => {});
  const imported = await page2.evaluate(async payload => {
    const file = new File([payload], "feedback.json", { type: "application/json" });
    const dt = new DataTransfer(); dt.items.add(file);
    const input = document.getElementById("btn-import-file");
    Object.defineProperty(input, "files", { value: dt.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
    return { n: STATE.comments.length, withShot: STATE.comments.filter(c => c.screenshot).length };
  }, fs.readFileSync(json, "utf8"));
  check(imported.n === 2, `Re-Import: 2 Kommentare (${imported.n})`);
  check(imported.withShot === 2, `Re-Import: Screenshots erhalten (${imported.withShot})`);

  // ── Bookmarklet (layer.js): ZIP-Export ─────────────────────────────────
  console.log("\n[Bookmarklet] ZIP-Export");
  const p3 = await ctx.newPage();
  p3.on("pageerror", e => { console.log("PAGE ERR:", e.message.slice(0, 140)); bad.push("pageerror-layer"); });
  await p3.goto(target, { waitUntil: "networkidle" });
  await p3.evaluate(() => localStorage.clear());
  await p3.reload({ waitUntil: "networkidle" });
  const code = fs.readFileSync(path.join(VF, "layer.min.js"), "utf8")
    .replace("https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js", `http://127.0.0.1:${PORT}/modern-screenshot.js`);
  await p3.evaluate(code);
  await p3.waitForTimeout(400);

  for (const sel of ["#card-simple", "#hero-block"]) {
    await p3.evaluate(() => document.querySelector('.__vfl_fab [data-act="mode"]').click());
    await p3.click(sel);
    await p3.waitForTimeout(400);
    await p3.evaluate(() => {
      const m = document.querySelector(".__vfl_modal");
      m.querySelectorAll("input, textarea").forEach(i => { i.value = "Layer-ZIP"; i.dispatchEvent(new Event("input", { bubbles: true })); });
      m.querySelector('[data-act="save"]').click();
    });
    await p3.waitForTimeout(3500);
  }
  const layerShots = await p3.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith("vibefeedback:v2:http"));
    return JSON.parse(localStorage.getItem(key) || "[]").filter(c => c.screenshot).length;
  });
  check(layerShots === 2, `Bookmarklet: 2 Kommentare mit Screenshot (${layerShots})`);

  await p3.evaluate(() => document.querySelector('.__vfl_fab [data-act="side"]').click());
  await p3.waitForTimeout(300);
  const [dl2] = await Promise.all([
    p3.waitForEvent("download", { timeout: 20000 }),
    p3.evaluate(() => document.querySelector('[data-act="export-zip"]').click())
  ]);
  const zip2 = path.join(OUT, "export_layer.zip");
  await dl2.saveAs(zip2);
  check(fs.existsSync(zip2) && fs.statSync(zip2).size > 1000, `Bookmarklet-ZIP heruntergeladen (${fs.statSync(zip2).size} bytes)`);

  let t2 = false;
  try { execFileSync("unzip", ["-t", zip2], { encoding: "utf8" }); t2 = true; } catch (e) {}
  check(t2, "Bookmarklet-ZIP: `unzip -t` bestätigt Integrität");

  const ex2 = path.join(OUT, "zip_extract_layer");
  fs.rmSync(ex2, { recursive: true, force: true });
  execFileSync("unzip", ["-q", "-o", zip2, "-d", ex2]);
  const shots2 = fs.existsSync(path.join(ex2, "screenshots")) ? fs.readdirSync(path.join(ex2, "screenshots")) : [];
  check(shots2.length === 2, `Bookmarklet-ZIP: 2 Screenshots (${shots2.join(", ")})`);
  const nums = shots2.map(f => f.slice(0, 2)).sort();
  check(nums[0] === "01" && nums[1] === "02", `Fortlaufende Nummerierung (${nums.join(", ")})`);
  const md2 = fs.readFileSync(path.join(ex2, "feedback.md"), "utf8");
  check(!md2.includes("data:image/"), "Bookmarklet-Markdown ohne data-URLs");

  console.log(`\n${ok.length}/${ok.length + bad.length} bestanden`);
  await browser.close();
  srv.close();
  process.exit(bad.length ? 1 : 0);
})();
