import {ABILITIES,cardHTML} from './combat.js';

const colors=['#a965e1','#70b9ef','#42c896'];
document.getElementById('matchups').innerHTML=ABILITIES.map((a,lane)=>`<article style="--magic:${colors[lane]}"><div class="tag">${String(lane+1).padStart(2,'0')} / АТАКА БОССА</div>${cardHTML(lane,'attack')}<h3>${a.attack}</h3><div class="connection"></div>${cardHTML(lane)}<h3>${a.name} <kbd>${a.key}</kbd></h3><p>${['Блокирует фиолетовую магию','Плавит синий лёд','Отражает зелёную магию'][lane]}</p></article>`).join('');
const demo=document.getElementById('demo');
const select=document.getElementById('demo-ability');
const status=document.getElementById('demo-status');
const buttons=[...document.querySelectorAll('[data-quality]')];
let timers=[];
function reset(){
  timers.forEach(clearTimeout);timers=[];
  demo.className='demo-stage';demo.dataset.lane=select.value;
  demo.style.setProperty('--magic',colors[+select.value]);
  demo.querySelector('.incoming').className=`combat-card attack-card lane-${select.value} incoming`;
  demo.querySelector('.defender').className=`combat-card ability-card lane-${select.value} defender`;
  demo.querySelector('.demo-verdict').textContent='';
  status.textContent='Готово к отражению';buttons.forEach(b=>b.disabled=false);
}
select.addEventListener('change',reset);
buttons.forEach(button=>button.addEventListener('click',()=>{
  reset();
  const quality=button.dataset.quality;
  // A fresh frame restarts repeated previews, without forcing synchronous layout.
  timers.push(setTimeout(()=>{
    demo.classList.add('flying');buttons.forEach(b=>b.disabled=true);
    status.textContent='Атака приближается…';
    timers.push(setTimeout(()=>{
      demo.classList.add('contact',quality);
      const verdict=quality==='perfect'?'ИДЕАЛЬНО':ABILITIES[+select.value].action;
      demo.querySelector('.demo-verdict').textContent=verdict;
      status.textContent=quality==='perfect'?'Идеальное отражение · контрудар':`Попадание · ${ABILITIES[+select.value].name}`;
    },900));
    timers.push(setTimeout(()=>buttons.forEach(b=>b.disabled=false),1650));
  },20));
}));
reset();
