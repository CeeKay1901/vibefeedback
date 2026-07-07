# VibeFeedback

Ein winziges, backend-freies Feedback-Tool für Vibecoding-Projekte.
Du teilst einen Link → deine Tester klicken direkt auf die Elemente, die sie kommentieren wollen → am Ende bekommst du ein sauberes Markdown, das du 1:1 als Prompt-Grundlage nutzen kannst.

**Live:** https://ceekay1901.github.io/vibefeedback/

## Wie es funktioniert

1. **Owner** öffnet `/` (Setup-View), fügt die URL zu einem eigenen Live-Projekt ein.
2. Tool baut einen Feedback-Link der Form `?src=<URL>` und stellt ihn zum Kopieren bereit.
3. **Tester** öffnet den Link, sieht das Projekt im Iframe. Jedes Element ist klickbar → Modal mit Selector + HTML-Auszug + freiem Kommentarfeld.
4. Kommentare landen im `localStorage` des Testers. Export als Markdown-Datei (Download) oder in die Zwischenablage.
5. Tester schickt die `.md` an den Owner (Mail, Chat, PR-Kommentar). Owner nutzt den Inhalt als Prompt-Kontext für die nächste Iteration.

## Was das PoC bewusst NICHT tut

- Kein Backend, keine Auth, keine geteilte DB. Jeder Tester schickt sein eigenes Markdown zurück.
- Keine Zeichnung/Screenshot-Annotation — nur DOM-Element-Referenzen.
- Keine Persistenz über Browser hinweg.

## CORS

Das Iframe wird über `fetch(src)` + `srcdoc` befüllt (damit wir Klicks auf DOM-Ebene sehen). Das Ziel muss also CORS für GET erlauben. GitHub Pages, Netlify, Vercel machen das per default. Falls nicht → Fallback im Fehler-Overlay: HTML direkt einfügen.

## Datenformat der Kommentare

```json
{
  "id": "…",
  "selector": "body > main > section:nth-of-type(2) > button",
  "snippet": "<button class=\"cta\">Jetzt starten</button>",
  "tag": "button",
  "text": "Freitext des Testers",
  "ts": "ISO-Zeitstempel"
}
```

## Loop-Prompt zur Selbst-Iteration

Siehe [`LOOP_PROMPT.md`](./LOOP_PROMPT.md). Enthält die Qualitätskriterien, gegen die das PoC iterativ verbessert wird.

## Lokal ausprobieren

```bash
git clone https://github.com/CeeKay1901/vibefeedback.git
cd vibefeedback
python3 -m http.server 8080
# → http://localhost:8080/
```
