// Phase-4-Verifikation: O1 (letzte Kategorie/Prio merken), O2 (Entwurf-Guard isDirty),
// E1 (Klick auf bereits kommentiertes Element zeigt Bestehendes statt neuem Modal).
// Aufruf: node test_phase4.js
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const VF = __dirname;
const PORT = 18144;
const demoSrc = `http://127.0.0.1:${PORT}/demo.html`;

function startServer(port){ return new Promise(res=>{ const s=http.createServer((req,rs)=>{ let fp=req.url.split("?")[0]; fp = fp==="/modern-screenshot.js"?path.join(VF,"node_modules/modern-screenshot/dist/index.js"):path.join(VF,fp); if(fp.endsWith("/"))fp+="index.html"; try{ const b=fs.readFileSync(fp); const m={".html":"text/html",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml"}[path.extname(fp)]||"text/plain"; rs.writeHead(200,{"Content-Type":m,"Access-Control-Allow-Origin":"*"}); rs.end(b);}catch(e){rs.writeHead(404);rs.end();}}); s.listen(port,"127.0.0.1",()=>res(s)); }); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,t,step=300){const t0=Date.now();while(Date.now()-t0<t){const v=await fn();if(v)return v;await sleep(step);}return null;}
let pass=0, fail=0;
const ok=(c,m)=>{ console.log(`  ${c?"✓":"✗"} ${m}`); c?pass++:fail++; };

async function clickSel(page, sel){
  return page.evaluate(s=>{ const doc=document.querySelector("#frame").contentDocument; const el=doc.querySelector(s); if(!el)return false; el.scrollIntoView({block:"center"}); const r=el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:doc.defaultView,clientX:r.left+r.width/2,clientY:r.top+r.height/2})); return true; }, sel);
}
async function fillAndSave(page, cat, pri, text){
  // Kategorie/Priorität liegen jetzt im Expand → erst aufklappen
  await page.locator(`.cbar [data-act=toggle-expand]`).first().click();
  await page.locator(`.cbar-expanded [data-role=cats] .pick[data-cat="${cat}"]`).click();
  await page.locator(`.cbar-expanded [data-role=prios] .pick[data-p="${pri}"]`).click();
  await page.evaluate(t=>{ const ta=document.querySelector(".cbar [data-role=text]"); ta.value=t; ta.dispatchEvent(new Event("input",{bubbles:true})); }, text);
  await waitFor(()=>page.evaluate(()=>!!(document.querySelector(".cbar-thumb:not([hidden])")||document.querySelector(".cbar .annot .stage canvas"))).catch(()=>false),15000,600);
  const before=await page.evaluate(()=>STATE.comments.length);
  await page.locator(".cbar [data-act=save]").click();
  await waitFor(()=>page.evaluate(n=>STATE.comments.length>n,before),8000,300);
}

(async()=>{
  const srv=await startServer(PORT);
  const browser=await chromium.launch({executablePath:"/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",args:["--no-sandbox","--disable-dev-shm-usage"],headless:true});
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(`window.__VF_MS_OVERRIDE="http://127.0.0.1:${PORT}/modern-screenshot.js";`);
  await ctx.addInitScript(()=>localStorage.setItem("vibefeedback:v2:author","Tester"));
  const page=await ctx.newPage();
  page.on("pageerror",e=>console.log("  PAGEERR:",e.message.slice(0,140)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(demoSrc)}&owner=1&__vftest=1`,{waitUntil:"domcontentloaded"});
  await page.locator(".coach button").click({timeout:3000}).catch(()=>{});
  await waitFor(()=>page.evaluate(()=>(document.querySelector("#frame")?.contentDocument?.body?.innerText?.trim().length||0)>40).catch(()=>false),20000);

  // pick two distinct stable elements in demo.html
  const els = await page.evaluate(()=>{ const doc=document.querySelector("#frame").contentDocument; const cand=[...doc.querySelectorAll("h1,h2,h3,button,a,p")].filter(e=>e.getBoundingClientRect().width>30); return cand.slice(0,3).map(e=>{ // build a simple unique-ish selector
    return e.id?`#${e.id}`:e.tagName.toLowerCase()+(e.className&&typeof e.className==="string"?"."+e.className.trim().split(/\s+/)[0]:""); }); });
  const selA = els[0], selB = els.find(s=>s!==els[0]) || els[1];
  console.log("Elemente:", selA, "|", selB);

  console.log("\n[O2] Entwurf-Guard isDirty()");
  await clickSel(page, selA);
  await waitFor(()=>page.locator(".cbar").isVisible().catch(()=>false),6000);
  ok(await page.evaluate(()=>window.__vf_active_cbar.isDirty()===false), "leer → isDirty false");
  await page.evaluate(()=>{ const ta=document.querySelector(".cbar [data-role=text]"); ta.value="etwas getippt"; ta.dispatchEvent(new Event("input",{bubbles:true})); });
  ok(await page.evaluate(()=>window.__vf_active_cbar.isDirty()===true), "mit Text → isDirty true");

  console.log("\n[O1] letzte Kategorie/Priorität merken");
  await fillAndSave(page, "bug", "must", "erster Bug");
  ok(await page.evaluate(()=>STATE.comments.length===1), "1 Kommentar gespeichert");
  ok(await page.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem("vibefeedback:v2:lastpick:"+STATE.src)).cat==="bug"; }catch(e){ return false; } }), "lastpick.cat = bug persistiert");
  // neue cbar auf anderem Element → Default sollte bug/must sein
  await clickSel(page, selB);
  await waitFor(()=>page.locator(".cbar").isVisible().catch(()=>false),6000);
  const active = await page.evaluate(()=>({ cat: document.querySelector('.cbar [data-role=cats] .pick[data-active="true"]')?.dataset.cat, pri: document.querySelector('.cbar [data-role=prios] .pick[data-active="true"]')?.dataset.p }));
  ok(active.cat==="bug", `neue cbar Default-Kategorie = bug (ist: ${active.cat})`);
  ok(active.pri==="must", `neue cbar Default-Priorität = must (ist: ${active.pri})`);
  await page.locator(".cbar [data-act=cancel]").click().catch(()=>{});

  console.log("\n[E1] Klick auf bereits kommentiertes Element");
  // selA hat bereits einen Kommentar → erneuter Klick soll KEINEN neuen Modal öffnen,
  // sondern actionToast zeigen; Kommentaranzahl unverändert.
  await sleep(300);
  const nBefore = await page.evaluate(()=>STATE.comments.length);
  await clickSel(page, selA);
  await sleep(600);
  const cbarOpen = await page.locator(".cbar").isVisible().catch(()=>false);
  ok(!cbarOpen, "kein neues Kommentar-Modal geöffnet");
  const toastTxt = await page.evaluate(()=>document.querySelector(".toast")?.textContent||"");
  ok(/schon\s+\d+\s+Kommentar/.test(toastTxt), `Hinweis-Toast sichtbar ("${toastTxt.slice(0,40)}")`);
  ok(await page.evaluate(n=>STATE.comments.length===n, nBefore), "Kommentaranzahl unverändert");
  // "Neuen hinzufügen" klicken → cbar öffnet
  await page.locator(".toast .toast-undo").click().catch(()=>{});
  ok(await waitFor(()=>page.locator(".cbar").isVisible().catch(()=>false),4000), "Aktion 'Neuen hinzufuegen' oeffnet die cbar");

  console.log(`\n${pass}/${pass+fail} bestanden`);
  await browser.close(); srv.close();
  process.exit(fail?1:0);
})();
