/* aimap.js
 * EXPORTA: AIMap
 * DEPENDE DE: W, H (constants.js); T, OB (monolith.js) lidos em tempo de chamada
 * v1.7: findPath(...,throughDoors) e doorAt() (guardas abrem portas)
 * NÃO PODE ALTERAR: Script clássico (sem import/export): declarações top-level viram escopo global de script, compartilhado entre os arquivos. a BFS (limite 12000), a ordem das direções nem o uso de Math.random em wander()
 */
/* ---------- AI MAP MODULE v1.3.8 ----------
   Camada única de navegação para criaturas: terreno, obstáculos, visão e movimento.
   Mantém o comportamento ecológico original, mas centraliza a leitura do mapa. */
const AIMap=(()=>{
 const inside=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
 const blocked=(x,y)=>{
  if(!inside(x,y)||T[y*W+x]===0)return true;
  const o=OB[y*W+x];return !!(o&&!(o.open&&(o.t==='door'||o.t==='doubleDoor')));
 };
 /* v1.7 PORTAS: para o cálculo de caminho do guarda, uma porta FECHADA conta como passagem (ele a abre ao chegar). Os demais cálculos continuam tratando-a como bloqueio. */
 const isDoor=o=>!!o&&(o.t==='door'||o.t==='doubleDoor');
 const blockedDoors=(x,y)=>{if(!inside(x,y)||T[y*W+x]===0)return true;const o=OB[y*W+x];return !!(o&&(!isDoor(o)||o.locked))}; // v1.7: porta trancada (NPC) não é passagem
 const doorAt=(x,y)=>{if(!inside(x,y))return null;const o=OB[y*W+x];return isDoor(o)&&!o.open&&!o.locked?o:null};
 const walkable=(x,y)=>!blocked(Math.floor(x),Math.floor(y));
  const nearestWalkable=(x,y)=>{
   const sx=Math.max(1,Math.min(W-2,Math.floor(x))),sy=Math.max(1,Math.min(H-2,Math.floor(y)));
   for(let radius=0;radius<Math.max(W,H);radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    if(radius&&Math.abs(dx)!==radius&&Math.abs(dy)!==radius)continue;
    const nx=sx+dx,ny=sy+dy;if(!blocked(nx,ny))return {x:nx+.5,y:ny+.5};
   }
   return null;
  };
 const lineOfSight=(ax,ay,bx,by)=>{
  const dist=Math.hypot(bx-ax,by-ay),steps=Math.max(1,Math.ceil(dist*10));
  for(let n=1;n<steps;n++)if(blocked(Math.floor(ax+(bx-ax)*n/steps),Math.floor(ay+(by-ay)*n/steps)))return false;
  return true;
 };
 const findPath=(ax,ay,bx,by,throughDoors)=>{
  const bl=throughDoors?blockedDoors:blocked; // v1.7: 5º argumento opcional
  const sx=Math.floor(ax),sy=Math.floor(ay),gx=Math.floor(bx),gy=Math.floor(by);
  if(!inside(sx,sy)||!inside(gx,gy)||bl(gx,gy))return null;
  const start=sy*W+sx,goal=gy*W+gx,prev=new Int32Array(W*H).fill(-1),queue=[start];
  prev[start]=start;let head=0,found=false;
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  while(head<queue.length&&queue.length<Math.min(W*H,12000)){
   const cur=queue[head++];if(cur===goal){found=true;break}
   const cx=cur%W,cy=(cur/W)|0;
   for(const [dx,dy] of dirs){const nx=cx+dx,ny=cy+dy,n=ny*W+nx;if(prev[n]===-1&&!bl(nx,ny)){prev[n]=cur;queue.push(n)}}
  }
  if(!found)return null;const path=[];let cur=goal;
  while(cur!==start){path.push({x:cur%W+.5,y:((cur/W)|0)+.5});cur=prev[cur];if(cur<0)return null}
  path.reverse();return path;
 };
 const move=(actor,tx,ty,speed,radius,dt)=>{
  const dx=tx-actor.x,dy=ty-actor.y,d=Math.hypot(dx,dy);if(d<.035)return;
  const step=Math.min(d,Math.max(0,speed)*dt),mx=dx/d*step,my=dy/d*step;
  const can=(x,y)=>!blocked(Math.floor(x-radius),Math.floor(y-radius))&&!blocked(Math.floor(x+radius),Math.floor(y-radius))&&!blocked(Math.floor(x-radius),Math.floor(y+radius))&&!blocked(Math.floor(x+radius),Math.floor(y+radius));
  const nx=actor.x+mx,ny=actor.y+my;
  if(can(nx,actor.y))actor.x=nx;
  if(can(actor.x,ny))actor.y=ny;
 };
 const wander=(actor,speed,radius,dt)=>{
  if(actor.heading===undefined)actor.heading=Math.random()*Math.PI*2;
  actor.decision=(actor.decision||0)-dt;
  if(actor.decision<=0){actor.heading+=(Math.random()-.5)*2.6;actor.decision=1+Math.random()*3;actor.pause=Math.random()<.3?.6+Math.random()*1.6:0}
  if(actor.pause>0){actor.pause-=dt;return}
  const ox=actor.x,oy=actor.y;move(actor,actor.x+Math.cos(actor.heading),actor.y+Math.sin(actor.heading),speed,radius,dt);
  if(Math.hypot(actor.x-ox,actor.y-oy)<speed*dt*.3){actor.heading=Math.random()*Math.PI*2;actor.decision=.4}
 };
 return Object.freeze({walkable,nearestWalkable,lineOfSight,findPath,move,wander,doorAt});
})();
