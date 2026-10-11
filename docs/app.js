(() => {
  'use strict';

  // ───────── 저장소 ─────────
  const K_PROGRESS = 'eng-progress';
  const K_SETTINGS = 'eng-settings';
  const K_LOG = 'eng-log';
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let data = { cards: [], categories: [] };
  let progress = load(K_PROGRESS, {});
  let settings = Object.assign({ newPerDay: 20 }, load(K_SETTINGS, {}));
  let log = load(K_LOG, {});          // { 'YYYY-MM-DD': { reviews, new } }

  const today = () => {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  const addDays = (n) => {
    const d = new Date(); d.setDate(d.getDate() + n); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel) => document.querySelector(sel);

  // ───────── 간격반복 (단순화한 SM-2) ─────────
  const KNOWN_DAYS = 21;
  function status(card) {
    const p = progress[card.id];
    if (!p || p.reps === 0 && !p.lapses) return 'new';
    return p.interval >= KNOWN_DAYS ? 'known' : 'learning';
  }
  function dueToday(card) {
    const p = progress[card.id];
    return p && p.due <= today();
  }
  function rate(card, grade) {
    const t = today();
    const p = progress[card.id] || { interval: 0, due: t, ease: 2.5, reps: 0, lapses: 0 };
    const wasNew = !progress[card.id];
    if (grade === 0) {            // 몰랐어요
      p.interval = 0; p.due = t; p.reps = 0; p.lapses += 1; p.ease = Math.max(1.3, p.ease - 0.2);
    } else if (grade === 1) {     // 애매해요
      p.interval = Math.max(1, p.interval); p.due = addDays(p.interval); p.reps += 1; p.ease = Math.max(1.3, p.ease - 0.15);
    } else {                      // 알았어요
      p.interval = p.reps === 0 ? 1 : p.reps === 1 ? 3 : Math.round(p.interval * p.ease);
      p.due = addDays(p.interval); p.reps += 1;
    }
    p.last = t; p.lastGrade = grade;
    progress[card.id] = p;
    save(K_PROGRESS, progress);
    const l = log[t] || { reviews: 0, new: 0 };
    l.reviews += 1; if (wasNew) l.new += 1;
    log[t] = l; save(K_LOG, log);
  }

  // ───────── 복습 세션 ─────────
  let queue = [];        // 이번 세션 카드
  let sessionTotal = 0;
  let browse = false;    // 전체 랜덤 훑어보기 모드
  let current = null;
  let flipped = false;

  function buildQueue() {
    const t = today();
    const due = shuffle(data.cards.filter(dueToday));
    const newToday = (log[t] || {}).new || 0;
    const room = Math.max(0, settings.newPerDay - newToday);
    const fresh = data.cards.filter(c => !progress[c.id]).slice(0, room);
    queue = [...due, ...fresh];
    sessionTotal = queue.length;
    browse = false;
  }
  function buildBrowse() {
    queue = shuffle([...data.cards]);
    sessionTotal = queue.length;
    browse = true;
  }
  function updateCounts() {
    $('#due-count').textContent = data.cards.filter(dueToday).length;
    const t = today();
    const newToday = (log[t] || {}).new || 0;
    const fresh = data.cards.filter(c => !progress[c.id]).length;
    $('#new-count').textContent = Math.min(fresh, Math.max(0, settings.newPerDay - newToday));
  }

  function renderReview() {
    updateCounts();
    const body = $('#review-body');
    if (!data.cards.length) {
      body.innerHTML = `<div class="done"><h2>아직 카드가 없어요</h2><p>notes/ 에 공부한 내용을 정리하고 빌드하면 여기에 나타납니다.</p></div>`;
      return;
    }
    if (!queue.length) {
      current = null;
      if (browse) {
        body.innerHTML = `<div class="done"><h2>전체를 한 바퀴 다 봤어요</h2><p>수고했어요.</p>
          <button class="btn" id="btn-browse">다시 랜덤으로 보기</button></div>`;
      } else {
        const total = data.cards.length;
        body.innerHTML = `<div class="done"><h2>오늘 복습 끝!</h2><p>${sessionTotal ? `${sessionTotal}장 복습했어요.` : '오늘 복습할 카드가 없어요.'} 전체 ${total}장</p>
          <button class="btn primary" id="btn-browse">전체 랜덤으로 훑어보기</button>
          <button class="btn" id="btn-more-new">새 카드 10장 더 보기</button></div>`;
        $('#btn-more-new').onclick = () => {
          const fresh = data.cards.filter(c => !progress[c.id]).slice(0, 10);
          if (!fresh.length) return toast('새 카드가 더 없어요');
          queue = fresh; sessionTotal = fresh.length; browse = false; renderReview();
        };
      }
      $('#btn-browse').onclick = () => { buildBrowse(); renderReview(); };
      return;
    }
    current = queue[0];
    flipped = false;
    const c = current;
    const done = sessionTotal - queue.length;
    body.innerHTML = `
      <div class="progress"><div style="width:${sessionTotal ? done / sessionTotal * 100 : 0}%"></div></div>
      <div class="card" id="card">
        <span class="cat">${esc(c.category)}</span>
        <div class="front">${esc(c.front)}</div>
        <div class="hint">탭해서 뒤집기</div>
        <div class="back">
          ${c.meaning ? `<div class="meaning">${esc(c.meaning)}</div>` : ''}
          ${c.example ? `<div class="example">${esc(c.example)}</div>` : ''}
          ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}
          <div class="src">${esc(c.title)} · ${esc(c.date)}${c.source ? ` · <a href="${esc(c.source)}" target="_blank" rel="noopener">영상</a>` : ''}</div>
        </div>
      </div>
      ${browse
        ? `<div class="grades hidden-btns" id="grades" style="grid-template-columns:1fr"><button class="good" data-g="next">다음</button></div>`
        : `<div class="grades hidden-btns" id="grades">
            <button class="bad" data-g="0">몰랐어요<small>잠시 후 다시</small></button>
            <button class="mid" data-g="1">애매해요<small>${nextLabel(c, 1)}</small></button>
            <button class="good" data-g="2">알았어요<small>${nextLabel(c, 2)}</small></button>
          </div>`}
      <div class="muted" style="text-align:center;margin-top:10px">${done + 1} / ${sessionTotal}</div>`;
    const card = $('#card');
    card.onclick = (e) => { if (e.target.tagName === 'A') return; flip(); };
    $('#grades').querySelectorAll('button').forEach(b => b.onclick = () => answer(b.dataset.g));
  }
  function nextLabel(card, grade) {
    const p = progress[card.id] || { interval: 0, ease: 2.5, reps: 0 };
    let n;
    if (grade === 1) n = Math.max(1, p.interval);
    else n = p.reps === 0 ? 1 : p.reps === 1 ? 3 : Math.round(p.interval * p.ease);
    return n === 1 ? '내일' : `${n}일 후`;
  }
  function flip() {
    if (flipped) return;
    flipped = true;
    $('#card').classList.add('flipped');
    $('#grades').classList.remove('hidden-btns');
  }
  function answer(g) {
    if (!flipped) return flip();
    const c = queue.shift();
    if (g === 'next') { renderReview(); return; }
    const grade = Number(g);
    rate(c, grade);
    if (grade === 0) {
      // 몇 장 뒤에 다시 보여주기
      const at = Math.min(queue.length, 3);
      queue.splice(at, 0, c);
      sessionTotal += 1;
    }
    renderReview();
  }

  // 키보드(데스크톱 테스트용): 스페이스 = 뒤집기, 1/2/3 = 평가
  document.addEventListener('keydown', (e) => {
    if (!$('#view-review').classList.contains('active') || !current) return;
    if (e.key === ' ') { e.preventDefault(); flip(); }
    if (browse && (e.key === 'Enter' || e.key === ' ') && flipped) answer('next');
    if (!browse && ['1', '2', '3'].includes(e.key) && flipped) answer(String(Number(e.key) - 1));
  });

  // ───────── 목록 ─────────
  let filterCat = '전체';
  let query = '';
  function renderChips() {
    const cats = ['전체', ...data.categories];
    $('#chips').innerHTML = cats.map(c => `<button class="${c === filterCat ? 'active' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
    $('#chips').querySelectorAll('button').forEach(b => b.onclick = () => { filterCat = b.dataset.c; renderChips(); renderList(); });
  }
  function renderList() {
    const q = query.trim().toLowerCase();
    const cards = data.cards.filter(c =>
      (filterCat === '전체' || c.category === filterCat) &&
      (!q || [c.front, c.meaning, c.example, c.note, c.title].join(' ').toLowerCase().includes(q)));
    $('#list-total').textContent = `${cards.length}장`;
    if (!cards.length) { $('#list-body').innerHTML = `<div class="empty">카드가 없어요</div>`; return; }
    const groups = new Map();
    for (const c of cards) {
      const key = `${c.date}|${c.title}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    let html = `<div class="legend"><span>새 카드</span><span class="learning">학습 중</span><span class="known">익숙함</span></div>`;
    for (const [key, list] of groups) {
      const [date, title] = key.split('|');
      html += `<div class="group"><span>${esc(title)}</span><span>${esc(date)}</span></div>`;
      for (const c of list) {
        html += `<div class="item" data-id="${c.id}">
          <div class="row"><span class="dot ${status(c)}"></span><span class="front">${esc(c.front)}</span><span class="cat">${esc(c.category)}</span></div>
          <div class="detail">
            ${c.meaning ? `<div class="meaning">${esc(c.meaning)}</div>` : ''}
            ${c.example ? `<div class="example">${esc(c.example)}</div>` : ''}
            ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}
          </div></div>`;
      }
    }
    $('#list-body').innerHTML = html;
    $('#list-body').querySelectorAll('.item').forEach(el => el.onclick = () => el.classList.toggle('open'));
  }
  $('#search').addEventListener('input', (e) => { query = e.target.value; renderList(); });

  // ───────── 통계 ─────────
  function renderStats() {
    const total = data.cards.length;
    const known = data.cards.filter(c => status(c) === 'known').length;
    const learning = data.cards.filter(c => status(c) === 'learning').length;
    const byCat = data.categories.map(cat => [cat, data.cards.filter(c => c.category === cat).length]);
    const max = Math.max(1, ...byCat.map(x => x[1]));
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      const key = d.toISOString().slice(0, 10);
      days.push([key, (log[key] || {}).reviews || 0]);
    }
    const wmax = Math.max(1, ...days.map(x => x[1]));
    const weekTotal = days.reduce((s, x) => s + x[1], 0);
    $('#stats-body').innerHTML = `
      <div class="metrics">
        <div class="metric"><div class="label">전체 카드</div><div class="value">${total}</div></div>
        <div class="metric"><div class="label">익숙함</div><div class="value">${total ? Math.round(known / total * 100) : 0}%</div></div>
        <div class="metric"><div class="label">학습 중</div><div class="value">${learning}</div></div>
        <div class="metric"><div class="label">이번 주 복습</div><div class="value">${weekTotal}</div></div>
      </div>
      <div class="section"><h3>카테고리별</h3>
        ${byCat.map(([k, n]) => `<div class="bar-row"><span class="name">${esc(k)}</span><div class="bar"><div style="width:${n / max * 100}%"></div></div><span class="n">${n}</span></div>`).join('')}
      </div>
      <div class="section"><h3>최근 7일 복습 횟수</h3>
        <div class="week">${days.map(([k, n]) => `<div><i style="height:${n / wmax * 100}%" title="${n}"></i><span>${k.slice(8)}</span></div>`).join('')}</div>
      </div>
      <div class="section">
        <div class="setting"><span>하루 새 카드 수</span><input type="number" min="0" max="200" id="new-per-day" value="${settings.newPerDay}"></div>
      </div>
      <div class="section"><h3>학습 데이터</h3>
        <button class="btn" id="btn-export">내보내기 (JSON)</button>
        <button class="btn" id="btn-import">가져오기</button>
        <input type="file" id="file-import" accept="application/json" hidden>
        <button class="btn danger" id="btn-reset">학습 데이터 초기화</button>
        <div class="muted" style="margin-top:10px">데이터 빌드: ${data.builtAt ? data.builtAt.replace('T', ' ').slice(0, 16) : '-'}</div>
      </div>`;
    $('#new-per-day').onchange = (e) => { settings.newPerDay = Math.max(0, Number(e.target.value) || 0); save(K_SETTINGS, settings); updateCounts(); };
    $('#btn-export').onclick = () => {
      const blob = new Blob([JSON.stringify({ progress, settings, log }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `eng-progress-${today()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('#btn-import').onclick = () => $('#file-import').click();
    $('#file-import').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        if (!obj.progress) throw new Error();
        progress = obj.progress; settings = Object.assign(settings, obj.settings || {}); log = obj.log || {};
        save(K_PROGRESS, progress); save(K_SETTINGS, settings); save(K_LOG, log);
        toast('가져왔어요'); buildQueue(); renderAll();
      } catch { toast('파일 형식이 맞지 않아요'); }
    };
    $('#btn-reset').onclick = () => {
      if (!confirm('모든 학습 기록을 지울까요? 되돌릴 수 없어요.')) return;
      progress = {}; log = {}; save(K_PROGRESS, progress); save(K_LOG, log);
      toast('초기화했어요'); buildQueue(); renderAll();
    };
  }

  // ───────── 탭 / 공통 ─────────
  function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'review') renderReview();
    if (name === 'list') renderList();
    if (name === 'stats') renderStats();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showView(b.dataset.view));

  let toastTimer;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
  }
  function renderAll() { renderChips(); renderReview(); renderList(); renderStats(); }

  async function init() {
    try {
      const res = await fetch('data.json', { cache: 'no-cache' });
      data = await res.json();
    } catch {
      $('#review-body').innerHTML = `<div class="done"><h2>데이터를 불러오지 못했어요</h2><p>온라인 상태에서 한 번 열어 두면 이후엔 오프라인에서도 열립니다.</p></div>`;
      return;
    }
    data.categories = data.categories || [...new Set(data.cards.map(c => c.category))];
    buildQueue();
    renderAll();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  init();
})();
