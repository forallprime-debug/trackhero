export const ABILITIES = Object.freeze([
  {id:'shield',name:'Щит',attack:'Тайная магия',color:'#a965e1',effectColor:'#d4a1ff',action:'БЛОК',key:'C'},
  {id:'flame',name:'Пламя',attack:'Синий лёд',color:'#70b9ef',effectColor:'#ffb34f',action:'ЛЁД РАСТОПЛЕН',key:'B'},
  {id:'sword',name:'Меч',attack:'Зелёная магия',color:'#42c896',effectColor:'#d6ff89',action:'ОТРАЖЕНО',key:'M'}
]);
export const ATLAS_URL='assets/battle/combat-kit-v2.png';
export function drawMagicCard(ctx,atlas,lane,x,y,side){
  if(!atlas.complete||!atlas.naturalWidth)return false;
  const cellW=atlas.naturalWidth/3,cellH=atlas.naturalHeight/2;
  ctx.save();ctx.beginPath();ctx.rect(x-side/2,y-side/2,side,side);ctx.clip();
  ctx.drawImage(atlas,lane*cellW,0,cellW,cellH,x-side/2,y-side/2,side,side);ctx.restore();return true;
}
export function cardHTML(lane,kind='ability',extra=''){
  const ability=ABILITIES[lane];
  return `<span class="combat-card ${kind}-card lane-${lane} ${extra}" aria-hidden="true"></span>`;
}
