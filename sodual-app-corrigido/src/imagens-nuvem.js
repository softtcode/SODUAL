/* ===== Imagens na nuvem — Entrega 5 (Supabase Storage PRIVADO, bucket "sodual-images") =====
   Trabalha em segundo plano, uma tarefa por vez, só quando a sincronização do JSON está ativa (salvo/pendente/salvando);
   nunca envia nada enquanto a conta aguarda decisão (migrar/adiado/conflito).

   Envio (imagem local em base64 ainda sem referência válida):
     1. valida formato (JPEG/PNG/WebP em data URL) e tamanho (≤ 1 MB, limite do bucket);
     2. nome do arquivo = SHA-256 do conteúdo (seguro e único):  <uid>/profile/avatar/<sha>.jpg · <uid>/characters/<id>/<sha>.jpg · <uid>/network/<id>/<sha>.jpg
     3. envia sem sobrescrever (upsert:false; "já existe" = mesmo conteúdo, conta como enviado);
     4. só depois da confirmação grava a referência {p,h} no espaço, se a imagem local ainda for a mesma (recorte e original preservados);
     5. save() → o JSON da nuvem passa a levar a referência no lugar do base64 (syncCargaStr em src/sync.js).
   Falha: a imagem local fica intacta, o base64 continua indo no JSON, a tarefa fica pendente e é tentada de novo (backoff) ou por
   "Tentar novamente" em Configurações › Sincronização.

   Recebimento (referência sem imagem local, p.ex. em outro dispositivo): pede uma URL ASSINADA (validade IMGN_CFG.validade, só em
   memória, renovada ao expirar), baixa, confere a impressão e guarda o base64 só neste dispositivo (sem marcar alteração).

   Backup portátil: imgExportavel() devolve uma cópia com todas as imagens em base64 e SEM referências privadas. */
const IMGN_CFG={bucket:'sodual-images',validade:3600,maxBytes:1048576,espera:1500,backoff:[5000,15000,30000,60000,120000],maxTent:6};
const IMGN={tok:-1,timer:null,prox:0,rodando:false,tent:0,erro:'',ignorar:new Set(),urls:new Map()};
const IMGN_OK=['salvo','pendente','salvando'],IMGN_EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const IMGN_RE=/^data:(image\/(?:jpeg|png|webp));base64,/;

/* Estado por sessão: troca de conta (SY.tok) zera tudo e cancela o que estava agendado. */
function imgnSessao(){if(IMGN.tok===SY.tok)return;clearTimeout(IMGN.timer);Object.assign(IMGN,{tok:SY.tok,timer:null,prox:0,rodando:false,tent:0,erro:'',ignorar:new Set(),urls:new Map()})}
function imgnBlob(d){const m=IMGN_RE.exec(d||'');if(!m)return null;let bin;try{bin=atob(d.slice(m[0].length))}catch(e){return null}
 const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:m[1]})}
async function imgnDataUrl(blob){const b=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));
 return'data:'+(String(blob.type||'image/jpeg').split(';')[0])+';base64,'+btoa(s)}
async function imgnSha(blob){const d=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,'0')).join('').slice(0,40)}
const imgnSeg=id=>String(id==null?'':id).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,64)||'x';
const imgnPasta=(s,uid)=>uid+'/'+(s.area=='profile'?'profile/avatar':s.area+'/'+imgnSeg(s.id));
const imgnJaExiste=e=>String(e&&(e.statusCode||e.status))=='409'||/already exists|duplicate/i.test(String(e&&e.message||''));
const imgnAinda=s=>imgSlots(S).some(x=>x.o===s.o&&x.c===s.c);

/* O que falta fazer agora (puro, barato graças ao cache de impressões). */
function imgnTarefas(){const up=[],down=[];if(!SY.user)return{up,down};
 imgSlots(S).forEach(s=>{const v=s.o[s.c],r=s.o[s.c+'Ref'];
  if(v&&typeof v=='string'){const h=syncHashC(v);if(IMGN_RE.test(v)&&!(imgRefOk(r)&&r.h===h)&&!IMGN.ignorar.has(h))up.push(s)}
  else if(imgRefOk(r)&&!IMGN.ignorar.has('d:'+r.p))down.push(s)});return{up,down}}
