"""Transactional route operations for the loopback development server.
Company deployment must put the same operations behind its existing admin auth/RBAC.
"""
import copy
import html
import json
import math
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, unquote, parse_qsl, urlencode
from page_registry import discover,admin_name

RESERVED=('/admin/','/api/','/_page-management/','/assets/','/cms/','/server/','/scripts/','/.git/','/dev/')
TYPES={'page','landing','policy','system','dynamic','group','planned','external'}
FIELDS={'name','menuName','hoverName','path','type','published','headerMenu','footerMenu','pcMenu','mobileMenu','order','seo','source','externalUrl','removed','useSharedFooter','showInHeader','bundleVersion','publishedBundleVersion'}
SEO_FIELDS={'title','description','canonical','indexable','sitemap','ogTitle','ogDescription','ogImage','ogUrl'}
class Conflict(ValueError): pass

def now(): return datetime.now(timezone.utc).isoformat()
def path_key(path): return path.rstrip('/') or '/'
def clean_path(value,pattern=False):
    value=str(value).strip()
    if not value.startswith('/') or value.startswith('//') or '?' in value or '#' in value or '\\' in value or re.search(r'%2f|%5c|%25',value,re.I):
        raise ValueError('경로는 /로 시작하고 쿼리·해시·역슬래시 없이 입력해 주세요.')
    decoded=unquote(value)
    if any(p in {'.','..'} for p in decoded.split('/')) or '//' in value or any(ord(c)<32 for c in value): raise ValueError('잘못된 URL 경로입니다.')
    value=decoded
    segments=value.strip('/').split('/')
    if any('.' in part and not (i==len(segments)-1 and part.endswith('.html')) for i,part in enumerate(segments)):raise ValueError('정적 리소스 파일 경로는 페이지 URL로 사용할 수 없습니다.')
    if not re.fullmatch(r'/[a-zA-Z0-9_./:\-가-힣%]*',value): raise ValueError('URL에 허용되지 않는 문자가 있습니다.')
    if ':' in value and not pattern: raise ValueError('동적 경로 패턴은 직접 생성할 수 없습니다.')
    if any((value+'/').startswith(p) for p in RESERVED): raise ValueError('시스템 예약 경로입니다.')
    return value if value=='/' or '.' in value.rsplit('/',1)[-1] else value.rstrip('/')+'/'
def full_url(value):
    if not value:return ''
    if any(ord(c)<32 for c in str(value)):raise ValueError('URL에 제어 문자를 사용할 수 없습니다.')
    u=urlsplit(str(value))
    if u.scheme not in {'http','https'} or not u.netloc or u.username or u.password:raise ValueError('전체 HTTP 또는 HTTPS URL을 입력해 주세요.')
    return str(value)
def redirect_address(value):
    raw=str(value).strip()
    if raw.startswith(('http://','https://')):full_url(raw)
    elif not raw.startswith('/') or raw.startswith('//'):raise ValueError('이전 링크를 붙여넣어 주세요.')
    url=urlsplit(raw)
    if url.fragment:raise ValueError('이전 링크에서 # 뒷부분을 제거해 주세요.')
    path=clean_path(url.path or '/',True)
    query=urlencode(sorted(parse_qsl(url.query,keep_blank_values=True)))
    return path+('?' + query if query else '')

def parent_path(path):
    parts=path.strip('/').split('/')
    return '/'+('/'.join(parts[:-1])+'/') if len(parts)>1 else '/'
def route_match(pattern,path):
    regex='^'+re.sub(r':([a-zA-Z_]+)',lambda m:r'\d+' if m[1]=='id' else '[^/]+',re.escape(pattern).replace('\\:',':')).rstrip('/')+'/?$'
    return bool(re.fullmatch(regex,path))
def source_url(page,path):
    # Keep existing route loaders' ID/slug assumptions after a route move.
    initial=page.get('sourceRoute') or page.get('initialPath',page['path'])
    if ':' not in page['path'] and any(route_match(alias,path) for alias in page.get('aliases',[])):return path
    if ':' in page['path'] and ':' in initial:
        names=re.findall(r':([a-zA-Z_]+)',page['path'])
        regex='^'+re.sub(r':[a-zA-Z_]+',r'([^/]+)',re.escape(page['path']).replace('\\:',':')).rstrip('/')+'/?$'
        m=re.match(regex,path)
        if m:
            for name,value in zip(names,m.groups()):initial=initial.replace(':'+name,value)
    return initial

