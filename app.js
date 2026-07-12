"use strict";

// ============ Config ============
// emoji bleibt für den Markdown-Export (kompakter LLM-Marker); icon = Lucide fürs UI.
const CATEGORIES = [
  { id:"bug",      label:"Bug",       emoji:"🐛", icon:"bug",         sub:"Etwas funktioniert nicht" },
  { id:"feature",  label:"Feature",   emoji:"✨", icon:"sparkles",    sub:"Idee / Wunsch" },
  { id:"design",   label:"Design",    emoji:"🎨", icon:"palette",     sub:"Sieht nicht richtig aus" },
  { id:"copy",     label:"Copy",      emoji:"📝", icon:"type",        sub:"Text / Formulierung" },
  { id:"question", label:"Frage",     emoji:"❓", icon:"circle-help", sub:"Ich verstehe nicht..." },
  { id:"praise",   label:"Lob",       emoji:"❤️", icon:"heart",       sub:"Das gefällt mir" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c=>[c.id,c]));
const PRIORITIES = [
  { id:"must",   label:"Muss" },
  { id:"should", label:"Sollte" },
  { id:"could",  label:"Könnte" },
  { id:"nice",   label:"Nice-to-have" },
];
const PRI_MAP = Object.fromEntries(PRIORITIES.map(p=>[p.id,p]));

/* Bearbeitungsstatus (geteilt mit dem Dashboard): fehlendes Feld = offen,
   damit Bestandsdaten und fremde Importe ohne Migration funktionieren. */
const STATUSES = [
  { id:"open",  label:"Offen",     chip:"○", icon:"circle" },
  { id:"doing", label:"In Arbeit", chip:"◐", icon:"loader-circle" },
  { id:"done",  label:"Erledigt",  chip:"✓", icon:"circle-check" },
];
const ST_MAP = Object.fromEntries(STATUSES.map(s=>[s.id,s]));
const stOf = c => ST_MAP[c.status] ? c.status : "open";

/* Inline-Lucide-Icons (stroke, currentColor) — ersetzen alle Emojis im UI.
   Emojis bleiben nur im Markdown-Export als kompakte LLM-Marker. */
const ICON_PATHS = {
  "bug":`<path d="M12 20v-9"/><path d="M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z"/><path d="M14.12 3.88 16 2"/><path d="M21 21a4 4 0 0 0-3.81-4"/><path d="M21 5a4 4 0 0 1-3.55 3.97"/><path d="M22 13h-4"/><path d="M3 21a4 4 0 0 1 3.81-4"/><path d="M3 5a4 4 0 0 0 3.55 3.97"/><path d="M6 13H2"/><path d="m8 2 1.88 1.88"/><path d="M9 7.13V6a3 3 0 1 1 6 0v1.13"/>`,
  "sparkles":`<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>`,
  "palette":`<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>`,
  "type":`<path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/>`,
  "circle-help":`<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`,
  "heart":`<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>`,
  "message-square":`<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>`,
  "mouse-pointer":`<path d="M12.586 12.586 19 19"/><path d="M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z"/>`,
  "crosshair":`<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>`,
  "camera":`<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/>`,
  "clipboard":`<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>`,
  "corner-left-up":`<path d="M14 9 9 4 4 9"/><path d="M20 20h-7a4 4 0 0 1-4-4V4"/>`,
  "presentation":`<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>`,
  "map-pin":`<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`,
  "search":`<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>`,
  "bot":`<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>`,
  "chevron-down":`<path d="m6 9 6 6 6-6"/>`,
  "paperclip":`<path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/>`,
  "circle":`<circle cx="12" cy="12" r="10"/>`,
  "loader-circle":`<path d="M21 12a9 9 0 1 1-6.219-8.56"/>`,
  "check":`<path d="M20 6 9 17l-5-5"/>`,
  "circle-check":`<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>`,
  "triangle-alert":`<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
  "zap":`<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>`,
  "trash-2":`<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
  "pencil":`<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>`,
  "download":`<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>`,
  "upload":`<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>`,
  "copy":`<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
  "plus":`<path d="M5 12h14"/><path d="M12 5v14"/>`,
  "x":`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  "thumbs-up":`<path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/><path d="M7 10v12"/>`,
  "thumbs-down":`<path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/><path d="M17 14V2"/>`,
  "reply":`<path d="M20 18v-2a4 4 0 0 0-4-4H4"/><path d="m9 17-5-5 5-5"/>`,
  "monitor":`<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>`
};
function icon(name, size){ const p=ICON_PATHS[name]; if(!p) return ""; size=size||16; return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`; }

// Kategorie-spezifische Feld-Templates. Wenn `fields` leer ist, nur Freitext.
const TEMPLATES = {
  bug: { fields: [
    { key:"expected", label:"Erwartetes Verhalten", placeholder:"Was sollte passieren?",           rows:2 },
    { key:"actual",   label:"Tatsächliches Verhalten", placeholder:"Was passiert stattdessen?",    rows:2 },
    { key:"steps",    label:"Schritte zum Reproduzieren", placeholder:"1. …\n2. …\n3. …",         rows:3 },
  ]},
  feature: { fields: [
    { key:"role",    label:"Als …",           placeholder:"z. B. neuer Nutzer / Admin",       rows:1 },
    { key:"want",    label:"möchte ich …",    placeholder:"welche Funktion / welches Verhalten?", rows:2 },
    { key:"benefit", label:"damit …",         placeholder:"welcher Nutzen entsteht dadurch?", rows:2 },
  ]},
  design: { fields: [
    { key:"issue",      label:"Was stört visuell?", placeholder:"Kontrast, Hierarchie, Spacing, Farbe…", rows:2 },
    { key:"suggestion", label:"Vorschlag",           placeholder:"Wie sollte es aussehen?",             rows:2 },
  ]},
  copy: { fields: [
    { key:"current",    label:"Aktueller Text",  placeholder:"Copy & paste den Text",                rows:2 },
    { key:"suggestion", label:"Vorschlag",       placeholder:"Wie besser formuliert?",               rows:2 },
  ]},
  question: { fields: [] },
  praise:   { fields: [] },
};

// ============ Utils ============
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = s => (s??"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const truncate = (s,n=200) => (s??"").length<=n?s:s.slice(0,n)+"…";
const toast = (msg,ms=2200) => {
  $$(".toast").forEach(t=>t.remove());
  const t = document.createElement("div");
  // role=status + aria-live: Screenreader kündigen Erfolg/Fehler/Validierung an
  // (der Toast ist auch der einzige Kanal für „Kommentar darf nicht leer sein").
  t.className="toast"; t.setAttribute("role","status"); t.setAttribute("aria-live","polite");
  t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>t.remove(), ms);
};

// Toast mit Rückgängig-Aktion für destruktive Schritte (Einzel-Löschung): sicherer
// als sofortiges, endgültiges Entfernen und weniger störend als ein confirm-Dialog.
function actionToast(msg, label, fn, ms=6000){
  $$(".toast").forEach(t=>t.remove());
  const t=document.createElement("div");
  t.className="toast"; t.setAttribute("role","status"); t.setAttribute("aria-live","polite");
  const span=document.createElement("span"); span.textContent=msg+"  ";
  const btn=document.createElement("button");
  btn.type="button"; btn.className="toast-undo"; btn.textContent=label;
  btn.addEventListener("click", ()=>{ t.remove(); fn(); });
  t.append(span, btn); document.body.appendChild(t);
  setTimeout(()=>t.remove(), ms);
}
const undoToast = (msg, onUndo, ms=6000) => actionToast(msg, "Rückgängig", onUndo, ms);

// Ungespeicherten Kommentar-Entwurf nicht stillschweigend verlieren: warnt beim
// Schließen/Neuladen/Weg-Navigieren, wenn die offene cbar getippten Inhalt hat.
window.addEventListener("beforeunload", e=>{
  if(window.__vf_active_cbar?.isDirty?.()){ e.preventDefault(); e.returnValue = ""; }
});

function cssPath(el){
  if(!el || el.nodeType!==1) return "";
  const doc = el.ownerDocument;
  const isUnique = s => { try{ return doc.querySelectorAll(s).length === 1; }catch(e){ return false; } };
  const cleanClasses = n => (typeof n.className === "string" ? n.className : "")
    .trim().split(/\s+/).filter(c => c && !c.startsWith("__vf_") && !c.startsWith("__pv_"));
  const partFor = n => {
    if(!n || n.nodeType!==1) return "";
    if(n.id){
      const s = "#" + CSS.escape(n.id);
      if(isUnique(s)) return s;
    }
    const tid = n.getAttribute && (n.getAttribute("data-testid") || n.getAttribute("data-test-id") || n.getAttribute("data-test"));
    if(tid){
      const s = `[data-testid="${CSS.escape(tid)}"]`;
      if(isUnique(s)) return s;
    }
    let sel = n.tagName.toLowerCase();
    const classes = cleanClasses(n).slice(0,3);
    if(classes.length) sel += "." + classes.map(c => CSS.escape(c)).join(".");
    if(isUnique(sel)) return sel;
    const parent = n.parentNode;
    if(parent){
      const sibs = [...parent.children].filter(c => c.tagName === n.tagName);
      if(sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(n)+1})`;
    }
    return sel;
  };

  const parts = [];
  let cur = el;
  while(cur && cur.nodeType===1 && cur.tagName.toLowerCase()!=="html"){
    parts.unshift(partFor(cur));
    if(isUnique(parts.join(" > "))) return parts.join(" > ");
    cur = cur.parentNode;
  }
  return parts.join(" > ");
}


function resolveElement(c, doc){
  try{ const el = doc.querySelector(c.selector); if(el) return el; }catch(e){}
  const info = c.info; const tag = c.tag || '*';
  if(!info) return null;
  if(info.id){ const el = doc.getElementById(info.id); if(el) return el; }
  try{ if(info.attrs?.ariaLabel){ const el = doc.querySelector('[aria-label="' + CSS.escape(info.attrs.ariaLabel) + '"]'); if(el) return el; } }catch(e){}
  try{ if(info.attrs?.href){ const el = doc.querySelector('a[href="' + CSS.escape(info.attrs.href) + '"]'); if(el) return el; } }catch(e){}
  if(info.text){
    const needle = info.text.trim().slice(0,80);
    if(needle.length >= 4){
      const all = [...doc.querySelectorAll(tag)];
      const exact = all.find(el => (el.innerText||el.textContent||'').trim().slice(0,80) === needle);
      if(exact) return exact;
      if(needle.length >= 20){
        const partial = all.find(el => (el.innerText||el.textContent||'').trim().includes(needle.slice(0,40)));
        if(partial) return partial;
      }
    }
  }
  return null;
}
function shortHtml(el){
  try{
    const clone = el.cloneNode(true);
    // strip our own instrumentation before serializing
    clone.querySelectorAll?.(".__vf_badge, .__vf_hover, .__vf_marked, .__vf_precise, .__vf_selected, .__pv_hi, .__vf_infobox").forEach(n => n.remove());
    clone.classList?.remove("__vf_hover","__vf_marked","__vf_precise","__vf_selected","__pv_hi");
    return truncate(clone.outerHTML.replace(/\s+/g," ").trim(), 400);
  }
  catch(e){ return "[unbekannt]"; }
}

// Semantic role hint — helps LLMs classify what the element *does*
function implicitRole(el){
  const t = el.tagName.toLowerCase();
  if(t==="a" && el.hasAttribute("href")) return "link";
  if(t==="button" || (t==="input" && ["button","submit","reset"].includes(el.type))) return "button";
  if(t==="input"){ return "input:" + (el.type||"text"); }
  if(t==="textarea") return "textarea";
  if(t==="select") return "select";
  if(t==="img") return "image";
  if(t==="svg") return "graphic";
  if(/^h[1-6]$/.test(t)) return "heading:"+t;
  if(t==="nav") return "navigation";
  if(t==="header") return "banner";
  if(t==="footer") return "contentinfo";
  if(t==="main") return "main";
  if(t==="section") return "section";
  if(t==="article") return "article";
  if(t==="form") return "form";
  if(t==="label") return "label";
  if(t==="li") return "listitem";
  if(t==="ul" || t==="ol") return "list";
  if(t==="p") return "paragraph";
  return t;
}

// Extract rich, LLM-friendly metadata about the picked element
function elementInfo(el){
  if(!el || el.nodeType!==1) return null;
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const rect = el.getBoundingClientRect();
  const cs = win.getComputedStyle(el);

  const ancestors = [];
  let p = el.parentElement;
  for(let i=0; i<6 && p && p.tagName.toLowerCase()!=="html"; i++, p=p.parentElement){
    const tag = p.tagName.toLowerCase();
    const id = p.id ? "#"+p.id : "";
    const cls = (typeof p.className==="string"?p.className:"").trim().split(/\s+/).filter(c=>c && !c.startsWith("__vf_") && !c.startsWith("__pv_")).slice(0,2);
    ancestors.unshift(tag + id + (cls.length?"."+cls.join("."):""));
  }
  const classes = (typeof el.className==="string"?el.className:"").trim().split(/\s+/).filter(c=>c && !c.startsWith("__vf_") && !c.startsWith("__pv_"));
  const text = (el.innerText||el.textContent||"").trim().replace(/\s+/g," ").slice(0,220) || null;

  const vw = win.innerWidth, vh = win.innerHeight;
  const visible = rect.width>0 && rect.height>0 && cs.visibility!=="hidden" && cs.display!=="none" && parseFloat(cs.opacity)>0;
  const inViewport = rect.bottom>0 && rect.top<vh && rect.right>0 && rect.left<vw;

  return {
    role: implicitRole(el),
    id: el.id || null,
    classes,
    text,
    attrs: {
      href: el.getAttribute?.("href") || null,
      src: el.getAttribute?.("src") || null,
      alt: el.getAttribute?.("alt") || null,
      title: el.getAttribute?.("title") || null,
      placeholder: el.getAttribute?.("placeholder") || null,
      value: (el.tagName==="INPUT"||el.tagName==="TEXTAREA") ? (el.value||null) : null,
      type: el.getAttribute?.("type") || null,
      ariaLabel: el.getAttribute?.("aria-label") || null,
      dataTestid: el.getAttribute?.("data-testid") || el.getAttribute?.("data-test-id") || null,
    },
    rect: {
      x: Math.round(rect.x), y: Math.round(rect.y),
      w: Math.round(rect.width), h: Math.round(rect.height),
      viewport: inViewport ? (rect.top < vh*0.5 ? "above-fold" : "below-fold-but-in-view") : "off-screen",
      visible
    },
    style: {
      color: cs.color, backgroundColor: cs.backgroundColor,
      // Eigener Hintergrund ist oft transparent (rgba(…,0)); für Kontrast-/Design-
      // Findings zählt der EFFEKTIVE Hintergrund aus der Elternkette — sonst sieht
      // der LLM „rgba(0,0,0,0)" und kann die Kontrast-Aussage nicht prüfen.
      effectiveBg: (/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(cs.backgroundColor) || cs.backgroundColor==="transparent") ? effectiveBackground(el) : cs.backgroundColor,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g,""),
      display: cs.display, position: cs.position,
      borderRadius: cs.borderRadius
    },
    ancestors,
    docTitle: doc.title || null
  };
}

// ============ Storage ============
const storeKey = src => "vibefeedback:v2:"+src;
function loadComments(src){
  try{
    const raw = localStorage.getItem(storeKey(src));
    if(raw){
      const arr = JSON.parse(raw);
      return arr.map(c => ({
        ...c,
        reactions: c.reactions || {likes:[],dislikes:[]},
        replies: (c.replies||[]).map(r => ({...r, reactions: r.reactions||{likes:[],dislikes:[]}}))
      }));
    }
    // Migration: v1 → v2
    const oldRaw = localStorage.getItem("vibefeedback:v1:"+src);
    if(oldRaw){
      const arr = JSON.parse(oldRaw).map(c => ({...c, category:c.category||"feature", priority:c.priority||"could", reactions:{likes:[],dislikes:[]}, replies:[]}));
      localStorage.setItem(storeKey(src), JSON.stringify(arr));
      return arr;
    }
    return [];
  }catch(e){ return []; }
}
function saveComments(src, arr){
  try{ localStorage.setItem(storeKey(src), JSON.stringify(arr)); return true; }
  catch(e){
    if(e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014)){
      const dayAgo = Date.now() - 864e5;
      let dropped = 0;
      // ts ist bei nativ erstellten Kommentaren ein ISO-String, bei Importen ggf. eine Zahl
      const tsMs = c => typeof c.ts === "number" ? c.ts : (Date.parse(c.ts) || 0);
      arr.forEach(c => { if(c.screenshot && tsMs(c) < dayAgo){ c.screenshot = null; dropped++; } });
      if(dropped){
        try{
          localStorage.setItem(storeKey(src), JSON.stringify(arr));
          toast(`Speicher knapp: ${dropped} alte Screenshot(s) entfernt, Kommentar gespeichert.`, 4000);
          return true;
        }catch(_){}
      }
      toast("Speicher voll — bitte alte Kommentare löschen.", 5000);
      return false;
    }
    toast("Speicher voll — Kommentar konnte nicht persistiert werden.", 4000);
    return false;
  }
}
const AUTHOR_KEY = "vibefeedback:v2:author";
const getAuthor = ()=> { try{ return localStorage.getItem(AUTHOR_KEY)||""; }catch(e){ return ""; } };
const setAuthor = v => { try{ localStorage.setItem(AUTHOR_KEY, v||""); }catch(e){} };

// Letzte Kategorie/Priorität pro Projekt merken → Serien gleichartiger Kommentare
// (z. B. mehrere Bugs) ohne jedes Mal neu zu klicken.
const LASTPICK_KEY = "vibefeedback:v2:lastpick";
const getLastPick = src => { try{ return JSON.parse(localStorage.getItem(LASTPICK_KEY+":"+src)||"{}"); }catch(e){ return {}; } };
const setLastPick = (src, cat, pri) => { try{ localStorage.setItem(LASTPICK_KEY+":"+src, JSON.stringify({cat, pri})); }catch(e){} };

function toggleReaction(commentId, type, replyId){
  const devId = getDeviceId();
  const cs = STATE.comments;
  let obj;
  if(replyId){
    const parent = cs.find(x=>x.id===commentId);
    obj = parent && (parent.replies||[]).find(r=>r.id===replyId);
  } else {
    obj = cs.find(x=>x.id===commentId);
  }
  if(!obj) return;
  obj.reactions = obj.reactions || {likes:[],dislikes:[]};
  const opp = type==="like" ? "dislikes" : "likes";
  obj.reactions[opp] = (obj.reactions[opp]||[]).filter(x=>x!==devId);
  const arr = obj.reactions[type] = obj.reactions[type]||[];
  const idx = arr.indexOf(devId);
  if(idx>=0) arr.splice(idx,1); else arr.push(devId);
  saveComments(STATE.src, cs);
  renderAll();
}

function addReply(commentId, text, author){
  const trimmed = (text||"").trim(); if(!trimmed) return;
  const c = STATE.comments.find(x=>x.id===commentId); if(!c) return;
  c.replies = c.replies||[];
  const id = Date.now().toString(36)+Math.random().toString(36).slice(2);
  c.replies.push({id, text:trimmed, author:author||"", ts:Date.now(), reactions:{likes:[],dislikes:[]}});
  saveComments(STATE.src, STATE.comments);
  renderAll();
}

const COACH_KEY = "vibefeedback:v2:coach-seen";
const seenCoach = ()=> { try{ return localStorage.getItem(COACH_KEY)==="1"; }catch(e){ return true; } };
const setSeenCoach = ()=> { try{ localStorage.setItem(COACH_KEY,"1"); }catch(e){} };
const EXPORT_REMINDER_KEY = "vibefeedback:v2:export-reminded";
const DEVICE_ID_KEY = "vibefeedback:anonId";
function getDeviceId(){
  try{
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if(!id){ id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)+Date.now().toString(36)); localStorage.setItem(DEVICE_ID_KEY, id); }
    return id;
  }catch(e){ return "anon"; }
}
const PRECISION_KEY = "vibefeedback:v2:precision";
const getPrecision = ()=> { try{ return localStorage.getItem(PRECISION_KEY)==="1"; }catch(e){ return false; } };
const setPrecision = v => { try{ localStorage.setItem(PRECISION_KEY, v?"1":"0"); }catch(e){} };

