// Pure timing/scoring functions shared by the game and its checks.
export const WINDOW = .30;
export const PERFECT_WINDOW = .09;
export const GOOD_WINDOW = .18;
export function judge(delta) { return Math.abs(delta) <= PERFECT_WINDOW ? 'perfect' : Math.abs(delta) <= GOOD_WINDOW ? 'good' : Math.abs(delta) <= WINDOW ? 'ok' : null; }
export function nearest(notes, lane, time) {
  let best = null, distance = WINDOW + 1e-9;
  for (const note of notes) { const d = Math.abs(note.time - time); if (note.lane === lane && note.state === 'pending' && d <= distance) { best = note; distance = d; } }
  return best;
}
export function multiplier(combo) { return Math.min(4, 1 + Math.floor(combo / 10)); }
export function makeLegacyChart(buffer, duration) {
  // Positive energy changes identify attacks in the actual recording. All analysis stays local.
  const data = buffer.getChannelData(0), rate = buffer.sampleRate, hop = Math.round(rate * .01);
  const frames = Math.floor(Math.min(duration, buffer.duration) * rate / hop), energy = new Float32Array(frames), flux = new Float32Array(frames);
  for (let i = 0; i < frames; i++) { let sum = 0; for (let j = 0; j < hop; j += 4) { const x = data[i * hop + j] || 0; sum += x * x; } energy[i] = Math.sqrt(sum / (hop / 4)); }
  for (let i = 2; i < frames; i++) flux[i] = Math.max(0, energy[i] - (energy[i-1] + energy[i-2]) / 2);
  let period = 50, best = -1;
  for (let lag = 38; lag <= 75; lag++) { let sum = 0; for (let i = lag; i < frames; i++) sum += flux[i] * flux[i-lag]; if (sum > best) { best = sum; period = lag; } }
  const beat = period * hop / rate;
  let phase = 0; best = -1;
  for (let p = 0; p < period; p++) { let sum = 0; for (let i = p; i < frames; i += period) sum += flux[i]; if (sum > best) { best = sum; phase = p * hop / rate; } }
  const notes = []; let previousLane = -1;
  for (let t = phase, k = 0; t < duration - 1.5; t += beat, k++) {
    if (t < 3) continue;
    // Snap to a nearby onset, keeping a playable minimum spacing.
    const center = Math.round(t * rate / hop); let peak = center, strength = -1;
    for (let j = Math.max(1, center-7); j <= Math.min(frames-1, center+7); j++) if (flux[j] > strength) { strength = flux[j]; peak = j; }
    const time = peak * hop / rate;
    if (energy[peak] < .008 || (notes.length && time - notes.at(-1).time < .3)) continue;
    let lane = [0,2,1,0,1,2,0,2][k % 8];
    if (lane === previousLane) lane = (lane+1)%3;
    const hold = k % 12 === 7 && t + beat * 1.4 < duration - 1.5;
    if (notes.length && notes.at(-1).end > time - .12) continue;
    notes.push({time, lane, duration:hold ? beat*1.4 : 0, end:time+(hold ? beat*1.4 : 0), state:'pending'}); previousLane = lane;
  }
  return {notes, bpm: Math.round(60 / beat)};
}

export const VICTORY_RATE = .85;
export function hasWon(hits, total) { return total > 0 && hits >= Math.ceil(total * VICTORY_RATE); }

