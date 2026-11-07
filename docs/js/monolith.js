/* monolith.js
 * EXPORTA: todo o estado e a lógica do jogo ainda não extraídos (gen, upd, draw, combate, inventário, ABISM, ...)
 * DEPENDE DE: constants.js, utils.js, audio.js, localization.js (antes); textures.js, aimap.js, guard-module.js (antes); mobile.js (depois)
 * NÃO PODE ALTERAR: Script clássico (sem import/export): declarações top-level viram escopo global de script, compartilhado entre os arquivos. nada nesta rodada: o antigo IIFE (()=>{...})() foi removido para que os arquivos compartilhem o escopo; o corpo é cópia literal
 */
const NOTE=SC[4][4];
let mode='menu',mi=0,ci=0;

/* ---------- áudio procedural ---------- */

/* ---------- menu ---------- */
const MI=['Play','Continue','Settings','Visual','Quit'];
$('mi').innerHTML=MI.map((t,i)=>`<div class="mi" data-i="${i}">${t}</div>`).join('');
const mis=[...document.querySelectorAll('.mi')];
const selM=i=>{mi=i;mis.forEach((e,j)=>e.classList.toggle('on',j==i))};selM(0);
function toast(t){$('mtoast').textContent=t;setTimeout(()=>$('mtoast').textContent='',2200)}
function menuAct(){if(mi==0)startCut();else if(mi==1)openContinue();else if(mi==2)openSettings();else toast(['','','','VISUAL: EM BREVE','NÃO É POSSÍVEL SAIR... AINDA.'][mi])}

mis.forEach((e,i)=>{e.onmouseenter=()=>selM(i);e.onclick=()=>{selM(i);menuAct()}});
async function openContinue(){const panel=$('continuePanel');panel.classList.remove('on');void panel.offsetWidth;panel.classList.add('on');panel.setAttribute('aria-hidden','false');}
function closeContinue(){const panel=$('continuePanel');panel.classList.remove('on');panel.setAttribute('aria-hidden','true')}
$('continueBack').onclick=closeContinue;$('continuePanel').addEventListener('click',e=>{if(e.target===$('continuePanel'))closeContinue()});
$('loadSaveButton').onclick=()=>{closeContinue();loadGame()};
$('deleteSaveButton').onclick=async()=>{const L=LANG[language]||LANG['pt-BR'];if(!confirm(L.deleteConfirm))return;try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).delete('bedSave');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});toast(L.deleted)}catch(e){console.warn('Falha ao excluir salvamento:',e);toast(L.loadFail)}};

/* ---------- configurações e localização ---------- */
let language=localStorage.getItem('abism_language')||'pt-BR';
try{ambientVolume=Number(localStorage.getItem('abism_ambient')??50)/100}catch(e){ambientVolume=.5}
function openSettings(){applyLanguage();$('languageSelect').value=language;$('ambientVolume').value=Math.round(ambientVolume*100);$('ambientValue').textContent=Math.round(ambientVolume*100)+'%';$('settingsPanel').classList.add('on');$('settingsPanel').setAttribute('aria-hidden','false')}
function closeSettings(){$('settingsPanel').classList.remove('on');$('settingsPanel').setAttribute('aria-hidden','true')}
$('settingsClose').onclick=closeSettings;$('languageSelect').onchange=e=>{language=e.target.value;localStorage.setItem('abism_language',language);applyLanguage()};$('ambientVolume').oninput=e=>{ambientVolume=Number(e.target.value)/100;$('ambientValue').textContent=e.target.value+'%';localStorage.setItem('abism_ambient',e.target.value);if(ng&&ac)ng.gain.setTargetAtTime(.05*ambientVolume,ac.currentTime,.04)};
applyLanguage();


/* ---------- cutscene ---------- */
function showScene(){const s=ABISM.Localization.getScene(ci,language),c=$('cp');c.style.animation='none';void c.offsetWidth;c.style.animation='';
$('kk').textContent=s[0];$('tt').textContent=s[1];$('ph').textContent='PLACEHOLDER_VISUAL_0'+(ci+1)+' — '+s[2];$('tx').textContent=s[3];
$('qq').hidden=!s[4];$('qq').textContent=s[4]||'';$('ct').textContent=`CENA ${String(ci+1).padStart(2,'0')} / ${String(SC.length).padStart(2,'0')}`;
$('pg').style.width=(ci+1)/SC.length*100+'%';$('nx').textContent=ci==SC.length-1?(language==='en-US'?'ENTER THE ASYLUM ›':'ENTRAR NO ASILO ›'):(language==='en-US'?'CONTINUE ›':'CONTINUAR ›')}
function startCut(){mode='cut';ci=0;$('cut').classList.add('on');stat(1);showScene()}
const adv=()=>{if(NPCModule.cutActive()){NPCModule.adv();return} /* v1.7: o overlay #cut também serve à cutscene do NPC */if(ci<SC.length-1){ci++;showScene()}else teleport()};
$('nx').onclick=adv;$('sk').onclick=()=>NPCModule.cutActive()?NPCModule.skip():teleport();
function toMenu(){stat(0);AbyssHome.reset();GuardBattle.close();mode='menu';document.body.classList.remove('ing');$('cut').classList.remove('on');$('end').classList.remove('on');$('tp').classList.remove('on')}

/* ---------- teletransporte ---------- */
function teleport(){
 if(mode=='tp')return;mode='tp';stat(0);$('end').classList.remove('on');
 const s=Math.floor(Math.random()*900000)+100000;
 $('tpt').textContent=`ALEMANHA 1940 → EICHENFELD · SEED #${s}`;
 const tp=$('tp');tp.classList.remove('on');void tp.offsetWidth;tp.classList.add('on');
 beep(70,1.6,'sawtooth',.12,1400);beep(900,.4,'square',.04,60);
 setTimeout(()=>{gen(s);$('cut').classList.remove('on');document.body.classList.add('ing');rs();stat(1)},700);
 setTimeout(()=>{tp.classList.remove('on');mode='game';last=performance.now();lastSave=0;requestAnimationFrame(loop)},1900);
}

/* ---------- geração procedural ---------- */
let fleeGrace=0,_hudCache='';
let T,K,OB,OBJ,RM,P,seed,have,expl,mmc=$('mm').getContext('2d'),elapsed,curB,guard,inventory=Array(36).fill(null),selectedSlot=null,hunger=100,hungerClock=0,thirst=100,thirstClock=0,sleep=100,sleepClock=0,rats=[],roaches=[],burrows=[],organicMatter=[],populations={rats:24,roaches:36},ecoClock=0,lastSave=0,bodyHP={head:35,torso:100,neck:45,shoulders:60,leftArm:65,rightArm:65,leftLeg:75,rightLeg:75,feet:55};
let equipped={};
/* ---------- arquitetura modular ABISM ----------
   Módulos isolados por responsabilidade; comunicação entre eles via eventos.
   Mantemos o pacote em um único HTML para distribuição offline simples. */
