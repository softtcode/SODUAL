const $=s=>document.querySelector(s),E=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])),rnd=n=>1+Math.floor(Math.random()*n),uid=()=>Math.random().toString(36).slice(2,10);
/* ===== REGRAS (Livro I, ed. 0.4) — centralizadas. Regras da mesa e pendências ficam identificadas como tal (ver PEND). ===== */
const AT=[['for','Força'],['des','Destreza'],['cor','Corpo'],['car','Carisma'],['int','Inteligência']],AN=Object.fromEntries(AT);
const SK={Atletismo:'for',Acrobacia:'des',Furtividade:'des','Prestidigitação':'des','História':'int','Controle de Mana':'cor','Investigação':'int',Natureza:'int','Religião':'int','Intuição':'int','Trato com Criaturas':'car',Medicina:'int','Percepção':'int','Atuação':'car','Enganação':'car','Intimidação':'car','Persuasão':'car',Montaria:'des',Luta:'for',Pontaria:'des'};
const GRD=[['Não treinado',0],['Apto',2],['Treinado',3],['Excepcional',5]];
/* Povos (cap. 16). d = quantidade de D4 raciais (cap. 10). Efeitos das habilidades transcritos do livro, com limites de uso preservados. */
/* Dados raciais da reserva inicial (regra atual da mesa): Sáelios 4D4, Arveni 3D4, Dárnios 2D4. Fichas já criadas mantêm a reserva registrada. */
const PV={'Sáelios':{d:4,per:['Controle de Mana','História','Investigação','Intuição','Percepção','Religião','Medicina'],hab:[['Sensibilidade Mágica','+1 em testes destinados a perceber ou identificar manifestações de mana.'],['Afinidade Arcana','Uma vez por cena, +2 em um teste de Controle de Mana.'],['Percepção do Fluxo','Ao observar alguém usando magia, pode tentar reconhecer alterações no fluxo de mana e características gerais da manifestação. Não revela automaticamente todas as capacidades do alvo.'],['Passos Arcanos','O deslocamento padrão aumenta de 9 para 12 metros por turno.']]},
Arveni:{d:3,per:['Atletismo','Acrobacia','Persuasão','Intuição','Medicina','Natureza','Montaria'],comp:[['Conhecimento Ampliado','Característica complementar: duas escolhas adicionais de perícias, registradas à parte das perícias raciais. O grau de treinamento dessas escolhas ainda não foi definido pelo livro: nenhum bônus é somado automaticamente.']],hab:[['Reflexos Condicionados','+1 em testes para recuperar o equilíbrio após queda, escorregão ou impacto que comprometa a estabilidade.'],['Resistência Adaptativa','+1 em testes para resistir a esforços físicos prolongados.'],['Leitura Social','+1 em testes de Intuição destinados a interpretar emoções, intenções, desconfortos ou sinais de mentira.']]},
'Dárnios':{d:2,comp:[['Tenacidade Física','Característica complementar e natural: reduz em 1 a penalidade final de ferimentos (−1 vira 0, −2 vira −1, −3 vira −2). Não reduz a gravidade, não impede agravamento nem desmembramento, não permite usar um membro Fatal, não depende de mana e não é um Cinete.']],per:['Atletismo','Prestidigitação','Intimidação','Medicina','Natureza','Trato com Criaturas','Percepção'],hab:[['Estrutura Robusta','+1 em testes para resistir a empurrões, quedas e deslocamentos forçados.'],['Mãos Firmes','+1 em testes de trabalho manual de precisão ou manuseio de ferramentas.'],['Firmeza Dárnia','Uma vez por cena, +2 em teste para resistir a esforço intenso ou manter posição diante de força externa.']]}};
/* As 17 origens reconhecidas (cap. 17), com o significado narrativo do livro. Nenhum benefício mecânico: os pacotes não foram publicados. */
const ORI_DESC={'Nobre':'Pessoa criada em uma família de posição social elevada, familiarizada com ambientes de influência e relações entre casas importantes.','Linhagem Militar':'Pessoa formada em um ambiente familiar de disciplina e tradição militar, com contato com a organização do serviço e do combate.','Camponês':'Pessoa que cresceu em comunidade rural e conviveu com rotinas de trabalho físico e atividades práticas.','Família Mercante':'Pessoa criada junto a atividades de comércio, negociação, circulação de produtos e relações mercantis.','Submundo':'Pessoa que teve sua formação pessoal próxima a redes informais ou atividades clandestinas.','Filho dos Marcados':'Descendente de participantes da traição ocorrida há aproximadamente dez anos, poupado das punições aplicadas aos adultos envolvidos. Carrega o estigma da família, mas a origem não determina culpa, caráter nem escolhas.','Erudito':'Pessoa criada em um contexto que valorizou estudos, pesquisa, documentação e aprendizagem intelectual.','Aprendiz de Ofício':'Pessoa que passou parte de sua juventude aprendendo uma atividade manual ou técnica.','Aprendiz de Curandeiro':'Pessoa que teve contato com cuidados básicos de saúde e práticas de tratamento.','Criado pela Fé':'Pessoa formada em ambiente religioso e familiarizada com crenças e ensinamentos de sua comunidade (em Bevon, predomina a fé na Mãe).','Fronteiriço':'Pessoa que cresceu próxima a áreas de risco ou regiões de fronteira, em contato com as exigências desse ambiente.','Marinheiro':'Pessoa com trajetória ligada a embarcações e ao cotidiano da navegação.','Nômade ou Viajante':'Pessoa criada em deslocamentos frequentes ou na convivência com diferentes lugares.','Caçador':'Pessoa familiarizada com observação de animais e atividades de rastreamento.','Prodígio':'Pessoa que manifestou facilidade excepcional em alguma área desde cedo, sem possuir automaticamente domínio universal.','Criado em Instituição':'Pessoa que cresceu em abrigo ou outro ambiente coletivo de convivência organizada.','Criado entre Cavaleiros':'Pessoa que passou parte de sua vida próxima a cavaleiros e à tradição dracônica de Bevon.'};
const ORI=Object.keys(ORI_DESC);
/* Perícias concedidas por cada origem: o livro (ed. 0.4) não publica os pacotes. Fica vazio até o autor definir; a validação já impede duplicar com as raciais quando houver. */
const ORI_PER={};
/* Estágios do núcleo, na ordem da mesa. O Livro I ed. 0.4 confirma Preto; Vermelho e Laranja (Escuro, Sólido, Claro); Prata (Escuro, Sólido, Claro) e o final Branco Puro.
   As cores entre Laranja e Prata estão pendentes no livro; Amarelo (Escuro, Sólido, Claro) é decisão da mesa (NUC_FONTE). Toda ficha nova começa em Preto (NUC_INI). Sem efeito mecânico.
   O valor gravado do estágio final continua 'Branco' (compatibilidade); a interface mostra o nome oficial 'Branco Puro' (nucNome).
   NUC_LEG: valores gravados por versões anteriores que não têm correspondência exata (o antigo "Laranja" pode ser qualquer um dos três tons) — são preservados e sinalizados, nunca convertidos sozinhos. */
