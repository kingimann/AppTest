// App model: an app project read as pages, components, tabs and data, the shape the native code exports
// (Flutter widgets, SwiftUI views) are written from. What has no native version yet is kept as a "todo" with its name.

const fieldKey = (n) => String(n ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
const PAGE_W = 400;

/** What a page has in it that turns into a native element; null for things the native app doesn't need (the page itself, App Logic). */
function elementOf(e, kids, todo, ctx = {}) {
  const B = (t) => (e.behaviors || []).find((b) => b.type === t), P = (b) => b.params || b; // (saved games keep params flat on the behavior)
  const color = (c) => (c == null || c === '' ? '' : String(c));
  const text = e.text && String(e.text.value ?? '') !== '' ? { value: String(e.text.value), size: +e.text.size || 16, weight: String(e.text.weight || '600'), color: color(e.text.color), align: e.text.align || 'center' } : null;
  const sh = e.shape || {}, W = +sh.w || (+sh.r || 0) * 2 || 0, H = +sh.h || (+sh.r || 0) * 2 || 0;
  /** A card, badge, picture box or button with things inside: its size, colours and corners, its own centred text, and its children where the design puts them. */
  const box = (action = null) => ({ kind: 'box', w: W, h: H || 48, radius: sh.type === 'circle' ? (H || 48) / 2 : +sh.radius || 0, fill: color(sh.fill), stroke: sh.stroke ? color(sh.stroke) : '', strokeW: +sh.lineWidth || (sh.stroke ? 1 : 0),
    shadow: !!sh.shadow, text, action, row: e.row != null && e.row !== '' ? +e.row || 0 : null, children: kids }); // row: its stretched children share its width, side by side
  const opts = (v) => String(v ?? '').split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  let b;
  if ((b = B('uiDataList'))) { const p = P(b); return { kind: 'list', collection: p.collection || '', title: p.title || '{title}', subtitle: p.subtitle || '', icon: p.icon || '', check: p.check || '', search: p.search || '', filter: p.filter || '', sort: p.sort || 'newest first', openPage: p.openPage || '', empty: p.empty || 'Nothing here yet', right: p.right || '', swipeDelete: p.swipeDelete !== false, rowH: +p.rowH || 64, gap: p.gap ?? 8, radius: p.radius ?? 14, doneLook: p.doneLook !== false, fill: e.stretch === 'both' }; }
  if ((b = B('uiForm'))) { const p = P(b); return { kind: 'form', collection: p.collection || '', fields: String(p.fields || '').split(',').map((s) => s.trim()).filter(Boolean).map(fieldKey), mode: /always adds/.test(p.mode || '') ? 'new' : /always changes/.test(p.mode || '') ? 'edit' : 'auto', saveLabel: p.saveLabel || 'Save', after: p.after || 'go back', page: p.page || '', fill: e.stretch === 'both' }; }
  if ((b = B('uiInput')) || (b = B('uiSearchBar'))) { const p = P(b); return { kind: 'input', var: p.var || 'text', placeholder: p.placeholder || '', keyboard: p.kind || (b.type === 'uiSearchBar' ? 'search' : 'text'), outlined: !!e.shape?.stroke }; }
  if ((b = B('uiToggle'))) { const p = P(b); return { kind: 'toggle', var: p.var || 'on', label: text?.value || '', start: p.start !== false }; }
  if ((b = B('button'))) {
    const p = P(b), act = { action: p.action || 'message', value: p.value ?? '', amount: p.amount ?? 1 };
    if (kids.length) return box(act); // a menu row, a shop item, a "Continue with Google" button: a box you can tap
    return { kind: 'button', label: text?.value || e.name || 'Button', ...act,
      fab: sh.type === 'circle' && /bottom/.test(e.anchor || ''), outlined: !!sh.stroke && (!sh.fill || /card|bg/.test(String(sh.fill))), plain: !sh.fill && !sh.stroke, fill: color(sh.fill), color: color(text?.color), stroke: color(sh.stroke),
      h: H || 52, radius: sh.type === 'circle' ? (H || 52) / 2 : sh.radius ?? 16, size: text?.size || 17 };
  }
  // social components: native versions that read the same data collections
  if ((b = B('uiFeed'))) { const p = P(b); return { kind: 'feed', collection: p.collection || 'Posts', look: p.look || 'timeline', filter: p.filter || '', search: p.searchVar || '', columns: +p.gridColumns || 3, profilePage: p.profilePage || '', empty: p.empty || 'No posts yet', fill: e.stretch === 'both' || !!e.stretch,
    tabs: String(p.tabs || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((t) => t[0]).map(([label, only = '', look = '']) => ({ label, only, look })),
    actions: String(p.actions || 'comment, repost, like, share').split(',').map((x) => x.trim()).filter(Boolean) }; }
  if ((b = B('uiComposer'))) { const p = P(b); return { kind: 'composer', collection: p.collection || 'Posts', placeholder: p.placeholder || 'What’s happening?' }; }
  if ((b = B('uiStories'))) { const p = P(b); return { kind: 'stories', collection: p.collection || 'Stories', yours: p.yours !== false }; }
  if ((b = B('uiInbox'))) { const p = P(b); return { kind: 'inbox', collection: p.collection || 'Messages', openPage: p.openPage || 'chat', fill: true }; }
  if ((b = B('uiChat'))) { const p = P(b); return { kind: 'chat', collection: p.collection || 'Messages', fill: true }; }
  if ((b = B('uiProfile'))) { const p = P(b); return { kind: 'profile', name: p.name || '{playerName}', handle: p.handle || '{playerHandle}', bio: p.bio || '', stats: String(p.stats || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]).map(([label, value]) => ({ label, value: value || '' })).concat(p.stats ? [] : [{ label: 'Posts', value: '{posts_count}' }]), cover: String(p.cover || '@accent').match(/#[0-9a-f]{6}/i)?.[0] || p.cover || '@accent', own: !!p.own }; }
  if ((b = B('uiMarketplace'))) { const p = P(b); return { kind: 'market', collection: p.collection || 'Listings', chatPage: p.chatPage || '', fill: true }; }
  if ((b = B('uiActivity'))) { const p = P(b); return { kind: 'activity', collection: p.collection || 'Notifications', profilePage: p.profilePage || '', fill: true }; }
  if ((b = B('uiBookmarks'))) return { kind: 'feed', collection: 'Posts', look: 'timeline', filter: 'saved = yes', search: '', columns: 3, profilePage: '', empty: 'Nothing saved yet: tap 🔖 on a post', fill: true };
  if ((b = B('uiFriends')) || (b = B('uiWhoToFollow'))) { const p = P(b); return { kind: 'people', collection: 'Profiles', profilePage: p.profilePage || '', fill: true }; }
  if ((b = B('uiAchievements'))) return { kind: 'achievements' };
  if ((b = B('uiTrending'))) { const p = P(b); return { kind: 'trending', collection: p.collection || 'Posts', searchVar: p.searchVar || p.var || '' }; }
  // controls and small parts
  if ((b = B('uiSlider'))) { const p = P(b); return { kind: 'slider', var: p.var || 'volume', min: +p.min || 0, max: p.max == null ? 100 : +p.max, step: +p.step || 1, start: p.start ?? 80 }; }
  if ((b = B('uiSegmented'))) { const p = P(b), o = opts(p.options || 'Easy, Normal, Hard'); return { kind: 'segmented', var: p.var || 'mode', options: o, index: /position/.test(p.store || ''), start: +p.start || 1 }; }
  if ((b = B('uiChips'))) { const p = P(b), o = opts(p.options || 'All, New, Popular'); return { kind: 'chips', var: p.var || 'filter', options: o, start: +p.start || 1, look: p.look || 'filled' }; }
  if ((b = B('uiDropdown'))) { const p = P(b), o = String(p.options || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]).map(([label, value]) => ({ label, value: value ?? label })); return { kind: 'dropdown', var: p.var || 'choice', options: o, placeholder: p.placeholder || 'Choose…', label: p.label || '', start: +p.start || 0 }; }
  if ((b = B('uiStepper'))) { const p = P(b); return { kind: 'stepper', var: p.var || 'amount', min: +p.min || 0, max: p.max == null ? 10 : +p.max, step: +p.step || 1, start: p.start ?? 1 }; }
  if ((b = B('uiRating'))) { const p = P(b); return { kind: 'rating', var: p.var || 'rating', max: +p.max || 5, start: p.start ?? 3 }; }
  if ((b = B('uiDivider'))) { const p = P(b); return { kind: 'divider', label: p.label ?? '' }; }
  if ((b = B('uiAvatar'))) { const p = P(b); return { kind: 'avatar', emoji: p.emoji || '', size: H || 64 }; }
  if ((b = B('uiBanner'))) { const p = P(b); return { kind: 'banner', tone: p.kind || 'info', title: p.title || '', text: p.text || text?.value || '', icon: p.icon || '' }; }
  if ((b = B('uiXPBar'))) { const p = P(b); return { kind: 'xpbar', xpVar: p.xpVar || 'xp', levelVar: p.levelVar || 'playerLevel', base: +p.base || 100, growth: +p.growth || 1.4 }; }
  if ((b = B('uiSteps'))) { const p = P(b); return { kind: 'steps', var: p.var || 'step', steps: opts(p.steps || 'Cart, Address, Pay') }; }
  if ((b = B('uiSpinner'))) return { kind: 'spinner' };
  if ((b = B('uiBack'))) { const p = P(b); return { kind: 'button', label: text?.value || '‹ Back', action: 'go back', value: '', amount: 1, plain: true, fill: '', color: color(text?.color) || '@accent', stroke: '', h: H || 40, radius: 12, size: text?.size || 16 }; }
  if ((b = B('uiCounter'))) { const p = P(b); return { kind: 'text', value: `${p.prefix || ''}{${p.var || 'score'}}${p.suffix || ''}`, size: text?.size || 32, weight: String(text?.weight || '800'), color: text?.color || '', align: text?.align || 'center' }; }
  if (e.bar) return { kind: 'bar', var: e.bar.var || 'xp', max: +e.bar.max || 100, h: +e.bar.h || 12, fill: color(e.bar.fill) || '@accent', bg: color(e.bar.bg) || '@line', radius: e.bar.radius ?? 6 };
  if ((b = B('uiList'))) { const p = P(b); if ((p.source || 'these items') === 'these items') return { kind: 'items', items: String(p.items || '').split('\n').map((s) => s.trim()).filter(Boolean) }; }
  // more components: charts, carousels, swipe pages, timers, keypads, popups… (each export has its own version)
  const named = (b, more) => ({ name: e.name || b.type, type: b.type, ...more });
  const th = (v, game, token = '') => { const c = color(v); return !c || c.toLowerCase() === game ? token : c; }; // (the component's game colour, untouched → the app's theme colour)
  const yes = (v, d = true) => (v == null || v === '' ? d : v !== false && v !== 'false' && v !== 'no');
  if ((b = B('uiTabIndicator'))) return null; // (the native Bottom Nav has its own)
  if ((b = B('uiNotifications'))) { const p = P(b); ctx.notify = { listen: p.listen || 'notify', position: p.position || 'top', look: p.look || 'card', seconds: +p.seconds || 3, max: +p.max || 3, bg: color(p.bg) || '#1e2235', text: color(p.text) || '#ffffff', accent: color(p.accent) || '#ffd23d' }; return null; } // (one for the whole app)
  if ((b = B('uiPopup')) || (b = B('uiSheet'))) { const p = P(b), sheet = b.type === 'uiSheet';
    return named(b, { kind: 'overlay', mode: sheet ? 'sheet' : 'popup', openOn: p.openOn || (sheet ? 'open sheet' : 'popup'), closeOn: p.closeOn || (sheet ? 'close sheet' : 'close'), startOpen: !!p.startOpen && p.startOpen !== 'false', autoClose: +p.autoClose || 0,
      tapCloses: sheet ? true : !!p.tapCloses && p.tapCloses !== 'false', dim: sheet ? yes(p.dim) : yes(p.modal), handle: sheet && yes(p.handle), box: { ...box(), w: W || 368 } }); }
  if ((b = B('uiChart'))) { const p = P(b);
    return named(b, { kind: 'chart', chart: p.chart || 'columns', data: String(p.data ?? 'Mon | 12\nTue | 19\nWed | 8').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((r) => r[0] || r[1]).map(([label = '', value = '0']) => ({ label, value })),
      track: p.track || '', every: +p.every || 1, points: +p.points || 30, title: p.title || '', max: +p.max || 0, values: yes(p.values), labels: yes(p.labels), grid: yes(p.grid), color: th(p.color, '#4fa3ff', '@accent'), text: th(p.text, '#e8eaf2'), bg: color(p.bg) || '', h: H || 200 }); }
  if ((b = B('uiCarousel'))) { const p = P(b);
    return named(b, { kind: 'carousel', items: String(p.items || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((r) => r[0]).map(([name, icon = '', value = '', lock = '', desc = '']) => ({ name, icon, value: value || name, lock, desc })),
      var: p.var || 'character', cardWidth: Math.min(1, Math.max(0.3, +p.cardWidth || 0.55)), arrows: yes(p.arrows), dots: yes(p.dots), loop: yes(p.loop, false), message: p.message || '', card: th(p.card, '#232842', '@card'), text: th(p.text, '#ffffff'), accent: th(p.accent, '#4fa3ff', '@accent'), h: H || 220 }); }
  if ((b = B('uiPager'))) { const p = P(b); return named(b, { kind: 'pager', var: p.var || 'slide', dots: yes(p.dots), dotColor: th(p.dotColor, '#ffffff', '@accent'), loop: yes(p.loop, false), auto: +p.auto || 0, message: p.message || 'slide', h: H || 320, children: kids }); }
  if ((b = B('uiPhotoGrid'))) { const p = P(b); return named(b, { kind: 'photogrid', collection: p.collection || 'Posts', field: fieldKey(p.field || 'media'), filter: p.filter || '', columns: +p.columns || 3, gap: p.gap == null ? 2 : +p.gap, radius: +p.radius || 0, openPage: p.openPage || '', message: p.message || '' }); }
  if ((b = B('uiLike'))) { const p = P(b); return named(b, { kind: 'like', var: p.var || 'liked', countVar: p.countVar ?? 'likes', icon: p.icon || 'heart', message: p.message || '', on: color(p.on) || '#f91880', off: color(p.off) || '@sub', text: color(p.text) || '@sub' }); }
  if ((b = B('uiTicker'))) { const p = P(b); return named(b, { kind: 'ticker', text: p.text || '', speed: +p.speed || 60, direction: p.direction || 'left', gap: p.gap == null ? 60 : +p.gap, size: +p.size || 15, bg: color(p.bg) || '', color: color(p.color) || '', accent: color(p.accent) || '#ffd23d', h: H || 36 }); }
  if ((b = B('uiTimerRing'))) { const p = P(b); return named(b, { kind: 'timer', seconds: +p.seconds || 30, countUp: yes(p.countUp, false), look: p.look || 'ring', format: p.format || 'seconds', autoStart: yes(p.autoStart), message: p.message || 'timer', endMessage: p.endMessage || '', endAction: p.endAction || 'nothing else', warnAt: p.warnAt == null ? 5 : +p.warnAt, var: p.var || '', color: th(p.color, '#4fa3ff', '@accent'), warn: color(p.warn) || '#ff4d5e', track: th(p.track, 'rgba(255,255,255,0.14)', '@line'), text: th(p.text, '#ffffff'), size: H || 120 }); }
  if ((b = B('uiSkeleton'))) { const p = P(b); return named(b, { kind: 'skeleton', layout: p.layout || 'avatar + lines', lines: +p.lines || 3, doneVar: p.doneVar || '', radius: p.radius == null ? 8 : +p.radius }); }
  if ((b = B('uiColorPicker'))) { const p = P(b); return named(b, { kind: 'colors', colors: opts(p.colors || '#ff4d5e, #ff9f43, #ffd23d, #3ccf7a, #4fa3ff, #8e6bf2'), var: p.var || 'color', columns: +p.columns || 5, shape: p.shape || 'circle', gap: p.gap == null ? 10 : +p.gap, ring: th(p.ring, '#ffffff', '@text'), message: p.message || '' }); }
  if ((b = B('uiKeypad'))) { const p = P(b); return named(b, { kind: 'keypad', var: p.var || 'code', maxLength: +p.maxLength || 4, mask: yes(p.mask, false), answer: String(p.answer ?? ''), rightMessage: p.rightMessage || '', wrongMessage: p.wrongMessage || '', enterMessage: p.enterMessage || '', autoEnter: yes(p.autoEnter), display: yes(p.display), keyStyle: p.keyStyle || 'round', keyColor: th(p.keyColor, '#2a3048', '@field'), text: th(p.text, '#ffffff'), accent: th(p.accent, '#3ccf7a', '@good'), displayBg: th(p.displayBg, '#11131d') }); }
  if ((b = B('uiSelector'))) { const p = P(b); return named(b, { kind: 'selector', var: p.var || 'difficulty', options: opts(p.options || 'Easy, Normal, Hard'), start: +p.start || 1, wrap: yes(p.wrap) }); }
  // game-style parts that work in apps too: a shop, a daily reward calendar, a prize wheel, a skill button, a radial menu, a level map, a quest log
  const lines = (v) => String(v ?? '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((r) => r[0]);
  if ((b = B('uiShop'))) { const p = P(b); return named(b, { kind: 'shop', items: lines(p.items ?? 'Red Hat | 🎩 | 50 | hat_red | +5% speed\nCool Shades | 🕶️ | 120 | shades | Look sharp\nWizard | 🧙 | 300 | wizard | A whole new you').map(([name, icon = '', price = '0', id = '', note = '']) => ({ name, icon, price: +price || 0, id: id || name.toLowerCase().replace(/\W+/g, '_'), note })),
    currency: p.currency || 'coins', currencyIcon: p.currencyIcon ?? '🪙', equipVar: p.equipVar ?? 'outfit', layout: p.layout || 'grid', columns: +p.columns || 2, confirm: yes(p.confirm), message: p.message ?? 'bought',
    card: th(p.card, '#232842', '@card'), text: th(p.text, '#ffffff'), accent: th(p.accent, '#3ccf7a', '@good'), owned: th(p.owned, '#4fa3ff', '@accent'), h: H || 0 }); }
  if ((b = B('uiDailyReward'))) { const p = P(b); return named(b, { kind: 'daily', rewards: lines(p.rewards ?? 'Day 1 | 🪙 | coins | 50\nDay 2 | 🪙 | coins | 100\nDay 3 | 💎 | gems | 5\nDay 4 | 🪙 | coins | 200\nDay 5 | 🎁 | coins | 300\nDay 6 | 💎 | gems | 10\nDay 7 | 👑 | gems | 25').map(([label, icon = '', v = 'coins', amount = '0']) => ({ label, icon, v, amount: +amount || 0 })),
    resetIfMissed: yes(p.resetIfMissed), columns: +p.columns || 4, message: p.message ?? 'daily claimed', card: th(p.card, '#232842', '@card'), text: th(p.text, '#ffffff'), accent: th(p.accent, '#ffd23d', '#ffd23d'), claimed: th(p.claimed, '#3ccf7a', '@good'), h: H || 0 }); }
  if ((b = B('uiSpinWheel'))) { const p = P(b); return named(b, { kind: 'wheel', segments: lines(p.segments ?? '10 | #ff4d5e | 10 | 3\n50 | #ff9f43 | 50 | 2\n5 | #ffd23d | 5 | 4\n100 | #3ccf7a | 100 | 1\n20 | #4fa3ff | 20 | 3\n200 | #8e6bf2 | 200 | 0.5').map(([label, color = '#4fa3ff', amount = '0', w = '1']) => ({ label, color, amount: +amount || 0, w: Math.max(0, +w || 0) })),
    var: p.var ?? 'coins', resultVar: p.resultVar ?? 'prize', spinOn: p.spinOn || 'tapped', message: p.message || 'spin', doneMessage: p.doneMessage || 'prize won', duration: +p.duration || 4, spinsVar: p.spinsVar || '', text: color(p.text) || '#ffffff', rim: color(p.rim) || '#ffd23d', size: Math.min(W || 280, H || 280) || 280 }); }
  if ((b = B('uiSkillButton'))) { const p = P(b); return named(b, { kind: 'skill', icon: p.icon ?? '⚡', label: p.label || '', message: p.message || 'skill', cooldown: +p.cooldown || 0, charges: Math.max(1, +p.charges || 1), costVar: p.costVar || '', cost: +p.cost || 0, shape: p.shape || 'circle', showTime: yes(p.showTime),
    bg: th(p.bg, '#232842', '@card'), ring: color(p.ring) || '#7fd3ff', size: Math.min(W || 72, H || 72) || 72 }); }
  if ((b = B('uiRadialMenu'))) { const p = P(b); return named(b, { kind: 'radial', items: lines(p.items ?? 'Wave | 👋 | emote wave\nLaugh | 😂 | emote laugh\nHeart | ❤️ | emote heart\nAngry | 😠 | emote angry\nCool | 😎 | emote cool').map(([label, icon = '', msg = '']) => ({ label, icon, msg: msg || label })),
    icon: p.icon ?? '😀', open: p.open || 'hold and slide', radius: +p.radius || 110, dim: p.dim == null ? 0.35 : +p.dim, labels: yes(p.labels), accent: th(p.accent, '#4fa3ff', '@accent'), bg: th(p.bg, '#232842', '@card'), size: Math.min(W || 64, H || 64) || 64 }); }
  if ((b = B('uiLevelMap'))) { const p = P(b); return named(b, { kind: 'levelmap', count: Math.max(1, Math.round(+p.count || (ctx.levels || 0) || 12)), unlockedVar: p.unlockedVar || 'unlocked', allOpen: yes(p.allOpen, false), starsVar: p.starsVar ?? 'stars_', layout: p.layout || 'winding path', action: p.action || 'plays that level', message: p.message || 'level', spacing: +p.spacing || 92,
    accent: th(p.accent, '#ffd23d', '#ffd23d'), node: th(p.node, '#4fa3ff', '@accent'), text: th(p.text, '#ffffff'), h: H || 480, fill: e.stretch === 'both' }); }
  if ((b = B('uiQuestLog'))) { const p = P(b); return named(b, { kind: 'quests', quests: lines(p.quests ?? 'Collect 50 coins | coins | 50 | gems 5\nDefeat 10 enemies | kills | 10 | coins 100\nReach level 3 | playerLevel | 3 | gems 20').map(([text, v = 'score', target = '1', reward = '']) => ({ text, v, target: Math.max(1, +target || 1), reward })),
    title: p.title ?? 'Quests', doneMessage: p.doneMessage || 'quest done', hideDone: yes(p.hideDone), text: th(p.text, '#ffffff'), accent: th(p.accent, '#4fa3ff', '@accent'), done: th(p.done, '#3ccf7a', '@good'), bg: color(p.bg) || '' }); }
  if ((b = B('uiPanel'))) { const p = P(b), pad = p.padding == null ? 16 : +p.padding; // a window: the card, its title in the header, then what's inside
    const title = p.title ? [{ kind: 'text', value: String(p.title), size: +p.titleSize || 17, weight: '800', color: th(p.titleColor, '#ffffff'), align: p.titleAlign === 'center' ? 'center' : 'left', pin: { fx: p.titleAlign === 'center' ? 0.5 : 0, fy: 0, x: p.titleAlign === 'center' ? 0 : pad, y: (+p.headerH || 44) / 2, w: 0, h: 0, align: p.titleAlign === 'center' ? 'center' : 'left', m: -1, wrap: 0 } }] : [];
    return { ...box(), children: [...title, ...kids] }; }
  // a menu on tap (Popover): the element is drawn natively; its menu is still to build
  if ((b = B('uiPopover'))) todo.push({ name: (e.name || 'Popover') + ' (its menu)', type: 'uiPopover' });
  const PASS = ['uiShowIf', 'dataStat', 'uiAnim', 'uiTooltip', 'uiLayout', 'uiScroll', 'uiPopover']; // (they change how it moves or where its things go: the element itself is still drawn)
  const UI = (e.behaviors || []).filter((x) => /^ui|^data/.test(x.type) && !PASS.includes(x.type));
  if (UI.length) { // no native version yet: it's drawn as its own card (shape, colours, text and what's inside), or a placeholder when it has none; the README lists it
    todo.push({ name: e.name || UI[0].type, type: UI[0].type });
    if (kids.length || text || (e.shape && (sh.fill || sh.stroke) && sh.type !== 'line')) return box();
    return { kind: 'todo', name: e.name || UI[0].type, type: UI[0].type };
  }
  if (e.sprite?.src && /^(https?:|data:image)/.test(e.sprite.src)) return { kind: 'image', src: e.sprite.src, h: Math.round((e.sprite.h || e.shape?.h || 160)) };
  if (kids.length || (e.shape && (sh.fill || sh.stroke) && sh.type !== 'line')) return box(); // a card, a badge, a divider line, a picture box
  if (text) return { kind: 'text', ...text };
  if (e.shape && H) return { kind: 'space', h: H }; // an empty shape: room between things
  return null;
}

/** Where an element sits on its page, top to bottom (anchors at the bottom come last). */
const orderOf = (e) => { const a = e.anchor || 'center', g = a.startsWith('top') ? 0 : a.startsWith('bottom') ? 2 : 1, hx = a.endsWith('left') ? 0 : a.endsWith('right') ? 2 : 1; return g * 100000 + (+e.y || 0) + hx * 0.01 + (+e.x || 0) / PAGE_W * 0.001; }; // (top to bottom; in a row, left to right)

/** game: the project JSON (as saved). */
export function appModel(game) {
  const ents = game.entities || [], byParent = new Map(), todo = [], ctx = { levels: (game.levels || []).length };
  for (const e of ents) { const k = e.parent || ''; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(e); }
  const kidsOf = (e) => (byParent.get(e.id) || []).slice().sort((a, b) => orderOf(a) - orderOf(b));
  const beh = (e, t) => (e.behaviors || []).find((b) => b.type === t);
  const P = (b) => (b ? b.params || b : {});
  /** Where a thing sits in its card: the anchor (0, ½ or 1 of the width / height), the offset from it, its size, and how its text lines up. */
  const pinOf = (e) => { const a = e.anchor || 'center', sh = e.shape || {};
    return { fx: /left$/.test(a) ? 0 : /right$/.test(a) ? 1 : 0.5, fy: /^top/.test(a) ? 0 : /^bottom/.test(a) ? 1 : 0.5, x: +e.x || 0, y: +e.y || 0,
      w: e.stretch === 'width' || e.stretch === 'both' ? 0 : +sh.w || (+sh.r || 0) * 2 || +e.sprite?.w || (e.bar ? +e.bar.w : 0) || 0, h: +sh.h || (+sh.r || 0) * 2 || (e.bar ? +e.bar.h : 0) || 0,
      align: e.text?.align || 'center', m: e.stretch === 'width' || e.stretch === 'both' ? +e.margin || 0 : -1, wrap: +e.text?.wrap || 0 }; };
  const build = (e) => {
    const kids = kidsOf(e).map(build).filter(Boolean);
    if (e.row != null && e.row !== '') { const cells = kids.filter((k) => k.pin.m >= 0); cells.forEach((k, i) => { k.pin.cell = i; k.pin.cells = cells.length; }); } // the cells of a row
    const x = elementOf(e, kids, todo, ctx); if (x) { x.pin = pinOf(e); x.src = e.id; if (x.box) x.box.src = e.id; } return x; // (src: the object it's made from, so the native preview can pick it for editing)
  };

  const bar = ents.map((e) => beh(e, 'uiAppBar')).find(Boolean), barP = P(bar);
  const titles = {}; for (const line of String(barP.titles || '').split('\n')) { const m = line.match(/^\s*([^=]+?)\s*=\s*(.+?)\s*$/); if (m) titles[m[1]] = m[2]; }
  const nav = ents.map((e) => beh(e, 'uiBottomNav')).find(Boolean), navP = P(nav);
  const rows = (v) => String(v || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((a) => a[0]);
  const bars = bar ? {
    look: barP.look || 'standard', brandPages: String(barP.brandPages ?? 'home').split(',').map((x) => x.trim()).filter(Boolean),
    align: barP.titleAlign && barP.titleAlign !== 'auto' ? barP.titleAlign : barP.style === 'centered' || (barP.look && !['standard', 'facebook', 'instagram'].includes(barP.look)) ? 'center' : 'left',
    avatar: barP.leftAvatar === 'yes' || ((barP.leftAvatar || 'for the look') === 'for the look' && barP.look === 'x'),
    left: barP.left || 'back, else menu', menuMessage: barP.menuMessage || 'menu', // (☰ / your avatar opens the Side Menu)
    circles: barP.iconStyle && barP.iconStyle !== 'for the look' ? barP.iconStyle : barP.look === 'facebook' ? 'circles' : 'plain', // icon buttons: plain, circles or outlined circles
    actions: rows(barP.actions ?? 'bell | notifications | unread\nsearch | search').map(([icon, does = '', badge = '', only = '']) => ({ icon, does, badge, only: only.split(',').map((x) => x.trim()).filter(Boolean) })).slice(0, 5),
    bg: barP.bg || '#12141f', text: barP.text || '#ffffff', icon: barP.iconColor || barP.text || '#ffffff', border: barP.border !== false, size: +barP.titleSize || 19, // (the App Bar's own default colours)
  } : null;
  // the Side Menu: its header and rows (a page, a message, or a switch for a variable), opened from the App Bar's avatar / ☰
  const side = ents.map((e) => beh(e, 'uiSideBar')).find(Boolean), sideP = P(side);
  const menuRows = (v) => String(v ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    if (l === '-') return { kind: 'line' };
    if (l.startsWith('#')) return { kind: 'section', label: l.replace(/^#+\s*/, '') };
    const [label = '', icon = '', to = '', badge = ''] = l.split('|').map((x) => x.trim());
    return to.startsWith('toggle:') ? { kind: 'toggle', label, icon, var: to.slice(7) } : to.startsWith('msg:') || to.startsWith('url:') || to.startsWith('button:') ? { kind: 'msg', label, icon, msg: to, badge } : { kind: 'page', label, icon, page: to, badge };
  });
  const menu = side ? {
    side: sideP.side || 'left', message: sideP.message || 'menu', title: sideP.title ?? 'My Game', subtitle: sideP.subtitle || '', avatar: sideP.avatar ?? '🙂', header: sideP.header || 'simple', social: !!sideP.social,
    profilePage: sideP.profilePage || 'profile', items: menuRows(sideP.items), footer: menuRows(sideP.footer), footerText: sideP.footerText || '',
    bg: sideP.bg || '#151826', text: sideP.text || '#e8eaf2', accent: sideP.accent || '#4fa3ff', badge: sideP.badgeColor || '#ff3b5c', width: +sideP.width || 290,
  } : null;
  const navStyle = navP.style || 'pill', navLabels = navP.labels && navP.labels !== 'auto' ? navP.labels : { minimal: 'never', bubble: 'selected only', 'raised center': 'always', curved: 'selected only', dock: 'never', outline: 'never' }[navStyle] || 'always';
  const navs = nav ? { style: navStyle, labels: navLabels, margin: +(navP.margin ?? 14), bar: navP.barColor || '#12141f', active: navP.activeColor || '#4fa3ff', idle: navP.idleColor || '#8b90a5', on: navP.onColor || '#ffffff' } : null; // (the Bottom Nav's own defaults)
  const tabs = String(navP.tabs || '').split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((t) => t[0] && t[2] && !/^(msg|button|url):/.test(t[2])).map(([label, icon, page, badge]) => ({ label, icon: icon || 'circle', page, badge: badge || '' }));

  const pages = [];
  for (const e of ents) {
    const s = beh(e, 'uiShowIf'); if (!s) continue;
    const p = P(s); if ((p.var || 'page') !== 'page' || p.value == null || p.value === '') continue;
    const items = kidsOf(e).map(build).filter(Boolean);
    const fab = items.find((x) => x.kind === 'button' && x.fab) || null;
    const value = String(p.value);
    pages.push({ value, name: e.name || value, home: !!p.whenUnset, title: titles[value] || (e.name || value).replace(/\s*Page$/i, ''), items: items.filter((x) => x !== fab), fab });
  }
  if (!pages.length) pages.push({ value: 'home', name: 'Home', home: true, title: game.settings?.appName || game.name || 'Home', items: [], fab: null });
  const home = (pages.find((p) => p.home) || pages.find((p) => p.value === (game.vars?.page ?? '')) || pages[0]).value;

  const stats = [];
  for (const e of ents) for (const b of e.behaviors || []) if (b.type === 'dataStat') { const p = P(b); if (p.var) stats.push({ var: p.var, collection: p.collection || '', how: p.how || 'count', field: fieldKey(p.field || ''), filter: p.filter || '', format: p.format || 'number' }); }

  const collections = (game.collections || []).map((c) => ({
    name: c.name, fields: (c.fields || []).map((f) => ({ name: f.name, key: fieldKey(f.name), type: f.type || 'text', options: String(f.options || '').split(',').map((s) => s.trim()).filter(Boolean), def: f.default ?? '' })),
    rows: (c.rows || []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k === '_at' ? k : fieldKey(k), v]))), // (_at: when it was added; it keeps its name)
  }));
  // a feed whose collection isn't there shows sample posts in the editor: the native app gets them as its Posts
  const feedColls = new Set(); const look = (x) => { if (['feed', 'trending', 'composer', 'photogrid'].includes(x.kind) && x.collection && (x.kind !== 'photogrid' || x.field === 'media')) feedColls.add(x.collection); (x.children || []).forEach(look); (x.box?.children || []).forEach(look); };
  for (const p of pages) { p.items.forEach(look); if (p.fab) look(p.fab); }
  for (const name of feedColls) if (!collections.some((c) => fieldKey(c.name) === fieldKey(name))) collections.push({ name, sample: true, fields: POST_FIELDS.map(([n, type]) => ({ name: n, key: fieldKey(n), type, options: [], def: type === 'number' ? 0 : type === 'yes/no' ? false : '' })), rows: samplePosts() });
  const vars = {}; for (const [k, v] of Object.entries(game.vars || {})) if (k !== 'page' && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')) vars[k] = v;
  // controls start with their own value when the project hasn't set the variable (a slider at 80, the 2nd tab picked…)
  const startOf = (x) => { switch (x.kind) {
    case 'slider': case 'stepper': case 'rating': return +x.start;
    case 'segmented': return x.index ? x.start : x.options[x.start - 1] ?? x.options[0];
    case 'chips': return x.options[x.start - 1] ?? x.options[0];
    case 'dropdown': return x.start ? x.options[x.start - 1]?.value : undefined;
    case 'toggle': return x.var === 'darkMode' ? undefined : !!x.start;
    case 'selector': return x.options[x.start - 1] ?? x.options[0];
    case 'carousel': return x.items.find((i) => !i.lock)?.value;
    case 'pager': return 1;
    case 'like': return false;
    default: return undefined; } };
  const walk = (x) => { const v = x.var && startOf(x); if (v !== undefined && !(x.var in vars) && !(x.var in (game.vars || {}))) vars[x.var] = v; (x.children || []).forEach(walk); (x.box?.children || []).forEach(walk); };
  for (const p of pages) p.items.forEach(walk);
  return {
    name: game.settings?.appName || game.name || 'My App', accent: game.settings?.appAccent || '', theme: themeOf(game),
    appBar: !!bar, bar: bars, nav: navs, menu, notify: ctx.notify || null, tabs: tabs.filter((t) => pages.some((p) => p.value === t.page)), pages, home, titles, collections, stats, vars, todo,
  };
}

/** Light or dark, the way the editor decides: the darkMode variable, else the theme picked, else (none picked) the background's brightness. */
function themeOf(game) {
  const v = game.vars?.darkMode;
  if (v !== undefined && v !== '' && v !== null) return [true, 1, '1', 'on', 'yes', 'dark'].includes(v) ? 'dark' : 'light';
  const bg = String(game.background || ''), t = game.settings?.appTheme;
  if (!t && /^#[0-9a-f]{3,8}$/i.test(bg)) { let h = bg.slice(1); if (h.length < 6) h = [...h.slice(0, 3)].map((c) => c + c).join(''); const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5 ? 'dark' : 'light'; }
  return t || 'light';
}
const POST_FIELDS = [['Author', 'text'], ['Handle', 'text'], ['Text', 'long text'], ['Media', 'text'], ['Color', 'text'], ['Likes', 'number'], ['Liked', 'yes/no'], ['Comments', 'number'], ['Reposts', 'number'], ['Reposted', 'yes/no'], ['Saved', 'yes/no'], ['Verified', 'yes/no'], ['Location', 'text']];
/** The editor's sample posts (what a feed shows before the app has a Posts collection). */
const samplePosts = () => { const t = Date.now(); return [
  { id: 'p1', author: 'Maya Chen', handle: 'maya', text: 'First light over the mountains this morning. Worth the 5am alarm.', media: '🏔️ | 🌄 | 🌲', color: '#4f7cff', likes: 1284, liked: false, comments: 48, reposts: 120, verified: true, location: 'Banff', _at: t - 7 * 60e3 },
  { id: 'p2', author: 'Leo Park', handle: 'leop', text: 'Shipped the new update! Dark mode, faster sync and a lot fewer bugs. Tell me what you think 👇', media: '', color: '', likes: 312, liked: true, comments: 27, reposts: 41, verified: false, _at: t - 2.5 * 3600e3 },
  { id: 'p6', author: 'Jon Doe', handle: 'jondoe', text: 'This is the kind of morning I need 🙌', media: '', color: '', likes: 41, liked: false, comments: 3, reposts: 1, verified: false, _at: t - 3 * 60e3 },
  { id: 'p5', author: 'Ava Brooks', handle: 'avab', text: 'Going live with a sketching session — come say hi!', media: '🎨', color: '#c2185b', likes: 77, liked: false, comments: 9, reposts: 3, verified: false, _at: t - 40 * 60e3 },
  { id: 'p3', author: 'Sofia Ruiz', handle: 'sofiaruiz', text: 'Homemade pasta night 🍝', media: '🍝', color: '#ff7a45', likes: 958, liked: false, comments: 63, reposts: 12, verified: false, _at: t - 26 * 3600e3 },
  { id: 'p4', author: 'Pocket News', handle: 'pocketnews', text: 'Scientists spot a new comet that will be visible without a telescope next month.', media: '', color: '', likes: 5420, liked: false, comments: 410, reposts: 1900, verified: true, _at: t - 3 * 86400e3 },
]; };

/** The app's colour tokens (@bg, @accent…) for light and dark; the accent is the app's own. */
export const PALETTES = {
  light: { bg: '#f4f6fb', card: '#ffffff', text: '#1c1f26', sub: '#6b7280', line: '#e5e7eb', field: '#f2f4f7', bar: '#ffffff', accent: '#3a7bfd', onAccent: '#ffffff', danger: '#ef4444', good: '#10b981' },
  dark: { bg: '#0f1115', card: '#1b1e25', text: '#f3f4f6', sub: '#9ca3af', line: '#2a2f38', field: '#252a33', bar: '#16191f', accent: '#6ea0ff', onAccent: '#0b1020', danger: '#f87171', good: '#34d399' },
};
/** "@accent" → the token name; "#ff0000" → null (a fixed colour). */
export const tokenOf = (c) => { const m = /^@(\w+)$/.exec(String(c || '')); return m && PALETTES.light[m[1]] ? m[1] : null; };
/** Pocket icon names → Material icon / SF Symbol names. */
export const ICONS = {
  home: ['home', 'house'], search: ['search', 'magnifyingglass'], explore: ['explore', 'safari'], user: ['person', 'person'], profile: ['person', 'person'], users: ['group', 'person.2'], chat: ['chat_bubble_outline', 'bubble.left'],
  bell: ['notifications_none', 'bell'], heart: ['favorite_border', 'heart'], star: ['star_border', 'star'], settings: ['settings', 'gearshape'], gear: ['settings', 'gearshape'], plus: ['add', 'plus'], add: ['add', 'plus'],
  list: ['list', 'list.bullet'], check: ['check', 'checkmark'], calendar: ['calendar_today', 'calendar'], clock: ['schedule', 'clock'], video: ['play_circle_outline', 'play.rectangle'], play: ['play_arrow', 'play'],
  shop: ['storefront', 'bag'], cart: ['shopping_cart', 'cart'], trophy: ['emoji_events', 'trophy'], map: ['map', 'map'], camera: ['photo_camera', 'camera'], image: ['image', 'photo'], edit: ['edit', 'pencil'],
  trash: ['delete_outline', 'trash'], info: ['info_outline', 'info.circle'], menu: ['menu', 'line.3.horizontal'], bookmark: ['bookmark_border', 'bookmark'], wallet: ['account_balance_wallet', 'creditcard'], money: ['attach_money', 'dollarsign.circle'],
  chart: ['bar_chart', 'chart.bar'], note: ['sticky_note_2', 'note.text'], book: ['menu_book', 'book'], music: ['music_note', 'music.note'], globe: ['public', 'globe'], gamepad: ['sports_esports', 'gamecontroller'], circle: ['circle', 'circle'],
  // the rest of the editor's icons
  pause: ['pause', 'pause'], close: ['close', 'xmark'], back: ['arrow_back', 'chevron.left'], next: ['arrow_forward', 'chevron.right'], sound: ['volume_up', 'speaker.wave.2'], lock: ['lock_outline', 'lock'],
  moon: ['dark_mode', 'moon'], sun: ['light_mode', 'sun.max'], filter: ['filter_list', 'line.3.horizontal.decrease'], sort: ['sort', 'arrow.up.arrow.down'], share: ['ios_share', 'square.and.arrow.up'],
  mail: ['mail_outline', 'envelope'], phone: ['phone', 'phone'], pin: ['place', 'mappin'], grid: ['grid_view', 'square.grid.2x2'], download: ['download', 'arrow.down.circle'], refresh: ['refresh', 'arrow.clockwise'],
  more: ['more_horiz', 'ellipsis'], coin: ['monetization_on', 'dollarsign.circle'], gem: ['diamond', 'diamond'], flag: ['flag', 'flag'], gift: ['card_giftcard', 'gift'], tag: ['sell', 'tag'], key: ['key', 'key'],
  shield: ['shield', 'shield'], bolt: ['bolt', 'bolt'], fire: ['local_fire_department', 'flame'], link: ['link', 'link'], eye: ['visibility', 'eye'], 'eye-off': ['visibility_off', 'eye.slash'], unlock: ['lock_open', 'lock.open'],
  sliders: ['tune', 'slider.horizontal.3'], cloud: ['cloud_queue', 'cloud'], upload: ['upload', 'arrow.up.circle'], wifi: ['wifi', 'wifi'], battery: ['battery_full', 'battery.100'], compass: ['explore', 'safari'],
  navigate: ['navigation', 'location.north'], send: ['send', 'paperplane'], attach: ['attach_file', 'paperclip'], mic: ['mic_none', 'mic'], headphones: ['headphones', 'headphones'], dice: ['casino', 'dice'],
  crown: ['workspace_premium', 'crown'], rocket: ['rocket_launch', 'paperplane'], target: ['gps_fixed', 'scope'], medal: ['military_tech', 'rosette'], 'thumbs-up': ['thumb_up_off_alt', 'hand.thumbsup'],
  smile: ['sentiment_satisfied', 'face.smiling'], 'user-plus': ['person_add', 'person.badge.plus'], logout: ['logout', 'rectangle.portrait.and.arrow.right'], login: ['login', 'person.crop.circle'], copy: ['content_copy', 'doc.on.doc'],
  file: ['description', 'doc'], folder: ['folder_open', 'folder'], inbox: ['inbox', 'tray'], card: ['credit_card', 'creditcard'], bag: ['shopping_bag', 'bag'], percent: ['percent', 'percent'], truck: ['local_shipping', 'shippingbox'],
  undo: ['undo', 'arrow.uturn.backward'], 'zoom-in': ['zoom_in', 'plus.magnifyingglass'], expand: ['open_in_full', 'arrow.up.left.and.arrow.down.right'], minus: ['remove', 'minus'], 'x-circle': ['cancel', 'xmark.circle'],
  'check-circle': ['check_circle_outline', 'checkmark.circle'], alert: ['warning_amber', 'exclamationmark.triangle'], help: ['help_outline', 'questionmark.circle'], sparkles: ['auto_awesome', 'sparkles'], bulb: ['lightbulb_outline', 'lightbulb'],
  palette: ['palette', 'paintpalette'], code: ['code', 'chevron.left.forwardslash.chevron.right'], layers: ['layers', 'square.3.layers.3d'], 'skip-next': ['skip_next', 'forward.end'], 'skip-back': ['skip_previous', 'backward.end'],
  mute: ['volume_off', 'speaker.slash'], repeat: ['repeat', 'repeat'], shuffle: ['shuffle', 'shuffle'], hourglass: ['hourglass_empty', 'hourglass'], podium: ['leaderboard', 'chart.bar'], news: ['newspaper', 'newspaper'],
  paw: ['pets', 'pawprint'], leaf: ['eco', 'leaf'], drop: ['water_drop', 'drop'], coffee: ['local_cafe', 'cup.and.saucer'], media: ['perm_media', 'photo.on.rectangle'],
};
/** The icons the App Bar, Bottom Nav and Side Menu show (they're drawn with the editor's own line icons). */
export const barIcons = (model) => [...new Set([...model.tabs.map((t) => t.icon), ...(model.bar?.actions || []).flatMap((a) => (a.icon === 'theme' || /dark mode/.test(a.does) ? ['sun', 'moon', a.icon] : [a.icon])),
  ...(model.menu ? ['menu', model.menu.avatar, ...[...model.menu.items, ...model.menu.footer].map((i) => i.icon)] : [])])].filter(Boolean);
export const iconFor = (name, i) => (ICONS[String(name || '').toLowerCase()] || ICONS.circle)[i];
