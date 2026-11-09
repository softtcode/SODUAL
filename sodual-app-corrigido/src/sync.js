/* ===== Sincronização na nuvem — Entrega 2 (dados JSON) =====
   Local-first: save() continua gravando NA HORA no localStorage e só "avisa" este módulo (syncMarcar). O envio à nuvem é
   assíncrono, com debounce, uma requisição por vez, snapshot imutável e controle de revisão no servidor (RPC sodual_sync_put).

   Garantias:
   • Nada é enviado antes de conhecer o estado da nuvem (decisão inicial). DEF() vazio nunca vai para a nuvem.
   • Sem sobrescrita silenciosa: se a nuvem mudou desde a última sincronização deste dispositivo e há mudanças locais,
     o módulo PARA em "conflito" e não grava nada (a resolução com escolha do jogador é a Entrega 3).
   • Dados locais de uma conta nunca vão para outra: cada sessão tem um número de geração (SY.tok); respostas atrasadas de
     uma sessão anterior são descartadas.
   • Offline: as mudanças ficam no localStorage e marcadas como pendentes; novas tentativas com backoff exponencial e limite.
     Erros de autenticação não são tratados como falha de rede.

   Metadados por conta (localStorage, chave LS+'.sync'): { rev: última revisão confirmada pela nuvem, hash: impressão do estado
   que corresponde a essa revisão, at: data da última sincronização confirmada }. Pendente = impressão do estado atual ≠ hash.
   O payload é o objeto S inteiro (fichas, rede, perfil, configurações, rascunho), que NÃO contém credenciais. */
const SYNC_CFG={debounce:1200,backoff:[2000,4000,8000,16000,32000,60000],maxTentativas:8,limite:3.9*1024*1024,esperaInicial:8000};
const SY={tok:0,user:null,cli:null,meta:null,estado:'desligado',erro:'',timer:null,voando:false,tent:0,ouvintes:new Set(),conflito:null,inicial:null};
/* Estados: desligado · iniciando · salvo · pendente · salvando · offline · vazio (nada na nuvem ainda) · migrar (dados locais,
   nuvem vazia: aguarda o jogador) · adiado (o jogador preferiu não enviar agora) · conflito · auth · grande · erro. */

/* JSON com chaves ordenadas: o mesmo conteúdo sempre gera a mesma string (o Postgres devolve jsonb com outra ordem). */
function syncStr(v){return JSON.stringify(v,function(k,x){return x&&typeof x=='object'&&!Array.isArray(x)?Object.keys(x).sort().reduce((o,c)=>(o[c]=x[c],o),{}):x})}
/* Impressão FNV-1a 32 bits + tamanho (detecta mudança; não é segurança). */
function syncHash(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(16)+':'+s.length}
/* Há algo que valha guardar? (uma conta nova só com o nome padrão não conta) */
function temConteudo(d){if(!d||typeof d!='object')return false;const n=d.net||{},st=d.set||{},p=st.perfil||{};
 return!!((d.chars||[]).length||(n.people||[]).length||(n.edges||[]).length||d.wiz||st.img||p.titulo||p.bio||p.moldura||p.banner||(p.insignias||[]).length)}
const syncMetaKey=()=>LS+'.sync';
function syncLerMeta(){try{const m=JSON.parse(localStorage.getItem(syncMetaKey())||'null');if(m&&typeof m=='object')return{rev:Math.max(0,+m.rev||0),hash:String(m.hash||''),at:m.at||null,mod:m.mod||null}}catch(e){}return{rev:0,hash:'',at:null,mod:null}}
function syncGravarMeta(){try{localStorage.setItem(syncMetaKey(),JSON.stringify(SY.meta))}catch(e){}}
/* Rótulo legível do dispositivo (informativo, mostrado em conflitos). */
function syncDispositivo(){const u=(typeof navigator!='undefined'&&navigator.userAgent)||'',b=/Edg\//.test(u)?'Edge':/OPR\//.test(u)?'Opera':/Firefox\//.test(u)?'Firefox':/Chrome\//.test(u)?'Chrome':/Safari\//.test(u)?'Safari':'Navegador',
 o=/Android/.test(u)?'Android':/iPhone|iPad|iPod/.test(u)?'iOS':/Windows/.test(u)?'Windows':/Mac OS X/.test(u)?'macOS':/Linux/.test(u)?'Linux':'';return(b+(o?' · '+o:'')).slice(0,80)}

