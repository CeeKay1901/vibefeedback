// Dashboard-Export: gültiges ZIP, CSV korrekt escaped, Screenshots als Dateien,
// und das Archiv lässt sich im Tool wieder importieren (Bilder inklusive).
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const VF = path.join(__dirname, "..");
const OUT = path.join(__dirname, "test_artifacts");

function startServer(dir, port) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let fp = req.url.split("?")[0];
      fp = fp === "/modern-screenshot.js" ? path.join(dir, "node_modules/modern-screenshot/dist/index.js") : path.join(dir, fp);
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

const ok = [], bad = [];
const check = (c, l, e) => { (c ? ok : bad).push(l); console.log(`  ${c ? "✓" : "✗"} ${l}${e && !c ? " — " + e : ""}`); };

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const day = n => new Date(Date.now() - n * 864e5).toISOString();

// Fiese Werte: Komma, Anführungszeichen, Zeilenumbruch, Semikolon
const NASTY = 'Er sagte "hallo", dann\nZeile zwei; Ende';

const seed = {
  "vibefeedback:v2:https://alpha.example/shop": [
    { id:"a1", selector:"h1", text:NASTY, author:"Marie", category:"copy", priority:"must", ts: day(1), screenshot: JPEG, pageUrl:"https://alpha.example/shop" },
    { id:"a2", selector:".cta", text:"ok", author:"Tom", category:"bug", priority:"could", ts: day(2), pageUrl:"https://alpha.example/shop/kasse", status:"done" }
  ],
  "vibefeedback:v2:https://beta.example/app": [
    { id:"b1", selector:"nav", text:"Navigation", author:"Ada", category:"feature", priority:"nice", ts: day(3), screenshot: JPEG }
  ],
  "vibefeedback:v2:author": "Marie"
};

