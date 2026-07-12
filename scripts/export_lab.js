// Export-Labor: erzeugt in einer ECHTEN Arbeitsumgebung (echte Websites, echte
// Screenshots) alle Export-Artefakte von VibeFeedback und legt sie zur Prüfung ab.
//   node scripts/export_lab.js
// Artefakte landen unter export_lab/ (gitignored).
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const VF = path.join(__dirname, "..");
const OUT = path.join(VF, "export_lab");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const SITES = [
  { name: "kippflix",     url: "https://www.kippflix.com/" },
  { name: "ideen-hangar", url: "https://ceekay1901.github.io/ideen-hangar/" },
];

function startServer(port) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let fp = req.url.split("?")[0];
      fp = fp === "/modern-screenshot.js" ? path.join(VF, "node_modules/modern-screenshot/dist/index.js") : path.join(VF, fp);
      try {
        const body = fs.readFileSync(fp);
        const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" }[path.extname(fp)] || "text/plain";
        res.writeHead(200, { "Content-Type": mime, "Access-Control-Allow-Origin": "*" });
        res.end(body);
      } catch { res.writeHead(404); res.end(); }
    });
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 15000, step = 500) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch {} await sleep(step); }
  return null;
}

// Diverse Elemente + Metadaten, damit die Exporte alle Code-Pfade abdecken.
const SEEDS = [
  { sel: ["h1", "h2", "header h1"], cat: "copy",    pri: "should", text: "Überschrift ist missverständlich — klarer formulieren, worum es geht." },
  { sel: ["button", "a.btn", ".btn", "nav a"],      cat: "bug",     pri: "must",   text: "Button reagiert auf Mobile verzögert; Doppelklicks lösen zwei Aktionen aus.\nBitte Debounce ergänzen." },
  { sel: ["img", "picture img", "svg"],             cat: "design",  pri: "could",  text: "Bild wirkt unscharf auf Retina — bitte 2x-Asset liefern." },
  { sel: ["p", "main p", "section p", "li"],        cat: "feature", pri: "nice",   text: "Hier wäre ein Tooltip mit mehr Kontext hilfreich." },
];

async function seedComment(page, seed, idx) {
  // 1. Element klicken → cbar öffnet
  const clicked = await page.evaluate(sels => {
    const doc = document.querySelector("#frame")?.contentDocument;
    if (!doc) return null;
    for (const s of sels) {
      const el = [...doc.querySelectorAll(s)].find(e => { const r = e.getBoundingClientRect(); return r.width > 24 && r.height > 12; });
      if (el) { el.scrollIntoView({ block: "center" }); el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView })); return s; }
    }
    return null;
  }, seed.sel);
  if (!clicked) return { ok: false, why: "kein Element für " + seed.sel[0] };
  const cbar = await waitFor(() => page.locator(".cbar").isVisible().catch(() => false), 8000);
  if (!cbar) return { ok: false, why: "cbar öffnete nicht" };

  // 2. 📷 klicken → echten Screenshot aufnehmen (opt-in seit 1.9.0)
  await page.locator('.cbar [data-act="screenshot"]').click({ timeout: 4000 }).catch(() => {});
  await waitFor(() => page.evaluate(() => {
    const t = document.querySelector(".cbar-thumb:not([hidden])");
    const cv = document.querySelector(".cbar .annot .stage canvas");
    return !!(t || cv);
  }).catch(() => false), 30000, 1000);

  // 3. Kategorie + Priorität wählen (Chips), Text setzen
  await page.evaluate(({ cat, pri, text }) => {
    const cbar = document.querySelector(".cbar");
    const pick = (group, val) => {
      const box = cbar.querySelector(`[data-role="${group}"]`);
      if (!box) return;
      const chip = [...box.querySelectorAll("[data-cat],[data-pri],button,.chip")].find(c => (c.dataset.cat === val || c.dataset.pri === val || (c.textContent || "").toLowerCase().includes(val)));
      (chip || box.firstElementChild)?.click();
    };
    pick("cats", cat); pick("prios", pri);
    const ta = cbar.querySelector('textarea[data-role="text"]');
    if (ta) { ta.value = text; ta.dispatchEvent(new Event("input", { bubbles: true })); }
  }, seed).catch(() => {});

  // 4. Speichern
  await page.locator('.cbar [data-act="save"]').click({ timeout: 4000 }).catch(() => {});
  await waitFor(() => page.evaluate(n => (window.__vftest?.STATE?.comments?.length || 0) >= n, idx + 1).catch(() => false), 8000);
  return { ok: true, clicked };
}

