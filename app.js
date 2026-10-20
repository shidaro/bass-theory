'use strict';

/* ======================= Утилиты ======================= */

const rand = n => Math.floor(Math.random() * n);
const pick = a => a[rand(a.length)];
const shuffle = a => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const cap = s => s[0].toUpperCase() + s.slice(1);

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
const fretWord = n => `${n} ${plural(n, 'лад', 'лада', 'ладов')}`;
const semiWord = n => `${n} ${plural(n, 'полутон', 'полутона', 'полутонов')}`;

// Правильный ответ + до 3 неповторяющихся неправильных, перемешано.
function choices(correct, distractors) {
  const opts = [correct];
  for (const d of distractors) {
    if (opts.length >= 4) break;
    if (!opts.includes(d)) opts.push(d);
  }
  const options = shuffle(opts);
  return { options, answer: options.indexOf(correct) };
}

/* ======================= Музыкальное ядро ======================= */

const PC_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const PC_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const pcName = pc => PC_SHARP[pc] === PC_FLAT[pc] ? PC_SHARP[pc] : `${PC_SHARP[pc]}/${PC_FLAT[pc]}`;

// Индекс 0 — самая толстая струна (E). MIDI: E1 = 28.
const STRINGS = [
  { name: 'E', midi: 28 },
  { name: 'A', midi: 33 },
  { name: 'D', midi: 38 },
  { name: 'G', midi: 43 },
];
const MAX_FRET = 12;
const midiAt = (s, f) => STRINGS[s].midi + f;
const pcAt = (s, f) => midiAt(s, f) % 12;
const posName = (s, f) => `${STRINGS[s].name}-${f}`;

function cellsWithMidi(m) {
  const out = [];
  for (let s = 0; s < 4; s++) {
    const f = m - STRINGS[s].midi;
    if (f >= 0 && f <= MAX_FRET) out.push([s, f]);
  }
  return out;
}

// Ноты с учётом написания (буква + знак) — нужны для интервалов и тональностей.
const LETTERS = 'CDEFGAB';
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const RU_LETTER = { C: 'до', D: 'ре', E: 'ми', F: 'фа', G: 'соль', A: 'ля', B: 'си' };

function parseNote(n) {
  let acc = 0;
  for (const ch of n.slice(1)) acc += ch === '♯' ? 1 : ch === '♭' ? -1 : 0;
  return { l: LETTERS.indexOf(n[0]), acc };
}
const noteStr = ({ l, acc }) => LETTERS[l] + (acc > 0 ? '♯'.repeat(acc) : '♭'.repeat(-acc));
const notePc = n => { const { l, acc } = parseNote(n); return (LETTER_PC[l] + acc + 12) % 12; };
function ruNote(n) {
  const { l, acc } = parseNote(n);
  return RU_LETTER[LETTERS[l]] + (acc > 0 ? '-диез' : acc < 0 ? '-бемоль' : '');
}
function transpose(n, iv) {
  const nl = (parseNote(n).l + iv.steps) % 7;
  let acc = (((notePc(n) + iv.s - LETTER_PC[nl]) % 12) + 12) % 12;
  if (acc > 6) acc -= 12;
  return { name: noteStr({ l: nl, acc }), acc };
}

// steps — на сколько букв вверх (для написания), shape — типичная форма на басу.
const INTERVALS = [
  { s: 1, short: 'м2', full: 'малая секунда', steps: 1, shape: 'та же струна, +1 лад' },
  { s: 2, short: 'б2', full: 'большая секунда', steps: 1, shape: 'та же струна, +2 лада' },
  { s: 3, short: 'м3', full: 'малая терция', steps: 2, shape: 'струна выше, 2 лада назад' },
  { s: 4, short: 'б3', full: 'большая терция', steps: 2, shape: 'струна выше, 1 лад назад' },
  { s: 5, short: 'ч4', full: 'чистая кварта', steps: 3, shape: 'струна выше, тот же лад' },
  { s: 6, short: 'тритон', full: 'тритон (ув4 / ум5)', steps: null, shape: 'струна выше, +1 лад' },
  { s: 7, short: 'ч5', full: 'чистая квинта', steps: 4, shape: 'струна выше, +2 лада' },
  { s: 8, short: 'м6', full: 'малая секста', steps: 5, shape: 'через струну, 2 лада назад' },
  { s: 9, short: 'б6', full: 'большая секста', steps: 5, shape: 'через струну, 1 лад назад' },
  { s: 10, short: 'м7', full: 'малая септима', steps: 6, shape: 'через струну, тот же лад' },
  { s: 11, short: 'б7', full: 'большая септима', steps: 6, shape: 'через струну, +1 лад' },
  { s: 12, short: 'ч8', full: 'октава', steps: 7, shape: 'через струну, +2 лада' },
];
const ivLabel = iv => iv.s === 6 ? iv.full : `${iv.short} · ${iv.full}`;
const ivInline = iv => iv.s === 6 ? 'тритон' : `${iv.short} (${iv.full})`;
const nearIntervals = (iv, d = 3) => shuffle(INTERVALS.filter(x => x !== iv && Math.abs(x.s - iv.s) <= d));

// Мажорные тональности: n > 0 — диезы, n < 0 — бемоли.
const MAJORS = [
  ['C', 0], ['G', 1], ['D', 2], ['A', 3], ['E', 4], ['B', 5], ['F♯', 6], ['C♯', 7],
  ['F', -1], ['B♭', -2], ['E♭', -3], ['A♭', -4], ['D♭', -5], ['G♭', -6], ['C♭', -7],
].map(([tonic, n]) => ({ tonic, n }));
const majorByN = n => MAJORS.find(k => k.n === n);
const SHARP_ORDER = ['F♯', 'C♯', 'G♯', 'D♯', 'A♯', 'E♯', 'B♯'];
const FLAT_ORDER = ['B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭', 'F♭'];
const keySigns = n => n > 0 ? SHARP_ORDER.slice(0, n) : FLAT_ORDER.slice(0, -n);
const relMinor = t => transpose(t, { steps: 5, s: 9 }).name;
const keyName = (t, minor) => `${cap(ruNote(t))} ${minor ? 'минор' : 'мажор'} (${t}${minor ? 'm' : ''})`;
function signsText(n) {
  if (n === 0) return 'без знаков';
  const a = Math.abs(n);
  return n > 0 ? `${a} ${plural(a, 'диез', 'диеза', 'диезов')}` : `${a} ${plural(a, 'бемоль', 'бемоля', 'бемолей')}`;
}
const okN = n => Math.abs(n) <= 7;

