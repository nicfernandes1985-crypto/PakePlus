/* guard-module.js
 * EXPORTA: GuardModule
 * DEPENDE DE: AIMap, rng, RM, OBJ, P, T, keys, say, beep, addItem, floorOfBand, FLOOR_ORDER, combatActive, combatTrans, fleeGrace, openCombat (todos em tempo de chamada)
 * NÃO PODE ALTERAR: Script clássico (sem import/export): declarações top-level viram escopo global de script, compartilhado entre os arquivos. COUNT/CONE/RANGE nem a ordem de consumo de Math.random()/rng() em mk() e materialize()
 */
/* ---------- GuardModule (v1.4.3): Guardas Corruptos com ID único ---------- */
const GuardModule=(()=>{
 const COUNT=15,CONE=Math.PI*.3,RANGE=8,CROUCH_RANGE=5; // cone de ~108°; fora dele é o ponto cego
 let list=[],pending=null,heat=new Float32Array(256),sprites=[],clock=0,msgAt=-99,btn=null;
 const walk=(x,y)=>AIMap.walkable(x,y);
 const hix=(x,y)=>Math.min(15,Math.max(0,x/8|0))+Math.min(15,Math.max(0,y/14|0))*16;
 const angDiff=(a,b)=>{const d=a-b;return Math.atan2(Math.sin(d),Math.cos(d))};
 const allRooms=()=>[].concat(...RM).filter(r=>r&&r.w>=3&&r.h>=3);
 const floorAt=y=>floorOfBand(bandAt(Math.floor(y)));
 const ring=(x,y)=>{const r=[[0,0],[3,0],[0,3],[-3,0],[0,-3]].map(d=>({x:x+d[0],y:y+d[1]})).filter(q=>walk(q.x,q.y));return r.length?r:[{x,y}]};
 const mk=(n,x,y,patrol)=>({id:'guard_'+String(n).padStart(2,'0'),name:'Corrupned_Guard',x,y,homeX:x,homeY:y,patrol:patrol&&patrol.length?patrol:[{x,y}],patrolIndex:0,state:'patrol',lastSeen:null,seenAt:0,investigate:0,a:Math.random()*6.28,alert:0,step:0,lastAttack:0,alive:true,dead:false,sleeping:false,drowsy:Math.round(Math.random()*40),drowsyRate:.28+Math.random()*.25,sleepSpot:null,sleepT:0,talkCd:Math.random()*15,talkT:0,nextElev:40+Math.random()*80,elevPt:null,elevT:0,rideT:0,rideTo:null,hot:null,hotT:0,basePatrol:null,path:null,pathKey:'',repath:Math.random(),
  equipment:[{name:'Cassetete',type:'weapon',damage:14,desc:'Cassetete de madeira usado pelo guarda.'}],inventory:[{name:'Chave do guarda',type:'key',desc:'Uma chave simples presa ao cinto.'}],bodyHP:{head:40,torso:100,leftArm:65,rightArm:65,leftLeg:75,rightLeg:75}});
 function reset(){list=[];pending=null;heat=new Float32Array(256);clock=0}
 function spawnAll(gr,patrol,s){pending={gx:gr.cx+.5,gy:gr.cy+.5,patrol,seed:((+s||1)*31+7)|0}}
 function materialize(){ // roda depois de gen() terminar, quando o mapa e os móveis já existem
  const p=pending;if(!p)return;pending=null;const R=rng(p.seed);
  list=[mk(1,p.gx,p.gy,p.patrol)];
  const rs=allRooms().filter(r=>Math.hypot(r.cx-P.x,r.cy-P.y)>12).map(r=>[R(),r]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
  for(let n=2;n<=COUNT&&rs.length;n++){const rm=rs[(n-2)%rs.length];let sx=rm.cx+.5,sy=rm.cy+.5;
   for(let t=0;t<24;t++){const x=rm.x+1+Math.floor(R()*Math.max(1,rm.w-2)),y=rm.y+1+Math.floor(R()*Math.max(1,rm.h-2));if(T[y*W+x]===1&&walk(x+.5,y+.5)){sx=x+.5;sy=y+.5;break}}
   const pts=[[1.5,1.5],[rm.w-1.5,1.5],[rm.w-1.5,rm.h-1.5],[1.5,rm.h-1.5]].map(c=>({x:rm.x+c[0],y:rm.y+c[1]})).filter(q=>walk(q.x,q.y));
   list.push(mk(n,sx,sy,pts));}
 }
 function follow(g,tx,ty,sp,dt){ // caminho com cache; repath espaçado para 15 guardas não pesarem
  const key=Math.floor(tx)+','+Math.floor(ty);g.repath-=dt;
  if(!g.path||g.repath<=0||(g.pathKey!==key&&g.state!=='chase')){g.pathKey=key;g.repath=g.state==='chase'?.6:2;g.path=AIMap.lineOfSight(g.x,g.y,tx,ty)?[]:(AIMap.findPath(g.x,g.y,tx,ty)||[])}
  const wp=g.path[0],px=wp?wp.x:tx,py=wp?wp.y:ty,ox=g.x,oy=g.y;
  AIMap.move(g,px,py,sp,.22,dt);
  if(wp&&Math.hypot(g.x-wp.x,g.y-wp.y)<.3)g.path.shift();
  const mx=g.x-ox,my=g.y-oy;if(mx*mx+my*my>1e-7)g.a+=angDiff(Math.atan2(my,mx),g.a)*Math.min(1,dt*8);
  return Math.hypot(g.x-tx,g.y-ty)}
 const sees=(g,rng)=>{const dx=P.x-g.x,dy=P.y-g.y,d=Math.hypot(dx,dy);if(d>rng)return false;if(Math.abs(angDiff(Math.atan2(dy,dx),g.a))>CONE)return false;return AIMap.lineOfSight(g.x,g.y,P.x,P.y)};
 const noiseR=()=>{const mv=keys.w||keys.a||keys.s||keys.d||keys.arrowup||keys.arrowdown||keys.arrowleft||keys.arrowright;if(!mv)return .4;return keys.c?.5:keys.shift?7:3.2};
 const note=(t,d)=>{if(d<9&&clock-msgAt>5){msgAt=clock;say(t,2000)}};
 function setHot(g,x,y,at){g.hot={x,y};g.hotT=70;g.seenAt=at;if(!g.basePatrol)g.basePatrol=g.patrol;g.patrol=ring(x,y);g.patrolIndex=0}
 function pickSleepSpot(g){ // lugar da mesma andar que o player menos frequentou
  const fl=floorAt(g.y);let best=null,bs=1e9;
  for(const r of allRooms()){if(floorAt(r.cy)!==fl)continue;const sc=heat[hix(r.cx,r.cy)]+Math.random()*.5;if(sc>=bs)continue;
   const c=[{x:r.x+1.5,y:r.y+1.5},{x:r.x+r.w-1.5,y:r.y+r.h-1.5},{x:r.cx+.5,y:r.cy+.5}].find(q=>walk(q.x,q.y));if(c){bs=sc;best=c}}
  if(best){g.sleepSpot=best;g.sleepT=70;g.state='sleepy';g.path=null}else g.drowsy=40}
 function startElev(g){
  const el=OBJ.filter(o=>o.t==='elevator');if(el.length<2){g.nextElev=90;return}
  const dist=o=>Math.hypot(o.x+1-g.x,o.y+1.6-g.y);let cur=el[0];for(const o of el)if(dist(o)<dist(cur))cur=o;
  if(dist(cur)>45){g.nextElev=60;return}
  let opts=el.filter(o=>o!==cur&&floorOfBand(o.band)!==floorOfBand(cur.band));if(!opts.length)opts=el.filter(o=>o!==cur);
  const dest=opts[Math.floor(Math.random()*opts.length)];
  g.elevPt={x:cur.x+1,y:cur.y+1.6};g.rideTo={x:dest.x+1,y:dest.y+1.6};
  g.rideT=3+1.4*Math.abs(FLOOR_ORDER.indexOf(floorOfBand(cur.band))-FLOOR_ORDER.indexOf(floorOfBand(dest.band)));
  g.elevT=45;g.state='elevWalk';g.path=null}
 function arrive(g,gd){g.x=g.rideTo.x;g.y=g.rideTo.y;g.rideTo=null;g.state='patrol';g.path=null;g.hot=null;g.basePatrol=null;g.patrol=ring(g.x,g.y);g.patrolIndex=0;g.nextElev=70+Math.random()*90;
  const d=Math.hypot(P.x-g.x,P.y-g.y);if(d<10){beep(880,.3,'sine',.05);note('Ding. Um guarda sai do elevador.',d)}}
 function wake(g,why){g.sleeping=false;g.state='investigate';g.lastSeen={x:P.x,y:P.y};g.seenAt=clock;g.investigate=6;g.drowsy=35;g.path=null;note(why==='noise'?'O barulho acordou um guarda!':'O guarda acordou.',Math.hypot(P.x-g.x,P.y-g.y))}
 function talk(g,h){
  g.state=h.state='talk';g.talkT=h.talkT=2.6;g.talkCd=h.talkCd=25;
  g.a=Math.atan2(h.y-g.y,h.x-g.x);h.a=g.a+Math.PI;
  const src=(g.seenAt||0)>=(h.seenAt||0)?g:h;
  if(src.hot||src.seenAt){const at=src.seenAt||clock,pt=src.hot||src.lastSeen;if(pt){setHot(g,pt.x,pt.y,at);setHot(h,pt.x,pt.y,at)}note('Os guardas sussurram sobre onde viram Karl.',Math.hypot(P.x-g.x,P.y-g.y))}
  else note('Dois guardas trocam algumas palavras.',Math.hypot(P.x-g.x,P.y-g.y))}
 function update(dt){
  materialize();if(!P||combatActive||combatTrans)return false;
  clock+=dt;heat[hix(P.x,P.y)]+=dt;
  if(!btn)btn=document.querySelector('[data-key="c"]');if(btn)btn.classList.toggle('pressed',!!keys.c);
  const nr=noiseR(),rng=keys.c?CROUCH_RANGE:RANGE;let fight=null;
  for(let i=0;i<list.length;i++){const g=list[i];if(!g.alive)continue;g.step+=dt;g.talkCd-=dt;
   const gd=Math.hypot(P.x-g.x,P.y-g.y);
   if(g.state==='elevRide'){g.rideT-=dt;if(g.rideT<=0)arrive(g);continue}
   const los=()=>AIMap.lineOfSight(g.x,g.y,P.x,P.y),heard=gd<nr&&(gd<nr*.5||los());
   if(g.state==='sleeping'){ // dormindo: sem visão, só acorda com barulho
    g.drowsy=Math.max(0,g.drowsy-dt*.45);
    if(heard)wake(g,'noise');else if(g.drowsy<=5)wake(g,'rested');
    else if(gd<1.4&&!$('msg').classList.contains('on'))say('[E] Eliminar o guarda adormecido',1200);
    continue}
   const vis=sees(g,rng);
   if(vis){g.state='chase';g.lastSeen={x:P.x,y:P.y};g.seenAt=clock;g.investigate=3;g.alert=1}
   else if(g.state==='chase'){g.state='investigate';g.alert=1;g.path=null}
   else if(heard&&nr>=3&&g.state!=='investigate'){g.state='investigate';g.lastSeen={x:P.x,y:P.y};g.seenAt=clock;g.investigate=4;g.alert=.5;g.path=null}
   if(g.state==='chase'){follow(g,P.x,P.y,1.5,dt);g.drowsy=Math.max(0,g.drowsy-dt*.1)}
   else if(g.state==='investigate'&&g.lastSeen){
    const d=follow(g,g.lastSeen.x,g.lastSeen.y,1.05,dt);g.investigate-=dt;
    if(d<.35)g.a+=dt*1.6; // olha ao redor
    if(g.investigate<=0||(d<.35&&g.investigate<2)){g.state='patrol';g.alert=0;setHot(g,g.lastSeen.x,g.lastSeen.y,g.seenAt||clock);g.lastSeen=null;g.path=null}}
   else if(g.state==='talk'){g.talkT-=dt;if(g.talkT<=0){g.state='patrol';g.path=null}}
   else if(g.state==='sleepy'){
    g.sleepT-=dt;const d=g.sleepSpot?follow(g,g.sleepSpot.x,g.sleepSpot.y,.6,dt):0;
    if(d<.45||g.sleepT<=0){g.state='sleeping';g.sleeping=true;g.drowsy=100;g.path=null}}
   else if(g.state==='elevWalk'){
    g.elevT-=dt;const d=follow(g,g.elevPt.x,g.elevPt.y,.7,dt);
    if(d<.7){g.state='elevRide';g.path=null}else if(g.elevT<=0){g.state='patrol';g.nextElev=60;g.path=null}}
   else{ // patrulha
    g.state='patrol';g.alert=0;g.drowsy=Math.min(100,g.drowsy+dt*g.drowsyRate);g.nextElev-=dt;
    if(g.hotT>0){g.hotT-=dt;if(g.hotT<=0){g.hot=null;if(g.basePatrol){g.patrol=g.basePatrol;g.basePatrol=null;g.patrolIndex=0}}}
    if(g.drowsy>=70&&!g.hot)pickSleepSpot(g);
    else if(g.nextElev<=0&&!g.hot)startElev(g);
    else{const wp=g.patrol[g.patrolIndex]||{x:g.homeX,y:g.homeY};
     if(follow(g,wp.x,wp.y,g.hot?.7:.48,dt)<.35)g.patrolIndex=(g.patrolIndex+1)%g.patrol.length;
     if(g.talkCd<=0)for(let j=i+1;j<list.length;j++){const h=list[j];if(h.alive&&h.state==='patrol'&&h.talkCd<=0&&Math.hypot(h.x-g.x,h.y-g.y)<2.2){talk(g,h);break}}}}
   if(!fight&&gd<.62&&vis)fight=g}
  if(fight&&performance.now()>=fleeGrace){guard=fight;openCombat();return true}
  return false}
 function stealthKill(){
  let best=null,bd=1.3;for(const g of list)if(g.alive&&g.sleeping){const d=Math.hypot(g.x-P.x,g.y-P.y);if(d<bd){bd=d;best=g}}
  if(!best)return false;
  best.alive=false;best.dead=true;best.sleeping=false;best.state='dead';best.deadAt={x:best.x,y:best.y};
  for(const it of [...best.inventory,...best.equipment])addItem({...it,count:1});
  best.inventory=[];best.equipment=[];best.looted=true;
  beep(140,.3,'sawtooth',.08,60);say('Você eliminou '+best.id+' em silêncio e revistou o corpo.',3200);return true}
 function sync(){
  while(sprites.length<list.length){const s=makeBillboard('guard',.9,1.58);scene3D.add(s);sprites.push(s)}
  sprites.forEach((s,i)=>{const g=list[i];if(!g||(!g.alive&&!g.dead)||g.state==='elevRide'){s.visible=false;return}
   const down=g.dead||g.sleeping;s.visible=true;s.position.set(g.deadAt?.x??g.x,.015,g.deadAt?.y??g.y);
   s.rotation.z=down?.95:0;s.scale.set(down?1.08:1,down?.58:1,1);s.material.color.setHex(g.sleeping?0x7f8fa6:g.state==='chase'?0xffb0a0:0xffffff)})}
 function serialize(){materialize();return {list:JSON.parse(JSON.stringify(list)),heat:Array.from(heat)}}
 function restore(d){pending=null;const gs=d.guards;
  if(gs&&gs.list){list=gs.list.map((g,i)=>Object.assign(mk(i+1,g.x,g.y,g.patrol),g));heat=Float32Array.from(gs.heat||[]);if(heat.length!==256)heat=new Float32Array(256)}
  else if(d.guard){list=[Object.assign(mk(1,d.guard.x,d.guard.y,d.guard.patrol),d.guard,{id:'guard_01'})];heat=new Float32Array(256)}else list=[]}
 return Object.freeze({reset,spawnAll,update,stealthKill,sync,serialize,restore,all:()=>list,get:id=>list.find(g=>g.id===id)})
})();