function imgnStatus(){imgnSessao();const t=imgnTarefas();return{ativo:!!SY.user,enviar:t.up.length,baixar:t.down.length,erro:IMGN.erro,rodando:IMGN.rodando,
 ignoradas:[...IMGN.ignorar].length,espera:IMGN.prox===Infinity?'parado':IMGN.prox>Date.now()?'aguardando':''}}

async function imgnUrl(p,cli,novo){const c=IMGN.urls.get(p);if(!novo&&c&&c.exp-60000>Date.now())return c.u;
 const{data,error}=await cli.storage.from(IMGN_CFG.bucket).createSignedUrl(p,IMGN_CFG.validade);if(error)throw error;
 if(!data||!data.signedUrl)throw Object.assign(new Error('URL assinada ausente'),{code:'resp'});
 IMGN.urls.set(p,{u:data.signedUrl,exp:Date.now()+IMGN_CFG.validade*1000});return data.signedUrl}
/* Baixa por URL assinada (renova uma vez se expirou) e confere a impressão. Devolve o data URL ou lança erro. */
async function imgnBuscar(r,cli){let resp;for(let i=0;i<2;i++){const u=await imgnUrl(r.p,cli,i>0);resp=await fetch(u);if(resp.ok||(resp.status!=400&&resp.status!=401&&resp.status!=403))break}
 if(!resp.ok)throw Object.assign(new Error('Download da imagem falhou ('+resp.status+')'),{status:resp.status});
 const d=await imgnDataUrl(await resp.blob());if(syncHashC(d)!==r.h)throw Object.assign(new Error('Imagem da nuvem não confere'),{code:'hash'});return d}

async function imgnEnviar(s,uid,cli,tok){const v=s.o[s.c],h=syncHashC(v),blob=imgnBlob(v);
 if(!blob||blob.size>IMGN_CFG.maxBytes){IMGN.ignorar.add(h);return false}                 // fica só local (e no JSON): nunca vira referência
 const p=imgnPasta(s,uid)+'/'+(await imgnSha(blob))+'.'+IMGN_EXT[blob.type];
 const{error}=await cli.storage.from(IMGN_CFG.bucket).upload(p,blob,{contentType:blob.type,upsert:false,cacheControl:'31536000'});
 if(tok!==SY.tok)return false;if(error&&!imgnJaExiste(error))throw error;
 if(!imgnAinda(s)||s.o[s.c]!==v)return false;                                              // mudou durante o envio: a nova imagem entra na próxima rodada
 s.o[s.c+'Ref']={p,h};save();return true}
async function imgnBaixar(s,cli,tok){const r=s.o[s.c+'Ref'];let d;
 try{d=await imgnBuscar(r,cli)}catch(e){if(e&&(e.status==404||e.code=='hash'||/not found|object not found/i.test(String(e.message)))){IMGN.ignorar.add('d:'+r.p);return false}throw e}
 if(tok!==SY.tok||!imgnAinda(s)||s.o[s.c]||s.o[s.c+'Ref']!==r)return false;
 s.o[s.c]=d;try{localStorage.setItem(LS,JSON.stringify(S))}catch(e){}                      // cache local; não é alteração do jogador
 return true}

/* Erros do Storage (storage-js não usa os códigos do PostgREST). */
function imgnTipo(e){const m=String(e&&e.message||''),s=+(e&&(e.status||e.statusCode))||0;
 if(/bucket not found/i.test(m))return'servidor';
 if(/jwt|token.*expired|invalid.*token/i.test(m)||s==401)return'auth';
 if(/row-level security|row level security|not authorized|unauthorized|permission/i.test(m)||s==403)return'negado';
 if(e&&(e.name=='StorageUnknownError'||e.name=='TypeError')||/failed to fetch|network|load failed|timeout/i.test(m)||s>=500)return'rede';
 return'erro'}
