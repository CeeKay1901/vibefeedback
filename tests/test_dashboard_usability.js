// Usability-Regression fürs Dashboard: kein horizontales Scrollen auf Mobile,
// Touch-Targets auf greifbarer Größe, Lightbox komplett per Tastatur bedienbar
// (inkl. Fokus-Rückgabe), Null-Treffer-Zustand der Suche, "/"-Shortcut.
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const VF = path.join(__dirname, "..");

function startServer(dir, port) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let fp = path.join(dir, req.url.split("?")[0]);
      if (fp.endsWith("/")) fp += "index.html";
      try {
        const body = fs.readFileSync(fp);
        const mime = { ".html": "text/html", ".js": "application/javascript", ".svg": "image/svg+xml" }[path.extname(fp)] || "text/plain";
        res.writeHead(200, { "Content-Type": mime });
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
const seed = {
  "vibefeedback:v2:https://alpha.example/": [
    { id:"a1", selector:"h1", text:"Titel unklar", author:"Marie", category:"copy", priority:"must", ts: day(1), screenshot: JPEG, pageUrl:"https://alpha.example/" },
    { id:"a2", selector:".cta", text:"Button kaputt", author:"Tom", category:"bug", priority:"should", ts: day(2), pageUrl:"https://alpha.example/preise" }
  ]
};
const DETAIL_HASH = "#p=" + encodeURIComponent("https://alpha.example/");

(async () => {
  const PORT = 18106;
  const srv = await startServer(VF, PORT);
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });

  // ── Mobile 390×844: nichts läuft aus dem Viewport ──────────────────────
  console.log("[1] Mobile-Layout");
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const mob = await mctx.newPage();
  mob.on("pageerror", e => { console.log("PAGE ERR:", e.message.slice(0, 140)); bad.push("pageerror"); });
  await mob.goto(`http://127.0.0.1:${PORT}/dashboard.html`, { waitUntil: "networkidle" });
  await mob.evaluate(d => { localStorage.clear(); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v)); }, seed);
  await mob.reload({ waitUntil: "networkidle" });
  await mob.waitForTimeout(400);
  let sw = await mob.evaluate(() => ({ s: document.documentElement.scrollWidth, v: innerWidth }));
  check(sw.s <= sw.v, `Übersicht ohne horizontales Scrollen (${sw.s}px bei ${sw.v}px Viewport)`);
  check(await mob.locator("#btn-refresh").isVisible(), "Topbar-Buttons sichtbar (zweite Zeile statt abgeschnitten)");

  await mob.evaluate(h => { location.hash = h; }, DETAIL_HASH);
  await mob.waitForTimeout(400);
  sw = await mob.evaluate(() => ({ s: document.documentElement.scrollWidth, v: innerWidth }));
  check(sw.s <= sw.v, `Detailansicht ohne horizontales Scrollen (${sw.s}px bei ${sw.v}px)`);

  // Touch-Targets: Status-Schalter und Chips mindestens ~38px hoch
  const t = await mob.evaluate(() => {
    const h = s => Math.round(document.querySelector(s)?.getBoundingClientRect().height || 0);
    return { st: h(".st-btns button"), chip: h(".filters .chip"), page: h(".pagelink") };
  });
  check(t.st >= 34, `Status-Schalter greifbar (${t.st}px hoch)`);
  check(t.chip >= 34, `Filter-Chips greifbar (${t.chip}px hoch)`);
  check(t.page >= 30, `Seiten-Links greifbar (${t.page}px hoch)`);
  await mctx.close();

  // ── Tastatur: Thumbnail → Lightbox → Esc → Fokus zurück ────────────────
  console.log("\n[2] Lightbox per Tastatur");
  const kctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const kb = await kctx.newPage();
  kb.on("pageerror", e => { console.log("PAGE ERR:", e.message.slice(0, 140)); bad.push("pageerror"); });
  await kb.goto(`http://127.0.0.1:${PORT}/dashboard.html`, { waitUntil: "networkidle" });
  await kb.evaluate(d => { localStorage.clear(); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v)); }, seed);
  await kb.goto("about:blank");
  await kb.goto(`http://127.0.0.1:${PORT}/dashboard.html${DETAIL_HASH}`, { waitUntil: "networkidle" });
  await kb.waitForTimeout(500);

  const thumb = kb.locator(".cmt .thumb").first();
  check(await thumb.getAttribute("role") === "button" && await thumb.getAttribute("tabindex") === "0", "Thumbnail ist fokussierbar (role=button, tabindex=0)");
  await thumb.focus();
  await kb.keyboard.press("Enter");
  await kb.waitForTimeout(200);
  check(await kb.locator("#lightbox").isVisible(), "Enter öffnet die Lightbox");
  check(await kb.evaluate(() => document.activeElement?.id) === "lightbox-close", "Fokus liegt auf dem Schließen-Button");
  check(await kb.locator("#lightbox-close").isVisible(), "Sichtbarer Schließen-Button vorhanden");
  await kb.keyboard.press("Escape");
  await kb.waitForTimeout(200);
  check(await kb.locator("#lightbox").isHidden(), "Esc schließt");
  check(await kb.evaluate(() => document.activeElement?.classList.contains("thumb")), "Fokus kehrt zum Thumbnail zurück");
  await kb.locator("#lightbox-close").isHidden().catch(() => {});

  // ── Suche: Null-Treffer-Zustand + "/"-Shortcut ─────────────────────────
  console.log("\n[3] Suche");
  await kb.keyboard.press("/");
  check(await kb.evaluate(() => document.activeElement?.id) === "cmt-search", '"/" springt in die Suche');
  await kb.locator("#cmt-search").fill("gibtesnicht");
  await kb.waitForTimeout(200);
  check(await kb.locator("#search-empty").isVisible(), "Null-Treffer-Meldung sichtbar");
  await kb.locator("#search-clear").click();
  await kb.waitForTimeout(200);
  check(await kb.evaluate(() => [...document.querySelectorAll(".cmt")].filter(el => el.style.display !== "none").length) === 2, "'Suche leeren' zeigt wieder alle");
  check(await kb.locator("#search-empty").isHidden(), "Meldung verschwindet wieder");
  // Shortcut stört nicht beim Tippen
  await kb.locator("#cmt-search").fill("");
  await kb.locator("#cmt-search").type("a/b");
  check(await kb.locator("#cmt-search").inputValue() === "a/b", '"/" bleibt beim Tippen normales Zeichen');
  await kctx.close();

  console.log(`\n${ok.length}/${ok.length + bad.length} bestanden`);
  await browser.close();
  srv.close();
  process.exit(bad.length ? 1 : 0);
})();