// ============ Setup View ============
function initLanding(){
  $("#view-landing").classList.remove("hidden");
  const input = $("#src-input");
  const err = $("#src-error");
  const result = $("#share-result");
  const link = $("#share-link");
  const corsHint = $("#cors-hint");

  $("#btn-generate").addEventListener("click", async ()=>{
    err.textContent=""; corsHint.textContent="";
    let val = input.value.trim();
    if(!val){ err.textContent="Bitte eine URL eingeben."; return; }
    try{
      const u = new URL(val);
      if(!/^https?:$/.test(u.protocol)) throw 0;
    }catch(e){ err.textContent="Ungültige URL (muss mit http/https beginnen)."; return; }

    const feedbackUrl = location.origin + location.pathname + "?src=" + encodeURIComponent(val);
    link.textContent = feedbackUrl;
    result.classList.remove("hidden");

    // Statustext IMMER in dunkler Vordergrundfarbe (WCAG AA); Semantik über Emoji
    // + getönten Hintergrund/Rahmen, nicht über hellen, kaum lesbaren Farbtext.
    const okStyle   = "color:var(--fg);background:rgba(98,193,45,.14);border-left:3px solid var(--success);padding:7px 10px;border-radius:6px";
    const warnStyle = "color:var(--fg);background:rgba(230,202,85,.20);border-left:3px solid var(--warn);padding:7px 10px;border-radius:6px";
    corsHint.style.cssText = "color:var(--muted)"; corsHint.textContent = "⏳ CORS-Check läuft…";
    try{
      const r = await fetch(val, { method:"GET", redirect:"follow" });
      if(!r.ok) throw new Error("HTTP "+r.status);
      const ct = r.headers.get("content-type")||"";
      if(!/text\/html|application\/xhtml/i.test(ct)){
        corsHint.innerHTML = `${icon("triangle-alert",13)} Response-Content-Type ist <code>${esc(ct||"unbekannt")}</code> — evtl. keine HTML-Seite.`;
        corsHint.style.cssText = warnStyle;
      }else{
        corsHint.innerHTML = `${icon("circle-check",13)} CORS OK — Tester können die Seite laden.`;
        corsHint.style.cssText = okStyle;
      }
    }catch(e){
      corsHint.innerHTML = `${icon("triangle-alert",13)} CORS blockiert oder Ziel nicht erreichbar (${esc(String(e.message||e))}). Tester bekommen im Fehlerfall einen Fallback zum HTML-Einfügen.`;
      corsHint.style.cssText = warnStyle;
    }

    $("#btn-preview").onclick = ()=> location.href = feedbackUrl + "&owner=1";
    $("#btn-copy").onclick = async ()=>{
      const t = feedbackUrl;
      try{ await navigator.clipboard.writeText(t); toast("Link kopiert."); }
      catch(e){
        const ta = document.createElement("textarea");
        ta.value = t; document.body.appendChild(ta); ta.select();
        try{ document.execCommand("copy"); toast("Link kopiert."); }
        catch(e2){ toast("Kopieren fehlgeschlagen — manuell markieren."); }
        ta.remove();
      }
    };
  });
  input.addEventListener("keydown", e=>{ if(e.key==="Enter") $("#btn-generate").click(); });
  // Bookmarklet link
  const bmLink = document.getElementById("bm-link");
  if(bmLink){ bmLink.href = "javascript:" + encodeURIComponent("/*!\n * VibeFeedback Layer — läuft auf jeder Seite via Bookmarklet.\n * Umgeht CORS/Iframe-Beschränkungen, indem er direkt in die Zielseite injiziert wird.\n * Speichert Kommentare in localStorage (Origin der Zielseite) und exportiert als Markdown.\n */\n!function(){if(window.__vf_layer_active)document.dispatchEvent(new CustomEvent(\"__vf_layer_toggle_sidebar\"));else{window.__vf_layer_active=!0;window.__vf_layer_version=\"0.8.0\";var e=\"vibefeedback:v2:\"+location.origin+location.pathname,t=\"vibefeedback:v2:author\",n=function(e,t){return[].slice.call((t||document).querySelectorAll(e))},r={bug:'<path d=\"M12 20v-9\"/><path d=\"M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z\"/><path d=\"M14.12 3.88 16 2\"/><path d=\"M21 21a4 4 0 0 0-3.81-4\"/><path d=\"M21 5a4 4 0 0 1-3.55 3.97\"/><path d=\"M22 13h-4\"/><path d=\"M3 21a4 4 0 0 1 3.81-4\"/><path d=\"M3 5a4 4 0 0 0 3.55 3.97\"/><path d=\"M6 13H2\"/><path d=\"m8 2 1.88 1.88\"/><path d=\"M9 7.13V6a3 3 0 1 1 6 0v1.13\"/>',sparkles:'<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\"/><path d=\"M20 2v4\"/><path d=\"M22 4h-4\"/><circle cx=\"4\" cy=\"20\" r=\"2\"/>',palette:'<path d=\"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z\"/><circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/>',type:'<path d=\"M12 4v16\"/><path d=\"M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2\"/><path d=\"M9 20h6\"/>',\"circle-help\":'<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><path d=\"M12 17h.01\"/>',heart:'<path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\"/>',\"message-square\":'<path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\"/>',clipboard:'<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/>',camera:'<path d=\"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z\"/><circle cx=\"12\" cy=\"13\" r=\"3\"/>'},a=[{id:\"bug\",label:\"Bug\",emoji:\"🐛\",icon:\"bug\",color:\"#e35f5f\",sub:\"Etwas funktioniert nicht\"},{id:\"feature\",label:\"Feature\",emoji:\"✨\",icon:\"sparkles\",color:\"#ffe05e\",sub:\"Idee / Wunsch\"},{id:\"design\",label:\"Design\",emoji:\"🎨\",icon:\"palette\",color:\"#62c12d\",sub:\"Sieht nicht richtig aus\"},{id:\"copy\",label:\"Copy\",emoji:\"📝\",icon:\"type\",color:\"#e6ca55\",sub:\"Text / Formulierung\"},{id:\"question\",label:\"Frage\",emoji:\"❓\",icon:\"circle-help\",color:\"#5c8fbf\",sub:\"Ich verstehe nicht...\"},{id:\"praise\",label:\"Lob\",emoji:\"❤️\",icon:\"heart\",color:\"#c67ba0\",sub:\"Das gefällt mir\"}],o={};a.forEach(function(e){o[e.id]=e});var i=[{id:\"must\",label:\"Muss\"},{id:\"should\",label:\"Sollte\"},{id:\"could\",label:\"Könnte\"},{id:\"nice\",label:\"Nice\"}],l={};i.forEach(function(e){l[e.id]=e});var c={bug:{fields:[{key:\"expected\",label:\"Erwartetes Verhalten\",placeholder:\"Was sollte passieren?\",rows:2},{key:\"actual\",label:\"Tatsächliches Verhalten\",placeholder:\"Was passiert stattdessen?\",rows:2},{key:\"steps\",label:\"Schritte zum Reproduzieren\",placeholder:\"1. …\\n2. …\\n3. …\",rows:3}]},feature:{fields:[{key:\"role\",label:\"Als …\",placeholder:\"z. B. neuer Nutzer\",rows:1},{key:\"want\",label:\"möchte ich …\",placeholder:\"welche Funktion?\",rows:2},{key:\"benefit\",label:\"damit …\",placeholder:\"welcher Nutzen?\",rows:2}]},design:{fields:[{key:\"issue\",label:\"Was stört visuell?\",placeholder:\"Kontrast, Spacing, Farbe…\",rows:2},{key:\"suggestion\",label:\"Vorschlag\",placeholder:\"Wie sollte es aussehen?\",rows:2}]},copy:{fields:[{key:\"current\",label:\"Aktueller Text\",placeholder:\"Copy&paste den Text\",rows:2},{key:\"suggestion\",label:\"Vorschlag\",placeholder:\"Wie besser?\",rows:2}]},question:{fields:[]},praise:{fields:[]}},s=\"data:image/svg+xml;base64,\"+btoa('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"48\" height=\"48\"><rect width=\"48\" height=\"48\" fill=\"#ececec\"/><path d=\"M0 0l48 48M48 0L0 48\" stroke=\"#d0d0d0\" stroke-width=\"1\"/></svg>'),d=null,f=null,u=j(x());u.length||x()===e||(u=j(e)),window.addEventListener(\"hashchange\",function(){u=j(x()),P(),D(),N()});var p=document.createElement(\"style\");p.textContent=[\".__vfl_root, .__vfl_root *, .__vfl_modal, .__vfl_modal * { box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }\",\".__vfl_hover { outline:2px dashed #262626 !important; outline-offset:2px; cursor:crosshair !important; }\",\".__vfl_selected { outline:3px solid #262626 !important; outline-offset:3px; box-shadow:0 0 0 8px rgba(255,224,94,.55) !important; }\",\".__vfl_marked { outline:2px solid var(--vfl-c,#ffe05e) !important; outline-offset:1px; }\",\".__vfl_badge { position:absolute; top:-11px; left:-11px; background:var(--vfl-c,#ffe05e); color:#262626; border:1px solid #262626; border-radius:99px; min-width:22px; height:22px; padding:0 5px; font:700 11px/1 system-ui,sans-serif; display:inline-flex; align-items:center; justify-content:center; z-index:2147483645; pointer-events:none; box-shadow:0 2px 6px rgba(38,38,38,.35); }\",\"body.__vfl_modal-open::after { content:''; position:fixed; inset:0; background:rgba(38,38,38,.35); z-index:2147483640; pointer-events:none; }\",\".__vfl_fab { position:fixed; bottom:20px; right:20px; z-index:2147483646; display:flex; flex-direction:column; gap:8px; align-items:flex-end; }\",\".__vfl_fab button { background:#262626; color:#ffe05e; border:1px solid #262626; border-radius:99px; padding:10px 16px; font:600 13px/1 system-ui,sans-serif; cursor:pointer; box-shadow:0 6px 20px rgba(38,38,38,.35); display:inline-flex; align-items:center; gap:6px; }\",\".__vfl_fab button:hover { background:#ffe05e; color:#262626; }\",\".__vfl_fab button.__vfl_active { background:#ffe05e; color:#262626; }\",\".__vfl_fab .__vfl_count { background:#e35f5f; color:#fff; border-radius:99px; padding:1px 8px; font-size:11px; margin-left:6px; }\",\".__vfl_side { position:fixed; top:0; right:0; bottom:0; width:min(400px,100vw); background:#fcfcfc; color:#262626; border-left:1px solid #e3e1d6; box-shadow:-6px 0 24px rgba(38,38,38,.15); z-index:2147483644; display:flex; flex-direction:column; transform:translateX(100%); transition:transform .22s ease; font-size:14px; }\",\".__vfl_side.__vfl_on { transform:translateX(0); }\",\".__vfl_side header { padding:14px 16px; border-bottom:1px solid #e3e1d6; display:flex; align-items:center; gap:10px; }\",\".__vfl_side header .__vfl_brand { font-weight:700; font-size:15px; flex:1; display:flex; align-items:center; gap:8px; }\",\".__vfl_side header .__vfl_brand img { height:22px; }\",\".__vfl_side header button { background:transparent; border:0; font-size:18px; cursor:pointer; padding:2px 6px; color:#7b7a71; }\",\".__vfl_side .__vfl_tools { padding:10px 12px; border-bottom:1px solid #e3e1d6; display:flex; gap:8px; flex-wrap:wrap; }\",\".__vfl_side .__vfl_tools button { background:#f1f1ec; color:#262626; border:1px solid #e3e1d6; border-radius:8px; padding:6px 12px; font-size:12.5px; cursor:pointer; font-weight:500; }\",\".__vfl_side .__vfl_tools button:hover { border-color:#262626; background:#ffe05e; }\",\".__vfl_list { flex:1; overflow-y:auto; padding:6px; }\",\".__vfl_empty { padding:40px 20px; color:#7b7a71; font-size:13px; text-align:center; }\",\".__vfl_item { background:#f1f1ec; border:1px solid #e3e1d6; border-left-width:3px; border-radius:8px; padding:10px 12px; margin:6px 4px; cursor:pointer; }\",\".__vfl_item:hover { border-color:#262626; background:#e8e6da; }\",\".__vfl_item .__vfl_row { display:flex; gap:6px; align-items:center; margin-bottom:4px; }\",\".__vfl_item .__vfl_num { background:#262626; color:#ffe05e; border-radius:99px; width:22px; height:22px; font-size:11px; display:grid; place-items:center; font-weight:700; }\",\".__vfl_item .__vfl_cat { padding:1px 8px; border-radius:99px; font-size:10.5px; font-weight:600; }\",\".__vfl_item .__vfl_del { margin-left:auto; background:transparent; border:0; cursor:pointer; color:#7b7a71; padding:2px 6px; font-size:14px; }\",\".__vfl_item .__vfl_del:hover { color:#e35f5f; }\",\".__vfl_item .__vfl_txt { font-size:13px; white-space:pre-wrap; word-break:break-word; margin-top:4px; }\",\".__vfl_item .__vfl_thumb { margin-top:8px; border:1px solid #e3e1d6; border-radius:6px; overflow:hidden; background:#fff; max-height:120px; text-align:center; }\",\".__vfl_item .__vfl_thumb img { max-width:100%; max-height:120px; display:inline-block; }\",\".__vfl_modal-bg { position:fixed; inset:0; background:rgba(38,38,38,.35); backdrop-filter:blur(4px); z-index:2147483647; display:grid; place-items:center; padding:12px; }\",\".__vfl_modal { background:#fff; border:1px solid #e3e1d6; border-radius:16px; width:100%; max-width:520px; padding:14px; box-shadow:0 20px 48px rgba(38,38,38,.2); max-height:calc(100dvh - 24px); overflow-y:auto; }\",\".__vfl_modal h3 { margin:0 0 8px; font-size:15px; color:#262626; display:flex; align-items:center; gap:8px; }\",\".__vfl_modal h3 .__vfl_tag { background:#262626; color:#ffe05e; padding:2px 8px; border-radius:6px; font-family:ui-monospace,monospace; font-size:12px; }\",\".__vfl_modal .__vfl_field { margin-bottom:7px; }\",\".__vfl_modal label { display:block; font-size:11px; color:#7b7a71; margin-bottom:3px; text-transform:uppercase; letter-spacing:.6px; font-weight:600; }\",\".__vfl_modal input, .__vfl_modal textarea { width:100%; background:#fff; border:1px solid #e3e1d6; color:#262626; padding:7px 9px; border-radius:8px; font:13px inherit; outline:none; }\",\".__vfl_modal input:focus, .__vfl_modal textarea:focus { border-color:#262626; box-shadow:0 0 0 3px rgba(255,224,94,.35); }\",\".__vfl_modal textarea { min-height:44px; resize:vertical; line-height:1.5; }\",\".__vfl_modal .__vfl_chips { display:flex; gap:6px; flex-wrap:wrap; }\",\".__vfl_ic { display:inline-block; vertical-align:-.15em; flex:none; }\",\".__vfl_modal .__vfl_chips .__vfl_pick { background:#f1f1ec; border:1px solid #e3e1d6; color:#3b3b3b; padding:6px 11px; border-radius:99px; font-size:12.5px; cursor:pointer; font-weight:500; }\",\".__vfl_modal .__vfl_chips .__vfl_pick[data-a='1'] { background:#ffe05e; border-color:#262626; color:#262626; font-weight:700; }\",\".__vfl_modal .__vfl_actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }\",\".__vfl_modal .__vfl_shotrow { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }\",\".__vfl_modal .__vfl_shotrow button { background:#f1f1ec; border:1px solid #e3e1d6; color:#3b3b3b; padding:6px 11px; border-radius:99px; font-size:12.5px; cursor:pointer; font-weight:500; }\",\".__vfl_modal .__vfl_shotrow button:hover { border-color:#262626; }\",\".__vfl_modal .__vfl_shothint { font-size:11px; color:#7b7a71; }\",\".__vfl_modal .__vfl_shotrow img { max-width:100%; max-height:110px; border:1px solid #e3e1d6; border-radius:8px; display:block; }\",\".__vfl_modal .__vfl_actions button { padding:9px 14px; border-radius:9px; border:1px solid #e3e1d6; background:#f1f1ec; color:#262626; font:600 13px inherit; cursor:pointer; }\",\".__vfl_modal .__vfl_actions button.__vfl_primary { background:#262626; border-color:#262626; color:#fcfcfc; }\",\".__vfl_modal .__vfl_actions button.__vfl_primary:hover { background:#ffe05e; color:#262626; }\",\".__vfl_toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#262626; color:#fcfcfc; padding:10px 16px; border-radius:10px; box-shadow:0 6px 20px rgba(38,38,38,.35); z-index:2147483647; font:13px system-ui; }\",\".__vfl_modal .__vfl_chips .__vfl_pick .__vfl_sub { display:block; font-size:10px; font-weight:400; opacity:.65; margin-top:1px; }\",\".__vfl_modal .__vfl_author-hint { font-size:11px; color:#5c8fbf; margin-top:3px; }\",\".__vfl_export-bar { position:fixed; bottom:0; left:0; right:0; z-index:2147483647; background:#ffe05e; border-top:2px solid #262626; padding:12px 16px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; box-shadow:0 -4px 20px rgba(38,38,38,.18); font:600 13px/1.4 system-ui,sans-serif; color:#262626; }\",\".__vfl_export-bar button { background:#262626; color:#ffe05e; border:1px solid #262626; border-radius:8px; padding:8px 14px; font:600 13px/1 system-ui,sans-serif; cursor:pointer; white-space:nowrap; }\",\".__vfl_export-bar button:hover { background:#1a1a1a; }\",\".__vfl_export-bar .__vfl_eb-dismiss { background:transparent; border:0; color:#262626; font-size:16px; padding:6px; cursor:pointer; margin-left:auto; flex-shrink:0; }\",\"@media(max-width:600px){ .__vfl_side { width:100vw; } .__vfl_fab { bottom:12px; right:12px; } .__vfl_fab button { padding:8px 12px; font-size:12px; } }\"].join(\"\\n\"),document.head.appendChild(p);var h=\"off\",_=null,v=\"vibefeedback:layer:export-reminded:\"+location.origin+location.pathname;document.addEventListener(\"visibilitychange\",function(){\"visible\"===document.visibilityState&&q()});var m=document.createElement(\"div\");m.className=\"__vfl_fab\",m.innerHTML='<button data-act=\"mode\" title=\"Kommentiermodus umschalten\">🎯 Kommentieren</button><button data-act=\"side\">'+k(\"message-square\",12)+' Liste <span class=\"__vfl_count\">'+u.length+\"</span></button>\",document.body.appendChild(m),m.querySelector('[data-act=\"mode\"]').addEventListener(\"click\",function(){O(\"select\"===h?\"off\":\"select\")}),m.querySelector('[data-act=\"side\"]').addEventListener(\"click\",function(){R()});var g=document.createElement(\"div\");g.className=\"__vfl_side\",g.innerHTML='<header><div class=\"__vfl_brand\"><span>'+k(\"message-square\",14)+'</span>VibeFeedback</div><button data-act=\"close\" title=\"Schließen\">✕</button></header><div class=\"__vfl_tools\"><button data-act=\"export-md\" title=\"Markdown-Datei herunterladen\">📄 Markdown</button><button data-act=\"export-json\" title=\"JSON-Datei herunterladen\">💾 JSON</button><button data-act=\"export-zip\" title=\"Markdown + Screenshots als Bilddateien in einem ZIP\">🗜 ZIP</button><button data-act=\"done\" title=\"Feedback fertig — Markdown herunterladen\" style=\"background:#262626;color:#ffe05e;border-color:#262626;font-weight:700\">✅ Fertig</button><button data-act=\"clear\" title=\"Alle Kommentare löschen\" style=\"margin-left:auto\">Alle löschen</button></div><div class=\"__vfl_list\"></div>',document.body.appendChild(g),document.addEventListener(\"__vf_layer_toggle_sidebar\",function(){R(!0)}),g.querySelector('[data-act=\"close\"]').addEventListener(\"click\",function(){R(!1)}),g.querySelector('[data-act=\"export-md\"]').addEventListener(\"click\",W),g.querySelector('[data-act=\"export-json\"]').addEventListener(\"click\",function(){if(!u.length)return void w(\"Keine Kommentare.\");V(\"vibefeedback-\"+(new Date).toISOString().slice(0,10)+\".json\",JSON.stringify({url:location.href,exportedAt:(new Date).toISOString(),comments:u},null,2),\"application/json\"),w(\"JSON heruntergeladen.\")}),g.querySelector('[data-act=\"export-zip\"]').addEventListener(\"click\",function(){if(!u.length)return void w(\"Keine Kommentare.\");try{var e=new TextEncoder,t=[],n=F({screenshotPath:function(e){var n=e.screenshot?function(e){var t=e.indexOf(\",\");if(t<0)return null;var n=e.slice(0,t);if(!/;base64/i.test(n))return null;for(var r=atob(e.slice(t+1)),a=new Uint8Array(r.length),o=0;o<r.length;o++)a[o]=r.charCodeAt(o);var i=n.match(/^data:image\\/(\\w+)/i);return{bytes:a,ext:(i&&i[1]||\"jpg\").replace(\"jpeg\",\"jpg\")}}(e.screenshot):null;if(!n)return null;var r,a,o=(r=e.info&&e.info.text||e.tag||\"element\",a=32,(r||\"\").toLowerCase().replace(/[äöüß]/g,function(e){return{\"ä\":\"ae\",\"ö\":\"oe\",\"ü\":\"ue\",\"ß\":\"ss\"}[e]}).replace(/[^a-z0-9]+/g,\"-\").replace(/^-+|-+$/g,\"\").slice(0,a||32)||\"element\"),i=\"screenshots/\"+String(t.length+1).padStart(2,\"0\")+\"-\"+o+\".\"+n.ext;return t.push({name:i,data:n.bytes}),i}}),r=JSON.stringify({url:location.href,exportedAt:(new Date).toISOString(),count:u.length,comments:u},null,2),a=[\"# VibeFeedback-Export\",\"\",\"- **feedback.md** — Feedback zum Lesen und als Prompt-Grundlage; Screenshots sind als Bilddateien verlinkt.\",\"- **feedback.json** — vollständige Daten inkl. eingebetteter Screenshots; in VibeFeedback re-importierbar.\",\"- **screenshots/** — ein Bild je kommentiertem Element.\",\"\",\"Quelle: \"+location.href,\"Exportiert: \"+(new Date).toLocaleString(\"de-DE\")+\" · \"+u.length+\" Kommentar(e)\",\"\"].join(\"\\n\"),o=Z([{name:\"feedback.md\",data:e.encode(n)},{name:\"feedback.json\",data:e.encode(r)},{name:\"README.md\",data:e.encode(a)}].concat(t)),i=URL.createObjectURL(o),l=document.createElement(\"a\");l.href=i,l.download=\"vibefeedback-\"+(new Date).toISOString().slice(0,10)+\".zip\",document.body.appendChild(l),l.click(),l.remove(),setTimeout(function(){URL.revokeObjectURL(i)},500),w(\"ZIP heruntergeladen — \"+t.length+\" Screenshot(s).\",3e3)}catch(e){console.warn(\"[vfl] zip\",e),w(\"ZIP-Export fehlgeschlagen.\")}}),g.querySelector('[data-act=\"done\"]').addEventListener(\"click\",function(){u.length?(W(),w(\"Markdown heruntergeladen. Feedback abgeschlossen!\")):w(\"Noch keine Kommentare.\")}),g.querySelector('[data-act=\"clear\"]').addEventListener(\"click\",function(){u.length&&confirm(\"Alle Kommentare für diese Seite löschen?\")&&(u=[],A(),D(),P(),N())}),document.addEventListener(\"mouseover\",function(e){\"select\"===h&&(I(e.target)||(_&&_!==e.target&&_.classList.remove(\"__vfl_hover\"),(_=e.target).classList.add(\"__vfl_hover\")))},!0),document.addEventListener(\"mouseout\",function(e){\"select\"===h&&e.target&&e.target.classList&&e.target.classList.remove(\"__vfl_hover\")},!0),document.addEventListener(\"click\",function(e){if(\"select\"===h&&!I(e.target)){e.preventDefault(),e.stopPropagation();var r=e.target;_&&(_.classList.remove(\"__vfl_hover\"),_=null),O(\"off\"),function(e,r){var o=!!r,l=e||null,s=r?r.selector:function(e){if(!e||1!==e.nodeType)return\"\";for(var t=function(e){try{return 1===document.querySelectorAll(e).length}catch(e){return!1}},n=function(e){if(!e||1!==e.nodeType)return\"\";var n=e.tagName.toLowerCase();if(e.id){var r=\"#\"+CSS.escape(e.id);if(t(r))return r}var a=function(e){return(\"string\"==typeof e.className?e.className:\"\").trim().split(/\\s+/).filter(function(e){return e&&!/^__vfl?_/.test(e)})}(e).slice(0,2).map(function(e){return\".\"+CSS.escape(e)}).join(\"\"),o=n+a,i=e.parentNode;if(!i||1!==i.nodeType)return o;var l=[].slice.call(i.children).filter(function(t){return t.tagName===e.tagName});return l.length>1&&(o+=\":nth-of-type(\"+(l.indexOf(e)+1)+\")\"),o},r=[],a=e;a&&1===a.nodeType&&\"html\"!==a.tagName.toLowerCase();){var o=n(a);r.unshift(o);var i=r.join(\" > \");if(t(i))return i;if(a=a.parentNode,r.length>8)break}return r.join(\" > \")}(l),d=r?r.snippet:function(e,t){if(!e)return\"\";t=t||400;var n=e.cloneNode(!0);n.querySelectorAll&&n.querySelectorAll(\".__vfl_badge, .__vfl_hover, .__vfl_selected\").forEach(function(e){e.remove()});var r=n.outerHTML||\"\";return r.length>t?r.slice(0,t)+\"…\":r}(l),f=r?r.tag:l.tagName.toLowerCase(),p=r?r.info:function(e){if(!e||1!==e.nodeType)return null;var t=e.getBoundingClientRect(),n=window.getComputedStyle(e);return{role:e.getAttribute&&e.getAttribute(\"role\")||e.tagName.toLowerCase(),id:e.id||null,text:(e.innerText||e.textContent||\"\").trim().replace(/\\s+/g,\" \").slice(0,220)||null,attrs:{href:e.getAttribute&&e.getAttribute(\"href\")||null,alt:e.getAttribute&&e.getAttribute(\"alt\")||null,ariaLabel:e.getAttribute&&e.getAttribute(\"aria-label\")||null},rect:{x:Math.round(t.x),y:Math.round(t.y),w:Math.round(t.width),h:Math.round(t.height)},style:{color:n.color,backgroundColor:n.backgroundColor,fontSize:n.fontSize}}}(l),h=r&&r.category||\"feature\",_=r&&r.priority||\"could\",v=r&&r.structured?Object.assign({},r.structured):{};l&&!o&&l.classList.add(\"__vfl_selected\");document.body.classList.add(\"__vfl_modal-open\");var m=document.createElement(\"div\");m.className=\"__vfl_modal-bg\",m.innerHTML='<div class=\"__vfl_modal\" role=\"dialog\"><h3>'+(o?\"Kommentar bearbeiten\":\"Kommentar\")+' <span class=\"__vfl_tag\">&lt;'+y(f)+'&gt;</span></h3><div class=\"__vfl_field\"><label>Kategorie</label><div class=\"__vfl_chips\" data-r=\"cats\">'+a.map(function(e){return'<span class=\"__vfl_pick\" data-cat=\"'+e.id+'\" data-a=\"'+(e.id===h?1:0)+'\" title=\"'+y(e.sub||\"\")+'\">'+k(e.icon,12)+\" \"+y(e.label)+(e.sub?'<span class=\"__vfl_sub\">'+y(e.sub)+\"</span>\":\"\")+\"</span>\"}).join(\"\")+'</div></div><div class=\"__vfl_field\"><label>Priorität</label><div class=\"__vfl_chips\" data-r=\"prios\">'+i.map(function(e){return'<span class=\"__vfl_pick\" data-p=\"'+e.id+'\" data-a=\"'+(e.id===_?1:0)+'\">'+y(e.label)+\"</span>\"}).join(\"\")+'</div></div><div class=\"__vfl_field\"><label>Von</label><input type=\"text\" data-r=\"author\" placeholder=\"Dein Name (wird gespeichert)\">'+(T()?\"\":'<span class=\"__vfl_author-hint\">Einmalig eingeben — wird für nächste Kommentare gemerkt.</span>')+'</div><div data-r=\"tpl\"></div><div class=\"__vfl_field\"><label data-r=\"text-label\">Kommentar</label><textarea data-r=\"text\" placeholder=\"Was ist dir aufgefallen?\"></textarea></div><div class=\"__vfl_field\"><label>Screenshot</label><div class=\"__vfl_shotrow\">'+(o?\"\":'<button type=\"button\" data-act=\"capture-shot\" title=\"Screenshot dieses Elements aufnehmen\">'+k(\"camera\",12)+\" Aufnehmen</button>\")+'<button type=\"button\" data-act=\"paste-shot\" title=\"Eigenen Screenshot aus der Zwischenablage einfügen (oder Strg+V)\">'+k(\"clipboard\",12)+' Aus Zwischenablage</button><span class=\"__vfl_shothint\" data-r=\"shot-hint\">'+(o?\"leer = vorhandener bleibt\":\"optional — leer = kein Screenshot\")+'</span><img data-r=\"shot-preview\" alt=\"Screenshot-Vorschau\" hidden></div></div><div class=\"__vfl_actions\"><button data-act=\"cancel\">Abbrechen</button><button class=\"__vfl_primary\" data-act=\"save\">'+(o?\"Aktualisieren\":\"Speichern\")+\"</button></div></div>\",document.body.appendChild(m);var g=m.querySelector('[data-r=\"text\"]'),b=m.querySelector('[data-r=\"author\"]'),x=m.querySelector('[data-r=\"text-label\"]'),S=m.querySelector('[data-r=\"tpl\"]');b.value=r&&r.author||T(),o&&(g.value=r.text||\"\");var L=null,E=null,M=m.querySelector('[data-act=\"capture-shot\"]');M&&M.addEventListener(\"click\",function(){l?(M.disabled=!0,M.textContent=\"Screenshot…\",C(l).then(function(e){E=e||null,L=null;var t=m.querySelector('[data-r=\"shot-preview\"]');e?(t.src=e,t.hidden=!1,m.querySelector('[data-r=\"shot-hint\"]').textContent=\"Screenshot aufgenommen\"):w(\"Screenshot nicht verfügbar.\"),M.disabled=!1,M.innerHTML=k(\"camera\",12)+\" Aufnehmen\"}).catch(function(){M.disabled=!1,M.innerHTML=k(\"camera\",12)+\" Aufnehmen\",w(\"Screenshot fehlgeschlagen.\")})):w(\"Kein Element ausgewählt.\")});function U(e){(function(e){return new Promise(function(t){if(!e)return t(null);var n=URL.createObjectURL(e),r=new Image;r.onload=function(){URL.revokeObjectURL(n);var e=Math.min(1,1400/Math.max(r.naturalWidth||1,r.naturalHeight||1)),a=document.createElement(\"canvas\");a.width=Math.max(1,Math.round((r.naturalWidth||1)*e)),a.height=Math.max(1,Math.round((r.naturalHeight||1)*e));var o=a.getContext(\"2d\");o.fillStyle=\"#fff\",o.fillRect(0,0,a.width,a.height),o.drawImage(r,0,0,a.width,a.height),t(a.toDataURL(\"image/jpeg\",.82))},r.onerror=function(){URL.revokeObjectURL(n),t(null)},r.src=n})})(e).then(function(e){if(e){L=e;var t=m.querySelector('[data-r=\"shot-preview\"]');t.src=e,t.hidden=!1,m.querySelector('[data-r=\"shot-hint\"]').textContent=\"eigener Screenshot wird verwendet\",w(\"Eigener Screenshot übernommen.\")}else w(\"Bild konnte nicht gelesen werden.\")})}function z(){var e=c[h],t=e&&e.fields.length;S.innerHTML=t?e.fields.map(function(e){return'<div class=\"__vfl_field\"><label>'+y(e.label)+'</label><textarea data-tpl=\"'+y(e.key)+'\" rows=\"'+(e.rows||2)+'\" placeholder=\"'+y(e.placeholder||\"\")+'\">'+y(v[e.key]||\"\")+\"</textarea></div>\"}).join(\"\"):\"\",n(\"[data-tpl]\",S).forEach(function(e){e.addEventListener(\"input\",function(){v[e.dataset.tpl]=e.value})}),x.textContent=t?\"Notiz (optional)\":\"Kommentar\",g.placeholder=t?\"Kontext, Nebenaspekte…\":\"Was ist dir aufgefallen?\"}m.querySelector('[data-act=\"paste-shot\"]').addEventListener(\"click\",function(){navigator.clipboard&&navigator.clipboard.read?navigator.clipboard.read().then(function(e){for(var t=0;t<e.length;t++){for(var n=null,r=0;r<e[t].types.length;r++)0===e[t].types[r].indexOf(\"image/\")&&(n=e[t].types[r]);if(n)return e[t].getType(n).then(U)}w(\"Kein Bild in der Zwischenablage — erst Screenshot kopieren, dann den Einfügen-Knopf nutzen.\",3500)}).catch(function(){w(\"Zugriff auf Zwischenablage nicht erlaubt — nutze Strg+V.\",3500)}):w(\"Zwischenablage nicht verfügbar — nutze Strg+V.\",3500)}),m.addEventListener(\"paste\",function(e){for(var t=e.clipboardData&&e.clipboardData.items||[],n=0;n<t.length;n++)if(0===t[n].type.indexOf(\"image/\"))return e.preventDefault(),void U(t[n].getAsFile())}),z(),setTimeout(function(){var e,t;(e=\"[data-tpl]\",t=S,(t||document).querySelector(e)||g).focus()},40),n(\"[data-r=cats] .__vfl_pick\",m).forEach(function(e){e.addEventListener(\"click\",function(){h=e.dataset.cat,n(\"[data-r=cats] .__vfl_pick\",m).forEach(function(t){t.dataset.a=t===e?1:0}),z()})}),n(\"[data-r=prios] .__vfl_pick\",m).forEach(function(e){e.addEventListener(\"click\",function(){_=e.dataset.p,n(\"[data-r=prios] .__vfl_pick\",m).forEach(function(t){t.dataset.a=t===e?1:0})})});var j=!1,q=!1;function O(){q=!0,m.remove(),document.body.classList.remove(\"__vfl_modal-open\"),l&&l.classList.remove(\"__vfl_selected\"),document.removeEventListener(\"keydown\",K,!0)}function N(){if(!j){var e=g.value.trim(),n=c[h],a={},i=!1;if(n&&n.fields.length&&n.fields.forEach(function(e){var t=(v[e.key]||\"\").trim();t&&(a[e.key]=t,i=!0)}),!e&&!i)return g.focus(),void w(\"Kommentar darf nicht leer sein.\");var l=b.value.trim();!function(e){try{e?localStorage.setItem(t,e):localStorage.removeItem(t)}catch(e){}}(l);var x=m.querySelector('[data-act=\"save\"]');j=!0,x.disabled=!0,x.textContent=\"Speichere…\",Promise.resolve(L||E||(r?r.screenshot:null)).then(function(t){if(!q){if(o){var n=Object.assign({},r);return Object.assign(r,{text:e,structured:i?a:null,author:l||null,category:h,priority:_,updatedAt:(new Date).toISOString()}),L&&(r.screenshot=L),void(A()?(D(),P(),O(),w(\"Aktualisiert.\"),R(!0)):(Object.assign(r,n),j=!1,x.disabled=!1,x.textContent=\"Aktualisieren\"))}u.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),selector:s,snippet:d,tag:f,info:p,pageUrl:location.origin+location.pathname+location.search+location.hash,text:e,structured:i?a:null,screenshot:t||null,author:l||null,category:h,priority:_,ts:(new Date).toISOString()}),A()?(D(),P(),O(),w(\"Gespeichert.\"),R(!0)):(u.pop(),j=!1,x.disabled=!1,x.textContent=\"Speichern\")}}).catch(function(){q||(j=!1,x.disabled=!1,x.textContent=o?\"Aktualisieren\":\"Speichern\",w(\"Fehler beim Speichern.\"))})}}function K(e){\"Escape\"===e.key?(e.preventDefault(),O()):(e.metaKey||e.ctrlKey)&&\"Enter\"===e.key&&(e.preventDefault(),N())}document.addEventListener(\"keydown\",K,!0),m.querySelector('[data-act=\"cancel\"]').addEventListener(\"click\",O),m.querySelector('[data-act=\"save\"]').addEventListener(\"click\",N),m.addEventListener(\"click\",function(e){e.target===m&&O()})}(r)}},!0);var b=function(){for(var e=new Uint32Array(256),t=0;t<256;t++){for(var n=t,r=0;r<8;r++)n=1&n?3988292384^n>>>1:n>>>1;e[t]=n>>>0}return e}();window.__vf_layer_zip={buildZip:Z,crc32:B,dosDateTime:H},P(),N(),u.length?(R(!0),w(\"VibeFeedback Layer — \"+u.length+\" Kommentar(e) geladen.\")):w(\"VibeFeedback Layer aktiv — klick auf 🎯 Kommentieren und dann auf ein Element.\",3500)}function x(){return\"vibefeedback:v2:\"+location.origin+location.pathname+location.search+location.hash}function y(e){return(null==e?\"\":String(e)).replace(/[&<>\"']/g,function(e){return{\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",'\"':\"&quot;\",\"'\":\"&#39;\"}[e]})}function w(e,t){n(\".__vfl_toast\").forEach(function(e){e.remove()});var r=document.createElement(\"div\");r.className=\"__vfl_toast\",r.textContent=e,document.body.appendChild(r),setTimeout(function(){r.remove()},t||2200)}function k(e,t){var n=r[e];return n?'<svg class=\"__vfl_ic\" width=\"'+(t=t||13)+'\" height=\"'+t+'\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">'+n+\"</svg>\":\"\"}function S(e){for(var t=e;t&&1===t.nodeType;){try{var n=window.getComputedStyle(t).backgroundColor;if(n&&\"transparent\"!==n&&!/rgba\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*0\\s*\\)/.test(n))return n}catch(e){break}t=t.parentElement}return\"#ffffff\"}function L(e,t){return t?e.replace(/url\\(\\s*(['\"]?)([^'\")]+)\\1\\s*\\)/g,function(e,n,r){if(/^(data:|https?:|\\/\\/)/i.test(r))return e;try{return'url(\"'+new URL(r,t).href+'\")'}catch(t){return e}}):e}function E(e,t,n){return Promise.race([e,new Promise(function(e){setTimeout(function(){e(n)},t)})])}function M(e){function t(t){return fetch(e,{mode:\"cors\",cache:t}).then(function(e){if(!e.ok)throw new Error(\"http \"+e.status);return e.blob().then(function(e){return new Promise(function(t,n){var r=new FileReader;r.onload=function(){t(r.result)},r.onerror=n,r.readAsDataURL(e)})})})}return t(\"force-cache\").catch(function(){return t(\"reload\")}).catch(function(){return!1})}function U(){return f||(e=\"\",t=[],[].slice.call(document.styleSheets||[]).forEach(function(n){var r=null;try{r=n.cssRules}catch(e){}r?[].slice.call(r).forEach(function(t){t.type===CSSRule.FONT_FACE_RULE&&(e+=L(t.cssText,n.href||document.baseURI)+\"\\n\")}):n.href&&t.push(E(fetch(n.href,{mode:\"cors\"}).then(function(t){return t.ok?t.text().then(function(t){var r,a;e+=(r=t,a=n.href,(r.match(/@font-face\\s*\\{[^}]*\\}/g)||[]).filter(function(e){return!/unicode-range/i.test(e)||-1!==e.indexOf(\"U+0000-00FF\")||/U\\+0-/.test(e)}).map(function(e){return L(e,a)}).join(\"\\n\")+\"\\n\")}):null}).catch(function(){}),5e3,null))}),f=Promise.all(t).then(function(){return E(function(e){for(var t,n=/url\\(\\s*(['\"]?)(https?:[^'\")]+)\\1\\s*\\)/g,r=[];t=n.exec(e);)-1===r.indexOf(t[2])&&r.push(t[2]);r=r.slice(0,24);var a={};return Promise.all(r.map(function(e){return M(e).then(function(t){t&&(a[e]=t)})})).then(function(){return e.replace(/url\\(\\s*(['\"]?)(https?:[^'\")]+)\\1\\s*\\)/g,function(e,t,n){return a[n]?'url(\"'+a[n]+'\")':e})})}(e),8e3,e)}),f.then(function(e){return e||(f=null),e}));var e,t}function C(e){if(!e||1!==e.nodeType)return Promise.resolve(null);var t=e.getBoundingClientRect();return t.width<2||t.height<2?Promise.resolve(null):(window.modernScreenshot&&window.modernScreenshot.domToCanvas?Promise.resolve(!0):d||(d=new Promise(function(e){var t=document.createElement(\"script\");t.src=\"https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js\",t.onload=function(){e(!(!window.modernScreenshot||!window.modernScreenshot.domToCanvas))},t.onerror=function(){d=null,t.remove(),e(!1)},document.head.appendChild(t)}))).then(function(t){if(!t)return z(e);var r=function(e){var t=[\"__vfl_hover\",\"__vfl_selected\",\"__vfl_marked\"],r=[];[e].concat(n(\".\"+t.join(\", .\"),e)).forEach(function(e){if(e.classList){var n=t.filter(function(t){return e.classList.contains(t)});n.length&&(e.classList.remove.apply(e.classList,n),r.push([e,n]))}});var a=document.body.classList.contains(\"__vfl_modal-open\");return a&&document.body.classList.remove(\"__vfl_modal-open\"),function(){r.forEach(function(e){e[0].classList.add.apply(e[0].classList,e[1])}),a&&document.body.classList.add(\"__vfl_modal-open\")}}(e);return E(U().catch(function(){return\"\"}),8e3,\"\").then(function(t){var n={scale:Math.min(2,window.devicePixelRatio||1),backgroundColor:S(e),timeout:8e3,filter:function(e){return!(1===e.nodeType&&\"string\"==typeof e.className&&-1!==e.className.indexOf(\"__vfl_\"))},fetch:{requestInit:{cache:\"force-cache\"},placeholderImage:s},fetchFn:M};return t&&(n.font={cssText:t}),window.modernScreenshot.domToCanvas(e,n).then(function(e){var t=1400;if(e.width>t||e.height>t){var n=Math.min(t/e.width,t/e.height),r=document.createElement(\"canvas\");r.width=Math.round(e.width*n),r.height=Math.round(e.height*n),r.getContext(\"2d\").drawImage(e,0,0,r.width,r.height),e=r}return e.toDataURL(\"image/jpeg\",.82)})}).then(function(e){return r(),e},function(t){return r(),z(e)})})}function z(e){return new Promise(function(t){if(!e||1!==e.nodeType)return t(null);try{var n=e.getBoundingClientRect(),r=Math.max(1,Math.ceil(n.width+20)),a=Math.max(1,Math.ceil(n.height+20)),o=1400,i=1;(r>o||a>o)&&(i=Math.min(o/r,o/a),r=Math.round(r*i),a=Math.round(a*i));var l=e.cloneNode(!0);!function e(t,n){if(t&&n&&1===n.nodeType){for(var r=window.getComputedStyle(t),a=\"\",o=0;o<r.length;o++)a+=r[o]+\":\"+r.getPropertyValue(r[o])+\";\";n.setAttribute(\"style\",a),n.removeAttribute(\"class\");for(var i=t.children,l=n.children,c=0;c<i.length&&c<l.length;c++)e(i[c],l[c])}}(e,l);var c=document.createElement(\"div\");c.style.cssText=\"padding:10px;box-sizing:border-box;background:#fff;display:inline-block;transform-origin:top left;transform:scale(\"+i+\")\",c.appendChild(l);var s=(new XMLSerializer).serializeToString(c),d=new Blob(['<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"'+r+'\" height=\"'+a+'\"><foreignObject width=\"100%\" height=\"100%\"><div xmlns=\"http://www.w3.org/1999/xhtml\">'+s+\"</div></foreignObject></svg>\"],{type:\"image/svg+xml;charset=utf-8\"}),f=URL.createObjectURL(d),u=new Image,p=setTimeout(function(){URL.revokeObjectURL(f),t(null)},4e3);u.onload=function(){clearTimeout(p);try{var e=Math.min(2,window.devicePixelRatio||1),n=document.createElement(\"canvas\");n.width=Math.round(r*e),n.height=Math.round(a*e);var o=n.getContext(\"2d\");o.scale(e,e),o.fillStyle=\"#fff\",o.fillRect(0,0,r,a),o.drawImage(u,0,0,r,a),t(n.toDataURL(\"image/jpeg\",.78))}catch(e){t(null)}URL.revokeObjectURL(f)},u.onerror=function(){clearTimeout(p),URL.revokeObjectURL(f),t(null)},u.src=f}catch(e){t(null)}})}function j(e){try{var t=JSON.parse(localStorage.getItem(e)||\"[]\");return Array.isArray(t)?t:[]}catch(e){return[]}}function A(){try{return localStorage.setItem(x(),JSON.stringify(u)),!0}catch(e){return w(\"Storage voll — Kommentar nicht gespeichert.\"),!1}}function T(){try{return localStorage.getItem(t)||localStorage.getItem(\"vibefeedback:author\")||\"\"}catch(e){return\"\"}}function q(){u.length>0&&!localStorage.getItem(v)&&(localStorage.setItem(v,\"1\"),function(){if(!document.querySelector(\".__vfl_export-bar\")){var e=document.createElement(\"div\");e.className=\"__vfl_export-bar\";var t=u.length;e.innerHTML='<span style=\"flex:1;min-width:160px\">'+k(\"message-square\",13)+\" Du hast <strong>\"+t+\" Kommentar\"+(1===t?\"\":\"e\")+'</strong>. Fertig? Exportiere dein Feedback!</span><button data-act=\"er-md\">⬇ Als Markdown</button><button data-act=\"er-dismiss\" class=\"__vfl_eb-dismiss\" aria-label=\"Schließen\">✕</button>',document.body.appendChild(e),e.querySelector('[data-act=\"er-md\"]').addEventListener(\"click\",function(){W(),e.remove()}),e.querySelector('[data-act=\"er-dismiss\"]').addEventListener(\"click\",function(){e.remove()})}}())}function O(e){h=e;var t=m.querySelector('[data-act=\"mode\"]');\"select\"===e?(t.classList.add(\"__vfl_active\"),t.textContent=\"✕ Modus aus\",document.body.style.cursor=\"crosshair\"):(t.classList.remove(\"__vfl_active\"),t.textContent=\"🎯 Kommentieren\",document.body.style.cursor=\"\",_&&(_.classList.remove(\"__vfl_hover\"),_=null))}function R(e){var t=\"boolean\"==typeof e?e:!g.classList.contains(\"__vfl_on\");g.classList.toggle(\"__vfl_on\",t),t&&D()}function N(){var e=m.querySelector(\".__vfl_count\");e&&(e.textContent=u.length)}function D(){var e=g.querySelector(\".__vfl_list\");if(!u.length)return e.innerHTML='<div class=\"__vfl_empty\">Noch keine Kommentare.<br>Klick oben auf 🎯 Kommentieren und dann auf ein Element.</div>',void N();e.innerHTML=u.map(function(e,t){var n,r,a=o[e.category]||o.feature,i=function(e){if(e.structured&&Object.keys(e.structured).length){var t=c[e.category];if(t&&t.fields.length)return t.fields.map(function(t){return e.structured[t.key]?t.label+\": \"+e.structured[t.key].replace(/\\s+/g,\" \"):null}).filter(Boolean).join(\" · \")+(e.text?\" · Notiz: \"+e.text.replace(/\\s+/g,\" \"):\"\")}return e.text||\"\"}(e);return'<div class=\"__vfl_item\" data-id=\"'+y(e.id)+'\" style=\"border-left-color:'+a.color+'\"><div class=\"__vfl_row\"><div class=\"__vfl_num\">'+(t+1)+'</div><span class=\"__vfl_cat\" style=\"background:'+a.color+'22;color:#262626\">'+k(a.icon,11)+\" \"+y(a.label)+'</span><button class=\"__vfl_del\" data-del=\"'+y(e.id)+'\" title=\"Löschen\">✕</button></div><div class=\"__vfl_txt\">'+y((r=200,(n=(n=i)||\"\").length<=r?n:n.slice(0,r)+\"…\"))+\"</div>\"+(e.screenshot?'<div class=\"__vfl_thumb\"><img src=\"'+e.screenshot+'\" alt=\"\"></div>':\"\")+\"</div>\"}).join(\"\"),n(\".__vfl_item\",e).forEach(function(e){e.addEventListener(\"click\",function(t){if(!t.target.closest(\"[data-del]\")){var n=u.find(function(t){return t.id===e.dataset.id});n&&function(e){var t=K(e);if(!t)return void w(\"Element nicht im DOM.\");t.scrollIntoView({behavior:\"smooth\",block:\"center\"}),t.animate([{boxShadow:\"0 0 0 0 rgba(255,224,94,.95)\"},{boxShadow:\"0 0 0 14px rgba(255,224,94,0)\"}],{duration:900})}(n)}})}),n(\"[data-del]\",e).forEach(function(e){e.addEventListener(\"click\",function(t){t.stopPropagation(),u=u.filter(function(t){return t.id!==e.dataset.del}),A(),D(),P(),N()})}),N()}function K(e){try{var t=document.querySelector(e.selector);if(t)return t}catch(e){}var n=e.info,r=e.tag||\"*\";if(!n)return null;if(n.id){var a=document.getElementById(n.id);if(a)return a}try{if(n.attrs&&n.attrs.ariaLabel){var o=document.querySelector('[aria-label=\"'+n.attrs.ariaLabel.replace(/\\\\/g,\"\\\\\\\\\").replace(/\"/g,'\\\\\"')+'\"]');if(o)return o}}catch(e){}try{if(n.attrs&&n.attrs.href){var i=document.querySelector('a[href=\"'+n.attrs.href.replace(/\\\\/g,\"\\\\\\\\\").replace(/\"/g,'\\\\\"')+'\"]');if(i)return i}}catch(e){}if(n.text){var l=n.text.trim().slice(0,80);if(l.length>=4){var c=[].slice.call(document.querySelectorAll(r)),s=c.filter(function(e){return(e.innerText||e.textContent||\"\").trim().slice(0,80)===l})[0];if(s)return s;if(l.length>=20){var d=l.slice(0,40),f=c.filter(function(e){return-1!==(e.innerText||e.textContent||\"\").trim().indexOf(d)})[0];if(f)return f}}}return null}function P(){n(\".__vfl_badge\").forEach(function(e){e.remove()}),n(\".__vfl_marked\").forEach(function(e){e.classList.remove(\"__vfl_marked\"),e.style.removeProperty(\"--vfl-c\")}),n(\"[data-vfl-pos-set]\").forEach(function(e){e.style.removeProperty(\"position\"),delete e.dataset.vflPosSet}),u.forEach(function(e,t){var n=K(e);if(n){var r=o[e.category]||o.feature;n.classList.add(\"__vfl_marked\"),n.style.setProperty(\"--vfl-c\",r.color);var a=/^(img|input|svg|video|canvas|iframe|br|hr)$/i.test(n.tagName)?n.parentElement:n;if(a){\"static\"===getComputedStyle(a).position&&(a.style.position=\"relative\",a.dataset.vflPosSet=\"1\");var i=document.createElement(\"span\");i.className=\"__vfl_badge\",i.style.setProperty(\"--vfl-c\",r.color),i.innerHTML=k(r.icon,11)+\" \"+(t+1),a.appendChild(i)}}})}function I(e){for(;e;){if(e.classList&&(e.classList.contains(\"__vfl_side\")||e.classList.contains(\"__vfl_fab\")||e.classList.contains(\"__vfl_modal-bg\")||e.classList.contains(\"__vfl_toast\")))return!0;e=e.parentNode}return!1}function F(e){e=e||{};var t=(new Date).toLocaleString(\"de-DE\"),n={must:0,should:1,could:2,nice:3},r=u.slice().sort(function(e,t){return(n[e.priority]||9)-(n[t.priority]||9)}),o=\"# Feedback zu \"+location.href+\"\\n\\n\";o+=\"> \"+u.length+\" Kommentar(e), exportiert \"+t+\". Erzeugt via VibeFeedback Bookmarklet.\\n\\n\";var i={};return a.forEach(function(e){i[e.id]=[]}),r.forEach(function(e){(i[e.category]||(i[e.category]=[])).push(e)}),a.forEach(function(t){var n=i[t.id]||[];n.length&&(o+=\"## \"+t.emoji+\" \"+t.label+\" (\"+n.length+\")\\n\\n\",n.forEach(function(t,n){var r=l[t.priority]||l.could;if(o+=\"### \"+(n+1)+\". `<\"+t.tag+\">` — Priorität: \"+r.label+\"\\n\\n\",o+=\"- **CSS-Selector:** `\"+t.selector+\"`\\n\",t.author&&(o+=\"- **Von:** \"+t.author+\"\\n\"),o+=\"- **Zeitstempel:** \"+new Date(t.ts).toLocaleString(\"de-DE\")+\"\\n\\n\",o+=\"**HTML-Auszug:**\\n\\n```html\\n\"+t.snippet+\"\\n```\\n\\n\",t.screenshot){var a=e.screenshotPath?e.screenshotPath(t,n):t.screenshot;a&&(o+=\"<details><summary>📷 Screenshot</summary>\\n\\n![Screenshot](\"+a+\")\\n\\n</details>\\n\\n\")}if(t.structured&&Object.keys(t.structured).length){var i=c[t.category];o+=\"**Feedback:**\\n\\n\",(i.fields||[]).forEach(function(e){var n=t.structured[e.key];n&&(o+=\"- **\"+e.label+\":**\\n\"+n.split(\"\\n\").map(function(e){return\"  > \"+e}).join(\"\\n\")+\"\\n\")}),t.text&&(o+=\"- **Notiz:**\\n\"+t.text.split(\"\\n\").map(function(e){return\"  > \"+e}).join(\"\\n\")+\"\\n\"),o+=\"\\n---\\n\\n\"}else o+=\"**Feedback:**\\n\\n\"+(t.text||\"\").split(\"\\n\").map(function(e){return\"> \"+e}).join(\"\\n\")+\"\\n\\n---\\n\\n\"}))}),o}function V(e,t,n){var r=new Blob([t],{type:n||\"text/plain;charset=utf-8\"}),a=URL.createObjectURL(r),o=document.createElement(\"a\");o.href=a,o.download=e,document.body.appendChild(o),o.click(),o.remove(),setTimeout(function(){URL.revokeObjectURL(a)},500)}function B(e){for(var t=4294967295,n=0;n<e.length;n++)t=b[255&(t^e[n])]^t>>>8;return(4294967295^t)>>>0}function H(e){return{time:e.getHours()<<11|e.getMinutes()<<5|e.getSeconds()>>1,date:e.getFullYear()-1980<<9|e.getMonth()+1<<5|e.getDate()}}function Z(e,t){var n=new TextEncoder,r=H(t||new Date),a=[],o=[],i=0;e.forEach(function(e){var t=n.encode(e.name),l=e.data,c=B(l),s=new DataView(new ArrayBuffer(30));s.setUint32(0,67324752,!0),s.setUint16(4,20,!0),s.setUint16(6,2048,!0),s.setUint16(8,0,!0),s.setUint16(10,r.time,!0),s.setUint16(12,r.date,!0),s.setUint32(14,c,!0),s.setUint32(18,l.length,!0),s.setUint32(22,l.length,!0),s.setUint16(26,t.length,!0),s.setUint16(28,0,!0),a.push(new Uint8Array(s.buffer),t,l);var d=new DataView(new ArrayBuffer(46));d.setUint32(0,33639248,!0),d.setUint16(4,20,!0),d.setUint16(6,20,!0),d.setUint16(8,2048,!0),d.setUint16(10,0,!0),d.setUint16(12,r.time,!0),d.setUint16(14,r.date,!0),d.setUint32(16,c,!0),d.setUint32(20,l.length,!0),d.setUint32(24,l.length,!0),d.setUint16(28,t.length,!0),d.setUint32(42,i,!0),o.push(new Uint8Array(d.buffer),t),i+=30+t.length+l.length});var l=o.reduce(function(e,t){return e+t.length},0),c=new DataView(new ArrayBuffer(22));return c.setUint32(0,101010256,!0),c.setUint16(8,e.length,!0),c.setUint16(10,e.length,!0),c.setUint32(12,l,!0),c.setUint32(16,i,!0),new Blob(a.concat(o,[new Uint8Array(c.buffer)]),{type:\"application/zip\"})}function W(){u.length?(V(\"vibefeedback-\"+(new Date).toISOString().slice(0,10)+\".md\",F(),\"text/markdown;charset=utf-8\"),w(\"Markdown heruntergeladen.\")):w(\"Keine Kommentare.\")}}();"); }
}

