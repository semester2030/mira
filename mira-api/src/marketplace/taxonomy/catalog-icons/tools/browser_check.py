from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
import shutil
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
t=Thread(target=server.serve_forever,daemon=True);t.start()
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,dpr in [(390,3),(1280,1)]:
   page=b.new_page(viewport={'width':w,'height':844},device_scale_factor=dpr)
   page.goto('http://127.0.0.1:%d/preview.html'%server.server_port)
   result=page.evaluate("""async()=>{const m=await(await fetch('./manifest.json')).json();const {portalIcon,withCatalogImage,iconIndex}=await import('./integration/catalog-images.mjs');const index=iconIndex(m);let n=0;for(const e of m.items){const c=withCatalogImage({id:e.knownCategoryId||'fixture:'+e.imageKey,imageKey:e.imageKey,nameAr:e.labelAr},index,new URL('./',location.href));const img=portalIcon(c);document.body.append(img);await img.decode();if(!img.naturalWidth||!img.currentSrc.includes(e.imageKey+'-'))throw Error('Bad image '+e.imageKey);img.remove();n++;}return n}""")
   assert result==33;print(f'PASS web adapter: {result} decoded; width={w}, DPR={dpr}')
   page.close()
  b.close()
finally:server.shutdown()
