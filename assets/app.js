const STATUS_LABEL = { pending:'Upcoming', won:'Won', lost:'Lost', void:'Void' };

function statusBadgeHtml(status){
  const s = status || 'pending';
  if(s === 'won' || s === 'lost'){
    return `<span class="badge-3d badge-3d-${s}">${STATUS_LABEL[s]}</span>`;
  }
  return `<span class="status-badge status-${s}">${STATUS_LABEL[s]||s}</span>`;
}

function legTagHtml(status){
  const s = status || 'pending';
  return `<span class="leg-tag leg-tag-${s}">${STATUS_LABEL[s]||s}</span>`;
}

function resolvedSlipCard(s){
  const legs = (s.legs||[]).map(leg => `
    <div class="yesterday-leg">
      <span>${leg.match}${leg.score ? ` <span class="leg-score">(${leg.score})</span>` : ''}${leg.pick ? ' — ' + leg.pick : ''}</span>
      ${legTagHtml(leg.status)}
    </div>`).join('');
  return `
    <div class="yesterday-card">
      <div class="yesterday-head">
        <div class="yesterday-head-name">
          <span>${s.name}</span>
          ${s.combined_odds ? `<span class="yesterday-odds">${s.combined_odds}</span>` : ''}
        </div>
        ${statusBadgeHtml(s.status)}
      </div>
      ${legs ? `<div class="yesterday-legs">${legs}</div>` : ''}
    </div>`;
}
const STORAGE_KEY = 'dsg-site-data';


function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
}

let lastUpdatedIso = null;
let lastRenderedData = null;

