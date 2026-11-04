/* ===== Criação de personagem — regras, cálculos e validação (independente da interface) =====
   Fonte: Livro I, ed. 0.3, caps. 10, 13, 14, 16 e 17.
   Exceção (regra da mesa definida pelo proprietário do projeto): a reserva inicial de mana NÃO é rolada;
   os dados raciais contam no valor máximo (D4 = 4) e soma-se o Corpo.
   Depende de rules.js (AT, AN, PV, ORI, ORI_PER, NARR, RG, uid). Não acessa DOM nem localStorage. */
const ETAPAS=['Identidade','Atributos','Reserva de mana','Perícias raciais','Habilidade racial','Origem','Revisão'];
const ETAPA={identidade:0,atributos:1,mana:2,pericias:3,habilidade:4,origem:5,revisao:6};
const ATR_REGRA={inicial:1,extras:4,total:9,max:5,zerosMax:1};
const MANA_REGRA_ID='dados-no-maximo';

/* --- Reserva inicial de mana (regra da mesa) --- */
const manaBase=povo=>PV[povo]?PV[povo].d*4:null;
/* Retorna o detalhamento do cálculo ou null se povo/Corpo ainda não permitem calcular. */
function calcManaInicial(povo,corpo){const b=manaBase(povo);if(b==null||!Number.isInteger(corpo)||corpo<0)return null;
 return{regra:MANA_REGRA_ID,dados:PV[povo].d+'D4',base:b,corpo,total:b+corpo}}

/* --- Rascunho --- */
const newW=()=>({nome:'',idade:'',povo:'',a:{for:1,des:1,cor:1,car:1,int:1},per:[],hab:'',origem:'',narr:{conceito:'',aparencia:'',historia:'',objetivos:'',obs:''}});
const err=(etapa,campo,codigo,msg)=>({etapa,campo,codigo,msg});
const isInt=v=>typeof v=='number'&&Number.isInteger(v);

/* --- Atributos --- */
function resumoAtributos(a){a=a||{};const vals=AT.map(([k])=>a[k]),soma=vals.reduce((s,v)=>s+(isInt(v)?v:0),0),zeros=AT.filter(([k])=>a[k]===0).map(([k])=>k);
 return{soma,zeros,restantes:ATR_REGRA.total-soma}}
function validateAttributes(a){const e=[],E1=(c,k,m)=>e.push(err(ETAPA.atributos,k?'a.'+k:'a',c,m));
 if(!a||typeof a!='object'){E1('ATR_AUSENTES','', 'Atributos não informados.');return e}
 AT.forEach(([k,n])=>{const v=a[k];if(!isInt(v))E1('ATR_INVALIDO',k,n+' tem um valor inválido; use um número inteiro de 0 a '+ATR_REGRA.max+'.');
  else if(v<0)E1('ATR_NEGATIVO',k,n+' não pode ser negativo.');
  else if(v>ATR_REGRA.max)E1('ATR_ACIMA_MAX',k,n+' está em '+v+'; o limite na criação é '+ATR_REGRA.max+'.')});
 const{soma,zeros,restantes}=resumoAtributos(a);
 if(zeros.length>ATR_REGRA.zerosMax)E1('ATR_ZEROS','', 'Só um atributo pode ser reduzido a 0; há '+zeros.length+' ('+zeros.map(k=>AN[k]).join(', ')+').');
 if(restantes>0)E1('ATR_PONTOS_RESTANTES','', 'Falta distribuir '+restantes+' ponto(s): a soma dos atributos deve ser '+ATR_REGRA.total+' (está em '+soma+').');
 if(restantes<0)E1('ATR_PONTOS_EXCEDIDOS','', 'Há '+(-restantes)+' ponto(s) a mais: a soma dos atributos deve ser '+ATR_REGRA.total+' (está em '+soma+').');
 return e}
