"""Static designer bundles. JavaScript runs in an opaque-origin sandbox."""
from io import BytesIO
from pathlib import Path,PurePosixPath
import html,json,re,stat,uuid,zipfile,shutil
MAX_ZIP=50*1024*1024
MAX_EXPANDED=100*1024*1024
ALLOWED={'.html','.htm','.css','.js','.mjs','.json','.png','.jpg','.jpeg','.gif','.webp','.svg','.ico','.avif','.woff','.woff2','.ttf','.otf','.eot','.mp4','.webm','.mp3','.wav','.ogg','.pdf','.txt','.md','.markdown','.map'}

def unpack_bundle(data):
 if len(data)>MAX_ZIP:raise ValueError('ZIP은 50MB 이하로 업로드해 주세요.')
 try:z=zipfile.ZipFile(BytesIO(data))
 except zipfile.BadZipFile:raise ValueError('올바른 ZIP 파일을 선택해 주세요.')
 entries=[];total=0
 for info in z.infolist():
  raw=info.filename
  if info.is_dir() or raw.startswith('__MACOSX/') or raw.endswith('/.DS_Store') or raw=='.DS_Store':continue
  path=PurePosixPath(raw)
  if '\\' in raw or path.is_absolute() or '..' in path.parts or '\x00' in raw or re.match(r'^[A-Za-z]:',raw) or stat.S_ISLNK(info.external_attr>>16):raise ValueError('ZIP에 안전하지 않은 파일 경로가 있습니다.')
  if info.flag_bits&1:raise ValueError('암호화된 ZIP은 지원하지 않습니다.')
  if path.suffix.lower() not in ALLOWED:raise ValueError('지원하지 않는 파일입니다: '+raw)
  total+=info.file_size
  if len(entries)>=2000 or total>MAX_EXPANDED:raise ValueError('압축 해제 후 100MB, 2,000개 파일 이내로 구성해 주세요.')
  entries.append((path.as_posix(),info))
 if not entries:raise ValueError('ZIP에 페이지 파일이 없습니다.')
 names=[name for name,_ in entries];prefix=''
 if 'index.html' not in names:
  folders={name.split('/')[0] for name in names}
  if len(folders)==1 and all('/' in name for name in names):prefix=next(iter(folders))+'/'
 if not any(name==prefix+'index.html' for name in names):raise ValueError('ZIP의 최상위 폴더에 index.html이 필요합니다.')
 files={}
 for name,info in entries:
  name=name[len(prefix):]
  if name.casefold() in {x.casefold() for x in files}:raise ValueError('중복 파일 경로입니다: '+name)
  try:files[name]=z.read(info)
  except (zipfile.BadZipFile,RuntimeError):raise ValueError('ZIP 파일을 정상적으로 읽을 수 없습니다.')
 for name,content in files.items():
  if PurePosixPath(name).suffix.lower() in {'.html','.htm','.css','.js','.mjs','.json'}:
   try:content.decode('utf-8-sig')
   except UnicodeDecodeError:raise ValueError('HTML·CSS·JS 파일은 UTF-8로 저장해 주세요: '+name)
 return files

def install_bundle(store,page_id,data,revision):
 state=store.read()
 if revision!=state['revision']:
  from page_management import Conflict
  raise Conflict('페이지 설정이 변경되었습니다. 새로고침 후 다시 업로드해 주세요.')
 page=next((p for p in state['pages'] if p['id']==page_id and not p.get('removed')),None)
 if not page or page.get('protected') or page.get('contentKind') or page.get('source') and not page.get('bundleVersion'):raise ValueError('새로 추가한 일반 페이지에만 ZIP 디자인을 업로드할 수 있습니다.')
 files=unpack_bundle(data);version=uuid.uuid4().hex;root=store.root
 assets=root/'page-uploads'/page_id/version;wrapper=root/'managed-pages'/page_id/'index.html';previous=wrapper.read_bytes() if wrapper.exists() else None;archive=None
 assets.mkdir(parents=True);wrapper.parent.mkdir(parents=True,exist_ok=True)
 try:
  for name,content in files.items():
   target=assets/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(content)
  archive=root/'server/.pages-data/page-bundles'/page_id/(version+'.zip');archive.parent.mkdir(parents=True,exist_ok=True);archive.write_bytes(data)
  route=json.dumps(page['path']).replace('<','\\u003c');base='/page-uploads/'+page_id+'/'+version+'/'
  document='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="page-id" content="%s"><meta name="page-route" content="%s"><meta name="page-type" content="page"><title>%s</title></head><body></body></html>'%(page_id,html.escape(page['path'],quote=True),html.escape(page.get('seo',{}).get('title') or page['name']))
  wrapper.write_text(document)
  # The wrapper declares the existing page ID; discovery therefore never adds a duplicate.
  result=store.operation({'kind':'save','id':page_id,'revision':revision,'values':{'source':wrapper.relative_to(root).as_posix(),'type':'page','bundleVersion':version,**({'publishedBundleVersion':page.get('publishedBundleVersion') or page['bundleVersion']} if page.get('published') and page.get('bundleVersion') else {})}})
  return result
 except Exception:
  shutil.rmtree(assets,ignore_errors=True)
  if archive:archive.unlink(missing_ok=True)
  if previous is None:wrapper.unlink(missing_ok=True)
  else:wrapper.write_bytes(previous)
  raise

def instrument_html(content,base,files):
 text=content.decode('utf-8-sig')
 def resolve(match):
  value=match[2]
  return match[1]+base+value.lstrip('/')+match[3] if value.startswith('/') and value.lstrip('/').split('?',1)[0] in files else match[0]
 text=re.sub(r'''((?:src|href)\s*=\s*["'])(/[^"']*)(["'])''',resolve,text,flags=re.I)
 return text