/* ======================= Тема: гриф ======================= */

// Объяснение «как найти»: от ближайшей опорной точки (0, 5, 12 лад) считаем лады.
function fretWalk(s, f) {
  const a = [0, 5, 12].reduce((b, x) => Math.abs(x - f) < Math.abs(b - f) ? x : b);
  const st = STRINGS[s].name;
  let anchor;
  if (a === 0) anchor = `открытая струна ${st}`;
  else if (a === 12) anchor = `12-й лад — снова ${st}, октавой выше`;
  else anchor = `5-й лад — ${PC_SHARP[pcAt(s, 5)]}` + (s < 3 ? ` (как открытая ${STRINGS[s + 1].name})` : '');
  if (a === f) return `Опорная точка: ${anchor}.`;
  const dir = f > a ? 1 : -1;
  const names = dir > 0 ? PC_SHARP : PC_FLAT;
  const steps = [];
  for (let x = a + dir; x !== f + dir; x += dir) steps.push(`${x}: ${names[pcAt(s, x)]}`);
  return `Опора: ${anchor}. Дальше ${dir > 0 ? 'вверх' : 'вниз'} по ладам → ${steps.join(' → ')}.`;
}

function qFretName() {
  const s = rand(4), f = rand(MAX_FRET + 1), pc = pcAt(s, f);
  const d = shuffle([1, 2, 3, -1, -2, -3]).map(x => pcName((pc + x + 12) % 12));
  return {
    topic: 'fret', id: `fn-${s}-${f}`,
    prompt: `Какая нота? Струна ${STRINGS[s].name}, ${f === 0 ? 'открытая' : `${f}-й лад`}`,
    board: { dots: [{ s, f, kind: 'mark' }] },
    ...choices(pcName(pc), d),
    explain: fretWalk(s, f),
    audio: [midiAt(s, f)],
  };
}

function qFretFind() {
  const s = rand(4), pc = rand(12);
  const cells = [];
  for (let f = 0; f <= MAX_FRET; f++) if (pcAt(s, f) === pc) cells.push([s, f]);
  const extra = cells.length > 1 ? ` Эта нота есть и на ${cells[1][1]}-м ладу — октавой выше.` : '';
  return {
    topic: 'fret', id: `ff-${s}-${pc}`,
    prompt: `Найди ${pcName(pc)} на струне ${STRINGS[s].name}`,
    board: { dots: [], tap: true, onlyString: s },
    cells,
    explain: fretWalk(s, cells[0][1]) + extra,
    audio: [midiAt(s, cells[0][1])],
  };
}

function qFretOctave() {
  const s = rand(2), f = rand(11);
  const m = midiAt(s, f) + 12;
  const tail = f === 0 ? ' Ещё вариант — 12-й лад той же струны.' : '';
  return {
    topic: 'fret', id: `fo-${s}-${f}`,
    prompt: `Отметь эту же ноту (${pcName(pcAt(s, f))}) октавой выше`,
    board: { dots: [{ s, f, kind: 'root' }], tap: true },
    cells: cellsWithMidi(m),
    explain: `Октава на басу — через одну струну вверх и на 2 лада дальше (5 + 5 + 2 = 12 полутонов): ${posName(s, f)} → ${posName(s + 2, f + 2)}.${tail}`,
    audio: [midiAt(s, f), m],
  };
}

function qFretUnison() {
  const up = Math.random() < 0.5;
  const s = up ? rand(3) : 1 + rand(3);
  const f = up ? 5 + rand(8) : rand(8);
  const ts = up ? s + 1 : s - 1, tf = up ? f - 5 : f + 5;
  const why = up
    ? 'Струна выше звучит на 5 полутонов выше, поэтому тот же звук на ней — на 5 ладов ближе к голове грифа'
    : 'Струна ниже звучит на 5 полутонов ниже, поэтому тот же звук на ней — на 5 ладов дальше';
  return {
    topic: 'fret', id: `fu-${s}-${f}-${ts}`,
    prompt: `Найди тот же звук на струне ${STRINGS[ts].name}`,
    board: { dots: [{ s, f, kind: 'root' }], tap: true, onlyString: ts },
    cells: [[ts, tf]],
    explain: `${why}: ${posName(s, f)} = ${posName(ts, tf)} (${pcName(pcAt(s, f))}).`,
    audio: [midiAt(s, f)],
  };
}