/* Pode subir/descer um atributo pela interface sem violar as regras? (o rascunho é sempre revalidado ao salvar) */
function podeAlterarAtributo(a,k,delta){const v=a[k],{zeros,restantes}=resumoAtributos(a);
 if(delta>0)return v<ATR_REGRA.max&&restantes>0;
 if(delta<0)return v>1||(v==1&&zeros.length<ATR_REGRA.zerosMax);return false}

/* --- Identidade --- */
function validateIdentity(w){const e=[],I=(c,f,m)=>e.push(err(ETAPA.identidade,f,c,m));
 if(!String(w.nome??'').trim())I('NOME_AUSENTE','nome','Informe o nome do personagem.');
 const id=w.idade;if(id===''||id==null)I('IDADE_AUSENTE','idade','Informe a idade do personagem.');
 else if(!isInt(id)||id<0)I('IDADE_INVALIDA','idade','A idade deve ser um número inteiro (0 ou mais).');
 if(!w.povo)I('POVO_AUSENTE','povo','Escolha o povo do personagem.');
 else if(!PV[w.povo])I('POVO_INEXISTENTE','povo','O povo “'+w.povo+'” não existe no Livro I.');
 if(w.narr!=null&&typeof w.narr!='object')I('NARR_INVALIDO','narr','Campos narrativos em formato inválido.');
 return e}

/* --- Mana --- */
function validateMana(w){const e=[];if(!PV[w.povo]||!isInt(w.a&&w.a.cor))return e; /* já apontado em identidade/atributos */
 if(!calcManaInicial(w.povo,w.a.cor))e.push(err(ETAPA.mana,'mana','MANA_INCALCULAVEL','Não foi possível calcular a reserva inicial.'));return e}

/* --- Perícias raciais --- */
const periciasOrigem=o=>ORI_PER[o]||[];
function validateRacialSkills(w){const e=[],P=(c,m)=>e.push(err(ETAPA.pericias,'per',c,m)),per=w.per,int=w.a&&w.a.int;
 if(!Array.isArray(per)){P('PER_INVALIDAS','Lista de perícias raciais inválida.');return e}
 const lista=PV[w.povo]?PV[w.povo].per:null;
 if(lista)per.filter(p=>!lista.includes(p)).forEach(p=>P('PER_OUTRO_POVO','“'+p+'” não pertence à lista de perícias de '+w.povo+'.'));
 const dup=per.filter((p,i)=>per.indexOf(p)!=i);[...new Set(dup)].forEach(p=>P('PER_DUPLICADA','“'+p+'” foi escolhida mais de uma vez.'));
 periciasOrigem(w.origem).filter(p=>per.includes(p)).forEach(p=>P('PER_DUPLICA_ORIGEM','“'+p+'” já é concedida pela origem; escolha outra perícia racial.'));
 if(isInt(int)&&int>=0){if(per.length>int)P('PER_EXCESSO','Foram escolhidas '+per.length+' perícias, mas Inteligência '+int+' permite exatamente '+int+'.');
  else if(per.length<int)P('PER_FALTANDO','Escolha mais '+(int-per.length)+' perícia(s): a quantidade deve ser igual à Inteligência ('+int+').')}
 return e}

/* --- Habilidade racial --- */
const habilidadeRacial=(povo,nome)=>PV[povo]?PV[povo].hab.find(x=>x[0]==nome)||null:null;
function validateRacialAbility(w){const e=[],H=(c,m)=>e.push(err(ETAPA.habilidade,'hab',c,m)),h=w.hab;
 if(Array.isArray(h)){H('HAB_MULTIPLAS','Escolha exatamente uma habilidade racial (há '+h.length+').');return e}
 if(!h){H('HAB_AUSENTE','Escolha uma habilidade racial.');return e}
 if(PV[w.povo]&&!habilidadeRacial(w.povo,h))H('HAB_OUTRO_POVO','“'+h+'” não é uma habilidade racial de '+w.povo+'.');return e}

