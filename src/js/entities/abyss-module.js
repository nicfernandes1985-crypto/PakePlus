/* abyss-module.js
 * EXPORTA: AbyssModule (spawn, update, animate, countSouls, spendSouls, isCarryingBody, speedFactor,
 *          pickBody, dropBody, interactAltar, closeAltar, openSkillMenu, castDisorient, castShock,
 *          combatStart, combatEnd, consumeStun, incomingDamage, rollBoneBreak, tickRound,
 *          outgoingMult, fleePenalty, playerStatusText, enemyStatusText, serialize, restore, cfg, flags)
 * DEPENDE DE: T, K, OB, OBJ, RM, P, H, W, BD, FLOOR_BAND, rng, $, say, beep, addItem, inventory, bodyHP,
 *             mind, guard, GuardModule, ABISM, organicMatter, objMesh, combatTargets, combatTargetMode,
 *             enemyThink, killGuard, refreshCombat (todos lidos em tempo de chamada, nunca no carregamento)
 * NÃO PODE ALTERAR: Script clássico (sem import/export). Este módulo usa um rng PRÓPRIO (seed*K+salt) para não
 *   consumir o rng() de gen(), que é determinístico por seed. Não mexer na ordem de chamada em gen(): spawn() roda por último.
 */
const AbyssModule=(()=>{
 /* ---------- ajustes rápidos ---------- */
 const cfg={
  altarChance:.5,            // chance de nascer 1 altar em CADA andar elegível (-1,-2,-3,-4)
  altarFloors:['-1','-2','-3','-4'],
  procMin:5,procMax:10,      // segundos de processamento do Coletor
  carrySpeed:.5,             // multiplicador de velocidade ao carregar corpo
  mindCost:10,               // custo de Mente das habilidades ativas
  shockDamage:25,carbonizeChance:.40,disorientChance:.65,
  boneBreakChance:.30,boneBreakTurns:3,boneBreakDot:2
 };
 const SOUL={name:'Alma',type:'material',rarity:'Rara',desc:'Essência arrancada de um corpo. Moeda do Altar do Deus do Abismo.'};
 const SKILLS={
  desorientar:{id:'desorientar',name:'Desorientar',type:'active',cost:2,desc:'Chance de 65% de deixar o inimigo Desorientado por 1 turno (ele perde a vez).'},
  choque:{id:'choque',name:'Choque Elétrico',type:'active',cost:3,desc:'25 de dano. 40% de Carbonização: o membro escolhido é destruído.'},
  resistencia:{id:'resistencia',name:'Resistência ao Decepamento',type:'passive',cost:3,desc:'Metade do dano em membros e nenhum golpe zera um membro (sobra 1 de vida).'}
 };
 const LABEL={head:'CABEÇA',torso:'TRONCO',leftArm:'BRAÇO ESQ.',rightArm:'BRAÇO DIR.',leftLeg:'PERNA ESQ.',rightLeg:'PERNA DIR.'};
 const LIMBS=['leftArm','rightArm','leftLeg','rightLeg'],ARMS=['leftArm','rightArm'],LEGS=['leftLeg','rightLeg'];
 const PROTECTED=['elevator','mech','note','gate','item','door','doubleDoor'];

 let skills={},flags={resistenciaDecepamento:false},carrying=null,pStatus={},hintAt=0;

 /* ---------- almas (moeda) ---------- */
 const countSouls=()=>{let n=0;if(typeof inventory==='undefined'||!inventory)return 0;for(const s of inventory)if(s&&s.name===SOUL.name)n+=s.count||1;return n};
 function spendSouls(n){
  if(countSouls()<n)return false;let left=n;
  for(let i=0;i<inventory.length&&left>0;i++){const s=inventory[i];if(!s||s.name!==SOUL.name)continue;const take=Math.min(left,s.count||1);left-=take;if((s.count||1)-take<=0)inventory[i]=null;else s.count=(s.count||1)-take}
  ABISM.Events.emit('InventoryChanged',{inventory});return true}
 const giveSoul=()=>addItem({...SOUL,count:1});

 /* ---------- geração ---------- */
 const inRect=(o,r)=>o.x>=r.x&&o.x<r.x+r.w&&o.y>=r.y&&o.y<r.y+r.h;
 const freeCell=(x,y)=>x>0&&y>0&&x<W-1&&y<H-1&&T[y*W+x]===1&&!OB[y*W+x]&&!K[y*W+x];
 const putObj=(o)=>{OBJ.push(o);for(let i=0;i<(o.w||1);i++)OB[o.y*W+o.x+i]=o;return o};
 function clearFurniture(rm){ // esvazia a sala (menos portas/elevador/mecanismos, que nunca chegam aqui)
  for(let i=OBJ.length-1;i>=0;i--){const o=OBJ[i];if(!inRect(o,rm)||PROTECTED.includes(o.t))continue;
   for(let n=0;n<(o.w||1);n++){const idx=o.y*W+o.x+n;if(OB[idx]===o)OB[idx]=null}OBJ.splice(i,1)}}
 function roomInfo(rm){let keep=0,doors=0,furn=0;
  for(const o of OBJ){if(!inRect(o,rm))continue;if(o.t==='door'||o.t==='doubleDoor')doors++;else if(PROTECTED.includes(o.t))keep++;else furn++}
  return {keep,doors,furn}}
 function carveAbyssRoom(R){ // O Abismo (-4) só tem corredores: abre uma sala fechada colada ao corredor inferior
  const yb=BD[6].y,w=7,h=5,dy=yb+23,ry=yb+24;
  for(let t=0;t<60;t++){
   const x0=8+Math.floor(R()*(W-8-w-8)),dx=x0+3;let ok=T[(yb+22)*W+dx]===1;
   for(let y=dy-1;ok&&y<=ry+h;y++)for(let x=x0-1;x<=x0+w;x++){if(y===dy-1)continue;if(T[y*W+x]!==0){ok=false;break}}
   if(!ok)continue;
   for(let y=ry;y<ry+h;y++)for(let x=x0;x<x0+w;x++)T[y*W+x]=1;
   T[dy*W+dx]=1;const d={t:'door',x:dx,y:dy,w:1,axis:'h',open:false};OBJ.push(d);OB[dy*W+dx]=d;
   for(const s of[-1,0,1])K[(dy+s)*W+dx]=1;
   const rm={x:x0,y:ry,w,h,cx:x0+(w>>1),cy:ry+(h>>1),b:6};RM[6].push(rm);return rm}
  return null}
 const baseFree=(x,y)=>x>0&&y>0&&x<W-1&&y<H-1&&T[y*W+x]===1&&!K[y*W+x];  // ignora mobília (ela será removida)
 function altarSpot(rm){ // célula 2x1 livre de corredores/portas (K), a mais próxima do centro da sala
  const cx=rm.x+((rm.w-2)>>1),cy=rm.y+(rm.h>>1);let best=null,bd=1e9;
  for(let y=rm.y+1;y<rm.y+rm.h-1;y++)for(let x=rm.x+1;x<rm.x+rm.w-2;x++){
   if(!baseFree(x,y)||!baseFree(x+1,y))continue;const d=Math.hypot(x-cx,y-cy);if(d<bd){bd=d;best={x,y}}}
  return best}
 function corridorCells(rm){let n=0;for(let y=rm.y;y<rm.y+rm.h;y++)for(let x=rm.x;x<rm.x+rm.w;x++)if(K[y*W+x])n++;return n}
 function pickAltarRoom(band,R){ // sala mais "isolada": menos corredores atravessando, menos portas, menos mobília
  const pool=(RM[band]||[]).filter(rm=>rm.w>=4&&rm.h>=4&&!(P&&inRect({x:Math.floor(P.x),y:Math.floor(P.y)},rm)));
  const ok=pool.map(rm=>({rm,i:roomInfo(rm),k:corridorCells(rm),r:R()})).filter(v=>v.i.keep===0&&altarSpot(v.rm));
  ok.sort((a,b)=>(a.k-b.k)||(a.i.doors-b.i.doors)||(a.i.furn-b.i.furn)||(a.r-b.r));
  return ok.length?ok[0].rm:null}
 function placeAltar(rm,fl){
  const sp=altarSpot(rm);if(!sp)return null;clearFurniture(rm);
  return putObj({t:'altar',x:sp.x,y:sp.y,w:2,v:0,floor:fl,room:{x:rm.x,y:rm.y,w:rm.w,h:rm.h}})}
 function placeCollector(R){
  const rooms=(RM[1]||[]).filter(rm=>rm.w>=5&&rm.h>=4&&!OBJ.some(o=>o.t==='altar'&&o.room.x===rm.x&&o.room.y===rm.y));
  const order=rooms.map(r=>[R(),r]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
  const tryRoom=rm=>{for(const y of[rm.y,rm.y+rm.h-1])for(let x=rm.x;x<rm.x+rm.w-1;x++)
   if(freeCell(x,y)&&freeCell(x+1,y)&&freeCell(x,y+(y===rm.y?1:-1)))
    return putObj({t:'coletor',x,y,w:2,v:0,proc:0,procTotal:0,ready:0});return null};
  for(const rm of order){const o=tryRoom(rm);if(o)return o}
  for(const rm of order){const i=roomInfo(rm);if(i.keep)continue;clearFurniture(rm);const o=tryRoom(rm);if(o)return o}
  return null}
 function spawn(seed){ // chamado UMA vez no fim de gen(), depois de mapa, mobília e ecologia
  skills={};flags.resistenciaDecepamento=false;carrying=null;pStatus={};
  const R=rng((((+seed||1)*2654435761)+97)|0);
  for(const fl of cfg.altarFloors){
   if(R()>=cfg.altarChance)continue;                       // chance por andar; no máximo 1 altar por andar
   const band=FLOOR_BAND[fl];let rm=band===6?carveAbyssRoom(R):pickAltarRoom(band,R);
   if(rm)placeAltar(rm,fl)}
  placeCollector(R)}                                       // Coletor de Almas: somente no andar -2

 /* ---------- Altar e Árvore de Habilidades ---------- */
 function altarHere(){if(!P||!OBJ)return null;for(const o of OBJ)if(o.t==='altar'&&o.room){const r=o.room;if(P.x>=r.x&&P.x<r.x+r.w&&P.y>=r.y&&P.y<r.y+r.h)return o}return null}
 function interactAltar(){if(!altarHere())return false;openAltar();return true}
 function openAltar(){for(const k in keys)delete keys[k];const p=$('altarPanel');p.classList.add('on');p.setAttribute('aria-hidden','false');$('altarMsg').textContent='Entregue Almas ao Abismo e ele responderá.';renderTree()}
 function closeAltar(){const p=$('altarPanel');p.classList.remove('on');p.setAttribute('aria-hidden','true')}
 const altarOpen=()=>$('altarPanel').classList.contains('on');
 function renderTree(){
  const souls=countSouls();$('altarSouls').textContent=souls;
  $('altarTree').innerHTML='<div class="altarRoot">◈ O ABISMO ◈</div><div class="altarBranches">'+Object.values(SKILLS).map(s=>{
   const owned=!!skills[s.id],can=souls>=s.cost;
   return '<button class="altarNode '+(owned?'owned':can?'can':'locked')+'" data-skill="'+s.id+'"'+(owned?' disabled':'')+'><span class="altarNodeType">'+(s.type==='active'?'ATIVA':'PASSIVA')+'</span><b>'+s.name+'</b><small>'+s.desc+'</small><em>'+(owned?'ADQUIRIDA':s.cost+' ALMAS')+'</em></button>'}).join('')+'</div>'}
 function buy(id){const s=SKILLS[id];if(!s||skills[id])return;
  if(!spendSouls(s.cost)){$('altarMsg').textContent='Almas insuficientes. O Abismo não aceita promessas.';beep(110,.25,'sawtooth',.06,60);return}
  skills[id]=true;if(id==='resistencia')flags.resistenciaDecepamento=true;
  beep(220,.4,'sawtooth',.07,90);setTimeout(()=>beep(440,.5,'sine',.05,120),180);
  $('altarMsg').textContent='O Abismo concede: '+s.name+'.';renderTree()}
 document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.altarNode');if(b&&altarOpen())buy(b.dataset.skill)});
 document.addEventListener('DOMContentLoaded',()=>{const c=$('altarClose');if(c)c.onclick=closeAltar});
 {const c=document.getElementById('altarClose');if(c)c.onclick=closeAltar}

 /* ---------- carregar corpos e Coletor de Almas ---------- */
 const isCarryingBody=()=>!!carrying;
 const speedFactor=()=>carrying?cfg.carrySpeed:1;
 const bodyPos=g=>g.deadAt?g.deadAt:{x:g.x,y:g.y};
 function nearestCorpse(){let best=null,bd=1.5;for(const g of GuardModule.all()){if(!g.dead||!g.looted||g.carried||g.consumed)continue;const p=bodyPos(g),d=Math.hypot(p.x-P.x,p.y-P.y);if(d<bd){bd=d;best=g}}return best}
 function pickBody(){
  if(carrying)return false;const g=nearestCorpse();if(!g)return false;
  const p=bodyPos(g);g.carried=true;carrying=g.id;
  for(const m of organicMatter)if(m.source==='guard_corpse'&&m.active&&Math.hypot(m.x-p.x,m.y-p.y)<1.2){m.active=false;break}
  beep(120,.2,'sawtooth',.06,70);say('Você ergue o corpo do guarda. Ele é pesado. Leve-o ao Coletor de Almas (Andar -2).',3600);return true}
 function dropBody(){
  if(!carrying)return false;const g=GuardModule.get(carrying);carrying=null;if(!g)return true;
  g.carried=false;g.deadAt={x:P.x,y:P.y};g.x=P.x;g.y=P.y;organicMatter.push({x:P.x,y:P.y,amount:8,active:true,source:'guard_corpse'});
  beep(90,.2,'sawtooth',.05,50);say('Você larga o corpo no chão.',1800);return true}
 const overlaps=o=>P.x>o.x-.7&&P.x<o.x+(o.w||1)+.7&&P.y>o.y-.7&&P.y<o.y+1.7;
 function insertBody(o){
  const g=GuardModule.get(carrying);carrying=null;if(g){g.carried=false;g.consumed=true;g.state='dead'}
  o.procTotal=o.proc=cfg.procMin+Math.random()*(cfg.procMax-cfg.procMin);
  beep(70,.8,'sawtooth',.09,40);setTimeout(()=>beep(300,.5,'square',.04,90),300);
  say('O Coletor de Almas engole o corpo e começa a processar...',3200)}
 function collectorInfo(o){say(o.proc>0?'O Coletor de Almas está processando... '+Math.ceil(o.proc)+'s':carrying?'Aproxime o corpo da máquina para inseri-lo.':'Coletor de Almas. Traga um corpo (saqueado) para extrair uma Alma.',2400)}
 function hint(t){if(!$('msg').classList.contains('on'))say(t,900)}
 function update(dt){
  if(!P||!OBJ)return;
  for(const o of OBJ){if(o.t!=='coletor')continue;
   if(o.proc>0){o.proc-=dt;if(o.proc<=0){o.proc=0;o.ready=(o.ready||0)+1;beep(660,.25,'sine',.06,40)}}
   if(o.ready>0){o.tryT=(o.tryT||0)-dt;if(o.tryT<=0){o.tryT=1;if(giveSoul()){o.ready--;say('O Coletor de Almas libera uma Alma.',2800);beep(520,.3,'sine',.07,300)}}}
   if(carrying&&overlaps(o)){if(o.proc>0||o.ready>0)hint('O Coletor de Almas ainda está ocupado.');else insertBody(o)}}
  if(altarHere())hint('[E] Altar do Deus do Abismo');
  else if(carrying)hint('[E] Soltar corpo');
  else if(nearestCorpse())hint('[E] Carregar corpo')}
 function animate(t){
  const s=t/1000;
  for(const o of OBJ){if(o.t!=='coletor'&&o.t!=='altar')continue;const g=objMesh.get(o),a=g&&g.userData.abyss;if(!a)continue;
   if(o.t==='coletor'){const busy=o.proc>0;a.rotor.rotation.y=busy?s*7:s*.35;a.glass.material.emissiveIntensity=busy?1.1+.8*Math.sin(s*14):.35;a.lamp.material.color.setHex(busy?0xff3a2a:(o.ready>0?0xffd34a:0x38d46a));a.lamp.material.emissive.setHex(busy?0xff1a0a:(o.ready>0?0xc99a10:0x12a044))}
   else{a.orb.position.y=1.3+Math.sin(s*1.6)*.07;a.orb.material.emissiveIntensity=1.4+.6*Math.sin(s*3.1);a.ring.rotation.y=s*.9}}}

 /* ---------- combate: habilidades ---------- */
 function openSkillMenu(){
  const el=$('combatTargets');el.innerHTML='';combatTargetMode='skillmenu';el.classList.add('on');
  const add=(txt,fn,dis)=>{const b=document.createElement('button');b.textContent=txt;b.disabled=!!dis;b.onclick=fn;el.appendChild(b)};
  add('Golpe concentrado · 15 Mente',()=>combatTargets('skill'),mind<15);
  if(skills.desorientar)add('Desorientar · '+cfg.mindCost+' Mente · 65%',castDisorient,mind<cfg.mindCost);
  if(skills.choque)add('Choque Elétrico · '+cfg.mindCost+' Mente',()=>combatTargets('shock'),mind<cfg.mindCost);
  if(flags.resistenciaDecepamento)add('Resistência ao Decepamento · PASSIVA ATIVA',()=>{},true)}
 function noMind(){$('combatLog').textContent='Karl está sem concentração suficiente.'}
 function castDisorient(){
  if(mind<cfg.mindCost){noMind();return}
  ABISM.Status.changeMind(-cfg.mindCost);combatTargets('');
  const hit=Math.random()<=cfg.disorientChance;if(hit){guard.status=guard.status||{};guard.status.desorientado=1}
  refreshCombat();enemyThink(hit?'Karl desorienta o Guarda! Ele vai perder a próxima ação.':'Karl tenta desorientar o Guarda, mas ele resiste.')}
 function castShock(part){
  if(mind<cfg.mindCost){noMind();return}
  ABISM.Status.changeMind(-cfg.mindCost);
  const hp=guard.bodyHP,sev=guard.severed||(guard.severed={});
  hp[part]=Math.max(0,hp[part]-cfg.shockDamage);
  let log='Choque Elétrico em '+LABEL[part]+' (-'+cfg.shockDamage+').';
  if(Math.random()<=cfg.carbonizeChance){
   if(LIMBS.includes(part)){hp[part]=0;sev[part]=true;log+=' CARBONIZAÇÃO! O membro vira cinza.'}
   else{hp[part]=Math.max(0,hp[part]-10);log+=' CARBONIZAÇÃO! A queimadura se aprofunda (-10).'}}
  if(typeof GuardBattle!=='undefined')GuardBattle.strike(part,cfg.shockDamage,hp,sev[part]?'burn':'shock');
  if(hp.torso<=0||hp.head<=0){killGuard(log);return}
  combatTargets('');refreshCombat();enemyThink(log)}

 /* ---------- combate: status ---------- */
 function combatStart(g){if(g){g.status={};g.severed=g.severed||{}}pStatus={}}
 function combatEnd(){pStatus={};try{if(guard)guard.status={}}catch(e){}}
 function consumeStun(g){if(g&&g.status&&g.status.desorientado>0){g.status.desorientado--;return true}return false}
 function incomingDamage(part,dmg){
  const q=pStatus.quebra;if(q&&(q.part==='torso'||q.part==='head'))dmg=Math.round(dmg*1.15);          // defesa reduzida
  if(flags.resistenciaDecepamento&&LIMBS.includes(part)){
   dmg=Math.max(1,Math.ceil(dmg*.5));if(bodyHP[part]>0&&bodyHP[part]-dmg<=0)dmg=Math.max(0,bodyHP[part]-1)}
  return dmg}
 function rollBoneBreak(part,dmg){
  if(dmg<=0||Math.random()>cfg.boneBreakChance)return '';
  pStatus.quebra={turns:cfg.boneBreakTurns,part};return ' QUEBRA DE OSSOS em '+(LABEL[part]||part)+'!'}
 function tickRound(){
  const q=pStatus.quebra;if(!q)return '';
  let dmg=cfg.boneBreakDot;if(flags.resistenciaDecepamento&&LIMBS.includes(q.part))dmg=Math.max(0,Math.min(dmg,bodyHP[q.part]-1));
  if(dmg>0)ABISM.Status.damageBody(q.part,dmg);
  q.turns--;let m=' Os ossos quebrados latejam (-'+dmg+' '+(LABEL[q.part]||q.part)+').';
  if(q.turns<=0){delete pStatus.quebra;m+=' Os ossos se recompõem.'}return m}
 const outgoingMult=()=>pStatus.quebra&&ARMS.includes(pStatus.quebra.part)?.7:1;
 const fleePenalty=()=>pStatus.quebra&&LEGS.includes(pStatus.quebra.part)?.25:0;
 const playerStatusText=()=>pStatus.quebra?' · QUEBRA DE OSSOS ('+(LABEL[pStatus.quebra.part]||'')+' · '+pStatus.quebra.turns+'t)':'';
 const enemyStatusText=g=>g&&g.status&&g.status.desorientado>0?'DESORIENTADO':'—';

 const serialize=()=>({skills:{...skills},flags:{...flags},carrying});
 function restore(d){skills=(d&&d.skills)||{};flags.resistenciaDecepamento=!!(d&&d.flags&&d.flags.resistenciaDecepamento);carrying=(d&&d.carrying)||null;pStatus={}}

 return Object.freeze({cfg,flags,SKILLS,spawn,update,animate,countSouls,spendSouls,isCarryingBody,speedFactor,pickBody,dropBody,
  interactAltar,closeAltar,altarOpen,collectorInfo,openSkillMenu,castDisorient,castShock,combatStart,combatEnd,consumeStun,
  incomingDamage,rollBoneBreak,tickRound,outgoingMult,fleePenalty,playerStatusText,enemyStatusText,serialize,restore,
  get skills(){return skills}})
})();