def synchronize(state,manifest):
    state=copy.deepcopy(state); existing={p['id']:p for p in state['pages']}
    for seed in manifest['pages']:
        if seed['id'] not in existing:state['pages'].append(copy.deepcopy(seed))
        else:
            old=existing[seed['id']]
            # Deployment updates source metadata only, never administrator overrides.
            for key in ['sourceStatus','registered','aliases','sourceBase','redirectTarget']:
                old[key]=seed.get(key)
            old['defaults']=seed.get('seo',{})
    present={p['id'] for p in manifest['pages']}
    for page in state['pages']:
        if page.get('registered') and page['id'] not in present:
            page['sourceStatus']='missing';page['registered']=False
    if state.get('pageInfoVersion',0)<2:
        seeds={p['id']:p for p in manifest['pages']}
        for page in state['pages']:
            seed=seeds.get(page['id'])
            original=page.get('defaults',{}).get('title') or page.get('seo',{}).get('title','')
            if seed and (page['name']==original or page['name']==seed.get('seo',{}).get('title')):
                page['name']=admin_name(page['name'],page['path'])
            if not page.get('menuName'):page['menuName']=page['name']
            if page.get('contentKind')=='event' and not page.get('seo',{}).get('title'):
                page.setdefault('seo',{})['title']=page.get('contentTitle',page['name'])+' · 시럽인연'
        state['pageInfoVersion']=2
    state['inventory']={k:v for k,v in manifest.items() if k!='pages'}
    return state

def validate(state):
    pages=[p for p in state['pages'] if not p.get('removed')]
    paths={};ids=set()
    for page in pages:
        if page['id'] in ids:raise ValueError('페이지 ID가 중복됩니다.')
        ids.add(page['id'])
        if page['type'] not in TYPES:raise ValueError('페이지 유형을 확인해 주세요.')
        path=clean_path(page['path'],page['type']=='dynamic')
        key=path_key(path)
        if key in paths:raise ValueError('이미 사용 중인 URL입니다: '+path)
        paths[key]=page
        if page['type']=='planned' and page.get('published'):raise ValueError('소스가 연결되지 않은 개발 예정 페이지는 공개할 수 없습니다.')
        if page['type']=='group' and page.get('published'):raise ValueError('경로 그룹은 공개 페이지가 아닙니다.')
        if page['type']=='external':
            if not page.get('externalUrl'):raise ValueError('외부 링크 URL을 입력해 주세요.')
            full_url(page['externalUrl'])
        if page.get('published') and page['type'] not in {'external','group'} and not page.get('source'):raise ValueError('소스 연결 후 공개할 수 있습니다.')
        if not isinstance(page.get('seo',{}),dict):raise ValueError('SEO 설정 형식을 확인해 주세요.')
        if page.get('order') is not None:
            try:
                if not math.isfinite(float(page['order'])):raise ValueError()
            except (ValueError,TypeError):raise ValueError('메뉴 순서는 숫자로 입력해 주세요.')
        for key in ['canonical','ogUrl','ogImage']:
            full_url(page.get('seo',{}).get(key,''))
    patterns=[p for p in pages if p['type']=='dynamic']
    # Reject equal-shape patterns and static pages shadowed by a moved dynamic pattern.
    for i,p in enumerate(patterns):
        for q in patterns[i+1:]:
            if re.sub(r':\w+',':param',p['path'])==re.sub(r':\w+',':param',q['path']):raise ValueError('동적 라우트가 충돌합니다.')
        for q in pages:
            if q['type'] not in {'dynamic','group'} and route_match(p['path'],q['path']) and q['path'] not in p.get('aliases',[]) and q.get('contentKind')!='event':
                raise ValueError('동적 라우트와 겹치는 URL입니다: '+q['path'])
    active={}
    for rule in state['redirects']:
        if not rule.get('active',True):continue
        address=redirect_address(rule['from']);parts=urlsplit(address);src=path_key(parts.path)+('?' + parts.query if parts.query else '');dest=clean_path(rule['to'],True)
        if rule.get('status') not in [301,302]:raise ValueError('301 또는 302를 선택해 주세요.')
        if src==path_key(dest) or rule.get('keepQuery') and path_key(parts.path)==path_key(dest):raise ValueError('자기 자신으로 리디렉션할 수 없습니다.')
        if src in active:raise ValueError('출발 URL이 중복됩니다.')
        if src in paths:raise ValueError('현재 페이지 URL을 리디렉션 출발 주소로 사용할 수 없습니다.')
        active[src]=path_key(dest)
    for start in active:
        seen=set();node=start
        while node in active:
            if node in seen:raise ValueError('순환 리디렉션입니다.')
            seen.add(node);node=active[node]
    # Flatten aliases so old links never acquire an unnecessary redirect chain.
    for rule in state['redirects']:
        if not rule.get('active',True):continue
        node=path_key(rule['to'])
        while node in active:node=active[node]
        if node!=path_key(rule['to']):
            rule['to']=next((r['to'] for r in state['redirects'] if path_key(r['to'])==node),node+'/')