const ABISM=(()=>{
 const listeners=new Map();
 const Events={on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return()=>listeners.get(name)?.delete(fn)},emit(name,payload){for(const fn of listeners.get(name)||[])try{fn(payload)}catch(err){console.error('ABISM event:',name,err)}}};
 const Data={items:Object.freeze({lantern:{id:'lantern',name:'Lamparina',type:'tool',stackable:false},knife:{id:'knife',name:'Faca',type:'weapon',damage:18,stackable:false},ratMeat:{id:'rat_meat',name:'Carne de rato',type:'food'},roach:{id:'roach',name:'Barata',type:'food'}}),recipes:Object.freeze([]),enemies:Object.freeze({corruptedGuard:{id:'corrupted_guard',name:'Corrupted Guard'}})};
 const Inventory={maxStack:999,add(slots,item,amount=1){if(!item)return false;let left=Math.max(1,amount|0);if(item.stackable!==false){for(const slot of slots){if(slot&&slot.name===item.name&&slot.type===item.type&&(slot.desc||'')===(item.desc||'')){const moved=Math.min(this.maxStack-(slot.count||1),left);slot.count=(slot.count||1)+moved;left-=moved;if(!left)return true}}}while(left>0){const i=slots.findIndex(v=>v===null);if(i<0)return false;const count=Math.min(this.maxStack,left);slots[i]={...item,count};left-=count}return true},
 Crafting:{resolve(items,recipes=Data.recipes){const ids=items.filter(Boolean).map(x=>x.id||x.name).sort();for(const recipe of recipes){const need=[...recipe.inputs].sort();if(ids.length===need.length&&ids.every((v,i)=>v===need[i]))return {...recipe.output}}return null}}
 };
 const Status={changeMind(delta){mind=Math.max(0,Math.min(100,mind+delta));Events.emit('OnSanityChanged',{value:mind,delta});return mind},damageBody(part,damage){if(!(part in bodyHP))return 0;const before=bodyHP[part];bodyHP[part]=Math.max(0,before-Math.max(0,damage));Events.emit('OnBodyChanged',{part,value:bodyHP[part],damage:before-bodyHP[part]});return bodyHP[part]}};
 const Combat={state:'exploration',turn:'none',enter(){this.state='battle';this.turn='player';Events.emit('CombatEntered',{})},enemy(){this.turn='enemy';Events.emit('CombatTurnChanged',{turn:this.turn})},player(){this.turn='player';Events.emit('CombatTurnChanged',{turn:this.turn})},exit(){this.state='exploration';this.turn='none';Events.emit('CombatExited',{})}};
 const Time={rest(hours){const gains={1:22,4:58,8:100};return {sleepGain:gains[hours]||0,hungerCost:Math.round(hours*1.5),minutes:hours*60}}};
 const Localization={getScene(index,lang){return (lang==='en-US'?SC_EN:SC)[index]}};
 return Object.freeze({Events,Data,Inventory,Status,Combat,Time,Localization});
})();
ABISM.Events.on('OnSanityChanged',()=>{if(combatActive)refreshCombat()});
ABISM.Events.on('OnBodyChanged',()=>{if(typeof renderBodyStatus==='function')renderBodyStatus();if(combatActive)refreshCombat()});
ABISM.Events.on('InventoryChanged',()=>{if($('invPanel').classList.contains('on')&&typeof renderInventory==='function')renderInventory()});
function addItem(item,amount=1){
 if(!item)return false;if(item.type==='food'&&!item.tags)item={...item,tags:['consumivel']};
 const ok=ABISM.Inventory.add(inventory,item,amount);if(!ok)say('Inventário cheio!');else ABISM.Events.emit('InventoryChanged',{inventory});return ok;
}
function gen(s){
 AbyssHome.reset();GuardBattle.close();worldNeedsBuild=true;cameraAngleIndex=0;cameraAngleTarget=0;
 seed=s;const R=rng(s),r=(a,b)=>a+Math.floor(R()*(b-a+1));
 T=new Uint8Array(W*H);K=new Uint8Array(W*H);OB=new Array(W*H).fill(null);OBJ=[];RM=[[],[],[],[],[],[],[],[],[],[]]; /* v1.7: 10 listas (banda 7 = Jardim; 9 = Ala de Cirurgia) */
 have=[0,0,0];inventory=Array(36).fill(null);equipped={leftHand:'Lamparina',rightHand:'Faca'};addItem({name:'Lamparina',type:'tool',desc:'Lamparina inicial equipada na mão esquerda.'});addItem({name:'Faca',type:'weapon',damage:18,desc:'Faca simples equipada na mão direita.'});for(const it of inventory)if(it)ITEMDB[it.name]={...it,count:1};inventory=Array(36).fill(null);hunger=100;hungerClock=0;thirst=100;thirstClock=0;sleep=100;sleepClock=0;rats=[];roaches=[];burrows=[];organicMatter=[];populations={rats:24,roaches:36};ecoClock=0;lastSave=0;bodyHP={head:35,torso:100,neck:45,shoulders:60,leftArm:65,rightArm:65,leftLeg:75,rightLeg:75,feet:55};selectedSlot=null;guard=null;GuardModule.reset();expl=new Uint8Array(W*H);mmc.clearRect(0,0,W,H);elapsed=0;curB=-1;
 const cv=(x1,y1,x2,y2,st,by)=>{for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){if(x<1||y<1||x>W-2||y>H-2)continue;const i=y*W+x;T[i]=st&&(y==by||y==by-1)?2:(T[i]||1);K[i]=1}};
 const link=(a,b,cw,st,by)=>{if(R()<.5){cv(Math.min(a.cx,b.cx),a.cy,Math.max(a.cx,b.cx)+cw-1,a.cy+cw-1,st,by);cv(b.cx,Math.min(a.cy,b.cy),b.cx+cw-1,Math.max(a.cy,b.cy)+cw-1,st,by)}else{cv(a.cx,Math.min(a.cy,b.cy),a.cx+cw-1,Math.max(a.cy,b.cy)+cw-1,st,by);cv(Math.min(a.cx,b.cx),b.cy,Math.max(a.cx,b.cx)+cw-1,b.cy+cw-1,st,by)}};
 const bsp=(x,y,w,h,bi)=>{const b=BD[bi],m=b.m,cH=w>=2*m,cV=h>=2*m;
  if((cH||cV)&&(w>b.x||h>b.x||R()<.6)){const hor=cH&&cV?(w>h*1.25?false:h>w*1.25?true:R()<.5):cV;let a,c;
   if(hor){const s=r(m,h-m);a=bsp(x,y,w,s,bi);c=bsp(x,y+s,w,h-s,bi)}else{const s=r(m,w-m);a=bsp(x,y,s,h,bi);c=bsp(x+s,y,w-s,h,bi)}
   link(a,c,b.cw);return R()<.5?a:c}
  const rw=r(Math.min(4,w-2),w-2),rh=r(Math.min(4,h-2),h-2),rx=x+r(1,w-rw-1),ry=y+r(1,h-rh-1);
  const rm={x:rx,y:ry,w:rw,h:rh,cx:rx+(rw>>1),cy:ry+(rh>>1),b:bi};
  for(let j=ry;j<ry+rh;j++)for(let i=rx;i<rx+rw;i++)T[j*W+i]=1;RM[bi].push(rm);return rm};
 for(let i=0;i<5;i++)bsp(0,BD[i].y,W,i===0?48:BD[i].h,i);
 const F2=(()=>{
  const out={director:null,spawn:null,lobbyTop:null};
  const carve=(x1,y1,x2,y2,k)=>{for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){T[y*W+x]=1;if(k)K[y*W+x]=1}};
  const mk=(x,y,w,h,b,ex)=>{carve(x,y,x+w-1,y+h-1,0);const rm=Object.assign({x,y,w,h,cx:x+(w>>1),cy:y+(h>>1),b},ex);RM[b].push(rm);return rm};
  /* Porta sempre ocupa um vão na PAREDE (T=0 dos dois lados no eixo da parede); axis 'h' = parede horizontal, 'v' = parede vertical. */
  const door=(x,y,axis,w)=>{w=w||1;const d={t:w===2?'doubleDoor':'door',x,y,w,axis,open:false};for(let j=0;j<w;j++){const xx=x+(axis==='h'?j:0),yy=y+(axis==='v'?j:0);T[yy*W+xx]=1;OB[yy*W+xx]=d;for(const s of[-1,0,1])K[(yy+(axis==='h'?s:0))*W+xx+(axis==='v'?s:0)]=1}OBJ.push(d);return d};
  const y0=BD[5].y;
  /* corredores das alas A/B e conector vertical até a biblioteca */
  carve(3,y0+16,73,y0+17,1);carve(3,y0+48,73,y0+49,1);carve(72,y0+16,73,y0+49,1);
  for(const base of[0,32])for(let k=0;k<7;k++){const x=3+k*10;
   if(base===0&&k===0){const lb=mk(x,y0+5,9,10,5,{bedroom:false,lobby:true,top:true}),bot=mk(x,y0+19,9,4,5,{bedroom:true,top:false,spawnRoom:true});door(x+4,y0+15,'h');door(x+4,y0+18,'h');out.lobbyTop=lb;out.spawn=bot;continue}
   if(base===0&&k>=5)continue; /* colunas 5-6 da ala A: banheiros */
   /* v1.7 CORREÇÃO DE PAREDES: a coluna 6 (x=63) ficava colada no corredor vertical x=72; com largura 8 sobra a parede x=71 */
   const rw6=k===6?8:9;
   mk(x,y0+base+11,rw6,4,5,{bedroom:true,top:true});mk(x,y0+base+19,rw6,4,5,{bedroom:true,top:false});
   door(x+4,y0+base+15,'h');door(x+4,y0+base+18,'h')}
  /* banheiros coletivos: masculino (norte) e feminino (sul) */
  /* v1.7 CORREÇÃO DE PAREDES: largura 18 (antes 19) deixa a parede x=71 entre o banheiro e o corredor x=72 */
  const wcM=mk(53,y0+9,18,6,5,{bath:'M',top:true}),wcF=mk(53,y0+19,18,6,5,{bath:'F',top:false});
  door(62,y0+15,'h');door(62,y0+18,'h');
  /* biblioteca gigantesca + anexo (ala B) + sala do diretor interna */
  carve(75,y0+2,124,y0+30,0);door(74,y0+16,'v',2);carve(75,y0+34,124,y0+62,0);door(74,y0+48,'v',2);
  for(let x=111;x<=124;x++)T[(y0+11)*W+x]=0;for(let y=y0+2;y<=y0+11;y++)T[y*W+111]=0;
  const dr=mk(112,y0+2,13,9,5,{directorOffice:true});T[0]=T[0];out.director=dr;
  door(117,y0+11,'h',2);door(111,y0+6,'v',1);
  /* elevador no saguão */
  {const lb=out.lobbyTop,ex=lb.x+3,e={t:'elevator',x:ex,y:lb.y,w:2,band:5};OBJ.push(e);OB[lb.y*W+ex]=e;OB[lb.y*W+ex+1]=e;K[(lb.y+1)*W+ex]=1;K[(lb.y+1)*W+ex+1]=1}
  /* Andar -4: o Abismo, só corredores */
  const yb=BD[6].y;for(const yy of[yb+5,yb+13,yb+21])carve(4,yy,123,yy+1,1);for(const xx of[4,42,84,122])carve(xx,yb+5,xx+1,yb+22,1);
  carve(24,yb+7,25,yb+12,1);carve(64,yb+15,65,yb+20,1);carve(104,yb+7,105,yb+12,1);
  {const e={t:'elevator',x:60,y:yb+5,w:2,band:6};OBJ.push(e);OB[(yb+5)*W+60]=e;OB[(yb+5)*W+61]=e}
  out.decorate=(put,r,R)=>{
   const y0=BD[5].y;
   for(const rm of RM[5]){
    if(rm.bath){const M=rm.bath==='M',yT=rm.y,yB=rm.y+rm.h-1,xr=rm.x+rm.w-1,wall=M?yT:yB,basin=M?yB:yT;
     OBJ.push({t:M?'wcSignM':'wcSignF',x:rm.x+(M?9:11),y:rm.y,w:1});
     if(M){for(let x=rm.x+1;x<=rm.x+7;x+=2)put('urinal',x,wall,1);for(let x=rm.x+10;x<=xr-1;x+=2)put('stall',x,wall,1)}
     else for(let x=rm.x+1;x<=xr-1;x+=2)put('stall',x,wall,1);
     for(let x=rm.x+1;x<=xr-2;x+=3)put('sink',x,basin,1);
     put('trash',xr,M?yB-1:yT+1,1);continue}
    if(rm.lobby){put('bench',rm.x+1,rm.y+4,3);put('radiator',rm.x+7,rm.y+5,1);put('couch',rm.x+5,rm.y+8,2);put('armchair',rm.x+1,rm.y+8,1);put('rockhorse',rm.x+7,rm.y+8,1);continue}
    if(!rm.bedroom)continue;
    const ry=rm.top?rm.y:rm.y+rm.h-1,st=rm.top?1:-1;
    put('bed',rm.x+1,ry,2);put('nightstand',rm.x+3,ry,1);
    if(R()<.5)put('desk',rm.x+6,ry,2,{shabby:true}),put('chair',rm.x+6,ry+st,1);else{put('dresser',rm.x+6,ry,1);put('dresser',rm.x+7,ry,1)}
    put('locker',rm.x+8,ry+st,1);if(R()<.5)put('bookcase',rm.x,ry+st*3,1);if(R()<.3)put('radiator',rm.x+r(2,6),ry,1);
    if(R()<.3)put('rockhorse',rm.x+5,ry+st*2,1);
    OBJ.push({t:'rug',x:rm.x+4,y:rm.y+1,w:1,v:r(0,9)});
    for(let n=0;n<2;n++)put(R()<.5?'papers':'trash',rm.x+r(0,rm.w-1),rm.y+r(0,rm.h-1),1)}
   for(const row of[y0+4,y0+7])for(let x=75;x<=109;x++)if(x%9!==0)put('bookcase',x,row,1);
   for(const row of[y0+21,y0+24,y0+27])for(let x=75;x<=122;x++)if(x%9!==0)put('bookcase',x,row,1);
   for(const row of[y0+14,y0+18]){for(const x of[80,90,100,110]){put('table',x,row,2);put('chair',x,row+1,1);put('chair',x+1,row-1,1)}}
   for(const row of[y0+37,y0+40])for(let x=75;x<=122;x++)if(x%9!==0)put('bookcase',x,row,1);
   for(const row of[y0+53,y0+56,y0+59])for(let x=75;x<=122;x++)if(x%9!==0)put('bookcase',x,row,1);
   for(const row of[y0+46,y0+50]){for(const x of[80,90,100,110]){put('table',x,row,2);put('chair',x,row+1,1);put('chair',x+1,row-1,1)}}
   for(let n=0;n<26;n++)put(n%3?'papers':'trash',r(75,123),r(y0+13,y0+19),1);
   for(let n=0;n<26;n++)put(n%3?'papers':'trash',r(75,123),r(y0+45,y0+51),1)};
  out.abyss=()=>{let rb=0,lk=0;for(let n=0;n<1500&&(rb<60||lk<10);n++){const x=r(3,W-4),y=r(yb+5,yb+22);if(T[y*W+x]!==1||OB[y*W+x]||OBJ.some(o=>o.x===x&&o.y===y))continue;if(lk<10&&n%5===0){OBJ.push({t:'leak',x,y,w:1,v:r(0,9),cd:R()*10});lk++}else if(rb<60){OBJ.push({t:'rubble',x,y,w:1,v:r(0,9)});rb++}}};
  return out})();
 /* v1.5: ALA DE CIRURGIA — salas pequenas (7x4) em duas fileiras, corredor central e conexão pela borda oeste */
 const SURG=(()=>{
  const rooms=[],ys=BD[0].y+50;
  const carve=(x1,y1,x2,y2,k)=>{for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){if(x<1||y<1||x>W-2||y>H-2)continue;T[y*W+x]=1;if(k)K[y*W+x]=1}};
  const door=(x,y)=>{const d={t:'door',x,y,w:1,axis:'h',open:false};T[y*W+x]=1;OB[y*W+x]=d;for(const s2 of[-1,0,1])K[y*W+x+s2]=1;K[(y-1)*W+x]=1;K[(y+1)*W+x]=1;OBJ.push(d)};
  carve(3,ys+6,123,ys+7,1);carve(1,2,2,ys+7,1);
  const kinds=['cirurgia','preparo','instrumentos','cirurgia','esteril','recuperacao','cirurgia','instrumentos'];
  for(let k=0;k<15;k++){const x=4+k*8; /* v1.7 CORREÇÃO DE PAREDES: x=4 (antes 3) deixa a parede x=3 ao lado do corredor oeste x=1..2 */
   for(const top of[true,false]){const y=top?ys+1:ys+9;
   carve(x,y,x+6,y+3,0);rooms.push({x,y,w:7,h:4,cx:x+3,cy:y+2,top,kind:kinds[(k+(top?0:3))%kinds.length]});door(x+3,top?ys+5:ys+8)}}
  RM[9]=rooms; // v1.7: antes RM[7]; a banda 7 agora é o Jardim
  const south=[...RM[0]].sort((a,b)=>b.cy-a.cy)[0];if(south)link(south,{cx:1,cy:south.cy},2,0,0);
  OBJ.push({t:'surgSign',x:4,y:ys+6,w:1});
  const decorate=(put)=>{for(const rm of rooms){const far=rm.top?rm.y:rm.y+3,mid=rm.top?rm.y+1:rm.y+2,xr=rm.x+6;
   if(rm.kind==='cirurgia'){put('surgTable',rm.x+2,mid,2);OBJ.push({t:'surgLamp',x:rm.x+2,y:mid,w:2});put('trayTable',rm.x+5,mid,1);put('toolCabinet',rm.x,far,1);put('sink',xr,far,1);put('cart',rm.x+5,far,1)}
   else if(rm.kind==='preparo'){for(const dx of[1,3,5])put('sink',rm.x+dx,far,1);put('locker',rm.x,far,1);put('bench',rm.x+2,mid,3)}
   else if(rm.kind==='instrumentos'){for(let dx=0;dx<=6;dx++)put(dx%3===2?'locker':'toolCabinet',rm.x+dx,far,1);put('trayTable',rm.x+3,mid,1);put('crate',rm.x+1,mid,1)}
   else if(rm.kind==='esteril'){put('autoclave',rm.x+1,far,1);put('autoclave',rm.x+3,far,1);put('table',rm.x+4,mid,2);put('barrel',xr,far,1)}
   else{put('bed',rm.x+1,far,2);put('bed',rm.x+4,far,2);put('ivstand',rm.x+3,mid,1);put('stretcher',rm.x+1,mid,2)}
   if(R()<.5)put('trash',rm.x+r(0,6),mid,1)}};
  return {rooms,decorate}})();
 /* v1.7 CORREÇÃO DE PAREDES: antes link(RM[0],RM[4]) abria corredores que atravessavam as salas da Ala de Cirurgia (sem paredes laterais).
    Agora a Medicação (anexo) liga ao corredor oeste x=1..2 da cirurgia, que já fica fora das salas. */
 for(let k=0;k<2;k++){const a=RM[4][r(0,RM[4].length-1)];cv(1,a.cy,a.cx+1,a.cy+1);cv(1,BD[0].y+57,2,a.cy+1)}
 const near=(x,y)=>K[y*W+x]||K[y*W+x+1]||K[y*W+x-1]||K[y*W+x+W]||K[y*W+x-W];
 const fr=(x,y)=>x>0&&y>0&&x<W-1&&y<H-1&&T[y*W+x]==1&&!OB[y*W+x]&&!near(x,y);
 const put=(t,x,y,w,extra)=>{w=w||1;for(let i=0;i<w;i++)if(!fr(x+i,y))return null;const o=Object.assign({t,x,y,w,v:r(0,9)},extra);OBJ.push(o);for(let i=0;i<w;i++)OB[y*W+x+i]=o;return o};
 const shuf=a=>a.map(v=>[R(),v]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]);
 /* início: menor cela do subterrâneo */
 const sp=F2.spawn;P={x:sp.cx+.5,y:sp.cy+.5,a:0};
 /* v1.3.3: cantina, consultórios e elevadores */
 const sorted0=[...RM[0]].sort((a,b)=>b.w*b.h-a.w*a.h),dirPre=null,cant=sorted0[0],psy=sorted0.slice(1,4);
 for(const bi of[0,2,1,3]){const pool=shuf(RM[bi]).filter(rm=>rm!==sp&&rm.w>=3&&rm.h>=3);const pref=bi==0?pool.filter(rm=>rm!==dirPre&&rm!==cant&&!psy.includes(rm)):pool;let done=0;
  for(const rm of[...pref,...pool]){for(let k=0;k<8&&!done;k++){const ex=rm.x+r(0,Math.max(0,rm.w-2));if(put('elevator',ex,rm.y,2,{band:bi})){K[(rm.y+1)*W+ex]=1;K[(rm.y+1)*W+ex+1]=1;done=1}}if(done)break}}
 /* saída: portão na parede norte de uma sala do asilo */
 for(const rm of shuf(RM[0])){if(rm.w<6)continue;const gx=rm.x+r(1,rm.w-3),gy=rm.y-1;
  if(gy<1||T[gy*W+gx]||T[gy*W+gx+1]||K[gy*W+gx]||K[gy*W+gx+1])continue;
  OBJ.push({t:'gate',x:gx,y:gy,w:2});for(let j=0;j<2;j++)for(let i=0;i<2;i++)K[(rm.y+j)*W+gx+i]=1;break}
 /* mecanismos: um por setor */
 for(const bi of[5,2,3])for(const rm of shuf(RM[bi]).filter(m=>bi!==5||m.directorOffice)){if(rm==sp)continue;let ok=0;const id=bi==5?0:bi==2?1:2;for(let k=0;k<12&&!ok;k++)ok=put('mech',rm.x+r(0,rm.w-1),rm.y,1,{id});if(ok)break}
 const gr=RM[0].find(rm=>rm.w>=4&&rm.h>=4)||RM[0][0],lock=OBJ.find(o=>o.t=='mech'&&o.id==2),gx=gr.cx+.5,gy=gr.cy+.5;const patrol=[{x:gr.x+1.5,y:gr.y+1.5},{x:gr.x+gr.w-1.5,y:gr.y+1.5},{x:gr.x+gr.w-1.5,y:gr.y+gr.h-1.5},{x:gr.x+1.5,y:gr.y+gr.h-1.5}].filter(q=>T[Math.floor(q.y)*W+Math.floor(q.x)]===1);GuardModule.reset();GuardModule.spawnAll(gr,patrol,s);
 for(const rm of shuf(RM[3])){if(put('item',rm.cx,rm.cy,1,{itemName:'Chave inglesa',itemType:'tool',desc:'Ferramenta pesada que pode ser usada em uma das mãos.'}))break;}
 /* Ecossistema: população total inclui indivíduos escondidos nas tocas; só uma fração fica ativa no mapa. */
 let family=0;
 for(const bi of [0,2,4])for(const rm of shuf(RM[bi]).slice(0,Math.min(3,RM[bi].length))){
  const bx=rm.x+Math.max(.7,rm.w/2),by=rm.y+Math.max(.7,rm.h/2);
  const burrow={id:'burrow_'+family,x:bx,y:by,familyId:family,sector:bi};burrows.push(burrow);
  const members=2+(family%3);
  for(let n=0;n<members&&rats.length<8;n++){const rx=bx+(R()-.5)*.8,ry=by+(R()-.5)*.8;rats.push({x:rx,y:ry,homeX:bx,homeY:by,burrowId:burrow.id,familyId:family,phase:R()*6.28,heading:R()*6.28,alive:true,hunt:0,hunger:35+R()*45,state:'forage',decision:0,visible:true})}
  family++;
 }
 for(const bi of [0,1,2,4])for(const rm of shuf(RM[bi]).slice(0,Math.min(4,RM[bi].length))){for(let n=0;n<3&&roaches.length<ECOLOGY.roaches.activeLimit;n++){const cx=rm.x+.6+R()*Math.max(.2,rm.w-1.2),cy=rm.y+.6+R()*Math.max(.2,rm.h-1.2);if(T[Math.floor(cy)*W+Math.floor(cx)]===1&&!OB[Math.floor(cy)*W+Math.floor(cx)])roaches.push({x:cx,y:cy,homeX:cx,homeY:cy,phase:R()*6.28,heading:R()*6.28,alive:true,state:'forage',hunger:20+R()*60,decision:R()*4,foodPath:null,foodTargetIndex:-1,foodRepath:0})}}
 /* Matéria orgânica invisível: pontos de alimento que atraem baratas pelo cheiro. */
 for(let n=0;n<Math.max(18,Math.floor(W*H/170));n++){const x=r(2,W-3),y=r(2,H-3);if(T[y*W+x]===1&&!OB[y*W+x])organicMatter.push({x:x+.5,y:y+.5,amount:1+R()*2,active:true})}
 /* Ala de Cirurgia: algumas baratas (RM[9] fica fora de RM[0] para não ganhar camas/portas extras) */
 for(const rm of shuf(RM[9]).slice(0,3))for(let n=0;n<2;n++)roaches.push({x:rm.cx+.5,y:rm.cy+.5,homeX:rm.cx+.5,homeY:rm.cy+.5,phase:R()*6.28,heading:R()*6.28,alive:true,state:'forage',hunger:20+R()*60,decision:R()*4,foodPath:null,foodTargetIndex:-1,foodRepath:0});
 /* bilhete na cela inicial */
 for(let k=0;k<10;k++)if(put('note',sp.x+r(0,sp.w-1),sp.y+sp.h-1))break;
 /* decoração por tipo de sala */
 for(let bi=0;bi<5;bi++)for(const rm of RM[bi]){
  const yT=rm.y,yB=rm.y+rm.h-1,a=rm.w*rm.h,xr=rm.x+rm.w-1;
  const line=(t,y,st,w)=>{for(let x=rm.x;x+w<=rm.x+rm.w;x+=st)if(R()<.85)put(t,x,y,w)};
  if(bi==0&&rm===cant){line('counter',yT,3,3);put('pillar',rm.x+(rm.w/3|0),rm.y+(rm.h>>1));put('pillar',rm.x+(rm.w*2/3|0),rm.y+(rm.h>>1));
   for(let yy=rm.y+3;yy<yB;yy+=4)for(let x=rm.x+1;x+4<=xr;x+=5){if(put('longTable',x,yy,4))for(let k=0;k<4;k+=1){if(R()<.6)put('cchair',x+k,yy-1,1);if(R()<.6)put('cchair',x+k,yy+1,1)}}
   for(let n=0;n<6;n++)put('trash',rm.x+r(0,rm.w-1),rm.y+r(1,rm.h-1),1);OBJ.push({t:'canteenSign',x:rm.x,y:yB,w:1})}
  else if(bi==0&&psy.includes(rm)){OBJ.push({t:'psychSign',x:rm.x,y:yT,w:1});put('inkboard',rm.x+1,yT,1);put('desk',xr-1,yT,2,{shabby:true});put('couch',rm.x,yB,2);put('bookcase',xr,yB);put('chair',rm.x+2,yT+1,1);for(let n=0;n<4;n++)put('papers',rm.x+r(0,rm.w-1),rm.y+r(1,rm.h-1),1)}
  else if(bi==0){/* v1.7: rm.kind marca o uso da sala: 'ward' (enfermaria) e 'patient' (quarto) têm camas; 'office' é sala administrativa */
   if(a>=45){rm.kind='ward';line('bed',yT,3,2);line('bed',yB,3,2);if(rm.w>=5)put('desk',rm.x+1,yT+1,2)}else if(a<30){rm.kind='patient';put('bed',rm.x,yT,2);put('locker',xr,yT)}else{rm.kind='office';put('desk',rm.x,yT,2);put('locker',xr,yB)}}
  else if(bi==1){if(a>=45){line('tank',yT,2,1);line('table',yB,4,2);if(rm.h>=7&&rm.w>=9)for(let x=rm.x+1;x+2<=xr;x+=4)put('table',x,rm.y+(rm.h>>1),2)}else{line('tank',yT,2,1);put('crate',xr,yB)}}
  else if(bi==2){if(a<=24){put('bed',rm.x,yT,2);put('bucket',xr,yB)}else{line('crate',yT,3,1);line('bed',yB,3,2)}}
   else if(bi==3){line('crate',yT,2,1);put('locker',xr,yB);if(rm.w>=4)put('desk',rm.x+1,yB,2)}
   else{line('tank',yT,2,1);put('table',rm.x,yB,2);if(rm.w>=4)put('desk',Math.max(rm.x, xr-1),yB,1);put('locker',xr,yT)}}
 /* Sala do diretor: uma sala ampla na ala dos pacientes, com mobiliário administrativo. */
 F2.decorate(put,r,R);F2.abyss();SURG.decorate(put);
 const directorRoom=F2.director;
 if(directorRoom){
  directorRoom.directorOffice=true;OBJ.push({t:'directorSign',x:directorRoom.x+Math.min(1,directorRoom.w-1),y:directorRoom.y,w:1});
  const placeOffice=(type,width)=>{for(let yy=directorRoom.y+1;yy<directorRoom.y+directorRoom.h-1;yy++)for(let xx=directorRoom.x+1;xx+width<=directorRoom.x+directorRoom.w-1;xx++){const obj=put(type,xx,yy,width);if(obj)return obj}return null};
  placeOffice('directorDesk',2);placeOffice('bookcase',1);placeOffice('chair',1);placeOffice('cabinet',1);
  if(directorRoom.w>=5&&directorRoom.h>=5)placeOffice('bed',2);
 }
 /* Portas só ocupam vãos reais: chão de sala de um lado, corredor do outro,
    e paredes laterais formando ombreiras. Cada sala recebe no máximo uma porta. */
 const noise2=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,fade=t=>t*t*t*(t*(t*6-15)+10),grad=(gx,gy,dx,dy)=>{const a=hash(gx,gy)*Math.PI*2;return Math.cos(a)*dx+Math.sin(a)*dy},u=fade(fx),v=fade(fy),a=grad(ix,iy,fx,fy),b=grad(ix+1,iy,fx-1,fy),c=grad(ix,iy+1,fx,fy-1),d=grad(ix+1,iy+1,fx-1,fy-1),lerp=(m,n,t)=>m+(n-m)*t;return .5+.5*lerp(lerp(a,b,u),lerp(c,d,u),v)};
 const isWall=(x,y)=>x>0&&y>0&&x<W-1&&y<H-1&&(T[y*W+x]===0||T[y*W+x]===2);
 const usedDoorThresholds=new Set();
 for(let bi=0;bi<5;bi++)for(const rm of RM[bi]){
  const candidates=[];
  const addCandidate=(x,y,axis,insideX,insideY,outX,outY)=>{
   if(T[insideY*W+insideX]!==1||T[outY*W+outX]!==1||OB[y*W+x])return;
   const key=outX+','+outY;if(usedDoorThresholds.has(key))return;
   const before=axis==='h'?[x-1,y]:[x,y-1],after=axis==='h'?[x+1,y]:[x,y+1];
   if(!isWall(...before))return;
   const nx=axis==='h'?x+1:x,ny=axis==='h'?y:y+1;
   const in2x=axis==='h'?nx:insideX,in2y=axis==='h'?insideY:ny;
   const out2x=axis==='h'?nx:outX,out2y=axis==='h'?outY:ny;
   const end=axis==='h'?[x+2,y]:[x,y+2];
   const canDouble=nx<(axis==='h'?rm.x+rm.w:W-1)&&ny<(axis==='v'?rm.y+rm.h:H-1)&&T[in2y*W+in2x]===1&&T[out2y*W+out2x]===1&&!OB[in2y*W+in2x]&&!OB[out2y*W+out2x]&&isWall(...end)&&noise2(x*.37+seed*.001,y*.37+seed*.002)>.58;
   const canSingle=isWall(...after);
   if(!canSingle&&!canDouble)return;
   const double=canDouble;
   candidates.push({x,y,axis,double,outX,outY});
  };
  for(let x=rm.x;x<rm.x+rm.w;x++){
   if(rm.y>1)addCandidate(x,rm.y,'h',x,rm.y+1,x,rm.y-1);
   if(rm.y+rm.h<H-1)addCandidate(x,rm.y+rm.h-1,'h',x,rm.y+rm.h-2,x,rm.y+rm.h);
  }
  for(let y=rm.y;y<rm.y+rm.h;y++){
   if(rm.x>1)addCandidate(rm.x,y,'v',rm.x+1,y,rm.x-1,y);
   if(rm.x+rm.w<W-1)addCandidate(rm.x+rm.w-1,y,'v',rm.x+rm.w-2,y,rm.x+rm.w,y);
  }
  const viable=candidates.filter(c=>Math.hypot(c.x-P.x,c.y-P.y)>4);
  if(!viable.length)continue;
  const c=viable[Math.floor(R()*viable.length)],width=c.double?2:1;
  const door={t:width===2?'doubleDoor':'door',x:c.x,y:c.y,w:width,axis:c.axis,open:false,director:!!rm.directorOffice};
  OBJ.push(door);
  for(let j=0;j<width;j++){const xx=c.x+(c.axis==='h'?j:0),yy=c.y+(c.axis==='v'?j:0);OB[yy*W+xx]=door;usedDoorThresholds.add((c.outX+(c.axis==='h'?j:0))+','+(c.outY+(c.axis==='v'?j:0)));}
 }
 /* v1.7 NPC DOENTE (visível no ANDAR 2): ocupa um dos dormitórios que NÃO seja o de Karl (spawnRoom). O quarto já tem cama e a porta
    para o corredor (a porta do dormitório de cima fica na linha rm.y+rm.h; a do de baixo, em rm.y-1). */
 {NPCModule.reset();
  const cands=shuf(RM[5].filter(rm=>rm.bedroom&&!rm.spawnRoom&&!rm.bath&&rm!==sp&&Math.hypot(rm.cx-P.x,rm.cy-P.y)>12));
  for(const rm of cands){
   const bed=OBJ.find(o=>o.t==='bed'&&o.x>=rm.x&&o.x<rm.x+rm.w&&o.y>=rm.y&&o.y<rm.y+rm.h);if(!bed)continue;
   const dy=rm.top?rm.y+rm.h:rm.y-1,dr=OBJ.find(o=>o.t==='door'&&o.axis==='h'&&o.y===dy&&o.x>=rm.x&&o.x<rm.x+rm.w);if(!dr)continue;
   rm.npcRoom=true;
   dr.locked=true;dr.keyDoor=true; // v1.7: trancada desde o início
   NPCModule.place({rm,door:dr,bed:{x:bed.x,y:bed.y},front:{x:dr.x,y:rm.top?dr.y-1:dr.y+1},band:5});break}}
 /* v1.7 ANEXO JARDIM (banda 7, y 128..191): enorme, aberto, poucas salas gigantes (BSP com m=22 e salas que quase preenchem a folha).
    Ligado ao Andar 1 pelo anexo da Medicação (banda 4), logo acima. Decorado com bancos, arbustos mortos, estátuas, árvores secas e uma fonte. */
 {const gb=BD[7],gm=gb.m,gRooms=[];
  const gbsp=(x,y,w,h,d)=>{d=d|0;const cH=w>=2*gm,cV=h>=2*gm;
   if((cH||cV)&&(d===0||R()<.85)){const hor=cH&&cV?(w>h*1.25?false:h>w*1.25?true:R()<.5):cV;let a,c;
    if(hor){const sy=r(gm,h-gm);a=gbsp(x,y,w,sy,d+1);c=gbsp(x,y+sy,w,h-sy,d+1)}else{const sx=r(gm,w-gm);a=gbsp(x,y,sx,h,d+1);c=gbsp(x+sx,y,w-sx,h,d+1)}
    link(a,c,gb.cw);return R()<.5?a:c}
   const rx=x+r(1,2),ry=y+r(1,2),rw=w-r(3,4),rh=h-r(3,4);
   const rm={x:rx,y:ry,w:rw,h:rh,cx:rx+(rw>>1),cy:ry+(rh>>1),b:7,garden:true,kind:'garden'};
   for(let j=ry;j<ry+rh;j++)for(let i=rx;i<rx+rw;i++)T[j*W+i]=1;RM[7].push(rm);gRooms.push(rm);return rm};
  gbsp(1,gb.y+2,W-2,gb.h-4);
  /* ligação com o anexo da Medicação: corredor vertical de 2 tiles a partir da sala da banda 4 mais próxima do Jardim cuja coluna até y=127 é só parede */
  const cand=RM[4].filter(a=>a.w>=3).sort((a,b)=>(b.y+b.h)-(a.y+a.h));let linked=0,lastX=-99;
  for(const a of cand){if(linked>=2)break;
   for(const cx of[a.cx,a.cx-1,a.cx+1]){let ok=cx>3&&cx<W-5;for(let y=a.y+a.h;y<=gb.y-1&&ok;y++)for(let x=cx-1;x<=cx+2;x++)if(T[y*W+x]!==0){ok=false;break}
    if(!ok||(linked===1&&Math.abs(cx-lastX)<20))continue;
    const J=gRooms.reduce((best,q)=>{const d=cx<q.x?q.x-cx:cx>=q.x+q.w?cx-q.x-q.w+1:0,e=best&&(cx<best.x?best.x-cx:cx>=best.x+best.w?cx-best.x-best.w+1:0);return !best||d<e?q:best},null);
    cv(cx,a.cy,cx+1,J.cy+1);cv(Math.min(cx,J.cx),J.cy,Math.max(cx,J.cx)+1,J.cy+1);lastX=cx;linked++;break}}
  if(!linked){const a=RM[4][RM[4].length-1],J=gRooms[0];cv(1,a.cy,a.cx+1,a.cy+1);cv(1,a.cy,2,J.cy+1);cv(1,J.cy,J.cx,J.cy+1)} // fallback: corredor pela borda oeste
  /* decoração: cada sala recebe objetos de jardim; a maior ganha a fonte no centro */
  const big=[...gRooms].sort((a,b)=>b.w*b.h-a.w*a.h);
  if(big[0]&&big[0].w>=9&&big[0].h>=9){const f=big[0];let placed=false; // os corredores passam pelo centro da sala (K): procura um 3x3 livre perto dele
   for(let rad=0;rad<10&&!placed;rad++)for(let dy=-rad;dy<=rad&&!placed;dy++)for(let dx=-rad;dx<=rad&&!placed;dx++){
    if(rad&&Math.abs(dx)!==rad&&Math.abs(dy)!==rad)continue;const fx=f.cx-1+dx,fy=f.cy+dy;
    let ok=fy-1>f.y&&fy+1<f.y+f.h-1&&fx>f.x&&fx+2<f.x+f.w-1;for(let j=-1;j<=1&&ok;j++)for(let i=0;i<3&&ok;i++)if(!fr(fx+i,fy+j))ok=false;
    if(ok){put('fountain',fx,fy,3);for(const q of[-1,1])put('solidPart',fx,fy+q,3);placed=true}}}
  const spread=(rm,type,n,w)=>{let done=0;for(let t=0;t<n*30&&done<n;t++){const x=rm.x+1+Math.floor(R()*Math.max(1,rm.w-2-(w||1))),y=rm.y+1+Math.floor(R()*Math.max(1,rm.h-2));
    if(OBJ.some(o=>o.garden&&Math.abs(o.x-x)<(type==='deadBush'?2:4)&&Math.abs(o.y-y)<(type==='deadBush'?2:4)))continue;
    if(put(type,x,y,w||1,{garden:true}))done++}};
  for(const rm of gRooms){const a=rm.w*rm.h;
   spread(rm,'bench',Math.max(1,Math.floor(a/420)),3);spread(rm,'statue',Math.max(1,Math.floor(a/650)),1);
   spread(rm,'deadTree',Math.floor(a/330),1);spread(rm,'deadBush',Math.max(2,Math.floor(a/110)),1)}
 }
 /* Celas do setor prisional: camas improvisadas e grades visíveis. */
 const cellRooms=shuf(RM[3].filter(rm=>rm.w>=4&&rm.h>=4)).slice(0,Math.min(5,RM[3].length));
 for(const rm of cellRooms){
  rm.cell=true;
  const bx=rm.x+1,by=rm.y+1;
  const bed=put('bed',bx,by,Math.min(2,rm.w-2),{shabby:true,cellBed:true});
  if(bed)bed.shabby=true;
  OBJ.push({t:'cellBars',x:rm.x+1,y:rm.y,w:Math.max(2,rm.w-2)});
 }
 /* v1.3.7: Subterrâneo — entulho espalhado e goteiras ocasionais */
 {const y0=BD[2].y,y1=y0+BD[2].h;let rb=0,lk=0;for(let n=0;n<900&&(rb<90||lk<16);n++){const x=r(2,W-3),y=r(y0+1,y1-2);if(T[y*W+x]!==1||OB[y*W+x]||OBJ.some(o=>o.x===x&&o.y===y))continue;
  if(lk<16&&n%5===0){OBJ.push({t:'leak',x,y,w:1,v:r(0,9),cd:R()*10});lk++}else if(rb<90){OBJ.push({t:'rubble',x,y,w:1,v:r(0,9)});rb++}}}
 /* Resíduos e macas extras para quebrar a limpeza artificial dos corredores. */
 for(let bi=0;bi<5;bi++)for(const rm of shuf(RM[bi]).slice(0,Math.min(5,RM[bi].length))){
  for(let n=0;n<2;n++){const tx=rm.x+1+r(0,Math.max(0,rm.w-2)),ty=rm.y+1+r(0,Math.max(0,rm.h-2));if(fr(tx,ty))put('trash',tx,ty,1)}
  if((bi===1||bi===3)&&rm.w>=4&&R()<.7)put('stretcher',rm.x+1,rm.y+1,2)
 }
 /* v1.4.4: mobília extra da referência visual (radiador, barril, banco, carrinho). RNG próprio: o layout base da seed não muda. */
 {const R2=rng((s*2654435761+12345)>>>0),r2=(a,b)=>a+Math.floor(R2()*(b-a+1));
  const nearDoor=(x,y)=>{for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const o=OB[(y+j)*W+x+i];if(o&&(o.t==='door'||o.t==='doubleDoor'))return true}return false};
  const put2=(t,x,y,w)=>{w=w||1;if(Math.hypot(x+w/2-P.x,y+.5-P.y)<2.2)return null;for(let i=0;i<w;i++)if(!fr(x+i,y)||nearDoor(x+i,y))return null;const o={t,x,y,w,v:r2(0,9)};OBJ.push(o);for(let i=0;i<w;i++)OB[y*W+x+i]=o;return o};
  for(let bi=0;bi<5;bi++)for(const rm of RM[bi]){
   if(rm.w<3||rm.h<3)continue;const yT=rm.y,yB=rm.y+rm.h-1,xr=rm.x+rm.w-1;
   if([0,3,4].includes(bi)&&R2()<.5)put2('radiator',rm.x+r2(0,rm.w-1),yT,1);
   if([1,2,3].includes(bi)&&R2()<.55)put2('barrel',R2()<.5?xr:rm.x,R2()<.5?yT:yB,1);
   if([0,4].includes(bi)&&rm.w>=5&&R2()<.4)put2('bench',rm.x+r2(0,rm.w-3),yB,3);
   if([0,4].includes(bi)&&R2()<.45)put2('armchair',rm.x+r2(0,rm.w-1),yB,1);
   if([0,4].includes(bi)&&R2()<.3)put2('ivstand',rm.x+r2(0,rm.w-1),yT+1,1);
   if([1,4].includes(bi)&&R2()<.35)put2('cart',rm.x+r2(0,rm.w-1),rm.y+r2(1,Math.max(1,rm.h-2)),1);
  }}
 // Fix 3: a mobília/portas é colocada depois da ecologia inicial; reparar posições agora.
 const clearEcologyCell=(x,y)=>x>0&&y>0&&x<W-1&&y<H-1&&T[y*W+x]===1&&!OB[y*W+x];
 const findEcologyCell=(x,y,reserved=new Set())=>{
  const sx=Math.max(1,Math.min(W-2,Math.floor(x))),sy=Math.max(1,Math.min(H-2,Math.floor(y)));
  for(let radius=0;radius<Math.max(W,H);radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(radius&&Math.abs(dx)!==radius&&Math.abs(dy)!==radius)continue;
   const cx=sx+dx,cy=sy+dy,key=cx+','+cy;
   if(!reserved.has(key)&&clearEcologyCell(cx,cy))return {x:cx+.5,y:cy+.5,key};
  }
  return null;
 };
 const reservedAnimals=new Set();
 for(const b of burrows){const spot=findEcologyCell(b.x,b.y);if(spot){b.x=spot.x;b.y=spot.y}}
 for(const a of [...rats,...roaches])if(a&&a.alive){
  let cx=Math.floor(a.x),cy=Math.floor(a.y),key=cx+','+cy;
  if(!clearEcologyCell(cx,cy)||reservedAnimals.has(key)){const spot=findEcologyCell(a.x,a.y,reservedAnimals);if(spot){a.x=spot.x;a.y=spot.y;key=spot.key}}
  reservedAnimals.add(key);if(a.homeX!==undefined)a.homeX=a.x;if(a.homeY!==undefined)a.homeY=a.y;
 }
 for(const m of organicMatter)if(m.active&&!clearEcologyCell(Math.floor(m.x),Math.floor(m.y))){const spot=findEcologyCell(m.x,m.y);if(spot){m.x=spot.x;m.y=spot.y}else m.active=false}
 AbyssModule.spawn(seed); /* altares (-1..-4) e Coletor de Almas (-2): por último, com rng próprio */
 AbyssHome.placeStairs(seed); /* v1.5.0: escadaria do Andar -4 para o Lar do Abismo (rng próprio, não muda altares/Coletor) */
}

