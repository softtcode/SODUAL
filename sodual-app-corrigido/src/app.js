const NAV=m=>[['NAVEGAÇÃO',[['lore','História do RPG','map'],['sheet','Meu personagem','scroll'],['rede','Rede de Conexões','net']]],['PERSONAGEM',[['hist',m&&m.nome?'História de '+m.nome:'História do personagem','pen'],['mochila','Mochila','shield'],['magias','Magias','flame'],['habs','Habilidades','sword']]],['COMPÊNDIO',[['livro','Livro de regras','book'],['biblioteca','Biblioteca','lib']]],['SISTEMA',[['perfil','Meu perfil','user'],['config','Configurações','sliders'],['ajuda','Ajuda','help']]]];
/* Celular (<768px): barra inferior com os destinos mais usados; o restante fica no painel "Mais". Usa os mesmos destinos de NAV e o mesmo go(). */
const BN=[['lore','Início','map'],['sheet','Ficha','scroll'],['mochila','Mochila','shield'],['magias','Magias','flame']],BN_IDS=BN.map(x=>x[0]),MORE_ORD=['PERSONAGEM','NAVEGAÇÃO','COMPÊNDIO','SISTEMA'];
IC.menu='M4 6h16 M4 12h16 M4 18h16';
Object.assign(IC,{nuvem:'M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z',nuvemOk:'M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z M9.5 13.5l2 2 4-4',nuvemOff:'M2 2l20 20 M5.8 5.8A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.4-.2 M21.4 15.6A4.5 4.5 0 0 0 17.5 10h-1.8A7 7 0 0 0 11 5.1',sincro:'M21 12a9 9 0 0 1-15 6.7L3 16 M3 12a9 9 0 0 1 15-6.7L21 8 M21 3v5h-5 M3 21v-5h5'});
/* Estado da sincronização para a interface (re-renderiza quando src/sync.js muda de estado). */
const useSync=()=>{const[,t]=React.useReducer(x=>x+1,0);React.useEffect(()=>typeof syncOuvir=='function'?syncOuvir(t):undefined,[]);return typeof syncStatus=='function'?syncStatus():{estado:'desligado'}};
/* Rótulo, ícone e classe de cada estado. "Salvo na nuvem" só depois da confirmação do servidor. */
const SYNC_UI={salvo:['Salvo na nuvem','nuvemOk','ok'],salvando:['Salvando…','sincro','run'],pendente:['Salvando…','sincro','run'],iniciando:['Conectando à nuvem…','sincro','run'],
 offline:['Salvo neste dispositivo','nuvemOff','loc'],vazio:['Salvo neste dispositivo','nuvem','loc'],migrar:['Só neste dispositivo','nuvem','warn'],adiado:['Só neste dispositivo','nuvem','warn'],
 conflito:['Conflito detectado','alert','warn'],auth:['Falha na sincronização','alert','err'],erro:['Falha na sincronização','alert','err'],grande:['Falha na sincronização','alert','err']};
