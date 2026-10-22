import {BOSS_ART,CARD_GEOMETRY,FIGHT_GEOMETRY} from './boss-art.js?v=bosses-5';
const asset=name=>`assets/figma/${name}`;
export function homePortraitHTML(boss){
 const art=BOSS_ART[boss.id],g=CARD_GEOMETRY[boss.id];
 const layers=Object.entries(art).filter(([key])=>/^imgImage7[4-7]$/.test(key)).map(([,src])=>`<img src="${src}" alt="">`).join('');
 return `<div class="home-boss-art roster-art" aria-hidden="true" style="--card-top:${g.top}px"><div class="roster-mask" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px;mask-image:url('${art.imgImage73}');-webkit-mask-image:url('${art.imgImage73}');mask-position:${g.mx}px ${g.my}px;-webkit-mask-position:${g.mx}px ${g.my}px">${layers}</div><img class="home-art-frame" src="${art.imgFrame}" alt=""></div>`;
}
export function portraitHTML(boss,variant='start'){
 if(variant==='start')return homePortraitHTML(boss);
 if(!['anna','egor'].includes(boss.id))return `<div class="boss-art victory-art roster-victory">${homePortraitHTML(boss)}</div>`;
 const prefix=`victory-${boss.id}`;
 return `<div class="boss-art victory-art ${boss.id}-art" aria-hidden="true"><div class="art-mask"><img class="art-underlay" src="${asset(`${prefix}-imgImage74.png`)}" alt="">${boss.id==='egor'?`<img src="${asset(`${prefix}-imgImage75.png`)}" alt="">`:''}</div><img class="art-frame" src="${asset(`${prefix}-imgFrame.png`)}" alt=""></div>`;
}
export function paintBattle(boss){
 const portrait=document.querySelector('.portrait'),g=FIGHT_GEOMETRY[boss.id];
 portrait.style.backgroundImage=g?'none':`url('${boss.battle}')`;
 portrait.innerHTML=g?`<div class="fight-art-stage"><div class="fight-art-mask" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px;mask-image:url('${BOSS_ART[boss.id].imgImage236}');-webkit-mask-image:url('${BOSS_ART[boss.id].imgImage236}');mask-position:${g.mx}px ${g.my}px;-webkit-mask-position:${g.mx}px ${g.my}px"><img src="${boss.battle}" alt=""></div></div>`:'';
}
export function paintBoss(boss){
  document.getElementById('boss-portrait').innerHTML=homePortraitHTML(boss);
  document.getElementById('boss-portrait').style.top=`${CARD_GEOMETRY[boss.id].top}px`;
  document.getElementById('boss-location').textContent=boss.location;
  document.getElementById('boss-name').innerHTML=boss.title;
  document.getElementById('boss-position').textContent=`${String(boss.position??1).padStart(2,'0')}/${String(boss.total??5).padStart(2,'0')}`;
}
export function paintOutcome(data){
  const screen=document.getElementById('outcome');
  screen.classList.toggle('victory',data.victory);screen.classList.toggle('defeat',!data.victory);
  screen.setAttribute('aria-label',`${data.victory?'Босс повержен':'Вы мертвы'}. Нажмите, чтобы вернуться к выбору боя`);
  document.getElementById('result-art').innerHTML=data.victory?portraitHTML(data.boss,'victory'):'';
  document.getElementById('result-title').innerHTML=data.victory?'Босс<br>повержен':'Вы мертвы';
  document.getElementById('result-description').textContent=data.victory?data.boss.soul:'ваша душа возвращается в нексус';
  document.getElementById('result-score').textContent=data.score;
  document.getElementById('result-accuracy').textContent=data.accuracy;
  document.getElementById('result-combo').textContent=data.combo;
}
export function fitScreens(root){
  const fit=()=>{const r=root.getBoundingClientRect();const top=parseFloat(getComputedStyle(root).getPropertyValue('--tg-top'))||0,bottom=parseFloat(getComputedStyle(root).getPropertyValue('--tg-bottom'))||0;const scale=Math.min(r.width/360,(r.height-top-bottom)/780);root.style.setProperty('--screen-scale',Math.max(.3,scale));root.style.setProperty('--screen-y',`${top+(r.height-top-bottom-780*scale)/2}px`)};
  new ResizeObserver(fit).observe(root);fit();return fit;
}
