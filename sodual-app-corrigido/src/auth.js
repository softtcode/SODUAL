/* ===== Autenticação — Supabase Auth (somente e-mail e senha) =====
 - Configuração pública em window.SODUAL_CONFIG (arquivo config.js; ver config.example.js e README). Só Project URL e publishable/anon key.
 - A sessão é mantida, renovada e restaurada pelo próprio supabase-js (persistSession). Nada aqui guarda senha ou token.
 - Dados por conta: cada conta usa a chave LS0+'.u.'+id no localStorage. A chave antiga LS0 (fichas de antes do login) nunca é
   apagada nem alterada; o jogador pode COPIÁ-LA para a sua conta, por escolha explícita, uma vez por dispositivo (marca LS0+'.dono').
 - "Última conta" (chave LAST): apenas id, e-mail e nome de exibição, para preencher o e-mail. Não é mecanismo de autenticação.
 - "Esquecer conta" ≠ "Excluir conta": remove só essa sugestão deste navegador; a conta no Supabase e os dados continuam intactos. */
const CFG=window.SODUAL_CONFIG||{},LAST='sodual.ultima',OWN=LS0+'.dono',SKIP=LS0+'.legado.visto.',PMIN=Math.max(6,+CFG.senhaMin||8),PREQ=CFG.senhaReq||'';
Object.assign(IC,{eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',eyeoff:'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9 M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6 M9.9 9.9a3 3 0 0 0 4.2 4.2',logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',mail:'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6',lock:'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',swap:'M16 3l4 4-4 4 M20 7H4 M8 21l-4-4 4-4 M4 17h16'});
/* Lê erros/indicadores que o Supabase devolve no link do e-mail (#type=recovery, #error_code=otp_expired...) antes de o cliente limpar a URL. */
const ALINK=(()=>{const p=new URLSearchParams((location.hash||'').replace(/^#/,'')),q=new URLSearchParams(location.search),g=k=>p.get(k)||q.get(k),r={rec:g('type')=='recovery',conf:['signup','email','invite'].includes(g('type')),err:g('error_description')||g('error'),code:g('error_code')};
 if(r.err)try{history.replaceState(null,'',location.pathname)}catch(e){}return r})();
const SBC=(()=>{try{return CFG.supabaseUrl&&CFG.supabaseKey&&window.supabase?supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'sodual.auth'}}):null}catch(e){console.error('[SODUAL] Supabase:',e);return null}})();
const AU={u:null};
const lsG=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lsS=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},lsD=k=>{try{localStorage.removeItem(k)}catch(e){}};
const ukey=id=>LS0+'.u.'+id,dname=u=>((u&&u.user_metadata&&u.user_metadata.display_name)||'').trim();
const lastAcc=()=>{try{const o=JSON.parse(lsG(LAST));return o&&o.email?o:null}catch(e){return null}};
const maskMail=e=>{const[a,d]=String(e||'').split('@');if(!d)return'';return(a.length<3?a[0]+'•':a[0]+'•'.repeat(Math.min(6,a.length-2))+a.slice(-1))+'@'+d};
const okMail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
/* Requisitos de senha: espelham o que estiver configurado no painel do Supabase (CFG.senhaMin / CFG.senhaReq). O servidor tem a palavra final. */
const PRUL=[[`Pelo menos ${PMIN} caracteres`,p=>p.length>=PMIN],['No máximo 72 caracteres',p=>p.length<=72,1]].concat(
 PREQ=='letters_digits'?[['Letras e números',p=>/[a-zA-Z]/.test(p)&&/\d/.test(p)]]:/^lower_upper/.test(PREQ)?[['Letras minúsculas e maiúsculas',p=>/[a-z]/.test(p)&&/[A-Z]/.test(p)],['Pelo menos um número',p=>/\d/.test(p)]]:[],
 PREQ=='lower_upper_letters_digits_symbols'?[['Pelo menos um símbolo (!@#…)',p=>/[^A-Za-z0-9]/.test(p)]]:[]);
