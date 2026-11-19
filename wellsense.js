"use strict";
/* WellSense — Future Health Digital Innovation Challenge 2026, Wellbeing track.
   Sense (check-ins) → Predict (personal-baseline signals) → Support (private AI coach + safety).
   English + Arabic (RTL). Regions: Pakistan, UAE. All data stays on this device; AI runs locally via Lemonade. */

const API = "http://localhost:13305/api/v1";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
async function api(path, opts = {}) {
  const r = await fetch(API + path, opts);
  if (!r.ok) { let m = r.status + " " + r.statusText; try { const j = await r.json(); m = j.error?.message || j.error || m; } catch {} throw new Error(typeof m === "string" ? m : JSON.stringify(m)); }
  return r;
}
const getJSON = p => api(p).then(r => r.json());
const postJSON = (p, b) => api(p, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(b)});

/* ---------- storage ---------- */
const KEY = "lp.health.v1";
const HD = Object.assign({log: {}, card: {}, screens: [], goals: {water: 8, steps: 7000}, region: "pk"}, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })());
HD.goals = Object.assign({water: 8, steps: 7000}, HD.goals); HD.screens ||= []; HD.region ||= "pk";
function save() { try { localStorage.setItem(KEY, JSON.stringify(HD)); } catch { toast(t("Couldn't save — browser storage is unavailable."), true); } }
const dkey = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const today = () => dkey(new Date());
const ago = n => { const x = new Date(); x.setDate(x.getDate() - n); return dkey(x); };
const lastDays = n => Array.from({length: n}, (_, i) => ago(n - 1 - i));
const day = k => HD.log[k] || (HD.log[k] = {});
const filled = e => e && Object.entries(e).some(([k, v]) => k[0] !== "_" && v != null && v !== "" && !(Array.isArray(v) && !v.length));
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

/* ---------- language ---------- */
let LANG = (() => { try { return localStorage.getItem("ws.lang") || "en"; } catch { return "en"; } })();
const AR_ = () => LANG === "ar";
function t(s, p = {}) { let out = AR_() ? (I18N_AR[s] ?? s) : s; return out.replace(/\{(\w+)\}/g, (m, k) => p[k] ?? m); }
const fmtDate = (d, o) => new Date(d).toLocaleDateString(AR_() ? "ar-AE-u-nu-latn" : undefined, o);
const listJoin = a => a.join(AR_() ? "، " : ", ");
// static HTML: remember original English text and attributes once, then swap
const STATIC = [];
function captureStatic() {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {acceptNode: n => n.nodeValue.trim() && !n.parentElement.closest("script,style,[data-dyn]") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT});
  for (let n; (n = w.nextNode());) STATIC.push({n, v: n.nodeValue});
  document.querySelectorAll("[placeholder],[aria-label],[title]").forEach(el => { if (el.closest("[data-dyn]")) return; for (const a of ["placeholder", "aria-label", "title"]) if (el.hasAttribute(a)) STATIC.push({el, a, v: el.getAttribute(a)}); });
}
function applyStatic() {
  for (const s of STATIC) {
    if (s.n) { const m = s.v.match(/^(\s*)([\s\S]*?)(\s*)$/); s.n.nodeValue = m[1] + t(m[2]) + m[3]; }
    else s.el.setAttribute(s.a, t(s.v));
  }
}
function setLang(l) {
  LANG = l; try { localStorage.setItem("ws.lang", l); } catch {}
  document.documentElement.lang = l === "ar" ? "ar" : "en"; document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  applyStatic(); $("#langBtn").textContent = l === "ar" ? "English" : "عربي";
  document.title = t("WellSense — early wellbeing signals"); renderSos(); refreshPage();
}

/* ---------- region ---------- */
const REGIONS = {
  pk: {name: "Pakistan", amb: "1122", amb2: "115", pol: "15", fire: "16", ambText: {en: "1122 or 115", ar: "1122 أو 115"},
       crisis: {name: {en: "Umang", ar: "أومنغ (Umang)"}, num: "0311-7786264", tel: "03117786264", note: {en: "free, 24/7 (number as widely published; confirm at umang.com.pk)", ar: "مجاني، على مدار الساعة (الرقم كما هو منشور على نطاق واسع؛ تأكّد منه على umang.com.pk)"}},
       numbers: [["1122", "Rescue 1122", "Ambulance, fire and rescue", 1], ["115", "Edhi Ambulance", "Ambulance, nationwide", 1], ["15", "Police", "Crime, threats, danger"], ["16", "Fire Brigade", "Fire"], ["1020", "Chhipa Ambulance", "Ambulance, mainly Karachi"], ["130", "Motorway Police", "Motorway and highway accidents"]],
       services: [["0311-7786264", "Umang", "Free 24/7 mental health helpline (confirm at umang.com.pk)", "03117786264"], ["0800-77767", "National Poison Control Centre, JPMC Karachi", "Toll-free; opened 2012 — may not answer 24/7", "080077767"]],
       poison: {en: "National Poison Control Centre, JPMC Karachi: 0800-77767 (opened 2012; may not answer 24/7 — call 1122 first if serious).", ar: "المركز الوطني لمكافحة السموم، مستشفى JPMC كراتشي: 0800-77767 (افتُتح عام 2012؛ قد لا يرد على مدار الساعة — اتصل بـ 1122 أولاً إذا كانت الحالة خطيرة)."}},
  ae: {name: "UAE", amb: "998", amb2: null, pol: "999", fire: "997", ambText: {en: "998", ar: "998"},
       crisis: {name: {en: "800-HOPE (National Mental Support Line)", ar: "800-HOPE (خط الدعم النفسي الوطني)"}, num: "800 4673", tel: "8004673", note: {en: "free, call or WhatsApp, Arabic and English — check current hours", ar: "مجاني، اتصال أو واتساب، بالعربية والإنجليزية — تحقّق من ساعات العمل الحالية"}},
       numbers: [["998", "Ambulance", "Medical emergencies, anywhere in the UAE", 1], ["999", "Police", "Police emergencies", 1], ["997", "Civil Defence", "Fire and rescue"], ["996", "Coastguard", "Sea emergencies"], ["995", "Search and Rescue", "Search and rescue"]],
       services: [["800 4673", "800-HOPE", "National Mental Support Line — call or WhatsApp, Arabic and English", "8004673"], ["800 506", "Itma'en (Dubai)", "Dubai mental health support line", "800506"], ["800 342", "Dubai Health Authority (800 DHA)", "24/7 health services and advice line", "800342"], ["800 424", "Poison and Drug Information Service (DoH Abu Dhabi)", "Weekdays 7am–11pm", "800424"]],
       poison: {en: "Poison and Drug Information Service (Department of Health – Abu Dhabi): 800 424, weekdays 7am–11pm. If serious, call 998.", ar: "خدمة معلومات السموم والأدوية (دائرة الصحة – أبوظبي): 800 424، أيام العمل من 7 صباحاً حتى 11 مساءً. إذا كانت الحالة خطيرة اتصل بـ 998."}},
};
const R = () => REGIONS[HD.region] || REGIONS.pk;
const L = o => o[AR_() ? "ar" : "en"];
function fill(s) { const r = R(); return s.replaceAll("{AMB}", `<b>${L(r.ambText)}</b>`).replaceAll("{AMB1}", `<b>${r.amb}</b>`).replaceAll("{POL}", `<b>${r.pol}</b>`).replaceAll("{CRISIS}", `<b>${esc(L(r.crisis.name))}</b> — ${r.crisis.num}`); }
function renderSos() {
  const r = R(), parts = [[r.amb, t("Ambulance")], ...(r.amb2 ? [[r.amb2, "Edhi"]] : []), [r.pol, t("Police")], [r.fire, t("Fire")]];
  $("#sosBar").innerHTML = `<div class="sos-t"><b>${t(HD.region === "ae" ? "Emergency in the UAE?" : "Emergency in Pakistan?")}</b><span>${t("Call now — don't wait.")}</span></div>` + parts.map(([n, l], i) => `<a class="sos-n ${i >= (r.amb2 ? 2 : 1) ? "alt" : ""}" href="tel:${n}"><span class="mono">${n}</span>${esc(l)}</a>`).join("");
}

/* ---------- UI helpers ---------- */
function toast(msg, bad) { const el = document.createElement("div"); el.className = "toast" + (bad ? " bad" : ""); el.textContent = msg; $("#toasts").append(el); setTimeout(() => el.remove(), bad ? 7000 : 4000); }
function modal(title, bodyHTML, {yes = t("Confirm"), no = t("Cancel"), onOpen} = {}) {
  return new Promise(res => {
    $("#modalTitle").textContent = title; $("#modalBody").innerHTML = bodyHTML; $("#modalYes").textContent = yes; $("#modalNo").textContent = no || ""; $("#modalNo").hidden = !no;
    const m = $("#modal"); m.hidden = false; onOpen?.($("#modalBody"));
    const done = v => { m.hidden = true; document.removeEventListener("keydown", key); res(v); };
    const key = e => { if (e.key === "Escape") done(false); };
    document.addEventListener("keydown", key);
    $("#modalYes").onclick = () => done(true); $("#modalNo").onclick = () => done(false);
  });
}

/* ---------- Lemonade status ---------- */
const S = {models: [], loaded: [], online: false, info: null, health: null};
async function refreshStatus() {
  try { const h = await getJSON("/health"); S.health = h; S.loaded = h.all_models_loaded || []; S.online = true; $("#status").className = "status ok"; $("#statusText").textContent = t("Private AI on"); }
  catch { S.online = false; S.loaded = []; $("#status").className = "status down"; $("#statusText").textContent = t("AI engine offline"); }
}
async function refreshModels() { try { S.models = (await getJSON("/models?show_all=true")).data || []; } catch { S.models = []; } }
async function refreshInfo() { try { S.info = await getJSON("/system-info"); } catch {} }