const FRET_FACTS = [
  { q: 'Между какими натуральными нотами нет диеза/бемоля?', a: 'E–F и B–C', w: ['C–D и F–G', 'A–B и D–E', 'G–A и E–F'],
    e: 'Ми–фа и си–до стоят на соседних ладах (полутон). Между остальными натуральными нотами пропускается один лад (тон).' },
  { q: '12-й лад любой струны — это…', a: 'нота открытой струны, октавой выше', w: ['квинта от открытой струны', 'та же нота, что на 5-м ладу', 'нота соседней струны'],
    e: '12 ладов = 12 полутонов = октава. После 12-го лада гриф повторяется.' },
  { q: '5-й лад струны E звучит так же, как…', a: 'открытая струна A', w: ['открытая струна D', '7-й лад струны A', 'открытая струна G'],
    e: 'Соседние струны баса настроены через кварту (5 полутонов): 5-й лад любой струны = следующая открытая струна.' },
  { q: 'Сколько полутонов между соседними струнами баса (EADG)?', a: '5 — чистая кварта', w: ['4 — большая терция', '7 — чистая квинта', '2 — тон'],
    e: 'E→A, A→D, D→G — везде по 5 полутонов. Поэтому при переходе на соседнюю струну всё сдвигается на 5 ладов.' },
  { q: 'Как найти октаву ноты на басу?', a: 'через струну вверх, на 2 лада дальше', w: ['на соседней струне, на 2 лада дальше', 'та же струна, на 7 ладов дальше', 'через струну, на том же ладу'],
    e: 'Через струну — это +10 полутонов (5 + 5), плюс 2 лада = 12. Самая ходовая фигура на басу.' },
  { q: 'Где тот же звук на соседней, более высокой струне?', a: 'на 5 ладов ближе к голове грифа', w: ['на 5 ладов дальше', 'на том же ладу', 'на 7 ладов ближе к голове'],
    e: 'Струна выше звучит на 5 полутонов выше — значит, сдвигаемся на 5 ладов назад. Например, E-7 (B) = A-2 (B).' },
  { q: 'Какая нота на 3-м ладу струны A?', a: 'C', w: ['B', 'C♯/D♭', 'D'],
    e: 'A → A♯ (1) → B (2) → C (3). Между B и C полутона нет, поэтому C уже на 3-м ладу.' },
  { q: '7-й лад струны E — та же нота, что…', a: '2-й лад струны A', w: ['открытая струна D', '2-й лад струны D', '5-й лад струны A'],
    e: 'Тот же звук на струне выше — на 5 ладов назад: 7 − 5 = 2. Это нота B.' },
  { q: 'Какие ноты на 3-м ладу струн E, A, D, G?', a: 'G, C, F, B♭', w: ['G, C, F, B', 'F♯, B, E, A', 'G, B, E, A'],
    e: 'Полезно знать наизусть: 3-й лад даёт G – C – F – B♭. Каждая следующая нота на кварту выше.' },
];

/* ======================= Тема: интервалы ======================= */

function shapeDesc(ds, df) {
  const str = ['та же струна', 'струна выше', 'через струну'][ds];
  const fr = df === 0 ? 'тот же лад' : df > 0 ? `+${fretWord(df)}` : `${fretWord(-df)} назад`;
  return `${str}, ${fr}`;
}
function shapeMath(ds, df) {
  const semis = ds * 5 + df;
  if (ds === 0 || df === 0) return semiWord(semis);
  let t = ds === 1 ? '5' : '5 + 5';
  if (df) t += ` ${df > 0 ? '+' : '−'} ${Math.abs(df)}`;
  return `${t} = ${semiWord(semis)}`;
}

// Компактная (удобная для руки) позиция интервала на грифе.
function placeInterval(semis) {
  for (;;) {
    const s = rand(4), f = 1 + rand(9);
    const opts = [];
    for (let ts = s; ts <= Math.min(3, s + 2); ts++) {
      const tf = f + semis - 5 * (ts - s);
      if (tf >= 0 && tf <= MAX_FRET && Math.abs(tf - f) <= 4) opts.push([ts, tf]);
    }
    if (opts.length) { const [ts, tf] = pick(opts); return { s, f, ts, tf }; }
  }
}

function qIntSemis() {
  const iv = pick(INTERVALS);
  const explain = `${ivLabel(iv)} = ${semiWord(iv.s)}. На грифе: ${iv.shape}.`;
  if (Math.random() < 0.5) {
    return {
      topic: 'int', id: `is-${iv.s}`,
      prompt: `Сколько полутонов (ладов) в интервале ${ivInline(iv)}?`,
      ...choices(String(iv.s), nearIntervals(iv).map(x => String(x.s))),
      explain,
    };
  }
  return {
    topic: 'int', id: `isr-${iv.s}`,
    prompt: `Интервал в ${semiWord(iv.s)} — это…`,
    ...choices(ivLabel(iv), nearIntervals(iv).map(ivLabel)),
    explain,
  };
}

function qIntShape() {
  const iv = pick(INTERVALS);
  const p = placeInterval(iv.s);
  const ds = p.ts - p.s, df = p.tf - p.f;
  return {
    topic: 'int', id: `ish-${p.s}-${p.f}-${p.ts}-${p.tf}`,
    prompt: 'Какой интервал от красной ноты до синей?',
    board: { dots: [{ s: p.s, f: p.f, kind: 'root' }, { s: p.ts, f: p.tf, kind: 'mark' }] },
    ...choices(ivLabel(iv), nearIntervals(iv).map(ivLabel)),
    explain: `${cap(shapeDesc(ds, df))}: ${shapeMath(ds, df)} → ${ivLabel(iv)}. ${pcName(pcAt(p.s, p.f))} → ${pcName(pcAt(p.ts, p.tf))}.`,
    audio: [midiAt(p.s, p.f), midiAt(p.ts, p.tf)],
  };
}

function qIntTap() {
  for (;;) {
    const iv = pick(INTERVALS.filter(x => x.s >= 3));
    const s = rand(3), f = 1 + rand(8);
    const m = midiAt(s, f) + iv.s;
    const cells = cellsWithMidi(m);
    if (!cells.length) continue;
    return {
      topic: 'int', id: `it-${s}-${f}-${iv.s}`,
      prompt: `Отметь ${ivInline(iv)} вверх от красной ноты`,
      board: { dots: [{ s, f, kind: 'root' }], tap: true },
      cells,
      explain: `${ivLabel(iv)} = ${semiWord(iv.s)}. Удобная форма: ${iv.shape}. От ${pcName(pcAt(s, f))} это ${pcName(m % 12)}.`,
      audio: [midiAt(s, f), m],
    };
  }
}