/* "há 2 min", "há 3 h", "ontem, 21:04" — só para a última sincronização CONFIRMADA (nunca para dados sem esse registro). */
const haQuanto=t=>{const d=t?Date.parse(t):NaN;if(!isFinite(d))return'';const s=Math.max(0,(Date.now()-d)/1000);
 if(s<60)return'agora há pouco';if(s<3600)return'há '+Math.round(s/60)+' min';if(s<86400)return'há '+Math.round(s/3600)+' h';
 try{return new Date(d).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch(e){return''}};
/* Celular: sinal discreto no botão "Mais" só quando a sincronização pede atenção (nunca a cada salvamento). */
const SyncDot=()=>{const s=useSync(),u=SYNC_UI[s.estado];if(!u||u[2]=='ok'||u[2]=='run')return null;
 return h`<i class=${'bn-dot sy-'+u[2]} aria-hidden="true"></i>`};
/* Avisos únicos nas MUDANÇAS de estado (nada a cada salvamento): queda de conexão, volta, falhas que pedem ação. */
const SyncAvisos=()=>{const s=useSync(),ant=React.useRef(s.estado),ruim=React.useRef(false);
 React.useEffect(()=>{const a=ant.current,e=s.estado;ant.current=e;if(a==e)return;
  if(e=='offline'||e=='auth'||e=='erro')ruim.current=true;                       // entre o problema e o "salvo" passam "iniciando"/"salvando"
  if(e=='offline'&&a!='offline')toast('Sem conexão com a nuvem: tudo continua salvo neste dispositivo.','warn');
  else if(e=='salvo'&&ruim.current){ruim.current=false;toast('Conexão restabelecida: alterações salvas na nuvem.','ok')}
  else if(e=='auth')toast('Sua sessão precisa ser renovada para sincronizar. Os dados continuam salvos aqui.','err');
  else if(e=='grande')toast('Não foi possível enviar: os dados (principalmente imagens) passam do limite da nuvem.','err');
  else if(e=='erro')toast('Falha na sincronização: '+(s.erro||'tente de novo em Configurações.'),'err')},[s.estado]);return null};
/* Conflito → abre a escolha de versão; demais estados → Configurações › Sincronização. */
const abrirSync=nav=>{if(typeof SY!='undefined'&&SY.estado=='conflito'){ui.cfAberto=true;R()}else nav('config')};
/* Indicador compacto. det: mostra a última sincronização confirmada numa segunda linha (usado no celular). */
const SyncChip=({onClick,det})=>{const s=useSync(),u=SYNC_UI[s.estado];if(!u)return null;const q=s.at?haQuanto(s.at):'';
 const dica=u[0]+(s.erro?' — '+s.erro:'')+(q?' · última sincronização confirmada: '+q:'')+(s.pendente&&s.estado!='salvo'?' · alterações aguardando envio':'');
 return h`<button type="button" class=${'sy-chip sy-'+u[2]+(det?' det':'')} onClick=${onClick} title=${dica} aria-label=${'Sincronização: '+dica}><${I} n=${u[1]} s=${15}/><span class="lb">${u[0]}${det&&h`<small>${s.erro?s.erro:q?'Última confirmação: '+q:'Ainda não sincronizado'}</small>`}</span></button>`};
/* Baixa um objeto como arquivo JSON (backup portátil de uma versão). */
const baixarJSON=(nome,obj)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,1)],{type:'application/json'}));a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
const dataHoraSy=t=>{try{return t?new Date(t).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):''}catch(e){return''}};
/* Cenário D / conflito de revisão: escolha explícita entre as versões, com confirmação. Nada é substituído sem ela. */
const ResumoVersao=({t,ic,r,linhas})=>h`<section class="cf-v"><h3><${I} n=${ic} s=${16}/>${t}</h3>${r?h`<dl>
 <div><dt>Personagem</dt><dd>${r.nome||'—'}${r.fichas>1?' (+'+(r.fichas-1)+')':''}</dd></div>
 <div><dt>Mana</dt><dd>${r.mana!=null?r.mana+(r.manaMax!=null?' / '+r.manaMax:''):'—'}</dd></div>
 <div><dt>Núcleo</dt><dd>${r.nucleo?nucNome(r.nucleo):'—'}</dd></div>
 <div><dt>Rede</dt><dd>${r.pessoas} pessoa(s) · ${r.conexoes} conexão(ões)</dd></div>
 <div><dt>Eventos de combate</dt><dd>${r.eventos}</dd></div>
 ${linhas.map(([a,b],i)=>h`<div key=${i}><dt>${a}</dt><dd>${b}</dd></div>`)}</dl>`:h`<p class="mut">Não há dados desta conta na nuvem (foram excluídos por outro dispositivo).</p>`}</section>`;
