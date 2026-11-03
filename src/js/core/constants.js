/* constants.js
 * EXPORTA: W, H, TS, BD, MECH, ECOLOGY, SLOTS, LEFT_SLOTS, RIGHT_SLOTS, VIS, LOOT_TABLE, ENEMY_PARTS, FLOOR_ORDER, FLOOR_BAND, FLOOR_NAME
 * DEPENDE DE: nada (apenas dados)
 * NÃO PODE ALTERAR: Script clássico (sem import/export): declarações top-level viram escopo global de script, compartilhado entre os arquivos. nenhum valor: BD/ECOLOGY/LOOT_TABLE definem geração e balanceamento
 */
const W=128,H=448,TS=30;
const BD=[
{n:'ANDAR 1 · PACIENTES E ALA DE CIRURGIA',y:0,h:64,m:9,x:16,cw:2,c:['#7c8474','#737b6b'],w:'#262a24',e:'#566050'},
{n:'ANDAR -2 · SETOR DE EXPERIMENTOS',y:128,h:64,m:8,x:14,cw:2,c:['#5a7b83','#527279'],w:'#16252a',e:'#3b6069'},
{n:'ANDAR -1 · SUBTERRÂNEO',y:192,h:64,m:6,x:11,cw:1,c:['#413e37','#3a3731'],w:'#110f0d',e:'#2f2b26'},
{n:'ANDAR -3 · SETOR DA PRISÃO',y:256,h:64,m:8,x:13,cw:2,c:['#514747','#493f40'],w:'#21191b',e:'#74504d'},
{n:'ANDAR 1 · SETOR DA MEDICAÇÃO (ANEXO)',y:64,h:64,m:8,x:13,cw:2,c:['#6b7770','#596a62'],w:'#18231e',e:'#527064'},
{n:'ANDAR 2 · DORMITÓRIOS E BIBLIOTECA',y:320,h:64,m:8,x:13,cw:2,c:['#6c6658','#645e51'],w:'#26211b',e:'#6b5a45'},
{n:'ANDAR -4 · O ABISMO',y:384,h:64,m:8,x:13,cw:2,c:['#2c3238','#272c32'],w:'#0c0f12',e:'#26313b'}];
const MECH=['Você encontra a chave-mestra no cofre do diretor. Mecanismo 1 de 3.','Você arranca o cilindro de ignição do aparelho. Mecanismo 2 de 3.','Você gira a válvula de pressão até travar. Mecanismo 3 de 3.'];
const ECOLOGY={rats:{maxPopulation:100,reproductionSeconds:240,activeLimit:8},roaches:{maxPopulation:100,reproductionSeconds:150,activeLimit:14}};
const SLOTS=[['head','Cabeça'],['torso','Tronco'],['shoulders','Ombros'],['neck','Pescoço'],['accessory1','Acessório 1'],['accessory2','Acessório 2'],['accessory3','Acessório 3'],['leftHand','Mão esquerda'],['rightHand','Mão direita'],['legs','Pernas'],['feet','Pés']];const LEFT_SLOTS=['head','shoulders','neck','accessory1','leftHand','legs'];const RIGHT_SLOTS=['torso','accessory2','accessory3','rightHand','feet'];
/* Ajustes rápidos do visual (luz ambiente, luminárias de parede, lamparina de Karl) */
const VIS={hemi:.085,ambient:.04,exposure:1.1,lampDist:8.5,lampDecay:1.6};
const LOOT_TABLE={
 'comum':[{name:'Garrafa de Água',type:'consumable',rarity:'Comum',effect:'Água potável. Recupera sede e deixa uma garrafa vazia.',desc:'Garrafa de água.'},{name:'Carne Crua',type:'food',rarity:'Comum',effect:'Recupera um pouco de fome.',desc:'Carne crua, precisa ser preparada.'},{name:'Sal',type:'material',rarity:'Comum',effect:'Ingrediente para preparo de alimentos.',desc:'Sal grosso.'},{name:'Pão',type:'food',rarity:'Comum',effect:'Recupera fome.',desc:'Pão simples.'},{name:'Enlatado de Sardinha',type:'food',rarity:'Comum',effect:'Recupera fome.',desc:'Sardinhas em conserva.'}],
 'incomum':[{name:'Coxa de Frango',type:'food',rarity:'Incomum',effect:'Recupera bastante fome.',desc:'Coxa de frango crua.'},{name:'Vinagre',type:'material',rarity:'Incomum',effect:'Ingrediente para preparo.',desc:'Vinagre em uma pequena garrafa.'},{name:'Óleo',type:'material',rarity:'Incomum',effect:'Ingrediente para preparo.',desc:'Óleo de cozinha.'},{name:'Enlatado de Milho',type:'food',rarity:'Incomum',effect:'Recupera fome.',desc:'Milho em conserva.'},{name:'Refri (lata)',type:'consumable',rarity:'Incomum',effect:'Recupera um pouco de sede.',desc:'Lata de refrigerante.'}],
 'rara':[{name:'Carne Estragada',type:'food',rarity:'Rara',effect:'Pode recuperar fome, mas faz mal.',desc:'Carne com cheiro forte e sinais de deterioração.'},{name:'Pão Mofado',type:'food',rarity:'Rara',effect:'Pouco nutritivo e perigoso.',desc:'Pão coberto por mofo.'},{name:'Coca Cola (1 litro)',type:'consumable',rarity:'Rara',effect:'Recupera sede e deixa uma garrafa vazia de 1 litro.',desc:'Garrafa de refrigerante de um litro.'}],
 'muito-rara':[{name:'Coxa de Frango',type:'food',rarity:'Muito rara',effect:'Um alimento relativamente nutritivo.',desc:'Coxa de frango em bom estado.'},{name:'Enlatado de Sardinha',type:'food',rarity:'Muito rara',effect:'Alimento preservado.',desc:'Lata intacta de sardinhas.'}],
 'lendaria':[{name:'Garrafa de Água',type:'consumable',rarity:'Lendária',effect:'Água limpa em excelente condição.',desc:'Garrafa lacrada de água.'},{name:'Coca Cola (1 litro)',type:'consumable',rarity:'Lendária',effect:'Bebida preservada e lacrada.',desc:'Garrafa de refrigerante de um litro.'}]
};
const ENEMY_PARTS=[['head','CABEÇA'],['torso','TRONCO'],['leftArm','BRAÇO ESQ.'],['rightArm','BRAÇO DIR.'],['leftLeg','PERNA ESQ.'],['rightLeg','PERNA DIR.']];
const FLOOR_ORDER=['2','1','-1','-2','-3','-4'],FLOOR_BAND={'2':5,'1':0,'-1':2,'-2':1,'-3':3,'-4':6},FLOOR_NAME={'2':'DORMITÓRIOS · BIBLIOTECA','1':'PACIENTES · MEDICAÇÃO','-1':'SUBTERRÂNEO','-2':'EXPERIMENTOS','-3':'PRISÃO','-4':'O ABISMO'};