const SPELL_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'B♭', 'E♭', 'F♯'];
// Редкие написания басисту почти не встречаются — не спрашиваем их.
const RARE = new Set(['E♯', 'B♯', 'F♭', 'C♭']);
const usable = t => Math.abs(t.acc) <= 1 && !RARE.has(t.name);
function qIntSpell() {
  for (;;) {
    const root = pick(SPELL_ROOTS);
    const iv = pick(INTERVALS.filter(x => x.steps && x.s < 12));
    const r = transpose(root, iv);
    if (!usable(r)) continue;
    const rPc = notePc(r.name);
    const d = [];
    for (const x of nearIntervals(iv, 2)) {
      if (!x.steps) continue;
      const t = transpose(root, x);
      if (usable(t) && notePc(t.name) !== rPc) d.push(t.name);
    }
    const { l, acc } = parseNote(r.name);
    for (const a of shuffle([acc - 1, acc + 1])) {
      const t = { name: noteStr({ l, acc: a }), acc: a };
      if (usable(t)) d.push(t.name);
    }
    for (const x of shuffle([...LETTERS])) if (notePc(x) !== rPc) d.push(x);

    const rl = parseNote(root).l;
    const letters = [];
    for (let i = 0; i <= iv.steps; i++) letters.push(LETTERS[(rl + i) % 7]);
    const natural = letters.at(-1);
    const natDist = (LETTER_PC[LETTERS.indexOf(natural)] - notePc(root) + 12) % 12;
    const degree = iv.full.split(' ').pop();
    const count = natDist === iv.s
      ? `${root} → ${natural} — как раз ${semiWord(iv.s)}, значит ответ ${r.name}.`
      : `${root} → ${natural} = ${semiWord(natDist)}, а нужно ${iv.s} → ${r.name}.`;
    const rootMidi = 36 + notePc(root);
    return {
      topic: 'int', id: `isp-${root}-${iv.s}`,
      prompt: `Какая нота на ${ivInline(iv)} выше ${root}?`,
      ...choices(r.name, d),
      explain: `${cap(degree)} — это ${iv.steps + 1}-я буква: ${letters.join('–')}. ${count}`,
      audio: [rootMidi, rootMidi + iv.s],
    };
  }
}

const INT_FACTS = [
  { q: 'Тот же лад на соседней струне выше — какой это интервал?', a: 'ч4 · чистая кварта', w: ['ч5 · чистая квинта', 'б3 · большая терция', 'ч8 · октава'],
    e: 'Соседняя струна выше звучит на 5 полутонов выше — это кварта.' },
  { q: 'Где проще всего взять квинту ВНИЗ от тоники?', a: 'тот же лад, на струну ниже', w: ['та же струна, 5 ладов назад', 'через струну, тот же лад', 'на струну ниже, 2 лада назад'],
    e: 'Тот же лад на струне ниже — это квинта тоники, только октавой ниже. Классика «тоника–квинта»: C на A-3 и G на E-3.' },
  { q: 'Какой интервал от тоники делает трезвучие минорным?', a: 'м3 · малая терция', w: ['б3 · большая терция', 'ч5 · чистая квинта', 'м7 · малая септима'],
    e: 'Минорное трезвучие: 1 – м3 – ч5. Мажорное: 1 – б3 – ч5. Разница всего в один лад.' },
  { q: 'Чем отличается б3 от м3 на грифе (струна выше)?', a: 'б3 — 1 лад назад, м3 — 2 лада назад', w: ['б3 — тот же лад, м3 — 1 лад назад', 'б3 — 2 лада назад, м3 — 1 лад назад', 'ничем'],
    e: 'Струна выше = +5 полутонов. б3 = 4 = 5 − 1, м3 = 3 = 5 − 2.' },
  { q: 'Сколько полутонов в тритоне?', a: '6', w: ['5', '7', '4'],
    e: 'Тритон — ровно пол-октавы (ув4 = ум5). На грифе: струна выше, +1 лад.' },
  { q: 'Из каких ступеней состоит доминантсептаккорд (C7)?', a: '1 – б3 – ч5 – м7', w: ['1 – б3 – ч5 – б7', '1 – м3 – ч5 – м7', '1 – м3 – ум5 – м7'],
    e: 'C7 = C – E – G – B♭. б7 даёт Cmaj7, а м3 + м7 — Cm7.' },
];

/* ======================= Тема: тональности ======================= */

const CIRCLE_SHARPS = 'C → G → D → A → E → B → F♯ → C♯ (каждый шаг — квинта вверх и +1 диез).';
const CIRCLE_FLATS = 'C → F → B♭ → E♭ → A♭ → D♭ → G♭ → C♭ (каждый шаг — кварта вверх и +1 бемоль).';

function keyRule(k) {
  const s = keySigns(k.n);
  if (k.n === 0) return 'До мажор — без знаков, с него начинается квинтовый круг.';
  if (k.n > 0) return `Знаки: ${s.join(' ')}. Подсказка: последний диез (${s.at(-1)}) — на полтона ниже тоники ${k.tonic}. Круг: ${CIRCLE_SHARPS}`;
  if (k.n === -1) return 'Фа мажор — один бемоль (B♭). Его просто запоминаем.';
  return `Знаки: ${s.join(' ')}. Подсказка: предпоследний бемоль (${s.at(-2)}) — это и есть тоника. Круг: ${CIRCLE_FLATS}`;
}
const neighborNs = n => shuffle([n + 1, n - 1, -n, n + 2, n - 2]).filter(x => okN(x) && x !== n);

function qKeyCount() {
  const k = pick(MAJORS.filter(k => k.n !== 0));
  return {
    topic: 'key', id: `kc-${k.tonic}`,
    prompt: `Сколько знаков в тональности ${keyName(k.tonic)}?`,
    ...choices(signsText(k.n), neighborNs(k.n).map(signsText)),
    explain: keyRule(k),
  };
}

function qKeyWhich() {
  const k = pick(MAJORS);
  return {
    topic: 'key', id: `kw-${k.n}`,
    prompt: `Какой мажор — ${signsText(k.n)}?`,
    ...choices(keyName(k.tonic), neighborNs(k.n).map(n => keyName(majorByN(n).tonic))),
    explain: keyRule(k),
  };
}

