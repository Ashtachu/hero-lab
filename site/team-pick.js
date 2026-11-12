/* Hero Lab | Team Composition Hero Picker
   Client-side editorial fit heuristic. Not ranked match statistics or live win rates.
   All hero names and guide excerpts come from OW_DB. */
(() => {
  'use strict';
  const roster = Array.isArray(window.OW_DB?.heroes) ? window.OW_DB.heroes.filter(h => h && h.name && ['Tank', 'Damage', 'Support'].includes(h.role)) : [];
  if (!roster.length || document.getElementById('team-pick-dialog')) return;
  const byName = new Map(roster.map(h => [h.name, h]));
  const byId = new Map(roster.map(h => [h.id, h]));
  const ROLES = ['Support', 'Damage', 'Tank'];
  const PARTY = {Support: ['Tank', 'Damage', 'Damage', 'Support'], Damage: ['Tank', 'Damage', 'Support', 'Support'], Tank: ['Damage', 'Damage', 'Support', 'Support']};
  const ENEMY = ['Tank', 'Damage', 'Damage', 'Support', 'Support'];
  const DIVE = new Set(['D.Va', 'Winston', 'Wrecking Ball', 'Doomfist', 'Hazard', 'Tracer', 'Genji', 'Sombra', 'Anran', 'Venture', 'Echo']);
  const POKE = new Set(['Sigma', 'Junkrat', 'Ashe', 'Hanzo', 'Widowmaker', 'Soldier: 76', 'Sojourn', 'Bastion', 'Freja', 'Emre']);
  const BRAWL = new Set(['Reinhardt', 'Junker Queen', 'Mauga', 'Ramattra', 'Reaper', 'Mei', 'Symmetra', 'Brigitte', 'Lúcio']);
  const SNIPERS = new Set(['Widowmaker', 'Hanzo', 'Ashe']);
  const DIVERS = new Set(['D.Va', 'Winston', 'Doomfist', 'Wrecking Ball', 'Tracer', 'Genji', 'Sombra', 'Anran']);
  // Broad, human-reviewed playstyle dimensions. Missing profiles use labeled guide descriptors.
  const SUPPORT = {
    'Ana':        [0,3,2,3,2], 'Baptiste':    [1,3,3,3,3], 'Brigitte':  [1,2,3,0,1],
    'Illari':     [1,2,1,3,2], 'Jetpack Cat': [3,2,1,2,2], 'Juno':      [3,3,1,2,2],
    'Kiriko':     [3,3,3,2,2], 'Lifeweaver':  [1,3,3,2,1], 'Lúcio':     [3,1,2,1,1],
    'Mercy':      [3,2,1,1,1], 'Mizuki':      [2,2,2,2,2], 'Moira':     [3,3,1,1,2],
    'Wuyang':     [2,3,2,2,2], 'Zenyatta':   [0,1,0,3,3]
  };
  const KEY_SUPPORT = {mobility:0, healing:1, protection:2, range:3, pressure:4};
  function traits(hero) {
    if (hero.role === 'Support' && SUPPORT[hero.name]) {
      const [mobility,healing,protection,range,pressure] = SUPPORT[hero.name];
      return {mobility,healing,protection,range,pressure};
    }
    const text = [hero.snapshot?.playstyle_label, hero.snapshot?.best_at, hero.guide?.gameplan, hero.guide?.positioning].filter(Boolean).join(' ').toLowerCase();
    return {
      mobility: /mobile|mobility|dive|flank|swift|fast rotation|jetpack|boost|blink|teleport|leap/.test(text) ? 3 : /position|rotat|speed|skirmish/.test(text) ? 2 : 1,
      healing: hero.role === 'Support' ? (/healing|sustain|triage|rescue|heal/.test(text) ? 2 : 1) : 0,
      protection: /peel|barrier|mitigat|protect|sustain|rescue|matrix|defensive/.test(text) ? 3 : /space|utility|control/.test(text) ? 2 : 1,
      range: /long.range|ranged|sniper|sightline|poke|precision|midrange/.test(text) ? 3 : /mid.range|projectile|cover|angle/.test(text) ? 2 : 1,
      pressure: /burst|pick|damage|pressure|eliminat|kill|duel/.test(text) ? 3 : 2
    };
  }
  function scoreHero(hero, allies, enemies, easy) {
    const t = traits(hero);
    const dive = allies.filter(n => DIVE.has(n)).length;
    const poke = allies.filter(n => POKE.has(n)).length;
    const brawl = allies.filter(n => BRAWL.has(n)).length;
    const enemyDive = enemies.filter(n => DIVERS.has(n)).length;
    const sniper = enemies.filter(n => SNIPERS.has(n)).length;
    const mercyPartner = hero.role === 'Support' && allies.includes('Mercy');
    let score = 48;
    score += dive * (t.mobility - 1.5) * 3.4;
    score += poke * (t.range - 1.5) * 1.8;
    score += brawl * (t.protection + t.healing - 2) * 1.1;
    score += enemyDive * (t.protection - 1) * 2.4;
    score += sniper * ((t.mobility - 1.4) * 2 + (t.range >= 2 ? 1.5 : -1.5));
    if (sniper && enemies.includes('Soldier: 76')) score -= (3 - t.range) * 3.2; // Avoid recommending close-range-only answers into layered hitscan sightlines.
    if (enemies.includes('Soldier: 76')) score += t.protection * 1.2;
    if (enemies.includes('D.Va')) score += t.mobility * 0.9 + t.protection * 0.6;
    if (mercyPartner) score += t.healing * 4.4 - (t.healing <= 1 ? 11 : 0);
    if (hero.role === 'Support' && !mercyPartner && allies.some(n => ['Lúcio', 'Zenyatta'].includes(n))) score += t.healing * 3.3;
    if (hero.role === 'Damage' && allies.some(n => n === 'Mercy')) score += t.range * 1.5 + t.pressure * 0.7;
    if (hero.role === 'Tank' && allies.some(n => ['Ana', 'Juno', 'Kiriko', 'Lúcio'].includes(n))) score += t.mobility * 1.3;
    if (easy) score -= Math.max(0, (Number(hero.snapshot?.difficulty) || 3) - 2) * 3;

    // Sparse editorial matchup records may contain BOTH threat and favored for the
    // same opponent. Treat those as conditional, never as an unconditional counter.
    const pairNotes = [];
    for (const name of enemies) {
      const opponent = byName.get(name);
      const kinds = new Set((hero.matchups || []).filter(x => x.opponent_hero_id === opponent?.id && x.editorial_status === 'reviewed').map(x => x.matchup_type));
      if (kinds.has('threat') && kinds.has('favored')) {pairNotes.push({name,kind:'mixed'});continue;}
      if (kinds.has('threat')) {score -= 3.5;pairNotes.push({name,kind:'threat'});}
      if (kinds.has('favored')) {score += 2.5;pairNotes.push({name,kind:'favored'});}
    }
    // Avoid false numerical confidence: integer fit score is an internal sort signal only.
    return {hero,t,score,pairNotes,dive,poke,brawl,mercyPartner,sniper,enemyDive};
  }
  function explain(item, allies, enemies) {
    const {hero,t,mercyPartner,dive,poke,pairNotes} = item;
    const why=[];
    if (mercyPartner && t.healing >= 2) why.push(`With Mercy on your team, ${hero.name} adds the healing coverage that lets Mercy spend more time boosting damage.`);
    if (dive >= 2 && t.mobility >= 2) why.push(`Can reposition around your faster teammates (${allies.filter(n => DIVE.has(n)).slice(0,3).join(', ')}) while preserving a way out.`);
    if (poke >= 2 && t.range >= 2) why.push('Can contribute safely from cover while your team pressures lanes and angles.');
    if (!why.length && item.brawl >= 2 && t.protection >= 2) why.push('Brings tools for staying together and protecting teammates in close engagements.');
    if (!why.length) why.push(`Playstyle: ${hero.snapshot?.playstyle_label || hero.guide?.role_text || hero.role}.`);
    const plan=[];
    if (enemies.includes('Widowmaker')) plan.push('Respect Widowmaker sightlines. Stay behind cover and let your tank contest her angle before you peek.');
    if (enemies.includes('D.Va')) plan.push('Time projectile-based pressure or utility around enemy D.Va’s Defense Matrix, and protect your backline when she commits.');
    if (enemies.includes('Soldier: 76')) plan.push('Avoid prolonged exposure to Soldier: 76’s sustained fire; use cover and heal through focused pressure.');
    if (enemies.includes('Mercy') && enemies.includes('Kiriko')) plan.push('Coordinate damage into one target and track their defensive cooldowns rather than splitting pressure across two supports.');
    if (!plan.length) plan.push(hero.guide?.engagement || hero.guide?.gameplan || 'Follow your team’s engage and keep an escape route.');
    const risks=pairNotes.filter(x=>x.kind==='threat').map(x=>x.name);
    const mixed=pairNotes.filter(x=>x.kind==='mixed').map(x=>x.name);
    let caution = hero.snapshot?.weakest_at ? `Reviewed weakness: ${hero.snapshot.weakest_at}.` : 'Keep your positioning and cooldown use deliberate.';
    if (risks.length) caution += ` Hero Lab also flags possible matchup pressure from ${risks.slice(0,2).join(' and ')}.`;
    if (mixed.length) caution += ` ${mixed.slice(0,2).join(', ')} has conditional matchup notes, not a guaranteed counter.`;
    return {why:why.slice(0,2),plan:plan.slice(0,2),caution};
  }

  const modal = document.createElement('div');
  modal.id = 'team-pick-dialog';modal.className = 'team-pick-overlay';modal.hidden = true;
  modal.innerHTML = `<section class="team-pick-window" role="dialog" aria-modal="true" aria-labelledby="team-pick-title" aria-describedby="team-pick-intro">
    <header class="team-pick-head"><div><span class="team-pick-overline">HERO LAB · TEAM BUILDER</span><h2 id="team-pick-title">Who should I play?</h2><p id="team-pick-intro">Enter your teammates and opponents. Get practical hero suggestions, not made-up win-rate rankings.</p></div><button type="button" id="team-pick-close" aria-label="Close team picker">✕</button></header>
    <div id="team-pick-inputs">
      <div class="team-pick-role"><strong>I’m playing</strong><div id="team-pick-role-tabs" role="group" aria-label="Your role"></div><label class="team-pick-easier"><input id="team-pick-easy" type="checkbox" /> Prefer easier heroes</label></div>
      <div class="team-pick-sides"><section class="team-pick-side"><div class="team-pick-side-title"><h3>Your teammates</h3><span id="team-pick-ally-count">0 of 4</span></div><p>You are the fifth player. Add whoever you know.</p><div id="team-pick-allies" class="team-pick-slots"></div></section><section class="team-pick-side"><div class="team-pick-side-title"><h3>Enemy team</h3><span id="team-pick-enemy-count">0 of 5</span></div><p>Mirrored heroes are allowed across opposing teams.</p><div id="team-pick-enemies" class="team-pick-slots"></div></section></div>
      <div class="team-pick-form-bottom"><span id="team-pick-validation" role="status" aria-live="polite">You can leave unknown players blank.</span><div class="team-pick-controls"><button type="button" id="team-pick-example" class="team-pick-quiet">Load example</button><button type="button" id="team-pick-submit" class="team-pick-primary">Find my picks</button></div></div>
    </div>
    <div id="team-pick-results" hidden><div class="team-pick-result-head"><h3>Recommended heroes for your lineup</h3><button type="button" id="team-pick-edit" class="team-pick-quiet">Edit lineup</button></div><p id="team-pick-confidence" class="team-pick-disclaimer"></p><div id="team-pick-cards" aria-live="polite"></div><p class="team-pick-disclaimer">These are transparent playstyle suggestions from Hero Lab's reviewed hero guides and limited matchup notes, not live pick-rate, win-rate, or guaranteed-counter data. Unverified patch changes are not treated as confirmed matchups.</p></div>
  </section>`;
  document.body.append(modal);
  const el=id=>document.getElementById(id);
  let role='Support', lastRole='Support', returnFocus=null;
  let allies = PARTY[role].map(r=>({role:r,name:''}));
  let enemies = ENEMY.map(r=>({role:r,name:''}));
  let lastResults=[];
  function optsFor(role) {return roster.filter(h=>h.role===role).sort((a,b)=>a.name.localeCompare(b.name));}
  function roleTabs() {
    const holder=el('team-pick-role-tabs');holder.replaceChildren();
    ROLES.forEach(value=>{
      const btn=document.createElement('button');btn.type='button';btn.className='team-pick-role-tab'+(role===value?' is-active':'');btn.dataset.pickRole=value;btn.textContent=value;btn.setAttribute('aria-pressed',String(role===value));holder.append(btn);
    });
  }
  function renderSlots() {
    const draw=(which,slots)=>{
      const parent=el(which);parent.replaceChildren();
      slots.forEach((slot,i)=>{
        const label=document.createElement('label');label.className='team-pick-slot';
        const span=document.createElement('span');span.textContent=slot.role+(slots===enemies?' '+(i>0?i===1||i===3?'1':'2':''):'');
        // Distinguish slots with similar roles without forcing players to know hero names.
        if (slots===allies && (slot.role==='Damage'||slot.role==='Support')) span.textContent=slot.role+' '+(slots.slice(0,i).filter(x=>x.role===slot.role).length+1);
        const select=document.createElement('select');select.dataset.side=slots===allies?'ally':'enemy';select.dataset.index=String(i);select.setAttribute('aria-label',(slots===allies?'Teammate ':'Enemy ')+slot.role+' '+(i+1));
        const empty=document.createElement('option');empty.value='';empty.textContent='Unknown / choose hero';select.append(empty);
        for (const h of optsFor(slot.role)) {const option=document.createElement('option');option.value=h.name;option.textContent=h.name;select.append(option);}
        select.value=slot.name;label.append(span,select);parent.append(label);
      });
    };
    draw('team-pick-allies',allies);draw('team-pick-enemies',enemies);
    updateCount();
  }
  function updateCount(message='You can leave unknown players blank.') {
    el('team-pick-ally-count').textContent=allies.filter(x=>x.name).length+' of 4';
    el('team-pick-enemy-count').textContent=enemies.filter(x=>x.name).length+' of 5';
    const duplicates=arr=>{const picked=arr.map(x=>x.name).filter(Boolean);return picked.length!==new Set(picked).size;};
    const bad=duplicates(allies)||duplicates(enemies);
    el('team-pick-validation').textContent=bad?'A hero cannot occupy two slots on the same team.':message;
    el('team-pick-validation').classList.toggle('is-error',bad);
    el('team-pick-submit').disabled=bad;
    return !bad;
  }
  function rerole(next) {
    if (!ROLES.includes(next))return;
    if(role!==next){
      const old=allies.map(x=>x.name).filter(Boolean);
      role=next;lastRole=next;
      allies=PARTY[next].map(r=>({role:r,name:''}));
      const assigned=new Set();
      for(const slot of allies){const found=old.find(name=>!assigned.has(name)&&byName.get(name)?.role===slot.role);if(found){slot.name=found;assigned.add(found);}}
    }
    roleTabs();renderSlots();
  }
  function activeRole() {
    const title=el('hero-detail')?.querySelector('.hero-calm-name h2')?.textContent?.trim();
    const hero=byName.get(title);
    if(el('hero-detail-view')?.classList.contains('active') && hero) return hero.role;
    return lastRole;
  }
  function open() {
    returnFocus=document.activeElement;
    rerole(activeRole());
    el('team-pick-results').hidden=true;el('team-pick-inputs').hidden=false;
    modal.hidden=false;document.body.classList.add('team-pick-open');
    el('team-pick-role-tabs').querySelector('button[aria-pressed="true"]')?.focus();
  }
  function close() {
    modal.hidden=true;document.body.classList.remove('team-pick-open');
    if(returnFocus?.isConnected && !returnFocus.hidden) returnFocus.focus();
  }
  function setExample() {
    role='Support';lastRole='Support';
    allies=PARTY.Support.map((r,i)=>({role:r,name:['D.Va','Junkrat','Anran','Mercy'][i]}));
    enemies=ENEMY.map((r,i)=>({role:r,name:['D.Va','Widowmaker','Soldier: 76','Mercy','Kiriko'][i]}));
    roleTabs();renderSlots();updateCount('Example loaded. Find my picks to see recommended Supports.');
  }
  function renderResults() {
    if(!updateCount())return;
    const friend=allies.map(x=>x.name).filter(Boolean),foes=enemies.map(x=>x.name).filter(Boolean);
    if (!friend.length || !foes.length) {updateCount('Add at least one teammate and one enemy to get useful suggestions.');return;}
    const easy=el('team-pick-easy').checked;
    const candidates=roster.filter(h=>h.role===role && !friend.includes(h.name));
    const picks=candidates.map(h=>scoreHero(h,friend,foes,easy)).sort((a,b)=>b.score-a.score||a.hero.name.localeCompare(b.hero.name)).slice(0,3);
    lastResults=picks;
    el('team-pick-inputs').hidden=true;el('team-pick-results').hidden=false;
    const complete=friend.length===4 && foes.length===5;
    el('team-pick-confidence').textContent=complete?`Full lineup: ${friend.join(', ')} vs ${foes.join(', ')}. Recommendations are editorial estimates, not guarantees.`:`Partial lineup (${friend.length}/4 teammates, ${foes.length}/5 enemies): recommendations may change once you know the rest.`;
    const box=el('team-pick-cards');box.replaceChildren();
    picks.forEach((pick,i)=>{
      const hero=pick.hero,details=explain(pick,friend,foes);
      const item=document.createElement('article');item.className='team-pick-result-card'+(!i?' best':'');
      const head=document.createElement('div');head.className='team-pick-card-head';
      const headText=document.createElement('div');const eyebrow=document.createElement('span');eyebrow.className='team-pick-rank';eyebrow.textContent=['Best starting fit','Alternative','Another option'][i];
      const name=document.createElement('h4');name.textContent=hero.name;
      const roleInfo=document.createElement('p');roleInfo.textContent=hero.snapshot?.playstyle_label||hero.guide?.role_text||hero.role;
      headText.append(eyebrow,name,roleInfo);
      const btn=document.createElement('button');btn.type='button';btn.className='team-pick-use';btn.textContent='Learn '+hero.name;btn.dataset.pickHero=hero.name;
      head.append(headText,btn);item.append(head);
      const why=document.createElement('div');why.className='team-pick-reasons';
      for(const line of details.why) {const p=document.createElement('p');p.textContent=line;why.append(p);}
      item.append(why);
      const against=document.createElement('p');against.className='team-pick-approach';const strong=document.createElement('strong');strong.textContent='Against their team: ';against.append(strong,document.createTextNode(details.plan.join(' ')));item.append(against);
      const risk=document.createElement('p');risk.className='team-pick-tradeoff';risk.textContent='Watch out: '+details.caution;item.append(risk);
      box.append(item);
    });
    el('team-pick-results').scrollIntoView?.({behavior:'instant',block:'nearest'});
  }
  const action=(label,className,id)=>{const b=document.createElement('button');b.type='button';b.className=className;b.id=id;b.dataset.teamPickOpen='1';b.textContent=label;return b;};
  function mountEntrypoints() {
    const roleHost=el('launch-role-step');
    if(roleHost&&!el('team-pick-entry-role'))roleHost.append(action('Not sure who to play? Get a recommendation','team-pick-entry','team-pick-entry-role'));
    const heroHost=el('launch-hero-step');
    if(heroHost&&!el('team-pick-entry-hero')) {
      const button=action('Not sure which hero fits your team?','team-pick-entry','team-pick-entry-hero');
      (el('launch-role-copy')||heroHost).insertAdjacentElement('afterend',button);
    }
    const goals=el('goal-picker');
    if(goals && !goals.querySelector('.team-pick-goal')) {
      const button=document.createElement('button');button.type='button';button.className='goal-btn team-pick-goal';button.dataset.teamPickOpen='1';
      button.innerHTML='<span class="goal-icon">◇</span><span><strong>Help me pick a hero</strong><small>Tell us both teams and get a recommended pick.</small></span><b>›</b>';
      goals.append(button);
    }
    const today=el('today-home'), grid=today?.querySelector('.today-role-grid');
    if(grid&&!today.querySelector('.team-pick-entry-today')) {
      const button=action('Help me pick for this match','team-pick-entry team-pick-entry-today','team-pick-entry-today');
      grid.insertAdjacentElement('afterend',button);
    }
  }
  function launchHero(name) {
    if (!byName.has(name))return;
    close();
    if (typeof openHero==='function') {document.body.classList.remove('launch-mode');openHero(name);window.scrollTo?.({top:0,behavior:'instant'});}
    else {const msg=el('team-pick-confidence');if(msg)msg.textContent='Hero detail cannot open right now. Reload the app and try again.';}
  }
  document.addEventListener('click',event=>{
    const roleTarget=event.target?.closest?.('[data-launch-role],[data-today-role]');
    if(roleTarget){const next=roleTarget.dataset.launchRole||roleTarget.dataset.todayRole;if(ROLES.includes(next))lastRole=next;}
    if(event.target?.closest?.('[data-team-pick-open]')){event.preventDefault();event.stopPropagation();open();}
  },true);
  el('team-pick-role-tabs').addEventListener('click',e=>{const target=e.target.closest('[data-pick-role]');if(target)rerole(target.dataset.pickRole);});
  modal.addEventListener('change',e=>{
    if(!e.target.matches('select[data-side]'))return;
    const slots=e.target.dataset.side==='ally'?allies:enemies;slots[Number(e.target.dataset.index)].name=e.target.value;updateCount();
  });
  el('team-pick-submit').addEventListener('click',renderResults);
  el('team-pick-example').addEventListener('click',setExample);
  el('team-pick-edit').addEventListener('click',()=>{el('team-pick-results').hidden=true;el('team-pick-inputs').hidden=false;updateCount();});
  el('team-pick-cards').addEventListener('click',e=>{const b=e.target.closest('[data-pick-hero]');if(b)launchHero(b.dataset.pickHero);});
  el('team-pick-close').addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close();});
  modal.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();close();return;}
    if(e.key==='Tab'){
      const focusables=[...modal.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled)')].filter(x=>x.getClientRects().length);
      if(!focusables.length)return;
      const first=focusables[0],last=focusables[focusables.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  const host=el('hero-detail');if(host)new MutationObserver(mountEntrypoints).observe(host,{childList:true,subtree:true});
  const today=el('today-home');if(today)new MutationObserver(mountEntrypoints).observe(today,{childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountEntrypoints,{once:true});else mountEntrypoints();
  // Expose a read-only ranking hook for deterministic CI against the full roster.
  window.HeroLabTeamFit = Object.freeze({recommend(role,team,foes,easy=false){
    if(!ROLES.includes(role))return [];
    const ally=[...new Set((team||[]).filter(x=>byName.has(x)))],enemy=[...new Set((foes||[]).filter(x=>byName.has(x)))];
    return roster.filter(h=>h.role===role&&!ally.includes(h.name)).map(h=>scoreHero(h,ally,enemy,easy)).sort((a,b)=>b.score-a.score||a.hero.name.localeCompare(b.hero.name)).slice(0,3).map(x=>x.hero.name);
  }});
})();