// V2: follow percussive onsets in three frequency bands, rather than rotating lanes.
export function makeChart(buffer, duration, mode='pulse') {
  if(mode==='classic')return makeLegacyChart(buffer,duration);
  const source=buffer.getChannelData(0), other=buffer.numberOfChannels>1?buffer.getChannelData(1):source;
  const stride=Math.max(1,Math.floor(buffer.sampleRate/11025)),rate=buffer.sampleRate/stride,hop=Math.round(rate*.01),step=hop/rate;
  // Analyze the entire song so short/full modes share the same tempo and opening.
  const frames=Math.floor(Math.min(buffer.duration,source.length/buffer.sampleRate)/step);
  const bands=Array.from({length:3},()=>new Float32Array(frames)),energy=new Float32Array(frames);
  const aLow=1-Math.exp(-2*Math.PI*180/rate),aMid=1-Math.exp(-2*Math.PI*Math.min(1800,rate*.35)/rate);
  let low=0,mid=0;
  for(let f=0;f<frames;f++){
    const sums=[0,0,0];let full=0;
    for(let j=0;j<hop;j++){
      const i=(f*hop+j)*stride,x=((source[i]||0)+(other[i]||0))*.5;
      low+=aLow*(x-low);mid+=aMid*(x-mid);
      const values=[low,mid-low,x-mid];
      for(let b=0;b<3;b++)sums[b]+=values[b]*values[b];full+=x*x;
    }
    energy[f]=Math.sqrt(full/hop);
    for(let b=0;b<3;b++)bands[b][f]=Math.log1p(100*Math.sqrt(sums[b]/hop));
  }
  const flux=bands.map(band=>{
    const out=new Float32Array(frames);let baseline=0;
    for(let f=0;f<frames;f++){out[f]=Math.max(0,band[f]-baseline);baseline+=.35*(band[f]-baseline)}
    const sorted=Array.from(out).sort((a,b)=>a-b),scale=sorted[Math.floor(sorted.length*.95)]||1;
    return out.map(v=>Math.min(4,v/scale));
  });
  const pulse=new Float32Array(frames);
  for(let f=0;f<frames;f++)pulse[f]=flux[0][f]*.5+flux[1][f]*.3+flux[2][f]*.2;
  // Normalized autocorrelation keeps sustained loud passages from dominating tempo.
  const firstLag=Math.round(.4/step),lastLag=Math.round(.8/step),correlations=[];
  let bestLag=firstLag,bestScore=-1;
  for(let lag=firstLag;lag<=lastLag;lag++){
    let cross=0,left=0,right=0;
    for(let f=lag;f<frames;f++){cross+=pulse[f]*pulse[f-lag];left+=pulse[f]*pulse[f];right+=pulse[f-lag]*pulse[f-lag]}
    const score=cross/(Math.sqrt(left*right)||1);correlations[lag]=score;
    if(score>bestScore){bestScore=score;bestLag=lag}
  }
  const before=correlations[bestLag-1]??bestScore,after=correlations[bestLag+1]??bestScore,denom=before-2*bestScore+after;
  const refinement=denom?Math.max(-.5,Math.min(.5,.5*(before-after)/denom)):0;
  const beat=(bestLag+refinement)*step;
  let phase=0,bestPhase=-1;
  for(let p=0;p<beat;p+=step){let sum=0;for(let t=p;t<buffer.duration;t+=beat)sum+=pulse[Math.round(t/step)]||0;if(sum>bestPhase){bestPhase=sum;phase=p}}
  if(mode==='vocal')return makeLeadChart(buffer,duration,bands,flux,energy,step,beat,phase);
  const notes=[],limit=Math.min(duration,buffer.duration);
  // A steady playable pulse: fast recordings use every other beat, never random skips.
  const playBeat=beat*(beat<.6?2:1);
  for(let k=0,time=phase;time<limit-1.5;k++,time=phase+k*playBeat){
    if(time<3)continue;
    const center=Math.round(time/step),radius=Math.round(.06/step);let audible=false;
    for(let f=Math.max(0,center-radius);f<Math.min(frames,center+radius+1);f++)if(energy[f]>.012){audible=true;break}
    if(!audible)continue;
    // Repeatable call-and-response: shield / sword, with a flame phrase ending.
    const lane=k%8===7?1:k%2===0?0:2;
    notes.push({time,lane,duration:0,end:time,state:'pending'});
  }
  // Holds only on sustained midrange phrases with room before the next attack.
  for(let i=0;i<notes.length-1;i++){
    const n=notes[i],gap=notes[i+1].time-n.time;
    if(n.lane!==1||gap<Math.max(1,beat*1.75))continue;
    const start=Math.round((n.time+.15)/step),end=Math.min(frames-1,Math.round((n.time+gap*.7)/step));
    let min=Infinity,max=0;for(let f=start;f<=end;f++){min=Math.min(min,energy[f]);max=Math.max(max,energy[f])}
    if(min>.02&&min>max*.45){n.duration=Math.min(beat*1.5,gap-.2);n.end=n.time+n.duration}
  }
  return {notes,bpm:Math.round(60/beat),beat:playBeat,phase,mode:'pulse'};
}

