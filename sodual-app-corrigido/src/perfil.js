/* ===== Meu Perfil — identidade do jogador =====
   Dados: S.set (nome, img, imgSrc, imgCrop) e S.set.perfil {titulo, bio, moldura, banner, insignias} — ver normPerfil em rules.js.
   Tudo fica no armazenamento local da conta (mesmo das fichas); não há sincronização entre dispositivos.
   Moldura = camada independente SOBRE a foto (a foto original nunca é alterada). Sem arte definitiva, a moldura/banner aparecem
   como prévia provisória identificada. Para instalar a arte: preencha `arte` em PF_MOLD/PF_BAN (rules.js) com o caminho do PNG/WebP. */
const pfArte=a=>a=='dragao-login'?((window.IMGS&&IMGS['dragao-login'])||'assets/dragao-login.webp'):a;
/* Avatar + moldura opcional por cima (camada separada, proporcional ao avatar). */
const AvatarMold=({img,s=176,ic=78,mold})=>{const m=PF_MOLD.find(x=>x.id==mold);
 return h`<span class=${'avm'+(m?' com':'')} style=${{width:s,height:s,'--fc':m?m.cor:'transparent'}}><${Avatar} img=${img} s=${s} ic=${ic}/>
  ${m&&(m.arte?h`<img class="avm-f" src=${m.arte} alt="" aria-hidden="true" draggable="false"/>`:h`<span class="avm-f prov" aria-hidden="true"></span>`)}</span>`};
const BannerPf=({id,tag=true})=>{const b=PF_BAN.find(x=>x.id==(id||''))||PF_BAN[0],img=b.arte&&b.arte!='padrao'?pfArte(b.arte):'';
 return h`<div class=${'pf-ban'+(img?' img':'')+(!b.arte?' prov pf-ban--'+b.id:'')} style=${img?{backgroundImage:`url(${img})`}:undefined} aria-hidden="true">${!b.arte&&tag&&h`<span class="pf-prov">Arte provisória</span>`}</div>`};
const Insignias=({ids})=>ids&&ids.length?h`<ul class="pf-ins" aria-label="Insígnias">${ids.map(id=>{const x=PF_INS.find(i=>i.id==id);return x&&h`<li key=${id}><${I} n=${x.ic} s=${14}/>${x.nome}</li>`})}</ul>`:null;

/* ===== Editor do perfil (modal) =====
   Rascunho local com prévia ao vivo: nome, biografia, banner, moldura, título e insígnias só são gravados em "Salvar perfil".
   A foto é a exceção: trocar, enquadrar e remover usam as funções de sempre (useEditorImagem/limparImagem) e são salvas na hora.
   Fechar com alterações não salvas pede confirmação. Se o salvamento falhar (armazenamento cheio), nada muda e o erro aparece. */
