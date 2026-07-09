// Fund #4: Badge-Nummer muss der Sidebar-Nummer entsprechen (Multi-Page)
const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const VF = __dirname;
const ok=[],bad=[]; const check=(c,l,e)=>{(c?ok:bad).push(l);console.log(`  ${c?"✓":"✗"} ${l}${e&&!c?" — "+e:""}`);};

const srv = http.createServer((req,res)=>{ let fp=req.url.split("?")[0];
  fp = fp === "/modern-screenshot.js" ? path.join(VF,"node_modules/modern-screenshot/dist/index.js") : path.join(VF,fp);
  if(fp.endsWith("/")) fp += "index.html";
  try{ const b=fs.readFileSync(fp);
    const mime={".html":"text/html",".js":"application/javascript",".css":"text/css"}[path.extname(fp)]||"text/plain";
    res.writeHead(200,{"Content-Type":mime,"Access-Control-Allow-Origin":"*"}); res.end(b);
  }catch(e){res.writeHead(404);res.end();}});

srv.listen(18092,"127.0.0.1", async ()=>{
  const P=18092;
  const browser = await chromium.launch({executablePath:"/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome",args:["--no-sandbox","--disable-dev-shm-usage"],headless:true});
  const page = await (await browser.newContext({viewport:{width:1360,height:900}})).newPage();
  page.on("pageerror",e=>{console.log("ERR:",e.message.slice(0,120)); bad.push("pageerror");});
  await page.addInitScript(`window.__VF_MS_OVERRIDE="http://127.0.0.1:${P}/modern-screenshot.js";`);
  await page.goto(`http://127.0.0.1:${P}/index.html?src=${encodeURIComponent(`http://127.0.0.1:${P}/demo.html`)}&__vftest=1`,{waitUntil:"networkidle"});
  await page.waitForTimeout(2000);
  await page.locator(".coach button").click().catch(()=>{});

  const comment = async (sel) => {
    await page.evaluate(s=>{const d=document.querySelector("#frame").contentDocument;
      d.querySelector(s).dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:d.defaultView}));},sel);
    await page.waitForTimeout(2200);
    await page.locator(".cbar textarea[data-role='text']").fill("K "+sel);
    page.once("dialog",d=>d.accept("T"));
    await page.locator(".cbar [data-act='save']").click();
    await page.waitForTimeout(1500);
  };

  // 2 Kommentare auf der Landing
  await comment(".hero h1");
  await comment(".hero-sub");

  // Zu Unterseite navigieren, dort 1 Kommentar
  await page.locator('[data-mode="nav"]').click();
  await page.frameLocator("#frame").locator('.nav-links a[href="demo-preise.html"]').first().click();
  await page.waitForTimeout(2000);
  await page.locator('[data-mode="comment"]').click();
  await comment(".section-title");

  const res = await page.evaluate(()=>{
    const doc = document.querySelector("#frame").contentDocument;
    const badges = [...doc.querySelectorAll(".__vf_badge")].map(b=>b.textContent.trim().replace(/^\S+\s*/,""));
    const sidebarNums = [...document.querySelectorAll(".sidebar .item .num")].map(n=>n.textContent.trim());
    const total = STATE.comments.length;
    return { badges, sidebarNums, total, cur: STATE.currentUrl };
  });
  console.log("  Badges auf Unterseite:", res.badges, "| Sidebar:", res.sidebarNums, "| gesamt:", res.total);
  check(res.total === 3, `3 Kommentare gesamt (${res.total})`);
  check(res.badges.length === 1, `1 Badge auf der Unterseite (${res.badges.length})`);
  check(res.badges[0] === "3", `Badge zeigt Sidebar-Nummer 3, nicht 1 (ist: ${res.badges[0]})`);
  check(res.sidebarNums.includes("3"), "Sidebar hat Nummer 3");

  console.log(`\n${ok.length}/${ok.length+bad.length} bestanden`);
  await browser.close(); srv.close();
  process.exit(bad.length?1:0);
});
