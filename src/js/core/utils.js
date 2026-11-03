/* utils.js
 * EXPORTA: $, rng, hash, bandAt, wallNear (globais de script)
 * DEPENDE DE: document; wallNear lê W, H (constants.js) e T (monolith.js) apenas em tempo de chamada
 * NÃO PODE ALTERAR: Script clássico (sem import/export): declarações top-level viram escopo global de script, compartilhado entre os arquivos. a aritmética de rng() e hash() (determinismo por seed) nem a tabela de bandAt
 */
const $=i=>document.getElementById(i);
const bandAt=y=>[0,4,1,2,3,5,6][Math.max(0,Math.min(6,y/64|0))];
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const hash=(x,y)=>((x*73856093^y*19349663)>>>0)%1000/1000;
function wallNear(x,y){for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const a=x+i,b=y+j;if(a>=0&&b>=0&&a<W&&b<H&&T[b*W+a])return 1}return 0}
