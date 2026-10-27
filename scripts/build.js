#!/usr/bin/env node
// notes/*.md   → docs/data.json     (단어·표현·패턴 카드)
// grammar/*.md → docs/grammar.json  (문법 개념 문서, HTML로 변환)
// 의존성 없음. 사용: node scripts/build.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const NOTES_DIR = path.join(ROOT, 'notes');
const GRAMMAR_DIR = path.join(ROOT, 'grammar');
const OUT_DATA = path.join(ROOT, 'docs', 'data.json');
const OUT_GRAMMAR = path.join(ROOT, 'docs', 'grammar.json');
const OUT_COURSE = path.join(ROOT, 'docs', 'course.json');
const CURRICULUM = require('./curriculum');
const COURSE_UNITS = new Map(CURRICULUM.flatMap(lv => lv.parts.flatMap(p => p.units.map(un => [un.n, { ...un, part: p.name, level: lv.level }]))));

const FIELD_MAP = { '뜻': 'meaning', '예문': 'example', '메모': 'note' };
const GRAMMAR_CATS = new Set(['문법']);
const CARD_CATS = new Set(['단어', '표현', '패턴']);

function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w가-힣]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let [, k, v] = kv;
    v = v.trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    }
    meta[k] = v;
  }
  return { meta, body: text.slice(m[0].length) };
}

const sha = (s, n) => crypto.createHash('sha1').update(s).digest('hex').slice(0, n);

// ───────── 카드 노트 ─────────
// "이름 (설명)" → { name, desc }
function parseGrammarRef(v) {
  const m = v.match(/^(.*?)\s*[（(]\s*(.*?)\s*[)）]\s*$/);
  return m ? { name: m[1].trim(), desc: m[2].trim() } : { name: v.trim(), desc: '' };
}

// "I {{ran into}} him." → { text: "I ran into him.", mark: "ran into" }
function splitMark(v) {
  const m = v.match(/\{\{(.+?)\}\}/);
  return { text: v.replace(/\{\{|\}\}/g, ''), mark: m ? m[1] : '' };
}

