// One-time analysis: node tools/build-charts.mjs <mono-float32-pcm> <sample-rate>
// PCM comes from the original recording; never runs on the player's phone.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeChart} from '../rhythm.js';
const bytes=fs.readFileSync(process.argv[2]),rate=Number(process.argv[3]);
if(!rate||bytes.length%4)throw new Error('Expected Float32 mono PCM and sample rate');
const samples=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
const buffer={sampleRate:rate,duration:samples.length/rate,getChannelData:()=>samples};
const charts={version:1,duration:buffer.duration,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../Music/Anna_Asti_-_Po_baram.mp3',import.meta.url))).digest('hex'),modes:{}};
for(const mode of ['classic','pulse','vocal']){
  const chart=makeChart(buffer,buffer.duration,mode);
  charts.modes[mode]={bpm:chart.bpm,beat:chart.beat??60/chart.bpm,phase:chart.phase??0,notes:chart.notes.map(n=>({time:+n.time.toFixed(4),lane:n.lane,duration:+n.duration.toFixed(4),end:+n.end.toFixed(4),...(n.part?{part:n.part}:{})}))};
  console.log(mode,charts.modes[mode].notes.length,'notes',chart.bpm,'BPM');
}
fs.writeFileSync(new URL('../charts.json',import.meta.url),JSON.stringify(charts));
