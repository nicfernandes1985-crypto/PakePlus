/* main.js
 * EXPORTA: carrega, em ordem, todos os scripts do jogo (execução sequencial garantida por async=false)
 * DEPENDE DE: three.min.js (tag <script> do CDN em index.html, antes deste arquivo)
 * NÃO PODE ALTERAR: a ORDEM da lista: utils/constants/audio/localization antes de tudo; monolith.js por último, antes de mobile.js
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
  'js/monolith.js',
  'js/ui/mobile.js'
 ];
 for(const src of ORDER){
  const s=document.createElement('script');
  s.src=src;s.async=false;
  s.onerror=()=>console.error('ABISM: falha ao carregar '+src);
  document.body.appendChild(s);
 }
})();
