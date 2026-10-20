import test from 'node:test';
import assert from 'node:assert/strict';
import {judge, nearest, multiplier, makeChart, hasWon} from '../rhythm.js';
test('Timing windows handle both early and late touches',()=>{for(const s of [-1,1]){assert.equal(judge(s*.06),'perfect');assert.equal(judge(s*.10),'good');assert.equal(judge(s*.17),'ok');assert.equal(judge(s*.181),null)}});
test('Nearest pending note only in pressed lane; cannot score a note twice',()=>{const notes=[{lane:0,time:1,state:'hit'},{lane:1,time:1.05,state:'pending'},{lane:0,time:1.12,state:'pending'}];assert.equal(nearest(notes,0,1.04),notes[2]);assert.equal(nearest(notes,2,1),null);assert.equal(nearest(notes,0,1.5),null)});
test('Combo multiplier caps at four',()=>{assert.equal(multiplier(0),1);assert.equal(multiplier(10),2);assert.equal(multiplier(30),4);assert.equal(multiplier(100),4)});
test('Audio chart is deterministic, bounded and playable with no overlapping holds',()=>{const rate=8000,duration=20,data=new Float32Array(rate*duration);for(let t=.2;t<duration;t+=.5)for(let k=0;k<400;k++)data[Math.floor(t*rate)+k]=Math.sin(k*.4)*(.8-k/500);const buffer={sampleRate:rate,duration,getChannelData:()=>data};const a=makeChart(buffer,duration),b=makeChart(buffer,duration);assert.deepEqual(a,b);assert.ok(a.notes.length>10);for(let i=0;i<a.notes.length;i++){const n=a.notes[i];assert.ok(n.time>=3&&n.end<duration);assert.ok(n.lane>=0&&n.lane<=2);if(i){assert.ok(n.time-a.notes[i-1].end>=.12);assert.ok(n.time-a.notes[i-1].time>=.48)}const previous=a.notes.slice(0,i).findLast(other=>other.lane===n.lane);if(previous)assert.ok(n.time-previous.time>=.85)}});

test("Victory requires at least 85% of notes regardless of score quality",()=>{assert.equal(hasWon(84,100),false);assert.equal(hasWon(85,100),true);assert.equal(hasWon(100,100),true);assert.equal(hasWon(849,1000),false);assert.equal(hasWon(850,1000),true);assert.equal(hasWon(9,11),false);assert.equal(hasWon(10,11),true);assert.equal(hasWon(0,0),false)});

test('New chart leaves silence empty',()=>{const data=new Float32Array(8000*12);assert.equal(makeChart({sampleRate:8000,duration:12,getChannelData:()=>data},12).notes.length,0)});
test('Short and full modes share their opening notes and detected tempo',()=>{const rate=8000,duration=30,data=new Float32Array(rate*duration);for(let t=.2;t<duration;t+=.5)for(let k=0;k<400;k++)data[Math.floor(t*rate)+k]=Math.sin(k*.4)*(.8-k/500);const buffer={sampleRate:rate,duration,getChannelData:()=>data},short=makeChart(buffer,15),full=makeChart(buffer,30);assert.equal(short.bpm,full.bpm);assert.deepEqual(short.notes.map(n=>[n.time,n.lane]),full.notes.filter(n=>n.time<=13.5).map(n=>[n.time,n.lane]));for(const n of short.notes)assert.ok(Math.abs(((n.time-.2)/.5)-Math.round((n.time-.2)/.5))<.1)});
test('Original chart remains available for comparison',()=>{const data=new Float32Array(8000*12);const result=makeChart({sampleRate:8000,duration:12,getChannelData:()=>data},12,'classic');assert.ok(Array.isArray(result.notes))});

test('Groove has a regular pulse and a repeating eight-note phrase',()=>{const rate=8000,duration=30,data=new Float32Array(rate*duration);data.fill(.1);const chart=makeChart({sampleRate:rate,duration,getChannelData:()=>data},duration);assert.ok(chart.notes.length>10);for(let i=1;i<chart.notes.length;i++){assert.ok(Math.abs(chart.notes[i].time-chart.notes[i-1].time-chart.beat)<1e-8)}for(let i=8;i<chart.notes.length;i++)assert.equal(chart.notes[i].lane,chart.notes[i-8].lane);assert.ok(new Set(chart.notes.map(n=>n.lane)).size===3)});

test('Third chart follows irregular lead attacks with bounded density and valid holds',()=>{
  const rate=8000,duration=18,data=new Float32Array(rate*duration);
  const attacks=[3.1,3.55,4.2,4.58,5.05,5.72,6.12,6.65,7.15,7.55,8.1,8.8,9.2,9.65,10.1,10.7,11.15,11.8,12.2,12.65,13.1,13.65,14.1,14.7,15.2];
  for(let a=0;a<attacks.length;a++){const start=Math.floor(attacks[a]*rate),hz=[180,240,320][a%3];for(let j=0;j<rate*.27;j++)data[start+j]=.35*Math.sin(2*Math.PI*hz*j/rate)*Math.min(1,j/80)*Math.exp(-j/(rate*.12))}
  const buffer={sampleRate:rate,duration,getChannelData:()=>data},chart=makeChart(buffer,duration,'vocal');
  assert.equal(chart.mode,'vocal');assert.ok(chart.notes.length>10);assert.deepEqual(chart,makeChart(buffer,duration,'vocal'));
  const last=[-10,-10,-10];
  chart.notes.forEach((n,i)=>{assert.ok(n.time>=3&&n.end<=duration-1.5);assert.ok(['voice','melody'].includes(n.part));assert.ok(n.time-last[n.lane]>=.65);last[n.lane]=n.time;if(i)assert.ok(n.time-chart.notes[i-1].end>=.12);assert.ok(chart.notes.filter(other=>other.time<=n.time&&n.time-other.time<4).length<=9)});
  const gaps=chart.notes.slice(1).map((n,i)=>Math.round((n.time-chart.notes[i].time)*100));assert.ok(new Set(gaps).size>2);
});
test('Third chart emits no vocal or melody notes in silence',()=>{const data=new Float32Array(8000*10);assert.equal(makeChart({sampleRate:8000,duration:10,getChannelData:()=>data},10,'vocal').notes.length,0)});