/* ---------- icons & art ---------- */
const IC = {
  mood: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>', energy: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  stress: '<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>', sleep: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  steps: '<path d="M7 4c1.7 0 2.6 1.8 2.6 4.3S8.7 12.5 7 12.5 4.4 10.8 4.4 8.3 5.3 4 7 4zM5 14.5h4v1.8a2 2 0 0 1-4 0zM16.5 7.5c1.7 0 2.6 1.8 2.6 4.3s-.9 4.2-2.6 4.2-2.6-1.7-2.6-4.2.9-4.3 2.6-4.3zM14.5 18h4v.8a2 2 0 0 1-4 0z"/>',
  bp: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M7 11h3l1-2 2 4 1-2h3"/>', note: '<path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>', check: '<path d="m5 12 4 4 10-10"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  trend: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>', heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
};
const icon = (k, s = 20) => `<svg class="ico" viewBox="0 0 24 24" style="width:${s}px;height:${s}px" aria-hidden="true">${IC[k] || IC.info}</svg>`;
const TINT = {mood: ["#FEF3C7", "#B45309"], energy: ["#FFEDD5", "#C2410C"], stress: ["#FCE7F3", "#BE185D"], sleep: ["#EDE9FE", "#6D28D9"], water: ["#DBEAFE", "#1D4ED8"], steps: ["#DCFCE7", "#15803D"], bp: ["#FFE4E6", "#BE123C"], note: ["#E0F2FE", "#0369A1"]};
const bub = k => { const dark = document.documentElement.dataset.theme === "dark", [bg, fg] = TINT[k]; return `<span class="bub" style="background:${dark ? fg + "33" : bg};color:${dark ? bg : fg}">${icon(k, 19)}</span>`; };
const FACE_COL = ["#EF4444", "#F97316", "#EAB308", "#84CC16", "#22C55E"];
function faceSvg(level, col) {
  const mouth = ["M8 16.5q4-4 8 0", "M8.5 16q3.5-2 7 0", "M8.5 15.5h7", "M8.5 14.5q3.5 2.5 7 0", "M7.5 14q4.5 4.5 9 0"][level - 1];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10" fill="${col}22"/>${level === 1 ? '<path d="M7.5 8.5l2.5 1M16.5 8.5l-2.5 1"/>' : ""}<circle cx="9" cy="10.5" r="1.1" fill="${col}" stroke="none"/><circle cx="15" cy="10.5" r="1.1" fill="${col}" stroke="none"/><path d="${mouth}"/></svg>`;
}
const glassSvg = full => `<svg viewBox="0 0 24 30"><path d="M4 3h16l-2 23a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="${full ? "#BFDBFE" : "none"}" stroke="${full ? "#2563EB" : "var(--border2)"}" stroke-width="1.8" stroke-linejoin="round"/>${full ? '<path d="M5.2 10h13.6l-1.4 16a1.5 1.5 0 0 1-1.5 1.3H8.1a1.5 1.5 0 0 1-1.5-1.3z" fill="#60A5FA"/>' : ""}</svg>`;
function greetArt(h) {
  if (h >= 18 || h < 5) return `<svg viewBox="0 0 260 260"><defs><radialGradient id="mg" cx=".4" cy=".4"><stop offset="0" stop-color="#FEF9C3"/><stop offset="1" stop-color="#FDE68A"/></radialGradient></defs><circle cx="150" cy="120" r="60" fill="url(#mg)"/><g fill="#FDE68A"><circle cx="60" cy="70" r="3"/><circle cx="90" cy="40" r="2"/><circle cx="220" cy="200" r="2.5"/><circle cx="70" cy="190" r="2"/></g></svg>`;
  return `<svg viewBox="0 0 260 260"><defs><radialGradient id="sg"><stop offset="0" stop-color="#FDE68A"/><stop offset="1" stop-color="#FBBF24"/></radialGradient></defs><g stroke="#FBBF24" stroke-width="6" stroke-linecap="round" opacity=".55">${Array.from({length: 12}, (_, i) => { const a = i * Math.PI / 6; return `<line x1="${150 + Math.cos(a) * 78}" y1="${120 + Math.sin(a) * 78}" x2="${150 + Math.cos(a) * 98}" y2="${120 + Math.sin(a) * 98}"/>`; }).join("")}</g><circle cx="150" cy="120" r="58" fill="url(#sg)"/><path d="M40 230c30-40 70-40 100 0" fill="#86EFAC" opacity=".7"/><path d="M110 240c30-30 70-30 110 0" fill="#34D399" opacity=".6"/></svg>`;
}
function confetti() {
  const box = document.createElement("div"); box.className = "confetti"; const cols = ["#14B8A6", "#F59E0B", "#F472B6", "#60A5FA", "#22C55E", "#A78BFA"];
  box.innerHTML = Array.from({length: 70}, () => `<i style="left:${Math.random() * 100}%;background:${cols[Math.floor(Math.random() * cols.length)]};animation-delay:${Math.random() * .5}s;animation-duration:${1.4 + Math.random() * 1.2}s"></i>`).join("");
  document.body.append(box); setTimeout(() => box.remove(), 3200);
}

