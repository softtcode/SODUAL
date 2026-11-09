/* ===== Landing page pública (apresentação do SODUAL) — versão 2.0 =====
   Mostrada antes do login para visitantes. Não acessa dados de conta nem o Supabase: os botões só levam à tela de login/cadastro existente.
   Rotas por hash (sem roteador): "#apresentacao" mostra esta página a qualquer pessoa (inclusive logada, sem encerrar a sessão);
   "#entrar" mostra o login. Ver Gate em src/auth.js.
   Textos baseados no Livro I (ed. 0.3) e em src/lore.js — nada de história, lugar ou entidade foi inventado.
   Demonstrações: usam as funções reais de regras (normFerimentos, wound, pen, progresso, NUC, regra dos D20) sobre objetos LOCAIS,
   criados só para a demonstração: nada é salvo, nenhuma ficha é lida ou alterada e não há chamada de rede.
   ARTES: LAND_ART concentra as imagens. Para usar artes próprias, troque os caminhos (ex.: 'assets/landing-hero.webp') e mantenha width/height. */
Object.assign(IC,{chev:'M6 9l6 6 6-6',zoom:'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M21 21l-4.3-4.3 M11 8v6 M8 11h6',reset:'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5'});
const LAND_ART={
 hero:{src:()=>(window.IMGS&&IMGS['dragao-login'])||'assets/dragao-login.webp',w:1312,h:1199,alt:'Um pequeno dragão roxo, em pixel art, enrolado sobre uma pedra sob um céu estrelado'},
 mapa:{src:()=>IMG('mapa'),alt:'Mapa do continente de Sodual, com florestas, montanhas, desertos, regiões geladas, lagos e arquipélagos'},
 dragao:{src:()=>IMG('dragao'),alt:'Ilustração de um dragão de Sodual'},
 povo:{src:()=>IMG('darnio'),alt:'Ilustração de um Dárnio, um dos três povos de Bevon'}};
/* Cards do sistema: textos curtos (2–3 linhas), mesmas regras de antes. */
const LAND_MEC=[['scroll','Criação de personagens','Povo, origem, atributos, perícias e habilidade racial, tudo conferido pelas regras do Livro I.'],
 ['flame','Mana e núcleo','Role sua reserva de mana e acompanhe o núcleo do Preto ao Branco. Quantidade não é controle.'],
 ['sword','Combate e consequências','Sem pontos de vida: ferimentos por região, estado Fatal e até a perda de um membro.'],
 ['pen','Histórias e evolução','Registre a trajetória, os vínculos e cada passo do núcleo do seu personagem.']];
/* ===== Céu estrelado (decorativo) =====
   Gerado UMA vez, na carga do script, com um gerador pseudoaleatório de semente fixa (mulberry32): as posições são sempre as mesmas
   e nada é sorteado durante a renderização. Amostragem estratificada (uma ou duas estrelas por célula de uma grade, com deslocamento
   aleatório) evita aglomerados e padrões geométricos. Desempenho: as estrelas fixas não animam; as que cintilam ficam em 3 grupos e
   apenas a opacidade de cada GRUPO é animada; só ~8 estrelas brilhantes animam sozinhas (transform/opacity). */
const LD_SKY=(()=>{let s=0x50da1;const r=()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
 const COR=['#f4f1ff','#f4f1ff','#efe9ff','#e2d6ff','#d3bfff','#bfa8ff','#d6e8ff','#c3dcff'],W=1600,H=1000,CX=20,CY=13,o={fixas:[],tw:[[],[],[]],bri:[]};
 for(let i=0;i<CX;i++)for(let j=0;j<CY;j++){const n=r()<.3?2:1;for(let k=0;k<n;k++){const z=r(),st={x:+((i+r())*W/CX).toFixed(1),y:+((j+r())*H/CY).toFixed(1),
   r:+(z<.7?.5+r()*.6:z<.94?1.1+r()*.6:1.7+r()*.7).toFixed(2),c:COR[Math.floor(r()*COR.length)],a:+(z<.25?.12+r()*.15:.3+r()*.6).toFixed(2)};
  if(r()<.2)o.tw[Math.floor(r()*3)].push(st);else o.fixas.push(st)}}
 for(let k=0;k<8;k++)o.bri.push({x:+(80+r()*(W-160)).toFixed(1),y:+(60+r()*(H-120)).toFixed(1),s:+(.6+r()*.7).toFixed(2),c:k%4==3?'#f0c76a':k%2?'#e2d6ff':'#f4f1ff',d:+(5+r()*6).toFixed(1),t:+(-r()*10).toFixed(1)});
 return o})();