function syncDefinir(estado,erro){SY.estado=estado;SY.erro=erro||'';SY.ouvintes.forEach(f=>{try{f()}catch(e){}})}
function syncStatus(){let pend=false;try{pend=!!(SY.user&&SY.meta&&syncHash(syncStr(S))!==SY.meta.hash)}catch(e){}
 return{estado:SY.estado,erro:SY.erro,at:SY.meta&&SY.meta.at,rev:SY.meta?SY.meta.rev:0,pendente:pend,conflito:SY.conflito,ativo:!!SY.user}}
function syncOuvir(f){SY.ouvintes.add(f);return()=>SY.ouvintes.delete(f)}

/* Classifica erros do supabase-js / PostgREST. */
function syncTipoErro(e){const c=String(e&&e.code||''),s=+(e&&e.status)||0,m=String(e&&e.message||'').toLowerCase();
 if(c=='28000'||c=='42501'||c=='PGRST301'||c=='PGRST302'||s==401||s==403||/jwt|not authenticated|não autenticado/.test(m))return'auth';
 if(c=='22023'||c=='54000')return'invalido';
 if(c=='42883'||c=='42P01'||c=='PGRST202'||c=='PGRST205')return'servidor'; // migração ausente no projeto
 if(e&&e.name=='AuthRetryableFetchError'||s==0||/failed to fetch|network|load failed|timeout|fetch/.test(m)||c=='')return'rede';
 return'erro'}

/* Decisão inicial (pura, testada): compara o estado local, os metadados deste dispositivo e o registro remoto. */
function syncDecidir({remoto,meta,localStr}){const lh=syncHash(localStr),tem=temConteudo(JSON.parse(localStr)),mudou=lh!==meta.hash;
 if(!remoto)return meta.rev>0?'remoto-apagado':tem?'migrar':'vazio';
 const rh=syncHash(syncStr(remoto.data)),rv=+remoto.revision;
 if(rh===lh)return'igual';
 if(meta.rev===rv)return mudou?'enviar':'conflito';                   // nuvem igual à última sincronia: só o local mudou
 if(meta.rev<rv){if(!tem&&!mudou||!tem&&meta.rev===0)return'adotar';   // dispositivo vazio: traz da nuvem
  if(meta.rev>0&&!mudou)return'adotar';                                 // só a nuvem mudou: avança
  return'conflito'}
 return'conflito'}                                                      // meta à frente da nuvem: algo estranho, não arriscar

async function syncBuscar(cols){const{data,error}=await SY.cli.from('sodual_user_data').select(cols||'data,revision,schema_version,updated_at,updated_by_device').maybeSingle();if(error)throw error;return data}

/* Substitui o estado local pelo da nuvem (guarda antes uma cópia do local, se havia conteúdo). Não marca pendência. */
function syncAdotar(rem){try{if(temConteudo(S))localStorage.setItem(LS+'.antes-nuvem',JSON.stringify({salvo:new Date().toISOString(),dados:S}))}catch(e){}
 S=norm(JSON.parse(JSON.stringify(rem.data)));try{localStorage.setItem(LS,JSON.stringify(S))}catch(e){}
 if(typeof ui!='undefined'&&ui){ui.w=null}
 SY.meta=Object.assign({},SY.meta,{rev:+rem.revision,hash:syncHash(syncStr(S)),at:rem.updated_at||null});syncGravarMeta();
 if(typeof applySet=='function')try{applySet()}catch(e){}if(typeof R=='function')try{R()}catch(e){}}

