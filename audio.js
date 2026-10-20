// Keep music on the native media playback path in mobile WebViews.
// play() must be called synchronously from the user's click, before any await.
export class MusicPlayer {
  constructor(media) {
    this.media=media;
    media.preload='auto';media.volume=1;media.muted=false;
    media.setAttribute('playsinline','');media.setAttribute('webkit-playsinline','');
  }
  setSource(url){this.media.src=url;this.media.load()}
  get currentTime(){return this.media.currentTime||0}
  play(){
    try{if(typeof navigator!=='undefined'&&navigator.audioSession)navigator.audioSession.type='playback'}catch{}
    this.media.muted=false;this.media.volume=1;
    return this.media.play();
  }
  pause(){this.media.pause()}
  stop(){this.pause();this.media.currentTime=0}
}
