// Status-Workflow im Tool: Sidebar-Toggle persistiert, Markdown kennzeichnet
// Status, und der Import übernimmt Status-Updates aus Kollaborations-Exporten
// statt sie als Duplikate zu verwerfen (auch als reiner Merge ohne neue Items).
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

(async () => {
  const PORT = 18102;
  const srv = await startServer(VF, PORT);
  const SRC = `http://127.0.0.1:${PORT}/test_screenshot.html`;
  const KEY = "vibefeedback:v2:" + SRC;

  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", e => { console.log("PAGE ERR:", e.message.slice(0, 160)); bad.push("pageerror"); });

  await page.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${PORT}/modern-screenshot.js";`);
  await page.addInitScript(([key, src]) => {
    localStorage.setItem(key, JSON.stringify([
      { id:"s1", selector:"h1", tag:"h1", text:"Titel unklar", author:"Marie", category:"copy", priority:"must", ts: Date.now() - 864e5 },
      { id:"s2", selector:".hero", tag:"div", text:"Hero zu voll", author:"Tom", category:"design", priority:"should", ts: 1750000000000 }
    ]));
  }, [KEY, SRC]);
  await page.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(SRC)}&owner=1&__vftest=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator(".coach button").click().catch(() => {});

  // ── Sidebar: Toggle durchschalten und persistieren ─────────────────────
  console.log("[1] Status in der Sidebar");
  const btn = page.locator('[data-status-btn="s1"]');
  check(await btn.count() === 1, "Status-Badge am Kommentar");
  check((await btn.textContent()).includes("Offen"), `initial Offen (${(await btn.textContent()).trim()})`);

  await btn.click();
  await page.waitForTimeout(200);
  check((await page.locator('[data-status-btn="s1"]').textContent()).includes("In Arbeit"), "Klick 1 → In Arbeit");
  let stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  check(stored.find(c => c.id === "s1").status === "doing", "In Arbeit im localStorage");

  await page.locator('[data-status-btn="s1"]').click();
  await page.waitForTimeout(200);
  stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  check(stored.find(c => c.id === "s1").status === "done", "Klick 2 → Erledigt im localStorage");
  check(await page.locator('.item[data-done="true"]').count() === 1, "Erledigtes Item gedimmt");
  check(/1.*erledigt/.test(await page.locator("#stats").textContent()), "Stats zählen Erledigtes");

  await page.locator('[data-status-btn="s1"]').click();
  await page.waitForTimeout(200);
  stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  check(!("status" in stored.find(c => c.id === "s1")), "Klick 3 → wieder offen (Feld entfernt)");

  // ── Markdown kennzeichnet den Status ───────────────────────────────────
  console.log("\n[2] Markdown-Export");
  await page.locator('[data-status-btn="s1"]').click();   // → doing
  await page.locator('[data-status-btn="s1"]').click();   // → done
  await page.waitForTimeout(200);
  const md = await page.evaluate(() => window.__vftest.buildMarkdown());
  check(/^## 1\. \[Muss\] ✓ /m.test(md), "Erledigt-Haken in der Überschrift");
  check(md.includes("Status Erledigt ✓"), "Status in der Meta-Zeile");
  check(md.includes("**Status:** ○ Offen 1 · ✓ Erledigt 1"), "Status-Summe im Kopf");
  check(md.includes("> 5. Items mit ✓"), "Anweisung an den KI-Assistenten");
  check(md.includes('"status": "done"') && md.includes('"status": "open"'), "Status im JSON-Block");

  // ── Import-Merge: Status aus fremdem Export übernehmen ────────────────
  console.log("\n[3] Import übernimmt Status");
  const res = await page.evaluate(async () => {
    // Export eines Helfers: gleiche Kommentare (per id bzw. selector+ts),
    // aber s1 wieder offen und s2 erledigt. Kein einziges neues Item.
    const payload = { comments: [
      { id:"s1", selector:"h1", ts: 0, status:"open" },
      { selector:".hero", ts: 1750000000000, status:"done" }   // ohne id → Fingerprint-Match
    ]};
    const file = new File([JSON.stringify(payload)], "feedback.json", { type: "application/json" });
    const dt = new DataTransfer(); dt.items.add(file);
    const input = document.getElementById("btn-import-file");
    Object.defineProperty(input, "files", { value: dt.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
    return { n: STATE.comments.length, s1: STATE.comments.find(c => c.id === "s1").status || "open", s2: STATE.comments.find(c => c.id === "s2").status || "open" };
  });
  check(res.n === 2, `keine Duplikate angelegt (${res.n} Kommentare)`);
  check(res.s1 === "open", `s1 per id wieder geöffnet (${res.s1})`);
  check(res.s2 === "done", `s2 per Fingerprint erledigt (${res.s2})`);
  stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  check(stored.find(c => c.id === "s2").status === "done", "reiner Status-Merge wird gespeichert");
  check(!("status" in stored.find(c => c.id === "s1")), "offen bleibt als fehlendes Feld gespeichert");
  const toast = await page.evaluate(() => document.querySelector(".toast")?.textContent || "");
  check(/2 Status übernommen/.test(toast) && !/Duplikat/.test(toast), `Toast meldet Merge statt Duplikate (${toast.trim()})`);

  // Unbekannter Status wird nicht übernommen
  const evil = await page.evaluate(async () => {
    const payload = { comments: [ { id:"s2", selector:".hero", ts: 1750000000000, status:"<img onerror=x>" } ] };
    const file = new File([JSON.stringify(payload)], "f.json", { type: "application/json" });
    const dt = new DataTransfer(); dt.items.add(file);
    const input = document.getElementById("btn-import-file");
    Object.defineProperty(input, "files", { value: dt.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 800));
    return STATE.comments.find(c => c.id === "s2").status;
  });
  check(evil === "done", `ungültiger Status wird ignoriert (${evil})`);

  // ── Kollaboration: neue Replies + Reaktionen eines Helfers werden übernommen ──
  console.log("\n[4] Import übernimmt Replies & Reaktionen (kein Datenverlust)");
  const collab = await page.evaluate(async () => {
    const payload = { comments: [ {
      id:"s1", selector:"h1", ts: 0,
      reactions: { likes: ["u1","u2"], dislikes: [] },
      replies: [ { id:"rp1", author:"Helfer", text:"Umformuliert, bitte prüfen.", ts: 111, reactions: { likes:["u3"], dislikes:[] } } ]
    } ] };
    const imp = async () => {
      const file = new File([JSON.stringify(payload)], "collab.json", { type:"application/json" });
      const dt = new DataTransfer(); dt.items.add(file);
      const input = document.getElementById("btn-import-file");
      Object.defineProperty(input, "files", { value: dt.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise(r => setTimeout(r, 900));
    };
    await imp(); await imp();   // zweimal → Reply darf sich nicht duplizieren
    const s1 = STATE.comments.find(c => c.id === "s1");
    return { n: STATE.comments.length, replies: (s1.replies||[]).length, replyText: (s1.replies||[])[0]?.text || "", replyRxn: (s1.replies||[])[0]?.reactions?.likes?.length || 0, likes: (s1.reactions?.likes||[]).length };
  });
  check(collab.n === 2, `keine neuen Items durch Kollaborations-Import (${collab.n})`);
  check(collab.replies === 1, `neue Reply übernommen & nicht dupliziert (${collab.replies})`);
  check(collab.replyText === "Umformuliert, bitte prüfen.", "Reply-Text erhalten");
  check(collab.replyRxn === 1, `Reply-Reaktion erhalten (${collab.replyRxn})`);
  check(collab.likes === 2, `Kommentar-Reaktionen (likes) übernommen (${collab.likes})`);

  console.log(`\n${ok.length}/${ok.length + bad.length} bestanden`);
  await browser.close();
  srv.close();
  process.exit(bad.length ? 1 : 0);
})();