/* Início da sessão de sincronização para a conta já carregada do localStorage (openAccount). Devolve a promessa da decisão inicial. */
function syncIniciar(user,o){o=o||{};syncEncerrar();const tok=++SY.tok;Object.assign(SY,{user,cli:o.cliente,meta:syncLerMeta(),voando:false,tent:0,conflito:null,timer:null});
 if(!SY.cli){syncDefinir('desligado','Cliente da nuvem indisponível');return Promise.resolve('sem-cliente')}
 syncDefinir('iniciando');
 SY.inicial=(async()=>{let rem;try{rem=await syncBuscar()}catch(e){if(tok!==SY.tok)return'descartado';syncFalha(e,true);return'falha'}
  if(tok!==SY.tok)return'descartado';
  /* Compara com a versão da nuvem já normalizada (numa cópia): o mesmo conteúdo salvo por uma versão anterior do app
     não pode parecer "diferente" só porque norm() acrescenta campos novos. */
  let remN=null;if(rem){try{remN=Object.assign({},rem,{data:norm(JSON.parse(JSON.stringify(rem.data)))})}catch(e){remN=rem}}
  const d=syncDecidir({remoto:remN,meta:SY.meta,localStr:syncStr(S)});
  if(d=='igual'){SY.meta=Object.assign({},SY.meta,{rev:+rem.revision,hash:syncHash(syncStr(S)),at:rem.updated_at||SY.meta.at});syncGravarMeta();syncDefinir('salvo')}
  else if(d=='adotar'){syncAdotar(rem);syncDefinir('salvo')}
  else if(d=='enviar'){syncDefinir('pendente');syncEnviar()}
  else if(d=='vazio')syncDefinir('vazio');
  else if(d=='migrar')syncDefinir('migrar');
  else{SY.conflito={tipo:d,remoto:rem?{revision:+rem.revision,updated_at:rem.updated_at,updated_by_device:rem.updated_by_device}:null};syncDefinir('conflito')}
  return d})();
 return SY.inicial}

/* Chamado por save() depois de gravar no localStorage. Nunca bloqueia nem lança erro. */
/* mod: data da última gravação local nesta sessão (mostrada em conflitos; dados antigos não têm e a interface diz isso). */
function syncMarcar(){if(!SY.user||!SY.cli)return;if(SY.meta){SY.meta.mod=new Date().toISOString();syncGravarMeta()}const e=SY.estado;
 if(e=='iniciando'||e=='migrar'||e=='adiado'||e=='conflito'||e=='grande'||e=='desligado')return syncDefinir(e,SY.erro); // continua local; nada é enviado
 if(e=='offline'||e=='auth'||e=='erro')return syncDefinir(e,SY.erro);  // sem requisição a cada edição: espera backoff, conexão ou "Sincronizar agora"
 if(e=='vazio'&&!temConteudo(S))return;
 if(e!='salvando')syncDefinir('pendente');syncAgendar(SYNC_CFG.debounce)}
function syncAgendar(ms){clearTimeout(SY.timer);const tok=SY.tok;SY.timer=setTimeout(()=>{if(tok===SY.tok)syncEnviar()},ms)}

/* Envia o snapshot atual (uma requisição por vez). Mudanças feitas durante o envio geram um novo envio depois. */
async function syncEnviar(){if(!SY.user||!SY.cli||SY.voando)return;clearTimeout(SY.timer);
 const e=SY.estado;if(e=='iniciando'||e=='migrar'||e=='adiado'||e=='conflito'||e=='grande'||e=='desligado')return;
 const tok=SY.tok,str=syncStr(S),h=syncHash(str);
 if(h===SY.meta.hash){syncDefinir('salvo');return}
 if(SY.meta.rev===0&&!temConteudo(S)){syncDefinir('vazio');return}            // nunca cria um registro vazio
 if(str.length>SYNC_CFG.limite){syncDefinir('grande','Os dados (principalmente imagens) passam do limite da nuvem.');return}
 SY.voando=true;syncDefinir('salvando');
 try{const{data,error}=await SY.cli.rpc('sodual_sync_put',{p_data:JSON.parse(str),p_expected_revision:SY.meta.rev,p_schema_version:VER,p_device:syncDispositivo()});
  if(tok!==SY.tok)return;if(error)throw error;
  if(data&&data.ok){SY.meta=Object.assign({},SY.meta,{rev:+data.revision,hash:h,at:data.updated_at||new Date().toISOString()});syncGravarMeta();SY.tent=0;
   if(syncHash(syncStr(S))!==h){syncDefinir('pendente');syncAgendar(SYNC_CFG.debounce)}else syncDefinir('salvo')}
  else if(data&&data.conflict){let rem=null;try{rem=await syncBuscar()}catch(x){}if(tok!==SY.tok)return;
   if(rem&&syncHash(syncStr(rem.data))===h){SY.meta=Object.assign({},SY.meta,{rev:+rem.revision,hash:h,at:rem.updated_at});syncGravarMeta();syncDefinir('salvo')} // outra aba já gravou o mesmo
   else{SY.conflito={tipo:rem?'conflito':'remoto-apagado',remoto:rem?{revision:+rem.revision,updated_at:rem.updated_at,updated_by_device:rem.updated_by_device}:null};syncDefinir('conflito')}}
  else throw Object.assign(new Error('Resposta inesperada da nuvem'),{code:'resp'})}
 catch(err){if(tok===SY.tok)syncFalha(err)}
 finally{if(tok===SY.tok)SY.voando=false}}

