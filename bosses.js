export const BOSSES = [
  {id:'anna',name:'Анна, Царица холодных баров',title:'Анна, Царица<br>холодных баров',location:'Иритилл Опустошённых Сердец',track:'ANNA ASTI · По барам',source:'Music/Anna_Asti_-_Po_baram.mp3',audio:'Music/anna-playback.m4a',chart:'charts.json',duration:237.864,soul:'вы получили душу царицы холодных баров',battle:'assets/battle/anna-background.png'},
  {id:'egor',name:'Егор, последний холостяк Лотрика',title:'Егор, последний<br>холостяк Лотрика',location:'Замок Несостоявшихся Свадеб',track:'ЕГОР КРИД · Невеста',source:'Music/Egor_Krid_-_Nevesta_47835003.mp3',audio:'Music/egor-playback.m4a',chart:'charts-egor.json',duration:206.3412244898,soul:'вы получили душу последнего холостяка Лотрика',battle:'assets/battle/egor-background.png'}
];
export function preparationKey(boss,length,mode){return `${boss.id}:${length}:${mode}`}
export function outcome(mode,boss,{score,hits,total,combo}){
  return {victory:mode==='win',boss,score:score.toLocaleString('ru-RU'),accuracy:`${total?Math.floor(hits/total*100):0}%`,combo:String(combo)};
}