/* ================= SENSE: check-in ================= */
const SCALES = {
  mood: {label: "Mood", opts: ["Very low", "Low", "Okay", "Good", "Great"], q: "How do you feel?"},
  energy: {label: "Energy", opts: ["Drained", "Low", "Okay", "Good", "High"], q: "How's your energy?"},
  stress: {label: "Stress", opts: ["Calm", "Mild", "Some", "High", "Very high"], q: "How stressed are you?"},
};
const SYMPTOMS = ["Headache", "Poor appetite", "Anxious", "Irritable", "Body aches", "Trouble focusing", "Lonely", "Tired all day"];
const CORE = ["mood", "energy", "stress", "sleep", "water", "steps"];
function renderToday() {
  const h = new Date().getHours(), d = day(today()), g = HD.goals;
  $("#greet").textContent = t(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening") + (HD.card.name ? (AR_() ? "، " : ", ") + HD.card.name.split(" ")[0] : "") + " 👋";
  $("#todayDate").textContent = fmtDate(new Date(), {weekday: "long", day: "numeric", month: "long"});
  $("#greetArt").innerHTML = greetArt(h);
  const doneN = CORE.filter(k => k === "water" ? d.water > 0 : d[k] != null).length;
  $("#progFill").style.width = (doneN / CORE.length * 100) + "%";
  $("#progText").textContent = doneN === CORE.length ? t("Check-in complete — nice work! 🎉") : t("{n} of {m} done", {n: doneN, m: CORE.length});
  const scale = k => { const inv = k === "stress";
    return `<div class="trk ${d[k] ? "done" : ""}"><div class="trk-h"><span class="lab">${bub(k)}${t(SCALES[k].q)}</span><b>${d[k] ? t(SCALES[k].opts[d[k] - 1]) : ""}</b></div>
      <div class="faces" role="radiogroup" aria-label="${t(SCALES[k].label)}">${SCALES[k].opts.map((o, i) => { const lvl = inv ? 5 - i : i + 1, col = FACE_COL[lvl - 1]; return `<button type="button" role="radio" aria-checked="${d[k] === i + 1}" class="face ${d[k] === i + 1 ? "on" : ""}" style="color:${col}" data-scale="${k}:${i + 1}" title="${t(o)}" aria-label="${t(o)}">${faceSvg(lvl, col)}</button>`; }).join("")}</div>
      <div class="scale-l"><span>${t(SCALES[k].opts[0])}</span><span>${t(SCALES[k].opts[4])}</span></div></div>`; };
  const bp = (s, di) => !s || !di ? "" : (s >= 180 || di >= 120) ? `<div class="flag bad">${t("Very high ({v}). With chest pain, breathlessness, weakness or vision changes, call {amb} now. Otherwise re-check in 5 minutes and contact a doctor today.", {v: s + "/" + di, amb: R().amb})}</div>` : (s >= 140 || di >= 90) ? `<div class="flag warn">${t("Above the usual target (under 140/90). If it stays high, see a doctor.")}</div>` : (s < 90 || di < 60) ? `<div class="flag warn">${t("Low. If dizzy or faint, sit or lie down and seek advice.")}</div>` : `<div class="flag ok">✓ ${t("In the normal range.")}</div>`;
  const sl = d.sleep;
  $("#checkin").innerHTML = scale("mood") + scale("energy") + scale("stress") + `
    <div class="trk ${sl != null ? "done" : ""}"><div class="trk-h"><span class="lab">${bub("sleep")}${t("How long did you sleep?")}</span><b class="mono" style="color:var(--text);font-size:18px">${t("{v} h", {v: sl ?? "–"})}</b></div><input type="range" min="0" max="12" step="0.5" value="${sl ?? 7}" data-set="sleep" aria-label="${t("Hours of sleep")}"><div class="scale-l"><span>${t("{v} h", {v: 0})}</span><span>${sl == null ? t("Slide to set") : sl >= 7 && sl <= 9 ? "😴 " + t("Great amount") : sl < 7 ? t("A bit short") : t("Plenty")}</span><span>${t("{v} h", {v: 12})}</span></div></div>
    <div class="trk ${d.water ? "done" : ""}"><div class="trk-h"><span class="lab">${bub("water")}${t("Water today")}</span><b class="mono" style="color:var(--text)">${d.water || 0}/${g.water}</b></div><div class="glasses" role="group" aria-label="${t("Glasses of water")}">${Array.from({length: Math.max(g.water, d.water || 0)}, (_, i) => `<button type="button" class="glass" data-glass="${i + 1}" aria-label="${t("{n} glasses", {n: i + 1})}">${glassSvg(i < (d.water || 0))}</button>`).join("")}</div><div class="scale-l"><span>${t("Tap a glass to fill up to it")}</span><span>${(d.water || 0) >= g.water ? "💧 " + t("Goal reached!") : ""}</span></div></div>
    <div class="trk ${d.steps != null ? "done" : ""}"><div class="trk-h"><span class="lab">${bub("steps")}${t("Steps today")}</span><b class="mono" style="color:var(--text)">${(d.steps || 0).toLocaleString()}</b></div><div class="bar"><div class="bar-fill" style="width:${Math.min(100, (d.steps || 0) / g.steps * 100)}%"></div></div><div class="acts"><input type="number" min="0" step="100" value="${d.steps ?? ""}" placeholder="${t("Type steps")}" data-set="steps" class="inp" style="flex:1" aria-label="${t("Steps today")}"><button class="btn-ghost sm" type="button" data-addsteps="1000">+1k</button></div><div class="scale-l"><span>${t("Goal {n}", {n: g.steps.toLocaleString()})}</span><span>${(d.steps || 0) >= g.steps ? "🎯 " + t("Goal reached!") : ""}</span></div></div>
    <div class="trk ${d.sys ? "done" : ""}"><div class="trk-h"><span class="lab">${bub("bp")}${t("Blood pressure")} <span class="muted small" style="font-weight:500">${t("optional")}</span></span><b class="mono" style="color:var(--text)">${d.sys ? d.sys + "/" + (d.dia ?? "–") : ""}</b></div><div class="acts"><input type="number" min="50" max="260" value="${d.sys ?? ""}" placeholder="${t("Top")}" data-set="sys" class="inp half" aria-label="${t("Systolic, top number")}"><span class="muted">/</span><input type="number" min="30" max="160" value="${d.dia ?? ""}" placeholder="${t("Bottom")}" data-set="dia" class="inp half" aria-label="${t("Diastolic, bottom number")}"></div>${bp(d.sys, d.dia)}</div>
    <div class="trk wide"><div class="trk-h"><span class="lab">${bub("note")}${t("Anything bothering you today?")}</span></div><div class="tags">${SYMPTOMS.map(s => `<button type="button" class="tagb ${(d.sym || []).includes(s) ? "on" : ""}" data-sym="${s}" aria-pressed="${(d.sym || []).includes(s)}">${t(s)}</button>`).join("")}</div><textarea class="inp" rows="2" data-set="note" placeholder="${t("Notes (optional) — e.g. busy week, exams, travelling")}">${esc(d.note || "")}</textarea></div>`;
  const C = $("#checkin"), after = () => { save(); const was = d._celebrated; renderToday(); if (!was && CORE.every(k => k === "water" ? d.water > 0 : d[k] != null)) { d._celebrated = 1; save(); confetti(); toast(t("Check-in complete — see you tomorrow! 🌿")); } };
  C.querySelectorAll("[data-scale]").forEach(b => b.onclick = () => { const [k, v] = b.dataset.scale.split(":"); d[k] = +v; after(); });
  C.querySelectorAll("[data-glass]").forEach(b => b.onclick = () => { const n = +b.dataset.glass; d.water = d.water === n ? n - 1 : n; after(); });
  C.querySelectorAll("[data-addsteps]").forEach(b => b.onclick = () => { d.steps = (d.steps || 0) + 1000; after(); });
  C.querySelectorAll("[data-sym]").forEach(b => b.onclick = () => { const s = new Set(d.sym || []); s.has(b.dataset.sym) ? s.delete(b.dataset.sym) : s.add(b.dataset.sym); d.sym = [...s]; after(); });
  C.querySelectorAll("[data-set]").forEach(i => { i.onchange = () => { const f = i.dataset.set; d[f] = f === "note" ? i.value.trim() : i.value === "" ? undefined : +i.value; after(); }; if (i.type === "range") i.oninput = () => { i.closest(".trk").querySelector(".trk-h b").textContent = t("{v} h", {v: i.value}); }; });
  let s = 0; for (const k of lastDays(400).reverse()) { if (filled(HD.log[k])) s++; else if (k !== today()) break; }
  $("#streak").textContent = s ? "🔥 " + t("{n}-day streak", {n: s}) : "🌱 " + t("Start your streak today");
  renderHabits(); renderScore(); renderSigList($("#todaySignals"), computeSignals().slice(0, 4));
  const last = HD.screens[HD.screens.length - 1], due = !last || (Date.now() - new Date(last.date)) / 864e5 >= 7;
  $("#mindDue").innerHTML = due ? `<div class="mind-cta"><span class="bub" style="width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">${icon("brain", 22)}</span><div style="flex:1"><div style="font-weight:700">${t("Weekly mind check is due")}</div><div class="muted small">${t("4 quick questions · about 1 minute")}</div></div><button class="btn-primary" style="height:38px" type="button" id="mindNow">${t("Start")}</button></div>` : "";
  $("#mindNow")?.addEventListener("click", mindCheck);
}

/* ---------- wellbeing index ---------- */
function dayScore(e) {
  if (!e) return null; const p = [];
  if (e.mood) p.push((e.mood - 1) / 4 * 100); if (e.energy) p.push((e.energy - 1) / 4 * 100); if (e.stress) p.push((5 - e.stress) / 4 * 100);
  if (e.sleep != null) { const dist = e.sleep < 7 ? 7 - e.sleep : e.sleep > 9 ? e.sleep - 9 : 0; p.push(Math.max(0, 100 - dist * 25)); }
  if (e.steps != null) p.push(Math.min(1, e.steps / HD.goals.steps) * 100); if (e.water != null) p.push(Math.min(1, e.water / HD.goals.water) * 100);
  return p.length >= 2 ? Math.round(mean(p)) : null;
}
function renderScore() {
  const tv = dayScore(HD.log[today()]), wk = mean(lastDays(8).slice(0, 7).map(k => dayScore(HD.log[k])).filter(v => v != null));
  const delta = tv != null && wk != null ? tv - Math.round(wk) : null;
  const col = tv == null ? "var(--dim)" : tv >= 70 ? "#16A34A" : tv >= 45 ? "#F59E0B" : "#EF4444";
  const word = t(tv == null ? "Check in to see it" : tv >= 80 ? "Doing great" : tv >= 65 ? "Doing well" : tv >= 45 ? "Okay — go gently" : "Needs some care");
  const Rr = 50, C = 2 * Math.PI * Rr;
  $("#scoreCard").innerHTML = `<div class="ring"><svg width="118" height="118" viewBox="0 0 118 118"><circle cx="59" cy="59" r="${Rr}" fill="none" stroke="var(--raise)" stroke-width="11"/><circle class="prog-c" cx="59" cy="59" r="${Rr}" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><div class="val"><b>${tv ?? "–"}</b><span>${t("of 100")}</span></div></div>
    <div class="ring-meta"><span class="muted small" style="font-weight:700;letter-spacing:.06em;text-transform:uppercase">${t("Wellbeing today")}</span><span class="mood-word" style="color:${col}">${word}</span><span class="muted small">${t("7-day average:")} <b style="color:var(--text)">${wk != null ? Math.round(wk) : "–"}</b></span>${delta != null ? `<span class="small ${delta >= 0 ? "up" : "down"}" style="font-weight:700">${delta >= 0 ? "▲" : "▼"} ${t("{n} vs your week", {n: Math.abs(delta)})}</span>` : ""}</div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => { const c = $("#scoreCard .prog-c"); if (c) c.style.strokeDashoffset = C * (1 - (tv || 0) / 100); }));
}

/* ================= HABITS (healthy-habits challenge statement) ================= */
const HABITS = {
  sleep7: {label: "Sleep 7+ hours", ic: "sleep", auto: d => d.sleep != null ? d.sleep >= 7 : null},
  water8: {label: "Drink 8 glasses of water", ic: "water", auto: d => d.water != null ? d.water >= HD.goals.water : null},
  steps: {label: "Walk 7,000 steps", ic: "steps", auto: d => d.steps != null ? d.steps >= HD.goals.steps : null},
  walk10: {label: "10-minute walk after a meal", ic: "steps"},
  screens: {label: "Screens off 30 min before bed", ic: "sleep"},
  breathe: {label: "3 minutes of slow breathing", ic: "stress"},
  fruitveg: {label: "5 portions of fruit and vegetables", ic: "heart"},
  nosugar: {label: "No sugary drinks today", ic: "water"},
};
HD.habits ||= [];
const habitDone = (k, h) => { const d = HD.log[k]; if (!d) return false; const H = HABITS[h]; if (H.auto) { const v = H.auto(d); if (v != null) return v; } return !!d.hab?.[h]; };
function habitStats(h, endAgo = 0) { const keys = Array.from({length: 7}, (_, i) => ago(endAgo + 6 - i)); return {done: keys.filter(k => habitDone(k, h)).length, keys}; }
function renderHabits() {
  const box = $("#habits"), d = day(today());
  if (!HD.habits.length) { box.innerHTML = `<div class="hab-empty">${t("No habits chosen yet. Pick a few small ones — they're the easiest way to stay well.")}</div>`; $("#habSummary").textContent = ""; return; }
  let tot = 0, hit = 0;
  box.innerHTML = HD.habits.map(h => {
    const H = HABITS[h]; if (!H) return ""; const st = habitStats(h), auto = H.auto && H.auto(d) != null, doneToday = habitDone(today(), h);
    tot += 7; hit += st.done;
    const dots = st.keys.map(k => `<span class="hdot ${habitDone(k, h) ? "on" : ""}" title="${fmtDate(k, {weekday: "short"})}"></span>`).join("");
    const btn = H.auto ? `<span class="hab-auto ${doneToday ? "on" : ""}">${doneToday ? "✓ " : ""}${t("Auto")}</span>` : `<button type="button" class="hab-btn ${doneToday ? "on" : ""}" data-hab="${h}" aria-pressed="${doneToday}">${doneToday ? "✓ " + t("Done today") : t("Mark done")}</button>`;
    return `<div class="hab ${doneToday ? "done" : ""}"><span class="hab-ic">${icon(H.ic, 18)}</span><div class="hab-main"><b>${t(H.label)}</b><div class="hdots" dir="ltr">${dots}</div></div><span class="muted small hab-count">${t("{a} of 7 days", {a: st.done})}</span>${btn}</div>`;
  }).join("");
  $("#habSummary").textContent = t("This week: {p}% of habit goals met", {p: Math.round(hit / Math.max(1, tot) * 100)});
  box.querySelectorAll("[data-hab]").forEach(b => b.onclick = () => { d.hab = d.hab || {}; d.hab[b.dataset.hab] = d.hab[b.dataset.hab] ? 0 : 1; save(); renderHabits(); renderScore(); renderSigList($("#todaySignals"), computeSignals().slice(0, 4)); });
}
async function chooseHabits() {
  const sel = new Set(HD.habits);
  const ok = await modal(t("Choose up to 4 habits"), `<div class="hab-pick">${Object.entries(HABITS).map(([k, H]) => `<button type="button" class="hab-opt ${sel.has(k) ? "on" : ""}" data-pick="${k}">${icon(H.ic, 18)}<span>${t(H.label)}</span>${H.auto ? `<span class="pill">${t("Auto")}</span>` : ""}</button>`).join("")}</div>`,
    {yes: t("Save"), onOpen: body => body.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { const k = b.dataset.pick; if (sel.has(k)) sel.delete(k); else if (sel.size < 4) sel.add(k); else return toast(t("You can pick up to 4.")); b.classList.toggle("on", sel.has(k)); })});
  if (!ok) return; HD.habits = [...sel]; save(); renderToday();
}
function habitSignals() {
  const out = [];
  for (const h of HD.habits) {
    if (!HABITS[h]) continue;
    const now = habitStats(h).done, prev = habitStats(h, 7).done, last3 = [0, 1, 2].filter(i => habitDone(ago(i), h)).length;
    const prevDays = Array.from({length: 7}, (_, i) => ago(7 + i)).filter(k => filled(HD.log[k])).length;
    if (prevDays >= 4 && now <= prev - 2 && last3 === 0) out.push({level: "watch", m: HABITS[h].ic, t: t("Habit slipping: {h}", {h: t(HABITS[h].label)}), d: t("Done on {a} of the last 7 days, down from {b} the week before — and not in the last 3 days.", {a: now, b: prev}), a: t("Restart small: do it once today, at the same time as something you already do (like after lunch)."), score: 1.2});
    else if (now >= 6) out.push({level: "good", m: HABITS[h].ic, t: t("On a roll: {h}", {h: t(HABITS[h].label)}), d: t("Done on {a} of the last 7 days. Habits like this protect you when life gets busy.", {a: now}), score: 0});
  }
  return out;
}

/* ================= PREDICT: early signals ================= */
const FLOOR = {sleep: .3, mood: .35, energy: .35, stress: .35, steps: .06, water: .6, sys: 3};
const METRICS = {
  sleep: {name: "Sleep", dir: 1, thr: 0.75, f: v => t("{v} h", {v: v.toFixed(1)}), worse: "Sleeping less than usual", better: "Sleeping more than usual", tip: "Keep the same bedtime tonight, dim screens 30 minutes before, and avoid tea or coffee after 4 pm."},
  mood: {name: "Mood", dir: 1, thr: 0.7, df: v => t("{v} points", {v: v.toFixed(1)}), f: v => `${t(SCALES.mood.opts[Math.round(v) - 1])} (${v.toFixed(1)}/5)`, worse: "Mood is lower than usual", better: "Mood is up", tip: "Plan one small thing you enjoy today, and get some daylight or a short walk."},
  energy: {name: "Energy", dir: 1, thr: 0.7, df: v => t("{v} points", {v: v.toFixed(1)}), f: v => v.toFixed(1) + "/5", worse: "Energy is dipping", better: "More energy than usual", tip: "Check sleep, water and meals first. Short breaks every hour help."},
  stress: {name: "Stress", dir: -1, thr: 0.7, df: v => t("{v} points", {v: v.toFixed(1)}), f: v => v.toFixed(1) + "/5", worse: "Stress is rising", better: "Stress has eased", tip: "Try 4-7-8 breathing (in 4, hold 7, out 8) three times, and write down the one thing worrying you most."},
  steps: {name: "Activity", dir: 1, pct: 0.3, f: v => t("{v} steps", {v: Math.round(v).toLocaleString()}), worse: "Moving less than usual", better: "Moving more", tip: "Add a 10-minute walk after a meal — cooler early morning or evening in hot weather."},
  water: {name: "Water", dir: 1, pct: 0.3, f: v => t("{v} glasses", {v: v.toFixed(1)}), worse: "Drinking less water", better: "Drinking more water", tip: "Keep a bottle in sight and drink a glass with each meal; more on hot days."},
  sys: {name: "Blood pressure", dir: -1, thr: 10, df: v => Math.round(v) + " mmHg", f: v => t("{v} (top number)", {v: Math.round(v)}), worse: "Blood pressure is above your usual", better: "Blood pressure is lower than your usual", tip: "Re-check at rest. If it stays at 140/90 or above, see a doctor."},
};
function computeSignals() {
  const sig = [], recentK = lastDays(3), baseK = Array.from({length: 14}, (_, i) => ago(i + 3)).reverse(), cr = R().crisis;
  const vals = (keys, m) => keys.map(k => HD.log[k]?.[m]).filter(v => v != null && v !== "");
  const baseDays = baseK.filter(k => filled(HD.log[k])).length;
  if (baseDays < 5) sig.push({level: "info", t: t("Learning your normal"), d: t("WellSense needs about 5 days of check-ins to learn your baseline. {n} more to go — or load demo data on the About page.", {n: Math.max(0, 5 - baseDays)})});
  const moved = {};
  if (baseDays >= 5) for (const [m, c] of Object.entries(METRICS)) {
    const b = vals(baseK, m), r = vals(recentK, m); if (b.length < 4 || r.length < 2) continue;
    const bm = mean(b), rm = mean(r), delta = rm - bm, change = c.pct ? (bm > 0 ? delta / bm : 0) : delta, thr = c.pct ?? c.thr;
    // variability-aware: the change must be beyond this person's normal day-to-day swings (z <= -2) and big enough to matter
    const method = window.SIG_METHOD || "hybrid", robust = window.SIG_ROBUST ?? false;
    const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
    const center = robust && method !== "fixed" ? med(b) : bm, spread = robust && method !== "fixed" ? 1.4826 * med(b.map(v => Math.abs(v - center))) : Math.sqrt(mean(b.map(v => (v - bm) ** 2)));
    const sd = Math.max(spread, FLOOR[m] * (c.pct ? bm : 1)), dz = rm - center, z = dz / (sd * Math.sqrt(1 / r.length + 1 / b.length));
    const chg = method === "fixed" ? change : (c.pct ? (center > 0 ? dz / center : 0) : dz);
    const Z = window.SIG_Z ?? 0.8, MINF = window.SIG_MINF ?? 1.15, PERS = window.SIG_PERSIST ?? 0; // tuned on 400 simulated users (see eval_results.js)
    const persistW = r.filter(v => c.dir * (v - center) < -0.5 * sd).length, persistB = r.filter(v => c.dir * (v - center) > 0.5 * sd).length;
    // fixed: big enough to matter. hybrid (WellSense): big enough to matter AND beyond this person's usual swings AND on most recent days
    const isWorse = method === "fixed" ? c.dir * chg <= -thr : (c.dir * chg <= -thr * MINF && c.dir * z <= -Z && persistW >= Math.min(PERS, r.length));
    const isBetter = method === "fixed" ? c.dir * chg >= thr : (c.dir * chg >= thr * MINF && c.dir * z >= Z && persistB >= Math.min(PERS, r.length));
    if (isWorse) {
      moved[m] = "worse";
      const dirW = t(delta < 0 ? "lower" : "higher"), amount = c.pct ? `${Math.round(Math.abs(change) * 100)}% ${dirW}` : `${(c.df || c.f)(Math.abs(delta))} ${dirW}`;
      sig.push({level: m === "sys" && rm >= 140 ? "act" : "watch", m, t: t(c.worse), d: t("Last 3 days: {r}. Your normal: {b} — {amt}.", {r: c.f(rm), b: c.f(bm), amt: amount}), a: t(c.tip), score: Math.abs(change / thr)});
    } else if (isBetter) { moved[m] = "better"; sig.push({level: "good", m, t: t(c.better), d: t("Last 3 days: {r}, compared with your normal of {b}. Keep it up.", {r: c.f(rm), b: c.f(bm)}), score: 0}); }
  }
  const trio = ["sleep", "stress", "mood", "energy"].filter(m => moved[m] === "worse");
  if (trio.length >= 3) sig.unshift({level: "act", t: t("Several signals are moving together"), d: t("{list} have all worsened over the last 3 days. Together these are an early sign of building stress, burnout or low mood.", {list: listJoin(trio.map(m => t(METRICS[m].name)))}), a: t("Talk it through with the Coach, ease your load this week, and reach out to someone you trust. If you feel unsafe, use Safety."), score: 99});
  const lowDays = lastDays(7).map(k => HD.log[k]).filter(e => e?.mood && e.mood <= 2).length;
  if (lowDays >= 4) sig.unshift({level: "act", t: t("Low mood on several days"), d: t("You've logged low mood on {n} of the last 7 days.", {n: lowDays}), a: t("Consider talking to a doctor or counsellor. {name} is {note}: {num}.", {name: L(cr.name), note: L(cr.note).split(" (")[0], num: cr.num}), score: 98});
  const short = recentK.map(k => HD.log[k]?.sleep).filter(v => v != null);
  if (short.length === 3 && short.every(v => v < 6) && !sig.some(s => s.m === "sleep")) sig.push({level: "watch", m: "sleep", t: t("Short sleep three nights running"), d: t("Under 6 hours each of the last 3 nights ({list}).", {list: listJoin(short.map(v => t("{v} h", {v})))}), a: t(METRICS.sleep.tip), score: 2});
  const symCount = {}; lastDays(5).forEach(k => (HD.log[k]?.sym || []).forEach(s => symCount[s] = (symCount[s] || 0) + 1));
  Object.entries(symCount).filter(([, n]) => n >= 3).forEach(([s, n]) => sig.push({level: "watch", t: t("{s} on {n} of the last 5 days", {s: t(s), n}), d: t("A repeating symptom is worth noticing."), a: t(s === "Headache" ? "Drink water, rest your eyes from screens, and see a doctor if headaches keep coming back, are severe, or come with fever, stiff neck or vision changes." : "If it continues for more than two weeks or affects daily life, talk to a doctor."), score: 1.5}));
  const td = HD.log[today()]; if (td?.sys >= 180 || td?.dia >= 120) sig.unshift({level: "act", t: t("Very high blood pressure today"), d: `${td.sys}/${td.dia}.`, a: t("With chest pain, breathlessness, weakness or vision changes call {amb} now. Otherwise re-check in 5 minutes and contact a doctor today.", {amb: R().amb}), score: 100});
  const sc = HD.screens.filter(x => (Date.now() - new Date(x.date)) / 864e5 <= 14).pop();
  if (sc) { const p = sc.phq[0] + sc.phq[1], gg = sc.gad[0] + sc.gad[1];
    if (p >= 3) sig.unshift({level: "act", t: t("Mind check: mood score is raised"), d: t("PHQ-2 score {n} of 6 (3 or more suggests checking in with a professional).", {n: p}), a: t("This isn't a diagnosis. A doctor or counsellor can help — {name}: {num}.", {name: L(cr.name), num: cr.num}), score: 97});
    if (gg >= 3) sig.unshift({level: "act", t: t("Mind check: anxiety score is raised"), d: t("GAD-2 score {n} of 6 (3 or more suggests checking in with a professional).", {n: gg}), a: t("This isn't a diagnosis. Talking to a doctor or counsellor helps; the Coach can share calming techniques."), score: 96}); }
  sig.push(...habitSignals());
  if (baseDays >= 5 && !sig.some(s => s.level === "watch" || s.level === "act")) sig.push({level: "good", t: t("All steady"), d: t("Nothing has drifted from your normal over the last 3 days."), score: -1});
  const rank = {act: 0, watch: 1, info: 2, good: 3};
  return sig.sort((a, b) => rank[a.level] - rank[b.level] || (b.score || 0) - (a.score || 0));
}
const SIG_IC = {act: "alert", watch: "trend", good: "check", info: "info"};
function renderSigList(box, list) {
  box.innerHTML = list.map(s => `<div class="sig ${s.level}"><span class="ic">${icon(s.m && IC[s.m] && s.level !== "act" ? s.m : SIG_IC[s.level], 19)}</span><div><div class="t">${esc(s.t)}</div><div class="d">${esc(s.d)}</div>${s.a ? `<div class="a">${esc(s.a)}</div>` : ""}</div></div>`).join("") || `<p class="muted small">${t("No signals yet.")}</p>`;
}

/* ---------- charts ---------- */
let RANGE = 14;
function trendChart(keys, m, color, fmt, lo, hi) {
  const W = 460, H = 130, P = 22, bw = (W - P) / keys.length;
  const pts = keys.map((k, i) => [i, m === "score" ? dayScore(HD.log[k]) : HD.log[k]?.[m]]).filter(p => p[1] != null);
  if (pts.length < 2) return `<div class="empty-c muted small">${t("Not enough entries yet")}</div>`;
  const vs = pts.map(p => p[1]); lo = lo ?? Math.min(...vs); hi = hi ?? Math.max(...vs); if (hi === lo) { hi += 1; lo -= 1; }
  const y = v => H - 16 - (v - lo) / (hi - lo) * (H - 30), x = i => P + i * bw + bw / 2;
  const base = Array.from({length: 14}, (_, i) => ago(i + 3)).map(k => m === "score" ? dayScore(HD.log[k]) : HD.log[k]?.[m]).filter(v => v != null);
  const bm = base.length >= 4 ? mean(base) : null;
  const band = `<rect x="${P + (keys.length - 3) * bw}" y="4" width="${bw * 3}" height="${H - 18}" style="fill:var(--accent-soft)" rx="6"/>`;
  const bl = bm != null ? `<line x1="${P}" x2="${W}" y1="${y(bm)}" y2="${y(bm)}" style="stroke:var(--chart-grid)" stroke-dasharray="5 5"/><text x="${W - 2}" y="${y(bm) - 4}" style="fill:var(--muted)" font-size="9" text-anchor="end">${esc(t("normal"))} ${esc(fmt(bm))}</text>` : "";
  const line = `<polyline points="${pts.map(([i, v]) => x(i) + "," + y(v)).join(" ")}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/>`;
  const dots = pts.map(([i, v]) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i >= keys.length - 3 ? 4 : 2.6}" fill="${color}"><title>${keys[i]}: ${esc(fmt(v))}</title></circle>`).join("");
  const lbl = keys.map((k, i) => (i % Math.ceil(keys.length / 7) === 0 || i === keys.length - 1) ? `<text x="${x(i)}" y="${H - 2}" fill="#7F918E" font-size="9" text-anchor="middle">${+k.slice(8)}</text>` : "").join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" dir="ltr" role="img" aria-label="${esc(t(m))}">${band}${bl}${line}${dots}<text x="0" y="12" fill="#7F918E" font-size="9">${esc(fmt(hi))}</text><text x="0" y="${H - 16}" fill="#7F918E" font-size="9">${esc(fmt(lo))}</text>${lbl}</svg>`;
}
function renderSignals() {
  renderSigList($("#allSignals"), computeSignals());
  const k = lastDays(RANGE), box = (title, svg) => `<div class="chartbox"><div class="trk-h"><span>${t(title)}</span></div>${svg}</div>`;
  $("#charts").innerHTML = box("Wellbeing index", trendChart(k, "score", "#14B8A6", v => Math.round(v), 0, 100)) + box("Mood", trendChart(k, "mood", "#EAB308", v => v.toFixed(1), 1, 5)) + box("Stress", trendChart(k, "stress", "#F87171", v => v.toFixed(1), 1, 5)) + box("Energy", trendChart(k, "energy", "#FB923C", v => v.toFixed(1), 1, 5)) + box("Sleep (hours)", trendChart(k, "sleep", "#A78BFA", v => v.toFixed(1) + "h")) + box("Steps", trendChart(k, "steps", "#22C55E", v => Math.round(v / 100) / 10 + "k")) + box("Water (glasses)", trendChart(k, "water", "#60A5FA", v => v.toFixed(0))) + box("Blood pressure (top)", trendChart(k, "sys", "#F472B6", v => Math.round(v)));
  const Hh = HD.screens.slice(-8).reverse();
  $("#mindHist").innerHTML = Hh.length ? `<table class="tbl"><thead><tr><th>${t("Date")}</th><th>${t("Mood (PHQ-2)")}</th><th>${t("Anxiety (GAD-2)")}</th></tr></thead><tbody>${Hh.map(s => { const p = s.phq[0] + s.phq[1], g = s.gad[0] + s.gad[1]; return `<tr><td>${fmtDate(s.date)}</td><td><span class="pill ${p >= 3 ? "warn" : "ok"}">${p} / 6</span></td><td><span class="pill ${g >= 3 ? "warn" : "ok"}">${g} / 6</span></td></tr>`; }).join("")}</tbody></table>` : `<p class="muted small">${t("No mind checks yet.")}</p>`;
}
document.querySelectorAll("#rangePills button").forEach(b => b.onclick = () => { RANGE = +b.dataset.r; document.querySelectorAll("#rangePills button").forEach(x => x.classList.toggle("on", x === b)); renderSignals(); });

/* ---------- weekly mind check (PHQ-2 + GAD-2) ---------- */
const MQ = [["phq", 0, "Little interest or pleasure in doing things"], ["phq", 1, "Feeling down, depressed or hopeless"], ["gad", 0, "Feeling nervous, anxious or on edge"], ["gad", 1, "Not being able to stop or control worrying"]];
const MOPTS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];
async function mindCheck() {
  const ans = {phq: [null, null], gad: [null, null]};
  const ok = await modal(t("Weekly mind check"), `<p style="margin:0 0 6px">${t("Over the <b>last 2 weeks</b>, how often have you been bothered by…")}</p>${MQ.map(([s, i, q]) => `<div class="q"><span class="qt">${t(q)}</span><div class="opts4">${MOPTS.map((o, v) => `<button type="button" data-q="${s}:${i}:${v}">${t(o)}</button>`).join("")}</div></div>`).join("")}<p class="small muted">${t("PHQ-2 and GAD-2 screening questions. Your answers stay on this computer.")}</p>`,
    {yes: t("Save"), onOpen: body => body.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { const [s, i, v] = b.dataset.q.split(":"); ans[s][+i] = +v; b.parentElement.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); })});
  if (!ok) return;
  if ([...ans.phq, ...ans.gad].some(v => v == null)) { toast(t("Please answer all four questions."), true); return mindCheck(); }
  HD.screens.push({date: new Date().toISOString(), ...ans}); save();
  const p = ans.phq[0] + ans.phq[1], g = ans.gad[0] + ans.gad[1], cr = R().crisis;
  const which = t(p >= 3 && g >= 3 ? "low mood and anxiety" : p >= 3 ? "low mood" : "anxiety");
  const msg = (p >= 3 || g >= 3)
    ? `<p>${t("Your answers suggest {which} may be affecting you (mood {p}/6, anxiety {g}/6).", {which, p, g})}</p><p>${t("This is a screening, not a diagnosis — but it's a good moment to talk to a doctor or counsellor.")} <b>${esc(L(cr.name))}</b>: <a href="tel:${cr.tel}">${cr.num}</a> — ${esc(L(cr.note))}.</p><p class="small">${t("If you ever feel unsafe, call {pol} or {amb} straight away.", {pol: R().pol, amb: R().amb})}</p>`
    : `<p>${t("Your scores are in the low range (mood {p}/6, anxiety {g}/6). Keep checking in weekly — WellSense will flag it if this changes.", {p, g})}</p>`;
  await modal(t("Thanks for checking in"), msg, {yes: t("Done"), no: null});
  refreshPage();
}
$("#mindBtn").onclick = mindCheck;
$("#habEdit").onclick = chooseHabits;