/* --- Origem --- */
function validateOrigin(w){if(!w.origem)return[err(ETAPA.origem,'origem','ORI_AUSENTE','Escolha uma origem.')];
 if(!ORI.includes(w.origem))return[err(ETAPA.origem,'origem','ORI_INEXISTENTE','A origem “'+w.origem+'” não está entre as 17 reconhecidas pelo Livro I.')];return[]}

/* --- Validação global: usada pelo assistente, pelo salvamento e pelos testes --- */
function validateCharacterCreation(w){if(!w||typeof w!='object')return{ok:false,erros:[err(ETAPA.identidade,'','RASCUNHO_INVALIDO','Rascunho de personagem ausente.')]};
 const erros=[...validateIdentity(w),...validateAttributes(w.a),...validateMana(w),...validateRacialSkills(w),...validateRacialAbility(w),...validateOrigin(w)];
 return{ok:!erros.length,erros}}
const errosDaEtapa=(w,s)=>validateCharacterCreation(w).erros.filter(x=>x.etapa==s);

/* --- Mutações do rascunho que mantêm as escolhas dependentes coerentes --- */
/* Remove perícias de outro povo/duplicadas/excedentes e habilidade incompatível. Retorna o que foi removido. */
function reconcileDraft(w){const rem={per:[],hab:''},lista=PV[w.povo]?PV[w.povo].per:[],int=isInt(w.a.int)&&w.a.int>=0?w.a.int:0,ok=[];
 (Array.isArray(w.per)?w.per:[]).forEach(p=>{if(lista.includes(p)&&!ok.includes(p)&&!periciasOrigem(w.origem).includes(p)&&ok.length<int)ok.push(p);else rem.per.push(p)});w.per=ok;
 if(w.hab&&!habilidadeRacial(w.povo,w.hab)){rem.hab=w.hab;w.hab=''}return rem}
function setPovo(w,p){w.povo=p;return reconcileDraft(w)}
function setAtributo(w,k,v){w.a[k]=v;return reconcileDraft(w)}
function setOrigem(w,o){w.origem=o;return reconcileDraft(w)}
function togglePericia(w,p){if(w.per.includes(p)){w.per=w.per.filter(x=>x!=p);return true}
 if(!PV[w.povo]||!PV[w.povo].per.includes(p)||periciasOrigem(w.origem).includes(p)||w.per.length>=w.a.int)return false;w.per.push(p);return true}

/* --- Ficha final. Só é gerada a partir de um rascunho válido. --- */
const txtParaHtml=t=>String(t||'').split(/\n{2,}/).map(p=>p.trim()).filter(Boolean).map(p=>'<p>'+E(p).replace(/\n/g,'<br>')+'</p>').join('');
function mk(w){const v=validateCharacterCreation(w);if(!v.ok){const x=new Error('Ficha inválida');x.erros=v.erros;throw x}
 const sk={};w.per.forEach(p=>sk[p]=2);periciasOrigem(w.origem).forEach(p=>{if(!(p in sk))sk[p]=2});
 const m=calcManaInicial(w.povo,w.a.cor),hb=habilidadeRacial(w.povo,w.hab),n=w.narr||{};
 return{id:uid(),nome:w.nome.trim(),idade:w.idade,povo:w.povo,origem:w.origem,cor:'#7a3436',img:'',a:{...w.a},
  manaMax:m.total,mana:m.total,mana0:m,nucleo:'',sk,hab:hb[0],
  narr:Object.fromEntries(NARR.map(([k])=>[k,String(n[k]||'').trim()])),
  w:Object.fromEntries(Object.keys(RG).map(k=>[k,{g:0,h:0,amp:0,log:[]}])),post:'Neutra',pesada:false,notes:'',inv:'',
  hist:{t:'',html:txtParaHtml(n.historia)},bag:[],magias:[],habs:[{id:uid(),nome:hb[0],cat:'Habilidade racial',efe:hb[1],racial:true}],eq:'',cin:'',money:[0,0,0],dead:false}}
