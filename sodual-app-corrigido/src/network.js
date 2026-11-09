/* Rede de Conexões — constelação SVG em tela cheia. Nós = personagem principal (ficha) + pessoas independentes (S.net.people). */
const ETY={'Amizade':'#5ee7ff','Inimizade':'#ff5f6d','Parentesco':'#f0c76a','Aliança':'#35d6c0','Rivalidade':'#ff9f43','Romance':'#ff5fc8','Mentoria':'#b48cff','Lealdade':'#7aa2ff','Traição':'#d63a3a','Relação desconhecida':'#9aa3d6','Personalizada':'#e8e8ff'};
const ESTY={'Amizade':['3 14',2.5],'Inimizade':['12 8',2.5],'Parentesco':['1 0',3.2],'Aliança':['1 0',2.6],'Rivalidade':['14 6 3 6',2.5],'Romance':['2 10',3.6],'Mentoria':['6 8',2.5],'Lealdade':['1 0',3],'Traição':['2 8',2.6],'Relação desconhecida':['3 10',2],'Personalizada':['4 10',2.5]};
const seedPos=(i,j=0)=>{const a=i*2.39996+.5+j,r=150*Math.sqrt(i+.8)*(1+.28*Math.sin(i*7.3+j));return{x:Math.round(520+r*Math.cos(a)),y:Math.round(330+r*.7*Math.sin(a))}};
/* ===== Céu da Rede (nível 1 de luz: fundo). Só decoração, sem eventos. =====
   Estrelas em amostragem estratificada (grade 20×14 com deslocamento pseudoaleatório fixo): irregular, mas sem vazios nem aglomerados.
   Três camadas: ~80% minúsculas e apagadas, ~15% pequenas, ~5% de destaque com halo muito suave (gradiente radial, sem filtro de
   desfoque, que recortava em "quadrados"). Só 1 em cada 4 estrelas de destaque/pequenas cintila, devagar e com pouca variação. */
const STARS=(()=>{let s=11;const r=()=>(s=(s*16807)%2147483647)/2147483647,o=[],C=['#ffffff','#ffffff','#f4f1ff','#dceaff','#ffe8bf','#e6dcff'];
 for(let gy=0;gy<14;gy++)for(let gx=0;gx<20;gx++){const n=r()<.93?1:0;if(!n)continue;const x=(gx+.08+r()*.84)*50,y=(gy+.08+r()*.84)*50,t=r(),k=t<.8?0:t<.95?1:2;
  o.push({x:+x.toFixed(1),y:+y.toFixed(1),k,r:k==0?.35+r()*.35:k==1?.75+r()*.3:1.15+r()*.3,op:k==0?.22+r()*.33:k==1?.55+r()*.2:.85,c:C[Math.floor(r()*C.length)],tw:k>0&&r()<.25?1+Math.floor(r()*3):0})}
 return o})();
const NEB=[{x:220,y:180,rx:330,ry:210,c:'#5b3fd0',o:.16},{x:820,y:560,rx:360,ry:220,c:'#137f9e',o:.12},{x:640,y:90,rx:260,ry:150,c:'#a2338a',o:.08}];
const Sky=({x,y})=>h`<svg class="sky" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style=${{transform:`translate(${x*.02}px,${y*.02}px) scale(1.04)`}}><defs>${NEB.map((n,i)=>h`<radialGradient key=${i} id=${'neb'+i}><stop offset="0" stopColor=${n.c} stopOpacity=${n.o}/><stop offset="1" stopColor=${n.c} stopOpacity="0"/></radialGradient>`)}<radialGradient id="stH"><stop offset="0" stopColor="#fff" stopOpacity=".35"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient></defs>
 ${NEB.map((n,i)=>h`<ellipse key=${i} cx=${n.x} cy=${n.y} rx=${n.rx} ry=${n.ry} fill=${`url(#neb${i})`}/>`)}
 ${STARS.filter(s=>s.k==2).map((s,i)=>h`<circle key=${'h'+i} cx=${s.x} cy=${s.y} r=${s.r*4.5} fill="url(#stH)" opacity=".55"/>`)}
 ${STARS.map((s,i)=>h`<circle key=${i} class=${s.tw?'stw stw'+s.tw:undefined} cx=${s.x} cy=${s.y} r=${s.r} fill=${s.c} opacity=${s.op}/>`)}</svg>`;
