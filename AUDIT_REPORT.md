# VibeFeedback — Web Audit Report

**Datum:** 2026-07-08 · **Tier:** 2 (Code + Playwright/Chromium via proot-Ubuntu) · **SEO:** ausgenommen

Screenshots: `newaudit_shots/` · Rohdaten: `newaudit_shots/findings.json`

---

## Gesamtbewertung

| Dimension | Score | Grade | Kürzester Kommentar |
|---|---|---|---|
| Design | 78 | B | pilot-CI konsistent · Dark-Mode-Details brechen |
| UX/Usability | 82 | B | Coach + Modes gut · Topbar überladen · Modal-Tiefe hoch |
| Content & Copy | 88 | B+ | konsequentes Du · Onboarding-Text lang |
| Features | 90 | A | LOOP-Kriterien A–H erfüllt · Bookmarklet ≠ Parität |
| Accessibility | 55 | D | keine Fokus-Ringe auf Buttons · Label-Lücken · Kontrast dark |
| Performance | 74 | C | 146 KB HTML · Bookmarklet inline · gzip ~45 KB |
| Security | 85 | B+ | esc()-basiert · offener redirect follow · CSP fehlt |
| Robustness | 78 | B | Quota-Handling zu simpel · try/catch schluckt still |
| Visual/Responsive | 72 | C | Mobile ok · Modal-Chrome eng · sticky-Footer fehlt Desktop |
| **Gesamt (gewichtet)** | **77** | **B–** | shippable, aber A11y-Sprint dringend |

Verifizierung per Playwright: **Landing lädt in 677 ms, Modal öffnet nach Klick, Bad-URL zeigt Fehlermeldung, dark-mode-Body-BG wechselt korrekt.** Bestätigt: Nur `input:focus, textarea:focus` als einzige Fokus-Regel im CSS — Buttons/Links/Chips **haben keinen sichtbaren Fokus-Ring**.

---

## Findings

### FAIL

#### F1 — Kein Fokus-Ring auf Buttons, Links, Chips (A11y)
`index.html:73` — nur `input:focus,textarea:focus` definiert. Playwright bestätigt: Tab → BUTTON „↑ Oben" bekommt Browser-Default (`outline: rgb(16,16,16) auto 1px`) — Chrome only. Auf Firefox/Safari + Design-Tokens: Fokus schleicht sich weg.
**Fix:** eine globale Regel ergänzen
```css
button:focus-visible, a:focus-visible, .chip:focus-visible,
[role="button"]:focus-visible, [tabindex]:focus-visible,
label.precision-toggle:focus-within {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
  border-radius: 6px;
}
```

#### F2 — pilot-Logo unsichtbar im Dark Mode
`pilot-logo.svg:2` hat `fill="#262626"` hart codiert → auf `--bg:#1c1c1a` de-facto invisible. Screenshot `06_landing_dark_mode.png` bestätigt.
**Fix:** SVG umbauen auf `fill="currentColor"` und CSS `img.logo { color: var(--fg); }` — aber `<img src>` erzeugt eigenen Kontext. Zwei saubere Wege:
1. SVG inline in `index.html` einbetten (dann `currentColor` funktioniert), oder
2. Zweites Logo `pilot-logo-dark.svg` mit `fill="#eeede8"` und `<picture>`-Swap via `prefers-color-scheme`.
Option 2 ist einzeilig und robust:
```html
<picture>
  <source srcset="pilot-logo-dark.svg" media="(prefers-color-scheme: dark)">
  <img src="pilot-logo.svg" alt="pilot" width="91" height="45">
</picture>
```

#### F3 — Kicker-Pill: Kontrast Yellow-BG × Light-FG im Dark Mode
`index.html:89` — `.hero .kicker { background: var(--accent); color: var(--fg); }`. Im Dark-Mode wird `--fg` zu `#eeede8` → hell auf hellgelb. Kontrast ~2.1 → WCAG-Fail.
**Fix:** Textfarbe der Pille an Akzent binden, nicht an fg:
```css
.hero .kicker{color:#262626;border-color:#262626}
```
(feste Farben, weil die Pille ihre Yellow-Identity behält.)