const Ceu=React.memo(()=>{const dot=(x,i)=>h`<circle key=${i} cx=${x.x} cy=${x.y} r=${x.r} fill=${x.c} opacity=${x.a}/>`;
 return h`<div class="ld-sky" aria-hidden="true"><svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
  <defs><radialGradient id="ld-gl"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="#d9c6ff" stop-opacity=".35"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient></defs>
  <g class="ld-sky-d">${LD_SKY.fixas.map(dot)}${LD_SKY.tw.map((g,i)=>h`<g key=${i} class=${'ld-tw ld-tw'+i}>${g.map(dot)}</g>`)}</g>
  ${LD_SKY.bri.map((b,i)=>h`<g key=${'b'+i} transform=${`translate(${b.x} ${b.y}) scale(${b.s})`}><g class="ld-bri" style=${{animationDuration:b.d+'s',animationDelay:b.t+'s'}}><circle r="9" fill="url(#ld-gl)"/><path d="M0-7 .9-.9 7 0 .9.9 0 7-.9.9-7 0-.9-.9Z" fill=${b.c}/></g></g>`)}
 </svg></div>`});
/* Ornamentos reutilizáveis (decorativos, ocultos de leitores de tela). */
const Orn=()=>h`<div class="ld-orn" aria-hidden="true"><i></i><svg viewBox="0 0 40 12" width="40" height="12"><path d="M20 0l3 6-3 6-3-6z M6 6h8 M26 6h8" fill="currentColor" stroke="currentColor" stroke-width=".8"/></svg><i></i></div>`;
const Cantos=()=>['tl','tr','bl','br'].map(p=>h`<svg key=${p} class=${'ld-canto '+p} viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M2 24V8a6 6 0 0 1 6-6h16 M2 14c6 0 12-6 12-12" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg>`);

/* ===== Modal acessível (mapa ampliado): Esc fecha, foco preso no diálogo, rolagem do fundo travada, foco devolvido ao abrir-o. ===== */
const LdModal=({titulo,onClose,children})=>{const box=React.useRef(),fechar=React.useRef();
 React.useEffect(()=>{const antes=document.activeElement,ov=document.body.style.overflow;document.body.style.overflow='hidden';fechar.current&&fechar.current.focus();
  const k=e=>{if(e.key=='Escape'){e.preventDefault();onClose();return}if(e.key!='Tab')return;const f=[...box.current.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])')];if(!f.length)return;
   const a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement==a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement==z){e.preventDefault();a.focus()}};
  document.addEventListener('keydown',k);return()=>{document.removeEventListener('keydown',k);document.body.style.overflow=ov;antes&&antes.focus&&antes.focus()}},[]);
 return ReactDOM.createPortal(h`<div class="ld-mdl" onClick=${onClose}><div class="ld-mdl-b" role="dialog" aria-modal="true" aria-label=${titulo} ref=${box} onClick=${e=>e.stopPropagation()}>
  <div class="ld-mdl-h"><h2>${titulo}</h2><button type="button" class="ld-x" ref=${fechar} onClick=${onClose} aria-label="Fechar mapa"><${I} n="x" s=${20}/></button></div>${children}</div></div>`,document.body)};