(async () => {
  const PORT = 18099;
  const srv = await startServer(VF, PORT);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGE ERR:", e.message.slice(0, 160)); bad.push("pageerror"); });

  await page.goto(`http://127.0.0.1:${PORT}/dashboard.html?__vftest=1`, { waitUntil: "networkidle" });
  await page.evaluate(data => {
    localStorage.clear();
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, seed);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // ── Button-Zustand ─────────────────────────────────────────────────────
  console.log("[1] Export-Button");
  check(!(await page.locator("#btn-export-all").isDisabled()), "aktiv, wenn Projekte da sind");

  // ── ZIP herunterladen und mit echten Werkzeugen prüfen ─────────────────
  console.log("\n[2] Archiv");
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.locator("#btn-export-all").click()
  ]);
  const zip = path.join(OUT, "alle.zip");
  await dl.saveAs(zip);
  check(/^vibefeedback-alle-\d{4}-\d{2}-\d{2}\.zip$/.test(dl.suggestedFilename()), `Dateiname: ${dl.suggestedFilename()}`);
  let t = false;
  try { execFileSync("unzip", ["-t", zip], { encoding: "utf8" }); t = true; } catch (e) {}
  check(t, "`unzip -t` bestätigt CRC-Integrität");

  const ex = path.join(OUT, "alle_extract");
  fs.rmSync(ex, { recursive: true, force: true });
  execFileSync("unzip", ["-q", "-o", zip, "-d", ex]);
  check(fs.existsSync(path.join(ex, "feedback.json")), "feedback.json enthalten");
  check(fs.existsSync(path.join(ex, "kommentare.csv")), "kommentare.csv enthalten");
  check(fs.existsSync(path.join(ex, "README.md")), "README.md enthalten");

  // Zwei Projektordner, Screenshots als echte Dateien
  const dirs = fs.readdirSync(ex, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  check(dirs.length === 2, `2 Projektordner (${dirs.join(", ")})`);
  const shots = dirs.flatMap(d => {
    const sd = path.join(ex, d, "screenshots");
    return fs.existsSync(sd) ? fs.readdirSync(sd).map(f => path.join(d, "screenshots", f)) : [];
  });
  check(shots.length === 2, `2 Screenshot-Dateien (${shots.join(", ")})`);
  // Nummerierung läuft über die Bilder, nicht über alle Kommentare — sonst gäbe es
  // ein "02" ohne "01", wenn der erste Kommentar keinen Screenshot hat.
  check(shots.every(f => /\/screenshots\/01-/.test(f)), `jedes Projekt beginnt bei 01 (${shots.join(", ")})`);
  const jpegOk = shots.every(f => { const b = fs.readFileSync(path.join(ex, f)); return b[0] === 0xFF && b[1] === 0xD8; });
  check(jpegOk, "Bilder sind gültige JPEGs");

  // ── feedback.json ──────────────────────────────────────────────────────
  console.log("\n[3] feedback.json");
  const js = JSON.parse(fs.readFileSync(path.join(ex, "feedback.json"), "utf8"));
  check(js.count === 3 && js.comments.length === 3, `3 Kommentare (${js.count})`);
  check(js.comments.every(c => !("screenshot" in c)), "keine doppelten base64-Bilder in der JSON");
  const withFile = js.comments.filter(c => c.screenshotFile);
  check(withFile.length === 2, `2 Verweise auf Bilddateien (${withFile.length})`);
  check(withFile.every(c => fs.existsSync(path.join(ex, c.screenshotFile))), "alle Verweise zeigen auf existierende Dateien");
  check(js.comments.every(c => c.project), "jeder Kommentar kennt sein Projekt");
  check(js.comments.find(c => c.id === "a2")?.status === "done", "Bearbeitungsstatus wandert mit in die JSON");

  // ── CSV ────────────────────────────────────────────────────────────────
  console.log("\n[4] kommentare.csv");
  const csv = fs.readFileSync(path.join(ex, "kommentare.csv"), "utf8");
  check(csv.charCodeAt(0) === 0xFEFF, "BOM vorhanden (Excel-Umlaute)");
  // Von einem echten CSV-Parser gegenlesen
  const parsed = execFileSync("python3", ["-c", `
import csv, io, sys, json
raw = open(sys.argv[1], encoding="utf-8-sig").read()
rows = list(csv.reader(io.StringIO(raw)))
print(json.dumps({"rows": len(rows), "head": rows[0], "status": [r[4] for r in rows[1:]], "nasty": [r[9] for r in rows[1:]]}))
`, path.join(ex, "kommentare.csv")], { encoding: "utf8" });
  const p = JSON.parse(parsed);
  check(p.rows === 4, `Kopfzeile + 3 Datenzeilen (${p.rows})`);
  check(p.head[0] === "Projekt" && p.head[4] === "Status" && p.head[9] === "Kommentar", `Spalten korrekt (${p.head.join("|")})`);
  check(p.nasty.includes(NASTY), "Text mit Komma, Anführungszeichen und Zeilenumbruch bleibt intakt");
  check(p.status.filter(s => s === "Offen").length === 2 && p.status.includes("Erledigt"), `Status-Spalte gefüllt (${p.status.join("|")})`);

  // ── Der Kreis schließt sich: Tool importiert das Dashboard-Archiv ──────
  console.log("\n[5] Re-Import ins Tool");
  const tool = await ctx.newPage();
  tool.on("pageerror", e => { console.log("TOOL ERR:", e.message.slice(0, 140)); bad.push("pageerror-tool"); });
  await tool.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${PORT}/modern-screenshot.js";`);
  await tool.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(`http://127.0.0.1:${PORT}/test_screenshot.html`)}&__vftest=1`, { waitUntil: "networkidle" });
  await tool.waitForTimeout(1500);
  await tool.locator(".coach button").click().catch(() => {});
  const imported = await tool.evaluate(async b64 => {
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const file = new File([bytes], "vibefeedback-alle.zip", { type: "application/zip" });
    const dt = new DataTransfer(); dt.items.add(file);
    const input = document.getElementById("btn-import-file");
    Object.defineProperty(input, "files", { value: dt.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 2000));
    return {
      n: STATE.comments.length,
      shots: STATE.comments.filter(c => (c.screenshot || "").startsWith("data:image/")).length,
      done: STATE.comments.filter(c => c.status === "done").length
    };
  }, fs.readFileSync(zip).toString("base64"));
  check(imported.n === 3, `Tool importiert 3 Kommentare (${imported.n})`);
  check(imported.shots === 2, `Screenshots aus den Projektordnern aufgelöst (${imported.shots})`);
  check(imported.done === 1, `Bearbeitungsstatus überlebt den Re-Import (${imported.done} erledigt)`);

  // ── Einzelprojekt-Export aus der Detailansicht ─────────────────────────
  console.log("\n[5b] Einzelprojekt-Export");
  await page.locator('button[data-open]').first().click();   // alpha ist zuletzt aktiv → erste Karte
  await page.waitForTimeout(400);
  const [dlP] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.locator("#btn-export-proj").click()
  ]);
  const zipP = path.join(OUT, "einzel.zip");
  await dlP.saveAs(zipP);
  check(/^vibefeedback-alpha-example.*\.zip$/.test(dlP.suggestedFilename()), `Dateiname trägt das Projekt (${dlP.suggestedFilename()})`);
  const exP = path.join(OUT, "einzel_extract");
  fs.rmSync(exP, { recursive: true, force: true });
  execFileSync("unzip", ["-q", "-o", zipP, "-d", exP]);
  const jsP = JSON.parse(fs.readFileSync(path.join(exP, "feedback.json"), "utf8"));
  check(jsP.count === 2 && jsP.comments.every(c => c.project === "https://alpha.example/shop"), `nur das eine Projekt enthalten (${jsP.count} Kommentare)`);
  const dirsP = fs.readdirSync(exP, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  check(dirsP.length === 1, `genau ein Projektordner (${dirsP.join(", ")})`);

  // ── Leerer Zustand ─────────────────────────────────────────────────────
  console.log("\n[6] Ohne Daten");
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  check(await page.locator("#btn-export-all").isDisabled(), "Button deaktiviert, wenn nichts zu exportieren ist");

  console.log(`\n${ok.length}/${ok.length + bad.length} bestanden`);
  await browser.close();
  srv.close();
  process.exit(bad.length ? 1 : 0);
})();