/* ---------- jogo ---------- */
const gameHost=$('g'),keys={};let last=0;
/* v1.5.0 · MÓDULO 1: luz do jogador. [F] acende/apaga a lamparina; os guardas enxergam essa luz de longe. */
let lampOn=true;
function playerLit(){return lampOn&&!!(equipped&&equipped.leftHand==='Lamparina')}
function toggleLamp(){if(mode!=='game'||combatActive||AbyssHome.busy)return;if(!(equipped&&equipped.leftHand==='Lamparina')){say('Karl não está segurando a lamparina.',1800);return}lampOn=!lampOn;beep(lampOn?620:260,.08,'square',.04,lampOn?900:120);say(lampOn?'Lamparina acesa. Os guardas podem ver essa luz de longe.':'Lamparina apagada. No escuro, os guardas só enxergam dentro da própria lanterna.',2800)}
let renderer3D=null,scene3D=null,camera3D=null,world3D=null,playerSprite=null,guardSprite=null;
let cameraAngleIndex=0,cameraAngleTarget=0;
let ratSprites=[],roachSprites=[],worldNeedsBuild=true,ambient3D=null,playerLamp=null,shadowSun=null,lampPool=[],lampSpots=[];
const occlusionMaterials=new Set();
/* v1.5: renderização por chunk — chunks longe de Karl ficam invisíveis (só o visual; a lógica segue rodando) */
const CH=16,CH_COLS=W/CH,CH_R=2;let chunkItems=[],lastChunkKey=-1;
function updateChunks(px,pz,force){const cx=Math.floor(px/CH),cy=Math.floor(pz/CH),key=cy*CH_COLS+cx;if(!force&&key===lastChunkKey)return;lastChunkKey=key;
 for(const m of chunkItems){const c=m.userData.chunk,d=Math.max(Math.abs((c%CH_COLS)-cx),Math.abs(Math.floor(c/CH_COLS)-cy));m.visible=d<=CH_R}}
const spriteTextures={};
function makeSpriteTexture(kind){
 if(spriteTextures[kind])return spriteTextures[kind];
 const c=document.createElement('canvas');c.width=128;c.height=192;
 const g=c.getContext('2d');g.clearRect(0,0,128,192);
 const ellipse=(x,y,rx,ry,color)=>{g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill()};
 if(kind==='karl'||kind==='guard'){
  const isGuard=kind==='guard';
  // Sprite placeholder original, desenhado em canvas e convertido em textura transparente.
  ellipse(64,27,17,19,isGuard?'#c8b8a0':'#c5b69b');
  g.fillStyle=isGuard?'#3a3028':'#262b29';g.fillRect(48,43,32,12);
  g.fillStyle=isGuard?'#51443a':'#5b5143';g.beginPath();g.moveTo(43,55);g.lineTo(85,55);g.lineTo(94,151);g.lineTo(34,151);g.closePath();g.fill();
  g.fillStyle=isGuard?'#302a26':'#343c38';g.fillRect(39,145,20,37);g.fillRect(69,145,20,37);
  g.fillStyle='#171817';g.fillRect(36,177,25,8);g.fillRect(67,177,25,8);
  if(isGuard){g.fillStyle='#7b302b';g.fillRect(43,58,42,8);g.fillStyle='#b8a78a';g.fillRect(48,82,32,4)}
  else {g.fillStyle='#b7aa8d';g.fillRect(49,62,30,5);g.fillStyle='#8d806b';g.fillRect(58,70,12,45)}
  g.fillStyle='#171817';g.fillRect(57,26,4,3);g.fillRect(69,26,4,3);
 }else if(kind==='patient'){ /* v1.7 NPC doente em pé: camisola hospitalar, magro, curvado */
  ellipse(64,30,15,18,'#cfc3ae');g.fillStyle='#d9d4c6';g.beginPath();g.arc(64,22,16,Math.PI,0);g.fill(); // cabelo ralo
  g.fillStyle='#9ea7a2';g.beginPath();g.moveTo(46,50);g.lineTo(82,50);g.lineTo(90,140);g.lineTo(38,140);g.closePath();g.fill();
  g.fillStyle='#868f8b';g.fillRect(40,56,10,64);g.fillRect(78,56,10,64);g.fillStyle='#cfc3ae';g.fillRect(40,118,9,10);g.fillRect(79,118,9,10);
  g.fillStyle='#bfc7c2';g.fillRect(46,138,36,5);g.fillStyle='#cfc3ae';g.fillRect(48,143,10,36);g.fillRect(70,143,10,36);
  g.fillStyle='#171817';g.fillRect(57,28,4,3);g.fillRect(69,28,4,3);
 }else if(kind==='patientBed'){ /* v1.7 NPC doente deitado na cama */
  g.fillStyle='#8c8f86';g.fillRect(4,132,120,46);g.fillStyle='#b9bdb0';g.fillRect(4,128,120,8); // colchão
  g.fillStyle='#9ea7a2';g.beginPath();g.moveTo(34,122);g.lineTo(112,126);g.lineTo(112,150);g.lineTo(34,152);g.closePath();g.fill();
  ellipse(24,134,15,13,'#cfc3ae');g.fillStyle='#d9d4c6';g.beginPath();g.arc(22,128,13,Math.PI*1.05,Math.PI*1.9);g.fill();
  g.fillStyle='#171817';g.fillRect(24,132,3,2);g.fillRect(14,132,3,2);
 }else if(kind==='rat'){
  ellipse(63,104,35,22,'#77736b');ellipse(89,91,16,14,'#8c877d');
  ellipse(95,91,3,3,'#d2b0a2');g.strokeStyle='#a58d82';g.lineWidth=4;g.beginPath();g.moveTo(34,111);g.quadraticCurveTo(10,130,20,145);g.stroke();
  ellipse(94,87,2,2,'#160f0d');
 }else if(kind==='roach'){
  ellipse(64,100,29,18,'#5b3925');ellipse(64,100,20,13,'#8b633e');
  g.strokeStyle='#c49a63';g.lineWidth=3;
  for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(52+i*7,91);g.lineTo(36+i*7,75);g.moveTo(52+i*7,109);g.lineTo(36+i*7,125);g.stroke()}
  g.beginPath();g.moveTo(84,94);g.lineTo(105,76);g.moveTo(84,106);g.lineTo(105,124);g.stroke();
 }
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;spriteTextures[kind]=tex;return tex;
}
function makeBillboard(kind,w,h){
 const mat=new THREE.SpriteMaterial({map:makeSpriteTexture(kind),transparent:true,depthWrite:false,alphaTest:.04});
 const sp=new THREE.Sprite(mat);sp.scale.set(w,h,1);sp.center.set(.5,0);sp.castShadow=false;sp.renderOrder=5;return sp;
}
function makeCreatureMaterial(color,roughness=.9){return new THREE.MeshStandardMaterial({color,roughness,metalness:0})}
function makeRatModel(){
 const root=new THREE.Group();root.userData.creature='rat';
 const fur=makeCreatureMaterial(0x77736b),furLight=makeCreatureMaterial(0x928b80),pink=makeCreatureMaterial(0x9c6864),dark=makeCreatureMaterial(0x211b19),eye=makeCreatureMaterial(0x080707,.45);
 const ell=(parent,mat,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
 // Corpo alongado paralelo ao chão, cabeça, focinho e orelhas: silhueta de rato vista de cima.
 ell(root,fur,0,.105,0,.245,.105,.145);ell(root,furLight,.185,.12,0,.115,.085,.105);ell(root,pink,.275,.105,0,.055,.045,.052);
 ell(root,pink,.13,.18,-.075,.045,.035,.04);ell(root,pink,.13,.18,.075,.045,.035,.04);
 ell(root,eye,.235,.165,-.052,.018,.018,.018);ell(root,eye,.235,.165,.052,.018,.018,.018);
 for(const z of [-.09,.09])for(const x of [-.13,.13]){const leg=ell(root,furLight,x,.055,z,.075,.035,.035);leg.rotation.y=z<0?-.25:.25}
 const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.21,.075,0),new THREE.Vector3(-.34,.065,.015),new THREE.Vector3(-.46,.045,.045),new THREE.Vector3(-.52,.04,.07)]);
 const tail=new THREE.Mesh(new THREE.TubeGeometry(curve,12,.012,5,false),pink);tail.castShadow=true;root.add(tail);
 root.scale.set(1.18,1,1.18);return root;
}
function makeRoachModel(){
 const root=new THREE.Group();root.userData.creature='roach';
 const shell=makeCreatureMaterial(0x51331f),shellHi=makeCreatureMaterial(0x805536),belly=makeCreatureMaterial(0x2d2119),legMat=makeCreatureMaterial(0x3a291e),antenna=makeCreatureMaterial(0x8c7257);
 const ell=(parent,mat,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m};
 ell(root,belly,-.005,.055,0,.22,.055,.105);ell(root,shell,-.005,.105,0,.205,.075,.115);ell(root,shellHi,.105,.09,0,.09,.055,.09);ell(root,shell,-.19,.075,0,.07,.05,.075);
 // Seis patas articuladas e duas antenas longas, distinguíveis mesmo em escala pequena.
 for(const side of [-1,1])for(let i=0;i<3;i++){
  const x=.08-i*.105,z=side*.095;const pts=[new THREE.Vector3(x,.065,z),new THREE.Vector3(x-.035,.035,z+side*.075),new THREE.Vector3(x-.075,.018,z+side*.11)];
  const leg=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),5,.009,4,false),legMat);leg.castShadow=true;root.add(leg);
 }
 for(const side of [-1,1]){const pts=[new THREE.Vector3(.17,.075,side*.025),new THREE.Vector3(.25,.065,side*.07),new THREE.Vector3(.34,.045,side*.13)];const a=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),8,.006,4,false),antenna);root.add(a)}
 return root;
}
function makeCreatureModel(kind){return kind==='rat'?makeRatModel():makeRoachModel()}

function initRenderer3D(){
 if(renderer3D)return;
 if(!window.THREE){console.error('Three.js não foi carregado. Verifique sua conexão com a CDN.');return}
 renderer3D=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer3D.setPixelRatio(Math.min(devicePixelRatio||1,2));
 renderer3D.setSize(innerWidth,innerHeight);
 renderer3D.shadowMap.enabled=true;renderer3D.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer3D.outputColorSpace=THREE.SRGBColorSpace;
 renderer3D.toneMapping=THREE.ACESFilmicToneMapping;renderer3D.toneMappingExposure=VIS.exposure;
 gameHost.appendChild(renderer3D.domElement);
 scene3D=new THREE.Scene();scene3D.background=new THREE.Color(0x080b09);
 scene3D.fog=new THREE.FogExp2(0x080b09,.025);
 camera3D=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,180);
 camera3D.position.set(0,13.5,9.5);camera3D.lookAt(0,.7,0);
 const hemi=new THREE.HemisphereLight(0x667064,0x080907,VIS.hemi);scene3D.add(hemi);
 ambient3D=new THREE.AmbientLight(0x71806c,VIS.ambient);scene3D.add(ambient3D);
 shadowSun=new THREE.DirectionalLight(0xffe0b2,0.035);
 shadowSun.position.set(-32,48,-28);shadowSun.castShadow=true;
 shadowSun.shadow.mapSize.set(4096,4096);
 shadowSun.shadow.camera.left=-52;shadowSun.shadow.camera.right=52;
 shadowSun.shadow.camera.top=52;shadowSun.shadow.camera.bottom=-52;
 shadowSun.shadow.camera.near=1;shadowSun.shadow.camera.far=130;
 shadowSun.shadow.bias=-.00025;shadowSun.shadow.normalBias=.025;
 shadowSun.target.position.set(0,0,0);scene3D.add(shadowSun,shadowSun.target);
 // Lamparina: luz pontual quente, irradiando em 360 graus (não é um facho direcional).
 playerLamp=new THREE.PointLight(0xffc978,4.2,9.5,1.45);playerLamp.position.set(0,1.15,0);playerLamp.castShadow=false;scene3D.add(playerLamp);
 // Pool fixo de luzes de parede: poucas PointLights reais que seguem as luminárias mais próximas.
 lampPool=[];for(let n=0;n<6;n++){const Lt=new THREE.PointLight(0xffe2b0,0,VIS.lampDist,VIS.lampDecay);Lt.castShadow=false;Lt.position.set(0,-50,0);Lt.userData={spot:null};scene3D.add(Lt);lampPool.push(Lt)}
 playerSprite=makeBillboard('karl',.82,1.48);playerSprite.material.depthTest=false;playerSprite.renderOrder=1000;scene3D.add(playerSprite);
 guardSprite=makeBillboard('guard',.9,1.58);scene3D.add(guardSprite);
 window.addEventListener('contextmenu',e=>e.preventDefault());
}
function rs(){
 if(!renderer3D)initRenderer3D();
 if(renderer3D){renderer3D.setSize(innerWidth,innerHeight);camera3D.aspect=innerWidth/innerHeight;camera3D.updateProjectionMatrix()}
}
addEventListener('resize',rs);initRenderer3D();
const solid=(x,y)=>x<0||y<0||x>=W||y>=H||T[y*W+x]==0||OB[y*W+x];
const hit=(x,y,r)=>solid(Math.floor(x-r),Math.floor(y-r))||solid(Math.floor(x+r),Math.floor(y-r))||solid(Math.floor(x-r),Math.floor(y+r))||solid(Math.floor(x+r),Math.floor(y+r));
let mt=0;function say(t,ms){const m=$('msg');m.textContent=t;m.classList.add('on');clearTimeout(mt);mt=setTimeout(()=>m.classList.remove('on'),ms||2600)}
function rollRarity(){const n=Math.random()*100;return n<55?'comum':n<80?'incomum':n<93?'rara':n<99?'muito-rara':'lendaria'}
function generateCrateLoot(o){if(o.loot)return o.loot;const count=2+Math.floor(Math.random()*3),loot=[];for(let i=0;i<count;i++){const rarity=rollRarity(),pool=LOOT_TABLE[rarity],base=pool[Math.floor(Math.random()*pool.length)];loot.push({...base,uid:'loot_'+Math.random().toString(36).slice(2),rarityKey:rarity})}o.loot=loot;o.opened=true;return loot}
let activeCrate=null,cratePreview=null,crateLid=null,cratePreviewOpen=false;
function initCratePreview(){if(cratePreview||!window.THREE)return;const canvas=$('crate3DCanvas'),renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(360,220,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;const scene=new THREE.Scene();scene.background=new THREE.Color(0x111811);const camera=new THREE.PerspectiveCamera(36,360/220,.1,50);camera.position.set(3.4,2.8,4.5);camera.lookAt(0,.45,0);scene.add(new THREE.HemisphereLight(0xd9e2d2,0x24170e,1.4));const key=new THREE.DirectionalLight(0xffd39a,2.4);key.position.set(3,5,4);scene.add(key);const box=new THREE.Group();scene.add(box);const wood=new THREE.MeshStandardMaterial({color:0x76502f,roughness:.88}),darkWood=new THREE.MeshStandardMaterial({color:0x49301e,roughness:.92}),iron=new THREE.MeshStandardMaterial({color:0x77766a,metalness:.72,roughness:.5});const floorPanel=new THREE.Mesh(new THREE.BoxGeometry(2,.14,1.35),darkWood);floorPanel.position.y=.08;box.add(floorPanel);const frontWall=new THREE.Mesh(new THREE.BoxGeometry(2,.92,.13),wood);frontWall.position.set(0,.55,.61);box.add(frontWall);const backWall=new THREE.Mesh(new THREE.BoxGeometry(2,.92,.13),wood);backWall.position.set(0,.55,-.61);box.add(backWall);const leftWall=new THREE.Mesh(new THREE.BoxGeometry(.13,.92,1.35),wood);leftWall.position.set(-.94,.55,0);box.add(leftWall);const rightWall=new THREE.Mesh(new THREE.BoxGeometry(.13,.92,1.35),wood);rightWall.position.set(.94,.55,0);box.add(rightWall);for(let y of [.3,.55,.8]){const innerRim=new THREE.Mesh(new THREE.BoxGeometry(1.78,.035,1.15),darkWood);innerRim.position.y=y;box.add(innerRim)}for(let x of [-.94,.94]){const band=new THREE.Mesh(new THREE.BoxGeometry(.08,1.06,1.42),iron);band.position.set(x,.5,0);box.add(band)}const pivot=new THREE.Group();pivot.position.set(0,1, -.675);box.add(pivot);const lid=new THREE.Mesh(new THREE.BoxGeometry(2.05,.16,1.42),wood);lid.position.set(0,.06,.675);lid.castShadow=true;pivot.add(lid);for(let x of [-.7,-.23,.23,.7]){const strip=new THREE.Mesh(new THREE.BoxGeometry(.13,.18,1.43),darkWood);strip.position.set(x,.06,.675);pivot.add(strip)}cratePreview={renderer,scene,camera,box,pivot};crateLid=pivot;renderCratePreview()}
function renderCratePreview(){if(cratePreview){cratePreview.renderer.render(cratePreview.scene,cratePreview.camera)}}
function openCrate(o){activeCrate=o;cratePreviewOpen=false;const panel=$('cratePanel');panel.classList.add('on');panel.setAttribute('aria-hidden','false');$('crateHint').textContent='CLIQUE NA CAIXA PARA EXAMINAR O CONTEÚDO';$('crateLoot').innerHTML='<div class="invHint">A caixa ainda está fechada.</div>';initCratePreview();if(crateLid)crateLid.rotation.x=0;renderCratePreview()}

function revealCrate(){if(!activeCrate)return;const loot=generateCrateLoot(activeCrate);cratePreviewOpen=true;if(crateLid)crateLid.rotation.x=-1.05;renderCratePreview();$('crateHint').textContent='A CAIXA FOI ABERTA · CLIQUE NOS ITENS PARA PEGÁ-LOS';renderCrateLoot()}
function renderCrateLoot(){if(!activeCrate)return;const loot=activeCrate.loot||[];$('crateLoot').innerHTML=loot.length?loot.map((it,i)=>`<button class="rarity-${it.rarityKey}" data-loot-index="${i}">${it.name}<small>${it.rarity} · ${it.effect}</small></button>`).join(''):'<div class="invHint">Esta caixa está vazia.</div>';$('crateLoot').querySelectorAll('[data-loot-index]').forEach(b=>b.onclick=()=>{const i=+b.dataset.lootIndex,it=activeCrate.loot[i];if(!it)return;const item={name:it.name,type:it.type,rarity:it.rarity,desc:it.desc,tags:it.type==='food'?['consumivel']:it.type==='consumable'?['consumivel']:[]};if(!addItem(item))return;if(it.name==='Garrafa de Água'&&it.type==='consumable'){}activeCrate.loot.splice(i,1);renderCrateLoot();say('Item coletado: '+it.name,1800)})}
function closeCrate(){activeCrate=null;cratePreviewOpen=false;if(crateLid)crateLid.rotation.x=0;renderCratePreview();$('cratePanel').classList.remove('on');$('cratePanel').setAttribute('aria-hidden','true')}
$('crateStage').addEventListener('click',revealCrate);$('crateStage').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();revealCrate()}});$('crateClose').onclick=closeCrate;
function target(){let b=null,bd=1.8;for(const bug of roaches){if(!bug.alive)continue;const d=Math.hypot(bug.x-P.x,bug.y-P.y);if(d<bd){bd=d;b={t:'roach',roach:bug}}}for(const o of OBJ){if(o.taken||o.read||(o.t==='crate'&&o.opened&&!(o.loot&&o.loot.length)))continue;if(o.t!='elevator'&&o.t!='mech'&&o.t!='note'&&o.t!='gate'&&o.t!='item'&&o.t!='door'&&o.t!='doubleDoor'&&o.t!='bed'&&o.t!='crate'&&o.t!='coletor')continue;const d=Math.hypot(o.x+o.w/2-P.x,o.y+.5-P.y);if(d<bd){bd=d;b=o}}return b}
function interact(){if(AbyssHome.active){AbyssHome.interact();return}if(NPCModule.interact())return; /* v1.7 */if(GuardModule.stealthKill())return;if(AbyssModule.pickBody())return;const o=target();
 if(!o||(o.t!=='door'&&o.t!=='doubleDoor')){if(AbyssModule.interactAltar())return}
 if(!o){AbyssModule.dropBody();return}
 if(o.t==='coletor'){AbyssModule.collectorInfo(o);return}
 if(o.t==='crate'){openCrate(o);return}
 if(o.t==='elevator'){openElev(o);return}
 if(o.t==='door'||o.t==='doubleDoor'){if(o.locked){ /* v1.7: porta do NPC doente — só abre com a 'Chave do guarda' (dropada pelos guardas); a chave é gasta */
  const ki=inventory.findIndex(i=>i&&i.name==='Chave do guarda');
  if(ki<0){say('Trancada. Só uma chave de guarda abre esta porta.',2200);return}
  inventory[ki]=null;o.locked=false;say('Você destranca a porta com a chave do guarda.',2200);try{beep(260,.15,'square',.04,120)}catch(e){}
  try{if(typeof renderInventory==='function')renderInventory()}catch(e){}} /* e segue para abrir */if(o.open&&Math.hypot(P.x-(o.x+.5),P.y-(o.y+.5))<.48){say('Afaste-se da passagem antes de fechar a porta.',1800);return}o.open=!o.open;refreshObjectMesh(o);for(let j=0;j<o.w;j++){const idx=(o.y+(o.axis==='v'?j:0))*W+o.x+(o.axis==='h'?j:0);OB[idx]=o.open?null:o}say(o.open?'A porta range ao abrir.':'A porta foi fechada.',1600);return}
 if(o.t==='bed'){openSleep();return}
 if(o.t=='roach'){if(!addItem({name:'Barata',type:'food',tags:['consumivel'],desc:'Uma barata capturada. É uma fonte pequena e desagradável de alimento.'}))return;o.roach.alive=false;populations.roaches=Math.max(0,populations.roaches-1);say('Barata capturada. População restante: '+populations.roaches+'.',2600);return}
 if(o.t=='item'){if(!addItem({name:o.itemName,type:o.itemType,desc:o.desc}))return;o.taken=1;refreshObjectMesh(o);say('Item coletado: '+o.itemName,2500)}
 else if(o.t=='mech'){o.taken=1;refreshObjectMesh(o);have[o.id]=1;addItem({name:'Mecanismo '+(o.id+1),type:'mechanism',desc:'Peça do sistema de travas da saída.'});beep(520,.15,'square',.06);setTimeout(()=>beep(780,.3,'square',.06),140);say(MECH[o.id],4000)}
 else if(o.t=='note'){o.read=1;refreshObjectMesh(o);addItem({name:'Bilhete de funcionário',type:'document',desc:'Um bilhete amassado com instruções sobre o selamento.'});beep(300,.1,'triangle',.06);say(language==='en-US'?SC_EN[4][4]:NOTE,9000)}
 else if(o.t=='gate'){const n=3-have.reduce((a,b)=>a+b);if(n)say(`O portão exige três mecanismos. Faltam ${n}.`,3000);else finish(1)}}
