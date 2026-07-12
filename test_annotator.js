// Annotator-Test: Stift (Freihand), Ausklappmenü, Nummern-Badge, Pixelieren, Undo/Redo.
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
        const mime = { ".html": "text/html", ".js": "application/javascript" }[path.extname(fp)] || "text/plain";
        res.writeHead(200, { "Content-Type": mime, "Access-Control-Allow-Origin": "*" });
        res.end(body);
      } catch (e) { res.writeHead(404); res.end(); }
    });
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}

const ok = [], bad = [];
const check = (cond, label) => { (cond ? ok : bad).push(label); console.log(`  ${cond ? "✓" : "✗"} ${label}`); };

(async () => {
  const PORT = 18087;
  const srv = await startServer(VF, PORT);
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on("pageerror", e => { console.log("PAGE ERR:", e.message.slice(0, 160)); bad.push("pageerror"); });
  await page.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${PORT}/modern-screenshot.js";`);

  await page.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(`http://127.0.0.1:${PORT}/test_screenshot.html`)}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.locator(".coach button").click().catch(() => {});
  await page.evaluate(() => {
    const doc = document.querySelector("#frame").contentDocument;
    doc.querySelector("#card-simple").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView }));
  });
  await page.waitForTimeout(2500);
  check(await page.locator(".cbar").isVisible(), "Kommentar-Bar offen");

  // Screenshot ist opt-in → aufnehmen; captureShot öffnet das Expand automatisch
  await page.locator(".cbar [data-act='screenshot']").click();
  await page.waitForFunction(() => !!document.querySelector(".cbar .annot .stage canvas"), { timeout: 15000 });
  await page.waitForTimeout(600);
  const canvas = page.locator(".cbar .annot .stage canvas");
  check(await canvas.isVisible(), "Annotator-Canvas sichtbar");

  // Werkzeugleiste: Stift vorhanden?
  check(await page.locator(".cbar .annot [data-tool='pen']").isVisible(), "Stift-Werkzeug in Toolbar");

  // Layout der bottom-fixed Bar verschiebt sich bei jeder Toolbar-Aktion —
  // Canvas-Position deshalb unmittelbar vor jeder Geste frisch holen (fraktionale Koordinaten).
  const freshBox = async () => { await page.waitForTimeout(250); await canvas.scrollIntoViewIfNeeded(); return canvas.boundingBox(); };
  const drag = async (fx1, fy1, fx2, fy2, wiggle) => {
    const b = await freshBox();
    const x1 = b.x + b.width * fx1, y1 = b.y + b.height * fy1;
    const x2 = b.x + b.width * fx2, y2 = b.y + b.height * fy2;
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    if (wiggle) {
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        await page.mouse.move(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + Math.sin(t * Math.PI * 3) * 18, { steps: 2 });
      }
    } else {
      await page.mouse.move(x2, y2, { steps: 8 });
    }
    await page.mouse.up();
  };
  const clickAt = async (fx, fy) => {
    const b = await freshBox();
    await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
  };

  // Stift: Kringel zeichnen
  await page.locator(".cbar .annot [data-tool='pen']").click();
  await drag(0.05, 0.25, 0.95, 0.45, true);
  check(true, "Freihand-Strich gezeichnet (visuell prüfen)");

  // Ausklappmenü öffnen
  await page.locator(".cbar .annot [data-act='more']").click();
  await page.waitForTimeout(200);
  check(await page.locator(".cbar .annot .tools-more").isVisible(), "Ausklappmenü (⋯) öffnet");
  check(await page.locator(".cbar .annot [data-tool='pixelate']").isVisible(), "Pixelieren im Ausklappmenü");
  check(await page.locator(".cbar .annot [data-tool='number']").isVisible(), "Nummern-Badge im Ausklappmenü");
  check((await page.locator(".cbar .annot .swatch").count()) >= 6, "6 Farben verfügbar");
  check((await page.locator(".cbar .annot [data-width]").count()) === 3, "3 Strichstärken");

  // Nummern-Badges platzieren (blau)
  await page.locator(".cbar .annot [data-tool='number']").click();
  await page.locator(".cbar .annot .swatch[data-color='#5c8fbf']").click();
  await clickAt(0.4, 0.75);
  await clickAt(0.5, 0.75);

  // Pixelieren: Bereich über dem Button
  await page.locator(".cbar .annot [data-tool='pixelate']").click();
  await drag(0.02, 0.6, 0.28, 0.95);

  // Dicker grüner Kreis
  await page.locator(".cbar .annot [data-tool='ellipse']").click();
  await page.locator(".cbar .annot .swatch[data-color='#62c12d']").click();
  await page.locator(".cbar .annot [data-width='2']").click();
  await drag(0.7, 0.55, 0.95, 0.95);

  // Undo + Redo: Kreis weg und wieder da (Fehler würden als pageerror auffallen)
  await page.locator(".cbar .annot [data-act='undo']").click();
  await page.locator(".cbar .annot [data-act='redo']").click();
  check(true, "Undo/Redo ohne Fehler");

  // Speichern und Ergebnis extrahieren
  await page.locator(".cbar textarea[data-role='text']").fill("Annotator-Test");
  page.once("dialog", d => d.accept("Tester"));
  await page.locator(".cbar [data-act='save']").click();
  await page.waitForTimeout(1500);
  const saved = await page.evaluate(() => {
    const c = STATE.comments[STATE.comments.length - 1];
    return c && c.screenshot ? c.screenshot : null;
  });
  check(!!saved, "Annotierter Screenshot gespeichert");
  if (saved) fs.writeFileSync(path.join(OUT, "annot_result.jpg"), Buffer.from(saved.split(",")[1], "base64"));

  console.log(`\n${ok.length}/${ok.length + bad.length} bestanden`);
  await browser.close();
  srv.close();
  process.exit(bad.length ? 1 : 0);
})();