function syncFalha(e,inicial){const t=syncTipoErro(e);
 if(t=='rede'){SY.tent++;syncDefinir('offline','Sem conexão com a nuvem. As alterações ficam salvas neste dispositivo.');
  if(SY.tent<=SYNC_CFG.maxTentativas){const tok=SY.tok,ms=SYNC_CFG.backoff[Math.min(SY.tent-1,SYNC_CFG.backoff.length-1)];clearTimeout(SY.timer);SY.timer=setTimeout(()=>{if(tok===SY.tok)inicial?syncReiniciar():syncEnviar()},ms)}}
 else if(t=='auth')syncDefinir('auth','A sessão precisa ser renovada para sincronizar.');
 else if(t=='invalido')syncDefinir('erro','A nuvem recusou os dados (formato ou tamanho).');
 else if(t=='servidor')syncDefinir('erro','A nuvem ainda não está configurada neste projeto (migração 001).');
 else syncDefinir('erro',String(e&&e.message||'Falha na sincronização'))}

/* Repete a decisão inicial (após falha de rede no início ou volta da conexão). */
function syncReiniciar(){if(!SY.user)return;const u=SY.user,c=SY.cli;return syncIniciar(u,{cliente:c})}
/* "Sincronizar agora" / evento online / token renovado. */
function syncAgora(){if(!SY.user)return;SY.tent=0;const e=SY.estado;
 if(e=='auth'||e=='erro'||e=='offline')return syncReiniciar();   // refaz a decisão: seguro mesmo com pendências
 if(e=='pendente'||e=='salvo')return syncEnviar()}
/* O jogador aceitou enviar os dados deste dispositivo para a nuvem vazia (cenário A). Concluído só após a confirmação do servidor. */
function syncMigrar(){if(!SY.user||(SY.estado!='migrar'&&SY.estado!='adiado'))return;SY.meta.hash='';syncDefinir('pendente');return syncEnviar()}
function syncAdiar(){if(SY.estado=='migrar')syncDefinir('adiado')}
/* Antes do logout: tenta enviar o pendente por até ms; o que não for enviado continua salvo neste dispositivo. */
async function syncDescarregar(ms){if(!SY.user)return;clearTimeout(SY.timer);
 const e=SY.estado;if(e!='pendente'&&e!='salvando'&&e!='offline')return;
 const fim=Date.now()+(ms||2500);if(!SY.voando)syncEnviar();
 while(SY.voando&&Date.now()<fim)await new Promise(r=>setTimeout(r,60))}
