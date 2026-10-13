(() => {
  'use strict';

  // ───────── 저장소 ─────────
  const K_MARKS = 'eng-marks';        // { cardId: { fav: true, review: true } }
  const K_SETTINGS = 'eng-settings';
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const TYPES = ['단어', '표현', '패턴'];
  const MARK_LABEL = { review: '복습', fav: '즐겨찾기' };
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
    repeat: svg('M5 11a7 7 0 0 1 12.5-4.3L19.5 9M19.5 4.5V9H15M19 13a7 7 0 0 1-12.5 4.3L4.5 15M4.5 19.5V15H9'),
    empty: svg('M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5zM12 9v6M9 12h6'),
    check: svg('M5 12.5l4.5 4.5L19 7.5'),
    x: svg('M6.5 6.5l11 11M17.5 6.5l-11 11'),
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
  // 필터: all | review | fav | 단어 | 표현 | 패턴
  const pool = (f) => data.cards.filter(c => f === 'all' ? true : (f === 'review' || f === 'fav') ? isMarked(c, f) : c.category === f);
  const filterLabel = (f) => f === 'all' ? '전체' : MARK_LABEL[f] || f;
  // 표시한 부분을 감싸서 보여준다
  function withMark(text, mark, wrap) {
    const i = mark ? text.indexOf(mark) : -1;
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + wrap(text.slice(i, i + mark.length)) + esc(text.slice(i + mark.length));
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
          <button class="icon-btn" id="open-stats" aria-label="기록·설정">${ICON.chart}</button>
        </div>
      </header>
      <div class="subbar"><div class="chips" id="filters"></div><div id="sub-right"></div></div>
      <div id="cards-main"></div>`;
    $('#open-stats').onclick = () => showView('stats');
    document.querySelectorAll('.iseg button').forEach(b => b.onclick = () => {
      settings.mode = b.dataset.mode; save(K_SETTINGS, settings); renderCards();
    });
    renderFilters();
    if (mode === 'card') renderStudy(); else renderList();
  }
  function renderFilters() {
    const keys = ['all', 'review', 'fav', ...TYPES.filter(t => pool(t).length)];
    $('#filters').innerHTML = keys.map(k =>
      `<button data-f="${k}" class="${k === filter ? 'active' : ''}">${filterLabel(k)} ${pool(k).length}</button>`).join('');
    $('#filters').querySelectorAll('button').forEach(b => b.onclick = () => { filter = b.dataset.f; renderCards(); });
  }
  const emptyText = () => filter === 'review' ? '복습에 추가한 카드가 없어요' : filter === 'fav' ? '즐겨찾기한 카드가 없어요' : '아직 카드가 없어요';
  const emptyHint = () => (filter === 'review' || filter === 'fav') ? '카드를 보다가 아래 버튼으로 추가할 수 있어요.' : '공부한 내용을 정리해서 올리면 여기에 나타납니다.';
  const emptyHtml = () => `<div class="done"><div class="blob">${ICON.empty}</div><h2>${esc(emptyText())}</h2><p>${emptyHint()}</p></div>`;

  function examplesHtml(c) {
    const hi = (t) => `<mark>${esc(t)}</mark>`;
    return (c.examples || []).map(ex => `
      <div class="ex">
        <div class="en">${withMark(ex.en, ex.mark, hi)}</div>
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
      <div class="card" id="card">
        <div class="type">${esc(c.category)}</div>
        <div class="front">${esc(c.front)}</div>
        <div class="hint">탭해서 뜻과 예문 보기</div>
        <div class="back">
          ${c.meaning ? `<div class="meaning">${esc(c.meaning)}</div>` : ''}
          ${backHtml(c)}
          <div class="src">${esc(c.title)} · ${esc(c.date)}</div>
        </div>
      </div>
      <div class="actions">
        <button id="btn-prev" aria-label="이전 카드" ${s.idx === 0 ? 'disabled' : ''}>${ICON.left}</button>
        <button class="mark" id="btn-fav">${ICON.star}즐겨찾기</button>
        <button class="mark" id="btn-review">${ICON.repeat}복습</button>
        <button class="primary" id="btn-next">${last ? '처음으로' : '다음'}${ICON.right}</button>
      </div>`;
    const paintMarks = () => {
      for (const [id, k] of [['#btn-fav', 'fav'], ['#btn-review', 'review']]) {
        $(id).classList.toggle('on', isMarked(c, k)); $(id).setAttribute('aria-pressed', isMarked(c, k));
      }
    };
    paintMarks();
    const onMark = (k) => () => { toast(`${MARK_LABEL[k]}${toggleMark(c, k) ? '에 추가했어요' : '에서 뺐어요'}`); paintMarks(); renderFilters(); };
    $('#btn-fav').onclick = onMark('fav');
    $('#btn-review').onclick = onMark('review');
    const card = $('#card');
    let sx = 0, sy = 0, swiped = false;
    card.onclick = (e) => { if (!e.target.closest('a') && !swiped) flip(); };
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
    const mk = (c, k, icon) => `<button class="mk ${isMarked(c, k) ? 'on' : ''}" data-k="${k}" aria-label="${MARK_LABEL[k]}" aria-pressed="${isMarked(c, k)}">${icon}</button>`;
    let html = '';
    for (const [key, list] of groups) {
      const [date, title] = key.split('|');
      html += `<div class="group"><span>${esc(title)}</span><span>${esc(date)}</span></div>`;
      for (const c of list) {
        html += `<div class="item" data-id="${c.id}">
          <div class="row">
            <div class="txt"><div class="front">${esc(c.front)}<span class="tag">${esc(c.category)}</span></div><div class="sum">${esc(c.meaning)}</div></div>
            ${mk(c, 'fav', ICON.star)}${mk(c, 'review', ICON.repeat)}
          </div>
          <div class="detail">${backHtml(c)}</div></div>`;
      }
    }
    body.innerHTML = html;
    wireGrammarLinks(body, 'cards');
    body.querySelectorAll('.item').forEach(el => {
      const c = data.cards.find(x => x.id === el.dataset.id);
      el.querySelector('.row').onclick = (e) => { if (!e.target.closest('.mk')) el.classList.toggle('open'); };
      el.querySelectorAll('.mk').forEach(b => b.onclick = () => {
        const k = b.dataset.k, on = toggleMark(c, k);
        toast(`${MARK_LABEL[k]}${on ? '에 추가했어요' : '에서 뺐어요'}`);
        if (filter === k && !on) { renderFilters(); fillList(); return; }
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); renderFilters();
      });
    });
  }

  // ───────── 시험 (예문 빈칸 채우기) ─────────
  const QUIZ_MAX = 10;
  let quizSource = 'all';
  let quiz = null;                 // { items: [{ card, ex }], idx, results: [{ ok, given }], answered }
  const norm = (s) => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const quizItems = (f) => pool(f).flatMap(c => (c.examples || []).filter(ex => ex.mark && ex.en.includes(ex.mark)).map(ex => ({ card: c, ex })));

  function renderQuiz() {
    if (!quiz) return renderQuizStart();
    if (quiz.idx >= quiz.items.length) return renderQuizResult();
    renderQuizQuestion();
  }
  function renderQuizStart() {
    const sources = ['all', 'review', 'fav', ...TYPES.filter(t => pool(t).length)];
    const n = quizItems(quizSource).length;
    $('#quiz-body').innerHTML = `
      <header class="topbar"><h1>시험</h1></header>
      <p class="lead">예문의 빈칸에 들어갈 말을 맞혀 보세요. 해석에서 강조된 부분이 빈칸의 뜻입니다.</p>
      <div class="label">범위</div>
      <div class="chips wrap" id="q-src">${sources.map(k => `<button data-f="${k}" class="${k === quizSource ? 'active' : ''}">${filterLabel(k)} ${quizItems(k).length}</button>`).join('')}</div>
      <div class="q-start">
        <div class="big">${Math.min(n, QUIZ_MAX)}<small>문제</small></div>
        <div class="muted">${n > QUIZ_MAX ? `${n}개 중에서 ${QUIZ_MAX}개를 뽑아요` : n ? '고른 범위의 예문 전부' : '이 범위에는 낼 문제가 없어요'}</div>
        <button class="cta" id="q-go" ${n ? '' : 'disabled'}>시작</button>
      </div>`;
    $('#q-src').querySelectorAll('button').forEach(b => b.onclick = () => { quizSource = b.dataset.f; renderQuizStart(); });
    $('#q-go').onclick = () => { quiz = { items: shuffle(quizItems(quizSource)).slice(0, QUIZ_MAX), idx: 0, results: [], answered: false }; renderQuiz(); };
  }
  function renderQuizQuestion() {
    const { card: c, ex } = quiz.items[quiz.idx];
    const words = ex.mark.trim().split(/\s+/).length;
    const blank = `<span class="blank">${Array.from({ length: words }, () => '<i></i>').join('')}</span>`;
    quiz.answered = false;
    $('#quiz-body').innerHTML = `
      <header class="topbar"><button class="back" id="q-quit">그만하기</button><div class="right">${quiz.idx + 1} / ${quiz.items.length}</div></header>
      <div class="progress"><div style="width:${quiz.idx / quiz.items.length * 100}%"></div></div>
      <div class="q-card">
        <div class="type">${esc(c.category)} · 단어 ${words}개</div>
        <div class="q-en" id="q-en">${withMark(ex.en, ex.mark, () => blank)}</div>
        <div class="q-ko">${withMark(ex.ko || c.meaning, ex.koMark, t => `<mark>${esc(t)}</mark>`)}</div>
        ${ex.koMark ? '' : `<div class="q-hint">뜻: <mark>${esc(c.meaning)}</mark></div>`}
      </div>
      <div id="q-answer">
        <form id="q-form" autocomplete="off">
          <input id="q-input" type="text" inputmode="text" placeholder="빈칸에 들어갈 말" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
          <div class="q-btns"><button type="button" class="ghost" id="q-skip">모르겠어요</button><button type="submit" class="cta">확인</button></div>
        </form>
      </div>`;
    $('#q-quit').onclick = () => { quiz = null; renderQuiz(); };
    $('#q-skip').onclick = () => grade('');
    $('#q-form').onsubmit = (e) => {
      e.preventDefault();
      const v = $('#q-input').value;
      if (!v.trim()) { $('#q-input').classList.add('shake'); setTimeout(() => $('#q-input') && $('#q-input').classList.remove('shake'), 300); return; }
      grade(v);
    };
  }
  function grade(given) {
    if (quiz.answered) return;
    quiz.answered = true;
    const { card: c, ex } = quiz.items[quiz.idx];
    const ok = !!given && norm(given) === norm(ex.mark);
    quiz.results.push({ ok, given });
    const last = quiz.idx === quiz.items.length - 1;
    $('#q-en').innerHTML = withMark(ex.en, ex.mark, t => `<mark class="${ok ? 'ok' : 'no'}">${esc(t)}</mark>`);
    $('#q-answer').innerHTML = `
      <div class="q-result ${ok ? 'ok' : 'no'}">
        <div class="head">${ok ? ICON.check : ICON.x}<b>${ok ? '맞았어요' : given ? '아쉬워요' : '정답을 확인하세요'}</b></div>
        ${!ok && given ? `<div class="given">내 답: ${esc(given)}</div>` : ''}
        <div class="ans"><b>${esc(c.front)}</b> ${esc(c.meaning)}</div>
        ${ex.grammar.length ? `<div class="gram">${ex.grammar.map(g => g.articleId
          ? `<a class="g-row" href="#g/${g.articleId}"><b>${esc(g.name)}</b>${esc(g.desc)}</a>`
          : `<span class="g-row"><b>${esc(g.name)}</b>${esc(g.desc)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="q-btns">
        <button class="ghost mark" id="q-review">${ICON.repeat}복습</button>
        <button class="cta" id="q-next">${last ? '결과 보기' : '다음'}</button>
      </div>`;
    const paint = () => { $('#q-review').classList.toggle('on', isMarked(c, 'review')); };
    paint();
    $('#q-review').onclick = () => { toast(`복습${toggleMark(c, 'review') ? '에 추가했어요' : '에서 뺐어요'}`); paint(); };
    $('#q-next').onclick = () => { quiz.idx += 1; renderQuiz(); window.scrollTo(0, 0); };
    wireGrammarLinks($('#q-answer'), 'quiz');
    $('#q-next').focus({ preventScroll: true });
  }
  function renderQuizResult() {
    const total = quiz.items.length;
    const right = quiz.results.filter(r => r.ok).length;
    const wrong = quiz.items.filter((_, i) => !quiz.results[i].ok);
    const wrongCards = [...new Map(wrong.map(w => [w.card.id, w.card])).values()];
    const pending = wrongCards.filter(c => !isMarked(c, 'review'));
    $('#quiz-body').innerHTML = `
      <header class="topbar"><h1>결과</h1></header>
      <div class="q-start">
        <div class="big">${right}<small>/ ${total}</small></div>
        <div class="muted">${right === total ? '전부 맞았어요' : `${total - right}문제를 놓쳤어요`}</div>
      </div>
      ${wrong.length ? `<div class="label">놓친 문제</div>${wrong.map(w => `
        <div class="item"><div class="row static"><div class="txt">
          <div class="front">${esc(w.card.front)}</div>
          <div class="sum wrap">${withMark(w.ex.en, w.ex.mark, t => `<mark>${esc(t)}</mark>`)}</div>
        </div></div></div>`).join('')}
        ${pending.length ? `<button class="btn" id="q-add">놓친 카드 ${pending.length}장 복습에 추가</button>` : `<div class="muted center">놓친 카드는 모두 복습에 들어 있어요</div>`}` : ''}
      <button class="cta block" id="q-again">다시 풀기</button>
      <button class="btn" id="q-home">범위 다시 고르기</button>`;
    const add = $('#q-add');
    if (add) add.onclick = () => { pending.forEach(c => setMark(c, 'review', true)); toast(`${pending.length}장을 복습에 추가했어요`); renderQuizResult(); };
    $('#q-again').onclick = () => { quiz = { items: shuffle(quizItems(quizSource)).slice(0, QUIZ_MAX), idx: 0, results: [], answered: false }; renderQuiz(); };
    $('#q-home').onclick = () => { quiz = null; renderQuiz(); };
  }

  // ───────── 문법 (개념 문서) ─────────
  const TAB_NAME = { cards: '카드', quiz: '시험' };
  const articleIdFromHash = () => (location.hash.match(/^#g\/(\w+)/) || [])[1];
  function renderGrammar() {
    const body = $('#grammar-body');
    const art = grammar.articles.find(a => a.id === articleIdFromHash());
    const meta = (a) => `${esc(a.date)}${a.tags.length ? ' · ' + a.tags.map(t => '#' + esc(t)).join(' ') : ''}`;
    if (art) {
      const backLabel = returnTab ? `${TAB_NAME[returnTab]}로 돌아가기` : '문법 목록';
      body.innerHTML = `
        <header class="topbar"><button class="back" id="g-back">← ${backLabel}</button></header>
        <article class="article">
          <h1>${esc(art.title)}</h1>
          <div class="meta">${meta(art)}</div>
          ${art.html}
        </article>
        <button class="btn" id="g-back2">${backLabel}</button>`;
      const back = () => {
        if (returnTab) { const t = returnTab; returnTab = null; history.replaceState(null, '', location.pathname); selectTab(t, false, true); }
        else location.hash = '';
      };
      $('#g-back').onclick = back; $('#g-back2').onclick = back;
    } else {
      returnTab = null;
      body.innerHTML = `
        <header class="topbar"><h1>문법</h1><div class="right"><span>${grammar.articles.length}편</span></div></header>
        ${grammar.articles.length ? grammar.articles.map(a => `
          <a class="g-item" href="#g/${a.id}">
            <div class="g-title">${esc(a.title)}</div>
            ${a.summary ? `<div class="g-sum">${esc(a.summary)}</div>` : ''}
            <div class="g-meta">${meta(a)}</div>
          </a>`).join('') : `<div class="empty">아직 문법 문서가 없어요</div>`}`;
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
    $('#stats-body').innerHTML = `
      <header class="topbar"><button class="back" id="s-back">← 카드로 돌아가기</button></header>
      <header class="topbar"><h1>기록·설정</h1></header>
      <div class="metrics">
        <div class="metric"><div class="label">전체 카드</div><div class="value">${data.cards.length}</div></div>
        <div class="metric"><div class="label">문법 문서</div><div class="value">${grammar.articles.length}</div></div>
        <div class="metric"><div class="label">복습</div><div class="value">${count('review')}</div></div>
        <div class="metric"><div class="label">즐겨찾기</div><div class="value">${count('fav')}</div></div>
      </div>
      <div class="section"><h3>종류별</h3>
        ${byCat.map(([k, n]) => `<div class="bar-row"><span class="name">${esc(k)}</span><div class="bar"><div style="width:${n / max * 100}%"></div></div><span class="n">${n}</span></div>`).join('')}
      </div>
      <div class="section"><h3>복습·즐겨찾기 데이터</h3>
        <button class="btn" id="btn-export">내보내기 (JSON)</button>
        <button class="btn" id="btn-import">가져오기</button>
        <input type="file" id="file-import" accept="application/json" hidden>
        <button class="btn danger" id="btn-reset">복습·즐겨찾기 모두 지우기</button>
        <div class="muted" style="margin-top:10px">데이터 빌드: ${data.builtAt ? data.builtAt.replace('T', ' ').slice(0, 16) : '-'}</div>
      </div>`;
    $('#s-back').onclick = () => selectTab('cards');
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
      if (!confirm('복습과 즐겨찾기 표시를 모두 지울까요? 되돌릴 수 없어요.')) return;
      marks = {}; save(K_MARKS, marks); toast('지웠어요'); renderStats();
    };
  }

  // ───────── 탭 / 공통 ─────────
  function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    if (name === 'cards') renderCards();
    if (name === 'grammar') renderGrammar();
    if (name === 'stats') renderStats();
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
    const sameQuiz = b.dataset.tab === 'quiz' && quiz && quiz.answered;
    selectTab(b.dataset.tab, false, sameQuiz);
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