#### F4 — Landing-Inputs & Toggles ohne sichtbares Label
`index.html:656` (`#src-input`), `~699` (`#tgl-render`, `#tgl-precision`). `aria-label` liegt am `<input>`, `<label>` ist wrapper ohne `for=`. Screen-Reader lesen inkonsistent.
**Fix:** sichtbares Label + `aria-describedby` für Fehlermeldung:
```html
<label for="src-input" class="field-label">Deine Projekt-URL</label>
<input type="url" id="src-input" placeholder="https://…" aria-describedby="src-error cors-hint">
```
Für Toggle: `<label for="tgl-render">` mit expliziter Verbindung, entfernte `aria-label` doppelt.

#### F5 — Modal ohne `aria-labelledby` / Focus-Trap
`index.html:1579` — `role="dialog" aria-modal="true"` ohne Verweis auf Titel. Tab läuft aus dem Modal raus in die Iframe-Seite darunter.
**Fix:** Titel bekommt `id="vf-modal-title"`, Dialog nimmt `aria-labelledby="vf-modal-title"`. Focus-Trap: bei Öffnen `Tab`/`Shift+Tab` innerhalb ersten/letzten fokussierbaren Element loopen (siehe Snippet in Anhang A).

#### F6 — Touch-Targets < 44 px auf Landing
Playwright/Mobile 390 px: `Link erzeugen` (316×36 px), `Demo starten →` (320×36 px), `GitHub →` (57×20 px), Footer-Link (214×14 px). WCAG 2.5.5.
**Fix:**
```css
.btn, button.primary, .link-cta { min-height: 44px; padding: 12px 18px; }
.nav a, footer a { min-height: 44px; display: inline-flex; align-items: center; padding: 10px 6px; }
```

### WARN

#### W1 — Topbar der App-Ansicht ist überladen (7 Controls in 1 Reihe)
`07_app_loaded.png`: Kommentieren/Navigieren/Original/Präzision/Owner-Dashboard/Präsentieren/Neu — auf 1440 px eng, auf 1024 px kritisch, unter 1024 knallt es. Cognitive Load hoch.
**Fix:**
- Original/Präzision in ein „⚙ Ansicht"-Popover gruppieren.
- Owner-Dashboard nur ins Owner-Mode (bereits) — visuell absetzen als Icon-Button rechts.
- Reihen-Layout mit `flex-wrap:wrap; gap:8px` als Fallback.

#### W2 — Sticky Save-Bar im Modal nur mobile
`index.html:355–369` (Modal-Actions als sticky nur `@media(max-width:900px)`). Auf Desktop mit vollem Bug-Template + Screenshot-Preview kann Save-Button unterhalb Viewport verschwinden.
**Fix:** sticky auch Desktop, gemeinsame CSS-Regel:
```css
.modal .actions-row{position:sticky;bottom:0;background:var(--panel);
  margin:12px -16px -16px;padding:12px 16px 16px;border-top:1px solid var(--line);z-index:5}
```

#### W3 — `<img src="pilot-logo.svg">` erhält keinen `alt`
`index.html:512` u. ä. — Alt-Text prüfen (im Nav+Topbar). Screen-Reader liest sonst Filename.
**Fix:** `alt="pilot" role="img"`.

#### W4 — `fetch(src, {redirect:"follow"})` ohne Host-Check
`index.html:1158`. Owner teilt Link `?src=https://ok.example/…` — wird nach Redirect zu `evil.example` gefolgt. Für PoC geringes Risiko, aber trivial fixbar:
```js
const res = await fetch(src, { redirect:"follow" });
const finalUrl = new URL(res.url || src);
if (finalUrl.host !== new URL(src).host) throw new Error(`Redirect zu ${finalUrl.host} — abgebrochen.`);
```