let combatActive=false,combatTargetMode='',combatTurn=0,mind=95,combatGuarding=false;

function showCombatTransition(kind,done){
 const t=$('combatTrans');
 if(!t)return;
 combatTrans=true;
 t.classList.remove('victory','defeat','on');
 t.classList.add(kind);
 t.querySelector('.tText').textContent=kind==='victory'?'VITÓRIA':kind==='flee'?'FUGA':'DERROTA';
 const animated=t.querySelectorAll('.tFlash,.tBars i,.tText');
 animated.forEach(el=>{el.style.animation='none';});
 t.classList.add('on');
 void t.offsetWidth;
 animated.forEach(el=>{el.style.animation='';});
 beep(kind==='victory'?520:kind==='flee'?300:75,kind==='defeat'?1:.7,'sawtooth',.1,kind==='victory'?1040:kind==='flee'?620:28);
 setTimeout(()=>{
  t.classList.remove('on',kind);
  combatTrans=false;
  if(typeof done==='function')done();
 },1600);
}
function finishPlayerDefeat(){closeCombat();showCombatTransition('defeat',()=>{mode='end';$('eh').textContent='GAME OVER';$('ep').textContent='Karl foi derrotado pelo guarda. Eichenfeld ficou em silêncio.';$('end').classList.add('on','gameover')})}
function showGuardLoot(){const loot=[...(guard.inventory||[]),...(guard.equipment||[])];$('resultTitle').textContent='GUARDA DERROTADO';$('resultDesc').textContent='O Corrupted Guard caiu. Karl pode revistar o corpo e recolher o que restou.';$('resultLoot').innerHTML=loot.map(it=>`<div class="lootRow"><span>${it.name}<br><small>${it.type==='weapon'?'EQUIPAMENTO':'INVENTÁRIO'}</small></span><small>${it.desc||''}</small></div>`).join('');$('combatResult').classList.add('on');$('combatActions').style.display='grid';playVictoryJingle()}
function closeCombatResult(){const loot=[...(guard?.inventory||[]),...(guard?.equipment||[])];for(const it of loot){if(addItem({...it,count:1})){} }if(guard){guard.looted=true;guard.inventory=[];guard.equipment=[]} $('combatResult').classList.remove('on');say('O corpo do guarda permanece no local.',2600)}
$('resultContinue').onclick=closeCombatResult;
let guardDying=false;
function openCombatReal(){if(combatActive||!guard||!guard.alive)return;combatActive=true;ABISM.Combat.enter();combatTurn=0;combatGuarding=false;enemyThinking=false;setCombatControls(false);mode='game';$('combatPanel').classList.add('on');$('combatPanel').setAttribute('aria-hidden','false');$('combatLog').textContent='O Corrupted Guard agarrou Karl. Escolha sua ação.';AbyssModule.combatStart(guard);combatTargets('');refreshCombat();guardDying=false;GuardBattle.open(guard)}
function closeCombat(){GuardBattle.close();AbyssModule.combatEnd();combatActive=false;ABISM.Combat.exit();enemyThinking=false;if(enemyThinkTimer)clearTimeout(enemyThinkTimer);if(enemyThinkInterval)clearInterval(enemyThinkInterval);enemyThinkTimer=null;enemyThinkInterval=null;setCombatControls(false);$('combatPanel').classList.remove('on');$('combatPanel').setAttribute('aria-hidden','true');combatTargetMode='';$('combatTargets').classList.remove('on')}
function refreshCombat(){const hp=guard.bodyHP||(guard.bodyHP={head:40,torso:100,leftArm:65,rightArm:65,leftLeg:75,rightLeg:75});GuardBattle.sync(guard);$('combatPlayerStats').textContent='KARL · TRONCO '+bodyHP.torso+' · MENTE '+mind+' · BRAÇOS '+bodyHP.leftArm+'/'+bodyHP.rightArm+' · PERNAS '+bodyHP.leftLeg+'/'+bodyHP.rightLeg+AbyssModule.playerStatusText();$('enemyTorsoBar').textContent=hp.torso;$('enemyStatus').textContent=AbyssModule.enemyStatusText(guard);const labels={head:'CABEÇA',torso:'TRONCO',leftArm:'BRAÇO E',rightArm:'BRAÇO D',leftLeg:'PERNA E',rightLeg:'PERNA D'};$('enemyLimbGrid').innerHTML=Object.entries(labels).map(([k,v])=>'<span>'+v+' · '+(guard.severed&&guard.severed[k]?'CARBONIZADO':hp[k])+'</span>').join('')}
function combatTargets(kind){combatTargetMode=kind;const el=$('combatTargets');el.innerHTML='';if(!kind){el.classList.remove('on');return}el.classList.add('on');const list=(kind==='attack'||kind==='shock')?ENEMY_PARTS:ENEMY_PARTS.filter(([k])=>['head','torso','leftArm','rightArm'].includes(k));for(const [key,label] of list){const b=document.createElement('button');b.textContent=label+' · '+(guard.bodyHP?.[key]??0);b.disabled=(guard.bodyHP?.[key]??0)<=0;b.onclick=()=>{if(kind==='attack')playerAttack(key,false);else if(kind==='shock')AbyssModule.castShock(key);else playerAttack(key,true)};el.appendChild(b)}}
let enemyThinkTimer=null,enemyThinkInterval=null,enemyThinking=false,enemyDecisionAt=0;
function setCombatControls(disabled){['combatAttack','combatSkill','combatGuard','combatFlee','combatItem'].forEach(id=>$(id).disabled=disabled)}
function enemyThink(log){
 if(!combatActive||enemyThinking)return;
 enemyThinking=true;ABISM.Combat.enemy();setCombatControls(true);
 const delay=10000+Math.random()*10000;enemyDecisionAt=Date.now()+delay;
 const chooseTree=()=>{
  const hp=guard.bodyHP||(guard.bodyHP={head:40,torso:100,leftArm:65,rightArm:65,leftLeg:75,rightLeg:75});
  const arms=(hp.leftArm>0?1:0)+(hp.rightArm>0?1:0);
  const legs=(bodyHP.leftLeg+bodyHP.rightLeg)/2;
  // Árvore de decisão: avalia vulnerabilidades antes de escolher o golpe.
  if(arms===0)return {name:'Investida desequilibrada',part:'torso',damage:5};
  if(bodyHP.torso<35)return {name:'Cassetetada brutal no tronco',part:'torso',damage:17};
  if(legs<45)return {name:'Ataque para derrubar',part:bodyHP.leftLeg<bodyHP.rightLeg?'leftLeg':'rightLeg',damage:12};
  if(bodyHP.leftArm<35||bodyHP.rightArm<35)return {name:'Golpe contra o braço ferido',part:bodyHP.leftArm<bodyHP.rightArm?'leftArm':'rightArm',damage:10};
  const roll=Math.random();
  if(roll<.48)return {name:'Cassetetada pesada',part:'torso',damage:13};
  if(roll<.72)return {name:'Cassetetada nos membros',part:Math.random()<.5?'leftArm':'rightArm',damage:9};
  if(roll<.9)return {name:'Cassetetada nas pernas',part:Math.random()<.5?'leftLeg':'rightLeg',damage:10};
  return {name:'Cassetetada alta',part:'head',damage:11};
 };
 const updateCountdown=()=>{if(!combatActive||!enemyThinking)return;const left=Math.max(0,Math.ceil((enemyDecisionAt-Date.now())/1000));$('combatLog').textContent=log+' O Guarda está avaliando uma abertura... ('+left+'s)';};
 updateCountdown();enemyThinkInterval=setInterval(updateCountdown,1000);
 enemyThinkTimer=setTimeout(()=>{
  clearInterval(enemyThinkInterval);enemyThinkInterval=null;enemyThinkTimer=null;
  if(!combatActive){enemyThinking=false;return}
  const action=chooseTree(),part=action.part;let dmg=action.damage;
  // Cabeça é o alvo mais difícil: 75% do dano dirigido a ela é evitado.
  if(AbyssModule.consumeStun(guard)){$('combatLog').textContent=log+' O Guarda, desorientado, cambaleia e perde o turno!';}else if(part==='head'&&Math.random()<.75){$('combatLog').textContent=log+' Karl desviou do ataque à cabeça!';}
  else{
   GuardBattle.attack();
   if(combatGuarding){dmg=Math.max(1,Math.round(dmg*.25));combatGuarding=false}
   const enemyArms=(guard.bodyHP?.leftArm||0)+(guard.bodyHP?.rightArm||0);
   if(enemyArms<=0)dmg=Math.max(2,Math.round(dmg*.35));else if(enemyArms<65)dmg=Math.round(dmg*.75);
   dmg=AbyssModule.incomingDamage(part,dmg);ABISM.Status.damageBody(part,dmg);
   const bone=AbyssModule.rollBoneBreak(part,dmg);
   $('combatLog').textContent=log+' O Guarda escolheu '+action.name+' e atingiu '+part.toUpperCase()+' (-'+dmg+').'+bone;
  }
  {const dot=AbyssModule.tickRound();if(dot)$('combatLog').textContent+=dot}
  enemyThinking=false;ABISM.Combat.player();setCombatControls(false);refreshCombat();
  if(bodyHP.torso<=0||bodyHP.head<=0){finishPlayerDefeat();return}
  combatTurn++;
 },delay);
}
function enemyTurn(log){enemyThink(log)}

function playerAttack(part,skill){const hp=guard.bodyHP||(guard.bodyHP={head:40,torso:100,leftArm:65,rightArm:65,leftLeg:75,rightLeg:75});const weapon=equipped.rightHand==='Faca'?18:8;let dmg=skill?Math.max(8,Math.round(weapon*1.5)):weapon;const statusLevel=Math.min(hunger,thirst);if(statusLevel<=50)dmg=Math.round(dmg*.75);if(statusLevel<=20)dmg=Math.round(dmg*.5);if(skill){if(mind<15){$('combatLog').textContent='Karl está sem concentração suficiente.';return}ABISM.Status.changeMind(-15)}if(part==='head')dmg=Math.round(dmg*1.2);dmg=Math.round(dmg*AbyssModule.outgoingMult());if(part.includes('Arm')&&hp[part]<=0)dmg=Math.round(dmg*.6);hp[part]=Math.max(0,hp[part]-dmg);GuardBattle.strike(part,dmg,hp);let log=(skill?'Habilidade: golpe concentrado':'Karl ataca')+' '+part.toUpperCase()+' (-'+dmg+').';if(hp.torso<=0||hp.head<=0){killGuard(log);return}combatTargets('');enemyThink(log)}
function killGuard(log){ /* o golpe final deixa o corpo desabar (e a cabeça sair, se for o caso) antes de fechar o combate */
 if(guardDying)return;guardDying=true;setCombatControls(true);$('combatTargets').classList.remove('on');$('combatLog').textContent=log+' O inimigo caiu.';
 GuardBattle.die(guard,()=>{guardDying=false;killGuardNow(log)})}
function killGuardNow(log){guard.alive=false;guard.dead=true;guard.state='dead';guard.deadAt={x:guard.x,y:guard.y};organicMatter.push({x:guard.x,y:guard.y,amount:8,active:true,source:'guard_corpse'});$('combatLog').textContent=log+' O inimigo caiu.';refreshCombat();$('combatActions').style.display='none';$('combatTargets').classList.remove('on');closeCombat();showCombatTransition('victory',showGuardLoot)}
function findFleeSpot(){const dx=P.x-guard.x,dy=P.y-guard.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
 for(let dist=3.2;dist>=.5;dist-=.35)for(const ang of[0,.5,-.5,1,-1,1.6,-1.6,2.4,-2.4]){const c=Math.cos(ang),s=Math.sin(ang),x=P.x+(ux*c-uy*s)*dist,y=P.y+(ux*s+uy*c)*dist;if(!hit(x,y,.34)&&AIMap.walkable(x,y)&&AIMap.lineOfSight(P.x,P.y,x,y))return{x,y}}
 const n=AIMap.nearestWalkable(P.x,P.y);return n||{x:P.x,y:P.y}}
function combatFlee(){const chance=Math.max(.18,Math.min(.8,.38+(bodyHP.leftLeg+bodyHP.rightLeg)/400-AbyssModule.fleePenalty()));if(Math.random()<chance){const spot=findFleeSpot(),fx=P.x,fy=P.y;setCombatControls(true);showCombatTransition('flee',()=>{});setTimeout(()=>{closeCombat();P.x=spot.x;P.y=spot.y;for(const k in keys)delete keys[k];guard.state='investigate';guard.lastSeen={x:fx,y:fy};guard.investigate=2;fleeGrace=performance.now()+3500;say('Karl conseguiu fugir do combate!',2200)},650)}else enemyThink('Karl tentou fugir, mas o Guarda o impediu.')} 
function combatGuard(){combatGuarding=true;combatTargets('');enemyThink('Karl assume uma postura defensiva, protegendo os membros.');}
function combatUseItem(){const el=$('combatTargets');el.innerHTML='';const usable=inventory.map((it,i)=>({it,i})).filter(v=>v.it&&((v.it.tags||[]).includes('consumivel')||v.it.type==='food'||v.it.type==='consumable'));if(!usable.length){$('combatLog').textContent='Você não tem nenhum item utilizável.';return}combatTargetMode='item';el.classList.add('on');for(const {it,i} of usable){const b=document.createElement('button');b.textContent=it.name+' ×'+(it.count||1);b.onclick=()=>{const nn=it.name.toLowerCase(),gain=nn.includes('água')?0:nn.includes('carne')?20:nn.includes('pão')?15:12;hunger=Math.min(100,hunger+gain);let byproduct=null;if(nn.includes('água')){thirst=Math.min(100,thirst+48);byproduct={name:'Garrafa Vazia',type:'material',desc:'Garrafa vazia de água.'}}else if(nn.includes('coca cola')){thirst=Math.min(100,thirst+34);byproduct={name:'Garrafa Vazia de Coca Cola (1 litro)',type:'material',desc:'Garrafa vazia de refrigerante de um litro.'}}else if(nn.includes('refri'))thirst=Math.min(100,thirst+18);if((inventory[i].count||1)>1)inventory[i].count--;else inventory[i]=null;if(byproduct)addItem(byproduct);combatTargets('');enemyThink('Karl usou '+it.name+' e recuperou um pouco de energia.');};el.appendChild(b)}}
$('combatAttack').onclick=()=>combatTargets('attack');$('combatSkill').onclick=()=>AbyssModule.openSkillMenu();$('combatGuard').onclick=combatGuard;$('combatFlee').onclick=combatFlee;$('combatItem').onclick=combatUseItem;


function finish(win,reason){mode='end';beep(win?600:90,1,'sawtooth',.1,win?1200:40);$('eh').textContent=win?'ESCAPOU':'COMPLEXO SELADO';
 $('ep').textContent=reason|| (win?'Os três mecanismos giram em sincronia e o portão cede. Karl sobe para a madrugada de Eichenfeld, sem saber quem — ou o quê — ainda caminha lá embaixo.':'O 31º dia terminou. O complexo foi selado e Karl ficou preso sob Eichenfeld.');$('end').classList.add('on')}
