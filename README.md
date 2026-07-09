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

## Features auf einen Blick

- **Export & Import als Markdown, JSON oder ZIP**: Das ZIP enthält `feedback.md` (Screenshots als verlinkte Bilddateien statt riesiger data-URLs), `feedback.json` (vollständig) und einen `screenshots/`-Ordner. Ein ZIP lässt sich direkt wieder importieren — inklusive Screenshots, auch wenn es zwischendurch von einem anderen Werkzeug neu gepackt wurde. Ohne externe Bibliothek gebaut.
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
  "ts": "ISO-Zeitstempel"
}
```

## Loop-Prompt zur Selbst-Iteration

Siehe [`LOOP_PROMPT.md`](./LOOP_PROMPT.md). Enthält die Qualitätskriterien, gegen die VibeFeedback iterativ verbessert wird.

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
npm test          # Playwright-Regressionssuite (111 Checks)
npm run build     # layer.min.js + eingebettetes Bookmarklet aus layer.js
npm run audit     # superaudit (Screenshots, a11y, Mobile)
```

Nach jeder Änderung an `layer.js` muss `npm run build` laufen — sonst bleibt das Bookmarklet in `index.html` veraltet.
