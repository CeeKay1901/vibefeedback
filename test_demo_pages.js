// Demo-Unterseiten-Test: Navigation im VF-iframe (Nav-Modus), Login-Form → Board,
// Board-Interaktionen, Blog → Artikel. Screenshots je Seite.
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
        const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml" }[path.extname(fp)] || "text/plain";
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
  const PORT = 18088;
  const srv = await startServer(VF, PORT);
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  page.on("pageerror", e => { console.log("PAGE ERR:", e.message.slice(0, 160)); bad.push("pageerror"); });
  await page.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${PORT}/modern-screenshot.js";`);

  const frame = () => page.frameLocator("#frame");
  const curUrl = () => page.evaluate(() => STATE.currentUrl);
  const shot = async name => {
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, name) });
  };

  await page.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(`http://127.0.0.1:${PORT}/demo.html`)}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.locator(".coach button").click().catch(() => {});
  check((await curUrl()).includes("demo.html"), "Landing im iframe geladen");

  // In den Navigieren-Modus schalten
  await page.locator('[data-mode="nav"]').click();
  await page.waitForTimeout(300);

  // Nav: Preise
  await frame().locator('.nav-links a[href="demo-preise.html"]').first().click();
  await page.waitForTimeout(1500);
  check((await curUrl()).includes("demo-preise.html"), "Preise-Seite lädt im iframe");
  check(await frame().locator("table").isVisible().catch(() => false), "Vergleichstabelle sichtbar");
  await frame().locator(".faq details summary").first().click().catch(() => {});
  await shot("demo_preise.png");

  // Preise → Login (CTA)
  await frame().locator('a.btn-primary[href="demo-login.html"]').first().click();
  await page.waitForTimeout(1500);
  check((await curUrl()).includes("demo-login.html"), "Login-Seite lädt");
  await shot("demo_login.png");

  // Login-Formular ausfüllen und absenden → Board (GET-Form durch VF geroutet)
  await frame().locator("#email").fill("demo@flowly.io");
  await frame().locator("#pw").fill("geheim123");
  await frame().locator('button[type="submit"]').click();
  await page.waitForTimeout(1800);
  check((await curUrl()).includes("demo-app.html"), "Login führt zum Board (GET-Form geroutet)");

  // Board-Interaktionen: Checkbox + Filter
  const firstCheckbox = frame().locator('[data-col="todo"] .task input[type="checkbox"]').first();
  await firstCheckbox.check();
  check(await frame().locator('[data-col="todo"] .task[data-done="true"]').count() === 1, "Task abhaken funktioniert");
  await frame().locator('.chip[data-filter="overdue"]').click();
  await page.waitForTimeout(300);
  const visibleTasks = await frame().locator(".task:visible").count();
  check(visibleTasks === 2, `Überfällig-Filter zeigt 2 Tasks (ist: ${visibleTasks})`);
  await frame().locator('.chip[data-filter="alle"]').click();
  await shot("demo_app.png");

  // Board → Blog → Artikel → zurück
  await frame().locator('.nav-links a[href="demo-blog.html"]').first().click();
  await page.waitForTimeout(1500);
  check((await curUrl()).includes("demo-blog.html"), "Blog lädt");
  await shot("demo_blog.png");
  await frame().locator('a[href="demo-blog-artikel.html"]').first().click();
  await page.waitForTimeout(1500);
  check((await curUrl()).includes("demo-blog-artikel.html"), "Blog-Artikel lädt");
  await frame().locator('a[href="demo-blog.html"]').first().click();
  await page.waitForTimeout(1200);
  check((await curUrl()).includes("demo-blog.html"), "Zurück-Link zum Blog funktioniert");

  // Kommentar auf Subpage: Kommentieren-Modus, Element klicken, speichern → pageUrl korrekt?
  await page.locator('[data-mode="comment"]').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const doc = document.querySelector("#frame").contentDocument;
    doc.querySelector(".section-title").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView }));
  });
  await page.waitForTimeout(2500);
  if (await page.locator(".cbar").isVisible()) {
    await page.locator(".cbar textarea[data-role='text']").fill("Subpage-Kommentar");
    page.once("dialog", d => d.accept("Tester"));
    await page.locator(".cbar [data-act='save']").click();
    await page.waitForTimeout(1200);
    const c = await page.evaluate(() => STATE.comments[STATE.comments.length - 1]);
    check(c && (c.pageUrl || "").includes("demo-blog.html"), "Kommentar trägt Subpage-URL");
    check(c && !!c.screenshot, "Screenshot auf Subpage captured");
  } else {
    check(false, "Kommentar-Bar auf Subpage öffnet nicht");
  }

  console.log(`\n${ok.length}/${ok.length + bad.length} bestanden`);
  await browser.close();
  srv.close();
  process.exit(bad.length ? 1 : 0);
})();