/* ===== Demonstração 1: ferimentos (motor real sobre uma ficha local) ===== */
const CENAS=[['Ileso',{}],['Escaramuça',{bd:{g:1,h:1},tronco:{g:2,h:1}}],['Batalha dura',{cabeca:{g:1,h:1},tronco:{g:3,h:1},be:{g:4,h:1},pd:{g:2,h:1}}],
 ['Condição crítica',{tronco:{g:5,h:0},pe:{g:3,h:1}}],['Membro perdido',{tronco:{g:4,h:1},be:{g:5,h:0,amp:1}}]];
const cena=i=>{const c=normFerimentos({w:{}});Object.entries(CENAS[i][1]).forEach(([k,v])=>Object.assign(c.w[k],v));return c};
const DemoFer=()=>{const[ci,sci]=React.useState(2),[rg,srg]=React.useState('tronco'),[,tick]=React.useReducer(x=>x+1,0),ref=React.useRef(null),[ev,sev]=React.useState(null);
 if(!ref.current)ref.current=cena(2);const c=ref.current,w=c.w[rg],pg=progresso(c,rg),
  usar=i=>{ref.current=cena(i);sci(i);sev(null);tick()},
  ferir=g=>{sev(wound(c,rg,g));tick()};
 return h`<div class="ld-demo-g ld-fer">
  <div class="ld-sil-w"><${Sil} c=${c} size=${210} leg=${false} sel=${rg} onPick=${k=>{srg(k);sev(null)}}/></div>
  <div class="ld-info">
   <div class="ld-chips" role="group" aria-label="Exemplos prontos">${CENAS.map(([n],i)=>h`<button key=${n} type="button" class=${'ld-chip'+(ci==i?' on':'')} aria-pressed=${ci==i} onClick=${()=>usar(i)}>${n}</button>`)}</div>
   <div class="ld-reg" aria-live="polite"><small>Região selecionada</small><h3>${RG[rg][0]}${ehMembro(rg)&&h` <span class=${'ld-st'+(w.amp?' bad':'')}>${membro(c,rg)}</span>`}</h3>
    <p><span class="pill" style=${{background:GC[w.g]}}>${GN[w.g]}</span> Penalidade <b>${pen(c,rg)}</b>${pg?h` · Progressão para ${GN[w.g+1]}: <b>${pg.h}/${pg.n}</b>`:''}</p>
    ${c.dead&&h`<p class="ld-alerta">Morte imediata: outra região já estava Fatal.</p>`}</div>
   <div class="ld-acoes"><span>Registrar ferimento:</span>${[1,2,3].map(g=>h`<button key=${g} type="button" class="ld-mini" onClick=${()=>ferir(g)}>${GN[g]}</button>`)}<button type="button" class="ld-mini ghost" onClick=${()=>usar(ci)} aria-label="Restaurar exemplo"><${I} n="reset" s=${14}/></button></div>
   ${ev&&h`<p class="ld-ev" aria-live="polite">${descreverEvento(ev)}</p>`}
   <p class="ld-nota">Toque numa região do corpo. As regras são as do aplicativo; nada aqui é salvo.</p>
  </div></div>`};

/* ===== Demonstração 2: estágios do núcleo (ordem oficial NUC, só visual — os estágios não têm efeito mecânico) ===== */
const DemoNuc=()=>{const[i,si]=React.useState(4),n=NUC[i],cor=NUC_C[n],mov=d=>si(Math.max(0,Math.min(NUC.length-1,i+d)));
 return h`<div class="ld-demo-g ld-nucd">
  <div class="ld-orbe-w" aria-hidden="true"><span class="ld-orbe" style=${{'--nc':cor}}></span></div>
  <div class="ld-info">
   <div class="ld-reg" aria-live="polite"><small>Estágio ${i+1} de ${NUC.length}</small><h3>${n}</h3><p>O núcleo fica no centro do abdômen e se desenvolve com o tempo. Estágio superior não garante vitória, reserva maior nem domínio perfeito da mana.</p></div>
   <div class="ld-nucs" role="radiogroup" aria-label="Estágios do núcleo" onKeyDown=${e=>{const d={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];if(d){e.preventDefault();mov(d);const g=e.currentTarget;requestAnimationFrame(()=>{const b=g.querySelector('[aria-checked="true"]');b&&b.focus()})}}}>
    ${NUC.map((x,k)=>h`<button key=${x} type="button" role="radio" aria-checked=${k==i} tabIndex=${k==i?0:-1} aria-label=${(k+1)+'. '+x} title=${x} class=${k==i?'on':''} style=${{'--nc':NUC_C[x]}} onClick=${()=>si(k)}></button>`)}</div>
   <div class="ld-nuc-l"><span>Preto (inicial)</span><span>Branco</span></div>
  </div></div>`};