#### W5 — 146 KB single-file HTML, Bookmarklet als inline-URL-encoded String (~34 KB)
`index.html:1034` erzeugt Bookmarklet-Href inline durch `encodeURIComponent(<layer.js-Kopie>)`. Verdoppelt Payload, hält Text nicht mit `layer.js` synchron (Duplikat).
**Fix:** Bookmarklet-Content zur Build/Runtime aus `layer.js` lesen:
```js
fetch("layer.js").then(r=>r.text()).then(js=>{
  bmLink.href = "javascript:"+encodeURIComponent(`(function(){var s=document.createElement('script');s.textContent=${JSON.stringify(js)};document.head.appendChild(s);})()`);
});
```
Erspart ~34 KB HTML-Payload und garantiert Sync mit `layer.js`.

#### W6 — localStorage-Quota-Fehler wirft Toast, aber kein Retry / kein Cleanup
`index.html:966`. Bei mehrfachem Bug-Modus + Screenshots (JPEG 0.78 quality) ist die Quota schnell erreicht.
**Fix:** bei `QuotaExceededError` Screenshots älterer Kommentare herunterrechnen oder Nutzer explizit fragen. Snippet:
```js
if(e.name==='QuotaExceededError'){
  arr.forEach(c=>{ if(c.screenshot && c.ts < Date.now()-864e5) c.screenshot = null; });
  try{ localStorage.setItem(storeKey(src), JSON.stringify(arr)); toast('Alte Screenshots gelöscht, Kommentar gespeichert.'); return true; }
  catch(_){ toast('Speicher voll. Bitte alte Kommentare löschen.', 5000); }
}
```

#### W7 — `try{…}catch(_){}` schluckt Form-Submit-Fehler im Iframe
`index.html:1396–1401`. Nutzer klickt Formular → nichts passiert → keine Meldung.
**Fix:** `catch(err){ console.warn('[vf] form',err); toast('Formular konnte nicht geöffnet werden.'); }`

#### W8 — Dark-Mode: Mock-Preview auf Landing bleibt weiß
`index.html:98–124` — `.mock` Panel hat feste helle Farben. In `06_landing_dark_mode.png` deutlich sichtbarer heller Block auf dunklem Screen.
**Fix:** `.mock` mit CSS-Vars füttern (`--panel`) statt `#fff`, oder `.mock` im Dark-Mode explizit auf dunkleren Ton mappen.

#### W9 — Screenshot-Capture Timeout 4 s, fehlender Reject-Handler
`index.html:1776–1779`. Große Elemente auf mobiler CPU brauchen länger; ohne `.catch()` an `captureElement` wird Rejection zum unhandled-rejection.
**Fix:**
```js
screenshot = await Promise.race([
  captureElement(currentEl).catch(e => (console.warn('[vf] shot',e), null)),
  new Promise(r=>setTimeout(()=>r(null), 8000))
]);
```

### INFO

- **I1** Typo-Ratio h1/body = 2.95 (56 px vs 19 px) — im gesunden 2.5–4×-Fenster.
- **I2** `prefers-reduced-motion` sauber implementiert (`index.html:465`), Playwright bestätigt Transitions ~0.
- **I3** Landing-Load (networkidle) 677 ms — schnell trotz 146 KB.
- **I4** Console-Error `net::ERR_INTERNET_DISCONNECTED` — vermutlich Google-Fonts-Load fehlgeschlagen. Prüfen ob Font überhaupt referenziert wird; wenn ja: Font selfhosten oder Fallback-Stack ist bereits gut.
- **I5** Feature-Parität `layer.js` ↔ `index.html`: Fehlend im Bookmarklet — Precision-Mode-Overlay, Presentation-Mode, Parent-Breadcrumb-Navigation, Debug-Panel. Doku im README als „Lite" markieren oder nachziehen.
- **I6** `.__vf_infobox` Precision-Overlay: `#fcfcfc` auf `#262626` → Kontrast ~15:1 ✓. (Agent-Report fälschlich als FAIL markiert — verifiziert OK.)

---

## Implementierungsplan

Sortiert nach **Impact ÷ Aufwand**. Jeder Block ist idempotent, teste sofort nach Anwendung im Browser (`python3 -m http.server 8080`).

### Sprint 1 — A11y-Basics (≈45 min, +12 Grade-Punkte)