const NUC=['Preto','Vermelho Escuro','Vermelho Sólido','Vermelho Claro','Laranja Escuro','Laranja Sólido','Laranja Claro','Amarelo Escuro','Amarelo Sólido','Amarelo Claro','Prata Escura','Prata Sólida','Prata Clara','Branco'],NUC_INI='Preto',
 NUC_C={'Preto':'#1b1622','Vermelho Escuro':'#6e1420','Vermelho Sólido':'#b3202e','Vermelho Claro':'#e0525c','Laranja Escuro':'#a8480f','Laranja Sólido':'#e2741b','Laranja Claro':'#f6a75a','Amarelo Escuro':'#a8860c','Amarelo Sólido':'#e8c21c','Amarelo Claro':'#f7e27a','Prata Escura':'#7d8590','Prata Sólida':'#b4bcc6','Prata Clara':'#dde2e8','Branco':'#f4f1ea'},NUC_LEG=['Laranja'];
const nucleoValido=v=>v===''||NUC.includes(v);
const nucNome=v=>v=='Branco'?'Branco Puro':v,NUC_FONTE=v=>/^Amarelo/.test(v)?'mesa':NUC.includes(v)?'livro':'';
function setNucleo(c,v){if(!nucleoValido(v))return false;c.nucleo=v;return true}
const RG={cabeca:['Cabeça',0],tronco:['Tronco',0],bd:['Braço direito',1],be:['Braço esquerdo',1],pd:['Perna direita',1],pe:['Perna esquerda',1]};
const GN=['Saudável','Leve','Intermediário','Alto','Grave','Fatal'],PEN=[0,0,-1,-2,-3,-3],GC=['#6f8f62','#b9a23c','#d08a2e','#c4552f','#8e1f2a','#2b1114'];
/* Ocorrências do grau atual necessárias para avançar: [cabeça/tronco, membros]. Regra geral: 2 graus iguais.
   Exceções nos braços e pernas: Leve → Intermediário exige 3 Leves e Intermediário → Alto exige 3 Intermediários. O próprio estado conta como 1 (ao chegar a um grau, o contador começa em 1). */
