// Dashboard: liest localStorage, aggregiert korrekt, Detailansicht + Filter,
// Charts haben Tabellenansicht, Löschen wirkt, Meta-Keys werden ignoriert.
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const VF = path.join(__dirname, "..");
const OUT = path.join(__dirname, "test_artifacts");

function startServer(dir, port) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let fp = path.join(dir, req.url.split("?")[0]);
      if (fp.endsWith("/")) fp += "index.html";
      try {
        const body = fs.readFileSync(fp);
        const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml" }[path.extname(fp)] || "text/plain";
        res.writeHead(200, { "Content-Type": mime });
        res.end(body);
      } catch (e) { res.writeHead(404); res.end(); }
    });
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}

const ok = [], bad = [];
const check = (c, l, e) => { (c ? ok : bad).push(l); console.log(`  ${c ? "✓" : "✗"} ${l}${e && !c ? " — " + e : ""}`); };

// 1×1 JPEG als gültiger Screenshot
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

const day = n => new Date(Date.now() - n * 864e5).toISOString();

const seed = {
  "vibefeedback:v2:https://alpha.example/": [
    { id:"a1", selector:"h1", text:"Titel unklar", author:"Marie", category:"copy",    priority:"must",   ts: day(1), screenshot: JPEG, pageUrl:"https://alpha.example/" },
    { id:"a2", selector:".cta", text:"Button-Text unklar", author:"Marie", category:"copy", priority:"should", ts: day(2), screenshot: JPEG, pageUrl:"https://alpha.example/" },
    { id:"a3", selector:".cta", text:"Nochmal der Button", author:"Tom", category:"bug", priority:"must",   ts: day(2), pageUrl:"https://alpha.example/preise" },
    { id:"a4", selector:"footer", text:"Schön!", author:"Tom", category:"praise", priority:"nice", ts: day(40), screenshot: JPEG, pageUrl:"https://alpha.example/preise" }
  ],
  "vibefeedback:v2:https://beta.example/app": [
    { id:"b1", selector:"nav", text:"Navigation verwirrend", author:"Ada", category:"feature", priority:"could", ts: day(3) }
  ],
  // Meta-Keys und Müll dürfen nicht als Projekt auftauchen
  "vibefeedback:v2:author": "Marie",
  "vibefeedback:v2:coach-seen": "1",
  "vibefeedback:v2:https://leer.example/": "[]",
  "vibefeedback:v2:https://kaputt.example/": "{nicht json",
  "irgendwas-anderes": "x"
};

