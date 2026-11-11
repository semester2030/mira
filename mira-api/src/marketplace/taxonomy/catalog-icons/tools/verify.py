import hashlib,json,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1]
m=json.loads((root/'manifest.json').read_text())
keys=set(); hashes=set()
for entry in m['items']:
 k=entry['imageKey'];assert k not in keys;keys.add(k)
 for size,item in entry['files'].items():
  b=(root/item['path']).read_bytes()
  assert b[:4]==b'RIFF' and b[8:12]==b'WEBP' and hashlib.sha256(b).hexdigest()==item['sha256']
  assert b[12:16]==b'VP8 ' and b[23:26]==b'\x9d\x01\x2a'
  assert struct.unpack_from('<HH',b,26)==(int(size),int(size))
 assert entry['files']['640']['sha256'] not in hashes;hashes.add(entry['files']['640']['sha256'])
assert len(keys)==33
print('OK:',len(keys),'unique icons; 66 WebP files and hashes verified.')