const AERR=e=>{if(!e)return'';const c=e.code||'',s=e.status,m=String(e.message||'').toLowerCase();
 if(e.name=='AuthRetryableFetchError'||s===0||/failed to fetch|network|load failed/.test(m))return'Sem conexão com o servidor. Verifique a internet e tente de novo.';
 if(c=='invalid_credentials'||/invalid login credentials/.test(m))return'E-mail ou senha incorretos.';
 if(c=='email_not_confirmed'||/email not confirmed/.test(m))return'Confirme seu e-mail antes de entrar. Procure a mensagem na caixa de entrada (e no spam).';
 if(c=='same_password'||/different from the old/.test(m))return'A nova senha precisa ser diferente da atual.';
 if(c=='weak_password'||(!c&&/password should (be at least|contain)/.test(m))){const r=e.reasons||[];return'Senha fraca'+(r.length?': '+r.map(x=>({length:`use pelo menos ${PMIN} caracteres`,characters:'misture os tipos de caractere pedidos',pwned:'essa senha apareceu em vazamentos conhecidos'})[x]||x).join('; '):'')+'.'}
 if(/rate_limit/.test(c)||s==429)return'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.';
 if(c=='email_address_invalid')return'Este endereço de e-mail não é aceito.';
 if(c=='signup_disabled')return'Novos cadastros estão desativados no momento.';
 if(c=='user_already_exists'||c=='email_exists')return'Não foi possível criar a conta com este e-mail. Se você já tem conta, entre ou recupere a senha.';
 if(/session|refresh_token/.test(c)||e.name=='AuthSessionMissingError')return'Sua sessão expirou. Peça um novo link de recuperação.';
 return'Não foi possível concluir agora. Tente de novo em instantes.'};
