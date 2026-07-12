const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..');
const OUT = DIR + '/superaudit_shots';
const PORT = 7799;

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
let shotIndex = 0;

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let fp = DIR + decodeURIComponent(req.url.split('?')[0]);
      if (fp.endsWith('/')) fp += 'index.html';
      try {
        const mime = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml' }[path.extname(fp)] || 'text/plain';
        res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' });
        fs.createReadStream(fp).pipe(res);
      } catch { res.writeHead(404); res.end(); }
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

const BASE = `http://127.0.0.1:${PORT}/index.html`;
const DEMO = `http://127.0.0.1:${PORT}/demos/demo.html`;
const APP  = `${BASE}?src=${encodeURIComponent(DEMO)}`;
const APP_OWNER = `${APP}&owner=1`;

async function s(page, label) {
  const n = String(++shotIndex).padStart(2,'0');
  await page.screenshot({ path: `${OUT}/${n}_${label}.png`, fullPage: false });
  process.stdout.write(`  📸 ${n}_${label}.png\n`);
}

async function sf(page, label) {
  const n = String(++shotIndex).padStart(2,'0');
  await page.screenshot({ path: `${OUT}/${n}_${label}.png`, fullPage: true });
  process.stdout.write(`  📸 ${n}_${label}.png (full)\n`);
}

// measure contrast ratio between two rgb colors
function contrastRatio(fg, bg) {
  const lum = ([r,g,b]) => {
    const ch = v => { v/=255; return v<=0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4; };
    return 0.2126*ch(r)+0.7152*ch(g)+0.0722*ch(b);
  };
  const parse = s => s.match(/\d+/g).map(Number);
  const L1 = lum(parse(fg)), L2 = lum(parse(bg));
  return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
}