/* Posturas (cap. 19, ed. 0.4): [cabeça/tronco, braços/pernas]. A Defensiva passou a dar +1 nos membros (antes +2). */
const NEED={1:[2,3],2:[2,3],3:[2,2],4:[2,2]},POS={Ofensiva:[0,0],Neutra:[2,0],Defensiva:[3,1]};
/* Bônus de ataque por postura (regra da mesa): Ofensiva +2. Aplicado só no cálculo, nunca gravado nos atributos. */
const ATK_POS={Ofensiva:2,Neutra:0,Defensiva:0};
/* Pontos de regra exibidos na Biblioteca: tipo 'livro' (confirmado no Livro I ed. 0.4), 'mesa' (decisão desta campanha/app) ou 'pend' (sem procedimento confirmado). */
const PEND=[['mesa','Reserva inicial de mana: dados raciais (Sáelios 4D4, Arveni 3D4, Dárnios 2D4) + Corpo, até 3 tentativas, cada uma descartando a anterior (Livro I 0.4). Pela mesa, o povo fica travado após a primeira rolagem.'],
 ['mesa','A postura Ofensiva concede +2 no ataque. Não é regra do livro (que só define bônus defensivos por região).'],
 ['livro','Posturas (cap. 19): Ofensiva +0; Neutra +2 em cabeça e tronco; Defensiva +3 em cabeça e tronco e +1 em braços e pernas. Ferimento Alto em um braço impede a Defensiva; arma pesada de duas mãos só na Ofensiva.'],
 ['livro','Núcleo: Preto; Vermelho e Laranja (Escuro, Sólido, Claro); Prata (Escuro, Sólido, Claro); final Branco Puro. Nenhum estágio tem efeito mecânico.'],
 ['pend','Cores do núcleo entre Laranja e Prata: sequência não definida no livro.'],
 ['mesa','Amarelo Escuro, Sólido e Claro, entre Laranja e Prata, foram definidos pela mesa. Fichas novas começam em Preto.'],
 ['livro','Fatal não mata sozinho: −3 geral em qualquer ação (sem somar às regionais) e o membro fica inutilizado. Morte imediata: já existir região Fatal e outra região receber ferimento Alto ou pior.'],
 ['livro','Desmembramento: braço ou perna já Fatal que recebe ferimento Intermediário ou superior, sem morte direta, rola 1D4; no 4 é amputado. Leve não rola. Não vale para cabeça e tronco.'],
 ['livro','Agravamento por região: 2 impactos por transição em cabeça e tronco; 3, 3, 2, 2 em braços e pernas. O próprio estado conta como 1.'],
 ['mesa','Ferimentos de graus diferentes (o livro deixa pendente): grau menor fica acumulado na região e, ao juntar a quantidade exigida, forma 1 do grau seguinte; grau maior define o grau e já conta 1, e os do grau anterior vão para o acumulador.'],
 ['livro','Tenacidade Física (Dárnios): reduz em 1 a penalidade final de ferimentos, uma vez (−3 geral vira −2). Não reduz a gravidade nem evita desmembramento; membro Fatal continua inutilizado.'],
 ['pend','Conhecimento Ampliado (Arveni): duas escolhas adicionais de perícia, mas o grau de treinamento delas não foi definido. O app registra as escolhas sem somar bônus.'],
 ['livro','Progressão orgânica: sem níveis nem pontos de experiência. Atributos, perícias, proficiências, núcleo e Cinete evoluem por decisão do mestre; edite a ficha manualmente.'],
 ['livro','Posse de um item não concede proficiência. Armaduras: mecânica suspensa (sem bônus de defesa).'],
 ['pend','Origens: pacotes mecânicos das 17 origens (perícias, arma, habilidade, dinheiro, equipamentos) não publicados. Ajuste perícias manualmente.'],
 ['pend','Gravidade inicial do ferimento e tabelas de armas, margens e proficiências: você informa o grau ao registrar.'],
 ['pend','Tratamento, estabilização, recuperação e descanso; purificação (custos, tempos); exaustão; Estados Bestiais; crítico ofensivo; testes prolongados.'],
 ['livro','Idade: Blackwood aceita ingresso a partir dos 18 anos (não é idade mínima para criar personagem). Não há pontos de vida.']];
/* ===== Estado e persistência ===== */
/* Versão do formato: 2 = ficha única + rede; 3 = campos narrativos (narr) e registro do cálculo de mana (mana0). */
const VER=3,NARR=[['conceito','Conceito do personagem'],['aparencia','Aparência'],['objetivos','Objetivos'],['obs','Observações pessoais']];
/* LS0 = dados do dispositivo anteriores ao login (nunca apagados nem alterados pela autenticação). LS = chave ativa; com sessão, cada conta usa LS0+'.u.'+id (ver src/auth.js). */
const LS0='sodual.v1';let LS=LS0;const DEF=()=>({v:VER,chars:[],net:{pos:{},edges:[],people:[]},set:{col:0,theme:"auto",ac:"#7b4be8",nome:"Viajante",img:""}});
/* ===== Perfil do jogador: cosméticos (sem efeito em regras). Guardado em S.set.perfil, no mesmo armazenamento local da conta.
   arte: caminho da arte definitiva (ex.: 'assets/cosmeticos/molduras/dragao-violeta.png'). Vazio = ainda não fornecida → a interface
   mostra uma prévia PROVISÓRIA identificada como tal. cor: só para a prévia provisória. */