/* ===== Demonstração 3: teste de D20 — mesma regra de roll() em rules.js:
   atributo > 0 rola tantos D20 quanto o atributo e mantém o maior; atributo 0 rola 2D20 e mantém o menor; soma o grau da perícia. ===== */
const DemoDado=()=>{const[a,sa]=React.useState(2),[g,sg]=React.useState(2),[res,sr]=React.useState(null),[n,sn]=React.useState(0),
 rolar=()=>{const q=a>0?a:2,d=Array.from({length:q},()=>rnd(20)),k=a>0?Math.max(...d):Math.min(...d);sr({d,k,i:d.indexOf(k),sk:g,t:k+g});sn(n+1)};
 return h`<div class="ld-demo-g ld-dado">
  <div class="ld-info">
   <div class="ld-campos"><label>Atributo<select value=${a} onChange=${e=>{sa(+e.target.value);sr(null)}}>${[0,1,2,3,4,5].map(v=>h`<option key=${v} value=${v}>${v}${v==0?' (2D20, o menor)':v==1?' (1D20)':' ('+v+'D20, o maior)'}</option>`)}</select></label>
    <label>Perícia<select value=${g} onChange=${e=>{sg(+e.target.value);sr(null)}}>${GRD.map(([l,v])=>h`<option key=${v} value=${v}>${l} (+${v})</option>`)}</select></label></div>
   <button type="button" class="b p ld-rolar" onClick=${rolar}><${I} n="dice" s=${18}/>Rolar ${a>0?a:2}D20</button>
   <p class="ld-nota">Atributo 0 rola 2D20 e fica com o menor. Nada aqui é salvo.</p>
  </div>
  <div class="ld-mesa" aria-live="polite">${res?h`<div class="ld-dados" key=${n}>${res.d.map((v,i)=>h`<span key=${i} class=${'ld-d'+(i==res.i?' on':'')} style=${{'--i':i}}>${v}</span>`)}</div>
   <p class="ld-conta">Dado mantido <b>${res.k}</b> + perícia <b>${res.sk}</b> = <strong>${res.t}</strong>${res.k==20&&a>0?h` <span class="ld-st">20 natural</span>`:''}</p>`
   :h`<p class="ld-vazio">Escolha o atributo e a perícia e role.</p>`}</div></div>`};

const ABAS=[['fer','Ferimentos','shield','Cada região do corpo tem o próprio grau de ferimento e a própria progressão. Escolha um exemplo, toque numa região e registre ferimentos para ver as regras reais em ação.',DemoFer],
 ['nuc','Núcleo','flame','Do Preto ao Branco: explore a sequência de estágios do núcleo de mana usada no aplicativo.',DemoNuc],
 ['dado','Rolagens','dice','Testes com D20: o atributo define quantos dados você rola e qual resultado fica; a perícia soma ao final.',DemoDado]];