// ============ App View ============
const STATE = { src:"", currentUrl:"", isOwner:false, comments:[], filter:"all", frameDoc:null, precision:false, frameInfoBox:null, mode:"comment", renderMode:"mirror", pendingScrollSelector:null };
const MODE_KEY = "vibefeedback:v2:mode";
const getMode = ()=> { try{ const v = localStorage.getItem(MODE_KEY); return v==="nav" ? "nav" : "comment"; }catch(e){ return "comment"; } };
const setMode = v => { try{ localStorage.setItem(MODE_KEY, v); }catch(e){} };
const RENDER_KEY = "vibefeedback:v2:render";
const getRender = ()=> { try{ const v = localStorage.getItem(RENDER_KEY); return v==="direct" ? "direct" : "mirror"; }catch(e){ return "mirror"; } };
const setRender = v => { try{ localStorage.setItem(RENDER_KEY, v); }catch(e){} };

async function initApp(src, isOwner){
  $("#view-app").classList.remove("hidden");
  STATE.src = src;
  STATE.currentUrl = src;
  STATE.isOwner = isOwner;
  STATE.comments = loadComments(src);

  updateUrlDisplay();
  const roleEl = $("#topbar-role");
  roleEl.textContent = isOwner ? "Owner-Dashboard" : "Feedback-Modus";
  roleEl.classList.add(isOwner ? "owner" : "commenter");

  $("#btn-back").onclick = ()=> location.href = location.origin + location.pathname;
  $("#btn-export").onclick = ()=> exportMarkdown(false);
  if(VFZIP) $("#btn-export-zip").onclick = ()=> exportZip();
  else $("#btn-export-zip").hidden = true;
  $("#btn-copy-md").onclick = ()=> exportMarkdown(true);
  $("#btn-import").onclick = ()=> $("#btn-import-file").click();
  $("#btn-import-file").addEventListener("change", ()=> importComments($("#btn-import-file")));
  $("#btn-present").onclick = ()=> openPresentation();

  STATE.precision = getPrecision();
  const tgl = $("#tgl-precision");
  tgl.checked = STATE.precision;
  tgl.addEventListener("change", ()=>{
    STATE.precision = tgl.checked;
    setPrecision(STATE.precision);
    applyPrecisionState();
    toast(STATE.precision ? "Präzisionsmodus aktiv." : "Präzisionsmodus aus.");
  });

  STATE.mode = getMode();
  const applyMode = () => {
    $$("#mode-toggle button").forEach(b => b.classList.toggle("active", b.dataset.mode === STATE.mode));
    applyPrecisionState();
  };
  $$("#mode-toggle button").forEach(b => b.addEventListener("click", ()=>{
    if(STATE.renderMode === "direct"){ toast("Im Original-Modus sind Klick-Kommentare deaktiviert."); return; }
    if(STATE.mode === b.dataset.mode) return;
    STATE.mode = b.dataset.mode;
    setMode(STATE.mode);
    applyMode();
    toast(STATE.mode === "nav" ? "Navigationsmodus — Klicks gehen an die Seite." : "Kommentiermodus — Klicks öffnen Feedback.");
  }));
  applyMode();

  STATE.renderMode = getRender();
  const rtgl = $("#tgl-render");
  rtgl.checked = STATE.renderMode === "direct";
  const applyRenderUi = () => {
    const direct = STATE.renderMode === "direct";
    $("#mode-toggle").style.opacity = direct ? ".5" : "1";
    $("#mode-toggle").style.pointerEvents = direct ? "none" : "";
    tgl.disabled = direct;
    tgl.closest(".precision-toggle").style.opacity = direct ? ".5" : "1";
    let banner = $("#render-banner");
    if(direct && !banner){
      banner = document.createElement("div");
      banner.id = "render-banner";
      banner.innerHTML = `${icon("monitor",13)} <b>Original-Rendering aktiv</b> — Seite lädt 1:1 wie im echten Browser. Klick-Kommentieren ist hier nicht möglich (Cross-Origin). Zurück in den Mirror-Modus für Feedback.`;
      $("#canvas").appendChild(banner);
    }else if(!direct && banner){ banner.remove(); }
  };
  rtgl.addEventListener("change", async ()=>{
    STATE.renderMode = rtgl.checked ? "direct" : "mirror";
    setRender(STATE.renderMode);
    applyRenderUi();
    toast(STATE.renderMode === "direct" ? "Original-Rendering — 1:1 wie im Browser." : "Mirror-Modus — Klick-Kommentieren aktiv.");
    await loadIntoFrame(STATE.src);
  });
  applyRenderUi();

  $("#dbg-toggle").addEventListener("click", ()=>{
    $("#dbg-panel").classList.toggle("on");
  });
  $("#btn-clear").onclick = ()=>{
    if(!STATE.comments.length){ toast("Nichts zu löschen."); return; }
    if(confirm("Alle Kommentare unwiderruflich löschen?")){
      STATE.comments = [];
      saveComments(STATE.src, STATE.comments);
      renderAll(); refreshFrameBadges();
    }
  };

  renderAll();

  // Sidebar-Tools nach Rolle: Commenter sehen nur Export
  if(!isOwner){
    const importBtn = document.getElementById('btn-import');
    const clearBtn = document.getElementById('btn-clear');
    if(importBtn) importBtn.style.display = 'none';
    if(clearBtn) clearBtn.style.display = 'none';
    // Import-File-Input auch verstecken
    const importFile = document.getElementById('btn-import-file');
    if(importFile) importFile.style.display = 'none';
  }

  await loadIntoFrame(src);
  if(!isOwner && !seenCoach() && !STATE.comments.length){
    showCoachMark();
  }

  // Export-Reminder: beim Tab-Wechsel zurück (wenn Kommentare vorhanden)
  const handleVisibility = () => {
    if(document.visibilityState === 'visible'
      && STATE.comments.length > 0
      && !sessionStorage.getItem(EXPORT_REMINDER_KEY)
      && !document.querySelector('.cbar')){ // cbar nicht offen
      sessionStorage.setItem(EXPORT_REMINDER_KEY, '1');
      showExportReminder();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
}

async function loadIntoFrame(src){
  const loader = $("#loader"), frame = $("#frame"), errbox = $("#errbox");
  loader.classList.remove("hidden"); frame.classList.add("hidden"); errbox.classList.add("hidden");
  frame.removeAttribute("src"); frame.removeAttribute("srcdoc");
  STATE.currentUrl = src;
  updateUrlDisplay();

  if(STATE.renderMode === "direct"){
    // Original-Rendering: echter iframe.src, pixelgenau — aber kein Klick-Hook (cross-origin)
    frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    frame.onload = null;
    frame.src = src;
    frame.classList.remove("hidden");
    frame.onload = ()=>{
      loader.classList.add("hidden");
      STATE.frameDoc = null;
      try{ hookFrame(frame.contentDocument); }catch(e){ /* cross-origin — expected */ }
      refreshFrameBadges();
    };
    // Timeout-Fallback: falls X-Frame-Options blockt sehen wir keinen onload
    setTimeout(()=>{ if(!loader.classList.contains("hidden")){ loader.classList.add("hidden"); }}, 4000);
    return;
  }

  try{
    const res = await fetch(src, { redirect:"follow" });
    if(!res.ok) throw new Error("HTTP "+res.status);
    const finalUrl = res.url || src;
    try{
      const srcHost = new URL(src).host;
      const finalHost = new URL(finalUrl).host;
      if(srcHost !== finalHost) throw new Error(`Redirect zu ${finalHost} — abgebrochen (Host-Wechsel).`);
    }catch(err){ if(err.message?.startsWith("Redirect")) throw err; }
    let html = await res.text();
    STATE.currentUrl = finalUrl;
    updateUrlDisplay();
    html = injectBase(html, finalUrl);
    frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    frame.onload = null;
    frame.srcdoc = html;
    frame.classList.remove("hidden");
    frame.onload = ()=>{
      loader.classList.add("hidden");
      hookFrame(frame.contentDocument);
      renderAll(); // pageref-Chips + Filter neu anhand STATE.currentUrl
      // Post-load: falls ein Sprung angefordert war (Comment-Klick auf andere Page), jetzt scrollen
      if(STATE.pendingScrollSelector){
        const cmt = STATE.pendingScrollSelector; STATE.pendingScrollSelector = null;
        setTimeout(()=> scrollToSelector(cmt), 240);
      }
    };
  }catch(e){
    loader.classList.add("hidden");
    showError(e);
  }
}

function updateUrlDisplay(){
  const el = $("#topbar-src"); if(!el) return;
  try{
    const u = new URL(STATE.currentUrl);
    const path = u.pathname + u.search + u.hash;
    const isEntry = STATE.currentUrl === STATE.src;
    el.innerHTML = `<span style="color:var(--muted)">${esc(u.host)}</span><span style="color:${isEntry?"var(--muted)":"var(--accent-2)"};font-weight:${isEntry?"400":"600"}">${esc(path)}</span>`;
    el.title = STATE.currentUrl + (isEntry?" (Startseite)":" — Subpage");
  }catch(e){ el.textContent = STATE.currentUrl; }
}

// Same-project check: erlauben wir Navigation nur wenn URL denselben Host wie STATE.src hat
function isSameProject(url){
  try{ return new URL(url).host === new URL(STATE.src).host; }
  catch(e){ return false; }
}

function injectBase(html, src){
  const baseHref = new URL("./", src).href;
  const safety = `<script>(function(){
    // history.pushState/replaceState würden auf about:srcdoc SecurityError werfen — swallow
    try{
      const _r = history.replaceState.bind(history);
      history.replaceState = function(s,t,u){ try{ _r(s,t,u); }catch(e){} };
      const _p = history.pushState.bind(history);
      history.pushState = function(s,t,u){ try{ _p(s,t,u); }catch(e){} };
    }catch(e){}
    // Fehler an Parent melden, damit Debug im Owner-Log möglich ist
    window.addEventListener("error", e => { try{ parent.postMessage({__vf:"err", msg:String(e.message), src:e.filename, line:e.lineno}, "*"); }catch(_){} });
    window.addEventListener("unhandledrejection", e => { try{ parent.postMessage({__vf:"rej", msg:String(e.reason && (e.reason.message||e.reason)) }, "*"); }catch(_){} });
  })();<\/script>`;
  // Hat die Seite ein eigenes <base> (nur im <head>-Bereich prüfen, nicht im Body-Text),
  // lassen wir es stehen — Safety-Script und Referrer-Meta braucht sie trotzdem,
  // sonst wirft z.B. jede SPA-Navigation auf about:srcdoc ungefangene SecurityErrors.
  const headArea = html.slice(0, 4000);
  const hasOwnBase = /<base\s[^>]*href/i.test(headArea);
  const baseTag = (hasOwnBase ? "" : `<base href="${baseHref}">`)
    + `<meta name="referrer" content="no-referrer-when-downgrade">${safety}`;
  if(/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + baseTag);
  if(/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, m => m + "<head>"+baseTag+"</head>");
  return "<head>"+baseTag+"</head>"+html;
}

const IFRAME_LOG = [];
function pushIframeLog(kind, msg, extra){
  IFRAME_LOG.push({ kind, msg, extra, ts:Date.now() });
  if(IFRAME_LOG.length > 40) IFRAME_LOG.shift();
  const badge = document.getElementById("dbg-badge");
  const toggle = document.getElementById("dbg-toggle");
  if(badge) badge.textContent = IFRAME_LOG.length;
  if(toggle) toggle.classList.add("on");
  renderDbgPanel();
}
function renderDbgPanel(){
  const panel = document.getElementById("dbg-panel"); if(!panel) return;
  panel.innerHTML = IFRAME_LOG.slice().reverse().map(e =>
    `<div class="dbg-item ${e.kind}"><div class="dbg-kind">${e.kind}</div><div class="dbg-msg">${esc(e.msg)}</div>${e.extra?`<div class="dbg-extra">${esc(e.extra)}</div>`:""}</div>`
  ).join("") || `<div class="dbg-empty">Keine Iframe-Fehler bisher.</div>`;
}
window.addEventListener("message", e => {
  const d = e.data;
  if(!d || typeof d !== "object") return;
  if(d.__vf === "err"){ console.warn("[iframe error]", d.msg, d.src+":"+d.line); pushIframeLog("error", d.msg, (d.src||"")+":"+(d.line||"")); }
  if(d.__vf === "rej"){ console.warn("[iframe promise rejection]", d.msg); pushIframeLog("rejection", d.msg); }
  if(d.__vf === "log"){ console.info("[iframe]", d.msg); pushIframeLog("info", d.msg); }
});

function showError(e){
  const box = $("#errbox");
  box.classList.remove("hidden");
  box.innerHTML = `
    <div style="max-width:520px">
      <h3>Projekt konnte nicht geladen werden</h3>
      <p class="muted">${esc(String(e && e.message || e))}</p>
      <p class="muted">
        Wahrscheinlich blockiert CORS den Abruf. Das Ziel muss <code>Access-Control-Allow-Origin</code> erlauben
        (GitHub Pages, Netlify, Vercel u.v.m. tun das). Alternativ: HTML-Quelltext direkt einfügen.
      </p>
      <div class="actions">
        <button class="primary" id="btn-paste">HTML einfügen</button>
        <button id="btn-retry">Erneut versuchen</button>
      </div>
    </div>`;
  $("#btn-retry").onclick = ()=> loadIntoFrame(STATE.src);
  $("#btn-paste").onclick = ()=>{
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(38,38,38,.5);backdrop-filter:blur(4px);z-index:9999;display:grid;place-items:center;padding:20px";
    overlay.innerHTML = `<div style="background:var(--panel);border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;width:100%;max-width:600px;box-shadow:var(--shadow-lg)">
      <h3 style="margin:0 0 8px;font-size:16px">HTML-Quelltext einfügen</h3>
      <p style="margin:0 0 12px;color:var(--muted);font-size:13px">Kopiere den Quelltext deiner Seite (Strg+U im Browser) und füge ihn hier ein.</p>
      <textarea id="paste-area" style="width:100%;min-height:200px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;resize:vertical" placeholder="&lt;!doctype html&gt;&#10;&lt;html&gt;…"></textarea>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
        <button id="paste-cancel">Abbrechen</button>
        <button class="primary" id="paste-ok">Laden</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    const ta = overlay.querySelector("#paste-area");
    setTimeout(()=>ta.focus(), 40);
    const close = ()=>{ overlay.remove(); };
    overlay.querySelector("#paste-cancel").onclick = close;
    overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });
    overlay.querySelector("#paste-ok").onclick = ()=>{
      const raw = ta.value.trim();
      if(!raw){ ta.focus(); return; }
      const html = injectBase(raw, STATE.src);
      const frame = $("#frame");
      frame.srcdoc = html;
      frame.classList.remove("hidden");
      box.classList.add("hidden");
      frame.onload = ()=> hookFrame(frame.contentDocument);
      close();
    };
    overlay.addEventListener("keydown", e=>{ if(e.key==="Escape") close(); });
  };
}

function hookFrame(doc){
  STATE.frameDoc = doc;
  const style = doc.createElement("style");
  style.textContent = `
    .__vf_hover{outline:2px dashed #262626 !important;outline-offset:2px;cursor:crosshair!important;transition:outline-color .1s}
    .__vf_hover.__vf_precise{outline:3px solid #262626 !important;outline-offset:2px;box-shadow:0 0 0 6px rgba(255,224,94,.35),0 0 30px rgba(255,224,94,.6) !important}
    .__vf_marked{outline:2px solid var(--vf-c, #262626) !important;outline-offset:1px}
    body.__vf_modal-open .__vf_selected{outline:3px solid #262626 !important;outline-offset:3px;box-shadow:0 0 0 6px rgba(255,224,94,.6),0 0 32px rgba(255,224,94,.7) !important;position:relative;z-index:2147483641 !important}
    .__vf_badge{position:absolute;top:-11px;left:-11px;background:var(--vf-c, #ffe05e);color:#262626;border-radius:99px;
      min-width:22px;height:22px;padding:0 5px;font:700 11px system-ui,sans-serif;display:inline-flex;align-items:center;justify-content:center;gap:3px;z-index:2147483647;
      pointer-events:none;box-shadow:0 2px 6px rgba(38,38,38,.35);border:1px solid #262626}
    .__vf_badge .ic{display:inline-block;vertical-align:-.15em;flex:none}
    .__vf_infobox{position:fixed;background:#262626;color:#fcfcfc;border:1px solid #262626;border-radius:8px;
      padding:8px 10px;font:12px/1.4 -apple-system,system-ui,sans-serif;pointer-events:none;z-index:2147483646;
      max-width:320px;box-shadow:0 8px 24px rgba(38,38,38,.4);backdrop-filter:blur(4px)}
    .__vf_infobox .row{display:flex;gap:8px;align-items:baseline;margin-top:2px}
    .__vf_infobox .k{color:#98978e;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;min-width:52px}
    .__vf_infobox .v{color:#fcfcfc;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px;word-break:break-word}
    .__vf_infobox .tag{color:#ffe05e;font-weight:700;font-size:13px}
    .__vf_infobox .id{color:#ffe05e}
    .__vf_infobox .cls{color:#bab8ab}
    .__vf_infobox .txt{color:#e3e1d6;font-style:italic;font-size:11.5px;margin-top:4px;padding-top:4px;border-top:1px solid #3b3b3b}
  `;
  doc.head && doc.head.appendChild(style);

  // Info-Overlay (nur bei Precision-Mode)
  const info = doc.createElement("div");
  info.className = "__vf_infobox";
  info.style.display = "none";
  doc.body && doc.body.appendChild(info);

  const updateInfoPos = (e) => {
    const pad = 14, w = info.offsetWidth || 200, h = info.offsetHeight || 60;
    let x = e.clientX + pad, y = e.clientY + pad;
    if(x + w > doc.defaultView.innerWidth) x = e.clientX - w - pad;
    if(y + h > doc.defaultView.innerHeight) y = e.clientY - h - pad;
    info.style.left = Math.max(4, x) + "px";
    info.style.top  = Math.max(4, y) + "px";
  };
  const fillInfo = (el) => {
    const inf = elementInfo(el);
    if(!inf){ info.style.display="none"; return; }
    const tag = el.tagName.toLowerCase();
    const rows = [];
    rows.push(`<div><span class="tag">&lt;${tag}&gt;</span>${inf.id?` <span class="id">#${esc(inf.id)}</span>`:""}${inf.classes.length?` <span class="cls">.${inf.classes.slice(0,3).map(esc).join(".")}</span>`:""}</div>`);
    rows.push(`<div class="row"><span class="k">Rolle</span><span class="v">${esc(inf.role)}</span></div>`);
    rows.push(`<div class="row"><span class="k">Größe</span><span class="v">${inf.rect.w}×${inf.rect.h} px · ${inf.rect.viewport}</span></div>`);
    if(inf.attrs.href) rows.push(`<div class="row"><span class="k">Href</span><span class="v">${esc(truncate(inf.attrs.href,60))}</span></div>`);
    if(inf.attrs.src) rows.push(`<div class="row"><span class="k">Src</span><span class="v">${esc(truncate(inf.attrs.src,60))}</span></div>`);
    if(inf.attrs.ariaLabel) rows.push(`<div class="row"><span class="k">Aria</span><span class="v">${esc(inf.attrs.ariaLabel)}</span></div>`);
    if(inf.text) rows.push(`<div class="txt">"${esc(truncate(inf.text,110))}"</div>`);
    info.innerHTML = rows.join("");
  };

  let hovered = null;
  doc.addEventListener("mouseover", e=>{
    if(hovered) hovered.classList.remove("__vf_hover","__vf_precise");
    if(STATE.mode !== "comment") return;
    hovered = e.target;
    if(hovered && hovered.nodeType===1){
      hovered.classList.add("__vf_hover");
      if(STATE.precision){
        hovered.classList.add("__vf_precise");
        fillInfo(hovered);
        info.style.display = "block";
      }
    }
  }, true);
  doc.addEventListener("mousemove", e=>{
    if(STATE.mode === "comment" && STATE.precision && info.style.display !== "none") updateInfoPos(e);
  }, true);
  doc.addEventListener("mouseout", e=>{
    if(e.target && e.target.classList) e.target.classList.remove("__vf_hover","__vf_precise");
    info.style.display = "none";
  }, true);
  // Capture-Phase, damit wir vor SPA-Handlern (React/Vue etc. mit stopPropagation) greifen
  doc.addEventListener("click", e=>{
    if(STATE.mode === "comment"){
      e.preventDefault(); e.stopPropagation();
      info.style.display = "none";
      // Klick auf einen Badge zielt aufs kommentierte Element, nicht auf den Badge.
      const badge = e.target.closest && e.target.closest(".__vf_badge");
      const targetEl = badge ? badge.parentElement : e.target;
      // Hat das Element schon Kommentare? Dann diese zeigen statt blind einen neuen
      // zu öffnen (Dedup + Kollaboration). Nur wenn keine cbar offen ist — sonst gilt
      // das übliche Re-Target-Verhalten.
      if(targetEl && !window.__vf_active_cbar){
        // Nur Kommentare DIESER Seite zählen — sonst matcht resolveElement per
        // Fallback ein gleichnamiges Element einer anderen Subpage (Fehl-Blockade).
        const here = STATE.comments.filter(c => {
          if(commentPage(c) !== STATE.currentUrl) return false;
          try{ return resolveElement(c, doc) === targetEl; }catch(_){ return false; }
        });
        if(here.length){
          const it = document.querySelector(`.item[data-id="${here[0].id}"]`);
          if(it){ $$(".item").forEach(x=>x.classList.remove("active")); it.classList.add("active"); it.scrollIntoView({block:"center"}); }
          focusComment(here[0]);
          actionToast(`Dieses Element hat schon ${here.length} Kommentar${here.length>1?"e":""}.`, "Neuen hinzufügen", ()=> openCommentModal(targetEl));
          return;
        }
      }
      openCommentModal(targetEl);
      return;
    }
    // Nav-Modus: Link-Klicks abfangen und durch unseren Loader routen,
    // damit wir in derselben Subpage-Kette bleiben (statt cross-origin wegzuwandern).
    const a = e.target.closest && e.target.closest("a[href]");
    if(!a) return;
    const rawHref = a.getAttribute("href");
    if(!rawHref) return;
    if(/^(javascript:|mailto:|tel:|#)/i.test(rawHref)) return; // interne Anker/Protokolle in Ruhe lassen
    let resolved;
    try{ resolved = new URL(rawHref, doc.baseURI).href; }catch(_){ return; }
    // Anker auf derselben Page: Browser scrollen lassen
    const cur = new URL(STATE.currentUrl);
    const res = new URL(resolved);
    if(cur.origin===res.origin && cur.pathname===res.pathname && cur.search===res.search && res.hash){
      return; // gleicher Path, nur Hash → nativer Anker-Scroll
    }
    if(!isSameProject(resolved)){
      toast("Externer Link — im neuen Tab öffnen: " + resolved.slice(0,60));
      e.preventDefault(); e.stopPropagation();
      try{ window.open(resolved, "_blank", "noopener"); }catch(_){}
      return;
    }
    e.preventDefault(); e.stopPropagation();
    loadIntoFrame(resolved);
  }, true);
  doc.addEventListener("submit", e=>{
    if(STATE.mode === "comment"){ e.preventDefault(); return; }
    // Nav-Modus: GET-Forms per Loader routen, POST/andere blocken
    const f = e.target;
    if(!(f instanceof doc.defaultView.HTMLFormElement)) return;
    const method = (f.getAttribute("method")||"get").toLowerCase();
    if(method !== "get"){ e.preventDefault(); toast("POST-Formulare im PoC nicht unterstützt."); return; }
    e.preventDefault();
    try{
      const action = f.getAttribute("action") || doc.baseURI;
      const url = new URL(action, doc.baseURI);
      const fd = new FormData(f);
      const params = new URLSearchParams();
      for(const [k,v] of fd.entries()){ if(typeof v === "string") params.append(k,v); }
      url.search = params.toString();
      if(isSameProject(url.href)) loadIntoFrame(url.href);
    }catch(err){
      console.warn("[vf] form-submit", err);
      toast("Formular konnte nicht geöffnet werden.");
    }
  }, true);

  STATE.frameInfoBox = info;
  refreshFrameBadges();
}

function applyPrecisionState(){
  const doc = STATE.frameDoc; if(!doc) return;
  if((!STATE.precision || STATE.mode !== "comment") && STATE.frameInfoBox) STATE.frameInfoBox.style.display = "none";
  if(STATE.mode !== "comment"){
    doc.querySelectorAll(".__vf_hover, .__vf_precise").forEach(n => n.classList.remove("__vf_hover","__vf_precise"));
  }
}

// ============ Screenshot ============
// Engine 1: modern-screenshot (SVG foreignObject) — der Browser rendert den Klon selbst,
//           inkl. Grid/Flex/Gradients/oklch/Webfonts; Bilder werden per fetch (CORS) als
//           dataURL inlined. Das kommt dem, was der Nutzer wirklich sieht, am nächsten.
// Engine 2: html2canvas (Canvas-2D-Nachbau) — Fallback, wenn Engine 1 nicht lädt/scheitert.
// Engine 3: strukturelles Canvas-2D-Drahtgitter — Notnagel ganz ohne CDN.

const MS_CDN  = "https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js";
const H2C_CDN = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
const SHOT_PLACEHOLDER = "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#ececec"/><path d="M0 0l48 48M48 0L0 48" stroke="#d0d0d0" stroke-width="1"/></svg>');

const _libLoading = {};
function loadScriptOnce(key, url, isReady){
  if(isReady()) return Promise.resolve(true);
  if(_libLoading[key]) return _libLoading[key];
  _libLoading[key] = new Promise(resolve=>{
    const s = document.createElement("script");
    s.src = url;
    s.onload  = ()=> resolve(isReady());
    // Fehlversuch nicht dauerhaft cachen — beim nächsten Capture erneut probieren
    // (sonst degradiert ein einzelner CDN-Schluckauf die ganze Session aufs Drahtgitter)
    s.onerror = ()=>{ _libLoading[key] = null; s.remove(); resolve(false); };
    document.head.appendChild(s);
  });
  return _libLoading[key];
}
const loadModernScreenshot = ()=> loadScriptOnce("ms",  window.__VF_MS_OVERRIDE  || MS_CDN,  ()=> !!window.modernScreenshot?.domToCanvas);
const loadHtml2Canvas      = ()=> loadScriptOnce("h2c", window.__VF_H2C_OVERRIDE || H2C_CDN, ()=> !!window.html2canvas);

// VF-eigene Overlays (Hover-Outline, Auswahl-Glow, Badges) dürfen nicht mit aufs Bild —
// der Screenshot soll die Seite zeigen, nicht unser Werkzeug.
function stripVfArtifacts(el){
  const doc = el.ownerDocument;
  const CLASSES = ["__vf_hover","__vf_precise","__vf_selected","__vf_marked","__pv_hi"];
  const touched = [];
  [el, ...el.querySelectorAll("."+CLASSES.join(", ."))].forEach(n=>{
    if(!n.classList) return;
    const had = CLASSES.filter(c => n.classList.contains(c));
    if(had.length){ n.classList.remove(...had); touched.push([n, had]); }
  });
  const modalOpen = doc.body?.classList.contains("__vf_modal-open");
  if(modalOpen) doc.body.classList.remove("__vf_modal-open");
  return ()=>{
    touched.forEach(([n, had]) => n.classList.add(...had));
    if(modalOpen) doc.body?.classList.add("__vf_modal-open");
  };
}
function isVfNode(n){
  return n.nodeType === 1 && typeof n.className === "string" &&
         (n.className.includes("__vf_") || n.className.includes("__pv_"));
}

// @font-face-Regeln der Zielseite einsammeln — auch aus Cross-Origin-Stylesheets
// (z.B. Google Fonts), auf die cssRules-Zugriff einen SecurityError wirft.
// modern-screenshot überspringt solche Sheets, dadurch fehlten die Webfonts im Screenshot.
const _fontCssCache = new WeakMap();
function absolutizeCssUrls(css, baseHref){
  if(!baseHref) return css;
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u)=>{
    if(/^(data:|https?:|\/\/)/i.test(u)) return m;
    try{ return `url("${new URL(u, baseHref).href}")`; }catch(e){ return m; }
  });
}
function extractFontFaces(cssText, baseHref){
  const blocks = (cssText.match(/@font-face\s*\{[^}]*\}/g) || [])
    // Nur Latin-Subset behalten (Google Fonts liefert pro Gewicht viele Subsets) —
    // sonst betten wir dutzende Fontdateien ein, die im Screenshot nie gebraucht werden.
    .filter(b => !/unicode-range/i.test(b) || b.includes("U+0000-00FF") || /U\+0-/.test(b));
  return blocks.map(b => absolutizeCssUrls(b, baseHref)).join("\n");
}

// Asset als dataURL holen. Erst aus dem Cache; schlägt das fehl, mit cache:"reload"
// erneut: Viele CDNs (z.B. image.tmdb.org) senden Access-Control-Allow-Origin nur,
// wenn die Anfrage einen Origin-Header trägt. Normale <img>-Loads senden keinen —
// die gecachte Antwort hat dann keine CORS-Freigabe und der cors-fetch scheitert.
// Ein frischer Request (mode:cors → Origin-Header) bekommt die Freigabe.
// Ein hängender Host darf die Capture-Kette nicht blockieren
const withTimeout = (p, ms, fallback) =>
  Promise.race([p, new Promise(r => setTimeout(()=> r(fallback), ms))]);

async function fetchAsDataUrl(url){
  for(const cache of ["force-cache", "reload"]){
    try{
      const res = await fetch(url, {mode:"cors", cache});
      if(!res.ok) continue;
      const blob = await res.blob();
      return await new Promise((ok, err)=>{
        const fr = new FileReader();
        fr.onload  = ()=> ok(fr.result);
        fr.onerror = err;
        fr.readAsDataURL(blob);
      });
    }catch(e){ /* nächster Versuch bzw. endgültig kein CORS */ }
  }
  return false;
}

// Fontdateien als dataURL einbetten: das SVG-foreignObject wird als <img> gerendert
// und darf keine Netzwerk-Requests machen — remote url() in @font-face bliebe leer.
async function inlineFontData(css){
  const URL_RE = /url\(\s*(['"]?)(https?:[^'")]+)\1\s*\)/g;
  const unique = [...new Set([...css.matchAll(URL_RE)].map(m => m[2]))].slice(0, 24);
  const resolved = new Map();
  await Promise.all(unique.map(async u=>{
    const dataUrl = await fetchAsDataUrl(u);
    if(dataUrl) resolved.set(u, dataUrl);
  }));
  return css.replace(URL_RE, (m, q, u)=> resolved.has(u) ? `url("${resolved.get(u)}")` : m);
}
async function collectFontCss(doc){
  if(_fontCssCache.has(doc)) return _fontCssCache.get(doc);
  let css = "";
  const fetchCss = async url=>{
    try{
      const res = await withTimeout(fetch(url, {mode:"cors"}), 5000, null);
      if(res && res.ok) css += extractFontFaces(await res.text(), url) + "\n";
    }catch(e){ /* kein CORS → Font bleibt Fallback */ }
  };
  for(const sheet of Array.from(doc.styleSheets || [])){
    let rules = null;
    try{ rules = sheet.cssRules; }catch(e){}
    if(!rules){ if(sheet.href) await fetchCss(sheet.href); continue; }
    for(const r of Array.from(rules)){
      if(r.type === CSSRule.FONT_FACE_RULE){
        css += absolutizeCssUrls(r.cssText, sheet.href || doc.baseURI) + "\n";
      }else if(r.type === CSSRule.IMPORT_RULE){
        let sub = null;
        try{ sub = r.styleSheet && r.styleSheet.cssRules; }catch(e){}
        if(sub){
          for(const rr of Array.from(sub)) if(rr.type === CSSRule.FONT_FACE_RULE)
            css += absolutizeCssUrls(rr.cssText, r.styleSheet.href || sheet.href || doc.baseURI) + "\n";
        }else if(r.href){
          await fetchCss(new URL(r.href, sheet.href || doc.baseURI).href);
        }
      }
    }
  }
  css = await inlineFontData(css);
  // Leeres Ergebnis nicht cachen: bei SPAs bleibt die doc-Referenz über Navigationen
  // hinweg dieselbe, und Fonts können erst später nachgeladen werden.
  if(css) _fontCssCache.set(doc, css);
  return css;
}

// Eingefügten Screenshot normalisieren: lange Kante begrenzen und als JPEG kodieren —
// Vollbild-Screenshots (Retina-PNG, mehrere MB) würden sonst den localStorage sprengen.
function normalizePastedImage(blob){
  return new Promise(resolve=>{
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = ()=>{
      URL.revokeObjectURL(url);
      const MAX_EDGE = 1400;
      const f = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth||1, img.naturalHeight||1));
      const c = document.createElement("canvas");
      c.width  = Math.max(1, Math.round((img.naturalWidth||1)  * f));
      c.height = Math.max(1, Math.round((img.naturalHeight||1) * f));
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// Effektiver Hintergrund hinter dem Element: transparente Elemente lassen beim Nutzer
// den Seitenhintergrund durchscheinen — hart Weiß zu hinterlegen verfälscht dunkle Seiten.
function effectiveBackground(el){
  let node = el;
  while(node && node.nodeType === 1){
    try{
      const bg = node.ownerDocument.defaultView.getComputedStyle(node).backgroundColor;
      if(bg && bg !== "transparent" && !/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(bg)) return bg;
    }catch(e){ break; }
    node = node.parentElement;
  }
  return "#ffffff";
}

function scaleDownCanvas(rawCanvas, MAX_W, MAX_H, DPR){
  if(rawCanvas.width <= MAX_W * DPR && rawCanvas.height <= MAX_H * DPR) return rawCanvas;
  const f  = Math.min(MAX_W * DPR / rawCanvas.width, MAX_H * DPR / rawCanvas.height);
  const out = document.createElement("canvas");
  out.width  = Math.round(rawCanvas.width  * f);
  out.height = Math.round(rawCanvas.height * f);
  out.getContext("2d").drawImage(rawCanvas, 0, 0, out.width, out.height);
  return out;
}

/* Sicherheitsnetz gegen vertikales Clipping.
   modern-screenshot rastert das Element auf exakt seine Rect-Höhe. Bei enger
   line-height (< Glyphenhöhe) ragen die Zeichen aber ÜBER die Box hinaus —
   sichtbarer Overflow, den scrollHeight nicht mitzählt — und die letzte Zeile
   wird abgeschnitten (auf echten Seiten mit Headline-Fonts der Normalfall).
   Lösung ohne fragile Font-Metrik-Rechnung: großzügig hoch rastern, danach die
   überschüssige Hintergrundfläche am unteren Rand wieder abschneiden (Trim). */
function extraCaptureHeight(el, rectH){
  try{
    const cs = el.ownerDocument.defaultView.getComputedStyle(el);
    const fs = parseFloat(cs.fontSize) || 16;
    return Math.ceil(Math.max(rectH * 0.30, fs * 0.6, 28));
  }catch(e){ return Math.ceil(Math.max(rectH * 0.30, 28)); }
}
// Unten aufgefüllte Hintergrundfläche abschneiden: von unten die erste Zeile mit
// „Tinte" suchen (Pixel, das sich deutlich vom Hintergrund abhebt) und darunter kappen.
function trimCanvasBottom(canvas, keptBelow){
  const g = canvas.getContext("2d");
  let ref;
  try{
    const px = g.getImageData(1, 1, 1, 1).data;   // Ecke = sicher Hintergrund
    ref = [px[0], px[1], px[2], px[3]];
  }catch(e){ return canvas; }
  let lastInk = -1;
  try{
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
    const W = canvas.width;
    outer:
    for(let y = canvas.height - 1; y >= 0; y--){
      const row = y * W * 4;
      for(let x = 0; x < W; x++){
        const i = row + x * 4;
        const diff = Math.abs(data[i]-ref[0]) + Math.abs(data[i+1]-ref[1]) + Math.abs(data[i+2]-ref[2]) + Math.abs(data[i+3]-ref[3]);
        if(diff > 48){ lastInk = y; break outer; }
      }
    }
  }catch(e){ return canvas; }
  if(lastInk < 0) return canvas;                       // nichts gefunden → so lassen
  const cut = Math.min(canvas.height, lastInk + 1 + (keptBelow || 0));
  if(cut >= canvas.height - 1) return canvas;          // kein nennenswerter Überschuss
  const out = document.createElement("canvas");
  out.width = canvas.width; out.height = cut;
  out.getContext("2d").drawImage(canvas, 0, 0);
  return out;
}

async function captureElement(el){
  if(!el || el.nodeType!==1) return null;
  const win = el.ownerDocument?.defaultView;
  if(!win) return null;
  const rootRect = el.getBoundingClientRect();
  if(rootRect.width < 2 || rootRect.height < 2) return null;

  console.log("[vf] capture start:", el.tagName, `${Math.round(rootRect.width)}×${Math.round(rootRect.height)}`);

  const DPR   = Math.min(window.devicePixelRatio || 1, 2);
  const MAX_W = 680, MAX_H = 480;
  const restore = stripVfArtifacts(el);

  try{
    // ---- Engine 1: modern-screenshot (foreignObject — pixel-treu) ----
    if(await loadModernScreenshot()){
      try{
        // Halb geladene Webfonts hießen: der Klon misst und rendert anders als das Original
        try{ await withTimeout(el.ownerDocument.fonts.ready, 3000, null); }catch(e){}
        const fontCss = await withTimeout(collectFontCss(el.ownerDocument).catch(()=> ""), 8000, "");
        const bg = effectiveBackground(el);
        // Großzügig höher rastern, damit überlaufende Glyphen (enge line-height)
        // nicht abgeschnitten werden — der Überschuss wird danach getrimmt.
        const extraH = extraCaptureHeight(el, rootRect.height);
        const msOpts = {
          scale: DPR,
          height: rootRect.height + extraH,
          backgroundColor: bg,
          timeout: 8000,
          filter: n => !isVfNode(n),
          fetch: { requestInit: { cache: "force-cache" }, placeholderImage: SHOT_PLACEHOLDER },
          fetchFn: fetchAsDataUrl,   // Bilder: Cache-Versuch, dann frischer CORS-Request
          ...(fontCss ? { font: { cssText: fontCss } } : {}),
        };
        const rawCanvas = await window.modernScreenshot.domToCanvas(el, msOpts);
        // bg gesetzt → der Überschuss ist einfarbig und lässt sich sauber wegschneiden
        const trimmed = bg ? trimCanvasBottom(rawCanvas, Math.round(4 * DPR)) : rawCanvas;
        const result = scaleDownCanvas(trimmed, MAX_W, MAX_H, DPR).toDataURL("image/jpeg", 0.82);
        console.log("[vf] capture success (modern-screenshot), dataURL length:", result.length);
        return result;
      }catch(e){
        console.warn("[vf] modern-screenshot failed, trying html2canvas:", e);
      }
    }

    // ---- Engine 2: html2canvas ----
    if(await loadHtml2Canvas()){
      try{
        const rawCanvas = await window.html2canvas(el, {
          foreignObjectRendering: false,
          useCORS:     true,   // load CORS-enabled images (TMDB, etc.) for real screenshots
          allowTaint:  false,  // skip non-CORS images; canvas stays untainted → toDataURL works
          logging:     false,
          scale:       DPR,
          scrollX:     -(win.scrollX || 0),
          scrollY:     -(win.scrollY || 0),
          windowWidth:  win.innerWidth  || 1280,
          windowHeight: win.innerHeight || 800,
          ignoreElements: isVfNode,
        });
        const result = scaleDownCanvas(rawCanvas, MAX_W, MAX_H, DPR).toDataURL("image/jpeg", 0.82);
        console.log("[vf] capture success (html2canvas), dataURL length:", result.length);
        return result;
      }catch(e){
        console.warn("[vf] html2canvas failed, using fallback:", e);
      }
    }

    // ---- Engine 3: strukturelles Canvas-2D-Drahtgitter (kein CDN nötig) ----
    return captureElementFallback(el, win, rootRect, DPR, MAX_W, MAX_H);
  }finally{
    restore();
  }
}

function captureElementFallback(el, win, rootRect, DPR, MAX_W, MAX_H){
  const PAD  = 10;
  const rawW = Math.ceil(rootRect.width  + PAD*2);
  const rawH = Math.ceil(rootRect.height + PAD*2);
  const scale = Math.min(1, MAX_W / rawW, MAX_H / rawH);
  const W = Math.round(rawW * scale), H = Math.round(rawH * scale);

  const canvas = document.createElement("canvas");
  canvas.width  = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  const ctx = canvas.getContext("2d");
  ctx.scale(DPR * scale, DPR * scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, rawW / scale, rawH / scale);

  function drawNode(node, depth){
    if(!node || node.nodeType !== 1 || depth > 3) return;
    const cls = typeof node.className === "string" ? node.className : "";
    if(cls.includes("__vf_") || cls.includes("__pv_")) return;
    let r, cs;
    try{ r = node.getBoundingClientRect(); cs = win.getComputedStyle(node); }catch(e){ return; }
    if(!r || r.width < 1 || r.height < 1) return;
    if(cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity||"1") < 0.05) return;
    const x = PAD + (r.left - rootRect.left);
    const y = PAD + (r.top  - rootRect.top);
    const w = r.width, h = r.height;
    if(x + w < 0 || y + h < 0 || x > rawW || y > rawH) return;
    ctx.save();
    const bg = cs.backgroundColor;
    if(bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent"){
      ctx.fillStyle = bg;
      const rx = Math.min(parseFloat(cs.borderTopLeftRadius)||0, h/2, 16);
      if(rx > 1 && ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x,y,w,h,rx); ctx.fill(); }
      else ctx.fillRect(x,y,w,h);
    }
    const bw = parseFloat(cs.borderTopWidth)||0, bc = cs.borderTopColor;
    if(bw >= 0.5 && bc && bc !== "rgba(0, 0, 0, 0)"){
      ctx.strokeStyle = bc; ctx.lineWidth = Math.max(0.5, bw);
      const rx = Math.min(parseFloat(cs.borderTopLeftRadius)||0, h/2, 16);
      if(rx > 1 && ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x,y,w,h,rx); ctx.stroke(); }
      else ctx.strokeRect(x,y,w,h);
    }
    let directText = "";
    node.childNodes.forEach(n=>{ if(n.nodeType===3){ const t=(n.textContent||"").trim(); if(t) directText+=(directText?" ":"")+t; } });
    if(directText && h >= 10){
      const fgColor = cs.color||"#222", rawFs = parseFloat(cs.fontSize)||14;
      const fs = Math.max(8, Math.min(rawFs, 18)), fw = /bold|700|800|900/.test(cs.fontWeight)?"600":"400";
      const ff = /monospace/.test(cs.fontFamily)?"monospace":"system-ui,sans-serif";
      ctx.fillStyle = fgColor; ctx.font = `${fw} ${fs}px ${ff}`;
      ctx.textBaseline = "middle"; ctx.textAlign = cs.textAlign==="center"?"center":"left";
      const txtX = cs.textAlign==="center" ? x+w/2 : x+Math.min(parseFloat(cs.paddingLeft)||0,12)+3;
      ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
      let line = directText;
      while(line && ctx.measureText(line).width > w-6 && line.length > 4) line = line.slice(0,-2);
      if(line !== directText) line += "…";
      ctx.fillText(line, txtX, y+h/2);
    }
    ctx.restore();
    const tag = node.tagName.toLowerCase();
    if(tag==="img"||tag==="video"||tag==="svg"){
      ctx.save(); ctx.fillStyle="#e8e8e8"; ctx.fillRect(x,y,w,h);
      ctx.strokeStyle="#ccc"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+w,y+h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+w,y); ctx.lineTo(x,y+h); ctx.stroke();
      ctx.restore(); return;
    }
    Array.from(node.children).slice(0,14).forEach(child=>drawNode(child,depth+1));
  }

  try{ drawNode(el, 0); }catch(e){ console.warn("[vf] drawNode:", e); }

  ctx.save();
  ctx.resetTransform ? ctx.resetTransform() : ctx.setTransform(1,0,0,1,0,0);
  ctx.strokeStyle="#d0d0d0"; ctx.lineWidth=1;
  ctx.strokeRect(0.5, 0.5, canvas.width-1, canvas.height-1);
  ctx.restore();

  try{
    const result = canvas.toDataURL("image/jpeg", 0.82);
    console.log("[vf] capture success (fallback), dataURL length:", result.length);
    return result;
  }catch(e){ return null; }
}

function catColorVar(catId){
  const map = { bug:"#e35f5f", feature:"#ffe05e", design:"#62c12d", copy:"#e6ca55", question:"#5c8fbf", praise:"#c67ba0" };
  return map[catId] || "#ffe05e";
}
function commentPage(c){ return c.pageUrl || STATE.src; }
function commentSummary(c){
  if(c.structured && Object.keys(c.structured).length){
    const tpl = TEMPLATES[c.category];
    if(tpl && tpl.fields.length){
      const parts = tpl.fields
        .map(f => c.structured[f.key] ? `${f.label}: ${c.structured[f.key].replace(/\s+/g," ")}` : null)
        .filter(Boolean);
      const joined = parts.join(" · ");
      return truncate(joined + (c.text?` · Notiz: ${c.text.replace(/\s+/g," ")}`:""), 220);
    }
  }
  return c.text || "";
}
function refreshFrameBadges(){
  const doc = STATE.frameDoc; if(!doc) return;
  $$(".__vf_marked", doc).forEach(el=>{ el.classList.remove("__vf_marked"); el.style.removeProperty("--vf-c"); if(el.style.position==="relative" && el.dataset.vfPosSet==="1"){ el.style.position=""; delete el.dataset.vfPosSet; } });
  $$(".__vf_badge", doc).forEach(el=>el.remove());
  // Badge-Nummer = Position in der Sidebar-Liste (über alle Seiten), damit
  // Badge und Sidebar bei Multi-Page-Projekten dieselbe Nummer zeigen.
  const allFiltered = filteredComments();
  const visibleComments = allFiltered.filter(c => commentPage(c) === STATE.currentUrl);
  visibleComments.forEach(c=>{
    let el;
    el = resolveElement(c, doc);
    if(!el) return;
    const color = catColorVar(c.category);
    el.classList.add("__vf_marked");
    el.style.setProperty("--vf-c", color);
    const cs = doc.defaultView.getComputedStyle(el);
    if(cs.position === "static"){ el.style.position = "relative"; el.dataset.vfPosSet = "1"; }
    const badge = doc.createElement("span");
    badge.className = "__vf_badge";
    badge.style.setProperty("--vf-c", color);
    const cat = CAT_MAP[c.category];
    badge.innerHTML = (cat?icon(cat.icon,11):"") + " " + (allFiltered.indexOf(c)+1);
    badge.dataset.vfId = c.id;
    el.appendChild(badge);
  });
}

// ============ Comment Modal ============
function createAnnotator(imgDataUrl){
  const TOOLS = [
    { id:"arrow", label:"↗", title:"Pfeil" },
    { id:"pen",   label:'<svg class="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>', title:"Stift (Freihand)" },
    { id:"rect",  label:"▭", title:"Rechteck" },
    { id:"ellipse", label:"○", title:"Kreis" },
    { id:"text",  label:"T", title:"Text" }
  ];
  // Weitere Werkzeuge im Ausklappmenü (⋯)
  const MORE_TOOLS = [
    { id:"highlight", label:"▨", title:"Marker (transparent hervorheben)" },
    { id:"pixelate",  label:"▩", title:"Pixelieren (sensible Daten unkenntlich machen)" },
    { id:"number",    label:"①", title:"Nummern-Badge (Klick platziert 1, 2, 3 …)" }
  ];
  const COLORS = [
    { id:"rot", hex:"#e35f5f" },
    { id:"gelb", hex:"#ffe05e" },
    { id:"schwarz", hex:"#262626" }
  ];
  const MORE_COLORS = [
    { id:"grün", hex:"#62c12d" },
    { id:"blau", hex:"#5c8fbf" },
    { id:"weiß", hex:"#ffffff" }
  ];
  const WIDTHS = [
    { id:"thin",   factor:0.6, label:"﹘", title:"Dünn" },
    { id:"normal", factor:1,   label:"─", title:"Mittel" },
    { id:"thick",  factor:2,   label:"━", title:"Dick" }
  ];
  let currentTool = "arrow";
  let currentColor = "#e35f5f";
  let currentWidth = 1;
  const shapes = [];     // { tool, color, width, x1,y1,x2,y2, text?, points?, n? }
  const redoStack = [];
  let img = null;
  let canvas, ctx, container, dragging = null;

  function commit(shape){
    shapes.push(shape);
    redoStack.length = 0;   // neuer Strich macht Redo-Historie ungültig
  }

  function draw(){
    if(!ctx || !img) return;
    ctx.clearRect(0,0,canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for(const s of shapes) drawShape(s);
    if(dragging) drawShape(dragging);
  }
  function drawShape(s){
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = Math.max(2, Math.round(canvas.width/300)) * (s.width || 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if(s.tool === "pen" && s.points && s.points.length){
      const pts = s.points;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      // Geglättete Kurve durch die Mittelpunkte — roher Polygonzug wirkt zackig
      for(let i = 1; i < pts.length - 1; i++){
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i+1].x)/2, (pts[i].y + pts[i+1].y)/2);
      }
      if(pts.length > 1) ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
      else ctx.lineTo(pts[0].x + 0.1, pts[0].y);  // Punkt-Tap → sichtbarer Punkt
      ctx.stroke();
    } else if(s.tool === "pixelate"){
      const x = Math.min(s.x1,s.x2), y = Math.min(s.y1,s.y2);
      const w = Math.abs(s.x2-s.x1), h = Math.abs(s.y2-s.y1);
      if(w >= 2 && h >= 2){
        // Region grob heruntersampeln und ohne Glättung zurückzeichnen
        const px = Math.max(6, Math.round(canvas.width/60));
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.round(w/px));
        off.height = Math.max(1, Math.round(h/px));
        off.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, off.width, off.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, 0, 0, off.width, off.height, x, y, w, h);
      }
    } else if(s.tool === "number"){
      const r = Math.max(12, Math.round(canvas.width/45));
      ctx.beginPath(); ctx.arc(s.x1, s.y1, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = pickContrastInk(s.color);
      ctx.lineWidth = Math.max(1.5, r/10);
      ctx.stroke();
      ctx.fillStyle = pickContrastInk(s.color);
      ctx.font = `bold ${Math.round(r*1.1)}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(s.n || 1), s.x1, s.y1 + 1);
    } else if(s.tool === "rect"){
      ctx.strokeRect(s.x1, s.y1, s.x2-s.x1, s.y2-s.y1);
    } else if(s.tool === "ellipse"){
      const cx = (s.x1+s.x2)/2, cy = (s.y1+s.y2)/2;
      const rx = Math.abs(s.x2-s.x1)/2, ry = Math.abs(s.y2-s.y1)/2;
      ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.stroke();
    } else if(s.tool === "arrow"){
      const dx = s.x2-s.x1, dy = s.y2-s.y1;
      const len = Math.hypot(dx,dy) || 1;
      const ang = Math.atan2(dy,dx);
      const head = Math.min(20, len*0.3);
      ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - head*Math.cos(ang-Math.PI/6), s.y2 - head*Math.sin(ang-Math.PI/6));
      ctx.lineTo(s.x2 - head*Math.cos(ang+Math.PI/6), s.y2 - head*Math.sin(ang+Math.PI/6));
      ctx.closePath(); ctx.fill();
    } else if(s.tool === "highlight"){
      ctx.globalAlpha = 0.35;
      ctx.fillRect(Math.min(s.x1,s.x2), Math.min(s.y1,s.y2), Math.abs(s.x2-s.x1), Math.abs(s.y2-s.y1));
    } else if(s.tool === "text" && s.text){
      const size = Math.max(14, Math.round(canvas.width/40));
      ctx.font = `bold ${size}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
      const pad = 4;
      const w = ctx.measureText(s.text).width + pad*2;
      const h = size + pad*2;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x1, s.y1, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = pickContrastInk(s.color);
      ctx.fillText(s.text, s.x1 + pad, s.y1 + pad);
    }
    ctx.restore();
  }
  function pickContrastInk(hex){
    const m = /^#([0-9a-f]{6})$/i.exec(hex); if(!m) return "#fff";
    const n = parseInt(m[1],16);
    const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
    const lum = (0.299*r + 0.587*g + 0.114*b)/255;
    return lum > 0.6 ? "#262626" : "#ffffff";
  }
  function getPoint(e){
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }
  function bindEvents(){
    canvas.addEventListener("pointerdown", e => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const p = getPoint(e);
      if(currentTool === "text"){
        const txt = prompt("Text:");
        if(txt){ commit({ tool:"text", color:currentColor, x1:p.x, y1:p.y, x2:p.x, y2:p.y, text: txt }); draw(); }
        return;
      }
      if(currentTool === "number"){
        const n = shapes.filter(s => s.tool === "number").length + 1;
        commit({ tool:"number", color:currentColor, x1:p.x, y1:p.y, n });
        draw();
        return;
      }
      if(currentTool === "pen"){
        dragging = { tool:"pen", color:currentColor, width:currentWidth, points:[p] };
      } else {
        dragging = { tool:currentTool, color:currentColor, width:currentWidth, x1:p.x, y1:p.y, x2:p.x, y2:p.y };
      }
      draw();
    });
    canvas.addEventListener("pointermove", e => {
      if(!dragging) return;
      const p = getPoint(e);
      if(dragging.tool === "pen"){
        const last = dragging.points[dragging.points.length-1];
        if(Math.hypot(p.x-last.x, p.y-last.y) > 2) dragging.points.push(p);
      } else {
        dragging.x2 = p.x; dragging.y2 = p.y;
      }
      draw();
    });
    const endDrag = () => {
      if(!dragging) return;
      if(dragging.tool === "pen"){
        if(dragging.points.length > 1) commit(dragging);
      } else {
        const dx = dragging.x2 - dragging.x1, dy = dragging.y2 - dragging.y1;
        if(Math.hypot(dx,dy) > 4) commit(dragging);
      }
      dragging = null;
      draw();
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
  }
  const toolBtn = t => `<button type="button" class="tool" data-tool="${t.id}" data-active="${t.id===currentTool}" title="${t.title}" aria-label="${t.title}">${t.label}</button>`;
  const swatchBtn = c => `<button type="button" class="swatch" data-color="${c.hex}" data-active="${c.hex===currentColor}" title="${c.id}" aria-label="Farbe ${c.id}" style="background:${c.hex}"></button>`;
  const HINTS = { pen:"Freihand zeichnen", text:"Klicken, dann Text eingeben", number:"Klicken zum Platzieren", pixelate:"Bereich zum Pixelieren aufziehen" };
  function selectTool(id){
    currentTool = id;
    container.querySelectorAll("[data-tool]").forEach(b => b.dataset.active = (b.dataset.tool === id));
    const hint = container.querySelector("[data-role=hint]");
    if(hint) hint.textContent = HINTS[id] || "Ziehen zum Zeichnen";
  }
  function selectColor(hex){
    currentColor = hex;
    container.querySelectorAll("[data-color]").forEach(b => b.dataset.active = (b.dataset.color === hex));
  }
  function selectWidth(factor){
    currentWidth = factor;
    container.querySelectorAll("[data-width]").forEach(b => b.dataset.active = (parseFloat(b.dataset.width) === factor));
  }
  function mount(host){
    container = document.createElement("div");
    container.className = "annot";
    container.innerHTML = `
      <div class="stage" data-role="stage"></div>
      <div class="tools">
        ${TOOLS.map(toolBtn).join("")}
        <span class="sep"></span>
        ${COLORS.map(swatchBtn).join("")}
        <span class="sep"></span>
        <button type="button" class="tool" data-act="undo" title="Rückgängig" aria-label="Rückgängig">↶</button>
        <button type="button" class="tool" data-act="clear" title="Alles löschen" aria-label="Alles löschen">✕</button>
        <button type="button" class="tool" data-act="more" title="Mehr Werkzeuge" aria-label="Mehr Werkzeuge" aria-expanded="false">⋯</button>
        <span class="grow"></span>
        <span class="hint" data-role="hint">Ziehen zum Zeichnen</span>
      </div>
      <div class="tools tools-more" hidden>
        ${MORE_TOOLS.map(toolBtn).join("")}
        <span class="sep"></span>
        ${MORE_COLORS.map(swatchBtn).join("")}
        <span class="sep"></span>
        ${WIDTHS.map(w => `<button type="button" class="tool" data-width="${w.factor}" data-active="${w.factor===currentWidth}" title="Strichstärke: ${w.title}" aria-label="Strichstärke: ${w.title}">${w.label}</button>`).join("")}
        <span class="sep"></span>
        <button type="button" class="tool" data-act="redo" title="Wiederholen" aria-label="Wiederholen">↷</button>
      </div>`;
    host.appendChild(container);
    const stage = container.querySelector("[data-role=stage]");
    stage.innerHTML = `<div class="ph"><span class="spin"></span>Screenshot wird erstellt…</div>`;
    container.querySelectorAll("[data-tool]").forEach(b => b.addEventListener("click", () => selectTool(b.dataset.tool)));
    container.querySelectorAll("[data-color]").forEach(b => b.addEventListener("click", () => selectColor(b.dataset.color)));
    container.querySelectorAll("[data-width]").forEach(b => b.addEventListener("click", () => selectWidth(parseFloat(b.dataset.width))));
    container.querySelector("[data-act=undo]").addEventListener("click", () => {
      if(shapes.length){ redoStack.push(shapes.pop()); draw(); }
    });
    container.querySelector("[data-act=redo]").addEventListener("click", () => {
      if(redoStack.length){ shapes.push(redoStack.pop()); draw(); }
    });
    container.querySelector("[data-act=clear]").addEventListener("click", () => { shapes.length = 0; redoStack.length = 0; draw(); });
    const moreBtn = container.querySelector("[data-act=more]");
    moreBtn.addEventListener("click", () => {
      const row = container.querySelector(".tools-more");
      row.hidden = !row.hidden;
      moreBtn.setAttribute("aria-expanded", String(!row.hidden));
      moreBtn.dataset.active = String(!row.hidden);
    });
    return container;
  }
  function showLoading(){
    const stage = container?.querySelector("[data-role=stage]");
    if(stage) stage.innerHTML = `<div class="ph"><span class="spin"></span>Screenshot wird erstellt…</div>`;
    canvas = null; ctx = null; img = null; shapes.length = 0; redoStack.length = 0;
  }
  function setImage(dataUrl){
    return new Promise((resolve, reject) => {
      const stage = container?.querySelector("[data-role=stage]");
      if(!stage){ reject(new Error("not mounted")); return; }
      if(!dataUrl){ stage.innerHTML = `<div class="ph">Screenshot nicht verfügbar.</div>`; resolve(false); return; }
      const im = new Image();
      im.onload = () => {
        img = im;
        shapes.length = 0;
        redoStack.length = 0;
        stage.innerHTML = "";
        canvas = document.createElement("canvas");
        canvas.width = im.naturalWidth;
        canvas.height = im.naturalHeight;
        ctx = canvas.getContext("2d");
        stage.appendChild(canvas);
        draw(); bindEvents();
        resolve(true);
      };
      im.onerror = () => { stage.innerHTML = `<div class="ph">Screenshot konnte nicht geladen werden.</div>`; resolve(false); };
      im.src = dataUrl;
    });
  }
  async function flatten(){
    if(!canvas || !img) return imgDataUrl || null;
    try { return canvas.toDataURL("image/jpeg", 0.82); }
    catch(e){ console.warn("[vf] annot flatten", e); return imgDataUrl || null; }
  }
  function reset(){
    canvas = null; ctx = null; img = null; shapes.length = 0; redoStack.length = 0;
    const stage = container?.querySelector("[data-role=stage]");
    if(stage) stage.innerHTML = `<div class="ph">Noch kein Screenshot — über die Kamera-Schaltfläche aufnehmen.</div>`;
  }
  return { mount, setImage, showLoading, flatten, reset, hasCanvas: () => !!canvas };
}

function openCommentModal(el, existing){
  const isEdit = !!existing;
  if(!el && !isEdit) return;

  // Wenn bereits eine Compact-Bar offen ist: bestehende auf neues Element umbiegen (kein zweites Modal öffnen)
  if(!isEdit && window.__vf_active_cbar){
    try { window.__vf_active_cbar.retarget(el); } catch(_){}
    return;
  }

  let currentEl = el || null;
  let selector, snippet, tag, info;

  function computeFromEl(){
    if(currentEl && currentEl.nodeType===1){
      selector = cssPath(currentEl);
      snippet = shortHtml(currentEl);
      tag = currentEl.tagName.toLowerCase();
      info = elementInfo(currentEl);
    }
  }
  if(isEdit){
    selector = existing.selector; snippet = existing.snippet; tag = existing.tag; info = existing.info || null;
  }else{
    if(currentEl.nodeType!==1) return;
    computeFromEl();
  }

  // Neue Kommentare starten mit der zuletzt genutzten Wahl (nicht bei Edits);
  // gegen kaputte/veraltete Werte gegen CAT_MAP/PRI_MAP geprüft.
  const lastPick = isEdit ? {} : getLastPick(STATE.src);
  let currentCat = existing?.category || (lastPick.cat && CAT_MAP[lastPick.cat] ? lastPick.cat : "feature");
  let currentPri = existing?.priority || (lastPick.pri && PRI_MAP[lastPick.pri] ? lastPick.pri : "could");
  let expanded = !!isEdit; // Edit-Modus startet direkt expanded

  const host = document.createElement("div");
  host.className = "cbar-host";
  host.innerHTML = `
    <div class="cbar" role="dialog" aria-modal="false" aria-labelledby="vf-modal-title">
      <div class="cbar-grip" data-act="toggle-expand" role="button" tabindex="0" aria-label="Details ein-/ausblenden">
        <div class="bar"></div>
      </div>
      <div class="cbar-expanded" data-role="expanded" ${expanded?"":"hidden"}>
        <div class="target-card" data-role="target" id="vf-modal-target">
          <div class="target-head">
            <span class="target-label">${icon('crosshair',13)} Auswahl</span>
            <div class="target-actions">
              <button type="button" data-act="up" title="Elternelement wählen">${icon('corner-left-up',13)} Eltern</button>
              <button type="button" data-act="highlight" title="Im Frame anzeigen">Zeigen</button>
            </div>
          </div>
          <div class="target-body" data-role="target-body"></div>
          <div data-role="annot-slot"></div>
        </div>
        <div data-role="template-fields"></div>
        <div class="field">
          <label>Von (optional)</label>
          <input type="text" data-field="author" placeholder="Dein Name">
        </div>
      </div>
      <div class="cbar-compact">
        <div class="cbar-row">
          <span class="cbar-target" data-act="toggle-expand" title="Element-Details, Templatefelder & Screenshot ein-/ausblenden">
            <span data-target-tag>&lt;${esc(tag)}&gt;</span>
            <span class="dims" data-target-dims></span>
          </span>
        </div>
        <!-- Kategorie + Priorität immer sichtbar, aber kompakt: Kategorie emoji-only
             (aktives Chip zeigt zusätzlich sein Label), Priorität als kurze Chips. -->
        <div class="cbar-meta">
          <div class="chips chips-cat" data-role="cats" role="radiogroup" aria-label="Kategorie">
            ${CATEGORIES.map(c=>`<span class="pick" data-cat="${c.id}" data-active="${c.id===currentCat}" role="radio" aria-checked="${c.id===currentCat}" tabindex="${c.id===currentCat?0:-1}" aria-label="${c.label}: ${c.sub||''}" title="${c.label} — ${c.sub||''}"><span class="emo">${icon(c.icon,15)}</span><span class="lbl">${c.label}</span></span>`).join("")}
          </div>
          <div class="chips chips-pri" data-role="prios" role="radiogroup" aria-label="Priorität">
            ${PRIORITIES.map(p=>`<span class="pick" data-p="${p.id}" data-active="${p.id===currentPri}" role="radio" aria-checked="${p.id===currentPri}" tabindex="${p.id===currentPri?0:-1}" aria-label="Priorität ${p.label}">${p.label}</span>`).join("")}
          </div>
        </div>
        <label class="sr-only" for="vf-cbar-text" id="vf-modal-title">${isEdit?"Kommentar bearbeiten":"Kommentar schreiben"}</label>
        ${!localStorage.getItem(AUTHOR_KEY) && !existing ? `<div class="field" id="author-field" style="margin-bottom:6px">
          <label for="cbar-author-compact" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);display:block;margin-bottom:3px">Dein Name <span style="color:var(--muted);font-weight:400">(für den Owner)</span></label>
          <input type="text" id="cbar-author-compact" data-field="author-compact" placeholder="z.B. Marie" style="font-size:13px;padding:8px 10px;width:100%;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--fg)" maxlength="40">
        </div>` : ''}
        <textarea id="vf-cbar-text" data-role="text" rows="2" placeholder="Was ist dir aufgefallen? Was sollte anders sein?"></textarea>
        <div class="cbar-actions">
          <span class="cbar-hint"><span class="badge-key">Esc</span>Abbrechen <span class="badge-key">⌘/Ctrl+⏎</span>Speichern</span>
          <button class="icon-btn" data-act="screenshot" title="Screenshot dieses Elements aufnehmen" aria-label="Screenshot dieses Elements aufnehmen">${icon('camera',17)}</button>
          <button class="icon-btn" data-act="paste-shot" title="Eigenen Screenshot aus der Zwischenablage einfügen (oder Strg+V)" aria-label="Eigenen Screenshot aus der Zwischenablage einfügen">${icon('clipboard',16)}</button>
          <img class="cbar-thumb" data-role="thumb" alt="Screenshot-Vorschau" hidden>
          <button class="icon-btn" data-act="toggle-expand" title="Details, Templates & Annotation" aria-label="Details ein-/ausblenden" aria-pressed="${expanded?"true":"false"}">${icon('chevron-down',18)}</button>
          <button class="ghost" data-act="cancel">Abbrechen</button>
          <button class="primary" data-act="save">${isEdit?"Aktualisieren":"Speichern"}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(host);
  const wrap = host; // Für Focus-Trap/Keydown-Kompat
  const cbar = $(".cbar", host);
  const expandedEl = $("[data-role=expanded]", host);
  const ta = $("[data-role=text]", host);
  const authorInput = $("[data-field=author]", host);
  const thumb = $("[data-role=thumb]", host);
  authorInput.value = existing?.author || getAuthor();
  if(isEdit) ta.value = existing.text;

  // Templates
  const tplWrap = $("[data-role=template-fields]", host);
  const structured = existing?.structured ? {...existing.structured} : {};
  function renderTemplate(){
    const tpl = TEMPLATES[currentCat];
    const has = tpl && tpl.fields.length;
    tplWrap.innerHTML = has ? tpl.fields.map(f => `
      <div class="field">
        <label>${esc(f.label)}</label>
        <textarea data-tpl="${esc(f.key)}" rows="${f.rows||2}" placeholder="${esc(f.placeholder||"")}">${esc(structured[f.key]||"")}</textarea>
      </div>
    `).join("") : "";
    $$("[data-tpl]", tplWrap).forEach(inp => {
      inp.addEventListener("input", ()=> { structured[inp.dataset.tpl] = inp.value; });
    });
    // Der Kommentar (dieses Feld) ist das Hauptfeld — immer klar als solches lesbar.
    // Kategorie/Priorität/Template-Felder liegen optional im Expand (mehr Detail fürs LLM).
    ta.placeholder = "Dein Kommentar – was ist dir aufgefallen? Was sollte anders sein?";
  }
  renderTemplate();

  // Fokus initial ins Textfeld
  setTimeout(()=> ta.focus(), 40);

  // ---- Annotator ----
  let annotator = null;
  let captureToken = 0;
  let capturePromise = null;   // läuft gerade ein Auto-Capture? (Save darf nicht vorbeiziehen)
  async function captureIntoAnnotator(){
    if(!annotator || !currentEl || !STATE.frameDoc) return;
    const myToken = ++captureToken;
    annotator.showLoading();
    thumb.hidden = true;
    let done;
    capturePromise = new Promise(r => done = r);
    let shot = null;
    try {
      shot = await Promise.race([
        captureElement(currentEl).catch(e => { console.warn("[vf] shot", e); return null; }),
        new Promise(r => setTimeout(()=>r(null), 8000))
      ]);
    } catch(e){ shot = null; }
    // Veraltet (neues Element / eingefügter Screenshot)? Ergebnis verwerfen.
    if(myToken !== captureToken){ done(); return; }
    await annotator.setImage(shot);
    if(myToken === captureToken && shot){
      thumb.src = shot;
      thumb.hidden = false;
    }
    if(myToken === captureToken) capturePromise = null;
    done();
  }
  // Screenshot ist jetzt opt-in: standardmäßig wird KEIN Screenshot aufgenommen.
  // Erst ein Klick auf die 📷-Schaltfläche lädt die Capture-Engine und nimmt auf.
  if(isEdit && existing?.screenshot){
    thumb.src = existing.screenshot;
    thumb.hidden = false;
  }

  // ---- Eigener Screenshot (Zwischenablage) ----
  // Für Edge-Cases, in denen der Auto-Screenshot nicht stimmt (Canvas/WebGL-Inhalte,
  // CORS-gesperrte Bilder, Video-Frames): Tester überschreibt ihn mit einem selbst
  // aufgenommenen Screenshot — per 📋-Button oder Strg+V direkt in der Bar.
  let customShot = null;
  async function applyCustomShot(blob){
    if(!blob) return;
    const dataUrl = await normalizePastedImage(blob);
    if(!dataUrl){ toast("Bild konnte nicht gelesen werden."); return; }
    captureToken++;        // laufenden Auto-Capture entwerten…
    capturePromise = null; // …und Save nicht mehr darauf warten lassen
    customShot = dataUrl;
    if(annotator) await annotator.setImage(dataUrl);
    thumb.src = dataUrl;
    thumb.hidden = false;
    toast("Eigener Screenshot übernommen.");
  }
  // Screenshot opt-in: erst auf Klick den Annotator erzeugen, Engine laden und aufnehmen.
  function captureShot(){
    if(isEdit){ toast("Screenshot-Nachbearbeitung nur bei neuen Kommentaren."); return; }
    if(!currentEl || !STATE.frameDoc){ toast("Kein Element ausgewählt."); return; }
    if(!annotator){
      annotator = createAnnotator(null);
      annotator.mount($("[data-role=annot-slot]", host));
    }
    if(!expanded) setExpanded(true);
    customShot = null;
    captureIntoAnnotator();
  }
  // Beim Wechsel auf ein anderes Element einen bereits aufgenommenen Screenshot
  // verwerfen (er gehörte zum vorigen Element) — es wird NICHT neu aufgenommen.
  function clearShot(){
    captureToken++;
    capturePromise = null;
    customShot = null;
    if(thumb){ thumb.hidden = true; thumb.src = ""; }
    if(annotator) annotator.reset();
  }
  async function pasteShotFromClipboard(){
    if(!navigator.clipboard?.read){ toast("Zwischenablage nicht verfügbar — nutze Strg+V.", 3500); return; }
    try{
      for(const item of await navigator.clipboard.read()){
        const type = item.types.find(t => t.startsWith("image/"));
        if(type) return applyCustomShot(await item.getType(type));
      }
      toast("Kein Bild in der Zwischenablage — erst Screenshot kopieren, dann den Einfügen-Knopf nutzen.", 3500);
    }catch(e){
      toast("Zugriff auf Zwischenablage nicht erlaubt — nutze Strg+V.", 3500);
    }
  }
  host.addEventListener("paste", e=>{
    const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
    if(!it) return;
    e.preventDefault();
    applyCustomShot(it.getAsFile());
  });

  // ---- Target-card + retarget ----
  function renderTarget(){
    const body = $("[data-role=target-body]", host);
    const hl = humanLabel(info);
    $("[data-target-tag]", host).innerHTML = hl
      ? `${esc(hl)}<span style="display:inline-block;margin-left:6px;font-size:10px;color:var(--muted);font-weight:400;opacity:.75">&lt;${esc(tag)}&gt;</span>`
      : `&lt;${esc(tag)}&gt;`;
    const dimsMini = info?.rect ? `${info.rect.w}×${info.rect.h}` : "";
    $("[data-target-dims]", host).textContent = dimsMini;
    const parts = [];
    if(!isEdit && currentEl){
      const chain = [];
      let p = currentEl;
      while(p && p.nodeType===1 && p.tagName.toLowerCase()!=="html"){
        chain.unshift(p);
        p = p.parentElement;
      }
      const crumbHtml = chain.map((n,i)=>{
        const t = n.tagName.toLowerCase();
        const id = n.id ? "#"+n.id : "";
        const cls = (typeof n.className==="string"?n.className:"").trim().split(/\s+/).filter(c=>c && !c.startsWith("__vf_") && !c.startsWith("__pv_")).slice(0,1);
        const label = t + id + (cls.length?"."+cls[0]:"");
        const isLast = i === chain.length-1;
        return `<span class="crumb${isLast?" active":""}" data-crumb-idx="${i}">${esc(label)}</span>`;
      }).join(`<span class="crumb-sep">›</span>`);
      parts.push(`<div class="crumbs">${crumbHtml}</div>`);
      host._crumbChain = chain;
    }
    const roleTxt = info?.role && info.role !== tag ? `<span class="pill">${esc(info.role)}</span>` : "";
    const textPrev = info?.text ? `<div class="txt">"${esc(truncate(info.text, 100))}"</div>` : `<div class="txt muted">(kein Text-Inhalt)</div>`;
    const dims = info?.rect ? `${info.rect.w}×${info.rect.h}px · ${info.rect.viewport}` : "";
    const href = info?.attrs?.href ? `<div class="attr">→ ${esc(truncate(info.attrs.href,60))}</div>` : "";
    const alt = info?.attrs?.alt ? `<div class="attr">alt: "${esc(truncate(info.attrs.alt,60))}"</div>` : "";
    const aria = info?.attrs?.ariaLabel ? `<div class="attr">aria-label: "${esc(truncate(info.attrs.ariaLabel,60))}"</div>` : "";
    const shot = (isEdit && existing?.screenshot) ? `<div class="screenshot"><img src="${esc(existing.screenshot)}" alt="Screenshot"></div>` : "";
    parts.push(`
      <div class="target-main">
        <div class="tagline"><span class="tt">&lt;${esc(tag)}&gt;</span>${roleTxt}<span class="dims">${dims}</span></div>
        ${textPrev}
        ${href}${alt}${aria}
        <div class="selector-line"><code>${esc(truncate(selector,80))}</code></div>
        ${isEdit ? shot : ""}
      </div>
    `);
    body.innerHTML = parts.join("");

    $$(".crumb", body).forEach(c => c.addEventListener("click", ()=>{
      const idx = +c.dataset.crumbIdx;
      const chain = host._crumbChain;
      if(!chain || !chain[idx]) return;
      currentEl = chain[idx];
      computeFromEl();
      renderTarget();
      highlightSelected();
      clearShot();
    }));
  }
  renderTarget();
  highlightSelected();

  function retargetUp(){
    if(!currentEl || !currentEl.parentElement) return;
    const p = currentEl.parentElement;
    if(!p || p.tagName.toLowerCase() === "html") { toast("Bereits das oberste Element."); return; }
    currentEl = p;
    computeFromEl();
    renderTarget();
    highlightSelected();
    clearShot();
  }
  function highlightSelected(){
    if(isEdit || !STATE.frameDoc) return;
    STATE.frameDoc.querySelectorAll(".__vf_selected").forEach(n => n.classList.remove("__vf_selected"));
    STATE.frameDoc.body?.classList.add("__vf_modal-open");
    if(currentEl) currentEl.classList.add("__vf_selected");
  }
  function unhighlight(){
    if(!STATE.frameDoc) return;
    STATE.frameDoc.body?.classList.remove("__vf_modal-open");
    STATE.frameDoc.querySelectorAll(".__vf_selected").forEach(n => n.classList.remove("__vf_selected"));
  }

  function setExpanded(v, focusAnnot){
    expanded = !!v;
    expandedEl.hidden = !expanded;
    $$("[data-act=toggle-expand][aria-pressed]", host).forEach(b => b.setAttribute("aria-pressed", expanded?"true":"false"));
    if(expanded && focusAnnot){
      const annotStage = $("[data-role=annot-slot] canvas", host);
      if(annotStage) annotStage.focus?.();
    }
  }

  // Handlers
  $$("[data-act=toggle-expand]", host).forEach(b => b.addEventListener("click", ()=> setExpanded(!expanded)));
  $$("[data-act=toggle-expand][role=button]", host).forEach(b => b.addEventListener("keydown", e=>{
    if(e.key==="Enter" || e.key===" "){ e.preventDefault(); setExpanded(!expanded); }
  }));
  $("[data-act=up]", host).addEventListener("click", retargetUp);
  $("[data-act=highlight]", host).addEventListener("click", ()=>{
    if(!currentEl) return;
    currentEl.scrollIntoView({behavior:"smooth", block:"center"});
    highlightSelected();
  });
  $("[data-act=screenshot]", host).addEventListener("click", captureShot);
  $("[data-act=paste-shot]", host).addEventListener("click", pasteShotFromClipboard);
  thumb.addEventListener("click", ()=> setExpanded(true, true));

  // Chip-Gruppen als echte Radiogruppen: Auswahl per Maus UND Tastatur (Enter/Space,
  // Pfeiltasten mit Roving-tabindex), Zustand über aria-checked statt nur Farbe.
  function wireRadioGroup(role, onPick){
    const chips = $$(`[data-role=${role}] .pick`, host);
    const select = (chip, focus)=>{
      chips.forEach(c=>{
        const on = c===chip;
        c.dataset.active = on;
        c.setAttribute("aria-checked", on);
        c.tabIndex = on ? 0 : -1;
      });
      if(focus) chip.focus();
      onPick(chip);
    };
    chips.forEach((chip, i)=>{
      chip.addEventListener("click", ()=> select(chip, false));
      chip.addEventListener("keydown", e=>{
        if(e.key===" " || e.key==="Enter"){ e.preventDefault(); select(chip, false); }
        else if(e.key==="ArrowRight" || e.key==="ArrowDown"){ e.preventDefault(); select(chips[(i+1)%chips.length], true); }
        else if(e.key==="ArrowLeft" || e.key==="ArrowUp"){ e.preventDefault(); select(chips[(i-1+chips.length)%chips.length], true); }
      });
    });
  }
  wireRadioGroup("cats", chip=>{ currentCat = chip.dataset.cat; renderTemplate(); });
  wireRadioGroup("prios", chip=>{ currentPri = chip.dataset.p; });

  const close = ()=>{
    unhighlight();
    host.remove();
    document.removeEventListener("keydown", onKey, true);
    if(window.__vf_active_cbar === api) window.__vf_active_cbar = null;
  };
  const save = async ()=>{
    const txt = ta.value.trim();
    const tpl = TEMPLATES[currentCat];
    const struct = {};
    let structHasContent = false;
    if(tpl && tpl.fields.length){
      tpl.fields.forEach(f => {
        const v = (structured[f.key]||"").trim();
        if(v){ struct[f.key] = v; structHasContent = true; }
      });
    }
    if(!txt && !structHasContent){
      if(tpl && tpl.fields.length && !expanded) setExpanded(true);
      const firstEmpty = $("[data-tpl]", tplWrap) || ta;
      firstEmpty.focus();
      toast("Kommentar darf nicht leer sein.");
      return;
    }
    // Compact author field (shown on first comment) takes precedence if filled
    const compactAuthorInput = $("[data-field=author-compact]", host);
    if(compactAuthorInput && compactAuthorInput.value.trim()){
      authorInput.value = compactAuthorInput.value.trim();
    }
    const author = authorInput.value.trim();
    setAuthor(author);
    let screenshot = existing?.screenshot || null;
    if(!isEdit && annotator){
      // Speichern während der Auto-Capture noch läuft (Ctrl+Enter direkt nach dem Klick):
      // kurz auf ihn warten, sonst hätte der Annotator kein Bild und der Kommentar
      // würde still ohne Screenshot gespeichert.
      if(capturePromise){
        const saveBtn = $("[data-act=save]", host);
        if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = "Screenshot…"; }
        await Promise.race([capturePromise, new Promise(r => setTimeout(r, 9000))]);
        if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = isEdit ? "Aktualisieren" : "Speichern"; }
      }
      try { screenshot = await annotator.flatten(); }
      catch(e){ console.warn("[vf] flatten", e); screenshot = null; }
      unhighlight();
    }
    // Eigener Screenshot gewinnt, wenn kein Annotator lief (Edit-Modus) oder flatten scheiterte
    if(customShot && (isEdit || !screenshot)) screenshot = customShot;
    if(isEdit){
      Object.assign(existing, {
        text:txt,
        structured: structHasContent ? struct : null,
        author:author||null, category:currentCat, priority:currentPri,
        updatedAt:new Date().toISOString()
      });
    }else{
      STATE.comments.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        selector, snippet, tag, info,
        pageUrl: STATE.currentUrl || STATE.src,
        text: txt,
        structured: structHasContent ? struct : null,
        screenshot,
        author: author || null,
        category: currentCat,
        priority: currentPri,
        ts: new Date().toISOString()
      });
    }
    if(saveComments(STATE.src, STATE.comments)){
      setLastPick(STATE.src, currentCat, currentPri);   // Wahl für den nächsten Kommentar merken
      renderAll(); refreshFrameBadges();
      close();
      toast(isEdit?"Aktualisiert.":"Kommentar gespeichert.");
      // Erster Kommentar: Export-Hinweis zeigen
      if(!isEdit && STATE.comments.length === 1){
        setTimeout(() => {
          toast('Erster Kommentar gespeichert! Am Ende: "Als Markdown" klicken und ans Team schicken.', 5500);
        }, 2400); // nach dem normalen Toast
      }
      // Presentation-Mode Promo: nach dem 3. Kommentar
      if(!isEdit && STATE.comments.length === 3 && STATE.isOwner){
        setTimeout(() => {
          toast('3 Kommentare! Tipp: "Präsentieren" für Team-Reviews nutzen.', 5000);
        }, 2600);
      }
    }else if(!isEdit){ STATE.comments.pop(); }
  };
  const onKey = e=>{
    if(e.key==="Escape"){ e.preventDefault(); close(); }
    else if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){ e.preventDefault(); save(); }
  };
  document.addEventListener("keydown", onKey, true);

  // Focus-Trap
  const focusableInModal = ()=> $$('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])', host)
    .filter(el => !el.disabled && el.offsetParent !== null);
  host.addEventListener("keydown", e=>{
    if(e.key !== "Tab") return;
    const list = focusableInModal(); if(!list.length) return;
    const first = list[0], last = list[list.length-1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
  $("[data-act=cancel]", host).onclick = close;
  $("[data-act=save]", host).onclick = save;

  // Public API für Re-Target aus dem Frame (Iframe-Klick auf anderes Element)
  const api = {
    retarget(newEl){
      if(!newEl || newEl.nodeType!==1) return;
      if(isEdit){ toast("Erst Bearbeitung abschließen oder abbrechen."); return; }
      currentEl = newEl;
      computeFromEl();
      renderTarget();
      highlightSelected();
      clearShot();   // Screenshot des alten Elements verwerfen (kein Auto-Capture)
      // Fokus zurück ins Textfeld für schnelles Weiter-Kommentieren
      ta.focus();
    },
    // Für die beforeunload-Warnung: hat der laufende (neue) Kommentar getippten,
    // noch ungespeicherten Inhalt? (Bei Edits konservativ nicht warnen.)
    isDirty(){
      if(isEdit) return false;
      if(ta.value.trim()) return true;
      const tpl = TEMPLATES[currentCat];
      if(tpl && tpl.fields.some(f => (structured[f.key]||"").trim())) return true;
      return false;
    },
    close
  };
  window.__vf_active_cbar = api;
}

// ============ Sidebar / Filter ============
function filteredComments(){
  if(STATE.filter==="all") return STATE.comments;
  return STATE.comments.filter(c=>c.category===STATE.filter);
}
function counts(){
  const c = { all: STATE.comments.length };
  const priosCount = {};
  CATEGORIES.forEach(k=>c[k.id]=0);
  PRIORITIES.forEach(p=>priosCount[p.id]=0);
  STATE.comments.forEach(x=>{
    if(c[x.category]!==undefined) c[x.category]++;
    if(priosCount[x.priority]!==undefined) priosCount[x.priority]++;
  });
  return { cats: c, prios: priosCount };
}
function renderAll(){
  const { cats: c, prios: priosCount } = counts();
  $("#cmt-count").textContent = c.all;

  // Stats badges
  const stats = $("#stats");
  const parts = [];
  if(priosCount.must) parts.push(`<span class="stat" style="color:var(--danger)"><b>${priosCount.must}</b> Muss</span>`);
  if(priosCount.should) parts.push(`<span class="stat" style="color:var(--warn)"><b>${priosCount.should}</b> Sollte</span>`);
  if(priosCount.could) parts.push(`<span class="stat"><b>${priosCount.could}</b> Könnte</span>`);
  if(priosCount.nice) parts.push(`<span class="stat"><b>${priosCount.nice}</b> Nice</span>`);
  const doneCount = STATE.comments.filter(x => stOf(x) === "done").length;
  if(doneCount) parts.push(`<span class="stat" style="color:var(--success)"><b>${doneCount}</b> ✓ erledigt</span>`);
  stats.innerHTML = parts.join("");

  // Filter chips
  const filter = $("#filter");
  const chips = [{id:"all",label:"Alle",emoji:""}].concat(CATEGORIES.map(x=>({id:x.id,label:x.label,emoji:x.emoji})));
  filter.innerHTML = chips.map(k=>{
    const n = c[k.id]||0;
    const active = STATE.filter===k.id?"active":"";
    if(k.id!=="all" && !n) return "";
    return `<span class="chip ${active}" data-f="${k.id}">${k.icon?icon(k.icon,13)+" ":""}${k.label}<span class="count">${n}</span></span>`;
  }).join("");
  $$("#filter .chip").forEach(ch => ch.addEventListener("click", ()=>{
    STATE.filter = ch.dataset.f; renderAll(); refreshFrameBadges();
  }));

  // List
  const list = $("#cmt-list");
  const items = filteredComments();
  const empty = $("#cmt-empty");
  if(!items.length && !STATE.comments.length){ empty.classList.remove("hidden"); list.innerHTML=""; return; }
  empty.classList.add("hidden");
  if(!items.length){
    list.innerHTML = `<div class="empty" style="padding:24px 12px">Keine Kommentare in dieser Kategorie.</div>`;
    return;
  }

  const devId = getDeviceId();
  list.innerHTML = items.map((c,i)=>{
    const cat = CAT_MAP[c.category]||CAT_MAP.feature;
    const pri = PRI_MAP[c.priority]||PRI_MAP.could;
    const rxn = c.reactions||{likes:[],dislikes:[]};
    const likeN = (rxn.likes||[]).length, dislikeN = (rxn.dislikes||[]).length;
    const likedByMe = (rxn.likes||[]).includes(devId);
    const dislikedByMe = (rxn.dislikes||[]).includes(devId);
    const replies = c.replies||[];
    const replyLabel = replies.length ? `${icon('message-square',14)} ${replies.length}` : `${icon('message-square',14)} Antworten`;
    const repliesHtml = replies.map(r => {
      const rRxn = r.reactions||{likes:[],dislikes:[]};
      const rLN = (rRxn.likes||[]).length, rDN = (rRxn.dislikes||[]).length;
      const rLiked = (rRxn.likes||[]).includes(devId);
      const rDisliked = (rRxn.dislikes||[]).includes(devId);
      return `<div class="reply" data-reply-id="${esc(r.id)}">
        <div class="reply-meta">${r.author?`<b>${esc(r.author)}</b>`:"Anonym"}<span>${new Date(r.ts).toLocaleString("de-DE")}</span></div>
        <div class="reply-txt">${esc(r.text)}</div>
        <div class="reply-reactions">
          <button class="rxn-btn${rLiked?" active":""}" data-rxn="${esc(c.id)}" data-reply-id="${esc(r.id)}" data-type="like" aria-label="Gefällt mir">${icon('thumbs-up',13)}${rLN?" "+rLN:""}</button>
          <button class="rxn-btn${rDisliked?" active":""}" data-rxn="${esc(c.id)}" data-reply-id="${esc(r.id)}" data-type="dislike" aria-label="Gefällt mir nicht">${icon('thumbs-down',13)}${rDN?" "+rDN:""}</button>
        </div>
      </div>`;
    }).join("");
    return `<div class="item" data-id="${esc(c.id)}" data-cat="${esc(c.category)}" data-done="${stOf(c)==="done"}">
      <div class="h">
        <div style="display:flex;gap:8px;align-items:center">
          <div class="num">${i+1}</div>
        </div>
        <div class="actions">
          <button class="edit" data-edit="${esc(c.id)}" title="Bearbeiten" aria-label="Bearbeiten">${icon('pencil',14)}</button>
          <button class="del" data-del="${esc(c.id)}" title="Löschen" aria-label="Löschen">${icon('trash-2',14)}</button>
        </div>
      </div>
      <div class="row2">
        <span class="cat" data-cat="${c.category}">${icon(cat.icon,13)} ${cat.label}</span>
        <span class="prio" data-p="${c.priority}">${pri.label}</span>
        <button class="st" data-status-btn="${esc(c.id)}" data-status="${stOf(c)}" title="Status weiterschalten (Offen → In Arbeit → Erledigt)">${icon(ST_MAP[stOf(c)].icon,13)} ${ST_MAP[stOf(c)].label}</button>
      </div>
      <div class="sel">${esc(truncate(c.selector,90))}</div>
      <div class="txt">${esc(commentSummary(c))}</div>
      ${c.screenshot ? `<div class="thumb"><img src="${esc(c.screenshot)}" alt="Screenshot" loading="lazy"></div>` : ""}
      <div class="meta">
        ${commentPage(c) !== STATE.currentUrl ? `<span class="pageref" title="Kommentar liegt auf einer anderen Subpage — Klick öffnet sie">${icon('map-pin',12)} ${esc(shortPath(commentPage(c)))}</span>` : ""}
        ${c.author?`<span>${esc(c.author)}</span>`:""}
        <span>${new Date(c.ts).toLocaleString("de-DE")}</span>
      </div>
      <div class="reactions">
        <button class="rxn-btn${likedByMe?" active":""}" data-rxn="${c.id}" data-type="like" aria-label="Gefällt mir">${icon('thumbs-up',14)}${likeN?" "+likeN:""}</button>
        <button class="rxn-btn${dislikedByMe?" active":""}" data-rxn="${c.id}" data-type="dislike" aria-label="Gefällt mir nicht">${icon('thumbs-down',14)}${dislikeN?" "+dislikeN:""}</button>
        <button class="reply-toggle" data-reply-toggle="${c.id}">${replyLabel}</button>
      </div>
      <div class="replies" data-replies="${c.id}"${replies.length?"":" hidden"}>${repliesHtml}</div>
      <div class="reply-form" data-reply-form="${c.id}" hidden>
        <textarea placeholder="Antwort schreiben…" rows="2"></textarea>
        <div class="reply-actions">
          <button class="ghost" data-reply-cancel="${c.id}">Abbrechen</button>
          <button class="primary small" data-reply-save="${c.id}">Antworten</button>
        </div>
      </div>
    </div>`;
  }).join("");

  $$("[data-del]", list).forEach(b=>b.addEventListener("click", e=>{
    e.stopPropagation();
    const id = b.dataset.del;
    const idx = STATE.comments.findIndex(x=>x.id===id);
    if(idx<0) return;
    const removed = STATE.comments[idx];
    STATE.comments = STATE.comments.filter(x=>x.id!==id);
    saveComments(STATE.src, STATE.comments);
    renderAll(); refreshFrameBadges();
    undoToast("Kommentar gelöscht", ()=>{
      STATE.comments.splice(Math.min(idx, STATE.comments.length), 0, removed);
      saveComments(STATE.src, STATE.comments);
      renderAll(); refreshFrameBadges();
    });
  }));
  $$("[data-edit]", list).forEach(b=>b.addEventListener("click", e=>{
    e.stopPropagation();
    const c = STATE.comments.find(x=>x.id===b.dataset.edit);
    if(c) openCommentModal(null, c);
  }));
  $$("[data-status-btn]", list).forEach(b=>b.addEventListener("click", e=>{
    e.stopPropagation();
    const c = STATE.comments.find(x=>x.id===b.dataset.statusBtn);
    if(!c) return;
    const order = STATUSES.map(s=>s.id);
    const next = order[(order.indexOf(stOf(c)) + 1) % order.length];
    if(next === "open") delete c.status; else c.status = next;   // offen = Feld weglassen
    saveComments(STATE.src, STATE.comments);
    renderAll();
  }));
  $$("[data-rxn]", list).forEach(b=>b.addEventListener("click", e=>{
    e.stopPropagation();
    toggleReaction(b.dataset.rxn, b.dataset.type, b.dataset.replyId||null);
  }));
  $$("[data-reply-toggle]", list).forEach(b=>b.addEventListener("click", e=>{
    e.stopPropagation();
    const id = b.dataset.replyToggle;
    const form = list.querySelector(`[data-reply-form="${id}"]`);
    const rlist = list.querySelector(`[data-replies="${id}"]`);
    if(form){
      form.hidden = !form.hidden;
      if(!form.hidden){ if(rlist) rlist.hidden=false; form.querySelector("textarea").focus(); }
    }
  }));
  $$("[data-reply-cancel]", list).forEach(b=>b.addEventListener("click", e=>{
    e.stopPropagation();
    const form = list.querySelector(`[data-reply-form="${b.dataset.replyCancel}"]`);
    if(form){ form.hidden=true; form.querySelector("textarea").value=""; }
  }));
  $$("[data-reply-save]", list).forEach(b=>b.addEventListener("click", e=>{
    e.stopPropagation();
    const id = b.dataset.replySave;
    const form = list.querySelector(`[data-reply-form="${id}"]`);
    const ta = form && form.querySelector("textarea");
    if(ta && ta.value.trim()) addReply(id, ta.value, getAuthor()||undefined);
  }));
  $$(".item", list).forEach(it => it.addEventListener("click", ()=>{
    const c = STATE.comments.find(x=>x.id===it.dataset.id);
    if(!c) return;
    focusComment(c);
    $$(".item", list).forEach(x=>x.classList.remove("active"));
    it.classList.add("active");
  }));
}

function focusComment(c){
  const targetPage = commentPage(c);
  if(targetPage && targetPage !== STATE.currentUrl){
    // Andere Subpage — erst dorthin navigieren, dann nach onload scrollen
    if(STATE.renderMode === "direct"){
      toast("Kommentar liegt auf anderer Subpage — Original-Modus lässt keine Steuerung zu.");
      return;
    }
    toast("Wechsle zu " + shortPath(targetPage) + " …");
    STATE.pendingScrollSelector = c;
    loadIntoFrame(targetPage);
    return;
  }
  scrollToSelector(c);
}
function shortPath(url){
  try{ const u = new URL(url); return (u.pathname||"/") + u.search + u.hash; }catch(e){ return url; }
}
function scrollToSelector(cOrSel){
  const doc = STATE.frameDoc; if(!doc) return;
  const el = (typeof cOrSel === 'object') ? resolveElement(cOrSel, doc) : (() => { try{ return doc.querySelector(cOrSel); }catch(e){ return null; } })();
  if(!el){ toast("Element nicht mehr im DOM."); return; }
  el.scrollIntoView({behavior:"smooth", block:"center"});
  el.animate([
    {boxShadow:"0 0 0 0 rgba(255,224,94,.95)"},
    {boxShadow:"0 0 0 14px rgba(255,224,94,0)"}
  ], {duration:900});
}

// ============ Human Label Helper ============
function humanLabel(info){
  if(!info) return null;
  const aria = info.attrs?.ariaLabel;
  if(aria && aria.length < 60) return aria;
  const txt = (info.text || '').trim();
  if(txt && txt.length > 0 && txt.length < 50) return `"${txt.slice(0,40)}"`;
  const tag = (info.tag || 'element').toLowerCase();
  const id = info.id ? `#${info.id}` : '';
  return id || null;
}

// ============ Export Reminder ============
function showExportReminder(){
  const existing = document.querySelector('.export-reminder');
  if(existing) return;
  const bar = document.createElement('div');
  bar.className = 'export-reminder';
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10001;background:var(--accent);border-top:2px solid var(--fg);padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 -4px 20px rgba(38,38,38,.18);font-size:13px;font-weight:500;color:var(--accent-ink)';
  bar.innerHTML = `
    <span style="flex:1;min-width:200px"><svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/></svg> Du hast <strong>${STATE.comments.length} Kommentar${STATE.comments.length===1?'':'e'}</strong>. Fertig? Exportiere dein Feedback!</span>
    <button id="er-download" style="background:var(--fg);color:var(--accent);border:1px solid var(--fg);border-radius:8px;padding:8px 14px;font:600 13px/1 inherit;cursor:pointer;white-space:nowrap">⬇ Als Markdown</button>
    <button id="er-zip" style="background:transparent;border:1px solid var(--fg);border-radius:8px;padding:8px 14px;font:600 13px/1 inherit;cursor:pointer;white-space:nowrap;color:var(--accent-ink)">🗜 Als ZIP</button>
    <button id="er-copy" style="background:transparent;border:1px solid var(--fg);border-radius:8px;padding:8px 14px;font:600 13px/1 inherit;cursor:pointer;white-space:nowrap;color:var(--accent-ink)">${icon("copy",13)} Kopieren</button>
    <button id="er-dismiss" style="background:transparent;border:0;padding:8px;cursor:pointer;color:var(--accent-ink);font-size:16px;line-height:1" aria-label="Schließen">✕</button>
  `;
  document.body.appendChild(bar);
  bar.querySelector('#er-download').onclick = () => { exportMarkdown(false); bar.remove(); };
  bar.querySelector('#er-zip').onclick = () => { exportZip(); bar.remove(); };
  bar.querySelector('#er-copy').onclick = () => { exportMarkdown(true); bar.remove(); };
  bar.querySelector('#er-dismiss').onclick = () => bar.remove();
}

// ============ Coach Mark ============
function showCoachMark(){
  const w = document.createElement("div");
  w.className = "coach";
  w.innerHTML = `
    <div class="card">
      <div style="font-size:32px;margin-bottom:8px">👋</div>
      <h3>So gibst du Feedback</h3>
      <p>Kein Signup, keine Konten. Nur klicken.</p>
      <div class="steps">
        <div>
          <div class="icon"><svg class="ic" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.586 12.586 19 19"/><path d="M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z"/></svg></div>
          <h4>Klick auf ein Element</h4>
          <p>Was auffällt: draufklicken. Zum Navigieren (Links, Formulare) oben auf <b>Navigieren</b> umschalten.</p>
        </div>
        <div>
          <div class="icon"><svg class="ic" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg></div>
          <h4>Kategorisieren</h4>
          <p>Bug? Feature-Wunsch? Design-Kritik? Ein Klick.</p>
        </div>
        <div style="background:var(--accent);border-color:var(--fg);border-width:1px;border-style:solid">
          <div class="icon"><svg class="ic" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg></div>
          <h4 style="color:var(--accent-ink)"><svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Exportieren &amp; senden</h4>
          <p style="color:var(--accent-ink)">Nicht vergessen: Dein Feedback bleibt auf <em>deinem</em> Gerät. Am Ende "Als Markdown" klicken → Datei ans Team schicken.</p>
        </div>
      </div>
      <button class="primary" id="coach-ok">Los geht's</button>
    </div>`;
  document.body.appendChild(w);
  $("#coach-ok", w).onclick = ()=>{ setSeenCoach(); w.remove(); };
  w.addEventListener("click", e=>{ if(e.target===w){ setSeenCoach(); w.remove(); }});
}

// ============ Presentation Mode ============
function openPresentation(){
  if(!STATE.comments.length){ toast("Keine Kommentare zum Präsentieren."); return; }
  let idx = 0;
  const w = document.createElement("div");
  w.className = "present";
  w.innerHTML = `
    <div class="present-top">
      <span class="title"><svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/></svg> Feedback-Review</span>
      <span class="counter"><span id="p-i">1</span> / ${STATE.comments.length}</span>
      <button class="tiny" id="p-close">Schließen (Esc)</button>
    </div>
    <div class="present-body">
      <div class="present-view">
        <iframe id="p-frame" sandbox="allow-same-origin allow-scripts"></iframe>
      </div>
      <div class="present-detail" id="p-detail"></div>
    </div>
    <div class="present-bot">
      <button id="p-prev">← Zurück</button>
      <div class="dots" id="p-dots"></div>
      <button class="primary" id="p-next">Weiter →</button>
    </div>`;
  document.body.appendChild(w);

  const pframe = $("#p-frame", w);
  // Re-use the loaded HTML from the main iframe.
  // Im Direkt-Rendering-Modus ist srcdoc leer (Frame lief über src) —
  // dann die URL direkt laden, sonst bliebe die Vorschau komplett leer.
  const mainFrame = $("#frame");
  if(mainFrame.srcdoc) pframe.srcdoc = mainFrame.srcdoc;
  else pframe.src = STATE.currentUrl || STATE.src;

  const render = ()=>{
    const c = STATE.comments[idx];
    $("#p-i", w).textContent = idx+1;
    const cat = CAT_MAP[c.category]||CAT_MAP.feature;
    const pri = PRI_MAP[c.priority]||PRI_MAP.could;
    $("#p-detail", w).innerHTML = `
      <div class="badges">
        <span class="cat" style="background:${catColorVar(c.category)}22;color:${catColorVar(c.category)}">${icon(cat.icon,13)} ${cat.label}</span>
        <span class="prio" style="border:1px solid var(--line);color:var(--fg-2);padding:4px 12px;border-radius:99px;font-size:12px">${pri.label}</span>
      </div>
      <h2>Kommentar ${idx+1}</h2>
      ${(function(){
        if(c.structured && Object.keys(c.structured).length){
          const tpl = TEMPLATES[c.category];
          const rows = (tpl?.fields||[]).map(f => c.structured[f.key]
            ? `<div style="margin-bottom:12px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);font-weight:700;margin-bottom:4px">${esc(f.label)}</div><div class="qtext" style="margin:0">${esc(c.structured[f.key])}</div></div>`
            : ""
          ).join("");
          const note = c.text ? `<div style="margin-bottom:12px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);font-weight:700;margin-bottom:4px">Notiz</div><div class="qtext" style="margin:0">${esc(c.text)}</div></div>` : "";
          return rows + note;
        }
        return `<div class="qtext">${esc(c.text||"")}</div>`;
      })()}
      ${c.screenshot ? `<div class="snipwrap" style="text-align:center;background:#fff"><label style="text-align:left">Screenshot</label><img src="${esc(c.screenshot)}" alt="Screenshot" style="max-width:100%;max-height:280px;border:1px solid var(--line);border-radius:6px"></div>` : ""}
      <div class="snipwrap">
        <label>Element</label>
        <code>${esc(c.snippet)}</code>
      </div>
      <div class="snipwrap">
        <label>CSS-Selector</label>
        <code>${esc(c.selector)}</code>
      </div>
      <div class="meta">
        ${c.author?`Von <b>${esc(c.author)}</b> · `:""}${new Date(c.ts).toLocaleString("de-DE")}
      </div>
    `;
    $("#p-dots", w).innerHTML = STATE.comments.map((_,i)=>`<span class="${i===idx?"on":""}"></span>`).join("");

    // highlight in iframe
    const doc = pframe.contentDocument;
    if(doc){
      $$(".__pv_hi", doc).forEach(el=>{ el.classList.remove("__pv_hi"); el.style.removeProperty("outline"); el.style.removeProperty("outline-offset"); });
      let el = resolveElement(c, doc);
      if(el){
        el.classList.add("__pv_hi");
        el.style.outline = `3px solid ${catColorVar(c.category)}`;
        el.style.outlineOffset = "3px";
        el.scrollIntoView({behavior:"smooth", block:"center"});
      }
    }
  };

  pframe.onload = ()=>{
    const doc = pframe.contentDocument;
    if(doc){
      // Prevent interaction inside presentation iframe
      doc.addEventListener("click", e=>{ e.preventDefault(); e.stopPropagation(); }, true);
      doc.addEventListener("submit", e=>e.preventDefault(), true);
    }
    render();
  };

  const close = ()=>{ w.remove(); document.removeEventListener("keydown", onKey, true); };
  const onKey = e=>{
    if(e.key==="Escape"){ close(); }
    else if(e.key==="ArrowRight" || e.key==="ArrowDown" || e.key===" "){ e.preventDefault(); if(idx<STATE.comments.length-1){ idx++; render(); } }
    else if(e.key==="ArrowLeft" || e.key==="ArrowUp"){ e.preventDefault(); if(idx>0){ idx--; render(); } }
  };
  document.addEventListener("keydown", onKey, true);
  $("#p-close", w).onclick = close;
  $("#p-next", w).onclick = ()=>{ if(idx<STATE.comments.length-1){ idx++; render(); } };
  $("#p-prev", w).onclick = ()=>{ if(idx>0){ idx--; render(); } };
}

// ============ Markdown Export ============
// opts.screenshotPath(comment, index) → relativer Pfad statt data-URL (ZIP-Export)
function buildMarkdown(opts){
  opts = opts || {};
  const src = STATE.src, cs = STATE.comments;
  const now = new Date().toISOString();
  const priOrder = { must:0, should:1, could:2, nice:3 };
  const actionVerb = { bug:"Fix", feature:"Implementiere", design:"Passe an", copy:"Formuliere um", question:"Beantworte", praise:"Notiere positiv" };
  // ts ist je nach Erzeugungspfad ISO-String oder Epoch-Zahl — robust auf ms parsen,
  // sonst liefert (a.ts||0)-(b.ts||0) bei String-ts NaN und der Tiebreak greift nicht.
  const tsn = v => typeof v === "number" ? v : (Date.parse(v) || 0);
  const sorted = [...cs].sort((a,b)=>{
    const pd = (priOrder[a.priority]??9) - (priOrder[b.priority]??9);
    if(pd) return pd;
    return tsn(a.ts) - tsn(b.ts);
  });

  const priCount = { must:0, should:0, could:0, nice:0 };
  const catCount = {};
  cs.forEach(c => { if(priCount[c.priority]!==undefined) priCount[c.priority]++; catCount[c.category]=(catCount[c.category]||0)+1; });

  let md = `# Feedback zu ${src}\n\n`;
  md += `> **Für den KI-Assistenten:** Du bist Senior Web-Engineer. Unten steht manuell gesammeltes Nutzer-Feedback zu einer Web-Seite. Arbeite die Items in der angegebenen Reihenfolge ab (Muss → Sollte → Könnte → Nice). Für jedes Item:\n`;
  md += `> 1. Finde das Ziel-Element per CSS-Selector — nutze die Fallback-Identifier (Text, ARIA-Label, data-testid, href) falls der Selector veraltet ist.\n`;
  md += `> 2. Schlage einen minimalen Patch vor (HTML/CSS/JS-Diff). Keine Umfangsausweitung.\n`;
  md += `> 3. Bei Mehrdeutigkeit: liste Rückfragen statt zu raten.\n`;
  md += `> 4. „Muss" ist blockierend, „Nice" ist optional. Antworte gruppiert nach Datei.\n`;
  const stCount = { open:0, doing:0, done:0 };
  cs.forEach(c => stCount[stOf(c)]++);
  if(stCount.done || stCount.doing) md += `> 5. Items mit ✓ sind bereits erledigt, ◐ ist in Arbeit — beide nur prüfen, nicht neu umsetzen.\n`;
  md += `\n`;

  md += `**Session:** ${cs.length} Item${cs.length===1?"":"s"} · exportiert ${now}\n\n`;
  if(stCount.done || stCount.doing) md += `**Status:** ${STATUSES.filter(s=>stCount[s.id]).map(s=>`${s.chip} ${s.label} ${stCount[s.id]}`).join(" · ")}\n\n`;
  md += `**Items nach Priorität:** `;
  md += PRIORITIES.filter(p=>priCount[p.id]).map(p=>`${p.label} ${priCount[p.id]}`).join(" · ") || "—";
  md += `\n\n**Verteilung:** `;
  md += CATEGORIES.filter(k=>catCount[k.id]).map(k=>`${k.emoji} ${k.label} ${catCount[k.id]}`).join(" · ") || "—";
  md += `\n\n---\n\n`;

  if(!cs.length){
    md += `_Noch keine Kommentare vorhanden._\n`;
    return md;
  }

  sorted.forEach((c, idx) => {
    const cat = CAT_MAP[c.category] || { emoji:"•", label:c.category };
    const pri = PRI_MAP[c.priority] || PRI_MAP.could;
    const verb = actionVerb[c.category] || "Adressiere";
    const info = c.info || {};
    const attrs = info.attrs || {};
    const shortText = (info.text && info.text.length<70) ? info.text : null;
    const truncText = info.text ? info.text.slice(0,56).trim()+"…" : null;
    // Reihenfolge: kurzer sichtbarer Text > semantische Attribute > gekürzter Text > roher Tag.
    // Ein blankes „<div>" als Überschrift ist für den LLM-Empfänger wertlos, gekürzter
    // Text (z.B. der Hero-Inhalt) verankert das Item dagegen sofort.
    // Letztes Glied: der Selektor statt eines nackten `<svg>`/`<div>` — der bleibt
    // ein eindeutiger Anker fürs Coding-LLM, ein blanker Tag ist wertlos.
    const title = shortText || attrs.ariaLabel || attrs.alt || attrs.title || attrs.placeholder || truncText || c.selector || (`<${c.tag}>`);

    md += `## ${idx+1}. [${pri.label}]${stOf(c)!=="open" ? " " + ST_MAP[stOf(c)].chip : ""} ${cat.emoji} ${verb}: ${title}\n\n`;

    const fp = [];
    fp.push(`\`${c.selector}\``);
    if(attrs.dataTestid) fp.push(`\`[data-testid="${attrs.dataTestid}"]\``);
    if(info.id) fp.push(`\`#${info.id}\``);
    if(info.text) fp.push(`Text="${info.text.slice(0,60).replace(/"/g,'\\"')}"`);
    if(attrs.ariaLabel) fp.push(`aria-label="${attrs.ariaLabel}"`);
    if(attrs.href) fp.push(`href="${attrs.href}"`);
    md += `**Ziel:** ${fp[0]}  \n`;
    if(fp.length>1) md += `**Fallback-Identifier:** ${fp.slice(1).join(" · ")}  \n`;

    const metaParts = [];
    metaParts.push(`Kategorie ${cat.label}`);
    metaParts.push(`Priorität ${pri.label}`);
    if(stOf(c) !== "open") metaParts.push(`Status ${ST_MAP[stOf(c)].label} ${ST_MAP[stOf(c)].chip}`);
    if(info.rect) metaParts.push(`${info.rect.w}×${info.rect.h}px @ ${info.rect.viewport}${info.rect.visible===false?" · unsichtbar":""}`);
    if(info.docTitle) metaParts.push(`Seite: "${info.docTitle}"`);
    if(c.author) metaParts.push(`von ${c.author}`);
    md += `**Meta:** ${metaParts.join(" · ")}\n\n`;

    // Strukturierte Template-Felder als saubere Sub-Sektionen
    const struct = c.structured || {};
    const tpl = TEMPLATES[c.category];
    let hasStructured = false;
    const coveredKeys = new Set();
    if(tpl && tpl.fields.length){
      tpl.fields.forEach(f => {
        const v = struct[f.key];
        coveredKeys.add(f.key);
        if(!v) return;
        hasStructured = true;
        md += `**${f.label}:**\n\n${v.split("\n").map(l=>"> "+l).join("\n")}\n\n`;
      });
    }
    // Nach Kategorie-Wechsel können strukturierte Felder aus einem anderen Template
    // übrig bleiben. Diese sonst nur im JSON-Block sichtbaren Werte generisch mit
    // ausgeben, damit der lesbare Teil deckungsgleich mit den Daten bleibt.
    Object.keys(struct).forEach(k => {
      const v = struct[k];
      if(coveredKeys.has(k) || !v) return;
      hasStructured = true;
      const label = k.charAt(0).toUpperCase() + k.slice(1);
      md += `**${label}:**\n\n${String(v).split("\n").map(l=>"> "+l).join("\n")}\n\n`;
    });
    if(c.text){
      md += `**${hasStructured ? "Zusätzliche Notiz" : "Feedback"}:**\n\n${c.text.split("\n").map(l=>"> "+l).join("\n")}\n\n`;
    }

    // Reactions + Replies
    const rxn = c.reactions||{likes:[],dislikes:[]};
    const likeN = (rxn.likes||[]).length, dislikeN = (rxn.dislikes||[]).length;
    if(likeN||dislikeN) md += `**Reaktionen:** 👍 ${likeN} · 👎 ${dislikeN}\n\n`;
    const replies = c.replies||[];
    if(replies.length){
      md += `**Antworten (${replies.length}):**\n\n`;
      replies.forEach(r => {
        const rRxn = r.reactions||{likes:[],dislikes:[]};
        const rLN = (rRxn.likes||[]).length, rDN = (rRxn.dislikes||[]).length;
        const rMeta = [r.author||"Anonym", new Date(r.ts).toLocaleString("de-DE"), ...(rLN||rDN?[`👍 ${rLN} 👎 ${rDN}`]:[])].join(" · ");
        md += `> **${rMeta}**\n> ${r.text.split("\n").join("\n> ")}\n\n`;
      });
    }

    // Element-Kontext komprimiert in einem Details-Block
    const ctx = [];
    if(info.role) ctx.push(`role=\`${info.role}\``);
    if(info.classes?.length) ctx.push(`classes=\`${info.classes.map(x=>"."+x).join("")}\``);
    if(info.ancestors?.length) ctx.push(`ancestors=\`${info.ancestors.join(" > ")}\``);
    if(info.style) ctx.push(`style=\`${info.style.fontSize} ${info.style.fontWeight}, ${info.style.color} / ${info.style.effectiveBg || info.style.backgroundColor}\``);
    if(ctx.length || c.snippet || c.screenshot){
      md += `<details><summary>Element-Kontext, HTML & Screenshot</summary>\n\n`;
      if(ctx.length) md += ctx.map(x=>`- ${x}`).join("\n") + `\n\n`;
      if(c.snippet) md += `\`\`\`html\n${c.snippet}\n\`\`\`\n\n`;
      if(c.screenshot){
        if(opts.screenshotPath){
          // ZIP-Export: Screenshot als verlinkte Bilddatei.
          const shotRef = opts.screenshotPath(c, idx);
          if(shotRef) md += `![Screenshot](${shotRef})\n\n`;
        } else {
          // Reiner Markdown-Export (Zwischenablage/Download) bleibt schlank und
          // LLM-tauglich: KEINE base64-Data-URL im Text (die blähte den Export auf
          // ~88% Ballast auf und wird von Chat-LLMs nicht als Bild gerendert).
          // Das Bild liegt als Datei im ZIP-Export (feedback.json + screenshots/).
          md += `_📎 Screenshot vorhanden — im ZIP-Export als Bilddatei, per Re-Import wieder verfügbar._\n\n`;
        }
      }
      md += `</details>\n\n`;
    }

    md += `---\n\n`;
  });

  // Maschinen-lesbarer JSON-Block am Ende
  const jsonPayload = sorted.map(c => ({
    id: c.id,
    priority: c.priority,
    category: c.category,
    status: c.status || "open",
    selector: c.selector,
    tag: c.tag || null,
    page: c.pageUrl || null,
    // Beim ZIP-Export: Pfad der Bilddatei, damit das Markdown allein re-importierbar bleibt
    screenshotFile: (opts.screenshotFiles && opts.screenshotFiles[c.id]) || null,
    fallback: {
      text: c.info?.text || null,
      ariaLabel: c.info?.attrs?.ariaLabel || null,
      dataTestid: c.info?.attrs?.dataTestid || null,
      href: c.info?.attrs?.href || null,
      id: c.info?.id || null
    },
    structured: c.structured || null,
    note: c.text || null,
    author: c.author || null,
    ts: c.ts,
    reactions: {likes:(c.reactions?.likes||[]).length, dislikes:(c.reactions?.dislikes||[]).length},
    replies: (c.replies||[]).map(r=>({id:r.id, author:r.author||null, text:r.text, ts:r.ts, reactions:{likes:(r.reactions?.likes||[]).length, dislikes:(r.reactions?.dislikes||[]).length}}))
  }));
  md += `<details><summary>🤖 Machine-readable JSON (für Tool-Konsumenten)</summary>\n\n\`\`\`json\n${JSON.stringify({ source: src, exportedAt: now, count: cs.length, items: jsonPayload }, null, 2)}\n\`\`\`\n\n</details>\n`;

  return md;
}

// Reaktionen aus einem Import übernehmen statt verwerfen (Kollaborations-Roundtrip):
// nur Strings, dedupliziert und gedeckelt, damit fremde Eingaben nichts aufblähen.
function normReactions(r){
  const clean = a => [...new Set((Array.isArray(a) ? a : []).filter(x => typeof x === "string").slice(0, 500))];
  return { likes: clean(r && r.likes), dislikes: clean(r && r.dislikes) };
}

// Übernimmt rohe Import-Items in STATE.comments. Importierte Dateien sind fremde
// Eingaben: IDs landen in HTML-Attributen, Screenshots in <img src> — beides nur
// in sicherer Form übernehmen (Stored-XSS).
function importItems(items, existingIds, existingFp){
  const safeId = v => (typeof v === "string" && /^[a-z0-9_-]{1,64}$/i.test(v)) ? v : null;
  // Ganzen String validieren, nicht nur das Präfix: ein `"` im Rest bräche sonst aus
  // dem <img src="…">-Attribut aus. Kein SVG (kann Skripte tragen).
  const safeShot = v => (typeof v === "string"
    && /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+=*$/i.test(v)
    && v.length < 4e6) ? v : null;

  let added = 0, skipped = 0, merged = 0;
  for(const item of items){
    if(!item || !item.selector) continue;
    const fp = item.selector + ":" + item.ts;

    // Dedup: skip if same id OR same selector+ts fingerprint.
    // Kollaborations-Roundtrip: Der bekannte Kommentar wird nicht dupliziert,
    // aber mitgelieferte Änderungen eines Helfers werden übernommen — Status,
    // neue Antworten und neue Reaktionen landen so wieder beim Owner.
    if((item.id && existingIds.has(item.id)) || existingFp.has(fp)){
      const mine = STATE.comments.find(x => (item.id && x.id === item.id) || (x.selector + ":" + x.ts) === fp);
      if(mine){
        let touched = false;
        const incoming = ST_MAP[item.status] ? item.status : null;
        if(incoming && stOf(mine) !== incoming){
          if(incoming === "open") delete mine.status; else mine.status = incoming;
          touched = true;
        }
        // Neue Antworten anhängen (nach id/ts+text deduplizieren)
        const seenReplies = new Set((mine.replies || []).map(r => r.id || (r.ts + ":" + r.text)));
        (item.replies || []).forEach(r => {
          const key = r.id || (r.ts + ":" + r.text);
          if(seenReplies.has(key)) return;
          seenReplies.add(key);
          (mine.replies = mine.replies || []).push({
            id:     safeId(r.id) || (Date.now().toString(36) + Math.random().toString(36).slice(2)),
            text:   r.text || "", author: r.author || "", ts: r.ts || Date.now(),
            reactions: normReactions(r.reactions)
          });
          touched = true;
        });
        // Reaktionen vereinigen
        const inc = normReactions(item.reactions);
        if(inc.likes.length || inc.dislikes.length){
          const cur = mine.reactions = normReactions(mine.reactions);
          const before = cur.likes.length + cur.dislikes.length;
          mine.reactions = { likes: [...new Set([...cur.likes, ...inc.likes])], dislikes: [...new Set([...cur.dislikes, ...inc.dislikes])] };
          if(mine.reactions.likes.length + mine.reactions.dislikes.length !== before) touched = true;
        }
        if(touched) merged++;
      }
      skipped++; continue;
    }

    const id = safeId(item.id) || (Date.now().toString(36) + Math.random().toString(36).slice(2));
    existingIds.add(id);
    existingFp.add(fp);

    const fallback = item.fallback || {};
    STATE.comments.push({
      id,
      selector:   item.selector,
      tag:        item.tag || (item.selector.match(/^(\w[\w-]*)/)?.[1] || "div"),
      text:       item.text || item.note || "",
      author:     item.author || "",
      ts:         item.ts || Date.now(),
      category:   CAT_MAP[item.category] ? item.category : "feature",
      priority:   PRI_MAP[item.priority] ? item.priority : "could",
      // Bearbeitungsstatus aus dem Dashboard; fehlend/unbekannt = offen (Feld weglassen)
      status:     ["doing","done"].includes(item.status) ? item.status : undefined,
      screenshot: safeShot(item.screenshot),
      structured: item.structured || null,
      snippet:    item.snippet || null,
      pageUrl:    item.page || item.pageUrl || null,
      info: item.info || (Object.keys(fallback).some(k=>fallback[k]) ? {
        text:      fallback.text || null,
        id:        fallback.id || null,
        attrs: {
          ariaLabel:   fallback.ariaLabel || null,
          dataTestid:  fallback.dataTestid || null,
          href:        fallback.href || null
        }
      } : null),
      reactions: normReactions(item.reactions),
      replies: (item.replies || []).map(r => ({
        id:     safeId(r.id) || (Date.now().toString(36) + Math.random().toString(36).slice(2)),
        text:   r.text || "",
        author: r.author || "",
        ts:     r.ts || Date.now(),
        reactions: normReactions(r.reactions)
      }))
    });
    added++;
  }
  return { added, skipped, merged };
}

async function importComments(fileInput){
  const files = fileInput ? [...fileInput.files] : [];
  if(!files.length) return;
  // Reset so the same file can be picked again next time
  fileInput.value = "";

  // Build dedup sets: by id and by selector:ts fingerprint
  const existingIds = new Set(STATE.comments.map(c=>c.id).filter(Boolean));
  const existingFp  = new Set(STATE.comments.map(c=>c.selector+":"+c.ts));

  let newCount = 0, skipCount = 0, mergeCount = 0, errorFiles = [];

  for(const file of files){
    let items = [];

    if(/\.zip$/i.test(file.name)){
      try{ items = await itemsFromZip(file); }
      catch(e){ console.warn("[vf] zip-import", e); errorFiles.push(file.name); continue; }
      const res = importItems(items, existingIds, existingFp);
      newCount += res.added; skipCount += res.skipped; mergeCount += res.merged;
      continue;
    }

    let raw;
    try{ raw = await file.text(); }
    catch(e){ errorFiles.push(file.name); continue; }

    try{
      if(file.name.endsWith(".json")){
        const parsed = JSON.parse(raw);
        items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.comments || []);
      } else {
        // .md: pull the JSON from the <details> machine-readable block
        const m = raw.match(/```json\r?\n([\s\S]*?)\r?\n```/);
        if(!m) throw new Error("Kein JSON-Block");
        const parsed = JSON.parse(m[1]);
        items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.comments || []);
      }
    }catch(e){ errorFiles.push(file.name); continue; }

    const res = importItems(items, existingIds, existingFp);
    newCount += res.added; skipCount += res.skipped; mergeCount += res.merged;
  }

  // Auch ein reiner Status-Merge (0 neue Kommentare) muss gespeichert werden
  if(newCount || mergeCount){
    saveComments(STATE.src, STATE.comments);
    renderAll();
    refreshFrameBadges();
  }

  // Ein Status-Merge zählt intern auch als "skipped" — dem Nutzer aber nur eines melden
  const dupCount = skipCount - mergeCount;
  const parts = [];
  if(newCount)       parts.push(`${newCount} Kommentar${newCount===1?"":"e"} importiert`);
  if(mergeCount)     parts.push(`${mergeCount} Status übernommen`);
  if(dupCount > 0)   parts.push(`${dupCount} Duplikat${dupCount===1?"":"e"} übersprungen`);
  if(errorFiles.length) parts.push(`${errorFiles.length} Datei${errorFiles.length===1?" unlesbar":"en unlesbar"}: ${errorFiles.join(", ")}`);
  toast(parts.join(" · ") || "Nichts importiert.", newCount ? 3000 : 4500);
}

// ============ ZIP ============
// Schreiben/Lesen liegt in vf-zip.js (gemeinsam mit dem Dashboard) und hängt als
// window.VFZip am globalen Objekt. layer.js hat eine eigene Kopie, weil das
// Bookmarklet in fremden Seiten nichts nachladen darf.
// Fehlt die Datei (404, Adblocker, Offline), dürfen nur die ZIP-Funktionen
// ausfallen — nicht das ganze Tool. Deshalb kein Destructuring auf oberster Ebene.
const VFZIP = window.VFZip || null;
if(!VFZIP) console.warn("[vf] vf-zip.js nicht geladen — ZIP-Export und -Import sind deaktiviert.");
function zipReady(){
  if(VFZIP) return true;
  toast("ZIP-Funktionen nicht verfügbar — die Datei vf-zip.js konnte nicht geladen werden.", 4500);
  return false;
}

// DOM-Helfer, bewusst lokal: der Markdown-Download darf nicht von vf-zip.js abhängen.
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

// Kommentare aus einem VibeFeedback-ZIP ziehen: bevorzugt feedback.json
// (enthält die Screenshots eingebettet), sonst das Markdown + screenshots/-Ordner.
async function itemsFromZip(file){
  if(!VFZIP) throw new Error("ZIP-Unterstützung nicht geladen");
  const files = await VFZIP.readZip(await file.arrayBuffer());
  const dec = new TextDecoder();
  const pick = re => [...files.keys()].find(n => re.test(n));

  const jsonName = files.has("feedback.json") ? "feedback.json" : pick(/\.json$/i);
  const mdName   = files.has("feedback.md")   ? "feedback.md"   : pick(/\.md$/i);

  let items = [];
  if(jsonName){
    const parsed = JSON.parse(dec.decode(files.get(jsonName)));
    items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.comments || []);
  }else if(mdName){
    const m = dec.decode(files.get(mdName)).match(/```json\r?\n([\s\S]*?)\r?\n```/);
    if(!m) throw new Error("Kein JSON-Block im Markdown");
    const parsed = JSON.parse(m[1]);
    items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.comments || []);
  }else{
    throw new Error("Weder feedback.json noch feedback.md im ZIP");
  }

  // Screenshots aus dem Ordner nachladen, wo sie in den Daten fehlen
  items.forEach(it => {
    if(it.screenshot || !it.screenshotFile) return;
    const bytes = files.get(it.screenshotFile);
    if(bytes) it.screenshot = VFZIP.bytesToDataUrl(bytes, it.screenshotFile);
  });
  return items;
}

async function exportZip(){
  if(!zipReady()) return;
  if(!STATE.comments.length){ toast("Keine Kommentare zum Exportieren."); return; }
  const btn = $("#btn-export-zip");
  if(btn){ btn.disabled = true; btn.textContent = "Packe…"; }
  try{
    const enc = new TextEncoder();
    const shots = [];               // { name, data }
    const screenshotFiles = {};     // comment.id → Dateiname (landet im JSON-Block)

    // buildMarkdown ruft screenshotPath in Sortier-Reihenfolge auf — dort die Dateien einsammeln
    const md = buildMarkdown({
      screenshotFiles,
      screenshotPath: (c, idx) => {
        const parsed = c.screenshot ? VFZIP.dataUrlToBytes(c.screenshot) : null;
        if(!parsed) return null;
        const label = VFZIP.slugify((c.info && c.info.text) || c.tag || "element", 32);
        let name = `screenshots/${String(idx + 1).padStart(2, "0")}-${label}.${parsed.ext}`;
        // Ein ZIP mit doppelten Einträgen wäre kaputt — Suffix anhängen, falls nötig
        for(let n = 2; shots.some(f => f.name === name); n++){
          name = `screenshots/${String(idx + 1).padStart(2, "0")}-${label}-${n}.${parsed.ext}`;
        }
        shots.push({ name, data: parsed.bytes });
        screenshotFiles[c.id] = name;
        return name;
      }
    });

    // Screenshots bleiben zusätzlich als base64 eingebettet (Standalone-Re-Import der
    // feedback.json ohne Ordner), tragen aber jetzt auch den Dateipfad — so kann
    // itemsFromZip den Ordner-Fallback nutzen, falls das base64 mal fehlt.
    const jsonPayload = {
      source: STATE.src,
      exportedAt: new Date().toISOString(),
      count: STATE.comments.length,
      comments: STATE.comments.map(c => screenshotFiles[c.id] ? { ...c, screenshotFile: screenshotFiles[c.id] } : c)
    };

    const stamp = new Date().toISOString().slice(0, 10);
    const readme = [
      `# VibeFeedback-Export`,
      ``,
      `- **feedback.md** — das Feedback zum Lesen und als Prompt-Grundlage. Screenshots sind als Bilddateien verlinkt.`,
      `- **feedback.json** — vollständige Daten inkl. eingebetteter Screenshots; kann in VibeFeedback re-importiert werden.`,
      `- **screenshots/** — ein Bild je kommentiertem Element.`,
      ``,
      `Quelle: ${STATE.src}`,
      `Exportiert: ${new Date().toLocaleString("de-DE")} · ${STATE.comments.length} Kommentar(e)`,
      ``
    ].join("\n");

    const blob = VFZIP.buildZip([
      { name: "feedback.md",   data: enc.encode(md) },
      { name: "feedback.json", data: enc.encode(JSON.stringify(jsonPayload, null, 2)) },
      { name: "README.md",     data: enc.encode(readme) },
      ...shots
    ]);

    downloadBlob(blob, `vibefeedback-${stamp}.zip`);
    document.querySelector(".export-reminder")?.remove();
    const mb = (blob.size / 1048576).toFixed(1);
    toast(`ZIP heruntergeladen — ${shots.length} Screenshot(s), ${mb} MB.`, 3500);
  }catch(e){
    console.warn("[vf] zip", e);
    toast("ZIP-Export fehlgeschlagen.");
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = "Als ZIP"; }
  }
}

async function exportMarkdown(copyOnly){
  if(!STATE.comments.length){ toast("Keine Kommentare zum Exportieren."); return; }
  const md = buildMarkdown();
  document.querySelector('.export-reminder')?.remove();
  if(copyOnly){
    try{ await navigator.clipboard.writeText(md); toast("Markdown in Zwischenablage."); }
    catch(e){ toast("Kopieren fehlgeschlagen."); }
    return;
  }
  const stamp = new Date().toISOString().slice(0,10);
  downloadBlob(new Blob([md], {type:"text/markdown;charset=utf-8"}), `vibefeedback-${stamp}.md`);
  toast("Markdown heruntergeladen.");
}

// ============ Back-to-Top ============
(function(){
  const btn = document.getElementById("back-to-top");
  if(!btn) return;
  const onScroll = ()=>{ btn.classList.toggle("visible", window.scrollY > 400); };
  window.addEventListener("scroll", onScroll, { passive:true });
})();

// ============ Router ============
(function main(){
  const params = new URLSearchParams(location.search);
  if(params.get("__vftest")==="1"){ window.__vftest = { STATE, buildMarkdown, CATEGORIES, PRIORITIES, TEMPLATES, CAT_MAP, PRI_MAP, createAnnotator, itemsFromZip, ...(VFZIP || {}) }; console.log("[vf] test hook installed"); }
  const src = params.get("src");
  const owner = params.get("owner")==="1";
  if(src){ initApp(src, owner); } else { initLanding(); }
})();