const ConflitoModal=()=>{const s=useSync(),[d,sd]=React.useState(null),[er,se]=React.useState(''),[cf,scf]=React.useState(null),[busy,sb]=React.useState(false),[,t]=React.useReducer(x=>x+1,0);
 const aberto=s.estado=='conflito'&&(ui.cfAberto||!ui.cfDispensado);
 const carregar=()=>{se('');sd(null);syncConflitoDetalhes().then(x=>x&&sd(x),e=>se('Não foi possível ler a versão da nuvem agora (sem conexão?). Nada foi alterado. Tente de novo.'))};
 React.useEffect(()=>{if(aberto)carregar()},[aberto,s.conflito&&s.conflito.remoto&&s.conflito.remoto.revision]);
 if(!aberto)return null;
 const fechar=()=>{ui.cfAberto=false;ui.cfDispensado=true;scf(null);t()},
  exportar=async()=>{const dia=new Date().toISOString().slice(0,10),em=new Date().toISOString();await exportarPortatil('sodual-este-dispositivo-'+dia+'.json',{origem:'este dispositivo',exportado:em},S);
   if(d&&d.remoto){await new Promise(r=>setTimeout(r,300));await exportarPortatil('sodual-nuvem-rev'+d.remoto.revision+'-'+dia+'.json',{origem:'nuvem',revisao:d.remoto.revision,exportado:em},d.remoto.data)}},
  agir=async()=>{sb(true);se('');const r=cf=='nuvem'?await syncManterNuvem():await syncManterDispositivo(d&&d.remoto?d.remoto.revision:0);sb(false);
   if(r.ok){scf(null);ui.cfAberto=false;toast(cf=='nuvem'?'Versão da nuvem aplicada. A versão anterior deste dispositivo ficou guardada.':'Versão deste dispositivo enviada para a nuvem.','ok');return}
   scf(null);if(r.motivo=='conflito'){toast('A nuvem mudou enquanto você decidia. Confira a versão nova.','warn');carregar()}else se(r.motivo=='rede'?'Sem conexão: nada foi alterado. Tente de novo quando a internet voltar.':r.motivo=='sem-nuvem'?'Não há mais dados na nuvem para manter.':'Não foi possível concluir agora. Nada foi alterado.')};
 const L=d&&d.local,Rm=d&&d.remoto;
 return h`<${Modal} t="Escolha qual versão manter" onClose=${fechar}><div class="cf">
 <p>Este dispositivo e a nuvem têm versões diferentes desta conta. <b>Nada foi sobrescrito.</b> Escolha qual manter; a outra fica guardada neste navegador.</p>
 ${er&&h`<div class="note bad" role="alert">${er}</div>`}
 ${!d&&!er?h`<p class="mut" role="status">Lendo a versão da nuvem…</p>`:d&&h`<div class="cf-g">
  <${ResumoVersao} t="Nuvem" ic="nuvem" r=${Rm&&Rm.resumo} linhas=${Rm?[['Alterada em',dataHoraSy(Rm.updated_at)||'—'],['Dispositivo',Rm.dispositivo||'não informado'],['Revisão',Rm.revision]]:[]}/>
  <${ResumoVersao} t="Este dispositivo" ic="user" r=${L.resumo} linhas=${[['Última alteração aqui',dataHoraSy(L.mod)||'sem registro de data'],['Última sincronização',dataHoraSy(L.at)||'nunca sincronizado'],['Dispositivo',L.dispositivo]]}/></div>`}
 ${cf?h`<div class="note cf-ok" role="alertdialog" aria-label="Confirmar"><b>${cf=='nuvem'?'Substituir a versão deste dispositivo pela da nuvem?':'Substituir a versão da nuvem pela deste dispositivo?'}</b><br/><small>${cf=='nuvem'?'Os dados deste dispositivo serão trocados pelos da nuvem. Uma cópia deles fica guardada neste navegador (Configurações › Dados locais).':'Os outros dispositivos passarão a receber esta versão. A versão atual da nuvem fica guardada neste navegador.'}</small>
  <div class="row"><${B} p ic="check" disabled=${busy} onClick=${agir}>${busy?'Aplicando…':'Confirmar'}<//><${B} disabled=${busy} onClick=${()=>scf(null)}>Voltar<//></div></div>`
 :h`<div class="row cf-ac"><${B} ic="down" onClick=${exportar} disabled=${!d}>Exportar as duas versões<//><${B} ic="nuvem" disabled=${!d||!Rm} onClick=${()=>scf('nuvem')}>Manter versão da nuvem<//><${B} ic="user" disabled=${!d} onClick=${()=>scf('disp')}>Manter versão deste dispositivo<//></div>
  <p class="mut cf-fine">Até você escolher, este dispositivo continua salvando localmente e nada é enviado. <button type="button" class="lk" onClick=${fechar}>Decidir depois</button></p>`}</div><//>`};
/* Cenário A: nuvem vazia e dados neste dispositivo. Nada é enviado sem a escolha do jogador. */
const MigrarNuvem=()=>{const s=useSync();if(s.estado!='migrar')return null;const c=S.chars[0];
 return h`<${Modal} t="Guardar suas fichas na nuvem?" onClose=${()=>syncAdiar()}><p>Encontramos dados desta conta só neste dispositivo${c?h`, incluindo a ficha de <b>${c.nome}</b>`:''}${S.net.people.length?` e ${S.net.people.length} pessoa(s) na rede`:''}. A nuvem desta conta ainda está vazia.</p>
 <div class="note">Enviar faz uma cópia na nuvem para abrir em outros dispositivos. Os dados continuam neste aparelho, e nada é apagado.</div>
 <div class="row"><${B} p ic="nuvem" onClick=${()=>syncMigrar()}>Enviar para a nuvem<//><${B} onClick=${()=>syncAdiar()}>Agora não<//></div><p class="mut" style=${{fontSize:'.8rem'}}>Você pode enviar depois em Configurações › Sincronização.</p><//>`};
