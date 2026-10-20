import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {preparedChart} from '../rhythm.js';
const bundle=JSON.parse(fs.readFileSync(new URL('../charts.json',import.meta.url)));
test('Prebuilt charts match the actual source recording and include all modes',()=>{
  const hash=crypto.createHash('sha256').update(fs.readFileSync(new URL('../Music/Anna_Asti_-_Po_baram.mp3',import.meta.url))).digest('hex');assert.equal(bundle.sourceSha256,hash);
  for(const mode of ['classic','pulse','vocal']){const chart=preparedChart(bundle,90,mode);assert.ok(chart.notes.length>20);for(const n of chart.notes){assert.ok(n.time>=3&&n.time<=88.5&&n.end<=89.85);assert.ok(Number.isFinite(n.time)&&n.end>=n.time&&n.lane>=0&&n.lane<=2)}}
});
test('Repeated fights get fresh note states without runtime audio analysis',()=>{const first=preparedChart(bundle,90,'vocal');first.notes[0].state='hit';assert.equal(preparedChart(bundle,90,'vocal').notes[0].state,'pending');assert.equal(bundle.modes.vocal.notes[0].state,undefined)});
test('Unknown or missing prebuilt charts fail explicitly',()=>{assert.throws(()=>preparedChart(bundle,90,'missing'),/недоступна/);assert.throws(()=>preparedChart({},90,'vocal'),/недоступна/)});