function upd(dt){
 if(!$('cut').classList.contains('on')||NPCModule.cutActive())NPCModule.update(dt); /* v1.7 NPC doente */
 if(NPCModule.busy())return; /* v1.7: Karl fica parado enquanto o doente anda até a porta e durante a cutscene */
 if($('sleepPanel').style.display==='flex'||combatActive||combatTrans||$('elevPanel').classList.contains('on')||$('altarPanel').classList.contains('on'))return;
 if(AbyssHome.active||AbyssHome.busy){AbyssHome.update(dt);return} /* Lar do Abismo: cena à parte, o resto do mundo fica parado */
 let inputX=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),inputY=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
 const camA=cameraAngleTarget,ca=Math.cos(camA),sa=Math.sin(camA);
 let dx=inputX*ca+inputY*sa,dy=-inputX*sa+inputY*ca;
 const depleted=Math.min(hunger,thirst),tooDepleted=depleted<=20,weak=depleted<=50;
 if(tooDepleted||AbyssModule.isCarryingBody())keys.shift=0;
 if(dx||dy){const l=Math.hypot(dx,dy),legFactor=(bodyHP.leftLeg+bodyHP.rightLeg)/150,statusFactor=weak?.58:1,baseSpeed=keys.c?2.2:keys.shift?6.4:4.2,sp=baseSpeed*Math.max(.35,legFactor)*statusFactor*AbyssModule.speedFactor()*dt/l;P.a=Math.atan2(dy,dx);
  if(!hit(P.x+dx*sp,P.y,.3))P.x+=dx*sp;if(!hit(P.x,P.y+dy*sp,.3))P.y+=dy*sp}
 if(hit(P.x,P.y,.3)){const n=AIMap.nearestWalkable(P.x,P.y);if(n){P.x=n.x;P.y=n.y}} /* resgate: nunca fica preso em parede/objeto */
 /* v1.7 barras mais rápidas: fome 20s (era 35), sede 15s (era 24), sono 35s (era 55) */
 hungerClock+=dt; if(hungerClock>=20){hungerClock=0;hunger=Math.max(0,hunger-1)}
 thirstClock+=dt;if(thirstClock>=15){thirstClock=0;thirst=Math.max(0,thirst-1)}
 sleepClock+=dt;if(sleepClock>=35){sleepClock=0;sleep=Math.max(0,sleep-1)}
 if(sleep<=0&&Math.random()<dt*.22){bodyHP.torso=Math.max(1,bodyHP.torso-1)}
 if(hunger<=0&&Math.random()<dt*.8){bodyHP.torso=Math.max(1,bodyHP.torso-1)}
 if(thirst<=0&&Math.random()<dt*1.15){bodyHP.torso=Math.max(1,bodyHP.torso-1)}
 const canSee=(ax,ay,bx,by)=>AIMap.lineOfSight(ax,ay,bx,by);
 const moveActor=(actor,tx,ty,speed,radius)=>AIMap.move(actor,tx,ty,speed,radius,dt);
 /* IA ecológica em árvore de prioridades: fugir > caçar > socializar/forragear > regressar à toca. */
 ecoClock+=dt;
 /* v1.3.4: goteiras */
 for(const o of OBJ)if(o.t==='leak'){o.cd=(o.cd??Math.random()*8)-dt;if(o.dripT!=null){const was=o.dripT;o.dripT+=dt;if(was<.5&&o.dripT>=.5&&Math.hypot(o.x-P.x,o.y-P.y)<9)beep(1400+Math.random()*400,.07,'sine',.025,700);if(o.dripT>1.3)o.dripT=null}else if(o.cd<=0){o.dripT=0;o.cd=4+Math.random()*12}}
 const walk=(x,y)=>AIMap.walkable(x,y);
 const bfs=(ax,ay,bx,by)=>AIMap.findPath(ax,ay,bx,by);
 const wander=(a,speed,radius)=>AIMap.wander(a,speed,radius,dt);
  for(const a of [...rats,...roaches])if(a&&a.alive&&!walk(a.x,a.y)){const spot=AIMap.nearestWalkable(a.x,a.y);if(spot){a.x=spot.x;a.y=spot.y}}
  for(const m of organicMatter)if(m.active&&!walk(m.x,m.y)){const spot=AIMap.nearestWalkable(m.x,m.y);if(spot){m.x=spot.x;m.y=spot.y}else m.active=false}
 for(const bug of roaches){if(!bug.alive)continue;
  // Recovery for old saves and agents left in a blocked cell.
  if(!walk(Math.floor(bug.x),Math.floor(bug.y))){const spot=AIMap.nearestWalkable(bug.x,bug.y);if(spot){bug.x=spot.x;bug.y=spot.y}}
  bug.phase+=dt*(1.1+Math.sin(bug.phase)*.15);bug.hunger=Math.min(100,(bug.hunger||0)+dt*.55);bug.foodSearch=(bug.foodSearch||0)-dt;bug.foodRepath=(bug.foodRepath||0)-dt;
  let threat=null,td=2.2;for(const rt of rats){if(!rt.alive)continue;const d=Math.hypot(rt.x-bug.x,rt.y-bug.y);if(d<td){td=d;threat=rt}}
  if(threat){bug.state='flee';bug.foodPath=null;const dx=bug.x-threat.x,dy=bug.y-threat.y,d=Math.hypot(dx,dy)||1;bug.heading=Math.atan2(dy,dx);moveActor(bug,bug.x+dx/d*2.2,bug.y+dy/d*2.2,.7,.07)}
  else if(bug.hunger>35){
   let foodIndex=bug.foodTargetIndex,food=foodIndex>=0?organicMatter[foodIndex]:null;
   if(!food||!food.active||bug.foodRepath<=0||!Array.isArray(bug.foodPath)){
    bug.foodPath=null;bug.foodTargetIndex=-1;food=null;
    const candidates=organicMatter.map((m,i)=>({m,i,d:Math.hypot(m.x-bug.x,m.y-bug.y)})).filter(v=>v.m.active).sort((a,b)=>a.d-b.d).slice(0,10);
    for(const candidate of candidates){const path=bfs(bug.x,bug.y,candidate.m.x,candidate.m.y);if(path){food=candidate.m;foodIndex=candidate.i;bug.foodPath=path;bug.foodTargetIndex=foodIndex;break}}
    bug.foodRepath=2.0;
   }
   if(food&&food.active&&Array.isArray(bug.foodPath)){
    bug.state='feeding';bug.heading=Math.atan2(food.y-bug.y,food.x-bug.x);
    const wp=bug.foodPath[0];if(wp){moveActor(bug,wp.x,wp.y,.48,.07);if(Math.hypot(bug.x-wp.x,bug.y-wp.y)<.22)bug.foodPath.shift()}
    if(Math.hypot(food.x-bug.x,food.y-bug.y)<.34){food.active=false;bug.hunger=Math.max(0,bug.hunger-65);bug.state='forage';bug.foodPath=null;bug.foodTargetIndex=-1;bug.starve=0}
   }else{bug.state='forage';bug.foodPath=null;bug.foodTargetIndex=-1;wander(bug,.22,.05)}
  }else{bug.state='forage';bug.foodPath=null;bug.foodTargetIndex=-1;wander(bug,.34,.07)}
  if(bug.hunger>=100){bug.starve=(bug.starve||0)+dt;if(bug.starve>100){bug.alive=false;populations.roaches=Math.max(0,populations.roaches-1)}}else bug.starve=0
 }

 for(const rat of rats){if(!rat.alive)continue;rat.phase+=dt*(1.25+Math.sin(rat.phase)*.12);rat.hunger=Math.min(100,(rat.hunger||0)+dt*.42);rat.sniffCd=(rat.sniffCd??Math.random()*4)-dt;rat.sniffT=Math.max(0,(rat.sniffT||0)-dt);rat.repath=(rat.repath||0)-dt;
  const playerDist=Math.hypot(P.x-rat.x,P.y-rat.y);
  if(playerDist<3.6){rat.state='flee';rat.scent=null;rat.path=null;rat.sniffT=0;const dx=rat.x-P.x,dy=rat.y-P.y,d=Math.hypot(dx,dy)||1;rat.heading=Math.atan2(dy,dx);moveActor(rat,rat.x+dx/d*2.8,rat.y+dy/d*2.8,1.05,.12);continue}
  const hungry=rat.hunger>30;let prey=null,pd=rat.hunger>55?9:5;
  if(hungry)for(const bug of roaches){if(!bug.alive)continue;const d=Math.hypot(bug.x-rat.x,bug.y-rat.y);if(d<pd&&canSee(rat.x,rat.y,bug.x,bug.y)){pd=d;prey=bug}}
  if(prey){rat.state='hunt';rat.scent=null;rat.path=null;moveActor(rat,prey.x,prey.y,.9,.12);if(pd<.3){prey.alive=false;populations.roaches=Math.max(0,populations.roaches-1);rat.hunger=Math.max(0,rat.hunger-48);rat.hunt=4}}
  else if(!hungry){rat.state='rest';wander(rat,.25,.12)}
  else if(rat.sniffT>0){rat.state='sniff'}
  else if(rat.scent){rat.state='track';if(!rat.path||rat.repath<=0){rat.path=bfs(rat.x,rat.y,rat.scent.x,rat.scent.y);rat.repath=2.5}
   const wp=rat.path&&rat.path[0];if(wp){moveActor(rat,wp.x,wp.y,.8,.12);if(Math.hypot(rat.x-wp.x,rat.y-wp.y)<.28)rat.path.shift()}else{rat.scent=null;rat.path=null;rat.sniffCd=.8}}
  else if(rat.sniffCd<=0){/* FAREJAR: sente a presa mais próxima e recebe uma pista aproximada de onde ela está */
   rat.sniffT=1.5;rat.sniffCd=6+Math.random()*4;let best=null,bd=22;for(const bug of roaches){if(!bug.alive)continue;const d=Math.hypot(bug.x-rat.x,bug.y-rat.y);if(d<bd){bd=d;best=bug}}
   if(best){let sx=best.x+(Math.random()-.5)*3,sy=best.y+(Math.random()-.5)*3;if(!walk(Math.floor(sx),Math.floor(sy))){sx=best.x;sy=best.y}rat.scent={x:sx,y:sy};rat.path=null;rat.repath=0}else rat.scent=null}
  else{rat.state='forage';wander(rat,.5,.12)}}
 /* Reprodução lenta, limitada por população máxima. População zero é extinção permanente. */
 if(populations.rats>0&&populations.rats<ECOLOGY.rats.maxPopulation){populations.ratBirth=(populations.ratBirth||0)+dt/ECOLOGY.rats.reproductionSeconds;if(populations.ratBirth>=1){populations.ratBirth-=1;populations.rats=Math.min(ECOLOGY.rats.maxPopulation,populations.rats+1);if(rats.filter(r=>r.alive).length<ECOLOGY.rats.activeLimit){const b=burrows[Math.floor(Math.random()*Math.max(1,burrows.length))];if(b)rats.push({x:b.x,y:b.y,homeX:b.x,homeY:b.y,burrowId:b.id,familyId:b.familyId,phase:Math.random()*6.28,heading:Math.random()*6.28,alive:true,hunt:0,hunger:30,state:'forage',decision:0,visible:true})}}}
 if(populations.roaches>0&&populations.roaches<ECOLOGY.roaches.maxPopulation){populations.roachBirth=(populations.roachBirth||0)+dt/ECOLOGY.roaches.reproductionSeconds;if(populations.roachBirth>=1){populations.roachBirth-=1;populations.roaches=Math.min(ECOLOGY.roaches.maxPopulation,populations.roaches+1);if(roaches.filter(r=>r.alive).length<ECOLOGY.roaches.activeLimit){const b=burrows[Math.floor(Math.random()*Math.max(1,burrows.length))];if(b)roaches.push({x:b.x+(Math.random()-.5),y:b.y+(Math.random()-.5),homeX:b.x,homeY:b.y,phase:Math.random()*6.28,heading:Math.random()*6.28,alive:true,state:'forage',hunger:20,decision:0})}}}
 /* Captura de rato: só ao correr diretamente em sua direção e encostar nele. */
 const movingX=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),movingY=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0),movingLen=Math.hypot(movingX,movingY)||1;
 if(keys.shift&&(movingX||movingY)){for(const rat of rats){if(!rat.alive)continue;const dx=rat.x-P.x,dy=rat.y-P.y,d=Math.hypot(dx,dy);const toward=(movingX*dx+movingY*dy)/movingLen/(d||1);if(d<.55&&toward>.45){if(addItem({name:'Carne de rato',type:'food',tags:['consumivel'],desc:'Carne crua de rato. Pode ser comida para recuperar a fome.'})){rat.alive=false;populations.rats=Math.max(0,populations.rats-1);say('Rato capturado! População restante: '+populations.rats+'.',2600)}break}}}
 /* Quando a população chega a zero, nenhum indivíduo ou nascimento permanece. */
 if(populations.rats<=0){populations.rats=0;rats=[]}if(populations.roaches<=0){populations.roaches=0;roaches=[]}
 AbyssModule.update(dt);AbyssHome.update(dt);
 if(GuardModule.update(dt))return;
  const px=Math.floor(P.x),py=Math.floor(P.y);
 for(let y=py-5;y<=py+5;y++)for(let x=px-5;x<=px+5;x++){if(x<0||y<0||x>=W||y>=H)continue;const i=y*W+x;if(!expl[i]&&T[i]){expl[i]=1;mmc.fillStyle=BD[bandAt(y)].c[0];mmc.fillRect(x,y,1,1)}}
 const b=bandAt(py);if(b!=curB){curB=b;say('SETOR: '+BD[b].n,2200)}
 elapsed+=dt;const daySeconds=12*60,day=Math.floor(elapsed/daySeconds)+1,dayTime=elapsed%daySeconds,gameHour=Math.floor(dayTime/60),gameMin=Math.floor(dayTime%60);
 if(day>31)return finish(0);
 {const hs=`<b>${BD[b].n}</b><br>DIA <b>${String(day).padStart(2,'0')} / 31</b> · MÊS DE 31 DIAS<br>HORÁRIO ${String(gameHour).padStart(2,'0')}:${String(gameMin).padStart(2,'0')} · 12 MIN/DIA<br><span class="hunger">FOME ${hunger}%</span><br><span style="color:#78b7cf">SEDE ${thirst}%</span><br>SONO ${sleep}%<br>RATOS ${populations.rats}/100 · BARATAS ${populations.roaches}/100<br>MECANISMOS ${have.map(h=>h?'◆':'◇').join(' ')}<br><span style="color:#c9a0ff">ALMAS ${AbyssModule.countSouls()}${AbyssModule.isCarryingBody()?' · CARREGANDO CORPO':''}</span><br><span style="color:#7e8878;font-size:11px">SEED #${seed} · WASD mover · SHIFT correr · C agachar · F lamparina · L girar câmera · E interagir · R novo layout</span>`;if(hs!==_hudCache){$('hud').innerHTML=hs;_hudCache=hs}}
 if(currentPanel==='status'&&$('invPanel').classList.contains('on'))renderBodyStatus();
 const t=target();if(t&&!$('msg').classList.contains('on'))say(t.t=='elevator'?'[E] Entrar no elevador':t.t=='gate'?'[E] Examinar o portão':(t.t=='door'||t.t=='doubleDoor')?(t.open?'[E] Fechar porta':'[E] Abrir '+(t.t==='doubleDoor'?'portas duplas':'porta')):t.t=='coletor'?'[E] Coletor de Almas':t.t=='bed'?'[E] Deitar e descansar':t.t=='note'?'[E] Ler o bilhete':t.t=='item'?'[E] Pegar item':t.t=='crate'?'[E] Abrir caixa':t.t=='rat'?'Corra em direção ao rato para capturá-lo':t.t=='roach'?'[E] Capturar barata':'[E] Pegar o mecanismo',400);
 const d=$('dot'),q=$('mm').getBoundingClientRect();d.style.left=(q.left+P.x*q.width/128)+'px';d.style.top=(q.top+P.y*q.height/H)+'px'}

/* ---------- renderização 2.5D / Three.js (v1.3.7) ----------
   O mapa lógico continua em células X/Y para não quebrar IA, colisões e saves.
   Na cena 3D, o eixo Y lógico vira Z; o eixo vertical real é Y.
   Cenário e mobiliário são meshes 3D. Seres vivos são sprites billboards. */
function disposeWorld3D(){
 if(!world3D)return;
 for(const model of [...ratSprites,...roachSprites]){scene3D.remove(model);model.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(mm=>mm.dispose());else o.material.dispose()}})}
 objMesh.clear();
 scene3D.remove(world3D);
 world3D.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}});
 world3D=null;ratSprites=[];roachSprites=[];chunkItems=[];lastChunkKey=-1;
}
function mat(color,roughness=.92,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness})}
function addBox(parent,x,z,w,h,d,color,opts={}){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,opts.roughness??.92,opts.metalness??0));
 mesh.position.set(x,opts.y??h/2,z);mesh.castShadow=opts.castShadow!==false;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function addCylinder(parent,x,z,radius,height,color,segments=12){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,segments),mat(color,.82,.08));
 mesh.position.set(x,height/2,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function floorColor(band,x,y){
 const b=BD[bandAt(y)];return ((x+y)&1)?b.c[0]:b.c[1];
}
/*PXT_EXPORT*/

/* v1.6: variantes comuns (0/6/7, próprias do andar) e raras (1-5) com espaçamento: nenhuma rara encosta noutra */
const isRareF=(x,y)=>hash(x*5+3,y*11+7)<.05;
function floorVariant(x,y){
 if(isRareF(x,y)&&!isRareF(x-1,y)&&!isRareF(x,y-1)&&!isRareF(x-1,y-1)&&!isRareF(x+1,y-1)&&!isRareF(x-1,y+1)){const q=hash(x+101,y+53);return q<.40?4:q<.72?1:q<.88?3:q<.97?2:5}
 const r=hash(x+31,y+17);return r<.46?0:r<.74?6:7}
/* paredes: comuns = lisa/desgastada/canos; raras (mural, caixa, quadro, sangue, aviso, cartaz) 1 por bloco de 9x9, com chance menor que 1 */
const WCOMMON=[[9,9,10,10,11,0,1,2],[9,10,11,0,1,1,2,2],[9,9,10,10,11,0,1,2],[9,10,11,0,1,2],[9,9,10,11,0,1,2],[9,9,10,10,11,0,1,2],[9,10,11,0,1,2],[9,10,11,0,1,2]];
const WRARE=[[3,4,5,7,8,6],[5,8,6,6,7],[6,5,6,7],[6,7,5,6],[4,7,8,5],[3,4,5,7,8,6],[6,7,5],[6,7,5]];
const WRATE=[.60,.55,.45,.50,.60,.60,.35,.12]; /* v1.7: o 8º valor é o Jardim (muros de pedra, quase sem cartazes) */
function wallVariant(b,x,y){
 const SC=9,sx=Math.floor(x/SC),sy=Math.floor(y/SC);
 if(hash(sx+b*31,sy+77)<WRATE[b]&&x===sx*SC+Math.floor(hash(sx*3+b,sy+9)*SC)&&y===sy*SC+Math.floor(hash(sx+5,sy*3+b)*SC)){const L=WRARE[b];return L[Math.floor(hash(x+13,y+29)*L.length)]}
 const L=WCOMMON[b],v=L[Math.floor(hash(Math.floor(x/5)+b*13,Math.floor(y/5)+101)*L.length)];return v>=9?9+Math.floor(hash(x+5,y+3)*3):v}
function buildFloorAndWalls(){
 const floorG=new Map(),wallG=new Map();
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x,b=bandAt(y);
  const cid=(y>>4)*CH_COLS+(x>>4);
  if(T[i]){const k=cid*1000+b*10+floorVariant(x,y);if(!floorG.has(k))floorG.set(k,[]);floorG.get(k).push([x,y])}
  else if(wallNear(x,y)){const k=cid*1000+b*100+wallVariant(b,x,y);if(!wallG.has(k))wallG.set(k,[]);wallG.get(k).push([x,y])}
 }
 const floorGeo=new THREE.BoxGeometry(1,.10,1),wallGeo=new THREE.BoxGeometry(1,2.0,1),dummy=new THREE.Object3D(),rough=[.62,.5,.72,.6,.55,.7,.8,.97];
 for(const [k0,cells] of floorG){const cid=Math.floor(k0/1000),k=k0%1000,b=Math.floor(k/10),v=k%10;
  const m=new THREE.MeshStandardMaterial({map:PXT.floor(b,v),roughness:rough[b],metalness:.04});
  const mesh=new THREE.InstancedMesh(floorGeo,m,cells.length);
  cells.forEach(([x,y],n)=>{dummy.position.set(x+.5,-.09,y+.5);dummy.updateMatrix();mesh.setMatrixAt(n,dummy.matrix)});
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.userData.chunk=cid;chunkItems.push(mesh);world3D.add(mesh);
 }
 for(const [k0,cells] of wallG){const cid=Math.floor(k0/1000),k=k0%1000,b=Math.floor(k/100),v=k%100;
  const side=new THREE.MeshStandardMaterial({map:PXT.wall(b,v),roughness:.95,metalness:0}),topM=new THREE.MeshStandardMaterial({map:PXT.top(b),roughness:.95,metalness:0});
  const mesh=new THREE.InstancedMesh(wallGeo,[side,side,topM,topM,side,side],cells.length);
  cells.forEach(([x,y],n)=>{dummy.position.set(x+.5,1,y+.5);dummy.updateMatrix();mesh.setMatrixAt(n,dummy.matrix)});
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.userData.chunk=cid;chunkItems.push(mesh);world3D.add(mesh);
 }
}
/* sangue, ralos, papéis e manchas de umidade: instâncias planas sobre o piso (determinístico por seed) */
function buildDecals(){
 const R=rng(((seed||1)*48271+977)|0);
 const BL=[.006,.008,.006,.014,.006,.006,.003,.002],VT=[.0015,.004,.004,.002,.0025,.002,.0015,0],PP=[.008,.003,.002,.001,.006,.010,.001,.004],DM=[.010,.012,.025,.012,.010,.012,.030,.020];
 const L={blood:[[],[],[],[]],vent:[],papers:[],damp:[[],[]]};
 const far={blood:new Map(),vent:new Map()},free=(k,x,y,d)=>{const bx=Math.floor(x/d),by=Math.floor(y/d),M=far[k];for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const l=M.get((bx+i)+','+(by+j));if(l)for(const q of l)if(Math.hypot(q[0]-x,q[1]-y)<d)return false}const key=bx+','+by;if(!M.has(key))M.set(key,[]);M.get(key).push([x,y]);return true};
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const a=R(),b=R(),c=R(),d=R(),i=y*W+x;
  if(T[i]!==1||OB[i])continue;
  const band=bandAt(y);let acc=BL[band];
  if(a<acc){if(free('blood',x,y,12))L.blood[Math.floor(b*4)].push([x+.5+(c-.5)*.5,y+.5+(d-.5)*.5,c*6.283,.9+b*.9])}
  else if(a<(acc+=VT[band])){if(free('vent',x,y,16))L.vent.push([x+.5,y+.5,0,.78])}
  else if(a<(acc+=PP[band]))L.papers.push([x+.5+(c-.5)*.4,y+.5+(d-.5)*.4,c*6.283,.55]);
  else if(a<(acc+=DM[band]))L.damp[Math.floor(b*2)].push([x+.5,y+.5,c*6.283,1.4+d]);
 }
 const geo=new THREE.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);
 const add=(tex,list,y,extra)=>{if(!list.length)return;
  const m=new THREE.MeshStandardMaterial(Object.assign({map:tex,transparent:true,depthWrite:false,roughness:.35,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2},extra||{}));
  const mesh=new THREE.InstancedMesh(geo,m,list.length),d=new THREE.Object3D();
  list.forEach((e,n)=>{d.position.set(e[0],y,e[1]);d.rotation.set(0,e[2],0);d.scale.set(e[3],1,e[3]);d.updateMatrix();mesh.setMatrixAt(n,d.matrix)});
  mesh.instanceMatrix.needsUpdate=true;mesh.receiveShadow=true;mesh.renderOrder=1;world3D.add(mesh)};
 for(let v=0;v<4;v++)add(PXT.blood(v),L.blood[v],.004);
 for(let v=0;v<2;v++)add(PXT.damp(v),L.damp[v],.003,{roughness:.2});
 add(PXT.vent(),L.vent,.004,{roughness:.7});
 add(PXT.papers(),L.papers,.005,{roughness:.9});
}
/* luminárias fluorescentes de parede + poças de luz aditivas; as luzes reais ficam num pool (updateLampPool) */
function buildFixtures(){
 lampSpots=[];
 const doorCells=new Set();for(const o of OBJ)if(o.t==='door'||o.t==='doubleDoor')for(let n=0;n<(o.w||1);n++)doorCells.add((o.x+(o.axis==='h'?n:0))+','+(o.y+(o.axis==='v'?n:0)));
 const nearDoor=(cx,cy)=>{for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++)if(doorCells.has((cx+i)+','+(cy+j)))return true;return false};
 const dirs=[[0,-1],[1,0],[0,1],[-1,0]],PR=[.62,.5,.3,.22,.55,.6,.15,.10],COL=[0xffe2b0,0xcfe9d6,0xf2c58a,0xe8a878,0xdff0dc,0xffd9a0,0x9fb7d0,0xb9d3b0],INT=[7,6,5,4.5,6.5,6,3.5,4.2],POOL=['warm','cool','warm','red','cool','warm','cool','cool'];
 const items=[[],[],[],[],[],[],[],[]];
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  if(T[y*W+x]!==1)continue;const band=bandAt(y);
  for(let k=0;k<4;k++){
   const dx=dirs[k][0],dy=dirs[k][1],wi=(y+dy)*W+x+dx;
   if(T[wi]!==0||OB[wi])continue;
   if(nearDoor(x,y)||nearDoor(x+dx,y+dy))continue;
   if((dx===0?x:y)%6!==3)continue;
   if(hash(x*3+k*17+1,y*5+k*11+9)>=PR[band])continue;
   const wx=x+dx+.5,wz=y+dy+.5;
   items[band].push({x:wx-dx*.58,z:wz-dy*.58,dx,dy,px:wx-dx*1.55,pz:wz-dy*1.55});
   lampSpots.push({x:wx-dx*.58,z:wz-dy*.58,lx:wx-dx*.95,lz:wz-dy*.95,color:COL[band],int:INT[band]});
  }
 }
 const all=[].concat(...items);
 if(all.length){
  const hm=new THREE.InstancedMesh(new THREE.BoxGeometry(.80,.07,.17),new THREE.MeshStandardMaterial({color:0x2a2d2a,roughness:.7,metalness:.3}),all.length);
  const tm=new THREE.InstancedMesh(new THREE.BoxGeometry(.70,.035,.10),new THREE.MeshBasicMaterial({color:0xfff2cf}),all.length),d=new THREE.Object3D();
  all.forEach((f,n)=>{d.rotation.set(0,f.dx!==0?Math.PI/2:0,0);d.position.set(f.x,1.62,f.z);d.updateMatrix();hm.setMatrixAt(n,d.matrix);
   d.position.set(f.x-f.dx*.045,1.62,f.z-f.dy*.045);d.updateMatrix();tm.setMatrixAt(n,d.matrix)});
  hm.instanceMatrix.needsUpdate=true;tm.instanceMatrix.needsUpdate=true;hm.castShadow=false;world3D.add(hm,tm);
 }
 const poolGeo=new THREE.PlaneGeometry(1,1);poolGeo.rotateX(-Math.PI/2);
 for(let b=0;b<7;b++){const list=items[b];if(!list.length)continue;
  const pm=new THREE.MeshBasicMaterial({map:PXT.pool(POOL[b]),transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false});
  const mesh=new THREE.InstancedMesh(poolGeo,pm,list.length),d=new THREE.Object3D();
  list.forEach((f,n)=>{d.position.set(f.px,.008,f.pz);d.scale.set(5.2,1,5.2);d.updateMatrix();mesh.setMatrixAt(n,d.matrix)});
  mesh.instanceMatrix.needsUpdate=true;mesh.renderOrder=2;world3D.add(mesh);
 }
}
/* Mantém só ~6 PointLights reais, sempre nas luminárias mais próximas de Karl (fade suave ao trocar). */
function updateLampPool(px,pz){
 if(!lampPool.length)return;
 const near=[];for(const s of lampSpots){const d=(s.x-px)*(s.x-px)+(s.z-pz)*(s.z-pz);if(d<121)near.push({d,s})}
 near.sort((a,b)=>a.d-b.d);
 const want=new Set(near.slice(0,lampPool.length).map(e=>e.s)),bound=new Set();
 for(const Lt of lampPool){const s=Lt.userData.spot;if(s&&want.has(s))bound.add(s)}
 const free=[...want].filter(s=>!bound.has(s));
 for(const Lt of lampPool){
  const s=Lt.userData.spot;
  if(s&&want.has(s))Lt.intensity+=(s.int-Lt.intensity)*.12;
  else{Lt.intensity*=.82;if(Lt.intensity<.05){Lt.intensity=0;const n=free.shift();if(n){Lt.userData.spot=n;Lt.position.set(n.lx,1.45,n.lz);Lt.color.setHex(n.color)}else Lt.userData.spot=null}}
 }
}

