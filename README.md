# VibeFeedback

Ein winziges, backend-freies Feedback-Tool für Vibecoding-Projekte.
Du teilst einen Link → deine Tester klicken direkt auf die Elemente, die sie kommentieren wollen → am Ende bekommst du ein sauberes Markdown, das du 1:1 als Prompt-Grundlage nutzen kannst.

**Live:** https://ceekay1901.github.io/vibefeedback/

## Wie es funktioniert

1. **Owner** öffnet `/` (Setup-View), fügt die URL zu einem eigenen Live-Projekt ein.
2. Tool baut einen Feedback-Link der Form `?src=<URL>` und stellt ihn zum Kopieren bereit. Der primäre CTA im Setup-Result öffnet den Link direkt als Owner.
3. **Tester** öffnet den Link, gibt beim ersten Kommentar einmalig seinen Namen ein (wird im Browser gespeichert). Jedes Element ist klickbar → Modal mit lesbarem Element-Label, Kategorie + Priorität, freiem Kommentarfeld.
4. Kommentare landen im `localStorage` des Testers. Ein **Export-Reminder-Banner** erscheint automatisch beim Tab-Wechsel, sobald Kommentare vorhanden sind — so geht kein Feedback verloren.
5. Tester exportiert als Markdown, ZIP (Markdown + Screenshot-Dateien) oder Zwischenablage und schickt die Datei an den Owner (Mail, Chat, PR-Kommentar). Owner nutzt den Inhalt als Prompt-Kontext für die nächste Iteration.

## Was VibeFeedback bewusst NICHT tut

- Kein Backend, keine Auth, keine geteilte DB. Jeder Tester schickt seinen eigenen Export zurück.
- Keine Persistenz über Browser hinweg.

## CORS

Das Iframe wird über `fetch(src)` + `srcdoc` befüllt (damit wir Klicks auf DOM-Ebene sehen). Das Ziel muss also CORS für GET erlauben. GitHub Pages, Netlify, Vercel machen das per default. Falls nicht → Fallback im Fehler-Overlay: HTML direkt einfügen.

## Dashboard

`dashboard.html` (verlinkt von der Startseite) ist das Projekt-Cockpit für alle Projekte, die du in diesem Browser kommentiert hast. Die Daten stammen ausschließlich aus dem `localStorage` — es gibt kein Backend.

- **Übersicht**: Kennzahlen über alles, Kategorie-/Prioritäts-Charts, 30-Tage-Aktivität und je Projekt eine Karte mit Fortschrittsbalken, offenen Muss-Fixes und direktem „▶ Im Tool öffnen".
- **Projekt-Detail**: Aktionsleiste (im Feedback-Tool öffnen, Feedback-Link für Tester:innen kopieren, offene Punkte als **Prompt** fürs Coding-Tool kopieren, Projekt als ZIP exportieren), „Nächste Schritte"-Arbeitsliste mit ✓-Abhaken, Kategorie/Priorität/Seiten/Autor:innen/Brennpunkte-Auswertung und alle Kommentare mit Volltextsuche, Sortierung, Filtern und Screenshot-Lightbox. Jede Projektansicht ist per `#p=<url>` direkt verlinkbar und überlebt den Reload.
- **Status-Workflow**: Jeder Kommentar lässt sich auf Offen ○ / In Arbeit ◐ / Erledigt ✓ setzen — im Dashboard *und* direkt in der Tool-Sidebar. Gespeichert im Browser, sichtbar in Kacheln und Fortschritt, enthalten in Export und Prompt. Grundlage für die kollaborative Nutzung: Wer beim Bauen unterstützt, arbeitet die Liste ab, exportiert — und beim Re-Import übernimmt das Tool die Status-Updates auf bereits bekannte Kommentare (Merge statt Duplikat).

**„Alles exportieren"** packt sämtliche Projekte in ein ZIP: `feedback.json` (wieder importierbar, samt Bildern und Status), `kommentare.csv` für die Tabellenkalkulation und die Screenshots als Dateien in Projektordnern. In der Detailansicht gibt es dasselbe Archiv je Projekt einzeln.

## Features auf einen Blick

