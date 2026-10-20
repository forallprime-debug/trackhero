import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicPlayer} from '../audio.js';
function fakeMedia(){return {currentTime:12,muted:true,volume:0,setAttribute(){},load(){this.loaded=true},pause(){this.paused=true},play(){this.called=true;return Promise.resolve()}}}
test('Native play is requested immediately inside the gesture, with sound enabled',async()=>{const media=fakeMedia(),player=new MusicPlayer(media);const promise=player.play();assert.equal(media.called,true);assert.equal(media.muted,false);assert.equal(media.volume,1);await promise});
test('Pause preserves the music clock and stop resets it for a new attempt',()=>{const media=fakeMedia(),player=new MusicPlayer(media);player.pause();assert.equal(player.currentTime,12);player.stop();assert.equal(player.currentTime,0);assert.equal(media.paused,true)});
test('Playback rejection reaches the UI instead of silently starting a battle',async()=>{const media=fakeMedia();media.play=()=>Promise.reject(new DOMException('Blocked','NotAllowedError'));const player=new MusicPlayer(media);await assert.rejects(player.play(),{name:'NotAllowedError'})});
