(() => {
  'use strict';

  // ───────── 저장소 ─────────
  const K_MARKS = 'eng-marks';        // { cardId: { fav: true, wrong: { 예문: true }, hist: { r, w } } }
  const K_SETTINGS = 'eng-settings';
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} if (k === K_MARKS || k === 'eng-days') syncSoon(); };

  const TYPES = ['단어', '표현', '패턴'];
  let data = { cards: [] };
  let grammar = { articles: [] };
  let course = { levels: [] };     // 목차: 레벨 → 부 → 과 (scripts/curriculum.js)
  let marks = load(K_MARKS, {});
  let settings = Object.assign({ mode: 'card' }, load(K_SETTINGS, {}));

  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel) => document.querySelector(sel);
  const svg = (d, cls) => `<svg viewBox="0 0 24 24"${cls ? ` class="${cls}"` : ''} aria-hidden="true"><path d="${d}"/></svg>`;
  const ICON = {
    card: svg('M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5zM9 12h6'),
    list: svg('M5 7h14M5 12h14M5 17h14'),
    chart: svg('M5 20V11M12 20V4M19 20v-6'),
    shuffle: svg('M4 7h3.5c5 0 5 10 10 10H20M4 17h3.5c1.6 0 2.6-1 3.5-2.4M20 7h-2.5c-1.6 0-2.6 1-3.5 2.4M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5'),
    left: svg('M14.5 5.5L8 12l6.5 6.5'),
    right: svg('M9.5 5.5L16 12l-6.5 6.5'),
    star: svg('M12 3.8l2.55 5.2 5.7.85-4.13 4.02.98 5.68L12 16.87l-5.1 2.68.98-5.68L3.75 9.85l5.7-.85z', 'fillable'),
    empty: svg('M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5zM12 9v6M9 12h6'),
    check: svg('M5 12.5l4.5 4.5L19 7.5'),
    x: svg('M6.5 6.5l11 11M17.5 6.5l-11 11'),
    sound: svg('M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11'),
    headphones: svg('M4.5 16v-3.5a7.5 7.5 0 0 1 15 0V16M4.5 15h2.5v5H5.5a1 1 0 0 1-1-1zM19.5 15H17v5h1.5a1 1 0 0 0 1-1z'),
    play: svg('M8 5.5v13l10.5-6.5z', 'fillable'),
    pause: svg('M8.5 5.5v13M15.5 5.5v13'),
    down: svg('M7 10l5 5 5-5'),
    chev: svg('M10 6.5l5.5 5.5-5.5 5.5'),
    book: svg('M12 6.5C10 5 7 4.6 4 5v13.5c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5zM12 6.5V20'),
    pen: svg('M5 19l1-4L16.5 4.5l3 3L9 18zM14.5 6.5l3 3'),
    moon: svg('M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z'),
  };
  // ───────── 학습한 날 (홈의 연속 학습일과 이번 주) ─────────
  const K_DAYS = 'eng-days';          // { 'YYYY-MM-DD': { sets: 오늘의 학습 완료 수, quiz: 시험 완료 수, n: 푼 문제, r: 맞힌 문제, lis: 끝까지 들은 카드 수 } }
  let days = load(K_DAYS, {});
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  function logDay(fn) {
    const k = dayKey();
    const d = days[k] || { sets: 0, quiz: 0, n: 0, r: 0 };
    fn(d); days[k] = d; save(K_DAYS, days);
  }
  const studied = (d) => { const x = days[dayKey(d)]; return !!(x && (x.sets || x.quiz || x.lis)); };
  // 연속 학습일. 오늘 아직 안 했으면 어제까지 이어진 날 수
  function streak() {
    let n = 0, i = studied(new Date()) ? 0 : 1;
    while (studied(daysAgo(i))) { n++; i++; }
    return n;
  }
  const isMarked = (c, key) => !!(marks[c.id] && marks[c.id][key]);
  function setMark(c, key, on) {
    const m = marks[c.id] || {};
    if (on) m[key] = true; else delete m[key];
    if (Object.keys(m).length) marks[c.id] = m; else delete marks[c.id];
    save(K_MARKS, marks);
    return on;
  }
  const toggleMark = (c, key) => setMark(c, key, !isMarked(c, key));
  // 오답노트: 시험에서 틀린 예문을 카드별로 기억한다. 그 예문을 맞히면 빠진다
  const isWrongEx = (c, ex) => !!(marks[c.id] && marks[c.id].wrong && marks[c.id].wrong[ex.en]);
  const isWrong = (c) => (c.examples || []).some(ex => isWrongEx(c, ex));
  function setWrong(c, ex, on) {
    const m = marks[c.id] || {};
    const w = m.wrong || {};
    if (on) w[ex.en] = true; else delete w[ex.en];
    if (Object.keys(w).length) m.wrong = w; else delete m.wrong;
    if (Object.keys(m).length) marks[c.id] = m; else delete marks[c.id];
    save(K_MARKS, marks);
  }
  // 시험 기록: 카드별 맞힌 횟수 r, 틀린 횟수 w
  const hist = (c) => (marks[c.id] && marks[c.id].hist) || { r: 0, w: 0 };
  // 복습 간격: 평가 버튼 없이 채점 결과로 정한다. 복습일에 맞히면 다음 칸(1→3→7→14→30→60일 뒤), 틀리면 처음부터(내일)
  // marks[id].rv = { b: 칸 0~6, d: 다음 복습일, t: 마지막으로 채점된 날 }. 복습일 전에 맞히면 칸은 그대로다
  const GAPS = [0, 1, 3, 7, 14, 30, 60];
  const addDays = (k, n) => { const d = new Date(`${k}T00:00`); d.setDate(d.getDate() + n); return dayKey(d); };
  function review(c) {
    const m = marks[c.id] || {};
    if (m.rv) return m.rv;
    const from = m.last || m.seen;   // 간격이 생기기 전 기록: 마지막으로 본 날 기준으로 잡는다
    if (!from) return null;
    const b = mastered(c) ? 2 : 0;
    return { b, d: addDays(from, GAPS[b] || 1), t: from };
  }
  const isDue = (c) => { const r = review(c); return !!r && r.d <= dayKey(); };
  function schedule(c, ok) {
    const m = marks[c.id] || {}, today = dayKey();
    const r = review(c) || { b: 0, d: today, t: '' };
    if (!ok) m.rv = { b: 0, d: addDays(today, 1), t: today };
    else if (r.d <= today && r.t !== today) { const b = Math.min(r.b + 1, GAPS.length - 1); m.rv = { b, d: addDays(today, GAPS[b]), t: today }; }
    else m.rv = r;
    marks[c.id] = m;
  }
  function addHist(c, ok) {
    schedule(c, ok);
    const m = marks[c.id];
    const h = m.hist || { r: 0, w: 0 };
    if (ok) h.r += 1; else h.w += 1;
    m.hist = h; m.last = dayKey(); marks[c.id] = m; save(K_MARKS, marks);
    logDay(d => { d.n += 1; if (ok) d.r += 1; });
  }
  // 배운 카드: 오늘의 학습에서 소개받았거나(seen) 시험에 한 번이라도 나온 카드
  const isSeen = (c) => !!(marks[c.id] && (marks[c.id].seen || marks[c.id].hist));
  function markSeen(c) {
    const m = marks[c.id] || {};
    if (m.seen) return;
    m.seen = dayKey();
    if (!m.rv) m.rv = { b: 0, d: m.seen, t: '' };   // 소개받은 날 바로 복습일. 그날 처음 맞히면 내일로 간다
    marks[c.id] = m; save(K_MARKS, marks);
  }
  // 필터: all | due (복습일이 된 카드) | recent (최근 7일 배운 카드) | wrong | fav | 단어 | 표현 | 패턴 | u3 (교재 3과) | self (교재 밖에서 직접 정리한 카드)
  const unitOf = (f) => /^u\d+$/.test(f) ? Number(f.slice(1)) : null;
  const isRecent = (c) => ((marks[c.id] || {}).seen || '') >= dayKey(daysAgo(6));
  const pool = (f) => data.cards.filter(c => f === 'all' ? true : f === 'due' ? isDue(c) : f === 'recent' ? isRecent(c) : f === 'wrong' ? isWrong(c) : f === 'fav' ? isMarked(c, f) : f === 'self' ? c.unit == null : unitOf(f) != null ? c.unit === unitOf(f) : c.category === f);
  const filterLabel = (f) => f === 'all' ? '전체' : f === 'due' ? '오늘 복습할 카드' : f === 'recent' ? '최근 7일 배운 카드' : f === 'wrong' ? '오답노트' : f === 'fav' ? '즐겨찾기' : f === 'self' ? '직접 정리한 카드' : unitOf(f) != null ? `${unitOf(f)}과` : f;
  const unitKeys = () => [...new Set(data.cards.map(c => c.unit).filter(u => u != null))].sort((a, b) => a - b).map(u => `u${u}`);
  // 목차의 모든 과를 순서대로. 각 과에 level, part 를 붙인다
  const allUnits = () => course.levels.flatMap(lv => lv.parts.flatMap(p => p.units.map(x => ({ ...x, level: lv.level, part: p.name }))));
  const unitInfo = (u) => allUnits().find(x => x.n === u);
  const unitTitle = (u) => {
    const info = unitInfo(u);
    if (info) return info.title;
    const a = grammar.articles.find(x => x.unit === u);
    if (a) return a.title;
    const c = data.cards.find(x => x.unit === u);
    return c ? c.title.replace(/^교재\s*\d+과\s*/, '') : `${u}과`;
  };
  const scopeName = (f) => unitOf(f) != null ? `${unitOf(f)}과 · ${unitTitle(unitOf(f))}` : filterLabel(f);
  // 범위 고르기: 칩 줄 대신 버튼 하나. 누르면 아래에서 묶음별 목록이 올라온다
  const scopeBtn = (id, f, n, unit = '') => `<button type="button" class="scope" id="${id}"><span>${esc(scopeName(f))}</span><b>${n}${unit}</b>${ICON.down}</button>`;
  function openScope(cur, count, pick) {
    const row = (k) => `<button type="button" class="sh-row${k === cur ? ' on' : ''}" data-f="${k}"><span>${esc(scopeName(k))}</span><b>${count(k)}</b>${k === cur ? ICON.check : '<i></i>'}</button>`;
    const groups = [['', ['all', ...['due', 'recent'].filter(k => pool(k).length), 'wrong', 'fav']], ['종류', TYPES.filter(t => pool(t).length)],
      ['교재', [...unitKeys(), ...(pool('self').length && unitKeys().length ? ['self'] : [])]]];
    openSheet(`<h3>범위</h3>${groups.filter(g => g[1].length).map(([t, ks]) => `${t ? `<div class="sh-g">${t}</div>` : ''}${ks.map(row).join('')}`).join('')}`,
      (sh, close) => sh.querySelectorAll('.sh-row').forEach(b => b.onclick = () => { close(); pick(b.dataset.f); }));
  }
  function openSheet(html, wire) {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
    const close = () => bg.remove();
    bg.onclick = (e) => { if (e.target === bg) close(); };
    document.body.appendChild(bg);
    wire(bg.querySelector('.sheet'), close);
  }
  const favBtn = (c, cls) => `<button class="${cls} ${isMarked(c, 'fav') ? 'on' : ''}" aria-label="즐겨찾기" aria-pressed="${isMarked(c, 'fav')}">${ICON.star}</button>`;
  // 별 버튼: 누르면 즐겨찾기를 켜고 끈다. after 는 바뀐 뒤 화면을 맞추는 콜백
  function wireFav(b, c, after) {
    b.onclick = (e) => {
      e.stopPropagation();
      const on = toggleMark(c, 'fav');
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
      toast(`즐겨찾기${on ? '에 추가했어요' : '에서 뺐어요'}`);
      if (after) after(on);
    };
  }
  // 표시한 부분을 감싸서 보여준다
  function withMark(text, mark, wrap) {
    const i = mark ? text.indexOf(mark) : -1;
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + wrap(text.slice(i, i + mark.length)) + esc(text.slice(i + mark.length));
  }

  // ───────── 발음 (브라우저 내장 음성) ─────────
  const TTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const RATES = [[0.75, '느리게'], [0.95, '보통'], [1.1, '빠르게']];
  const rate = () => Number(settings.rate) || 0.95;
  let voices = {};
  // 언어별로 가장 자연스러운 목소리를 고른다 (iOS의 고품질, 크롬의 Google 음성 우선)
  function pickVoices() {
    const all = speechSynthesis.getVoices();
    const best = (lang) => {
      const vs = all.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang));
      return vs.find(v => /enhanced|premium|natural|google/i.test(v.name)) || vs.find(v => v.localService) || vs[0] || null;
    };
    voices = { en: best('en-us') || best('en'), ko: best('ko') };
  }
  if (TTS) { pickVoices(); speechSynthesis.onvoiceschanged = pickVoices; }
  // 패턴의 ~ 와 ~ing, 대화 예문의 A: B: 는 읽지 않는다
  const sayText = (t) => String(t).replace(/~\w*/g, ' ').replace(/(^|\s)[A-Z]:(?=\s)/g, ' ').replace(/\s+([?.!,])/g, '$1').replace(/\s+/g, ' ').trim();
  // 다 읽으면 끝나는 Promise. 화면이 꺼져 onend 가 안 오는 경우를 대비해 넉넉한 시간이 지나면 끝난 것으로 본다
  function speak(text, lang = 'en', r) {
    return new Promise(done => {
      const t = sayText(text || '');
      if (!TTS || !t) return done();
      const u = new SpeechSynthesisUtterance(t);
      const v = voices[lang];
      if (v) u.voice = v;
      u.lang = v ? v.lang : lang === 'ko' ? 'ko-KR' : 'en-US';
      u.rate = r || (lang === 'en' ? rate() : 1);
      const timer = setTimeout(done, 3000 + t.length * 160 / u.rate);
      u.onend = u.onerror = () => { clearTimeout(timer); done(); };
      speechSynthesis.speak(u);
    });
  }
  // 버튼으로 듣기: 읽던 것을 끊고 새로 읽는다
  function say(text, lang, r) {
    if (!TTS) return Promise.resolve();
    stopListen();
    speechSynthesis.cancel();
    return speak(text, lang, r);
  }
  const sayBtn = (text, label = '') => TTS
    ? `<button type="button" class="say${label ? ' say-txt' : ''}" data-say="${esc(text)}" aria-label="발음 듣기">${ICON.sound}${label}</button>` : '';
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.say');
    if (b) say(b.dataset.say, 'en', Number(b.dataset.rate) || undefined);
  });
  const rateChips = (id) => `<div class="chips wrap" id="${id}">${RATES.map(([r, t]) => `<button data-r="${r}" class="${r === rate() ? 'active' : ''}">${t}</button>`).join('')}</div>`;
  function wireRate(id, after) {
    document.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => {
      settings.rate = Number(b.dataset.r); save(K_SETTINGS, settings);
      document.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle('active', x === b));
      if (after) after();
    });
  }

  // ───────── 카드 ─────────
  let filter = 'all';
  let query = '';
  let flipped = false;
  let returnTab = null;            // 카드에서 문법 문서로 넘어갔을 때 돌아올 탭
  const sessions = {};             // filter → { ids, idx }

  function session() {
    const p = pool(filter);
    const have = new Set(p.map(c => c.id));
    let s = sessions[filter];
    if (!s) s = sessions[filter] = { ids: p.map(c => c.id), idx: 0 };
    const kept = s.ids.filter(id => have.has(id));
    const keptSet = new Set(kept);
    s.ids = [...kept, ...p.filter(c => !keptSet.has(c.id)).map(c => c.id)];
    s.idx = Math.min(s.idx, Math.max(0, s.ids.length - 1));
    return s;
  }

  function renderCards() {
    const mode = settings.mode;
    const body = $('#cards-body');
    body.className = mode === 'card' ? 'mode-card' : '';
    body.innerHTML = `
      <header class="topbar">
        <h1>카드</h1>
        <div class="right">
          <div class="iseg" role="group" aria-label="보기 방식">
            <button data-mode="card" class="${mode === 'card' ? 'active' : ''}" aria-label="카드로 보기">${ICON.card}</button>
            <button data-mode="list" class="${mode === 'list' ? 'active' : ''}" aria-label="목록으로 보기">${ICON.list}</button>
          </div>
          ${TTS ? `<button class="icon-btn" id="open-listen" aria-label="듣기 모드">${ICON.headphones}</button>` : ''}
          <button class="icon-btn" id="open-stats" aria-label="기록·설정">${ICON.chart}</button>
        </div>
      </header>
      <div class="subbar"><div id="filters"></div><div id="sub-right"></div></div>
      <div id="cards-main"></div>`;
    $('#open-stats').onclick = () => showView('stats');
    if ($('#open-listen')) $('#open-listen').onclick = () => openListen(filter, 'cards');
    document.querySelectorAll('.iseg button').forEach(b => b.onclick = () => {
      settings.mode = b.dataset.mode; save(K_SETTINGS, settings); renderCards();
    });
    renderFilters();
    if (mode === 'card') renderStudy(); else renderList();
  }
  // 범위 버튼 하나. 누르면 범위 목록이 아래에서 올라온다
  function renderFilters() {
    $('#filters').innerHTML = scopeBtn('f-scope', filter, pool(filter).length, '장');
    $('#f-scope').onclick = () => openScope(filter, k => pool(k).length, (k) => { filter = k; renderCards(); });
  }
  const emptyText = () => filter === 'wrong' ? '오답노트가 비어 있어요' : filter === 'fav' ? '즐겨찾기한 카드가 없어요' : '아직 카드가 없어요';
  const emptyHint = () => filter === 'wrong' ? '시험에서 틀린 문제가 자동으로 들어오고, 다시 맞히면 빠집니다.' : filter === 'fav' ? '카드 오른쪽 위의 별을 누르면 추가됩니다.' : '공부한 내용을 정리해서 올리면 여기에 나타납니다.';
  const emptyHtml = () => `<div class="done"><div class="blob">${ICON.empty}</div><h2>${esc(emptyText())}</h2><p>${emptyHint()}</p></div>`;

  function examplesHtml(c) {
    const hi = (t) => `<mark>${esc(t)}</mark>`;
    return (c.examples || []).map(ex => `
      <div class="ex">
        <div class="en">${withMark(ex.en, ex.mark, hi)}${sayBtn(ex.en)}</div>
        ${ex.ko ? `<div class="ko">${withMark(ex.ko, ex.koMark, hi)}</div>` : ''}
        ${ex.grammar.length ? `<div class="gram">${ex.grammar.map(g => g.articleId
          ? `<a class="g-row" href="#g/${g.articleId}"><b>${esc(g.name)}</b>${esc(g.desc)}</a>`
          : `<span class="g-row"><b>${esc(g.name)}</b>${esc(g.desc)}</span>`).join('')}</div>` : ''}
      </div>`).join('');
  }
  const backHtml = (c) => `
    ${(c.examples || []).length ? `<div class="label">예문</div>${examplesHtml(c)}` : ''}
    ${c.note ? `<div class="label">메모</div><div class="note">${esc(c.note)}</div>` : ''}`;
  function wireGrammarLinks(root, from) {
    root.querySelectorAll('a.g-row').forEach(a => a.onclick = (e) => { e.stopPropagation(); returnTab = from; });
  }

  function renderStudy() {
    const main = $('#cards-main');
    const s = session();
    if (!s.ids.length) { $('#sub-right').innerHTML = ''; main.innerHTML = emptyHtml(); return; }
    const c = data.cards.find(x => x.id === s.ids[s.idx]);
    const last = s.idx === s.ids.length - 1;
    flipped = false;
    $('#sub-right').innerHTML = `<span>${s.idx + 1} / ${s.ids.length}</span><button class="icon-btn" id="btn-shuffle" aria-label="순서 섞기">${ICON.shuffle}</button>`;
    main.innerHTML = `
      <div class="progress"><div style="width:${(s.idx + 1) / s.ids.length * 100}%"></div></div>
      <div class="card-wrap">${favBtn(c, 'star')}
      <div class="card" id="card">
        <div class="type">${esc(c.category)}</div>
        <div class="front">${esc(c.front)}</div>
        ${sayBtn(c.front) && `<div class="front-say">${sayBtn(c.front)}</div>`}
        <div class="hint">탭해서 뜻과 예문 보기</div>
        <div class="back">
          ${c.meaning ? `<div class="meaning">${esc(c.meaning)}</div>` : ''}
          ${backHtml(c)}
          <div class="src">${esc(c.title)} · ${esc(c.date)}</div>
        </div>
      </div>
      </div>
      <div class="actions">
        <button id="btn-prev" aria-label="이전 카드" ${s.idx === 0 ? 'disabled' : ''}>${ICON.left}</button>
        <button class="primary" id="btn-next">${last ? '처음으로' : '다음'}${ICON.right}</button>
      </div>`;
    wireFav(main.querySelector('.star'), c, renderFilters);
    const card = $('#card');
    let sx = 0, sy = 0, swiped = false;
    card.onclick = (e) => { if (!e.target.closest('a, .say') && !swiped) flip(); };
    card.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiped = false; }, { passive: true });
    card.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; if (dx < 0) move(1); else if (s.idx > 0) move(-1); }
    }, { passive: true });
    wireGrammarLinks(main, 'cards');
    $('#btn-prev').onclick = () => move(-1);
    $('#btn-next').onclick = () => move(1);
    $('#btn-shuffle').onclick = () => { shuffle(s.ids); s.idx = 0; renderStudy(); toast('순서를 섞었어요'); };
  }
  function flip() {
    if (!$('#card')) return;
    flipped = !flipped;
    $('#card').classList.toggle('flipped', flipped);
    $('#card').scrollTop = 0;
  }
  function move(d) {
    const s = session();
    if (!s.ids.length) return;
    s.idx = (s.idx + d + s.ids.length) % s.ids.length;
    renderStudy();
  }
  document.addEventListener('keydown', (e) => {
    if (!$('#view-cards').classList.contains('active') || settings.mode !== 'card' || !$('#card')) return;
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ') { e.preventDefault(); flip(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') move(1);
    else if (e.key === 'ArrowLeft' && session().idx > 0) move(-1);
  });

  function renderList() {
    $('#sub-right').innerHTML = '';
    $('#cards-main').innerHTML = `
      <input id="search" type="search" placeholder="영어 또는 한국어로 검색" autocomplete="off" value="${esc(query)}">
      <div id="list-body"></div>`;
    $('#search').addEventListener('input', (e) => { query = e.target.value; fillList(); });
    fillList();
  }
  function fillList() {
    const q = query.trim().toLowerCase();
    const cards = pool(filter).filter(c => !q || [c.front, c.meaning, c.example, c.note, c.title].join(' ').toLowerCase().includes(q));
    const body = $('#list-body');
    if (!cards.length) { body.innerHTML = q ? `<div class="empty">검색 결과가 없어요</div>` : emptyHtml(); return; }
    const groups = new Map();
    for (const c of cards) {
      const key = `${c.date}|${c.title}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    let html = '';
    for (const [key, list] of groups) {
      const [date, title] = key.split('|');
      html += `<div class="group"><span>${esc(title)}</span><span>${esc(date)}</span></div>`;
      for (const c of list) {
        html += `<div class="item" data-id="${c.id}">
          <div class="row">
            <div class="txt"><div class="front">${esc(c.front)}<span class="tag">${esc(c.category)}</span></div><div class="sum">${esc(c.meaning)}</div></div>
            ${favBtn(c, 'mk')}
          </div>
          <div class="detail">${backHtml(c)}</div></div>`;
      }
    }
    body.innerHTML = html;
    wireGrammarLinks(body, 'cards');
    body.querySelectorAll('.item').forEach(el => {
      const c = data.cards.find(x => x.id === el.dataset.id);
      el.querySelector('.row').onclick = (e) => { if (!e.target.closest('.mk')) el.classList.toggle('open'); };
      wireFav(el.querySelector('.mk'), c, (on) => { renderFilters(); if (filter === 'fav' && !on) fillList(); });
    });
  }

  // ───────── 듣기 모드 ─────────
  // 카드 탭에서 고른 범위를 순서대로 읽어 준다: 앞면 → 뜻 → 예문마다 영어 → 해석 (→ 영어 한 번 더)
  // 화면을 보지 않고 출퇴근길에 듣는 용도. 카드 탭과 같은 순서(session)와 위치를 쓴다
  const listen = { on: false, step: 0, token: 0, lock: null, until: 0, tmin: 0, ret: 'cards' };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const TIMERS = [0, 10, 20, 30];   // 몇 분 뒤 멈춤. 0 은 끄기
  function listenSteps(c) {
    const ko = settings.listenKo !== false, twice = !!settings.listenTwice;
    const st = [{ lang: 'en', text: c.front, at: 'front' }];
    if (ko && c.meaning) st.push({ lang: 'ko', text: c.meaning, at: 'meaning' });
    (c.examples || []).forEach((ex, i) => {
      st.push({ lang: 'en', text: ex.en, at: i });
      if (ko && ex.ko) st.push({ lang: 'ko', text: ex.ko, at: i });
      if (twice) st.push({ lang: 'en', text: ex.en, at: i });
    });
    return st;
  }
  // 재생 중에는 화면이 꺼지지 않게 한다 (지원하는 브라우저만). 화면이 꺼지면 브라우저가 읽기를 멈춘다
  async function keepAwake(on) {
    try {
      if (on && !listen.lock && navigator.wakeLock) listen.lock = await navigator.wakeLock.request('screen');
      if (!on && listen.lock) { listen.lock.release(); listen.lock = null; }
    } catch {}
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && listen.on) { listen.lock = null; keepAwake(true); } });
  async function runListen(tok) {
    while (listen.on && tok === listen.token) {
      const s = session();
      if (!s.ids.length) { stopListen(); return paintListen(); }
      const c = data.cards.find(x => x.id === s.ids[s.idx]);
      const steps = listenSteps(c);
      if (listen.step >= steps.length) {
        // 한 장을 끝까지 들었다. 들은 날도 학습한 날로 친다 (연속 학습일 유지)
        logDay(d => { d.lis = (d.lis || 0) + 1; });
        listen.step = 0;
        const end = s.idx === s.ids.length - 1;
        s.idx = (s.idx + 1) % s.ids.length;
        if (listen.until && Date.now() >= listen.until) { listen.until = 0; stopListen(); toast('타이머가 끝나서 멈췄어요'); return paintListen(); }
        if (end && settings.listenOnce) { stopListen(); toast('끝까지 들었어요'); return paintListen(); }
        await wait(1000);
        continue;
      }
      paintListen();
      const st = steps[listen.step];
      await speak(st.text, st.lang);
      if (tok !== listen.token) return;
      await wait(st.lang === 'en' ? 800 : 500);
      if (tok !== listen.token) return;
      listen.step += 1;
    }
  }
  function stopListen() {
    if (!listen.on) return;
    listen.on = false; listen.token += 1;
    if (TTS) speechSynthesis.cancel();
    keepAwake(false);
  }
  // 재생 위치를 바꾸고, 재생 중이었으면 바뀐 위치부터 다시 읽는다
  function listenGo(change) {
    const was = listen.on;
    stopListen();
    change();
    if (was) startListen(); else paintListen();
  }
  function startListen() {
    listen.on = true; listen.token += 1;
    speechSynthesis.cancel();
    keepAwake(true);
    runListen(listen.token);
  }
  // 범위 f 를 처음부터 듣는다. from: 돌아갈 화면 (home | cards | course)
  function openListen(f, from = 'cards', autoplay = false) {
    filter = f; listen.ret = from; listen.step = 0;
    if (sessions[f]) sessions[f].idx = 0;
    showView('listen');
    if (autoplay && TTS) startListen();
  }
  const BACK = { home: '← 홈으로', cards: '← 카드로 돌아가기', course: '← 코스로' };
  function renderListen() {
    const left = listen.until ? Math.max(1, Math.ceil((listen.until - Date.now()) / 60000)) : 0;
    $('#listen-body').innerHTML = `
      <header class="topbar"><button class="back" id="l-back">${BACK[listen.ret] || BACK.cards}</button><button class="icon-btn" id="l-dim" aria-label="화면 어둡게">${ICON.moon}</button></header>
      <header class="topbar"><h1>듣기</h1><div class="right" id="l-count"></div></header>
      <div class="subbar" id="l-filters"></div>
      <div id="l-main"></div>
      <div class="label">읽는 방식</div>
      <div class="chips wrap" id="l-opts">
        <button data-o="listenKo" class="${settings.listenKo !== false ? 'active' : ''}">한국어 해석도 읽기</button>
        <button data-o="listenTwice" class="${settings.listenTwice ? 'active' : ''}">영어 한 번 더</button>
        <button data-o="listenOnce" class="${settings.listenOnce ? 'active' : ''}">끝나면 멈춤</button>
      </div>
      <div class="label">타이머</div>
      <div class="chips wrap" id="l-timer">${TIMERS.map(t => `<button data-t="${t}" class="${(left ? t === listen.tmin : !t) ? 'active' : ''}">${t ? `${t}분` : '끄기'}</button>`).join('')}</div>
      <div class="muted l-left" id="l-left">${left ? `${left}분 뒤 멈춰요 (듣던 카드는 끝까지 읽어요)` : ''}</div>
      <div class="label">속도</div>
      ${rateChips('l-rate')}
      <p class="muted l-note">화면이 꺼지면 브라우저가 읽기를 멈춰요. 재생 중에는 화면이 켜진 채로 유지돼요. 주머니에 넣을 때는 오른쪽 위 달 버튼으로 화면을 어둡게 해 두세요.</p>`;
    $('#l-back').onclick = () => selectTab(listen.ret === 'course' ? 'course' : listen.ret === 'home' ? 'home' : 'cards');
    $('#l-dim').onclick = openDim;
    const paintScope = () => {
      $('#l-filters').innerHTML = scopeBtn('l-scope', filter, pool(filter).length, '장');
      $('#l-scope').onclick = () => openScope(filter, k => pool(k).length, (k) => listenGo(() => { filter = k; listen.step = 0; paintScope(); }));
    };
    paintScope();
    $('#l-opts').querySelectorAll('button').forEach(b => b.onclick = () => {
      const k = b.dataset.o;
      const apply = () => {
        settings[k] = k === 'listenKo' ? settings.listenKo === false : !settings[k];
        save(K_SETTINGS, settings);
        b.classList.toggle('active', k === 'listenKo' ? settings.listenKo !== false : settings[k]);
      };
      if (k === 'listenOnce') return apply();   // 읽는 내용이 안 바뀌니 끊지 않는다
      listenGo(() => { apply(); listen.step = 0; });
    });
    $('#l-timer').querySelectorAll('button').forEach(b => b.onclick = () => {
      const t = Number(b.dataset.t);
      listen.until = t ? Date.now() + t * 60000 : 0; listen.tmin = t;
      $('#l-timer').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      $('#l-left').textContent = t ? `${t}분 뒤 멈춰요 (듣던 카드는 끝까지 읽어요)` : '';
    });
    wireRate('l-rate', () => listenGo(() => {}));
    paintListen();
  }
  // 화면 어둡게: 주머니에 넣고 들을 때. 검은 화면에 지금 읽는 표현만 흐리게 보이고, 두 번 톡 치면 재생·일시정지
  function openDim() {
    if ($('#dim')) return;
    const el = document.createElement('div');
    el.id = 'dim';
    el.innerHTML = `<button type="button" class="dim-close">밝게</button><div class="dim-txt" id="dim-txt"></div><div class="dim-hint">두 번 톡: 재생 · 일시정지</div>`;
    let lastTap = 0;
    el.addEventListener('click', (e) => {
      if (e.target.closest('.dim-close')) { el.remove(); return; }
      const now = Date.now();
      if (now - lastTap < 350) { lastTap = 0; if (listen.on) { stopListen(); paintListen(); } else startListen(); }
      else lastTap = now;
    });
    document.body.appendChild(el);
    paintListen();
  }
  function paintListen() {
    const main = $('#l-main');
    if (!main) return;
    const s = session();
    $('#l-count').textContent = s.ids.length ? `${s.idx + 1} / ${s.ids.length}` : '';
    if (!s.ids.length) { main.innerHTML = emptyHtml(); if ($('#dim-txt')) $('#dim-txt').textContent = ''; return; }
    const c = data.cards.find(x => x.id === s.ids[s.idx]);
    const at = listen.on || listen.step ? (listenSteps(c)[listen.step] || {}).at : null;
    const now = (k) => at === k ? ' now' : '';
    if ($('#dim-txt')) $('#dim-txt').innerHTML = `${esc(c.front)}<small>${listen.on ? `${s.idx + 1} / ${s.ids.length}` : '일시정지'}</small>`;
    main.innerHTML = `
      <div class="progress"><div style="width:${(s.idx + 1) / s.ids.length * 100}%"></div></div>
      <div class="q-card l-card">
        <div class="type">${esc(c.category)}${c.unit != null ? ` · ${c.unit}과` : ''}</div>
        <div class="l-front${now('front')}">${esc(c.front)}</div>
        ${c.meaning ? `<div class="l-meaning${now('meaning')}">${esc(c.meaning)}</div>` : ''}
        ${(c.examples || []).map((ex, i) => `<div class="l-ex${now(i)}"><div class="en">${esc(ex.en)}</div>${ex.ko ? `<div class="ko">${esc(ex.ko)}</div>` : ''}</div>`).join('')}
      </div>
      <div class="l-ctrl">
        <button id="l-prev" aria-label="이전 카드">${ICON.left}</button>
        <button class="primary" id="l-play" aria-label="${listen.on ? '일시정지' : '재생'}">${listen.on ? ICON.pause : ICON.play}</button>
        <button id="l-next" aria-label="다음 카드">${ICON.right}</button>
      </div>`;
    const step = (d) => listenGo(() => { s.idx = (s.idx + d + s.ids.length) % s.ids.length; listen.step = 0; });
    $('#l-prev').onclick = () => step(-1);
    $('#l-next').onclick = () => step(1);
    $('#l-play').onclick = () => { if (listen.on) { stopListen(); paintListen(); } else startListen(); };
  }

  // ───────── 연습 (문제 풀기) ─────────
  // 문제마다 방식이 다를 수 있다. 오늘의 학습은 소개 → 문장 조립 → 빈칸 → 영작 → 받아쓰기를 섞어서 낸다
  const QUIZ_MAX = 10;
  let quizSource = 'all';
  const MODES = {
    intro: ['새 표현', '표현을 먼저 보고, 발음을 들어 보세요.'],
    order: ['문장 조립', '해석을 보고 단어를 순서대로 눌러 문장을 완성하세요.'],
    type: ['빈칸 채우기', '예문의 빈칸에 들어갈 말을 맞혀 보세요. 해석에서 강조된 부분이 빈칸의 뜻입니다. 원형이나 작은 오타도 정답으로 봅니다.'],
    choice: ['보기 고르기', '예문의 빈칸에 들어갈 말을 보기에서 고르세요.'],
    write: ['영작', '해석을 보고 영어 문장 전체를 써 보세요. 대소문자와 문장부호는 안 봐요. 작은 오타는 정답으로 봅니다.'],
    listen: ['받아쓰기', '문장을 듣고 빈칸에 들린 말을 그대로 써 보세요. 작은 오타는 정답으로 봅니다. 소리를 켜 주세요.'],
  };
  const QUIZ_MODES = ['order', 'write', 'type', 'choice', ...(TTS ? ['listen'] : [])];
  let quizMode = load('quizMode', 'order');
  if (!QUIZ_MODES.includes(quizMode)) quizMode = 'order';
  let quiz = null;                 // { items: [{ card, ex, mode }], idx, results: [{ ok, v, given }], answered, daily, title }
  const norm = (s) => s.toLowerCase().replace(/['’‘`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();   // Im = I'm
  function editDistance(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  const tolerance = (len) => len <= 5 ? 0 : len <= 10 ? 1 : len <= 24 ? 2 : Math.floor(len / 12);   // 허용하는 오타 글자 수
  // 답을 정답들과 비교해 exact | base | near | wrong 을 돌려준다
  function judge(given, answers) {
    const g = norm(given);
    if (!g) return 'wrong';
    const [mark, base] = answers.map(norm);
    if (g === mark) return 'exact';
    if (base && g === base) return 'base';
    return answers.some(a => editDistance(g, norm(a)) <= tolerance(norm(a).length)) ? 'near' : 'wrong';
  }
  const quizItems = (f) => pool(f).flatMap(c => (c.examples || []).filter(ex => ex.mark && ex.en.includes(ex.mark) && (f !== 'wrong' || isWrongEx(c, ex))).map(ex => ({ card: c, ex })));
  const baseForm = (c) => c.front.replace(/~/g, ' ');   // 카드 앞면의 원형. 패턴은 ~ 를 뺀 고정 부분
  const startQuiz = () => {
    const items = pickWeighted(quizItems(quizSource), QUIZ_MAX).map(it => ({ ...it, mode: quizMode }));   // 오답노트를 다 맞혀 비었으면 시작 화면으로
    quiz = items.length ? { items, idx: 0, results: [], answered: false, title: `${MODES[quizMode][0]} · ${scopeName(quizSource)}` } : null;
    renderQuiz();
  };
  // 많이 틀린 카드(틀림 2배 - 맞힘, 오답노트 +3)에 가중치를 줘서 n개를 뽑는다
  function pickWeighted(items, n) {
    const left = items.map(it => ({ it, w: 1 + Math.max(0, hist(it.card).w * 2 - hist(it.card).r + (isWrongEx(it.card, it.ex) ? 3 : 0)) }));
    const out = [];
    while (left.length && out.length < n) {
      let r = Math.random() * left.reduce((a, x) => a + x.w, 0), i = 0;
      while (i < left.length - 1 && (r -= left[i].w) > 0) i++;
      out.push(left.splice(i, 1)[0].it);
    }
    return out;
  }
  // 보기: 정답 + 오답 3개. 정답과 모양(단어 수, 활용형, 대소문자)이 비슷한 것을 먼저 고르고, 원형이 다르면 원형도 오답으로 넣는다
  function quizOptions(c, ex) {
    const cap = /^I\b/.test(ex.mark) ? ex.en.startsWith(ex.mark) : /^[A-Z]/.test(ex.mark);
    const fit = (s) => cap ? s[0].toUpperCase() + s.slice(1) : /^I\b/.test(s) ? s : s[0].toLowerCase() + s.slice(1);
    const shape = (m) => { const w = m.trim().split(/\s+/); return { n: w.length, ing: /ing\b/.test(w[0]), ed: /ed\b/.test(w[0]), i: /^I\b/.test(m) }; };
    const sh = shape(ex.mark);
    const score = (o, m) => { const t = shape(m); return (o.category === c.category) + (t.n === sh.n) * 2 + (t.ing === sh.ing) + (t.ed === sh.ed) + (t.i === sh.i) + Math.random(); };
    const seen = new Set([norm(ex.mark)]);
    const opts = [ex.mark];
    const base = baseForm(c).trim();
    if (!seen.has(norm(base))) { seen.add(norm(base)); opts.push(fit(base)); }
    const cands = data.cards.filter(o => o.id !== c.id)
      .flatMap(o => (o.examples || []).map(e => e.mark).filter(Boolean).map(m => ({ m, s: score(o, m) })))
      .sort((a, b) => b.s - a.s);
    for (const { m } of cands) {
      if (seen.has(norm(m))) continue;
      seen.add(norm(m)); opts.push(fit(m));
      if (opts.length === 4) break;
    }
    return shuffle(opts);
  }

  // ───────── 오늘의 학습 ─────────
  // 지금 공부할 과: 아직 안 본 카드가 남은 첫 과. 다 봤으면 정답 기록이 가장 적은 과
  const unitCards = (u) => pool(`u${u}`);
  const unitSeen = (u) => unitCards(u).filter(isSeen).length;
  const mastered = (c) => hist(c).r >= 2 && hist(c).r > hist(c).w;
  const unitDone = (u) => unitCards(u).length > 0 && unitCards(u).every(mastered);
  function currentUnit() {
    const units = unitKeys().map(unitOf);   // 카드가 있는 과만, 번호순
    if (!units.length) return null;
    return units.find(u => unitSeen(u) < unitCards(u).length) ?? units.find(u => !unitDone(u)) ?? units[units.length - 1];
  }
  const DAILY_NEW = 3;
  const randomEx = (c) => c.examples[Math.random() * c.examples.length | 0];
  const okEx = (c) => (c.examples || []).filter(ex => ex.mark && ex.en.includes(ex.mark));
  // 오늘의 학습 한 세트: 새 표현 소개 → 새 표현으로 문장 조립 → 오답·복습 빈칸 → 복습 영작 → 받아쓰기
  function dailyItems() {
    const u = currentUnit();
    const fresh = (u != null ? unitCards(u) : data.cards).filter(c => !isSeen(c) && okEx(c).length).slice(0, DAILY_NEW);
    const old = shuffle(data.cards.filter(c => isSeen(c) && okEx(c).length && !fresh.includes(c)));
    const items = [];
    fresh.forEach(c => items.push({ card: c, ex: okEx(c)[0], mode: 'intro' }));
    fresh.forEach(c => items.push({ card: c, ex: okEx(c)[0], mode: 'order' }));
    const wrong = shuffle(quizItems('wrong')).slice(0, 3);
    wrong.forEach(it => items.push({ ...it, mode: 'type' }));
    const used = new Set([...fresh, ...wrong.map(it => it.card)]);
    const take = (n, mode, from) => { for (const c of from) { if (used.has(c)) continue; used.add(c); items.push({ card: c, ex: shuffle(okEx(c))[0], mode }); if (--n <= 0) break; } };
    // 복습은 복습일이 된 카드부터 (오래 밀린 것, 낮은 칸 먼저). 모자라면 복습일이 가까운 카드로 채운다
    const rk = (c) => review(c) || { b: 0, d: '' };
    const due = old.filter(isDue).sort((a, b) => rk(a).d.localeCompare(rk(b).d) || rk(a).b - rk(b).b);
    const stale = [...due, ...old.filter(c => !isDue(c)).sort((a, b) => rk(a).d.localeCompare(rk(b).d))];
    const extra = Math.min(4, Math.max(0, due.length - 7));   // 밀린 복습이 많으면 빈칸을 몇 개 더
    take(Math.max(1, 3 - wrong.length) + extra, 'type', stale);
    take(2, 'write', stale);
    if (TTS) take(2, 'listen', stale);
    // 배운 게 아직 적으면 새 표현으로 한 번 더 연습한다
    if (old.length < 3) fresh.forEach(c => { const ex = okEx(c)[1] || okEx(c)[0]; items.push({ card: c, ex, mode: 'type' }); if (TTS) items.push({ card: c, ex: okEx(c)[0], mode: 'listen' }); });
    return { unit: u, fresh, items, due: pool('due').length };
  }
  function startDaily() {
    const d = dailyItems();
    if (!d.items.length) return toast('공부할 카드가 없어요');
    quiz = { items: d.items, idx: 0, results: [], answered: false, daily: true, title: d.unit != null ? `${d.unit}과 · ${unitTitle(d.unit)}` : '오늘의 학습' };
    selectTab('quiz', false, true);
    renderQuiz();
  }

  function renderQuiz() {
    if (!quiz) return renderQuizStart();
    if (quiz.idx >= quiz.items.length) return renderQuizResult();
    renderQuizQuestion();
  }
  function renderQuizStart() {
    const n = quizItems(quizSource).length;
    $('#quiz-body').innerHTML = `
      <header class="topbar"><h1>연습</h1></header>
      <div class="label">방식</div>
      <div class="chips wrap" id="q-mode">${QUIZ_MODES.map(k => `<button data-m="${k}" class="${k === quizMode ? 'active' : ''}">${MODES[k][0]}</button>`).join('')}</div>
      <p class="lead">${MODES[quizMode][1]}</p>
      <div class="label">범위</div>
      <div class="subbar">${scopeBtn('q-scope', quizSource, n, '문제')}</div>
      <div class="q-start">
        <div class="big">${Math.min(n, QUIZ_MAX)}<small>문제</small></div>
        <div class="muted">${n > QUIZ_MAX ? `${n}개 중에서 ${QUIZ_MAX}개를 뽑아요` : n ? '고른 범위의 예문 전부' : '이 범위에는 낼 문제가 없어요'}</div>
        <button class="cta" id="q-go" ${n ? '' : 'disabled'}>시작</button>
      </div>`;
    $('#q-scope').onclick = () => openScope(quizSource, k => quizItems(k).length, (k) => { quizSource = k; renderQuizStart(); });
    $('#q-mode').querySelectorAll('button').forEach(b => b.onclick = () => { quizMode = b.dataset.m; save('quizMode', quizMode); renderQuizStart(); });
    $('#q-go').onclick = startQuiz;
  }
  const quizHead = () => `
      <header class="topbar"><button class="back" id="q-quit">${quiz.daily ? '그만하기' : '그만하기'}</button><div class="right">${quiz.idx + 1} / ${quiz.items.length}</div></header>
      <div class="progress"><div style="width:${quiz.idx / quiz.items.length * 100}%"></div></div>`;
  const wireQuit = () => { $('#q-quit').onclick = () => { const d = quiz.daily; quiz = null; if (d) selectTab('home'); else renderQuiz(); }; };
  // 문장 배열: 해석만 보여 주고, 섞인 단어를 눌러 예문 전체를 순서대로 만든다
  // 대화 예문의 화자 표시(A: B:)와 문장부호는 뺀다
  function orderTokens(ex) {
    const t = ex.en.trim().split(/\s+/).filter(x => !/^[A-Z]:$/.test(x)).map(x => x.replace(/^["“(]+|[.,!?;:"”)]+$/g, '')).filter(Boolean);
    if (t.length && !/^I\b/.test(t[0])) t[0] = t[0][0].toLowerCase() + t[0].slice(1);   // 첫 단어가 대문자로 드러나지 않게
    return t;
  }
  // 새 표현 소개: 앞면, 뜻, 예문을 보여 주고 발음을 들려준다
  function renderIntro() {
    const { card: c } = quiz.items[quiz.idx];
    markSeen(c);
    quiz.answered = true;
    $('#quiz-body').innerHTML = `${quizHead()}
      <div class="q-card">${favBtn(c, 'star')}
        <div class="type">새 표현 · ${esc(c.category)}</div>
        <div class="q-front">${esc(c.front)}${sayBtn(c.front)}</div>
        <div class="q-meaning">${esc(c.meaning)}</div>
        <div class="label">예문</div>${examplesHtml(c)}
        ${c.note ? `<div class="label">메모</div><div class="note">${esc(c.note)}</div>` : ''}
      </div>
      <button class="cta block" id="q-next">알겠어요</button>`;
    wireQuit(); wireFav($('#quiz-body .star'), c); wireGrammarLinks($('#quiz-body'), 'quiz');
    if (TTS) say(c.front);
    $('#q-next').onclick = () => { quiz.results.push({ intro: true }); quiz.idx += 1; renderQuiz(); window.scrollTo(0, 0); };
  }
  function renderOrderQuestion() {
    const { card: c, ex } = quiz.items[quiz.idx];
    const words = orderTokens(ex);
    let bank = shuffle(words.map((_, i) => i));
    if (words.length > 1 && bank.every((v, i) => v === i)) bank.push(bank.shift());
    const picked = [];
    quiz.answered = false;
    $('#quiz-body').innerHTML = `${quizHead()}
      <div class="q-card">${favBtn(c, 'star')}
        <div class="type">문장 조립 · 단어 ${words.length}개</div>
        <div class="q-en" id="q-en"></div>
        <div class="q-ko lg">${esc(ex.ko || c.meaning)}</div>
        ${quiz.daily ? `<div class="q-hint">표현: <mark>${esc(c.front)}</mark></div>` : ''}
      </div>
      <div id="q-answer">
        <div class="o-line" id="o-line"></div>
        <div class="o-bank" id="o-bank"></div>
        <div class="q-btns"><button type="button" class="ghost" id="q-skip">정답 보기</button><button type="button" class="cta" id="o-check">확인</button></div>
      </div>`;
    const paint = () => {
      $('#o-line').innerHTML = picked.length ? picked.map((i, n) => `<button type="button" data-n="${n}">${esc(words[i])}</button>`).join('') : '<span>아래 단어를 순서대로 누르세요</span>';
      $('#o-bank').innerHTML = bank.map(i => `<button type="button" data-i="${i}" ${picked.includes(i) ? 'disabled' : ''}>${esc(words[i])}</button>`).join('');
      $('#o-line').querySelectorAll('button').forEach(b => b.onclick = () => { picked.splice(+b.dataset.n, 1); paint(); });
      $('#o-bank').querySelectorAll('button').forEach(b => b.onclick = () => { picked.push(+b.dataset.i); paint(); });
    };
    paint();
    wireQuit();
    $('#q-skip').onclick = () => grade('', true);
    wireFav($('#quiz-body .star'), c);
    $('#o-check').onclick = () => {
      if (picked.length < words.length) { $('#o-line').classList.add('shake'); setTimeout(() => $('#o-line') && $('#o-line').classList.remove('shake'), 300); return; }
      grade(picked.map(i => words[i]).join(' '));
    };
  }
  // 영작: 해석을 보고 문장 전체를 쓴다. 힌트로 표현의 원형을 보여 준다
  function renderWriteQuestion() {
    const { card: c, ex } = quiz.items[quiz.idx];
    quiz.answered = false;
    $('#quiz-body').innerHTML = `${quizHead()}
      <div class="q-card">${favBtn(c, 'star')}
        <div class="type">영작 · 단어 ${ex.en.trim().split(/\s+/).length}개</div>
        <div class="q-en" id="q-en"></div>
        <div class="q-ko lg">${esc(ex.ko || c.meaning)}</div>
        <div class="q-hint">표현: <mark>${esc(c.front)}</mark></div>
      </div>
      <div id="q-answer">
        <form id="q-form" autocomplete="off">
          <textarea id="q-input" rows="2" placeholder="영어 문장을 써 보세요" autocapitalize="sentences" autocorrect="off" spellcheck="false" enterkeyhint="done"></textarea>
          <div class="q-btns"><button type="button" class="ghost" id="q-skip">정답 보기</button><button type="submit" class="cta">확인</button></div>
        </form>
      </div>`;
    wireQuit();
    $('#q-skip').onclick = () => grade('', true);
    wireFav($('#quiz-body .star'), c);
    $('#q-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#q-form').requestSubmit(); } });
    $('#q-form').onsubmit = (e) => {
      e.preventDefault();
      const v = $('#q-input').value;
      if (!v.trim()) { $('#q-input').classList.add('shake'); setTimeout(() => $('#q-input') && $('#q-input').classList.remove('shake'), 300); return; }
      grade(v);
    };
  }
  function renderQuizQuestion() {
    const it = quiz.items[quiz.idx];
    if (it.mode === 'intro') return renderIntro();
    if (it.mode === 'order') return renderOrderQuestion();
    if (it.mode === 'write') return renderWriteQuestion();
    const { card: c, ex } = it;
    const words = ex.mark.trim().split(/\s+/).length;
    const blank = `<span class="blank">${Array.from({ length: words }, () => '<i></i>').join('')}</span>`;
    quiz.answered = false;
    const opts = it.mode === 'choice' ? quizOptions(c, ex) : [];
    const choice = opts.length > 1;   // 보기를 만들 카드가 모자라면 타이핑으로 낸다
    const dict = it.mode === 'listen';
    const koHtml = `<div class="q-ko">${withMark(ex.ko || c.meaning, ex.koMark, t => `<mark>${esc(t)}</mark>`)}</div>
        ${ex.koMark ? '' : `<div class="q-hint">뜻: <mark>${esc(c.meaning)}</mark></div>`}`;
    $('#quiz-body').innerHTML = `${quizHead()}
      <div class="q-card">${favBtn(c, 'star')}
        <div class="type">${dict ? '받아쓰기' : `빈칸 채우기 · ${esc(c.category)}`} · 단어 ${words}개</div>
        <div class="q-en" id="q-en">${withMark(ex.en, ex.mark, () => blank)}</div>
        ${dict ? `<div class="q-listen">
          <button type="button" class="ghost" id="q-play">${ICON.sound}다시 듣기</button>
          <button type="button" class="ghost" id="q-slow">느리게</button>
          <button type="button" class="ghost" id="q-ko-show">해석 보기</button>
        </div><div id="q-ko-box" hidden>${koHtml}</div>` : koHtml}
      </div>
      <div id="q-answer">${choice ? `
        <div class="q-opts">${opts.map(o => `<button type="button" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>
        <button type="button" class="ghost block" id="q-skip">정답 보기</button>` : `
        <form id="q-form" autocomplete="off">
          <input id="q-input" type="text" inputmode="text" placeholder="빈칸에 들어갈 말" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
          <div class="q-btns"><button type="button" class="ghost" id="q-skip">정답 보기</button><button type="submit" class="cta">확인</button></div>
        </form>`}
      </div>`;
    wireQuit();
    $('#q-skip').onclick = () => grade('', true);
    wireFav($('#quiz-body .star'), c);
    if (dict) {
      $('#q-play').onclick = () => say(ex.en);
      $('#q-slow').onclick = () => say(ex.en, 'en', 0.7);
      $('#q-ko-show').onclick = (e) => { $('#q-ko-box').hidden = false; e.currentTarget.remove(); };
      say(ex.en);
    }
    if (choice) { $('#quiz-body').querySelectorAll('.q-opts button').forEach(b => b.onclick = () => grade(b.dataset.v)); return; }
    $('#q-form').onsubmit = (e) => {
      e.preventDefault();
      const v = $('#q-input').value;
      if (!v.trim()) { $('#q-input').classList.add('shake'); setTimeout(() => $('#q-input') && $('#q-input').classList.remove('shake'), 300); return; }
      grade(v);
    };
  }
  // reveal: 정답 보기. 채점하지 않고 정답을 보여 주며 오답노트에 넣는다
  function grade(given, reveal) {
    if (quiz.answered) return;
    quiz.answered = true;
    const { card: c, ex, mode } = quiz.items[quiz.idx];
    const whole = mode === 'order' || mode === 'write';   // 문장 전체가 답
    const answers = mode === 'listen' ? [ex.mark] : [ex.mark, baseForm(c)];   // 받아쓰기는 들린 형태 그대로만
    const v = reveal ? 'reveal'
      : mode === 'order' ? (norm(given) === norm(orderTokens(ex).join(' ')) ? 'exact' : 'wrong')
      : mode === 'write' ? judge(given, [ex.en])
      : judge(given, answers);
    const ok = v === 'exact' || v === 'base' || v === 'near';   // 원형이나 오타 1~2개도 정답
    quiz.results.push({ ok, v, given });
    const wasWrong = isWrongEx(c, ex);
    setWrong(c, ex, !ok);   // 틀리면 오답노트에 넣고, 맞히면 뺀다
    addHist(c, ok);
    const last = quiz.idx === quiz.items.length - 1;
    const HEAD = { exact: '맞았어요', base: '원형으로 맞았어요', near: '거의 맞았어요', wrong: '아쉬워요', reveal: '정답이에요' };
    $('#q-en').innerHTML = withMark(ex.en, ex.mark, t => `<mark class="${ok ? 'ok' : 'no'}">${esc(t)}</mark>`) + sayBtn(ex.en);
    if ($('#q-ko-box')) { $('#q-ko-box').hidden = false; $('.q-listen').remove(); }
    if (TTS && whole && !reveal) say(ex.en);   // 완성한 문장을 들려준다
    $('#q-answer').innerHTML = `
      <div class="q-result ${ok ? 'ok' : 'no'}">
        <div class="head">${ok ? ICON.check : ICON.x}<b>${HEAD[v]}</b></div>
        ${v === 'wrong' || v === 'near' ? `<div class="given ${v}">내 답: ${esc(given)}</div>` : ''}
        ${v === 'exact' || whole ? '' : `<div class="used">이 문장에서는 <b>${esc(ex.mark)}</b></div>`}
        <div class="ans"><b>${esc(c.front)}</b> ${esc(c.meaning)}</div>
        ${ex.grammar.length ? `<div class="gram">${ex.grammar.map(g => g.articleId
          ? `<a class="g-row" href="#g/${g.articleId}"><b>${esc(g.name)}</b>${esc(g.desc)}</a>`
          : `<span class="g-row"><b>${esc(g.name)}</b>${esc(g.desc)}</span>`).join('')}</div>` : ''}
        ${!ok ? `<div class="wn">오답노트에 넣었어요</div>` : wasWrong ? `<div class="wn">오답노트에서 뺐어요</div>` : ''}${v === 'near' ? `<div class="wn">오타로 봐서 정답 처리했어요</div>` : ''}
      </div>
      <button class="cta block" id="q-next">${last ? '결과 보기' : '다음'}</button>`;
    $('#q-next').onclick = () => { quiz.idx += 1; renderQuiz(); window.scrollTo(0, 0); };
    wireGrammarLinks($('#q-answer'), 'quiz');
    $('#q-next').focus({ preventScroll: true });
  }
  function renderQuizResult() {
    const graded = quiz.items.map((it, i) => ({ it, r: quiz.results[i] })).filter(x => x.r && !x.r.intro);
    const total = graded.length;
    const right = graded.filter(x => x.r.ok).length;
    const wrong = graded.filter(x => !x.r.ok);
    const nReveal = wrong.filter(x => x.r.v === 'reveal').length, nWrong = wrong.length - nReveal;
    const fresh = quiz.items.filter(it => it.mode === 'intro').map(it => it.card);
    if (!quiz.logged) { quiz.logged = true; logDay(d => { if (quiz.daily) d.sets += 1; else d.quiz += 1; }); }
    const st = streak();
    $('#quiz-body').innerHTML = `
      <header class="topbar"><h1>${quiz.daily ? '오늘의 학습 완료' : '결과'}</h1></header>
      <div class="q-start">
        <div class="big">${right}<small>/ ${total}</small></div>
        <div class="muted">${right === total ? '전부 맞았어요' : [nWrong && `틀림 ${nWrong}`, nReveal && `정답 봄 ${nReveal}`].filter(Boolean).join(' · ')}</div>
        ${quiz.daily ? `<div class="streak-big">🔥 ${st}일 연속</div>` : ''}
      </div>
      ${fresh.length ? `<div class="label">오늘 새로 배운 표현</div>${fresh.map(c => `
        <div class="item"><div class="row static"><div class="txt"><div class="front">${esc(c.front)}</div><div class="sum">${esc(c.meaning)}</div></div></div></div>`).join('')}` : ''}
      ${wrong.length ? `<div class="label">놓친 문제</div>${wrong.map(({ it, r }) => `
        <div class="item"><div class="row static"><div class="txt">
          <div class="front">${esc(it.card.front)}<span class="tag">${r.v === 'reveal' ? '정답 봄' : '틀림'}</span></div>
          <div class="sum wrap">${withMark(it.ex.en, it.ex.mark, t => `<mark>${esc(t)}</mark>`)}</div>
        </div></div></div>`).join('')}
        <div class="muted center">놓친 문제는 오답노트에 들어 있어요. 다시 맞히면 빠집니다.</div>` : ''}
      ${quiz.daily ? `<button class="cta block" id="q-home">홈으로</button><button class="btn" id="q-again">한 세트 더</button>`
        : `<button class="cta block" id="q-again">다시 풀기</button><button class="btn" id="q-home">범위 다시 고르기</button>`}`;
    $('#q-again').onclick = quiz.daily ? startDaily : startQuiz;
    $('#q-home').onclick = () => { const d = quiz.daily; quiz = null; if (d) selectTab('home'); else renderQuiz(); };
  }

  // ───────── 홈 ─────────
  const KIND = { grammar: '문법 + 패턴', speak: '말하기 과제', situation: '상황 회화' };
  const LEVEL_CLS = ['', 'lv1', 'lv2', 'lv3', 'lv4'];
  // 과에 자료가 있나: 카드가 있거나 문법 문서가 있으면 공부할 수 있다
  const unitReady = (un) => unitCards(un).length > 0 || grammar.articles.some(a => a.unit === un);
  const unitState = (un) => unitDone(un) ? 'done' : unitSeen(un) ? 'now' : unitReady(un) ? 'ready' : 'soon';
  const levelOf = (un) => (unitInfo(un) || {}).level || 1;
  const levelInfo = (lv) => course.levels.find(l => l.level === lv) || course.levels[0];
  const greet = () => { const h = new Date().getHours(); return h < 5 ? '늦은 밤이에요' : h < 11 ? '좋은 아침이에요' : h < 17 ? '좋은 오후예요' : '좋은 저녁이에요'; };
  const unitRow = (un, cur) => {
    const info = unitInfo(un) || {};
    const cs = unitCards(un), seen = unitSeen(un), st = unitState(un);
    const pct = cs.length ? Math.round(cs.filter(mastered).length / cs.length * 100) : 0;
    const sub = st === 'done' ? '완료' : st === 'now' ? `${seen}/${cs.length} 배움 · 익힘 ${pct}%` : st === 'ready' ? `${cs.length ? `표현 ${cs.length}개` : '문법 문서'} · 시작 전` : `${KIND[info.kind] || ''} · 준비 중`;
    return `<button type="button" class="u-row ${st}${un === cur ? ' cur' : ''}" data-u="${un}">
      <div class="u-num">${st === 'done' ? ICON.check : un}</div>
      <div class="u-txt"><div class="u-title">${esc(unitTitle(un))}</div><div class="u-sub">${sub}</div>
        ${st === 'now' ? `<div class="u-bar"><div style="width:${pct}%"></div></div>` : ''}</div>
      ${ICON.chev}</button>`;
  };
  const wireUnitRows = (root) => root.querySelectorAll('.u-row[data-u]').forEach(b => b.onclick = () => openUnit(Number(b.dataset.u)));
  // 레벨 진행: 그 레벨의 과 가운데 완료한 과 수 / 전체 과 수
  function levelProgress(lv) {
    const us = levelInfo(lv).parts.flatMap(p => p.units.map(x => x.n));
    return { done: us.filter(unitDone).length, started: us.filter(u => unitSeen(u) > 0).length, ready: us.filter(unitReady).length, total: us.length };
  }
  // 홈의 듣기 바로가기: 복습할 카드, 최근 배운 카드, 지금 과 (비어 있는 것은 뺀다)
  const HEAR_NAME = { due: '복습할 카드', recent: '최근 배운 카드', wrong: '오답노트' };
  const hearScopes = (u) => [...['due', 'recent'], ...(u != null ? [`u${u}`] : ['all'])]
    .map(f => [f, pool(f).length]).filter(([, n]) => n).slice(0, 3);
  const ring = (pct, size = 64) => {
    const r = (size - 8) / 2, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/></svg>`;
  };
  function renderHome() {
    const today = days[dayKey()] || { sets: 0, quiz: 0, n: 0, r: 0 };
    const st = streak();
    const u = currentUnit();
    const lv = u != null ? levelOf(u) : 1;
    const L = levelInfo(lv);
    const week = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
    const d = dailyItems();
    const nNew = d.fresh.length, nRev = d.items.length - nNew * 2;
    const prog = levelProgress(lv);
    const pct = Math.round(prog.done / prog.total * 100);
    // 지금 과와 그다음 두 과
    const flat = allUnits().map(x => x.n);
    const from = u != null ? flat.indexOf(u) : 0;
    const next = flat.slice(from, from + 3);
    const seenAll = data.cards.filter(isSeen).length;
    const now = new Date();
    $('#home-body').innerHTML = `
      <header class="topbar home-top">
        <div><div class="date">${now.getMonth() + 1}월 ${now.getDate()}일 ${'일월화수목금토'[now.getDay()]}요일</div><h1>${greet()}</h1></div>
        <div class="right">${st ? `<span class="streak">🔥 ${st}일</span>` : ''}<button class="icon-btn" id="open-stats" aria-label="기록·설정">${ICON.chart}</button></div>
      </header>
      <div class="week">${week.map(w => `<div class="${studied(w) ? 'on' : ''}${dayKey(w) === dayKey() ? ' today' : ''}"><span>${'일월화수목금토'[w.getDay()]}</span><i>${studied(w) ? ICON.check : ''}</i></div>`).join('')}</div>
      <section class="hero ${LEVEL_CLS[lv]}${today.sets ? ' done' : ''}">
        <div class="hero-top"><span class="pill">레벨 ${lv} ${esc(L.name)} · ${esc(L.goal)}</span>${u != null ? `<span>${u}과</span>` : ''}</div>
        <div class="hero-kicker">${today.sets ? '오늘 학습 완료' : '오늘의 학습'}</div>
        <h2>${today.sets ? `${today.sets}세트 · ${today.n}문제 풀었어요` : u != null ? esc(unitTitle(u)) : '복습'}</h2>
        <p>${nNew ? `새 표현 ${nNew}개 + 복습 ${nRev}문제` : `복습 ${d.items.length}문제`} · 약 ${Math.max(3, Math.round(d.items.length * 0.8))}분</p>
        ${d.due ? `<div class="hero-due">${today.sets ? '아직' : '오늘'} 복습할 카드 <b>${d.due}장</b></div>` : ''}
        <button class="cta block" id="h-start">${today.sets ? '한 세트 더' : '시작하기'}</button>
      </section>
      ${TTS ? `<div class="label">듣기만 하기 <span class="lbl-sub">화면 안 봐도 돼요</span></div>
      <div class="hear-row">${hearScopes(u).map(([f, n]) => `<button type="button" data-f="${f}">${ICON.headphones}<span>${esc(HEAR_NAME[f] || scopeName(f))}</span><b>${n}장</b></button>`).join('')}</div>` : ''}
      <div class="label">빠른 연습</div>
      <div class="tiles">
        <button type="button" data-m="order"><i class="t1">${ICON.pen}</i><span>문장 조립</span></button>
        <button type="button" data-m="write"><i class="t2">${ICON.pen}</i><span>영작</span></button>
        ${TTS ? `<button type="button" data-m="listen"><i class="t3">${ICON.sound}</i><span>받아쓰기</span></button>` : ''}
        <button type="button" data-m="choice"><i class="t4">${ICON.check}</i><span>보기 고르기</span></button>
        <button type="button" data-m="wrong"><i class="t5">${ICON.x}</i><span>오답노트 ${pool('wrong').length}</span></button>
        <button type="button" data-m="cards"><i class="t6">${ICON.card}</i><span>카드 ${seenAll}/${data.cards.length}</span></button>
      </div>
      <div class="label row"><span>코스</span><button type="button" class="link" id="h-course">전체 보기 ${ICON.chev}</button></div>
      <section class="lv-card ${LEVEL_CLS[lv]}">
        ${ring(pct)}
        <div class="lv-txt"><div class="lv-name">레벨 ${lv} · ${esc(L.name)}</div><div class="lv-goal">${esc(L.desc)}</div>
          <div class="lv-sub">${prog.done}/${prog.total}과 완료 · ${esc(L.months)}</div></div>
      </section>
      <div class="u-list">${next.map(un => unitRow(un, u)).join('')}</div>
      ${pool('self').length ? `<div class="label">직접 정리한 카드</div><button type="button" class="u-row ready" id="h-self"><div class="u-num">${ICON.book}</div><div class="u-txt"><div class="u-title">유튜브에서 정리한 표현</div><div class="u-sub">${pool('self').length}장</div></div>${ICON.chev}</button>` : ''}`;
    $('#open-stats').onclick = () => showView('stats');
    $('#h-start').onclick = startDaily;
    $('#h-course').onclick = () => selectTab('course');
    $('#home-body').querySelectorAll('.tiles button').forEach(b => b.onclick = () => {
      const m = b.dataset.m;
      if (m === 'cards') { filter = 'all'; return selectTab('cards'); }
      if (m === 'wrong') { if (!pool('wrong').length) return toast('오답노트가 비어 있어요'); quizSource = 'wrong'; quizMode = 'type'; }
      else { quizSource = u != null && unitSeen(u) ? `u${u}` : 'all'; quizMode = m; }
      save('quizMode', quizMode); quiz = null;
      selectTab('quiz', false, true); startQuiz();
    });
    $('#home-body').querySelectorAll('.hear-row button').forEach(b => b.onclick = () => openListen(b.dataset.f, 'home', true));
    wireUnitRows($('#home-body'));
    if ($('#h-self')) $('#h-self').onclick = () => { filter = 'self'; selectTab('cards'); };
  }

  // ───────── 코스 (레벨 → 부 → 과) ─────────
  let courseLevel = null;
  function renderCourse() {
    const u = currentUnit();
    if (courseLevel == null) courseLevel = u != null ? levelOf(u) : 1;
    const L = levelInfo(courseLevel);
    const prog = levelProgress(courseLevel);
    $('#course-body').innerHTML = `
      <header class="topbar"><h1>코스</h1><div class="right"><span>${allUnits().length}과 · 3년</span></div></header>
      <div class="seg" id="c-seg">${course.levels.map(l => `<button data-l="${l.level}" class="${LEVEL_CLS[l.level]}${l.level === courseLevel ? ' active' : ''}"><b>${l.level}</b>${esc(l.name)}</button>`).join('')}</div>
      <section class="lv-card ${LEVEL_CLS[courseLevel]}">
        ${ring(Math.round(prog.done / prog.total * 100))}
        <div class="lv-txt"><div class="lv-name">레벨 ${L.level} · ${esc(L.name)} <span class="goal">${esc(L.goal)}</span></div><div class="lv-goal">${esc(L.desc)}</div>
          <div class="lv-sub">${prog.done}/${prog.total}과 완료 · 자료 ${prog.ready}과 · ${esc(L.months)}</div></div>
      </section>
      ${L.parts.map(p => `<div class="c-part"><span>${esc(p.name)}</span><span>${p.units.filter(x => unitDone(x.n)).length}/${p.units.length}</span></div>
        <div class="u-list">${p.units.map(x => unitRow(x.n, u)).join('')}</div>`).join('')}
      <p class="muted c-note">자료가 없는 과는 "준비 중"이에요. 공부하면서 하나씩 채워요.</p>`;
    $('#c-seg').querySelectorAll('button').forEach(b => b.onclick = () => { courseLevel = Number(b.dataset.l); renderCourse(); window.scrollTo(0, 0); });
    wireUnitRows($('#course-body'));
  }
  // 과 하나: 문법 읽기 / 카드 보기 / 연습 / 듣기. 자료가 없으면 준비 중 안내
  function openUnit(un) {
    const info = unitInfo(un) || {};
    const art = grammar.articles.find(a => a.unit === un);
    const cs = unitCards(un);
    const ready = unitReady(un);
    openSheet(`<div class="sh-g">레벨 ${levelOf(un)} · ${esc(info.part || '')} · ${un}과</div><h3>${esc(unitTitle(un))}</h3>
      <div class="sh-sub">${ready ? `${unitSeen(un)}/${cs.length} 배움 · 익힘 ${cs.length ? Math.round(cs.filter(mastered).length / cs.length * 100) : 0}%` : `${KIND[info.kind] || ''} · 아직 자료가 없어요`}</div>
      ${art ? `<button type="button" class="sh-row" data-a="grammar">${ICON.book}<span>${info.kind === 'grammar' ? '문법 읽기' : '설명 읽기'}</span></button>` : ''}
      ${cs.length ? `<button type="button" class="sh-row" data-a="cards">${ICON.card}<span>표현 카드 ${cs.length}장</span></button>
      <button type="button" class="sh-row" data-a="order">${ICON.pen}<span>문장 조립 연습</span></button>
      <button type="button" class="sh-row" data-a="write">${ICON.pen}<span>영작 연습</span></button>
      ${TTS ? `<button type="button" class="sh-row" data-a="hear">${ICON.headphones}<span>듣기 모드</span></button>` : ''}` : ''}
      ${!ready ? `<p class="muted">이 과는 아직 준비 중이에요. 앞 과를 공부하는 동안 채워 둘게요.</p>` : ''}`,
      (sh, close) => sh.querySelectorAll('.sh-row').forEach(b => b.onclick = () => {
        close();
        const a = b.dataset.a;
        if (a === 'grammar') { location.hash = `#g/${art.id}`; return; }
        if (a === 'cards') { filter = `u${un}`; return selectTab('cards'); }
        if (a === 'hear') return openListen(`u${un}`, 'course', true);
        quizSource = `u${un}`; quizMode = a; save('quizMode', quizMode); quiz = null;
        selectTab('quiz', false, true); startQuiz();
      }));
  }

  // ───────── 문법 (개념 문서) ─────────
  const TAB_NAME = { home: '홈', course: '코스', cards: '카드', quiz: '연습' };
  const articleIdFromHash = () => (location.hash.match(/^#g\/(\w+)/) || [])[1];
  // 목록 묶음: 교재 문서는 부별로(빌드가 과 순서로 정렬해 둠), 나머지는 맨 뒤 "그 밖의 문서"
  function grammarGroups() {
    const groups = [];
    for (const a of grammar.articles) {
      const part = a.unit != null ? a.part : '그 밖의 문서';
      const last = groups[groups.length - 1];
      if (last && last[0] === part) last[1].push(a); else groups.push([part, [a]]);
    }
    return groups;
  }
  // 교재 문서 끝의 이전 과 / 다음 과 버튼. 중간에 빠진 과는 건너뛴다
  function unitNav(art) {
    if (art.unit == null) return '';
    const book = grammar.articles.filter(a => a.unit != null);
    const i = book.indexOf(art), prev = book[i - 1], next = book[i + 1];
    if (!prev && !next) return '';
    const link = (a, dir) => a ? `<a class="u-nav ${dir}" href="#g/${a.id}"><span>${dir === 'prev' ? '← 이전' : '다음 →'} · ${a.unit}과</span>${esc(a.title)}</a>` : '<span></span>';
    return `<nav class="u-navs">${link(prev, 'prev')}${link(next, 'next')}</nav>`;
  }
  // 교재 문서 끝: 이 과의 카드를 넘겨 보거나 시험으로 바로 간다
  function unitStudy(art) {
    const n = art.unit != null ? pool(`u${art.unit}`).length : 0;
    if (!n) return '';
    return `<div class="u-study"><div class="label">${art.unit}과 복습</div>
      <div class="q-btns"><button type="button" class="ghost" id="u-cards">카드 ${n}장</button><button type="button" class="cta" id="u-quiz">이 과 시험 보기</button></div></div>`;
  }
  function renderGrammar() {
    const body = $('#grammar-body');
    const art = grammar.articles.find(a => a.id === articleIdFromHash());
    const meta = (a) => a.unit != null
      ? `${a.unit}과 · ${esc(a.part)}`
      : `${esc(a.date)}${a.tags.length ? ' · ' + a.tags.map(t => '#' + esc(t)).join(' ') : ''}`;
    const item = (a) => `
          <a class="g-item" href="#g/${a.id}">
            ${a.unit != null ? `<div class="g-unit">${a.unit}과</div>` : ''}
            <div class="g-title">${esc(a.title)}</div>
            ${a.summary ? `<div class="g-sum">${esc(a.summary)}</div>` : ''}
            ${a.unit == null ? `<div class="g-meta">${meta(a)}</div>` : ''}
          </a>`;
    if (art) {
      const backLabel = returnTab ? `${TAB_NAME[returnTab]}로 돌아가기` : '문법 목록';
      body.innerHTML = `
        <header class="topbar"><button class="back" id="g-back">← ${backLabel}</button></header>
        <article class="article">
          <h1>${esc(art.title)}</h1>
          <div class="meta">${meta(art)}</div>
          ${art.html}
        </article>
        ${unitStudy(art)}
        ${unitNav(art)}
        <button class="btn" id="g-back2">${backLabel}</button>`;
      const back = () => {
        if (returnTab) { const t = returnTab; returnTab = null; history.replaceState(null, '', location.pathname); selectTab(t, false, true); }
        else location.hash = '';
      };
      $('#g-back').onclick = back; $('#g-back2').onclick = back;
      const leave = () => { returnTab = null; history.replaceState(null, '', location.pathname); };
      if ($('#u-cards')) $('#u-cards').onclick = () => { leave(); filter = `u${art.unit}`; selectTab('cards'); };
      if ($('#u-quiz')) $('#u-quiz').onclick = () => { leave(); quizSource = `u${art.unit}`; quiz = null; selectTab('quiz'); };
    } else {
      returnTab = null;
      body.innerHTML = `
        <header class="topbar"><h1>문법</h1><div class="right"><span>${grammar.articles.length}편</span></div></header>
        ${grammar.articles.length ? grammarGroups().map(([part, list]) => `
          <h2 class="g-part">${esc(part)}</h2>
          ${list.map(item).join('')}`).join('') : `<div class="empty">아직 문법 문서가 없어요</div>`}`;
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#g/')) selectTab('grammar', true);
    else if (returnTab) { const t = returnTab; returnTab = null; selectTab(t, false, true); }   // 폰의 뒤로가기
    else if ($('#view-grammar').classList.contains('active')) renderGrammar();
  });

  // ───────── 기록·설정 ─────────
  function renderStats() {
    const count = (key) => pool(key).length;
    const byCat = [...TYPES.map(k => [k, count(k)]), ['문법', grammar.articles.length]];
    const max = Math.max(1, ...byCat.map(x => x[1]));
    const solved = data.cards.reduce((a, c) => a + hist(c).r + hist(c).w, 0);
    const rightAll = data.cards.reduce((a, c) => a + hist(c).r, 0);
    // 복습 일정: 배운 카드를 다음 복습일로 묶는다
    const ds = data.cards.map(review).filter(Boolean).map(r => r.d), t0 = dayKey();
    const plan = [['오늘', ds.filter(d => d <= t0).length], ['내일', ds.filter(d => d === addDays(t0, 1)).length],
      ['이번 주', ds.filter(d => d > addDays(t0, 1) && d <= addDays(t0, 7)).length], ['그 뒤', ds.filter(d => d > addDays(t0, 7)).length]];
    const planMax = Math.max(1, ...plan.map(x => x[1]));
    const weak = data.cards.filter(c => hist(c).w > 0).sort((a, b) => hist(b).w - hist(a).w || hist(a).r - hist(b).r).slice(0, 5);
    $('#stats-body').innerHTML = `
      <header class="topbar"><button class="back" id="s-back">← 홈으로</button></header>
      <header class="topbar"><h1>기록·설정</h1></header>
      <div class="metrics">
        <div class="metric"><div class="label">연속 학습</div><div class="value">${streak()}일</div></div>
        <div class="metric"><div class="label">학습한 날</div><div class="value">${Object.keys(days).filter(k => studied(new Date(k))).length}</div></div>
        <div class="metric"><div class="label">배운 카드</div><div class="value">${data.cards.filter(isSeen).length}<small> / ${data.cards.length}</small></div></div>
        <div class="metric"><div class="label">익힌 카드</div><div class="value">${data.cards.filter(mastered).length}</div></div>
        <div class="metric"><div class="label">오늘 복습할 카드</div><div class="value">${count('due')}</div></div>
        <div class="metric"><div class="label">들은 카드</div><div class="value">${Object.values(days).reduce((a, d) => a + (d.lis || 0), 0)}</div></div>
        <div class="metric"><div class="label">오답노트</div><div class="value">${count('wrong')}</div></div>
        <div class="metric"><div class="label">즐겨찾기</div><div class="value">${count('fav')}</div></div>
        <div class="metric"><div class="label">푼 문제</div><div class="value">${solved}</div></div>
        <div class="metric"><div class="label">정답률</div><div class="value">${solved ? Math.round(rightAll / solved * 100) + '%' : '-'}</div></div>
      </div>
      ${plan.some(x => x[1]) ? `<div class="section"><h3>복습 일정</h3>
        ${plan.map(([k, n]) => `<div class="bar-row"><span class="name">${k}</span><div class="bar"><div style="width:${n / planMax * 100}%"></div></div><span class="n">${n}</span></div>`).join('')}
        <div class="muted" style="margin-top:8px">맞히면 다음 복습이 1일 → 3일 → 7일 → 14일 → 30일 → 60일 뒤로 늘어나고, 틀리면 다음 날 다시 나와요.</div>
      </div>` : ''}
      ${weak.length ? `<div class="section"><h3>자주 틀리는 카드</h3>
        ${weak.map(c => `<div class="bar-row"><span class="name wide">${esc(c.front)}</span><span class="n">${hist(c).w}회</span></div>`).join('')}
      </div>` : ''}
      <div class="section"><h3>종류별</h3>
        ${byCat.map(([k, n]) => `<div class="bar-row"><span class="name">${esc(k)}</span><div class="bar"><div style="width:${n / max * 100}%"></div></div><span class="n">${n}</span></div>`).join('')}
      </div>
      ${TTS ? `<div class="section"><h3>발음 속도</h3>${rateChips('s-rate')}
        <div class="muted" style="margin-top:8px">카드의 발음 듣기, 듣기 모드, 받아쓰기에 같이 쓰여요.</div></div>` : ''}
      <div class="section"><h3>동기화</h3><div id="sy-box"></div></div>
      <div class="section"><h3>즐겨찾기·오답노트·시험 기록</h3>
        <button class="btn" id="btn-export">내보내기 (JSON)</button>
        <button class="btn" id="btn-import">가져오기</button>
        <input type="file" id="file-import" accept="application/json" hidden>
        <button class="btn danger" id="btn-reset">즐겨찾기·오답노트·기록 모두 지우기</button>
        <div class="muted" style="margin-top:10px">데이터 빌드: ${data.builtAt ? data.builtAt.replace('T', ' ').slice(0, 16) : '-'}</div>
      </div>`;
    $('#s-back').onclick = () => selectTab('home');
    paintSync();
    if (TTS) wireRate('s-rate', () => say('This is how fast I will read.'));
    $('#btn-export').onclick = () => {
      const blob = new Blob([JSON.stringify({ marks, days }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `eng-marks-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('#btn-import').onclick = () => $('#file-import').click();
    $('#file-import').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        if (!obj.marks || typeof obj.marks !== 'object') throw new Error();
        marks = obj.marks; save(K_MARKS, marks);
        if (obj.days && typeof obj.days === 'object') { days = obj.days; save(K_DAYS, days); }
        toast('가져왔어요'); renderStats();
      } catch { toast('파일 형식이 맞지 않아요'); }
    };
    $('#btn-reset').onclick = () => {
      if (!confirm('즐겨찾기, 오답노트, 학습 기록을 모두 지울까요? 되돌릴 수 없어요.')) return;
      marks = {}; days = {}; save(K_MARKS, marks); save(K_DAYS, days); toast('지웠어요'); renderStats();
    };
  }

  // ───────── 동기화 (Firebase, 무료 플랜) ─────────
  // 학습 기록(marks, days)을 Firestore 의 users/{uid} 문서 하나에 통째로 둔다. 이메일·비밀번호 로그인.
  // 폰 저장소가 원본이고, 바뀔 때마다 몇 초 뒤 올린다. 다른 기기에서 바뀌면 받아서 합친다.
  const SYNC = { ready: false, user: null, timer: null, unsub: null, last: load('eng-sync-at', null), busy: false, err: '' };
  let fbAuth = null, fbDb = null;
  const loadScript = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  async function initSync() {
    if (!window.FIREBASE_CONFIG) return;
    try {
      const v = '10.14.1';
      await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
      await Promise.all([loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`), loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore-compat.js`)]);
      firebase.initializeApp(window.FIREBASE_CONFIG);
      fbAuth = firebase.auth(); fbDb = firebase.firestore();
      SYNC.ready = true;
      fbAuth.onAuthStateChanged(u => { SYNC.user = u; if (u) watchRemote(); else stopWatch(); paintSync(); });
    } catch (e) { SYNC.err = '동기화 모듈을 불러오지 못했어요 (오프라인?)'; }
  }
  const userDoc = () => fbDb.collection('users').doc(SYNC.user.uid);
  // 두 기기의 기록 합치기: 즐겨찾기는 하나라도 켜져 있으면 켜짐, 오답은 합집합, 횟수는 큰 쪽, 날짜는 이른/늦은 쪽
  function mergeMarks(a = {}, b = {}) {
    const out = {};
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[id] || {}, y = b[id] || {}, m = {};
      if (x.fav || y.fav) m.fav = true;
      const w = { ...(x.wrong || {}), ...(y.wrong || {}) };
      if (Object.keys(w).length) m.wrong = w;
      if (x.hist || y.hist) m.hist = { r: Math.max((x.hist || {}).r || 0, (y.hist || {}).r || 0), w: Math.max((x.hist || {}).w || 0, (y.hist || {}).w || 0) };
      const seen = [x.seen, y.seen].filter(Boolean).sort()[0]; if (seen) m.seen = seen;
      const last = [x.last, y.last].filter(Boolean).sort().pop(); if (last) m.last = last;
      // 복습 간격은 더 최근에 채점된 쪽. 같은 날이면 복습일이 이른 쪽 (덜 외운 것으로 본다)
      const rv = [x.rv, y.rv].filter(Boolean).sort((p, q) => (q.t || '').localeCompare(p.t || '') || p.d.localeCompare(q.d))[0]; if (rv) m.rv = rv;
      if (Object.keys(m).length) out[id] = m;
    }
    return out;
  }
  function mergeDays(a = {}, b = {}) {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[k] || {}, y = b[k] || {};
      out[k] = { sets: Math.max(x.sets || 0, y.sets || 0), quiz: Math.max(x.quiz || 0, y.quiz || 0), n: Math.max(x.n || 0, y.n || 0), r: Math.max(x.r || 0, y.r || 0), lis: Math.max(x.lis || 0, y.lis || 0) };
    }
    return out;
  }
  // 받은 기록을 폰 기록과 합쳐 저장하고, 화면이 기록을 보여 주는 중이면 다시 그린다
  function applyRemote(d) {
    if (!d) return;
    const m2 = mergeMarks(marks, d.marks), d2 = mergeDays(days, d.days);
    const changed = JSON.stringify(m2) !== JSON.stringify(marks) || JSON.stringify(d2) !== JSON.stringify(days);
    marks = m2; days = d2;
    try { localStorage.setItem(K_MARKS, JSON.stringify(marks)); localStorage.setItem(K_DAYS, JSON.stringify(days)); } catch {}
    if (changed) {
      const v = document.querySelector('.view.active');
      if (v && v.id === 'view-home') renderHome();
      if (v && v.id === 'view-stats') renderStats();
      if (v && v.id === 'view-cards' && settings.mode === 'list') fillList();
    }
  }
  function watchRemote() {
    stopWatch();
    SYNC.unsub = userDoc().onSnapshot(snap => {
      if (snap.metadata.hasPendingWrites) return;   // 내가 올린 것
      const d = snap.data();
      if (d) { applyRemote(d); SYNC.last = new Date().toISOString(); save('eng-sync-at', SYNC.last); }
      syncSoon(0);   // 합친 결과를 올려 둔다 (같으면 쓰기 한 번뿐)
      paintSync();
    }, () => { SYNC.err = '서버에서 기록을 받지 못했어요'; paintSync(); });
  }
  function stopWatch() { if (SYNC.unsub) { SYNC.unsub(); SYNC.unsub = null; } }
  function syncSoon(ms = 2500) {
    if (!SYNC.ready || !SYNC.user) return;
    clearTimeout(SYNC.timer);
    SYNC.timer = setTimeout(pushNow, ms);
  }
  async function pushNow() {
    if (!SYNC.ready || !SYNC.user || SYNC.busy) return;
    SYNC.busy = true;
    try {
      await userDoc().set({ marks, days, updatedAt: new Date().toISOString(), device: navigator.userAgent.slice(0, 60) }, { merge: false });
      SYNC.last = new Date().toISOString(); save('eng-sync-at', SYNC.last); SYNC.err = '';
    } catch (e) { SYNC.err = '올리지 못했어요. 다시 시도해요'; }
    SYNC.busy = false; paintSync();
  }
  const AUTH_MSG = { 'auth/invalid-email': '이메일 형식이 아니에요', 'auth/user-not-found': '없는 계정이에요. 회원가입을 눌러 보세요', 'auth/wrong-password': '비밀번호가 틀렸어요', 'auth/invalid-credential': '이메일이나 비밀번호가 틀렸어요',
    'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인을 눌러 보세요', 'auth/weak-password': '비밀번호는 6자 이상이어야 해요', 'auth/network-request-failed': '인터넷 연결을 확인해 주세요', 'auth/too-many-requests': '잠시 뒤에 다시 시도해 주세요' };
  async function doAuth(signup) {
    const email = ($('#sy-email').value || '').trim(), pw = $('#sy-pw').value || '';
    if (!email || !pw) return toast('이메일과 비밀번호를 넣어 주세요');
    try {
      if (signup) await fbAuth.createUserWithEmailAndPassword(email, pw); else await fbAuth.signInWithEmailAndPassword(email, pw);
      toast(signup ? '가입했어요. 기록을 올리는 중' : '로그인했어요');
    } catch (e) { toast(AUTH_MSG[e.code] || `실패: ${e.code || e.message}`); }
  }
  const fmtTime = (iso) => { if (!iso) return '아직 안 함'; const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  function syncHtml() {
    if (!window.FIREBASE_CONFIG) return `<div class="muted">아직 설정 전이에요. <code>docs/firebase-config.js</code>에 Firebase 설정을 넣으면 켜져요 (README 참고).</div>`;
    if (!SYNC.ready) return `<div class="muted">${esc(SYNC.err || '동기화 모듈을 불러오는 중…')}</div>`;
    if (!SYNC.user) return `
      <div class="muted" style="margin-bottom:10px">로그인하면 즐겨찾기·오답노트·학습 기록이 서버에 저장되고, 다른 폰이나 PC에서도 이어서 공부할 수 있어요.</div>
      <form id="sy-form" autocomplete="on">
        <input id="sy-email" class="field" type="email" placeholder="이메일" autocomplete="username" inputmode="email">
        <input id="sy-pw" class="field" type="password" placeholder="비밀번호 (6자 이상)" autocomplete="current-password">
        <div class="q-btns"><button type="button" class="ghost" id="sy-signup">회원가입</button><button type="submit" class="cta">로그인</button></div>
      </form>`;
    return `
      <div class="sy-row"><span class="muted">계정</span><b>${esc(SYNC.user.email || '')}</b></div>
      <div class="sy-row"><span class="muted">마지막 동기화</span><b>${SYNC.err ? `<span class="bad">${esc(SYNC.err)}</span>` : fmtTime(SYNC.last)}</b></div>
      <div class="q-btns" style="margin-top:12px"><button type="button" class="ghost" id="sy-out">로그아웃</button><button type="button" class="cta" id="sy-now" ${SYNC.busy ? 'disabled' : ''}>${SYNC.busy ? '올리는 중…' : '지금 동기화'}</button></div>`;
  }
  function paintSync() {
    const box = $('#sy-box'); if (!box) return;
    box.innerHTML = syncHtml();
    if ($('#sy-form')) { $('#sy-form').onsubmit = (e) => { e.preventDefault(); doAuth(false); }; $('#sy-signup').onclick = () => doAuth(true); }
    if ($('#sy-now')) $('#sy-now').onclick = () => { pushNow(); toast('올리는 중'); };
    if ($('#sy-out')) $('#sy-out').onclick = () => { if (confirm('로그아웃할까요? 폰의 기록은 그대로 남아요.')) fbAuth.signOut(); };
  }

  // ───────── 탭 / 공통 ─────────
  function showView(name) {
    if (name !== 'listen') { stopListen(); if ($('#dim')) $('#dim').remove(); }
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    if (name === 'home') renderHome();
    if (name === 'course') renderCourse();
    if (name === 'cards') renderCards();
    if (name === 'grammar') renderGrammar();
    if (name === 'stats') renderStats();
    if (name === 'listen') renderListen();
    window.scrollTo(0, 0);
  }
  // keepQuiz: 문법 문서를 보고 돌아올 때는 풀던 문제 화면을 그대로 둔다
  function selectTab(tab, keepReturn, keepQuiz) {
    if (!keepReturn) returnTab = null;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    showView(tab);
    if (tab === 'quiz' && !keepQuiz) renderQuiz();
  }
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    returnTab = null;
    if (location.hash.startsWith('#g/')) history.replaceState(null, '', location.pathname);
    const sameQuiz = b.dataset.tab === 'quiz' && !!quiz;   // 풀던 문제와 입력을 그대로 둔다
    selectTab(b.dataset.tab, false, sameQuiz);
    const st = sameQuiz && quiz.idx < quiz.items.length && $('#quiz-body .star');   // 카드 탭에서 바꾼 즐겨찾기 반영
    if (st) st.classList.toggle('on', isMarked(quiz.items[quiz.idx].card, 'fav'));
  });

  let toastTimer;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 1500);
  }

  async function init() {
    try {
      data = await (await fetch('data.json', { cache: 'no-cache' })).json();
    } catch {
      $('#home-body').innerHTML = `<div class="done"><h2>데이터를 불러오지 못했어요</h2><p>온라인 상태에서 한 번 열어 두면 이후엔 오프라인에서도 열립니다.</p></div>`;
      return;
    }
    try { grammar = await (await fetch('grammar.json', { cache: 'no-cache' })).json(); } catch {}
    try { course = await (await fetch('course.json', { cache: 'no-cache' })).json(); } catch {}
    selectTab(location.hash.startsWith('#g/') ? 'grammar' : 'home');
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});   // 브라우저가 오래 안 쓴 사이트 데이터를 지우지 않게
    initSync();
  }
  init();
})();