const PF_MOLD=[['dragao-violeta','Dragão Violeta','#8b5cf6',''],['runas-douradas','Runas Douradas','#f0c76a',''],['chamas-arcanas','Chamas Arcanas','#c23fb0',''],['lua-crepusculo','Lua do Crepúsculo','#9fb3ff',''],['floresta-encantada','Floresta Encantada','#3fb98a',''],['cristais-mana','Cristais de Mana','#5ee7ff','']].map(([id,nome,cor,arte])=>({id,nome,cor,arte}));
/* Banners: "Céu Astral" é o banner estrelado já existente; "Dragão Violeta" usa a arte oficial do login. Os outros dois aguardam arte. */
const PF_BAN=[['','Céu Astral','padrao'],['dragao-violeta','Dragão Violeta','dragao-login'],['floresta-encantada','Floresta Encantada',''],['ruinas-antigas','Ruínas Antigas','']].map(([id,nome,arte])=>({id,nome,arte}));
const PF_TIT=['Explorador do Continente','Guardião das Runas','Cronista de Sodual','Veterano de Campanha','Desbravador'];
/* Insígnias: "livre" = escolha cosmética do jogador; as demais dependem de uma regra de obtenção que ainda não existe e ficam bloqueadas. */
const PF_INS=[['explorador','Explorador','compass','livre'],['mestre','Mestre de Campanha','book','livre'],['fundador','Fundador','star','futura'],['veterano','Veterano','shield','futura']].map(([id,nome,ic,tipo])=>({id,nome,ic,tipo}));
const PF_BIO_MAX=160,PF_INS_MAX=3;
/* Texto simples: remove marcação e caracteres de controle; a interface sempre exibe como texto (React escapa). */
function textoSimples(s,max){return String(s==null?'':s).replace(/<[^>]*>/g,'').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g,'').slice(0,max)}
/* Completa o perfil sem apagar nada: valores fora dos catálogos viram "nenhum"; insígnias futuras nunca ficam ativas. */
function normPerfil(p){p=p&&typeof p=='object'?p:{};const ok=(v,l)=>l.some(x=>x.id==v)?v:'';
 return{titulo:PF_TIT.includes(p.titulo)?p.titulo:'',bio:textoSimples(p.bio,PF_BIO_MAX),moldura:ok(p.moldura,PF_MOLD),banner:ok(p.banner,PF_BAN),
  insignias:(Array.isArray(p.insignias)?p.insignias:[]).filter((v,i,a)=>a.indexOf(v)==i&&PF_INS.some(x=>x.id==v&&x.tipo=='livre')).slice(0,PF_INS_MAX)}}
/* Normaliza/migra qualquer objeto de dados (carga inicial e restauração de backup). Nunca descarta dados do usuário sem necessidade. */
function norm(o){const d=Object.assign(DEF(),o&&typeof o=='object'?o:{});d.chars=Array.isArray(d.chars)?d.chars:[];d.net=Object.assign({pos:{},edges:[],people:[]},d.net||{});d.net.pos=d.net.pos||{};d.net.edges=Array.isArray(d.net.edges)?d.net.edges:[];d.net.people=Array.isArray(d.net.people)?d.net.people:[];d.set=Object.assign(DEF().set,d.set||{});d.set.perfil=normPerfil(d.set.perfil);
 if(d.chars.length>1){d.chars.slice(1).forEach(c=>{if(!d.net.people.some(p=>p.id==c.id))d.net.people.push({id:c.id,nome:c.nome,cor:c.cor||"#5ee7ff",img:c.img||""})});d.chars=d.chars.slice(0,1)}
 d.chars.forEach(c=>{c.hist=c.hist||{t:"",html:""};c.bag=c.bag||[];c.magias=c.magias||[];c.habs=c.habs||[];c.sk=c.sk||{};c.money=c.money||[0,0,0];
  /* Ferimentos: completa regiões e campos novos (cnt, cb) sem alterar grau, contador, amputação ou morte já gravados. */
  normFerimentos(c);
  /* v3: só acrescenta campos ausentes. Reserva (manaMax/mana), núcleo e textos existentes nunca são recalculados nem sobrescritos. */
  const n=c.narr&&typeof c.narr=='object'?c.narr:{};c.narr=Object.fromEntries(NARR.map(([k])=>[k,typeof n[k]=='string'?n[k]:'']).concat(Object.entries(n).filter(([k])=>!NARR.some(x=>x[0]==k))));if(c.nucleo==null)c.nucleo='';
  /* Postura: arma pesada só permite Ofensiva (regra aplicada também a fichas antigas); valor desconhecido vira Neutra. */
  if(!POS[c.post])c.post='Neutra';if(c.pesada&&c.post!='Ofensiva')c.post='Ofensiva'});
 /* Rascunho de criação rolado com a quantidade antiga de dados raciais: a rolagem fica guardada em mrAntiga (não é apagada), mas deixa de valer; o jogador rola de novo com a regra atual. */
 const W=d.wiz,M=W&&W.mr;if(M&&PV[M.povo]&&Array.isArray(M.dados)&&M.dados.length!=PV[M.povo].d){W.mrAntiga=M;delete W.mr}
 /* Segurança (backup importado de terceiros): imagens só como data URL de imagem rasterizada (nunca endereço externo, que
    rastrearia quem abre a ficha, nem texto que escape do url() do CSS); cores só hexadecimais (#rgb/#rrggbb). Fora disso: vazio / cor padrão. */
 const imgOk=o=>{if(o&&typeof o=='object')['img','imgSrc'].forEach(k=>{const v=o[k];if(v!=null&&v!==''&&!(typeof v=='string'&&IMG_SEGURA.test(v)))o[k]=''})},
  corOk=(o,k,p)=>{if(o&&typeof o=='object'&&o[k]!=null&&!/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(o[k]))o[k]=p};
 imgOk(d.set);d.chars.forEach(imgOk);d.net.people.forEach(imgOk);corOk(d.set,'ac',DEF().set.ac);d.chars.forEach(c=>corOk(c,'cor','#7a3436'));d.net.people.forEach(p=>corOk(p,'cor','#5ee7ff'));
 ["folders","camp","bes","diario","arsenal"].forEach(k=>delete d[k]);d.v=VER;return d}
