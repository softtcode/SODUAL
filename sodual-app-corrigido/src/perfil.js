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

/* Modal de personalização: rascunho local com prévia ao vivo; só grava em S.set.perfil ao clicar em Salvar. */
const ABAS_PF=[['mold','Moldura','star'],['ban','Banner','map'],['tit','Título','scroll'],['bio','Biografia','pen'],['ins','Insígnias','shield']];
const Personalizar=({onClose,inicio})=>{const u=S.set,[d,sd]=React.useState(()=>normPerfil(u.perfil)),[ab,sab]=React.useState(inicio||'mold'),set=(k,v)=>sd(x=>({...x,[k]:v})),
  salvar=()=>{upd(()=>{u.perfil=normPerfil(d)});toast('Perfil atualizado','ok');onClose()},
  op=(on,fn,ch,extra={})=>h`<button type="button" class=${'pf-op'+(on?' on':'')} aria-pressed=${on} onClick=${fn} ...${extra}>${ch}</button>`;
 let corpo;
 if(ab=='mold')corpo=h`<p class="pf-dica">As molduras ficam por cima da foto, sem alterá-la.</p><div class="pf-grade">${op(!d.moldura,()=>set('moldura',''),h`<${AvatarMold} img=${u.img} s=${64} ic=${28}/><span>Sem moldura</span>`)}
  ${PF_MOLD.map(m=>op(d.moldura==m.id,()=>set('moldura',m.id),h`<${AvatarMold} img=${u.img} s=${64} ic=${28} mold=${m.id}/><span>${m.nome}</span>${!m.arte&&h`<small>Prévia provisória</small>`}`,{key:m.id}))}</div>`;
 else if(ab=='ban')corpo=h`<div class="pf-grade ban">${PF_BAN.map(b=>op((d.banner||'')==b.id,()=>set('banner',b.id),h`<${BannerPf} id=${b.id} tag=${false}/><span>${b.nome}</span>${!b.arte&&h`<small>Prévia provisória</small>`}`,{key:b.id||'padrao'}))}</div>
  <p class="pf-dica">Banners com arte provisória serão trocados pela arte definitiva quando ela for fornecida; sua escolha continua salva.</p>`;
 else if(ab=='tit')corpo=h`<div class="pf-lista">${op(!d.titulo,()=>set('titulo',''),'Sem título')}${PF_TIT.map(t=>op(d.titulo==t,()=>set('titulo',t),t,{key:t}))}</div><p class="pf-dica">Títulos são cosméticos e não dependem de conquistas.</p>`;
 else if(ab=='bio')corpo=h`<label class="fld pf-bio-f">Biografia curta<textarea rows="4" maxLength=${PF_BIO_MAX} value=${d.bio} placeholder="Quem é você à mesa? Uma linha sobre seu jeito de jogar." onChange=${e=>set('bio',textoSimples(e.target.value,PF_BIO_MAX))}></textarea></label>
  <p class=${'pf-cont'+(d.bio.length>=PF_BIO_MAX?' max':'')} aria-live="polite">${d.bio.length}/${PF_BIO_MAX} caracteres</p>`;
 else corpo=h`<p class="pf-dica">Escolha até ${PF_INS_MAX} insígnias. As bloqueadas dependem de regras de obtenção que ainda não existem.</p><div class="pf-lista">${PF_INS.map(x=>{const on=d.insignias.includes(x.id),liv=x.tipo=='livre';
   return op(on,()=>{if(!liv)return;set('insignias',on?d.insignias.filter(i=>i!=x.id):d.insignias.length<PF_INS_MAX?[...d.insignias,x.id]:d.insignias)},h`<${I} n=${liv?x.ic:'lock'} s=${16}/>${x.nome}${!liv&&h`<small>Em breve</small>`}`,{key:x.id,disabled:!liv,class:'pf-op'+(on?' on':'')+(liv?'':' bloq')})})}</div>`;
 return h`<${Modal} t="Personalizar perfil" onClose=${onClose}>
  <div class="pf-prev" aria-label="Prévia do perfil"><${BannerPf} id=${d.banner}/><div class="pf-prev-i"><${AvatarMold} img=${u.img} s=${84} ic=${36} mold=${d.moldura}/><div><b class="cz">${u.nome}</b>${d.titulo&&h`<small class="pf-tit">${d.titulo}</small>`}</div></div>${d.bio&&h`<p class="pf-bio">${d.bio}</p>`}<${Insignias} ids=${d.insignias}/></div>
  <div class="pf-abas" role="tablist" aria-label="O que personalizar">${ABAS_PF.map(([id,l,ic])=>h`<button key=${id} type="button" role="tab" aria-selected=${ab==id} class=${ab==id?'on':''} onClick=${()=>sab(id)}><${I} n=${ic} s=${15}/>${l}</button>`)}</div>
  <div class="pf-corpo" role="tabpanel">${corpo}</div>
  <div class="row"><${B} p ic="check" onClick=${salvar}>Salvar perfil<//><${B} onClick=${onClose}>Cancelar<//></div><//>`};