/* ================= SUPPORT: coach ================= */
const PREFERRED = ["Qwen3-4B-Instruct-2507-GGUF", "Llama-3.2-3B-Instruct-GGUF", "Phi-4-mini-instruct-GGUF", "Qwen3-1.7B-GGUF"];
function SYS() {
  const r = R(), cr = r.crisis, amb = r.amb2 ? `${r.amb} or ${r.amb2}` : r.amb;
  return `You are WellSense Coach, a warm, practical wellbeing coach that runs privately on the user's own computer. The user is in ${r.name === "UAE" ? "the United Arab Emirates" : "Pakistan"}.
Your job: help the user notice changes in their wellbeing early, keep healthy habits, and take small realistic next steps. Use their check-in data and signals when provided — refer to specific numbers kindly.
Rules:
- You are not a doctor. Give general information and say when to see a doctor. Don't diagnose.
- Emergencies (chest pain, trouble breathing, stroke signs, severe bleeding, unconsciousness, poisoning, severe allergic reaction, heatstroke): START by telling them to call ${amb} (ambulance) now, then brief first-aid steps following NHS / Resuscitation Council UK guidance (e.g. suspected heart attack: sit them down; an adult over 16 who isn't allergic can chew one 300 mg aspirin). In emergencies don't suggest food or drink, apart from that aspirin rule and sips of cool water for an alert person with heatstroke.
- Thoughts of suicide or self-harm: respond warmly, encourage them to contact ${cr.name.en} now (${cr.num}) or someone they trust, and call ${r.pol} or ${r.amb} if in immediate danger. Never discuss methods.
- Medicines: general information only; for doses follow the label or ask a pharmacist or doctor. Never give children's doses.
- Keep replies short: a sentence of empathy, then 3–5 concrete bullet steps.
- ${AR_() ? "Reply in clear Modern Standard Arabic (العربية الفصحى), even if the user writes in English, unless they ask for another language." : "Reply in the language the user writes in (English, Urdu or Arabic)."}`;
}
const AI = {log: [], busy: false};
const chatModels = () => S.models.filter(m => m.downloaded && m.recipe === "llamacpp" && !(m.labels || []).some(l => ["embeddings", "reranking", "classification"].includes(l))).sort((a, b) => (PREFERRED.indexOf(a.id) + 1 || 99) - (PREFERRED.indexOf(b.id) + 1 || 99));
/* This PC's GPU (Quadro P2000, sm_61) can't run llama.cpp's GPU builds, so chat models load on the CPU backend. */
async function ensureLoaded(model, slot) {
  if (S.loaded.some(l => l.model_name === model)) return;
  if (slot) slot.innerHTML = `<span class="spin">${t("Waking up the coach… (10–30 seconds the first time)")}</span>`;
  await postJSON("/load", {model_name: model, llamacpp_backend: "cpu"}); await refreshStatus();
}
async function renderCoach() {
  const list = chatModels(), sel = $("#aiModel"), prev = sel.value;
  sel.innerHTML = list.map(m => `<option value="${esc(m.id)}">${esc(m.id)}</option>`).join("");
  if (list.some(m => m.id === prev)) sel.value = prev;
  const none = !list.length || !S.online;
  $("#aiSetup").hidden = !none;
  document.querySelectorAll("#aiForm textarea, #aiForm button, #aiModel, [data-ask]").forEach(e => e.disabled = none || AI.busy);
  if (!S.online && typeof DEMO_REPLIES !== "undefined") { $("#aiSetup").hidden = false; $("#aiSetup").innerHTML = `<div class="flag ok">${t("Online demo — the coach runs privately on each person's own computer through Lemonade, so it can't run in this browser. Tap a starter to see a real answer recorded on our test laptop.")}</div>`; document.querySelectorAll("#aiForm textarea, #aiForm button, [data-ask]").forEach(e => e.disabled = false); return; }
  if (!S.online) $("#aiSetup").innerHTML = `<div class="flag bad">${t("The local AI engine (Lemonade Server) isn't running. Start Lemonade, and the coach turns on by itself.")}</div>`;
  else if (!list.length) {
    $("#aiSetup").innerHTML = `<div class="flag warn">${t("The coach needs a chat model on this computer. Qwen3-4B-Instruct (2.5 GB) is recommended.")}</div><button class="btn-primary" id="getModel" type="button">${t("Download Qwen3-4B-Instruct")}</button>`;
    $("#getModel").onclick = () => { postJSON("/pull", {model_name: "Qwen3-4B-Instruct-2507-GGUF", stream: false}).catch(() => {}); toast(t("Download started — this takes a few minutes.")); };
  }
}
const SELF_HARM = ["kill myself", "suicide", "suicidal", "end my life", "want to die", "self harm", "self-harm", "hurt myself", "hurting myself", "harm myself", "harming myself", "take my own life", "end it all", "don't want to live", "dont want to live", "cut myself", "no reason to live", "khudkushi", "marna chahta", "marna chahti", "انتحار", "أنتحر", "اقتل نفسي", "أقتل نفسي", "أريد أن أموت", "اريد ان اموت", "إيذاء نفسي", "ايذاء نفسي", "أؤذي نفسي", "انهي حياتي", "أنهي حياتي"];
function redFlag(s) {
  s = s.toLowerCase();
  if (SELF_HARM.some(w => s.includes(w))) return {kind: "mind"};
  const a = AID_EN.find(x => x.urgent && [...x.kw, ...(AID_KW_AR[x.id] || [])].some(w => s.includes(w)));
  if (a) return {kind: "aid", a: AID().find(y => y.id === a.id)};
  if (["can't breathe", "cannot breathe", "vomiting blood", "coughing blood", "لا أستطيع التنفس", "لا يستطيع التنفس", "يتقيأ دم"].some(w => s.includes(w))) return {kind: "aid", a: AID()[0]};
  return null;
}
function bubble(role, html) {
  $("#aiEmpty").hidden = true;
  const d = document.createElement("div"); d.className = role === "user" ? "u" : "b";
  if (role === "user") { d.textContent = html; d.dir = "auto"; } else d.innerHTML = `<div class="av">${icon("heart", 19)}</div><div class="body"><div class="who"><b>${t("Coach")}</b><span class="muted mono small">${esc($("#aiModel").value)}</span></div><div class="slot" dir="auto">${html}</div></div>`;
  $("#aiMsgs").append(d); const sc = $("#aiScroll"); sc.scrollTop = sc.scrollHeight; return d;
}
function context() {
  if (!$("#aiCtx").checked) return "";
  const c = HD.card, out = [];
  const rows = lastDays(7).map(k => { const e = HD.log[k]; if (!filled(e)) return null; const f = []; for (const m of ["mood", "energy", "stress"]) if (e[m]) f.push(`${m} ${SCALES[m].opts[e[m] - 1]}`); if (e.sleep != null) f.push(`sleep ${e.sleep}h`); if (e.steps != null) f.push(`steps ${e.steps}`); if (e.water != null) f.push(`water ${e.water} glasses`); if (e.sys) f.push(`BP ${e.sys}/${e.dia}`); if (e.sym?.length) f.push(`symptoms: ${e.sym.join(", ")}`); if (e.note) f.push(`note: ${e.note}`); return `${k}: ${f.join(", ")}`; }).filter(Boolean);
  if (rows.length) out.push("Check-ins (last 7 days):\n" + rows.join("\n"));
  const was = LANG; LANG = "en"; const sig = computeSignals().filter(s => s.level !== "info"); LANG = was;
  if (sig.length) out.push("WellSense early signals (last 3 days vs personal 14-day baseline):\n" + sig.map(s => `- [${s.level}] ${s.t}: ${s.d}`).join("\n"));
  if (HD.habits.length) out.push("Habits (done in last 7 days / previous 7):\n" + HD.habits.filter(h => HABITS[h]).map(h => `- ${HABITS[h].label}: ${habitStats(h).done}/7 (previous week ${habitStats(h, 7).done}/7)`).join("\n"));
  const sc = HD.screens[HD.screens.length - 1]; if (sc) out.push(`Latest mind check (${sc.date.slice(0, 10)}): PHQ-2 ${sc.phq[0] + sc.phq[1]}/6, GAD-2 ${sc.gad[0] + sc.gad[1]}/6`);
  if (c.allergies) out.push("Allergies: " + c.allergies); if (c.meds) out.push("Regular medicines: " + c.meds); if (c.conditions) out.push("Conditions: " + c.conditions);
  if (c.name) out.push("First name: " + c.name.split(" ")[0]);
  return out.length ? "\n\nThe user has chosen to share their WellSense data:\n" + out.join("\n\n") : "";
}
const telRe = () => new RegExp(`\\b(${[R().amb, R().amb2, R().pol].filter(Boolean).join("|")})\\b`, "g");
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1<i>$2</i>").replace(/^#{1,4} ?(.+)$/gm, "<b>$1</b>").replace(/^\s*[-*] (.+)$/gm, "• $1").replace(telRe(), '<a href="tel:$1">$1</a>');
async function streamChat(messages, slot, onDone) {
  const model = $("#aiModel").value || chatModels()[0]?.id;
  await ensureLoaded(model, slot);
  slot.innerHTML = `<span class="spin">${t("Thinking…")}</span>`;
  const r = await api("/chat/completions", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({model, stream: true, temperature: 0.4, max_tokens: 800, messages})});
  const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "", out = "", started = false; const t0 = performance.now();
  for (;;) {
    const {value, done} = await rd.read(); if (done) break;
    buf += dec.decode(value, {stream: true}); const lines = buf.split("\n"); buf = lines.pop();
    for (const ln of lines) { const s = ln.replace(/^data:\s*/, "").trim(); if (!s || s === "[DONE]") continue;
      try { const dl = JSON.parse(s).choices?.[0]?.delta?.content; if (!dl) continue; if (!started) { slot.innerHTML = `<div class="text md" dir="auto"></div>`; started = true; } out += dl; slot.querySelector(".text").innerHTML = md(out.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim()); const sc = $("#aiScroll"); if (sc && slot.closest("#aiScroll") && sc.scrollHeight - sc.scrollTop - sc.clientHeight < 160) sc.scrollTop = sc.scrollHeight; } catch {} }
  }
  slot.insertAdjacentHTML("beforeend", `<span class="muted small">${t("{s} s · on this computer · general information, not medical advice", {s: ((performance.now() - t0) / 1000).toFixed(0)})}</span>`);
  onDone?.(out); return out;
}
function demoAsk(text) {
  const rec = (typeof DEMO_REPLIES !== "undefined" ? DEMO_REPLIES : {})[text];
  bubble("user", text);
  const slot = bubble("bot", "").querySelector(".slot");
  if (!rec) { slot.innerHTML = `<div class="muted">${t("In this online demo, pick one of the starters above.")}</div>`; return; }
  slot.innerHTML = `<div class="text md" dir="auto">${md(rec.text)}</div><span class="muted small">${t("Recorded answer from the local AI (Qwen3-4B on a 2018 laptop CPU)")} · ${rec.secs} s</span>`;
}
async function ask(text) {
  if (AI.busy || !text) return;
  if (!S.online && typeof DEMO_REPLIES !== "undefined" && !redFlag(text)) return demoAsk(text);
  const f = redFlag(text), r = R(), cr = r.crisis; bubble("user", text);
  if (f) {
    const w = document.createElement("div"); w.className = "emerg-inline";
    w.innerHTML = f.kind === "mind"
      ? `<b>${t("You don't have to go through this alone.")}</b> ${t("If you might act on these thoughts, call {pol} or {amb} now.", {pol: `<a href="tel:${r.pol}">${r.pol}</a>`, amb: `<a href="tel:${r.amb}">${r.amb}</a>`})} ${t("Talk to")} <b>${esc(L(cr.name))}</b>: <a href="tel:${cr.tel}">${cr.num}</a>. <button class="btn-ghost sm" data-go="mind" type="button">${t("What to do")}</button>`
      : `<b>${t("This could be an emergency.")}</b> ${t("Call {amb} now.", {amb: `<a href="tel:${r.amb}">${r.amb}</a>` + (r.amb2 ? ` ${t("or")} <a href="tel:${r.amb2}">${r.amb2}</a>` : "")})} <button class="btn-ghost sm" data-go="${f.a.id}" type="button">${t("First aid:")} ${esc(f.a.t)}</button>`;
    $("#aiMsgs").append(w); w.querySelector("[data-go]").onclick = e => { location.hash = "safety"; setTimeout(() => openAid(e.target.dataset.go), 50); };
  }
  if (!S.online && typeof DEMO_REPLIES !== "undefined") { bubble("bot", `<div class="muted">${t("In this online demo the AI coach is off. Use the emergency numbers and first-aid steps above.")}</div>`); return; }
  AI.log.push({role: "user", content: text});
  const slot = bubble("bot", `<span class="spin">${t("Thinking…")}</span>`).querySelector(".slot");
  AI.busy = true; renderCoach();
  try { await streamChat([{role: "system", content: SYS() + context()}, ...AI.log.slice(-10)], slot, out => AI.log.push({role: "assistant", content: out})); }
  catch (e) { AI.log.pop(); slot.innerHTML = `<div class="err">${t("The coach couldn't answer:")} ${esc(e.message)}</div>`; }
  AI.busy = false; renderCoach();
}
$("#aiForm").onsubmit = e => { e.preventDefault(); const v = $("#aiInput").value.trim(); $("#aiInput").value = ""; ask(v); };
$("#aiInput").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#aiForm").requestSubmit(); } });
document.querySelectorAll("[data-ask]").forEach(b => b.onclick = () => ask(b.textContent.trim()));
$("#aiNew").onclick = () => { AI.log = []; $("#aiMsgs").innerHTML = ""; $("#aiEmpty").hidden = false; };
$("#aiSummaryBtn").onclick = async () => {
  if (!S.online || !chatModels().length) { toast(t("The coach isn't ready — see the Coach page."), true); return; }
  const box = $("#aiSummary"); box.hidden = false; box.className = "ai-summary"; box.innerHTML = `<b>${t("Your week, in brief")}</b><div class="slot" dir="auto"></div>`;
  const btn = $("#aiSummaryBtn"); btn.disabled = true; const ctxOn = $("#aiCtx").checked; $("#aiCtx").checked = true;
  try { await streamChat([{role: "system", content: SYS() + context()}, {role: "user", content: "Write my weekly wellbeing summary: 2 sentences on how my week went using my numbers, then the 3 most useful small actions for next week as bullets. Mention any signal that needs attention first." + (AR_() ? " اكتب الملخص باللغة العربية." : "")}], box.querySelector(".slot")); }
  catch (e) { box.querySelector(".slot").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  $("#aiCtx").checked = ctxOn; btn.disabled = false;
};

/* ================= SAFETY ================= */
let cpr = null;
const AID = () => AR_() ? AID_AR : AID_EN;
function renderSafety() {
  const r = R();
  document.querySelectorAll("#regionPills button").forEach(b => { b.classList.toggle("on", b.dataset.region === HD.region); b.setAttribute("aria-pressed", b.dataset.region === HD.region); });
  $("#numbers").innerHTML = r.numbers.map(([n, nm, s, big]) => `<a class="num ${big ? "num-big" : ""}" href="tel:${n}"><span class="mono n">${n}</span><span><b>${t(nm)}</b><span class="muted small">${t(s)}</span></span></a>`).join("");
  $("#services").innerHTML = r.services.map(([n, nm, s, tel]) => `<a class="num" href="tel:${tel}"><span class="mono n" style="color:var(--accent);font-size:16px;min-width:96px">${n}</span><span><b>${t(nm)}</b><span class="muted small">${t(s)}</span></span></a>`).join("") + (HD.region === "ae" ? `<p class="muted small" style="margin:4px 0 0">${t("Abu Dhabi residents can also book care and see health records in the Department of Health's Sahatna app.")}</p>` : "");
  $("#aidList").innerHTML = AID().map(a => `<button type="button" class="aid-pill ${a.urgent ? "urg" : ""}" data-aid="${a.id}"><b>${a.t}</b><span class="small">${a.tag}</span></button>`).join("");
  $("#aidList").querySelectorAll("[data-aid]").forEach(b => b.onclick = () => openAid(b.dataset.aid));
  if (!cpr) openAid($("#aidCard").dataset.open || "cpr", true);
  const F = [["name", "Full name"], ["blood", "Blood group"], ["allergies", "Allergies"], ["meds", "Regular medicines"], ["conditions", "Medical conditions"], ["contact", "Emergency contact (name & phone)"], ["doctor", "Doctor / hospital"]];
  $("#card").innerHTML = F.map(([k, l]) => `<label class="field"><span>${t(l)}</span><input class="inp" data-card="${k}" value="${esc(HD.card[k] || "")}" autocomplete="off" dir="auto"></label>`).join("");
  $("#card").querySelectorAll("[data-card]").forEach(i => i.oninput = () => { HD.card[i.dataset.card] = i.value.trim(); save(); });
  $("#printCard").onclick = () => { const w = window.open("", "_blank", "width=520,height=660"); if (!w) return toast(t("Allow pop-ups to print the card."), true);
    w.document.write(`<html dir="${AR_() ? "rtl" : "ltr"}"><title>${t("Emergency card")}</title><body style="font-family:Segoe UI,Tahoma,sans-serif;padding:24px"><div style="border:3px solid #c00;border-radius:14px;padding:18px;max-width:420px"><h2 style="margin:0 0 4px;color:#c00">${t("EMERGENCY MEDICAL CARD")}</h2><p style="margin:0 0 12px">${t("In an emergency call")} <b>${L(r.ambText)}</b></p>${F.map(([k, l]) => `<p style="margin:6px 0"><b>${t(l)}:</b> ${esc(HD.card[k] || "—")}</p>`).join("")}</div><script>print()<\/script></body></html>`); w.document.close(); };
}
document.querySelectorAll("#regionPills button").forEach(b => b.onclick = () => { HD.region = b.dataset.region; save(); renderSos(); renderSafety(); toast(t(HD.region === "ae" ? "Showing UAE numbers and services." : "Showing Pakistan numbers and services.")); });
function openAid(id, quiet) {
  const a = AID().find(x => x.id === id); if (!a) return;
  if (cpr) toggleCpr();
  const box = $("#aidCard"); box.dataset.open = id; const r = R();
  document.querySelectorAll(".aid-pill").forEach(b => b.classList.toggle("on", b.dataset.aid === id));
  const note = a.id === "poison" ? L(r.poison) : a.note;
  box.innerHTML = `<div class="row-between" style="flex-wrap:wrap"><h2 class="title">${a.t}</h2>${a.urgent ? `<a class="btn-call" href="tel:${r.amb}">${t("Call {n}", {n: r.amb})}</a>` : ""}</div><p class="aid-when">${a.when}</p><ol class="steps">${a.steps.map(s => `<li>${fill(s)}</li>`).join("")}</ol>${a.dont ? `<div class="aid-dont"><b>${t("Don't")}</b><ul>${a.dont.map(s => `<li>${fill(s)}</li>`).join("")}</ul></div>` : ""}${note ? `<p class="muted small" style="margin:0">${fill(note)}</p>` : ""}${a.cpr ? `<div class="cpr"><button type="button" class="btn-primary" id="cprBtn">${t("Start CPR beat · 110/min")}</button><div class="cpr-ring" id="cprRing"><span class="mono" id="cprCount">0</span><span class="small muted">${t("compressions")}</span></div><div class="small muted" id="cprTime">${t("Push on every beat.")}</div></div>` : ""}`;
  if (a.cpr) $("#cprBtn").onclick = toggleCpr;
  if (!quiet) box.scrollIntoView({behavior: "smooth", block: "start"});
}
function toggleCpr() {
  if (cpr) { clearInterval(cpr.id); cpr.ctx.close(); cpr = null; const b = $("#cprBtn"); if (b) b.textContent = t("Start CPR beat · 110/min"); return; }
  const ctx = new AudioContext(), t0 = Date.now(); let n = 0;
  cpr = {ctx, id: setInterval(() => {
    const ring = $("#cprRing"); if (!ring || $("#page-safety").hidden) return toggleCpr();
    n++; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = n % 30 === 0 ? 1100 : 880; g.gain.setValueAtTime(.4, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .08); o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .09);
    ring.classList.remove("beat"); void ring.offsetWidth; ring.classList.add("beat"); $("#cprCount").textContent = n;
    const s = Math.floor((Date.now() - t0) / 1000); $("#cprTime").textContent = t("Push on every beat.") + ` ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` + (s >= 120 && s % 120 < 10 ? " — " + t("swap rescuers if you can") : "");
  }, 60000 / 110)};
  $("#cprBtn").textContent = t("Stop beat");
}

