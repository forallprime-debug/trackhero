import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicPlayer} from '../audio.js';
function fakeMedia(){return {currentTime:12,muted:true,volume:0,setAttribute(){},load(){this.loaded=true},pause(){this.paused=true},play(){this.called=true;return Promise.resolve()}}}
test('Native play is requested immediately inside the gesture, with sound enabled',async()=>{const media=fakeMedia(),player=new MusicPlayer(media);const promise=player.play();assert.equal(media.called,true);assert.equal(media.muted,false);assert.equal(media.volume,1);await promise});
test('Pause preserves the music clock and stop resets it for a new attempt',()=>{const media=fakeMedia(),player=new MusicPlayer(media);player.pause();assert.equal(player.currentTime,12);player.stop();assert.equal(player.currentTime,0);assert.equal(media.paused,true)});
test('Playback rejection reaches the UI instead of silently starting a battle',async()=>{const media=fakeMedia();media.play=()=>Promise.reject(new DOMException('Blocked','NotAllowedError'));const player=new MusicPlayer(media);await assert.rejects(player.play(),{name:'NotAllowedError'})});

import {downloadAsset} from '../audio.js';
test('Download reports byte progress and returns the original data',async()=>{
  const progress=[];const bytes=await downloadAsset('track',{onProgress:(n,total)=>progress.push([n,total]),fetcher:async()=>new Response(new Uint8Array([1,2,3]),{headers:{'Content-Length':'3'}})});
  assert.deepEqual([...new Uint8Array(bytes)],[1,2,3]);assert.deepEqual(progress.at(-1),[3,3]);
});
test('Stalled downloads abort and give a retry message',async()=>{
  await assert.rejects(downloadAsset('track',{timeoutMs:10,fetcher:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))}),/Проверь интернет/);
});
test('Failed HTTP responses do not silently keep preparation waiting',async()=>{await assert.rejects(downloadAsset('track',{fetcher:async()=>new Response('',{status:404})}),/404/)});

import {AssetCache,playbackAsset} from '../audio.js';
import {BOSSES} from '../bosses.js';
test('Returning to a downloaded boss reuses audio and chart bytes',async()=>{
 const calls=[];const cache=new AssetCache({loader:async url=>{calls.push(url);return new Uint8Array([calls.length]).buffer}});
 const first=await cache.get('anna');await cache.get('egor');assert.equal(await cache.get('anna'),first);
 assert.deepEqual(calls,['anna','egor']);
});
test('Cache evicts least recently used files and stays within its memory limit',async()=>{
 const calls=[];const cache=new AssetCache({maxBytes:4,loader:async url=>{calls.push(url);return new ArrayBuffer(2)}});
 await cache.get('anna');await cache.get('egor');await cache.get('anna');await cache.get('mia');await cache.get('egor');
 assert.deepEqual(calls,['anna','egor','mia','egor']);assert.equal(cache.bytes,4);
});
test('Failed and cancelled downloads can be retried and never enter the cache',async()=>{
 let attempts=0;
 const cache=new AssetCache({loader:async()=>{if(++attempts===1)throw new Error('offline');return new ArrayBuffer(2)}});
 await assert.rejects(cache.get('anna'),/offline/);await cache.get('anna');assert.equal(attempts,2);
 const controller=new AbortController();controller.abort();
 await assert.rejects(cache.get('anna',{signal:controller.signal}),{name:'AbortError'});
 const mid=new AbortController();
 const cancelled=new AssetCache({loader:async()=>{mid.abort();return new ArrayBuffer(2)}});
 await assert.rejects(cancelled.get('anna',{signal:mid.signal}),{name:'AbortError'});assert.equal(cancelled.bytes,0);
});
test('90-second and full battles select separate audio without changing the MP3 fallback',()=>{
 for(const boss of BOSSES){
  const short=playbackAsset(boss,'90',true),full=playbackAsset(boss,'full',true);
  assert.equal(short.url,`Music/${boss.id}-90.m4a`);assert.equal(full.url,boss.audio);assert.notEqual(short.url,full.url);
  assert.equal(playbackAsset(boss,'90',false).url,boss.source);
 }
});