const Profile=()=>{const[ed,se]=React.useState(false),[nm,sn]=React.useState(''),[rm,sr]=React.useState(false),[pz,spz]=React.useState(null),c=me(),u=S.set,fx=useEditorImagem(()=>S.set,IMG_CFG.perfil,'Enquadrar foto de perfil');
 u.perfil=u.perfil||normPerfil(null);const p=u.perfil;
 const commit=()=>{se(false);const v=nm.trim();if(v&&v!=u.nome)upd(()=>u.nome=v);toast('Nome atualizado','ok')};
 return h`<div class="pf">${fx.input}
 <section class="pf-hero p1"><${BannerPf} id=${p.banner}/>
  <div class="pf-id"><span class="av-w"><button class="pf-av" onClick=${fx.escolher} aria-label=${u.img?'Substituir foto de perfil':'Escolher foto de perfil'}><${AvatarMold} img=${u.img} s=${176} ic=${78} mold=${p.moldura}/><span class="pf-ov" aria-hidden="true"></span><span class="pf-cam" aria-hidden="true"><${I} n="camera" s=${18}/></span></button>${u.img&&h`<button type="button" class="av-adj" onClick=${fx.ajustar} aria-label="Ajustar enquadramento da foto de perfil" title="Ajustar enquadramento"><${I} n="crop" s=${16}/></button>`}</span>
  <div class="pf-tx"><div class="tg">PERFIL DO JOGADOR</div>
   ${ed?h`<input class="pf-in" autoFocus aria-label="Nome do usuário" value=${nm} maxLength=${40} onChange=${e=>sn(e.target.value)} onInput=${e=>sn(e.target.value)} onKeyDown=${e=>{if(e.key=='Enter')commit();if(e.key=='Escape')se(false)}} onBlur=${commit}/>`:h`<h1 class="pf-nm">${u.nome}<button class="b i" aria-label="Editar nome" onClick=${()=>{sn(u.nome);se(true)}}><${I} n="pen" s=${16}/></button></h1>`}
   ${p.titulo?h`<p class="pf-tit pf-tit-eq"><span class="sr">Título equipado: </span>${p.titulo}</p>`:h`<button type="button" class="lk pf-add" onClick=${()=>spz('tit')}>+ Escolher um título</button>`}
   ${p.bio?h`<p class="pf-bio">${p.bio}</p>`:h`<button type="button" class="lk pf-add" onClick=${()=>spz('bio')}>+ Escrever uma biografia curta</button>`}
   <${Insignias} ids=${p.insignias}/>
   <div class="row pf-acts"><${B} p ic="star" onClick=${()=>spz('mold')}>Personalizar perfil<//><div class="pf-foto" role="group" aria-label="Foto de perfil">${!rm&&h`<${B} ic="camera" onClick=${fx.escolher}>${u.img?'Trocar foto':'Escolher foto'}<//>`}${u.img&&!rm&&h`<${B} ic="crop" onClick=${fx.ajustar}>Enquadrar<//><${B} ic="trash" class="b dng" onClick=${()=>sr(true)}>Remover foto<//>`}${rm&&h`<span class="pf-cf">Remover a foto de perfil? <${B} p onClick=${()=>{upd(()=>limparImagem(u));sr(false);toast('Foto removida','ok')}}>Remover<//><${B} onClick=${()=>sr(false)}>Manter<//></span>`}</div></div>
  </div></div></section>
 <div class="pf-grid">
  <section class="p2 pf-jor"><h2>Jornada</h2><dl class="pf-dl"><div><dt><${I} n="user" s=${15}/>Personagem principal</dt><dd>${c?c.nome:'—'}</dd></div><div><dt><${I} n="compass" s=${15}/>Povo e origem</dt><dd>${c?c.povo+' · '+c.origem:'—'}</dd></div><div><dt><${I} n="flame" s=${15}/>Núcleo</dt><dd>${c&&c.nucleo?h`<${NucDot} v=${c.nucleo}/> ${nucNome(c.nucleo)}`:'—'}</dd></div><div><dt><${I} n="net" s=${15}/>Rede de Conexões</dt><dd>${S.net.people.length} pessoa(s) · ${S.net.edges.length} conexão(ões)</dd></div></dl>
   ${!c&&h`<div class="row"><${B} p ic="scroll" onClick=${()=>{ui.w=newW();ui.step=0;go('wiz')}}>Criar personagem<//></div>`}</section>
  <section class="p2 pf-conta">${AU.u&&(([u0,d0])=>h`<h2>Conta</h2><div class="pf-acc-i"><small>Conta conectada</small><span class="pf-em" title=${AU.u.email}><${I} n="mail" s=${15}/><span>${u0}<wbr/>${d0!=null?'@'+d0:''}</span></span></div><p class="mut pf-fine">Perfil, fichas e personalização ficam salvos neste navegador, separados por conta.</p><div class="row"><${B} ic="sliders" onClick=${()=>go('config')}>Configurações<//><${Logout} cls="pf-lo"/></div>`)(String(AU.u.email).split('@'))}
   ${!AU.u&&h`<h2>Aparência</h2><p class="mut">Tema e cor de destaque ficam em Configurações.</p><${B} ic="sliders" onClick=${()=>go('config')}>Abrir Configurações<//>`}</section>
 </div>
 ${pz&&h`<${Personalizar} inicio=${pz} onClose=${()=>spz(null)}/>`}
 ${fx.modal}</div>`};
