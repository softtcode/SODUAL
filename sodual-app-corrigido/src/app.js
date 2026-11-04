const NAV=m=>[['NAVEGAÇÃO',[['lore','História do RPG','map'],['sheet','Meu personagem','scroll'],['rede','Rede de Conexões','net']]],['PERSONAGEM',[['hist',m&&m.nome?'História de '+m.nome:'História do personagem','pen'],['mochila','Mochila','shield'],['magias','Magias','flame'],['habs','Habilidades','sword']]],['COMPÊNDIO',[['livro','Livro de regras','book'],['biblioteca','Biblioteca','lib']]],['SISTEMA',[['perfil','Meu perfil','user'],['config','Configurações','sliders'],['ajuda','Ajuda','help']]]];
/* Celular (<768px): barra inferior com os destinos mais usados; o restante fica no painel "Mais". Usa os mesmos destinos de NAV e o mesmo go(). */
const BN=[['lore','Início','map'],['sheet','Ficha','scroll'],['mochila','Mochila','shield'],['magias','Magias','flame']],BN_IDS=BN.map(x=>x[0]),MORE_ORD=['PERSONAGEM','NAVEGAÇÃO','COMPÊNDIO','SISTEMA'];
IC.menu='M4 6h16 M4 12h16 M4 18h16';
const MQ=window.matchMedia?matchMedia('(prefers-color-scheme: light)'):null;
function applySet(){const r=document.documentElement,t=S.set.theme=='auto'?(MQ&&MQ.matches?'light':'dark'):S.set.theme;r.dataset.theme=t;r.style.setProperty('--ac',S.set.ac||'#7b4be8');const m=document.querySelector('meta[name=theme-color]');m&&m.setAttribute('content',t=='light'?'#ecebf8':'#0b1030');try{localStorage.setItem('sodual.tema',JSON.stringify({theme:S.set.theme,ac:S.set.ac}))}catch(e){}}
MQ&&MQ.addEventListener&&MQ.addEventListener('change',()=>{S.set.theme=='auto'&&applySet()});
const NEED_CHAR=['hist','mochila','magias','habs'],VIEW={lore:Lore,livro:Book,biblioteca:Lib,perfil:Profile,config:Config,ajuda:Help};
const More=({c,act,nav,onClose})=>{const r=React.useRef(),u=S.set;
 React.useEffect(()=>{const f=e=>e.key=='Escape'&&onClose();addEventListener('keydown',f);const b=r.current&&r.current.querySelector('.bs-i.on,.bs-i');b&&b.focus({preventScroll:true});return()=>removeEventListener('keydown',f)},[]);
 const g=NAV(c).filter(x=>MORE_ORD.includes(x[0])).sort((a,b)=>MORE_ORD.indexOf(a[0])-MORE_ORD.indexOf(b[0]));
 return h`<div class="mdl bsh" onClick=${onClose}><div class="bs" id="bs-more" role="dialog" aria-modal="true" aria-label="Mais seções" ref=${r} onClick=${e=>e.stopPropagation()}><div class="bs-g" aria-hidden="true"></div>
 <button class=${'ub bs-u'+(act=='perfil'?' on':'')} aria-label=${u.nome+' — abrir perfil'} onClick=${()=>nav('perfil')}><${Avatar} img=${u.img} s=${40}/><span><b>${u.nome}</b><small>Ver perfil</small></span></button>
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
 else if(NEED_CHAR.includes(v))body=!c?h`<${NoChar} t="Crie seu personagem para usar esta aba"/>`:v=='hist'?h`<${Hist} key=${c.id} c=${c}/>`:v=='mochila'?h`<${Bag} c=${c}/>`:v=='magias'?h`<${Cards} k="magias" sc=${MAG} t="Magias" ic="flame" cls="m" em=${['Nenhuma magia no grimório','O livro ainda não traz uma lista de magias. Registre aqui as que o seu personagem conhece, com os campos que fizerem sentido.','Registrar primeira magia']}/>`:h`<${Cards} k="habs" sc=${HAB} t="Habilidades" ic="sword" cls="k" em=${['Nenhuma habilidade registrada','Registre as habilidades do personagem. A habilidade racial escolhida na criação já aparece aqui.','Registrar habilidade']}/>`;
 else if(v=='rede')body=h`<${Net}/>`;
 else body=h`<${VIEW[v]||Lore}/>`;
 const inMore=!BN_IDS.includes(act);
 return h`<div class=${'app'+(col?' col':'')+(tab?' tab':'')+(w<1100?' wm':'')+(w<760?' ws':'')+(v=='rede'?' is-net':'')}><a class="skip" href="#main" onClick=${e=>{e.preventDefault();mr.current&&mr.current.focus()}}>Ir para o conteúdo</a><nav class="sb" aria-label="Navegação principal"><div class="sbh"><span class="lb">SODUAL</span><button class="b i sb-tg" style=${{marginLeft:'auto',background:'none',color:'#c9cffa'}} aria-label=${col?'Expandir menu':'Recolher menu'} onClick=${()=>{st(null);upd(()=>S.set.col=S.set.col?0:1)}}><${I} n=${col?'cr':'cl'} s=${18}/></button></div>
 <button class="ub" aria-label=${u.nome+' — abrir perfil'} onMouseEnter=${e=>tp(u.nome,e)} onMouseLeave=${()=>st(null)} onClick=${()=>nav('perfil')}><${Avatar} img=${u.img}/><span class="lb"><b style=${{display:'block',fontSize:'.9rem'}}>${u.nome}</b><small style=${{color:'#8f97d6'}}>Ver perfil</small></span></button>
 <div class="sbn">${NAV(c).map(([cat,its])=>h`<div key=${cat}><div class="sbc">${cat}</div>${its.map(([id,l,ic])=>h`<button key=${id} class=${'ni'+(act==id?' on':'')} aria-label=${l} aria-current=${act==id?'page':undefined} onMouseEnter=${e=>tp(l,e)} onMouseLeave=${()=>st(null)} onFocus=${e=>tp(l,e)} onBlur=${()=>st(null)} onClick=${()=>nav(id)}><${I} n=${ic} s=${19}/><span class="lb">${l}</span></button>`)}</div>`)}</div><div class="sbf"><span id="st"></span></div></nav>
 ${tip&&h`<div class="tip" style=${{top:tip.y,left:'calc(var(--sw) + 8px)'}}>${tip.l}</div>`}
 <main id="main" tabIndex="-1" aria-label=${lab} ref=${mr} class=${v=='rede'?'full':''}><${AP} mode="wait"><${MD} key=${v+(v=='sheet'?ui.tab:'')} initial=${{opacity:0,y:8}} animate=${{opacity:1,y:0}} exit=${{opacity:0}}>${body}<//><//></main><${Res}/>
 ${more&&h`<${More} c=${c} act=${act} nav=${mnav} onClose=${()=>smo(false)}/>`}
 <nav class="bn noprint" aria-label="Navegação principal">${BN.map(([id,l,ic])=>h`<button key=${id} class=${'bn-i'+(act==id&&!more?' on':'')} aria-current=${act==id?'page':undefined} onClick=${()=>mnav(id)}><${I} n=${ic} s=${22}/><span>${l}</span></button>`)}<button class=${'bn-i'+(more||inMore?' on':'')} aria-haspopup="dialog" aria-expanded=${more} aria-controls="bs-more" aria-label=${inMore&&!more?'Mais seções (atual: '+lab+')':'Mais seções'} onClick=${()=>{st(null);smo(!more)}}><${I} n="menu" s=${22}/><span>Mais</span></button></nav></div>`};
/* Gate (src/auth.js) só monta o App depois que o Supabase confirma uma sessão válida. */
ReactDOM.createRoot(document.getElementById('root')).render(h`<${Gate}/>`);