// Experimental lead-line chart. Periodicity and midrange energy are heuristics;
// they do not isolate the singer from the mixed recording.
function makeLeadChart(buffer,duration,bands,flux,energy,step,beat,phase){
  const data=buffer.getChannelData(0),right=buffer.numberOfChannels>1?buffer.getChannelData(1):data;
  const stride=Math.max(1,Math.floor(buffer.sampleRate/6000)),rate=buffer.sampleRate/stride;
  const frames=energy.length,pitches=new Float32Array(frames),confidence=new Float32Array(frames),voice=new Uint8Array(frames);
  const window=new Float32Array(320),minLag=Math.floor(rate/500),maxLag=Math.min(100,Math.ceil(rate/90));
  for(let f=0;f<frames;f+=4){
    if(energy[f]<.012)continue;
    const center=Math.round(f*step*buffer.sampleRate);
    for(let j=0;j<window.length;j++){
      const i=center+(j-window.length/2)*stride;
      const x=((data[i]||0)+(right[i]||0))*.5,prev=((data[i-stride]||0)+(right[i-stride]||0))*.5;
      window[j]=(x-.65*prev)*(.5-.5*Math.cos(2*Math.PI*j/(window.length-1)));
    }
    let best=0,lagAt=0;
    for(let lag=minLag;lag<=maxLag;lag++){
      let cross=0,a=0,b=0;
      for(let j=0;j<window.length-lag;j++){const x=window[j],y=window[j+lag];cross+=x*y;a+=x*x;b+=y*y}
      const score=cross/(Math.sqrt(a*b)||1);
      if(score>best){best=score;lagAt=lag}
    }
    for(let j=f;j<Math.min(frames,f+4);j++){confidence[j]=best;if(best>.55)pitches[j]=rate/lagAt}
  }
  // Classify whole one-second sections, avoiding voice/melody toggles per syllable.
  const section=Math.max(1,Math.round(1/step));
  for(let start=0;start<frames;start+=section){let count=0,active=0;
    for(let f=start;f<Math.min(frames,start+section);f++){
      if(energy[f]<.012)continue;active++;
      const low=Math.expm1(bands[0][f]),mid=Math.expm1(bands[1][f]),high=Math.expm1(bands[2][f]);
      if(confidence[f]>.6&&mid>low*.6&&mid>high*.85)count++;
    }
    if(active&&count/active>.4)voice.fill(1,start,Math.min(frames,start+section));
  }
  const sorted=Array.from(pitches).filter(p=>p>0).sort((a,b)=>a-b),lower=sorted[Math.floor(sorted.length*.33)]||160,upper=sorted[Math.floor(sorted.length*.67)]||300;
  const novelty=new Float32Array(frames);
  for(let f=1;f<frames;f++){
    // Vocal syllables emphasize midrange attacks; instrumental sections use a broader lead envelope.
    novelty[f]=voice[f]?Math.max(0,flux[1][f]*.9+flux[2][f]*.2-flux[0][f]*.15):flux[1][f]*.55+flux[2][f]*.3+flux[0][f]*.15;
  }
  const notes=[],limit=Math.min(duration,buffer.duration),lastLaneTime=[-10,-10,-10];
  for(let f=1;f<frames-1;f++){
    const time=f*step;
    if(time<3||time>limit-1.5||energy[f]<.012)continue;
    if(novelty[f]<novelty[f-1]||novelty[f]<=novelty[f+1])continue;
    let sum=0,squares=0,count=0;
    for(let j=Math.max(0,f-50);j<Math.min(frames,f+50);j++){sum+=novelty[j];squares+=novelty[j]*novelty[j];count++}
    const mean=sum/count,std=Math.sqrt(Math.max(0,squares/count-mean*mean));
    if(novelty[f]<Math.max(.2,mean+std*(voice[f]?.4:.65)))continue;
    if(notes.length&&time-notes.at(-1).time<.32)continue;
    let pitch=pitches[f],lane=pitch?(pitch<lower?0:pitch>upper?2:1):(flux[1][f]>flux[2][f]?1:2);
    if(time-lastLaneTime[lane]<.65){
      // Preserve a distinct syllable but route close repeats as a small playable turn.
      const direction=notes.length&&pitch>(notes.at(-1).pitch||pitch)?1:-1;
      const alternatives=[(lane+direction+3)%3,(lane-direction+3)%3];
      lane=alternatives.find(l=>time-lastLaneTime[l]>=.65);
      if(lane===undefined)continue;
    }
    if(notes.filter(n=>time-n.time<4).length>=9)continue;
    notes.push({time,lane,duration:0,end:time,state:'pending',part:voice[f]?'voice':'melody',pitch});lastLaneTime[lane]=time;
  }
  // Sustained voiced/melodic notes become holds only if the pitch stays stable.
  for(let i=0;i<notes.length;i++){
    const n=notes[i],next=notes[i+1]?.time??limit-1.5,gap=next-n.time;
    if(!n.pitch||gap<.9)continue;
    const end=Math.min(n.time+.8,next-.18);let stable=0,count=0;
    for(let f=Math.round((n.time+.12)/step);f<Math.min(frames,Math.floor(end/step));f++){
      count++;if(pitches[f]>0&&confidence[f]>.6&&Math.abs(12*Math.log2(pitches[f]/n.pitch))<1.5)stable++;
    }
    if(count&&stable/count>.7){n.duration=end-n.time;n.end=end}
  }
  return {notes,bpm:Math.round(60/beat),beat,phase,mode:'vocal'};
}

// Runtime uses the precomputed score, without decoding/analyzing music on a phone.
export function preparedChart(bundle,duration,mode){
  const chart=bundle?.modes?.[mode];
  if(!chart||!Array.isArray(chart.notes)||!(bundle.duration>0))throw new Error('Карта трека недоступна. Обнови мини-приложение.');
  const limit=Math.min(duration,bundle.duration);
  return {...chart,notes:chart.notes.filter(n=>n.time>=3&&n.time<=limit-1.5&&n.end<=limit-.15).map(n=>({...n,state:'pending'}))};
}
