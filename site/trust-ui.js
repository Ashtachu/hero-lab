/* Hero Lab patch provenance: intentionally shows uncertainty instead of asserting that every stat is current. */
(() => {
  'use strict';
  const data = window.OW_DB || {};
  const live = data.liveEngine || {};
  const statuses = live.heroStatus || {};
  const heroRoot = document.getElementById('hero-detail');
  const patchRoot = document.getElementById('patch-dashboard');
  const pending = (live.entries || []).filter(e => e.status !== 'auto_verified' && e.status !== 'manually_verified' && e.status !== 'dismissed');
  const totalHeroes = (data.heroes || []).length;
  const source = typeof live.source_url === 'string' && live.source_url.startsWith('https://overwatch.blizzard.com/') ? live.source_url : 'https://overwatch.blizzard.com/en-us/news/patch-notes/';
  const make = (tag, cls, value) => { const el = document.createElement(tag); if (cls) el.className=cls; if (value != null) el.textContent=value; return el; };
  const isoDate = (value) => {
    if (!value) return 'Not recorded';
    const dt = new Date(value);
    return Number.isFinite(dt.valueOf()) ? dt.toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'}) : 'Invalid recorded date';
  };
  const elapsedMinutes = () => {
    const t = new Date(live.checked_at).getTime();
    return Number.isFinite(t) ? (Date.now()-t)/60000 : Infinity;
  };
  const health = () => {
    if (live.status !== 'checked' || !live.checked_at) return {kind:'unknown', label:'No verified poll available'};
    if (elapsedMinutes() > 120) return {kind:'stale',label:'Blizzard check overdue'};
    return {kind:'checked',label:'Blizzard page checked'};
  };
  const pill = (kind, label) => make('span', 'trust-pill '+kind, label);
  const field = (name,value,note) => {
    const item=make('div','trust-field');item.append(make('span','',name),make('strong','',value));
    if(note) item.append(make('small','',note)); return item;
  };
  const openNotes = (hero, count) => {
    if (!count) return null;
    const notes=pending.filter(e=>e.hero===hero).slice(0,5);
    const details=make('details','trust-details');
    details.append(make('summary','',`Review queue · ${count} recorded change${count===1?'':'s'}`));
    if (!notes.length) details.append(make('p','trust-warning','The published notes preview is limited. Check the Patch History for additional entries.'));
    for (const note of notes) {
      const row=make('div','trust-pending');
      row.append(make('em','',`${note.patch_date} · ${note.game_mode||'mode unknown'}${note.ability?' · '+note.ability:''}`),make('span','',note.text||'Change details unavailable'));
      details.append(row);
    }
    return details;
  };
  const heroTitle = () => heroRoot?.querySelector('.hero-calm-name h2')?.textContent?.trim() || '';
  function renderHero() {
    if (!heroRoot) return;
    const hero=heroTitle();
    if (!hero || !statuses[hero]) return;
    const old=document.getElementById('trust-hero-card');
    if(old?.dataset.hero===hero) return;
    if(old) old.remove();
    const s=statuses[hero]; const poll=health();
    const card=make('section','trust-card');card.id='trust-hero-card';card.dataset.hero=hero;
    card.setAttribute('aria-label',`Patch accuracy for ${hero}`);
    const header=make('div','trust-header'); const head=make('div');
    head.append(make('h3','trust-heading','Patch accuracy · '+hero),make('p','trust-subheading','A fresh source check is not proof that every gameplay number is verified.'));
    header.append(head,pill(s.awaiting_review_count>0?'review':poll.kind,s.awaiting_review_count>0?`${s.awaiting_review_count} change${s.awaiting_review_count===1?'':'s'} awaiting review`:poll.label));
    card.append(header);
    const grid=make('div','trust-fields');
    grid.append(field('Last Blizzard check',isoDate(s.last_blizzard_check_at),poll.kind==='stale'?'Overdue: check the scheduled workflow':poll.label),
      field('Last verified stats update',isoDate(s.last_verified_stats_at),s.last_verified_stat_source==='official_patch'?'From a validated Blizzard stat change':s.last_verified_stats_at?'From the seeded reference; not newly confirmed by Blizzard':'No verified numeric stat recorded'),
      field('Awaiting review',String(s.awaiting_review_count||0),s.latest_pending_date?`Newest flagged note: ${s.latest_pending_date}`:'No pending changes detected by this parser'));
    card.append(grid);
    if(s.last_auto_verified_patch_date) card.append(make('p','trust-warning',`Last safely applied Blizzard stat change: ${s.last_auto_verified_patch_date}. Other mechanics may still need review.`));
    if(s.awaiting_review_count) card.append(make('p','trust-warning','Important: pending changes are shown for transparency but have not been applied to damage, matchup, or TTK calculations.'));
    if(poll.kind==='stale') card.append(make('p','trust-warning','The latest published check is overdue. The app cannot confirm that newer Blizzard changes have been processed.'));
    const notes=openNotes(hero,s.awaiting_review_count||0);if(notes) card.append(notes);
    const link=make('a','trust-source-link','Official Blizzard patch notes');link.href=source;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
    const anchor=heroRoot.querySelector('.hero-calm-header');
    if (anchor) anchor.insertAdjacentElement('afterend',card);else heroRoot.prepend(card);
  }
  function renderBoard() {
    if(!patchRoot || document.getElementById('trust-board'))return;
    const board=make('section','trust-board');board.id='trust-board';board.setAttribute('aria-label','Hero patch verification overview');
    const head=make('div','trust-header');const title=make('div');title.append(make('h3','trust-heading','Patch accuracy by hero'),make('p','trust-subheading','Source polling, stat verification, and unreviewed changes are tracked separately.'));
    head.append(title,pill(health().kind,health().label));board.append(head);
    const grid=make('div','trust-fields');const waiting=Object.values(statuses).filter(x=>x.awaiting_review_count>0).length;
    grid.append(field('Last Blizzard check',isoDate(live.checked_at),'Official patch notes source'),field('Heroes with pending notes',`${waiting} / ${totalHeroes}`,'Pending changes do not update combat math'),field('Unreviewed notes',String(live.review_count??pending.length),'Across the recorded patch history'));board.append(grid);
    const controls=make('div','trust-board-controls');const input=make('input','trust-search');input.id='trust-search';input.type='search';input.placeholder='Search hero status';input.setAttribute('aria-label','Search hero patch status');
    const label=make('label','trust-filter');const check=make('input');check.type='checkbox';label.append(check,make('span','','Only awaiting review'));controls.append(input,label);board.append(controls);
    const count=make('p','trust-count');count.setAttribute('role','status');board.append(count);
    const list=make('div','trust-hero-list');list.id='trust-hero-list';board.append(list);
    function refresh(){list.replaceChildren();const all=(data.heroes||[]).filter(h=>statuses[h.name] && h.name.toLowerCase().includes(input.value.trim().toLowerCase()) && (!check.checked || statuses[h.name].awaiting_review_count>0)).sort((a,b)=>(statuses[b.name].awaiting_review_count-statuses[a.name].awaiting_review_count)||a.name.localeCompare(b.name));
      count.textContent=`Showing ${all.length} of ${totalHeroes} heroes`;
      for(const hero of all){const stat=statuses[hero.name];const row=make('div','trust-hero-row');const col=make('div');col.append(make('strong','',hero.name),make('small','',stat.last_verified_stats_at?`Stats: ${isoDate(stat.last_verified_stats_at)}`:'No verified stat date'));row.append(col,pill(stat.awaiting_review_count?'review':'checked',stat.awaiting_review_count?`${stat.awaiting_review_count} pending`:'No pending'));list.append(row)}
      if (!all.length) list.append(make('p','trust-warning','No heroes match the current filter.'));
    }
    input.addEventListener('input',refresh);check.addEventListener('change',refresh);refresh();
    const disclaimer=make('p','trust-warning','No pending changes means only that this parser found no unresolved hero notes. It does not certify that the full hero kit matches the current game.');board.append(disclaimer);
    const link=make('a','trust-source-link','Read Blizzard patch notes');link.href=source;link.target='_blank';link.rel='noopener noreferrer';board.append(link);
    patchRoot.prepend(board);
  }
  const attach = () => { renderHero();renderBoard(); };
  // Native Hero Lab re-renders these views when selecting heroes or switching tabs.
  if (heroRoot) new MutationObserver(() => {if(!heroRoot.querySelector('#trust-hero-card') || document.getElementById('trust-hero-card')?.dataset.hero!==heroTitle())renderHero();}).observe(heroRoot,{subtree:true,childList:true});
  if (patchRoot) new MutationObserver(() => {if(!document.getElementById('trust-board'))renderBoard();}).observe(patchRoot,{subtree:true,childList:true});
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
})();