const LINKMSG=a=>a.code=='otp_expired'?'O link expirou ou já foi usado. Peça um novo.':'Não foi possível validar o link do e-mail. Peça um novo.';
const redir=()=>CFG.siteUrl||location.origin+location.pathname;
/* ---- Conta ativa: troca a chave de dados e reinicia o estado da interface ---- */
function remember(u){if(!u||!u.email)return;const n=dname(u)||(S.set.nome&&S.set.nome!='Viajante'?S.set.nome:'');lsS(LAST,JSON.stringify({id:u.id,email:u.email,nome:n}))}
function openAccount(u){const had=loadS(ukey(u.id));if(!had){const n=dname(u);if(n)S.set.nome=n.slice(0,40);save()}ui=UI0();AU.u=u;remember(u);typeof applySet=='function'&&applySet()}
function closeAccount(){if(AU.u){save();remember(AU.u)}AU.u=null;LS='';S=DEF();ui=UI0()}
/* Fichas de antes do login neste dispositivo (chave LS0), que ainda não foram copiadas para nenhuma conta. */
const legacy=()=>{try{const d=JSON.parse(lsG(LS0));const n=(d.chars||[]).length,p=((d.net||{}).people||[]).length;return n||p?{n,p,nome:n?d.chars[0].nome:''}:null}catch(e){return null}};
const canImport=()=>!!AU.u&&!lsG(OWN)&&!!legacy()&&!S.chars.length&&!S.net.people.length&&!S.net.edges.length;
function importLegacy(){if(!canImport())return false;const d=norm(JSON.parse(lsG(LS0))),n=S.set.nome;if(n&&n!='Viajante'&&(!d.set.nome||d.set.nome=='Viajante'))d.set.nome=n;S=d;if(!save())return false;lsS(OWN,AU.u.id);ui=UI0();applySet();return true}
async function sair(){if(!SBC)return false;save();const{error}=await SBC.auth.signOut({scope:'local'});if(error){toast('Não foi possível sair: '+AERR(error));return false}return true}
/* ---- Componentes ---- */
const Brand=({s})=>h`<div class=${'au-br'+(s?' s':'')}><span class="au-sl" aria-hidden="true"><${I} n="flame" s=${s?18:26}/></span><span class="au-nm">SODUAL</span></div>`;
const AFld=({id,l,v,set,err,hint,pw,show,tog,children,...r})=>h`<div class=${'au-f'+(err?' bad':'')}><label for=${id}>${l}</label><div class=${pw?'au-pw':''}><input id=${id} value=${v} onChange=${e=>set(e.target.value)} aria-invalid=${err?'true':undefined} aria-describedby=${err?id+'-e':hint?id+'-h':undefined} type=${pw?(show?'text':'password'):r.type||'text'} ...${r}/>${pw&&tog&&h`<button type="button" class="au-eye" aria-label=${show?'Ocultar senha':'Mostrar senha'} aria-pressed=${!!show} aria-controls=${id} onClick=${tog}><${I} n=${show?'eyeoff':'eye'} s=${20}/></button>`}</div>${err?h`<small class="au-e" id=${id+'-e'}>${err}</small>`:hint&&h`<small class="au-h" id=${id+'-h'}>${hint}</small>`}${children}</div>`;
const Rules=({p,id})=>h`<ul class="au-rq" id=${id} aria-label="Requisitos da senha">${PRUL.filter(([,f,hid])=>!hid||(p&&!f(p))).map(([t,f])=>{const ok=p&&f(p);return h`<li key=${t} class=${ok?'ok':''}><${I} n=${ok?'check':'x'} s=${14}/><span>${t}</span><span class="sr">${ok?' (atendido)':' (pendente)'}</span></li>`})}</ul>`;
const Load=({t='Abrindo o SODUAL…',err,retry})=>h`<div class="au au-ld" role="status" aria-live="polite"><div class="au-ldb"><span class="au-ring" aria-hidden="true"><${I} n="flame" s=${30}/></span><span class="au-nm">SODUAL</span><p>${err||t}</p>${retry&&h`<button class="b p au-btn" onClick=${retry}>Tentar de novo</button>`}</div></div>`;
/* Arte da tela de login: dragãozinho em pixel art (assets/dragao-login.webp, 1312×1199). Uma só imagem: painel lateral no desktop, faixa no topo do cartão em tablets e celulares. */
const AU_IMG=(window.IMGS&&IMGS['dragao-login'])||'assets/dragao-login.webp',AuImg=({c})=>h`<img class=${c} src=${AU_IMG} alt="" width="1312" height="1199" decoding="async" fetchpriority="high" draggable="false"/>`;
const Shell=({children,wide})=>h`<div class="au"><aside class="au-art" aria-hidden="true"><${AuImg} c="au-img"/><div class="au-art-t"><${Brand}/><p class="au-tag">Fichas, lore e constelações do seu RPG — guardadas sob o seu nome.</p><div class="au-orn"><i></i><${I} n="flame" s=${14}/><i></i></div></div></aside><main class="au-m" id="main"><div class=${'au-c'+(wide?' w':'')}><div class="au-ban" aria-hidden="true"><${AuImg} c="au-bimg"/></div><${Brand} s/>${children}</div></main></div>`;
const Auth=({start,note})=>{const L=lastAcc(),[m,sm]=React.useState(start||(L?'last':'login')),[em,se]=React.useState(start=='reset'&&AU.u?AU.u.email:''),[pw,sp]=React.useState(''),[p2,sp2]=React.useState(''),[nm,sn]=React.useState(''),[sh,ssh]=React.useState(false),[err,ser]=React.useState({}),[msg,smsg]=React.useState(note||null),[busy,sb]=React.useState(false),[cd,scd]=React.useState(0),[last,sl]=React.useState(L),hr=React.useRef(),first=React.useRef(true);
 React.useEffect(()=>{if(first.current){first.current=false;return}hr.current&&hr.current.focus({preventScroll:true});try{scrollTo(0,0)}catch(e){}},[m]);
 React.useEffect(()=>{if(cd<=0)return;const t=setTimeout(()=>scd(cd-1),1000);return()=>clearTimeout(t)},[cd]);
 const to=(x,keep)=>{ser({});if(!keep)smsg(null);sp('');sp2('');ssh(false);sm(x)},
  run=async f=>{if(busy)return;sb(true);smsg(null);try{await f()}catch(e){console.warn('[SODUAL] auth',e);smsg({t:AERR(e),bad:1})}finally{sb(false)}},
  img=last&&(()=>{try{return(JSON.parse(lsG(ukey(last.id)))||{}).set.img||''}catch(e){return''}})(),
  vMail=e=>!e.trim()?'Informe seu e-mail.':!okMail(e.trim())?'Esse e-mail não parece válido. Confira o formato (nome@exemplo.com).':'',
  vNew=()=>{const o={},bad=PRUL.find(([,f])=>!f(pw));if(!pw)o.pw='Crie uma senha.';else if(bad)o.pw='A senha ainda não atende: '+bad[0].toLowerCase()+'.';if(!p2)o.p2='Repita a senha para confirmar.';else if(pw&&p2!==pw)o.p2='As senhas não coincidem.';return o},
  fail=o=>{ser(o);const k=Object.keys(o)[0];if(k){const el=document.getElementById('au-'+k);el&&el.focus()}return!k};
 const login=e=>{e.preventDefault();const mail=m=='last'?last.email:em.trim(),o={};if(m!='last'){const x=vMail(em);if(x)o.em=x}if(!pw)o.pw='Informe sua senha.';if(!fail(o))return;
   run(async()=>{const{error}=await SBC.auth.signInWithPassword({email:mail,password:pw});if(error)throw error;sp('')})},
  signup=e=>{e.preventDefault();const o={},x=vMail(em);if(x)o.em=x;Object.assign(o,vNew());if(!fail(o))return;
   run(async()=>{const n=nm.trim().slice(0,40),{data,error}=await SBC.auth.signUp({email:em.trim(),password:pw,options:{emailRedirectTo:redir(),data:n?{display_name:n}:{}}});if(error)throw error;
    if(!data.session){to('check',1);scd(60)}})},
  forgot=e=>{e&&e.preventDefault();const x=vMail(em);if(!fail(x?{em:x}:{}))return;
   run(async()=>{const{error}=await SBC.auth.resetPasswordForEmail(em.trim(),{redirectTo:redir()});if(error)throw error;if(m=='sent')smsg({t:'Link reenviado.'});else to('sent',1);scd(60)})},
  resend=()=>run(async()=>{const{error}=await SBC.auth.resend({type:'signup',email:em.trim(),options:{emailRedirectTo:redir()}});if(error)throw error;scd(60);smsg({t:'Enviamos um novo e-mail de confirmação.'})}),
  reset=e=>{e.preventDefault();if(!fail(vNew()))return;
   run(async()=>{const{error}=await SBC.auth.updateUser({password:pw});if(error)throw error;sp('');sp2('');toast('Senha atualizada. Bem-vindo de volta!');AUTH_DONE_RESET()})},
  cancelReset=()=>run(async()=>{await SBC.auth.signOut({scope:'local'})}),
  forget=()=>run(async()=>{const{data}=await SBC.auth.getSession();if(data&&data.session){const{error}=await SBC.auth.signOut({scope:'local'});if(error)throw error}lsD(LAST);sl(null);se('');to('login',1);smsg({t:'Conta esquecida neste navegador. A conta e os dados dela não foram apagados.'})});
 /* Funções que devolvem marcação (não componentes): evitam remontar botões e títulos a cada tecla. */
 const Msg=()=>msg&&h`<p class=${'au-msg'+(msg.bad?' bad':' ok')} role=${msg.bad?'alert':'status'}><${I} n=${msg.bad?'x':'check'} s=${16}/><span>${msg.t}</span></p>`,
  Btn=({t,bt})=>h`<button class="b p au-btn" type="submit" disabled=${busy} aria-busy=${busy?'true':undefined}>${busy?h`<span class="au-sp" aria-hidden="true"></span>${bt}`:t}</button>`,
  H=({t,s})=>h`<h1 class="au-t" tabIndex="-1" ref=${hr}>${t}</h1>${s&&h`<p class="au-s">${s}</p>`}`,
  eye={pw:true,show:sh,tog:()=>ssh(!sh)};
 let body;
 if(m=='last'&&last)body=h`${H({t:'Bem-vindo de volta!',s:'Digite sua senha para continuar.'})}
  <div class="au-acc"><${Avatar} img=${img} s=${52} ic=${24}/><div>${last.nome&&h`<b>${last.nome}</b>`}<span>${maskMail(last.email)}</span></div></div>
  ${Msg()}<form onSubmit=${login} noValidate><input type="email" name="email" autoComplete="username" value=${last.email} readOnly hidden/>
  <${AFld} id="au-pw" l="Senha" v=${pw} set=${sp} err=${err.pw} autoComplete="current-password" ...${eye}/>
  ${Btn({t:'Entrar novamente',bt:'Entrando…'})}</form>
  <button class="au-lk" onClick=${()=>{se(last.email);to('forgot')}}>Esqueci minha senha</button>
  <div class="au-alt"><button class="b au-btn2" onClick=${()=>{se('');to('login')}}><${I} n="swap" s=${16}/>Usar outra conta</button><button class="b au-btn2" onClick=${forget} disabled=${busy}><${I} n="x" s=${16}/>Esquecer conta</button></div>
  <p class="au-fine">“Esquecer conta” só remove esta sugestão deste navegador. Não exclui a conta nem suas fichas.</p>`;
 else if(m=='login'||m=='last')body=h`${H({t:'Entrar no SODUAL',s:'Acesse suas fichas e continue a jornada.'})}${Msg()}
  <form onSubmit=${login} noValidate><${AFld} id="au-em" l="E-mail" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck="false" v=${em} set=${se} err=${err.em}/>
  <${AFld} id="au-pw" l="Senha" v=${pw} set=${sp} err=${err.pw} autoComplete="current-password" ...${eye}/>
  <button type="button" class="au-lk au-fg" onClick=${()=>to('forgot')}>Esqueci minha senha</button>
  ${Btn({t:'Entrar',bt:'Entrando…'})}</form>
  <p class="au-sw">Ainda não tem conta? <button class="au-lk" onClick=${()=>to('signup')}>Criar conta</button></p>
  ${last&&h`<p class="au-sw"><button class="au-lk" onClick=${()=>to('last')}>Voltar para ${last.nome||maskMail(last.email)}</button></p>`}`;
 else if(m=='signup')body=h`${H({t:'Criar conta',s:'Leva menos de um minuto.'})}${Msg()}
  <form onSubmit=${signup} noValidate><${AFld} id="au-nm" l="Nome de exibição (opcional)" autoComplete="nickname" maxLength=${40} v=${nm} set=${sn} hint="Aparece no seu perfil. Pode mudar depois."/>
  <${AFld} id="au-em" l="E-mail" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck="false" v=${em} set=${se} err=${err.em}/>
  <${AFld} id="au-pw" l="Senha" v=${pw} set=${sp} err=${err.pw} autoComplete="new-password" aria-describedby=${err.pw?'au-pw-e au-rq':'au-rq'} ...${eye}><${Rules} p=${pw} id="au-rq"/><//>
  <${AFld} id="au-p2" l="Confirmar senha" v=${p2} set=${sp2} err=${err.p2} autoComplete="new-password" pw show=${sh}/>
  ${Btn({t:'Criar conta',bt:'Criando…'})}</form>
  <p class="au-sw">Já tem conta? <button class="au-lk" onClick=${()=>to(last?'last':'login')}>Entrar</button></p>`;
 else if(m=='check')body=h`<div class="au-ic" aria-hidden="true"><${I} n="mail" s=${30}/></div>${H({t:'Confirme seu e-mail',s:h`Se o endereço <b>${maskMail(em)}</b> puder ser usado, enviamos um link de confirmação. Abra-o para entrar.`})}${Msg()}
  <p class="au-fine">Não chegou? Veja o spam ou o lixo eletrônico. O link expira depois de um tempo.</p>
  <button class="b au-btn2 au-full" onClick=${resend} disabled=${busy||cd>0}>${cd>0?`Reenviar em ${cd}s`:'Reenviar e-mail'}</button>
  <button class="b p au-btn" onClick=${()=>to(last?'last':'login')}>Voltar para o login</button>`;
 else if(m=='forgot')body=h`${H({t:'Recuperar senha',s:'Informe o e-mail da conta. Enviaremos um link para criar uma nova senha.'})}${Msg()}
  <form onSubmit=${forgot} noValidate><${AFld} id="au-em" l="E-mail" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck="false" v=${em} set=${se} err=${err.em}/>
  ${Btn({t:'Enviar link',bt:'Enviando…'})}</form>
  <p class="au-sw"><button class="au-lk" onClick=${()=>to(last?'last':'login')}>Voltar para o login</button></p>`;
 else if(m=='sent')body=h`<div class="au-ic" aria-hidden="true"><${I} n="mail" s=${30}/></div>${H({t:'Verifique seu e-mail',s:h`Se existir uma conta com <b>${maskMail(em)}</b>, você receberá um link para definir uma nova senha.`})}${Msg()}
  <p class="au-fine">O link vale por tempo limitado e só pode ser usado uma vez. Não chegou? Veja o spam.</p>
  <button class="b au-btn2 au-full" onClick=${forgot} disabled=${busy||cd>0}>${cd>0?`Reenviar em ${cd}s`:'Reenviar link'}</button>
  <button class="b p au-btn" onClick=${()=>to(last?'last':'login')}>Voltar para o login</button>`;
 else if(m=='reset')body=h`${H({t:'Nova senha',s:AU.u?h`Defina a nova senha de <b>${maskMail(AU.u.email)}</b>.`:'Defina sua nova senha.'})}${Msg()}
  <form onSubmit=${reset} noValidate><input type="email" name="email" autoComplete="username" value=${AU.u?AU.u.email:''} readOnly hidden/>
  <${AFld} id="au-pw" l="Nova senha" v=${pw} set=${sp} err=${err.pw} autoComplete="new-password" aria-describedby=${err.pw?'au-pw-e au-rq':'au-rq'} ...${eye}><${Rules} p=${pw} id="au-rq"/><//>
  <${AFld} id="au-p2" l="Confirmar nova senha" v=${p2} set=${sp2} err=${err.p2} autoComplete="new-password" pw show=${sh}/>
  ${Btn({t:'Salvar nova senha',bt:'Salvando…'})}</form>
  <p class="au-sw"><button class="au-lk" onClick=${cancelReset} disabled=${busy}>Cancelar e voltar ao login</button></p>`;
 return h`<${Shell}>${body}<//>`};
