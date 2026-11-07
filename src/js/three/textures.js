/* textures.js
 * EXPORTA: PXT (texturas pixel-art procedurais)
 * DEPENDE DE: THREE (CDN), rng (utils.js)
 * NÃO PODE ALTERAR: Script clássico (sem import/export): declarações top-level viram escopo global de script, compartilhado entre os arquivos. as seeds de rng() das texturas nem as chaves de cache
 */
/* ---------- TEXTURAS PIXEL-ART PROCEDURAIS · v1.4.4 ----------
   Referência visual: ladrilhos com juntas escuras e brilho úmido, reboco encardido com friso
   verde-escuro, canos, lâmpadas fluorescentes de parede com poças de luz, sangue seco, ralos.
   Tudo é desenhado por canvas (sem arquivos externos) e usa filtro NEAREST para manter o pixel-art. */
const PXT=(()=>{
 const cache={};
 const hx=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
 const sh=(c,f)=>c.map(v=>Math.max(0,Math.min(255,Math.round(v*f))));
 const css=(c,a)=>a===undefined||a>=1?'rgb('+c[0]+','+c[1]+','+c[2]+')':'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';
 const px=(g,x,y,c,a,w,h)=>{g.fillStyle=css(c,a);g.fillRect(Math.floor(x),Math.floor(y),w||1,h||1)};
 const blot=(g,cx,cy,r,c,a,R)=>{for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){const d=Math.hypot(x,y)/r;if(d<=1&&R()<1-d*.8)px(g,cx+x,cy+y,c,a*(1-d*.4))}};
 const speckle=(g,x0,y0,w,h,c,n,R,lo,hi,a)=>{for(let i=0;i<n;i++)px(g,x0+R()*w,y0+R()*h,sh(c,lo+R()*(hi-lo)),a)};
 const mk=(key,w,h,draw,smooth)=>{
  if(cache[key])return cache[key];
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;draw(g);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.magFilter=smooth?THREE.LinearFilter:THREE.NearestFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;
  cache[key]=t;return t};
 /* paletas por setor: 0 Pacientes · 1 Experimentos · 2 Subterrâneo · 3 Prisão · 4 Medicação */
 const FLOOR=['#9a9d94','#6a7c80','#58564c','#665a5a','#939890','#6f6a5c','#2f3338','#55633f'];
 const PLASTER=['#a9aba4','#7c8d90','#6f6b60','#7a6e6e','#a6aba4','#847a68','#4b535b','#6f7a66'];
 const DADO=['#6c716b','#24383d','#2d2a24','#3a2b2d','#5f6a63','#3b3023','#1c2228','#3c4a36'];
 /* v1.5: Andar 2 (refs. 1,2,3,5): 4 temas de parede · Andar 1 (ref. 4): paredes claras chamuscadas, piso de ladrilho claro com cinzas */
 const T2P=['#9b9b95','#6f7a66','#3a5757','#a39a86'],T2D=['#3c3c3a','#434b3f','#1b2c2e','#6b5f4e'];
 const flake=(g,R,pl,n,SPL)=>{for(let i=0;i<n;i++){const x=Math.floor(R()*32),y=Math.floor(R()*(SPL-3)),w=2+Math.floor(R()*5),h=2+Math.floor(R()*4);px(g,x,y,sh(pl,.35),.8,w,h);px(g,x,y,sh(pl,1.35),.55,w,1);px(g,x,y+h,sh(pl,1.25),.4,w,1)}};
 const crack=(g,R,c,n)=>{for(let i=0;i<n;i++){let x=Math.floor(R()*32),y=Math.floor(R()*30);const len=6+Math.floor(R()*14);for(let k=0;k<len;k++){px(g,x,y,c,.75);const r=R();if(r<.4)x+=R()<.5?-1:1;else if(r<.8)y+=1;else{x+=1;y+=1}if(x<0||x>31||y>37)break}}};
 const decay2=(g,R,th,pl,dd,SPL)=>{
  if(th===0){for(let i=0;i<5;i++)blot(g,Math.floor(R()*32),Math.floor(R()*(SPL-6)),4+Math.floor(R()*4),[28,28,27],.85,R);flake(g,R,pl,12,SPL);crack(g,R,[20,20,20],3)}
  else if(th===1){crack(g,R,[30,36,28],7);flake(g,R,pl,16,SPL);for(let i=0;i<4;i++)blot(g,Math.floor(R()*32),Math.floor(R()*(SPL-4)),2+Math.floor(R()*3),[120,126,104],.35,R)}
  else if(th===2){for(let i=0;i<9;i++){const x=Math.floor(R()*32),len=12+Math.floor(R()*SPL);for(let y=0;y<len&&y<64;y++)px(g,x,y,[10,22,24],.45*(1-y/len)+.08)}
   for(let i=0;i<5;i++)blot(g,Math.floor(R()*32),Math.floor(R()*(SPL-4)),3+Math.floor(R()*3),[20,40,40],.5,R);speckle(g,0,0,32,SPL,[120,170,160],40,R,.6,1.2,.25);crack(g,R,[8,14,14],3)}
  else{for(let i=0;i<14;i++)blot(g,Math.floor(R()*32),Math.floor(R()*(SPL-4)),1+Math.floor(R()*3),[52,46,36],.7,R);for(let i=0;i<2;i++)blot(g,Math.floor(R()*32),Math.floor(R()*(SPL-6)),2+Math.floor(R()*2),[96,26,24],.35,R);flake(g,R,pl,5,SPL)}};
 const soot=(g,R,pl,dd,SPL)=>{
  for(let y=0;y<SPL;y++){const a=Math.max(0,.55-y/SPL*.7);px(g,0,y,[16,15,14],a,32,1)}
  for(let i=0;i<8;i++){const x=Math.floor(R()*32),len=8+Math.floor(R()*24);for(let y=0;y<len;y++)px(g,x,y,[10,10,10],.55*(1-y/len)+.05,1+(R()<.4?1:0),1)}
  for(let i=0;i<5;i++)blot(g,Math.floor(R()*32),Math.floor(R()*(SPL-4)),3+Math.floor(R()*4),[22,20,18],.55,R);
  speckle(g,0,0,32,SPL,[230,230,222],30,R,.9,1.1,.2)};
 const floor2=(g,R,b,v)=>{
  if(v%2===0){const c=hx('#6d7266');px(g,0,0,c,1,32,32);speckle(g,0,0,32,32,c,260,R,.55,1.35,.5);crack(g,R,[24,28,22],5);
   for(let i=0;i<3;i++)blot(g,Math.floor(R()*32),Math.floor(R()*32),3+Math.floor(R()*4),[30,34,28],.35,R);if(v===2)blot(g,16,16,6,[84,14,16],.5,R)}
  else{for(let r=0;r<4;r++){const c=sh(hx('#6a5640'),.8+R()*.4);px(g,0,r*8,c,1,32,8);px(g,0,r*8,[22,16,10],.8,32,1);
    for(let k=0;k<5;k++)px(g,Math.floor(R()*32),r*8+1+Math.floor(R()*6),sh(c,.7),.5,2+Math.floor(R()*8),1);px(g,Math.floor(R()*32),r*8,[18,12,8],.9,1,8)}
   speckle(g,0,0,32,32,[90,70,50],120,R,.5,1.2,.4);if(v===3)blot(g,Math.floor(R()*32),Math.floor(R()*32),7,[30,20,14],.4,R);if(v===5)blot(g,16,14,5,[90,18,18],.45,R)}};
 const ash=(g,R,b,v)=>{for(let i=0;i<3;i++)blot(g,Math.floor(R()*32),Math.floor(R()*32),3+Math.floor(R()*5),[20,19,18],.4,R);speckle(g,0,0,32,32,[24,22,20],90,R,.7,1.1,.45);if(v===1||v===3)blot(g,16,16,8,[14,13,12],.55,R)};

 /* piso por família de andar: 'tile' quadriculado (Andar 1, Medicação, -3, -4) · 'wood' tábuas (Andar 2) · 'concrete' laje (-1) · 'panel' placas de laboratório (-2)
    v: 0/6/7 = variações comuns do próprio andar · 1-5 = raras (mancha, rachadura, ladrilho escuro, riscos, óleo) */
 const FAM=['tile','panel','concrete','tile','tile','wood','tile','grass'];
 const baseFloor=(g,R,b,fam,v)=>{
  if(fam==='tile'){
   for(let ty=0;ty<4;ty++)for(let tx=0;tx<4;tx++){const chk=v===7?((tx+ty)&1?.8:1.12):1;px(g,tx*8,ty*8,sh(b,(.78+R()*.34)*chk*(v===6?1.08:1)),1,8,8)}
   speckle(g,0,0,32,32,b,190,R,.5,1.4,.4);
   for(let ty=0;ty<4;ty++)for(let tx=0;tx<4;tx++){const x=tx*8,y=ty*8;
    px(g,x+1,y+1,sh(b,1.35),.2,6,1);px(g,x+1,y+1,sh(b,1.35),.2,1,6);px(g,x+1,y+7,sh(b,.45),.3,7,1);px(g,x+7,y+1,sh(b,.45),.3,1,7)}
   for(let k=0;k<4;k++){px(g,k*8,0,sh(b,.28),1,1,32);px(g,0,k*8,sh(b,.28),1,32,1)}}
  else if(fam==='wood'){const c0=hx('#6a5640');
   for(let r=0;r<4;r++){const c=sh(c0,(.8+R()*.4)*(v===7?1.12:1));
    if(v===6){px(g,r*8,0,c,1,8,32);px(g,r*8,0,[22,16,10],.8,1,32);px(g,r*8,Math.floor(R()*32),[18,12,8],.9,8,1)}
    else{px(g,0,r*8,c,1,32,8);px(g,0,r*8,[22,16,10],.8,32,1);px(g,Math.floor(R()*32),r*8,[18,12,8],.9,1,8)}
    for(let k=0;k<5;k++){const gx=Math.floor(R()*32),gy=r*8+1+Math.floor(R()*6);if(v===6)px(g,r*8+1+Math.floor(R()*6),gx,sh(c,.7),.5,1,2+Math.floor(R()*8));else px(g,gx,gy,sh(c,.7),.5,2+Math.floor(R()*8),1)}}
   speckle(g,0,0,32,32,[90,70,50],120,R,.5,1.2,.4)}
  else if(fam==='grass'){ /* v1.7 JARDIM: grama morta, terra e pedrinhas */
   px(g,0,0,sh(b,.9),1,32,32);speckle(g,0,0,32,32,b,260,R,.6,1.45,.5);
   for(let i=0;i<26;i++){const gx=Math.floor(R()*32),gy=Math.floor(R()*30);px(g,gx,gy,sh(b,R()<.5?1.35:.6),.7,1,2+Math.floor(R()*3))}
   for(let i=0;i<4;i++)px(g,Math.floor(R()*30),Math.floor(R()*30),[104,88,62],.75,2+Math.floor(R()*3),2);
   for(let i=0;i<3;i++)px(g,Math.floor(R()*31),Math.floor(R()*31),[132,130,118],.8,1,1)}
  else if(fam==='concrete'){const c=sh(b,v===7?1.1:v===6?.92:1);px(g,0,0,c,1,32,32);speckle(g,0,0,32,32,c,320,R,.5,1.4,.5);
   px(g,0,15,sh(c,.4),.8,32,1);px(g,15,0,sh(c,.4),.8,1,32);px(g,0,16,sh(c,1.3),.25,32,1);
   for(let i=0;i<(v===6?9:3);i++)px(g,Math.floor(R()*32),Math.floor(R()*32),sh(c,1.5),.6,1+Math.floor(R()*2),1+Math.floor(R()*2));
   if(v===7)blot(g,Math.floor(R()*32),Math.floor(R()*32),6,sh(c,.72),.45,R)}
  else{const c=sh(b,v===7?1.12:1);px(g,0,0,c,1,32,32);speckle(g,0,0,32,32,c,140,R,.7,1.25,.3);
   if(v===6){for(let y=0;y<32;y+=3)px(g,0,y,sh(c,.45),.9,32,1);for(let y=1;y<32;y+=3)px(g,0,y,sh(c,1.3),.25,32,1)}
   else{for(const t of[0,16]){px(g,t,0,sh(c,.35),.95,1,32);px(g,0,t,sh(c,.35),.95,32,1);px(g,t+1,0,sh(c,1.35),.22,1,32);px(g,0,t+1,sh(c,1.35),.22,32,1)}
    for(const [rx,ry] of[[3,3],[12,3],[3,12],[12,12],[19,3],[28,3],[19,12],[28,12],[3,19],[12,19],[3,28],[12,28],[19,19],[28,19],[19,28],[28,28]])px(g,rx,ry,sh(c,.5),.8,1,1)}}};
 const floor=(band,v)=>mk('fl'+band+'_'+v,32,32,g=>{
  const R=rng(7001+band*97+v*13),b=hx(FLOOR[band]);
  baseFloor(g,R,b,FAM[band],v);
  if(v===1){blot(g,8+Math.floor(R()*16),8+Math.floor(R()*16),7,sh(b,.35),.5,R);blot(g,Math.floor(R()*32),Math.floor(R()*32),4,sh(b,.45),.45,R)}
  else if(v===2){let x=Math.floor(R()*32),y=0;for(let i=0;i<34&&y<32;i++){px(g,x,y,sh(b,.2),.95);if(R()<.35)px(g,x+1,y,sh(b,1.3),.25);y++;if(R()<.5)x+=R()<.5?-1:1;x=Math.max(0,Math.min(31,x))}}
  else if(v===3){const tx=Math.floor(R()*4),ty=Math.floor(R()*4);px(g,tx*8+1,ty*8+1,sh(b,.55),.8,7,7);for(let i=0;i<10;i++)px(g,tx*8+R()*8,ty*8+R()*8,sh(b,1.3),.5)}
  else if(v===4){for(let i=0;i<5;i++)px(g,R()*20,R()*32,sh(b,1.5),.18,6+Math.floor(R()*8),1)}
  else if(v===5){blot(g,Math.floor(R()*32),Math.floor(R()*32),7,[40,30,22],.35,R);speckle(g,0,0,32,32,[30,24,18],40,R,.6,1.2,.5)}
  if(band===0||band===4)ash(g,R,b,v);
 });

 const bandWall=(g,R,band,pl,dd,SPL)=>{
  if(band===1){for(let x=0;x<32;x+=8)px(g,x,SPL,sh(dd,.3),.9,1,64-SPL);for(let y=SPL+4;y<61;y+=8)px(g,0,y,sh(dd,.3),.9,32,1);
   for(let i=0;i<4;i++){const x=Math.floor(R()*32);for(let y=SPL;y<SPL+14;y++)px(g,x,y,[96,60,34],.3*(1-(y-SPL)/14))}}
  else if(band===2){for(let y=0;y<SPL;y+=4){px(g,0,y,sh(pl,.45),.7,32,1);const off=(y/4)%2?4:0;for(let x=off;x<32;x+=8)px(g,x,y,sh(pl,.45),.7,1,4)}
   for(let i=0;i<5;i++)blot(g,Math.floor(R()*32),Math.floor(R()*(SPL-4)),3,sh(pl,.55),.5,R)}
  else if(band===3){for(let i=0;i<2;i++){const x=4+Math.floor(R()*20),y=6+Math.floor(R()*14);for(let k=0;k<4;k++)px(g,x+k*2,y,[26,22,22],.8,1,5);px(g,x-1,y+2,[26,22,22],.8,9,1)}
   for(let i=0;i<5;i++){const x=Math.floor(R()*32),len=8+Math.floor(R()*18);for(let y=0;y<len;y++)px(g,x,y,[96,52,34],.3*(1-y/len)+.04)}}
  else if(band===6){for(let i=0;i<10;i++){const x=Math.floor(R()*32),len=14+Math.floor(R()*40);for(let y=0;y<len&&y<64;y++)px(g,x,y,[4,8,10],.5*(1-y/len)+.1)}
   speckle(g,0,0,32,64,[40,70,60],40,R,.7,1.3,.3)}};
 /* parede: reboco encardido em cima, friso verde-escuro embaixo (v: 0/9-11 liso · 1-2 canos · 3 mural · 4 caixa de incêndio · 5 ventilação/quadro · 6 sangue · 7 aviso · 8 cartaz) */
 const wall=(band,v)=>mk('wl'+band+'_'+v,32,64,g=>{
  const th=band===5?v%4:-1,R=rng(5003+band*61+v*29),pl=hx(th>=0?T2P[th]:PLASTER[band]),dd=hx(th>=0?T2D[th]:DADO[band]),SPL=38,PIPE=[96,100,94],PC=[.35,.7,1.05,.8,.4];
  px(g,0,0,pl,1,32,SPL);px(g,0,SPL,dd,1,32,64-SPL);
  speckle(g,0,0,32,SPL,pl,260,R,.6,1.25,.45);speckle(g,0,SPL,32,64-SPL,dd,160,R,.5,1.4,.45);
  for(let i=0;i<10;i++){const x=Math.floor(R()*32),len=10+Math.floor(R()*(SPL-10));for(let y=0;y<len;y++)px(g,x,y,sh(pl,.4),.3*(1-y/len)+.04)}
  for(let i=0;i<6;i++)blot(g,Math.floor(R()*32),Math.floor(R()*(SPL-4)),2+Math.floor(R()*3),sh(pl,.5),.5,R);
  for(let i=0;i<4;i++)blot(g,Math.floor(R()*32),Math.floor(R()*(SPL-4)),2+Math.floor(R()*2),sh(pl,1.3),.4,R);
  for(let i=0;i<7;i++){const x=Math.floor(R()*32),len=6+Math.floor(R()*20);for(let y=SPL;y<SPL+len&&y<64;y++)px(g,x,y,sh(dd,.55),.35*(1-(y-SPL)/len)+.05)}
  for(let i=0;i<3;i++)blot(g,Math.floor(R()*32),SPL+4+Math.floor(R()*18),3,[70,45,30],.35,R);
  px(g,0,0,sh(pl,.45),1,32,2);
  px(g,0,SPL-2,sh(pl,1.15),.55,32,1);px(g,0,SPL-1,sh(dd,.35),1,32,1);
  px(g,0,61,sh(dd,.4),1,32,3);px(g,0,60,sh(dd,1.4),.25,32,1);
  if(th>=0)decay2(g,R,th,pl,dd,SPL);else if(band===0||band===4)soot(g,R,pl,dd,SPL);
  else bandWall(g,R,band,pl,dd,SPL);
  switch(v){
   case 1:{const x0=13;for(let i=0;i<5;i++)px(g,x0+i,0,sh(PIPE,PC[i]),1,1,64);for(const y of [10,34,56])px(g,x0-1,y,sh(PIPE,.3),1,7,2);break}
   case 2:{for(let i=0;i<5;i++)px(g,0,5+i,sh(PIPE,PC[i]),1,32,1);for(const x of [3,25])px(g,x,3,sh(PIPE,.3),1,2,9);break}
   case 3:{px(g,4,12,[58,40,28],1,24,16);px(g,5,13,[128,98,64],1,22,14);
    px(g,6,14,[216,210,190],1,6,7);px(g,13,15,[206,200,180],1,5,6);px(g,19,14,[222,216,196],1,6,8);
    px(g,7,16,[90,88,80],.8,4,1);px(g,7,18,[90,88,80],.8,3,1);px(g,20,16,[90,88,80],.8,4,1);px(g,20,19,[90,88,80],.8,3,1);
    px(g,8,14,[170,40,36],1);px(g,15,15,[170,40,36],1);px(g,21,14,[170,40,36],1);break}
   case 4:{px(g,10,14,[30,12,10],1,12,17);px(g,11,15,[132,34,28],1,10,15);px(g,12,16,[162,50,42],1,8,3);
    px(g,12,20,[40,16,14],1,8,8);px(g,13,21,[62,24,22],.8,6,6);
    px(g,13,23,[226,210,196],1,1,5);px(g,17,23,[226,210,196],1,1,5);px(g,13,25,[226,210,196],1,5,1);break}
   case 5:{px(g,5,16,[28,28,26],1,12,8);for(let i=0;i<4;i++)px(g,6,17+i*2,[10,10,9],1,10,1);
    px(g,22,14,[30,32,30],1,6,9);px(g,23,15,[70,74,72],1,4,7);px(g,24,17,[214,142,52],1,2,1);break}
   case 6:{blot(g,16+Math.floor(R()*8-4),12+Math.floor(R()*6),5,[92,16,18],.8,R);
    for(let i=0;i<6;i++){const x=10+Math.floor(R()*12),len=4+Math.floor(R()*14);for(let y=14;y<14+len;y++)px(g,x,y,[84,14,16],.75*(1-(y-14)/len)+.1)}break}
   case 7:{px(g,11,14,[44,40,34],1,10,13);px(g,12,15,[200,196,176],1,8,11);
    for(let i=0;i<4;i++)px(g,13,17+i*2,[60,60,55],.8,6,1);px(g,12,15,[120,30,28],1,8,1);break}
   case 8:{px(g,6,8,[40,34,28],1,20,26);px(g,7,9,[184,172,146],1,18,24);
    for(let y=-6;y<=6;y++)for(let x=-8;x<=8;x++){const e=(x*x)/64+(y*y)/36;if(e<=1)px(g,16+x,19+y,e>.7?[150,98,100]:[186,128,126],1)}
    for(let i=0;i<14;i++)px(g,9+R()*14,14+R()*10,[110,70,72],.8,2,1);
    px(g,9,10,[70,60,50],1,14,1);px(g,10,12,[70,60,50],1,12,1);px(g,9,29,[70,60,50],1,14,1);px(g,12,31,[70,60,50],1,8,1);break}
  }
 });
 const top=band=>mk('wt'+band,32,32,g=>{
  const R=rng(333+band*7),b=sh(hx(DADO[band]),.75),rim=sh(hx(PLASTER[band]),.5);
  px(g,0,0,b,1,32,32);speckle(g,0,0,32,32,b,120,R,.6,1.3,.5);
  px(g,0,0,rim,1,32,2);px(g,0,30,rim,1,32,2);px(g,0,0,rim,1,2,32);px(g,30,0,rim,1,2,32);px(g,2,2,sh(b,1.4),.18,28,1)});

 /* decalques de chão (alpha) */
 const blood=v=>mk('bl'+v,64,64,g=>{
  const R=rng(8100+v*37),P=[[74,10,10],[96,14,14],[118,20,22],[56,8,10],[138,28,28]],col=()=>P[Math.floor(R()*P.length)];
  if(v===0){blot(g,32,32,8,P[1],.95,R);blot(g,32,32,5,P[3],.9,R);
   for(let i=0;i<26;i++){const a=R()*6.283,len=10+R()*20;
    for(let t=4;t<len;t++){const k=1-t/len;if(R()<k*1.1){const s=k>.5?2:1;px(g,32+Math.cos(a)*t,32+Math.sin(a)*t,col(),.92,s,s)}}
    blot(g,Math.floor(32+Math.cos(a)*len),Math.floor(32+Math.sin(a)*len),1+Math.floor(R()*2),col(),.9,R)}}
  else if(v===1){const th=-.35,cx=Math.cos(th),sy=Math.sin(th);
   for(let t=0;t<54;t++){const k=1-t/54;blot(g,Math.floor(6+t*cx),Math.floor(40+t*sy),Math.max(1,Math.round(4*k+R()*2)),col(),.9,R)}
   for(let i=0;i<14;i++)blot(g,Math.floor(8+R()*50),Math.floor(40-R()*22),1+Math.floor(R()*2),col(),.9,R)}
  else if(v===2){for(let i=0;i<16;i++)blot(g,Math.floor(32+R()*40-20),Math.floor(32+R()*40-20),1+Math.floor(R()*3),col(),.9,R)}
  else{blot(g,28,32,11,P[1],.9,R);blot(g,26,30,6,P[3],.9,R);
   for(let x=36;x<62;x++){const k=1-(x-36)/26;if(R()<k)px(g,x,30+Math.floor(R()*5),col(),.85*k+.1,1,1+Math.floor(R()*2))}}
 });
 const vent=()=>mk('vent',32,32,g=>{
  px(g,3,6,[22,22,20],1,26,20);px(g,4,7,[70,72,68],1,24,18);
  for(let i=0;i<8;i++)px(g,6+i*3,9,[8,8,8],1,2,14);
  px(g,4,7,[110,112,106],.5,24,1);px(g,4,24,[30,30,28],.6,24,1);
  for(const p of [[4,7],[26,7],[4,23],[26,23]])px(g,p[0],p[1],[150,140,110],1,2,2)});
 const papers=()=>mk('papers',32,32,g=>{
  g.save();g.translate(11,14);g.rotate(.35);g.fillStyle='rgb(204,199,181)';g.fillRect(-6,-5,12,10);g.fillStyle='rgba(60,58,52,.7)';g.fillRect(-4,-2,8,1);g.fillRect(-4,1,6,1);g.restore();
  g.save();g.translate(21,19);g.rotate(-.5);g.fillStyle='rgb(190,185,166)';g.fillRect(-5,-5,10,9);g.fillStyle='rgba(60,58,52,.7)';g.fillRect(-3,-2,6,1);g.restore()});
 const damp=v=>mk('dm'+v,64,64,g=>{const R=rng(6600+v*19);for(let i=0;i<3;i++)blot(g,16+Math.floor(R()*32),16+Math.floor(R()*32),8+Math.floor(R()*8),[8,8,8],.34,R)});
 const POOLC={warm:'255,226,176',cool:'205,236,226',red:'236,172,136',teal:'96,230,214'};
 const pool=name=>mk('pool'+name,128,128,g=>{
  const c=POOLC[name]||POOLC.warm,gr=g.createRadialGradient(64,64,2,64,64,64);
  gr.addColorStop(0,'rgba('+c+',.55)');gr.addColorStop(.35,'rgba('+c+',.22)');gr.addColorStop(1,'rgba('+c+',0)');
  g.fillStyle=gr;g.fillRect(0,0,128,128)},true);
 return {floor,wall,top,blood,vent,papers,damp,pool};
})();