def apply_operation(state,op,manifest):
    result=copy.deepcopy(state);before=copy.deepcopy(state);kind=op.get('kind');changed=[]
    pages=result['pages'];page=next((p for p in pages if p['id']==op.get('id')),None)
    if kind=='sync': result=synchronize(result,manifest)
    elif kind=='site-settings':
        supplied=op.get('values',{})
        if not isinstance(supplied,dict):raise ValueError('설정 형식을 확인해 주세요.')
        settings=copy.deepcopy(result.get('siteSettings') or {})
        for section in ['basic','footer']:
            if section not in supplied:continue
            allowed={'siteName','description','favicon','image'} if section=='basic' else {'company','representative','address','businessNumber','commerce','tourism','marriage','email','phone','copyright'}
            settings[section]={k:str(v).strip()[:5000] for k,v in supplied[section].items() if k in allowed}
            if section=='footer':
                settings[section]['phone']=settings[section].get('phone','').replace('02-506-5670','02-508-5670')
                settings[section]['company']=re.sub(r'(?:\(주\)|㈜|（주）)\s*시놀','시놀(주)',settings[section].get('company','시놀(주)'))
        if 'footerDesign' in supplied:
            design=supplied['footerDesign'];clean={}
            for key in ['background','primaryColor','textColor','logoColor']:
                if key not in design:continue
                if not re.fullmatch(r'#[0-9a-fA-F]{6}',str(design[key])):raise ValueError('색상 값을 확인해 주세요.')
                clean[key]=design[key]
            for key in ['primarySize','mobilePrimarySize','secondarySize','paddingY','paddingX','mobilePaddingY','mobilePaddingX','gap']:
                if key not in design:continue
                value=float(design[key]);low,high=(8,30) if 'Size' in key else (0,120)
                if not math.isfinite(value) or not low<=value<=high:raise ValueError('글자 크기 또는 여백을 확인해 주세요.')
                clean[key]=value
            settings['footerDesign']=clean
        if 'footerLinks' in supplied:
            if not isinstance(supplied['footerLinks'],list) or len(supplied['footerLinks'])>100:raise ValueError('링크 목록을 확인해 주세요.')
            links=[];ids=set()
            for item in supplied['footerLinks']:
                id=str(item['id']);url=str(item['url']).strip();label=str(item['label']).strip()
                if not re.fullmatch(r'link-\d+',id) or id in ids or not label:raise ValueError('링크 이름을 확인해 주세요.')
                parsed=urlsplit(url)
                if parsed.scheme and parsed.scheme not in {'http','https','mailto','tel'} or parsed.username or parsed.password or url.startswith('//') or not url or any(ord(c)<32 for c in url):raise ValueError('올바른 링크 주소를 입력해 주세요.')
                ids.add(id);links.append({'id':id,'label':label[:120],'url':url})
            settings['footerLinks']=links
        result['siteSettings']=settings
    elif kind=='reorder':
        ids=op.get('ids',[])
        if not isinstance(ids,list) or len(ids)!=len(set(ids)) or len(ids)<2:raise ValueError('정렬할 페이지 목록을 확인해 주세요.')
        selected=[next((p for p in pages if p['id']==id and not p.get('removed')),None) for id in ids]
        if any(p is None for p in selected):raise ValueError('페이지를 찾을 수 없습니다.')
        if len({parent_path(p['path']) for p in selected})!=1 or any(p['path']=='/' for p in selected):raise ValueError('같은 단계의 페이지끼리 순서를 바꿔 주세요.')
        for index,page in enumerate(selected):page['order']=index*10
    elif kind=='sync-events':
        source=next((p for p in manifest['pages'] if p.get('source')=='silovematch/events/view/index.html'),None)
        if not source:raise ValueError('이벤트 상세 소스를 찾을 수 없습니다.')
        for item in op.get('records',[])[:5000]:
            content_id=str(item['id']);event_id=str(uuid.uuid5(uuid.NAMESPACE_URL,'sinor-event-page:'+content_id))
            existing=next((p for p in pages if p['id']==event_id),None)
            slug=str(item.get('slug','')).strip()
            if not slug or not re.fullmatch(r'[a-z0-9]+(?:[-_][a-z0-9]+)*',slug):continue
            eventpath='/silovematch/events/'+slug+'/'
            if existing:
                existing['contentTitle']=str(item['title']);existing['contentPublished']=bool(item.get('published'))
                continue
            pages.append({**copy.deepcopy(source),'id':event_id,'name':str(item['title']),'path':eventpath,'initialPath':eventpath,
                          'sourceRoute':eventpath,'aliases':[],'type':'page','protected':False,'registered':False,
                          'contentKind':'event','contentId':content_id,'contentTitle':str(item['title']),
                          'contentPublished':bool(item.get('published')),'published':bool(item.get('published')),
                          'order':len(pages)*10,'menuName':str(item['title']),'seo':{'title':str(item['title'])+' · 시럽인연'}})
    elif kind=='sync-forms':
        source=next((p for p in manifest['pages'] if p.get('source')=='forms/index.html'),None)
        if not source:raise ValueError('입력폼 소스를 찾을 수 없습니다.')
        for item in op.get('records',[])[:5000]:
            slug=str(item.get('slug','')).strip()
            if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}',slug):continue
            content_id=str(item['id']);form_id=str(uuid.uuid5(uuid.NAMESPACE_URL,'sinor-form-page:'+content_id))
            existing=next((p for p in pages if p['id']==form_id),None)
            if existing:
                if existing['name']==existing.get('contentTitle'):existing['name']=str(item['name'])
                existing.update(contentTitle=str(item['name']),contentPublished=bool(item.get('active')))
                continue
            path='/forms/'+slug+'/'
            pages.append({**copy.deepcopy(source),'id':form_id,'name':str(item['name']),'menuName':str(item['name']),
                'path':path,'initialPath':path,'sourceRoute':path,'aliases':[],'type':'page','protected':False,'registered':False,
                'contentKind':'form','contentId':content_id,'contentTitle':str(item['name']),'contentPublished':bool(item.get('active')),
                'published':bool(item.get('active')),'order':len(pages)*10,
                'seo':{'title':str(item['name'])+' · 시놀','description':str(item['name'])+'에 필요한 정보를 입력하고 신청을 완료하세요.',
                       'ogTitle':str(item['name'])+' · 시놀','ogDescription':str(item['name'])+'에 필요한 정보를 입력하고 신청을 완료하세요.','canonical':'https://web.sinor.co.kr'+path,'ogUrl':'https://web.sinor.co.kr'+path,'ogImage':'https://web.sinor.co.kr/assets/'+('silovematch-logo.png' if '시럽' in str(item['name']) else 'sinor-logo-official.png'),'indexable':False,'sitemap':False}})
    elif kind=='defaults':
        result['defaults']={k:v for k,v in op.get('values',{}).items() if k in SEO_FIELDS}
        for key in ['canonical','ogUrl','ogImage']:full_url(result['defaults'].get(key,''))
    elif kind=='redirect':
        values={k:v for k,v in op.get('values',{}).items() if k in {'from','to','status','active','keepQuery','pageId'}}
        raw=str(values.get('from','')).strip();values['from']=redirect_address(raw);values['to']=clean_path(values.get('to',''),True)
        values['sourceUrl']=raw if raw.startswith(('http://','https://')) else ''
        if values.get('pageId'):
            target=next((p for p in pages if p['id']==values['pageId'] and not p.get('removed')),None)
            if not target:raise ValueError('연결할 페이지를 찾을 수 없습니다.')
        old=next((r for r in result['redirects'] if r['id']==op.get('redirectId')),None)
        if old:old.update(values,updatedAt=now(),updatedBy='로컬 관리자')
        else:result['redirects'].append(dict(values,id=str(uuid.uuid4()),createdAt=now(),updatedAt=now(),updatedBy='로컬 관리자'))
    elif kind=='restore':
        history=next((h for h in result['history'] if h['id']==op.get('historyId')),None)
        if not history:raise ValueError('복원할 변경 이력이 없습니다.')
        result['pages']=copy.deepcopy(history['before']['pages']);result['redirects']=copy.deepcopy(history['before']['redirects']);result['defaults']=copy.deepcopy(history['before'].get('defaults',{}))
        result=synchronize(result,manifest)
    elif kind=='delete':
        if not page:raise ValueError('페이지를 찾을 수 없습니다.')
        if page.get('protected'):raise ValueError('보호된 시스템 페이지는 삭제할 수 없습니다.')
        if any(p['id']!=page['id'] and not p.get('removed') and p['path'].startswith(page['path']) for p in pages):raise ValueError('하위 페이지를 먼저 이동하거나 정리해 주세요.')
        page.update(removed=True,published=False)
    elif kind in {'save','move'}:
        if not page:
            if op.get('id'):raise ValueError('페이지를 찾을 수 없습니다.')
            page={'id':str(uuid.uuid4()),'name':'','path':'','initialPath':'','source':'','aliases':[],'type':'planned','protected':False,'registered':False,'published':False,'order':0,'seo':{},'pcMenu':True,'mobileMenu':True}
            pages.append(page)
        oldpath=page['path'];values={k:v for k,v in op.get('values',{}).items() if k in FIELDS and k!='removed'}
        for bundle_field in ['bundleVersion','publishedBundleVersion']:
            if bundle_field in values and not re.fullmatch(r'[a-f0-9]{32}',str(values[bundle_field])):raise ValueError('페이지 ZIP 버전을 확인해 주세요.')
        if 'seo' in values:
            if not isinstance(values['seo'],dict):raise ValueError('SEO 설정 형식을 확인해 주세요.')
            values['seo']={k:v for k,v in values['seo'].items() if k in SEO_FIELDS}
            if values['seo'].get('title','')!=page.get('seo',{}).get('title',''):values['titleCustomized']=True
        for key in ['published','headerMenu','footerMenu','pcMenu','mobileMenu','useSharedFooter','showInHeader']:
            if key in values and type(values[key]) is not bool:raise ValueError('공개 및 메뉴 설정 형식을 확인해 주세요.')
        if kind=='move':
            target=next((p for p in pages if p['id']==op.get('parentId')),None)
            if op.get('parentId') and not target:raise ValueError('상위 페이지를 찾을 수 없습니다.')
            parent=target['path'] if target else '/'
            if target and (target['id']==page['id'] or parent.startswith(oldpath) and oldpath!='/'):raise ValueError('자신 또는 하위 페이지로 이동할 수 없습니다.')
            if target and (not parent.endswith('/') or target['type'] in {'dynamic','external','system'} and target['path']!='/forms/' or ':' in parent):raise ValueError('이 항목은 상위 경로로 사용할 수 없습니다.')
            values={'path':parent.rstrip('/')+'/'+oldpath.strip('/').split('/')[-1]+'/','order':op.get('order',page.get('order',0))}
        if not str(values.get('name',page['name'])).strip():raise ValueError('페이지명을 입력해 주세요.')
        if page.get('protected') and any(values.get(k,page.get(k))!=page.get(k) for k in ['path','source','type']):raise ValueError('보호된 시스템 페이지의 URL·소스·유형은 변경할 수 없습니다.')
        newsource=values.get('source',page.get('source',''))
        if newsource:
            allowed={p['source'] for p in manifest['pages'] if p.get('source')}
            if newsource not in allowed:raise ValueError('조사된 사용자용 페이지 소스만 연결할 수 있습니다.')
            seed=next(p for p in manifest['pages'] if p.get('source')==newsource)
            values['sourceRoute']=seed['initialPath'];values['sourceBase']=seed.get('sourceBase')
        if values.get('type',page['type'])=='planned' and newsource:values['type']='page'
        for key in ['name','menuName']:
            if key in values:
                if not isinstance(values[key],str) or len(values[key])>200:raise ValueError('페이지 이름은 200자 이내로 입력해 주세요.')
                values[key]=values[key].strip()
        if any(key in values and values[key]!=page.get(key) for key in ['menuName','headerMenu','footerMenu']):
            values['menuConfigured']=True
            values['headerScope']='/'+page.get('initialPath',page['path']).strip('/').split('/')[0]+'/'
        if 'showInHeader' in values:

            values['headerVisibilitySet']=True
            values['headerScope']='/'+page.get('initialPath',page['path']).strip('/').split('/')[0]+'/'
        if values.get('published') is True and page.get('bundleVersion'):values['publishedBundleVersion']=values.get('bundleVersion',page['bundleVersion'])
        page.update(values)
        if not page.get('initialPath'):page['initialPath']=page['path']
        newpath=clean_path(page['path'],page['type']=='dynamic');page['path']=newpath
        if oldpath and oldpath!='/' and newpath!=oldpath and newpath.startswith(oldpath):raise ValueError('자신의 하위 경로로 이동할 수 없습니다.')
        expected=set(re.findall(r':([a-zA-Z_]+)',page.get('sourceRoute') or page.get('initialPath','')))
        if page['type']=='dynamic' and expected and expected!=set(re.findall(r':([a-zA-Z_]+)',newpath)):raise ValueError('기존 동적 경로의 매개변수는 유지해야 합니다.')
        if oldpath and path_key(oldpath)!=path_key(newpath):
            if oldpath=='/' or newpath=='/':raise ValueError('홈 경로는 이동할 수 없습니다.')
            changed.append({'id':page['id'],'name':page['name'],'from':oldpath,'to':newpath})
            for child in pages:
                if child['id']!=page['id'] and not child.get('removed') and child['path'].startswith(oldpath):
                    if child.get('protected'):raise ValueError('하위에 보호된 시스템 페이지가 있습니다.')
                    previous=child['path'];child['path']=newpath+previous[len(oldpath):]
                    changed.append({'id':child['id'],'name':child['name'],'from':previous,'to':child['path']})
            destinations={path_key(x['from']):x['to'] for x in changed}
            for rule in result['redirects']:
                if path_key(rule['to']) in destinations:rule['to']=destinations[path_key(rule['to'])]
            # Returning to a previous URL removes the conflicting former redirect atomically.
            result['redirects']=[r for r in result['redirects'] if path_key(r['from']) not in {path_key(x['to']) for x in changed}]
            if op.get('redirect',True):
                for item in changed:result['redirects'].append({'id':str(uuid.uuid4()),'from':item['from'],'to':item['to'],'status':301,'active':True,'keepQuery':True,'pageId':item['id'],'createdAt':now(),'updatedAt':now(),'updatedBy':'로컬 관리자'})
    else:raise ValueError('지원하지 않는 작업입니다.')
    validate(result)
    if kind=='restore':
        old={p['id']:p for p in before['pages']}
        changed=[{'id':p['id'],'name':p['name'],'from':old[p['id']]['path'],'to':p['path']} for p in result['pages'] if p['id'] in old and p['path']!=old[p['id']]['path']]
    return result,changed,before

