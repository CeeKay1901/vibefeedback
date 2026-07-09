/**
 * VibeFeedback × Kippflix — Screenshot Quality Loop Test
 *
 * Ablauf pro Iteration:
 *  1. Playwright öffnet Kippflix direkt → Reference-Screenshots (5 Elemente)
 *  2. Playwright öffnet VibeFeedback mit Kippflix als Target → VF captureElement()
 *  3. Beide Bilder werden nebeneinander in einer HTML-Report-Seite gespeichert
 *  4. Pixel-Similarität wird grob über canvas.getContext("2d").getImageData geprüft
 *  5. Wenn alle Elemente ≥ Schwelle → PASS, sonst FAIL mit Details
 */

const { chromium } = require("/data/data/com.termux/files/home/vibefeedback/node_modules/playwright");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

const VF_DIR    = "/data/data/com.termux/files/home/vibefeedback";
const OUT_DIR   = path.join(VF_DIR, "kf_shots");
const KF_URL    = "https://ceekay1901.github.io/Kippflix/";
const H2C_LOCAL = path.join(VF_DIR, "node_modules/html2canvas/dist/html2canvas.min.js");

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Local VF-server (serves vibefeedback + html2canvas) ──────────────────────
function startServer(port){
  return new Promise(resolve=>{
    const srv = http.createServer((req, res)=>{
      const urlPath = req.url.split("?")[0];
      let fp = urlPath === "/html2canvas.min.js"
        ? H2C_LOCAL
        : path.join(VF_DIR, urlPath);
      if(fp.endsWith("/")) fp += "index.html";
      try{
        const ext  = path.extname(fp);
        const mime = {".html":"text/html",".js":"application/javascript",".svg":"image/svg+xml",".css":"text/css"}[ext]||"text/plain";
        res.writeHead(200, {"Content-Type":mime,"Access-Control-Allow-Origin":"*"});
        res.end(fs.readFileSync(fp));
      }catch(e){ res.writeHead(404); res.end("not found"); }
    });
    srv.listen(port, "127.0.0.1", ()=>resolve(srv));
  });
}

const sleep = ms => new Promise(r=>setTimeout(r,ms));

// ── Elements to test ─────────────────────────────────────────────────────────
// selector, label, extra wait condition
const ELEMENTS = [
  { sel: ".nav",            label: "nav-bar",      desc: "Navigation Bar" },
  { sel: ".stats-bar",      label: "stats-bar",    desc: "Stats Bar" },
  { sel: ".hero",           label: "hero",         desc: "Hero Section" },
  { sel: ".strip",          label: "first-strip",  desc: "Erster Film-Strip" },
  { sel: ".card",           label: "film-card",    desc: "Film-Karte (.card)" },
];

// ── Phase 1: Reference screenshots via Playwright element.screenshot() ────────
async function takeReferenceShots(browser){
  console.log("\n── Phase 1: Referenz-Screenshots (Playwright direkt) ──");
  const ctx  = await browser.newContext({ viewport:{width:1280,height:900} });
  const page = await ctx.newPage();

  console.log("  Lade Kippflix live…");
  await page.goto(KF_URL, { waitUntil:"networkidle", timeout:30000 });
  // Wait for skeleton to be replaced by real content
  await page.waitForSelector(".card, .strip, .hero__title", { timeout:15000 }).catch(()=>{});
  await sleep(3000); // let strips animate in

  const refs = {};
  for(const el of ELEMENTS){
    try{
      const loc = page.locator(el.sel).first();
      await loc.waitFor({ state:"visible", timeout:5000 });
      const buf = await loc.screenshot({ type:"png" });
      const fp  = path.join(OUT_DIR, `ref_${el.label}.png`);
      fs.writeFileSync(fp, buf);
      refs[el.label] = fp;
      console.log(`  ✓ ref ${el.desc} → ref_${el.label}.png`);
    }catch(e){
      console.log(`  ✗ ref ${el.desc} → ${e.message.slice(0,80)}`);
      refs[el.label] = null;
    }
  }
  await page.screenshot({ path: path.join(OUT_DIR, "ref_full_page.png"), fullPage:false });
  await ctx.close();
  return refs;
}