const Demos=()=>{const[t,st]=React.useState(0),tabs=React.useRef([]),D=ABAS[t][4],
 tecla=e=>{const d={ArrowRight:1,ArrowLeft:-1,Home:-9,End:9}[e.key];if(!d)return;e.preventDefault();const n=d==-9?0:d==9?ABAS.length-1:(t+d+ABAS.length)%ABAS.length;st(n);tabs.current[n]&&tabs.current[n].focus()};
 return h`<div class="ld-app-g">
  <div class="ld-app-t ld-rv"><p class="ld-app-desc">${ABAS[t][3]}</p>
   <ul class="ld-list"><li><${I} n="check" s=${16}/>Criação guiada em 7 etapas</li><li><${I} n="check" s=${16}/>Ficha com atributos, perícias e rolagens</li><li><${I} n="check" s=${16}/>Modo de Combate, mochila, magias e habilidades</li><li><${I} n="check" s=${16}/>História, Rede de Conexões e livro de regras</li></ul></div>
  <div class="ld-demo ld-rv"><div class="ld-tabs" role="tablist" aria-label="Demonstrações" onKeyDown=${tecla}>${ABAS.map(([id,l,ic],i)=>h`<button key=${id} id=${'ld-t-'+id} ref=${el=>tabs.current[i]=el} type="button" role="tab" aria-selected=${t==i} aria-controls="ld-painel" tabIndex=${t==i?0:-1} class=${t==i?'on':''} onClick=${()=>st(i)}><${I} n=${ic} s=${16}/>${l}</button>`)}</div>
   <div id="ld-painel" class="ld-painel" role="tabpanel" aria-labelledby=${'ld-t-'+ABAS[t][0]}><${D} key=${t}/></div></div></div>`};

/* Brilho que acompanha o cursor nos cards: um único listener no contêiner, atualiza 2 variáveis CSS por quadro (sem estado React). */
const useLuz=()=>{const r=React.useRef();React.useEffect(()=>{const el=r.current;if(!el||RM||!matchMedia('(hover:hover)').matches)return;let q=0,ev=null;
 const f=e=>{ev=e;if(q)return;q=requestAnimationFrame(()=>{q=0;const c=ev.target.closest&&ev.target.closest('.ld-mc');if(!c)return;const b=c.getBoundingClientRect();c.style.setProperty('--mx',(ev.clientX-b.left)+'px');c.style.setProperty('--my',(ev.clientY-b.top)+'px')})};
 el.addEventListener('pointermove',f,{passive:true});return()=>{el.removeEventListener('pointermove',f);cancelAnimationFrame(q)}},[]);return r};

