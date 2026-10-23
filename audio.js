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

export async function downloadAsset(url,{onProgress=()=>{},timeoutMs=60000,signal,fetcher=fetch}={}){
  const controller=new AbortController();let timedOut=false;
  const abort=()=>controller.abort();
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs);
  try{
    const response=await fetcher(url,{signal:controller.signal});
    if(!response.ok)throw new Error(`Файл не загружен (${response.status}). Попробуй ещё раз.`);
    const total=Number(response.headers.get('Content-Length'))||0;
    if(!response.body?.getReader){const bytes=await response.arrayBuffer();onProgress(bytes.byteLength,total||bytes.byteLength);return bytes}
    const reader=response.body.getReader(),parts=[];let received=0;
    while(true){const {done,value}=await reader.read();if(done)break;parts.push(value);received+=value.byteLength;onProgress(received,total)}
    const bytes=new Uint8Array(received);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
    return bytes.buffer;
  }catch(e){if(timedOut)throw new Error('Загрузка заняла слишком долго. Проверь интернет и нажми «Подготовить бой» ещё раз.');throw e}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}

// Completed downloads survive boss changes. Bound memory use on mobile WebViews.
export class AssetCache {
  constructor({maxBytes=32*1024*1024,loader=downloadAsset}={}){
    this.maxBytes=maxBytes;this.loader=loader;this.entries=new Map();this.bytes=0;
  }
  async get(url,options={}){
    if(options.signal?.aborted)throw new DOMException('Cancelled','AbortError');
    if(this.entries.has(url)){
      const bytes=this.entries.get(url);this.entries.delete(url);this.entries.set(url,bytes);
      options.onProgress?.(bytes.byteLength,bytes.byteLength);return bytes;
    }
    const bytes=await this.loader(url,options);
    if(options.signal?.aborted)throw new DOMException('Cancelled','AbortError');
    if(bytes.byteLength<=this.maxBytes){
      // Another caller may have completed the same URL in the meantime.
      if(this.entries.has(url)){this.bytes-=this.entries.get(url).byteLength;this.entries.delete(url)}
      while(this.bytes+bytes.byteLength>this.maxBytes){
        const oldest=this.entries.keys().next().value;
        this.bytes-=this.entries.get(oldest).byteLength;this.entries.delete(oldest);
      }
      this.entries.set(url,bytes);this.bytes+=bytes.byteLength;
    }
    return bytes;
  }
}

export function playbackAsset(boss,length,canPlayAAC){
  if(canPlayAAC)return {url:length==='full'?boss.audio:boss.shortAudio,type:'audio/mp4'};
  return {url:boss.source,type:'audio/mpeg'};
}