- **Export & Import als Markdown, JSON oder ZIP**: Der reine **Markdown-Export** (Zwischenablage/Download) ist bewusst bild-frei — schlanker, prompt-fertiger Text (statt ~88% base64-Ballast, den ein Chat-LLM ohnehin nicht als Bild rendert); jeder Screenshot erscheint als Hinweis „im ZIP-Export enthalten". Wer die Bilder mitschicken will, nutzt das **ZIP**: `feedback.md` (Screenshots als verlinkte Bilddateien), `feedback.json` (vollständig, inkl. eingebetteter Screenshots) und einen `screenshots/`-Ordner. Ein ZIP lässt sich direkt wieder importieren — inklusive Screenshots, auch wenn es zwischendurch von einem anderen Werkzeug neu gepackt wurde. Ohne externe Bibliothek gebaut.
- **Pixel-treue Screenshots**: Jeder Kommentar bekommt automatisch einen Screenshot des angeklickten Elements — gerendert vom Browser selbst (SVG foreignObject via [modern-screenshot](https://github.com/qq15725/modern-screenshot)), inkl. externer Bilder, Webfonts und dunkler Hintergründe. Der Screenshot zeigt, was der Tester wirklich sieht; VibeFeedback-eigene Overlays (Outlines, Badges) werden vorher entfernt. Fallback-Kaskade: html2canvas → strukturelles Drahtgitter.
- **Eigener Screenshot aus der Zwischenablage**: Für Edge-Cases, in denen der Auto-Screenshot nicht passt (Canvas/WebGL-Inhalte, CORS-gesperrte Bilder, Video-Frames) — Screenshot mit dem OS-Tool aufnehmen, dann 📋-Button oder Strg+V in der Kommentar-Bar bzw. im Bookmarklet-Modal. Ersetzt den Auto-Screenshot, funktioniert auch beim Bearbeiten.
- **Zeichenwerkzeuge im Screenshot**: Pfeil, Stift (Freihand), Rechteck, Kreis, Text direkt in der Toolbar — im Ausklappmenü (⋯) zusätzlich Marker, Pixelieren (sensible Daten unkenntlich machen), Nummern-Badges (1, 2, 3 …), sechs Farben, drei Strichstärken und Wiederholen (Redo).
- **Autor-Name**: Beim ersten Kommentar wird der Name abgefragt und im localStorage gespeichert — erscheint im Export.
- **Kategorie + Subtitel**: Bug, Feature, Design, Copy, Frage, Lob — jede Kategorie zeigt einen erklärenden Untertitel (z.B. "Bug = Etwas funktioniert nicht").
- **Lesbare Element-Labels** (`humanLabel`): Badges und Sidebar zeigen zuerst `aria-label` oder sichtbaren Text, den CSS-Selector dahinter nur gedimmt.
- **Export-Reminder**: Sticky Banner erscheint beim Tab-Wechsel, wenn unexportierte Kommentare vorhanden sind (Download / Kopieren / Schließen).
- **Fertig-Toast**: Nach dem ersten gespeicherten Kommentar erscheint für 5,5 s ein Toast mit Export-Hinweis.
- **Presentation-Mode Promo**: Nach dem 3. Kommentar Toast-Hinweis auf den Präsentations-Modus für Owners.
- **Rolle-basierte Sidebar**: Import- und Lösch-Aktionen sind für Commenter ausgeblendet — weniger Rauschen für Tester.
- **Mobile-optimiert**: Canvas-Mindesthöhe 340 px; Precision- und Original-Toggle werden auf Touch-Geräten ausgeblendet.

## Datenformat der Kommentare

```json
{
  "id": "…",
  "selector": "body > main > section:nth-of-type(2) > button",
  "snippet": "<button class=\"cta\">Jetzt starten</button>",
  "tag": "button",
  "text": "Freitext des Testers",
  "author": "Name des Testers",
  "category": "bug",
  "priority": "must",
  "sub": "Etwas funktioniert nicht",
  "ts": "ISO-Zeitstempel",
  "status": "done"
}
```

`status` ist optional (`doing` | `done`) — ein fehlendes Feld bedeutet „offen". Beim Import wird ein mitgelieferter Status auf bereits vorhandene Kommentare übernommen.

## Projektstruktur

Die Seite läuft **ohne Build-Schritt** auf GitHub Pages: Ein `git push` auf `main`
geht direkt live — alle Dateien werden 1:1 so ausgeliefert, wie sie im Repo liegen.
(Der einzige Node-Schritt ist `npm run build`, der lokal das Bookmarklet neu erzeugt.)

```
vibefeedback/
├── index.html          # Landing-Page + das eigentliche Feedback-Tool (?src=…)
├── styles.css          # alle Styles der Landing/App (aus index.html ausgelagert)
├── app.js              # das komplette Feedback-Tool als Skript (aus index.html ausgelagert)
├── dashboard.html      # Projekt-Cockpit über alle im Browser kommentierten Projekte
├── layer.js            # Quelle des Bookmarklets (läuft injiziert auf fremden Seiten)
├── layer.min.js        # daraus gebautes Bookmarklet — via `npm run build`, nicht von Hand
├── vf-zip.js           # gemeinsamer ZIP-Writer für index.html + dashboard.html
├── test_screenshot.html# Test-Fixture (bleibt im Root, wird per URL geladen)
├── noise.svg, og-image.svg, pilot-logo*.svg, fonts/   # Assets
│
├── demos/              # Beispiel-Website zum Ausprobieren des Tools (die „Live-Demo")
├── tests/              # Playwright-Tests — `npm test` läuft alle aus diesem Ordner
├── scripts/            # Node-Helfer: build-bookmarklet.js (Build) + superaudit.js (Audit)
│
├── package.json        # npm-Skripte: test / test:live / test:sites / build / audit
├── CHANGELOG.md        # Verlauf aller Versionen (+ „Bekannt / Offen" ganz oben)
└── README.md           # dieses Dokument
```

**Merkhilfe:** `index.html` + `styles.css` + `app.js` gehören zusammen (eine Seite,
in drei Dateien getrennt für die Übersicht). Was im Browser läuft, liegt im Root;
was nur zur Entwicklung dient, liegt in `tests/` und `scripts/`.

## Lokal ausprobieren

```bash
git clone https://github.com/CeeKay1901/vibefeedback.git
cd vibefeedback
python3 -m http.server 8080
# → http://localhost:8080/
```

## Entwicklung

```bash
npm install
npm test          # Playwright-Regressionssuite (13 Test-Dateien in tests/)
npm run test:sites # Kernfeature-Matrix gegen echte Live-Seiten (netzabhängig)
npm run build     # layer.min.js + eingebettetes Bookmarklet aus layer.js
npm run audit     # superaudit (Screenshots, a11y, Mobile)
```

Nach jeder Änderung an `layer.js` muss `npm run build` laufen — sonst bleibt das Bookmarklet in `app.js` veraltet.

### ZIP-Code liegt zweimal — mit Absicht

`vf-zip.js` ist die gemeinsame Quelle für `index.html` und `dashboard.html`. Das Bookmarklet (`layer.js`) trägt eine eigene Kopie, weil es in fremde Seiten injiziert wird und dort nichts nachladen darf. `tests/test_zip_parity.js` stellt sicher, dass beide bei gleicher Eingabe byte-identische Archive erzeugen — wer eine ändert, muss die andere nachziehen.
