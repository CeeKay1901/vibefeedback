# Fixplan — Kernfeature-Test gegen echte Seiten (2026-07-10)

Getestet mit `node test_real_sites.js` (bzw. `npm run test:sites`): der komplette
Kernfluss gegen fünf echte Seiten plus ein bewusster CORS-Fehlerfall.

## Testmatrix

| Seite | Laden | Klick→Bar | Speichern | Auto-Screenshot | Badge | Subpage | Markdown | ZIP | Dashboard |
|---|---|---|---|---|---|---|---|---|---|
| kippflix.com | ✓ | ✓ | ✓ | ⚠ beschnitten | ✓ | n/a¹ | ✓ | ✓ | ✓ |
| ideen-hangar | ✓ | ✓ | ✓ | ⚠ beschnitten | ✓ | n/a¹ | ✓ | ✓ | ✓ |
| pilot-skillmarkt | ✓ | ✓ | ✓ | ⚠ beschnitten | ✓ | n/a¹ | ✓ | ✓ | ✓ |
| WochenplanerAnna | ✓ | ✓ | ✓ | ⚠ beschnitten | ✓ | n/a¹ | ✓ | ✓ | ✓ |
| cv | ✓ | ✓ | ✓ | ⚠ beschnitten | ✓ | n/a¹ | ✓ | ✓ | ✓ |
| example.com (kein CORS) | Fehlerbox ✓ + „HTML einfügen“-Fallback ✓ | | | | | | | | |

¹ Alle fünf Zielseiten sind Single-Page-Apps ohne interne Seitenlinks — kein Bug.
Subpage-Navigation ist lokal über die Demo-Unterseiten abgedeckt (`test_demo_pages.js`).

Alle Flows funktionieren. **Ein systematischer Defekt:** die Element-Screenshots.

---

## Finding 1 (KRITISCH): Element-Screenshots vertikal abgeschnitten

**Symptom:** Auf allen fünf echten Seiten ist der automatische Element-Screenshot
unten beschnitten — bei mehrzeiligen Überschriften fehlt die letzte Zeile ganz
oder halb, bei einzeiligen Elementen sind die Glyphen halbiert
(Belege: `test_artifacts/real_sites/*_shot.jpg`).

**Reproduktion (minimal, lokal):** Eine Seite mit
`h1 { font-size: 73.92px; line-height: .98 }` (drei Zeilen, Rect 700×217)
liefert einen Capture, in dem die dritte Zeile abgeschnitten ist — **auch ohne
Webfont** (nur `system-ui`).

**Diagnose:** Im SVG-foreignObject-Klon rendert der Text mit ~1.2-facher
Zeilenhöhe statt der expliziten `line-height` (gemessen: ~87 px/Zeile statt
72.4 px → Faktor ≈ 1.2 = `normal`). Der Canvas wird aber auf die
Original-Rect-Höhe gesetzt → der Überlauf wird abgeschnitten. Die explizite
`line-height` geht also beim Klonen verloren (Verdacht: Style-Diffing von
modern-screenshot gegen ein Sandbox-Default, das `line-height:normal` als
„Default“ wertet). Zweitverdacht für den Kippflix-Fall (line-height war dort
schon 1.2): Webfont „Plus Jakarta Sans“ wird nicht inlined → Fallback-Font mit
anderer Metrik. Beide Spuren betreffen dieselbe Codestelle (Klon-Styling in
`captureElement`).

**Warum die bestehende Suite grün ist:** Die lokalen Fixtures
(`test_screenshot.html`) verwenden keine enge `line-height` — reale Seiten
setzen bei Headlines fast immer 0.95–1.1.

### Implementierungsschritte

1. **Rote Tests zuerst:** `test_screenshot.html` um zwei Fixtures erweitern:
   (a) mehrzeilige H1 mit `line-height:.98` + Webfont, (b) einzeiliges Element
   mit `line-height:1` und knappem Rect. In `test_screenshot.js` prüfen:
   Capture-Bildhöhe/Inhalt vs. Ground-Truth (Pixel-Similarity-Harness aus
   `test_kippflix.js` wiederverwenden). Muss zunächst FEHLSCHLAGEN.
2. **Ursache festnageln:** Im Capture-Pfad den Klon inspizieren
   (`onCloneNode`-Hook): computed `line-height`/`font-family` von Original vs.
   Klon loggen. Bestätigt das den Diffing-Verdacht → Schritt 3a, sonst 3b.
3. **Fix:**
   a. Typografie-kritische Properties beim Klonen **immer explizit inline**
      setzen (pro Knoten aus `getComputedStyle` des Originals):
      `line-height, font-size, font-family, font-weight, letter-spacing,
      word-spacing, white-space, text-transform`. modern-screenshot bietet
      dafür `onCloneNode` bzw. die `style`/`includeStyleProperties`-Optionen.
   b. **Sicherheitsnetz unabhängig von (a):** Nach dem Rendern die tatsächliche
      Klon-Höhe messen und den Canvas daran ausrichten (statt blind an der
      Original-Rect-Höhe) — plus kleiner Puffer, dann auf Inhalt trimmen.
      Damit kann KEINE Metrik-Drift mehr Inhalt abschneiden, egal welche.
4. **Verifikation:** `npm test` (lokale Fixtures) und `npm run test:sites`
   gegen alle fünf Live-Seiten; die gespeicherten `*_shot.jpg` visuell abnehmen
   (letzte Zeile vollständig? Glyphen ganz?).

## Finding 2 (MITTEL): Mini-Elemente ergeben aussagelose Screenshots

**Symptom:** Klick auf ein kleines Element (einzeilige `<p>`, 24-px-Überschrift)
erzeugt einen schmalen Streifen ohne Kontext (WochenplanerAnna: 2,4 KB Sliver).
Für den Empfänger des Exports ist nicht erkennbar, wo auf der Seite das Element
liegt.

### Implementierungsschritte

1. Schwelle definieren: Rect-Höhe < ~48 px oder Fläche < ~10 000 px².
2. Unterschreitet das Element die Schwelle → stattdessen den nächsten
   Vorfahren capturen, der sie erfüllt (max. 3 Ebenen hoch, Deckel z. B.
   1200×800), und das Ziel-Element im Bild markieren (Rahmen im Capture,
   analog zu den vorhandenen Annotator-Rechtecken).
3. Fixture mit Mini-Element in `test_screenshot.html` + Assertion
   (Bild ≥ Schwelle, Markierung vorhanden).

## Finding 3 (KLEIN): Livetest dauerhaft verfügbar machen

`test_real_sites.js` als `npm run test:sites` verankern (nicht in `npm test`,
da netzabhängig) und nach jedem Screenshot-Fix laufen lassen.

---

## Reihenfolge & Aufwand

| Schritt | Umfang | Risiko |
|---|---|---|
| F1.1 rote Fixtures | klein | — |
| F1.2 Diagnose-Hook | klein | — |
| F1.3a Style-Inlining | mittel | Regressionsgefahr für bestehende Captures → Suite + Live-Matrix |
| F1.3b Höhen-Sicherheitsnetz | mittel | Performance (zweite Messung) — akzeptabel |
| F2 Kontext-Capture | mittel | Verhaltensänderung → README/CHANGELOG |
| F3 npm-Script | trivial | — |
