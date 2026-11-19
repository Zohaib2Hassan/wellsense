window.runEval = function () {
  const save0 = {log: HD.log, screens: HD.screens, habits: HD.habits}, lang0 = LANG; LANG = "en";
  let seed = 20261120; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const U = (a, b) => a + (b - a) * rnd(), N = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const METR = ["sleep", "mood", "energy", "stress", "steps", "water"];
  function person(drift) {
    const p = {sleep: [U(6.3, 8.3), U(.3, .9)], mood: [U(3, 4.5), U(.3, .8)], energy: [U(3, 4.5), U(.3, .8)], stress: [U(1.5, 3), U(.3, .8)], steps: [U(4000, 10000), U(.1, .25)], water: [U(5, 9), U(.7, 1.5)], sys: [U(110, 135), U(3, 7)]};
    const dm = drift ? [...METR].sort(() => rnd() - .5).slice(0, rnd() < .5 ? 1 : 2) : [];
    const mag = {sleep: -U(1, 2), mood: -U(1, 1.6), energy: -U(1, 1.6), stress: U(1, 1.8), steps: -U(.35, .55), water: -U(.35, .55)};
    return {p, dm, mag};
  }
  function series(P, T) { // T = days since the change began (drifted days are the last T days)
    const log = {};
    for (let i = 16 + 5; i >= 0; i--) {
      const k = ago(i), e = {}, f = i < T ? (i === T - 1 ? .6 : 1) : 0;
      for (const m of [...METR, "sys"]) {
        if (rnd() < .1) continue; // missed entries
        const [mu, sd] = P.p[m]; let v;
        const dr = P.dm.includes(m) ? P.mag[m] * f : 0;
        if (m === "steps") v = Math.round(mu * (1 + dr) * (1 + sd * N()) / 10) * 10;
        else if (m === "water") v = Math.round(clamp(mu * (1 + dr) + sd * N(), 0, 14));
        else if (m === "sleep") v = Math.round(clamp(mu + dr + sd * N(), 2, 12) * 2) / 2;
        else if (m === "sys") v = Math.round(mu + sd * N());
        else v = Math.round(clamp(mu + dr + sd * N(), 1, 5));
        e[m] = v;
      }
      log[k] = e;
    }
    return log;
  }
  const COMBO = "Several signals are moving together";
  function detected(P, sigs) { return sigs.some(s => (s.level === "watch" || s.level === "act") && (P.dm.includes(s.m) || s.t === COMBO)); }
  function anyAlarm(sigs) { return sigs.some(s => s.level === "watch" || s.level === "act"); }
  const nD = 200, nS = 200, people = [...Array(nD)].map(() => person(true)), stable = [...Array(nS)].map(() => person(false));
  // pre-generate data so both methods see identical cases
  const dataD = people.map(P => [1, 2, 3, 4, 5].map(T => series(P, T))), dataS = stable.map(P => series(P, 0));
  HD.screens = []; HD.habits = [];
  const res = {};
  for (const method of ["adaptive", "fixed"]) {
    window.SIG_METHOD = method; const sens = {}, first = [];
    for (let T = 1; T <= 5; T++) { let c = 0; people.forEach((P, i) => { HD.log = dataD[i][T - 1]; if (detected(P, computeSignals())) c++; }); sens[T] = c / nD; }
    people.forEach((P, i) => { let ft = null; for (let T = 1; T <= 5 && ft == null; T++) { HD.log = dataD[i][T - 1]; if (detected(P, computeSignals())) ft = T; } first.push(ft); });
    let fa = 0; stable.forEach((P, i) => { HD.log = dataS[i]; if (anyAlarm(computeSignals())) fa++; });
    const det = first.filter(v => v != null).sort((a, b) => a - b);
    res[method] = {sens, fa: fa / nS, median: det.length ? det[Math.floor(det.length / 2)] : null, caughtBy5: det.length / nD};
  }
  window.SIG_METHOD = undefined;
  // safety red-flag test
  const POS = ["I have crushing chest pain", "my dad collapsed and is not breathing", "she is choking on food", "his face is drooping and he has slurred speech", "I think I'm having a heart attack", "there is a lot of bleeding and the blood won't stop", "my son swallowed bleach", "he took too many pills", "I want to end my life", "I've been thinking about suicide", "I want to die", "she fainted and won't wake up", "throat swelling after eating peanuts", "he has heatstroke and is confused", "my friend is unconscious", "I keep thinking of hurting myself", "the baby is not breathing", "tight chest and pain in left arm", "I can't breathe", "he is coughing blood",
    "عندي ألم في الصدر", "والدي انهار ولا يتنفس", "ابني يختنق", "أعتقد أنها نوبة قلبية", "نزيف لا يتوقف", "أخي أخذ جرعة زائدة من الدواء", "أفكر في الانتحار", "أريد أن أموت", "أغمي عليه ولا يستيقظ", "تورم الحلق بعد الأكل", "أصيب بضربة شمس", "لا أستطيع التنفس"];
  const NEG = ["how much water should I drink", "tips to sleep better", "I feel a bit tired today", "what is a healthy breakfast", "my chest day at the gym was great", "I burned dinner last night", "how do I lower stress", "walking plan for beginners", "is coffee bad for sleep", "I had a headache yesterday", "how to stay hydrated while fasting", "this deadline is killing me",
    "كم كوب ماء أشرب يومياً", "نصائح لنوم أفضل", "أشعر ببعض التعب", "ما هو الفطور الصحي", "كيف أخفف التوتر", "خطة مشي للمبتدئين", "هل القهوة تؤثر على النوم", "عندي صداع خفيف"];
  const missed = POS.filter(s => !redFlag(s)), wrong = NEG.filter(s => redFlag(s));
  res.safety = {pos: POS.length, neg: NEG.length, sens: (POS.length - missed.length) / POS.length, spec: (NEG.length - wrong.length) / NEG.length, missed, wrong};
  res.n = nD + nS; res.nDrift = nD; res.nStable = nS;
  HD.log = save0.log; HD.screens = save0.screens; HD.habits = save0.habits; LANG = lang0;
  return res;
};