const NoCfg=()=>h`<${Shell}><h1 class="au-t">${window.supabase?'Configuração pendente':'Sem conexão'}</h1>${window.supabase?h`<p class="au-s">O SODUAL ainda não sabe a qual projeto Supabase se conectar.</p><p class="au-fine">Crie o arquivo <code>config.js</code> a partir de <code>config.example.js</code> (ou defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY na Vercel). Veja o README.</p>`:h`<p class="au-s">Não foi possível carregar o serviço de login. Verifique a internet e recarregue a página.</p><button class="b p au-btn" onClick=${()=>location.reload()}>Recarregar</button>`}<//>`;
/* Oferta (opcional e explícita) de copiar as fichas de antes do login para a conta. O original continua no dispositivo. */
const Legacy=({done})=>{const l=legacy();return h`<${Modal} t="Fichas encontradas neste dispositivo" onClose=${done}>
 <p>Este navegador tem dados de antes do login${l.nome?h`, incluindo a ficha de <b>${l.nome}</b>`:''}. Quer usá-los nesta conta?</p>
 <div class="note">É uma cópia: o original continua guardado neste dispositivo. A oferta só vale para uma conta — depois de copiar, outras contas neste navegador não verão essas fichas.</div>
 <div class="row"><${B} p ic="check" onClick=${()=>{if(importLegacy()){toast('Fichas copiadas para a sua conta');done()}else toast('Não foi possível copiar as fichas.')}}>Usar nesta conta<//><${B} onClick=${()=>{lsS(SKIP+AU.u.id,'1');done()}}>Agora não<//></div>
 <p class="mut" style=${{fontSize:'.8rem'}}>Você pode fazer isso depois em Configurações.</p><//>`};
