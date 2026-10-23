import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {BOSSES,preparationKey,outcome} from '../bosses.js';
import {preparedChart,hasWon} from '../rhythm.js';
import {portraitHTML,revealPortrait} from '../screens.js';
import {BOSS_ART} from '../boss-art.js';
for(const boss of BOSSES){
  test(`${boss.id}: maps correspond to this recording and work at both lengths`,()=>{
    const map=JSON.parse(fs.readFileSync(new URL(`../${boss.chart}`,import.meta.url)));
    const hash=crypto.createHash('sha256').update(fs.readFileSync(new URL(`../${boss.source}`,import.meta.url))).digest('hex');
    assert.equal(map.sourceSha256,hash);assert.ok(Math.abs(map.duration-boss.duration)<.1);
    assert.ok(fs.statSync(new URL(`../${boss.shortAudio}`,import.meta.url)).size<fs.statSync(new URL(`../${boss.audio}`,import.meta.url)).size);
    assert.ok(fs.statSync(new URL(`../${boss.audio}`,import.meta.url)).size<fs.statSync(new URL(`../${boss.source}`,import.meta.url)).size);
    for(const mode of ['classic','pulse','vocal'])for(const duration of [90,map.duration]){
      const chart=preparedChart(map,duration,mode);assert.ok(chart.notes.length>20);
      for(const n of chart.notes){assert.ok(n.time>=3&&n.end<=duration);assert.ok(n.lane>=0&&n.lane<=2)}
    }
    for(const path of [boss.battle,...Object.values(BOSS_ART[boss.id])])assert.ok(fs.statSync(new URL(`../${path}`,import.meta.url)).size>0,path);
    assert.ok(boss.source.startsWith(`Music/${String(BOSSES.indexOf(boss)+1).padStart(2,'0')} `));
    for(const variant of ['start','victory'])for(const match of portraitHTML(boss,variant).matchAll(/src="([^"]+)"/g))assert.ok(fs.existsSync(new URL(`../${match[1]}`,import.meta.url)),match[1]);
  });
}
test('Switching bosses, length or layout cannot reuse the wrong prepared chart',()=>{
  const keys=new Set(BOSSES.flatMap(boss=>['90','full'].flatMap(length=>['vocal','pulse','classic'].map(mode=>preparationKey(boss,length,mode)))));
  assert.equal(keys.size,BOSSES.length*6);
});
test('Results select the correct boss and show hit count percentage',()=>{
  for(const boss of BOSSES){const win=outcome(hasWon(85,100)?'win':'survived',boss,{score:1000,hits:85,total:100,combo:18});assert.equal(win.victory,true);assert.equal(win.boss.id,boss.id);assert.equal(win.accuracy,'85%');assert.equal(win.combo,'18');const loss=outcome('survived',boss,{score:2000,hits:84,total:100,combo:20});assert.equal(loss.victory,false)}
});

test('Boss cards contain only the final portrait, without images of previous bosses',()=>{
 const expected={anna:'74',egor:'75',princes:'76',mia:'77',heir:'74'};
 for(const boss of BOSSES){
  const html=portraitHTML(boss);
  const portraits=[...html.matchAll(/src="([^"]*imgImage7[4-7]\.webp)"/g)].map(match=>match[1]);
  assert.deepEqual(portraits,[`assets/figma/cards-${boss.id}-imgImage${expected[boss.id]}.webp`]);
 }
 const egor=portraitHTML(BOSSES.find(b=>b.id==='egor'),'victory');
 assert.ok(!egor.includes('imgImage74.webp'));
});
test('Portrait stays hidden until decoding completes and never reveals a failed image',async()=>{
 let resolve;
 const ready=new Promise(r=>resolve=r);
 const mask={style:{},isConnected:true,querySelectorAll:()=>[{decode:()=>ready}]};
 const pending=revealPortrait({querySelectorAll:()=>[mask]});
 assert.equal(mask.style.visibility,'hidden');
 resolve();await pending;assert.equal(mask.style.visibility,'visible');
 mask.querySelectorAll=()=>[{decode:()=>Promise.reject(new Error('Download failed'))}];
 await revealPortrait({querySelectorAll:()=>[mask]});
 assert.equal(mask.style.visibility,'hidden');
 mask.isConnected=false;mask.querySelectorAll=()=>[{decode:()=>Promise.resolve()}];
 await revealPortrait({querySelectorAll:()=>[mask]});
 assert.equal(mask.style.visibility,'hidden');
});
