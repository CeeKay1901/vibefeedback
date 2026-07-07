# Changelog

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