function qKeyFromSigns() {
  const k = pick(MAJORS.filter(k => k.n !== 0));
  return {
    topic: 'key', id: `kf-${k.n}`,
    prompt: `В ключе: ${keySigns(k.n).join(' ')}. Какая это мажорная тональность?`,
    ...choices(keyName(k.tonic), neighborNs(k.n).map(n => keyName(majorByN(n).tonic))),
    explain: keyRule(k),
  };
}

function qKeySignsList() {
  const k = pick(MAJORS.filter(k => k.n !== 0 && Math.abs(k.n) <= 6));
  const list = n => n === 0 ? 'без знаков' : keySigns(n).join(' ');
  return {
    topic: 'key', id: `kl-${k.tonic}`,
    prompt: `Какие знаки в тональности ${keyName(k.tonic)}?`,
    ...choices(list(k.n), neighborNs(k.n).map(list)),
    explain: keyRule(k),
  };
}

function qKeyRelative() {
  const k = pick(MAJORS.filter(k => Math.abs(k.n) <= 6));
  const m = relMinor(k.tonic);
  const near = neighborNs(k.n).map(n => majorByN(n).tonic);
  const explain = `Параллельный минор строится от 6-й ступени — на м3 (3 полутона) ниже тоники: ${k.tonic} → ${m}. На басу: та же струна, 3 лада назад. Знаки у них общие — ${signsText(k.n)}.`;
  if (Math.random() < 0.5) {
    return {
      topic: 'key', id: `kr-${k.tonic}`,
      prompt: `Какой минор параллелен тональности ${keyName(k.tonic)}?`,
      ...choices(keyName(m, true), [keyName(k.tonic, true), ...near.map(t => keyName(relMinor(t), true))]),
      explain,
    };
  }
  return {
    topic: 'key', id: `krr-${k.tonic}`,
    prompt: `Какой мажор параллелен тональности ${keyName(m, true)}?`,
    ...choices(keyName(k.tonic), [keyName(m), ...near.map(t => keyName(t))]),
    explain,
  };
}

const ORDINALS = ['первым', 'вторым', 'третьим', 'четвёртым', 'пятым', 'шестым', 'седьмым'];
function qKeyOrder() {
  const sharp = Math.random() < 0.5;
  const order = sharp ? SHARP_ORDER : FLAT_ORDER;
  const i = rand(7);
  return {
    topic: 'key', id: `ko-${sharp ? 's' : 'f'}${i}`,
    prompt: `Какой ${sharp ? 'диез' : 'бемоль'} появляется в ключе ${ORDINALS[i]}?`,
    ...choices(order[i], shuffle(order.filter((_, j) => j !== i))),
    explain: sharp
      ? 'Порядок диезов: F C G D A E B (фа–до–соль–ре–ля–ми–си) — каждый следующий на квинту выше предыдущего.'
      : 'Порядок бемолей — тот же ряд задом наперёд: B E A D G C F (си–ми–ля–ре–соль–до–фа).',
  };
}

/* ======================= Реестр тем ======================= */

const factGen = (topic, list) => () => {
  const i = rand(list.length), x = list[i];
  return { topic, id: `${topic}-fact${i}`, prompt: x.q, ...choices(x.a, shuffle(x.w)), explain: x.e };
};

const TOPICS = {
  fret: {
    title: 'Гриф', sub: 'Ноты, опорные лады, октавы',
    gens: [[qFretName, 3], [qFretFind, 3], [qFretOctave, 2], [qFretUnison, 2], [factGen('fret', FRET_FACTS), 1.5]],
  },
  int: {
    title: 'Интервалы', sub: 'Полутоны, формы на грифе, ноты',
    gens: [[qIntSemis, 2], [qIntShape, 3], [qIntTap, 3], [qIntSpell, 2], [factGen('int', INT_FACTS), 1]],
  },
  key: {
    title: 'Тональности', sub: 'Знаки, квинтовый круг, параллели',
    gens: [[qKeyCount, 2], [qKeyWhich, 2], [qKeyFromSigns, 2], [qKeySignsList, 1.5], [qKeyRelative, 2], [qKeyOrder, 1]],
  },
};

function genFrom(topic) {
  const gens = TOPICS[topic].gens;
  let r = Math.random() * gens.reduce((a, [, w]) => a + w, 0);
  for (const [g, w] of gens) { if ((r -= w) <= 0) return g(); }
  return gens[0][0]();
}

function buildSet(topic, n) {
  const out = [], ids = new Set();
  for (let g = 0; out.length < n && g < 500; g++) {
    const q = genFrom(topic);
    if (ids.has(q.id)) continue;
    ids.add(q.id);
    out.push(q);
  }
  return out;
}

/* ======================= Хранилище ======================= */

const STORE_KEY = 'bass-theory-v1';
function loadDb() {
  const base = { stats: {}, mistakes: {}, tickets: { passed: 0, total: 0 } };
  try { return { ...base, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; } catch { return base; }
}
function saveDb() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* приватный режим — живём без сохранения */ }
}
let db = loadDb();

// Ошибка попадает в «Мои ошибки» и уходит оттуда после 2 верных ответов подряд.
function record(q, ok) {
  const st = db.stats[q.topic] ||= { c: 0, t: 0 };
  st.t++;
  if (ok) st.c++;
  const m = db.mistakes[q.id];
  if (!ok) db.mistakes[q.id] = { q, streak: 0, at: m ? m.at : Date.now() };
  else if (m && ++m.streak >= 2) delete db.mistakes[q.id];
  saveDb();
}

/* ======================= Звук ======================= */

let actx;
function playNotes(midis) {
  actx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  const t0 = actx.currentTime + 0.05;
  const seq = midis.length > 1
    ? [...midis.map((m, i) => [m, i * 0.6]), ...midis.map(m => [m, midis.length * 0.6 + 0.15])]
    : [[midis[0], 0]];
  // Сдвигаем на 2 октавы вверх — динамик телефона басовый регистр почти не воспроизводит.
  for (const [m, dt] of seq) pluck(m + 24, t0 + dt);
}
function pluck(m, t) {
  const f = 440 * 2 ** ((m - 69) / 12);
  const o = actx.createOscillator(), g = actx.createGain(), lp = actx.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.value = f;
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(f * 6, t);
  lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.9);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.25, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
  o.connect(lp).connect(g).connect(actx.destination);
  o.start(t);
  o.stop(t + 1.5);
}

