/* ===== Enquadramento de imagens (avatar do perfil e retrato do personagem) =====
   Armazenamento (mesmo do resto do app: localStorage da conta, sem Supabase Storage):
   - img      recorte final já pronto (JPEG em data URL) — é o que todas as telas exibem, como antes;
   - imgSrc   cópia reduzida da imagem original (lado maior ≤ IMG_SRC_LADO), para reabrir o editor sem perder o resto da foto;
   - imgCrop  {x,y,z}: centro do recorte em coordenadas normalizadas da original (0..1) e zoom (1 = preenche o quadro).
   Fichas antigas só têm img: o editor reabre a partir dela, centrada, sem alterar nada até o usuário salvar. */
if(typeof IC!='undefined')IC.crop='M6 2v14a2 2 0 0 0 2 2h14 M18 22V8a2 2 0 0 0-2-2H2';
const IMG_ZMAX=5,IMG_SRC_LADO=1280,IMG_SRC_LIM=240000,IMG_OUT_LIM=90000;
/* Proporção real de cada espaço (CSS): avatar do perfil .uav e retrato da ficha .sh-av .av são círculos (1:1). */
const IMG_CFG={perfil:{asp:1,round:true,out:400,nome:'foto de perfil'},retrato:{asp:1,round:true,out:320,nome:'retrato do personagem'}};
/* Maior retângulo com a proporção asp que cabe na imagem (zoom 1), em pixels da original. */
function cropBase(iw,ih,asp){return iw/ih>asp?{w:ih*asp,h:ih}:{w:iw,h:iw/asp}}
/* Garante zoom 1..IMG_ZMAX e centro dentro dos limites: o recorte nunca sai da imagem (sem áreas vazias). */
function cropClamp(st,iw,ih,asp){const z=Math.min(IMG_ZMAX,Math.max(1,+st.z||1)),b=cropBase(iw,ih,asp),hw=b.w/z/2/iw,hh=b.h/z/2/ih,
  cl=(v,m)=>Math.min(1-m,Math.max(m,isFinite(+v)?+v:.5));return{x:cl(st.x,hw),y:cl(st.y,hh),z}}
/* Retângulo de origem (pixels da original) para desenhar o recorte. */
function cropRect(st,iw,ih,asp){const s=cropClamp(st,iw,ih,asp),b=cropBase(iw,ih,asp),w=b.w/s.z,h=b.h/s.z;return{sx:s.x*iw-w/2,sy:s.y*ih-h/2,sw:w,sh:h}}
/* Posição da imagem num quadro de largura W (px): tamanho exibido e deslocamento. */
function cropView(st,iw,ih,asp,W){const s=cropClamp(st,iw,ih,asp),k=W/(cropBase(iw,ih,asp).w/s.z),H=W/asp;return{w:iw*k,h:ih*k,l:W/2-s.x*iw*k,t:H/2-s.y*ih*k,k}}
/* Arrastar dx,dy pixels de tela num quadro de largura W. */
function cropPan(st,dx,dy,iw,ih,asp,W){const v=cropView(st,iw,ih,asp,W);return cropClamp({x:st.x-dx/(iw*v.k),y:st.y-dy/(ih*v.k),z:st.z},iw,ih,asp)}
/* Zoom para z2 mantendo fixo o ponto (fx,fy) do quadro (0..1; 0.5 = centro). */
function cropZoom(st,z2,fx,fy,iw,ih,asp){const s=cropClamp(st,iw,ih,asp),b=cropBase(iw,ih,asp),n=cropClamp({...s,z:z2},iw,ih,asp).z;
 return cropClamp({x:s.x+(fx-.5)*(b.w/s.z-b.w/n)/iw,y:s.y+(fy-.5)*(b.h/s.z-b.h/n)/ih,z:n},iw,ih,asp)}
/* Desenha em canvas e comprime em JPEG até caber em lim bytes (reduz a qualidade, depois o tamanho). */
function jpegAte(desenha,W,H,lim){let z=1,q=.88,out='';for(let i=0;i<10;i++){const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(W*z));cv.height=Math.max(1,Math.round(H*z));
  const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';desenha(x,cv.width,cv.height);
  out=cv.toDataURL('image/jpeg',q);if(out.length*.75<=lim)break;if(q>.6)q-=.1;else z*=.85}return out}
/* Recorte final (out × out/asp) e cópia reduzida da original para reedição. */
function gerarRecorte(el,st,cfg){const iw=el.naturalWidth,ih=el.naturalHeight,r=cropRect(st,iw,ih,cfg.asp),W=cfg.out,H=Math.round(cfg.out/cfg.asp);
 return jpegAte((x,w,h)=>x.drawImage(el,r.sx,r.sy,r.sw,r.sh,0,0,w,h),W,H,IMG_OUT_LIM)}
