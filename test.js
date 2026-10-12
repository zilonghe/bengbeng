const BB=require('./game.js');
let worst=99;
for(let run=0;run<20;run++){
 const g=BB.create(390,800,20); let frames=0;
 while(g.state!=='over'&&g.day<16&&frames<60*60*30){
  // 简单AI：机器人在战车上方徘徊
  if(g.bot.path.length===0) g.bot.path.push({x:100+Math.random()*190,y:g.rv.y-80-Math.random()*250});
  BB.update(g,1/60); frames++;
  if(g.state==='cards'){ BB.pick(g,g.offers[(Math.random()*g.offers.length)|0].id); }
  if(g.state==='transition') BB.nextDay(g);
  g.events.length=0;
  for(const e of g.enemies) if(!isFinite(e.x+e.y+e.hp)) throw 'NaN enemy';
  if(!isFinite(g.rv.hp)) throw 'NaN hp';
 }
 console.log('run',run,'day',g.day,'lvl',g.level,'kills',g.kills,'state',g.state, JSON.stringify(g.lv));
}
