"""Gera um único HTML autocontido (CSS, JS e imagens embutidos): python3 tools/build_single.py
Lê e grava sempre em UTF-8 (no Windows o padrão seria cp1252 e corromperia os acentos)."""
import re,base64,pathlib,json
U='utf-8'
r=pathlib.Path(__file__).resolve().parent.parent;s=(r/'index.html').read_text(encoding=U)
css=(r/'styles.css').read_text(encoding=U)
s=s.replace('<link rel="stylesheet" href="styles.css">','<style>'+css+'</style>')
MIME={'.jpg':'image/jpeg','.webp':'image/webp'}
imgs={p.stem:'data:'+MIME[p.suffix]+';base64,'+base64.b64encode(p.read_bytes()).decode() for p in sorted((r/'assets').iterdir()) if p.suffix in MIME}
s=s.replace('<script src="src/rules.js">','<script>window.SINGLE=true;window.IMGS='+json.dumps(imgs)+'</script>\n<script src="src/rules.js">',1)
# Favicon embutido (o arquivo único pode ser aberto sem o favicon.ico ao lado)
fav='data:image/x-icon;base64,'+base64.b64encode((r/'favicon.ico').read_bytes()).decode()
s=re.sub(r'href="favicon\.ico(\?v=\d+)?"',lambda m:'href="'+fav+'"',s)
s=re.sub(r'<script src="(src/[^"]+)"></script>',lambda m:'<script>'+(r/m.group(1)).read_text(encoding=U)+'</script>',s)
(r/'sodual-single.html').write_text(s,encoding=U,newline='\n');print('ok',len(s))