/* Fim da sessão (logout/troca de conta): invalida tudo o que estiver em andamento. Os dados locais ficam como estão. */
function syncEncerrar(){SY.tok++;clearTimeout(SY.timer);Object.assign(SY,{user:null,cli:null,timer:null,voando:false,conflito:null,inicial:null});if(SY.estado!='desligado')syncDefinir('desligado')}
/* Ao voltar à aba ou à conexão: confere se outro dispositivo mudou a nuvem. Sem mudanças locais → avança; com mudanças → conflito. */
async function syncVerificar(){if(!SY.user||SY.voando)return;const e=SY.estado;if(e!='salvo'&&e!='pendente'&&e!='offline')return;
 if(e=='offline')return syncAgora();const tok=SY.tok;let rem;try{rem=await syncBuscar('revision,updated_at')}catch(x){return}
 if(tok!==SY.tok||!rem||+rem.revision===SY.meta.rev)return;
 const local=syncHash(syncStr(S))!==SY.meta.hash;if(local){syncEnviar();return}                   // o envio vai detectar o conflito
 try{const full=await syncBuscar();if(tok===SY.tok&&full){syncAdotar(full);syncDefinir('salvo');if(typeof toast=='function')toast('Dados atualizados com a versão da nuvem','ok')}}catch(x){}}

/* ===== Entrega 3 — resolução explícita de conflitos e exclusão da nuvem =====
   Regras: nada é decidido sozinho; a interface pede confirmação antes de chamar estas funções. Cada ação relê a nuvem,
   grava com a revisão atual (se outro dispositivo mudar a nuvem no meio, a ação devolve conflito de novo e nada é sobrescrito)
   e guarda uma cópia do lado substituído neste navegador:
     LS+'.antes-nuvem'       versão deste dispositivo antes de adotar a nuvem
     LS+'.nuvem-substituida' versão da nuvem antes de ser substituída pela deste dispositivo
     LS+'.nuvem-excluida'    versão da nuvem no momento em que o jogador a excluiu */
function syncResumo(d){d=d&&typeof d=='object'?d:{};const c=(d.chars||[])[0],n=d.net||{};
 return{nome:c?String(c.nome||''):'',fichas:(d.chars||[]).length,mana:c&&c.mana!=null?c.mana:null,manaMax:c&&c.manaMax!=null?c.manaMax:null,nucleo:c?String(c.nucleo||''):'',
  pessoas:(n.people||[]).length,conexoes:(n.edges||[]).length,eventos:c&&Array.isArray(c.cb)?c.cb.length:0,jogador:String((d.set||{}).nome||'')}}
function syncGuardarCopia(sufixo,dados,extra){try{localStorage.setItem(LS+sufixo,JSON.stringify(Object.assign({salvo:new Date().toISOString(),dados},extra||{})));return true}catch(e){return false}}
function syncLerCopia(sufixo){try{const o=JSON.parse(localStorage.getItem(LS+sufixo)||'null');return o&&o.dados?o:null}catch(e){return null}}

/* Detalhes para a tela de conflito (só leitura). Atualiza SY.conflito com a revisão vista agora. */
async function syncConflitoDetalhes(){if(!SY.user)return null;const tok=SY.tok,rem=await syncBuscar();if(tok!==SY.tok)return null;
 SY.conflito=Object.assign({},SY.conflito,{tipo:rem?'conflito':'remoto-apagado',remoto:rem?{revision:+rem.revision,updated_at:rem.updated_at,updated_by_device:rem.updated_by_device}:null});
 SY.remDados=rem?rem.data:null;syncDefinir(SY.estado,SY.erro);
 return{local:{resumo:syncResumo(S),mod:SY.meta.mod||null,at:SY.meta.at||null,rev:SY.meta.rev,dispositivo:syncDispositivo()},
  remoto:rem?{resumo:syncResumo(rem.data),revision:+rem.revision,updated_at:rem.updated_at||null,dispositivo:rem.updated_by_device||null,data:rem.data}:null}}

/* "Manter versão da nuvem": relê a nuvem (a mais recente) e a adota; a versão deste dispositivo fica em LS+'.antes-nuvem'. */
async function syncManterNuvem(){if(!SY.user)return{ok:false,motivo:'sem-sessao'};const tok=SY.tok;let rem;
 try{rem=await syncBuscar()}catch(e){return{ok:false,motivo:'rede',erro:e}}if(tok!==SY.tok)return{ok:false,motivo:'descartado'};
 if(!rem)return{ok:false,motivo:'sem-nuvem'};
 syncGuardarCopia('.antes-nuvem',S,{motivo:'conflito'});clearTimeout(SY.timer);
 syncAdotar(rem);SY.conflito=null;SY.remDados=null;SY.tent=0;syncDefinir('salvo');return{ok:true,revision:+rem.revision}}

