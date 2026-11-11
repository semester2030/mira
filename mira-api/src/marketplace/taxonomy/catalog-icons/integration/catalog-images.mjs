// Server: decorate the EXISTING category response; this does not create categories.
export function iconIndex(manifest) {
  const result = new Map();
  for (const item of manifest.items) {
    if (result.has(item.imageKey)) throw Error('Duplicate imageKey: '+item.imageKey);
    result.set(item.imageKey,item);
  }
  return result;
}
export function withCatalogImage(category, index, publicBase) {
  const entry=index.get(category.imageKey);
  if (!entry) throw Error('Unmapped imageKey: '+category.imageKey);
  const base=new URL(publicBase);
  if (!base.pathname.endsWith('/')) throw Error('Asset base must end in /');
  const uri=size=>new URL(entry.files[size].path,base).href;
  return {...category, icon:{key:entry.imageKey,smallUrl:uri(160),largeUrl:uri(640),version:entry.files[640].sha256}};
}
// Portal: render the category returned by the server, never look up images by label.
export function portalIcon(category) {
  let img=document.createElement('img');
  img.alt=category.nameAr; img.src=category.icon.smallUrl;
  img.srcset=category.icon.smallUrl+' 160w, '+category.icon.largeUrl+' 640w';
  img.sizes='(max-width: 500px) 88px, 112px';
  img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';
  return img;
}
