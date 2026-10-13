// Loading screens for built games: what shows while the file unpacks the engine, the game, its pictures and fonts.
// loadingParts() turns the settings into CSS, HTML and a small script. The editor's live preview and the built file use the same parts.

export const LOADING_DEFAULTS = {
  splash: 'logo', // 'logo' (picture + name), 'text' (name and text only), 'none'
  splashBg: '', splashBg2: '', splashGrad: 'down', // background colour, optional second colour: down / across / diagonal / glow (from the centre)
  splashImage: '', splashFit: 'cover', splashDim: 0.35, // background picture
  logo: 'icon', logoImage: '', logoSize: 96, logoShape: 'rounded', logoAnim: 'none',
  showName: true, nameFont: '', nameColor: '#ffffff', nameSize: 22,
  splashText: '', textColor: '', tips: '', tipEvery: 3,
  bar: 'rounded', barColor: '#ffffff', barColor2: '', barTrack: '', barWidth: 200, barPos: 'under', barLabel: '',
  splashTime: 1.2, tapToStart: false, tapText: 'Tap to start', exit: 'fade', credit: false,
};

/** One-tap looks. Each sets several loading-screen settings at once. */
const BASE = { splashGrad: 'down', splashImage: '', logoSize: 96, nameSize: 22, textColor: '', barWidth: 200, barPos: 'under', splashTime: 1.2, tapToStart: false, tapText: 'Tap to start' };
export const LOADING_PRESETS = {
  Classic: { splashBg: '', splashBg2: '', splashImage: '', logo: 'icon', logoShape: 'rounded', logoAnim: 'none', showName: true, nameFont: '', nameColor: '#ffffff', bar: 'rounded', barColor: '#ffffff', barColor2: '', barTrack: '', barLabel: '', exit: 'fade' },
  Minimal: { splashBg: '#000000', splashBg2: '', splashImage: '', logo: 'none', showName: true, nameFont: 'system-ui, -apple-system, sans-serif', nameColor: '#ffffff', nameSize: 18, bar: 'line', barColor: '#ffffff', barColor2: '', barTrack: '', barWidth: 160, barLabel: '', exit: 'fade' },
  Neon: { splashBg: '#07041a', splashBg2: '#1b0838', splashGrad: 'glow', splashImage: '', logo: 'icon', logoShape: 'circle', logoAnim: 'glow', showName: true, nameFont: '"Avenir Next Condensed", "Arial Narrow", sans-serif-condensed, sans-serif', nameColor: '#33f0ff', nameSize: 26, bar: 'glow', barColor: '#33f0ff', barColor2: '#ff3df0', barTrack: '', barWidth: 220, barLabel: '{percent}%', textColor: '#b9a8ff', exit: 'zoom' },
  Retro: { splashBg: '#000000', splashBg2: '', splashImage: '', logo: 'none', showName: true, nameFont: 'ui-monospace, Menlo, Consolas, monospace', nameColor: '#41ff00', nameSize: 24, bar: 'blocks', barColor: '#41ff00', barColor2: '', barTrack: 'rgba(65,255,0,0.15)', barWidth: 240, barLabel: 'LOADING {percent}%', textColor: '#2fae00', tapText: 'PRESS TO START', exit: 'wipe' },
  Candy: { splashBg: '#ff8fb8', splashBg2: '#8b5cf6', splashGrad: 'diagonal', splashImage: '', logo: 'icon', logoShape: 'circle', logoAnim: 'bounce', showName: true, nameFont: '"Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif', nameColor: '#ffffff', nameSize: 28, bar: 'striped', barColor: '#ffd23d', barColor2: '#ff6f91', barTrack: 'rgba(255,255,255,0.3)', barWidth: 230, barLabel: '', exit: 'slide up' },
  Cinematic: { splashBg: '#000000', splashBg2: '', splashImage: '', logo: 'none', showName: true, nameFont: 'Georgia, "Times New Roman", serif', nameColor: '#e8dcc0', nameSize: 30, bar: 'spinner', barColor: '#e8dcc0', barColor2: '', barTrack: '', barLabel: '', textColor: '#8c826c', exit: 'fade', splashTime: 2.5 },
  Storybook: { splashBg: '#4a2f1b', splashBg2: '#1f130a', splashGrad: 'glow', splashImage: '', logo: 'icon', logoShape: 'rounded', logoAnim: 'float', showName: true, nameFont: '"Palatino Linotype", Palatino, "Book Antiqua", serif', nameColor: '#ffe9b8', nameSize: 28, bar: 'ring', barColor: '#e8b84a', barColor2: '', barTrack: 'rgba(255,233,184,0.15)', barWidth: 200, barLabel: '{percent}%', textColor: '#d9c39a', exit: 'fade' },
  Arcade: { splashBg: '#12002b', splashBg2: '#3b0a67', splashGrad: 'down', splashImage: '', logo: 'icon', logoShape: 'square', logoAnim: 'pulse', showName: true, nameFont: 'Impact, "Arial Black", sans-serif', nameColor: '#ffd23d', nameSize: 32, bar: 'thick', barColor: '#ff3d57', barColor2: '#ffd23d', barTrack: 'rgba(0,0,0,0.45)', barWidth: 250, barLabel: '{percent}%', exit: 'zoom', tapToStart: true, tapText: 'TAP TO PLAY' },
};