async function imgnRodar(){imgnSessao();if(IMGN.rodando||!SY.user||!SY.cli||!IMGN_OK.includes(SY.estado))return;
 const t=imgnTarefas();if(!t.up.length&&!t.down.length){if(IMGN.erro){IMGN.erro='';syncDefinir(SY.estado,SY.erro)}return}
 const tok=SY.tok,uid=SY.user.id,cli=SY.cli;
 if(!cli.storage||typeof crypto=='undefined'||!crypto.subtle){IMGN.erro='Este navegador não permite enviar imagens à nuvem (é preciso HTTPS).';IMGN.prox=Infinity;syncDefinir(SY.estado,SY.erro);return}
 IMGN.rodando=true;let falha=null,mudou=false;
 try{for(const s of t.up){if(tok!==SY.tok)return;try{if(await imgnEnviar(s,uid,cli,tok))mudou=true}catch(e){falha=e;break}}
  if(!falha)for(const s of t.down){if(tok!==SY.tok)return;try{if(await imgnBaixar(s,cli,tok))mudou=true}catch(e){falha=e;break}}}
 finally{if(tok===SY.tok){IMGN.rodando=false;
  if(falha){const k=imgnTipo(falha);IMGN.tent++;
   IMGN.erro=k=='rede'?'Sem conexão: as imagens ficam neste dispositivo e serão enviadas depois.':k=='auth'?'Sessão expirada: entre de novo para enviar as imagens.':
    k=='servidor'?'O armazenamento de imagens ainda não está configurado (migração 002).':k=='negado'?'A nuvem recusou a imagem (permissões do Storage; confira a migração 002).':
    'Falha ao sincronizar imagens: '+String(falha.message||falha).slice(0,120);
   if(k!='servidor'&&k!='negado'&&IMGN.tent<=IMGN_CFG.maxTent){const ms=IMGN_CFG.backoff[Math.min(IMGN.tent-1,IMGN_CFG.backoff.length-1)];IMGN.prox=Date.now()+ms;clearTimeout(IMGN.timer);
    IMGN.timer=setTimeout(()=>{IMGN.timer=null;IMGN.prox=0;if(tok===SY.tok)imgnRodar()},ms)}else IMGN.prox=Infinity}
  else{IMGN.tent=0;IMGN.erro=''}
  if(mudou&&typeof R=='function')try{R()}catch(e){}
  syncDefinir(SY.estado,SY.erro)}}}

/* Agenda uma rodada (chamado a cada mudança de estado da sincronização). Respeita o backoff e nunca roda duas ao mesmo tempo. */
function imgnAgendar(ms){imgnSessao();if(!SY.user||!SY.cli||!IMGN_OK.includes(SY.estado)||IMGN.rodando||IMGN.timer||IMGN.prox)return;
 const t=imgnTarefas();if(!t.up.length&&!t.down.length)return;const tok=SY.tok;
 IMGN.timer=setTimeout(()=>{IMGN.timer=null;if(tok===SY.tok)imgnRodar()},ms==null?IMGN_CFG.espera:ms)}
/* "Tentar novamente": zera o backoff e as imagens marcadas como problemáticas nesta sessão. */
function imgnAgora(){imgnSessao();clearTimeout(IMGN.timer);Object.assign(IMGN,{timer:null,prox:0,tent:0,erro:'',ignorar:new Set()});return imgnRodar()}

/* Backup portátil: cópia de d com todas as imagens em base64 (do cache local ou baixadas agora) e sem referências privadas. */
async function imgExportavel(d){const c=JSON.parse(JSON.stringify(d||{})),m=new Map();let faltando=0;
 imgSlots(S).forEach(({o,c:k})=>{const v=o[k];if(v&&typeof v=='string')m.set(syncHashC(v),v)});
 for(const{o,c:k}of imgSlots(c)){const rk=k+'Ref',r=o[rk];if(r===undefined)continue;
  if(!o[k]&&r&&typeof r=='object'){if(m.has(r.h))o[k]=m.get(r.h);
   else if(imgRefOk(r)&&SY.cli&&SY.cli.storage){try{o[k]=await imgnBuscar(r,SY.cli)}catch(e){faltando++}}else faltando++}
  delete o[rk]}
 return{dados:c,faltando}}

if(typeof syncOuvir=='function')syncOuvir(()=>imgnAgendar());
if(typeof window!='undefined'&&window.addEventListener)window.addEventListener('online',()=>{if(SY.user&&IMGN.erro)imgnAgora()});