async function run() {
  const PORT = 18220;
  const srv = await startServer(PORT);
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"], headless: true });
  const manifest = { sites: [], generatedAt: new Date().toISOString() };

  for (const site of SITES) {
    const dir = path.join(OUT, site.name);
    fs.mkdirSync(path.join(dir, "zip"), { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    await ctx.addInitScript(`window.__VF_MS_OVERRIDE = "http://127.0.0.1:${PORT}/modern-screenshot.js";`);
    await ctx.addInitScript(() => localStorage.setItem("vibefeedback:v2:author", "Real-Tester"));
    const page = await ctx.newPage();
    const rec = { name: site.name, url: site.url, comments: 0, artifacts: {}, notes: [] };
    try {
      console.log(`\n━━ ${site.name} (${site.url}) ━━`);
      await page.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(site.url)}&owner=1&__vftest=1`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.locator(".coach button").click({ timeout: 4000 }).catch(() => {});
      const loaded = await waitFor(() => page.evaluate(() => {
        const f = document.querySelector("#frame"); const err = document.querySelector("#errbox");
        if (err && !err.classList.contains("hidden")) return "error";
        return (f?.contentDocument?.body?.innerText?.trim().length || 0) > 40 ? "ok" : null;
      }).catch(() => null), 30000);
      if (loaded !== "ok") { rec.notes.push("Seite lud nicht: " + loaded); manifest.sites.push(rec); await ctx.close(); continue; }

      let n = 0;
      for (const seed of SEEDS) {
        const r = await seedComment(page, seed, n);
        if (r.ok) n++; else rec.notes.push(seed.sel[0] + ": " + r.why);
        await sleep(400);
      }
      rec.comments = await page.evaluate(() => window.__vftest.STATE.comments.length).catch(() => 0);
      console.log(`  ${rec.comments} echte Kommentare geseedet`);
      if (!rec.comments) { manifest.sites.push(rec); await ctx.close(); continue; }

      // Variety anreichern (Status, Reply, strukturierte Felder, Reaktionen) — realistisch, in-memory
      await page.evaluate(() => {
        const cs = window.__vftest.STATE.comments;
        if (cs[0]) cs[0].status = "done";
        if (cs[1]) { cs[1].status = "doing"; cs[1].replies = [{ id: "r1", author: "Owner", text: "Guter Punkt, ich schaue mir das Debounce an.", ts: Date.now(), reactions: { likes: [], dislikes: [] } }]; cs[1].reactions = { likes: ["a", "b"], dislikes: [] }; }
        if (cs[2]) cs[2].structured = { ist: "Bild ist 1x aufgelöst", soll: "2x/SVG liefern" };
      }).catch(() => {});

      // Artefakt 1: reiner Markdown-Export
      const md = await page.evaluate(() => window.__vftest.buildMarkdown()).catch(() => "");
      fs.writeFileSync(path.join(dir, "feedback.md"), md);
      rec.artifacts.md_bytes = Buffer.byteLength(md);

      // Artefakt 2: echter ZIP-Download über den Button
      let zipPath = null;
      try {
        const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.locator("#btn-export-zip").click()]);
        zipPath = path.join(dir, "export.zip");
        await dl.saveAs(zipPath);
        rec.artifacts.zip_bytes = fs.statSync(zipPath).size;
        try { execFileSync("unzip", ["-o", zipPath, "-d", path.join(dir, "zip")], { stdio: "ignore" }); rec.artifacts.zip_unpacked = fs.readdirSync(path.join(dir, "zip")); } catch (e) { rec.notes.push("unzip: " + e.message.slice(0, 60)); }
      } catch (e) { rec.notes.push("ZIP-Download: " + e.message.slice(0, 80)); }

      // Artefakt 3: Roundtrip — ZIP re-importieren, Treue prüfen
      if (zipPath) {
        const zb = fs.readFileSync(zipPath);
        const round = await page.evaluate(async b64 => {
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const file = new File([bytes], "export.zip");
          const items = await window.__vftest.itemsFromZip(file);
          const orig = window.__vftest.STATE.comments;
          return {
            origCount: orig.length, importCount: items.length,
            withShot: items.filter(i => i.screenshot && i.screenshot.startsWith("data:image/")).length,
            lostText: orig.filter(o => !items.find(i => (i.note || i.text) === (o.text || null) || (i.selector === o.selector))).length,
            sampleKeys: items[0] ? Object.keys(items[0]) : [],
          };
        }, zb.toString("base64")).catch(e => ({ err: e.message }));
        fs.writeFileSync(path.join(dir, "roundtrip.json"), JSON.stringify(round, null, 2));
        rec.artifacts.roundtrip = round;
      }
      manifest.sites.push(rec);
    } catch (e) {
      rec.notes.push("Fehler: " + e.message.slice(0, 120)); manifest.sites.push(rec);
    }
    await ctx.close();
  }

  // Dashboard „Alles exportieren" (kommentare.csv + feedback.json + Screenshots je Projekt)
  try {
    const dctx = await browser.newContext({ acceptDownloads: true });
    const dpage = await dctx.newPage();
    // 2 realistische Projekte in localStorage seeden (mit einem echten Screenshot aus obigem Lauf)
    const oneShot = (() => {
      for (const s of SITES) { const p = path.join(OUT, s.name, "zip", "screenshots"); if (fs.existsSync(p)) { const f = fs.readdirSync(p)[0]; if (f) { const b = fs.readFileSync(path.join(p, f)); return `data:image/${path.extname(f).slice(1) === "jpg" ? "jpeg" : path.extname(f).slice(1)};base64,${b.toString("base64")}`; } } }
      return null;
    })();
    await dpage.goto(`http://127.0.0.1:${PORT}/dashboard.html`, { waitUntil: "domcontentloaded" });
    await dpage.evaluate(shot => {
      const mk = (url, texts) => localStorage.setItem("vibefeedback:v2:" + url, JSON.stringify(texts.map((t, i) => ({
        id: "d" + i + Math.random().toString(36).slice(2, 6), selector: "main > section:nth-child(" + (i + 1) + ") button", tag: "button",
        text: t, author: "Real-Tester", category: ["bug", "feature", "design"][i % 3], priority: ["must", "should", "could"][i % 3],
        status: i === 0 ? "done" : undefined, ts: Date.now() - i * 8.64e7, pageUrl: url,
        screenshot: i === 0 ? shot : null, info: { text: "Element " + i, rect: { w: 120, h: 40, viewport: "1440×900" } },
        reactions: { likes: [], dislikes: [] }, replies: [],
      }))));
      mk("https://example-shop.dev/", ["Warenkorb-Button unauffindbar", "Filter nach Größe fehlt", "Produktbild lädt langsam", 'Zeilenumbruch im Titel, „Sonder;angebot" mit Sonderzeichen']);
      mk("https://example-blog.dev/", ["Kommentarfunktion kaputt", "Dark-Mode-Toggle merkt sich nichts"]);
    }, oneShot).catch(e => console.log("seed dash:", e.message));
    await dpage.goto(`http://127.0.0.1:${PORT}/dashboard.html`, { waitUntil: "networkidle" });
    const [dl] = await Promise.all([dpage.waitForEvent("download", { timeout: 15000 }), dpage.locator("#btn-export-all").click()]);
    const zp = path.join(OUT, "dashboard-all.zip");
    await dl.saveAs(zp);
    try { execFileSync("unzip", ["-o", zp, "-d", path.join(OUT, "dashboard-all")], { stdio: "ignore" }); } catch {}
    manifest.dashboard = { zip_bytes: fs.statSync(zp).size, unpacked: fs.existsSync(path.join(OUT, "dashboard-all")) ? execFileSync("find", [path.join(OUT, "dashboard-all"), "-type", "f"]).toString().trim().split("\n").map(p => p.replace(OUT + "/", "")) : [] };
    console.log("\n━━ Dashboard-Export: " + manifest.dashboard.zip_bytes + " bytes ━━");
    await dctx.close();
  } catch (e) { manifest.dashboard = { err: e.message.slice(0, 120) }; console.log("Dashboard-Export fehlgeschlagen:", e.message); }

  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  await browser.close(); srv.close();
  console.log("\n✅ Export-Labor fertig. Artefakte in " + OUT);
  console.log(JSON.stringify(manifest, null, 2));
}
run().catch(e => { console.error(e); process.exit(1); });