class PageStore:
    def __init__(self,root,dbpath):
        self.root=Path(root);self.dbpath=Path(dbpath);self.dbpath.parent.mkdir(parents=True,exist_ok=True)
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, body TEXT NOT NULL)')
            row=db.execute('SELECT body FROM state WHERE id=1').fetchone()
            state=json.loads(row[0]) if row else {'pages':[],'redirects':[],'history':[],'revision':0,'defaults':{}}
            manifest=discover(self.root)
            state=synchronize(state,manifest)
            if state.get('navigationVersion',0)<2:
                seeds={p['id']:p for p in manifest['pages']}
                for page in state['pages']:
                    page.pop('menuCustomized',None);page.pop('orderCustomized',None)
                    if page['id'] in seeds:
                        for key in ['headerMenu','footerMenu','pcMenu','mobileMenu']:page[key]=seeds[page['id']].get(key,True if key in {'pcMenu','mobileMenu'} else False)
                state['navigationVersion']=2
            validate(state)
            db.execute('INSERT OR REPLACE INTO state VALUES (1,?)',(json.dumps(state,ensure_ascii=False),))
    def connect(self): return sqlite3.connect(self.dbpath,timeout=15)
    def read(self):
        with self.connect() as db:return json.loads(db.execute('SELECT body FROM state WHERE id=1').fetchone()[0])
    def operation(self,op,preview=False):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            current=json.loads(db.execute('SELECT body FROM state WHERE id=1').fetchone()[0])
            if op.get('revision')!=current['revision']:raise Conflict('다른 창에서 설정이 변경되었습니다. 목록을 새로고침해 주세요.')
            manifest=discover(self.root)
            result,changes,before=apply_operation(current,op,manifest)
            if preview:return {'changes':changes,'revision':current['revision']}
            result['revision']+=1
            summary={k:op.get(k) for k in ['kind','id','values','parentId','order','redirectId','historyId'] if k in op}
            oldpages={p['id']:p for p in before['pages']};diff=[]
            for p in result['pages']:
                old=oldpages.get(p['id'],{})
                for key in p:
                    if old.get(key)!=p[key]:diff.append({'pageId':p['id'],'page':p['name'],'field':key,'before':old.get(key),'after':p[key]})
            for scope in ['defaults','redirects']:
                if before[scope]!=result[scope]:diff.append({'scope':scope,'before':before[scope],'after':result[scope]})
            result['history'].insert(0,{'id':str(uuid.uuid4()),'at':now(),'actor':'로컬 관리자','operation':summary,'changes':changes,'diff':diff,'before':{k:before[k] for k in ['pages','redirects','defaults']}})
            result['history']=result['history'][:100]
            db.execute('UPDATE state SET body=? WHERE id=1',(json.dumps(result,ensure_ascii=False),))
            return self.public(result)
    @staticmethod
    def public(state):
        out=copy.deepcopy(state)
        for h in out['history']:h.pop('before',None)
        return out

