"""Discover public route definitions, never enumerate CMS records as pages."""
import html
import json
import re
import subprocess
import uuid
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

EXCLUDED = {'page-uploads':'업로드 페이지 내부 리소스', 'admin':'어드민 전용', 'migration':'이관 원본 보관', 'assets':'정적 리소스',
            'components':'내부 컴포넌트', 'demo':'개발 확인용', 'deployment':'전달용 산출물',
            'docs':'문서', 'scripts':'개발 도구', 'tests':'테스트', 'tools':'개발 도구',
            'flutter':'Flutter 원본', 'node_modules':'의존성', '.git':'Git 내부'}
PATTERNS = {'columns/view/index.html':('/columns/:id/','칼럼 상세', ['/columns/view/']),
            'silovematch/events/view/index.html':('/silovematch/events/:slug/','이벤트 상세',['/silovematch/events/view/']),
            'forms/index.html':('/forms/','입력폼',['/forms/:slug/'])}

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(); self.title=''; self.in_title=False; self.meta={}; self.links=[]; self.canonical=''
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='title': self.in_title=True
        if tag=='meta': self.meta[a.get('name',a.get('property',a.get('http-equiv','').lower()))]=a.get('content','')
        if tag=='link' and a.get('rel')=='canonical': self.canonical=a.get('href','')
        if tag=='a' and a.get('href'): self.links.append(a['href'])
    def handle_endtag(self,tag):
        if tag=='title': self.in_title=False
    def handle_data(self,text):
        if self.in_title: self.title+=text

def admin_name(title,path):
    if path=='/':return '홈'
    if path=='/columns/':return '시놀칼럼'
    if path=='/company/':return '회사소개'
    return re.split(r'\s*[·|]\s*',title,maxsplit=1)[0].strip() or title