/* ================= ABOUT ================= */
function renderEval() {
  const E = typeof EVAL_RESULTS !== "undefined" ? EVAL_RESULTS : null, box = $("#evalBox"); if (!box) return;
  if (!E) { box.innerHTML = `<p class="muted small">${t("Evaluation results will appear here.")}</p>`; return; }
  const a = E.adaptive, f = E.fixed, pct = v => Math.round(v * 100) + "%";
  box.innerHTML = `<div class="eval-tiles"><div class="tile"><b>${pct(a.sens[3])}</b><span>${t("drifts caught within 3 days")}</span></div><div class="tile"><b>${pct(a.fa)}</b><span>${t("false alarms on stable users")}</span></div><div class="tile"><b>${t("{n} days", {n: a.median})}</b><span>${t("median time to first signal")}</span></div><div class="tile"><b>${pct(E.safety.sens)}</b><span>${t("emergency phrases caught (EN + AR)")}</span></div></div>
   <table class="tbl"><thead><tr><th>${t("Days since change began")}</th>${[1, 2, 3, 4, 5].map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody><tr><td>${t("Adaptive thresholds (WellSense)")}</td>${[1, 2, 3, 4, 5].map(d => `<td>${pct(a.sens[d])}</td>`).join("")}</tr><tr><td>${t("Fixed thresholds (baseline method)")}</td>${[1, 2, 3, 4, 5].map(d => `<td>${pct(f.sens[d])}</td>`).join("")}</tr></tbody></table>
   <p class="muted small" style="margin:0">${t("{n} simulated users ({d} with a gradual change in sleep, mood, stress, energy, activity or water; {s} stable). False alarms: adaptive {fa1} vs fixed {fa2}. Safety test: {p} emergency phrases and {q} everyday phrases; {spec} of everyday phrases correctly left alone. Synthetic data only — not a clinical validation.", {n: E.n, d: E.nDrift, s: E.nStable, fa1: pct(a.fa), fa2: pct(f.fa), p: E.safety.pos, q: E.safety.neg, spec: pct(E.safety.spec)})}</p>`;
}
function renderAbout() {
  renderEval();
  const I = S.info || {}, gpu = I.devices?.nvidia_gpu?.[0]?.name || I.devices?.amd_gpu?.[0]?.name, model = chatModels()[0]?.id || t("not installed yet");
  $("#techKv").innerHTML = [["Sense", t("Daily check-in (mood, energy, stress, sleep, water, steps, optional blood pressure, symptoms) and weekly PHQ-2 / GAD-2")], ["Predict", t("Personal baseline: last 3 days vs the 14 days before, per measure, plus combined-pattern and repeated-symptom rules. Fully explainable.")], ["Support", t("Local AI coach ({m}) with emergency and crisis safeguards", {m: model})], ["Languages", t("English and Arabic (right-to-left); the coach can also reply in Urdu")], ["Regions", t("Pakistan and UAE emergency numbers, first aid and support lines")], ["AI engine", t("Lemonade Server {v} on this computer — {s}", {v: S.health?.version || "", s: t(S.online ? "running" : "offline")})], ["Runs on", `${(I.Processor || t("this computer's processor")).replace(/\(R\)|\(TM\)/g, "")}${gpu ? " · " + gpu : ""}`], ["Data", t("Stored only in this browser on this device. No account, no cloud, nothing uploaded.")]]
    .map(([k, v]) => `<dt>${t(k)}</dt><dd>${esc(v)}</dd>`).join("");
}
$("#demoBtn").onclick = async () => {
  if (Object.keys(HD.log).some(k => filled(HD.log[k])) && !await modal(t("Load demo data?"), `<p>${t("This replaces your current check-ins with 4 weeks of sample data that shows how early signals work. Your emergency card is kept.")}</p>`, {yes: t("Load demo")})) return;
  HD.log = {}; let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 27; i >= 0; i--) {
    const k = ago(i), late = i <= 2, mid = i === 3;
    HD.log[k] = late ? {mood: i === 0 ? 2 : 3 - (i % 2), energy: 2, stress: 4 + (i === 0 ? 1 : 0), sleep: [5.5, 5, 5.5][i], water: 4 + (i % 2), steps: 3200 + Math.round(rnd() * 900), sys: 128 + i, dia: 84, sym: i <= 1 ? ["Headache", "Trouble focusing"] : ["Headache"], note: i === 0 ? (AR_() ? "أسبوع مواعيد تسليم، أسهر لوقت متأخر" : "Deadline week, staying up late") : ""}
      : {mood: Math.min(5, 4 + (rnd() > .7 ? 1 : 0) - (rnd() > .85 ? 1 : 0)), energy: 4 - (rnd() > .75 ? 1 : 0), stress: 2 + (rnd() > .7 ? 1 : 0), sleep: Math.round((7 + rnd() * 1) * 2) / 2 - (mid ? 0.5 : 0), water: 7 + Math.round(rnd() * 2), steps: 6200 + Math.round(rnd() * 2600), sys: 116 + Math.round(rnd() * 8), dia: 76 + Math.round(rnd() * 5)};
  }
  for (let i = 27; i >= 0; i--) { const e = HD.log[ago(i)]; e.hab = i <= 2 ? {walk10: 0, screens: 0} : {walk10: rnd() > .15 ? 1 : 0, screens: rnd() > .25 ? 1 : 0}; }
  HD.habits = ["sleep7", "water8", "walk10", "screens"];
  const d = new Date(); d.setDate(d.getDate() - 8); HD.screens = [{date: d.toISOString(), phq: [0, 1], gad: [1, 0]}];
  save(); toast(t("Demo data loaded — see Today and Signals.")); location.hash = "today";
};
$("#exportBtn").onclick = () => {
  const cols = ["date", "mood", "energy", "stress", "sleep", "water", "steps", "sys", "dia", "sym", "note"];
  const rows = Object.keys(HD.log).sort().filter(k => filled(HD.log[k])).map(k => [k, ...cols.slice(1).map(c => { const v = HD.log[k][c]; return Array.isArray(v) ? v.join("; ") : v ?? ""; })]);
  const csv = "﻿" + [cols, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type: "text/csv"})); a.download = "wellsense-data.csv"; a.click();
};
$("#clearBtn").onclick = async () => { if (!await modal(t("Delete all your data?"), `<p>${t("This removes every check-in, mind check and your emergency card from this computer. It can't be undone.")}</p>`, {yes: t("Delete everything")})) return; HD.log = {}; HD.card = {}; HD.screens = []; save(); toast(t("All data deleted.")); refreshPage(); };