/* ======================= Гриф (SVG) ======================= */

const BD = { left: 22, open: 26, fw: 27, top: 20, gap: 34 };

// spec: { dots:[{s,f,kind,label}], tap, onlyString }, result: { cells, picked } после ответа.
function boardSVG(spec, result) {
  const nut = BD.left + BD.open;
  const W = nut + MAX_FRET * BD.fw + 6;
  const H = BD.top + 3 * BD.gap + 36;
  const y = s => BD.top + (3 - s) * BD.gap;
  const x = f => f === 0 ? BD.left + BD.open / 2 - 1 : nut + (f - 0.5) * BD.fw;
  const yMid = BD.top + 1.5 * BD.gap;
  let g = `<rect x="${nut}" y="${BD.top - 10}" width="${MAX_FRET * BD.fw}" height="${3 * BD.gap + 20}" rx="3" class="wood"/>`;

  for (const f of [3, 5, 7, 9]) g += `<circle cx="${x(f)}" cy="${yMid}" r="4" class="inlay"/>`;
  g += `<circle cx="${x(12)}" cy="${BD.top + 0.5 * BD.gap}" r="4" class="inlay"/><circle cx="${x(12)}" cy="${BD.top + 2.5 * BD.gap}" r="4" class="inlay"/>`;
  for (let f = 1; f <= MAX_FRET; f++) {
    const fx = nut + f * BD.fw;
    g += `<line x1="${fx}" y1="${BD.top - 10}" x2="${fx}" y2="${y(0) + 10}" class="fret"/>`;
  }
  g += `<line x1="${nut}" y1="${BD.top - 10}" x2="${nut}" y2="${y(0) + 10}" class="nut"/>`;
  for (let s = 0; s < 4; s++) {
    const dim = spec.onlyString != null && spec.onlyString !== s;
    g += `<line x1="${BD.left}" y1="${y(s)}" x2="${W - 6}" y2="${y(s)}" class="string${dim ? ' dim' : ''}" stroke-width="${(1 + (3 - s) * 0.55).toFixed(2)}"/>`;
    g += `<text x="9" y="${y(s) + 4}" class="slabel${dim ? ' dim' : ''}">${STRINGS[s].name}</text>`;
  }
  for (const f of [0, 3, 5, 7, 9, 12]) g += `<text x="${x(f)}" y="${H - 6}" class="fnum">${f}</text>`;

  const dots = [...spec.dots];
  if (result) {
    for (const [s, f] of result.cells) dots.push({ s, f, kind: 'ok' });
    const [ps, pf] = result.picked;
    if (!result.cells.some(([s, f]) => s === ps && f === pf)) dots.push({ s: ps, f: pf, kind: 'bad' });
  }
  for (const d of dots) {
    g += `<circle cx="${x(d.f)}" cy="${y(d.s)}" r="10" class="dot ${d.kind}"/>`;
    if (d.label) g += `<text x="${x(d.f)}" y="${y(d.s) + 3.5}" class="dlabel ${d.kind}">${d.label}</text>`;
  }

  if (spec.tap && !result) {
    for (let s = 0; s < 4; s++) {
      if (spec.onlyString != null && spec.onlyString !== s) continue;
      for (let f = 0; f <= MAX_FRET; f++) {
        const cx = f === 0 ? BD.left - 4 : nut + (f - 1) * BD.fw;
        const w = f === 0 ? BD.open + 4 : BD.fw;
        g += `<rect x="${cx}" y="${y(s) - BD.gap / 2}" width="${w}" height="${BD.gap}" class="cell" data-action="tap" data-s="${s}" data-f="${f}"/>`;
      }
    }
  }
  return `<svg class="board${spec.tap && !result ? ' tappable' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Гриф бас-гитары">${g}</svg>`;
}

/* ======================= Экраны ======================= */

const app = document.getElementById('app');
let screen = 'home';
let quiz = null;
let theoryTopic = null;

function show(next, keepScroll) {
  screen = next;
  app.innerHTML = { home: renderHome, quiz: renderQuiz, result: renderResult, theory: renderTheory }[screen]();
  if (!keepScroll) window.scrollTo(0, 0);
}

function renderHome() {
  const mCount = Object.keys(db.mistakes).length;
  const t = db.tickets;
  const topics = Object.entries(TOPICS).map(([id, tp]) => {
    const st = db.stats[id] || { c: 0, t: 0 };
    const pct = st.t ? Math.round(st.c / st.t * 100) : 0;
    return `
      <section class="card topic">
        <div class="topic-head">
          <div><div class="card-title">${tp.title}</div><div class="card-sub">${tp.sub}</div></div>
          <div class="pct">${st.t ? pct + '%' : '—'}</div>
        </div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="topic-meta">${st.t ? `${st.c} из ${st.t} верно` : 'Ещё не начато'}</div>
        <div class="row">
          <button class="btn" data-action="topic" data-topic="${id}">Тренировка</button>
          <button class="btn ghost" data-action="theory" data-topic="${id}">Теория</button>
        </div>
      </section>`;
  }).join('');

  return `
    <header class="hero">
      <h1>Бас · Теория</h1>
      <p>Билеты по теории для 4-струнного баса</p>
    </header>
    <button class="card big" data-action="ticket">
      <div class="card-title">Билет</div>
      <div class="card-sub">20 вопросов из всех тем · можно ошибиться 2 раза</div>
      ${t.total ? `<div class="card-meta">Сдано ${t.passed} из ${t.total}</div>` : ''}
    </button>
    <button class="card" data-action="mistakes" ${mCount ? '' : 'disabled'}>
      <div class="card-title">Мои ошибки <span class="badge">${mCount}</span></div>
      <div class="card-sub">${mCount ? 'Вопрос уходит после 2 верных ответов подряд' : 'Пока пусто — сюда попадут вопросы, где ошибся'}</div>
    </button>
    <h3 class="section">Темы</h3>
    ${topics}
    <button class="link" data-action="reset">Сбросить прогресс</button>`;
}

