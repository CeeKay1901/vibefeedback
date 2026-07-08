# Loop-Prompt: VibeFeedback Selbst-Iteration

Dieser Prompt wird in einer Schleife auf das Projekt angewendet. In jeder Iteration:

1. Lies den aktuellen Stand von `index.html` und `layer.js`.
2. Gehe die Qualitätskriterien unten Punkt für Punkt durch.
3. Bewerte jeden Punkt mit ✅ (erfüllt), 🟡 (teilweise), ❌ (fehlt/kaputt).
4. Wähle **den schwächsten Punkt** (❌ zuerst, dann 🟡 mit größtem Impact) und fixe ihn.
5. Committe mit prägnanter Nachricht (`feat:`, `fix:`, `polish:`), dann `git push`.
6. Aktualisiere ggf. `CHANGELOG.md` und dieses Iterations-Log.
7. Wenn alle Punkte ✅ → melde `<promise>ALL_GREEN</promise>` und stoppe die Loop.

Regel: **maximal eine sinnvolle Verbesserung pro Iteration.** Nicht refaktorieren „because we can".

---

## Qualitätskriterien

### A. Funktionalität (Kern) — iframe-Modus
- **A1** Setup-View akzeptiert URL, validiert Format, erzeugt Share-Link.
- **A2** Feedback-View lädt src via `fetch()` in `srcdoc`-Iframe. `<base>`-Tag wird injiziert.
- **A3** Klick auf Element im Iframe öffnet Modal mit korrektem CSS-Selector + HTML-Auszug.
- **A4** Kommentar wird gespeichert und in Sidebar-Liste angezeigt (nummeriert).
- **A5** Kommentiertes Element bekommt sichtbaren Badge (Nummer + Emoji) im Iframe.
- **A6** Klick auf Sidebar-Eintrag scrollt zum Element und hebt es hervor.
- **A7** Löschen einzelner Kommentare + „Alle löschen" funktioniert.
- **A8** Markdown-Export erzeugt Datei-Download UND Kopie in Zwischenablage.

### B. Bookmarklet-Modus (layer.js)
- **B1** Landing Page zeigt Bookmarklet-Link mit Drag-to-Bookmarks UX.
- **B2** layer.js lädt als IIFE auf beliebiger Seite ohne Konflikte (Namespace `__vfl_`).
- **B3** Zweites Aktivieren des Bookmarklets togglet die Sidebar (kein Doppel-Inject).
- **B4** Kommentare werden in `localStorage` der Zielseite (Origin+Path) gespeichert.
- **B5** layer.js hat parität mit index.html: Templates, Priorität, Screenshots, MD-Export.
- **B6** JSON-Export funktioniert im Bookmarklet-Modus.

### C. Kommentar-Features
- **C1** Strukturierte Templates je Kategorie (Bug: expected/actual/steps; Feature: role/want/benefit; Design: issue/suggestion; Copy: current/suggestion).
- **C2** Screenshot-Capture per SVG-foreignObject → Canvas → JPEG, thumbnail in Sidebar.
- **C3** Fingerprint-Fallback: wenn CSS-Selector veraltet → Suche via id / aria-label / href / Text-Inhalt.
- **C4** Kategorie-Chips: Bug/Feature/Design/Copy/Frage/Lob mit Farben.
- **C5** Priorität: Muss/Sollte/Könnte/Nice pro Kommentar.
- **C6** Autor-Feld (optional, persistiert in localStorage).

### D. UX
- **D1** Hover-Highlight im Iframe (Crosshair-Cursor + dashed outline).
- **D2** Modal schließbar mit `Esc`, speicherbar mit `Ctrl/Cmd+Enter`.
- **D3** Toast-Nachrichten nach Aktionen (Speichern, Kopieren, Fehler).
- **D4** Leerer Zustand der Sidebar erklärt was zu tun ist.
- **D5** Mobile-Layout (< 900px) als Bottom-Sheet Modal, Stack statt Split.
- **D6** Modal passt vollständig auf den Bildschirm (max-height + overflow-y:auto), kein Abschneiden.
- **D7** Presentation-Mode: Slideshow durch Kommentare mit Element-Highlight im Iframe.

### E. Robustheit
- **E1** CORS-Fehler zeigt verständliche Fehlermeldung + HTML-Einfügen-Fallback.
- **E2** Relative URLs im Iframe laden korrekt (Base-Tag Injection).
- **E3** Sonderzeichen im Kommentartext korrekt escaped (kein XSS in Sidebar/MD).
- **E4** localStorage-Quota-Fehler wird abgefangen.
- **E5** Klicks auf Links/Formulare im Iframe abgefangen (kein ungewolltes Navigieren).
- **E6** Subpage-Navigation: Kommentare bleiben URL-gebunden, Sidebar zeigt Seitenreferenz.

### F. Export-Qualität
- **F1** Markdown enthält Header mit Ziel-URL, Anzahl, Zeitstempel.
- **F2** Jeder Kommentar hat: Nummer, Kategorie, Priorität, Selector, HTML-Auszug, Feedback.
- **F3** Strukturierte Template-Felder werden im Markdown klar gegliedert ausgegeben.
- **F4** Screenshot als `<details>`-Block im Markdown eingebettet.
- **F5** Dateiname enthält Datum (`vibefeedback-2026-07-08.md`).
- **F6** Markdown ist auf Anhieb Prompt-tauglich.

### G. Code-Qualität
- **G1** Single-file (index.html), keine externen CDN-Abhängigkeiten.
- **G2** layer.js: Single-IIFE, kein Framework, kein Build-Step nötig.
- **G3** Bookmarklet in Landing Page dynamisch aus layer.js eingebettet (encodeURIComponent).
- **G4** Keine toten Funktionen oder Debug-Reste.
- **G5** JS-Syntax valide (node -e "new Function(script)" = OK).

### H. Sharing & Deploy
- **H1** Feedback-Link ist stateless im Query-Param (kein Server nötig).
- **H2** GitHub Pages läuft (HTTP 200, CORS offen).
- **H3** Owner-Modus (`&owner=1`) zeigt Presentation-Button und Export-Tools.
- **H4** README mit Live-Link und Nutzungserklärung.

---

## Iterations-Log

| # | Datum | Kriterium | Änderung |
|---|-------|-----------|----------|
| 0 | 2026-07-07 | init | MVP mit allen Kern-Features |
| 1 | 2026-07-07 | C5, D2, F2 | Storage-Quota, Modal-Shortcuts, Autor im Export |
| 2 | 2026-07-07 | E1 | CORS-Precheck im Setup, Clipboard-Fallback |
| 3 | 2026-07-07 | final QA | Alle ursprünglichen Kriterien ✅ |
| 4 | 2026-07-07 | H3, D7 | pilot.de CI, Presentation-Mode |
| 5 | 2026-07-07 | C1 | Strukturierte Comment-Templates je Kategorie |
| 6 | 2026-07-07 | C2 | Screenshot-Capture per SVG-foreignObject |
| 7 | 2026-07-08 | B1–B6 | Bookmarklet-Modus: layer.js v0.4.0 fertig + Landing-Section |
| 8 | 2026-07-08 | C3 | Fingerprint-Fallback (id/aria-label/href/text) in index.html + layer.js |
| 9 | 2026-07-08 | D6 | Modal kompakter: max-height, overflow-y, textarea min-height reduziert |