const IMG_SEGURA=/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]*={0,2}$/;
let S=DEF();
/* Carrega (e migra, se for de versão anterior) os dados guardados na chave k e passa a salvar nela. Retorna false se a chave não existia. */
function loadS(k){LS=k;let RAW=null;S=norm(DEF());try{RAW=localStorage.getItem(LS);if(RAW){const p=JSON.parse(RAW);const old=(p.v||1)<VER;if(old)try{localStorage.setItem(LS+'.bak',RAW)}catch(e){}S=norm(p);if(old)try{localStorage.setItem(LS,JSON.stringify(S))}catch(e){}}}catch(e){try{localStorage.setItem(LS+'.corrupt',RAW||'')}catch(_){}S=DEF()}return RAW!=null}
loadS(LS0);
/* Migração: ficha única + pessoas da rede independentes */

const UI0=()=>({net:{sel:null,edge:null,link:true,k:1,x:0,y:0,dying:null,newId:null},view:"lore",id:null,tab:'ficha',reg:'cabeca',w:null,step:0,pdf:'',rl:{a:'des',s:'Luta',m:0,reg:'',def:0}});
let ui=UI0();
/* Sem conta aberta (LS vazio) nada é gravado: evita escrever dados de uma conta na chave de outra. */
/* Grava na hora no localStorage (síncrono, como sempre) e só então avisa a sincronização (src/sync.js), que envia em segundo plano. */
function save(){if(!LS)return true;try{localStorage.setItem(LS,JSON.stringify(S));(document.getElementById("st")||{}).textContent='✔ salvo '+new Date().toLocaleTimeString().slice(0,5)}catch(e){toast('Armazenamento do navegador cheio. Exporte um backup e remova imagens grandes.');return false}
 if(typeof syncMarcar=='function')try{syncMarcar()}catch(e){}return true}