let AUTH_DONE_RESET=()=>{};
/* Portão: nada do aplicativo é montado antes de o Supabase confirmar a sessão. Mantém a interface sincronizada via onAuthStateChange. */
const Gate=()=>{const[st,sst]=React.useState(SBC?{s:'load'}:{s:'cfg'}),cur=React.useRef(st),[leg,sleg]=React.useState(false),set=x=>{cur.current=x;sst(x)};
 React.useEffect(()=>{if(!SBC)return;let rec=ALINK.rec;
  const enter=(u,extra)=>{if(!(cur.current.s=='in'&&AU.u&&AU.u.id==u.id))openAccount(u);else AU.u=u;sleg(canImport()&&!lsG(SKIP+u.id));set(Object.assign({s:'in',u},extra))},
   out=note=>{closeAccount();set({s:'out',note})};
  AUTH_DONE_RESET=()=>{rec=false;AU.u&&enter(AU.u)};
  const tm=setTimeout(()=>cur.current.s=='load'&&set({s:'load',err:'O servidor de login está demorando a responder.'}),12000);
  const{data:{subscription}}=SBC.auth.onAuthStateChange((ev,ses)=>{setTimeout(()=>{clearTimeout(tm);const u=ses&&ses.user;
   if(ev=='PASSWORD_RECOVERY'||(rec&&u&&ev!='SIGNED_OUT')){rec=true;if(cur.current.s=='in'){save()}AU.u=u;set({s:'reset'});return}
   if(ev=='SIGNED_OUT'||!u){if(cur.current.s!='out'||ev=='SIGNED_OUT')out(ALINK.err&&cur.current.s=='load'?{t:LINKMSG(ALINK),bad:1}:null);return}
   if(ev=='INITIAL_SESSION'||ev=='SIGNED_IN'){enter(u);if(ALINK.conf&&ev=='INITIAL_SESSION'){ALINK.conf=false;toast('E-mail confirmado. Boas-vindas ao SODUAL!')}return}
   if(ev=='USER_UPDATED'||ev=='TOKEN_REFRESHED'){AU.u=u;remember(u)}},0)});
  return()=>{clearTimeout(tm);subscription.unsubscribe()}},[]);
 if(st.s!='in')document.title=(st.s=='reset'?'Nova senha':'Entrar')+' — SODUAL';
 if(st.s=='cfg')return h`<${NoCfg}/>`;
 if(st.s=='load')return h`<${Load} err=${st.err} retry=${st.err&&(()=>location.reload())}/>`;
 if(st.s=='out')return h`<${Auth} key="out" note=${st.note}/>`;
 if(st.s=='reset')return h`<${Auth} key="reset" start="reset"/>`;
 return h`<${React.Fragment}><${App} key=${st.u.id}/>${leg&&h`<${Legacy} done=${()=>sleg(false)}/>`}<//>`};
/* Botão "Sair da conta" reutilizado no Perfil e em Configurações. */
const Logout=({cls})=>{const[b,sb]=React.useState(false);return h`<button class=${'b '+(cls||'')} disabled=${b} aria-busy=${b?'true':undefined} onClick=${async()=>{sb(true);if(!await sair())sb(false)}}><${I} n="logout" s=${16}/>${b?'Saindo…':'Sair da conta'}</button>`};
