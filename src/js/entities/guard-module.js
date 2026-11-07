/* guard-module.js
 * EXPORTA: GuardModule (reset, spawnAll, update, stealthKill, sync, serialize, restore, all, get,
 *          cones, noiseStatus, emitNoise, forceToFloor, zones, cfg)
 * DEPENDE DE: AIMap, rng, RM, OBJ, P, T, keys, say, beep, addItem, floorOfBand, bandAt, FLOOR_ORDER, combatActive, combatTrans, fleeGrace,
 *             openCombat, playerLit, AbyssHome (todos em tempo de chamada)
 * NÃO PODE ALTERAR: Script clássico (sem import/export): declarações top-level viram escopo global de script, compartilhado entre os arquivos.
 *   COUNT/RANGE nem a ordem de consumo de Math.random()/rng() em mk(). v1.5.0: materialize() agora só usa salas dos andares 1 e 2.
 */
/* ---------- GuardModule (v1.5.0): Guardas Corruptos com ID único ----------
   MÓDULO 1 · Visão: o guarda é cego no escuro. Só enxerga dentro do cone da PRÓPRIA lanterna. Também enxerga a luz do jogador (lamparina) de longe.
   MÓDULO 2 · Audição: ruído por modo de movimento (agachar < andar < correr), raio limitado, e só no MESMO ANDAR do jogador.
   MÓDULO 3 · IA: nascem só nos andares 1 e 2; têm medo do Abismo (andares negativos) e fogem; relatam corpos; investigam estímulos. */
