const asset=name=>`assets/figma/${name}`;
export function portraitHTML(boss,variant='start'){
  const prefix=`${variant==='start'?'start':'victory'}-${boss.id}`;
  return `<div class="boss-art ${variant}-art ${boss.id}-art" aria-hidden="true"><div class="art-mask"><img class="art-underlay" src="${asset(`${prefix}-imgImage74.png`)}" alt="">${boss.id==='egor'?`<img src="${asset(`${prefix}-imgImage75.png`)}" alt="">`:''}</div><img class="art-frame" src="${asset(`${prefix}-imgFrame.png`)}" alt=""></div>`;
}
export function paintBoss(boss){
  document.getElementById('boss-portrait').innerHTML=boss.id==='egor'?`<div class="home-boss-art egor-home" aria-hidden="true"><div class="home-art-mask"><img src="assets/figma/home-egor-base.png" alt=""><img src="assets/figma/home-egor.png" alt=""></div><img class="home-art-frame" src="assets/figma/home-frame.png" alt=""></div>`:`<div class="home-boss-art anna-home">${portraitHTML(boss)}</div>`;
  document.getElementById('boss-location').textContent=boss.location;
  document.getElementById('boss-name').innerHTML=boss.title;
  document.getElementById('boss-position').textContent=`${String(boss.position??1).padStart(2,'0')}/${String(boss.total??2).padStart(2,'0')}`;
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