const Landing=({logado,onEntrar})=>{const raiz=React.useRef(),[mapa,smapa]=React.useState(false),luz=useLuz();
 React.useEffect(()=>{const t=document.title;document.title='SODUAL — RPG de fantasia: crie seu personagem';try{scrollTo(0,0)}catch(e){}
  /* O conteúdo só fica oculto (classe rv-on) quando o observador existe: se o JavaScript falhar, tudo continua visível.
     Cada elemento anima uma única vez (unobserve), sem repetir ao rolar de volta. */
  const R0=raiz.current,els=[...R0.querySelectorAll('.ld-rv')];
  if(RM||!window.IntersectionObserver)return()=>{document.title=t};
  R0.classList.add('rv-on');
  const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}}),{rootMargin:'0px 0px -8% 0px',threshold:.08});
  els.forEach(e=>io.observe(e));return()=>{io.disconnect();document.title=t}},[]);
 const ir=id=>{const el=document.getElementById(id);el&&el.scrollIntoView({behavior:RM?'auto':'smooth',block:'start'})},
  principal=logado?'Voltar ao aplicativo':'Começar minha jornada',
  cta=(t,cls)=>h`<button type="button" class=${'b p ld-cta '+(cls||'')} onClick=${onEntrar}>${t}<${I} n="right" s=${18}/></button>`,
  A=LAND_ART;
 return h`<div class="ld" ref=${raiz}><${Ceu}/>
 <header class="ld-top"><a class="ld-brand" href="#apresentacao" onClick=${e=>{e.preventDefault();try{scrollTo({top:0,behavior:RM?'auto':'smooth'})}catch(_){scrollTo(0,0)}}}><span class="ld-sl" aria-hidden="true"><${I} n="flame" s=${16}/></span>SODUAL</a>
  <button type="button" class="b ld-in" onClick=${onEntrar}>${logado?'Abrir o aplicativo':'Entrar'}</button></header>
 <main id="main">
 <section class="ld-hero" aria-labelledby="ld-h1">
  <figure class="ld-hero-a ld-in1"><span class="ld-halo" aria-hidden="true"></span>
   <svg class="ld-runa" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><circle cx="100" cy="100" r="96" class="ld-runa-a"/><circle cx="100" cy="100" r="88" class="ld-runa-b"/>${[0,90,180,270].map(a=>h`<path key=${a} transform=${`rotate(${a} 100 100)`} d="M100 0l3 6-3 6-3-6z" class="ld-runa-c"/>`)}</svg>
   <img src=${A.hero.src()} alt=${A.hero.alt} width=${A.hero.w} height=${A.hero.h} fetchpriority="high" decoding="async" draggable="false"/></figure>
  <div class="ld-hero-t">
   <p class="ld-tag ld-in2">RPG de fantasia · Livro I</p>
   <h1 id="ld-h1" class="ld-logo ld-in3">SODUAL</h1>
   <p class="ld-lema ld-in4">Seu destino ainda não foi <em>escrito</em>.</p>
   <p class="ld-sub ld-in5">Crie seu personagem. Descubra o continente. Escreva sua própria lenda.</p>
   <div class="ld-acts ld-in6">${cta(principal)}<button type="button" class="b ld-sec" onClick=${()=>ir('ld-mundo')}>Explorar o universo</button></div>
  </div>
  <button type="button" class="ld-down" onClick=${()=>ir('ld-mundo')} aria-label="Rolar até o universo"><span>Descubra</span><${I} n="chev" s=${22}/></button>
 </section>

 <section id="ld-mundo" class="ld-sec-w ld-mundo" aria-labelledby="ld-h-mundo">
  <header class="ld-head"><${Orn}/><p class="ld-k ld-rv">O universo</p><h2 id="ld-h-mundo" class="ld-rv">O continente de Sodual</h2></header>
  ${/* SINOPSE curta + texto completo no <details> (funciona sem JavaScript). Para usar a sinopse oficial do autor, troque estes parágrafos. */''}
  <div class="ld-mundo-g">
   <div class="ld-txt ld-rv">
    <p>A oeste, o Reino de Bevon, nascido há cerca de quatrocentos anos da união de Arveni, Dárnios e Sáelios. A leste, Morgot e seus cavaleiros de grifos. Uma rivalidade antiga, que não se resume a heróis e vilões.</p>
    <p>Na Academia Militar Blackwood, jovens arriscam a vida por um vínculo que não podem exigir: <em>são os dragões que escolhem</em>. E pelo continente, criaturas, Cascas e mistérios continuam à espreita.</p>
    <details class="ld-mais"><summary>Descobrir mais sobre o continente<${I} n="chev" s=${16}/></summary>
     <p>A oeste, o Reino de Bevon. A leste, Morgot e seus cavaleiros de grifos. Uma rivalidade que atravessa gerações, mas que não se resume a heróis e vilões.</p>
     <p>Há cerca de quatrocentos anos, Arveni, Dárnios e Sáelios uniram seus reinos diante de uma ameaça vinda do leste. Hoje Bevon é governado pelo Conselho dos Seis e ainda carrega a memória recente de uma traição.</p>
     <p>Perto da capital, na Academia Militar Blackwood, jovens enfrentam provas que podem custar a vida. Numa floresta dentro de uma grande cratera, centenas de dragões livres aguardam. Nenhum deles pertence a ninguém: são os dragões que escolhem.</p>
     <p>O reino se protege com uma barreira mágica sustentada por cavaleiros, mas criaturas perigosas, Cascas e mistérios que nem os registros explicam continuam à espreita.</p></details>
   </div>
   <figure class="ld-fig ld-rv"><button type="button" class="ld-mapa" onClick=${()=>smapa(true)} aria-label="Ampliar o mapa do continente"><${Cantos}/><img src=${A.mapa.src()} alt=${A.mapa.alt} loading="lazy" decoding="async"/><span class="ld-zoom" aria-hidden="true"><${I} n="zoom" s=${16}/>Ampliar</span></button>
    <figcaption>Bevon a oeste, Morgot a leste.</figcaption></figure>
  </div>
  <blockquote class="ld-q ld-rv"><p>Poder não é destino: é escolha, vínculo e consequência.</p><cite>Livro I</cite></blockquote>
  <div class="ld-trio">
   <article class="ld-card ld-rv" style=${{'--d':'0ms'}}><img src=${A.povo.src()} alt=${A.povo.alt} loading="lazy" decoding="async"/><div><h3>Três povos, um reino</h3><p>Arveni, Dárnios e Sáelios vivem no mesmo reino. Aparência e reserva de mana variam, mas nada disso decide quem alguém será.</p></div></article>
   <article class="ld-card ld-rv" style=${{'--d':'90ms'}}><img src=${A.dragao.src()} alt=${A.dragao.alt} loading="lazy" decoding="async"/><div><h3>Dragões e vínculos</h3><p>Na Colheita, cadetes entram na floresta em busca de contato. O encontro pode terminar em indiferença, ataque ou escolha.</p></div></article>
   <article class="ld-card ld-card-m ld-rv" style=${{'--d':'180ms'}}><div class="ld-mana" aria-hidden="true"><span></span></div><div><h3>O poder da mana</h3><p>Humanos e outros humanoides sencientes carregam um núcleo de mana. Ter muita energia não garante saber usá-la.</p></div></article>
  </div>
 </section>

 <section class="ld-sec-w ld-mec" aria-labelledby="ld-h-mec">
  <header class="ld-head"><${Orn}/><p class="ld-k ld-rv">O sistema</p><h2 id="ld-h-mec" class="ld-rv">Regras que contam histórias</h2>
   <p class="ld-lead ld-rv">Testes com D20: o atributo define quantos dados você rola, e você fica com o melhor. Perícias e posturas fazem o resto.</p></header>
  <div class="ld-cards" ref=${luz}>${LAND_MEC.map(([ic,t,d],i)=>h`<article key=${t} class="ld-mc ld-rv" style=${{'--d':i*80+'ms'}}><span class="ld-ic" aria-hidden="true"><${I} n=${ic} s=${22}/></span><h3>${t}</h3><p>${d}</p></article>`)}</div>
 </section>

 <section class="ld-sec-w ld-app" aria-labelledby="ld-h-app">
  <header class="ld-head"><${Orn}/><p class="ld-k ld-rv">O aplicativo</p><h2 id="ld-h-app" class="ld-rv">Sua ficha, viva</h2>
   <p class="ld-lead ld-rv">Experimente: estas demonstrações usam as regras reais do aplicativo, sem conta e sem salvar nada.</p></header>
  <${Demos}/>
 </section>

 <section class="ld-fim" aria-labelledby="ld-h-fim">
  <div class="ld-fim-p ld-rv"><${Cantos}/><span class="ld-fim-halo" aria-hidden="true"></span>
   <header class="ld-head"><${Orn}/><h2 id="ld-h-fim">Toda lenda começa com uma escolha.</h2><p class="ld-lead">Seu personagem está esperando para ganhar vida.</p></header>
   ${cta(principal,'big')}</div>
 </section>
 </main>
 <footer class="ld-ft"><span>SODUAL</span> · Baseado no <i>Livro I — Guia do Jogador</i> (ed. 0.3)</footer>
 ${mapa&&h`<${LdModal} titulo="Mapa do continente de Sodual" onClose=${()=>smapa(false)}><img class="ld-mdl-img" src=${A.mapa.src()} alt=${A.mapa.alt}/><p class="ld-mdl-c">Bevon a oeste, Morgot a leste. O mapa foi preservado sem fronteiras nem nomes inventados.</p><//>`}
 </div>`};