const GuardModule=(()=>{
 const COUNT=15,RANGE=8,CROUCH_RANGE=5;
 const CFG={
  spawnFloors:['1','2'],                    // MÓDULO 3: nenhum spawn natural nos andares -1, -2, -3 e -4
  flashHalf:Math.PI*.24,                    // lanterna do guarda: cone de ~86° (metade do ângulo)
  lightRange:16,lightHalf:Math.PI*.46,      // luz do jogador: enxergada de longe, mas só dentro do campo de visão frontal (~165°)
  noise:{idle:0,crouch:1.2,walk:5,run:10},  // MÓDULO 2: raio (tiles) que cada modo de movimento alcança
  muffle:.55,                               // sem linha de visão o som chega abafado (raio x0,55)
  bodySight:7,partnerR:9,                   // alcance para ver um corpo / distância de um parceiro que recebe o relato
  zoneR:9,zoneTTL:100,                      // área de alerta (tiles / segundos) criada por um relato de corpo
  fleeSpeed:1.9,
  /* v1.7 LANTERNA DINÂMICA: o guarda só acende a lanterna se estiver no escuro */
  litR:7,        // dentro de 7 tiles da lamparina ACESA do jogador o guarda está iluminado
  lampR:5.5,     // ou a 5,5 tiles de uma luminária de parede
  litRange:5     // sem lanterna (só luz alheia) ele enxerga a 5 tiles; com lanterna, até RANGE
 };
 let list=[],pending=null,heat=new Float32Array(256),sprites=[],clock=0,msgAt=-99,btn=null,zoneList=[],zoneId=0,lastNoise={mode:'idle',radius:0};
 const walk=(x,y)=>AIMap.walkable(x,y);
 const hix=(x,y)=>Math.min(15,Math.max(0,x/8|0))+Math.min(15,Math.max(0,y/14|0))*16;
 const angDiff=(a,b)=>{const d=a-b;return Math.atan2(Math.sin(d),Math.cos(d))};
 const isNeg=f=>!!f&&f[0]==='-';
 const floorAt=y=>floorOfBand(bandAt(Math.floor(y)));
 const pFloor=()=>floorAt(P.y);
 const allRooms=()=>[].concat(...RM).filter(r=>r&&r.w>=3&&r.h>=3&&!r.stair);
 const spawnRooms=()=>allRooms().filter(r=>CFG.spawnFloors.includes(floorAt(r.cy)));
 const ring=(x,y)=>{const r=[[0,0],[3,0],[0,3],[-3,0],[0,-3]].map(d=>({x:x+d[0],y:y+d[1]})).filter(q=>walk(q.x,q.y));return r.length?r:[{x,y}]};
 const bodyPos=b=>b.deadAt||{x:b.x,y:b.y};
 const mk=(n,x,y,patrol)=>({id:'guard_'+String(n).padStart(2,'0'),name:'Corrupted_Guard',x,y,homeX:x,homeY:y,patrol:patrol&&patrol.length?patrol:[{x,y}],patrolIndex:0,state:'patrol',lastSeen:null,seenAt:0,investigate:0,a:Math.random()*6.28,alert:0,step:0,lastAttack:0,alive:true,dead:false,sleeping:false,drowsy:Math.round(Math.random()*40),drowsyRate:.28+Math.random()*.25,sleepSpot:null,sleepT:0,talkCd:Math.random()*15,talkT:0,nextElev:40+Math.random()*80,elevPt:null,elevT:0,rideT:0,rideTo:null,hot:null,hotT:0,basePatrol:null,path:null,pathKey:'',repath:Math.random(),
  light:true,sus:0,stim:null,noiseAt:-99,lightAt:-99,scanT:Math.random()*.4,leave:null,fear:0,fleeExit:false,reported:false,
  equipment:[{name:'Cassetete',type:'weapon',damage:14,desc:'Cassetete de madeira usado pelo guarda.'}],inventory:[{name:'Chave do guarda',type:'key',desc:'Uma chave simples presa ao cinto.'}],bodyHP:{head:40,torso:100,leftArm:65,rightArm:65,leftLeg:75,rightLeg:75}});
 function reset(){list=[];pending=null;heat=new Float32Array(256);clock=0;zoneList=[]}
 function spawnAll(gr,patrol,s){pending={gx:gr.cx+.5,gy:gr.cy+.5,patrol,seed:((+s||1)*31+7)|0}}
 /* v1.7 SPAWN: guardas só nascem em CORREDORES ou SALAS ADMINISTRATIVAS — nunca em quartos de paciente/enfermarias (camas), banheiros ou dormitórios */
 const roomHasBed=r=>OBJ.some(o=>o.t==='bed'&&o.x>=r.x&&o.x<r.x+r.w&&o.y>=r.y&&o.y<r.y+r.h);
 const safeRoom=r=>r.kind!=='patient'&&r.kind!=='ward'&&r.kind!=='npc'&&!r.garden&&!r.bath&&!r.bedroom&&!roomHasBed(r); // v1.7: nem quarto do NPC nem Jardim
 const inAnyRoom=(x,y)=>allRooms().some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
 function corridorCells(fl){const out=[];for(let y=0;y<H;y++){if(floorAt(y)!==fl)continue;for(let x=1;x<W-1;x++){if(T[y*W+x]===1&&!OB[y*W+x]&&walk(x+.5,y+.5)&&!inAnyRoom(x,y))out.push({x:x+.5,y:y+.5})}}return out}
 function materialize(){ // roda depois de gen() terminar, quando o mapa e os móveis já existem
  const p=pending;if(!p)return;pending=null;const R=rng(p.seed);
  const far=q=>Math.hypot(q.x-P.x,q.y-P.y)>12;
  const sh=a=>a.map(v=>[R(),v]).sort((m,n)=>m[0]-n[0]).map(v=>v[1]);
  const spots={};
  for(const f of CFG.spawnFloors){
   const cor=sh(corridorCells(f).filter((_,i)=>i%5===0)),rooms=sh(spawnRooms().filter(r=>floorAt(r.cy)===f&&safeRoom(r)));
   const rs=[];rooms.forEach(rm=>{for(let t=0;t<24;t++){const x=rm.x+1+Math.floor(R()*Math.max(1,rm.w-2)),y=rm.y+1+Math.floor(R()*Math.max(1,rm.h-2));if(T[y*W+x]===1&&!OB[y*W+x]&&walk(x+.5,y+.5)){rs.push({x:x+.5,y:y+.5,room:rm});break}}});
   const mix=[];for(let i=0;i<Math.max(cor.length,rs.length);i++){if(i<cor.length)mix.push({x:cor[i].x,y:cor[i].y});if(i<rs.length)mix.push(rs[i])}  // intercala corredor e sala administrativa
   spots[f]=mix.filter(far)}
  const patrolFor=(spot,f)=>{ // patrulha: sala administrativa = cantos da sala; corredor = pontos de corredor próximos
   if(spot.room){const rm=spot.room;const pts=[[1.5,1.5],[rm.w-1.5,1.5],[rm.w-1.5,rm.h-1.5],[1.5,rm.h-1.5]].map(c=>({x:rm.x+c[0],y:rm.y+c[1]})).filter(q=>walk(q.x,q.y));if(pts.length)return pts}
   const near=corridorCells(f).filter(c=>Math.hypot(c.x-spot.x,c.y-spot.y)<14&&Math.hypot(c.x-spot.x,c.y-spot.y)>4);const pts=sh(near).slice(0,3);return pts.length?[{x:spot.x,y:spot.y},...pts]:[{x:spot.x,y:spot.y}]};
  const used={'1':0,'2':0};list=[];
  for(let n=1;n<=COUNT;n++){ // 1 de cada 3 guardas no Andar 2 (pequeno); o resto no Andar 1
   const f=(n%3===0&&spots['2'].length)||!spots['1'].length?'2':'1',ss=spots[f];if(!ss.length)break;
   const sp=ss[used[f]++%ss.length];list.push(mk(n,sp.x,sp.y,patrolFor(sp,f)))}
  if(!list.length)list=[mk(1,p.gx,p.gy,p.patrol)]; // fallback
 }
 function follow(g,tx,ty,sp,dt){ // caminho com cache; repath espaçado para 15 guardas não pesarem
  if(!walk(tx,ty)){const n=AIMap.nearestWalkable(tx,ty);if(n){tx=n.x;ty=n.y}}
  const key=Math.floor(tx)+','+Math.floor(ty);g.repath-=dt;
  if(!g.path||g.repath<=0||(g.pathKey!==key&&g.state!=='chase')){g.pathKey=key;g.repath=g.state==='chase'?.6:2;g.path=AIMap.lineOfSight(g.x,g.y,tx,ty)?[]:(AIMap.findPath(g.x,g.y,tx,ty,true)||[])} // v1.7: true = pode atravessar portas fechadas
  const wp=g.path[0],px=wp?wp.x:tx,py=wp?wp.y:ty,ox=g.x,oy=g.y;
  doorsAhead(g,px,py); // v1.7: abre a porta que estiver à frente
  AIMap.move(g,px,py,sp,.22,dt);
  if(wp&&Math.hypot(g.x-wp.x,g.y-wp.y)<.3)g.path.shift();
  const mx=g.x-ox,my=g.y-oy;if(mx*mx+my*my>1e-7)g.a+=angDiff(Math.atan2(my,mx),g.a)*Math.min(1,dt*8);
  return Math.hypot(g.x-tx,g.y-ty)}

 /* ---------- MÓDULO 1 · visão, lanterna e luz ---------- */
 const inFov=(g,tx,ty,half)=>{const dx=tx-g.x,dy=ty-g.y;return Math.hypot(dx,dy)<.6||Math.abs(angDiff(Math.atan2(dy,dx),g.a))<=half};
 // O guarda só vê algo se a LANTERNA dele estiver acesa, o ponto estiver dentro do cone e não houver parede no caminho.
 const flashSees=(g,tx,ty,range)=>{if(!g.light)return false;const d=Math.hypot(tx-g.x,ty-g.y);if(d>(g.torch?range:Math.min(range,CFG.litRange))||!inFov(g,tx,ty,CFG.flashHalf))return false;return AIMap.lineOfSight(g.x,g.y,tx,ty)};
 const playerLit=()=>typeof window.playerLit==='function'?window.playerLit():true;

 /* ---------- MÓDULO 2 · audição ---------- */
 const moving=()=>!!(keys.w||keys.a||keys.s||keys.d||keys.arrowup||keys.arrowdown||keys.arrowleft||keys.arrowright);
 function noiseNow(){
  if(typeof AbyssHome!=='undefined'&&AbyssHome.active)return {mode:'idle',radius:0};
  if(!moving())return {mode:'idle',radius:CFG.noise.idle};
  if(keys.c)return {mode:'crouch',radius:CFG.noise.crouch};
  if(keys.shift)return {mode:'run',radius:CFG.noise.run};
  return {mode:'walk',radius:CFG.noise.walk}}
 const noiseStatus=()=>lastNoise;
 function emitNoise(x,y,radius,floor){ // ruído avulso (golpes, corpos...). Só atinge guardas do MESMO andar.
  const fl=floor||floorAt(y);
  for(const g of list){if(!g.alive||g.state==='elevRide'||g.state==='flee'||floorAt(g.y)!==fl)continue;
   const d=Math.hypot(g.x-x,g.y-y),eff=radius*(AIMap.lineOfSight(g.x,g.y,x,y)?1:CFG.muffle)*(g.sleeping?.7:1);
   if(d>eff)continue;if(g.sleeping)wake(g,'noise');else stimulus(g,x,y,'noise')}}

 /* ---------- MÓDULO 3 · estímulos, áreas de alerta, medo ---------- */
 const note=(t,d)=>{if(d<9&&clock-msgAt>5){msgAt=clock;say(t,2000)}};
 /* v1.7 LANTERNA DINÂMICA: escuro = fora da luz da lamparina do jogador E longe das luminárias de parede */
 const lampNear=(x,y,r)=>{if(typeof lampSpots==='undefined'||!lampSpots)return false;const r2=r*r;for(const s of lampSpots){const dx=s.x-x,dz=s.z-y;if(dx*dx+dz*dz<r2)return true}return false};
 const isDark=(g,lit)=>!((lit&&Math.hypot(g.x-P.x,g.y-P.y)<=CFG.litR)||lampNear(g.x,g.y,CFG.lampR));
 /* v1.7 PORTAS: o guarda abre portas fechadas no caminho e as fecha depois (só as que ele mesmo abriu) */
 const doorMem=new Map();
 const setDoor=(o,open)=>{o.open=open;for(let j=0;j<o.w;j++){const idx=(o.y+(o.axis==='v'?j:0))*W+o.x+(o.axis==='h'?j:0);OB[idx]=open?null:o}try{refreshObjectMesh(o)}catch(e){}};
 function openDoor(g,o){
  setDoor(o,true);const m=doorMem.get(g)||[];m.push({o,t:clock});doorMem.set(g,m);
  if(floorAt(g.y)===pFloor()&&Math.hypot(g.x-P.x,g.y-P.y)<12){try{beep(150,.12,'square',.03,90)}catch(e){}}}
 function doorsAhead(g,px,py){const dx=px-g.x,dy=py-g.y,dd=Math.hypot(dx,dy)||1;for(const k of[.55,1.0]){const o=AIMap.doorAt(Math.floor(g.x+dx/dd*k),Math.floor(g.y+dy/dd*k));if(o)openDoor(g,o)}}
 function tickDoors(g){
  const m=doorMem.get(g);if(!m||!m.length)return;
  for(let i=m.length-1;i>=0;i--){const o=m[i].o;if(!o.open){m.splice(i,1);continue}
   if(clock-m[i].t<3||g.state==='chase')continue;
   const cx=o.x+(o.axis==='h'?o.w/2:.5),cy=o.y+(o.axis==='v'?o.w/2:.5);
   if(Math.hypot(g.x-cx,g.y-cy)<1.8||Math.hypot(P.x-cx,P.y-cy)<1.3)continue;
   if(list.some(h=>h!==g&&h.alive&&Math.hypot(h.x-cx,h.y-cy)<1.3))continue;
   setDoor(o,false);m.splice(i,1)}}
 /* v1.7: PointLights 3D das lanternas. Pool fixo de 3 luzes (evita recompilar shaders) que seguem os guardas de lanterna acesa mais próximos de Karl */
 let tl=[];
 function torchLights(){if(tl.length||typeof THREE==='undefined'||typeof scene3D==='undefined'||!scene3D)return;for(let n=0;n<3;n++){const L=new THREE.PointLight(0xfff1cc,0,10.5,1.5);L.castShadow=false;L.position.set(0,-50,0);scene3D.add(L);tl.push(L)}}
 const PRI={noise:1,light:2,sight:3};
 const zoneAt=(x,y,fl)=>{for(const z of zoneList)if(z.floor===fl&&Math.hypot(x-z.x,y-z.y)<z.r)return z;return null};
 function addZone(x,y,fl){const z={id:++zoneId,x,y,floor:fl,r:CFG.zoneR,until:clock+CFG.zoneTTL};zoneList.push(z);return z}
 function exitFrom(g,z){ // ponto fora da área marcada (centro de sala mais próximo)
  if(g.leave&&g.leave.zone===z.id)return g.leave;
  let best=null,bd=1e9;
  for(const r of allRooms()){if(floorAt(r.cy)!==z.floor)continue;const d0=Math.hypot(r.cx-z.x,r.cy-z.y);if(d0<z.r+2||!walk(r.cx+.5,r.cy+.5))continue;const d=Math.hypot(r.cx-g.x,r.cy-g.y);if(d<bd){bd=d;best={x:r.cx+.5,y:r.cy+.5}}}
  if(!best){const dx=g.x-z.x,dy=g.y-z.y,d=Math.hypot(dx,dy)||1;best={x:g.x+dx/d*(z.r+2),y:g.y+dy/d*(z.r+2)}}
  return g.leave={x:best.x,y:best.y,zone:z.id}}
 function wpOf(g,fl){const n=g.patrol.length;for(let k=0;k<n;k++){const w=g.patrol[(g.patrolIndex+k)%n];if(!zoneAt(w.x,w.y,fl)){g.patrolIndex=(g.patrolIndex+k)%n;return w}}return null}
 function stimulus(g,x,y,kind){ // ouviu/viu algo: Patrulha -> Investigação até a última posição conhecida
  if(g.state==='chase'||g.state==='flee'||g.state==='elevRide')return;
  const fl=floorAt(g.y);if(kind!=='sight'&&zoneAt(x,y,fl))return; // ninguém investiga dentro de uma área de alerta
  const pri=PRI[kind]||1,cur=g.stim?g.stim.pri:0;
  if(g.state==='investigate'&&cur>pri&&g.investigate>1.5)return;
  g.state='investigate';g.lastSeen={x,y};g.seenAt=clock;g.investigate=kind==='noise'?4:6;g.alert=kind==='noise'?.5:.8;g.stim={kind,pri};g.path=null;g.hot=null}
 function setHot(g,x,y,at){g.hot={x,y};g.hotT=70;g.seenAt=at;if(!g.basePatrol)g.basePatrol=g.patrol;g.patrol=ring(x,y);g.patrolIndex=0}
 function discover(g,b,p,fl){ // achou o corpo de outro guarda
  b.reported=true;
  const partner=list.find(h=>h!==g&&h.alive&&!h.sleeping&&h.state!=='elevRide'&&h.state!=='flee'&&floorAt(h.y)===fl&&Math.hypot(h.x-g.x,h.y-g.y)<=CFG.partnerR);
  const d=Math.hypot(P.x-g.x,P.y-g.y);
  if(partner){
   addZone(p.x,p.y,fl);
   for(const q of [g,partner]){q.state='talk';q.talkT=2.8;q.talkCd=25;q.path=null;q.hot=null;q.leave=null;q.alert=0;q.stim=null;if(q.basePatrol){q.patrol=q.basePatrol;q.basePatrol=null}}
   g.a=Math.atan2(partner.y-g.y,partner.x-g.x);partner.a=g.a+Math.PI;
   note('Um guarda acha o corpo de outro e avisa o parceiro. A área foi marcada como perigosa.',d)}
  else{setHot(g,p.x,p.y,clock);g.state='investigate';g.lastSeen={x:p.x,y:p.y};g.investigate=8;g.alert=1;g.stim={kind:'sight',pri:3};g.path=null;note('Um guarda acha um corpo e fica em alerta, sozinho.',d)}}
 function scanBodies(g,fl){
  for(const b of list){if(b===g||!b.dead||b.consumed||b.carried||b.reported)continue;const p=bodyPos(b);if(floorAt(p.y)!==fl)continue;
   if(flashSees(g,p.x,p.y,CFG.bodySight)){discover(g,b,p,fl);return}}}
 // Medo do Abismo: qualquer guarda que pare num andar negativo (empurrado, forçado, save antigo) foge para os andares positivos.
 function startFlee(g,fl){
  g.state='flee';g.fear=1;g.path=null;g.hot=null;g.lastSeen=null;g.stim=null;g.sleeping=false;g.drowsy=35;g.sus=0;
  const band=bandAt(Math.floor(g.y)),here=OBJ.filter(o=>o.t==='elevator'&&o.band===band),ups=OBJ.filter(o=>o.t==='elevator'&&!isNeg(floorOfBand(o.band)));
  let cur=null,bd=1e9;for(const o of here){const d=Math.hypot(o.x+1-g.x,o.y+1.6-g.y);if(d<bd){bd=d;cur=o}}
  if(cur&&ups.length){const dest=ups[Math.floor(Math.random()*ups.length)];
   g.elevPt={x:cur.x+1,y:cur.y+1.6};g.rideTo={x:dest.x+1,y:dest.y+1.6};g.rideT=3+1.4*Math.abs(FLOOR_ORDER.indexOf(fl)-FLOOR_ORDER.indexOf(floorOfBand(dest.band)));g.fleeExit=true}
  else{g.fleeExit=false;g.elevPt=null}
  note('Um guarda em pânico foge do Abismo.',Math.hypot(P.x-g.x,P.y-g.y))}
 function updateFlee(g,dt){
  g.fear=1;
  if(g.fleeExit&&g.elevPt){const d=follow(g,g.elevPt.x,g.elevPt.y,CFG.fleeSpeed,dt);if(d<.7){g.state='elevRide';g.path=null}return}
  const dx=g.x-P.x,dy=g.y-P.y,d=Math.hypot(dx,dy)||1; // sem elevador neste andar: corre para longe de Karl
  follow(g,g.x+dx/d*6,g.y+dy/d*6,CFG.fleeSpeed,dt)}
 function forceToFloor(who,floor){ // empurra/força um guarda para outro andar (ex.: floor '-2'): ele entra em Fuga
  const g=typeof who==='string'?list.find(x=>x.id===who):who;if(!g||!g.alive)return false;
  const el=OBJ.find(o=>o.t==='elevator'&&floorOfBand(o.band)===floor);if(!el)return false;
  const sp=AIMap.nearestWalkable(el.x+1,el.y+2.2)||{x:el.x+1,y:el.y+2};g.x=sp.x;g.y=sp.y;g.path=null;g.state='patrol';g.sleeping=false;return true}

 function pickSleepSpot(g){ // lugar da mesma andar que o player menos frequentou
  const fl=floorAt(g.y);let best=null,bs=1e9;
  for(const r of allRooms()){if(floorAt(r.cy)!==fl)continue;const sc=heat[hix(r.cx,r.cy)]+Math.random()*.5;if(sc>=bs)continue;
   const c=[{x:r.x+1.5,y:r.y+1.5},{x:r.x+r.w-1.5,y:r.y+r.h-1.5},{x:r.cx+.5,y:r.cy+.5}].find(q=>walk(q.x,q.y));if(c){bs=sc;best=c}}
  if(best){g.sleepSpot=best;g.sleepT=70;g.state='sleepy';g.path=null}else g.drowsy=40}
 function startElev(g){ // guardas só circulam entre os andares POSITIVOS (1 e 2)
  const el=OBJ.filter(o=>o.t==='elevator'&&!isNeg(floorOfBand(o.band)));if(el.length<2){g.nextElev=90;return}
  const dist=o=>Math.hypot(o.x+1-g.x,o.y+1.6-g.y);let cur=el[0];for(const o of el)if(dist(o)<dist(cur))cur=o;
  if(dist(cur)>45){g.nextElev=60;return}
  let opts=el.filter(o=>o!==cur&&floorOfBand(o.band)!==floorOfBand(cur.band));if(!opts.length)opts=el.filter(o=>o!==cur);
  const dest=opts[Math.floor(Math.random()*opts.length)];
  g.elevPt={x:cur.x+1,y:cur.y+1.6};g.rideTo={x:dest.x+1,y:dest.y+1.6};
  g.rideT=3+1.4*Math.abs(FLOOR_ORDER.indexOf(floorOfBand(cur.band))-FLOOR_ORDER.indexOf(floorOfBand(dest.band)));
  g.elevT=45;g.state='elevWalk';g.path=null}
 function arrive(g){g.x=g.rideTo.x;g.y=g.rideTo.y;g.rideTo=null;g.state='patrol';g.path=null;g.hot=null;g.basePatrol=null;g.fear=0;g.fleeExit=false;g.leave=null;g.patrol=ring(g.x,g.y);g.patrolIndex=0;g.nextElev=70+Math.random()*90;
  const d=Math.hypot(P.x-g.x,P.y-g.y);if(floorAt(g.y)===pFloor()&&d<10){beep(880,.3,'sine',.05);note('Ding. Um guarda sai do elevador.',d)}}
 function wake(g,why){g.sleeping=false;g.state='investigate';g.lastSeen={x:P.x,y:P.y};g.seenAt=clock;g.investigate=6;g.drowsy=35;g.path=null;g.stim={kind:'noise',pri:1};note(why==='noise'?'O barulho acordou um guarda!':'O guarda acordou.',Math.hypot(P.x-g.x,P.y-g.y))}
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
  const pf=pFloor(),nz=noiseNow(),lit=playerLit(),range=keys.c?CROUCH_RANGE:RANGE;lastNoise=nz;let fight=null;
  zoneList=zoneList.filter(z=>z.until>clock);
  for(let i=0;i<list.length;i++){const g=list[i];if(!g.alive)continue;g.step+=dt;g.talkCd-=dt;
   if(g.state==='elevRide'){g.rideT-=dt;if(g.rideT<=0)arrive(g);continue}
   const gf=floorAt(g.y),same=gf===pf,gd=Math.hypot(P.x-g.x,P.y-g.y);
   if(isNeg(gf)&&g.state!=='flee')startFlee(g,gf);
   g.darkT=(g.darkT||0)-dt;if(g.darkT<=0){g.darkT=.5;g.dark=isDark(g,lit)} // v1.7: reavalia o escuro 2x por segundo
   tickDoors(g);
   if(g.state==='flee'){g.light=true;g.torch=!!g.dark;updateFlee(g,dt);continue}
   g.light=g.state!=='sleeping'; // dormindo: sem visão
   g.torch=g.light&&(!!g.dark||g.state==='chase'||g.state==='investigate'); // v1.7: acende a lanterna no escuro (ou em alerta)
   if(g.state==='sleeping'){ // dormindo: sem visão, só acorda com barulho do MESMO andar
    g.drowsy=Math.max(0,g.drowsy-dt*.45);
    const eff=nz.radius*(AIMap.lineOfSight(g.x,g.y,P.x,P.y)?1:CFG.muffle)*.7;
    if(same&&nz.radius>0&&gd<=eff)wake(g,'noise');else if(g.drowsy<=5)wake(g,'rested');
    else if(same&&gd<1.4&&!$('msg').classList.contains('on'))say('[E] Eliminar o guarda adormecido',1200);
    continue}
   /* --- percepção: só no mesmo andar --- */
   let vis=false;
   if(same){
    vis=flashSees(g,P.x,P.y,range);
    if(!vis&&lit&&gd<=CFG.lightRange&&clock-g.lightAt>.35&&inFov(g,P.x,P.y,CFG.lightHalf)&&AIMap.lineOfSight(g.x,g.y,P.x,P.y)){g.lightAt=clock;stimulus(g,P.x,P.y,'light')}
    if(nz.radius>0&&clock-g.noiseAt>.9&&gd<=nz.radius*(AIMap.lineOfSight(g.x,g.y,P.x,P.y)?1:CFG.muffle)){
     g.noiseAt=clock;const j=nz.mode==='run'?.8:1.4,nx=P.x+(Math.random()-.5)*2*j,ny=P.y+(Math.random()-.5)*2*j;
     stimulus(g,walk(nx,ny)?nx:P.x,walk(nx,ny)?ny:P.y,'noise')}}
   if(vis){
    g.sus=Math.min(1.2,g.sus+dt*(gd<3?2.4:gd<6?1.2:.65));
    stimulus(g,P.x,P.y,'sight');
    if(g.sus>=1||gd<2){if(g.state!=='chase'){g.state='chase';g.path=null;note('Um guarda viu Karl!',gd)}g.lastSeen={x:P.x,y:P.y};g.seenAt=clock;g.investigate=3;g.alert=1}
    else if(g.state==='investigate'){g.lastSeen={x:P.x,y:P.y};g.seenAt=clock}}
   else{g.sus=Math.max(0,g.sus-dt*.45);if(g.state==='chase'){g.state='investigate';g.alert=1;g.path=null;g.stim={kind:'sight',pri:3}}}
   /* --- comportamento --- */
   if(g.state==='chase'){follow(g,P.x,P.y,1.5,dt);g.drowsy=Math.max(0,g.drowsy-dt*.1)}
   else if(g.state==='investigate'&&g.lastSeen){
    const d=follow(g,g.lastSeen.x,g.lastSeen.y,1.05,dt);g.investigate-=dt;
    if(d<.35)g.a+=dt*1.6; // olha ao redor
    if(g.investigate<=0||(d<.35&&g.investigate<2)){g.state='patrol';g.alert=0;g.stim=null;setHot(g,g.lastSeen.x,g.lastSeen.y,g.seenAt||clock);g.lastSeen=null;g.path=null}}
   else if(g.state==='talk'){g.talkT-=dt;if(g.talkT<=0){g.state='patrol';g.path=null}}
   else if(g.state==='sleepy'){
    g.sleepT-=dt;const d=g.sleepSpot?follow(g,g.sleepSpot.x,g.sleepSpot.y,.6,dt):0;
    if(d<.45||g.sleepT<=0){g.state='sleeping';g.sleeping=true;g.light=false;g.torch=false;g.drowsy=100;g.path=null}}
   else if(g.state==='elevWalk'){
    g.elevT-=dt;const d=follow(g,g.elevPt.x,g.elevPt.y,.7,dt);
    if(d<.7){g.state='elevRide';g.path=null}else if(g.elevT<=0){g.state='patrol';g.nextElev=60;g.path=null}}
   else{ // patrulha
    g.state='patrol';g.alert=0;g.stim=null;g.drowsy=Math.min(100,g.drowsy+dt*g.drowsyRate);g.nextElev-=dt;
    if(g.hotT>0){g.hotT-=dt;if(g.hotT<=0){g.hot=null;if(g.basePatrol){g.patrol=g.basePatrol;g.basePatrol=null;g.patrolIndex=0}}}
    const zin=zoneAt(g.x,g.y,gf);
    if(zin){const ex=exitFrom(g,zin);follow(g,ex.x,ex.y,1,dt)} // dentro de área de alerta: sai dela
    else if(g.drowsy>=70&&!g.hot)pickSleepSpot(g);
    else if(g.nextElev<=0&&!g.hot)startElev(g);
    else{const wp=wpOf(g,gf);
     if(wp){if(follow(g,wp.x,wp.y,g.hot?.7:.48,dt)<.35)g.patrolIndex=(g.patrolIndex+1)%g.patrol.length}else g.a+=dt*.4;
     if(g.talkCd<=0)for(let j=i+1;j<list.length;j++){const h=list[j];if(h.alive&&h.state==='patrol'&&h.talkCd<=0&&floorAt(h.y)===gf&&Math.hypot(h.x-g.x,h.y-g.y)<2.2){talk(g,h);break}}}}
   // corpos de outros guardas (a cada ~0,4 s por guarda)
   g.scanT-=dt;if(g.scanT<=0){g.scanT=.4;if(g.state==='patrol'||g.state==='investigate')scanBodies(g,gf)}
   if(!fight&&same&&g.light&&gd<.62&&(vis||gd<.5))fight=g}
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
  sprites.forEach((s,i)=>{const g=list[i];if(!g||(!g.alive&&!g.dead)||g.state==='elevRide'||g.carried||g.consumed){s.visible=false;return}
   const down=g.dead||g.sleeping;s.visible=true;s.position.set(g.deadAt?.x??g.x,.015,g.deadAt?.y??g.y);
   s.rotation.z=down?.95:0;s.scale.set(down?1.08:1,down?.58:1,1);s.material.color.setHex(g.sleeping?0x7f8fa6:g.state==='flee'?0xffc890:g.state==='chase'?0xffb0a0:0xffffff)});
  // v1.7 LANTERNA: PointLight 3D nos guardas de lanterna acesa mais próximos de Karl
  torchLights();
  if(tl.length){const pf=pFloor(),cand=list.filter(g=>g.alive&&g.torch&&!g.carried&&!g.consumed&&g.state!=='elevRide'&&floorAt(g.y)===pf).map(g=>({g,d:Math.hypot(g.x-P.x,g.y-P.y)})).sort((a,b)=>a.d-b.d).slice(0,tl.length);
   tl.forEach((L,i)=>{const c=cand[i];if(c){const g=c.g;L.position.set(g.x+Math.cos(g.a)*.9,1.05,g.y+Math.sin(g.a)*.9);L.intensity+=(3.2-L.intensity)*.2}else{L.intensity*=.8;if(L.intensity<.02)L.intensity=0}})}}
 // cones de visão (lanterna) dos guardas acordados que estão no mesmo andar do jogador: usados pelo VisionFX para desenhar no Canvas
 function cones(){
  if(!P)return [];const pf=pFloor();
  return list.filter(g=>g.alive&&g.light&&g.torch&&!g.carried&&!g.consumed&&g.state!=='elevRide'&&floorAt(g.y)===pf).map(g=>({x:g.x,y:g.y,a:g.a,half:CFG.flashHalf,range:RANGE,state:g.state,sus:g.sus,fear:g.fear}))}
 function serialize(){materialize();return {list:JSON.parse(JSON.stringify(list)),heat:Array.from(heat)}}
 function restore(d){pending=null;zoneList=[];const gs=d.guards;
  if(gs&&gs.list){list=gs.list.map((g,i)=>Object.assign(mk(i+1,g.x,g.y,g.patrol),g));heat=Float32Array.from(gs.heat||[]);if(heat.length!==256)heat=new Float32Array(256)}
  else if(d.guard){list=[Object.assign(mk(1,d.guard.x,d.guard.y,d.guard.patrol),d.guard,{id:'guard_01'})];heat=new Float32Array(256)}else list=[]}
 return Object.freeze({reset,spawnAll,update,stealthKill,sync,serialize,restore,cones,noiseStatus,emitNoise,forceToFloor,cfg:CFG,all:()=>list,zones:()=>zoneList,get:id=>list.find(g=>g.id===id)})
})();