async function run() {
  console.log('\n🔍 SUPERAUDIT VibeFeedback\n');
  const srv = await serve();
  const findings = [];
  const note = (sev, area, msg) => { findings.push({sev,area,msg}); console.log(`  [${sev}] ${area}: ${msg}`); };

  const launch = () => chromium.launch({ args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'], headless:true });

  // ── BLOCK 1: LANDING ────────────────────────────────────────────────────
  console.log('\n━━ [1] Landing Page ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  {
    const browser = await launch();
    const ctx1440 = await browser.newContext({ viewport:{width:1440,height:900} });
    const ctx390  = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, deviceScaleFactor:3 });
    const ctx768  = await browser.newContext({ viewport:{width:768,height:1024} });
    const ctxDark = await browser.newContext({ viewport:{width:1440,height:900}, colorScheme:'dark' });

    const p = await ctx1440.newPage();
    await p.goto(BASE, { waitUntil:'networkidle', timeout:15000 });
    await p.waitForTimeout(600);
    await s(p, 'landing_desktop');
    await sf(p, 'landing_desktop_scroll');

    // Scroll-Bereiche
    await p.evaluate(() => window.scrollTo(0, 900));
    await p.waitForTimeout(300);
    await s(p, 'landing_section2');
    await p.evaluate(() => window.scrollTo(0, 1800));
    await p.waitForTimeout(300);
    await s(p, 'landing_section3_bookmarklet');
    await p.evaluate(() => window.scrollTo(0, 2700));
    await p.waitForTimeout(300);
    await s(p, 'landing_section4_setup');

    // Hover-Zustand des primären Buttons
    const btn = await p.$('button.primary');
    if (btn) { await btn.hover(); await p.waitForTimeout(200); await s(p, 'landing_btn_hover'); }

    // Mobile
    const pm = await ctx390.newPage();
    await pm.goto(BASE, { waitUntil:'networkidle', timeout:15000 });
    await pm.waitForTimeout(600);
    await s(pm, 'landing_mobile_390');
    await sf(pm, 'landing_mobile_full');

    // Tablet
    const pt = await ctx768.newPage();
    await pt.goto(BASE, { waitUntil:'networkidle', timeout:15000 });
    await pt.waitForTimeout(500);
    await s(pt, 'landing_tablet_768');

    // Dark mode test
    const pd = await ctxDark.newPage();
    await pd.goto(BASE, { waitUntil:'networkidle', timeout:15000 });
    await pd.waitForTimeout(500);
    await s(pd, 'landing_darkmode');
    const bgDark = await pd.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (bgDark === 'rgb(252, 252, 252)' || bgDark === 'rgb(246, 245, 239)') {
      note('WARN', 'DarkMode', `Body-Bg bleibt hell (${bgDark}) trotz prefers-color-scheme:dark — kein Dark-Mode implementiert`);
    }

    // Kontrast Landing-Elemente messen
    const landingContrast = await p.evaluate(() => {
      const results = [];
      [['h1','body'],['button.primary','button.primary'],['p','.landing']].forEach(([sel,bgSel]) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const cs = getComputedStyle(el);
        results.push({ sel, color:cs.color, bg:cs.backgroundColor, fontSize:cs.fontSize, fontWeight:cs.fontWeight });
      });
      return results;
    });
    landingContrast.forEach(({sel,color,bg,fontSize}) => {
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        try {
          const r = contrastRatio(color, bg);
          const fs = parseFloat(fontSize);
          const required = fs >= 18 ? 3 : 4.5;
          if (r < required) note('FAIL', 'Kontrast', `${sel}: ${r.toFixed(1)}:1 (benötigt ${required}:1, Schrift ${fontSize})`);
        } catch(e) {}
      }
    });

    // Performance Landing
    const perf = await p.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      return { dcl: Math.round(n?.domContentLoadedEventEnd-n?.startTime), load: Math.round(n?.loadEventEnd-n?.startTime), resources: performance.getEntriesByType('resource').length, htmlSize: document.documentElement.outerHTML.length };
    });
    console.log(`  → Perf: DCL=${perf.dcl}ms, Load=${perf.load}ms, ${perf.resources} Ressourcen, HTML=${Math.round(perf.htmlSize/1024)}KB`);
    if (perf.load > 3000) note('WARN','Perf',`Ladezeit ${perf.load}ms > 3s`);

    await browser.close();
  }

  // ── BLOCK 2: APP MODE (Desktop Owner) ───────────────────────────────────
  console.log('\n━━ [2] App-Modus (Desktop, Owner-View) ━━━━━━━━━━━━━━━━━━━━━');
  {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
    const p = await ctx.newPage();
    await p.goto(APP_OWNER, { waitUntil:'networkidle', timeout:20000 });
    await p.waitForTimeout(1500); // Coach-Overlay warten
    await s(p, 'app_initial_coach');

    // Coach-Overlay schließen
    const coachBtn = await p.$('#coach-ok, .coach button.primary, .coach button');
    if (coachBtn) { await coachBtn.click(); await p.waitForTimeout(400); }
    await s(p, 'app_after_coach');

    // App-Topbar & Sidebar messen
    const layout = await p.evaluate(() => {
      const topbar = document.querySelector('.topbar, [class*="topbar"]');
      const sidebar = document.querySelector('.sidebar, #sidebar, [class*="sidebar"]');
      const frame = document.querySelector('iframe, #frame');
      const app = document.querySelector('.app, #view-app');
      return {
        topbar: topbar ? { h: topbar.offsetHeight, visible: topbar.offsetWidth > 0 } : null,
        sidebar: sidebar ? { w: sidebar.offsetWidth, visible: sidebar.offsetWidth > 0 } : null,
        frame: frame ? { w: frame.offsetWidth, h: frame.offsetHeight } : null,
        appGrid: app ? { computed: getComputedStyle(app).gridTemplateColumns } : null
      };
    });
    console.log('  → Layout:', JSON.stringify(layout));
    if (layout.frame) {
      const ratio = layout.frame.w / layout.frame.h;
      if (ratio < 1 && layout.frame.w > 600) note('INFO','Layout',`iframe Verhältnis ${ratio.toFixed(2)} — sehr schmal`);
    }

    // Demo-Seite hat sich geladen?
    const frameLoaded = await p.evaluate(() => {
      const iframe = document.querySelector('iframe, #frame');
      if (!iframe) return false;
      try { return !!iframe.contentDocument?.body; } catch { return false; }
    });
    console.log(`  → iframe geladen: ${frameLoaded}`);
    if (!frameLoaded) note('WARN','iframe','iframe nicht zugänglich (CORS oder srcdoc-Fehler)');

    await s(p, 'app_desktop_full_state');

    // Sidebar-Zustand testen
    const sidebar = await p.$('.sidebar, #sidebar, [class*="sidebar"]');
    if (sidebar) {
      const sBox = await sidebar.boundingBox();
      console.log(`  → Sidebar BBox: ${JSON.stringify(sBox)}`);
    }

    // Mode-Buttons testen
    const modeBtn = await p.$('[data-mode="comment"], [onclick*="comment"], button[title*="komment" i]');
    if (modeBtn) {
      await modeBtn.click();
      await p.waitForTimeout(300);
      await s(p, 'app_comment_mode_active');
    }

    // Topbar-Toggle prüfen
    const toggles = await p.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="checkbox"], input[id*="tgl"]'));
      return inputs.map(el => ({ id:el.id, label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || null, ariaLabel: el.getAttribute('aria-label') }));
    });
    toggles.forEach(t => {
      if (!t.label && !t.ariaLabel) note('FAIL','A11y',`Toggle #${t.id} hat weder <label> noch aria-label`);
    });

    // Render-Toggle (mirror/direct)
    const renderToggle = await p.$('#tgl-render, [id*="render"]');
    if (renderToggle) {
      await renderToggle.click();
      await p.waitForTimeout(600);
      await s(p, 'app_direct_render_mode');
      await renderToggle.click(); // zurück
      await p.waitForTimeout(400);
    }

    // Precision-Toggle
    const precToggle = await p.$('#tgl-precision, [id*="precision"]');
    if (precToggle) {
      await precToggle.click({ force:true, timeout:3000 }).catch(()=>{});
      await p.waitForTimeout(300);
      await s(p, 'app_precision_mode');
      await precToggle.click({ force:true, timeout:3000 }).catch(()=>{});
      await p.waitForTimeout(200);
    }

    // Sidebar: leerer Zustand
    const emptySide = await p.$('#cmt-empty, .empty, [class*="empty"]');
    if (emptySide) {
      const visible = await emptySide.evaluate(el => !el.classList.contains('hidden'));
      if (visible) await s(p, 'app_sidebar_empty');
    }

    // Export-Button prüfen
    const exportBtn = await p.$('[data-act="export-md"], button[onclick*="export"], #btn-export');
    if (exportBtn) {
      await exportBtn.click();
      await p.waitForTimeout(300);
      await s(p, 'app_export_click');
    }

    // Filter chips prüfen
    const chips = await p.$$('.chip, [class*="chip"]');
    console.log(`  → Filter-Chips: ${chips.length}`);

    await browser.close();
  }

  // ── BLOCK 3: COMMENT-MODAL ──────────────────────────────────────────────
  console.log('\n━━ [3] Kommentar-Modal ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
    const p = await ctx.newPage();

    // Inject pre-existing comments + skip coach
    await p.goto(APP_OWNER, { waitUntil:'domcontentloaded', timeout:20000 });
    await p.evaluate(() => {
      localStorage.setItem('vibefeedback:coach:v2','1');
      localStorage.setItem(`vibefeedback:v2:http://127.0.0.1:7799/demos/demo.html`, JSON.stringify([
        { id:'aaa1', selector:'h1', snippet:'<h1>Demo</h1>', tag:'h1', info:{role:'h1',text:'Demo'}, pageUrl:'http://127.0.0.1:7799/demos/demo.html', text:'Überschrift zu groß auf Mobile', category:'design', priority:'should', ts:new Date().toISOString() },
        { id:'aaa2', selector:'button', snippet:'<button>Jetzt starten</button>', tag:'button', info:{role:'button',text:'Jetzt starten'}, pageUrl:'http://127.0.0.1:7799/demos/demo.html', text:'Button reagiert nicht auf Enter-Key', category:'bug', priority:'must', ts:new Date().toISOString() },
        { id:'aaa3', selector:'p', snippet:'<p>Demo</p>', tag:'p', info:{role:'p',text:'Demo'}, pageUrl:'http://127.0.0.1:7799/demos/demo.html', text:'Preis prominenter zeigen', category:'feature', priority:'could', ts:new Date().toISOString() },
      ]));
    });
    await p.reload({ waitUntil:'networkidle', timeout:20000 });
    await p.waitForTimeout(1200);
    await s(p, 'app_with_comments');

    // Filter-Chip klicken
    const bugChip = await p.$('.chip[data-f="bug"]');
    if (bugChip) { await bugChip.click(); await p.waitForTimeout(300); await s(p, 'app_filter_bug'); }
    const allChip = await p.$('.chip[data-f="all"]');
    if (allChip) { await allChip.click(); await p.waitForTimeout(200); }

    // Edit-Button
    const editBtn = await p.$('button.edit, [data-edit]');
    if (editBtn) {
      await editBtn.click();
      await p.waitForTimeout(400);
      await s(p, 'modal_edit_open');
      // Kategorie-Chips in Modal
      const catChips = await p.$$('[data-cat]');
      console.log(`  → Modal Kategorie-Chips: ${catChips.length}`);
      // Prio-Chips
      const prioChips = await p.$$('[data-p]');
      console.log(`  → Modal Prio-Chips: ${prioChips.length}`);
      // Bug-Kategorie wählen → Template sichtbar?
      const bugCat = await p.$('[data-cat="bug"]');
      if (bugCat) { await bugCat.click({ force:true, timeout:3000 }).catch(()=>{}); await p.waitForTimeout(200); await s(p, 'modal_bug_template'); }
      // Design-Kategorie
      const designCat = await p.$('[data-cat="design"]');
      if (designCat) { await designCat.click({ force:true, timeout:3000 }).catch(()=>{}); await p.waitForTimeout(200); await s(p, 'modal_design_template'); }
      // Escape schließt Modal?
      await p.keyboard.press('Escape');
      await p.waitForTimeout(300);
      await s(p, 'modal_after_escape');
    }

    // Kommentar-Item klicken → Fokus im iframe?
    const cmtItem = await p.$('.item, [class*="item"]');
    if (cmtItem) {
      await cmtItem.click({ force:true, timeout:3000 }).catch(()=>{});
      await p.waitForTimeout(500);
      await s(p, 'app_comment_focus');
    }

    // Löschen testen
    const delBtn = await p.$('button.del, [data-del]');
    if (delBtn) {
      await delBtn.click({ force:true, timeout:3000 }).catch(()=>{});
      await p.waitForTimeout(300);
      await s(p, 'app_after_delete');
    }

    await browser.close();
  }

  // ── BLOCK 4: MOBILE APP ─────────────────────────────────────────────────
  console.log('\n━━ [4] Mobile App-Modus ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, deviceScaleFactor:3, storageState: { cookies:[], origins:[{ origin:`http://127.0.0.1:${PORT}`, localStorage:[{ name:'vibefeedback:coach:v2', value:'1' }] }] } });
    const p = await ctx.newPage();
    await p.goto(APP_OWNER, { waitUntil:'networkidle', timeout:20000 });
    await p.waitForTimeout(1200);
    await s(p, 'app_mobile_390');

    // Mobile-Grid prüfen
    const mobileLayout = await p.evaluate(() => {
      const app = document.querySelector('.app, #view-app');
      if (!app) return null;
      const cs = getComputedStyle(app);
      return { gridRows: cs.gridTemplateRows, gridCols: cs.gridTemplateColumns, height: app.offsetHeight };
    });
    console.log('  → Mobile Layout:', mobileLayout);
    if (mobileLayout?.gridRows?.includes('minmax')) {
      console.log('  → Mobile nutzt dvh-basiertes Grid ✓');
    }

    // Topbar auf Mobile
    const topbar = await p.evaluate(() => {
      const t = document.querySelector('.topbar, [class*="topbar"]');
      if (!t) return null;
      const cs = getComputedStyle(t);
      return { h:t.offsetHeight, overflow:cs.overflow, wrap:cs.flexWrap };
    });
    console.log('  → Mobile Topbar:', topbar);
    if (topbar?.h > 80) note('WARN','Mobile','Topbar auf Mobile sehr hoch (>80px) — möglicherweise Overflow');

    // Sidebar auf Mobile sichtbar?
    const mobileSidebar = await p.evaluate(() => {
      const s = document.querySelector('.sidebar, #sidebar');
      if (!s) return null;
      return { visible:s.offsetHeight > 0, h:s.offsetHeight, overflow:getComputedStyle(s).overflow };
    });
    console.log('  → Mobile Sidebar:', mobileSidebar);
    if (mobileSidebar?.h < 100) note('WARN','Mobile','Sidebar auf Mobile sehr klein (<100px)');

    // Touch-Target sizes
    const touchTargets = await p.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      return btns.filter(el => el.offsetWidth > 0).map(el => ({
        text: el.textContent.trim().substring(0,30),
        w: el.offsetWidth, h: el.offsetHeight,
        tooSmall: el.offsetHeight < 44 || el.offsetWidth < 44
      })).filter(x => x.tooSmall);
    });
    if (touchTargets.length) {
      note('WARN','TouchTarget',`${touchTargets.length} Buttons < 44px: ${touchTargets.map(t=>t.text||'?').join(', ')}`);
    }
    console.log(`  → ${touchTargets.length} Touch-Targets unter 44px`);

    await sf(p, 'app_mobile_full');
    await browser.close();
  }

  // ── BLOCK 5: ERROR STATES ────────────────────────────────────────────────
  console.log('\n━━ [5] Fehlerzustände & Edge Cases ━━━━━━━━━━━━━━━━━━━━━━━━');
  {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport:{width:1440,height:900} });

    // CORS-Fehler: ungültige URL
    const p1 = await ctx.newPage();
    await p1.goto(`${BASE}?src=${encodeURIComponent('https://cors-blocked-example.invalid/')}`, { waitUntil:'domcontentloaded', timeout:10000 });
    await p1.waitForTimeout(4000);
    await s(p1, 'error_cors_blocked');

    // Fehlerbox vorhanden?
    const errBox = await p1.$('#errbox, [class*="error"], [class*="errbox"]');
    if (errBox) {
      const visible = await errBox.evaluate(el => !el.classList.contains('hidden') && el.offsetHeight > 0);
      if (visible) {
        await s(p1, 'error_box_visible');
        // Paste-Button → prompt() prüfen
        const pasteBtn = await p1.$('#btn-paste');
        if (pasteBtn) {
          // Öffnet der Button ein Modal mit Textarea oder ein window.prompt()?
          await pasteBtn.evaluate(el => el.click());   // Overlay fängt echte Klicks ab
          await p1.waitForTimeout(300);
          const hasTextarea = await p1.$('#paste-area');
          if (hasTextarea) console.log('  → Paste-Button öffnet Textarea-Modal ✓');
          else note('WARN','UX','#btn-paste nutzt window.prompt() — keine Textarea für großen HTML-Input');
          const cancel = await p1.$('#paste-cancel');
          if (cancel) await cancel.evaluate(el => el.click());
        }
      }
    }

    // localStorage voll simulieren
    const p2 = await ctx.newPage();
    await p2.goto(APP_OWNER, { waitUntil:'domcontentloaded', timeout:10000 });
    await p2.evaluate(() => localStorage.setItem('vibefeedback:coach:v2','1'));
    await p2.reload({ waitUntil:'networkidle', timeout:15000 });
    await p2.waitForTimeout(800);

    // Leerer Zustand
    const emptyState = await p2.$('#cmt-empty, .empty');
    if (emptyState) {
      const vis = await emptyState.evaluate(el => !el.classList.contains('hidden'));
      if (vis) await s(p2, 'state_empty_sidebar');
    }

    await browser.close();
  }

  // ── BLOCK 6: ACCESSIBILITY ──────────────────────────────────────────────
  console.log('\n━━ [6] Accessibility-Deep-Scan ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport:{width:1440,height:900} });

    // Landing A11y
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil:'networkidle', timeout:15000 });
    const a11yLanding = await p.evaluate(() => {
      const issues = [];
      // Images ohne alt
      document.querySelectorAll('img').forEach(img => {
        if (!img.getAttribute('alt') && img.getAttribute('alt') !== '') issues.push(`img ohne alt: ${img.src.substring(0,60)}`);
      });
      // Buttons ohne Label
      document.querySelectorAll('button').forEach(btn => {
        const label = btn.getAttribute('aria-label')||btn.getAttribute('title')||btn.textContent.trim();
        if (!label || label.length < 2) issues.push(`button ohne Label: "${btn.outerHTML.substring(0,60)}"`);
      });
      // Links ohne Label
      document.querySelectorAll('a').forEach(a => {
        const label = a.getAttribute('aria-label')||a.textContent.trim()||a.getAttribute('title');
        if (!label) issues.push(`a ohne Label: ${a.href}`);
      });
      // Inputs ohne Label
      document.querySelectorAll('input, textarea, select').forEach(el => {
        const id = el.id;
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const hasAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        if (!hasLabel && !hasAria) issues.push(`${el.tagName} #${id||'?'} ohne Label`);
      });
      // Heading-Hierarchie
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4')).map(h=>({tag:h.tagName,text:h.textContent.trim().substring(0,50)}));
      return { issues, headings, h1Count: document.querySelectorAll('h1').length };
    });
    console.log(`  → Landing A11y: ${a11yLanding.issues.length} Issues, ${a11yLanding.h1Count} H1(s)`);
    a11yLanding.issues.forEach(i => note('WARN','A11y-Landing',i));
    if (a11yLanding.h1Count !== 1) note('WARN','A11y','Landing hat ' + a11yLanding.h1Count + ' H1 (erwartet: 1)');
    console.log('  → Heading-Hierarchie:', a11yLanding.headings.map(h=>`${h.tag}: ${h.text}`).join(' → '));

    // App A11y
    const ctx2 = await browser.newContext({ storageState:{ cookies:[], origins:[{ origin:`http://127.0.0.1:${PORT}`, localStorage:[{name:'vibefeedback:coach:v2',value:'1'}] }] } });
    const p2 = await ctx2.newPage();
    await p2.goto(APP_OWNER, { waitUntil:'networkidle', timeout:20000 });
    await p2.waitForTimeout(1000);
    const a11yApp = await p2.evaluate(() => {
      const issues = [];
      document.querySelectorAll('button').forEach(btn => {
        const label = btn.getAttribute('aria-label')||btn.getAttribute('title')||btn.textContent.trim();
        if (!label || label.length < 2) issues.push(`button ohne Label: class="${btn.className.substring(0,40)}" text="${btn.textContent.trim().substring(0,20)}"`);
      });
      document.querySelectorAll('input').forEach(el => {
        const id = el.id;
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const hasAria = el.getAttribute('aria-label')||el.getAttribute('aria-labelledby');
        const hasTitle = el.getAttribute('title');
        if (!hasLabel && !hasAria && !hasTitle) issues.push(`input #${id||'?'} ohne Label/aria-label`);
      });
      // role=dialog in Modal?
      const modals = document.querySelectorAll('[role="dialog"]');
      // focus trap?
      return { issues, modalCount: modals.length };
    });
    console.log(`  → App A11y: ${a11yApp.issues.length} Issues`);
    a11yApp.issues.forEach(i => note('FAIL','A11y-App',i));

    // Keyboard navigation test: Tab durch die Landing-Seite
    const p3 = await ctx.newPage();
    await p3.goto(BASE, { waitUntil:'networkidle', timeout:15000 });
    await p3.keyboard.press('Tab');
    await p3.waitForTimeout(100);
    await p3.keyboard.press('Tab');
    await p3.waitForTimeout(100);
    await s(p3, 'a11y_keyboard_tab');
    const focusedEl = await p3.evaluate(() => {
      const el = document.activeElement;
      return { tag:el?.tagName, id:el?.id, text:el?.textContent?.trim().substring(0,40), outline:getComputedStyle(el||document.body).outline };
    });
    console.log('  → Fokussiertes Element nach 2x Tab:', focusedEl);
    if (focusedEl.outline === 'none' || focusedEl.outline.includes('0px')) {
      note('WARN','A11y','Fokus-Ring nicht sichtbar (outline:none)');
    }

    await browser.close();
  }

  // ── BLOCK 7: PRINT / REDUCED MOTION ──────────────────────────────────────
  console.log('\n━━ [7] Reduced Motion & Sonderzustände ━━━━━━━━━━━━━━━━━━━━');
  {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport:{width:1440,height:900}, reducedMotion:'reduce' });
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil:'networkidle', timeout:15000 });
    const hasMotionQuery = await p.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      return sheets.some(s => { try { return Array.from(s.cssRules).some(r => r.cssText?.includes('prefers-reduced-motion')); } catch { return false; } });
    });
    console.log(`  → prefers-reduced-motion CSS-Query vorhanden: ${hasMotionQuery}`);
    if (!hasMotionQuery) note('INFO','Motion','Kein @media (prefers-reduced-motion) — Animationen laufen immer');
    await browser.close();
  }

  // ── BLOCK 8: DETAILED METRICS ───────────────────────────────────────────
  console.log('\n━━ [8] Detaillierte Metriken ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  {
    const browser = await launch();
    const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil:'networkidle', timeout:15000 });
    const metrics = await p.evaluate(() => {
      const measure = sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return { w:Math.round(r.width), h:Math.round(r.height), fontSize:s.fontSize, lineHeight:s.lineHeight, fontWeight:s.fontWeight, color:s.color, bg:s.backgroundColor, borderRadius:s.borderRadius, padding:s.padding };
      };
      return {
        h1: measure('h1'), primaryBtn: measure('button.primary'), secondaryBtn: measure('button:not(.primary)'),
        urlInput: measure('input[type="url"], input'), nav: measure('nav, .nav, header'),
        bodyScrollH: document.body.scrollHeight, viewportH: window.innerHeight,
        totalImages: document.querySelectorAll('img').length,
        totalButtons: document.querySelectorAll('button').length,
        totalLinks: document.querySelectorAll('a[href]').length,
        customFonts: Array.from(document.fonts).filter(f=>f.status==='loaded').map(f=>f.family).filter((v,i,a)=>a.indexOf(v)===i)
      };
    });
    console.log('  → H1:', metrics.h1);
    console.log('  → Primary Button:', metrics.primaryBtn);
    console.log('  → URL Input:', metrics.urlInput);
    console.log('  → Seite:', metrics.bodyScrollH+'px hoch,', metrics.totalButtons,'Buttons,', metrics.totalLinks,'Links,', metrics.totalImages,'Imgs');
    console.log('  → Custom Fonts:', metrics.customFonts);

    if (metrics.primaryBtn?.h < 44) note('WARN','TouchTarget',`Primary Button ${metrics.primaryBtn.h}px hoch < 44px Minimum`);
    if (metrics.bodyScrollH > 4000) note('INFO','UX',`Seite ist ${metrics.bodyScrollH}px hoch — kein "zurück nach oben" Button`);

    fs.writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2));
    await browser.close();
  }

  // ── REPORT ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FINDINGS:');
  const fail = findings.filter(f=>f.sev==='FAIL');
  const warn = findings.filter(f=>f.sev==='WARN');
  const info = findings.filter(f=>f.sev==='INFO');
  console.log(`  🔴 FAIL: ${fail.length}  🟡 WARN: ${warn.length}  🔵 INFO: ${info.length}`);
  findings.forEach(f => console.log(`  [${f.sev}] ${f.area}: ${f.msg}`));

  fs.writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
  srv.close();
  console.log(`\n✅ Superaudit fertig. ${fs.readdirSync(OUT).filter(f=>f.endsWith('.png')).length} Screenshots in ${OUT}\n`);
}

run().catch(e => { console.error('FEHLER:', e.message.substring(0,300)); process.exit(1); });
