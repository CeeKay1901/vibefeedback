// Echte Mobile-Emulation (Touch/coarse pointer, 390px) — Diagnose der Mobile-UI.
const { chromium, devices } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const VF = __dirname;
const OUT = path.join(VF, "test_artifacts", "mobile");
const PORT = 18155;
const demoSrc = `http://127.0.0.1:${PORT}/demo.html`;
function startServer(port){ return new Promise(res=>{ const s=http.createServer((req,rs)=>{ let fp=req.url.split("?")[0]; fp = fp==="/modern-screenshot.js"?path.join(VF,"node_modules/modern-screenshot/dist/index.js"):path.join(VF,fp); if(fp.endsWith("/"))fp+="index.html"; try{ const b=fs.readFileSync(fp); const m={".html":"text/html",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml"}[path.extname(fp)]||"text/plain"; rs.writeHead(200,{"Content-Type":m,"Access-Control-Allow-Origin":"*"}); rs.end(b);}catch(e){rs.writeHead(404);rs.end();}}); s.listen(port,"127.0.0.1",()=>res(s)); }); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,t,step=300){const t0=Date.now();while(Date.now()-t0<t){const v=await fn();if(v)return v;await sleep(step);}return null;}
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=await startServer(PORT);
  const browser=await chromium.launch({executablePath:"/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",args:["--no-sandbox","--disable-dev-shm-usage"],headless:true});
  const iphone = devices["iPhone 13"];
  const ctx=await browser.newContext({ ...iphone });
  await ctx.addInitScript(`window.__VF_MS_OVERRIDE="http://127.0.0.1:${PORT}/modern-screenshot.js";`);
  await ctx.addInitScript(()=>localStorage.setItem("vibefeedback:v2:author","Chris"));
  const shot=async(p,n,full=false)=>{ await p.screenshot({path:path.join(OUT,n+".png"),fullPage:full}); console.log("  📸",n, `(vp ${p.viewportSize().width}x${p.viewportSize().height})`); };

  // Landing
  const lp=await ctx.newPage();
  await lp.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"networkidle"}); await sleep(500);
  await shot(lp,"m_landing_top",false);

  // Tool
  const tp=await ctx.newPage();
  await tp.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(demoSrc)}&owner=1&__vftest=1`,{waitUntil:"domcontentloaded"});
  await tp.locator(".coach button").click({timeout:3000}).catch(()=>{});
  await waitFor(()=>tp.evaluate(()=>(document.querySelector("#frame")?.contentDocument?.body?.innerText?.trim().length||0)>40).catch(()=>false),20000);
  await sleep(400);
  await shot(tp,"m_tool_loaded",false);
  // cbar öffnen
  await tp.evaluate(()=>{ const d=document.querySelector("#frame").contentDocument; const el=d.querySelector("button,.btn,h1,h2,a"); el.scrollIntoView({block:"center"}); const r=el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:d.defaultView,clientX:r.left+r.width/2,clientY:r.top+r.height/2})); }).catch(()=>{});
  await waitFor(()=>tp.locator(".cbar").isVisible().catch(()=>false),8000); await sleep(500);
  await shot(tp,"m_tool_cbar_compact",false);
  await tp.locator(".cbar [data-cat=bug]").click().catch(()=>{});
  await tp.locator(".cbar [data-act=toggle-expand]").click().catch(()=>{}); await sleep(600);
  await shot(tp,"m_tool_cbar_expanded",false);
  // messen: wie viel Höhe frisst die cbar + topbar?
  const metrics = await tp.evaluate(()=>{
    const vp = innerHeight;
    const cbar = document.querySelector(".cbar")?.getBoundingClientRect();
    const top = document.querySelector(".topbar")?.getBoundingClientRect();
    const chips = [...document.querySelectorAll(".cbar [data-role=cats] .pick")].map(c=>{ const r=c.getBoundingClientRect(); return Math.round(r.width)+"x"+Math.round(r.height); });
    return { vp, cbarH: cbar?Math.round(cbar.height):0, topH: top?Math.round(top.height):0, chip0: chips[0], nChips: chips.length };
  }).catch(()=>({}));
  console.log("  METRIK:", JSON.stringify(metrics));

  // Dashboard
  const dseed=await ctx.newPage();
  await dseed.goto(`http://127.0.0.1:${PORT}/index.html?src=${encodeURIComponent(demoSrc)}&owner=1&__vftest=1`,{waitUntil:"domcontentloaded"});
  await dseed.locator(".coach button").click({timeout:2000}).catch(()=>{});
  await waitFor(()=>dseed.evaluate(()=>(document.querySelector("#frame")?.contentDocument?.body?.innerText?.trim().length||0)>40).catch(()=>false),15000);
  // ein Kommentar über den Save-Flow
  await dseed.evaluate(()=>{ const d=document.querySelector("#frame").contentDocument; const el=d.querySelector("h1,h2,button"); const r=el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:d.defaultView,clientX:r.left+r.width/2,clientY:r.top+r.height/2})); }).catch(()=>{});
  await waitFor(()=>dseed.locator(".cbar").isVisible().catch(()=>false),6000);
  await dseed.evaluate(()=>{ const ta=document.querySelector(".cbar [data-role=text]"); ta.value="Mobiler Testkommentar"; ta.dispatchEvent(new Event("input",{bubbles:true})); }).catch(()=>{});
  await waitFor(()=>dseed.evaluate(()=>!!(document.querySelector(".cbar-thumb:not([hidden])")||document.querySelector(".cbar .annot .stage canvas"))).catch(()=>false),12000,600);
  await dseed.locator(".cbar [data-act=save]").click().catch(()=>{});
  await sleep(1500); await dseed.close();

  const dp=await ctx.newPage();
  await dp.goto(`http://127.0.0.1:${PORT}/dashboard.html`,{waitUntil:"networkidle"}); await sleep(700);
  await shot(dp,"m_dashboard_overview",true);
  const src = await dp.evaluate(()=>window.__vftest?.PROJECTS?.[0]?.src||null).catch(()=>null);
  if(src){ await dp.evaluate(s=>location.hash="#p="+encodeURIComponent(s),src); await sleep(800); await shot(dp,"m_dashboard_detail",true); }

  console.log("\nMobile-Shots:", OUT);
  await browser.close(); srv.close();
})();
