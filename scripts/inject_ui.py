from pathlib import Path
p=Path(__file__).resolve().parents[1]/'site/index.html'
s=p.read_text()
assert 'id="hero-follow-trigger"' not in s
css='''<style id="live-engine-styles">
.live-follow-trigger{height:44px;border:2px solid #cbdccf;background:#e8f4eb;color:#244b3b;border-radius:14px;padding:0 13px;font-weight:850;cursor:pointer;white-space:nowrap}
.live-follow-trigger:hover{background:#d7eedf}
.live-engine-dialog{position:fixed;z-index:1000;inset:0;background:rgba(27,51,39,.45);display:grid;place-items:center;padding:18px}
.live-engine-dialog[hidden]{display:none!important}
.live-engine-card{width:min(610px,100%);max-height:88dvh;overflow:auto;border-radius:24px;border:2px solid #bcd6c5;background:#fffdf7;padding:22px;box-shadow:0 22px 65px rgba(20,46,32,.22);color:#20372f}
.live-engine-head{display:flex;justify-content:space-between;align-items:start;gap:12px}
.live-engine-head h2{margin:0;color:#20372f;font-size:21px}.live-engine-head p,.live-engine-hint{color:#425b50;font-size:12px;line-height:1.5}
.live-engine-close{border:1px solid #c7d8ca;border-radius:11px;background:#f6f9f2;padding:8px 12px;color:#24483a;cursor:pointer}
.live-engine-hero-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
.live-engine-follow{display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #d0dfd3;border-radius:12px;background:#f9fbf6;color:#24483a;font-size:12px;cursor:pointer}
.live-engine-follow input{accent-color:#35735a;width:18px;height:18px}
.live-engine-badge{display:inline-block;padding:6px 9px;border-radius:999px;background:#e6f2e9;border:1px solid #bfdac8;font-size:11px;color:#315744;font-weight:800}
.live-engine-banner{margin-top:12px;border-radius:13px;border:1px solid #cddfce;padding:11px 12px;background:#f3f8f0;color:#344f41;font-size:12px;line-height:1.5}
.live-engine-alert{border-bottom:1px solid #dce8de;padding:10px 0;color:#294537;font-size:12px;line-height:1.5}
.live-engine-alert small{display:block;color:#536c5c}
.live-engine-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.live-engine-actions button{border:1px solid #bdd3c3;background:#e7f3e8;color:#254d3c;padding:10px 12px;border-radius:11px;font-weight:800;cursor:pointer}
@media(max-width:680px){.live-follow-trigger{height:42px;padding:0 10px;font-size:12px}.live-engine-hero-list{grid-template-columns:repeat(2,minmax(0,1fr))}.live-engine-card{padding:15px}.topbar-actions:has(.live-follow-trigger){grid-template-columns:minmax(0,1fr) auto auto auto;gap:5px}}
@media(max-width:420px){.live-follow-trigger{font-size:0}.live-follow-trigger:before{content:'Follow';font-size:12px}}
</style>'''
s=s.replace('</head>',css+'\n</head>',1)
s=s.replace('<button id="ui-sound-toggle"','<button id="hero-follow-trigger" type="button" class="live-follow-trigger" title="Follow heroes and patch notifications">Follow heroes</button>\n          <button id="ui-sound-toggle"',1)
modal='''<section id="live-follow-dialog" class="live-engine-dialog" role="dialog" aria-modal="true" aria-labelledby="live-follow-title" hidden>
 <div class="live-engine-card">
  <div class="live-engine-head"><div><h2 id="live-follow-title">Follow hero changes</h2><p>Track Blizzard patch notes for the heroes you actually play. Your choices stay in this browser.</p></div><button type="button" id="live-follow-close" class="live-engine-close" aria-label="Close follow settings">Close</button></div>
  <div id="live-engine-status" class="live-engine-banner" role="status"></div>
  <div class="live-engine-actions"><button id="live-enable-notifications" type="button">Enable browser alerts</button><button id="live-view-patches" type="button">Patch history</button></div>
  <p class="live-engine-hint">Alerts appear when you reopen or refresh this app and new notes are found. Background push notifications require a separate push service. Unvalidated balance numbers are not applied automatically.</p>
  <div id="live-follow-list" class="live-engine-hero-list"></div>
  <h3>Recent followed changes</h3><div id="live-follow-events" aria-live="polite"></div>
 </div>
</section>'''
s=s.replace('</body>',modal+'\n</body>',1)
js=r'''<script id="live-engine-ui">
(()=>{
'use strict';
const db=window.OW_DB||{}, engine=db.liveEngine||{};
const trigger=document.getElementById('hero-follow-trigger'), dialog=document.getElementById('live-follow-dialog');
const list=document.getElementById('live-follow-list'),events=document.getElementById('live-follow-events'), status=document.getElementById('live-engine-status');
const safeGet=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch(_){return fallback}};
const safeSave=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}};
const followed=new Set(safeGet('heroLabFollowedHeroes',[]));
const escapeHTML=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timeStr=engine.checked_at ? new Date(engine.checked_at).toLocaleString() : 'Not yet checked by the deployed engine';
function render(){
  const checked=engine.status==='checked';
  status.textContent=checked?`Official Blizzard page checked ${timeStr}. Latest detected patch: ${engine.latest_seen_date||'unknown'}. Only explicitly validated stat changes affect calculations.`:'Automatic server polling is not connected in this local file. Deploy the included GitHub Actions workflow to activate it.';
  list.replaceChildren();for(const h of (db.heroes||[]).sort((a,b)=>a.name.localeCompare(b.name))){
    const label=document.createElement('label');label.className='live-engine-follow';
    const input=document.createElement('input');input.type='checkbox';input.checked=followed.has(h.name);input.setAttribute('aria-label','Follow '+h.name);
    input.addEventListener('change',()=>{if(input.checked)followed.add(h.name);else followed.delete(h.name);safeSave('heroLabFollowedHeroes',[...followed]);renderEvents()});
    label.append(input,document.createTextNode(h.name));list.append(label);
  }renderEvents();
}
function renderEvents(){
  const matching=(engine.entries||[]).filter(x=>followed.has(x.hero)).slice(0,20);events.replaceChildren();
  if(!followed.size){events.textContent='Choose heroes above to see their patch updates.';return}
  if(!matching.length){events.textContent='No recorded changes for your followed heroes in this deployed snapshot.';return}
  for(const ev of matching){const node=document.createElement('div');node.className='live-engine-alert';
   const strong=document.createElement('strong');strong.textContent=`${ev.hero} · ${ev.patch_date} · ${ev.status==='auto_verified'?'Validated stat':'Pending verification'}`;
   const desc=document.createElement('small');desc.textContent=(ev.ability?ev.ability+': ':'')+ev.text;
   node.append(strong,desc);events.append(node)}
}
let previousFocus=null;
function open(){previousFocus=document.activeElement;render();dialog.hidden=false;document.getElementById('live-follow-close').focus()}
function close(){dialog.hidden=true;previousFocus?.focus()}
trigger?.addEventListener('click',open);
document.getElementById('live-follow-close')?.addEventListener('click',close);
dialog?.addEventListener('click',ev=>{if(ev.target===dialog)close()});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!dialog.hidden)close()});
document.getElementById('live-view-patches')?.addEventListener('click',()=>{close();const history=document.querySelector('[data-power-mode="patch"]');if(history)history.click();else document.querySelector('[data-view="patches"]')?.click()});
document.getElementById('live-enable-notifications')?.addEventListener('click',async()=>{
 if(!('Notification' in window)){alert('This browser does not support notifications. Followed changes remain visible in the app.');return}
 if(!window.isSecureContext){alert('Browser alerts require HTTPS or localhost. Followed updates will still show in the app.');return}
 const permission=await Notification.requestPermission();
 alert(permission==='granted'?'Browser alerts enabled for newly detected changes when this app is opened.':'Notifications not enabled. Followed changes remain visible here.');
});
// Browser-only notifications: no invented background push guarantees.
const allEvents=(engine.entries||[]).filter(x=>followed.has(x.hero));
const signature=allEvents.map(x=>x.id).sort().join('|');
const old=safeGet('heroLabLastSeenPatchIds',[]);
const newlyObserved=allEvents.filter(x=>!old.includes(x.id));
if(old.length&&newlyObserved.length&&'Notification' in window&&Notification.permission==='granted'&&window.isSecureContext){
 try{new Notification('Hero Lab: followed hero changes',{body:newlyObserved.slice(0,3).map(e=>e.hero+': '+e.text).join(' · ').slice(0,220)})}catch(_){}}
// Save the union, so toggling subscriptions cannot re-alert historical patches on every visit.
safeSave('heroLabLastSeenPatchIds',[...new Set([...old,...(engine.entries||[]).map(x=>x.id)])].slice(-2500));
if(trigger&&newlyObserved.length&&old.length){trigger.textContent=`${newlyObserved.length} new patches`}
})();
</script>'''
s=s.replace('</body>',js+'\n</body>',1)
p.write_text(s)
print('patched UI',len(s))
