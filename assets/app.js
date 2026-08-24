const STATUS_LABEL = { pending:'Pending', won:'Won', lost:'Lost', void:'Void' };

function statusBadgeHtml(status){
  const s = status || 'pending';
  if(s === 'won' || s === 'lost'){
    return `<span class="badge-3d badge-3d-${s}">${STATUS_LABEL[s]}</span>`;
  }
  return `<span class="status-badge status-${s}">${STATUS_LABEL[s]||s}</span>`;
}
const STORAGE_KEY = 'dsg-site-data';


function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
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
          ${statusBadgeHtml(status)}
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
  document.getElementById('updated-stamp').textContent = data.site?.updated
    ? 'Updated ' + new Date(data.site.updated).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) + ' WAT'
    : '';
  document.getElementById('today-date').textContent = (fmtDate(data.today?.date) || "TODAY'S FIXTURES").toUpperCase();

  const slips = data.today?.slips || [];
  document.getElementById('stat-row').innerHTML = `
    <div class="stat-pill"><b>${slips.length}</b> slips today</div>
    <div class="stat-pill"><b>${(data.today?.all_picks||[]).length}</b> matches analyzed</div>`;

  const history = data.history || [];
  const yesterday = history[0];
  document.getElementById('yesterday-wrap').innerHTML = yesterday
    ? (yesterday.slips||[]).map(s=>`<div class="yesterday-row"><span>${s.name}</span>${statusBadgeHtml(s.status)}</div>`).join('')
    : `<p class="empty-note">No slips recorded yet — results will show up here after day one.</p>`;

  document.getElementById('ticket-grid').innerHTML = slips.length
    ? slips.map(ticketCard).join('')
    : `<p class="empty-note">Today's slips aren't up yet — check back soon.</p>`;

  const track = buildTrackRecord(data);
  document.getElementById('track-body').innerHTML = track.some(t=>t.count>0)
    ? track.map(t=>`<tr><td>${t.name}</td><td><div class="form-dots">${t.dots || '<span class="empty-note">No history yet</span>'}</div></td><td class="rate">${t.rate}</td></tr>`).join('')
    : `<tr><td colspan="3" class="empty-note">Track record builds up once a few days of results are in.</td></tr>`;

  const picks = data.today?.all_picks || [];
  document.getElementById('board-body').innerHTML = picks.length
    ? picks.map(p=>`<tr><td>${p.match}</td><td>${p.competition||''}</td><td>${p.kickoff||''}</td><td>${p.market}</td><td>${p.pick}</td><td class="odds">${p.odds}</td></tr>`).join('')
    : `<tr><td colspan="6" class="empty-note">No board data yet.</td></tr>`;

  const older = history.slice(1);
  document.getElementById('history-wrap').innerHTML = older.length
    ? older.map(day => `
      <details class="history-day">
        <summary><span>${fmtDate(day.date)}</span><span>▾</span></summary>
        ${(day.slips||[]).map(s=>`<div class="slip-row"><span>${s.name}</span>${statusBadgeHtml(s.status)}</div>`).join('')}
      </details>`).join('')
    : `<p class="empty-note">Older results will build up here day by day.</p>`;
}

async function loadAndRender(){
  try{
    const res = await fetch('data/site-data.json', { cache: 'no-store' });
    if(!res.ok) throw new Error('failed to load data/site-data.json');
    const data = await res.json();
    render(data);
  }catch(e){
    document.getElementById('ticket-grid').innerHTML =
      '<p class="empty-note">Today\'s slips aren\'t up yet -- check back soon.</p>';
  }
}

loadAndRender();