/** Loading bar styles: [value, name, has a real amount (not just spinning)]. */
export const BAR_STYLES = [['line', 'Thin line'], ['rounded', 'Rounded'], ['thick', 'Thick with %'], ['striped', 'Striped (moving)'], ['blocks', 'Blocks (retro)'], ['glow', 'Glowing'], ['ring', 'Ring'], ['dots', 'Bouncing dots'], ['spinner', 'Spinner'], ['none', 'No bar']];

const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const hex = (c, d) => (/^#[0-9a-f]{3,8}$/i.test(c || '') || /^rgba?\(/.test(c || '') ? c : d);

/**
 * CSS, HTML and script for a loading screen.
 * ctx: { title, icon (data URL), bg (the game's background), preview (true: loops forever for the editor) }
 * The script defines window.PocketLoading = { set(fraction), done(start) }: done waits for the minimum time and a tap if asked, plays the exit, then calls start().
 */
export function loadingParts(o, ctx) {
  o = { ...LOADING_DEFAULTS, ...o };
  const bg = hex(o.splashBg, ctx.bg || '#000'), bg2 = hex(o.splashBg2, '');
  const grad = !bg2 ? bg : o.splashGrad === 'glow' ? `radial-gradient(circle at 50% 45%, ${bg2}, ${bg} 70%)` : `linear-gradient(${{ down: '180deg', across: '90deg', diagonal: '135deg' }[o.splashGrad] || '180deg'}, ${bg}, ${bg2})`;
  const c1 = hex(o.barColor, '#ffffff'), fillBg = o.barColor2 ? `linear-gradient(90deg, ${c1}, ${hex(o.barColor2, c1)})` : c1;
  const track = o.barTrack || 'rgba(255,255,255,0.18)', W = Math.max(60, Math.min(340, +o.barWidth || 200));
  const textC = o.textColor || 'rgba(255,255,255,0.72)', font = o.nameFont || ctx.font || '-apple-system, system-ui, sans-serif';
  const logoSrc = o.logo === 'picture' && o.logoImage ? o.logoImage : o.logo === 'none' ? '' : ctx.icon;
  const showLogo = o.splash === 'logo' && logoSrc, sz = Math.max(40, Math.min(220, +o.logoSize || 96));
  const radius = { circle: '50%', square: '0', rounded: Math.round(sz * 0.23) + 'px', none: '0' }[o.logoShape] || '22%';
  const anim = { pulse: 'pk-pulse 1.4s ease-in-out infinite', bounce: 'pk-bounce 1s ease-in-out infinite', spin: 'pk-spin 2.4s linear infinite', float: 'pk-float 2.6s ease-in-out infinite', glow: 'pk-glow 1.6s ease-in-out infinite' }[o.logoAnim] || 'none';
  const hasAmount = !['dots', 'spinner', 'none'].includes(o.bar);
  const label = o.barLabel || (o.bar === 'thick' || o.bar === 'ring' ? '{percent}%' : '');
  const css = `#pk-load{position:fixed;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:${grad};color:#fff;font:600 16px ${font};text-align:center;overflow:hidden;transition:opacity .45s,transform .45s,clip-path .55s;-webkit-user-select:none;user-select:none}
#pk-load .pk-bgimg{position:absolute;inset:0;background:url("${o.splashImage ? o.splashImage.replace(/"/g, '%22') : ''}") center/${o.splashFit === 'contain' ? 'contain' : o.splashFit === 'tile' ? 'auto' : 'cover'} ${o.splashFit === 'tile' ? 'repeat' : 'no-repeat'}}
#pk-load .pk-dim{position:absolute;inset:0;background:rgba(0,0,0,${Math.max(0, Math.min(0.9, +o.splashDim || 0))})}
#pk-load>.pk-in{position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;padding:0 24px;max-width:100%;box-sizing:border-box}
#pk-load .pk-logo{width:${sz}px;height:${sz}px;border-radius:${radius};object-fit:cover;${o.logoShape === 'none' ? '' : 'box-shadow:0 8px 30px rgba(0,0,0,.35);'}animation:${anim}}
#pk-load .pk-name{font:800 ${Math.max(12, +o.nameSize || 22)}px ${font};color:${hex(o.nameColor, '#fff')};letter-spacing:.01em;line-height:1.15}
#pk-load .pk-text,#pk-load .pk-tip{font-weight:400;font-size:14px;color:${textC};line-height:1.35;max-width:320px}
#pk-load .pk-tip{min-height:19px;transition:opacity .3s}
#pk-load .pk-bar{width:${W}px;max-width:80vw;position:relative}
#pk-load .pk-track{position:relative;height:${{ line: 3, rounded: 8, thick: 22, striped: 14, glow: 8 }[o.bar] || 8}px;border-radius:${o.bar === 'line' ? 2 : 999}px;background:${track};overflow:hidden}
#pk-load .pk-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:inherit;background:${fillBg};transition:width .2s ease-out}
${o.bar === 'glow' ? `#pk-load .pk-track{overflow:visible}#pk-load .pk-fill{box-shadow:0 0 12px ${c1},0 0 24px ${c1}}` : ''}
${o.bar === 'striped' ? '#pk-load .pk-fill::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(-45deg,rgba(255,255,255,.28) 0 8px,transparent 8px 16px);background-size:22.6px 100%;animation:pk-stripe .6s linear infinite}' : ''}
${o.bar === 'thick' ? '#pk-load .pk-in-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5)}' : ''}
#pk-load .pk-blocks{display:flex;gap:4px}#pk-load .pk-blocks i{flex:1;height:16px;background:${track};outline:1px solid ${c1}}#pk-load .pk-blocks i.on{background:${c1}}
#pk-load .pk-ring{width:${Math.min(W, 120) * 0.6}px;height:${Math.min(W, 120) * 0.6}px;margin:0 auto;position:relative}#pk-load .pk-ring svg{width:100%;height:100%;transform:rotate(-90deg)}#pk-load .pk-ring span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800}
#pk-load .pk-dots{display:flex;gap:8px;justify-content:center}#pk-load .pk-dots i{width:10px;height:10px;border-radius:50%;background:${c1};animation:pk-dot 1s ease-in-out infinite}#pk-load .pk-dots i:nth-child(2){animation-delay:.15s}#pk-load .pk-dots i:nth-child(3){animation-delay:.3s}
#pk-load .pk-spin{width:34px;height:34px;margin:0 auto;border-radius:50%;border:3px solid ${track};border-top-color:${c1};animation:pk-spin .8s linear infinite}
#pk-load .pk-label{margin-top:8px;font-size:13px;font-weight:600;color:${textC}}
#pk-load .pk-tap{font-size:16px;font-weight:700;animation:pk-blink 1.2s ease-in-out infinite}
#pk-load .pk-credit{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);left:0;right:0;font-size:11px;font-weight:500;color:${textC};opacity:.7}
${o.barPos === 'bottom' ? '#pk-load .pk-bar{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 56px);left:50%;transform:translateX(-50%)}' : ''}
#pk-load.pk-out-fade{opacity:0}#pk-load.pk-out-slide{transform:translateY(-100%)}#pk-load.pk-out-zoom{opacity:0;transform:scale(1.35)}#pk-load.pk-out-wipe{clip-path:circle(0% at 50% 50%)}
@keyframes pk-pulse{50%{transform:scale(1.08)}}@keyframes pk-bounce{50%{transform:translateY(-14px)}}@keyframes pk-spin{to{transform:rotate(360deg)}}@keyframes pk-float{50%{transform:translateY(-8px) rotate(2deg)}}
@keyframes pk-glow{50%{box-shadow:0 0 28px ${c1},0 0 56px ${c1}}}@keyframes pk-stripe{to{background-position:22.6px 0}}@keyframes pk-dot{0%,80%,100%{transform:scale(.5);opacity:.5}40%{transform:scale(1);opacity:1}}@keyframes pk-blink{50%{opacity:.35}}`;
  let bar = '';
  if (o.bar === 'blocks') bar = `<div class="pk-blocks">${'<i></i>'.repeat(10)}</div>`;
  else if (o.bar === 'ring') bar = `<div class="pk-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" fill="none" stroke="${track}" stroke-width="3"/><circle class="pk-arc" cx="18" cy="18" r="15.5" fill="none" stroke="${c1}" stroke-width="3" stroke-linecap="round" stroke-dasharray="97.4" stroke-dashoffset="97.4"/></svg><span class="pk-pct"></span></div>`;
  else if (o.bar === 'dots') bar = '<div class="pk-dots"><i></i><i></i><i></i></div>';
  else if (o.bar === 'spinner') bar = '<div class="pk-spin"></div>';
  else if (o.bar !== 'none') bar = `<div class="pk-track"><div class="pk-fill"></div>${o.bar === 'thick' ? '<div class="pk-in-label pk-pct"></div>' : ''}</div>`;
  const outer = o.bar === 'ring' || o.bar === 'thick' ? '' : label ? '<div class="pk-label pk-pct"></div>' : '';
  const html = `<div id="pk-load"${o.splash === 'none' && !o.tapToStart ? ' hidden' : ''}>${o.splashImage ? '<div class="pk-bgimg"></div><div class="pk-dim"></div>' : ''}<div class="pk-in">${showLogo ? `<img class="pk-logo" src="${logoSrc}" alt="">` : ''}${o.showName !== false && o.splash !== 'none' ? `<div class="pk-name">${esc(ctx.title)}</div>` : ''}${o.splashText ? `<div class="pk-text">${esc(o.splashText)}</div>` : ''}<div class="pk-bar">${bar}${outer}</div>${o.tips ? '<div class="pk-tip"></div>' : ''}</div>${o.credit ? '<div class="pk-credit">Made with Pocket Engine</div>' : ''}</div>`;
  const cfg = { label, hasAmount, tips: String(o.tips || '').split('|').map((t) => t.trim()).filter(Boolean), every: Math.max(1, +o.tipEvery || 3), min: Math.max(0, +o.splashTime || 0) * 1000, tap: !!o.tapToStart, tapText: o.tapText || 'Tap to start', exit: o.exit || 'fade', preview: !!ctx.preview, hidden: o.splash === 'none' && !o.tapToStart };
  const js = `(function(){var C=${JSON.stringify(cfg).replace(/</g, '\\u003c')},el=document.getElementById('pk-load'),t0=performance.now(),shown=0,real=0,raf=0,finished=false;
function q(s){return el.querySelectorAll(s)}
function draw(){var f=Math.max(0,Math.min(1,shown)),p=Math.round(f*100);q('.pk-fill').forEach(function(d){d.style.width=p+'%'});q('.pk-blocks i').forEach(function(d,i){d.className=i<Math.round(f*10)?'on':''});q('.pk-arc').forEach(function(d){d.setAttribute('stroke-dashoffset',String(97.4*(1-f)))});q('.pk-pct').forEach(function(d){d.textContent=C.label.replace(/\\{percent\\}/g,p)})}
function tick(){var cap=C.min?Math.min(1,(performance.now()-t0)/C.min):1,want=Math.min(real,cap);shown+=(want-shown)*0.18;if(want-shown<0.004)shown=want;draw();if(!finished)raf=requestAnimationFrame(tick)}
var ti=0,tip=el.querySelector('.pk-tip');function nextTip(){if(!tip||!C.tips.length||finished)return;tip.style.opacity=0;setTimeout(function(){tip.textContent=C.tips[ti++%C.tips.length];tip.style.opacity=1},C.tips.length>1?250:0)}
if(tip&&C.tips.length){tip.textContent=C.tips[ti++%C.tips.length];if(C.tips.length>1)setInterval(nextTip,C.every*1000)}
raf=requestAnimationFrame(tick);
function leave(start){finished=true;cancelAnimationFrame(raf);start&&start();if(C.preview)return;var cls={fade:'pk-out-fade','slide up':'pk-out-slide',zoom:'pk-out-zoom',wipe:'pk-out-wipe'}[C.exit];if(!cls||el.hidden){el.remove();return}el.classList.add(cls);setTimeout(function(){el.remove()},600)}
window.PocketLoading={set:function(f){real=Math.max(real,Math.min(1,f))},
done:function(start){real=1;var wait=function(){if(shown<0.995&&C.hasAmount&&!el.hidden){requestAnimationFrame(wait);return}var left=C.min-(performance.now()-t0);if(left>0){setTimeout(wait,left);return}
if(!C.tap)return leave(start);q('.pk-bar,.pk-tip').forEach(function(d){d.style.display='none'});var t=document.createElement('div');t.className='pk-tap';t.textContent=C.tapText;el.querySelector('.pk-in').appendChild(t);el.addEventListener('pointerup',function(){leave(start)},{once:true})};wait()}};
if(C.preview){var run=function(){cancelAnimationFrame(raf);real=0;shown=0;t0=performance.now();finished=false;var steps=[0.35,0.5,0.55,0.8,0.82,1],i=0;var iv=setInterval(function(){real=steps[i++];if(i>=steps.length){clearInterval(iv)}},450);raf=requestAnimationFrame(tick);setTimeout(run,Math.max(4200,C.min+1800))};cancelAnimationFrame(raf);run()}
})();`;
  return { css, html, js };
}
// every preset starts from the same base, so picking one never keeps another's tap-to-start or timing
for (const k of Object.keys(LOADING_PRESETS)) LOADING_PRESETS[k] = { ...BASE, ...LOADING_PRESETS[k] };