/* Funde os móveis/objetos estáticos (centenas de caixas e cilindros) em poucas malhas por material:
   de ~5 mil draw calls para algumas dezenas. Transparentes e instanciados ficam de fora; se algo falhar, mantém tudo como estava. */
function mergeStaticObjects(){
 try{
  world3D.updateMatrixWorld(true);
  const buckets=new Map(),victims=[];
  for(const grp of world3D.children){
   if(!grp.isGroup||grp.userData.dynamic)continue;
   grp.traverse(m=>{
    if(!m.isMesh||m.isInstancedMesh)return;
    const mt=m.material;
    if(!mt||Array.isArray(mt)||!mt.isMeshStandardMaterial||mt.transparent||mt.side!==THREE.FrontSide)return;
    victims.push(m);
    if(!m.visible)return;
    const key=[grp.userData.chunk,mt.color.getHex(),mt.emissive.getHex(),mt.emissiveIntensity,mt.roughness,mt.metalness,m.castShadow?1:0,m.receiveShadow?1:0].join('|');
    let bk=buckets.get(key);
    if(!bk){bk={mat:mt,cs:m.castShadow,rs:m.receiveShadow,ck:grp.userData.chunk,parts:[],verts:0,idx:0};buckets.set(key,bk)}
    const g=m.geometry.clone();g.applyMatrix4(m.matrixWorld);
    bk.parts.push(g);bk.verts+=g.attributes.position.count;bk.idx+=g.index?g.index.count:g.attributes.position.count;
   });
  }
  const merged=[];
  for(const bk of buckets.values()){
   const pos=new Float32Array(bk.verts*3),nor=new Float32Array(bk.verts*3),uv=new Float32Array(bk.verts*2),idx=new Uint32Array(bk.idx);
   let vo=0,io=0;
   for(const g of bk.parts){
    const n=g.attributes.position.count;
    pos.set(g.attributes.position.array,vo*3);nor.set(g.attributes.normal.array,vo*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,vo*2);
    if(g.index){const a=g.index.array;for(let i=0;i<a.length;i++)idx[io+i]=a[i]+vo;io+=a.length}else{for(let i=0;i<n;i++)idx[io+i]=vo+i;io+=n}
    vo+=n;g.dispose();
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(new THREE.BufferAttribute(idx,1));
   const mesh=new THREE.Mesh(geo,bk.mat.clone());mesh.castShadow=bk.cs;mesh.receiveShadow=bk.rs;mesh.userData.chunk=bk.ck;chunkItems.push(mesh);merged.push(mesh);
  }
  for(const m of merged)world3D.add(m);
  for(const v of victims){if(v.parent)v.parent.remove(v);if(v.geometry)v.geometry.dispose();if(v.material)v.material.dispose()}
  for(const grp of [...world3D.children])if(grp.isGroup&&grp.children.length===0)world3D.remove(grp);
  for(const grp of world3D.children)if(grp.isGroup&&grp.userData.chunk!==undefined)chunkItems.push(grp);
 }catch(err){console.warn('ABISM: fusão estática falhou; mantendo meshes individuais.',err)}
}

/* grupos 3D de objetos interativos (fora da fusão estática) — Map para não entrar no snapshot do save */
const objMesh=new Map(),DYNAMIC_T=['door','doubleDoor','mech','note','item','altar','coletor'];
function refreshObjectMesh(o){
 if(!o||!world3D){worldNeedsBuild=true;return}
 const old=objMesh.get(o);if(!old){worldNeedsBuild=true;return}
 world3D.remove(old);const ix=chunkItems.indexOf(old);if(ix>=0)chunkItems.splice(ix,1);
 old.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material){if(Array.isArray(n.material))n.material.forEach(mm=>mm.dispose());else n.material.dispose()}});
 const g=buildObject3D(o);chunkItems.push(g);updateChunks(P.x,P.y,true);
}
function buildObject3D(o){
 const x=o.x+(o.w||1)/2,z=o.y+.5,w=(o.w||1)*.88,band=bandAt(o.y),sterile=[0,4].includes(band),dark=[2,3].includes(band);
 const wood=dark?0x40352c:0x66503a,metal=dark?0x454644:0x68716c,linen=sterile?0xc4c7bd:0x77746a;
 const group=new THREE.Group();group.userData.chunk=Math.max(0,Math.min(H-1,o.y>>4<<4))/CH*CH_COLS+Math.max(0,Math.min(W-1,o.x))/CH|0;world3D.add(group);if(DYNAMIC_T.includes(o.t)){group.userData.dynamic=true;objMesh.set(o,group)}
 const bx=(xx,zz,ww,hh,dd,c,yy,opts={})=>addBox(group,xx,zz,ww,hh,dd,c,{y:yy,...opts});
 const leg=(xx,zz,yy,h,c=wood,r=.045)=>{const m=addCylinder(group,xx,zz,r,h,c,8);m.position.y=yy+h/2;return m};
 const sign=(label,color=0x40352b)=>{
  bx(x,z-.43,.72,.48,.075,color,1.58);
  bx(x,z-.385,.64,.39,.012,0xb49b6b,1.58,{castShadow:false});
  const plate=new THREE.Mesh(new THREE.BoxGeometry(.58,.30,.008),mat(color,.95));plate.position.set(x,1.58,z-.375);group.add(plate);
  // Letras geométricas discretas: permanecem legíveis mesmo sem texturas externas.
  const count=label==='DIRETOR'?7:(label==='PSIQ.'||label==='WC')?5:label==='CIR.'?4:7;
  for(let i=0;i<count;i++)bx(x-(count-1)*.035+i*.07,z-.365,.025,.035,.008,0xd8c9a5,1.58,{castShadow:false});
 };
 switch(o.t){
  case 'bed':{
   const frame=o.shabby?0x514237:sterile?0x9ba49e:0x51483e,cover=o.shabby?0x655347:sterile?0xd9ddd6:dark?0x4b4942:(o.v>6?0x6b7580:0x8a8f98);
   bx(x,z,w,.20,.82,frame,.20);bx(x,z,w*.92,.12,.75,cover,.34);
   bx(x-w*.31,z,w*.30,.14,.68,o.shabby?0x514239:sterile?0xf1f1eb:0xb9b9ae,.45);
   bx(x-w*.46,z,.09,.48,.91,0x555d58,.38);bx(x+w*.46,z,.09,.48,.91,0x555d58,.38);
   for(const xx of [x-w*.4,x+w*.4])for(const zz of [z-.32,z+.32])leg(xx,zz,.02,.22,frame,.035);
   if(sterile){bx(x,z-.43,w*.9,.025,.035,0xf4f5ef,.48);bx(x,z+.43,w*.9,.025,.035,0xf4f5ef,.48)}
   break;
  }
  case 'locker':case 'cabinet':{
   const isLocker=o.t==='locker',body=isLocker?metal:0x777064;
   bx(x,z,.66,1.48,.58,body,.76);bx(x,z-.302,.60,1.38,.025,isLocker?0x59615d:0x8b8171,.76);
   if(isLocker){for(let k=0;k<3;k++)bx(x,z-.32,.42,.018,.012,0x303633,.45+k*.13);bx(x+.20,z-.325,.025,.11,.018,0xb5aa91,.72)}
   else{bx(x-.18,z-.32,.018,1.27,.018,0x29251f,.76);bx(x+.18,z-.32,.018,1.27,.018,0x29251f,.76);for(let k=0;k<2;k++)bx(x,z-.32,.54,.018,.018,0x29251f,.40+k*.65);}
   addCylinder(group,x+.22,z-.34,.025,.055,0xd0b77a,8).position.y=.78;break;
  }
  case 'desk':case 'directorDesk':{
   const top=o.shabby?0x39312a:sterile?0xe6e8e3:wood;
   bx(x,z,w,.16,.72,top,.82);bx(x,z,w*.90,.035,.66,o.t==='directorDesk'?0x7d5b3e:top,.92);
   for(const xx of [x-w*.38,x+w*.38]){bx(xx,z,.09,.72,.12,wood,.40);bx(xx,z-.22,.11,.48,.10,0x45372b,.36)}
   bx(x,z-.17,w*.58,.025,.22,sterile?0xffffff:0xb9b29a,.95);
   if(o.t==='directorDesk'){bx(x,z-.08,.24,.025,.17,0xd7d0b7,.98);bx(x+.18,z+.08,.12,.018,.08,0x393b37,.98)}
   else{bx(x-.20,z-.08,.16,.018,.12,0xd8d0a8,.98)}
   break;
  }
  case 'table':case 'longTable':case 'messTable':{
   const top=o.t==='table'?0xaeb9bb:o.t==='messTable'?0x6a5a45:0x8c8a7c,depth=.72;
   bx(x,z,w,.14,depth,top,.78);bx(x,z,w*.92,.025,depth*.88,o.t==='messTable'?0x8a765c:0xbdbaa8,.87);
   for(const xx of [x-w*.40,x+w*.40])for(const zz of [z-.27,z+.27])leg(xx,zz,.03,.68,o.t==='table'?0x51534d:0x51483d,.035);
   if(o.t==='table'){bx(x-.18,z-.08,.18,.035,.12,0x7a1414,.91);bx(x+.19,z+.09,.06,.025,.12,0x2a2a2a,.91)}
   if(o.t==='messTable'){bx(x-w*.30,z-.08,.18,.025,.13,0xd4cdb4,.91);bx(x+w*.28,z+.08,.12,.025,.10,0x4a2420,.91)}
   if(o.t==='longTable'){bx(x-.18+(o.v%3)*.08,z,.15,.025,.12,0x4a2f2a,.91);bx(x+w*.30,z+.13,.09,.025,.09,0x585649,.91)}
   break;
  }
  case 'counter':
   bx(x,z,w,.22,.68,0x5d5a50,.82);bx(x,z-.02,w*.96,.07,.64,0x8e8a7a,.96);bx(x,z+.25,w,.16,.08,0x3a372f,1.12);
   bx(x-.20,z-.08,.14,.025,.10,0x393631,1.01);break;
  case 'stretcher':{
   bx(x,z,w,.10,.55,0x58625e,.58);bx(x,z,w*.94,.13,.50,0xc2c8c0,.70);bx(x,z,w*.82,.035,.40,0xe7e8e2,.79);
   bx(x-w*.39,z,.12,.18,.20,0xb6c1bb,.88);
   for(const xx of [x-w*.40,x+w*.40])for(const zz of [z-.20,z+.20])leg(xx,zz,.04,.45,0x606d69,.025);
   break;
  }
  case 'stairs':{AbyssHome.buildStairs(o,group);break}
  case 'altar':{
   // Altar do Deus do Abismo: pedra negra, runas rubras e um orbe flutuante (animado por AbyssModule.animate).
   addBox(group,x,z,1.78,.16,.95,0x15111a);
   addBox(group,x,z,1.46,.62,.72,0x2b2630,{y:.47});
   addBox(group,x,z,1.66,.12,.86,0x3a3342,{y:.84});
   for(const sx of[-.7,.7])addBox(group,x+sx,z-.28,.16,1.05,.16,0x1b1720);
   const runeM=addBox(group,x,z+.37,1.1,.08,.02,0x7a1030,{y:.5,castShadow:false});runeM.material.emissive=new THREE.Color(0xa01040);runeM.material.emissiveIntensity=1.2;
   const ring=new THREE.Mesh(new THREE.TorusGeometry(.3,.025,8,28),new THREE.MeshStandardMaterial({color:0x9a2050,emissive:0xc0245c,emissiveIntensity:1.2}));
   ring.rotation.x=Math.PI/2;ring.position.set(x,1.3,z);group.add(ring);
   const orb=new THREE.Mesh(new THREE.SphereGeometry(.15,18,14),new THREE.MeshStandardMaterial({color:0xff4a7a,emissive:0xd81b50,emissiveIntensity:1.5,roughness:.3}));
   orb.position.set(x,1.3,z);group.add(orb);
   group.userData.abyss={orb,ring};break}
  case 'coletor':{
   // Coletor de Almas: câmara de vidro com rotor, moega escura para o corpo e lâmpada de estado.
   const steel=0x4b5553,dk=0x1b211f;
   addBox(group,x,z,1.84,.5,.86,steel,{metalness:.25});
   addBox(group,x,z,1.52,.07,.72,dk,{y:.54});
   const glass=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.98,20,1,true),new THREE.MeshStandardMaterial({color:0x9fe8ff,emissive:0x2a8fb0,emissiveIntensity:.35,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false}));
   glass.position.set(x-.4,1.06,z);group.add(glass);
   const rotor=new THREE.Group();rotor.position.set(x-.4,1.06,z);
   const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.86,8),mat(0x8a9390,.4,.5));rotor.add(shaft);
   for(const a of[0,Math.PI/2]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.5,.05,.05),mat(0x8a9390,.4,.5));arm.rotation.y=a;arm.position.y=.2;rotor.add(arm)}
   group.add(rotor);
   addBox(group,x-.4,z,.78,.06,.78,dk,{y:1.58});
   addBox(group,x+.52,z,.62,1.05,.74,dk,{y:.9});
   addBox(group,x+.52,z+.375,.42,.5,.03,0x090c0b,{y:.8,castShadow:false});
   const lamp=new THREE.Mesh(new THREE.SphereGeometry(.07,12,10),new THREE.MeshStandardMaterial({color:0x38d46a,emissive:0x12a044,emissiveIntensity:1.4}));
   lamp.position.set(x+.52,1.5,z+.3);group.add(lamp);
   group.userData.abyss={rotor,glass,lamp};break}
  case 'tank':{
   // Cilindro de vidro com líquido azul-esverdeado emissivo, tampas metálicas e três pés (referência: tanques do laboratório).
   const metal=0x2e3331;
   const glass=new THREE.Mesh(new THREE.CylinderGeometry(.30,.30,1.2,20,1,true),new THREE.MeshStandardMaterial({color:0x7fe0d4,emissive:0x1f9a90,emissiveIntensity:1.1,roughness:.15,metalness:0,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));
   glass.position.set(x,.95,z);group.add(glass);
   const liq=new THREE.Mesh(new THREE.CylinderGeometry(.255,.255,1.05,16),new THREE.MeshStandardMaterial({color:0x2fb5a8,emissive:0x188a80,emissiveIntensity:1.25,roughness:.3,transparent:true,opacity:.55,depthWrite:false}));
   liq.position.set(x,.92,z);group.add(liq);
   addCylinder(group,x,z,.35,.12,metal,18).position.y=.40;
   addCylinder(group,x,z,.35,.12,metal,18).position.y=1.55;
   addCylinder(group,x,z,.12,.10,0x4a514d,12).position.y=1.66;
   for(let k=0;k<3;k++){const a=k*2.094+.5;addCylinder(group,x+Math.cos(a)*.28,z+Math.sin(a)*.28,.03,.40,metal,6).position.y=.20}
   const gl=new THREE.Mesh(new THREE.PlaneGeometry(1.9,1.9),new THREE.MeshBasicMaterial({map:PXT.pool('teal'),transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));
   gl.rotation.x=-Math.PI/2;gl.position.set(x,.007,z);group.add(gl);
   break;
  }
  case 'crate':{
   const c=0x66513a;bx(x,z,.68,.52,.62,c,.29);
   for(const xx of [x-.29,x+.29])bx(xx,z,.045,.58,.66,0x3d3023,.30);
   for(const yy of [.10,.48])bx(x,z,.70,.045,.66,0x8a6a46,yy);
   bx(x,z-.335,.12,.52,.025,0x3a2b1e,.30);bx(x,z+.335,.12,.52,.025,0x3a2b1e,.30);
   // Travessas em X na face frontal e tampa, recuperando a leitura de caixote de madeira.
   const brace1=bx(x,z-.344,.72,.07,.025,0x4a3828,.30);brace1.rotation.z=.68;
   const brace2=bx(x,z-.346,.72,.07,.025,0x4a3828,.30);brace2.rotation.z=-.68;
   break;
  }
  case 'bucket':{
   addCylinder(group,x,z,.24,.38,0x555b58,12);addCylinder(group,x,z,.25,.035,0x777d79,12).position.y=.38;
   const pts=[new THREE.Vector3(x-.19,.39,z),new THREE.Vector3(x-.16,.63,z),new THREE.Vector3(x,.70,z),new THREE.Vector3(x+.16,.63,z),new THREE.Vector3(x+.19,.39,z)];
   const handle=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,.018,6,false),mat(0x777d79));group.add(handle);break;
  }
  case 'pillar':{
   addCylinder(group,x,z,.38,1.65,0x294a70,16);addCylinder(group,x,z,.42,.10,0x3f6a9e,16).position.y=1.60;addCylinder(group,x,z,.42,.10,0x1c3350,16).position.y=.05;
   addCylinder(group,x-.10,z-.08,.045,.015,0x7aa6d6,8).position.y=1.67;break;
  }
  case 'bookcase':{
   bx(x,z,.68,1.62,.44,0x44352b,.81);bx(x,z-.235,.60,1.50,.025,0x30251f,.81);
   for(let k=0;k<3;k++){const yy=.40+k*.40;bx(x,z-.255,.60,.045,.045,0x8b765a,yy);for(let j=0;j<4;j++){const colors=[0x8b5141,0x9c8651,0x526b5a,0x777d83];bx(x-.22+j*.145,z-.285,.105,.25,.035,colors[(j+k)%4],yy+.15)}}
   break;
  }
  case 'chair':case 'cchair':{
   const green=o.t==='cchair';const seat=green?0x35523f:0x51483d,back=green?0x4f7a5d:0x766653;
   bx(x,z,.42,.12,.42,seat,.48);bx(x,z+.17,.42,.65,.08,back,.82);
   for(const xx of [x-.16,x+.16]){leg(xx,z-.15,.04,.42,seat,.025);leg(xx,z+.15,.04,.42,seat,.025)}
   bx(x,z+.205,.34,.10,.035,green?0x233a2c:0x51483d,.64);
   if(green)bx(x,z-.04,.34,.04,.36,0x4f7a5d,.57);break;
  }
  case 'couch':
   bx(x,z,w,.34,.58,0x4a3a35,.38);bx(x,z+.23,w,.60,.13,0x6b5249,.70);bx(x,z-.23,w,.50,.12,0x33282a,.64);
   bx(x-w*.42,z,.13,.48,.62,0x3e302e,.55);bx(x+w*.42,z,.13,.48,.62,0x3e302e,.55);break;
  case 'cellBars':
   for(let k=0;k<o.w;k++){const xx=o.x+k+.5;addCylinder(group,xx,o.y+.5,.022,1.9,0x777a74,8).position.y=.95}
   bx(o.x+o.w/2,o.y+.5,o.w,.055,.055,0x777a74,1.65);bx(o.x+o.w/2,o.y+.5,o.w,.045,.045,0x777a74,.25);break;
  case 'door':case 'doubleDoor':{
   // Porta pesada com batentes, verga, janelinha de vidro escuro e maçaneta; aberta = só o batente.
   const isH=o.axis==='h',n=o.w||1,len=n;
   const cx=isH?o.x+n/2:o.x+.5,cz=isH?o.y+.5:o.y+n/2;
   const A=(oa,oc,wa,h,dc,c,yy,opts)=>isH?bx(cx+oa,cz+oc,wa,h,dc,c,yy,opts):bx(cx+oc,cz+oa,dc,h,wa,c,yy,opts);
   const frame=0x1d201c,leaf=0x3b3a34,leafHi=0x4b483f;
   A(-len/2+.05,0,.10,2.0,.20,frame,1.0);A(len/2-.05,0,.10,2.0,.20,frame,1.0);A(0,0,len,.12,.20,frame,1.98);
   if(!o.open){
    for(let s=0;s<n;s++){const off=-len/2+.5+s;
     A(off,0,.86,1.78,.10,leaf,.89);
     for(const side of [-1,1]){
      A(off,side*.056,.70,1.60,.012,leafHi,.89,{castShadow:false});
      A(off,side*.058,.34,.34,.008,0x6e6d5f,1.38,{castShadow:false});
      A(off,side*.062,.26,.26,.008,0x0b0d0c,1.38,{castShadow:false});
     }
     const hd=(n===2?(s===0?.34:-.34):.30);
     A(off+hd,0,.05,.06,.26,0xb7a678,.92,{castShadow:false});
    }
    if(n===2)A(0,0,.02,1.76,.12,0x15170f,.89,{castShadow:false});
   }
   break;
  }
  case 'elevator':{
   // Elevador industrial antigo: portal de alvenaria, marco metálico e portas bipartidas.
   const ew=Math.max(1.25,w),front=z-.49,frame=dark?0x343936:0x59615c,steel=dark?0x626963:0x89918a;
   // Caixa escura do vão e soleira
   bx(x,front+.015,ew*.88,2.12,.10,0x111715,1.06);
   bx(x,front-.035,ew*.98,.16,.20,0x777d75,2.20);
   bx(x,front-.04,ew*.98,.12,.18,frame,.10);
   // Ombreiras laterais e travessa superior
   bx(x-ew*.49,front-.045,.105,2.34,.19,frame,1.17);
   bx(x+ew*.49,front-.045,.105,2.34,.19,frame,1.17);
   bx(x,front-.045,ew, .16,.19,frame,2.27);
   bx(x-ew*.49,front-.15,.035,2.12,.025,steel,1.16);
   bx(x+ew*.49,front-.15,.035,2.12,.025,steel,1.16);
   // Duas folhas pesadas, com frisos verticais e reforços
   const leaf=ew*.455;
   bx(x-leaf*.50,front-.105,leaf-.018,1.98,.075,0x747d76,1.10);
   bx(x+leaf*.50,front-.105,leaf-.018,1.98,.075,0x626b65,1.10);
   for(let side of [-1,1]){
    const cx=x+side*leaf*.50;
    bx(cx,front-.148,.025,1.82,.012,0x9ba198,1.10);
    bx(cx-side*leaf*.34,front-.148,.018,1.82,.012,0x4a514c,1.10);
    bx(cx,front-.151,leaf*.72,.035,.012,0x505852,.30);
    // Pequena placa de manutenção na parte inferior
    bx(cx,front-.153,.18,.055,.014,0x343a36,.43);
   }
   // Encontro central das portas e trilho superior
   bx(x,front-.158,.035,1.94,.018,0x252b28,1.10);
   bx(x,front-.16,ew*.82,.045,.025,0xb0a98f,2.12);
   // Indicador de andar antigo, acima da porta
   bx(x,front-.16,.48,.24,.055,0x171d1a,2.42);
   bx(x,front-.192,.36,.145,.012,0x8c9b82,2.42);
   bx(x,front-.202,.075,.075,.014,0xffa13b,2.43);
   // Caixa de chamada lateral com botão e parafusos
   const px=x+ew*.58;
   bx(px,front-.115,.16,.42,.075,0x343b37,1.55);
   bx(px,front-.158,.115,.31,.018,0x777f77,1.55);
   bx(px,front-.171,.055,.055,.018,0xe2a34e,1.68);
   bx(px,front-.171,.035,.035,.018,0x343a35,1.43);
   // Placa de advertência e parafusos nos cantos do portal
   bx(x,front-.151,.52,.10,.018,0x252c28,2.08);
   for(const sx of [-1,1])for(const sy of [.28,2.05]){
    const bolt=addCylinder(group,x+sx*ew*.45,front-.17,.018,.018,0xc4b58e,8);bolt.rotation.x=Math.PI/2;bolt.position.y=sy;
   }
   // Faixas gastas de segurança na soleira
   for(let k=0;k<8;k++)bx(x-ew*.39+k*ew*.112,front-.17,.055,.018,.018,k%2?0x252b28:0xc5a34f,.20);
   break;
  }
  case 'gate':
   bx(x,z,w,2.1,.18,0x343b3b,1.05);for(let k=0;k<7;k++)bx(x-w*.43+k*w*.145,z-.12,.045,2,.08,0x9a8b65,1.05);
   bx(x,z-.15,w,.06,.10,0x9a8b65,1.72);for(let k=0;k<3;k++){const light=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),mat(have[k]?0x55ff55:0xff3333));light.position.set(x-w*.25+k*w*.25,1.10,z-.22);group.add(light)}break;
  case 'note':if(!o.read){bx(x,z,.32,.025,.24,0xe8e2c8,.04);bx(x,z-.13,.22,.008,.012,0x8a846c,.055);bx(x,z-.08,.18,.008,.012,0x8a846c,.055)}break;
  case 'item':if(!o.taken){bx(x,z,.36,.12,.14,0xb9a36b,.10);bx(x+.08,z-.04,.07,.17,.08,0x29251b,.18)}break;
  case 'mech':if(!o.taken){bx(x,z,.42,.20,.42,0x2a2a28,.10);addCylinder(group,x,z,.16,.12,0xd28c3d,12).position.y=.27;addCylinder(group,x,z,.065,.15,0x292a27,10).position.y=.39}break;
  case 'leak':{
   const puddle=new THREE.Mesh(new THREE.CircleGeometry(.28,20),mat(0x293f4c,.25));puddle.rotation.x=-Math.PI/2;puddle.position.set(x,.012,z);group.add(puddle);
   addCylinder(group,x,z,.025,.012,0x9ec8e8,8).position.y=.025;break;
  }
  case 'directorSign':sign('DIRETOR');break;
  case 'psychSign':sign('PSIQ.');break;
  case 'canteenSign':sign('CANTINA');break;
  case 'wcSignM':sign('WC',0x2b4466);break;
  case 'wcSignF':sign('WC',0x6b3052);break;
  case 'surgSign':sign('CIR.',0x4a1f1f);break;
  case 'inkboard':
   bx(x,z,.68,.82,.09,0x252b27,1.08);bx(x,z-.052,.60,.72,.012,0xd9d4bf,1.08);
   for(let k=0;k<4;k++)bx(x-.12+(k%2)*.24,z-.06,.035,.16,.008,0x373a35,.88+Math.floor(k/2)*.18);break;
  case 'papers':{
   const paper=bx(x,z,.28,.018,.22,0xd8d2b4,.04);paper.rotation.y=o.v*.7;
   for(let k=0;k<2;k++)bx(x-.035,z-.025,.13,.004,.008,0x8a846c,.055+k*.006);break;
  }
  case 'rubble':
   for(let k=0;k<5;k++){const a=o.v*1.7+k*1.9,rx=Math.cos(a)*.16,rz=Math.sin(a*1.3)*.14;const rock=bx(x+rx,z+rz,.09+(k%2)*.07,.07+(k%3)*.025,.08,0x55534b,.07+k%2*.035);rock.rotation.y=a;rock.rotation.z=a*.35}break;
  case 'trash':
   bx(x,z,.48,.32,.42,0x272824,.20);bx(x-.09,z-.03,.14,.10,.12,0x8c887b,.39);bx(x+.12,z+.06,.18,.13,.12,0x5b5144,.36);break;
  case 'barrel':{
   addCylinder(group,x,z,.30,.86,0x3d4540,16);
   for(const yy of [.16,.43,.70])addCylinder(group,x,z,.315,.04,0x232824,16).position.y=yy;
   addCylinder(group,x,z,.28,.03,0x59625c,16).position.y=.87;
   addCylinder(group,x+.1,z-.06,.045,.02,0x151a17,8).position.y=.895;
   break;
  }
  case 'radiator':{
   const zr=z-.30;
   for(let k=0;k<8;k++)bx(x-.31+k*.088,zr,.06,.58,.12,0x5c5e58,.46);
   bx(x,zr,.78,.05,.10,0x30322f,.78);bx(x,zr,.78,.05,.10,0x30322f,.16);
   break;
  }
  case 'bench':{
   const bw=(o.w||3)*.92;
   bx(x,z,bw,.07,.40,0x2c3033,.46);bx(x,z+.2,bw,.38,.06,0x2c3033,.72);
   for(let k=0;k<4;k++)bx(x-bw*.375+k*bw*.25,z+.2,.015,.36,.07,0x15181a,.72);
   for(const xx of [x-bw*.46,x+bw*.46])bx(xx,z,.05,.46,.42,0x1d2022,.24);
   bx(x,z+.08,bw,.04,.04,0x1d2022,.30);
   break;
  }
  case 'cart':{
   bx(x,z,.62,.04,.42,0x7d847f,.78);bx(x,z,.62,.04,.42,0x7d847f,.40);
   for(const xx of [x-.29,x+.29])for(const zz of [z-.19,z+.19])leg(xx,zz,0,.78,0x5b625d,.016);
   const gl=[0x9ab5a8,0xc8b88a,0x8aa0b4,0xb08a82];
   for(let k=0;k<4;k++){const h=.12+((k+o.v)%3)*.03;addCylinder(group,x-.2+k*.13,z-.06,.035,h,gl[k],8).position.y=.80+h/2}
   bx(x+.2,z+.1,.14,.03,.12,0xcfd0c4,.82);
   break;
  }

  case 'armchair':{ /* poltrona de hospital azul (ref. 4) */
   bx(x,z,.62,.14,.58,0x4f6a84,.42);bx(x,z+.25,.62,.62,.12,0x4f6a84,.80);
   for(const sx of[-1,1])bx(x+sx*.31,z,.08,.34,.58,0x3a4f64,.60);
   bx(x,z-.02,.46,.07,.40,0x7da7b8,.52);for(const xx of[x-.24,x+.24])for(const zz of[z-.22,z+.22])leg(xx,zz,0,.36,0x2d3238,.03);break}
  case 'ivstand':{addCylinder(group,x,z,.02,1.7,0x9aa39e,8);addCylinder(group,x,z,.17,.03,0x4c524f,12).position.y=.02;
   bx(x,z,.14,.24,.06,0xb9d8d0,1.55,{castShadow:false});bx(x,z,.30,.02,.02,0x9aa39e,1.70);break}
  case 'surgTable':{bx(x,z,w,.07,.62,0xb6bfbc,.90);bx(x,z,w*.94,.04,.54,0x7e8f8c,.95,{castShadow:false});
   addCylinder(group,x,z,.09,.84,0x707b78,10);bx(x,z,w*.55,.05,.40,0x555e5c,.04);bx(x-w*.40,z,.30,.08,.40,0x88938f,.94);break}
  case 'surgLamp':{const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.34,.40,.10,16),new THREE.MeshStandardMaterial({color:0xcfd3c8,emissive:0xfff0c8,emissiveIntensity:.7,roughness:.4}));
   lamp.position.set(x,1.85,z);lamp.castShadow=false;group.add(lamp);bx(x,z,.04,.30,.04,0x5a615f,1.98);break}
  case 'trayTable':{bx(x,z,.50,.03,.36,0xc3cbc7,.80);for(const xx of[x-.2,x+.2])for(const zz of[z-.13,z+.13])leg(xx,zz,0,.78,0x7a8582,.018);
   for(let k=0;k<4;k++)bx(x-.15+k*.10,z-.04+(k%2)*.08,.012,.012,.17,0xe2e6e2,.83,{castShadow:false});bx(x+.16,z+.1,.10,.02,.07,0x7a1a18,.83);break}
  case 'toolCabinet':{bx(x,z,.74,1.55,.42,0x7f8985,.78);bx(x,z-.215,.64,1.40,.02,0x3a4743,.78,{castShadow:false});
   for(let k=0;k<4;k++){bx(x,z-.23,.62,.02,.03,0xa5b0ac,.30+k*.36);for(let j=0;j<3;j++)bx(x-.2+j*.2,z-.235,.03,.012,.14,0xdfe4e0,.38+k*.36,{castShadow:false})}break}
  case 'autoclave':{addCylinder(group,x,z,.30,.95,0x8d9692,16);bx(x,z-.29,.34,.34,.04,0x2b3330,.62,{castShadow:false});
   addCylinder(group,x+.1,z-.3,.035,.03,0xd28c3d,8).position.y=.85;bx(x,z,.66,.08,.66,0x5a6360,.04);break}
  case 'sink':{bx(x,z,.62,.12,.40,0xdfe3df,.82);bx(x,z-.02,.50,.03,.30,0x8ea09c,.88,{castShadow:false});bx(x,z+.22,.62,.30,.05,0x9aa09a,.92);
   addCylinder(group,x,z+.17,.02,.16,0x9aa39e,8).position.y=.96;bx(x,z+.15,.04,.02,.12,0x9aa39e,1.06);
   for(const xx of[x-.24,x+.24])leg(xx,z,0,.76,0x7a847f,.025);
   bx(x,z+.29,.50,.50,.025,0x9db3b3,1.45,{castShadow:false});bx(x,z+.285,.58,.58,.02,0x4a4238,1.45);break}
  case 'toilet':case 'stall':case 'urinal':{
   if(o.t!=='urinal'){bx(x,z+.12,.34,.28,.44,0xe3e6e0,.20);addCylinder(group,x,z+.08,.17,.03,0xd2d5cd,14).position.y=.42;bx(x,z+.34,.32,.40,.14,0xe3e6e0,.60);bx(x+.09,z+.34,.05,.03,.04,0x9aa39e,.82)}
   else{bx(x,z+.28,.30,.60,.26,0xe3e6e0,.60);bx(x,z+.14,.20,.18,.10,0xcdd1c9,.40)}
   if(o.t!=='toilet'){const hh=o.t==='stall'?1.55:1.05;for(const sx of[-.46,.46]){bx(x+sx,z,.03,hh,.88,0x56635e,o.t==='stall'?.78:.95+(hh-1.05)/2);}
    if(o.t==='stall')bx(x,z-.43,.92,.60,.03,0x56635e,.55,{castShadow:false})}
   break}
  case 'dresser':{bx(x,z,.78,.78,.46,0x6b4f35,.39);for(let k=0;k<3;k++){bx(x,z-.235,.66,.20,.02,0x4a3624,.18+k*.24);bx(x,z-.25,.10,.02,.02,0xc4b58e,.18+k*.24)}
   bx(x,z+.19,.60,.60,.04,0xaebfc2,1.12,{castShadow:false});bx(x,z+.18,.68,.68,.025,0x3a2c1e,1.12);
   const crk=bx(x+.05,z+.165,.012,.55,.01,0x1d2425,1.12,{castShadow:false});crk.rotation.z=.4;break}
  case 'nightstand':{bx(x,z,.50,.52,.40,0x6e5a44,.26);bx(x,z-.205,.40,.16,.02,0x45352a,.30);bx(x,z-.215,.07,.02,.02,0xc4b58e,.30);
   addCylinder(group,x,z,.07,.04,0x3d352d,10).position.y=.54;const sh2=new THREE.Mesh(new THREE.CylinderGeometry(.07,.13,.16,10),new THREE.MeshStandardMaterial({color:0xc9b48a,emissive:0x6b5a38,emissiveIntensity:.5,roughness:.8}));sh2.position.set(x,.68,z);group.add(sh2);break}
  case 'rug':{const rg=new THREE.Mesh(new THREE.CylinderGeometry(.78,.78,.012,24),mat(0x6b5a58,1));rg.scale.set(1,1,.78);rg.position.set(x,.008,z);rg.receiveShadow=true;group.add(rg);
   const st2=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.014,10),mat(0x4a1a18,1));st2.position.set(x+.12,.012,z-.05);group.add(st2);break}
  case 'rockhorse':{bx(x,z,.62,.05,.10,0x6e5a3e,.07);bx(x,z+.1,.62,.05,.06,0x6e5a3e,.05);bx(x,z,.46,.24,.16,0x8a7550,.42);
   bx(x-.26,z,.12,.30,.12,0x8a7550,.62);bx(x-.34,z,.18,.12,.10,0x8a7550,.78);bx(x-.17,z,.04,.10,.18,0x4a3a28,.62);
   for(const xx of[x-.17,x+.17])bx(xx,z,.04,.36,.10,0x6e5a3e,.22).rotation.z=xx<x?.25:-.25;break}
  /* v1.7 OBJETOS DO JARDIM (geometrias simples do Three.js via helpers addBox/addCylinder) */
  case 'solidPart':break; // bloco invisível: só ocupa células (colisão) ao redor da fonte
  case 'fountain':{
   const cx=x,cz=z; // o objeto ocupa 3 tiles na linha central; as linhas acima/abaixo são 'solidPart'
   addCylinder(group,cx,cz,1.42,.34,0x7d8277,24); // bacia de pedra
   addCylinder(group,cx,cz,1.22,.06,0x4a4f46,24).position.y=.36;
   const water=addCylinder(group,cx,cz,1.18,.05,0x1f4f48,24);water.position.y=.32;water.material=new THREE.MeshStandardMaterial({color:0x1d4a44,emissive:0x0d3a36,emissiveIntensity:.9,roughness:.25,metalness:.1});
   addCylinder(group,cx,cz,.26,.78,0x8a8f83,12).position.y=.55;addCylinder(group,cx,cz,.55,.07,0x7d8277,18).position.y=.92;
   addCylinder(group,cx,cz,.10,.38,0x69705f,8).position.y=1.12;
   for(let k=0;k<5;k++){const a=k/5*6.283;bx(cx+Math.cos(a)*1.3,cz+Math.sin(a)*1.3,.18,.16,.18,0x5f6a58,.4)} // musgo na borda
   break}
  case 'statue':{
   bx(x,z,.62,.34,.62,0x7a7e73,.17);bx(x,z,.50,.12,.50,0x6a6e64,.40);
   bx(x,z,.26,.62,.18,0x8d9186,.78);bx(x-.17,z,.10,.46,.12,0x8d9186,.74);bx(x+.17,z,.10,.30,.12,0x8d9186,.68); // tronco e braços (um quebrado)
   const hd=addCylinder(group,x,z,.11,.20,0x969a8e,10);hd.position.y=1.22;
   bx(x+.04,z+.1,.34,.05,.05,0x4c5a44,.52,{castShadow:false}); // trepadeira seca
   break}
  case 'deadTree':{
   addCylinder(group,x,z,.16,1.5,0x3a2f26,7).position.y=.75;addCylinder(group,x,z,.24,.16,0x2e251e,7).position.y=.08;
   for(const [dx,dz,hh,rr] of[[-.34,.1,1.35,.5],[.30,-.12,1.5,-.55],[.12,.3,1.62,.3],[-.1,-.3,1.25,-.4]]){const br=bx(x+dx,z+dz,.05,.7,.05,0x2e251e,hh);br.rotation.z=rr;br.rotation.x=dz*1.4}
   break}
  case 'deadBush':{
   for(let k=0;k<7;k++){const a=k/7*6.283+o.v,L=.34+((o.v*7+k*3)%5)*.05;const tw=bx(x+Math.cos(a)*.1,z+Math.sin(a)*.1,.025,L,.025,k%3?0x3a3226:0x4a4030,.1+L/2);tw.rotation.z=Math.cos(a)*.6;tw.rotation.x=Math.sin(a)*.6}
   bx(x,z,.34,.05,.34,0x2a2a1e,.03,{castShadow:false});
   break}
  default:
   bx(x,z,.4,.22,.4,0x51483d,.12);
 }

 /* v1.5: orientação automática — a frente do móvel sempre vira para o lado aberto, em qualquer eixo (norte/sul/leste/oeste) */
 {const FD={locker:'S',cabinet:'S',bookcase:'S',couch:'S',bench:'S',desk:'S',directorDesk:'S',counter:'S',inkboard:'S',toilet:'S',stall:'S',urinal:'S',sink:'S',toolCabinet:'S',dresser:'S',nightstand:'S',armchair:'S',autoclave:'S',radiator:'N'};
  const isW=(cx,cy)=>cx<0||cy<0||cx>=W||cy>=H||T[cy*W+cx]===0,n=o.w||1;
  const wallAt=side=>{for(let i=0;i<n;i++){if(side==='N'&&isW(o.x+i,o.y-1))return true;if(side==='S'&&isW(o.x+i,o.y+1))return true}
   if(n===1){if(side==='W'&&isW(o.x-1,o.y))return true;if(side==='E'&&isW(o.x+1,o.y))return true}return false};
  let th=0;
  if(FD[o.t]){const d=FD[o.t],ws=[d,'N','S','W','E'].find(wallAt);
   if(ws&&ws!==d)th=d==='S'?({N:Math.PI,W:-Math.PI/2,E:Math.PI/2})[ws]:({S:Math.PI,W:Math.PI/2,E:-Math.PI/2})[ws]}
  else if(o.t==='chair'||o.t==='cchair'){const tb=(yy)=>{const q=OB[yy*W+o.x];return q&&(q.t==='desk'||q.t==='directorDesk'||q.t==='table'||q.t==='longTable'||q.t==='messTable')};
   if(tb(o.y+1)&&!tb(o.y-1))th=Math.PI;else if(!tb(o.y-1)&&isW(o.x,o.y+1)===false&&isW(o.x,o.y-1))th=Math.PI}
  if(th){const c=Math.cos(th),sn=Math.sin(th);group.rotation.y=th;group.position.set(x-(x*c+z*sn),0,z-(-x*sn+z*c))}}
 return group;
}
function buildWorld3D(){
 if(!scene3D)initRenderer3D();if(!scene3D||!T)return;
 disposeWorld3D();
 occlusionMaterials.clear();
 for(const model of [...ratSprites,...roachSprites]){scene3D.remove(model);model.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}})}
 ratSprites=[];roachSprites=[];
 world3D=new THREE.Group();scene3D.add(world3D);
 buildFloorAndWalls();
 for(const o of OBJ)buildObject3D(o);
 mergeStaticObjects();
 buildDecals();buildFixtures();
 // Criaturas são modelos 3D baixos, apoiados no chão (não billboards verticais).
 for(const rat of rats){const model=makeCreatureModel('rat');model.userData.actor=rat;scene3D.add(model);ratSprites.push(model)}
 for(const bug of roaches){const model=makeCreatureModel('roach');model.userData.actor=bug;scene3D.add(model);roachSprites.push(model)}
 worldNeedsBuild=false;worldJustBuilt=true;
}
let worldJustBuilt=true;
function syncActorSprites(){
 if(!playerSprite||!P)return;
 playerSprite.position.set(P.x,.015+AbyssHome.stairHeight(P.x,P.y),P.y);playerSprite.scale.set(.82,keys.c?1.1:1.48,1);
 guardSprite.visible=false;GuardModule.sync();NPCModule.sync(); // v1.7
 /* v1.7 JARDIM: luar de uma noite sem teto — luz ambiente e 'lua' sobem suavemente dentro do anexo e voltam ao normal fora dele */
 {const gar=bandAt(P.y)===7;if(ambient3D){ambient3D.intensity+=((gar?.7:VIS.ambient)-ambient3D.intensity)*.08;ambient3D.color.lerp(new THREE.Color(gar?0x8fa6b8:0x71806c),.08)}if(shadowSun){shadowSun.intensity+=((gar?.75:.035)-shadowSun.intensity)*.08}}
 // Modelos de animais acompanham o estado lógico e a direção real de deslocamento.
 while(ratSprites.length<rats.length){const model=makeCreatureModel('rat');scene3D.add(model);ratSprites.push(model)}
 ratSprites.forEach((model,i)=>{const a=rats[i];model.visible=!!(a&&a.alive&&Math.hypot(a.x-P.x,a.y-P.y)<42);if(!a)return;model.position.set(a.x,.012,a.y);model.rotation.y=-(a.heading??0);model.rotation.z=Math.sin(a.phase||0)*.025;model.position.y=.012+Math.abs(Math.sin(a.phase||0))*.008});
 while(roachSprites.length<roaches.length){const model=makeCreatureModel('roach');scene3D.add(model);roachSprites.push(model)}
 roachSprites.forEach((model,i)=>{const a=roaches[i];model.visible=!!(a&&a.alive&&Math.hypot(a.x-P.x,a.y-P.y)<42);if(!a)return;model.position.set(a.x,.008,a.y);model.rotation.y=-(a.heading??0);model.rotation.z=Math.sin(a.phase||0)*.035;model.position.y=.008+Math.abs(Math.sin(a.phase||0)*.004)});
}

