/* audio.js
 * EXPORTA: ac, ns, ng, ambientVolume, A, stat, beep, playVictoryJingle
 * DEPENDE DE: Web Audio API (AudioContext)
 * NÃO PODE ALTERAR: Script clássico (sem import/export): declarações top-level viram escopo global de script, compartilhado entre os arquivos. ac/ns/ng/ambientVolume: o monolith.js (configurações) lê e escreve essas variáveis
 */
let ac,ns,ng,ambientVolume=0.5;
const A=()=>{if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();ac.resume&&ac.resume();return ac};
function stat(on){try{const a=A();if(on){if(ns)return;const b=a.createBuffer(1,a.sampleRate*2,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;ns=a.createBufferSource();ns.buffer=b;ns.loop=true;const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=1800;ng=a.createGain();ng.gain.value=.05*ambientVolume;ns.connect(f);f.connect(ng);ng.connect(a.destination);ns.start()}else if(ns){ng.gain.setTargetAtTime(0,a.currentTime,.1);const n=ns;setTimeout(()=>n.stop(),400);ns=null}}catch(e){}}
function beep(f,d,t,v,f2){try{const a=A(),o=a.createOscillator(),g=a.createGain();o.type=t||'square';o.frequency.setValueAtTime(f,a.currentTime);if(f2)o.frequency.exponentialRampToValueAtTime(f2,a.currentTime+d);g.gain.setValueAtTime(v||.05,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+d)}catch(e){}}
function playVictoryJingle(){try{const a=A(),now=a.currentTime,notes=[523.25,659.25,783.99,1046.5];notes.forEach((f,i)=>{const o=a.createOscillator(),g=a.createGain();o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(.0001,now+i*.16);g.gain.exponentialRampToValueAtTime(.07,now+i*.16+.025);g.gain.exponentialRampToValueAtTime(.0001,now+i*.16+.32);o.connect(g);g.connect(a.destination);o.start(now+i*.16);o.stop(now+i*.16+.34)})}catch(e){}}
