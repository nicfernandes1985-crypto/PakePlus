/* guard-battle.js
 * EXPORTA: GuardBattle (open, close, strike, sync, attack, die)
 * DEPENDE DE: assets/guard_corrupted.png; DOM .combatArena (index.html); beep (audio.js, opcional) (tudo lido em tempo de chamada)
 * NÃO PODE ALTERAR: o PNG. O sprite é usado SEM nenhuma edição de pixels: as peças são apenas recortes dele (polígonos POLY).
 *   Chaves das peças = chaves de bodyHP do guarda (rightArm = braço do cassetete, à esquerda da tela; leftArm = braço da braçadeira).
 *   Script clássico (sem import/export). Carregar antes de monolith.js ou depois: o monolith só o chama em tempo de execução.
 */
/* ---------- GuardBattle (v1.5.0) · MÓDULO 5: sprite de batalha do Corrupted Guard + desmembramento ----------
   Só o VISUAL do arquivo de teste (Teste_de_sprite__combate_de_membros.html) foi aproveitado: peças que se soltam do corpo, giram,
   quicam no chão, espirram sangue e deixam manchas. A mecânica de combate continua sendo a do jogo (bodyHP, habilidades, turnos). */
const GuardBattle=(()=>{
 const SRC='assets/guard_corrupted.png',SW=1246,SH=1262,FEET=[632,1236];
 // Recortes do sprite (coordenadas da imagem original). O tronco é o que sobra depois de tirar todos eles.
 const POLY={
  head:[[520,0],[712,0],[716,120],[692,165],[668,196],[640,200],[600,200],[570,196],[548,186],[534,150],[520,100]],
  rightArm:[[412,205],[470,168],[548,170],[536,236],[510,300],[500,400],[482,470],[462,520],[450,560],[440,596],[428,640],[420,692],[240,852],[150,862],[150,790],[335,640],[332,600],[342,545],[372,480],[392,410],[402,320]],
  leftArm:[[690,168],[750,168],[806,205],[830,255],[852,322],[866,400],[885,470],[906,520],[908,600],[906,692],[815,692],[812,600],[802,590],[775,545],[762,480],[764,400],[770,330],[748,262],[722,218]],
  rightLeg:[[340,897],[500,897],[500,900],[548,948],[552,1262],[340,1262]],
  leftLeg:[[650,948],[702,925],[760,903],[870,893],[935,985],[935,1262],[650,1262]]
 };
 const PIVOT={head:[612,192],rightArm:[478,222],leftArm:[772,222],rightLeg:[470,903],leftLeg:[782,903]};
 // Linha do corte no tronco, onde aparece o ferimento depois que a peça sai.
 const WOUND={head:[[548,188],[600,201],[668,198]],rightArm:[[548,174],[536,236],[518,282]],leftArm:[[700,176],[722,218],[748,262]],rightLeg:[[425,899],[470,904],[510,905]],leftLeg:[[705,924],[760,904],[830,897]]};
 const LIMBS=['leftArm','rightArm','leftLeg','rightLeg'];
 const PARTS=['head',...LIMBS];
 let img=null,ready=false,parts=null,torso=null,cv=null,cx=null,arena=null,raf=0,S=null,V=null,last=0,pendingOpen=null;

 /* ---------- carregar e recortar ---------- */
 function load(){
  if(img)return;img=new Image();
  img.onload=()=>{try{build();ready=true;if(pendingOpen){const g=pendingOpen;pendingOpen=null;open(g)}}catch(e){console.warn('ABISM: GuardBattle não conseguiu recortar o sprite.',e)}};
  img.onerror=()=>console.warn('ABISM: não foi possível carregar '+SRC);
  img.src=SRC}
 const trace=(g,p,dx,dy)=>{g.beginPath();p.forEach((v,i)=>i?g.lineTo(v[0]+dx,v[1]+dy):g.moveTo(v[0]+dx,v[1]+dy));g.closePath()};
 function build(){
  parts={};
  for(const k in POLY){
   const p=POLY[k],xs=p.map(v=>v[0]),ys=p.map(v=>v[1]),pad=3;
   const bx=Math.min(...xs)-pad,by=Math.min(...ys)-pad,w=Math.min(SW,Math.max(...xs)+pad)-bx,h=Math.min(SH,Math.max(...ys)+pad)-by;
   const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
   // a peça é o recorte + uma borda de ~1,5 px (mesmo pixel do sprite) para nunca deixar fresta entre ela e o tronco
   g.translate(-bx,-by);const pat=g.createPattern(img,'no-repeat');g.fillStyle=pat;g.strokeStyle=pat;g.lineWidth=3;g.lineJoin='round';
   trace(g,p,0,0);g.fill();g.stroke();
   parts[k]={name:k,c,bx,by,w,h,cx:bx+w/2,cy:by+h/2,m:null}}
  torso=document.createElement('canvas');torso.width=SW;torso.height=SH;const t=torso.getContext('2d');
  t.drawImage(img,0,0);t.globalCompositeOperation='destination-out';t.fillStyle='#000';
  for(const k in POLY){trace(t,POLY[k],0,0);t.fill()}}

 /* ---------- DOM ---------- */
 function ensure(){
  if(cv)return true;arena=document.querySelector('.combatArena');if(!arena)return false;
  cv=document.createElement('canvas');cv.id='guardBattle';cv.setAttribute('aria-label','Corrupted Guard em combate');arena.appendChild(cv);cx=cv.getContext('2d');
  cv.addEventListener('pointerdown',kick);return true}
 function size(){
  const w=arena.clientWidth||600,h=arena.clientHeight||400,dpr=Math.min(2,window.devicePixelRatio||1);
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
  V={w,h,dpr,u:h/200,s:h*.78/SH,cx:w*.585,gy:h*.88}}
 const sfx=(f,d,t,v,f2)=>{try{if(typeof beep==='function')beep(f,d,t,v,f2)}catch(e){}};

 /* ---------- ciclo de vida ---------- */
 function open(g){
  load();if(!ensure()||!g)return;
  if(!ready){pendingOpen=g;return}
  size();
  S={g,t:0,at:1,shake:0,recoil:0,lean:0,drop:0,dyingOn:false,dyT:0,cb:null,cbDone:false,blood:[],stains:[],loose:[],severed:{},bleed:{},rootM:null};
  for(const k of LIMBS){ // membros que já estavam perdidos (luta anterior): ficam caídos no chão
   const burn=!!(g.severed&&g.severed[k]),gone=burn||(g.bodyHP&&g.bodyHP[k]<=0);if(!gone)continue;
   S.severed[k]=burn?'burn':'cut';
   if(!burn){const P=parts[k];S.loose.push({k,x:V.cx+(Math.random()-.5)*SW*V.s*.55,y:V.gy-6+Math.random()*10*V.u,r:(Math.random()-.5)*3,vx:0,vy:0,vr:0,kind:'cut',fade:1,dy:Math.random()*10*V.u,life:9,rest:true})}
   S.bleed[k]=0}
  cv.style.display='block';last=performance.now();if(!raf)raf=requestAnimationFrame(frame)}
 function close(){pendingOpen=null;S=null;if(raf){cancelAnimationFrame(raf);raf=0}if(cv)cv.style.display='none'}

 /* ---------- efeitos ---------- */
 const toScreen=(x,y)=>{const m=S&&S.rootM;if(!m)return {x:V.cx+(x-FEET[0])*V.s,y:V.gy+(y-FEET[1])*V.s};const p=m.transformPoint(new DOMPoint(x,y));return {x:p.x/V.dpr,y:p.y/V.dpr}};
 function spill(x,y,n,kind){
  const u=V.u;
  for(let i=0;i<n;i++){
   if(kind==='burn')S.blood.push({x,y,vx:(Math.random()-.5)*3*u,vy:-Math.random()*3.2*u,c:Math.random()<.5?'#ff9a2e':Math.random()<.5?'#ffd27a':'#4a4a4a',z:Math.max(2,Math.round(2*u*.55)),ember:1,life:.5+Math.random()*.8,dy:0});
   else if(kind==='shock')S.blood.push({x,y,vx:(Math.random()-.5)*5*u,vy:-Math.random()*4*u,c:Math.random()<.6?'#9fd8ff':'#fff3b0',z:Math.max(2,Math.round(1.6*u*.55)),ember:1,life:.25+Math.random()*.3,dy:0});
   else S.blood.push({x,y,vx:(Math.random()-.5)*3*u,vy:-Math.random()*3*u,c:Math.random()<.2?'#b3262e':'#8c1f26',z:Math.max(2,Math.round(2*u*.55)),dy:Math.random()*10*u})}}
 function partCenter(k){
  if(k==='torso')return [630,430];
  if(k==='head')return [612,100];
  const P=parts[k];return [P.cx,P.cy]}
 function strike(part,dmg,hp,kind){ // chamado quando um golpe do jogador acerta uma parte
  if(!S)return;const c=partCenter(part),p=toScreen(c[0],c[1]),d=Math.max(1,+dmg||1);
  const k=kind==='burn'?'shock':(kind||'cut');
  spill(p.x,p.y,k==='shock'?Math.min(30,8+d/2|0):Math.min(26,6+d/2|0),k);
  S.shake=Math.max(S.shake,3+Math.min(5,d/6));S.recoil=1;
  sfx(k==='shock'?900:160,.12,k==='shock'?'square':'sawtooth',.06,k==='shock'?120:50);
  if(LIMBS.includes(part)&&!S.severed[part]){
   if(kind==='burn')sever(part,'burn');
   else if(hp&&hp[part]<=0)sever(part,'cut')}}
 function sever(k,kind){
  if(!S||S.severed[k])return;const P=parts[k],pv=PIVOT[k];let x,y,r=0;
  if(P.m){const q=P.m.transformPoint(new DOMPoint(P.cx-pv[0],P.cy-pv[1]));x=q.x/V.dpr;y=q.y/V.dpr;r=Math.atan2(P.m.b,P.m.a)}
  else{const q=toScreen(P.cx,P.cy);x=q.x;y=q.y}
  S.severed[k]=kind;S.bleed[k]=kind==='burn'?0:7;
  S.loose.push({k,x,y,r,vx:(Math.random()-.5)*3*V.u,vy:(-2.5-Math.random()*2)*V.u,vr:(Math.random()-.5)*.4,kind,fade:1,dy:Math.random()*10*V.u,life:0});
  spill(x,y,kind==='burn'?34:k==='head'?44:30,kind==='burn'?'burn':'cut');
  S.shake=6;S.recoil=1;
  sfx(kind==='burn'?110:70,.35,'sawtooth',.1,kind==='burn'?400:30);setTimeout(()=>sfx(210,.1,'square',.05,60),90)}
 function sync(g){ // garante que todo membro com 0 de vida (ou carbonizado) já saiu do corpo
  if(!S||!g)return;
  for(const k of LIMBS){if(S.severed[k])continue;const burn=!!(g.severed&&g.severed[k]);if(burn||(g.bodyHP&&g.bodyHP[k]<=0))sever(k,burn?'burn':'cut')}}
 function attack(){if(!S)return;S.at=0;sfx(200,.18,'sawtooth',.04,70)}
 function die(g,cb){ // golpe final: cabeça decepada (se for o caso), o corpo desaba e só então o combate termina
  if(!S||!ready){if(cb)cb();return}
  if(g&&g.bodyHP&&g.bodyHP.head<=0&&!S.severed.head){sever('head','cut');spill(toScreen(612,200).x,toScreen(612,200).y,30,'cut')}
  const st=S;st.dyingOn=true;st.dyT=0;st.cb=cb;st.cbDone=false;
  setTimeout(()=>{if(!st.cbDone){st.cbDone=true;const c=st.cb;st.cb=null;if(c)c()}},1700)} // relógio real: não depende da taxa de quadros
 function kick(e){ // como no teste de referência: clicar numa peça solta a chuta
  if(!S||!V)return;const r=cv.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  for(let i=S.loose.length-1;i>=0;i--){const p=S.loose[i],P=parts[p.k],rad=Math.max(P.w,P.h)*V.s*.55;
   if(Math.hypot(mx-p.x,my-p.y)<rad){p.rest=false;p.vy=-3.5*V.u;p.vx=(Math.random()-.5)*5*V.u;p.vr=(Math.random()-.5)*.6;if(p.kind!=='burn')spill(p.x,p.y,5,'cut');sfx(120,.08,'square',.04,60);return}}}

 /* ---------- simulação ---------- */
 const ease=t=>t*t*(3-2*t);
 function step(dt,k){
  const u=V.u,gy=V.gy;S.t+=dt;
  if(S.at<1)S.at=Math.min(1,S.at+dt/.75);
  S.shake=Math.max(0,S.shake-.4*k);S.recoil=Math.max(0,S.recoil-dt*3.2);
  // inclinação/queda quando faltam pernas
  const miss=(S.severed.rightLeg?1:0)+(S.severed.leftLeg?1:0),tl=S.severed.rightLeg&&!S.severed.leftLeg?-.05:S.severed.leftLeg&&!S.severed.rightLeg?.05:0,td=miss===2?72:miss===1?24:0;
  S.lean+=(tl-S.lean)*Math.min(1,dt*6);S.drop+=(td-S.drop)*Math.min(1,dt*6);
  if(S.dyingOn){S.dyT+=dt;if(S.dyT>=1.45&&!S.cbDone){S.cbDone=true;const cb=S.cb;S.cb=null;if(cb)cb()}}
  // peças soltas
  for(const p of S.loose){
   p.life+=dt;
   if(p.kind==='burn'&&p.life>.9)p.fade=Math.max(0,1-(p.life-.9)/1.3);
   if(p.rest)continue;
   p.vy+=.22*u*k;p.x+=p.vx*k;p.y+=p.vy*k;p.r+=p.vr*k;
   const g0=gy-7*u*.6+p.dy*.5;
   if(p.y>g0){p.y=g0;p.vy*=-.35;p.vx*=.7;p.vr*=.6;if(Math.abs(p.vy)<.6*u){p.vy=0;if(Math.abs(p.vx)<.15*u&&Math.abs(p.vr)<.02){p.rest=true;p.vx=p.vr=0}}}
   if(p.kind==='burn'&&p.fade>0&&p.fade<1&&Math.random()<.5)S.blood.push({x:p.x+(Math.random()-.5)*20,y:p.y-Math.random()*14,vx:(Math.random()-.5)*.8*u,vy:-.8*u-Math.random()*u,c:Math.random()<.5?'#ff9a2e':'#555',z:2,ember:1,life:.4+Math.random()*.5,dy:0})}
  S.loose=S.loose.filter(p=>!(p.kind==='burn'&&p.fade<=0));
  // sangrando pelo toco
  for(const k2 in S.bleed){
   if(S.bleed[k2]>0)S.bleed[k2]-=dt;
   const w=WOUND[k2],kind=S.severed[k2],rate=kind==='burn'?.35:S.bleed[k2]>0?.22:.03;
   if(Math.random()<rate*k*.5){const a=w[Math.floor(Math.random()*w.length)],q=toScreen(a[0],a[1]);
    if(kind==='burn')S.blood.push({x:q.x,y:q.y,vx:(Math.random()-.5)*.6*u,vy:-.7*u,c:Math.random()<.5?'#ff9a2e':'#444',z:2,ember:1,life:.5,dy:0});
    else S.blood.push({x:q.x,y:q.y,vx:(Math.random()-.5)*.5*u,vy:0,c:'#8c1f26',z:Math.max(2,Math.round(1.8*u*.55)),dy:Math.random()*10*u})}}
  // partículas
  S.blood=S.blood.filter(b=>{
   if(b.ember){b.life-=dt;if(b.life<=0)return false;b.vy+=.05*u*k}else b.vy+=.2*u*k;
   b.x+=b.vx*k;b.y+=b.vy*k;
   if(!b.ember&&b.y>=gy+b.dy){if(S.stains.length<700)S.stains.push({x:b.x/V.w,y:(gy+b.dy)/V.h,z:b.z,c:b.c});return false}
   return true})}

 /* ---------- desenho ---------- */
 function swing(k,t){
  const base={head:Math.sin(t*1.7)*.012,rightArm:Math.sin(t*2)*.025,leftArm:Math.sin(t*2+1)*.025,rightLeg:0,leftLeg:0}[k];
  let a=base;
  if(S.at<1){const sw=Math.sin(S.at*Math.PI);
   if(k==='rightArm')a+=2.3*sw;else if(k==='leftArm')a+=(S.severed.rightArm?2:.45)*sw;else if(k==='head')a+=-.08*sw}
  if(k==='head'&&S.dyingOn)a+=.5*ease(Math.min(1,S.dyT/.9));
  return a}
 function wound(k,t){
  const w=WOUND[k],burn=S.severed[k]==='burn';
  cx.save();cx.lineCap='round';cx.lineJoin='round';
  cx.beginPath();w.forEach((v,i)=>i?cx.lineTo(v[0],v[1]):cx.moveTo(v[0],v[1]));
  cx.strokeStyle=burn?'#0d0a09':'#47090f';cx.lineWidth=k==='head'?30:24;cx.stroke();
  cx.strokeStyle=burn?'rgba(255,120,30,'+(.35+.25*Math.sin(t*9+w[0][0])).toFixed(2)+')':'#8c1f26';cx.lineWidth=k==='head'?17:13;cx.stroke();
  cx.strokeStyle=burn?'rgba(255,210,120,.35)':'rgba(214,70,78,'+(.35+.15*Math.sin(t*3)).toFixed(2)+')';cx.lineWidth=4;cx.stroke();
  cx.restore()}
 function draw(t){
  const {w,h,dpr,s,u}=V;cx.setTransform(dpr,0,0,dpr,0,0);cx.clearRect(0,0,w,h);
  // manchas de sangue no chão
  for(const st of S.stains){cx.fillStyle=st.c;cx.fillRect(Math.round(st.x*w),Math.round(st.y*h),st.z,st.z)}
  // sombra
  cx.fillStyle='rgba(0,0,0,.42)';cx.beginPath();cx.ellipse(V.cx,V.gy+3*u,SW*s*.2,6*u,0,0,Math.PI*2);cx.fill();
  // corpo (coordenadas do sprite original, escaladas)
  const dying=S.dyingOn?ease(Math.min(1,S.dyT/.9)):0,lunge=S.at<1?Math.sin(S.at*Math.PI):0,sh=S.shake>0?(Math.random()-.5)*S.shake*u*.9:0;
  cx.save();
  cx.translate(V.cx+sh+(-60*lunge-90*dying)*s,V.gy+(S.drop+22*lunge+8*dying)*s);
  cx.rotate(S.lean+.035*S.recoil-1.38*dying-.05*lunge);
  cx.scale(s,s);cx.translate(-FEET[0],-FEET[1]+Math.sin(t*2)*4*(1-dying));
  S.rootM=cx.getTransform();
  cx.drawImage(torso,0,0);
  for(const k of PARTS){if(S.severed[k])wound(k,t)}
  for(const k of ['rightLeg','leftLeg','rightArm','leftArm','head']){
   if(S.severed[k])continue;const P=parts[k],pv=PIVOT[k];
   cx.save();cx.translate(pv[0],pv[1]);cx.rotate(swing(k,t));P.m=cx.getTransform();
   cx.drawImage(P.c,P.bx-pv[0],P.by-pv[1]);cx.restore()}
  cx.restore();
  // peças soltas
  for(const p of S.loose){const P=parts[p.k];
   cx.save();cx.globalAlpha=p.fade;cx.translate(p.x,p.y);cx.rotate(p.r);cx.scale(s,s);
   if(p.kind==='burn')cx.filter='brightness(.35) sepia(.6)';
   cx.drawImage(P.c,P.bx-P.cx,P.by-P.cy);cx.restore()}
  // partículas
  for(const b of S.blood){cx.globalAlpha=b.ember?Math.min(1,b.life*2):1;cx.fillStyle=b.c;cx.fillRect(b.x|0,b.y|0,b.z,b.z)}
  cx.globalAlpha=1}
 function frame(now){
  raf=0;if(!S)return;
  const dt=Math.min(.05,(now-last)/1000);last=now;
  try{size();step(dt,dt*60);draw(now/1000)}catch(e){if(!frame.warned){frame.warned=1;console.warn('ABISM: GuardBattle falhou.',e)}
   if(S&&S.dyingOn&&!S.cbDone){S.cbDone=true;const cb=S.cb;S.cb=null;if(cb)cb()}}
  raf=requestAnimationFrame(frame)}

 load();
 return Object.freeze({open,close,strike,sync,attack,die,get active(){return !!S}})
})();
