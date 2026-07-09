const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const PORT = 7801;
const DIR = '/data/data/com.termux/files/home/vibefeedback';
const OUT = DIR + '/verify_shots';
if(!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const srv = http.createServer((req,res)=>{
  const fp = DIR + decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html');
  try { res.writeHead(200,{'Content-Type':'text/html','Access-Control-Allow-Origin':'*'}); fs.createReadStream(fp).pipe(res); }
  catch { res.writeHead(404); res.end(); }
});

(async()=>{
  await new Promise(r=>srv.listen(PORT,'127.0.0.1',r));
  const BASE = `http://127.0.0.1:${PORT}/index.html`;
  const DEMO = `http://127.0.0.1:${PORT}/demo.html`;
  const APP  = `${BASE}?src=${encodeURIComponent(DEMO)}&owner=1`;
  const b = await chromium.launch({args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],headless:true});

  const ctxDark = await b.newContext({viewport:{width:1440,height:900},colorScheme:'dark'});
  const pd = await ctxDark.newPage();
  await pd.goto(BASE,{waitUntil:'networkidle',timeout:15000});
  await pd.waitForTimeout(500);
  await pd.screenshot({path:OUT+'/01_dark_mode.png'});
  const bgDark = await pd.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  console.log('Dark Mode BG:', bgDark);

  const ctx1 = await b.newContext({viewport:{width:1440,height:900}});
  const p1 = await ctx1.newPage();
  await p1.goto(BASE,{waitUntil:'networkidle',timeout:15000});
  await p1.evaluate(()=>window.scrollTo(0,2000));
  await p1.waitForTimeout(400);
  await p1.screenshot({path:OUT+'/02_back_to_top_visible.png'});
  const btnVisible = await p1.evaluate(()=>document.getElementById('back-to-top')?.classList.contains('visible'));
  console.log('Back-to-Top sichtbar:', btnVisible ? '✅' : '❌');

  const ss = {cookies:[],origins:[{origin:`http://127.0.0.1:${PORT}`,localStorage:[{name:'vibefeedback:coach:v2',value:'1'}]}]};
  const ctx2 = await b.newContext({viewport:{width:390,height:844},isMobile:true,storageState:ss});
  const p2 = await ctx2.newPage();
  await p2.goto(APP,{waitUntil:'networkidle',timeout:20000});
  await p2.waitForTimeout(1000);
  await p2.screenshot({path:OUT+'/03_mobile_touch_targets.png'});
  const small = await p2.evaluate(()=>Array.from(document.querySelectorAll('button,.precision-toggle')).filter(el=>el.offsetWidth>0&&el.offsetHeight<40).map(el=>({text:el.textContent.trim().slice(0,20),h:el.offsetHeight})));
  console.log('Buttons < 40px Mobile:', small.length, small.map(x=>x.text+'('+x.h+'px)').join(', ')||'keine');

  const ctxAD = await b.newContext({viewport:{width:1440,height:900},colorScheme:'dark',storageState:ss});
  const pad = await ctxAD.newPage();
  await pad.goto(APP,{waitUntil:'networkidle',timeout:20000});
  await pad.waitForTimeout(1000);
  await pad.screenshot({path:OUT+'/04_app_dark_mode.png'});
  console.log('App Dark Mode gespeichert');

  await b.close(); srv.close();
  console.log('Fertig. Shots in', OUT);
})().catch(e=>{console.error(e.message);process.exit(1);});