const usage=()=>{let n=0;try{n=new Blob([localStorage.getItem(LS)||'']).size}catch(e){}return n}
/* Aviso breve. tp opcional: 'ok' (sucesso), 'warn' (atenção), 'err' (erro), 'crit' (ferimento crítico). Cor + ícone + texto, nunca só animação. */
function toast(t,tp){const e=$('#toast');if(!e)return;e.textContent=t;e.className=tp?'t-'+tp:'';e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',tp=='crit'||tp=='err'?4000:2600)}
const cur=()=>S.chars.find(c=>c.id==ui.id);
/* ===== Lógica de regras ===== */
function roll(a,skill,mod){const sk=(cur()?.sk||{})[skill]||0,n=+a;let d=[];const c=Math.max(n,2);for(let i=0;i<(n>0?n:2);i++)d.push(rnd(20));const k=n>0?Math.max(...d):Math.min(...d);return{d,k,sk,mod:+mod,t:k+sk+ +mod,n}}
/* Penalidade de ferimento: penBase = valor do grau (membro amputado: −3, decisão do app); pen = penalidade FINAL da região, já com a
   Tenacidade Física dos Dárnios (cap. 16 e 20, ed. 0.4: reduz 1 da magnitude uma única vez; derivada do povo, nunca gravada no grau). */
function penBase(c,r){return c.w[r].amp?-3:PEN[c.w[r].g]}
const temTenacidade=c=>!!c&&c.povo=='Dárnios',tenacidade=(c,v)=>temTenacidade(c)&&v<0?v+1:v;
function pen(c,r){return tenacidade(c,penBase(c,r))}
/* Penalidade geral do Fatal (−3 em qualquer ação, sem somar às regionais); com Tenacidade, −2. O membro Fatal continua inutilizado. */
const penGeral=c=>Object.values(c.w||{}).some(x=>x&&x.g==5)?tenacidade(c,-3):0,fmtPen=v=>v<0?'−'+(-v):String(v);
/* Mana atual (ficha, cabeçalho e Modo de Combate usam este mesmo dado e estas mesmas funções, sempre via upd → save → sincronização).
   Ajuste manual: inteiro entre 0 e a mana máxima (sem máxima registrada, só o piso). Nunca mexe em manaMax, mana0 ou no núcleo. */
const manaLim=(c,v)=>{v=Math.trunc(+v)||0;const mx=+c.manaMax||0;return Math.max(0,mx>0?Math.min(mx,v):v)};
function definirMana(c,v){c.mana=manaLim(c,v);return c.mana}
function ajustarMana(c,d){const a=Math.trunc(+c.mana)||0,mx=+c.manaMax||0;
 /* Acima da máxima (registro antigo/correção do mestre): só permite gastar; nunca sobe mais. */
 if(d>0&&mx>0&&a>=mx)return a;c.mana=d<0?Math.max(0,a+d):manaLim(c,a+d);return c.mana}
/* Conhecimento Ampliado (Arveni, ed. 0.4): duas escolhas adicionais de perícia em c.ca (metadado; nenhum bônus em c.sk). */
const CA_MAX=2,temConhecimento=c=>!!c&&c.povo=='Arveni',conhecimento=c=>(Array.isArray(c&&c.ca)?c.ca:[]).slice(0,CA_MAX).map(v=>SK[v]?v:'');
function setConhecimento(c,i,v){if(!temConhecimento(c)||!(i>=0&&i<CA_MAX)||(v!==''&&!SK[v]))return false;const a=conhecimento(c);while(a.length<CA_MAX)a.push('');
 if(v&&a.some((x,j)=>j!=i&&x==v))return false;a[i]=v;c.ca=a;return true}
const fatal=c=>Object.values(c.w).some(x=>x.g==5);
/* ---- Posturas (cap. 19): fonte única para interface, rolagens e carga de fichas ---- */
/* Posturas que podem ser escolhidas agora. Arma pesada de duas mãos: só Ofensiva. */
const posturasPermitidas=c=>c.pesada?['Ofensiva']:Object.keys(POS);
/* Postura efetiva: além da escolha, Alto ou pior em um braço impede a Defensiva (volta à Neutra). */
function post(c){const p=posturasPermitidas(c).includes(c.post)?c.post:'Ofensiva';if(p=='Defensiva'&&(c.w.bd.g>=3||c.w.be.g>=3))return'Neutra';return p}
function setPostura(c,p){if(!posturasPermitidas(c).includes(p))return false;c.post=p;return true}
/* Marcar arma pesada troca para Ofensiva; desmarcar não restaura a postura anterior. */
function setPesada(c,on){c.pesada=!!on;if(c.pesada)c.post='Ofensiva'}
const atkPostura=c=>ATK_POS[post(c)]||0;
/* Modificador de ataque = perícia + bônus da postura (não altera atributos). */
const atkMod=(c,skill)=>((c.sk||{})[skill]||0)+atkPostura(c);
/* Contador do próximo grau de uma região: {h,n} ou null quando não há progressão (Saudável ou Fatal). */
const progresso=(c,r)=>{const w=c.w[r];return w.g>0&&w.g<5?{h:w.h,n:NEED[w.g][RG[r][1]]}:null};
/* ===== Ferimentos, Fatal, morte e desmembramento — fonte única para interface, testes e carga de fichas =====
   Região c.w[r]: g grau (0 Saudável … 5 Fatal), h ferimentos equivalentes rumo ao próximo grau, amp 0 Íntegro / 1 Amputado (só membros),
   cnt[g] ferimentos recebidos de cada grau, ac[g] ferimentos de grau menor que o estado ainda acumulados (não convertidos), log textos da região. Ficha: dead, morte {em,reg,g} e cb (histórico de combate, mais recente primeiro). */
/* Declarações de função (içadas): norm() as usa já na carga inicial, antes desta linha ser executada. */
function ehMembro(r){return!!(RG[r]&&RG[r][1])}
function int0(v){return Math.max(0,Math.trunc(+v)||0)}
const membro=(c,r)=>ehMembro(r)?(c.w[r].amp?'Amputado':'Íntegro'):null,CB_MAX=200;
/* Completa/saneia uma região sem apagar dados: grau 0..5, contadores inteiros e não negativos, amputação só em braço/perna. */
function normReg(w,r){w=w&&typeof w=='object'?w:{};w.g=Math.min(5,int0(w.g));w.h=int0(w.h);if(w.g>0&&w.g<5)w.h=Math.min(w.h,NEED[w.g][RG[r][1]]-1);
 w.amp=ehMembro(r)&&+w.amp?1:0;w.log=Array.isArray(w.log)?w.log:[];const n=Array.isArray(w.cnt)?w.cnt:[];w.cnt=GN.map((_,i)=>int0(n[i]));
 /* ac[k]: ferimentos de grau k, menor que o estado, ainda não convertidos. Fichas antigas começam com 0 (nada é reconstruído). */
 const q=Array.isArray(w.ac)?w.ac:[];w.ac=GN.map((_,i)=>int0(q[i]));return w}
function normFerimentos(c){c.w=c.w&&typeof c.w=='object'?c.w:{};Object.keys(RG).forEach(r=>c.w[r]=normReg(c.w[r],r));c.dead=!!c.dead;c.cb=Array.isArray(c.cb)?c.cb:[];return c}
/* Morte imediata, avaliada com o estado ANTERIOR ao ferimento: outra região já Fatal + ferimento Alto (3) ou pior nesta região. */
const avaliarMorte=(c,r,g)=>g>=3&&Object.keys(RG).some(k=>k!=r&&c.w[k].g==5);
/* Teste de desmembramento (cap. 20, ed. 0.4): braço/perna já Fatal, ainda íntegro, recebendo ferimento Intermediário (2) ou superior,
   desde que esse ferimento não cause morte direta (a morte tem prioridade). Leve não rola. Cabeça e tronco nunca. */
const testaDesmembramento=(c,r,g)=>ehMembro(r)&&c.w[r].g==5&&!c.w[r].amp&&g>=2&&!avaliarMorte(c,r,g);
/* Progressão pura de uma região (não altera w; devolve o novo estado).
   - Mesmo grau do estado: soma em h (o estado conta como 1); ao atingir NEED, sobe um grau e o novo estado começa em 1.
   - Grau menor: fica no acumulador ac[grau]. Ao atingir NEED daquele grau, as ocorrências são consumidas (cada uma usada uma só vez)
     e formam 1 ocorrência do grau seguinte, que segue a mesma regra (conversões sucessivas).
   - Grau maior: define o grau e já conta 1; as ocorrências do grau anterior (h) não são descartadas: vão para ac (confirmado pela mesa).
   - Fatal é o limite: em região Fatal os ferimentos são acumulados, mas nenhuma conversão forma um novo Fatal. A gravidade nunca diminui.
   Devolve {g,h,ac,ef,conv,subiu}: conv lista os graus convertidos (ex.: [1] = Leves formaram um Intermediário). */
function progredir(w,r,g){const l=RG[r][1],ac=GN.map((_,i)=>int0((w.ac||[])[i])),g0=w.g,conv=[];let G=w.g,H=w.h,subiu=false;
 const un=k=>{if(k>G){if(G>0&&G<5)ac[G]+=H;G=k;H=k<5?1:0;return}
  if(k==G){if(G<5&&++H>=NEED[G][l]){G++;H=G<5?1:0;subiu=true}return}
  ac[k]++;if(!(G==5&&k+1==5)&&ac[k]>=NEED[k][l]){ac[k]-=NEED[k][l];conv.push(k);un(k+1)}};
 un(g);const ef=g>g0?'grau':g==g0?(g0==5?'fatal':subiu?'agravou':'impacto'):subiu?'agravou':conv.length?'convertido':'inferior';
 return{g:G,h:H,ac,ef,conv,subiu}}
const hora=t=>new Date(t).toLocaleTimeString().slice(0,5);
/* Texto de um evento do histórico (região e ficha). */
function descreverEvento(ev){const r=ev.reg,nm=RG[r]?RG[r][0]:r,a=ev.antes||{},d=ev.depois||{};if(ev.tipo&&ev.tipo!='ferimento')return ev.txt||'';
 const l=RG[r]?RG[r][1]:0,n=d.g>0&&d.g<5?NEED[d.g][l]:0,p=[nm+': ferimento '+GN[ev.g]],rumo=n?GN[d.g]+' — '+d.h+'/'+n+' rumo a '+GN[d.g+1]:GN[d.g];
 /* Conversões de ferimentos acumulados (ex.: "2 Leves formaram 1 Intermediário"). */
 (ev.conv||[]).forEach(k=>p.push(NEED[k][l]+' '+GN[k]+(NEED[k][l]>1?'s':'')+' formaram 1 '+GN[k+1]));
 const acum=()=>{const v=d.ac&&d.ac[ev.g];return v?'acumulado ('+v+'/'+NEED[ev.g][l]+' para formar 1 '+GN[ev.g+1]+')':''};
 p.push({grau:GN[a.g]+' → '+GN[d.g]+(n?' ('+d.h+'/'+n+' rumo a '+GN[d.g+1]+')':'')+(a.g>0&&a.g<5&&a.h?' · '+a.h+' '+GN[a.g]+' anterior(es) mantido(s) no acumulador':''),impacto:rumo,agravou:'agravou de '+GN[a.g]+' para '+GN[d.g],
  convertido:rumo,inferior:(d.g==5?'região já Fatal (limite)':'menor que o estado atual ('+GN[d.g]+')')+(acum()?', '+acum():''),fatal:'região já Fatal (limite)'}[ev.ef]);
 if(a.g<5&&d.g==5)p.push('condição crítica (Fatal) — continua vivo');if(ev.d4!=null)p.push('Teste de desmembramento: 1D4 → '+ev.d4+(ev.amp?' — '+nm+' amputado!':' — sem amputação'));
 if(ev.morte)p.push('MORTE IMEDIATA (outra região já estava Fatal)');return p.join(' · ')}
function registrar(c,ev){ev.t=ev.t||new Date().toISOString();const w=c.w[ev.reg];if(w)w.log.unshift(hora(ev.t)+' — '+descreverEvento(ev).replace(/^[^:]+: /,''));c.cb.unshift(ev);if(c.cb.length>CB_MAX)c.cb.length=CB_MAX;return ev}
/* Registra um ferimento de grau g (1 Leve … 5 Fatal) na região r. d4: rolador opcional (testes); padrão aleatório no momento do impacto.
   Devolve o evento {reg,g,antes,depois,ef,d4,amp,morte} ou null se a entrada for inválida. */
function wound(c,r,g,d4){g=Math.trunc(+g);if(!RG[r]||!(g>=1&&g<=5))return null;normFerimentos(c);
 const w=c.w[r],antes={g:w.g,h:w.h,amp:w.amp},morte=!c.dead&&avaliarMorte(c,r,g),teste=testaDesmembramento(c,r,g),p=progredir(w,r,g);
 antes.ac=w.ac.slice();w.g=p.g;w.h=p.h;w.ac=p.ac;w.cnt[g]++;let x=null;if(teste){x=Math.min(4,Math.max(1,Math.trunc((d4||(()=>rnd(4)))())||1));if(x==4)w.amp=1}
 const ev={tipo:'ferimento',reg:r,g,antes,depois:{g:w.g,h:w.h,amp:w.amp,ac:w.ac.slice()},ef:p.ef,conv:p.conv,d4:x,amp:x==4,morte};
 if(morte){c.dead=true;c.morte={em:new Date().toISOString(),reg:r,g}}return registrar(c,ev)}
/* Ajustes manuais (correções do jogador/mestre). Nenhum deles desfaz amputação nem morte: essas têm ações próprias, com confirmação na interface. */
function ajusteRegiao(c,r,acao,v){normFerimentos(c);const w=c.w[r],a={g:w.g,h:w.h,amp:w.amp},M=t=>registrar(c,{tipo:'ajuste',reg:r,antes:a,depois:{g:w.g,h:w.h,amp:w.amp},txt:RG[r][0]+': '+t});
 if(acao=='impacto'){if(w.h>0){w.h--;return M('−1 ferimento no contador (ajuste manual)')}return null}
 if(acao=='grau'){if(w.g>0){w.g--;w.h=0;return M('grau reduzido para '+GN[w.g]+' (ajuste manual)')}return null}
 if(acao=='curar'){w.g=0;w.h=0;w.ac=GN.map(()=>0);return M('região curada (ajuste manual)'+(w.amp?' — o membro continua amputado':''))}
 if(acao=='definir'){const g=Math.trunc(+v);if(!(g>=0&&g<=5))return null;w.g=g;w.h=0;return M('grau definido: '+GN[g]+' (ajuste manual)')}
 if(acao=='amputar'){if(!ehMembro(r)||w.amp)return null;w.amp=1;return M('amputação registrada manualmente')}
 if(acao=='desamputar'){if(!w.amp)return null;w.amp=0;return M('amputação desfeita (correção de registro)')}return null}
function desfazerMorte(c){normFerimentos(c);if(!c.dead)return null;c.dead=false;delete c.morte;return registrar(c,{tipo:'ajuste',reg:'',txt:'Morte desfeita (correção de registro)'})}
/* ===== Criação de personagem: ver src/creation.js (regras, cálculo de mana e validação global) ===== */
