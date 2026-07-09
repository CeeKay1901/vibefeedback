# Changelog

## 0.7.0 — 2026-07-09 — Systematische Bugfix-Runde

Drei parallele Code-Reviews (Screenshot-Pipeline, Kommentar-Lifecycle, Bookmarklet) + Audit-Suiten. Alle Funde verifiziert und mit Regressionstests abgesichert.

### security
- **Stored-XSS im Import geschlossen** (kritisch): `id`, `screenshot`, `category` und `priority` aus importierten `.json`/`.md`-Dateien landeten ungefiltert in HTML-Attributen bzw. `<img src>`. Eine präparierte Feedback-Datei konnte beim Import beliebiges JavaScript im Origin des Tools ausführen (Zugriff auf alle gespeicherten Kommentare). Jetzt: strikte Validierung an der Quelle (`id` nur `[a-z0-9_-]`, `screenshot` nur vollständig geprüfte base64-Raster-dataURL — kein SVG, das Skripte tragen kann; Kategorie/Priorität gegen Whitelist) **plus** `esc()` an allen Render-Stellen (Defense-in-Depth).

### fix
- **Datenverlust bei vollem Speicher**: Das Screenshot-Pruning verglich einen ISO-String mit einer Zahl (`"2026-…" < 1751…` → immer `false`), lief also nie an. Bei Quota-Fehler ging der Kommentar verloren, statt alte Screenshots freizugeben.
- **Subpage-Zuordnung ging bei Export/Import verloren**: Export schrieb `c.page` (existiert nie → immer `null`), Import schrieb nach `page` statt `pageUrl`. Nach Re-Import saßen alle Kommentare auf der Startseite.
- **Badge-Nummer ≠ Sidebar-Nummer** bei Projekten mit mehreren Unterseiten — Badges zählten pro Seite neu.
- **Screenshot-Verlust beim schnellen Speichern**: Ctrl+Enter direkt nach dem Klick speicherte still ohne Screenshot; jetzt wartet der Save kurz auf den laufenden Capture ("Screenshot…").
- **Präsentationsmodus blieb leer**, wenn „Direkt"-Rendering aktiv war (`srcdoc` ist dort leer).
- **`injectBase`**: Seiten mit eigenem `<base>` bekamen kein Safety-Script → SPA-Navigation warf ungefangene `SecurityError` in `about:srcdoc`.
- **CDN-Fehlversuch wurde dauerhaft gecacht**: Ein transienter Netzfehler degradierte alle weiteren Screenshots der Sitzung aufs Drahtgitter. Ebenso wird leeres Font-CSS nicht mehr gecacht (SPAs laden Fonts nach).
- **Hänger-Schutz**: Font-/Stylesheet-Fetches haben jetzt Timeouts — ein stallender Host konnte sonst jeden Screenshot der Sitzung blockieren.
- **Edit-Modus**: Klick auf ein anderes Element war eine stille No-Op (jetzt Hinweis-Toast); eingefügter Screenshot wird beim Elementwechsel verworfen.

### fix (Bookmarklet)
- **Wirtsseite wurde dauerhaft verändert**: aufgezwungenes `position:relative` (für Badge-Positionierung) wurde nie zurückgenommen → verschobene Layouts auf der Zielseite.
- **Badges an `<img>`/`<input>`/`<svg>`** waren unsichtbar (ersetzte Elemente rendern keine Kinder) — Badge hängt jetzt am Elternelement.
- **Doppel-Submit** per gehaltenem Ctrl+Enter legte mehrere identische Kommentare an.
- **Edit + voller Speicher**: Modal fror auf „Speichere…" ein, ohne Rollback.
- **Esc während „Speichere…"** speicherte den Kommentar trotzdem.
- **Hash-Router-SPAs**: alle Routen teilten sich einen Kommentar-Store (`STORE_KEY` ohne `search`/`hash`) → Badges auf falschen Elementen. Jetzt route-spezifisch inkl. Migration alter Daten und `hashchange`-Handling.
- **Autor-Name** wird nun mit dem Haupttool geteilt (gleicher localStorage-Key, alter Key wird gelesen).
- `window.__vf_layer_version` als Laufzeit-Marker (VF_VERSION wurde vorher wegoptimiert).

