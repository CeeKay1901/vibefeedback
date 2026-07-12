# Changelog

## Bekannt / Offen

- **Kontext-Capture bei Mini-Elementen**: Klick auf ein sehr kleines Element (einzeilige `<p>`, 24-px-Überschrift) erzeugt einen schmalen Screenshot-Streifen ohne Kontext — der Empfänger erkennt nicht, wo auf der Seite das Element liegt. Idee: bei Rect-Höhe < ~48 px bzw. Fläche < ~10 000 px² stattdessen den nächsten passenden Vorfahren capturen (max. 3 Ebenen hoch) und das Ziel-Element im Bild markieren. (Übernommen aus dem gelöschten `FIXPLAN.md`, Finding 2 vom 2026-07-10; Findings 1 und 3 sind erledigt.)

## Export-Härtung — 2026-07-12 — geprüft in echter Arbeitsumgebung

Alle Export-Wege (Markdown, ZIP, JSON, CSV, Dashboard-„Alles exportieren", Re-Import) wurden gegen **echte Live-Websites** erzeugt und geprüft — neues Labor `npm run export:lab` (echte Screenshots, echte Selektoren). Daraus 13 verifizierte Fixes/Optimierungen.

### fixed (Datenverlust im Kollaborations-Roundtrip)
- **Reaktionen (👍/👎) gingen bei jedem Re-Import verloren** — `importItems` setzte sie hart auf leer. Jetzt werden sie übernommen (dedupliziert, gedeckelt).
- **Bekannter Kommentar beim Re-Import: neue Antworten & Reaktionen eines Helfers wurden verworfen** — der Merge-Zweig übernahm nur den Status. Jetzt werden neue Replies angehängt (dedupliziert nach id) und Reaktionen vereinigt. Neue Regressionstests in `tests/test_status_tool.js`.
- **Reply-Reaktionen** werden beim Import ebenfalls übernommen statt zurückgesetzt.

### changed (Markdown-Export prompt-tauglicher)
- Strukturierte Template-Felder (z. B. Ist/Soll nach Kategorie-Wechsel) erscheinen jetzt auch im **lesbaren Fließtext**, nicht nur im JSON-Block.
- Titel-Fallback nutzt den **CSS-Selektor** statt eines wertlosen `<svg>`/`<div>` — bleibt ein eindeutiger Anker fürs Coding-LLM.
- „Aufwand nach Priorität" → „Items nach Priorität" (es war immer eine Anzahl, kein Aufwandsmaß).
- Platzhaltertext beim reinen Markdown-Export verweist nicht mehr auf ein nicht erzeugtes ZIP.
- Robuster Sort-Tiebreak (ISO-String- **und** Epoch-Zeitstempel) statt `NaN`.

### changed (CSV / Dashboard für deutsches Excel)
- **Semikolon** als Feldtrenner (deutsches Excel legte bei Komma alles in Spalte A).
- **CSV-/Formel-Injection** entschärft: Werte mit führendem `=`,`+`,`-`,`@` bekommen ein Schutz-Apostroph.
- Zeitpunkt-Spalte **de-DE-lesbar** (`9.7.2026, 19:18:08`) statt ISO-UTC.
- Screenshot-Spalte zeigt den **Dateipfad** zur beiliegenden Bilddatei statt nur „ja/nein".

### changed (ZIP-Robustheit)
- feedback.json im ZIP trägt jetzt zusätzlich `screenshotFile` (Ordner-Fallback beim Re-Import), **ohne** das eingebettete base64 zu entfernen — der Standalone-Import der feedback.json bleibt intakt (weiter durch `tests/test_zip_export.js` abgesichert).

## Struktur-Aufräumen — 2026-07-12

Reine Umstrukturierung, **kein** Verhaltens- oder Feature-Change. Ziel: verständlicherer, aufgeräumter Root — leichter zu warten. Deploy bleibt buildlos (GitHub Pages, Push = live). Alle Tests (`npm test`), der Build (`npm run build`) und der Audit (`npm run audit`) laufen unverändert grün.

### changed
- **`index.html` entflochten**: Das riesige Inline-`<style>` liegt jetzt in `styles.css`, das komplette Inline-`<script>` in `app.js`. `index.html` schrumpft von ~3888 auf ~270 Zeilen und lädt beide als Geschwister-Dateien. Verhalten identisch. `npm run build` schreibt die Bookmarklet-Zeile jetzt in `app.js` (vorher `index.html`).
- **Ordner statt Root-Wildwuchs**: Die 7 Demo-Dateien liegen in `demos/`, alle Playwright-Tests in `tests/`, `superaudit.js` neben dem Build-Skript in `scripts/`. Alle Aufrufer (Produktions-Links, Test-URLs, Audit-Seeds) wurden mitgezogen.
- **README** um einen kommentierten Projektstruktur-Baum ergänzt; veraltete Angaben korrigiert (Testanzahl, Bookmarklet-Zielort).

### removed
- Veraltete/erledigte Doku (`AUDIT_REPORT.md`, `FIXPLAN.md`, `LOOP_PROMPT.md`) und sechs verwaiste, an kein npm-Skript gebundene Audit-/Test-Skripte. Der einzige noch offene Punkt aus `FIXPLAN.md` wurde nach „Bekannt / Offen" (oben) gerettet.

### fixed
- Vier Tests legen ihren `test_artifacts`-Ausgabeordner jetzt selbst an (`mkdirSync`), statt sich auf einen zufällig vorhandenen Ordner zu verlassen — `npm test` läuft damit auch auf einem frischen Clone.

## 1.9.0 — 2026-07-12 — Screenshot ist opt-in (kein Auto-Capture)

Bisher wurde bei jedem Kommentar automatisch ein Element-Screenshot aufgenommen und mitgespeichert. Jetzt speichert VibeFeedback **standardmäßig ohne Screenshot** — erst ein Klick auf die 📷-Schaltfläche lädt die Capture-Engine und nimmt auf.

### changed
- **Kein Auto-Capture mehr beim Öffnen der Kommentar-Bar.** Der Annotator wird erst bei 📷-Klick erzeugt (lazy) — die Screenshot-Engine (modern-screenshot) lädt also nur, wenn wirklich ein Screenshot gewünscht ist.
- Beim Wechsel auf ein anderes Element wird ein bereits aufgenommener Screenshot verworfen (kein automatisches Neu-Aufnehmen).
- **Bookmarklet** analog: neuer „Aufnehmen"-Button im Modal; ohne Klick kein Screenshot. Neu gebaut.
- Eigener Screenshot per Zwischenablage (📋 / Strg+V) funktioniert unverändert und ohne 📷.
- Button-Titel/Hints angepasst („optional — leer = kein Screenshot").

### tests
- `test_bugfixes` [5] auf Opt-in umgeschrieben (Standard ohne / nach 📷 mit); `test_annotator`, `test_paste_shot`, `test_demo_pages`, `test_zip_export` nehmen den Screenshot jetzt explizit per 📷 auf. Alle 13 Dateien grün.

## 1.8.0 — 2026-07-11 — Eigene Icons statt Emojis (Lucide) im gesamten UI

Alle Emojis im UI durch selbstgehostete Inline-**Lucide**-Icons (stroke, `currentColor`) ersetzt — einheitliches, professionelles Bild statt bunter System-Emojis, konsistent mit der pilot-Ästhetik.

### changed
- **Kategorien** → Lucide: Bug=`bug`, Feature=`sparkles`, Design=`palette`, Copy=`type`, Frage=`circle-help`, Lob=`heart`. Überall: Kommentar-Bar, Sidebar, Badges im iframe, Dashboard-Charts/Tabellen/Karten, Landing-Mock.
- **Status** → `circle`/`loader-circle`/`circle-check`; **Toolbar/Aktionen** → `camera`, `clipboard`, `crosshair`, `corner-left-up`, `chevron-down`, `message-square`, `mouse-pointer`, `monitor`, `presentation`, `map-pin`, `pencil`, `trash-2`, `thumbs-up/down`, `download`, `refresh-cw`, `play`, `bot` u. a.
- **Landing-Feature-Cards** und **Coach-Overlay** auf Icons umgestellt; Topbar-Mobile-Icons (`::before`-Emoji) durch Inline-SVG ersetzt.
- **Bookmarklet** (`layer.js`) ebenfalls umgestellt + neu gebaut.
- Icon-System: `ICON_PATHS` + `icon(name,size)`-Helfer in `index.html`, `dashboard.html` und `layer.js`; CSS-Klasse `.ic`.

### unverändert
- **Markdown-Export** behält die Emojis (🐛 etc.) bewusst als kompakte LLM-Marker — dort lässt sich kein SVG einbetten.

Tests: `test_badge_numbers` auf Icon-Badges angepasst; alle 13 Test-Dateien grün. Landing/Tool/Dashboard visuell abgenommen.

## 1.7.0 — 2026-07-11 — Kategorie & Priorität immer sichtbar — smart & kompakt

Rückmeldung zu 1.5.0: Kategorie und Priorität sollen nicht im Expand versteckt, sondern **immer sichtbar** sein — aber platzsparend. Umgesetzt als kompakter Meta-Strip direkt über dem Kommentarfeld:

### changed
- **Kategorie als Emoji-Strip**: alle sechs Kategorien als kleine Emoji-Chips; nur das **aktive** Chip blendet zusätzlich sein Label ein (+ Kategorie-Farbe). Voller Name & Sub bleiben als `title`/`aria-label` erhalten. Eine Reihe statt drei.
- **Priorität** als kurze Chips (Muss/Sollte/Könnte/Nice) daneben.
- Beide sind jetzt Teil der Kompakt-Ansicht (aus dem Expand zurückgeholt); das Expand behält Element-Details, Templatefelder und Autor.

So sieht man Kategorie + Priorität auf einen Blick und kann sie mit einem Tap ändern, ohne dass die Bar wieder überladen wirkt. Hilfsskripte auf „Chips im Compact" zurückgestellt. Alle 13 Test-Dateien grün.

## 1.6.0 — 2026-07-11 — Design-Politur mit den pilot-Design-Skills

Kuratierte Qualitäts-Politur innerhalb der bestehenden pilot-Identität (warmes Papier, Signal-Gelb, Ink, Inter/JetBrains Mono) — kein Redesign, sondern die Ausführung gehoben (design-assets + frontend-design). Bewusst ohne Scroll-Animationen (wirken schnell „AI-generiert").

### changed
- **Mehrstufige, zum Ink getönte Schatten** statt einlagiger: cbar, Sidebar-Karten, Modals, Landing-Feature-Cards, Mock-Frame und Dashboard-Kacheln bekommen weiche, glaubwürdige Tiefe (`--shadow-sm/--shadow/--shadow-lg`, hell + dunkel, `index.html` + `dashboard.html`).
- **Fokus-Ring** neu: Ink-Kontur (hoher Kontrast, WCAG) + gelber Halo (Marke) statt gelber Kontur auf Weiß — sichtbar auf hell und dunkel; in beiden Dateien vereinheitlicht.
- **Feine Papier-Körnung** (`noise.svg`, feTurbulence) nur auf der Landing (nicht über der Ziel-iframe im Tool) — Textur statt flacher Fläche, Opazität ~0.035.
- `scroll-behavior:smooth` (mit `prefers-reduced-motion`-Ausnahme), `text-wrap:balance` am Hero-Titel, `::selection` in Brand-Gelb (bereits in 1.4.0).

Rein additive/visuelle Änderungen — kein Layout-, Logik- oder Bookmarklet-Eingriff. Alle 13 Test-Dateien grün; Landing/Tool/Dashboard visuell abgenommen.

## 1.5.0 — 2026-07-11 — Kommentar-Bar radikal vereinfacht: nur Name + Kommentar

Die Kommentar-Eingabe war dreiteilig (Kategorie-Chips + Prioritäts-Chips + Text) — zu viel zum Ausfüllen. Jetzt zeigt die Kompakt-Ansicht **nur das Kommentarfeld** (und beim ersten Mal das Namensfeld). Schnell ausgefüllt, während der Export dem LLM trotzdem die wichtigsten Infos liefert.

### changed
- **Kategorie- und Prioritäts-Chips ins Expand (⌄) verschoben**, als „Kategorie (optional)" / „Priorität (optional)" mit Gruppen-Labels. Standard-Ansicht = Ziel + Kommentar + Speichern.
- Textfeld ist jetzt klar das Hauptfeld („Dein Kommentar – was ist dir aufgefallen? …"), nicht mehr als „Zusätzliche Notiz" degradiert.
- Der Export bleibt reichhaltig: Selektor, Fallback-Identifier, Screenshot, HTML-Snippet, Element-Kontext (Rolle/Klassen/Styles/Position) und Seite werden **automatisch** erfasst — plus der Kommentar. Kategorie/Priorität fließen ein, wenn gesetzt (sonst sinnvoller Default, gemerkt über [[letzte Wahl]]).

Die strukturierten Template-Felder (Erwartet/Tatsächlich/Schritte …) bleiben als optionales Detail im Expand — für alle, die dem LLM mehr geben wollen.

Kein Kern-Test klickt die cbar-Chips (die Suite speichert mit Default) → alle 13 Test-Dateien grün; Hilfsskripte (`test_phase4` u.a.) auf „erst aufklappen" angepasst; funktional + visuell (Desktop/Mobile) abgenommen.

## 1.4.1 — 2026-07-11 — Mobile: Bedienelemente kompakter

Rückmeldung: Buttons auf dem Handy noch etwas zu groß. Touch-Ziele bleiben gut tippbar, aber enger:
- Kommentar-Bar: Kategorie-/Prio-Chips 40→34 px, Icon-Buttons 44→38 px, Abbrechen/Speichern 44→38 px → die cbar ist ~31 px niedriger, mehr Seite bleibt sichtbar.
- Topbar-Aktionen 44→40 px, Sidebar-Export-Buttons kompakter (kleinere Schrift/Padding, weniger Umbruch).

Nur `@media(pointer:coarse)`/`max-width:640px` in `index.html` — Desktop und Dashboard unberührt. Alle 13 Test-Dateien grün.

## 1.4.0 — 2026-07-11 — Typografie: selbstgehostete pilot-Fonts (Inter + JetBrains Mono)

Die App war für die pilot-Brandfont „Centra No1" (kommerziell) gebaut, rendete aber mangels Font in System-Schrift (auf Android/Linux inkonsistent). Jetzt der dokumentierte pilot-Fallback **Inter** (UI) + **JetBrains Mono** (Selektoren/Snippets/Tags), selbstgehostet.

### feat
- `fonts/inter-variable.woff2` (48 KB) + `fonts/jetbrains-mono-variable.woff2` (40 KB), variabel, latin (deckt Deutsch). `@font-face` mit `font-display:swap`, keine Google-Fonts-CDN (offline/DSGVO). In `index.html` **und** `dashboard.html`.
- Font-Stacks: `"Centra No1","Inter",…` primär, `"JetBrains Mono",ui-monospace,…` für alle Mono-Stellen; `text-rendering:optimizeLegibility`; `::selection` in Brand-Gelb.
- Bookmarklet (`layer.js`) bewusst **nicht** angefasst — es wird in fremde Seiten injiziert und lädt keine App-Fonts.

### fix
- Dashboard-Detail lief auf 390 px um 6 px über (Inters breitere Metrik trieb die Status-Segmentbuttons über die Kommentar-Spalte): Buttons auf Mobil schmaler (`padding:9px 8px`, Höhe/Touch bleibt ≥35 px) + `min-width:0` auf die flexible Kartenspalte.

Verifiziert: alle 13 Test-Dateien grün (`npm test`), Font-Ladung + 390-px-Overflow separat gemessen, Landing/Tool/Dashboard visuell abgenommen.

Hinweis: Beim Umstellen der Mono-Stacks hatte ein globales Replace versehentlich die generierte Bookmarklet-Zeile getroffen — via `npm run build` aus dem unveränderten `layer.js` sauber neu erzeugt.

## 1.3.1 — 2026-07-11 — Mobile-Fix: Kommentar-Bar fraß den halben Bildschirm

Auf dem Handy (echte Emulation, iPhone 13) belegte die Kommentar-Bar ~63 % des Viewports, Chips waren riesig und die Aktionsleiste überlappte sich. Behoben:

### fix
- **Kategorie-Sublabels auf Mobil ausgeblendet** („Etwas funktioniert nicht" etc.) — die Chips schrumpfen von ~174 px auf ~67 px Breite (2 Reihen statt 3+). (Der `<span>` trug ein Inline-`display:block`, daher via `!important` überschrieben; `aria-label` behält die volle Beschreibung für Screenreader.)
- **Aktionsleiste bricht sauber** statt sich zu überlappen: „Speichern" liegt jetzt als volle Breite unter „Abbrechen". Ursache war das `min-width:44px` aus 1.2.0, das die Buttons am Schrumpfen hinderte → auf Mobil `min-width:0; flex:1 1 130px`.
- **Textarea 16 px auf Mobil** → verhindert den iOS-Zoom-Sprung beim Fokussieren.
- **Topbar entdichtet**: das nicht-interaktive Rollen-Badge („Owner-Dashboard"/„Feedback-Modus", der längste Text) ist auf Mobil ausgeblendet.
- Kleinere cbar-Paddings/Gaps auf Mobil.

Alle Änderungen ausschließlich in `@media(max-width:640px)` — Desktop unberührt. Verifiziert mit echter Mobile-Emulation (`test_mobile_shots.js`) und der vollen Suite (13/13 grün, inkl. 390-px-Usability-Test).

## 1.3.0 — 2026-07-11 — Kernfeature-Optimierung: schneller kommentieren, nichts verlieren, nicht doppeln

Produkt-Review der Kernfeatures (Element-Kommentierung → Export). Drei fokussierte Verbesserungen am Kern-Job „präzises Feedback sammeln":

### feat / fix
- **Letzte Kategorie & Priorität werden gemerkt** (pro Projekt, localStorage): Ein neuer Kommentar startet mit der zuletzt genutzten Wahl statt immer `feature/could`. Serien gleichartiger Rückmeldungen (z. B. mehrere Bugs) ohne Wiederholklicks. Edits bleiben unberührt; Werte werden gegen gültige Kategorien/Prioritäten geprüft.
- **Ungespeicherter Entwurf geht nicht mehr still verloren**: `beforeunload`-Warnung, wenn die offene Kommentar-Bar getippten, noch nicht gespeicherten Inhalt hat (Freitext oder Templatefeld). Bei Edits bewusst keine Warnung.
- **„Element schon kommentiert"**: Klick auf ein Element (oder seinen Badge), das bereits Kommentare hat, springt zum bestehenden Kommentar (Sidebar-Highlight + Element-Puls im iframe) und bietet per Toast „Neuen hinzufügen" an — statt blind einen zweiten Kommentar zu öffnen. Dedup + Kollaboration; behebt zugleich, dass ein Badge-Klick vorher einen Kommentar auf dem Badge selbst startete. Zählt nur Kommentare der **aktuellen** Seite (kein Fehl-Match über Subpages).

### intern
- `undoToast` verallgemeinert zu `actionToast(msg, label, fn)` (Basis für den „Neuen hinzufügen"-Hinweis).

Neu: `test_phase4.js` (10 Checks: isDirty-Guard, Merken der Wahl, Bereits-kommentiert-Fluss). Alle 13 Test-Dateien grün (`npm test`, Exit 0).

## 1.2.0 — 2026-07-11 — UI-Review-Sweep über alle drei Oberflächen (a11y & Bedienung)

Systematischer UX/UI-Review von Landing, Tool-Flow und Dashboard (Code-Analyse je Oberfläche + reale Screenshots Desktop/Mobile via `ui_review_shots.js`). Die Kritisch- und Hoch-Befunde sind umgesetzt:

### fix (Tastatur & Screenreader)
- **Kategorie-/Prioritäts-Chips waren per Tastatur nicht auslösbar** (`role=button` ohne keydown): jetzt echte `role=radiogroup`/`radio` mit Enter/Space + Pfeiltasten (Roving-tabindex) und `aria-checked` statt reiner Farbmarkierung.
- **Toasts ohne `aria-live`**: jetzt `role=status` + `aria-live` — Speichern-Erfolg und die Leer-Validierung werden angesagt.
- **Dashboard-Filter-Chips** tragen jetzt `aria-pressed`; nach dem Redraw (`draw()`) wird der **Fokus auf den bedienten Filter/Status zurückgesetzt** (vorher fiel er auf den Seitenanfang → Tastatur-Filtern unbrauchbar).

### fix (Datensicherheit)
- **Einzelnen Kommentar löschen** war sofort & endgültig (nur „Alle löschen" hatte confirm): jetzt **Undo-Toast** („Kommentar gelöscht — Rückgängig", 6 s).

### fix (Kontrast & Touch, WCAG AA)
- Globale Tokens `--muted`/`--dim` abgedunkelt (hell) bzw. aufgehellt (dunkel) auf ≥4.5:1 — betraf fast allen Hilfs-/Kleintext in Tool **und** Dashboard.
- Landing: **CORS-Statustext** war als hellgrüner/gelber Text kaum lesbar (~2.3:1) → dunkler Text auf getöntem Chip, Semantik weiter über ✅/⚠️.
- Touch-Targets auf `pointer:coarse`: Kategorie-/Prio-Chips, cbar-Icon-Buttons und die Bearbeiten/Löschen-Icons (vorher hover-only + winzig) auf ≥40–44 px; ✕ vom ✎ abgesetzt.

### fix (Landing-Feinschliff)
- URL-Feld: `inputmode=url`, `autocomplete=url`, `autocapitalize=off`, `spellcheck=false`.
- Workflow-Schritt-Überschriften `h4`→`h3` (lückenlose Heading-Hierarchie unter dem `h2`).
- Dashboard: Filter-Leerzustand bekommt einen „Filter zurücksetzen"-Button (kein Dead-End mehr).

### bewusst offen (nächste Runde)
- Sidebar-Kommentare & Breadcrumb-Chips (`div`/`span`+onclick) noch nicht tastaturbedienbar.
- Landing: Kern-Eingabe („Link erzeugen") liegt unter dem Fold — Umbau in den Hero ist eine Design-Entscheidung.
- Lightbox-Focus-Trap, Nav-Buttons→Links, doppeltes Autor-Feld, Chart-Re-Animation beim Filtern.

Tests: alle 13 Dateien grün (`npm test`, Exit 0); zusätzlich visuell über den Screenshot-Sweep abgenommen.

## 1.1.0 — 2026-07-11 — Export ist LLM-tauglicher (Kernfeature-Realitätscheck)

Das Kernfeature — der Feedback-Export als Prompt-Grundlage — wurde end-to-end gegen die echte Live-Seite kippflix.com durchgespielt: je ein **Bug**, ein **Feature** und eine **Design**-Verbesserung, mit ausgefüllten Template-Feldern, Priorität und echten Auto-Screenshots (`test_export_quality.js`). Der erzeugte Markdown wurde als LLM-Input bewertet. Inhaltlich stark (KI-Preamble, strukturierte Templates, Fallback-Identifier, Grounding, pixeltreue Screenshots) — drei Schwachstellen wurden gefunden und behoben:

### fix
- **Reiner Markdown-Export war zu 88 % base64-Ballast.** Zwischenablage- und Download-Export betteten die Screenshots als data-URLs ein (62 KB, davon 55 KB base64) — für einen Chat-LLM unbrauchbares Rauschen, das zudem nicht als Bild gerendert wird. Der reine Text ist jetzt **~7,6 KB** und prompt-fertig; jeder Screenshot erscheint als Hinweis „_als Bilddatei im ZIP-Export enthalten_". Bilder gibt es weiterhin verlustfrei im **ZIP** (`feedback.json` + `screenshots/`), das auch re-importierbar bleibt.
- **Design-/Kontrast-Findings waren nicht überprüfbar:** Der Element-Kontext zeigte den *eigenen* (meist transparenten) Hintergrund `rgba(0,0,0,0)` statt des gerenderten. Jetzt liefert `elementInfo` bei transparentem Hintergrund den **effektiven** Hintergrund aus der Elternkette (`effectiveBackground`) — z. B. `rgb(255,255,255) / rgb(20,20,20)` statt `/ rgba(0,0,0,0)`. Das LLM kann eine Kontrast-Aussage jetzt tatsächlich prüfen (oder widerlegen).
- **Nichtssagende Überschriften:** Bei Elementen mit langem Text (> 70 Zeichen, z. B. ein Hero-`<div>`) fiel der Item-Titel auf den rohen Tag `<div>` zurück („Implementiere: <div>"). Jetzt: gekürzter sichtbarer Text als Fallback vor dem rohen Tag.

Kein `layer.js`/Bookmarklet-Eingriff nötig (eigener, schlanker Export). Tests: alle 13 Dateien grün (`npm test`, Exit 0); der ZIP-Export-Test deckt „keine data-URLs im reinen Markdown" mit ab. Neu: `test_export_quality.js` (Live-Realitätscheck, netzabhängig).

## 0.14.0 — 2026-07-10 — Screenshots schneiden die letzte Zeile nicht mehr ab

Der Kernfeature-Test gegen fünf echte Seiten (`npm run test:sites`) förderte einen systematischen Screenshot-Defekt zutage — jetzt behoben.

### fix
- **Element-Screenshots waren vertikal abgeschnitten** (Finding 1 aus `FIXPLAN.md`): Bei Überschriften mit enger `line-height` (< Glyphenhöhe, auf echten Seiten der Normalfall) ragen die Zeichen über die Element-Box hinaus. modern-screenshot rasterte aber stur auf die Box-Höhe → die letzte Zeile bzw. die Unterlängen fehlten. Auf **allen** fünf Testseiten sichtbar (kippflix.com, ideen-hangar, pilot-skillmarkt, WochenplanerAnna, cv).
  - Fix ohne fragile Font-Metrik-Rechnung: großzügig höher rastern (`domToCanvas` mit `height`-Reserve proportional zu Rect-Höhe und `font-size`), dann den einfarbigen Überschuss am unteren Rand per Ink-Scan wieder abschneiden (`trimCanvasBottom`). Robust gegen jede Metrik-Drift, egal ob Webfont, Fallback-Font oder enge Zeilenhöhe.
  - Vor dem Capture wird zusätzlich `document.fonts.ready` abgewartet, damit Klon und Original dieselbe Metrik sehen.
- Regressionstest: `test_screenshot.html` hat zwei neue Fixtures (enge `line-height` mit Webfont und mit System-Font); `test_screenshot.js` prüft, dass das Bild die volle Inhaltshöhe abdeckt **und** unten tatsächlich Glyphen-Tinte liegt (gegen ein „genug hoch, aber leer"-Scheingrün).

Tests: 267 Checks (+4 im Screenshot-Test). Verifiziert gegen alle fünf Live-Seiten via `npm run test:sites`.

## 0.13.1 — 2026-07-10 — Usability-Audit umgesetzt

Fokussierter Usability-Audit (Mobile, Tastatur, Touch, Leere Zustände) mit fünf Findings — alle behoben:

- **Mobile-Topbar lief aus dem Viewport** (573 px Seitenbreite bei 390 px): die ganze Seite scrollte horizontal, zwei von drei Buttons waren abgeschnitten. Jetzt bricht die Topbar auf schmalen Screens in eine zweite Zeile um.
- **Seiten-Tabelle drückte die Karte aus dem Viewport** statt intern zu scrollen (`min-width:auto`-Falle bei Grid-Items) — `.grid>*{min-width:0}`.
- **Lightbox war nicht tastaturbedienbar**: Thumbnails sind jetzt fokussierbar (`role=button`, Enter/Leertaste öffnet), es gibt einen sichtbaren ✕-Button, der Fokus wandert beim Öffnen auf den Schließen-Button und beim Schließen zurück zum Thumbnail.
- **Touch-Targets zu klein** (Status-Schalter 24 px, Seiten-Links 16 px hoch): auf Touch-Geräten und schmalen Screens jetzt ≥ 35 px — auch für den Status-Button in der Tool-Sidebar.
- **Suche ohne Treffer** zeigte nur eine leere Liste: jetzt klare Meldung mit „Suche leeren"-Aktion. Dazu: **„/" springt in die Suche** (wie bei GitHub), ohne beim normalen Tippen zu stören.

Tests: 291 Checks; neu `test_dashboard_usability.js` (kein horizontales Scrollen auf 390 px, Touch-Größen, komplette Tastatur-Lightbox inkl. Fokus-Rückgabe, Null-Treffer-Zustand, Shortcut).

## 0.13.0 — 2026-07-10 — Dashboard-Ergonomie: Deep-Links, Suche, Lightbox

### feat
- **Hash-Routing**: Jede Projektansicht hat jetzt eine eigene URL (`dashboard.html#p=<url>`). Reload bleibt im Projekt, der Browser-Zurück-Button funktioniert, und die Ansicht lässt sich als Link teilen — wichtig für die kollaborative Nutzung. Unbekannte oder kaputte Hashes fallen sauber auf die Übersicht zurück.
- **Screenshot-Lightbox**: Klick auf ein Thumbnail öffnet den (ggf. annotierten) Screenshot in Großansicht mit dem Kommentartext als Bildunterschrift; Klick oder Esc schließt. Vorher waren die 96-px-Vorschauen eine Sackgasse.
- **Volltextsuche** in der Kommentarliste (Text, Selektor, Autor:in, Seitenpfad) — filtert live ohne Redraw, mit Trefferanzeige, kombinierbar mit den Kategorie-/Prioritäts-/Status-Filtern.
- **Sortierung** der Kommentare: Neueste zuerst, Älteste zuerst oder nach Priorität.
- **Abhaken direkt in der Arbeitsliste**: Jeder Punkt in „Nächste Schritte" hat einen „✓ erledigen"-Button.

Tests: 274 Checks; neu abgedeckt Deep-Link über Reload, Suche inkl. Trefferzahl, Prioritäts-Sortierung, Lightbox öffnen/schließen, Arbeitslisten-Haken.

## 0.12.0 — 2026-07-10 — Status-Workflow im Tool + Kollaborations-Merge

Der in 0.11.0 eingeführte Bearbeitungsstatus war nur im Dashboard sichtbar. Jetzt ist der Kreis geschlossen:

### feat
- **Status direkt in der Tool-Sidebar**: Jeder Kommentar trägt ein Status-Badge (○ Offen / ◐ In Arbeit / ✓ Erledigt), ein Klick schaltet weiter. Erledigte Items werden gedimmt, die Stats-Zeile zählt Erledigtes mit.
- **Import übernimmt Status statt ihn zu verwerfen**: Bisher wurden bekannte Kommentare (gleiche id oder Selector+Zeitstempel) beim Import komplett übersprungen — Status-Updates aus dem Export eines Helfers gingen verloren. Jetzt wird der mitgelieferte Status auf den vorhandenen Kommentar gemergt (auch als *reiner* Merge ohne ein einziges neues Item, inkl. Speichern). Der Toast meldet „N Status übernommen" statt fälschlich „Duplikate übersprungen". Das ist der Kollaborations-Roundtrip: Helfer arbeitet Punkte ab → exportiert → Owner importiert → Fortschritt ist da.
- **Markdown-Export kennzeichnet den Status**: ✓/◐ in der Überschrift, Status in der Meta-Zeile, Status-Summe im Kopf und eine explizite Anweisung an den KI-Assistenten, Erledigtes nur zu prüfen statt neu umzusetzen.

### fix
- Ungültige/fremde `status`-Werte aus Importen werden ignoriert (Whitelist), offen bleibt als fehlendes Feld gespeichert.

Tests: 263 Checks; neu `test_status_tool.js` (Sidebar-Toggle, Markdown-Kennzeichnung, Merge per id und per Fingerprint, Merge-only-Persistenz, Whitelist).

## 0.11.0 — 2026-07-10 — Dashboard wird Projekt-Cockpit

Das Dashboard ist jetzt der Ort, an dem man ein Projekt *steuert*, nicht nur ansieht — gedacht auch für die spätere kollaborative Nutzung (jemand bietet Unterstützung beim Bauen an und arbeitet die Punkte ab).

### feat
- **Status-Workflow pro Kommentar**: Offen ○ / In Arbeit ◐ / Erledigt ✓, direkt am Kommentar umschaltbar. Persistiert im `localStorage` (fehlendes Feld = offen, keine Migration nötig), überlebt Export → ZIP → Re-Import ins Tool (`importItems`-Whitelist und der JSON-Block des Markdown-Exports kennen `status` jetzt). Erledigtes wird gedimmt, zählt aus „Offen"-Kacheln, Arbeitsliste und Prompt heraus.
- **Projekt-Karten in der Übersicht** statt Tabelle: Fortschrittsbalken (erledigt/gesamt), offene Muss-Fixes, Screenshots, Seiten, Top-Kategorien, Autor:innen — und je Karte der direkte Sprung „▶ Im Tool öffnen".
- **Detailansicht als Cockpit** mit Aktionsleiste:
  - **▶ Im Feedback-Tool öffnen** (Primär-CTA) — das Projekt direkt im Owner-Modus.
  - **🔗 Feedback-Link kopieren** — der Teilen-Link für Tester:innen.
  - **🤖 Prompt kopieren** — alle offenen Punkte als fertiger Arbeitsauftrag fürs Coding-Tool, nach Priorität gruppiert, mit Seite + Selektor.
  - **⬇ Projekt exportieren** — ZIP nur für dieses Projekt (gleiches Format wie „Alles exportieren").
- **Mehr Insights pro Projekt**: eigene Kategorie- und Prioritäts-Charts, „Nächste Schritte"-Arbeitsliste (offene Punkte, dringendste zuerst), Seiten-Tabelle mit Muss/Offen-Spalten und Absprung je Unterseite, „Brennpunkte" (mehrfach kommentierte Elemente), Status-Filter zusätzlich zu Kategorie/Priorität, Kacheln für Offen/Erledigt/Muss-offen.
- **Export kennt den Status**: `kommentare.csv` hat eine Status-Spalte, `feedback.json` trägt das Feld unverändert.

### fix
- Übersichts-Kachel „Muss-Fixes" zählt jetzt nur noch *offene* Muss-Punkte — erledigte Blocker sind keine Blocker mehr.

Tests: 243 Checks (vorher 208); neu abgedeckt u. a. Status-Persistenz über Reload und Re-Import, Prompt-Inhalt, Einzelprojekt-Export, Seiten-Links, Projekt-Karten.

## 0.10.0 — 2026-07-09 — Alles exportieren + ein ZIP-Writer statt zwei

### feat
- **„⬇ Alles exportieren" im Dashboard**: sichert alle Projekte in einem Archiv.
  - `feedback.json` — alle Kommentare; **im Tool importierbar**, die Bilder werden über `screenshotFile` aus den Projektordnern nachgeladen.
  - `kommentare.csv` — eine Zeile je Kommentar (RFC-4180-konform, mit BOM für Excel), für Auswertung in der Tabellenkalkulation.
  - `<projekt>/screenshots/01-….jpg` — die Bilder als normale Dateien, je Projekt ein Ordner.
  - `README.md` mit Überblick und Projektliste.
  - Bewusst kein Prompt-Markdown: das baut das Tool selbst, und eine zweite Kopie dieser Logik wäre eine Fehlerquelle.

### refactor
- **Der ZIP-Writer liegt jetzt einmal**: `vf-zip.js` wird von `index.html` und `dashboard.html` geladen. Ohne diesen Schritt hätte das Dashboard eine dritte Kopie bekommen.
- Das **Bookmarklet behält bewusst seine eigene Kopie** — es wird in fremde Seiten injiziert und darf nichts nachladen. Damit sie nicht wegdriftet, prüft `test_zip_parity.js`, dass beide Implementierungen bei gleicher Eingabe **byte-identische** Archive erzeugen. Der Test wurde gegen zwei absichtliche Sabotagen (verändertes Header-Feld, falsches CRC-Polynom) geprüft — er schlägt an.
- `buildZip(files, when)` nimmt den Zeitstempel entgegen. Dadurch ist das Ergebnis reproduzierbar und überhaupt erst vergleichbar.

### fix
- **Ausfallsicherheit gegen die eigene Auslagerung**: Ein fehlendes `vf-zip.js` (404, Adblocker, offline) hätte durch das Destructuring auf oberster Ebene eine Ausnahme geworfen und damit *das ganze Tool und das ganze Dashboard* lahmgelegt — der Router läuft am Skriptende. Jetzt fallen nur die ZIP-Funktionen aus: der Button verschwindet bzw. wird deaktiviert, Markdown-Export und alles andere laufen weiter. Der Fall ist als Test hinterlegt.

## 0.9.1 — 2026-07-09 — Nachprüfung des Dashboards

Eigene Nachkontrolle der 0.9.0-Änderungen; drei Fehler gefunden, die die Tests nicht abgedeckt hatten:

- **Der Entartungs-Fallback war nur halb verdrahtet**: Im Detail degradierten Charts korrekt, in der Übersicht nicht. Wer einen einzigen Kommentar hatte, sah einen Balken zwischen fünf leeren, obwohl `barChart` das bereits als entartet meldete.
- **„Seiten betroffen" zählte zu wenig**: Der Fix aus 0.9.0 zählte nur `pageUrl`-Werte und übersah damit Kommentare ohne Seitenangabe. Bei zwei Projekten (drei Seiten) stand dort „2". Jetzt die Vereinigung der bereits normalisierten Seitenlisten.
- **Die Detailansicht verschwieg einen leeren 30-Tage-Verlauf** (die Übersicht erklärte ihn). Jetzt beide gleich.

Außerdem: Der Testdatensatz hatte in jeder Kategorie genau einen Kommentar — dadurch waren alle Balken gleich lang und die Chartqualität ließ sich gar nicht prüfen. Jetzt mit Varianz, plus explizite Tests für beide Zustände (echtes Chart / degradierte Form).

## 0.9.0 — 2026-07-09 — Dashboard mit Analytics

Neue Seite `dashboard.html`, erreichbar über Navigation und CTA der Startseite. Sie liest ausschließlich den `localStorage` dieses Browsers — kein Backend, nichts wird hochgeladen.

### feat
- **Übersicht**: Stat-Kacheln (Projekte, Kommentare, Muss-Fixes, Screenshot-Quote, Autor:innen, aktive Tage), Kommentare nach Kategorie und Priorität, 30-Tage-Aktivitätsverlauf, Projekttabelle mit Muss-Anzahl, Unterseiten, Screenshots und letzter Aktivität.
- **Projekt-Detail**: alle Kommentare mit Screenshot-Vorschau, Filter nach Kategorie und Priorität, Kommentare pro Unterseite, Beiträge pro Autor:in bzw. mehrfach kommentierte Elemente, Zeitraum, Direktlink ins Tool, Projekt löschen.

### Chart-Handwerk
- Farben nach der Data-Viz-Methode gewählt und mit dem Validator geprüft — **gegen die Fläche, auf der die Marks wirklich liegen** (Balken-Track `#f6f6f3`, nicht die Karten-Fläche). Die erste Rampe fiel dabei durch (heller Endpunkt 1,95:1, Floor ist 2:1) und wurde gespreizt.
- Eine Serie → ein Farbton (kein Wertrampen-Effekt auf nominalen Kategorien). Prioritäten sind geordnet → Ordinal-Rampe, immer mit Text neben dem Farbpunkt.
- **Entartete Charts degradieren**: ein einzelner Balken wird zur Zahl, lauter gleich lange Balken werden zur Tabelle, ein leerer 30-Tage-Verlauf zu einem Satz. Ein Chart, das nichts zeigt, ist schlechter als keins.
- Jedes Chart hat eine Tabellenansicht; Tooltips erscheinen auch bei Tastaturfokus; Dark Mode hat eigene, separat validierte Farbstufen.

### security
- **DOM-XSS im Tooltip geschlossen**: Das Escaping beim Bauen von `data-tip` war wirkungslos, weil der Browser die Entities beim Parsen des Attributs wieder dekodiert und der Wert dann über `innerHTML` in den Tooltip floss. Ein Autorname oder Seitenpfad aus einem manipulierten Import hätte beim Hover Code ausgeführt. Jetzt `textContent`.
- **Screenshots werden validiert**: Nur eingebettete Rasterbilder werden angezeigt. Eine externe URL im Store wäre ein Tracking-Pixel gewesen (Referer-Leak), ein SVG hätte Skripte tragen können.

### fix
- Blockierter `localStorage` (privater Modus, WebViews) zeigt jetzt eine Erklärung statt ewig „Lade …".
- Unbekannte Kategorien/Prioritäten werden als „Sonstige"/„ohne Priorität" geführt, statt in keinem Balken aufzutauchen bzw. fälschlich als „Könnte" zu erscheinen.
- „Seiten betroffen" zählt global distinkte Seiten statt sie je Projekt aufzuaddieren.
- Der `storage`-Event reißt eine offene Detailansicht nicht mehr weg und ignoriert fremde Keys.
- `Math.max(...)`-Spread durch `reduce` ersetzt (RangeError bei sehr vielen Kommentaren).

## 0.8.0 — 2026-07-09 — ZIP-Export und -Import mit Screenshot-Dateien

- **feat: „Als ZIP"** neben „Als Markdown" — in der Sidebar, im Export-Reminder-Banner und im Bookmarklet. Das Archiv enthält:
  - `feedback.md` — dasselbe Markdown, aber die Screenshots sind als Bilddateien **verlinkt** statt als data-URL eingebettet. Damit bleibt die Datei lesbar und klein (vorher blähten Base64-Bilder sie auf ein Vielfaches auf).
  - `feedback.json` — vollständige Daten **inklusive** eingebetteter Screenshots, in VibeFeedback re-importierbar.
  - `screenshots/01-hero-titel.jpg` … — ein Bild je kommentiertem Element, benannt nach Nummer und Elementtext.
  - `README.md` — erklärt den Inhalt für Empfänger.
- **Keine neue Abhängigkeit**: eigener ZIP-Writer (`store`-Methode, CRC32) in ~70 Zeilen. Die Screenshots sind bereits JPEG-komprimiert, eine zweite Kompression brächte kaum etwas.
- **feat: ZIP-Import** — der Datei-Dialog akzeptiert jetzt `.zip` neben `.md`/`.json`. Eigener ZIP-Reader (Central Directory), der `store` und `deflate` auspackt (letzteres über die `DecompressionStream`-API), damit auch von fremden Werkzeugen neu gepackte Archive funktionieren. Enthält das Archiv keine `feedback.json`, werden die Kommentare aus dem JSON-Block des Markdowns gelesen und die Bilder anhand des neuen Feldes `screenshotFile` aus `screenshots/` nachgeladen.
- **Sicherheit beim Import:** Bilder aus dem Archiv werden nur als Raster-dataURL übernommen (kein SVG); IDs und Kategorien laufen durch dieselbe Validierung wie beim JSON-Import. Die Item-Übernahme liegt jetzt in einer gemeinsamen Funktion `importItems`, damit ZIP und Einzeldatei nicht auseinanderlaufen können.
- **fix**: Der JSON-Import akzeptierte nur `{items:[…]}`, nicht `{comments:[…]}` — der eigene JSON-Export ließ sich dadurch nicht re-importieren.
- Verifiziert gegen echte ZIP-Tools: `unzip -t` bestätigt die CRC-Integrität, die extrahierten Bilder sind gültige JPEGs, das Markdown verlinkt sie korrekt. Der Import wurde gegen das eigene Archiv, ein Archiv ohne `feedback.json`, ein von Python deflate-gepacktes Archiv, ein bösartiges Archiv (XSS-Payloads, SVG-„Screenshot") und eine kaputte Datei geprüft (44 Checks in `test_zip_export.js`).

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
- Topbar- und Sidebar-Buttons erfüllen die 44×44-px-Mindestgröße (WCAG 2.5.5) — auf Touch-Geräten und auf schmalen Viewports; die Topbar bleibt dabei einzeilig und scrollt horizontal, statt umzubrechen.
- Veraltete Audit-Heuristik korrigiert: der CORS-Fallback nutzt längst eine Textarea statt `window.prompt()`, der Audit meldete das trotzdem.

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
