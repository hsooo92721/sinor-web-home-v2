#!/usr/bin/env python3
"""Prepare saved CMS settings as reviewable static files. Does not commit or deploy."""
import argparse,base64,hashlib,json,re
from pathlib import Path
from urllib.parse import urlparse
p=argparse.ArgumentParser();p.add_argument('settings',type=Path);p.add_argument('--output',type=Path,required=True);p.add_argument('--base-path',default='/sinor-web-home-v2/');p.add_argument('--origin',default='');a=p.parse_args()
root=Path(__file__).resolve().parents[1];out=a.output.resolve()
if out.exists():p.error('Use a new output folder so existing files are not overwritten.')
state=json.loads(a.settings.read_text());out.mkdir(parents=True);base='/'+a.base_path.strip('/')+'/' if a.base_path.strip('/') else '/'
def image(value):
 if not value.startswith('data:image/'):return value
 m=re.fullmatch(r'data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\s]+)',value)
 if not m:raise ValueError('Unsupported image')
 blob=base64.b64decode(m[2],validate=True);name='cms/media/'+hashlib.sha256(blob).hexdigest()[:24]+'.'+m[1];target=out/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(blob);return a.origin.rstrip('/')+base+name
from html import escape
redirects=[];seen=set()
for page in state['pages']:
 path=page['path'];parts=Path(path.lstrip('/')).parts
 if not path.startswith('/') or any(x in ('.','..') for x in parts) or any(x in path for x in ('?','#','\\')):raise ValueError('Invalid page path')
 if path in seen:raise ValueError('Duplicate page path')
 seen.add(path)
 if page.get('deleted'):continue
 template=(root/page['template']).resolve()
 if root not in template.parents or template.suffix!='.html':raise ValueError('Invalid template')
 html=template.read_text();sourcebase=re.search(r'<base\b[^>]*href="([^"]+)"',html,re.I);templatefolder=Path(page['template']).parent.as_posix();relative=sourcebase[1] if sourcebase else './';import posixpath
 absolute=posixpath.normpath(base+templatefolder+'/'+relative)+'/'
 html=re.sub(r'<base\b[^>]*>','',html,flags=re.I);html=re.sub(r'<head[^>]*>',lambda m:m[0]+'<base href="'+escape(absolute,quote=True)+'">',html,count=1,flags=re.I)
 title=escape(page.get('title') or page['name']);html=re.sub(r'<title>.*?</title>','<title>'+title+'</title>',html,flags=re.S|re.I)
 page['image']=image(page.get('image') or '')
 for name,value in [('description',page.get('description','')),('og:title',page.get('title') or page['name']),('og:description',page.get('description','')),('og:image',page['image'])]:
  html=re.sub(r'<meta\b(?=[^>]*(?:name|property)="'+re.escape(name)+'")[^>]*>','',html,flags=re.I)
  html=html.replace('</head>','<meta '+('property' if name.startswith('og:') else 'name')+'="'+name+'" content="'+escape(value,quote=True)+'"></head>')
 target=out/path.lstrip('/')/'index.html';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(html)
 for old in set(page.get('legacyUrls',[])+[page.get('originalPath',path)]):
  parsed=urlparse(old);source=parsed.path
  if parsed.query:source+='?'+parsed.query
  if source and source!=path:redirects.append((source,path))
for patches in state.get('patches',{}).values():
 for patch in patches:
  if patch.get('imageData'):patch['src']=image(patch.pop('imageData'))
published=out/'cms/published-site-content.json';published.parent.mkdir(exist_ok=True);published.write_text(json.dumps(state,ensure_ascii=False,indent=2))
(out/'_redirects').write_text('\n'.join(old+' '+new+' 301!' for old,new in sorted(set(redirects)))+'\n')
(out/'redirect-map.json').write_text(json.dumps([{'from':x,'to':y,'status':301} for x,y in sorted(set(redirects))],ensure_ascii=False,indent=2))
print('Prepared static pages, published settings, images and redirect mapping in',out)
print('Review these files and merge them into the site before committing. GitHub Pages does not execute _redirects; configure HTTP 301 on the production host.')