function gerarFonte(el){const iw=el.naturalWidth,ih=el.naturalHeight,k=Math.min(1,IMG_SRC_LADO/Math.max(iw,ih));return jpegAte((x,w,h)=>x.drawImage(el,0,0,w,h),iw*k,ih*k,IMG_SRC_LIM)}
/* Grava o resultado no objeto (S.set ou ficha). Só aqui a imagem anterior é substituída. Sem espaço, guarda só o recorte; se nem isso couber, restaura tudo. */
function aplicarImagem(o,r){const ant={img:o.img,imgSrc:o.imgSrc,imgCrop:o.imgCrop};Object.assign(o,{img:r.img,imgSrc:r.src||'',imgCrop:r.src?r.crop:null});
 if(save()){R();return true}
 o.imgSrc='';o.imgCrop=null;if(save()){R();toast('Enquadramento salvo. Sem espaço para guardar a original: um novo ajuste partirá do recorte.');return 'parcial'}
 Object.assign(o,ant);save();R();return false}
const limparImagem=o=>{o.img='';o.imgSrc='';o.imgCrop=null};

/* Editor: arrastar (mouse/toque), pinça para zoom, roda do mouse, controle deslizante e teclado (setas, + e −). */
const Cropper=({src,ini,fonte,cfg,titulo,onSave,onCancel,onTrocar})=>{const[im,sim]=React.useState(null),[st,sst]=React.useState(ini||{x:.5,y:.5,z:1}),[busy,sb]=React.useState(false),
  fr=React.useRef(),ptr=React.useRef(new Map()),cur=React.useRef(st),asp=cfg.asp;cur.current=st;
 React.useEffect(()=>{let vivo=1;const el=new Image();el.decoding='async';el.onload=()=>{if(!vivo)return;if(!el.naturalWidth||!el.naturalHeight){toast('Imagem inválida.');onCancel();return}
   sim({el,iw:el.naturalWidth,ih:el.naturalHeight});sst(s=>cropClamp(s,el.naturalWidth,el.naturalHeight,asp))};el.onerror=()=>{if(vivo){toast('Não foi possível ler a imagem.');onCancel()}};el.src=src;return()=>{vivo=0}},[src]);
 /* Largura do quadro na tela no momento do gesto (inclui a escala da animação, que é o que importa para converter pixels de tela). */
 const Wt=()=>fr.current?fr.current.getBoundingClientRect().width:1;
 const set=fn=>{if(!im)return;sst(s=>fn(s,im.iw,im.ih))},zoomEm=(z2,fx=.5,fy=.5)=>set((s,iw,ih)=>cropZoom(s,z2,fx,fy,iw,ih,asp)),
  rel=(cx,cy)=>{const b=fr.current.getBoundingClientRect();return[(cx-b.left)/b.width,(cy-b.top)/b.height]};
 /* Roda do mouse: listener nativo não passivo para impedir a rolagem da página por trás do modal. */
 React.useEffect(()=>{const f=fr.current;if(!f)return;const wh=e=>{e.preventDefault();const[fx,fy]=rel(e.clientX,e.clientY);zoomEm(cur.current.z*Math.exp(-e.deltaY*.0015),fx,fy)};f.addEventListener('wheel',wh,{passive:false});return()=>f.removeEventListener('wheel',wh)},[im]);
 const down=e=>{if(!im)return;try{e.currentTarget.setPointerCapture(e.pointerId)}catch(_){}ptr.current.set(e.pointerId,{x:e.clientX,y:e.clientY})},
  move=e=>{const P=ptr.current;if(!im||!P.has(e.pointerId))return;e.preventDefault();const ant=[...P.values()].slice(0,2).map(p=>({...p}));P.set(e.pointerId,{x:e.clientX,y:e.clientY});const nov=[...P.values()].slice(0,2);
   const W=Wt();if(nov.length<2){const d=ant[0];set((s,iw,ih)=>cropPan(s,e.clientX-d.x,e.clientY-d.y,iw,ih,asp,W));return}
   const dist=a=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1,mid=a=>({x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}),m0=mid(ant),m1=mid(nov),[fx,fy]=rel(m1.x,m1.y);
   set((s,iw,ih)=>cropZoom(cropPan(s,m1.x-m0.x,m1.y-m0.y,iw,ih,asp,W),s.z*dist(nov)/dist(ant),fx,fy,iw,ih,asp))},
  up=e=>{ptr.current.delete(e.pointerId)},
  key=e=>{const W=Wt(),p=.03*W,k={ArrowLeft:[p,0],ArrowRight:[-p,0],ArrowUp:[0,p],ArrowDown:[0,-p]}[e.key];if(k){e.preventDefault();set((s,iw,ih)=>cropPan(s,k[0],k[1],iw,ih,asp,W))}
   else if(e.key=='+'||e.key=='='){e.preventDefault();zoomEm(st.z*1.1)}else if(e.key=='-'||e.key=='_'){e.preventDefault();zoomEm(st.z/1.1)}else if(e.key=='0'){e.preventDefault();set(()=>({x:.5,y:.5,z:1}))}};
 /* Posição em % do quadro (largura 1): independe de medições, da animação do modal e do tamanho de cada prévia. */
 const vista=cls=>{if(!im)return null;const v=cropView(st,im.iw,im.ih,asp,1),P=n=>n*100+'%';return h`<img src=${src} alt="" draggable=${false} class=${cls} style=${{width:P(v.w),height:P(v.h*asp),left:P(v.l),top:P(v.t*asp)}}/>`},
  peq=im&&Math.min(cropBase(im.iw,im.ih,asp).w/st.z,cropBase(im.iw,im.ih,asp).h/st.z)<cfg.out*.75,
  salvar=()=>{if(!im||busy)return;sb(true);setTimeout(()=>{try{const crop=cropClamp(st,im.iw,im.ih,asp);if(!onSave({img:gerarRecorte(im.el,crop,cfg),src:fonte||gerarFonte(im.el),crop}))sb(false)}catch(err){toast('Não foi possível gerar o recorte.');sb(false)}},20)},
  rd=cfg.round?' cr-rd':'';
 return h`<${Modal} t=${titulo} onClose=${onCancel}><div class="cr">
  <div ref=${fr} class=${'cr-f'+rd+(im?'':' cr-ld')} style=${{aspectRatio:String(asp)}} tabIndex="0" role="group" aria-roledescription="editor de enquadramento" aria-label="Enquadramento: arraste para mover; pinça, roda do mouse ou teclas + e − para zoom; setas movem; 0 restaura"
   onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up} onLostPointerCapture=${up} onKeyDown=${key}>${vista('cr-i')}<span class="cr-m" aria-hidden="true"></span>${!im&&h`<span class="cr-w">Carregando…</span>`}</div>
  <div class="cr-z"><button type="button" class="b i" aria-label="Diminuir zoom" disabled=${!im||st.z<=1} onClick=${()=>zoomEm(st.z/1.2)}><${I} n="minus" s=${16}/></button>
   <input type="range" min="1" max=${IMG_ZMAX} step="0.01" value=${st.z} aria-label="Zoom" aria-valuetext=${Math.round(st.z*100)+'%'} disabled=${!im} onInput=${e=>zoomEm(+e.target.value)} onChange=${e=>zoomEm(+e.target.value)}/>
   <button type="button" class="b i" aria-label="Aumentar zoom" disabled=${!im||st.z>=IMG_ZMAX} onClick=${()=>zoomEm(st.z*1.2)}><${I} n="plus" s=${16}/></button></div>
  <div class="cr-pv" aria-label="Prévia"><small class="mut">Prévia</small>${[72,40].map(s=>h`<span key=${s} class=${'cr-p'+rd} style=${{width:s,height:s/asp}}>${vista('cr-i')}</span>`)}</div>
  <small class="mut cr-dc">Arraste para posicionar${matchMedia('(pointer:coarse)').matches?' · use dois dedos para o zoom':' · use a roda do mouse ou o controle para o zoom'}.${peq?' A área escolhida tem pouca resolução: a foto pode perder nitidez.':''}</small></div>
  <div class="row cr-ac">${onTrocar&&h`<${B} ic="up" onClick=${onTrocar}>Trocar imagem<//>`}<${B} ic="x" onClick=${onCancel}>Cancelar<//><${B} p ic="check" disabled=${!im||busy} onClick=${salvar}>${busy?'Salvando…':'Salvar enquadramento'}<//></div><//>`};

/* Liga o editor a um alvo (função que devolve S.set ou a ficha). Devolve o input de arquivo oculto, o modal e as ações. */
function useEditorImagem(alvo,cfg,titulo){const[ed,se]=React.useState(null),fi=React.useRef();
 React.useEffect(()=>()=>{if(ed&&ed.url)URL.revokeObjectURL(ed.url)},[ed]);
 const arquivo=f=>{if(!f)return;if(!IMGOK.includes(f.type)){toast('Formato inválido. Use JPG, PNG, WebP ou GIF.');return}if(f.size>MAXIN*1048576){toast('Imagem acima de '+MAXIN+' MB. Escolha um arquivo menor.');return}
   const u=URL.createObjectURL(f);se({src:u,url:u,ini:null,fonte:null})},
  ajustar=()=>{const o=alvo();if(!o||!o.img)return;se({src:o.imgSrc||o.img,ini:o.imgSrc&&o.imgCrop||null,fonte:o.imgSrc||null})},
  escolher=()=>fi.current&&fi.current.click();
 const input=h`<input ref=${fi} type="file" accept=${IMGOK.join(',')} hidden aria-label=${'Escolher '+cfg.nome} onChange=${e=>{arquivo(e.target.files[0]);e.target.value=''}}/>`,
  modal=ed&&ReactDOM.createPortal(h`<${Cropper} key=${ed.src} src=${ed.src} ini=${ed.ini} fonte=${ed.fonte} cfg=${cfg} titulo=${titulo} onCancel=${()=>se(null)} onTrocar=${escolher}
   onSave=${r=>{const o=alvo(),ok=o&&aplicarImagem(o,r);if(ok){se(null);if(ok===true)toast('Enquadramento salvo');return true}if(o)toast('Não foi possível salvar: armazenamento do navegador cheio.');return false}}/>`,document.body);
 return{input,modal,escolher,ajustar,arquivo}}
