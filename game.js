import {MusicPlayer, downloadAsset} from './audio.js?v=ready-7';
import {WINDOW, judge, nearest, multiplier, preparedChart, VICTORY_RATE, hasWon} from './rhythm.js?v=ready-7';
const $ = id => document.getElementById(id), root = $('game'), canvas = $('highway'), pen = canvas.getContext('2d'), pads = [...document.querySelectorAll('.pad')];
const NOTE_TRAVEL = 1.8;
const audioElement=document.createElement('audio');audioElement.hidden=true;document.body.append(audioElement);
const music=new MusicPlayer(audioElement);
let pendingChart=null,preparedKey='';
const TRACK = 'Music/Anna_Asti_-_Po_baram.mp3';
const laneColors=['#aab7b8','#d28c60','#b4a078'];
const laneIcons=['01 Shield.png','02 Flame.png','03 Sword.png'].map(name=>{const img=new Image();img.src=`assets/${name}`;return img});
let chartBeat=1,chartPhase=0;
let chartData, musicReady=false, duration = 90, state = 'idle', notes = [], training = false, offset = 0;
let hp=100, boss=100, score=0, combo=0, maxCombo=0, hitCount=0, perfectCount=0, feedbackUntil=0;
let width=400, height=350, lastUI=0, phaseTwo=false, countText='', loadTask, holdGrace=0;
const held = new Map(), activeInputs = new Map(), flashes=[0,0,0], particles=[], hitEffects=[];
const storage={get(k,f=''){try{return localStorage.getItem(k)??f}catch{return f}},set(k,v){try{localStorage.setItem(k,String(v))}catch{}}};
$('offset').value=storage.get('anna.offset','0'); $('offset-value').textContent=`${$('offset').value} мс`;
$('best').textContent=storage.get('anna.best') ? `Личный рекорд · ${Number(storage.get('anna.best')).toLocaleString('ru-RU')} душ` : '';
$('offset').addEventListener('input',()=>{ $('offset-value').textContent=`${$('offset').value} мс`; storage.set('anna.offset',$('offset').value); });
function tgCall(method,...args){ try{ const tg=window.Telegram?.WebApp; if(!tg?.initData)return; const versions={requestFullscreen:'8.0',lockOrientation:'8.0',disableVerticalSwipes:'7.7',enableVerticalSwipes:'7.7',enableClosingConfirmation:'6.2',disableClosingConfirmation:'6.2'};if(versions[method]&&!tg.isVersionAtLeast(versions[method]))return;if(tg[method])return tg[method](...args); }catch{} }
function setupTelegram(){ const tg=window.Telegram?.WebApp;if(!tg?.initData)return;tgCall('ready');tgCall('expand');tgCall('setHeaderColor','#090d12');tgCall('setBackgroundColor','#090d12');const safe=()=>{const a=tg.safeAreaInset||{},b=tg.contentSafeAreaInset||{};root.style.setProperty('--tg-top',`${(a.top||0)+(b.top||0)+10}px`);root.style.setProperty('--tg-bottom',`${Math.max(a.bottom||0,b.bottom||0)+10}px`)};safe();tg.onEvent('safeAreaChanged',safe);tg.onEvent('contentSafeAreaChanged',safe);tg.onEvent('deactivated',()=>pause());tg.BackButton?.onClick(()=>pause());}
setupTelegram();
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*d);canvas.height=Math.round(height*d);pen.setTransform(d,0,0,d,0,0)}
new ResizeObserver(resize).observe(canvas);
function audioTime(){return music.currentTime}
function gameTime(){return audioTime()-offset}
function fmt(t){t=Math.max(0,Math.floor(t));return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`}
async function load(){
  if(musicReady&&chartData)return;
  if(!loadTask){
    const controller=new AbortController();
    loadTask=(async()=>{
      try{
        const aac=!!audioElement.canPlayType('audio/mp4; codecs="mp4a.40.2"');
        const [mapBytes,musicBytes]=await Promise.all([
          downloadAsset('charts.json?v=ready-7',{signal:controller.signal,timeoutMs:20000}),
          downloadAsset(aac?'Music/anna-playback.m4a':TRACK,{signal:controller.signal,onProgress:(received,total)=>{
            const mb=(received/1048576).toFixed(1);
            $('status').textContent=total?`Загрузка музыки: ${Math.min(100,Math.round(received/total*100))}% · ${mb} МБ`:`Загрузка музыки: ${mb} МБ`;
          }})
        ]);
        const map=JSON.parse(new TextDecoder().decode(mapBytes));
        if(!map.modes||!map.duration)throw new Error('Повреждена карта трека');
        music.setSource(URL.createObjectURL(new Blob([musicBytes],{type:aac?'audio/mp4':'audio/mpeg'})));
        chartData=map;musicReady=true;
      }catch(e){controller.abort();throw e}
    })();
  }
  try{await loadTask}catch(e){loadTask=null;throw e}
}
function stopSource(){music.stop()}
function resetInputs(preserveHolds=false){activeInputs.clear();if(!preserveHolds)held.clear();pads.forEach(p=>p.classList.remove('active'))}
function backButton(show){const tg=window.Telegram?.WebApp;if(tg?.initData&&tg.isVersionAtLeast('6.1'))tg.BackButton?.[show?'show':'hide']()}
async function start(){
  if(state==='paused'){await resume();return}
  const key=`${$('length').value}:${$('chart-mode').value}`;
  $('start').disabled=true;
  try{
    if(!pendingChart||preparedKey!==key){
      $('status').textContent='Загружаем готовую карту и музыку…';
      await load();
      duration=$('length').value==='full'?chartData.duration:Math.min(90,chartData.duration);
      pendingChart=preparedChart(chartData,duration,$('chart-mode').value);
      if(!pendingChart.notes.length)throw new Error('Не удалось построить карту нот');
      preparedKey=key;
      $('start').innerHTML='Вступить в бой со звуком <span>↗</span>';
      $('status').textContent='Трек готов. Нажми ещё раз, чтобы включить звук и начать бой.';
      return;
    }
    // Native play is invoked inside this click, before any asynchronous work.
    const playback=music.play();
    $('status').textContent='Включаем звук…';
    await playback;
    resetInputs();offset=Number($('offset').value)/1000;training=$('training').checked;
    notes=pendingChart.notes.map(n=>({...n,state:'pending'}));chartBeat=pendingChart.beat??60/pendingChart.bpm;chartPhase=pendingChart.phase??0;
    hp=100;boss=100;score=0;combo=0;maxCombo=0;hitCount=0;perfectCount=0;phaseTwo=false;particles.length=0;hitEffects.length=0;flashes.fill(0);
    root.classList.remove('phase-two');$('phase').textContent='ПЕРВЫЙ ОБЕТ';$('judgment').textContent='СЛЕДУЙ РИТМУ';feedbackUntil=0;$('timing').textContent='Центр руны на линии';
    state='playing';$('overlay').hidden=true;$('pause').disabled=false;tgCall('disableVerticalSwipes');tgCall('enableClosingConfirmation');tgCall('requestFullscreen');tgCall('lockOrientation');backButton(true);updateUI();
  }catch(e){
    music.pause();
    $('status').textContent=e.name==='NotAllowedError'?'Telegram заблокировал звук. Нажми «Вступить в бой» ещё раз.':`Не удалось включить трек: ${e.message}. Попробуй ещё раз.`;
    console.error(e);
  }finally{$('start').disabled=false}
}
function showMenu(mode){
  const paused=mode==='pause';$('overlay').hidden=false;$('settings').hidden=!paused;$('instructions').hidden=true;$('results').hidden=paused;$('restart').hidden=!paused;
  $('eyebrow').textContent=paused?'ОБЕТ НЕ РАЗОРВАН':'СОБОР ПОМНИТ';$('title').textContent=paused?'Тишина перед ударом':mode==='win'?'Обет разрушен':mode==='dead'?'Ты пал':'Она устояла';
  $('description').textContent=paused?'Сделай вдох. Следующий удар будет точным.':mode==='win'?'Холод отступает. Анна склоняет корону.':mode==='dead'?'Собор забрал ещё одну душу. Попробуй снова.':'Дойди до конца и набери 85% попаданий, чтобы победить.';
  $('start').innerHTML=paused?'Продолжить <span>↗</span>':'Ещё один бой <span>↗</span>';
  $('status').textContent=paused?'Смещение можно изменить перед продолжением.':'Раскладку можно сменить перед следующим боем · Прототип 0.2';
  if(!paused){$('settings').hidden=false;$('results').innerHTML=`<span>ДУШИ<b>${score.toLocaleString('ru-RU')}</b></span><span>МАКС. КОМБО<b>${maxCombo}</b></span><span>ПОПАДАНИЯ<b>${Math.floor(hitCount/notes.length*100)}%</b></span><span>ИДЕАЛЬНО<b>${perfectCount}</b></span>`}
}
function pause(){if(state!=='playing')return;state='paused';resetInputs(true);music.pause();showMenu('pause');tgCall('enableVerticalSwipes')}
async function resume(){
  try{
    const playback=music.play();
    await playback;offset=Number($('offset').value)/1000;holdGrace=gameTime()+.35;state='playing';$('overlay').hidden=true;tgCall('disableVerticalSwipes');
  }catch(e){$('status').textContent='Не удалось включить звук. Нажми «Продолжить» ещё раз.';console.error(e)}
}
audioElement.addEventListener('pause',()=>{if(state==='playing'&&audioElement.paused&&!audioElement.ended)pause()});
audioElement.addEventListener('ended',()=>{if(state==='playing')finish(hasWon(hitCount,notes.length)?'win':'survived')});
audioElement.addEventListener('error',()=>{
  if(state==='playing')pause();
  $('status').textContent='Не удалось воспроизвести трек. Закрой мини-приложение и открой его заново.';
});
function finish(mode){if(state!=='playing')return;state='ended';stopSource();resetInputs();$('pause').disabled=true;$('countdown').textContent='';if(score>Number(storage.get('anna.best','0')))storage.set('anna.best',score);$('best').textContent=`Личный рекорд · ${Number(storage.get('anna.best','0')).toLocaleString('ru-RU')} душ`;showMenu(mode);tgCall('enableVerticalSwipes');tgCall('disableClosingConfirmation');backButton(false)}
function feedback(text,color='#a0e4fc'){ $('judgment').textContent=text;$('judgment').style.color=color;$('timing').textContent='Центр руны на линии';feedbackUntil=performance.now()+1000 }
function damage(amount){hp=Math.max(0,hp-amount);combo=0;root.classList.remove('hit');$('damage').animate([{opacity:.6},{opacity:0}],{duration:350});if(hp===0&&!training)finish('dead')}
function reward(note,quality,delta){const value=quality==='perfect'?1:quality==='good'?.8:.55;hitCount++;if(quality==='perfect')perfectCount++;combo++;maxCombo=Math.max(maxCombo,combo);score+=Math.round(100*value*multiplier(combo));hp=Math.min(100,hp+.65);feedback(quality==='perfect'?'ИДЕАЛЬНО':quality==='good'?'ТОЧНО':'ЕСТЬ');const ms=Math.round(Math.abs(delta)*1000);$('timing').textContent=`${delta<0?'РАНЬШЕ':delta>0?'ПОЗЖЕ':'В РИТМ'} · ${ms} мс${quality==='perfect'?' · ±65 мс':''}`;root.classList.add('hit');setTimeout(()=>root.classList.remove('hit'),120);burst(note.lane,quality);}
function press(lane,input){
  if(state!=='playing'||activeInputs.has(input))return;
  if([...activeInputs.values()].includes(lane))return;
  activeInputs.set(input,lane);pads[lane].classList.add('active');flashes[lane]=performance.now()+180;
  const t=gameTime();if(t<0)return;if(held.has(lane))return;
  const note=nearest(notes,lane,t);
  if(!note){damage(1.5);feedback('МИМО','#c7807f');return}
  const quality=judge(t-note.time);reward(note,quality,t-note.time);note.state=note.duration?'holding':'hit';if(note.duration)held.set(lane,note);updateUI();
}
function release(input){const lane=activeInputs.get(input);if(lane===undefined)return;activeInputs.delete(input);pads[lane].classList.remove('active');const note=held.get(lane);if(note){held.delete(lane);if(gameTime()<note.end-.12){note.state='broken';damage(3);feedback('ОБРЫВ','#c7807f')}else completeHold(note)}}
function completeHold(note){if(note.state!=='holding')return;note.state='hit';score+=50*multiplier(combo);held.delete(note.lane);burst(note.lane);feedback('УДЕРЖАНО')}
$('start').addEventListener('click',start);$('pause').addEventListener('click',pause);$('restart').addEventListener('click',()=>{state='ended';stopSource();start()});
for(const pad of pads){pad.addEventListener('pointerdown',e=>{e.preventDefault();pad.setPointerCapture(e.pointerId);press(Number(pad.dataset.lane),`p${e.pointerId}`)});for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,e=>release(`p${e.pointerId}`));}
const keys={KeyC:0,KeyB:1,KeyM:2,ArrowLeft:0,ArrowDown:1,ArrowRight:2};
window.addEventListener('keydown',e=>{if((e.code==='Escape'||e.code==='Space')&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();if(state==='playing')pause();else if(state==='paused')resume();return}if(keys[e.code]!==undefined&&state==='playing'&&!e.repeat){e.preventDefault();press(keys[e.code],e.code)}});
window.addEventListener('keyup',e=>release(e.code));window.addEventListener('blur',()=>pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});

function updateUI(){boss=Math.max(0,100-hitCount/Math.ceil(notes.length*VICTORY_RATE)*100);$('life').style.width=`${hp}%`;$('resolve').style.width=`${Math.min(100,combo/40*100)}%`;$('boss-life').style.width=`${boss}%`;document.querySelector('.bossbar').setAttribute('aria-valuenow',String(Math.round(boss)));$('score').textContent=score.toLocaleString('ru-RU');$('combo').textContent=combo;$('multiplier').textContent=`×${multiplier(combo)}`;const t=Math.max(0,audioTime());$('progress').style.width=`${Math.min(100,t/duration*100)}%`;$('time').textContent=`${fmt(t)} / ${fmt(duration)}`;}
function point(lane,p){return{x:width/2+(lane-1)*width*.306,y:height*(.04+.82*p),spread:1}}
function noteSize(){return Math.min(width*.104,height*.092)}
function rune(x,y,size,color,fill=true,lane=null){
  const w=size*2.7,h=size*2.85;
  pen.save();pen.beginPath();pen.roundRect(x-w/2,y-h/2,w,h,Math.max(3,size*.18));
  pen.strokeStyle=color;pen.lineWidth=fill?2.5:1.5;pen.shadowColor=color;pen.shadowBlur=fill?5:0;
  if(fill){const g=pen.createLinearGradient(0,y-h/2,0,y+h/2);g.addColorStop(0,color+'88');g.addColorStop(.3,'#181b20e6');g.addColorStop(.75,'#101216eb');g.addColorStop(1,color+'55');pen.fillStyle=g;pen.fill()}
  else{pen.fillStyle=color+'12';pen.fill()}pen.stroke();pen.shadowBlur=0;
  const icon=laneIcons[lane];
  if(icon?.complete&&icon.naturalWidth){if(!fill)pen.globalAlpha=.65;const side=Math.min(w,h)*1.05;pen.drawImage(icon,x-side/2,y-side/2,side,side)}
  pen.restore();
}
function judgmentField(now){
  const y=point(1,1).y, zone=noteSize()*3.0, speed=height*.82/NOTE_TRAVEL, perfect=.065*speed;
  const elapsed=gameTime()-chartPhase,beatAge=((elapsed%chartBeat)+chartBeat)%chartBeat;
  const pulse=state==='playing'&&elapsed>=0&&!matchMedia('(prefers-reduced-motion: reduce)').matches?Math.max(0,1-beatAge/.16):0;
  pen.save();pen.fillStyle='#070e19f0';pen.fillRect(width*.035,y-zone/2,width*.93,zone);
  const g=pen.createLinearGradient(0,y-zone/2,0,y+zone/2);g.addColorStop(0,'#aa7c3133');g.addColorStop(.5,'#f4bf6444');g.addColorStop(1,'#aa7c3122');pen.fillStyle=g;pen.fillRect(width*.035,y-zone/2,width*.93,zone);
  for(const edge of [-1,1]){pen.beginPath();pen.moveTo(width*.035,y+edge*zone/2);pen.lineTo(width*.965,y+edge*zone/2);pen.strokeStyle='#c3a16f';pen.lineWidth=2;pen.stroke()}
  pen.fillStyle='#ffe2a83b';pen.fillRect(width*.035,y-perfect,width*.93,perfect*2);
  pen.beginPath();pen.moveTo(width*.035,y);pen.lineTo(width*.965,y);pen.strokeStyle='#ffe2a8';pen.shadowColor='#ffc96f';pen.shadowBlur=8+pulse*16;pen.lineWidth=2+pulse*2;pen.stroke();pen.shadowBlur=0;
  if(pulse){pen.fillStyle=`rgba(238,197,125,${pulse*.13})`;pen.fillRect(width*.035,y-zone/2,width*.93,zone)}
  for(let lane=0;lane<3;lane++){
    const p=point(lane,1),color=laneColors[lane];rune(p.x,p.y,noteSize(),color,false,lane);
    pen.fillStyle='#ddd0b8';pen.font='11px system-ui';pen.textAlign='center';pen.fillText(['C','B','M'][lane],p.x,p.y+noteSize()*1.2);
    if(flashes[lane]>now){pen.fillStyle=color+'22';pen.fillRect(p.x-width*.14,y-zone/2,width*.28,zone)}
  }
  pen.restore();
}
function burst(lane,quality='good'){
  const perfect=quality==='perfect',p=point(lane,1),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  hitEffects.push({lane,perfect,age:0,duration:perfect?650:320});
  for(let i=0;i<(reduced?0:perfect?24:8);i++)particles.push({x:p.x,y:p.y,vx:(Math.random()-.5)*(perfect?240:100),vy:-Math.random()*(perfect?230:100),life:1,decay:perfect?1.6:3,color:perfect?'#ffe6ae':laneColors[lane],star:perfect});
}
function drawHitEffects(dt){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(let i=hitEffects.length-1;i>=0;i--){const effect=hitEffects[i];effect.age+=dt*1000;if(effect.age>=effect.duration){hitEffects.splice(i,1);continue}
    const t=effect.age/effect.duration,p=point(effect.lane,1),w=width*.28,h=noteSize()*2.9,color=effect.perfect?'#ffe6ae':laneColors[effect.lane];
    pen.save();pen.globalAlpha=(1-t)*(effect.perfect?.9:.65);pen.shadowColor=color;pen.shadowBlur=effect.perfect?22:8;
    const beam=pen.createLinearGradient(0,p.y-h*(effect.perfect?3:1),0,p.y+h/2);beam.addColorStop(0,color+'00');beam.addColorStop(1,color+'99');pen.fillStyle=beam;pen.fillRect(p.x-w/2,p.y-h*(effect.perfect?3:1),w,h*(effect.perfect?3.5:1.5));
    pen.strokeStyle=color;pen.lineWidth=effect.perfect?3:2;pen.beginPath();pen.roundRect(p.x-w/2,p.y-h/2,w,h,8);pen.stroke();
    if(effect.perfect&&!reduced){pen.beginPath();pen.ellipse(p.x,p.y,w*(.45+t*.65),h*(.45+t*.65),0,0,Math.PI*2);pen.stroke();pen.fillStyle='#fff7de';pen.fillRect(p.x-w*.55,p.y-1,w*1.1,2)}
    pen.restore();
  }
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt;p.life-=p.decay*dt;if(p.life<=0){particles.splice(i,1);continue}pen.save();pen.globalAlpha=p.life;pen.fillStyle=p.color;
    if(p.star){pen.fillRect(p.x-3,p.y-1,6,2);pen.fillRect(p.x-1,p.y-3,2,6)}else pen.fillRect(p.x,p.y,3,3);pen.restore();
  }
}
let lastFrame=0;
function render(now){
  const dt=lastFrame?Math.min(.05,(now-lastFrame)/1000):0;lastFrame=now;
  requestAnimationFrame(render);pen.clearRect(0,0,width,height);const t=state==='idle'?0:gameTime();
  const gradient=pen.createLinearGradient(0,height*.1,0,height*.9);gradient.addColorStop(0,'#080e1300');gradient.addColorStop(.5,'#080e13b8');gradient.addColorStop(1,'#080e13fa');pen.fillStyle=gradient;pen.fillRect(0,0,width,height);
  for(let i=0;i<4;i++){const x=width/2+(i-1.5)*width*.306;pen.beginPath();pen.moveTo(x,0);pen.lineTo(x,height);pen.strokeStyle='#a69c8850';pen.lineWidth=1;pen.stroke()}
  judgmentField(now);
  if(state==='playing'){
    let pendingDamage=0;
    for(const n of notes){if(n.state==='pending'&&t-n.time>WINDOW){n.state='miss';pendingDamage+=5;}else if(n.state==='holding'){if(![...activeInputs.values()].includes(n.lane)&&t>holdGrace){n.state='broken';held.delete(n.lane);pendingDamage+=3;}else if(t>=n.end-.04)completeHold(n)}}
    if(pendingDamage){damage(pendingDamage);feedback('ПРОМАХ','#c7807f')}
    if(state==='playing'&&audioTime()>=duration)finish(hasWon(hitCount,notes.length)?'win':'survived');
    if(!phaseTwo&&audioTime()>duration*.52){phaseTwo=true;root.classList.add('phase-two');$('phase').textContent='ВТОРОЙ ОБЕТ · ЛЕДЯНОЙ ГНЕВ';feedback('ВТОРОЙ ОБЕТ','#e2c28a')}
    const count=audioTime()<3?String(Math.ceil(3-audioTime())):'';if(count!==countText){$('countdown').textContent=count;countText=count}
    if(now-lastUI>80){updateUI();lastUI=now}
  }
  const visible=state==='idle'?[{time:1,lane:0,duration:.6,state:'pending'},{time:1.7,lane:1,duration:0,state:'pending'},{time:2.3,lane:2,duration:0,state:'pending'}]:notes;
  for(const n of visible){if(!['pending','holding'].includes(n.state))continue;const delta=n.time-t;if(delta>NOTE_TRAVEL||delta < -Math.max(n.duration,.25))continue;let p=1-delta/NOTE_TRAVEL;const pos=point(n.lane,Math.min(1.08,Math.max(0,p))),color=laneColors[n.lane];
    if(n.duration){const tail=point(n.lane,Math.max(0,1-(n.time+n.duration-t)/NOTE_TRAVEL)),head=n.state==='holding'?point(n.lane,1):pos;pen.beginPath();pen.moveTo(tail.x,tail.y);pen.lineTo(head.x,head.y);pen.strokeStyle=color+'55';pen.lineWidth=20*pos.spread;pen.stroke();pen.strokeStyle=color;pen.lineWidth=3;pen.stroke();rune(tail.x,tail.y,noteSize()*.35,color,true,n.lane);}
    const head=n.state==='holding'?point(n.lane,1):pos;rune(head.x,head.y,noteSize(),color,true,n.lane);
  }
  drawHitEffects(state==='paused'?0:dt);
  if(feedbackUntil&&now>feedbackUntil){$('judgment').textContent='СЛЕДУЙ РИТМУ';$('judgment').style.color='';$('timing').textContent='Центр руны на линии';feedbackUntil=0}
}
requestAnimationFrame(render);