def discover(root):
    root=Path(root); records=[]; exclusions=[]
    seo_file=root/'cms/page-seo.json'
    seo_catalog=json.loads(seo_file.read_text()) if seo_file.exists() else {}
    try: tracked=set(subprocess.check_output(['git','ls-files'],cwd=root,text=True,stderr=subprocess.DEVNULL).splitlines())
    except (OSError,subprocess.CalledProcessError): tracked=set()
    for file in sorted(root.rglob('*.html')):
        relative=file.relative_to(root).as_posix(); parts=file.relative_to(root).parts
        reason=EXCLUDED.get(parts[0])
        if not reason and ('admin-preview' in file.name or file.name=='pagination-demo.html'): reason='개발·어드민 미리보기'
        if not reason and len(parts)>2 and parts[0]=='columns' and parts[1].isdigit(): reason='/columns/:id/ 동적 경로로 통합'
        if not reason and relative.startswith('silovematch/events/') and relative not in {'silovematch/events/index.html','silovematch/events/view/index.html'}: reason='/silovematch/events/:slug/ 동적 경로로 통합'
        if reason: exclusions.append({'source':relative,'reason':reason}); continue
        parser=Metadata(); parser.feed(file.read_text(errors='replace'))
        if parts[0]=='managed-pages' and parser.meta.get('page-route') and (root/parser.meta['page-route'].strip('/')/'index.html').is_file():
            exclusions.append({'source':relative,'reason':'정적 배포된 업로드 페이지와 중복되는 내부 소스'});continue
        path='/' if relative=='index.html' else '/'+(relative[:-10] if relative.endswith('index.html') else relative)
        title=html.unescape(parser.title).strip() or file.stem
        aliases=[]
        if relative in PATTERNS: path,_,aliases=PATTERNS[relative]
        if parser.meta.get('page-route'):path=parser.meta['page-route']
        protected=relative in {'index.html','forms/index.html','404.html'}
        kind='dynamic' if relative in PATTERNS else 'policy' if parts[0]=='policy' or file.name=='terms.html' else 'system' if file.name=='404.html' else 'landing' if parts[0] in {'silovematch','adv','download','moim','silove'} else 'page'
        if parser.meta.get('page-type') in {'page','landing','policy','system','dynamic'}:kind=parser.meta['page-type']
        page_id=parser.meta.get('page-id') or str(uuid.uuid5(uuid.NAMESPACE_URL,'sinor-page:'+relative))
        uuid.UUID(page_id)
        records.append({'id':page_id,
            'name':admin_name(title,path), 'path':path,'initialPath':path,'source':relative,
            'sourceBase':'/'+(str(file.parent.relative_to(root)).replace('\\','/').strip('.')+'/').lstrip('/'),
            'redirectTarget':parser.meta.get('refresh',''),'aliases':aliases,'type':kind,'protected':protected,'registered':True,
            'sourceStatus':'tracked' if relative in tracked else 'local',
            'published':True,'menuName':admin_name(title,path),'hoverName':'','headerMenu':False,'footerMenu':False,
            'pcMenu':True,'mobileMenu':True,'order':len(records)*10,
            'seo':{'title':parser.title,'description':parser.meta.get('description',''),
                   'canonical':parser.canonical,'indexable':'noindex' not in parser.meta.get('robots',''),
                   'sitemap':kind not in {'dynamic','system'},'ogTitle':parser.meta.get('og:title',''),
                   'ogDescription':parser.meta.get('og:description',''),'ogImage':parser.meta.get('og:image',''),
                   'ogUrl':parser.meta.get('og:url','')},'defaults':{}})
    # Path groups have no source and are never published as invented content pages.
    paths={p['path'] for p in records}
    for page in list(records):
        parts=page['path'].strip('/').split('/')[:-1]
        for n in range(1,len(parts)+1):
            path='/'+('/'.join(parts[:n]))+'/'
            if ':' in path or path in paths: continue
            paths.add(path)
            records.append({'id':str(uuid.uuid5(uuid.NAMESPACE_URL,'sinor-group:'+path)),
                            'name':path,'path':path,'initialPath':path,'source':'','aliases':[],
                            'type':'group','protected':False,'registered':True,'published':False,
                            'sourceStatus':'group','menuName':'','hoverName':'','headerMenu':False,
                            'footerMenu':False,'pcMenu':True,'mobileMenu':True,'order':0,'seo':{}})
    # Infer menu visibility from real header/footer DOM, never create or rename menu items.
    from urllib.parse import urljoin,urlsplit
    footer=root/'components/footer.html'
    footer_html=footer.read_text() if footer.exists() else ''
    footer_links=Metadata(); footer_links.feed(footer_html)
    fpaths={urlsplit(urljoin('https://web.sinor.co.kr/components/footer.html',x)).path for x in footer_links.links}
    hpaths=set()
    for page in records:
        if not page['source']: continue
        text=(root/page['source']).read_text(errors='replace')
        for header in re.findall(r'<header\b[\s\S]*?</header>',text,re.I):
            p=Metadata();p.feed(header)
            hpaths.update(urlsplit(urljoin('https://web.sinor.co.kr'+page['initialPath'],x)).path for x in p.links)
    for page in records:
        page['headerMenu']=page['path'] in hpaths;page['footerMenu']=page['path'] in fpaths
    for page in records:
        overrides=seo_catalog.get(page['initialPath'],{})
        page['seo']={**page.get('seo',{}),**overrides}
        if page['seo'].get('title'):page['seo']['ogTitle']=page['seo']['title']
    counts=Counter(e['reason'] for e in exclusions)
    return {'version':1,'pages':records,'excluded':exclusions,'excludedCounts':dict(counts),
            'dynamicPatterns':list(PATTERNS.values()),'totalHtml':len(records)-sum(p['type']=='group' for p in records)+len(exclusions)}

def write_manifest(root):
    data=discover(root)
    path=Path(root)/'cms/page-registry.json'
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    return data
