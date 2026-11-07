/* abyss-home.js
 * EXPORTA: AbyssHome (active, busy, placeStairs, buildStairs, stairHeight, update, render, interact, reset, enter, exit, cfg)
 * DEPENDE DE: THREE, T, K, OB, OBJ, RM, P, W, H, BD, rng, $, say, beep, A, ac, ambientVolume, keys, bodyHP, hunger, thirst, AbyssModule,
 *             renderer3D, mat, addBox, makeBillboard, playerLit, ABYSS_HORIZON_URL (todos lidos em tempo de chamada, nunca no carregamento)
 * NÃO PODE ALTERAR: Script clássico (sem import/export). placeStairs() roda DEPOIS de AbyssModule.spawn() (rng próprio, para não mudar
 *   altares/Coletor de uma mesma seed). O Lar do Abismo é uma cena 3D separada: não entra no save (salvar só acontece na cama).
 */
/* ---------- AbyssHome (v1.5.0) · MÓDULO 4: O Lar do Abismo ----------
   1) Andar -4: uma escadaria de concreto (corrimãos de metal, luz escassa) num corredor fechado por uma porta. Ao chegar ao TOPO, o jogador
      atravessa um fade e entra no Lar do Abismo.
   2) Lar do Abismo: planície escura e vazia, com câmera baixa. Ao andar um pouco, a névoa recua e a criatura colossal (imagem de referência)
      aparece no horizonte, num plano de fundo com paralaxe sutil.
   3) Respiração: som grave, lento e pesado (Web Audio) que cresce suavemente conforme Karl se aproxima do horizonte. */