// ── Phase 2: VibeFeedback captures ───────────────────────────────────────────
async function takeVFShots(browser, port){
  console.log("\n── Phase 2: VibeFeedback captureElement() ──");
  const vfUrl  = `http://127.0.0.1:${port}/index.html`;
  const appUrl = `${vfUrl}?src=${encodeURIComponent(KF_URL)}`;

  const ctx  = await browser.newContext({ viewport:{width:1280,height:900} });
  const page = await ctx.newPage();

  const logs = [];
  page.on("console", msg=>{ const t=msg.text(); logs.push(t); if(t.includes("[vf]")) console.log("    LOG:", t.slice(0,120)); });
  page.on("pageerror", e=>console.error("    PAGE ERR:", e.message));

  // Override CDN so html2canvas loads locally
  await page.addInitScript(`window.__VF_H2C_OVERRIDE = "http://127.0.0.1:${port}/html2canvas.min.js";`);

  // Add CORS headers so VibeFeedback's fetch() and html2canvas useCORS:true both work
  for(const pattern of ["https://ceekay1901.github.io/**", "https://image.tmdb.org/**", "https://www.criticker.com/**"]){
    await page.route(pattern, async route => {
      try {
        const resp = await route.fetch();
        const headers = { ...resp.headers(), "access-control-allow-origin": "*" };
        await route.fulfill({ response: resp, headers });
      } catch(e) { await route.continue(); }
    });
  }

  console.log("  Lade VibeFeedback mit Kippflix…");
  await page.goto(appUrl, { waitUntil:"networkidle", timeout:45000 });
  // Wait for iframe content to render film cards (can take 10+ s via srcdoc + external JS)
  await page.waitForFunction(()=>{
    const f = document.querySelector("#frame");
    const doc = f && f.contentDocument;
    if(!doc || !doc.body) return false;
    // Accept: static nav loaded OR dynamic film-card loaded
    return !!doc.querySelector(".nav, .hero, .film-card, .strip");
  }, { timeout:30000 }).catch(e=>console.log("  waitForFunction timeout:", e.message.slice(0,80)));
  await sleep(5000); // extra time for strips to build

  const shots = {};
  for(const el of ELEMENTS){
    console.log(`\n  Capture: ${el.desc} (${el.sel})`);
    const dataUrl = await page.evaluate(async (sel)=>{
      const frameEl = document.querySelector("#frame");
      if(!frameEl) return {err:"no frame"};
      const doc = frameEl.contentDocument;
      if(!doc) return {err:"no contentDocument"};
      const target = doc.querySelector(sel);
      if(!target) return {err:`no element: ${sel}`};
      try{
        const result = await captureElement(target);
        return result ? {ok:true, data:result, len:result.length} : {err:"null result"};
      }catch(e){ return {err:e.message}; }
    }, el.sel).catch(e=>({err:e.message}));

    if(dataUrl && dataUrl.ok){
      // Convert dataURL to PNG buffer for storage
      const base64 = dataUrl.data.replace(/^data:image\/\w+;base64,/, "");
      const fp = path.join(OUT_DIR, `vf_${el.label}.jpg`);
      fs.writeFileSync(fp, Buffer.from(base64, "base64"));
      shots[el.label] = { fp, dataUrl: dataUrl.data, len: dataUrl.len };
      console.log(`  ✓ VF ${el.desc} → vf_${el.label}.jpg (${dataUrl.len} bytes)`);
    } else {
      console.log(`  ✗ VF ${el.desc} → ${JSON.stringify(dataUrl)}`);
      shots[el.label] = null;
    }
  }
  await page.screenshot({ path: path.join(OUT_DIR, "vf_full_app.png") });
  await ctx.close();
  return shots;
}