const ABAS_PF=[['info','Informações','user'],['foto','Foto e banner','camera'],['mold','Moldura','star'],['tit','Título','scroll'],['ins','Insígnias','shield']];
const ABA_ANT={bio:'info',ban:'foto'};
const EditorPerfil=({onClose,inicio,fx})=>{const u=S.set,ini=React.useRef(null),[d,sd]=React.useState(()=>({...normPerfil(u.perfil),nome:u.nome||''})),[ab,sab]=React.useState(ABA_ANT[inicio]||inicio||'info'),
  [er,ser]=React.useState(''),[rm,srm]=React.useState(false),set=(k,v)=>{ser('');sd(x=>({...x,[k]:v}))};
 if(ini.current==null)ini.current=JSON.stringify(d);
 const sujo=JSON.stringify(d)!==ini.current,
  fechar=()=>{if(sujo&&!confirm('Descartar as alterações do perfil que ainda não foram salvas?'))return;onClose()},
  salvar=()=>{const ant={nome:u.nome,perfil:u.perfil},nome=textoSimples(d.nome,40).trim();if(!nome){ser('Informe um nome.');sab('info');return}
   u.nome=nome;u.perfil=normPerfil(d);if(!save()){u.nome=ant.nome;u.perfil=ant.perfil;ser('Não foi possível salvar: armazenamento do navegador cheio. Nada foi alterado; exporte um backup e tente de novo.');return}
   R();toast('Perfil atualizado','ok');onClose()},
  op=(on,fn,ch,extra={})=>h`<button type="button" class=${'pf-op'+(on?' on':'')} aria-pressed=${on} onClick=${fn} ...${extra}>${ch}</button>`;
 let corpo;
 if(ab=='info')corpo=h`<label class="fld">Nome<input type="text" maxLength=${40} value=${d.nome} onChange=${e=>set('nome',e.target.value)} onInput=${e=>set('nome',e.target.value)} autoComplete="nickname"/></label>
  <label class="fld pf-bio-f">Sobre mim<textarea rows="7" maxLength=${PF_BIO_MAX} value=${d.bio} placeholder="Quem é você à mesa? Conte sobre seu jeito de jogar, suas campanhas e personagens favoritos. Quebras de linha são preservadas." onChange=${e=>set('bio',textoSimples(e.target.value,PF_BIO_MAX))}></textarea></label>
  <p class=${'pf-cont'+(d.bio.length>=PF_BIO_MAX?' max':'')} aria-live="polite">${d.bio.length}/${PF_BIO_MAX} caracteres</p>`;
 else if(ab=='foto')corpo=h`<section class="pf-ed-s"><h3>Foto de perfil</h3><p class="pf-dica">A foto é salva na hora, separada das demais alterações.</p>
   <div class="pf-ed-foto"><${AvatarMold} img=${u.img} s=${72} ic=${30} mold=${d.moldura}/><div class="pf-ed-ac">${rm?h`<span class="pf-cf">Remover a foto de perfil? <${B} p onClick=${()=>{upd(()=>limparImagem(u));srm(false);toast('Foto removida','ok')}}>Remover<//><${B} onClick=${()=>srm(false)}>Manter<//></span>`
    :h`<${B} ic="camera" onClick=${fx.escolher}>${u.img?'Trocar foto':'Escolher foto'}<//>${u.img&&h`<${B} ic="crop" onClick=${fx.ajustar}>Enquadrar<//><${B} ic="trash" class="b dng" onClick=${()=>srm(true)}>Remover<//>`}`}</div></div></section>
  <section class="pf-ed-s"><h3>Banner</h3><div class="pf-grade ban">${PF_BAN.map(b=>op((d.banner||'')==b.id,()=>set('banner',b.id),h`<${BannerPf} id=${b.id} tag=${false}/><span>${b.nome}</span>${!b.arte&&h`<small>Prévia provisória</small>`}`,{key:b.id||'padrao'}))}</div>
  <p class="pf-dica">Banners com arte provisória serão trocados pela arte definitiva quando ela for fornecida; sua escolha continua salva.</p></section>`;
 else if(ab=='mold')corpo=h`<p class="pf-dica">As molduras ficam por cima da foto, sem alterá-la.</p><div class="pf-grade">${op(!d.moldura,()=>set('moldura',''),h`<${AvatarMold} img=${u.img} s=${64} ic=${28}/><span>Sem moldura</span>`)}
  ${PF_MOLD.map(m=>op(d.moldura==m.id,()=>set('moldura',m.id),h`<${AvatarMold} img=${u.img} s=${64} ic=${28} mold=${m.id}/><span>${m.nome}</span>${!m.arte&&h`<small>Prévia provisória</small>`}`,{key:m.id}))}</div>`;
 else if(ab=='tit')corpo=h`<div class="pf-lista">${op(!d.titulo,()=>set('titulo',''),'Sem título')}${PF_TIT.map(t=>op(d.titulo==t,()=>set('titulo',t),t,{key:t}))}</div><p class="pf-dica">Títulos são cosméticos e não dependem de conquistas.</p>`;
 else corpo=h`<p class="pf-dica">Escolha até ${PF_INS_MAX} insígnias. As bloqueadas dependem de regras de obtenção que ainda não existem.</p><div class="pf-lista">${PF_INS.map(x=>{const on=d.insignias.includes(x.id),liv=x.tipo=='livre';
   return op(on,()=>{if(!liv)return;set('insignias',on?d.insignias.filter(i=>i!=x.id):d.insignias.length<PF_INS_MAX?[...d.insignias,x.id]:d.insignias)},h`<${I} n=${liv?x.ic:'lock'} s=${16}/>${x.nome}${!liv&&h`<small>Em breve</small>`}`,{key:x.id,disabled:!liv,class:'pf-op'+(on?' on':'')+(liv?'':' bloq')})})}</div>`;
 return h`<${Modal} t="Editar perfil" onClose=${fechar}>
  <div class="pf-prev" aria-label="Prévia do perfil"><${BannerPf} id=${d.banner}/><div class="pf-prev-i"><${AvatarMold} img=${u.img} s=${84} ic=${36} mold=${d.moldura}/><div><b class="cz">${d.nome||u.nome}</b>${d.titulo&&h`<small class="pf-tit">${d.titulo}</small>`}</div></div>${d.bio&&h`<p class="pf-bio">${d.bio}</p>`}<${Insignias} ids=${d.insignias}/></div>
  <div class="pf-abas" role="tablist" aria-label="O que editar">${ABAS_PF.map(([id,l,ic])=>h`<button key=${id} type="button" role="tab" aria-selected=${ab==id} class=${ab==id?'on':''} onClick=${()=>sab(id)}><${I} n=${ic} s=${15}/>${l}</button>`)}</div>
  <div class="pf-corpo" role="tabpanel">${corpo}</div>
  ${er&&h`<div class="er" role="alert">${er}</div>`}
  <div class="row"><${B} p ic="check" onClick=${salvar}>Salvar perfil<//><${B} onClick=${fechar}>${sujo?'Descartar':'Fechar'}<//>${sujo&&h`<small class="mut pf-sujo" aria-live="polite">Alterações não salvas</small>`}</div><//>`};

/* Menu da foto (botão de câmera no avatar): Trocar, Enquadrar, Remover — as mesmas funções de sempre. Teclado, toque e Esc. */
const AvatarMenu=({img,fx,onRemover})=>{const[ab,sab]=React.useState(false),[cf,scf]=React.useState(false),cx=React.useRef(),bt=React.useRef(),fechar=()=>{sab(false);scf(false)};
 usePopover(ab,fechar,cx,bt);
 const itens=()=>cx.current?[...cx.current.querySelectorAll('[role=menuitem]')]:[];
 React.useEffect(()=>{if(ab){const l=itens();l[0]&&l[0].focus({preventScroll:true})}},[ab,cf]);
 const tecla=e=>{const l=itens(),i=l.indexOf(document.activeElement);const m={ArrowDown:(i+1)%l.length,ArrowUp:(i-1+l.length)%l.length,Home:0,End:l.length-1}[e.key];if(m!=null&&l.length){e.preventDefault();l[m].focus()}else if(e.key=='Tab')fechar()},
  ir=f=>{fechar();bt.current&&bt.current.focus({preventScroll:true});f()};
 return h`<span class="pf-avm"><button type="button" ref=${bt} class="pf-cam" aria-label="Foto de perfil: opções" aria-haspopup="menu" aria-expanded=${ab} onClick=${()=>{scf(false);sab(!ab)}}><${I} n="camera" s=${17}/></button>
  ${ab&&h`<div class="hd-pop pf-avpop" ref=${cx} role="menu" aria-label="Foto de perfil" onKeyDown=${tecla}>${cf?h`<p class="pf-avq">Remover a foto de perfil?</p><button type="button" role="menuitem" class="hd-sair" onClick=${()=>ir(onRemover)}><${I} n="trash" s=${17}/>Remover</button><button type="button" role="menuitem" onClick=${()=>scf(false)}><${I} n="left" s=${17}/>Manter a foto</button>`
   :h`<button type="button" role="menuitem" onClick=${()=>ir(fx.escolher)}><${I} n="camera" s=${17}/>${img?'Trocar foto':'Escolher foto'}</button>${img&&h`<button type="button" role="menuitem" onClick=${()=>ir(fx.ajustar)}><${I} n="crop" s=${17}/>Enquadrar</button><div class="hd-sep" role="separator"></div><button type="button" role="menuitem" class="hd-sair" onClick=${()=>scf(true)}><${I} n="trash" s=${17}/>Remover foto</button>`}`}</div>`}</span>`};

/* ===== Apresentação do perfil (reutilizável) =====
   Só exibe os dados recebidos — não lê a conta logada —, para poder mostrar no futuro o perfil de outro jogador (campanhas, lobbies).
   Ações de dono são opcionais: avatarAcoes (menu da foto) e onEditar (botão "Editar perfil"). Nenhum dado privado é exibido aqui. */
const PerfilView=({nome,img,perfil,jornada,avatarAcoes,onEditar,extraJornada})=>{const p=normPerfil(perfil);
 return h`<article class="pf-hero p1" aria-label=${'Perfil de '+nome}><${BannerPf} id=${p.banner}/>
  <div class="pf-cab">
   <div class="pf-idt"><span class="av-w pf-avw"><${AvatarMold} img=${img} s=${176} ic=${78} mold=${p.moldura}/>${avatarAcoes}</span>
    <div class="pf-tx"><div class="tg">PERFIL DO JOGADOR</div><h1 class="pf-nm">${nome}</h1>
     ${p.titulo&&h`<p class="pf-tit pf-tit-eq"><span class="sr">Título equipado: </span>${p.titulo}</p>`}<${Insignias} ids=${p.insignias}/></div>
    ${onEditar&&h`<button type="button" class="b pf-edit" onClick=${onEditar}><${I} n="pen" s=${15}/>Editar perfil</button>`}</div>
   <section class="pf-bio-b" aria-labelledby="pf-sobre"><h2 id="pf-sobre" class="pf-sec-t">Sobre mim</h2>
    ${p.bio?h`<p class="pf-bio">${p.bio}</p>`:h`<p class="pf-bio pf-vz">Este aventureiro ainda não escreveu sua história.</p>`}</section>
   ${jornada&&h`<section class="pf-jor" aria-labelledby="pf-jor-t"><h2 id="pf-jor-t" class="pf-sec-t">Jornada</h2><dl class="pf-dl">${jornada.map(([ic,t,v])=>h`<div key=${t}><dt><${I} n=${ic} s=${15}/>${t}</dt><dd>${v}</dd></div>`)}</dl>${extraJornada}</section>`}
  </div></article>`};

/* Página Meu Perfil: o dono vê a apresentação + acessos discretos à edição; a conta (dado administrativo) fica à parte. */
const Profile=()=>{const[pz,spz]=React.useState(null),c=me(),u=S.set,fx=useEditorImagem(()=>S.set,IMG_CFG.perfil,'Enquadrar foto de perfil');
 u.perfil=u.perfil||normPerfil(null);
 const jornada=[['user','Personagem principal',c?c.nome:'—'],['compass','Povo e origem',c?c.povo+' · '+c.origem:'—'],['flame','Núcleo',c&&c.nucleo?h`<${NucDot} v=${c.nucleo}/> ${nucNome(c.nucleo)}`:'—'],['net','Rede de Conexões',`${S.net.people.length} pessoa(s) · ${S.net.edges.length} conexão(ões)`]];
 return h`<div class="pf">${fx.input}
 <${PerfilView} nome=${u.nome} img=${u.img} perfil=${u.perfil} jornada=${jornada} onEditar=${()=>spz('info')}
  avatarAcoes=${h`<${AvatarMenu} img=${u.img} fx=${fx} onRemover=${()=>{upd(()=>limparImagem(u));toast('Foto removida','ok')}}/>`}
  extraJornada=${!c&&h`<div class="row pf-jor-ac"><${B} p ic="scroll" onClick=${()=>{ui.w=newW();ui.step=0;go('wiz')}}>Criar personagem<//></div>`}/>
 <section class="p2 pf-conta">${AU.u&&(([u0,d0])=>h`<h2>Conta</h2><div class="pf-acc-i"><small>Conta conectada</small><span class="pf-em" title=${AU.u.email}><${I} n="mail" s=${15}/><span>${u0}<wbr/>${d0!=null?'@'+d0:''}</span></span></div><p class="mut pf-fine">Perfil, fichas e personalização ficam salvos neste navegador, separados por conta.</p><div class="row"><${B} ic="sliders" onClick=${()=>go('config')}>Configurações<//><${Logout} cls="pf-lo"/></div>`)(String(AU.u.email).split('@'))}
  ${!AU.u&&h`<h2>Aparência</h2><p class="mut">Tema e cor de destaque ficam em Configurações.</p><${B} ic="sliders" onClick=${()=>go('config')}>Abrir Configurações<//>`}</section>
 ${pz&&h`<${EditorPerfil} inicio=${pz} fx=${fx} onClose=${()=>spz(null)}/>`}
 ${fx.modal}</div>`};