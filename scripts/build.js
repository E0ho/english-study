#!/usr/bin/env node
// notes/*.md → docs/data.json
// 의존성 없음. 사용: node scripts/build.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const NOTES_DIR = path.join(ROOT, 'notes');
const OUT_FILE = path.join(ROOT, 'docs', 'data.json');

const FIELD_MAP = { '뜻': 'meaning', '예문': 'example', '메모': 'note' };

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

function stableId(category, front) {
  return crypto.createHash('sha1').update(`${category}\u0000${front}`).digest('hex').slice(0, 10);
}

function parseNote(file, text, warnings) {
  const { meta, body } = parseFrontMatter(text);
  const cards = [];
  let category = null;
  let card = null;
  let lastField = null;

  const flush = () => {
    if (!card) return;
    if (!card.meaning) warnings.push(`${file}: "${card.front}" 에 뜻이 없습니다`);
    card.example = card.example.join('\n');
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
      continue;
    }
    if ((m = line.match(/^###\s+(.+)$/))) {
      flush();
      const front = m[1].trim();
      if (!category) {
        warnings.push(`${file}: "${front}" 위에 ## 카테고리가 없어 건너뜁니다`);
        card = null;
        continue;
      }
      card = {
        id: stableId(category, front),
        category, front,
        meaning: '', example: [], note: [],
        title: meta.title || path.basename(file, '.md'),
        source: meta.source || '',
        date: meta.date || '',
        tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : []),
      };
      continue;
    }
    if (!card) continue;
    if ((m = line.match(/^-\s*([^:：]+)\s*[:：]\s*(.*)$/))) {
      const key = FIELD_MAP[m[1].trim()];
      if (key) {
        const val = m[2].trim();
        if (key === 'meaning') card.meaning = card.meaning ? `${card.meaning} / ${val}` : val;
        else card[key].push(val);
        lastField = key;
        continue;
      }
    }
    // 들여쓴 이어지는 줄 → 직전 필드에 이어붙임
    if (lastField && lastField !== 'meaning' && line.trim()) {
      const arr = card[lastField];
      arr[arr.length - 1] = `${arr[arr.length - 1]}\n${line.trim()}`;
    }
  }
  flush();
  return cards;
}

function main() {
  if (!fs.existsSync(NOTES_DIR)) {
    console.error('notes/ 폴더가 없습니다');
    process.exit(1);
  }
  const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith('.md')).sort();
  const warnings = [];
  const seen = new Map();
  let cards = [];

  for (const f of files) {
    const text = fs.readFileSync(path.join(NOTES_DIR, f), 'utf8');
    for (const c of parseNote(f, text, warnings)) {
      if (seen.has(c.id)) {
        warnings.push(`${f}: "${c.front}" (${c.category}) 가 ${seen.get(c.id)} 와 중복되어 건너뜁니다`);
        continue;
      }
      seen.set(c.id, f);
      cards.push(c);
    }
  }

  cards.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const out = {
    builtAt: new Date().toISOString(),
    categories: [...new Set(cards.map(c => c.category))],
    cards,
  };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n');

  const byCat = {};
  for (const c of cards) byCat[c.category] = (byCat[c.category] || 0) + 1;
  console.log(`노트 ${files.length}개 → 카드 ${cards.length}개`);
  for (const [k, v] of Object.entries(byCat)) console.log(`  ${k}: ${v}`);
  for (const w of warnings) console.warn(`경고: ${w}`);
}

main();