1. **Fokus-Ringe** (F1) — CSS-Block einfügen nach Zeile 73.
2. **Modal ARIA + Focus-Trap** (F5) — `aria-labelledby` + Tab-Handler beim Öffnen. Siehe Anhang A.
3. **Landing-Labels sichtbar** (F4) — `<label for="src-input">`, `<label for="tgl-render">` mit sichtbarem Text; entferne redundante `aria-label`s. Fehler-Div bekommt `role="alert"`.
4. **Logo-Alt + Role** (W3) — überall wo `<img>` mit Logo geladen wird.

### Sprint 2 — Dark-Mode fixen (≈30 min, +6 Punkte)

5. **Zweites Logo für Dark** (F2) — `pilot-logo-dark.svg` erstellen (`fill="#eeede8"`), `<picture>`-Swap.
6. **Kicker-Kontrast** (F3) — feste Textfarbe `#262626`.
7. **Mock-Preview auf Vars mappen** (W8) — `.mock`, `.mock .frame-bar`, `.link-box` auf `var(--panel)` / `var(--panel-2)` umstellen.

### Sprint 3 — UX-Politur (≈45 min, +5 Punkte)

8. **Touch-Targets 44 px** (F6) — globale Btn-min-height, extra für Nav/Footer-Links.
9. **Sticky Save-Bar auch Desktop** (W2) — sticky-Regel aus Mobile-Block herauslösen.
10. **Topbar entzerren** (W1) — Original/Präzision in Popover (`<details><summary>⚙ Ansicht</summary>…`), erspart auch einen a11y-Fehler weil `<details>` nativ toggelt.

### Sprint 4 — Robustness/Security (≈40 min, +4 Punkte)

11. **Host-Validierung nach Redirect** (W4) — 3 Zeilen unter `fetch()`.
12. **Form-Submit-Fehler mit Toast** (W7).
13. **Screenshot-Reject-Handler + 8 s Timeout** (W9).
14. **Quota-Downgrade-Retry** (W6).

### Sprint 5 — Payload-Diät (≈2 h, optional)

15. **Bookmarklet aus `layer.js` erzeugen** (W5) — Bookmarklet-Href aus `fetch("layer.js")`.
    - Nebeneffekt: `layer.js` wird zur einzigen Quelle der Wahrheit, Duplikate weg.

### Sprint 6 — Feature-Parität (optional, ≈4–6 h)

16. Precision-Mode-Overlay in `layer.js` portieren.
17. Presentation-Mode als kompakte Slideshow in `layer.js`.
18. Parent-Breadcrumb/Element-Traversal in `layer.js`.
19. README-Passage „Bookmarklet-Lite" ODER Feature-Parität herstellen.

---

## Anhang A — Focus-Trap Snippet für Modal

Einzufügen in `openCommentModal` gleich nach dem Modal-DOM-Insert:

```js
const focusable = ()=>[...wrap.querySelectorAll(
  'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
)].filter(el=>!el.disabled && el.offsetParent);
wrap.addEventListener('keydown', e=>{
  if(e.key!=='Tab') return;
  const list = focusable(); if(!list.length) return;
  const first = list[0], last = list[list.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
});
```

## Anhang B — Verifizierte Screenshots

- `newaudit_shots/01_landing_desktop.png` — Landing hell, sauberer pilot-Look
- `newaudit_shots/06_landing_dark_mode.png` — Logo weg, Kicker unlesbar, Mock hell → 3 Bugs sichtbar
- `newaudit_shots/07_app_loaded.png` — Topbar mit 7 Controls, Kommentieren-Yellow-CTA gut sichtbar
- `newaudit_shots/09_after_click_modal.png` — Modal Feature-Template, 5 Formularfelder, korrektes Autofocus auf „Als…"
- `newaudit_shots/10_app_error_invalid_url.png` — Coach-Overlay verdeckt Error-Text (Coach Coach vor Error?)

---

## Nächste Aktion

Ich kann Sprint 1 + 2 + 3 (rund ~2 h Umsetzung, 21 Grade-Punkte Impact) autark ausführen — sag „los" und ich fange mit F1 an. Sprint 5+6 vor dem Start Rücksprache (Bookmarklet-Refactor bricht Feature-Freeze, Parität ist Umfangs-Diskussion).