function parseNote(file, text, warnings) {
  const { meta, body } = parseFrontMatter(text);
  const cards = [];
  let category = null;
  let skipping = false;
  let card = null;
  let lastField = null;

  const flush = () => {
    if (!card) return;
    if (!card.meaning) warnings.push(`${file}: "${card.front}" 에 뜻이 없습니다`);
    if (card.examples.length < 2) warnings.push(`${file}: "${card.front}" 의 예문이 ${card.examples.length}개입니다. 2개 이상 필요합니다`);
    for (const ex of card.examples) if (!ex.mark) warnings.push(`${file}: "${card.front}" 예문 "${ex.en}" 에 {{정답}} 표시가 없어 시험에 나오지 않습니다`);
    for (const ex of card.examples) if (!ex.grammar.length) warnings.push(`${file}: "${card.front}" 예문 "${ex.en}" 에 문법 표시가 없습니다`);
    card.example = card.examples.map(e => `${e.en} ${e.ko}`).join('\n');
    card.note = card.note.join('\n');
    cards.push(card);
    card = null;
    lastField = null;
  };

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if ((m = line.match(/^##\s+(.+)$/))) {
      flush();
      category = m[1].trim();
      skipping = GRAMMAR_CATS.has(category);
      if (!skipping && !CARD_CATS.has(category)) warnings.push(`${file}: "${category}" 는 앱 메뉴에 없는 종류입니다. 단어, 표현, 패턴 중 하나를 쓰세요`);
      if (skipping) warnings.push(`${file}: "${category}" 는 카드가 아니라 grammar/ 폴더에 문서로 쓰세요. 이 섹션은 건너뜁니다`);
      continue;
    }
    if ((m = line.match(/^###\s+(.+)$/))) {
      flush();
      if (skipping) continue;
      const front = m[1].trim();
      if (!category) {
        warnings.push(`${file}: "${front}" 위에 ## 카테고리가 없어 건너뜁니다`);
        continue;
      }
      card = {
        id: sha(`${category}\u0000${front}`, 10),
        category, front,
        meaning: '', examples: [], note: [],
        title: meta.title || path.basename(file, '.md'),
        source: meta.source || '',
        date: meta.date || '',
        tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : []),
        unit: /^\d+$/.test(meta.unit || '') ? Number(meta.unit) : null,   // 교재 과 번호. 앱의 과별 범위
      };
      continue;
    }
    if (!card) continue;
    if ((m = line.match(/^\s+-\s*(해석|문법)\s*[:：]\s*(.*)$/)) && card.examples.length) {
      const ex = card.examples[card.examples.length - 1];
      if (m[1] === '해석') { const k = splitMark(m[2].trim()); ex.ko = k.text; ex.koMark = k.mark; }
      else ex.grammar.push(parseGrammarRef(m[2]));
      continue;
    }
    if ((m = line.match(/^-\s*([^:：]+)\s*[:：]\s*(.*)$/))) {
      const key = FIELD_MAP[m[1].trim()];
      if (key) {
        const val = m[2].trim();
        if (key === 'meaning') card.meaning = card.meaning ? `${card.meaning} / ${val}` : val;
        else if (key === 'example') { const e = splitMark(val); card.examples.push({ en: e.text, mark: e.mark, ko: '', koMark: '', grammar: [] }); }
        else card[key].push(val);
        lastField = key;
        continue;
      }
    }
    if (lastField === 'note' && line.trim()) {
      const arr = card.note;
      arr[arr.length - 1] = `${arr[arr.length - 1]}\n${line.trim()}`;
    }
  }
  flush();
  return cards;
}

// ───────── 마크다운 → HTML (문법 문서용 최소 변환기) ─────────
// 지원: ## ~ ####, 문단, 목록(2단계), 표, 인용(> = 예문 상자, "→ " 시작 줄 = 번역), 코드블록, 구분선, **굵게**, *기울임*, `코드`
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  return esc(s).split(/(`[^`]+`)/).map(p =>
    p.length > 1 && p.startsWith('`') && p.endsWith('`')
      ? `<code>${p.slice(1, -1)}</code>`
      : p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
         .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>')
  ).join('');
}

const LIST_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

function parseList(lines, i, indent) {
  const first = lines[i].match(LIST_RE);
  const tag = /\d/.test(first[2]) ? 'ol' : 'ul';
  let html = `<${tag}>`;
  while (i < lines.length) {
    const m = lines[i].match(LIST_RE);
    if (!m) break;
    const ind = m[1].length;
    if (ind < indent) break;
    if (ind > indent) {
      const [sub, ni] = parseList(lines, i, ind);
      html = html.endsWith('</li>') ? html.slice(0, -5) + sub + '</li>' : html + `<li>${sub}</li>`;
      i = ni;
      continue;
    }
    html += `<li>${inline(m[3])}</li>`;
    i++;
  }
  return [html + `</${tag}>`, i];
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (!line.trim()) { i++; continue; }

    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if ((m = line.match(/^(#{2,4})\s+(.*)$/))) {
      const lv = m[1].length;
      out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); i++; continue;
    }
    if (/^-{3,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push('<blockquote>' + buf.filter(t => t.trim()).map(t =>
        /^→/.test(t) ? `<p class="tr">${inline(t.replace(/^→\s*/, ''))}</p>` : `<p>${inline(t)}</p>`).join('') + '</blockquote>');
      continue;
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && SEP_RE.test(lines[i + 1])) {
      const head = cells(line); i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push('<div class="table-wrap"><table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if (LIST_RE.test(line)) {
      const [html, ni] = parseList(lines, i, line.match(LIST_RE)[1].length);
      out.push(html); i = ni; continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|>|```|\s*\|)/.test(lines[i]) && !LIST_RE.test(lines[i]) && !/^-{3,}\s*$/.test(lines[i])) {
      buf.push(lines[i].trim()); i++;
    }
    if (!buf.length) { buf.push(line.trim()); i++; }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

function readMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()
    .map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')]);
}

const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
// 문법 이름 → 문서 id. 제목/keywords 와 같거나, 이름이 keyword 로 시작하면 연결(가장 긴 것 우선)
function linkGrammar(name, articles) {
  const n = norm(name);
  let best = null, bestLen = 0;
  for (const a of articles) for (const k of a.keys) {
    if (n === k) return a.id;
    if (n.startsWith(k) && k.length > bestLen) { best = a.id; bestLen = k.length; }
  }
  return best;
}

