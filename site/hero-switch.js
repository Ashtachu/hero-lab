/* Hero Lab | accessible hero quick-switch, preserving existing app flow. */
(() => {
  'use strict';
  if (document.getElementById('hero-switch-dialog')) return;
  const heroes = Array.isArray(window.OW_DB?.heroes) ? window.OW_DB.heroes : [];
  const choices = heroes.filter(h => h && h.name && ['Tank', 'Damage', 'Support'].includes(h.role));
  const trigger = document.getElementById('back-to-heroes');
  const titleHost = document.querySelector('.topbar > div:first-child');
  if (!trigger || !titleHost || !choices.length) return;

  // Preserve old app behavior everywhere else; intercept only the explicit switch button.
  trigger.type = 'button';
  trigger.classList.add('hero-switch-main');
  trigger.textContent = '⇄ Change hero';
  trigger.setAttribute('aria-haspopup', 'dialog');
  const titleTrigger = document.createElement('button');
  titleTrigger.type = 'button';
  titleTrigger.id = 'hero-switch-top';
  titleTrigger.className = 'hero-switch-top';
  titleTrigger.hidden = true;
  titleTrigger.setAttribute('aria-haspopup', 'dialog');
  titleTrigger.textContent = '⇄ Change hero';
  titleHost.append(titleTrigger);

  const wrap = document.createElement('div');
  wrap.id = 'hero-switch-dialog';
  wrap.className = 'hero-switch-backdrop';
  wrap.hidden = true;
  wrap.innerHTML = `
    <section class="hero-switch-panel" role="dialog" aria-modal="true" aria-labelledby="hero-switch-title" aria-describedby="hero-switch-description">
      <div class="hero-switch-heading">
        <div><p class="hero-switch-eyebrow">HERO LAB</p><h2 id="hero-switch-title">Change your hero</h2>
        <p id="hero-switch-description">Pick another hero. Your saved practice progress stays where it is.</p></div>
        <button id="hero-switch-close" type="button" aria-label="Close hero picker">✕</button>
      </div>
      <div class="hero-switch-current" id="hero-switch-current"></div>
      <div id="hero-switch-roles" class="hero-switch-roles" role="group" aria-label="Filter heroes by role"></div>
      <label class="hero-switch-search-label" for="hero-switch-search">Find a hero</label>
      <input type="search" id="hero-switch-search" placeholder="Search heroes…" autocomplete="off" />
      <p id="hero-switch-count" class="hero-switch-count" role="status"></p>
      <div id="hero-switch-results" class="hero-switch-results" aria-label="Available heroes"></div>
      <div class="hero-switch-footer"><button id="hero-switch-cancel" type="button">Keep current hero</button></div>
    </section>`;
  document.body.append(wrap);

  const roleHost = wrap.querySelector('#hero-switch-roles');
  const search = wrap.querySelector('#hero-switch-search');
  const list = wrap.querySelector('#hero-switch-results');
  const count = wrap.querySelector('#hero-switch-count');
  const currentEl = wrap.querySelector('#hero-switch-current');
  const roles = ['Support', 'Damage', 'Tank', 'All'];
  let role = 'All';
  let returnFocus = null;
  let lastHeroName = '';

  function selectedHeroName() {
    const node = document.querySelector('#hero-detail .hero-calm-name h2');
    const name = node?.textContent?.trim();
    if (choices.some(h => h.name === name)) return name;
    return lastHeroName;
  }
  function selectedHero() {
    const name = selectedHeroName();
    return choices.find(h => h.name === name) || null;
  }
  function updateTriggers() {
    const shown = document.getElementById('hero-detail-view')?.classList.contains('active');
    const h = selectedHero();
    if (h) lastHeroName = h.name;
    titleTrigger.hidden = !shown;
    if (shown) {
      titleTrigger.textContent = h ? `⇄ Change hero · ${h.name}` : '⇄ Change hero';
      trigger.setAttribute('aria-label', h ? `Change hero, currently ${h.name}` : 'Change hero');
    }
  }
  function renderRoles() {
    roleHost.replaceChildren();
    roles.forEach(value => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hero-switch-role' + (role === value ? ' is-active' : '');
      btn.dataset.role = value;
      btn.setAttribute('aria-pressed', String(role === value));
      btn.textContent = value;
      roleHost.append(btn);
    });
  }
  function renderList() {
    const q = search.value.trim().toLocaleLowerCase();
    const matches = choices.filter(h => (role === 'All' || h.role === role) && h.name.toLocaleLowerCase().includes(q)).sort((a,b) => a.name.localeCompare(b.name));
    const current = selectedHeroName();
    list.replaceChildren();
    count.textContent = `${matches.length} ${matches.length === 1 ? 'hero' : 'heroes'} found`;
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'hero-switch-empty';
      empty.textContent = 'No heroes match that search. Try another name or select All.';
      list.append(empty);
      return;
    }
    for (const hero of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hero-switch-item' + (hero.name === current ? ' is-current' : '');
      button.dataset.heroName = hero.name;
      button.setAttribute('aria-label', `Play ${hero.name}, ${hero.role}` + (hero.name === current ? ', current hero' : ''));
      const name = document.createElement('strong');
      name.textContent = hero.name;
      const badge = document.createElement('span');
      badge.className = `hero-switch-role-badge role-${hero.role.toLowerCase()}`;
      badge.textContent = hero.name === current ? `${hero.role} · Current` : hero.role;
      button.append(name, badge);
      list.append(button);
    }
  }
  function showPicker() {
    updateTriggers();
    const h = selectedHero();
    role = h?.role || 'All';
    search.value = '';
    currentEl.textContent = h ? `Currently learning: ${h.name} · ${h.role}` : 'Choose a hero to learn';
    renderRoles();renderList();
    returnFocus = document.activeElement;
    wrap.hidden = false;
    document.body.classList.add('hero-switch-open');
    search.focus();
  }
  function closePicker() {
    if (wrap.hidden) return;
    wrap.hidden = true;
    document.body.classList.remove('hero-switch-open');
    if (returnFocus?.isConnected && !returnFocus.hidden) returnFocus.focus();
  }
  function chooseHero(name) {
    const hero = choices.find(h => h.name === name);
    if (!hero) return;
    if (hero.name === selectedHeroName()) { closePicker(); return; }
    if (typeof openHero !== 'function') {
      count.textContent = 'Hero selection is unavailable. Please reload the app.';
      return;
    }
    closePicker();
    document.body.classList.remove('launch-mode');
    openHero(hero.name);
    lastHeroName = hero.name;
    updateTriggers();
    window.scrollTo?.({top: 0, behavior: 'instant'});
    trigger.focus();
  }
  // Capture prevents the old "back to role selection" handler from firing.
  trigger.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    showPicker();
  }, true);
  titleTrigger.addEventListener('click', showPicker);
  roleHost.addEventListener('click', event => {
    const btn = event.target.closest('button[data-role]');
    if (!btn) return;
    role = btn.dataset.role;renderRoles();renderList();
  });
  list.addEventListener('click', event => {
    const btn = event.target.closest('button[data-hero-name]');
    if (btn) chooseHero(btn.dataset.heroName);
  });
  search.addEventListener('input', renderList);
  wrap.querySelector('#hero-switch-close').addEventListener('click', closePicker);
  wrap.querySelector('#hero-switch-cancel').addEventListener('click', closePicker);
  wrap.addEventListener('click', event => { if (event.target === wrap) closePicker(); });
  wrap.addEventListener('keydown', event => {
    if (event.key === 'Escape') {event.preventDefault();closePicker();return;}
    if (event.key !== 'Tab') return;
    const focusable = [...wrap.querySelectorAll('button:not(:disabled), input:not(:disabled)')].filter(el => el.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
  });
  const app = document.getElementById('hero-detail');
  if (app) new MutationObserver(updateTriggers).observe(app, {childList:true,subtree:false});
  const main = document.querySelector('main');
  if (main) new MutationObserver(updateTriggers).observe(main, {attributes:true,attributeFilter:['class'],subtree:true});
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',updateTriggers));
  updateTriggers();
})();