function timeAgoText(iso){
  if(!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if(seconds < 60) return 'a few seconds ago';
  const minutes = Math.floor(seconds / 60);
  if(minutes < 60) return `${minutes} minute${minutes===1?'':'s'} ago`;
  const hours = Math.floor(minutes / 60);
  if(hours < 24) return `${hours} hour${hours===1?'':'s'} ago`;
  const days = Math.floor(hours / 24);
  if(days < 30) return `${days} day${days===1?'':'s'} ago`;
  const months = Math.floor(days / 30);
  if(months < 12) return `${months} month${months===1?'':'s'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years===1?'':'s'} ago`;
}

function setUpdatedStamp(iso){
  const el = document.getElementById('updated-stamp');
  if(!el) return;
  const labelEl = el.querySelector('.updated-label');
  const timeEl = el.querySelector('.updated-time');
  if(labelEl && timeEl){
    labelEl.textContent = 'Updated';
    timeEl.textContent = iso ? timeAgoText(iso) : '';
  }
}

function tickUpdatedStamp(){
  if(lastUpdatedIso) setUpdatedStamp(lastUpdatedIso);
}
function tickLiveUpdates(){
  if(lastRenderedData) render(lastRenderedData);
}
setInterval(tickLiveUpdates, 30000);

// A match is assumed to run ~130 minutes (90 + stoppage + halftime buffer) from kickoff
const MATCH_DURATION_MS = 130 * 60 * 1000;

function liveStateForLegs(legs){
  if(!legs || !legs.length) return 'pending';
  const now = Date.now();
  let anyStarted = false;
  let allFinished = true;
  for(const leg of legs){
    if(!leg.kickoff_iso){ allFinished = false; continue; }
    const kt = new Date(leg.kickoff_iso).getTime();
    if(isNaN(kt)){ allFinished = false; continue; }
    if(now >= kt) anyStarted = true;
    if(now < kt + MATCH_DURATION_MS) allFinished = false;
  }
  if(!anyStarted) return 'pending';
  if(!allFinished) return 'live';
  return 'finished';
}

function pendingStateBadgeHtml(legs){
  const state = liveStateForLegs(legs);
  const LABELS = { pending:'Upcoming', live:'Running', finished:'Finished' };
  return `<span class="status-badge status-pend-${state}">${LABELS[state]}</span>`;
}

function ticketCard(slip){
  const status = slip.status || 'pending';
  const legsHtml = (slip.legs||[]).map(leg => `
    <div class="leg">
      <div>
        <div>${leg.match}</div>
        <div class="leg-meta">${leg.competition||''} · ${leg.kickoff||''} · ${leg.market}: ${leg.pick}</div>
      </div>
      <div class="leg-odds">${leg.odds}</div>
    </div>`).join('');
  return `
    <div class="ticket">
      <div class="ticket-top">
        <div>
          <div class="ticket-name">${slip.name}</div>
          ${status === 'pending' ? pendingStateBadgeHtml(slip.legs) : statusBadgeHtml(status)}
        </div>
        <div class="ticket-odds"><div class="num">${slip.combined_odds}</div><div class="label">TOTAL ODDS</div></div>
      </div>
      <div class="ticket-perf"></div>
      ${legsHtml || '<p class="empty-note">No legs added yet.</p>'}
    </div>`;
}

function buildTrackRecord(data){
  const order = (data.today?.slips||[]).map(s=>s.name);
  const map = {};
  (data.history||[]).forEach(day=>{
    (day.slips||[]).forEach(s=>{
      if(!map[s.name]) map[s.name]=[];
      map[s.name].push({ date: day.date, status: s.status });
    });
  });
  const names = order.length ? order : Object.keys(map);
  return names.map(name=>{
    const entries = map[name] || [];
    const won = entries.filter(e=>e.status==='won').length;
    const lost = entries.filter(e=>e.status==='lost').length;
    const rate = (won+lost) > 0 ? Math.round((won/(won+lost))*100) + '%' : '—';
    const dots = entries.slice(0,12).map(e=>`<span class="dot dot-${e.status||'void'}" title="${e.date}: ${STATUS_LABEL[e.status]||e.status}"></span>`).join('');
    return { name, dots, rate, count: entries.length };
  });
}

function render(data){
  lastRenderedData = data;
  lastUpdatedIso = data.site?.updated || null;
  setUpdatedStamp(lastUpdatedIso);
  document.getElementById('today-date').textContent = (fmtDate(data.today?.date) || "TODAY'S FIXTURES").toUpperCase();

  const slips = data.today?.slips || [];
  document.getElementById('stat-row').innerHTML = `
    <div class="stat-pill"><b>${slips.length}</b> slips today</div>
    <div class="stat-pill"><b>${(data.today?.all_picks||[]).length}</b> matches analyzed</div>`;

  const history = data.history || [];
  const yesterday = history[0];
  document.getElementById('yesterday-wrap').innerHTML = yesterday
    ? (yesterday.slips||[]).map(resolvedSlipCard).join('')
    : `<p class="empty-note">No slips recorded yet — results will show up here after day one.</p>`;

  document.getElementById('ticket-grid').innerHTML = slips.length
    ? slips.map(ticketCard).join('')
    : `<p class="empty-note">Today's slips aren't up yet — check back soon.</p>`;

  const track = buildTrackRecord(data);
  document.getElementById('track-body').innerHTML = track.some(t=>t.count>0)
    ? track.map(t=>`<tr><td>${t.name}</td><td><div class="form-dots">${t.dots || '<span class="empty-note">No history yet</span>'}</div></td><td class="rate">${t.rate}</td></tr>`).join('')
    : `<tr><td colspan="3" class="empty-note">Track record builds up once a few days of results are in.</td></tr>`;

function boardRow(p){
  const state = liveStateForLegs([p]); // reuse the same kickoff-based live logic as slip tickets
  const LABELS = { pending:'Upcoming', live:'Running', finished:'Finished' };
  const statusHtml = `<span class="status-badge status-pend-${state}">${LABELS[state]}</span>`;
  const resultHtml = p.result
    ? `<span class="leg-score">${p.result}</span>`
    : (state === 'finished' ? '<span class="empty-note">TBC</span>' : '—');
  return `<tr><td>${p.match}</td><td>${p.competition||''}</td><td>${p.kickoff||''}</td><td>${p.market}</td><td>${p.pick}</td><td class="odds">${p.odds}</td><td>${statusHtml}</td><td>${resultHtml}</td></tr>`;
}

  const picks = data.today?.all_picks || [];
  document.getElementById('board-body').innerHTML = picks.length
    ? picks.map(boardRow).join('')
    : `<tr><td colspan="8" class="empty-note">No board data yet.</td></tr>`;

  const older = history.slice(1);
  document.getElementById('history-wrap').innerHTML = older.length
    ? older.map(day => `
      <details class="history-day">
        <summary><span>${fmtDate(day.date)}</span><span>▾</span></summary>
        ${(day.slips||[]).map(resolvedSlipCard).join('')}
      </details>`).join('')
    : `<p class="empty-note">Older results will build up here day by day.</p>`;
}

async function loadAndRender(){
  try{
    const res = await fetch('data/site-data.json', { cache: 'no-store' });
    if(!res.ok) throw new Error('failed to load data/site-data.json');
    const data = await res.json();
    lastRenderedData = data;
    render(data);
  }catch(e){
    document.getElementById('ticket-grid').innerHTML =
      '<p class="empty-note">Today\'s slips aren\'t up yet -- check back soon.</p>';
  }
}

loadAndRender();