function buildCards(warnings, articles) {
  const files = readMd(NOTES_DIR);
  const seen = new Map();
  const cards = [];
  for (const [f, text] of files) {
    for (const c of parseNote(f, text, warnings)) {
      if (seen.has(c.id)) {
        warnings.push(`${f}: "${c.front}" (${c.category}) 가 ${seen.get(c.id)} 와 중복되어 건너뜁니다`);
        continue;
      }
      seen.set(c.id, f);
      for (const ex of c.examples) for (const g of ex.grammar) g.articleId = linkGrammar(g.name, articles) || '';
      cards.push(c);
    }
  }
  cards.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  fs.mkdirSync(path.dirname(OUT_DATA), { recursive: true });
  fs.writeFileSync(OUT_DATA, JSON.stringify({
    builtAt: new Date().toISOString(),
    categories: [...new Set(cards.map(c => c.category))],
    cards,
  }, null, 2) + '\n');
  const byCat = {};
  for (const c of cards) byCat[c.category] = (byCat[c.category] || 0) + 1;
  console.log(`노트 ${files.length}개 → 카드 ${cards.length}개`);
  for (const [k, v] of Object.entries(byCat)) console.log(`  ${k}: ${v}`);
}

function buildGrammar(warnings) {
  const files = readMd(GRAMMAR_DIR);
  const articles = files.map(([f, text]) => {
    const { meta, body } = parseFrontMatter(text);
    if (!meta.title) warnings.push(`${f}: front matter 에 title 이 없어 파일명을 제목으로 씁니다`);
    return {
      id: sha(f, 8),
      title: meta.title || path.basename(f, '.md'),
      summary: meta.summary || '',
      date: meta.date || '',
      source: meta.source || '',
      tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : []),
      // 교재 순서. unit = 과 번호, part = 부 이름 (예: 1부 문장의 뼈대). 없으면 교재 밖 문서
      unit: /^\d+$/.test(meta.unit || '') ? Number(meta.unit) : null,
      part: meta.part || '',
      keys: [meta.title || '', ...(Array.isArray(meta.keywords) ? meta.keywords : (meta.keywords ? [meta.keywords] : []))].map(norm).filter(Boolean),
      html: mdToHtml(body),
    };
  });
  // 교재 문서는 과 순서대로 앞에, 나머지는 최신순으로 뒤에
  articles.sort((a, b) =>
    (a.unit != null || b.unit != null) ? (a.unit ?? Infinity) - (b.unit ?? Infinity)
      : (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));
  const units = new Map();
  for (const a of articles) {
    if (a.unit == null) { if (a.part) warnings.push(`"${a.title}" 에 part 만 있고 unit 이 없습니다`); continue; }
    if (units.has(a.unit)) warnings.push(`"${a.title}" 의 unit ${a.unit} 이 "${units.get(a.unit)}" 와 겹칩니다`);
    units.set(a.unit, a.title);
    const cu = COURSE_UNITS.get(a.unit);
    if (!cu) warnings.push(`"${a.title}" 의 unit ${a.unit} 이 scripts/curriculum.js 목차에 없습니다`);
    else if (a.part && a.part !== cu.part) warnings.push(`"${a.title}" 의 part "${a.part}" 가 목차의 "${cu.part}" 와 다릅니다`);
    if (cu) a.part = cu.part;   // 부 이름은 목차가 기준
  }
  fs.mkdirSync(path.dirname(OUT_GRAMMAR), { recursive: true });
  fs.writeFileSync(OUT_GRAMMAR, JSON.stringify({ builtAt: new Date().toISOString(), articles: articles.map(({ keys, ...a }) => a) }, null, 2) + '\n');
  console.log(`문법 문서 ${articles.length}편`);
  return articles;
}

// 목차 → docs/course.json. 과 번호가 겹치지 않는지 확인한다
function buildCourse(warnings) {
  const seen = new Map();
  for (const lv of CURRICULUM) for (const p of lv.parts) for (const un of p.units) {
    if (seen.has(un.n)) warnings.push(`목차의 과 번호 ${un.n} ("${un.title}") 이 "${seen.get(un.n)}" 와 겹칩니다`);
    seen.set(un.n, un.title);
  }
  fs.writeFileSync(OUT_COURSE, JSON.stringify({ builtAt: new Date().toISOString(), levels: CURRICULUM }, null, 2) + '\n');
  console.log(`목차 ${CURRICULUM.length}레벨 ${seen.size}과`);
}

const warnings = [];
if (!fs.existsSync(NOTES_DIR)) { console.error('notes/ 폴더가 없습니다'); process.exit(1); }
buildCourse(warnings);
buildCards(warnings, buildGrammar(warnings));
for (const w of warnings) console.warn(`경고: ${w}`);
