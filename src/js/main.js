/* main.js
 * EXPORTA: carrega, em ordem, todos os scripts do jogo (execução sequencial garantida por async=false)
 * DEPENDE DE: three.min.js (tag <script> do CDN em index.html, antes deste arquivo)
 * NÃO PODE ALTERAR: a ORDEM da lista: utils/constants/audio/localization antes de tudo; monolith.js depois dos módulos; vision-fx.js e mobile.js por último
 */
(function(){
 const ORDER=[
  'js/core/utils.js',
  'js/core/constants.js',
  'js/core/audio.js',
  'js/core/localization.js',
  'js/three/textures.js',
  'js/ai/aimap.js',
  'js/entities/guard-module.js',
  'js/entities/abyss-module.js',
  'assets/abyss-horizon-data.js',
  'js/entities/abyss-home.js',
  'js/entities/npc-module.js',
  'js/ui/guard-battle.js',
  'js/monolith.js',
  'js/ui/vision-fx.js',
  'js/ui/mobile.js'
 ];
 for(const src of ORDER){
  const s=document.createElement('script');
  s.src=src;s.async=false;
  s.onerror=()=>{console.error('ABISM: falha ao carregar '+src);if(!document.getElementById('loadErr')){const d=document.createElement('div');d.id='loadErr';d.style.cssText='position:fixed;inset:0;z-index:9999;background:#000e;color:#e8b86a;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font:14px monospace';d.textContent='ABISM: falha ao carregar '+src+'. Verifique a conexão (three.js vem de CDN) e recarregue.';document.body.appendChild(d)}};
  document.body.appendChild(s);
 }
})();
