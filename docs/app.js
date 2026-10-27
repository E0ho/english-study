(() => {
  'use strict';

  // ───────── 저장소 ─────────
  const K_MARKS = 'eng-marks';        // { cardId: { fav: true, wrong: { 예문: true }, hist: { r, w } } }
  const K_SETTINGS = 'eng-settings';
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const TYPES = ['단어', '표현', '패턴'];
  let data = { cards: [] };
  let grammar = { articles: [] };
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
  };
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
  function addHist(c, ok) {
    const m = marks[c.id] || {};
    const h = m.hist || { r: 0, w: 0 };
    if (ok) h.r += 1; else h.w += 1;
    m.hist = h; marks[c.id] = m; save(K_MARKS, marks);
  }
  // 필터: all | wrong | fav | 단어 | 표현 | 패턴 | u3 (교재 3과)
  const unitOf = (f) => /^u\d+$/.test(f) ? Number(f.slice(1)) : null;
  const pool = (f) => data.cards.filter(c => f === 'all' ? true : f === 'wrong' ? isWrong(c) : f === 'fav' ? isMarked(c, f) : unitOf(f) != null ? c.unit === unitOf(f) : c.category === f);
  const filterLabel = (f) => f === 'all' ? '전체' : f === 'wrong' ? '오답노트' : f === 'fav' ? '즐겨찾기' : unitOf(f) != null ? `${unitOf(f)}과` : f;
  const unitKeys = () => [...new Set(data.cards.map(c => c.unit).filter(u => u != null))].sort((a, b) => a - b).map(u => `u${u}`);
  const filterKeys = () => ['all', 'wrong', 'fav', ...TYPES.filter(t => pool(t).length), ...unitKeys()];
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
      <div class="subbar"><div class="chips" id="filters"></div><div id="sub-right"></div></div>
      <div id="cards-main"></div>`;
    $('#open-stats').onclick = () => showView('stats');
    if ($('#open-listen')) $('#open-listen').onclick = () => showView('listen');
    document.querySelectorAll('.iseg button').forEach(b => b.onclick = () => {
      settings.mode = b.dataset.mode; save(K_SETTINGS, settings); renderCards();
    });
    renderFilters();
    if (mode === 'card') renderStudy(); else renderList();
  }
  function renderFilters() {
    $('#filters').innerHTML = filterKeys().map(k =>
      `<button data-f="${k}" class="${k === filter ? 'active' : ''}">${filterLabel(k)} ${pool(k).length}</button>`).join('');
    $('#filters').querySelectorAll('button').forEach(b => b.onclick = () => { filter = b.dataset.f; renderCards(); });
    showActiveChip($('#filters'));
  }
  // 가로로 넘치는 칩 줄에서 고른 칩이 보이게 한다 (문법 문서에서 "이 과 카드"로 왔을 때)
  function showActiveChip(row) {
    const a = row.querySelector('.active');
    if (a) row.scrollLeft = a.offsetLeft - (row.clientWidth - a.offsetWidth) / 2;
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
  const listen = { on: false, step: 0, token: 0, lock: null };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
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
        listen.step = 0; s.idx = (s.idx + 1) % s.ids.length;
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
  function renderListen() {
    $('#listen-body').innerHTML = `
      <header class="topbar"><button class="back" id="l-back">← 카드로 돌아가기</button></header>
      <header class="topbar"><h1>듣기</h1><div class="right" id="l-count"></div></header>
      <div class="chips" id="l-filters">${filterKeys().map(k => `<button data-f="${k}" class="${k === filter ? 'active' : ''}">${filterLabel(k)} ${pool(k).length}</button>`).join('')}</div>
      <div id="l-main"></div>
      <div class="label">읽는 방식</div>
      <div class="chips wrap" id="l-opts">
        <button data-o="listenKo" class="${settings.listenKo !== false ? 'active' : ''}">한국어 해석도 읽기</button>
        <button data-o="listenTwice" class="${settings.listenTwice ? 'active' : ''}">영어 한 번 더</button>
      </div>
      <div class="label">속도</div>
      ${rateChips('l-rate')}
      <p class="muted l-note">화면이 꺼지면 브라우저가 읽기를 멈춰요. 재생 중에는 화면이 켜진 채로 유지돼요.</p>`;
    $('#l-back').onclick = () => selectTab('cards');
    showActiveChip($('#l-filters'));
    $('#l-filters').querySelectorAll('button').forEach(b => b.onclick = () => listenGo(() => {
      filter = b.dataset.f; listen.step = 0;
      $('#l-filters').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    }));
    $('#l-opts').querySelectorAll('button').forEach(b => b.onclick = () => listenGo(() => {
      const k = b.dataset.o;
      settings[k] = k === 'listenKo' ? settings.listenKo === false : !settings[k];
      save(K_SETTINGS, settings); listen.step = 0;
      b.classList.toggle('active', k === 'listenKo' ? settings.listenKo !== false : settings[k]);
    }));
    wireRate('l-rate', () => listenGo(() => {}));
    paintListen();
  }
  function paintListen() {
    const main = $('#l-main');
    if (!main) return;
    const s = session();
    $('#l-count').textContent = s.ids.length ? `${s.idx + 1} / ${s.ids.length}` : '';
    if (!s.ids.length) { main.innerHTML = emptyHtml(); return; }
    const c = data.cards.find(x => x.id === s.ids[s.idx]);
    const at = listen.on || listen.step ? (listenSteps(c)[listen.step] || {}).at : null;
    const now = (k) => at === k ? ' now' : '';
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

  // ───────── 시험 (예문 빈칸 채우기) ─────────
  const QUIZ_MAX = 10;
  let quizSource = 'all';
  const QUIZ_MODES = [['type', '타이핑'], ['choice', '보기 4개'], ['order', '문장 배열'], ...(TTS ? [['listen', '받아쓰기']] : [])];
  let quizMode = load('quizMode', 'type');
  if (!QUIZ_MODES.some(([k]) => k === quizMode)) quizMode = 'type';
  let quiz = null;                 // { mode, items: [{ card, ex }], idx, results: [{ ok, given }], answered }
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
  const tolerance = (len) => len <= 5 ? 0 : len <= 10 ? 1 : 2;   // 허용하는 오타 글자 수
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
    const items = pickWeighted(quizItems(quizSource), QUIZ_MAX);   // 오답노트를 다 맞혀 비었으면 시작 화면으로
    quiz = items.length ? { mode: quizMode, items, idx: 0, results: [], answered: false } : null;
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

  function renderQuiz() {
    if (!quiz) return renderQuizStart();
    if (quiz.idx >= quiz.items.length) return renderQuizResult();
    renderQuizQuestion();
  }
  function renderQuizStart() {
    const sources = filterKeys().filter(k => unitOf(k) == null);
    const units = unitKeys();
    const chip = (k) => `<button data-f="${k}" class="${k === quizSource ? 'active' : ''}">${filterLabel(k)} ${quizItems(k).length}</button>`;
    const n = quizItems(quizSource).length;
    $('#quiz-body').innerHTML = `
      <header class="topbar"><h1>시험</h1></header>
      <p class="lead">${quizMode === 'order' ? '해석을 보고 단어를 순서대로 눌러 문장을 완성하세요.' : quizMode === 'listen' ? '문장을 듣고 빈칸에 들린 말을 그대로 써 보세요. 작은 오타는 정답으로 봅니다. 소리를 켜 주세요.' : `예문의 빈칸에 들어갈 말을 맞혀 보세요. 해석에서 강조된 부분이 빈칸의 뜻입니다.${quizMode === 'type' ? ' 원형이나 작은 오타도 정답으로 봅니다.' : ''}`}</p>
      <div class="label">범위</div>
      <div class="chips wrap" id="q-src">${sources.map(chip).join('')}</div>
      ${units.length ? `<div class="label">교재</div><div class="chips wrap" id="q-unit">${units.map(chip).join('')}</div>` : ''}
      <div class="label">방식</div>
      <div class="chips wrap" id="q-mode">${QUIZ_MODES.map(([k, t]) => `<button data-m="${k}" class="${k === quizMode ? 'active' : ''}">${t}</button>`).join('')}</div>
      <div class="q-start">
        <div class="big">${Math.min(n, QUIZ_MAX)}<small>문제</small></div>
        <div class="muted">${n > QUIZ_MAX ? `${n}개 중에서 ${QUIZ_MAX}개를 뽑아요` : n ? '고른 범위의 예문 전부' : '이 범위에는 낼 문제가 없어요'}</div>
        <button class="cta" id="q-go" ${n ? '' : 'disabled'}>시작</button>
      </div>`;
    $('#quiz-body').querySelectorAll('#q-src button, #q-unit button').forEach(b => b.onclick = () => { quizSource = b.dataset.f; renderQuizStart(); });
    $('#q-mode').querySelectorAll('button').forEach(b => b.onclick = () => { quizMode = b.dataset.m; save('quizMode', quizMode); renderQuizStart(); });
    $('#q-go').onclick = startQuiz;
  }
  // 문장 배열: 해석만 보여 주고, 섞인 단어를 눌러 예문 전체를 순서대로 만든다
  // 대화 예문의 화자 표시(A: B:)와 문장부호는 뺀다
  function orderTokens(ex) {
    const t = ex.en.trim().split(/\s+/).filter(x => !/^[A-Z]:$/.test(x)).map(x => x.replace(/^["“(]+|[.,!?;:"”)]+$/g, '')).filter(Boolean);
    if (t.length && !/^I\b/.test(t[0])) t[0] = t[0][0].toLowerCase() + t[0].slice(1);   // 첫 단어가 대문자로 드러나지 않게
    return t;
  }
  function renderOrderQuestion() {
    const { card: c, ex } = quiz.items[quiz.idx];
    const words = orderTokens(ex);
    let bank = shuffle(words.map((_, i) => i));
    if (words.length > 1 && bank.every((v, i) => v === i)) bank.push(bank.shift());
    const picked = [];
    quiz.answered = false;
    $('#quiz-body').innerHTML = `
      <header class="topbar"><button class="back" id="q-quit">그만하기</button><div class="right">${quiz.idx + 1} / ${quiz.items.length}</div></header>
      <div class="progress"><div style="width:${quiz.idx / quiz.items.length * 100}%"></div></div>
      <div class="q-card">${favBtn(c, 'star')}
        <div class="type">문장 배열 · 단어 ${words.length}개</div>
        <div class="q-en" id="q-en"></div>
        <div class="q-ko lg">${esc(ex.ko || c.meaning)}</div>
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
    $('#q-quit').onclick = () => { quiz = null; renderQuiz(); };
    $('#q-skip').onclick = () => grade('', true);
    wireFav($('#quiz-body .star'), c);
    $('#o-check').onclick = () => {
      if (picked.length < words.length) { $('#o-line').classList.add('shake'); setTimeout(() => $('#o-line') && $('#o-line').classList.remove('shake'), 300); return; }
      grade(picked.map(i => words[i]).join(' '));
    };
  }
  function renderQuizQuestion() {
    if (quiz.mode === 'order') return renderOrderQuestion();
    const { card: c, ex } = quiz.items[quiz.idx];
    const words = ex.mark.trim().split(/\s+/).length;
    const blank = `<span class="blank">${Array.from({ length: words }, () => '<i></i>').join('')}</span>`;
    quiz.answered = false;
    const opts = quiz.mode === 'choice' ? quizOptions(c, ex) : [];
    const choice = opts.length > 1;   // 보기를 만들 카드가 모자라면 타이핑으로 낸다
    const dict = quiz.mode === 'listen';
    const koHtml = `<div class="q-ko">${withMark(ex.ko || c.meaning, ex.koMark, t => `<mark>${esc(t)}</mark>`)}</div>
        ${ex.koMark ? '' : `<div class="q-hint">뜻: <mark>${esc(c.meaning)}</mark></div>`}`;
    $('#quiz-body').innerHTML = `
      <header class="topbar"><button class="back" id="q-quit">그만하기</button><div class="right">${quiz.idx + 1} / ${quiz.items.length}</div></header>
      <div class="progress"><div style="width:${quiz.idx / quiz.items.length * 100}%"></div></div>
      <div class="q-card">${favBtn(c, 'star')}
        <div class="type">${dict ? '받아쓰기' : esc(c.category)} · 단어 ${words}개</div>
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
    $('#q-quit').onclick = () => { quiz = null; renderQuiz(); };
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
    const { card: c, ex } = quiz.items[quiz.idx];
    const order = quiz.mode === 'order';   // 문장 배열은 문장 전체가 같아야 정답
    const answers = quiz.mode === 'listen' ? [ex.mark] : [ex.mark, baseForm(c)];   // 받아쓰기는 들린 형태 그대로만
    const v = reveal ? 'reveal' : order ? (norm(given) === norm(orderTokens(ex).join(' ')) ? 'exact' : 'wrong') : judge(given, answers);
    const ok = v === 'exact' || v === 'base' || v === 'near';   // 원형이나 오타 1~2개도 정답
    quiz.results.push({ ok, v, given });
    const wasWrong = isWrongEx(c, ex);
    setWrong(c, ex, !ok);   // 틀리면 오답노트에 넣고, 맞히면 뺀다
    addHist(c, ok);
    const last = quiz.idx === quiz.items.length - 1;
    const HEAD = { exact: '맞았어요', base: '원형으로 맞았어요', near: '거의 맞았어요', wrong: '아쉬워요', reveal: '정답이에요' };
    $('#q-en').innerHTML = withMark(ex.en, ex.mark, t => `<mark class="${ok ? 'ok' : 'no'}">${esc(t)}</mark>`) + sayBtn(ex.en);
    if ($('#q-ko-box')) { $('#q-ko-box').hidden = false; $('.q-listen').remove(); }
    $('#q-answer').innerHTML = `
      <div class="q-result ${ok ? 'ok' : 'no'}">
        <div class="head">${ok ? ICON.check : ICON.x}<b>${HEAD[v]}</b></div>
        ${v === 'wrong' || v === 'near' ? `<div class="given ${v}">내 답: ${esc(given)}</div>` : ''}
        ${v === 'exact' || order ? '' : `<div class="used">이 문장에서는 <b>${esc(ex.mark)}</b></div>`}
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
    const total = quiz.items.length;
    const right = quiz.results.filter(r => r.ok).length;
    const wrong = quiz.items.filter((_, i) => !quiz.results[i].ok);
    const nReveal = quiz.results.filter(r => r.v === 'reveal').length, nWrong = wrong.length - nReveal;
    $('#quiz-body').innerHTML = `
      <header class="topbar"><h1>결과</h1></header>
      <div class="q-start">
        <div class="big">${right}<small>/ ${total}</small></div>
        <div class="muted">${right === total ? '전부 맞았어요' : [nWrong && `틀림 ${nWrong}`, nReveal && `정답 봄 ${nReveal}`].filter(Boolean).join(' · ')}</div>
      </div>
      ${wrong.length ? `<div class="label">놓친 문제</div>${wrong.map((w, i) => `
        <div class="item"><div class="row static"><div class="txt">
          <div class="front">${esc(w.card.front)}<span class="tag">${quiz.results[quiz.items.indexOf(w)].v === 'reveal' ? '정답 봄' : '틀림'}</span></div>
          <div class="sum wrap">${withMark(w.ex.en, w.ex.mark, t => `<mark>${esc(t)}</mark>`)}</div>
        </div></div></div>`).join('')}
        <div class="muted center">놓친 문제는 오답노트에 들어 있어요. 다시 맞히면 빠집니다.</div>` : ''}
      <button class="cta block" id="q-again">다시 풀기</button>
      <button class="btn" id="q-home">범위 다시 고르기</button>`;
    $('#q-again').onclick = startQuiz;
    $('#q-home').onclick = () => { quiz = null; renderQuiz(); };
  }

  // ───────── 문법 (개념 문서) ─────────
  const TAB_NAME = { cards: '카드', quiz: '시험' };
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
    const weak = data.cards.filter(c => hist(c).w > 0).sort((a, b) => hist(b).w - hist(a).w || hist(a).r - hist(b).r).slice(0, 5);
    $('#stats-body').innerHTML = `
      <header class="topbar"><button class="back" id="s-back">← 카드로 돌아가기</button></header>
      <header class="topbar"><h1>기록·설정</h1></header>
      <div class="metrics">
        <div class="metric"><div class="label">전체 카드</div><div class="value">${data.cards.length}</div></div>
        <div class="metric"><div class="label">문법 문서</div><div class="value">${grammar.articles.length}</div></div>
        <div class="metric"><div class="label">오답노트</div><div class="value">${count('wrong')}</div></div>
        <div class="metric"><div class="label">즐겨찾기</div><div class="value">${count('fav')}</div></div>
        <div class="metric"><div class="label">푼 문제</div><div class="value">${solved}</div></div>
        <div class="metric"><div class="label">정답률</div><div class="value">${solved ? Math.round(rightAll / solved * 100) + '%' : '-'}</div></div>
      </div>
      ${weak.length ? `<div class="section"><h3>자주 틀리는 카드</h3>
        ${weak.map(c => `<div class="bar-row"><span class="name wide">${esc(c.front)}</span><span class="n">${hist(c).w}회</span></div>`).join('')}
      </div>` : ''}
      <div class="section"><h3>종류별</h3>
        ${byCat.map(([k, n]) => `<div class="bar-row"><span class="name">${esc(k)}</span><div class="bar"><div style="width:${n / max * 100}%"></div></div><span class="n">${n}</span></div>`).join('')}
      </div>
      ${TTS ? `<div class="section"><h3>발음 속도</h3>${rateChips('s-rate')}
        <div class="muted" style="margin-top:8px">카드의 발음 듣기, 듣기 모드, 받아쓰기에 같이 쓰여요.</div></div>` : ''}
      <div class="section"><h3>즐겨찾기·오답노트·시험 기록</h3>
        <button class="btn" id="btn-export">내보내기 (JSON)</button>
        <button class="btn" id="btn-import">가져오기</button>
        <input type="file" id="file-import" accept="application/json" hidden>
        <button class="btn danger" id="btn-reset">즐겨찾기·오답노트·기록 모두 지우기</button>
        <div class="muted" style="margin-top:10px">데이터 빌드: ${data.builtAt ? data.builtAt.replace('T', ' ').slice(0, 16) : '-'}</div>
      </div>`;
    $('#s-back').onclick = () => selectTab('cards');
    if (TTS) wireRate('s-rate', () => say('This is how fast I will read.'));
    $('#btn-export').onclick = () => {
      const blob = new Blob([JSON.stringify({ marks }, null, 2)], { type: 'application/json' });
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
        toast('가져왔어요'); renderStats();
      } catch { toast('파일 형식이 맞지 않아요'); }
    };
    $('#btn-reset').onclick = () => {
      if (!confirm('즐겨찾기, 오답노트, 시험 기록을 모두 지울까요? 되돌릴 수 없어요.')) return;
      marks = {}; save(K_MARKS, marks); toast('지웠어요'); renderStats();
    };
  }

  // ───────── 탭 / 공통 ─────────
  function showView(name) {
    if (name !== 'listen') stopListen();
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
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
      $('#cards-body').innerHTML = `<div class="done"><h2>데이터를 불러오지 못했어요</h2><p>온라인 상태에서 한 번 열어 두면 이후엔 오프라인에서도 열립니다.</p></div>`;
      return;
    }
    try { grammar = await (await fetch('grammar.json', { cache: 'no-cache' })).json(); } catch {}
    selectTab(location.hash.startsWith('#g/') ? 'grammar' : 'cards');
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  init();
})();