function startQuiz(mode, topic) {
  let qs;
  if (mode === 'ticket') qs = shuffle([...buildSet('fret', 7), ...buildSet('int', 7), ...buildSet('key', 6)]);
  else if (mode === 'topic') qs = buildSet(topic, 20);
  else qs = Object.values(db.mistakes).sort((a, b) => a.at - b.at).slice(0, 20).map(m => m.q);
  quiz = { mode, topic, qs, i: 0, results: [], picked: null };
  show('quiz');
}

function quizTitle() {
  return quiz.mode === 'ticket' ? 'Билет' : quiz.mode === 'topic' ? TOPICS[quiz.topic].title : 'Мои ошибки';
}

function renderQuiz() {
  const q = quiz.qs[quiz.i];
  const done = quiz.picked !== null;
  const errs = quiz.results.filter(r => r === false).length;
  const squares = quiz.qs.map((_, j) => {
    const r = quiz.results[j];
    return `<i class="${r === true ? 'ok' : r === false ? 'bad' : ''}${j === quiz.i ? ' cur' : ''}"></i>`;
  }).join('');

  let body = '';
  if (q.board) body += boardSVG(q.board, done && q.cells ? { cells: q.cells, picked: quiz.picked } : null);
  if (q.options) {
    body += `<div class="opts">${q.options.map((o, j) => {
      let cls = 'opt';
      if (done && j === q.answer) cls += ' ok';
      else if (done && j === quiz.picked) cls += ' bad';
      return `<button class="${cls}" data-action="opt" data-i="${j}" ${done ? 'disabled' : ''}>${o}</button>`;
    }).join('')}</div>`;
  } else if (!done) {
    body += `<p class="hint">Нажми на нужный лад прямо на грифе</p>`;
  }
  if (done) {
    const ok = quiz.results[quiz.i];
    const streak = quiz.mode === 'mistakes' && ok && db.mistakes[q.id] ? '<p class="small">Ещё один верный ответ — и вопрос уйдёт из ошибок.</p>' : '';
    body += `
      <div class="explain ${ok ? 'ok' : 'bad'}" id="explain">
        <b>${ok ? 'Верно' : 'Неверно'}</b>
        <p>${q.explain}</p>${q.cells && q.cells.length > 1 ? '<p class="small muted">Зелёным отмечены все места на грифе, где есть этот звук — подходит любое.</p>' : ''}${streak}
        ${q.audio ? '<button class="btn ghost small" data-action="play">▶ Послушать</button>' : ''}
      </div>
      <button class="btn primary wide" data-action="next">${quiz.i + 1 < quiz.qs.length ? 'Дальше' : 'Результат'}</button>`;
  }

  return `
    <div class="qbar">
      <button class="icon-btn" data-action="home" aria-label="Выйти">✕</button>
      <div class="qtitle">${quizTitle()} · ${quiz.i + 1}/${quiz.qs.length}</div>
      <div class="qerr ${quiz.mode === 'ticket' && errs > 2 ? 'bad' : ''}">${errs} ${plural(errs, 'ошибка', 'ошибки', 'ошибок')}</div>
    </div>
    <div class="squares">${squares}</div>
    <div class="qtopic">${TOPICS[q.topic].title}</div>
    <h2 class="qtext">${q.prompt}</h2>
    ${body}`;
}

