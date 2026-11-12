/* Hero Lab | User-intent routes. Keep all hero facts grounded in OW_DB. */
(() => {
  'use strict';
  const database = window.OW_DB || {};
  const roster = Array.isArray(database.heroes) ? database.heroes : [];
  if (!roster.length) return;

  const routes = {
    learn: {
      title: 'Learn this hero',
      description: 'Positioning, strategy, aim, team comps and counters.'
    },
    survive: {
      title: 'I keep getting eliminated',
      description: 'Find safer positions and know when to escape.'
    },
    fight: {
      title: 'I want more impact',
      description: 'Aim better, secure eliminations and use abilities well.'
    },
    matchups: {
      title: 'An enemy hero is giving me trouble',
      description: 'Choose the enemy and learn how to play against them.'
    },
    practice: {
      title: 'I want to practice',
      description: 'Follow short drills and track improvement.'
    }
  };

  const examples = {
    dive: {
      title: 'Dive and coordinated picks',
      explanation: 'Move together to pressure isolated targets, then disengage before the enemy team turns on you.',
      Tank: ['Winston', 'D.Va', 'Doomfist', 'Wrecking Ball'],
      Damage: ['Tracer', 'Genji', 'Echo', 'Sombra', 'Venture'],
      Support: ['Juno', 'Kiriko', 'Jetpack Cat', 'Mercy']
    },
    brawl: {
      title: 'Close-range brawl and rush',
      explanation: 'Push as a group, contest shorter sightlines and use speed, peel or sustain to win close fights.',
      Tank: ['Reinhardt', 'Junker Queen', 'Ramattra', 'Mauga'],
      Damage: ['Reaper', 'Mei', 'Cassidy', 'Symmetra'],
      Support: ['Lúcio', 'Brigitte', 'Moira', 'Baptiste']
    },
    poke: {
      title: 'Cover-based poke and picks',
      explanation: 'Use safe angles, ranged pressure and coordinated cooldowns to create an advantage before pushing.',
      Tank: ['Sigma', 'Orisa', 'Domina', 'Ramattra'],
      Damage: ['Ashe', 'Hanzo', 'Soldier: 76', 'Widowmaker', 'Sierra'],
      Support: ['Ana', 'Baptiste', 'Illari', 'Zenyatta']
    }
  };
  const overrides = {
    'Mizuki': ['poke', 'dive'], 'Juno': ['dive', 'brawl'],
    'Mercy': ['poke', 'dive'], 'Kiriko': ['dive', 'brawl'],
    'Lifeweaver': ['poke', 'brawl'], 'Wuyang': ['poke', 'dive'],
    'Baptiste': ['poke', 'brawl'], 'Brigitte': ['brawl', 'dive'],
    'D.Va': ['dive', 'brawl'], 'Ramattra': ['brawl', 'poke'],
    'Hazard': ['dive', 'brawl'], 'Reaper': ['brawl', 'dive'],
    'Soldier: 76': ['poke', 'dive'], 'Pharah': ['poke', 'dive']
  };

  const nameOf = (hero) => String(hero?.name || '');
  const clean = value => (typeof value === 'string' && value.trim()) ? value.trim() : 'Not reviewed yet.';
  const el = (tag, cls, value) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const addText = (parent, tag, cls, value) => {
    const child = el(tag, cls, clean(value));
    parent.append(child);
    return child;
  };
  const currentHero = () => {
    const name = document.querySelector('#hero-detail .hero-calm-name h2')?.textContent?.trim();
    return roster.find(hero => hero.name === name) || null;
  };
  const isValidHero = name => roster.some(hero => hero.name === name);
  const archetypes = hero => {
    if (overrides[hero.name]) return overrides[hero.name];
    const style = `${hero.guide?.role_text || ''} ${hero.snapshot?.playstyle_label || ''}`.toLowerCase();
    if (/dive|mobile|flank|assassin|skirmish|disrupt/.test(style)) return ['dive', 'brawl'];
    if (/brawl|rush|frontline|close-range|anti-dive|peel|sustain|control|tank pressure/.test(style)) return ['brawl', 'poke'];
    if (/poke|snip|precision|long-range|hitscan|projectile|midrange/.test(style)) return ['poke', 'brawl'];
    return ['poke', 'dive'];
  };
  function teamFor(hero, key) {
    const template = examples[key];
    const desired = ['Tank', 'Damage', 'Damage', 'Support', 'Support'];
    const used = new Set();
    let playerPlaced = false;
    const picks = desired.map(role => {
      if (role === hero.role && !playerPlaced) {
        playerPlaced = true;
        used.add(hero.name);
        return {name:hero.name, role, player:true};
      }
      const next = template[role].find(n => !used.has(n) && isValidHero(n));
      if (next) used.add(next);
      return {name:next || 'Role flex', role, player:false};
    });
    return picks;
  }
  function section(title, description, className='') {
    const block = el('section', 'learn-section ' + className);
    addText(block, 'h4', 'learn-section-title', title);
    if (description) addText(block, 'p', 'learn-section-intro', description);
    return block;
  }
  function fact(label, content) {
    const card = el('div', 'learn-fact');
    addText(card, 'span', 'learn-fact-label', label);
    addText(card, 'p', '', content);
    return card;
  }
  function matchupGroup(hero, type, heading, description) {
    const outer = section(heading, description, type === 'threat' ? 'learn-danger' : 'learn-favorable');
    const items = (hero.matchups || []).filter(m => m.matchup_type === type && isValidHero(m.opponent_name));
    const cards = el('div', 'learn-matchup-list');
    if (!items.length) {
      addText(cards, 'p', 'learn-empty', 'No reviewed matchups are available yet.');
    }
    for (const m of items.slice(0, 4)) {
      const card = el('article', 'learn-matchup');
      card.dataset.learnMatchupType = type;
      addText(card, 'h5', '', m.opponent_name);
      addText(card, 'p', 'learn-matchup-summary', m.summary);
      addText(card, 'p', 'learn-matchup-approach', m.approach);
      cards.append(card);
    }
    outer.append(cards);
    return outer;
  }

  function renderLearning(hero) {
    const guide = hero.guide || {};
    const aim = hero.aimGuide || {};
    const snapshot = hero.snapshot || {};
    const wrapper = el('div', 'learn-guide');
    wrapper.id = 'learn-overview';
    wrapper.dataset.hero = hero.name;
    const heroStatus = database.liveEngine?.heroStatus?.[hero.name];

    const intro = el('header', 'learn-intro');
    addText(intro, 'span', 'learn-eyebrow', 'HERO PLAYBOOK');
    addText(intro, 'h3', '', `Learn ${hero.name}`);
    addText(intro, 'p', 'learn-summary', clean(snapshot.playstyle_label || guide.role_text || hero.tagline));
    const oneLine = el('div', 'learn-one-line');
    addText(oneLine, 'strong', '', 'Your main job');
    addText(oneLine, 'p', '', guide.gameplan);
    intro.append(oneLine);
    wrapper.append(intro);

    const essentials = el('div', 'learn-essentials');
    const position = section('Where to position', 'Set up safely before you commit.', 'learn-position');
    position.append(fact('Starting position', guide.positioning));
    position.append(fact('When to move', guide.engagement));
    essentials.append(position);
    const strategy = section('Fight strategy', 'Make your abilities support a specific fight plan.', 'learn-strategy');
    strategy.append(fact('Your strengths', snapshot.best_at));
    strategy.append(fact('What to avoid', snapshot.weakest_at));
    strategy.append(fact('Cooldown decisions', guide.ability_usage));
    essentials.append(strategy);
    wrapper.append(essentials);

    const aimSection = section('How to aim', 'Mechanics-based guidance for this hero.', 'learn-aim');
    const aimGrid = el('div','learn-aim-grid');
    aimGrid.append(fact('Aim type and range', `${clean(aim.aim_type || snapshot.aim_style)} · ${clean(aim.range_preference)}`));
    aimGrid.append(fact('Where to aim', aim.where_to_aim));
    aimGrid.append(fact('Vertical aim and movement', aim.vertical_aiming));
    if (Array.isArray(aim.drills) && aim.drills.length) aimGrid.append(fact('Try this drill', aim.drills[0]));
    aimSection.append(aimGrid);
    wrapper.append(aimSection);

    const teamSection = section('Team comps that fit', 'Practical starting lineups based on playstyle, not live win-rate rankings.', 'learn-team');
    const teamGrid = el('div', 'learn-team-grid');
    for (const key of archetypes(hero)) {
      const setup = examples[key];
      const lineup = el('article','learn-team-card');
      addText(lineup,'h5','',setup.title);
      addText(lineup,'p','',setup.explanation);
      const members = el('div','learn-team-members');
      members.setAttribute('aria-label', 'Example 5-hero team composition');
      for (const member of teamFor(hero, key)) {
        const chip = el('span','learn-team-member' + (member.player ? ' is-you' : ''));
        const nm = el('strong','',member.name);
        const role = el('small','',member.role + (member.player ? ' · You' : ''));
        chip.append(nm,role);
        members.append(chip);
      }
      lineup.append(members);
      teamGrid.append(lineup);
    }
    teamSection.append(teamGrid);
    addText(teamSection, 'p','learn-note', 'These are illustrative team shells. They are not verified optimal compositions, patch rankings or guaranteed synergies.');
    wrapper.append(teamSection);

    const matchups = el('div', 'learn-matchup-columns');
    matchups.append(
      matchupGroup(hero, 'favored', 'Heroes you can pressure', 'Favorable matchups from the reviewed guide; not automatic wins.'),
      matchupGroup(hero, 'threat', 'Heroes who can punish you', 'Dangerous matchups and what to do differently.')
    );
    wrapper.append(matchups);
    const explore = el('button','learn-explore','Explore another enemy matchup');
    explore.type = 'button';
    explore.addEventListener('click', () => {
      document.querySelector('#change-goal')?.click();
      document.querySelector('#goal-picker [data-help-group="matchups"]')?.click();
    });
    wrapper.append(explore);

    const bottom = el('div','learn-footer');
    const verified = [guide.reviewed_at,aim.reviewed_at].filter(Boolean).sort().reverse()[0];
    addText(bottom,'p','learn-source',`Guide reviewed: ${verified || 'date not recorded'}. Matchup lists are selective, not a complete counter chart.`);
    if (heroStatus?.awaiting_review_count > 0) {
      addText(bottom,'p','learn-caution',`${heroStatus.awaiting_review_count} detected Blizzard note(s) for ${hero.name} still need review. Unverified changes are not applied to combat calculations.`);
    }
    wrapper.append(bottom);
    return wrapper;
  }

  function refreshChoices() {
    const picker = document.getElementById('goal-picker');
    if (!picker) return;
    for (const [key, label] of Object.entries(routes)) {
      const button = picker.querySelector(`[data-help-group="${key}"]`);
      if (!button) continue;
      const strong = button.querySelector('strong');
      const small = button.querySelector('small');
      if (strong && strong.textContent !== label.title) strong.textContent = label.title;
      if (small && small.textContent !== label.description) small.textContent = label.description;
      button.setAttribute('aria-label',`${label.title}. ${label.description}`);
    }
    const heading = document.querySelector('.calm-question-head h3');
    if (heading && heading.textContent.startsWith('What do you want help with on')) {
      const desired = 'What do you want to improve?';
      if (heading.textContent !== desired) heading.textContent = desired;
    }
    const intro = document.querySelector('.calm-question-head p');
    if (intro && intro.textContent !== 'Pick what you need. Each option gives you a clear plan.') intro.textContent = 'Pick what you need. Each option gives you a clear plan.';
  }

  function openLearn(event) {
    const button = event.target?.closest?.('#goal-picker [data-help-group="learn"]');
    if (!button) return;
    const hero = currentHero();
    if (!hero) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const picker = document.getElementById('goal-picker');
    const active = document.getElementById('goal-active');
    const answer = document.getElementById('hero-help-answer');
    const choices = document.getElementById('topic-choices');
    const label = document.getElementById('goal-current-label');
    if (!picker || !active || !answer || !choices || !label) return;
    if (typeof window.rememberHeroRoute === 'function') window.rememberHeroRoute(hero,'learn',null);
    picker.hidden = true;
    active.hidden = false;
    label.textContent = routes.learn.title;
    choices.replaceChildren();
    choices.hidden = true;
    answer.hidden = false;
    answer.replaceChildren(renderLearning(hero));
    if (window.matchMedia('(max-width: 680px)').matches) {
      answer.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }
  // Native code builds the hero route buttons again when the hero changes.
  // Delegate clicks so it keeps working after Change Hero and reload.
  document.addEventListener('click',openLearn,true);
  document.addEventListener('click',event => {
    const change = event.target?.closest?.('#change-goal');
    if (!change) return;
    const choices = document.getElementById('topic-choices');
    if (choices) choices.hidden = false;
  },true);
  const root = document.getElementById('hero-detail');
  if (root) {
    const observer = new MutationObserver(refreshChoices);
    observer.observe(root,{childList:true,subtree:true});
  }
  refreshChoices();
})();