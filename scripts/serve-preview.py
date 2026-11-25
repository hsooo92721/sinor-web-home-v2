"""Loopback prototype server with transactional page management and HTTP redirects."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
import html
import json
import re
import secrets
import sqlite3
import sys
from urllib.parse import urlsplit, quote, parse_qs, parse_qsl, urlencode, unquote
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from page_bundle import install_bundle,instrument_html,MAX_ZIP
from footer_source import read_footer_source,save_footer_source
from page_registry import write_manifest
from page_management import PageStore, Conflict, route_match, path_key, metadata_html, source_url

class PreviewHandler(SimpleHTTPRequestHandler):
    def parse_request(self):
        if not super().parse_request():return False
        host=urlsplit('http://'+self.headers.get('Host','')).hostname
        if host not in {'127.0.0.1','localhost','::1'}:
            self.send_error(421,'This development server is loopback-only');return False
        return True
    def json_response(self,value,status=200):
        data=json.dumps(value,ensure_ascii=False).encode();self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_GET(self):
        if urlsplit(self.path).path=='/_page-management/page-bundle':
            params=parse_qs(urlsplit(self.path).query);page=next((p for p in self.server.pages.read()['pages'] if p['id']==params.get('id',[''])[0]),None)
            if not page or not page.get('bundleVersion'):self.send_error(404);return
            file=Path(self.directory)/'server/.pages-data/page-bundles'/page['id']/(page['bundleVersion']+'.zip')
            if not file.is_file():self.send_error(404);return
            data=file.read_bytes();self.send_response(200);self.send_header('Content-Type','application/zip');self.send_header('Content-Disposition','attachment; filename="page-design.zip"');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
        if urlsplit(self.path).path=='/_page-management/footer-source':
            self.json_response({**read_footer_source(self.directory),'token':self.server.page_token});return
        if urlsplit(self.path).path=='/_page-management/site-settings':
            state=self.server.pages.read();self.json_response({'settings':state.get('siteSettings'),'revision':state['revision'],'token':self.server.page_token});return
        if urlsplit(self.path).path=='/_page-management/navigation':
            state=self.server.pages.read();keys=['id','name','initialPath','path','published','showInHeader','headerScope','menuConfigured','menuName','headerMenu','footerMenu']
            self.json_response([{k:p.get(k) for k in keys} for p in state['pages'] if (p.get('headerVisibilitySet') or p.get('menuConfigured')) and not p.get('removed') and p['path']!='/']);return
        if urlsplit(self.path).path=='/_page-management/state':
            self.json_response({**PageStore.public(self.server.pages.read()),'token':self.server.page_token,'backend':'local-server'});return
        super().do_GET()
    def do_POST(self):
        path=urlsplit(self.path).path
        if path not in {'/_page-management/preview','/_page-management/change','/_page-management/footer-source','/_page-management/page-bundle'}:self.send_error(404);return
        origin=self.headers.get('Origin')
        if (origin and urlsplit(origin).netloc!=self.headers.get('Host')) or not secrets.compare_digest(self.headers.get('X-Page-Token',''),self.server.page_token):
            self.json_response({'error':'관리자 요청을 확인할 수 없습니다.'},403);return
        try:
            length=int(self.headers.get('Content-Length','0'))
            if path=='/_page-management/page-bundle':
                if not 0<length<=MAX_ZIP:raise ValueError('ZIP은 50MB 이하로 업로드해 주세요.')
                self.json_response(install_bundle(self.server.pages,self.headers.get('X-Page-Id',''),self.rfile.read(length),int(self.headers.get('X-Page-Revision','-1'))));return
            if length<=0 or length>1024*1024:raise ValueError('요청 크기를 확인해 주세요.')
            op=json.loads(self.rfile.read(length));result=save_footer_source(self.directory,op) if path.endswith('/footer-source') else self.server.pages.operation(op,preview=path.endswith('/preview'))
            self.json_response(result)
        except Conflict as e:self.json_response({'error':str(e)},409)
        except (ValueError,KeyError,TypeError) as e:self.json_response({'error':str(e)},400)
        except (sqlite3.Error,OSError):self.json_response({'error':'저장을 완료하지 못했습니다. 기존 설정은 유지됩니다.'},503)
    def page_bytes(self,text,status=200,content_type='text/html; charset=utf-8'):
        data=text.encode();self.send_response(status);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(data)));self.end_headers();return BytesIO(data)
    def redirect(self,target,status=301):
        self.send_response(status);self.send_header('Location',quote(target,safe='/:?&=%_-~.'));self.send_header('Content-Length','0');self.end_headers();return None
    def send_head(self):
        original=self.path;url=urlsplit(original);path=unquote(url.path)
        if any((path+'/').startswith(p) for p in ['/.git/','/server/','/scripts/','/tests/','/_page-management/']):self.send_error(404);return None
        if Path(path).suffix.lower() in {'.js','.css','.json','.png','.jpg','.jpeg','.webp','.gif','.svg','.woff','.woff2','.ico','.mp4','.webm','.txt'} and not path.startswith('/dev/'):
            return super().send_head()
        state=self.server.pages.read();preview=path.startswith('/dev/')
        if path=='/sitemap.xml':
            origin='http://'+self.headers.get('Host','localhost')
            links=['<url><loc>'+html.escape(origin+p['path'])+'</loc></url>' for p in state['pages'] if not p.get('removed') and p.get('published') and p.get('source') and ':' not in p['path'] and p.get('seo',{}).get('sitemap',state.get('defaults',{}).get('sitemap',False))]
            return self.page_bytes('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(links)+'</urlset>',content_type='application/xml; charset=utf-8')
        if preview:path='/'+path[len('/dev/'):]
        if path.startswith('/page-uploads/'):
            parts=path.strip('/').split('/')
            owner=next((p for p in state['pages'] if len(parts)>3 and p['id']==parts[1] and parts[2] in ({p.get('bundleVersion'),p.get('publishedBundleVersion')} if preview else {p.get('publishedBundleVersion') or p.get('bundleVersion')}) and not p.get('removed')),None)
            if not owner or not preview and not owner.get('published'):self.send_error(404);return None
            folder=(Path(self.directory)/'page-uploads'/parts[1]/parts[2]).resolve();target=(Path(self.directory)/path.lstrip('/')).resolve()
            if not target.is_relative_to(folder) or not target.is_file():self.send_error(404);return None
            if target.suffix.lower() in {'.html','.htm'}:
                self.send_response(200);text=instrument_html(target.read_bytes(),('/dev' if preview else '')+'/page-uploads/'+parts[1]+'/'+parts[2]+'/',{x.relative_to(folder).as_posix() for x in folder.rglob('*') if x.is_file()});data=text.encode()
                self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Security-Policy',"sandbox allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation");self.send_header('Content-Length',str(len(data)));self.end_headers();return BytesIO(data)
            if target.suffix.lower() in {'.css','.js','.mjs'}:
                text=target.read_text();base=('/dev' if preview else '')+'/page-uploads/'+parts[1]+'/'+parts[2]+'/'
                names={x.relative_to(folder).as_posix() for x in folder.rglob('*') if x.is_file()}
                text=re.sub(r'''(["'])(/[^"']+)(["'])''',lambda m:m[1]+base+m[2].lstrip('/')+m[3] if m[2].lstrip('/').split('?',1)[0] in names else m[0],text)
                return self.page_bytes(text,content_type='text/css; charset=utf-8' if target.suffix.lower()=='.css' else 'text/javascript; charset=utf-8')
            original_path=self.path;self.path=path
            try:return super().send_head()
            finally:self.path=original_path

        if not preview:
            for rule in sorted(state['redirects'],key=lambda r:bool(urlsplit(r['from']).query),reverse=True):
                source=urlsplit(rule['from'])
                query_matches=not source.query or urlencode(sorted(parse_qsl(source.query,keep_blank_values=True)))==urlencode(sorted(parse_qsl(url.query,keep_blank_values=True)))
                if rule.get('active') and query_matches and route_match(source.path,path):
                    target=rule['to'];names=re.findall(r':\w+',rule['from']);actual=path.strip('/').split('/');pattern=source.path.strip('/').split('/')
                    for a,b in zip(pattern,actual):
                        if a.startswith(':'):target=target.replace(a,b)
                    if rule.get('keepQuery') and url.query:target+='?'+url.query
                    return self.redirect(target,rule['status'])
        pages=state['pages'];page=next((p for p in pages if not p.get('removed') and path_key(p['path'])==path_key(path)),None)
        if not page:page=next((p for p in pages if not p.get('removed') and (p['type']=='dynamic' and route_match(p['path'],path) or any(route_match(a,path) for a in p.get('aliases',[])))),None)
        # Existing file aliases must respect visibility/URL changes too.
        if not page:
            source=path.lstrip('/')
            page=next((p for p in pages if p.get('source')==source and not p.get('removed')),None)
            if page and path_key(page['path'])!=path_key(page.get('initialPath','')):self.send_error(404);return None
        if page:
            if not preview and not page.get('published'):self.send_error(404);return None
            if page['type']=='external':return self.redirect(page['externalUrl'],302)
            if not page.get('source') or page['type'] in {'group','planned'}:self.send_error(404);return None
            target=(Path(self.directory)/page['source']).resolve()
            if not target.is_relative_to(Path(self.directory).resolve()) or not target.is_file():self.send_error(404);return None
            text=target.read_text()
            if page.get('bundleVersion'):
                version=page['bundleVersion'] if preview else page.get('publishedBundleVersion') or page['bundleVersion']
                folder=Path(self.directory)/'page-uploads'/page['id']/version
                entry=folder/'index.html'
                if not entry.is_file():self.send_error(404);return None
                base=('/dev' if preview else '')+'/page-uploads/'+page['id']+'/'+version+'/'
                text=entry.read_text(encoding='utf-8-sig')
                if not re.search(r'<head\b',text,re.I):text=re.sub(r'(<html\b[^>]*>)',r'\1<head></head>',text,count=1,flags=re.I) if re.search(r'<html\b',text,re.I) else '<html><head></head><body>'+text+'</body></html>'
                text=re.sub(r'<base\b[^>]*>','',text,flags=re.I)
                text=re.sub(r'<head([^>]*)>',lambda m:m.group()+'<base href="'+html.escape(base,quote=True)+'">',text,count=1,flags=re.I)
                names={x.relative_to(folder).as_posix() for x in folder.rglob('*') if x.is_file()}
                text=re.sub(r"""((?:src|href)\s*=\s*["'])(/[^"']*)(["'])""",lambda m:m[1]+base+m[2].lstrip('/')+m[3] if m[2].lstrip('/').split('?',1)[0] in names else m[0],text,flags=re.I)
                text=re.sub(r'''(href=["'])(#[^"']*)(["'])''',lambda m:m[1]+html.escape(url.path,quote=True)+m[2]+m[3],text,flags=re.I)
                # Every uploaded web page uses the shared footer.
                footer_path=Path(self.directory)/'components/footer.html'
                css_path=Path(self.directory)/'footer.css'
                if footer_path.is_file():
                    footer=footer_path.read_text()
                    footer=re.sub(r"""((?:src|href)=["'])\.\./""",r'\1/',footer)
                    text=re.sub(r'<footer\b[^>]*>[\s\S]*?</footer>','',text,flags=re.I)
                    text=text.replace('</body>',footer+'</body>')
                if css_path.is_file():text=text.replace('</head>','<style>'+css_path.read_text()+'</style></head>')
                text=metadata_html(text,page,state.get('defaults',{}),'http://'+self.headers.get('Host','localhost')+path)
                context=json.dumps({'bundleBase':base,'preview':preview}).replace('<','\\u003c')
                text=text.replace('</head>','<script>window.SINOR_PAGE_ROUTE='+context+';</script></head>',1)
                if preview:text=text.replace('</head>','<meta name="robots" content="noindex,nofollow"></head>',1)
                data=text.encode();self.send_response(200)
                self.send_header('Content-Type','text/html; charset=utf-8')
                self.send_header('Content-Security-Policy','sandbox allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation')
                self.send_header('Content-Length',str(len(data)));self.end_headers();return BytesIO(data)
            changed=path_key(page['path'])!=path_key(page.get('initialPath',''))
            if changed or preview or page['type']=='dynamic':
                text=re.sub(r'<base\b[^>]*>','',text,flags=re.I)
                base=page.get('sourceBase') or '/'+str(Path(page['source']).parent)+'/'
                text=re.sub(r'<head([^>]*)>',lambda m:m.group()+'<base href="'+html.escape(base,quote=True)+'">',text,count=1,flags=re.I)
            if page.get('useSharedFooter') is True:
                if 'app-footer' not in text:text=text.replace('</body>','<footer class="app-footer" data-shared-footer></footer></body>')
                if 'footer.js' not in text:text=text.replace('</body>','<script src="/footer.js?v=20261124-managed" defer></script></body>')
            elif page.get('useSharedFooter') is False:
                text=re.sub(r'<footer\b[^>]*class=["\'][^"\']*app-footer[^"\']*["\'][^>]*>[\s\S]*?</footer>','',text,flags=re.I)
                text=re.sub(r'<script\b[^>]*src=["\'][^"\']*footer\.js[^"\']*["\'][^>]*>[\s\S]*?</script>','',text,flags=re.I)
            text=metadata_html(text,page,state.get('defaults',{}),'http://'+self.headers.get('Host','localhost')+path)
            if changed or preview or page['type']=='dynamic' or page.get('contentId') or page.get('titleCustomized') or page.get('bundleVersion'):
                context=json.dumps({'originalPath':source_url(page,path),'preview':preview,'contentId':page.get('contentId'),'contentKind':page.get('contentKind'),'bundleBase':('/page-uploads/'+page['id']+'/'+(page['bundleVersion'] if preview else page.get('publishedBundleVersion') or page['bundleVersion'])+'/') if page.get('bundleVersion') else None,'title':page.get('seo',{}).get('title','') if page.get('titleCustomized') else ''}).replace('<','\\u003c')
                text=text.replace('</head>','<script>window.SINOR_PAGE_ROUTE='+context+';</script></head>',1)
            if page['path']!='/':text=text.replace('</head>','<script type="module" src="/cms/page-runtime.js?v=3"></script></head>',1)
            if preview:text=re.sub('</head>','<meta name="robots" content="noindex,nofollow"></head>',text,count=1,flags=re.I)
            return self.page_bytes(text)
        # Removed/private/unmapped old URLs cannot bypass policy via a file entry point.
        for p in pages:
            old=p.get('initialPath','')
            if old and (route_match(old,path) or path.lstrip('/')==p.get('source')):
                self.send_error(404);return None
        if preview:self.send_error(404);return None
        try:
            return super().send_head()
        finally:self.path=original
    def end_headers(self):
        if urlsplit(self.path).path.startswith(('/page-uploads/','/dev/page-uploads/')):self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Cache-Control','no-cache');super().end_headers()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('port',type=int,nargs='?',default=8792);parser.add_argument('--database',type=Path)
    args=parser.parse_args();root=Path(__file__).resolve().parents[1]
    write_manifest(root)
    db=args.database or root/'server/.pages-data/pages.sqlite'
    handler=partial(PreviewHandler,directory=str(root))
    with ThreadingHTTPServer(('127.0.0.1',args.port),handler) as server:
        server.pages=PageStore(root,db);server.page_token=secrets.token_urlsafe(32)
        print(f'페이지관리: http://127.0.0.1:{args.port}/admin/pages/',flush=True)
        server.serve_forever()