const AbyssHome=(()=>{
 const CFG={
  stairW:3,stairH:10,rise:2.6,run0:1,runLen:7.4,               // geometria da escadaria (em tiles)
  xLim:34,zStart:6,zLimit:-48,                                  // limites de caminhada no Lar do Abismo
  horizonZ:-96,horizonW:54,horizonH:81,horizonLine:.313,        // plano do horizonte (linha do chão a 31,3% da base da imagem)
  revealFrom:4,revealTo:18,                                     // distância andada (u) em que o horizonte começa/termina de aparecer
  fogNear:.042,fogFar:.011,
  breathMin:.07,breathMax:.5
 };
 let active=false,busy=false,cool=0,stairsObj=undefined,hintAt=-99,flags={revealMsg:false,nearMsg:false,limitAt:-99};
 let scene=null,cam=null,sprite=null,lamp=null,horizon=null,horizonMat=null,fogRef=null,mouthLamp=null;
 let hp={x:0,z:CFG.zStart,y:0},camPos=null,pitch=0,walked=0,fade=null;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};

 /* ---------- relevo: função simples, igual para a malha e para a altura do jogador ---------- */
 const hAt=(x,z)=>{const k=clamp((2-z)/10,0,1);return k*(.28*Math.sin(x*.19)*Math.cos(z*.15)+.18*Math.sin(x*.43+z*.37)+.12*Math.sin(z*.08))};

 /* ---------- andar -4: carve da sala + objeto 'stairs' ---------- */
 function placeStairs(seed){
  stairsObj=undefined;
  const R=rng((((+seed||1)*2246822519)+131)|0),yb=BD[6].y,w=CFG.stairW,h=CFG.stairH,dy=yb+23,ry=yb+24;
  for(let t=0;t<160;t++){
   const x0=6+Math.floor(R()*(W-w-12)),dx=x0+1;
   if(T[(yb+22)*W+dx]!==1)continue;
   let ok=ry+h<H-1;
   for(let y=dy;ok&&y<=ry+h;y++)for(let x=x0-1;x<=x0+w;x++){if(T[y*W+x]!==0){ok=false;break}}
   if(!ok)continue;
   for(let y=ry;y<ry+h;y++)for(let x=x0;x<x0+w;x++)T[y*W+x]=1;
   T[dy*W+dx]=1;const d={t:'door',x:dx,y:dy,w:1,axis:'h',open:false};OBJ.push(d);OB[dy*W+dx]=d;
   for(const s of[-1,0,1])K[(dy+s)*W+dx]=1;
   RM[6].push({x:x0,y:ry,w,h,cx:x0+1,cy:ry+(h>>1),b:6,stair:true});
   const o={t:'stairs',x:x0,y:ry,w,h,dx,dy};OBJ.push(o);stairsObj=o;return o}
  return null}
 function getStairs(){
  if(stairsObj===undefined){stairsObj=(typeof OBJ!=='undefined'&&OBJ&&OBJ.find(o=>o.t==='stairs'))||null}
  return stairsObj}
 function stairHeight(px,py){
  const s=getStairs();if(!s||active)return 0;
  if(px<s.x||px>=s.x+s.w||py<s.y+CFG.run0)return 0;
  return CFG.rise*clamp((py-(s.y+CFG.run0))/CFG.runLen,0,1)}

 /* ---------- malha da escadaria (chamado por buildObject3D) ---------- */
 function buildStairs(o,group){
  const cx=o.x+o.w/2,z0=o.y+CFG.run0,n=13,depth=CFG.runLen/n,riser=CFG.rise/n,iw=o.w-.24;
  const conc=[0x77776f,0x68685f],metal=0x3d4448,rust=0x5b4635;
  for(let i=0;i<n;i++){const top=(i+1)*riser;addBox(group,cx,z0+(i+.5)*depth,iw,top,depth,conc[i&1],{roughness:.97})}
  const landZ0=z0+CFG.runLen,landLen=o.y+o.h-landZ0;
  addBox(group,cx,landZ0+landLen/2,iw,CFG.rise,landLen,0x5f5f58,{roughness:.97});
  // corrimãos inclinados + postes
  const L=Math.hypot(CFG.runLen,CFG.rise),ang=-Math.atan2(CFG.rise,CFG.runLen);
  for(const sx of[o.x+.14,o.x+o.w-.14]){
   const r=addBox(group,sx,z0+CFG.runLen/2,.06,.06,L,metal,{y:CFG.rise/2+.95,roughness:.5,metalness:.4,castShadow:false});r.rotation.x=ang;
   for(let k=0;k<=6;k++){const t=k/6,zz=z0+t*CFG.runLen;addBox(group,sx,zz,.05,.95,.05,metal,{y:CFG.rise*t+.475,roughness:.55,metalness:.35,castShadow:false})}
   addBox(group,sx,landZ0+landLen/2,.06,.06,landLen,metal,{y:CFG.rise+.95,roughness:.5,metalness:.4,castShadow:false})}
  // arco escuro no topo, com luz fria vazando do outro lado
  const archZ=o.y+o.h-.12,hy=CFG.rise;
  for(const sx of[o.x+.42,o.x+o.w-.42])addBox(group,sx,archZ,.34,hy+2.1,.3,0x2b2b29,{roughness:1});
  addBox(group,cx,archZ,o.w-.5,.34,.3,0x2b2b29,{y:hy+2.0,roughness:1});
  const glow=addBox(group,cx,archZ+.1,o.w-1.05,1.85,.03,0xa8b4c2,{y:hy+1.02,castShadow:false});
  glow.material.emissive=new THREE.Color(0x7f93a8);glow.material.emissiveIntensity=.85;
  // duas lâmpadas de parede (iluminação escassa), uma fraca e uma quase morta
  [[.3,o.x+.06],[.78,o.x+o.w-.06]].forEach(([t,xx],i)=>{
   const zz=z0+t*CFG.runLen,l=addBox(group,xx,zz,.1,.14,.22,0x1d1f1e,{y:CFG.rise*t+1.9,castShadow:false});
   const b=addBox(group,xx+(i?-.07:.07),zz,.07,.09,.12,0xffc070,{y:CFG.rise*t+1.9,castShadow:false});
   b.material.emissive=new THREE.Color(0xffa84a);b.material.emissiveIntensity=i?.35:1.1;b.material.transparent=false});
  // entulho e manchas nos degraus
  const rr=rng((o.x*73856093^o.y*19349663)|0);
  for(let k=0;k<7;k++){const i=Math.floor(rr()*n),px=o.x+.3+rr()*(o.w-.6);addBox(group,px,z0+(i+.5)*depth,.1+rr()*.16,.05+rr()*.05,.1+rr()*.14,rr()<.4?rust:0x4a4a46,{y:(i+1)*riser+.03,castShadow:false})}
 }

 /* ---------- áudio: respiração grave e lenta ---------- */
 const Breath=(()=>{
  let n=null;
  function start(){
   try{
    if(n)return;const a=A(),N=Math.floor(a.sampleRate*.25),len=Math.floor(a.sampleRate*7),tmp=new Float32Array(len+N);let last=0;
    for(let i=0;i<tmp.length;i++){last=(last+.02*(Math.random()*2-1))/1.02;tmp[i]=last*3.6}
    const buf=a.createBuffer(1,len,a.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=i<N?tmp[i]*(i/N)+tmp[len+i]*(1-i/N):tmp[i]; // emenda do loop sem estalo
    const src=a.createBufferSource();src.buffer=buf;src.loop=true;
    const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=150;lp.Q.value=.8;
    const o1=a.createOscillator(),o2=a.createOscillator(),g1=a.createGain(),g2=a.createGain();
    o1.type='sine';o1.frequency.value=41;g1.gain.value=.55;o2.type='sine';o2.frequency.value=82;g2.gain.value=.16;
    const breath=a.createGain();breath.gain.value=.5;            // ganho base: o LFO soma ±.45 (inspira/expira ~9 s)
    const lfo=a.createOscillator(),lfoG=a.createGain();lfo.type='sine';lfo.frequency.value=.11;lfoG.gain.value=.45;lfo.connect(lfoG);lfoG.connect(breath.gain);
    const lfo2=a.createOscillator(),lfo2G=a.createGain();lfo2.type='sine';lfo2.frequency.value=.037;lfo2G.gain.value=38;lfo2.connect(lfo2G);lfo2G.connect(lp.frequency); // o filtro "abre" ao inspirar
    const master=a.createGain();master.gain.value=0;
    src.connect(lp);lp.connect(breath);o1.connect(g1);g1.connect(breath);o2.connect(g2);g2.connect(breath);breath.connect(master);master.connect(a.destination);
    src.start();o1.start();o2.start();lfo.start();lfo2.start();n={a,master,srcs:[src,o1,o2,lfo,lfo2]}
   }catch(e){n=null}}
  function level(v){if(!n)return;try{n.master.gain.setTargetAtTime(v*ambientVolume,n.a.currentTime,.5)}catch(e){}}
  function stop(){if(!n)return;const k=n;n=null;try{k.master.gain.setTargetAtTime(0,k.a.currentTime,.25);setTimeout(()=>{for(const s of k.srcs){try{s.stop()}catch(e){}}try{k.master.disconnect()}catch(e){}},900)}catch(e){}}
  return {start,level,stop,get on(){return !!n}}})();

 /* ---------- fade de transição ---------- */
 function ensureFade(){if(fade)return;fade=document.createElement('div');fade.id='abyssFade';fade.innerHTML='<span></span>';document.body.appendChild(fade)}
 function fadeTo(on,ms,done,text){
  ensureFade();fade.style.transitionDuration=ms+'ms';fade.firstChild.textContent=text||'';
  fade.classList.toggle('on',!!on);setTimeout(()=>{if(done)done()},ms+30)}

 /* ---------- cena do Lar do Abismo ---------- */
 function noiseTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=rng(4242);
  g.fillStyle='#8a8a8e';g.fillRect(0,0,128,128);
  for(let i=0;i<2600;i++){const v=90+Math.floor(r()*110);g.fillStyle='rgba('+v+','+v+','+(v+4)+','+(.25+r()*.5).toFixed(2)+')';g.fillRect(Math.floor(r()*128),Math.floor(r()*128),1+Math.floor(r()*2),1+Math.floor(r()*2))}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(36,36);t.colorSpace=THREE.SRGBColorSpace;return t}
 function buildScene(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);fogRef=new THREE.FogExp2(0x040405,CFG.fogNear);scene.fog=fogRef;
  cam=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,420);
  scene.add(new THREE.HemisphereLight(0x646a76,0x060607,.62));
  const moon=new THREE.DirectionalLight(0x9aa6bb,.42);moon.position.set(-24,34,-30);scene.add(moon);
  lamp=new THREE.PointLight(0xffc978,4.2,11,1.45);scene.add(lamp);
  // chão
  const seg=96,size=240,g=new THREE.PlaneGeometry(size,size,seg,seg);g.rotateX(-Math.PI/2);
  const pos=g.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,hAt(pos.getX(i),pos.getZ(i)-60));
  g.computeVertexNormals();
  const ground=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x6c6c72,roughness:1,flatShading:true,map:noiseTexture()}));ground.position.set(0,0,-60);ground.receiveShadow=false;scene.add(ground);
  // pedras e espinhos
  const r=rng(777),rockM=new THREE.MeshStandardMaterial({color:0x242428,roughness:1,flatShading:true}),spireM=new THREE.MeshStandardMaterial({color:0x1a1a1d,roughness:1,flatShading:true});
  for(let i=0;i<84;i++){
   const x=(r()*2-1)*46,z=-8-r()*92;if(Math.abs(x)<4&&z>-16)continue;
   const spire=r()<.35,m=new THREE.Mesh(spire?new THREE.ConeGeometry(.5+r()*.7,3+r()*6,5):new THREE.DodecahedronGeometry(1,0),spire?spireM:rockM);
   if(!spire)m.scale.set(.5+r()*1.8,.5+r()*1.4,.5+r()*1.8);
   m.position.set(x,hAt(x,z-0)+(spire?1.5:.2),z);m.rotation.set((r()-.5)*.3,r()*6.28,(r()-.5)*.3);scene.add(m)}
  // boca da escadaria (volta ao andar -4)
  const mouth=new THREE.Group();mouth.position.set(0,0,CFG.zStart+2.4);scene.add(mouth);
  const conc=new THREE.MeshStandardMaterial({color:0x6a6a63,roughness:.97}),dark=new THREE.MeshStandardMaterial({color:0x020202,roughness:1}),met=new THREE.MeshStandardMaterial({color:0x3d4448,roughness:.5,metalness:.4});
  const bx=(w,h,d,x,y,z,m)=>{const q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);q.position.set(x,y,z);mouth.add(q);return q};
  bx(9,.3,9,0,.15,0,conc);bx(3.2,.04,2.8,0,.32,0,dark);
  bx(.35,.45,3.2,-1.78,.52,0,conc);bx(.35,.45,3.2,1.78,.52,0,conc);bx(3.9,.45,.35,0,.52,-1.5,conc);bx(3.9,.45,.35,0,.52,1.5,conc);
  for(let i=0;i<4;i++)bx(3,.12,.5,0,.3-i*.08,.95-i*.62,i%2?conc:dark);
  for(const sx of[-1.85,1.85]){bx(.07,1.1,.07,sx,1.2,-1.4,met);bx(.07,1.1,.07,sx,1.2,1.4,met);bx(.06,.06,2.9,sx,1.72,0,met)}
  const pole=bx(.12,3.6,.12,3.2,1.8,-1.2,met);const bulb=bx(.3,.2,.3,3.2,3.5,-1.2,dark);bulb.material=new THREE.MeshStandardMaterial({color:0xffd9a0,emissive:0xffa84a,emissiveIntensity:1.4});
  mouthLamp=new THREE.PointLight(0xffb070,2.6,13,1.6);mouthLamp.position.set(3.2,3.3,CFG.zStart+1.2);scene.add(mouthLamp);
  // horizonte
  const tex=new THREE.Texture();tex.colorSpace=THREE.SRGBColorSpace;
  const img=new Image();img.onload=()=>{tex.image=img;tex.needsUpdate=true};img.src=ABYSS_HORIZON_URL;
  horizonMat=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false});
  horizon=new THREE.Mesh(new THREE.PlaneGeometry(CFG.horizonW,CFG.horizonH),horizonMat);horizon.renderOrder=-10;
  horizon.position.set(0,CFG.horizonH*(.5-CFG.horizonLine),CFG.horizonZ);scene.add(horizon);
  sprite=makeBillboard('karl',.82,1.48);sprite.material.depthTest=true;scene.add(sprite);
  camPos=new THREE.Vector3(0,2.7,CFG.zStart+5.2)}

 /* ---------- entrar / sair ---------- */
 function enter(){
  if(active||busy)return;busy=true;for(const k in keys)delete keys[k];beep(90,.9,'sawtooth',.06,40);
  fadeTo(true,800,()=>{
   if(!scene)buildScene();
   active=true;hp={x:0,z:CFG.zStart,y:0};walked=0;pitch=.12;flags={revealMsg:false,nearMsg:false,limitAt:-99};
   camPos.set(0,2.7,CFG.zStart+5.2);horizonMat.opacity=0;fogRef.density=CFG.fogNear;
   document.body.classList.add('inHome');Breath.start();Breath.level(CFG.breathMin);
   fadeTo(false,1500,()=>{busy=false},'');
   say('O ar aqui é denso e frio. Há algo respirando, muito longe.',4600)
  },'LAR DO ABISMO')}
 function exit(){
  if(!active||busy)return;busy=true;for(const k in keys)delete keys[k];
  fadeTo(true,700,()=>{
   const s=getStairs();active=false;document.body.classList.remove('inHome');Breath.stop();
   if(s){P.x=s.x+s.w/2;P.y=s.y+CFG.run0+CFG.runLen-1.8}
   cool=2.5;fadeTo(false,900,()=>{busy=false});
   say('Karl desce a escadaria. O som some atrás dele.',3000)
  })}
 function reset(){active=false;busy=false;cool=0;stairsObj=undefined;Breath.stop();document.body.classList.remove('inHome');if(fade){fade.classList.remove('on')}}

 /* ---------- loop lógico ---------- */
 function mainTick(dt){
  const s=getStairs();if(!s||!P)return;
  if(cool>0)cool-=dt;
  const inX=P.x>=s.x&&P.x<s.x+s.w;
  if(inX&&P.y>=s.y+s.h-.9&&P.y<s.y+s.h&&cool<=0&&!busy){enter();return}
  if(performance.now()/1000-hintAt>25&&Math.abs(P.x-(s.x+1.5))<4&&P.y>s.dy-3&&P.y<s.y+2){hintAt=performance.now()/1000;say('Uma escadaria de concreto sobe para a escuridão. Lá em cima, algo respira.',4200)}}
 function homeTick(dt){
  if(busy)return;
  const ix=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),iy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
  if(ix||iy){
   const l=Math.hypot(ix,iy),legF=(bodyHP.leftLeg+bodyHP.rightLeg)/150,weak=Math.min(hunger,thirst)<=50,base=keys.c?2.2:keys.shift?6.4:4.2;
   const sp=base*Math.max(.35,legF)*(weak?.58:1)*AbyssModule.speedFactor()*dt/l;
   hp.x=clamp(hp.x+ix*sp,-CFG.xLim,CFG.xLim);const nz=hp.z+iy*sp;
   if(nz<CFG.zLimit){hp.z=CFG.zLimit;const t=performance.now()/1000;if(t-flags.limitAt>8){flags.limitAt=t;say('A névoa à frente se fecha como uma garganta. Karl não consegue avançar.',3600)}}
   else hp.z=clamp(nz,CFG.zLimit,CFG.zStart+7)}
  hp.y=hAt(hp.x,hp.z);walked=Math.max(walked,CFG.zStart-hp.z);
  const rev=smooth((CFG.zStart-hp.z-CFG.revealFrom)/(CFG.revealTo-CFG.revealFrom)),prox=clamp((CFG.zStart-hp.z)/(CFG.zStart-CFG.zLimit),0,1);
  Breath.level(CFG.breathMin+(CFG.breathMax-CFG.breathMin)*Math.pow(prox,1.4));
  if(rev>.35&&!flags.revealMsg){flags.revealMsg=true;say('A névoa recua. Algo imenso respira no horizonte, e o chão inteiro sobe e desce com ele.',6200)}
  if(prox>.8&&!flags.nearMsg){flags.nearMsg=true;say('Cada respiração é mais próxima. Não há para onde ir além dele.',5200)}
  const near=Math.hypot(hp.x,hp.z-(CFG.zStart+2.4))<3;if(near&&!$('msg').classList.contains('on'))say('[E] Descer a escadaria',900)}
 function update(dt){if(active)homeTick(dt);else mainTick(dt)}
 function interact(){
  if(busy)return;if(Math.hypot(hp.x,hp.z-(CFG.zStart+2.4))<3.2){exit();return}
  say('Não há nada aqui além do chão cinza e da respiração.',2200)}

 /* ---------- render ---------- */
 function render(t){
  if(!scene)buildScene();
  const w=innerWidth,h=innerHeight;if(cam.aspect!==w/h){cam.aspect=w/h;cam.updateProjectionMatrix()}
  const rev=smooth((CFG.zStart-hp.z-CFG.revealFrom)/(CFG.revealTo-CFG.revealFrom)),prox=clamp((CFG.zStart-hp.z)/(CFG.zStart-CFG.zLimit),0,1);
  horizonMat.opacity=rev;fogRef.density=CFG.fogNear+(CFG.fogFar-CFG.fogNear)*rev;
  // paralaxe sutil: o plano acompanha 92% do deslocamento lateral e balança bem de leve
  horizon.position.x=hp.x*.92+Math.sin(t*.00021)*.5;
  const crouch=keys.c?.55:0,tp=(7+17*prox)*Math.PI/180,dist=14;
  camPos.lerp(new THREE.Vector3(hp.x,hp.y+2.7-crouch,hp.z+5.2),.14);
  pitch+=(tp-pitch)*.04;
  cam.position.copy(camPos);cam.lookAt(camPos.x,camPos.y+Math.tan(pitch)*dist-.25,camPos.z-dist);
  sprite.position.set(hp.x,hp.y,hp.z);sprite.scale.set(.82,keys.c?1.1:1.48,1);
  lamp.visible=playerLit();lamp.position.set(hp.x,hp.y+1.5,hp.z+.3);
  if(mouthLamp)mouthLamp.intensity=2.2+.5*Math.sin(t*.003)+.25*Math.sin(t*.011);
  renderer3D.render(scene,cam)}

 return Object.freeze({placeStairs,buildStairs,stairHeight,update,render,interact,reset,enter,exit,cfg:CFG,
  get active(){return active},get busy(){return busy}})
})();
