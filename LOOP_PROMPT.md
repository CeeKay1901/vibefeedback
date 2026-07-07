# Loop-Prompt: VibeFeedback Selbst-Iteration

Dieser Prompt wird in einer Schleife auf das Projekt angewendet. In jeder Iteration:

1. Lies den aktuellen Stand von `index.html` (und ggf. anderer Dateien).
2. Gehe die Qualitätskriterien unten Punkt für Punkt durch.
3. Bewerte jeden Punkt mit ✅ (erfüllt), 🟡 (teilweise), ❌ (fehlt/kaputt).
4. Wähle **den schwächsten Punkt** (❌ zuerst, dann 🟡 mit größtem Impact) und fixe ihn.
5. Committe mit prägnanter Nachricht (`feat:`, `fix:`, `polish:`).
6. Aktualisiere ggf. `CHANGELOG.md`.
7. Wenn alle Punkte ✅ → melde „all green" und stoppe die Loop.

Regel: **maximal eine sinnvolle Verbesserung pro Iteration.** Nicht refaktorieren „because we can". Wenn ein Kriterium ✅ ist, nicht anfassen.

---

## Qualitätskriterien

### A. Funktionalität (Kern)
- **A1** Setup-View akzeptiert URL, validiert Format, erzeugt Share-Link.
- **A2** Feedback-View lädt src via `fetch()` in `srcdoc`-Iframe. `<base>`-Tag wird injiziert.
- **A3** Klick auf Element im Iframe öffnet Modal mit korrektem CSS-Selector + HTML-Auszug.
- **A4** Kommentar wird gespeichert und in Sidebar-Liste angezeigt (nummeriert).
- **A5** Kommentiertes Element bekommt sichtbaren Badge (Nummer) im Iframe.
- **A6** Klick auf Sidebar-Eintrag scrollt zum Element und hebt es hervor.
- **A7** Löschen einzelner Kommentare + „Alle löschen" funktioniert.
- **A8** Markdown-Export erzeugt Datei-Download UND Kopie in Zwischenablage.

### B. UX
- **B1** Onboarding-Text im Setup-View erklärt in ≤3 Sätzen, was das Tool tut.
- **B2** Hover-Highlight im Iframe zeigt klar, was klickbar wäre.
- **B3** Cursor im Iframe wird zu Crosshair, um Kommentiermodus zu signalisieren.
- **B4** Modal ist mit `Esc` schließbar, mit `Ctrl/Cmd+Enter` speicherbar.
- **B5** Toast-Nachrichten geben Feedback nach Aktionen (Speichern, Kopieren, Fehler).
- **B6** Leerer Zustand der Sidebar erklärt was zu tun ist.
- **B7** Mobile-Layout (< 900px) bleibt bedienbar (Stack statt Split).
- **B8** Farb-Kontraste erfüllen mindestens WCAG AA für Body-Text.

### C. Robustheit
- **C1** CORS-Fehler beim Laden zeigt verständliche Fehlermeldung + Fallback („HTML einfügen").
- **C2** Iframe-Inhalt mit relativen URLs (Bilder, CSS) lädt trotz `srcdoc` korrekt (Base-Tag).
- **C3** Kommentar auf Element, das nicht mehr im DOM ist, gibt sanften Fehler statt Crash.
- **C4** Selector-Generator produziert eindeutige Selektoren (Id/nth-of-type-Fallback).
- **C5** localStorage-Quota-Fehler wird abgefangen.
- **C6** Klicks auf Links/Formulare im Iframe werden abgefangen (kein Navigieren weg).
- **C7** Sonderzeichen im Kommentartext / Snippet werden korrekt escaped (kein XSS in Sidebar/MD).

### D. Sharing / Deploy
- **D1** Feedback-Link ist stateless im Query-Param (kein Server-State nötig).
- **D2** URL des Tools ist stabil (GitHub Pages läuft).
- **D3** Owner-Modus (`&owner=1`) unterscheidet sich sichtbar vom Feedback-Modus.
- **D4** Repo hat README mit Live-Link + Nutzungserklärung.

### E. Export-Qualität
- **E1** Markdown enthält Header mit Ziel-URL, Anzahl Kommentare, Export-Zeitstempel.
- **E2** Jeder Kommentar hat: Nummer, Tag, Selector, HTML-Auszug (fenced code block), Feedback-Text als Blockquote.
- **E3** Markdown ist auf Anhieb Prompt-tauglich („Nimm dieses Feedback und verbessere…" funktioniert).
- **E4** Dateiname enthält Datum (z.B. `vibefeedback-2026-07-07.md`).

### F. Code-Qualität
- **F1** Single-file, keine Frameworks, keine Build-Chain.
- **F2** Keine externen Netzwerk-Abhängigkeiten (Fonts/CDNs) außer dem zu ladenden Projekt.
- **F3** JS ist in `"use strict"` und ohne Konsolen-Warnings zur Laufzeit.
- **F4** Keine toten Funktionen oder Debug-Reste.

---

## Iterations-Log (wird automatisch geführt)

| # | Datum | Kriterium | Änderung |
|---|-------|-----------|----------|
| 0 | 2026-07-07 | init | MVP mit allen Kern-Features geschrieben |