function draw(t){
 if(!renderer3D)initRenderer3D();if(!renderer3D)return;
 if(worldNeedsBuild)buildWorld3D();
 if(!world3D)return;
 if(AbyssHome.active){AbyssHome.render(t);VisionFX.render();return}
 syncActorSprites();AbyssModule.animate(t);
 const tx=P.x,tz=P.y,stH=AbyssHome.stairHeight(tx,tz);updateChunks(tx,tz,worldJustBuilt);worldJustBuilt=false;
 // Câmera mais próxima: o jogador ocupa mais espaço e o mapa deixa de aparecer inteiro.
 const orbitDistance=9.5,orbitAngle=cameraAngleTarget;
 const desired=new THREE.Vector3(tx+Math.sin(orbitAngle)*orbitDistance,13.5+stH,tz+Math.cos(orbitAngle)*orbitDistance);
 camera3D.position.lerp(desired,.16);
 camera3D.lookAt(tx,.72+stH,tz);
 // A lamparina ilumina ao redor de Karl em todas as direções, sem depender para onde ele olha.
 const hasLantern=!!(equipped&&equipped.leftHand==='Lamparina');
 playerLamp.visible=hasLantern&&lampOn;
 playerLamp.position.set(tx,1.15+stH,tz);updateLampPool(tx,tz);
 // Máscara em espaço de tela: abre uma área suave nas estruturas que encobrem Karl.
 const screenPos=new THREE.Vector3(tx,.78,tz).project(camera3D);
 const sx=(screenPos.x*.5+.5)*renderer3D.domElement.width;
 const sy=(-screenPos.y*.5+.5)*renderer3D.domElement.height;
 for(const m of occlusionMaterials){const u=m.userData.occlusionUniforms;if(u){u.playerScreen.value.set(sx,renderer3D.domElement.height-sy);u.viewport.value.set(renderer3D.domElement.width,renderer3D.domElement.height)}}
 if(shadowSun){shadowSun.target.position.set(tx,0,tz);shadowSun.position.set(tx-32,48,tz-28);shadowSun.target.updateMatrixWorld()}
 renderer3D.render(scene3D,camera3D);
 VisionFX.render(); /* cones de lanterna / ruído desenhados no Canvas 2D por cima do mundo */
}
let sleepStage='rps';
function openSleep(){if(mode!=='game')return;sleepStage='rps';$('sleepTitle').textContent='PEDRA, PAPEL E TESOURA';$('sleepText').textContent='Karl só consegue dormir em uma cama. Antes de descansar, precisa vencer uma partida contra a própria sorte.';$('rpsChoices').style.display='flex';$('sleepHours').style.display='none';$('sleepPanel').style.display='flex'}
function closeSleep(){$('sleepPanel').style.display='none'}
const rpsBeats={pedra:'tesoura',papel:'pedra',tesoura:'papel'};
function playRPS(choice){const enemy=['pedra','papel','tesoura'][Math.floor(Math.random()*3)];if(choice===enemy){$('sleepText').textContent='Empate! Os dois escolheram '+enemy+'. Tente novamente.';return}
 if(rpsBeats[choice]===enemy){$('sleepText').textContent='Você venceu! Karl pode escolher quanto tempo deseja dormir.';$('rpsChoices').style.display='none';$('sleepHours').style.display='flex';sleepStage='hours';return}
 $('sleepText').textContent='Você perdeu. Um ruído ecoa no quarto... algo se aproxima.';guard=GuardModule.all().filter(g=>g.alive&&!g.sleeping).sort((p,q)=>Math.hypot(p.x-P.x,p.y-P.y)-Math.hypot(q.x-P.x,q.y-P.y))[0]||null;if(guard&&guard.alive){const ang=Math.atan2(guard.y-P.y,guard.x-P.x);let spot=null;for(let radius=1.05;radius<=1.8&&!spot;radius+=.25)for(let n=0;n<16;n++){const a=ang+n*Math.PI*2/16,nx=P.x+Math.cos(a)*radius,ny=P.y+Math.sin(a)*radius;if(!hit(nx,ny,.22)){spot={x:nx,y:ny};break}}if(spot){guard.x=spot.x;guard.y=spot.y}guard.state='chase';guard.lastSeen={x:P.x,y:P.y};guard.alert=1;guard.investigate=4}
 closeSleep();say('Você perdeu no pedra, papel e tesoura. O inimigo mais próximo foi trazido para perto!',4200)}