/* "Manter versão deste dispositivo": grava este estado SOBRE a revisão que o jogador viu (revVista; 0 = nuvem vazia).
   Se a nuvem mudou depois disso, devolve conflito de novo (a interface mostra os dados novos e pede outra confirmação). */
async function syncManterDispositivo(revVista){if(!SY.user)return{ok:false,motivo:'sem-sessao'};if(SY.voando)return{ok:false,motivo:'ocupado'};
 const tok=SY.tok,str=syncStr(S),h=syncHash(str);revVista=Math.max(0,+revVista||0);
 if(str.length>SYNC_CFG.limite)return{ok:false,motivo:'grande'};
 if(SY.remDados)syncGuardarCopia('.nuvem-substituida',SY.remDados,{revision:revVista});
 SY.voando=true;clearTimeout(SY.timer);syncDefinir('salvando');
 try{const{data,error}=await SY.cli.rpc('sodual_sync_put',{p_data:JSON.parse(str),p_expected_revision:revVista,p_schema_version:VER,p_device:syncDispositivo()});
  if(tok!==SY.tok)return{ok:false,motivo:'descartado'};if(error)throw error;
  if(data&&data.ok){SY.meta=Object.assign({},SY.meta,{rev:+data.revision,hash:h,at:data.updated_at||new Date().toISOString()});syncGravarMeta();SY.conflito=null;SY.remDados=null;SY.tent=0;
   if(syncHash(syncStr(S))!==h){syncDefinir('pendente');syncAgendar(SYNC_CFG.debounce)}else syncDefinir('salvo');return{ok:true,revision:+data.revision}}
  SY.conflito={tipo:data&&data.revision?'conflito':'remoto-apagado',remoto:data&&data.revision?{revision:+data.revision,updated_at:data.updated_at,updated_by_device:data.updated_by_device}:null};
  syncDefinir('conflito');return{ok:false,motivo:'conflito',revision:data?+data.revision:0}}
 catch(e){if(tok===SY.tok)syncDefinir('conflito',syncTipoErro(e)=='rede'?'Sem conexão: tente de novo quando a internet voltar.':String(e&&e.message||'Falha'));return{ok:false,motivo:syncTipoErro(e),erro:e}}
 finally{if(tok===SY.tok)SY.voando=false}}

/* "Excluir dados da nuvem": apaga só o registro remoto desta conta (nunca a conta nem os dados deste dispositivo),
   usando a revisão atual. Depois, este dispositivo fica em "adiado": nada é reenviado sem o jogador pedir. */
async function syncExcluirNuvem(){if(!SY.user)return{ok:false,motivo:'sem-sessao'};if(SY.voando)return{ok:false,motivo:'ocupado'};const tok=SY.tok;
 clearTimeout(SY.timer);SY.voando=true;
 try{const cab=await syncBuscar('revision,data');if(tok!==SY.tok)return{ok:false,motivo:'descartado'};
  if(cab){syncGuardarCopia('.nuvem-excluida',cab.data,{revision:+cab.revision,motivo:'exclusao'});   // espaço próprio: não apaga a cópia de uma substituição anterior
   const{data,error}=await SY.cli.rpc('sodual_sync_delete',{p_expected_revision:+cab.revision});if(tok!==SY.tok)return{ok:false,motivo:'descartado'};if(error)throw error;
   if(!(data&&data.ok))return{ok:false,motivo:'conflito',revision:data?+data.revision:0}}
  SY.meta=Object.assign({},SY.meta,{rev:0,hash:'',at:null});syncGravarMeta();SY.conflito=null;SY.remDados=null;syncDefinir('adiado');return{ok:true}}
 catch(e){return{ok:false,motivo:syncTipoErro(e),erro:e}}
 finally{if(tok===SY.tok)SY.voando=false}}

if(typeof window!='undefined'&&window.addEventListener){
 window.addEventListener('online',()=>syncAgora());
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible')syncVerificar()})}