def metadata_html(text,page,defaults,canonical):
    seo={**{k:v for k,v in defaults.items() if v is not None and v!=''},**{k:v for k,v in page.get('seo',{}).items() if v!='' and v is not None}}
    esc=lambda v:html.escape(str(v),quote=True)
    if seo.get('title'):
        text=re.sub(r'<title\b[^>]*>.*?</title>','<title>'+esc(seo['title'])+'</title>',text,flags=re.I|re.S)
    tags=[]
    for field,name,attr in [('description','description','name'),('ogTitle','og:title','property'),('ogDescription','og:description','property'),('ogImage','og:image','property'),('ogUrl','og:url','property')]:
        if seo.get(field):
            text=re.sub(r'<meta\b[^>]*\b'+attr+r'=["\']'+re.escape(name)+r'["\'][^>]*>','',text,flags=re.I)
            tags.append('<meta '+attr+'="'+name+'" content="'+esc(seo[field])+'">')
    if seo.get('canonical'):
        text=re.sub(r'<link\b[^>]*rel=["\']canonical["\'][^>]*>','',text,flags=re.I)
        tags.append('<link rel="canonical" href="'+esc(seo['canonical'])+'">')
    if 'indexable' in seo:
        text=re.sub(r'<meta\b[^>]*name=["\']robots["\'][^>]*>','',text,flags=re.I)
        tags.append('<meta name="robots" content="'+('index,follow' if seo['indexable'] else 'noindex,nofollow')+'">')
    return re.sub(r'</head>',lambda m:''.join(tags)+m.group(),text,count=1,flags=re.I)