### a11y
- Import-Datei-Input hat ein `aria-label` (Audit-FAIL behoben).
- Topbar- und Sidebar-Buttons erfüllen auf Touch-Geräten die 44-px-Mindestgröße (WCAG 2.5.5).

## 0.6.1 — 2026-07-09 — Demo: funktionierende Unterseiten

Die Flowly-Demo ist jetzt eine Mini-Site — im Navigieren-Modus komplett durchklickbar, Kommentare tragen die jeweilige Subpage-URL:

- **demo-app.html** — Task-Board („Mein Board"): 3 Spalten, Checkboxen, Filter-Chips (Alle/Meine/Überfällig), „+ Neuer Task" und Löschen funktionieren lokal.
- **demo-login.html** — Login mit GET-Formular; Absenden führt (durch VF geroutet) echt zum Board.
- **demo-preise.html** — Preisseite mit Vergleichstabelle und FAQ (`<details>`-Accordion).
- **demo-blog.html** + **demo-blog-artikel.html** — Blog-Liste mit ausgearbeitetem Artikel.
- **demo-shared.css** — gemeinsame Design-Tokens der Unterseiten (aus demo.html extrahiert).
- Landing (`demo.html`): tote `#`-Links (Nav, CTAs, Pricing-Buttons, Footer) zeigen jetzt auf die echten Unterseiten.
- Neue absichtliche DEMO-FEHLER zum Finden: Löschen ohne Bestätigung neben Bearbeiten, Icon-Buttons ohne Label (⚡/◫), US-Datumsformat im Blog, „OK"-Button im Login, Preis-Sternchen ohne Fußnote, Passwort landet als GET-Parameter in der URL.

## 0.6.0 — 2026-07-09 — Annotator: echter Stift + Ausklappmenü

- **feat: Stift (Freihand)** — das ✎-Symbol war bisher ein transparenter Marker-Kasten; jetzt gibt es echtes Freihand-Zeichnen mit geglätteter Kurve (quadratische Interpolation durch die Mittelpunkte).
- **feat: Ausklappmenü (⋯)** in der Annotator-Toolbar mit mehr Funktionen:
  - **Marker** (transparentes Hervorheben, vorher fälschlich als ✎ beschriftet)
  - **Pixelieren** — Bereich aufziehen, um sensible Daten unkenntlich zu machen (verdeckt auch darunterliegende Annotationen)
  - **Nummern-Badges** — Klick platziert ①, ②, ③ …
  - **3 weitere Farben** (Grün, Blau, Weiß) und **3 Strichstärken** (dünn/mittel/dick)
  - **Redo (↷)** — Undo/Redo-Historie; neuer Strich verwirft die Redo-Kette
- **ux:** Hint-Text wechselt je Werkzeug („Freihand zeichnen", „Klicken zum Platzieren", …).

## 0.5.1 — 2026-07-09 — Eigener Screenshot + CORS-Cache-Fix

- **feat: Screenshot aus Zwischenablage überschreiben** — für Edge-Cases, in denen der Auto-Screenshot nicht passt: 📋-Button (Clipboard-API) oder Strg+V in der Kommentar-Bar und im Bookmarklet-Modal. Eingefügte Bilder werden auf max. 1400 px Kante normalisiert und als JPEG gespeichert (localStorage-Schonung); im Haupttool landet das Bild im Annotator und ist weiter annotierbar, im Edit-Modus ersetzt es den vorhandenen Screenshot.
- **fix: CORS-Cache-Falle beim Bild-Inlining** — CDNs wie image.tmdb.org senden `Access-Control-Allow-Origin` nur bei Requests mit Origin-Header; gecachte `<img>`-Antworten haben keine Freigabe, der cors-fetch scheiterte live (Poster → Platzhalter). `fetchFn` versucht jetzt erst den Cache, dann einen frischen Request.

## 0.5.0 — 2026-07-09 — Pixel-treue Screenshots

**Screenshot-Engine neu aufgebaut** — Screenshots zeigen jetzt, was der Nutzer wirklich sieht.

- **Engine 1: modern-screenshot** (SVG foreignObject, CDN-lazy-loaded): Der Browser rendert den DOM-Klon selbst, statt dass html2canvas CSS nachbaut — Grid/Flex/Gradients/`oklch`-Farben funktionieren. Externe Bilder werden per fetch (CORS) als dataURL eingebettet (TMDB-Poster, picsum etc. erscheinen echt statt als Platzhalter).
- **Webfont-Einbettung**: `@font-face`-Regeln werden auch aus Cross-Origin-Stylesheets (Google Fonts) eingesammelt — deren `cssRules`-Zugriff wirft einen SecurityError, weshalb modern-screenshot sie überspringt — und die Fontdateien (Latin-Subset) als dataURL inlined. Vorher: falsche Fontmetriken → dünnere Titel, umbrechende Badges.
- **Effektiver Hintergrund**: Transparente Elemente bekommen die Hintergrundfarbe aus der Elternkette statt hart Weiß — dunkle Seiten (Kippflix-Cards) sehen im Screenshot aus wie im Original.
- **Saubere Captures**: VF-eigene Overlays (Hover-Outline, Auswahl-Glow, Badges) werden vor dem Capture entfernt und danach wiederhergestellt — der Screenshot zeigt die Seite, nicht das Werkzeug.
- **Fallback-Kaskade**: modern-screenshot → html2canvas → strukturelles Canvas-2D-Drahtgitter.
- **Bookmarklet-Parität**: `layer.js` nutzt dieselbe Engine (CDN-Load; bei CSP-Block der Zielseite Fallback auf den bisherigen naiven Klon). `layer.min.js` + eingebettetes Bookmarklet jetzt per terser generiert.
- **Verifikation**: Playwright-Tests vergleichen Captures gegen `locator.screenshot()`-Ground-Truth (test_screenshot.js, test_kippflix.js) — 14/14 bzw. 5/5 grün.

## 0.4.0 — 2026-07-08 — UX improvements batch

### feat
- **Export-Reminder**: Sticky Banner erscheint beim Tab-Wechsel (`visibilitychange`), wenn Kommentare im localStorage vorhanden sind — Aktionen: Download, Kopieren, Schließen.
- **Fertig-Toast**: Nach dem ersten gespeicherten Kommentar wird ein 5,5-s-Toast mit Export-Hinweis eingeblendet.
- **Presentation-Mode Promo**: Nach dem 3. Kommentar Toast-Hinweis auf den Präsentations-Modus (nur für Owner).
- **Autor-Name**: Beim ersten Kommentar wird der Name per Prompt abgefragt und im localStorage gespeichert; erscheint in Sidebar und Markdown-Export.
- **Kategorie-Subtitel** (`sub`-Feld): Jede Kategorie hat einen erklärenden Untertitel (z.B. "Bug = Etwas funktioniert nicht") — sichtbar als Tooltip und Sub-Text in den Chips.
- **Rolle-basierte Sidebar**: Import- und Löschen-Aktion für Commenter ausgeblendet; nur Owner sieht die vollen Verwaltungsfunktionen.

### ux
- **`humanLabel()`**: Badges und Sidebar zeigen `aria-label` oder sichtbaren Element-Text zuerst; CSS-Selector dahinter nur gedimmt dargestellt (`cbar`-Logik).
- **`PoC`-Badge** → `Beta` im Landing-Header.
- **"🖥 Original"** → **"🖥 Direkt"** mit verbessertem Tooltip.
- **Setup-Result umstrukturiert**: "Als Owner öffnen" als primärer full-width CTA (oberste Aktion).
- **CORS-Hinweis** direkt unter dem Hero-CTA mit Bookmarklet-Link ergänzt.
- **Coach Mark Step 3**: Accent-Background und stärkerer Warntext für mehr Aufmerksamkeit.

### chore
- **Mobile Canvas**: `min-height` von 280 px auf 340 px erhöht für bessere iframe-Nutzbarkeit.
- **Touch-Geräte**: Precision-Toggle und Original-Toggle per `@media (pointer: coarse)` ausgeblendet.

## 0.3.0 — 2026-07-07 — pilot CI

**Corporate Identity:** Design komplett auf pilot.de umgezogen.

- **Logo:** `pilot-logo.svg` (91×45) im Landing-Nav und App-Topbar, ersetzt das alte gradient-„V".
- **Palette:** dark-mode entfernt, pilot-Farben etabliert — `#fcfcfc` Hintergrund, `#262626` Text, `#ffe05e` Akzent-Gelb, `#7b7a71` muted, `#f1f1ec` cream, `#e35f5f` danger, `#62c12d` success.
- **Typografie:** Body-Font auf `"Centra No1"` + Fallback-Stack.
- **Buttons:** Primary jetzt schwarz mit gelbem Hover (statt Purple-Gradient). Kicker/Eyebrow als Yellow-Pills.
- **Hero:** flach getypset, Wort-Accent als Gelb-Highlight-Box statt Text-Gradient.
- **Iframe-Highlights:** Hover/Selected/Badge-Farben auf schwarz/gelb umgestellt, bleibt sichtbar auf jedem Ziel-Site-Hintergrund.
- **Kategorie- und Prioritäts-Chips:** in den neuen pilot-Tönen (Feature=Gelb, Design=Grün, Copy=Ocker, Bug=Rot, Frage=Blau, Lob=Rosé).
- **Presentation-Mode / Coach / Modal:** helle Panels, dunkler Text, gelber Fokus-Ring.
- **Favicon:** pilot-Logo.

## 0.2.0 — 2026-07-07 — Präsentations-Release

**Landing:** komplettes Redesign — Hero, Feature-Cards, Mock-Preview, Workflow-Flow, Demo-Card. Gradient-Backdrops, hover-lift, glasmorphism-Modal.

**Kommentar-Kategorien:** Bug, Feature, Design, Copy, Frage, Lob — jede mit Emoji + Farbe. Wählbar im Modal per Chip.

**Priorität:** Muss / Sollte / Könnte / Nice — pro Kommentar.

**Sidebar:**
- Live-Statistik (Muss/Sollte-Zähler farbig)
- Filter-Chips nach Kategorie mit Counts
- Kommentar-Items mit farbigem Left-Border pro Kategorie
- Edit-Button pro Kommentar
- Hover-only Actions (weniger visuelles Rauschen)

**Iframe-Badges:** Kategorie-Emoji + Nummer statt nur Nummer. Farbe folgt der Kategorie.

**Presentation-Mode (🎬):** Vollbild-Slideshow, links das Element im Iframe (auto-scrolled, farb-highlighted), rechts der Kommentar in groß mit Kategorie-Badge + Priorität. Navigation per Pfeiltasten, Space, Esc.

**Onboarding-Coach-Mark:** Erste Öffnung im Feedback-Modus zeigt 3-Schritte-Erklärung.

**Kommentar-Bearbeiten:** ✎-Button pro Item.

**Markdown-Export:** nach Kategorie gruppiert, nach Priorität sortiert, mit Übersichts-Header + Prioritäten-Zusammenfassung.

**Datenmigration:** v1-Kommentare werden automatisch mit Default-Kategorie/Priorität in v2 überführt.

## 0.1.2 — 2026-07-07 — Iter 2

- CORS-Precheck bereits im Setup-View (fetch-HEAD) mit Content-Type-Warnung
- Clipboard-Fallback via `document.execCommand("copy")` für unsichere Kontexte
- Feedback-URL wird sofort gezeigt, CORS-Status separat gefüllt

## 0.1.1 — 2026-07-07 — Iter 1

- `saveComments` fängt Quota-Fehler ab, rollt Kommentar bei Failure zurück
- Modal-Shortcuts (Esc / Ctrl+Enter) auf document-Level statt Textarea-only
- Optional „Von"-Feld pro Kommentar, persistent im Browser
- Autor erscheint in Sidebar und Markdown-Export

## 0.1.0 — 2026-07-07 — MVP

- Single-file `index.html` mit Setup- und Feedback-View
- Iframe-Loader via `fetch()` + `srcdoc`, `<base>`-Injection für relative Assets
- Klick-basierte Element-Auswahl, Hover-Highlight, Cursor-Wechsel
- CSS-Selector-Generator mit Id- und `nth-of-type`-Fallback
- Kommentar-Modal (Esc / Ctrl+Enter Shortcuts)
- Sidebar-Liste mit Nummerierung, Löschen, Klick-zum-Fokussieren
- Badges im Iframe pro kommentiertem Element
- Markdown-Export (Download + Zwischenablage)
- CORS-Fallback via HTML-Paste
- `demo.html` als Test-Target
- `LOOP_PROMPT.md` mit Qualitätskriterien für Selbst-Iteration
