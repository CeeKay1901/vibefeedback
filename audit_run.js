// Vollständiger Playwright-Audit für vibefeedback
// Wird via proot-distro Ubuntu ausgeführt.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUT_DIR = path.join(__dirname, 'newaudit_shots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// Simple static server for index.html + demo.html
function startServer(port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404); res.end('not found'); return;
      }
      const ext = path.extname(filePath);
      const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json' }[ext] || 'text/plain';
      res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' });
      fs.createReadStream(filePath).pipe(res);
    });
    srv.listen(port, () => resolve(srv));
  });
}

const findings = [];
function log(sev, area, msg, extra) { findings.push({ sev, area, msg, ...(extra||{}) }); console.log(`[${sev}] ${area}: ${msg}`); }

async function main() {
  const port = 8087;
  const srv = await startServer(port);
  console.log(`server on http://localhost:${port}`);
  const baseUrl = `http://localhost:${port}/index.html`;
  const demoUrl = `http://localhost:${port}/demo.html`;

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  const consoleErrs = [];
  async function newPage(ctx) {
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleErrs.push({ type: m.type(), text: m.text().slice(0,300) }); });
    page.on('pageerror', e => consoleErrs.push({ type: 'pageerror', text: String(e).slice(0,300) }));
    return page;
  }

  // 1. Landing Desktop
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await newPage(ctx);
    const t0 = Date.now();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const loadMs = Date.now() - t0;
    log('INFO', 'Perf', `Landing Load Time (networkidle): ${loadMs}ms`);
    await page.screenshot({ path: path.join(OUT_DIR, '01_landing_desktop.png'), fullPage: false });
    await page.screenshot({ path: path.join(OUT_DIR, '02_landing_desktop_full.png'), fullPage: true });

    // Value Prop check
    const hero = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? { text: h1.textContent.trim().slice(0,200), size: parseFloat(getComputedStyle(h1).fontSize) } : null;
    });
    log('INFO', 'Design', `H1: "${hero?.text}" size=${hero?.size}px`);

    const typographyRatio = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const p = document.querySelector('main p, section p, .hero p');
      if (!h1 || !p) return null;
      const h1S = parseFloat(getComputedStyle(h1).fontSize);
      const bS = parseFloat(getComputedStyle(p).fontSize);
      return { h1: h1S, body: bS, ratio: (h1S / bS).toFixed(2) };
    });
    log('INFO', 'Design', `Typo-Ratio h1/body: ${JSON.stringify(typographyRatio)}`);

    // Focus visibility
    const focusRing = await page.evaluate(() => {
      const rules = [];
      for (const s of document.styleSheets) {
        try { for (const r of s.cssRules) if (r.selectorText && r.selectorText.includes(':focus')) rules.push(r.selectorText); } catch(e){}
      }
      return rules.slice(0, 10);
    });
    log('INFO', 'A11y', `Focus-Selektoren: ${focusRing.length} — ${focusRing.slice(0,3).join(' | ')}`);

    // A11y: buttons without accessible name
    const badBtn = await page.evaluate(() => {
      const arr = [];
      document.querySelectorAll('button, a[role="button"]').forEach(b => {
        const name = (b.getAttribute('aria-label') || b.textContent || '').trim();
        if (!name) arr.push(b.outerHTML.slice(0, 120));
      });
      return arr;
    });
    if (badBtn.length) log('FAIL', 'A11y', `${badBtn.length} Buttons ohne Namen`, { examples: badBtn.slice(0,3) });

    // Inputs without labels
    const badIn = await page.evaluate(() => {
      const arr = [];
      document.querySelectorAll('input, select, textarea').forEach(el => {
        const id = el.id;
        const lbl = id ? document.querySelector(`label[for="${id}"]`) : null;
        const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        if (!lbl && !aria) arr.push({ tag: el.tagName, type: el.type, id: id || null, name: el.name || null });
      });
      return arr;
    });
    if (badIn.length) log('FAIL', 'A11y', `${badIn.length} Inputs ohne Label`, { list: badIn });

    // Contrast quick check on primary button
    const btnStyle = await page.evaluate(() => {
      const b = document.querySelector('.btn-primary, button.primary, [class*="primary"]');
      return b ? { bg: getComputedStyle(b).backgroundColor, fg: getComputedStyle(b).color, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height } : null;
    });
    log('INFO', 'Design', `Primary Btn: ${JSON.stringify(btnStyle)}`);

    // Touch targets
    const smallTouch = await page.evaluate(() => {
      const arr = [];
      document.querySelectorAll('button, a').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width < 44 && r.width > 0 && r.height < 44 && el.offsetParent) {
          arr.push({ text: (el.textContent || '').trim().slice(0,30), w: Math.round(r.width), h: Math.round(r.height) });
        }
      });
      return arr;
    });
    if (smallTouch.length) log('WARN', 'TouchTarget-Landing', `${smallTouch.length} Ziele <44px`, { list: smallTouch.slice(0,10) });

    await ctx.close();
  }

  // 2. Mobile
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await newPage(ctx);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(OUT_DIR, '03_landing_mobile.png'), fullPage: false });
    await page.screenshot({ path: path.join(OUT_DIR, '04_landing_mobile_full.png'), fullPage: true });

    // Horizontal scroll check
    const hOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (hOverflow) log('FAIL', 'Responsive', `Horizontales Scrollen auf Mobile @ 390px`);

    const touchS = await page.evaluate(() => {
      const arr = [];
      document.querySelectorAll('button, a, input[type="submit"]').forEach(el => {
        const r = el.getBoundingClientRect();
        if ((r.width < 44 || r.height < 44) && r.width > 0 && el.offsetParent) {
          arr.push({ text: (el.textContent || el.value || '').trim().slice(0,30), w: Math.round(r.width), h: Math.round(r.height) });
        }
      });
      return arr;
    });
    if (touchS.length) log('WARN', 'TouchTarget-Mobile', `${touchS.length} <44px auf Mobile`, { list: touchS.slice(0,10) });

    await ctx.close();
  }

  // 3. Tablet
  {
    const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await newPage(ctx);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(OUT_DIR, '05_landing_tablet.png'), fullPage: false });
    await ctx.close();
  }

  // 4. Dark Mode preference
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    const page = await newPage(ctx);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.screenshot({ path: path.join(OUT_DIR, '06_landing_dark_mode.png'), fullPage: false });
    log('WARN', 'DarkMode', `Body-BG bei prefers dark: ${bg}`);
    await ctx.close();
  }

  // 5. Reduced motion
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await newPage(ctx);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const transitions = await page.evaluate(() => {
      // check if key elements have animations/transitions
      const b = document.querySelector('.btn-primary, button');
      return b ? getComputedStyle(b).transition : null;
    });
    log('INFO', 'Motion', `Transition am Btn bei reduced-motion: ${transitions}`);
    await ctx.close();
  }

  // 6. App-Modus mit demo.html als src
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await newPage(ctx);
    await page.goto(`${baseUrl}?src=${encodeURIComponent(demoUrl)}&owner=1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT_DIR, '07_app_loaded.png'), fullPage: false });
    await page.screenshot({ path: path.join(OUT_DIR, '08_app_full.png'), fullPage: true });

    // Check iframe loaded
    const iframeInfo = await page.evaluate(() => {
      const f = document.querySelector('iframe');
      if (!f) return null;
      try { return { hasContent: !!f.contentDocument?.body, r: f.getBoundingClientRect() }; } catch(e) { return { crossOrigin: true, err: e.message }; }
    });
    log('INFO', 'App', `iframe: ${JSON.stringify(iframeInfo)}`);

    // Click on demo body
    try {
      const iframe = await page.frameLocator('iframe');
      const body = iframe.locator('body');
      await body.click({ position: { x: 50, y: 50 } });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT_DIR, '09_after_click_modal.png') });
      const modalVisible = await page.evaluate(() => {
        const m = document.querySelector('.modal, [class*="modal"], dialog, [role="dialog"]');
        return m ? { display: getComputedStyle(m).display, visible: m.getBoundingClientRect().width > 0 } : null;
      });
      log('INFO', 'App', `Modal nach Klick: ${JSON.stringify(modalVisible)}`);
    } catch(e) {
      log('WARN', 'App', `iframe click failed: ${e.message.slice(0,150)}`);
    }
    await ctx.close();
  }

  // 7. App mit ungültiger URL
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await newPage(ctx);
    await page.goto(`${baseUrl}?src=https://this-does-not-exist-xyz.example.invalid/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT_DIR, '10_app_error_invalid_url.png'), fullPage: false });
    const errText = await page.evaluate(() => {
      const arr = [];
      document.querySelectorAll('*').forEach(el => {
        const t = (el.textContent || '').toLowerCase();
        if ((t.includes('fehler') || t.includes('cors') || t.includes('konnte')) && t.length < 300 && el.children.length === 0) arr.push(t.trim().slice(0,150));
      });
      return [...new Set(arr)].slice(0,5);
    });
    log('INFO', 'App-Robust', `Fehlermeldungen bei Bad URL: ${JSON.stringify(errText)}`);
    await ctx.close();
  }

  // 8. Modal Test — leeres Setup
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await newPage(ctx);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    // Try to submit empty form
    const btn = await page.$('button[type="submit"], #btn-create, button:has-text("Feedback-Link")');
    if (btn) {
      await btn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT_DIR, '11_landing_empty_submit.png') });
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
      log('INFO', 'Validierung', `Nach leerem Submit sichtbarer Feedback-Text ansatzweise: ${bodyText.slice(0,120)}`);
    }
    await ctx.close();
  }

  // 9. Keyboard-Tab durch Landing
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await newPage(ctx);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => document.activeElement ? { tag: document.activeElement.tagName, text: (document.activeElement.textContent || '').trim().slice(0,50), outline: getComputedStyle(document.activeElement).outline, boxShadow: getComputedStyle(document.activeElement).boxShadow } : null);
    log('INFO', 'A11y-Focus', `Erstes Tab-Ziel: ${JSON.stringify(first)}`);
    await page.screenshot({ path: path.join(OUT_DIR, '12_keyboard_first_tab.png') });
    await ctx.close();
  }

  // 10. Console-Errors summary
  if (consoleErrs.length) log('WARN', 'Console', `${consoleErrs.length} Console-Errors/Warnings`, { sample: consoleErrs.slice(0, 8) });

  await browser.close();
  srv.close();

  fs.writeFileSync(path.join(OUT_DIR, 'findings.json'), JSON.stringify(findings, null, 2));
  console.log(`\nDONE. ${findings.length} findings written.`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
