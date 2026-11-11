from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from urllib.request import urlopen
from io import BytesIO
from PIL import Image
import hashlib,json
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
try:
 data=json.load(urlopen(base+'manifest.json'))
 for item in data['items']:
  for size,asset in item['files'].items():
   with urlopen(base+asset['path']) as response:
    assert response.status==200 and response.headers.get_content_type()=='image/webp'
    b=response.read();assert hashlib.sha256(b).hexdigest()==asset['sha256']
    im=Image.open(BytesIO(b));im.load();assert im.size==(int(size),int(size))
 print('PASS local HTTP: all 66 files fetched, SHA-256 matched, decoded at expected size.')
finally:s.shutdown()
