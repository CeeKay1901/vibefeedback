/**
 * Screenshot capture test — VibeFeedback
 * Verifies: Canvas 2D capture works, toDataURL succeeds, result stored in STATE
 */
const { chromium } = require("/data/data/com.termux/files/home/vibefeedback/node_modules/playwright");
const http = require("http");
const fs   = require("fs");
const path = require("path");

const VF_DIR = "/data/data/com.termux/files/home/vibefeedback";

const H2C_LOCAL = path.join(VF_DIR, "node_modules/html2canvas/dist/html2canvas.min.js");
const MS_LOCAL  = path.join(VF_DIR, "node_modules/modern-screenshot/dist/index.js");

function startServer(dir, port){
  return new Promise(resolve=>{
    const srv = http.createServer((req, res)=>{
      const urlPath = req.url.split("?")[0];
      // Serve capture libs from node_modules for test environment
      let fp = urlPath === "/html2canvas.min.js" ? H2C_LOCAL
             : urlPath === "/modern-screenshot.js" ? MS_LOCAL
             : path.join(dir, urlPath);
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

(async()=>{
  const PORT   = 18081;
  const vfUrl  = `http://127.0.0.1:${PORT}/index.html`;
  const tgtUrl = `http://127.0.0.1:${PORT}/test_screenshot.html`;
  const appUrl = `${vfUrl}?src=${encodeURIComponent(tgtUrl)}`;

  console.log("Starting server…");
  const srv = await startServer(VF_DIR, PORT);

  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"],
    headless: true
  });
  const ctx  = await browser.newContext({ viewport:{width:1280,height:800} });
  const page = await ctx.newPage();

  // Override CDN URLs so capture libs load from local test server
  await page.addInitScript(`
    window.__VF_H2C_OVERRIDE = "http://127.0.0.1:${PORT}/html2canvas.min.js";
    window.__VF_MS_OVERRIDE  = "http://127.0.0.1:${PORT}/modern-screenshot.js";
  `);

  const logs = [];
  page.on("console", msg=>{ const t=msg.text(); logs.push({type:msg.type(),t}); if(t.includes("[vf]")) console.log("  LOG:", t); });
  page.on("pageerror", e=>console.error("  PAGE ERR:", e.message));

  const ok=[], fail=[];
  const pass=(l,d="")=>{ ok.push(l);   console.log(`  ✓ ${l}${d?" — "+d:""}`); };
  const bad =(l,d="")=>{ fail.push(l); console.log(`  ✗ ${l}${d?" — "+d:""}`); };

  // ── 1. Load app ──────────────────────────────────────────────────────────
  console.log("\n[1] App laden…");
  await page.goto(appUrl, {waitUntil:"networkidle"});
  await sleep(2500);
  (await page.locator("#frame").isVisible()) ? pass("App geladen + iframe sichtbar") : bad("iframe nicht sichtbar");

  // Coach-Overlay schließen, damit Ground-Truth-Screenshots freie Sicht aufs iframe haben
  await page.locator(".coach button").click().catch(()=>{});
  await sleep(400);

  // ── 2. captureElement function exists and has no fobSupported ────────────
  console.log("\n[2] API-Check…");
  const apiCheck = await page.evaluate(()=>({
    hasCaptureEl: typeof captureElement === "function",
    hasFobSupported: typeof fobSupported !== "undefined",
    hasSTATE: typeof STATE === "object"
  })).catch(e=>({ err: e.message }));
  apiCheck.hasCaptureEl ? pass("captureElement() vorhanden") : bad("captureElement() fehlt", JSON.stringify(apiCheck));
  !apiCheck.hasFobSupported ? pass("fobSupported entfernt (korrekt)") : bad("fobSupported existiert noch — sollte weg sein");

  // ── 3. Direct unit test: captureElement on a real element ─────────────────
  console.log("\n[3] Unit-Test: captureElement direkt aufrufen…");
  const captureResult = await page.evaluate(async ()=>{
    // Get an element from the iframe
    const frameEl = document.querySelector("#frame");
    if(!frameEl) return {err:"no frame"};
    let doc;
    try{ doc = frameEl.contentDocument; }catch(e){ return {err:"contentDocument: "+e.message}; }
    if(!doc) return {err:"contentDocument null"};
    const target = doc.querySelector(".card") || doc.querySelector("div") || doc.body;
    if(!target) return {err:"no target element"};
    try{
      const result = await captureElement(target);
      return {
        isNull: result === null,
        type: typeof result,
        length: result ? result.length : 0,
        prefix: result ? result.slice(0,30) : null,
        dataUrl: result
      };
    }catch(e){ return {err: e.message}; }
  }).catch(e=>({err:"evaluate: "+e.message}));

  if(captureResult.err){ bad("captureElement() warf Fehler", captureResult.err); }
  else if(captureResult.isNull){ bad("captureElement() gab null zurück"); }
  else if(captureResult.length < 500){ bad("captureElement() lieferte zu kurzes Ergebnis", `${captureResult.length} bytes`); }
  else { pass("captureElement() erfolgreich", `${captureResult.length} bytes, prefix: ${captureResult.prefix}`); }

  // Fidelity-Artefakte: Capture vs. Ground-Truth (Playwright-Screenshot desselben Elements)
  const saveDataUrl = (dataUrl, name)=>{
    if(!dataUrl) return;
    const b64 = dataUrl.split(",")[1];
    fs.writeFileSync(path.join(VF_DIR, name), Buffer.from(b64, "base64"));
  };
  saveDataUrl(captureResult.dataUrl, "fidelity_capture_card.jpg");
  await page.frameLocator("#frame").locator("#card-simple").screenshot({path: path.join(VF_DIR, "fidelity_truth_card.png")}).catch(e=>console.warn("  truth shot:", e.message));
  await page.frameLocator("#frame").locator("#card-with-img").screenshot({path: path.join(VF_DIR, "fidelity_truth_img.png")}).catch(e=>console.warn("  truth shot:", e.message));
  const imgCapture = await page.evaluate(async ()=>{
    const doc = document.querySelector("#frame")?.contentDocument;
    const t = doc?.querySelector("#card-with-img");
    if(!t) return null;
    return captureElement(t).catch(()=>null);
  });
  saveDataUrl(imgCapture, "fidelity_capture_img.jpg");
  imgCapture && imgCapture.length > 500 ? pass("img-Karte captured", `${imgCapture.length} bytes`) : bad("img-Karte capture fehlgeschlagen");

  // ── 4. Test with element that has external background-image ───────────────
  console.log("\n[4] Element mit externem bg-image testen…");
  const bgCapture = await page.evaluate(async ()=>{
    const frameEl = document.querySelector("#frame");
    const doc = frameEl?.contentDocument;
    const target = doc?.querySelector("#ext-bg-div") || doc?.querySelector(".external-bg");
    if(!target) return {err:"ext-bg-div nicht gefunden"};
    try{
      const result = await captureElement(target);
      return { isNull: result===null, length: result?.length||0, prefix: result?.slice(0,30)||null, dataUrl: result };
    }catch(e){ return {err:e.message}; }
  }).catch(e=>({err:"evaluate: "+e.message}));

  saveDataUrl(bgCapture.dataUrl, "fidelity_capture_extbg.jpg");
  await page.frameLocator("#frame").locator("#ext-bg-div").screenshot({path: path.join(VF_DIR, "fidelity_truth_extbg.png")}).catch(()=>{});
  if(bgCapture.err){ bad("bg-image capture: " + bgCapture.err); }
  else if(bgCapture.isNull){ bad("bg-image capture gab null zurück"); }
  else if(bgCapture.length < 500){ bad("bg-image capture zu kurz", `${bgCapture.length} bytes`); }
  else { pass("bg-image Element: capture success (kein SecurityError!)", `${bgCapture.length} bytes`); }

  // ── 5. No SecurityError in any log ───────────────────────────────────────
  console.log("\n[5] Fehler-Log prüfen…");
  const secErr = logs.find(l=>l.t.includes("SecurityError")||l.t.includes("tainted"));
  !secErr ? pass("Kein SecurityError / tainted-canvas in Logs") : bad("SecurityError in Logs", secErr.t.slice(0,120));

  const captureSuccess = logs.find(l=>l.t.includes("capture success"));
  captureSuccess ? pass("'capture success' in Console-Logs", captureSuccess.t) : bad("'capture success' NICHT in Logs — captureElement lief nie?");

  // ── 6. Full UI flow: click element → cbar → screenshot button ─────────────
  console.log("\n[6] UI-Flow: iframe-Klick → cbar → 📷…");
  // Inject a click directly on a frame element via evaluate to bypass Playwright frame routing
  const clicked = await page.evaluate(()=>{
    const frameEl = document.querySelector("#frame");
    const doc = frameEl?.contentDocument;
    const target = doc?.querySelector("#card-simple") || doc?.querySelector(".card");
    if(!target) return false;
    target.dispatchEvent(new MouseEvent("click", {bubbles:true, cancelable:true, view:doc.defaultView}));
    return true;
  }).catch(()=>false);
  clicked ? pass("Click-Event in iframe dispatched") : bad("Konnte kein Click-Event dispatchen");
  await sleep(1200);

  const cbarVis = await page.locator(".cbar").isVisible().catch(()=>false);
  cbarVis ? pass("Compact-Bar geöffnet") : bad("Compact-Bar NICHT geöffnet");

  if(cbarVis){
    // Click screenshot button
    const shotBtn = page.locator(".cbar [data-act='screenshot']");
    const shotVis = await shotBtn.isVisible().catch(()=>false);
    if(!shotVis){ bad("Screenshot-Button nicht sichtbar"); }
    else{
      await shotBtn.click();
      pass("📷 Button geklickt");
      await sleep(3000);

      // Check logs for capture result
      const capLog = logs.find(l=>l.t.includes("capture success"));
      capLog ? pass("Capture in Logs bestätigt", capLog.t.match(/length: \d+/)?.[0]||"") : bad("'capture success' nach Button-Klick nicht in Logs");

      // Check DOM: annotator canvas or thumb
      const annotCanv = page.locator(".cbar .annot .stage canvas");
      const thumb     = page.locator(".cbar-thumb:not([hidden])");
      const inUI = (await annotCanv.isVisible().catch(()=>false)) || (await thumb.isVisible().catch(()=>false));
      inUI ? pass("Screenshot sichtbar im UI (canvas oder thumb)") : bad("Screenshot NICHT sichtbar in UI");
    }

    // Save and check STATE — use evaluate to fill + save programmatically
    const stateCheck = await page.evaluate(async ()=>{
      const ta = document.querySelector(".cbar textarea[data-role='text']");
      if(ta){ ta.value = "Playwright-Test"; ta.dispatchEvent(new Event("input")); }
      const saveBtn = document.querySelector(".cbar [data-act='save']");
      if(!saveBtn) return {err:"no save btn"};
      saveBtn.click();
      await new Promise(r=>setTimeout(r,1200));
      const c = STATE?.comments?.[0];
      return c ? {has:!!c.screenshot, len:c.screenshot?.length||0} : {err:"STATE.comments empty", len: STATE?.comments?.length};
    }).catch(e=>({err:e.message}));
    if(stateCheck?.has && stateCheck.len > 500)
      pass("Screenshot in STATE.comments[0] gespeichert", `${stateCheck.len} bytes`);
    else
      bad("Kein Screenshot in STATE.comments", JSON.stringify(stateCheck));
  }

  // ── 7. Reale-Welt-Typografie: enge line-height darf nichts abschneiden ────
  // Auf echten Seiten (Headlines mit line-height 0.95–1.1, Webfonts) wurde die
  // letzte Zeile bzw. die Unterlängen abgeschnitten, weil die Canvas-Höhe blind
  // der Element-Rect-Höhe folgte. Assertion: das Bild deckt die volle
  // Inhaltshöhe (scrollHeight) ab UND unten im Bild liegt Glyphen-Tinte.
  console.log("\n[7] Enge line-height (Clipping-Regression)…");
  for(const sel of ["#tight-lh-web", "#tight-lh-sys"]){
    const r = await page.evaluate(async sel=>{
      const doc = document.querySelector("#frame").contentDocument;
      const el  = doc.querySelector(sel);
      if(!el) return { err: "Element fehlt" };
      try{ await Promise.race([doc.fonts.ready, new Promise(res=>setTimeout(res, 4000))]); }catch(e){}
      const rect = el.getBoundingClientRect();
      const contentH = Math.max(rect.height, el.scrollHeight);
      const dataUrl = await captureElement(el);
      if(!dataUrl) return { err: "kein Capture" };
      const img = new Image();
      await new Promise((res, rej)=>{ img.onload=res; img.onerror=()=>rej(new Error("img")); img.src=dataUrl; });
      const cv = document.createElement("canvas");
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const g = cv.getContext("2d");
      g.drawImage(img, 0, 0);
      const ink = (y0, y1)=>{
        const d = g.getImageData(0, Math.floor(cv.height*y0), cv.width, Math.max(1, Math.floor(cv.height*(y1-y0)))).data;
        let n = 0;
        for(let i=0;i<d.length;i+=16){ const lum = d[i]*.3+d[i+1]*.6+d[i+2]*.1; if(lum<120) n++; }
        return n;
      };
      return {
        rectW: Math.round(rect.width), rectH: Math.round(rect.height), contentH: Math.round(contentH),
        imgW: img.naturalWidth, imgH: img.naturalHeight,
        aspectImg: img.naturalHeight / img.naturalWidth,
        aspectContent: contentH / rect.width,
        inkMid: ink(.40, .60), inkBottom: ink(.87, 1)
      };
    }, sel).catch(e=>({ err: e.message }));
    if(r.err){ bad(`${sel}: ${r.err}`); continue; }
    const aspectOk = r.aspectImg >= r.aspectContent * 0.97;
    aspectOk
      ? pass(`${sel}: Bild deckt volle Inhaltshöhe`, `img ${r.imgW}×${r.imgH}, Inhalt ${r.rectW}×${r.contentH}`)
      : bad(`${sel}: Bild zu flach → Clipping`, `img-Aspekt ${r.aspectImg.toFixed(3)} < Inhalt ${r.aspectContent.toFixed(3)} (img ${r.imgW}×${r.imgH}, Inhalt ${r.rectW}×${r.contentH})`);
    (r.inkBottom > Math.max(8, r.inkMid * 0.15))
      ? pass(`${sel}: letzte Zeile/Unterlängen im Bild`, `ink bottom=${r.inkBottom} mid=${r.inkMid}`)
      : bad(`${sel}: unten keine Glyphen — abgeschnitten`, `ink bottom=${r.inkBottom} mid=${r.inkMid}`);
  }

  // ── Screenshot of final state ─────────────────────────────────────────────
  await page.screenshot({path: path.join(VF_DIR, "test_screenshot_result.png")});

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n── ERGEBNIS ──────────────────────────────────────────────");
  ok.forEach(l=>console.log(`  ✓ ${l}`));
  fail.forEach(l=>console.log(`  ✗ ${l}`));
  console.log(`\n  ${ok.length}/${ok.length+fail.length} bestanden`);
  if(fail.length){
    console.log("\n  Alle [vf]-Logs:");
    logs.filter(l=>l.t.includes("[vf]")||l.t.includes("Error")).forEach(l=>console.log("    "+l.t));
  }

  await browser.close();
  srv.close();
  process.exit(fail.length > 0 ? 1 : 0);
})();
