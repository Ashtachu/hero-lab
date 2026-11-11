/* Hero Lab | place Tools alongside other navigation, not over game content.
   No app data or saved state is modified. */
(() => {
  'use strict';
  function mount() {
    const tools = document.getElementById('power-open');
    const actions = document.querySelector('.main > .topbar .topbar-actions');
    if (!tools || !actions) return;
    if (tools.parentElement !== actions) actions.insertBefore(tools, actions.querySelector('.icon-btn') || null);
    tools.classList.add('hl-tools-inline');
    tools.textContent = '⌕ Tools';
    tools.setAttribute('aria-label','Open universal search and tools');
    const search = document.querySelector('#hero-search');
    if (search) search.setAttribute('placeholder','Find a hero…');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();