const MQ=window.matchMedia?matchMedia('(prefers-color-scheme: light)'):null;
function applySet(){const r=document.documentElement,t=S.set.theme=='auto'?(MQ&&MQ.matches?'light':'dark'):S.set.theme;r.dataset.theme=t;r.style.setProperty('--ac',S.set.ac||'#7b4be8');const m=document.querySelector('meta[name=theme-color]');m&&m.setAttribute('content',t=='light'?'#ecebf8':'#0b1030');try{localStorage.setItem('sodual.tema',JSON.stringify({theme:S.set.theme,ac:S.set.ac}))}catch(e){}}
MQ&&MQ.addEventListener&&MQ.addEventListener('change',()=>{S.set.theme=='auto'&&applySet()});
const NEED_CHAR=['hist','mochila','magias','habs'],VIEW={lore:Lore,livro:Book,biblioteca:Lib,perfil:Profile,config:Config,ajuda:Help};
const More=({c,act,nav,onClose})=>{const r=React.useRef(),u=S.set;
 React.useEffect(()=>{const f=e=>e.key=='Escape'&&onClose();addEventListener('keydown',f);const b=r.current&&r.current.querySelector('.bs-i.on,.bs-i');b&&b.focus({preventScroll:true});return()=>removeEventListener('keydown',f)},[]);
 const g=NAV(c).filter(x=>MORE_ORD.includes(x[0])).sort((a,b)=>MORE_ORD.indexOf(a[0])-MORE_ORD.indexOf(b[0]));
 return h`<div class="mdl bsh" onClick=${onClose}><div class="bs" id="bs-more" role="dialog" aria-modal="true" aria-label="Mais seções" ref=${r} onClick=${e=>e.stopPropagation()}><div class="bs-g" aria-hidden="true"></div>
 <button class=${'ub bs-u'+(act=='perfil'?' on':'')} aria-label=${u.nome+' — abrir perfil'} onClick=${()=>nav('perfil')}><${Avatar} img=${u.img} s=${40}/><span><b>${u.nome}</b><small>Ver perfil</small></span></button>
 <div class="bs-sy"><${SyncChip} det onClick=${()=>abrirSync(nav)}/></div>
 ${g.map(([cat,its])=>{const l=its.filter(x=>!BN_IDS.includes(x[0])&&x[0]!='perfil');return l.length?h`<section key=${cat}><div class="bs-c">${cat}</div><div class="bs-gr">${l.map(([id,lb,ic])=>h`<button key=${id} class=${'bs-i'+(act==id?' on':'')} aria-current=${act==id?'page':undefined} onClick=${()=>nav(id)}><${I} n=${ic} s=${20}/><span>${lb}</span></button>`)}</div></section>`:null})}</div></div>`};
