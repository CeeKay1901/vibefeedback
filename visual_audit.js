const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = '/data/data/com.termux/files/home/vibefeedback';
const OUT_DIR = PROJECT_DIR + '/audit_screenshots';
const PORT = 7788;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Simple HTTP server for local files
function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let filePath = PROJECT_DIR + decodeURIComponent(req.url.split('?')[0]);
      if (filePath.endsWith('/')) filePath += 'index.html';
      try {
        const ext = path.extname(filePath);
        const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml' }[ext] || 'text/plain';
        res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' });
        fs.createReadStream(filePath).pipe(res);
      } catch(e) {
        res.writeHead(404); res.end('not found');
      }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function shot(page, name, note) {
  const file = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${name}.png${note ? ' — ' + note : ''}`);
}

async function shotFull(page, name, note) {
  const file = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${name}.png (full)${note ? ' — ' + note : ''}`);
}

async function run() {
  console.log('\n🔍 VibeFeedback Visual Audit\n');
  const server = await startServer();
  const BASE = `http://127.0.0.1:${PORT}/index.html`;
  const DEMO = `http://127.0.0.1:${PORT}/demo.html`;

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true
  });

  // ── 1. DESKTOP Landing Page ──────────────────────────────────────────────
  console.log('\n[1] Desktop Landing Page (1440×900)');
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dPage = await desktop.newPage();
  await dPage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await dPage.waitForTimeout(800);
  await shot(dPage, '01_landing_desktop', 'Landing / Startseite');
  await shotFull(dPage, '02_landing_desktop_full', 'Landing vollständig');

  // ── 2. MOBILE Landing Page ───────────────────────────────────────────────
  console.log('\n[2] Mobile Landing Page (390×844, iPhone 14 Pro)');
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mPage = await mobile.newPage();
  await mPage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await mPage.waitForTimeout(600);
  await shot(mPage, '03_landing_mobile', 'Landing Mobile');
  await shotFull(mPage, '04_landing_mobile_full', 'Landing Mobile vollständig');

  // ── 3. TABLET Landing ────────────────────────────────────────────────────
  console.log('\n[3] Tablet Landing Page (768×1024)');
  const tablet = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tPage = await tablet.newPage();
  await tPage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await tPage.waitForTimeout(600);
  await shot(tPage, '05_landing_tablet', 'Landing Tablet');

  // ── 4. App mit URL laden (Demo-Seite) ────────────────────────────────────
  console.log('\n[4] App-Modus mit Demo-Seite (Desktop)');
  const appPage = await desktop.newPage();
  await appPage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await appPage.waitForTimeout(500);

  // URL eingeben
  const urlInput = await appPage.$('input[type="url"], input[placeholder*="http"], input[name="url"], #url-input, [data-role="url"]');
  if (urlInput) {
    await urlInput.fill(DEMO);
    await urlInput.press('Enter');
    console.log('  → URL eingegeben');
  } else {
    // Suche alle Input-Felder
    const inputs = await appPage.$$('input');
    console.log(`  → ${inputs.length} Input(s) gefunden`);
    if (inputs.length > 0) {
      await inputs[0].fill(DEMO);
      await inputs[0].press('Enter');
    }
  }
  await appPage.waitForTimeout(3000);
  await shot(appPage, '06_app_loaded_desktop', 'App mit Demo-Seite geladen');
  await shotFull(appPage, '07_app_loaded_full', 'App vollständig');

  // ── 5. Sidebar prüfen ────────────────────────────────────────────────────
  console.log('\n[5] Sidebar / Kommentar-Panel');
  const sidebar = await appPage.$('[class*="sidebar"], [id*="sidebar"], [class*="panel"]');
  if (sidebar) {
    const box = await sidebar.boundingBox();
    if (box) console.log(`  → Sidebar: ${Math.round(box.width)}×${Math.round(box.height)}px`);
  }
  await shot(appPage, '08_sidebar_state', 'Sidebar Zustand');

  // ── 6. Klick auf Element in iframe simulieren ─────────────────────────────
  console.log('\n[6] Interaktion: Hover über iframe-Element');
  const iframe = await appPage.$('iframe');
  if (iframe) {
    const frame = await iframe.contentFrame();
    if (frame) {
      try {
        await frame.waitForSelector('body', { timeout: 5000 });
        const clickTarget = await frame.$('h1, h2, h3, button, a, p, div[class]');
        if (clickTarget) {
          await clickTarget.scrollIntoViewIfNeeded();
          await clickTarget.hover();
          await appPage.waitForTimeout(700);
          await shot(appPage, '09_hover_element', 'Hover über Element im iframe');
          await clickTarget.click({ force: true });
          await appPage.waitForTimeout(2000);
          await shot(appPage, '10_after_click', 'Nach Klick auf Element im iframe');
        } else {
          console.log('  → Kein klickbares Element im iframe gefunden');
          await shot(appPage, '09_iframe_state', 'iframe-Zustand');
        }
      } catch(e) {
        console.log('  → iframe-Interaktion fehlgeschlagen:', e.message.substring(0, 80));
        await shot(appPage, '09_iframe_fallback', 'iframe ohne Interaktion');
      }
    }
  } else {
    console.log('  → Kein iframe auf der Seite');
    await shot(appPage, '09_no_iframe', 'Seite ohne iframe');
  }

  // ── 7. Keyboard shortcut Test ─────────────────────────────────────────────
  console.log('\n[7] Escape-Key & Modal');
  await appPage.keyboard.press('Escape');
  await appPage.waitForTimeout(400);
  await shot(appPage, '11_after_escape', 'Nach Escape-Key');

  // ── 8. Mobile App-Modus ───────────────────────────────────────────────────
  console.log('\n[8] Mobile App-Modus');
  const mAppPage = await mobile.newPage();
  await mAppPage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await mAppPage.waitForTimeout(500);
  const mInputs = await mAppPage.$$('input');
  if (mInputs.length > 0) {
    await mInputs[0].fill(DEMO);
    await mInputs[0].press('Enter');
    await mAppPage.waitForTimeout(3000);
  }
  await shot(mAppPage, '12_app_mobile', 'App Mobile');

  // ── 9. Kontrastverhältnisse ───────────────────────────────────────────────
  console.log('\n[9] Dark mode / Kontrast');
  const darkPage = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark'
  }).then(c => c.newPage());
  await darkPage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await darkPage.waitForTimeout(600);
  await shot(darkPage, '13_dark_mode', 'Dark-Mode (System)');

  // ── 10. Accessibility-Analyse ─────────────────────────────────────────────
  console.log('\n[10] Accessibility-Analyse');

  // Interaktive Elemente ohne Labels
  const missingLabels = await appPage.evaluate(() => {
    const results = [];
    document.querySelectorAll('button, [role="button"], a, input, select').forEach(el => {
      const label = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim() || el.getAttribute('placeholder');
      if (!label || label.length < 2) {
        results.push({
          tag: el.tagName,
          id: el.id || null,
          class: el.className.substring(0, 60),
          text: el.textContent.substring(0, 30)
        });
      }
    });
    return results;
  });
  console.log(`  → ${missingLabels.length} Elemente ohne barrierefreies Label`);
  fs.writeFileSync(`${OUT_DIR}/missing_labels.json`, JSON.stringify(missingLabels, null, 2));

  // ARIA roles snapshot via evaluate
  const ariaRoles = await appPage.evaluate(() => {
    const els = document.querySelectorAll('[role], button, input, select, textarea, a[href]');
    return Array.from(els).slice(0, 60).map(el => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      ariaExpanded: el.getAttribute('aria-expanded'),
      text: el.textContent.trim().substring(0, 40)
    }));
  });
  fs.writeFileSync(`${OUT_DIR}/aria_roles.json`, JSON.stringify(ariaRoles, null, 2));
  console.log(`  → ${ariaRoles.length} ARIA-Elemente analysiert`);

  // ── 11. Layout-Maße auslesen ──────────────────────────────────────────────
  console.log('\n[11] Layout-Metriken');
  await dPage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await dPage.waitForTimeout(500);
  const metrics = await dPage.evaluate(() => {
    const get = sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return { w: Math.round(r.width), h: Math.round(r.height), fontSize: s.fontSize, color: s.color, bg: s.backgroundColor };
    };
    return {
      body: { w: document.body.scrollWidth, h: document.body.scrollHeight },
      mainHeading: get('h1'),
      primaryBtn: get('button.primary, .btn-primary, button[type="submit"]'),
      urlInput: get('input[type="url"], input'),
      nav: get('nav, header, .header'),
    };
  });
  console.log('  → Body:', metrics.body);
  if (metrics.mainHeading) console.log('  → H1:', metrics.mainHeading);
  if (metrics.primaryBtn) console.log('  → Primary Button:', metrics.primaryBtn);
  if (metrics.urlInput) console.log('  → URL Input:', metrics.urlInput);
  fs.writeFileSync(`${OUT_DIR}/layout_metrics.json`, JSON.stringify(metrics, null, 2));

  // ── 12. Performance ───────────────────────────────────────────────────────
  console.log('\n[12] Performance-Timing');
  const perfPage = await desktop.newPage();
  const startTime = Date.now();
  await perfPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const dclTime = Date.now() - startTime;
  await perfPage.waitForTimeout(200);
  const perf = await perfPage.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd - nav?.startTime) || null,
      loadComplete: Math.round(nav?.loadEventEnd - nav?.startTime) || null,
      htmlSize: document.documentElement.outerHTML.length
    };
  });
  console.log(`  → DOMContentLoaded (wall): ${dclTime}ms`);
  console.log(`  → Performance API:`, perf);
  fs.writeFileSync(`${OUT_DIR}/performance.json`, JSON.stringify({ wallTime: dclTime, ...perf }, null, 2));

  await browser.close();
  server.close();

  console.log(`\n✅ Audit abgeschlossen. Screenshots in: ${OUT_DIR}/`);
  console.log(`   ${fs.readdirSync(OUT_DIR).length} Dateien erstellt.\n`);
}

run().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