function answer(ok, picked) {
  quiz.picked = picked;
  quiz.results[quiz.i] = ok;
  record(quiz.qs[quiz.i], ok);
  show('quiz', true);
  document.getElementById('explain')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nextQuestion() {
  if (quiz.i + 1 < quiz.qs.length) {
    quiz.i++;
    quiz.picked = null;
    show('quiz');
    return;
  }
  if (quiz.mode === 'ticket') {
    db.tickets.total++;
    if (quiz.results.filter(r => !r).length <= 2) db.tickets.passed++;
    saveDb();
  }
  show('result');
}

function renderResult() {
  const n = quiz.qs.length;
  const errs = quiz.results.filter(r => !r).length;
  const wrong = quiz.qs.filter((_, j) => !quiz.results[j]);
  const head = quiz.mode === 'ticket'
    ? `<div class="verdict ${errs <= 2 ? 'ok' : 'bad'}">${errs <= 2 ? 'Сдано' : 'Не сдано'}</div>
       <p class="center muted">Верно ${n - errs} из ${n} · ${errs} ${plural(errs, 'ошибка', 'ошибки', 'ошибок')}</p>`
    : `<div class="verdict">${n - errs} из ${n}</div><p class="center muted">${quizTitle()}</p>`;
  const list = wrong.length ? `
    <h3 class="section">Разбор ошибок</h3>
    ${wrong.map(q => `<div class="card review"><div class="card-title">${q.prompt}</div><p>${q.explain}</p></div>`).join('')}` : '';
  const again = quiz.mode === 'ticket' ? 'Ещё билет' : quiz.mode === 'topic' ? 'Ещё раз' : 'Повторить ошибки';
  const canAgain = quiz.mode !== 'mistakes' || Object.keys(db.mistakes).length;
  return `
    <div class="result">
      ${head}
      <div class="row">
        ${canAgain ? `<button class="btn primary" data-action="again">${again}</button>` : ''}
        <button class="btn ghost" data-action="home">На главную</button>
      </div>
      ${list}
    </div>`;
}

/* ======================= Теория ======================= */

const THEORY = {
  fret: () => {
    const naturals = [];
    for (let s = 0; s < 4; s++) for (let f = 0; f <= MAX_FRET; f++) {
      const n = PC_SHARP[pcAt(s, f)];
      if (n.length === 1) naturals.push({ s, f, kind: 'note', label: n });
    }
    return `
      <p>Все натуральные ноты (без диезов и бемолей) на первых 12 ладах:</p>
      ${boardSVG({ dots: naturals })}
      <ul class="rules">
        <li><b>Строй E–A–D–G.</b> Соседние струны отличаются на 5 полутонов (кварта).</li>
        <li><b>E–F и B–C — соседние лады.</b> Между остальными натуральными нотами пропускается один лад.</li>
        <li><b>Опорные лады.</b> 0 — открытая струна. 5 — нота следующей струны. 12 — снова открытая, октавой выше. От них удобно отсчитывать.</li>
        <li><b>3-й лад наизусть:</b> E → G, A → C, D → F, G → B♭.</li>
        <li><b>Тот же звук на струне выше</b> — на 5 ладов ближе к голове грифа (E-7 = A-2).</li>
      </ul>
      <p><b>Октава:</b> через струну вверх и на 2 лада дальше.</p>
      ${boardSVG({ dots: [{ s: 0, f: 3, kind: 'root', label: 'G' }, { s: 2, f: 5, kind: 'mark', label: 'G' }, { s: 1, f: 3, kind: 'root', label: 'C' }, { s: 3, f: 5, kind: 'mark', label: 'C' }] })}`;
  },
  int: () => `
    <p>Интервал — расстояние между двумя нотами в полутонах (1 лад = 1 полутон). На басу у каждого интервала есть своя «фигура».</p>
    ${boardSVG({ dots: [
      { s: 1, f: 3, kind: 'root', label: 'R' }, { s: 2, f: 2, kind: 'mark', label: '3' },
      { s: 2, f: 5, kind: 'mark', label: '5' }, { s: 3, f: 5, kind: 'mark', label: '8' }, { s: 0, f: 3, kind: 'mark', label: '5' },
    ] })}
    <p class="small muted">От C (A-3): б3 = E, ч5 = G, октава = C. Квинта вниз — тот же лад, струна ниже.</p>
    <table class="tbl">
      <tr><th>Интервал</th><th>Полут.</th><th>Форма на грифе</th></tr>
      ${INTERVALS.map(iv => `<tr><td><b>${iv.short}</b> <span class="muted">${iv.s === 6 ? 'ув4 / ум5' : iv.full}</span></td><td>${iv.s}</td><td>${iv.shape}</td></tr>`).join('')}
    </table>
    <ul class="rules">
      <li><b>Струна выше = +5 полутонов,</b> через струну = +10. Отсюда все фигуры: ч5 = 5 + 2, б3 = 5 − 1, октава = 10 + 2.</li>
      <li><b>Мажор и минор</b> отличаются терцией: 1 – б3 – ч5 против 1 – м3 – ч5.</li>
      <li><b>Написание нот:</b> терция — 3-я буква (A–B–C), квинта — 5-я (A–B–C–D–E). Поэтому б3 от A — это C♯, а не D♭.</li>
    </ul>`,
  key: () => `
    <p>Тональность определяется ключевыми знаками. Их порядок и количество подчиняются квинтовому кругу.</p>
    <ul class="rules">
      <li><b>Диезы:</b> ${CIRCLE_SHARPS}</li>
      <li><b>Бемоли:</b> ${CIRCLE_FLATS}</li>
      <li><b>Порядок диезов:</b> F C G D A E B. <b>Бемолей</b> — наоборот: B E A D G C F.</li>
      <li><b>По диезам:</b> последний диез + полтона = тоника (F♯ C♯ G♯ → A мажор).</li>
      <li><b>По бемолям:</b> предпоследний бемоль = тоника (B♭ E♭ A♭ → E♭ мажор). F мажор — 1 бемоль, запоминаем.</li>
      <li><b>Параллельный минор</b> — на 3 полутона ниже (та же струна, 3 лада назад), знаки те же.</li>
    </ul>
    <table class="tbl">
      <tr><th>Знаки</th><th>Мажор</th><th>Минор</th></tr>
      ${[...MAJORS].sort((a, b) => a.n - b.n).map(k => `<tr><td>${k.n ? keySigns(k.n).join(' ') : '—'}</td><td><b>${k.tonic}</b></td><td>${relMinor(k.tonic)}m</td></tr>`).join('')}
    </table>`,
};

function renderTheory() {
  return `
    <div class="qbar">
      <button class="icon-btn" data-action="home" aria-label="Назад">✕</button>
      <div class="qtitle">Теория · ${TOPICS[theoryTopic].title}</div><div></div>
    </div>
    <div class="theory">${THEORY[theoryTopic]()}</div>
    <button class="btn primary wide" data-action="topic" data-topic="${theoryTopic}">Тренировка по теме</button>`;
}

/* ======================= События ======================= */

app.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const { action } = el.dataset;
  const q = quiz && quiz.qs[quiz.i];
  switch (action) {
    case 'home': show('home'); break;
    case 'ticket': startQuiz('ticket'); break;
    case 'mistakes': startQuiz('mistakes'); break;
    case 'topic': startQuiz('topic', el.dataset.topic); break;
    case 'theory': theoryTopic = el.dataset.topic; show('theory'); break;
    case 'again': startQuiz(quiz.mode, quiz.topic); break;
    case 'next': nextQuestion(); break;
    case 'play': playNotes(q.audio); break;
    case 'opt':
      if (quiz.picked === null) answer(+el.dataset.i === q.answer, +el.dataset.i);
      break;
    case 'tap': {
      if (quiz.picked !== null) break;
      const s = +el.dataset.s, f = +el.dataset.f;
      answer(q.cells.some(([cs, cf]) => cs === s && cf === f), [s, f]);
      break;
    }
    case 'reset':
      if (confirm('Сбросить статистику и ошибки?')) {
        db = { stats: {}, mistakes: {}, tickets: { passed: 0, total: 0 } };
        saveDb();
        show('home');
      }
      break;
  }
});

show('home');

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