function completeSleep(hours){const rest=ABISM.Time.rest(hours);sleep=Math.min(100,sleep+rest.sleepGain);hunger=Math.max(0,hunger-rest.hungerCost);elapsed+=rest.minutes;sleepClock=0;closeSleep();say('Karl dormiu por '+hours+' hora(s). O progresso foi salvo.',3000);saveGame()}
document.querySelectorAll('[data-rps]').forEach(b=>b.onclick=()=>playRPS(b.dataset.rps));
document.querySelectorAll('[data-hours]').forEach(b=>b.onclick=()=>completeSleep(+b.dataset.hours));
$('sleepCancel').onclick=closeSleep;
function renderBodyStatus(){const labels=[['head','CABEÇA'],['neck','PESCOÇO'],['torso','TRONCO'],['shoulders','OMBROS'],['leftArm','BRAÇO E'],['rightArm','BRAÇO D'],['leftLeg','PERNA E'],['rightLeg','PERNA D'],['feet','PÉS']];const target=$('bodyStatusContent');if(!target)return;target.innerHTML='<div style="background:#050806df;border:1px solid #64705b;padding:12px;font-size:12px;line-height:1.8;max-width:520px"><b style="color:#e8b86a;letter-spacing:2px">INTEGRIDADE CORPORAL</b>'+labels.map(([k,n])=>`<div class="hpRow"><span style="width:88px">${n}</span><div class="hpTrack"><div class="hpFill" style="width:${bodyHP[k]}%"></div></div><span>${bodyHP[k]}%</span></div>`).join('')+'</div>'}
let currentPanel='menu';
function openInventory(){if(mode!=='game')return;currentPanel='menu';$('panelMenu').style.display='grid';document.querySelectorAll('.invPage').forEach(p=>p.classList.remove('active'));$('panelTitle').textContent='OPÇÕES DE SOBREVIVÊNCIA';$('invPanel').classList.add('on');$('invPanel').setAttribute('aria-hidden','false');renderInventory()}
function showPanel(name){currentPanel=name;$('panelMenu').style.display='none';document.querySelectorAll('.invPage').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));$('panelTitle').textContent=({inventory:'INVENTÁRIO · 36 ESPAÇOS',equipment:'EQUIPAMENTOS',talk:'FALAR',craft:'CRAFTAR',status:'STATUS · INTEGRIDADE CORPORAL'})[name]||'OPÇÕES';if(name==='status')renderBodyStatus();renderInventory()}
function closeInventory(){$('invPanel').classList.remove('on');$('invPanel').setAttribute('aria-hidden','true');selectedSlot=null}
function renderInventory(){
 const icons={food:'🍖',tool:'🔧',mechanism:'⚙',document:'▤',equipment:'♜',weapon:'⚔'};
 $('bagGrid').innerHTML=inventory.map((it,i)=>`<div class="bagSlot ${it?'filled':''}" data-slot-index="${i}" ${it?'draggable="true"':''}>${it?`<span class="ico">${icons[it.type]||'◆'}</span><small>${it.name}</small>${(it.count||1)>1?`<b class="stackCount">${it.count}</b>`:''}`:`<small>${String(i+1).padStart(2,'0')}</small>`}</div>`).join('');
 $('bagGrid').querySelectorAll('[data-slot-index]').forEach(el=>{el.addEventListener('dragstart',e=>{const i=+el.dataset.slotIndex;if(!inventory[i]){e.preventDefault();return}e.dataTransfer.setData('text/plain',String(i))});el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('dragover')});el.addEventListener('dragleave',()=>el.classList.remove('dragover'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('dragover');const from=+e.dataTransfer.getData('text/plain'),to=+el.dataset.slotIndex;if(Number.isInteger(from)&&from>=0&&from<36&&to>=0&&to<36){if(from!==to&&inventory[from]&&inventory[to]&&inventory[from].name===inventory[to].name&&inventory[from].type===inventory[to].type&&(inventory[from].desc||'')===(inventory[to].desc||'')){const room=999-(inventory[to].count||1),move=Math.min(room,inventory[from].count||1);inventory[to].count=(inventory[to].count||1)+move;if(move>=(inventory[from].count||1))inventory[from]=null;else inventory[from].count-=move;}else if(from!==to){[inventory[from],inventory[to]]=[inventory[to],inventory[from]]}renderInventory()}});el.addEventListener('click',()=>{const it=inventory[+el.dataset.slotIndex];if(it)$('itemDescription').textContent=it.name+' ×'+(it.count||1)+': '+it.desc});el.addEventListener('dblclick',()=>{const i=+el.dataset.slotIndex,it=inventory[i];if(it&&((it.tags||[]).includes('consumivel')||it.type==='food'||it.type==='consumable')){pendingConsume=i;$('consumeName').textContent=it.name;$('consumePopup').style.display='block'}})});
 const slotButton=k=>{const n=SLOTS.find(x=>x[0]===k)[1];return `<button class="slotBtn ${selectedSlot===k?'selected':''}" data-slot="${k}">EQUIP<small>${n}: ${equipped[k]||'Vazio'}</small></button>`};
 $('equipLeft').innerHTML=LEFT_SLOTS.map(slotButton).join('');$('equipRight').innerHTML=RIGHT_SLOTS.map(slotButton).join('');
 document.querySelectorAll('#equipLeft [data-slot],#equipRight [data-slot]').forEach(b=>b.onclick=()=>{selectedSlot=b.dataset.slot;renderInventory();$('equipMessage').textContent='Espaço selecionado: '+SLOTS.find(x=>x[0]===selectedSlot)[1]});
 const usable=inventory.filter(i=>i&&((selectedSlot==='leftHand'||selectedSlot==='rightHand')?['equipment','weapon','tool'].includes(i.type):i.type==='equipment'));$('equipChoices').innerHTML=(selectedSlot&&equipped[selectedSlot]?`<button class="itemBtn" id="unequipBtn">Desequipar: ${equipped[selectedSlot]}<small>Devolve o item ao inventário</small></button>`:'')+(selectedSlot?(usable.length?usable.map(it=>`<button class="itemBtn" data-equip="${inventory.indexOf(it)}">Equipar: ${it.name}</button>`).join(''):'<span class="invHint">Nenhum item compatível disponível.</span>'):'<span class="invHint">Escolha um espaço acima.</span>');
 $('equipChoices').querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{const i=+b.dataset.equip,it=inventory[i];if(it){const old=equipped[selectedSlot];ITEMDB[it.name]={...it,count:1};if((it.count||1)>1)it.count--;else inventory[i]=null;equipped[selectedSlot]=it.name;if(old){const o={...(ITEMDB[old]||{name:old,type:'equipment',desc:'Item desequipado.'}),name:old,count:1};if(!addItem(o))say('Inventário cheio: '+old+' perdido.',2200)}$('equipMessage').textContent=it.name+' equipado.';renderInventory()}});
 const ub=$('unequipBtn');if(ub)ub.onclick=()=>{const n=equipped[selectedSlot];if(unequipSlot(selectedSlot))$('equipMessage').textContent=n+' desequipado e guardado no inventário.';else $('equipMessage').textContent='Inventário cheio.';renderInventory()};
 $('craftGrid').innerHTML='<button class="itemBtn" disabled>Receitas ainda não descobertas<small>Encontre materiais e ferramentas para liberar combinações.</small></button>';
}
let pendingConsume=null;$('consumeUse').onclick=()=>{const it=pendingConsume===null?null:inventory[pendingConsume];if(it&&((it.tags||[]).includes('consumivel')||it.type==='food'||it.type==='consumable')){const n=it.name.toLowerCase();let food=0,water=0,byproduct=null;if(n.includes('água')){water=48;byproduct={name:'Garrafa Vazia',type:'material',desc:'Garrafa vazia de água.'}}else if(n.includes('coca cola')){water=34;byproduct={name:'Garrafa Vazia de Coca Cola (1 litro)',type:'material',desc:'Garrafa vazia de refrigerante de um litro.'}}else if(n.includes('refri'))water=18;else if(n.includes('carne estragada')){food=12;ABISM.Status.changeMind(-5)}else if(n.includes('pão mofado')){food=8;ABISM.Status.changeMind(-3)}else if(n.includes('carne crua'))food=22;else if(n.includes('coxa'))food=34;else if(n.includes('sardinha'))food=27;else if(n.includes('milho'))food=24;else if(n.includes('pão'))food=18;else if(n.includes('rato'))food=18;else if(n.includes('barata'))food=7;hunger=Math.min(100,hunger+food);thirst=Math.min(100,thirst+water);if((inventory[pendingConsume].count||1)>1)inventory[pendingConsume].count--;else inventory[pendingConsume]=null;if(byproduct)addItem(byproduct);say('Karl consumiu '+it.name+'. '+(food?'Fome +'+food+'%. ':'')+(water?'Sede +'+water+'%.':''),2600);renderInventory()}pendingConsume=null;$('consumePopup').style.display='none'};$('consumeClose').onclick=()=>{$('consumePopup').style.display='none';pendingConsume=null};
document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>showPanel(b.dataset.open));$('invClose').onclick=closeInventory;$('backToOptions').onclick=()=>{currentPanel='menu';$('panelMenu').style.display='grid';document.querySelectorAll('.invPage').forEach(p=>p.classList.remove('active'));$('panelTitle').textContent='OPÇÕES DE SOBREVIVÊNCIA'};
$('talkSelf').onclick=()=>{const lines=['“Calma, Karl. Um passo de cada vez.”','“Preciso encontrar uma saída. Não posso parar agora.”','“Se ainda consigo pensar, ainda não enlouqueci.”','“Escute. Respire. Continue andando.”'];$('talkMessage').textContent=lines[Math.floor(Math.random()*lines.length)];say('Karl: '+$('talkMessage').textContent,3600)};
$('talkNearby').onclick=()=>{const nearGuard=GuardModule.all().some(g=>g.alive&&!g.sleeping&&Math.hypot(g.x-P.x,g.y-P.y)<4);if(nearGuard){$('talkMessage').textContent='O guarda não responde. Ele apenas observa Karl em silêncio.';say('Karl tenta falar com o guarda. Nenhuma resposta.',3000)}else{$('talkMessage').textContent='Não há ninguém por perto para responder.';say('Karl chama, mas só escuta o eco.',2600)}};
$('invPanel').addEventListener('click',e=>{if(e.target===$('invPanel'))closeInventory()});
// Persistência local de dados extensos com IndexedDB (Java não é executado nativamente neste HTML).
const DB_NAME='ABISM_Eichenfeld_DB',DB_STORE='worlds';let dbPromise=null;
function openDB(){if(!('indexedDB'in window))return Promise.reject(new Error('IndexedDB indisponível'));if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(DB_STORE))req.result.createObjectStore(DB_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});return dbPromise}
function snapshot(){return {seed,T,K,OBJ:OBJ.map(o=>({...o})),RM,P:{...P},have:[...have],expl:Array.from(expl),elapsed,curB,guards:GuardModule.serialize(),npc:NPCModule.serialize(),abyss:AbyssModule.serialize(),inventory:inventory.map(i=>i?({...i,tags:i.tags?[...i.tags]:[]}):null),equipped:{...equipped},hunger,hungerClock,thirst,thirstClock,sleep,sleepClock,rats:rats.map(x=>({...x})),roaches:roaches.map(x=>({...x})),burrows:burrows.map(x=>({...x})),organicMatter:organicMatter.map(x=>({...x})),populations:{...populations},ecoClock,bodyHP:{...bodyHP},mind,combatActive:false,itemDB:ITEMDB}}
async function saveGame(){if(mode!=='game'||!T)return;try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(snapshot(),'bedSave');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});$('mtoast').textContent='JOGO SALVO';}catch(e){console.warn('Falha ao salvar ABISM:',e)}}
async function loadGame(){try{const db=await openDB(),data=await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly'),q=tx.objectStore(DB_STORE).get('bedSave');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});if(!data){toast((LANG[language]||LANG['pt-BR']).noSave);return}if(data.T.length!==W*H){toast('SAVE DE VERSÃO ANTERIOR (MAPA INCOMPATÍVEL)');return}worldNeedsBuild=true;seed=data.seed;T=new Uint8Array(data.T);K=new Uint8Array(data.K);OBJ=data.OBJ||[];RM=data.RM||[[],[],[],[],[],[],[],[],[],[]];P=data.P;have=data.have;expl=new Uint8Array(data.expl);elapsed=data.elapsed;curB=data.curB;GuardModule.restore(data);NPCModule.restore(data.npc);AbyssModule.restore(data.abyss);guard=null;inventory=data.inventory||Array(36).fill(null);equipped=data.equipped||{};delete equipped.weaponLeft;delete equipped.weaponRight;hunger=data.hunger;thirst=data.thirst??100;thirstClock=data.thirstClock??0;sleep=data.sleep??100;sleepClock=data.sleepClock??0;hungerClock=data.hungerClock;rats=data.rats||[];roaches=data.roaches||[];burrows=data.burrows||[];organicMatter=data.organicMatter||[];populations=data.populations||{rats:rats.length,roaches:roaches.length};ecoClock=data.ecoClock||0;bodyHP=data.bodyHP||{head:35,torso:100,neck:45,shoulders:60,leftArm:65,rightArm:65,leftLeg:75,rightLeg:75,feet:55};mind=data.mind??95;Object.assign(ITEMDB,data.itemDB||{});combatActive=false;AbyssHome.reset();GuardBattle.close();OB=new Array(W*H).fill(null);for(const o of OBJ.filter(q=>q.t!=='stairs'))for(let n=0;n<(o.w||1);n++){const idx=(o.y+(o.axis==='v'?n:0))*W+o.x+(o.axis==='h'?n:0);if(idx>=0&&idx<OB.length&&!((o.t==='door'||o.t==='doubleDoor')&&o.open))OB[idx]=o}mmc.clearRect(0,0,W,H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(expl[i]&&T[i]){mmc.fillStyle=BD[bandAt(y)].c[0];mmc.fillRect(x,y,1,1)}}$('end').classList.remove('on');$('cut').classList.remove('on');document.body.classList.add('ing');mode='game';last=performance.now();lastSave=0;rs();toast(language==='en-US'?'SAVE LOADED':'SALVAMENTO CARREGADO');requestAnimationFrame(loop)}catch(e){console.warn(e);toast((LANG[language]||LANG['pt-BR']).loadFail)}}
function loop(t){if(mode!='game')return;const dt=Math.min(.05,(t-last)/1000);last=t;upd(dt);if(mode=='game')draw(t);requestAnimationFrame(loop)}


/* ---------- elevadores (v1.3.3) ---------- */
const floorOfBand=b=>({0:'1',4:'1',7:'1',2:'-1',1:'-2',3:'-3',5:'2',6:'-4'})[b]; /* v1.7: banda 7 = Jardim, também Andar 1 */
let elevBusy=false,elevObj=null,elevCur='1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function renderElev(){const el=$('elevBtns');el.innerHTML='';for(const f of FLOOR_ORDER){const has=OBJ.some(o=>o.t==='elevator'&&o.band===FLOOR_BAND[f]);const b=document.createElement('button');b.innerHTML=(f==='1'?'ANDAR 1':'ANDAR '+f)+'<small>'+FLOOR_NAME[f]+'</small>';b.disabled=!has||f===elevCur||elevBusy;if(f===elevCur)b.classList.add('cur');b.onclick=()=>goFloor(f);el.appendChild(b)}$('elevFloor').textContent=elevCur;$('elevExit').disabled=elevBusy}
async function openElev(o){elevObj=o;elevBusy=false;elevCur=floorOfBand(o.band);for(const k in keys)delete keys[k];$('elevMsg').textContent='O painel pisca fracamente. Escolha um andar.';$('elevArrow').textContent='■';$('elevDoors').classList.remove('open');renderElev();$('elevPanel').classList.add('on');$('elevPanel').setAttribute('aria-hidden','false');beep(240,.2,'triangle',.05);await wait(150);$('elevDoors').classList.add('open')}
function closeElev(){if(elevBusy)return;$('elevPanel').classList.remove('on');$('elevPanel').setAttribute('aria-hidden','true')}
$('elevExit').onclick=closeElev;
async function goFloor(f){if(elevBusy||f===elevCur)return;const dest=OBJ.find(o=>o.t==='elevator'&&o.band===FLOOR_BAND[f]);if(!dest)return;
 elevBusy=true;renderElev();const a=FLOOR_ORDER.indexOf(elevCur),b=FLOOR_ORDER.indexOf(f),dir=b>a?1:-1,cab=$('elevCab');
 $('elevMsg').textContent='As portas se fecham...';$('elevDoors').classList.remove('open');beep(180,.9,'square',.04,90);await wait(1300);
 $('elevArrow').textContent=dir>0?'▼':'▲';$('elevMsg').textContent=dir>0?'O elevador desce. A cabine range e vibra.':'O elevador sobe, tremendo a cada andar.';
 cab.classList.add(dir>0?'shake':'shake2');const rumble=setInterval(()=>beep(55+Math.random()*25,.35,'sawtooth',.07,38),300);
 for(let i=a+dir;i!==b+dir;i+=dir){await wait(1400);elevCur=FLOOR_ORDER[i];$('elevFloor').textContent=elevCur;elapsed+=20;if(Math.random()<.35)beep(120,.15,'square',.05,60)}
 clearInterval(rumble);cab.classList.remove('shake','shake2');$('elevArrow').textContent='■';
 P.x=dest.x+1;P.y=dest.y+1.6;elevObj=dest;beep(880,.5,'sine',.06);$('elevMsg').textContent='Ding. Andar '+f+'.';await wait(500);
 $('elevDoors').classList.add('open');await wait(1300);elevBusy=false;closeElev();last=performance.now();say('ANDAR '+f+' · '+FLOOR_NAME[f],2600)}

/* ---------- transição de combate e desequipar (v1.3.4) ---------- */
let combatTrans=false;
function openCombat(){if(combatActive||combatTrans||!guard||!guard.alive)return;combatTrans=true;for(const k in keys)delete keys[k];const t=$('combatTrans');t.classList.remove('on');void t.offsetWidth;t.classList.add('on');
 beep(90,.5,'sawtooth',.1,40);beep(1200,.15,'square',.05,300);setTimeout(()=>beep(60,.6,'sawtooth',.1,30),350);
 setTimeout(()=>{combatTrans=false;openCombatReal()},750);setTimeout(()=>t.classList.remove('on'),1500)}
const ITEMDB={};
function unequipSlot(s){const n=equipped[s];if(!n)return false;const it={...(ITEMDB[n]||{name:n,type:'equipment',desc:'Item desequipado.'}),name:n,count:1};if(!addItem(it))return false;delete equipped[s];return true}
/*TEST_HOOK*/
/* ---------- entrada ---------- */
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(UIMobileModule.getMode()==='mobile'&&mode==='game'&&!['escape'].includes(k)&&!$('invPanel').classList.contains('on')&&!$('combatPanel').classList.contains('on')&&!$('elevPanel').classList.contains('on')&&!$('cratePanel').classList.contains('on')&&!$('altarPanel').classList.contains('on'))return;
 if(mode=='menu'){if($('continuePanel').classList.contains('on')&&k==='escape'){closeContinue();return}if($('continuePanel').classList.contains('on'))return;if(k=='arrowup'||k=='w')selM((mi+4)%5);else if(k=='arrowdown'||k=='s')selM((mi+1)%5);else if(k=='enter')menuAct()}
 else if(mode=='cut'){if(k=='enter'||k==' '||k=='arrowright'){e.preventDefault();adv()}else if(k=='escape')toMenu()}
 else if(mode=='game'){if(NPCModule.cutActive()){if(k=='enter'||k==' '||k=='arrowright'){e.preventDefault();NPCModule.adv()}return} /* v1.7 */if(combatActive){if(k==='escape'){combatFlee();e.preventDefault()}return}if($('altarPanel').classList.contains('on')){if(k==='escape'||k==='e')AbyssModule.closeAltar();e.preventDefault();return}if($('sleepPanel').style.display==='flex'){if(k==='escape'){closeSleep();e.preventDefault()}return}if($('invPanel').classList.contains('on')){if(k==='i'||k==='escape'){if(currentPanel==='menu')closeInventory();else{$('backToOptions').click()}e.preventDefault()}return}if($('elevPanel').classList.contains('on')){if(k==='escape')closeElev();e.preventDefault();return}if($('cratePanel').classList.contains('on')){if(k==='escape')closeCrate();e.preventDefault();return}if(k==='l'&&!e.repeat){cameraAngleIndex=(cameraAngleIndex+1)%4;cameraAngleTarget=cameraAngleIndex*Math.PI/2;say('CÂMERA · ÂNGULO '+(cameraAngleIndex+1)+'/4',1200);e.preventDefault();return}if(k==='f'){if(!e.repeat)toggleLamp();e.preventDefault();return}keys[k]=1;if(k=='e'){if(bodyHP.leftArm<=0&&bodyHP.rightArm<=0)say('Você perdeu os dois braços e não consegue interagir.',2200);else interact();}else if(k=='r')teleport();else if(k=='escape')toMenu();else if(k=='i'){openInventory();e.preventDefault()};if(k.startsWith('arrow')||k==' ')e.preventDefault()}
 else if(mode=='end'){if($('end').classList.contains('gameover')){toMenu();$('end').classList.remove('gameover');}else if(k=='r'||k=='enter')teleport();else if(k=='escape')toMenu()}});
addEventListener('keyup',e=>delete keys[e.key.toLowerCase()]);
$('er').onclick=()=>teleport();$('em').onclick=toMenu;$('end').addEventListener('pointerdown',()=>{if($('end').classList.contains('gameover')){toMenu();$('end').classList.remove('gameover')}});