/* Ornamento astronômico só nos cantos (o centro fica limpo para os personagens): arcos incompletos, marcas de graus e um
   pequeno compasso, em traço dourado finíssimo. Tamanho fixo em px, ancorado no canto: não escala com o zoom nem cobre nomes. */
const ORN_T=Array.from({length:19},(_,i)=>{const a=(i*5)*Math.PI/180,l=i%3?6:11;return{x1:150*Math.cos(a),y1:150*Math.sin(a),x2:(150-l)*Math.cos(a),y2:(150-l)*Math.sin(a)}});
const SkyCanto=({p})=>h`<svg class=${'sky-orn '+p} viewBox="0 0 200 200" aria-hidden="true" focusable="false"><g fill="none" stroke="#f0c76a">
 <path d="M150 0A150 150 0 0 1 0 150" strokeOpacity=".16"/><path d="M178 0A178 178 0 0 1 112 138" strokeOpacity=".09" strokeDasharray="1 5"/><path d="M118 0A118 118 0 0 1 60 102" strokeOpacity=".08"/>
 ${ORN_T.map((t,i)=>h`<line key=${i} x1=${t.x1} y1=${t.y1} x2=${t.x2} y2=${t.y2} strokeOpacity=${i%3?.12:.22}/>`)}
 <g transform="translate(34 34)" strokeOpacity=".2"><circle r="9"/><path d="M0-15V15M-15 0H15" strokeOpacity=".5"/><path d="M0-9 2 0 0 9-2 0Z" fill="#f0c76a" fillOpacity=".35" stroke="none"/></g></g></svg>`;
