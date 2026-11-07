/* vision-fx.js
 * EXPORTA: VisionFX (render)
 * DEPENDE DE: THREE, camera3D, GuardModule, AIMap, P, mode, combatActive, AbyssHome, playerLit (todos em tempo de chamada)
 * NÃO PODE ALTERAR: Script clássico (sem import/export). Carregar DEPOIS de guard-module.js e monolith.js. render() é chamado no fim de draw(),
 *   porque usa as matrizes da câmera já atualizadas pelo renderer.
 */
/* ---------- VisionFX (v1.5.0) ----------
   Desenha NO CANVAS 2D (por cima do mundo 3D) o cone de luz da lanterna de cada guarda acordado do andar do jogador:
   polígono recortado por paredes (raycast no mapa lógico) + gradiente radial. Também desenha o anel de ruído do jogador,
   o "?" / "!" de alerta dos guardas e o pequeno painel RUÍDO / LUZ. */
const VisionFX=(()=>{
 let cv=null,cx=null,hud=null,v3=null,lastHud='';
 const TINT={patrol:[255,238,196],talk:[255,238,196],sleepy:[255,238,196],elevWalk:[255,238,196],investigate:[255,190,90],chase:[255,84,62],flee:[255,150,60]};
 const NOISE_LABEL={idle:['PARADO',0],crouch:['AGACHADO',1],walk:['ANDANDO',3],run:['CORRENDO',4]};
 function ensure(){
  if(cv)return;
  cv=document.createElement('canvas');cv.id='visionCanvas';cv.setAttribute('aria-hidden','true');document.body.appendChild(cv);cx=cv.getContext('2d');
  hud=document.createElement('div');hud.id='noiseHud';hud.setAttribute('aria-live','off');document.body.appendChild(hud)}
 const proj=(x,y,z,w,h)=>{if(!v3)v3=new THREE.Vector3();v3.set(x,z,y).project(camera3D);return {x:(v3.x*.5+.5)*w,y:(-v3.y*.5+.5)*h,z:v3.z}};
 function drawCone(c,w,h,t){
  const N=34,step=.3,steps=Math.ceil(c.range/step),pts=[];
  for(let i=0;i<=N;i++){
   const ang=c.a-c.half+2*c.half*i/N,ca=Math.cos(ang),sa=Math.sin(ang);let d=0,hitWall=false;
   for(let s=1;s<=steps;s++){const dd=s*step;if(!AIMap.walkable(c.x+ca*dd,c.y+sa*dd)){hitWall=true;break}d=dd}
   d=Math.min(c.range,d+(hitWall?.2:0));pts.push(proj(c.x+ca*d,c.y+sa*d,.05,w,h))}
  const o=proj(c.x,c.y,.05,w,h);let R=1;for(const p of pts)R=Math.max(R,Math.hypot(p.x-o.x,p.y-o.y));
  const col=TINT[c.state]||TINT.patrol,flick=.9+.1*Math.sin(t*13+c.x*3.1),a=(c.state==='chase'?.46:.34)*flick;
  const g=cx.createRadialGradient(o.x,o.y,0,o.x,o.y,R);
  g.addColorStop(0,'rgba('+col+','+(a*1.1).toFixed(3)+')');g.addColorStop(.55,'rgba('+col+','+(a*.42).toFixed(3)+')');g.addColorStop(1,'rgba('+col+',0)');
  cx.beginPath();cx.moveTo(o.x,o.y);for(const p of pts)cx.lineTo(p.x,p.y);cx.closePath();cx.fillStyle=g;cx.fill();
  cx.lineWidth=1;cx.strokeStyle='rgba('+col+',.10)';cx.stroke()}
 function drawMark(c,w,h){
  const p=proj(c.x,c.y,1.95,w,h);let ch='',color='';
  if(c.state==='chase'){ch='!';color='#ff5a46'}else if(c.state==='flee'){ch='!!';color='#ffa040'}else if(c.state==='investigate'){ch='?';color='#ffc15a'}
  if(ch){cx.font='bold 22px Georgia,serif';cx.textAlign='center';cx.textBaseline='middle';cx.lineWidth=4;cx.strokeStyle='rgba(0,0,0,.8)';cx.strokeText(ch,p.x,p.y);cx.fillStyle=color;cx.fillText(ch,p.x,p.y)}
  else if(c.sus>.05){const bw=28,bh=4;cx.fillStyle='rgba(0,0,0,.6)';cx.fillRect(p.x-bw/2-1,p.y-bh/2-1,bw+2,bh+2);cx.fillStyle='#ffd070';cx.fillRect(p.x-bw/2,p.y-bh/2,bw*Math.min(1,c.sus),bh)}}
 function drawNoiseRing(r,w,h){
  if(r<=0)return;cx.beginPath();
  for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,p=proj(P.x+Math.cos(a)*r,P.y+Math.sin(a)*r,.05,w,h);if(i)cx.lineTo(p.x,p.y);else cx.moveTo(p.x,p.y)}
  cx.lineWidth=1.5;cx.setLineDash([5,7]);cx.strokeStyle='rgba(190,215,255,.22)';cx.stroke();cx.setLineDash([])}
 function updateHud(show){
  if(!hud)return;
  if(!show){if(lastHud!=='hide'){hud.style.visibility='hidden';lastHud='hide'}return}
  const n=GuardModule.noiseStatus(),L=NOISE_LABEL[n.mode]||NOISE_LABEL.idle,lit=typeof playerLit==='function'?playerLit():true;
  const key=n.mode+'|'+lit;if(key===lastHud)return;lastHud=key;
  hud.style.visibility='visible';
  hud.innerHTML='<span class="nz">RUÍDO <i class="bars">'+'▮'.repeat(L[1])+'<u>'+'▮'.repeat(4-L[1])+'</u></i> '+L[0]+(n.radius?' · '+n.radius+'m':'')+'</span><span class="lt'+(lit?' on':'')+'">LUZ '+(lit?'ACESA':'APAGADA')+' [F]</span>'}
 function render(){
  try{
   ensure();
   const w=innerWidth,h=innerHeight,dpr=Math.min(2,window.devicePixelRatio||1);
   if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
   cx.setTransform(dpr,0,0,dpr,0,0);cx.clearRect(0,0,w,h);
   const homeOn=typeof AbyssHome!=='undefined'&&AbyssHome.active;
   if(mode!=='game'||combatActive||homeOn||!camera3D||!P){updateHud(false);return}
   const t=performance.now()/1000,cones=GuardModule.cones();
   drawNoiseRing(GuardModule.noiseStatus().radius,w,h);
   cx.globalCompositeOperation='lighter';
   for(const c of cones)drawCone(c,w,h,t);
   cx.globalCompositeOperation='source-over';
   for(const c of cones)drawMark(c,w,h);
   updateHud(true)
  }catch(err){if(!render.warned){render.warned=1;console.warn('ABISM: VisionFX falhou.',err)}}}
 return Object.freeze({render})
})();