(async () => {
  const PORT = 18095;
  const srv = await startServer(VF, PORT);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGE ERR:", e.message.slice(0, 160)); bad.push("pageerror"); });

  await page.goto(`http://127.0.0.1:${PORT}/dashboard.html?__vftest=1`, { waitUntil: "networkidle" });
  await page.evaluate(data => {
    localStorage.clear();
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, seed);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // ── Aggregation ────────────────────────────────────────────────────────
  console.log("[1] Übersicht");
  const projects = await page.evaluate(() => window.__vftest.PROJECTS.map(p => ({ src: p.src, n: p.comments.length, must: p.must, shots: p.shots, pages: p.pages.length, authors: p.authors })));
  check(projects.length === 2, `2 Projekte erkannt (${projects.length})`, JSON.stringify(projects.map(p => p.src)));
  check(!projects.some(p => /leer|kaputt|author|coach/.test(p.src)), "Leere/kaputte Stores und Meta-Keys ignoriert");
  const alpha = projects.find(p => p.src.includes("alpha"));
  check(alpha && alpha.n === 4, `alpha: 4 Kommentare (${alpha && alpha.n})`);
  check(alpha && alpha.must === 2, `alpha: 2 Muss-Fixes (${alpha && alpha.must})`);
  check(alpha && alpha.shots === 3, `alpha: 3 Screenshots (${alpha && alpha.shots})`);
  check(alpha && alpha.pages === 2, `alpha: 2 Unterseiten (${alpha && alpha.pages})`);
  check(alpha && alpha.authors.length === 2, `alpha: 2 Autor:innen (${alpha && alpha.authors.join()})`);
  // Zuletzt aktiv zuerst
  check(projects[0].src.includes("alpha"), "Sortierung: zuletzt aktives Projekt oben");

  const tiles = await page.evaluate(() => [...document.querySelectorAll(".tile")].map(t => ({
    label: t.querySelector(".label").textContent.trim(), value: t.querySelector(".value").textContent.trim()
  })));
  const tile = l => tiles.find(t => t.label.toLowerCase().startsWith(l))?.value;
  check(tile("projekte") === "2", `Kachel Projekte = 2 (${tile("projekte")})`);
  check(tile("kommentare") === "5", `Kachel Kommentare = 5 (${tile("kommentare")})`);
  check(tile("muss") === "2", `Kachel Muss-Fixes = 2 (${tile("muss")})`);
  check(tile("mit screenshot") === "60 %", `Kachel Screenshot-Quote = 60 % (${tile("mit screenshot")})`);
  check(tile("autor") === "3", `Kachel Autor:innen = 3 (${tile("autor")})`);

  // ── Charts ─────────────────────────────────────────────────────────────
  console.log("\n[2] Charts");
  const catCard = page.locator(".card").filter({ hasText: "Kommentare nach Kategorie" });
  check(await catCard.locator(".bar-row").count() > 0, "Varianz in den Daten → echtes Balkenchart");
  const catBars = await page.evaluate(() => [...document.querySelectorAll("#tbl-cat")].length);
  check(catBars === 1, "Kategorie-Chart hat Tabellenansicht");
  check(await page.locator(".spark").count() === 1, "Aktivitätsverlauf gerendert");
  // Tabellenansicht ein-/ausblenden
  const tblCat = page.locator("#tbl-cat");
  check(await tblCat.isHidden(), "Tabelle initial versteckt");
  await page.locator('[data-toggle-table="tbl-cat"]').click();
  check(await tblCat.isVisible(), "Tabelle per Button sichtbar");
  // Kategorie-Werte in der Tabelle
  const catCells = await page.locator("#tbl-cat tbody tr").allTextContents();
  const copyRow = catCells.find(r => r.includes("Copy"));
  check(/Copy2/.test((copyRow || "").replace(/\s/g, "")), `Copy = 2 in Tabelle (${copyRow})`);

  // Prioritäten: Muss=2, Sollte=1, Könnte=1, Nice=1
  await page.locator('[data-toggle-table="tbl-pri"]').click();
  const priRows = await page.locator("#tbl-pri tbody tr").allTextContents();
  check(/Muss.*2/.test(priRows[0] || ""), `Muss = 2 (${priRows[0]})`);
  check(/Nice.*1/.test(priRows[3] || ""), `Nice = 1 (${priRows[3]})`);

  // Tooltip beim Hover über einen Balken
  await page.locator(".bar-row").first().hover();
  await page.waitForTimeout(200);
  const tipShown = await page.evaluate(() => document.getElementById("tip").dataset.show === "true");
  check(tipShown, "Hover zeigt Tooltip");

  // Verlauf: 40 Tage alter Kommentar liegt außerhalb der 30-Tage-Reihe
  const seriesSum = await page.evaluate(() => window.__vftest.dailySeries(window.__vftest.PROJECTS.flatMap(p => p.comments), 30).reduce((n, d) => n + d.value, 0));
  check(seriesSum === 4, `30-Tage-Reihe zählt 4 von 5 Kommentaren (${seriesSum})`);

  await page.screenshot({ path: path.join(OUT, "dashboard_overview.png"), fullPage: true });

  // ── Detailansicht ──────────────────────────────────────────────────────
  console.log("\n[3] Detailansicht");
  await page.locator('button[data-open]').first().click();
  await page.waitForTimeout(300);
  check((await page.locator("h1").textContent()).includes("alpha") || (await page.locator(".sub").textContent()).includes("alpha"), "Detailansicht des zuletzt aktiven Projekts");
  check(await page.locator(".cmt").count() === 4, `4 Kommentare gelistet (${await page.locator(".cmt").count()})`);
  check(await page.locator(".cmt .thumb").count() === 3, `3 Screenshot-Vorschauen (${await page.locator(".cmt .thumb").count()})`);
  check(await page.locator(".cmt .thumb-ph").count() === 1, "1 Platzhalter für fehlenden Screenshot");
  // Seiten-Cockpit: Kennzahlen je Seite plus Absprung ins Tool
  const pagesCard = page.locator(".card").filter({ hasText: "Kommentare pro Seite" });
  check(await pagesCard.locator("tbody tr").count() === 2, `2 Seiten gelistet (${await pagesCard.locator("tbody tr").count()})`);
  const preiseRow = pagesCard.locator("tbody tr").filter({ hasText: "/preise" });
  check((await preiseRow.locator("td").nth(1).textContent()).trim() === "2", "Kommentarzahl pro Seite stimmt");
  check((await preiseRow.locator("td").nth(2).textContent()).includes("1"), "Muss-Spalte je Seite");
  const preiseHref = await preiseRow.locator("a.pagelink").getAttribute("href");
  check((preiseHref || "").includes(encodeURIComponent("https://alpha.example/preise")) && preiseHref.includes("owner=1"), `Seite verlinkt ins Tool (${(preiseHref || "").slice(0, 60)})`);

  // Filter nach Kategorie
  await page.locator('[data-cat="bug"]').click();
  await page.waitForTimeout(250);
  check(await page.locator(".cmt").count() === 1, `Kategorie-Filter Bug → 1 Kommentar (${await page.locator(".cmt").count()})`);
  await page.locator('[data-cat="all"]').click();
  await page.waitForTimeout(250);
  // Filter nach Priorität
  await page.locator('[data-pri="must"]').click();
  await page.waitForTimeout(250);
  check(await page.locator(".cmt").count() === 2, `Prioritätsfilter Muss → 2 Kommentare (${await page.locator(".cmt").count()})`);
  await page.screenshot({ path: path.join(OUT, "dashboard_detail.png"), fullPage: true });

  // Subpage-Chip sichtbar
  const chips = await page.locator(".cmt .chip").allTextContents();
  check(chips.some(c => c.includes("/preise")), `Subpage-Kennzeichnung sichtbar (${chips.join(" | ")})`);

  // ── Entartete vs. echte Charts ─────────────────────────────────────────
  console.log("\n[3b] Chartform passt zu den Daten");
  const forms = await page.evaluate(() => {
    const bc = window.__vftest.barChart;
    return {
      einBalken:    bc([{label:"a",value:5}]).degenerate,
      alleGleich:   bc([{label:"a",value:2},{label:"b",value:2}]).degenerate,
      ungleich:     bc([{label:"a",value:3},{label:"b",value:1}]).degenerate,
      ordinalBleibt: bc([{label:"a",value:2},{label:"b",value:2}], {keepOrder:true}).degenerate,
      leer:         bc([{label:"a",value:0}]).degenerate
    };
  });
  check(forms.einBalken === true, "Ein Balken → entartet (Kachel statt Chart)");
  check(forms.alleGleich === true, "Alle Werte gleich → entartet (Tabelle)");
  check(forms.ungleich === false, "Unterschiedliche Werte → echtes Balkenchart");
  check(forms.ordinalBleibt === false, "Ordinale Prioritäten behalten das Chart");
  check(forms.leer === true, "Nur Nullwerte → kein Chart");

  // Autoren: Marie 2, Tom 2 → gleich → Tabelle; nach Filter bleibt Reihenfolge stabil
  const authorCard = page.locator(".card").filter({ hasText: "Kommentare pro Autor" });
  check(await authorCard.count() === 1, "Autoren-Karte vorhanden");

  // ── Cockpit: Aktionen, Arbeitsliste, Status-Workflow ───────────────────
  console.log("\n[3c] Aktionen & Status");
  const openHref = await page.locator("#btn-open-tool").getAttribute("href");
  check((openHref || "").includes(encodeURIComponent("https://alpha.example/")) && openHref.includes("owner=1"), "Primär-CTA öffnet das Projekt im Feedback-Tool");
  check(await page.locator("#btn-export-proj").isEnabled(), "Einzelprojekt-Export verfügbar");

  const nextCard = page.locator(".card").filter({ hasText: "Nächste Schritte" });
  check(await nextCard.locator(".next li").count() === 4, `4 offene Punkte in der Arbeitsliste (${await nextCard.locator(".next li").count()})`);
  check(/Muss/.test(await nextCard.locator(".next li").first().textContent()), "Muss-Punkte stehen oben");

  // ── Cockpit-Ergonomie: Deep-Link, Suche, Sortierung, Lightbox ──────────
  console.log("\n[3c'] Deep-Link, Suche, Sortierung, Lightbox");
  check(page.url().includes("#p="), `Detailansicht hat Deep-Link im Hash (${page.url().split("#")[1] || "—"})`);
  await page.locator('[data-pri="all"]').click();   // Prioritätsfilter aus [3] zurücksetzen
  await page.waitForTimeout(250);

  await page.locator("#cmt-search").fill("button");
  await page.waitForTimeout(200);
  check(await page.locator(".cmt:visible").count() === 2, `Suche "button" → 2 Treffer (${await page.locator(".cmt:visible").count()})`);
  check(/2 von 4/.test(await page.locator("#search-note").textContent()), "Trefferanzeige neben dem Suchfeld");
  await page.locator("#cmt-search").fill("");
  await page.waitForTimeout(200);
  check(await page.locator(".cmt:visible").count() === 4, "Suche geleert → alle sichtbar");

  await page.locator("#cmt-sort").selectOption("pri");
  await page.waitForTimeout(250);
  check(/Muss/.test(await page.locator(".cmt").first().textContent()), "Sortierung nach Priorität: Muss zuerst");
  await page.locator("#cmt-sort").selectOption("new");
  await page.waitForTimeout(250);

  await page.locator(".cmt .thumb").first().click();
  await page.waitForTimeout(200);
  check(await page.locator("#lightbox").isVisible(), "Thumbnail öffnet Lightbox");
  check(((await page.locator("#lightbox img").getAttribute("src")) || "").startsWith("data:image/"), "Lightbox zeigt den Screenshot");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check(await page.locator("#lightbox").isHidden(), "Esc schließt die Lightbox");

  // Kopier-Aktionen: Feedback-Link (für Tester) und Prompt (fürs Coding-Tool)
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: `http://127.0.0.1:${PORT}` });
  await page.locator("#btn-copy-link").click();
  await page.waitForTimeout(300);
  const copiedLink = await page.evaluate(() => navigator.clipboard.readText());
  check(copiedLink === `http://127.0.0.1:${PORT}/?src=${encodeURIComponent("https://alpha.example/")}`, `Feedback-Link kopiert (${copiedLink})`);
  await page.locator("#btn-copy-prompt").click();
  await page.waitForTimeout(300);
  const copiedPrompt = await page.evaluate(() => navigator.clipboard.readText());
  check(copiedPrompt.startsWith("Du bekommst Nutzer-Feedback"), "Prompt kopiert");

  // Filter zurücksetzen (aus [3] ist noch "Muss" aktiv), dann neuesten Kommentar erledigen
  await page.locator('[data-pri="all"]').click();
  await page.waitForTimeout(250);
  await page.locator(".cmt").first().locator('.st-btns button[data-st="done"]').click();
  await page.waitForTimeout(300);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("vibefeedback:v2:https://alpha.example/")));
  check(stored.find(c => c.id === "a1")?.status === "done", "Status landet im localStorage");
  check(stored.filter(c => !("status" in c)).length === 3, "übrige Kommentare bleiben ohne Status-Feld");

  const tileVal = async l => page.evaluate(l => {
    const t = [...document.querySelectorAll(".tile")].find(t => (t.querySelector(".label")?.textContent.trim().toLowerCase() || "").startsWith(l));
    return t?.querySelector(".value")?.textContent.trim();
  }, l);
  check(await tileVal("erledigt") === "25 %", `Erledigt-Kachel 25 % (${await tileVal("erledigt")})`);
  check(await tileVal("offen") === "3", `Offen-Kachel 3 (${await tileVal("offen")})`);
  check(await page.locator('.cmt[data-done="true"]').count() === 1, "Erledigter Kommentar gedimmt markiert");
  await page.locator('[data-st-filter="done"]').click();
  await page.waitForTimeout(250);
  check(await page.locator(".cmt").count() === 1, `Status-Filter Erledigt → 1 Kommentar (${await page.locator(".cmt").count()})`);
  await page.locator('[data-st-filter="all"]').click();
  await page.waitForTimeout(250);
  check(await page.locator(".card").filter({ hasText: "Nächste Schritte" }).locator(".next li").count() === 3, "Arbeitsliste ohne den erledigten Punkt");

  // Prompt enthält nur Offenes, gruppiert nach Priorität
  const prompt = await page.evaluate(() => window.__vftest.buildPrompt(window.__vftest.PROJECTS[0]));
  check(prompt.includes("## Muss"), "Prompt gruppiert nach Priorität");
  check(prompt.includes("Nochmal der Button") && prompt.includes(".cta"), "Prompt nennt Text und Selektor");
  check(!prompt.includes("Titel unklar"), "Erledigtes bleibt aus dem Prompt draußen");

  // Abhaken direkt aus der Arbeitsliste
  await page.locator("[data-next-done]").first().click();
  await page.waitForTimeout(300);
  const stored2 = await page.evaluate(() => JSON.parse(localStorage.getItem("vibefeedback:v2:https://alpha.example/")));
  check(stored2.filter(c => c.status === "done").length === 2, `Arbeitslisten-Haken setzt Status (${stored2.filter(c => c.status === "done").length} erledigt)`);
  // zurücksetzen, damit die Prozent-Checks unten stimmen
  await page.locator(".cmt").filter({ hasText: "Nochmal der Button" }).locator('button[data-st="open"]').click();
  await page.waitForTimeout(300);

  // Status und Ansicht überleben den Reload (Hash-Routing)
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  check(await page.evaluate(() => window.__vftest.PROJECTS.find(p => p.src.includes("alpha")).done) === 1, "Status überlebt den Reload");
  check(await page.locator("#btn-back").count() === 1, "Reload bleibt dank Hash in der Detailansicht");
  await page.evaluate(() => { location.hash = ""; });
  await page.waitForTimeout(300);
  check(await page.locator(".proj-card").count() === 2, "Hash leeren → zurück zur Übersicht");

  // ── Projekt-Karten in der Übersicht ────────────────────────────────────
  console.log("\n[3d] Projekt-Karten");
  check(await page.locator(".proj-card").count() === 2, `2 Projekt-Karten (${await page.locator(".proj-card").count()})`);
  const firstCard = page.locator(".proj-card").first();
  check(await firstCard.locator(".progress span").evaluate(el => el.style.width) === "25%", "Fortschrittsbalken zeigt 25 %");
  const cardHref = await firstCard.locator("a.btn").getAttribute("href");
  check((cardHref || "").includes(encodeURIComponent("https://alpha.example/")) && cardHref.includes("owner=1"), "Karte verlinkt direkt ins Tool");
  check(/Muss offen/.test(await firstCard.textContent()), "Karte zeigt offene Muss-Fixes");

  // ── Löschen ────────────────────────────────────────────────────────────
  console.log("\n[4] Projekt löschen");
  await page.locator('button[data-open]').first().click();
  await page.waitForTimeout(300);
  page.once("dialog", d => d.accept());
  await page.locator("#btn-del").click();
  await page.waitForTimeout(400);
  const left = await page.evaluate(() => window.__vftest.PROJECTS.length);
  check(left === 1, `nach Löschen 1 Projekt (${left})`);
  const gone = await page.evaluate(() => localStorage.getItem("vibefeedback:v2:https://alpha.example/"));
  check(gone === null, "Store aus localStorage entfernt");
  const authorKept = await page.evaluate(() => localStorage.getItem("vibefeedback:v2:author"));
  check(authorKept === "Marie", "Meta-Keys bleiben unangetastet");

  // Nur noch beta mit einem Kommentar: ein einzelner Balken zwischen fünf leeren
  // wäre informationslos → Zahl statt Chart, und kein Tabellen-Umschalter.
  const catCard2 = page.locator(".card").filter({ hasText: "Kommentare nach Kategorie" });
  check(await catCard2.locator(".bar-row").count() === 0, "Ein Kommentar → kein Balkenchart in der Übersicht");
  check(await catCard2.locator(".value").count() === 1, "Stattdessen die Zahl");
  check(await page.locator('[data-toggle-table="tbl-cat"]').count() === 0, "Kein Tabellen-Umschalter ohne Tabelle");
  check(await page.locator(".tile").nth(1).locator(".foot").textContent().then(t => /1 Seite/.test(t)), "Seiten-Kachel zählt korrekt weiter");

  // ── Leerer Zustand ─────────────────────────────────────────────────────
  console.log("\n[5] Leerer Zustand");
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  check(await page.locator(".empty h2").isVisible(), "Leerer Zustand mit Erklärung");
  const demoHref = await page.locator(".empty a.btn").getAttribute("href");
  check((demoHref || "").startsWith("./?src="), `Demo-Link zeigt aufs Tool (${demoHref?.slice(0, 30)})`);

  // ── Verlinkung von der Startseite ──────────────────────────────────────
  console.log("\n[6] Einstieg über die Startseite");
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  check(await page.locator("#nav-dashboard").isVisible(), "Dashboard-Link in der Navigation");
  await page.locator("#cta-dashboard").click();
  await page.waitForTimeout(600);
  check(page.url().includes("dashboard.html"), `CTA führt zum Dashboard (${page.url().split("/").pop()})`);

  console.log(`\n${ok.length}/${ok.length + bad.length} bestanden`);
  await browser.close();
  srv.close();
  process.exit(bad.length ? 1 : 0);
})();