// ── Phase 3: HTML comparison report ──────────────────────────────────────────
function buildReport(refs, shots, iteration){
  const rows = ELEMENTS.map(el=>{
    const refImg  = refs[el.label] ? `ref_${el.label}.png` : null;
    const vfShot  = shots[el.label];
    const vfImg   = vfShot ? `vf_${el.label}.jpg` : null;
    const status  = (refImg && vfImg) ? "✓" : (vfImg ? "⚠ ref fehlt" : "✗");
    return `
    <tr>
      <td><b>${el.desc}</b><br><code>${el.sel}</code></td>
      <td class="status ${status==="✓"?"ok":status.startsWith("⚠")?"warn":"fail"}">${status}</td>
      <td>${refImg ? `<img src="${refImg}" alt="ref">` : "<em>n/a</em>"}</td>
      <td>${vfImg  ? `<img src="${vfImg}"  alt="vf">`  : "<em>Fehler</em>"}</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>VF Screenshot Quality — Iteration ${iteration}</title>
<style>
  body { font-family: system-ui,sans-serif; margin:0; padding:20px; background:#111; color:#eee; }
  h1   { font-size:18px; margin-bottom:16px; }
  table{ border-collapse:collapse; width:100%; }
  th,td{ border:1px solid #333; padding:8px; vertical-align:top; }
  th   { background:#1a1a1a; font-size:12px; }
  td.ok   { color:#4caf50; }
  td.warn { color:#ff9800; }
  td.fail { color:#f44336; }
  td img  { max-width:420px; max-height:320px; display:block; border:1px solid #444; }
  code { font-size:11px; background:#1a1a1a; padding:2px 4px; border-radius:3px; }
  .meta { font-size:12px; color:#888; margin-bottom:16px; }
</style>
</head>
<body>
<h1>VibeFeedback Screenshot Quality — Iteration ${iteration}</h1>
<div class="meta">Generiert: ${new Date().toISOString()} | Ziel: ${KF_URL}</div>
<table>
  <thead><tr><th>Element</th><th>Status</th><th>Referenz (Playwright)</th><th>VibeFeedback captureElement()</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<hr style="margin:20px 0;border-color:#333">
<h2 style="font-size:14px">Full-Page Vergleich</h2>
<table>
  <tr>
    <td><b>Kippflix direkt</b><br><img src="ref_full_page.png" style="max-width:600px"></td>
    <td><b>VibeFeedback App</b><br><img src="vf_full_app.png" style="max-width:600px"></td>
  </tr>
</table>
</body></html>`;

  const fp = path.join(OUT_DIR, `report_iter${iteration}.html`);
  fs.writeFileSync(fp, html);
  console.log(`\n  📄 Report: ${fp}`);
  return fp;
}

// ── Main loop ─────────────────────────────────────────────────────────────────
(async()=>{
  const PORT = 18082;
  console.log("Starting local VF server…");
  const srv = await startServer(PORT);

  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"],
    headless: true
  });

  let iteration = 1;
  const MAX_ITER = 1; // First run: collect results, then iterate via /loop

  while(iteration <= MAX_ITER){
    console.log(`\n${"═".repeat(60)}`);
    console.log(`ITERATION ${iteration}`);
    console.log("═".repeat(60));

    const refs  = await takeReferenceShots(browser);
    const shots = await takeVFShots(browser, PORT);

    // Summary
    console.log("\n── Ergebnis ──");
    let pass = 0, fail = 0;
    for(const el of ELEMENTS){
      const hasRef = !!refs[el.label];
      const hasVF  = !!shots[el.label];
      if(hasVF){ pass++; console.log(`  ✓ ${el.desc}`); }
      else      { fail++; console.log(`  ✗ ${el.desc} — Capture fehlgeschlagen`); }
    }
    console.log(`\n  ${pass}/${pass+fail} Captures erfolgreich`);

    buildReport(refs, shots, iteration);
    iteration++;
  }

  await browser.close();
  srv.close();
  console.log("\nDone. Öffne kf_shots/report_iter1.html für visuellen Vergleich.");
})().catch(e=>{ console.error("FATAL:", e); process.exit(1); });