const App=()=>{const[,t]=React.useReducer(x=>x+1,0),[tip,st]=React.useState(null),[w,sw]=React.useState(1200),[more,smo]=React.useState(false),mr=React.useRef(),tab=useMQ(MQT);R=t;React.useEffect(applySet,[]);
 React.useEffect(()=>{const ro=new ResizeObserver(e=>sw(Math.round(e[0].contentRect.width)));mr.current&&ro.observe(mr.current);return()=>ro.disconnect()},[]);
 const c=me();if(c)ui.id=c.id;const v=ui.view=='wiz'&&c?'sheet':ui.view,col=!!S.set.col||tab,act=v=='wiz'?'sheet':v,nav=id=>{st(null);go(id,id=='sheet'?{tab:'ficha'}:{})},u=S.set,
 mnav=id=>{smo(false);nav(id);try{scrollTo({top:0,behavior:'instant'})}catch(e){scrollTo(0,0)}},
 tp=(l,e)=>col&&st({l,y:e.currentTarget.getBoundingClientRect().top+e.currentTarget.offsetHeight/2});
 const lab=(NAV(c).flatMap(x=>x[1]).find(x=>x[0]==act)||[])[1]||'SODUAL';document.title=(act=='lore'?'História do RPG':lab)+' — SODUAL';
 let body;
 if(v=='wiz')body=h`<${Wiz}/>`;
 else if(v=='sheet')body=c?h`<${Sheet} c=${c}/>`:h`<${NoChar}/>`;
 else if(NEED_CHAR.includes(v))body=!c?h`<${NoChar} t="Crie seu personagem para usar esta aba"/>`:v=='hist'?h`<${Hist} key=${c.id} c=${c}/>`:v=='mochila'?h`<${Bag} c=${c}/>`:v=='magias'?h`<${Cards} k="magias" sc=${MAG} t="Magias" ic="flame" cls="m" em=${['Seu grimório aguarda suas primeiras páginas','O livro ainda não traz uma lista de magias: registre as que o seu personagem conhece.','Registrar primeira magia']}/>`:h`<${Cards} k="habs" sc=${HAB} t="Habilidades" ic="sword" cls="k" em=${['Nenhuma habilidade registrada ainda','A habilidade racial escolhida na criação aparece aqui; registre as demais conforme a história avança.','Registrar habilidade']}/>`;
 else if(v=='rede')body=h`<${Net}/>`;
 else body=h`<${VIEW[v]||Lore}/>`;
 const inMore=!BN_IDS.includes(act);
 return h`<div class=${'app'+(col?' col':'')+(tab?' tab':'')+(w<1100?' wm':'')+(w<760?' ws':'')+(v=='rede'?' is-net':'')}><a class="skip" href="#main" onClick=${e=>{e.preventDefault();mr.current&&mr.current.focus()}}>Ir para o conteúdo</a><nav class="sb" aria-label="Navegação principal"><div class="sbh"><span class="lb">SODUAL</span><button class="b i sb-tg" style=${{marginLeft:'auto',background:'none',color:'#c9cffa'}} aria-label=${col?'Expandir menu':'Recolher menu'} onClick=${()=>{st(null);upd(()=>S.set.col=S.set.col?0:1)}}><${I} n=${col?'cr':'cl'} s=${18}/></button></div>
 <button class="ub" aria-label=${u.nome+' — abrir perfil'} onMouseEnter=${e=>tp(u.nome,e)} onMouseLeave=${()=>st(null)} onClick=${()=>nav('perfil')}><${Avatar} img=${u.img}/><span class="lb"><b style=${{display:'block',fontSize:'.9rem'}}>${u.nome}</b><small style=${{color:'#8f97d6'}}>Ver perfil</small></span></button>
 <div class="sbn">${NAV(c).map(([cat,its])=>h`<div key=${cat}><div class="sbc">${cat}</div>${its.map(([id,l,ic])=>h`<button key=${id} class=${'ni'+(act==id?' on':'')} aria-label=${l} aria-current=${act==id?'page':undefined} onMouseEnter=${e=>tp(l,e)} onMouseLeave=${()=>st(null)} onFocus=${e=>tp(l,e)} onBlur=${()=>st(null)} onClick=${()=>nav(id)}><${I} n=${ic} s=${19}/><span class="lb">${l}</span></button>`)}</div>`)}</div><div class="sbf"><${SyncChip} onClick=${()=>abrirSync(nav)}/><span id="st"></span></div></nav><${MigrarNuvem}/><${ConflitoModal}/><${SyncAvisos}/>
 ${tip&&h`<div class="tip" style=${{top:tip.y,left:'calc(var(--sw) + 8px)'}}>${tip.l}</div>`}
 <main id="main" tabIndex="-1" aria-label=${lab} ref=${mr} class=${v=='rede'?'full':''}><${AP} mode="wait"><${MD} key=${v+(v=='sheet'?ui.tab:'')} initial=${{opacity:0,y:8}} animate=${{opacity:1,y:0}} exit=${{opacity:0}}>${body}<//><//></main><${Res}/>
 ${more&&h`<${More} c=${c} act=${act} nav=${mnav} onClose=${()=>smo(false)}/>`}
 <nav class="bn noprint" aria-label="Navegação principal">${BN.map(([id,l,ic])=>h`<button key=${id} class=${'bn-i'+(act==id&&!more?' on':'')} aria-current=${act==id?'page':undefined} onClick=${()=>mnav(id)}><${I} n=${ic} s=${22}/><span>${l}</span></button>`)}<button class=${'bn-i'+(more||inMore?' on':'')} aria-haspopup="dialog" aria-expanded=${more} aria-controls="bs-more" aria-label=${inMore&&!more?'Mais seções (atual: '+lab+')':'Mais seções'} onClick=${()=>{st(null);smo(!more)}}><${I} n="menu" s=${22}/><span>Mais</span><${SyncDot}/></button></nav></div>`};
/* Gate (src/auth.js) só monta o App depois que o Supabase confirma uma sessão válida. */
ReactDOM.createRoot(document.getElementById('root')).render(h`<${Gate}/>`);
