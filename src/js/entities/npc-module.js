/* npc-module.js  (v1.7 NOVO)
 * EXPORTA: NPCModule (reset, place, update, sync, busy, cutActive, adv, skip, interact, serialize, restore)
 * DEPENDE DE: AIMap, P, T, OB, OBJ, W, $, say, beep, makeBillboard, scene3D, refreshObjectMesh, bandAt (lidos em tempo de chamada)
 * NÃO PODE ALTERAR: Script clássico. place() roda dentro de gen() (monolith.js), depois do passe de portas.
 * O NPC DOENTE: deita numa cama de um dormitório do Andar 2 (não o de Karl). Quando Karl entra, ele se levanta, anda até a porta (bloqueando a saída),
 * a porta (trancada desde o início, só abre com a Chave do guarda) e roda uma cutscene reaproveitando o overlay #cut (placeholder de imagem). No fim ele destranca a porta e volta à cama.
 */
const NPCModule=(()=>{
 const SENSE=9; // v1.7: raio (tiles) em que o doente percebe Karl, mesmo através da parede
 const LINES=[ // roteiro exato (5 telas)
  'Então é você, a pessoa que veio, desertor?',
  'Não importa, o que importa é que esse lugar está apodrecendo.',
  'Eles vivem tentando remendar, o que já não tem jeito.',
  'Mas há um jeito de sair daqui......me liberte, que eu te ajudarei em sua missão, uma das chaves está com os Guardas....faz dias que eu não me alimento, então eu não acho que aguentaria muito mais tempo.....a decisão é sua.......desertor.....',
  '[ O doente encosta na porta trancada e volta, devagar, para a cama. Só uma chave de guarda a abre. ]'];
 let N=null,sprite=null,idx=0,cutOn=false;
 const doorCells=o=>{const c=[];for(let j=0;j<o.w;j++)c.push((o.y+(o.axis==='v'?j:0))*W+o.x+(o.axis==='h'?j:0));return c};
 function setDoor(o,open){o.open=open;for(const i of doorCells(o))OB[i]=open?null:o;try{refreshObjectMesh(o)}catch(e){}}
 const reset=()=>{N=null;cutOn=false;if(sprite&&sprite.parent)sprite.parent.remove(sprite);sprite=null};
 function place(d){N={rm:{x:d.rm.x,y:d.rm.y,w:d.rm.w,h:d.rm.h},door:{x:d.door.x,y:d.door.y},bed:d.bed,front:d.front,band:d.band,x:d.bed.x+.9,y:d.bed.y+.5,st:'bed',path:null,t:0,met:false}}
 const doorObj=()=>N&&OBJ.find(o=>(o.t==='door')&&o.x===N.door.x&&o.y===N.door.y);
 const inside=()=>P.x>=N.rm.x&&P.x<N.rm.x+N.rm.w&&P.y>=N.rm.y&&P.y<N.rm.y+N.rm.h;
 const goTo=(tx,ty)=>{const p=AIMap.findPath(N.x,N.y,tx,ty,true);N.path=p||[{x:tx,y:ty}];N.t=0};
 function walk(dt,sp){ // anda pelo caminho (ignora colisão: a primeira célula pode ser a própria cama)
  const w=N.path&&N.path[0];if(!w)return true;const dx=w.x-N.x,dy=w.y-N.y,d=Math.hypot(dx,dy),st=sp*dt;
  if(d<=st){N.x=w.x;N.y=w.y;N.path.shift()}else{N.x+=dx/d*st;N.y+=dy/d*st}return !N.path.length}
 function update(dt){
  if(!N||!P)return;
  if(N.st==='bed'){if(!N.met&&bandAt(Math.floor(P.y))===N.band&&Math.hypot(P.x-N.x,P.y-N.y)<=SENSE){
    N.st='walk';const o=doorObj();if(o&&!o.open)o.locked=true;
    say('Algo se move atrás da porta trancada...',3200);try{beep(120,.25,'square',.05,70)}catch(e){}
    goTo(N.front.x+.5,N.front.y+.5)}}
  else if(N.st==='walk'){N.t+=dt;const done=walk(dt,1.15);
   if(done||N.t>8){N.st='cut';startCut()}}
  else if(N.st==='back'){const done=walk(dt,.9);if(done){N.x=N.bed.x+.9;N.y=N.bed.y+.5;N.st='rest'}}}
 const busy=()=>!!N&&(N.st==='walk'||N.st==='cut');
 const cutActive=()=>cutOn;
 function show(){const c=$('cp');c.style.animation='none';void c.offsetWidth;c.style.animation='';
  $('kk').textContent='DORMITÓRIO · ANDAR 2';$('tt').textContent='O DOENTE';$('ph').textContent='[PLACEHOLDER: NPC DOENTE]';
  $('tx').textContent=LINES[idx];$('qq').hidden=true;$('ct').textContent=`CENA ${String(idx+1).padStart(2,'0')} / ${String(LINES.length).padStart(2,'0')}`;
  $('pg').style.width=(idx+1)/LINES.length*100+'%';$('nx').textContent=idx===LINES.length-1?'CONTINUAR ›':'CONTINUAR ›'}
 function startCut(){idx=0;cutOn=true;$('cut').classList.add('on');show()}
 function end(){ // 5ª tela encerra: destranca a porta, NPC volta para a cama
  cutOn=false;$('cut').classList.remove('on');N.met=true; // a porta continua trancada: só abre com a chave do guarda
  N.st='back';goTo(N.bed.x+.9,N.bed.y+.5);say('A porta continua trancada. Procure uma chave com os guardas.',2800)}
 const adv=()=>{if(idx<LINES.length-1){idx++;show()}else end()};
 const skip=()=>{idx=LINES.length-1;show()};
 function interact(){
  if(!N||N.st==='walk'||N.st==='cut'||!N.met)return false;
  if(Math.hypot(P.x-N.x,P.y-N.y)>SENSE/2)return false;
  say('O doente sussurra: "...uma das chaves está com os Guardas... desertor..."',3200);return true}
 function sync(){
  if(!N||typeof scene3D==='undefined'||!scene3D||typeof makeBillboard!=='function')return;
  const lying=N.st==='bed'||N.st==='rest';
  if(!sprite||sprite.userData.lying!==lying){if(sprite&&sprite.parent)sprite.parent.remove(sprite);
   sprite=lying?makeBillboard('patientBed',1.5,1.05):makeBillboard('patient',.85,1.5);sprite.userData.lying=lying;scene3D.add(sprite)}
  sprite.position.set(N.x,lying?.5:.015,N.y)}
 const serialize=()=>N&&{...N,path:null,st:N.st==='cut'||N.st==='walk'?'bed':N.st==='back'?'rest':N.st,x:N.bed.x+.9,y:N.bed.y+.5};
 function restore(d){reset();if(!d)return;N={...d,path:null,t:0}}
 return Object.freeze({reset,place,update,sync,busy,cutActive,adv,skip,interact,serialize,restore,get state(){return N}})
})();
