/* mobile.js
 * EXPORTA: UIMobileModule
 * DEPENDE DE: $, keys, mode, bodyHP, interact, openInventory/closeInventory, closeCrate/closeElev, teleport, toMenu, combatFlee (monolith.js)
 * NÃO PODE ALTERAR: Script clássico (sem import/export): declarações top-level viram escopo global de script, compartilhado entre os arquivos. o início sempre em modo PC; carregar DEPOIS de monolith.js (mantém a ordem original dos listeners)
 */
/* ---------- MÓDULO UI MOBILE v1.4.3 Fix ----------
   Módulo separado: gerencia preferência de controle e botões touch.
   As ações reutilizam as funções existentes; não altera lógica de movimento,
   inventário, combate ou interação. */
const UIMobileModule=(()=>{
 const STORAGE_KEY='abism_control_mode';
 // A versão sempre inicia em PC, mesmo se uma sessão anterior terminou em MOBILE.
 let controlMode='pc';
 const root=$('mobileControls');
 let enteredFullscreenByModule=false;
 const syncOrientation=()=>{
  document.body.classList.toggle('portrait-mobile',!!(window.matchMedia&&window.matchMedia('(orientation: portrait)').matches));
 };
 const isTouchDevice=()=>('ontouchstart' in window)||(navigator.maxTouchPoints||0)>0;
 const requestLandscape=()=>{
  if(controlMode!=='mobile')return;
  const lock=()=>{
   try{
    if(screen.orientation&&typeof screen.orientation.lock==='function'){
     const result=screen.orientation.lock('landscape');
     if(result&&typeof result.catch==='function')result.catch(()=>{});
    }
   }catch(_){}
  };
  // Em navegadores móveis, o bloqueio de orientação normalmente exige tela cheia.
  if(isTouchDevice()&&document.documentElement.requestFullscreen&&!document.fullscreenElement){
   try{
    const result=document.documentElement.requestFullscreen();
    if(result&&typeof result.then==='function')result.then(()=>{enteredFullscreenByModule=true;lock()}).catch(()=>lock());
    else lock();
   }catch(_){lock()}
  }else lock();
 };
 const releaseLandscape=()=>{
  try{if(screen.orientation&&typeof screen.orientation.unlock==='function')screen.orientation.unlock()}catch(_){}
  if(enteredFullscreenByModule&&document.fullscreenElement&&document.exitFullscreen){
   try{const result=document.exitFullscreen();if(result&&typeof result.catch==='function')result.catch(()=>{})}catch(_){}
  }
  enteredFullscreenByModule=false;
 };
 const setMode=value=>{
  const previousMode=controlMode;
  controlMode=value==='mobile'?'mobile':'pc';
  document.body.classList.toggle('control-mobile',controlMode==='mobile');
  $('controlPC').classList.toggle('active',controlMode==='pc');
  $('controlMobile').classList.toggle('active',controlMode==='mobile');
  $('controlPC').setAttribute('aria-pressed',String(controlMode==='pc'));
  $('controlMobile').setAttribute('aria-pressed',String(controlMode==='mobile'));
  // Mantém a escolha durante a sessão, mas nunca a restaura automaticamente no próximo carregamento.
  try{localStorage.setItem(STORAGE_KEY,controlMode)}catch(e){}
  root.setAttribute('aria-hidden',String(controlMode!=='mobile'));
  syncOrientation();
  if(controlMode==='mobile'&&previousMode!=='mobile')requestLandscape();
  if(controlMode==='pc'&&previousMode==='mobile')releaseLandscape();
  return controlMode;
 };
 $('controlPC').addEventListener('click',()=>setMode('pc'));
 $('controlMobile').addEventListener('click',()=>setMode('mobile'));
 $('orientationRetry').addEventListener('click',()=>requestLandscape());
 addEventListener('resize',syncOrientation);
 addEventListener('orientationchange',syncOrientation);
 addEventListener('fullscreenchange',syncOrientation);
 const clearHeld=()=>root.querySelectorAll('[data-key]').forEach(b=>{delete keys[b.dataset.key];b.classList.remove('pressed')});
 root.querySelectorAll('[data-key]').forEach(button=>{
  const down=e=>{if(controlMode!=='mobile')return;e.preventDefault();if(button.dataset.key==='c'){if(keys.c)delete keys.c;else keys.c=1;return}keys[button.dataset.key]=1;button.classList.add('pressed');try{button.setPointerCapture(e.pointerId)}catch(_){}};
  const up=e=>{e.preventDefault();if(button.dataset.key==='c')return;delete keys[button.dataset.key];button.classList.remove('pressed')};
  button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);
 });
 const action=(name)=>{
  if(mode!=='game')return;
  if(name==='interact'){if($('invPanel').classList.contains('on')||$('combatPanel').classList.contains('on')||$('elevPanel').classList.contains('on')||$('cratePanel').classList.contains('on'))return;if(bodyHP.leftArm<=0&&bodyHP.rightArm<=0)say('Você perdeu os dois braços e não consegue interagir.',2200);else interact()}
  else if(name==='inventory'){if(combatActive||$('elevPanel').classList.contains('on')||$('cratePanel').classList.contains('on'))return;if($('invPanel').classList.contains('on')){if(currentPanel==='menu')closeInventory();else $('backToOptions').click()}else openInventory()}
  else if(name==='camera'){if(combatActive||$('invPanel').classList.contains('on'))return;cameraAngleIndex=(cameraAngleIndex+1)%4;cameraAngleTarget=cameraAngleIndex*Math.PI/2;say('CÂMERA · ÂNGULO '+(cameraAngleIndex+1)+'/4',1200)}
  else if(name==='restart'){if(!combatActive&&!$('invPanel').classList.contains('on')&&!$('elevPanel').classList.contains('on')&&!$('cratePanel').classList.contains('on'))teleport()}
  else if(name==='menu'){if(combatActive){combatFlee();return}if($('sleepPanel').style.display==='flex'){closeSleep();return}if($('invPanel').classList.contains('on')){if(currentPanel==='menu')closeInventory();else $('backToOptions').click();return}if($('elevPanel').classList.contains('on')){closeElev();return}if($('cratePanel').classList.contains('on')){closeCrate();return}toMenu()}
 };
 root.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',e=>{e.preventDefault();action(button.dataset.action)}));
 addEventListener('pointerup',()=>root.querySelectorAll('[data-key]').forEach(b=>{if(b.dataset.key==='c')return;delete keys[b.dataset.key];b.classList.remove('pressed')}));addEventListener('blur',clearHeld);
 setMode('pc');
 return Object.freeze({getMode:()=>controlMode,setMode,clearHeld,syncOrientation,requestLandscape});
})();