/* ---------- theme ---------- */
function setTheme(th) { document.documentElement.dataset.theme = th; try { localStorage.setItem("ws.theme", th); } catch {} $("#themeBtn").innerHTML = icon(th === "dark" ? "sun" : "moon", 18); refreshPage(); }
$("#themeBtn").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
$("#themeBtn").innerHTML = icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon", 18);
$("#langBtn").onclick = () => setLang(AR_() ? "en" : "ar");

/* ---------- router & boot ---------- */
const PAGES = ["today", "signals", "coach", "safety", "about"];
const current = () => { const r = location.hash.slice(1); return PAGES.includes(r) ? r : "today"; };
function refreshPage() { const p = current(); if (p === "today") renderToday(); if (p === "signals") renderSignals(); if (p === "coach") renderCoach(); if (p === "safety") renderSafety(); if (p === "about") renderAbout(); }
function route() {
  const p = current();
  PAGES.forEach(x => $("#page-" + x).hidden = x !== p);
  document.querySelectorAll(".top .seg a").forEach(a => a.classList.toggle("on", a.dataset.route === p));
  window.scrollTo(0, 0); refreshPage();
}
addEventListener("hashchange", route);
captureStatic(); setLang(LANG); route();
(async () => { await refreshStatus(); await refreshModels(); await refreshInfo(); if (["coach", "about"].includes(current())) refreshPage(); })();
setInterval(async () => { await refreshStatus(); if (current() === "coach" && !AI.busy) { if (!chatModels().length) await refreshModels(); renderCoach(); } }, 8000);