const PForm=({p,at,onClose})=>{const[f,sf]=React.useState(p?{...p}:{nome:'',cor:'#5ee7ff',img:''}),[er,se]=React.useState('');
 const ok=()=>{if(!f.nome.trim())return se('Informe o nome.');if(!f.img)return se('Escolha uma foto de perfil.');if(!f.cor)return se('Escolha uma cor de identificação.');upd(()=>{if(p)Object.assign(p,{nome:f.nome.trim(),cor:f.cor,img:f.img});else{const n={id:uid(),nome:f.nome.trim(),cor:f.cor,img:f.img};S.net.people.push(n);S.net.pos[n.id]=at()}});toast(p?'Personagem atualizado':'Personagem adicionado');onClose()};
 return h`<${Modal} t=${p?'Editar personagem':'Adicionar à constelação'} onClose=${onClose}><div class="row"><span class="uav" style=${{width:80,height:80,borderColor:f.cor,backgroundImage:f.img?`url(${f.img})`:undefined}}>${!f.img&&h`<${I} n="user" s=${34}/>`}</span><label class="b"><${I} n="up" s=${16}/>${f.img?'Substituir foto':'Escolher foto'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange=${e=>{readImg(e.target.files[0],160,d=>sf(x=>({...x,img:d})));e.target.value=''}}/></label></div><label>Nome</label><input type="text" value=${f.nome} onChange=${e=>sf({...f,nome:e.target.value})} autoFocus/><label>Cor de identificação</label><input type="color" value=${f.cor} onChange=${e=>sf({...f,cor:e.target.value})} style=${{width:60,padding:0,height:34}}/>${er&&h`<div class="er">${er}</div>`}<div class="row"><${B} p ic="check" onClick=${ok}>${p?'Salvar':'Adicionar'}<//>${p&&h`<${B} ic="trash" onClick=${()=>{if(confirm('Excluir "'+p.nome+'" da rede? As conexões dele serão removidas.')){upd(()=>{S.net.people=S.net.people.filter(x=>x!=p);S.net.edges=S.net.edges.filter(e=>e.a!=p.id&&e.b!=p.id);delete S.net.pos[p.id]});onClose()}}}>Excluir<//>`}<${B} onClick=${onClose}>Cancelar<//></div><//>`};
/* ===== Rede de Conexões 4.1 — mapa astral interativo =====
   Só a apresentação mudou: zoom, pan, arraste, criação/edição/remoção de pessoas e vínculos, reorganização e posições (S.net.pos)
   usam a mesma lógica e o mesmo formato de dados de antes. Barra superior recolhível (preferência só deste navegador), ferramentas
   agrupadas (visualização | edição) e painel contextual (coluna à direita no desktop, folha inferior no celular), sempre com botão de fechar. */
Object.assign(IC,{chevU:'M18 15l-6-6-6 6',chevD:'M6 9l6 6 6-6',fit:'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',shuffle:'M16 3h5v5 M4 20L21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5'});
const NET_MIN_K='sodual.rede.recolhida';
const netMinIni=()=>{try{const v=localStorage.getItem(NET_MIN_K);if(v!=null)return v=='1'}catch(e){}return typeof innerWidth!='undefined'&&innerWidth<768};
/* Botão de ferramenta: ícone + rótulo acessível + dica (title). on (opcional) = botão alternável com aria-pressed. */
const NB=({ic,l,on,exp,cls,onClick,dis})=>h`<button type="button" class=${'nt-b'+(cls?' '+cls:'')+(on?' on':'')} title=${l} aria-label=${l} aria-pressed=${on===undefined?undefined:!!on} aria-expanded=${exp===undefined?undefined:!!exp} disabled=${dis} onClick=${onClick}><${I} n=${ic} s=${17}/></button>`;
const Net=()=>{const N=ui.net,sv=React.useRef(),wr=React.useRef(),dr=React.useRef(null),fr=React.useRef(),pc=React.useRef(-1),pr=React.useRef(),[pm,spm]=React.useState(null),[mn,smn]=React.useState(netMinIni),m=me();
 const nodes=[...(m?[{id:m.id,nome:m.nome,img:m.img,cor:m.cor,main:1}]:[]),...S.net.people];
 nodes.forEach((n,i)=>{if(!S.net.pos[n.id])S.net.pos[n.id]=n.main?{x:520,y:330}:seedPos(i)});
 const ids=new Set(nodes.map(n=>n.id));S.net.edges=S.net.edges.filter(e=>ids.has(e.a)&&ids.has(e.b));
 const nd=id=>nodes.find(n=>n.id==id),P=id=>S.net.pos[id],EG=S.net.edges,ed=EG.find(e=>e.id==N.edge),sel=nd(N.sel);
 function zoom(f,mx,my){const r=wr.current.getBoundingClientRect();mx=mx??r.width/2;my=my??r.height/2;const k=Math.max(.25,Math.min(3,N.k*f));N.x=mx-(mx-N.x)*k/N.k;N.y=my-(my-N.y)*k/N.k;N.k=k;N.auto=false;R()}
 const fit=()=>{if(!wr.current)return;const r=wr.current.getBoundingClientRect(),ps=nodes.map(n=>P(n.id));if(!ps.length||!r.width)return;const x0=Math.min(...ps.map(p=>p.x))-120,x1=Math.max(...ps.map(p=>p.x))+120,y0=Math.min(...ps.map(p=>p.y))-120,y1=Math.max(...ps.map(p=>p.y))+120,k=Math.max(r.width<600?.55:.25,Math.min(1.3,r.width/(x1-x0),r.height/(y1-y0)));N.k=k;N.x=r.width/2-(x0+x1)/2*k;N.y=r.height/2-(y0+y1)/2*k;R()};fr.current=fit;
 React.useEffect(()=>{N.auto=true;N.sm=false;const el=sv.current,f=e=>{e.preventDefault();N.sm=false;const r=wr.current.getBoundingClientRect();zoom(e.deltaY<0?1.12:.89,e.clientX-r.left,e.clientY-r.top)};el.addEventListener('wheel',f,{passive:false});
  /* Mudou o tamanho do palco (janela, painel aberto/fechado, barra recolhida): reenquadra suavemente enquanto o jogador não mexeu no zoom. */
  const ro=new ResizeObserver(()=>{if(N.auto){N.sm=true;fr.current()}});ro.observe(wr.current);return()=>{el.removeEventListener('wheel',f);ro.disconnect()}},[]);
 React.useEffect(()=>{if(pc.current>=0&&pc.current!=nodes.length&&N.auto){N.sm=true;fr.current()}pc.current=nodes.length},[nodes.length]);
 const wp=e=>{const r=wr.current.getBoundingClientRect();return{x:(e.clientX-r.left-N.x)/N.k,y:(e.clientY-r.top-N.y)/N.k}};
 const down=(e,id)=>{e.stopPropagation();sv.current.setPointerCapture(e.pointerId);N.sm=false;const w=wp(e);dr.current=id?{id,mv:0,sx:e.clientX,sy:e.clientY,ox:P(id).x-w.x,oy:P(id).y-w.y}:{pan:1,mv:0,sx:e.clientX,sy:e.clientY,ox:N.x,oy:N.y}};
 const move=e=>{const d=dr.current;if(!d)return;const dx=e.clientX-d.sx,dy=e.clientY-d.sy;if(Math.abs(dx)+Math.abs(dy)>4)d.mv=1;if(!d.mv)return;if(d.pan){N.x=d.ox+dx;N.y=d.oy+dy;N.auto=false}else{const w=wp(e),q=P(d.id);q.x=Math.round(w.x+d.ox);q.y=Math.round(w.y+d.oy)}R()};
 const clickNode=id=>{if(N.sel&&N.sel!=id&&N.link){if(EG.some(e=>(e.a==N.sel&&e.b==id)||(e.a==id&&e.b==N.sel))){toast('Esses personagens já estão conectados.');N.sel=id}else{const e={id:uid(),a:N.sel,b:id,tipo:'Relação desconhecida',cor:'',cn:'',desc:'',obs:''};S.net.edges.push(e);N.edge=e.id;N.newId=e.id;N.sel=null;save();toast('Conexão criada');setTimeout(()=>{N.newId=null;R()},900)}}else{N.sel=id;N.edge=null}R()};
 const up=()=>{const d=dr.current;dr.current=null;if(!d)return;if(d.mv){if(!d.pan)save()}else if(d.id)clickNode(d.id);else{N.sel=null;N.edge=null;R()}};
 const cut=id=>{N.dying=id;R();setTimeout(()=>{S.net.edges=S.net.edges.filter(e=>e.id!=id);N.dying=null;N.edge=null;save();R();toast('Conexão rompida')},450)};
 const spread=()=>{const from=Object.fromEntries(nodes.map(n=>[n.id,{...P(n.id)}])),to=Object.fromEntries(nodes.map((n,i)=>[n.id,n.main?{x:520,y:330}:seedPos(i,Math.random()*6)]));let t=0;const f=()=>{t++;const u=1-Math.pow(1-t/40,3);nodes.forEach(n=>{S.net.pos[n.id]={x:Math.round(from[n.id].x+(to[n.id].x-from[n.id].x)*u),y:Math.round(from[n.id].y+(to[n.id].y-from[n.id].y)*u)}});R();if(t<40)requestAnimationFrame(f);else{save();N.sm=true;N.auto=true;fr.current()}};f()};
 const at=()=>{const r=wr.current.getBoundingClientRect(),cx=(r.width/2-N.x)/N.k,cy=(r.height/2-N.y)/N.k,all=Object.values(S.net.pos);let best=null,bd=-1;for(let i=0;i<40;i++){const p={x:Math.round(cx+(Math.random()-.5)*(260+i*14)),y:Math.round(cy+(Math.random()-.5)*(180+i*10))},d=Math.min(999,...all.map(q=>Math.hypot(q.x-p.x,q.y-p.y)));if(d>bd){bd=d;best=p}if(d>130)break}return best};
 const rel=id=>EG.filter(e=>e.a==id||e.b==id),col=e=>e.cor||ETY[e.tipo]||'#fff',lab=e=>e.tipo=='Personalizada'&&e.cn?e.cn:e.tipo;
 const dim=e=>N.sel?!(e.a==N.sel||e.b==N.sel):N.edge?e.id!=N.edge:false;
 const path=e=>{const a=P(e.a),b=P(e.b),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y;return`M${a.x} ${a.y}Q${mx-dy*.12} ${my+dx*.12} ${b.x} ${b.y}`};
 /* ---- apresentação ---- */
 const rN=c=>c.main?30:24,
  /* Ponto da borda do retrato na direção do outro astro: as "estrelas" das pontas ficam visíveis em vez de escondidas sob o retrato. */
  ponta=(a,b,r)=>{const A=P(a),Bp=P(b),dx=Bp.x-A.x,dy=Bp.y-A.y,l=Math.hypot(dx,dy)||1;return{x:A.x+dx/l*r,y:A.y+dy/l*r}};
 const setMin=v=>{smn(v);try{localStorage.setItem(NET_MIN_K,v?'1':'0')}catch(e){}},
  aberto=!!(ed||sel),
  fechar=()=>{N.sel=null;N.edge=null;R();const s=sv.current;s&&s.focus&&s.focus({preventScroll:true})};
 React.useEffect(()=>{if(!aberto)return;const f=e=>{if(e.key=='Escape'&&!document.querySelector('.mdl'))fechar()};addEventListener('keydown',f);return()=>removeEventListener('keydown',f)},[aberto]);
 React.useEffect(()=>{if(aberto&&pr.current&&!(N.link&&sel))pr.current.focus({preventScroll:true})},[N.sel,N.edge]);
 /* Celular: o painel é uma folha inferior; traz o astro selecionado para a faixa visível acima dela (só a visão muda, nunca as posições). */
 React.useEffect(()=>{if(!sel||!wr.current||innerWidth>=768)return;const r=wr.current.getBoundingClientRect(),p=P(sel.id);N.sm=true;N.auto=false;N.x=r.width/2-p.x*N.k;N.y=r.height*.22-p.y*N.k;R()},[N.sel]);
 const dica=!m?'Crie o personagem principal em “Meu personagem” para iniciar sua rede; ele será o astro central.':!S.net.people.length?'Sua constelação ainda tem uma única estrela. Adicione pessoas para traçar os primeiros vínculos.':
  'Clique numa estrela para ver seus vínculos. Com “Conectar” ativo, clique numa estrela e depois em outra para criar o vínculo. Arraste estrelas para movê-las, arraste o céu para navegar e use a roda do mouse ou os botões para o zoom. Clique numa linha para editá-la.';
 const pessoa=sel&&!sel.main?S.net.people.find(x=>x.id==sel.id):null;
 return h`<div class=${'net'+(aberto?' pn-on':'')}>
 <header class=${'nt-h'+(mn?' min':'')}>
  <div class="nt-hl"><span class="nt-ic" aria-hidden="true"><${I} n="net" s=${18}/></span><h1 class="nt-t">Rede de Conexões</h1>${!mn&&h`<span class="nt-ct"><b>${nodes.length}</b> personagem(ns) · <b>${EG.length}</b> conexão(ões)</span>`}</div>
  <div class="nt-ha">${m&&h`<button type="button" class="b p nt-add" onClick=${()=>spm({})} aria-label="Adicionar personagem" title="Adicionar personagem"><${I} n="plus" s=${16}/><span class="nt-al">Adicionar personagem</span></button>`}
   <${NB} ic=${mn?'chevD':'chevU'} l=${mn?'Expandir a barra da Rede':'Recolher a barra da Rede'} exp=${!mn} onClick=${()=>setMin(!mn)}/></div>
  ${!mn&&h`<p class="nt-dica" id="nt-dica">${dica}</p>`}${!mn&&!m&&h`<div class="row nt-cr"><${B} ic="scroll" onClick=${()=>{ui.w=newW();ui.step=0;go('wiz')}}>Criar personagem principal<//></div>`}
 </header>
 <div class="nt-body">
 <div class="nt-stage" ref=${wr}><${Sky} x=${N.x} y=${N.y}/>${["tl","tr","bl","br"].map(p=>h`<${SkyCanto} key=${p} p=${p}/>`)}
 <svg ref=${sv} class="nt-svg" tabIndex="-1" onPointerDown=${e=>down(e,null)} onPointerMove=${move} onPointerUp=${up} role="group" aria-label="Constelação de personagens"><defs>${nodes.map(c=>h`<radialGradient key=${'g'+c.id} id=${'g'+c.id}><stop offset=".35" stopColor=${c.cor} stopOpacity=".55"/><stop offset="1" stopColor=${c.cor} stopOpacity="0"/></radialGradient>`)}${nodes.filter(c=>c.img).map(c=>h`<pattern key=${'p'+c.id} id=${'p'+c.id} width="1" height="1" patternContentUnits="objectBoundingBox"><image href=${c.img} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice"/></pattern>`)}<radialGradient id="ndBg"><stop offset="0" stopColor="#2a2470"/><stop offset="1" stopColor="#11163f"/></radialGradient></defs>
 <g style=${{transform:`translate(${N.x}px,${N.y}px) scale(${N.k})`,transformOrigin:'0 0',transition:N.sm?'transform .55s cubic-bezier(.3,.8,.3,1)':'none'}}>${EG.map(e=>{const a=nd(e.a),b=nd(e.b);if(!a||!b)return null;const d=path(e),on=N.edge==e.id||!!N.sel&&(e.a==N.sel||e.b==N.sel),o=N.dying==e.id?1:dim(e)?.16:on?1:.8,mx=(P(e.a).x+P(e.b).x)/2,my=(P(e.a).y+P(e.b).y)/2,[da,sw]=ESTY[e.tipo]||['3 10',2.5],k=col(e),pa=ponta(e.a,e.b,rN(a)+6),pb=ponta(e.b,e.a,rN(b)+6),w0=on?sw*.85:sw*.55;
  return h`<g key=${e.id} class=${'eg'+(on?' on':'')} style=${{opacity:o}}><title>${a.nome+' ⇄ '+b.nome+' · '+lab(e)}</title><path class="eu" d=${d} style=${{strokeWidth:w0+2.6}}/><path class=${'eb'+(N.newId==e.id?' new':'')+(N.dying==e.id?' die':'')} d=${d} pathLength="1" stroke=${k} style=${{strokeWidth:w0}}/><path class="ef" d=${d} stroke=${k} style=${{strokeDasharray:da,strokeWidth:w0+.5}}/><circle class="ep" cx=${pa.x} cy=${pa.y} r=${on?3.2:2.2} fill=${k}/><circle class="ep" cx=${pb.x} cy=${pb.y} r=${on?3.2:2.2} fill=${k}/><path class="eh" d=${d} onPointerDown=${ev=>ev.stopPropagation()} onClick=${()=>{N.edge=e.id;N.sel=null;R()}}/>${on&&h`<text class="el" x=${mx} y=${my-9} textAnchor="middle" fill=${k}>${lab(e)}</text>`}</g>`})}
 ${nodes.map(c=>{const p=P(c.id),on=N.sel==c.id,far=!!N.sel&&!on&&!EG.some(e=>(e.a==N.sel&&e.b==c.id)||(e.b==N.sel&&e.a==c.id)),lig=!!N.sel&&!on&&!far,r=rN(c),nm=c.nome||'?',lw=Math.min(220,nm.length*7.6+(c.main?34:20));
  return h`<g key=${c.id} class=${'nd'+(on?' sel':'')+(far?' far':'')+(lig?' rel':'')+(c.main?' main':'')} transform=${`translate(${p.x} ${p.y})`} tabIndex="0" role="button" aria-pressed=${on} aria-label=${nm+(c.main?', personagem principal':'')+' — '+rel(c.id).length+' conexão(ões)'} onPointerDown=${e=>down(e,c.id)} onKeyDown=${e=>{if(e.key=='Enter'||e.key==' '){e.preventDefault();clickNode(c.id)}}}>
   <circle class="nd-halo" r=${r+24} fill=${`url(#g${c.id})`}/><circle class="nd-orb" r=${r+9}/><circle class="nd-aro" r=${r+3.5} stroke=${on?'#f0c76a':c.cor}/>${on&&h`<circle class="ring" r=${r+4} stroke="#f0c76a"/>`}
   <circle class="nm" r=${r} fill=${c.img?`url(#p${c.id})`:'url(#ndBg)'}/>${!c.img&&h`<text class="nd-ini" y="6" textAnchor="middle" fill=${c.cor}>${nm.trim()[0].toUpperCase()}</text>`}
   <g class="nd-lb" transform=${`translate(0 ${r+22})`}><rect x=${-lw/2} y="-11" width=${lw} height="21" rx="10.5"/><text y="4" textAnchor="middle">${nm}${c.main?' ★':''}</text></g></g>`})}</g></svg>
 ${N.link&&sel&&h`<div class="nt-chip" role="status">Escolha outra estrela para conectar a <b>${sel.nome}</b></div>`}
 <div class="nt-dock noprint" role="toolbar" aria-label="Ferramentas da constelação">
  <div class="nt-grp" role="group" aria-label="Visualização"><${NB} ic="plus" l="Aproximar" onClick=${()=>{N.sm=true;zoom(1.25)}}/><${NB} ic="minus" l="Afastar" onClick=${()=>{N.sm=true;zoom(.8)}}/><${NB} ic="fit" l="Ajustar ao conteúdo" onClick=${()=>{N.sm=true;N.auto=true;fit()}}/><${NB} ic="shuffle" l="Reorganizar a constelação" onClick=${spread}/></div>
  <span class="nt-sep" aria-hidden="true"></span>
  <div class="nt-grp" role="group" aria-label="Edição"><${NB} ic="link" l=${N.link?'Conectar ao clicar: ligado':'Conectar ao clicar: desligado'} on=${!!N.link} onClick=${()=>{N.link=!N.link;R()}}/>${m&&h`<${NB} ic="user" l="Adicionar personagem" onClick=${()=>spm({})}/>`}<${NB} ic="help" l=${mn?'Mostrar instruções':'Ocultar instruções'} on=${!mn} onClick=${()=>setMin(!mn)}/></div>
 </div></div>
 ${aberto&&h`<aside class="nt-pn" aria-label=${ed?'Conexão selecionada':'Personagem selecionado'}>
  <div class="nt-pn-h"><span class="nt-grab" aria-hidden="true"></span><h2 tabIndex="-1" ref=${pr}>${ed?h`<${I} n="link" s=${17}/> Conexão`:sel.nome}</h2><${NB} ic="x" l="Fechar painel" cls="nt-x" onClick=${fechar}/></div>
  <div class="nt-pn-b">${ed?h`<p class="nt-par"><b>${(nd(ed.a)||{}).nome}</b><span aria-hidden="true">⇄</span><b>${(nd(ed.b)||{}).nome}</b></p>
   <label>Tipo<select value=${ed.tipo} onChange=${e=>upd(()=>{ed.tipo=e.target.value;ed.cor=''})}>${Object.keys(ETY).map(t=>h`<option key=${t}>${t}</option>`)}</select></label>${ed.tipo=='Personalizada'&&h`<label>Nome do tipo<input type="text" value=${ed.cn} onChange=${e=>upd(()=>ed.cn=e.target.value)}/></label>`}
   <label>Cor da conexão<input type="color" value=${col(ed)} onChange=${e=>upd(()=>ed.cor=e.target.value)} style=${{width:60,padding:0,height:32}}/></label><label>Descrição<textarea value=${ed.desc} onChange=${e=>upd(()=>ed.desc=e.target.value)}></textarea></label><label>Observações<textarea value=${ed.obs||''} onChange=${e=>upd(()=>ed.obs=e.target.value)}></textarea></label>
   <div class="row nt-ac"><${B} ic="trash" onClick=${()=>cut(ed.id)}>Romper conexão<//></div>`
  :h`<div class="nt-pf"><span class="nt-av" style=${{'--c':sel.cor,backgroundImage:sel.img?`url(${sel.img})`:undefined}}>${!sel.img&&h`<${I} n="user" s=${26}/>`}</span><div><small>${sel.main?`Personagem principal · ${m.povo} · ${m.origem}`:'Personagem da rede'}</small><b>${rel(sel.id).length} conexão(ões)</b></div></div>
   ${N.link?h`<p class="nt-lk">“Conectar” está ativo: escolha outra estrela para criar um vínculo com <b>${sel.nome}</b>.</p>`:null}
   <h3 class="nt-st">Vínculos</h3>${rel(sel.id).length?h`<ul class="nt-rl">${rel(sel.id).map(e=>{const o=nd(e.a==sel.id?e.b:e.a);return o&&h`<li key=${e.id}><button type="button" onClick=${()=>{N.edge=e.id;N.sel=null;R()}}><span class="dt" style=${{background:col(e)}}></span><b>${o.nome}</b><small>${lab(e)}</small><${I} n="right" s=${14}/></button></li>`})}</ul>`:h`<p class="mut nt-vz">Sem vínculos ainda. Ative “Conectar” e clique em outra estrela.</p>`}
   <div class="row nt-ac">${!N.link&&S.net.people.length?h`<${B} ic="link" onClick=${()=>{N.link=true;R()}}>Conectar a outra estrela<//>`:null}${sel.main?h`<${B} ic="pen" onClick=${()=>go('sheet',{tab:'ficha'})}>Abrir ficha<//>`:h`<${B} ic="pen" onClick=${()=>spm(pessoa)}>Editar<//>`}</div>`}</div></aside>`}
 </div>
 ${pm&&h`<${PForm} p=${pm.id?pm:null} at=${at} onClose=${()=>spm(null)}/>`}</div>`};
