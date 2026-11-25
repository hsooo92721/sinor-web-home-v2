import copy
from functools import partial
import http.client
from http.server import ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from page_registry import discover
from page_management import PageStore,Conflict,apply_operation,validate
spec=importlib.util.spec_from_file_location('managed_preview',ROOT/'scripts/serve-preview.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class PageManagementTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
  for path,title in [('index.html','홈'),('company/index.html','회사소개'),('company/team/index.html','팀'),('policy/privacy/index.html','개인정보'),('forms/index.html','입력폼'),('columns/view/index.html','칼럼'),('columns/1/index.html','개별 칼럼'),('admin/index.html','어드민')]:
   file=self.root/path;file.parent.mkdir(parents=True,exist_ok=True);file.write_text('<html><head><title>'+title+'</title><meta name="description" content="기본 설명"><link href="test.css" rel="stylesheet"></head><body>'+title+'</body></html>')
  self.store=PageStore(self.root,self.root/'data/state.sqlite');self.manifest=discover(self.root)
 def tearDown(self):self.temp.cleanup()
 def page(self,path):return next(p for p in self.store.read()['pages'] if p['path']==path)
 def op(self,kind,**kwargs):return self.store.operation(dict(kind=kind,revision=self.store.read()['revision'],**kwargs))
 def test_independent_page_fields_and_sync(self):
  page=self.page('/company/')
  self.op('save',id=page['id'],values={'name':'내부 회사','menuName':'기업 안내','seo':{'title':'회사 안내 · 시놀'},'headerMenu':True,'footerMenu':False})
  self.op('save',id=page['id'],values={'name':'관리용 이름'})
  saved=self.page('/company/')
  self.assertEqual(saved['seo']['title'],'회사 안내 · 시놀')
  self.assertEqual(saved['menuName'],'기업 안내')
  self.assertTrue(saved['headerMenu'])
  self.op('sync')
  saved=self.page('/company/')
  self.assertEqual(saved['name'],'관리용 이름')
  self.assertEqual(saved['seo']['title'],'회사 안내 · 시놀')
  self.assertEqual(saved['menuName'],'기업 안내')
  from page_management import metadata_html
  rendered=metadata_html('<html><head><title>원본</title></head></html>',saved,{},'')
  self.assertIn('<title>회사 안내 · 시놀</title>',rendered)
 def test_initial_admin_name_preserves_html_title_and_path(self):
  file=self.root/'company/index.html'
  file.write_text('<html><head><title>회사소개 · 시놀</title></head></html>')
  manifest=discover(self.root)
  seed=next(p for p in manifest['pages'] if p['path']=='/company/')
  self.assertEqual(seed['name'],'회사소개')
  self.assertEqual(seed['seo']['title'],'회사소개 · 시놀')
  self.assertEqual(seed['path'],'/company/')
  new=self.root/'new/index.html';new.parent.mkdir();new.write_text('<title>새 페이지 · 시놀</title>')
  self.op('sync')
  self.assertEqual(self.page('/new/')['name'],'새 페이지')

 def test_form_records_are_children_and_keep_stable_identity(self):
  records=[{'id':'consult','name':'시럽인연 상담 신청','slug':'consult','active':True},{'id':'casting','name':'출연 신청','slug':'casting','active':False}]
  self.op('sync-forms',records=records)
  page=self.page('/forms/consult/')
  self.assertEqual(page['name'],'시럽인연 상담 신청')
  self.assertEqual(page['contentKind'],'form')
  self.assertEqual(page['contentId'],'consult')
  self.op('save',id=page['id'],values={'name':'내부 폼 이름','seo':{'title':'상담 신청 제목'}})
  self.op('sync-forms',records=[{**records[0],'name':'변경한 실제 양식명'},records[1]])
  self.assertEqual(self.page('/forms/consult/')['name'],'내부 폼 이름')
  self.assertEqual(self.page('/forms/consult/')['seo']['title'],'상담 신청 제목')
  self.assertFalse(self.page('/forms/casting/')['published'])
 def test_footer_source_validation_and_versioned_save(self):
  from footer_source import read_footer_source,save_footer_source,validate_footer_source
  (self.root/'components').mkdir(exist_ok=True)
  (self.root/'components/footer.html').write_text('<footer class="app-footer"><a href="/company/">회사소개</a></footer>')
  (self.root/'footer.css').write_text('body .app-footer{padding:26px}')
  source=read_footer_source(self.root)
  saved=save_footer_source(self.root,{**source,'css':'body .app-footer{padding:30px}'})
  self.assertNotEqual(source['version'],saved['version'])
  with self.assertRaises(ValueError):save_footer_source(self.root,source)
  for html,css in [('<footer class="app-footer"><script>alert(1)</script></footer>',''),('<footer class="app-footer" onclick="alert(1)"></footer>',''),('<footer class="app-footer"></footer>','body{display:none}')]:
   with self.assertRaises(ValueError):validate_footer_source(html,css)

 def test_zip_bundle_install_replace_and_preserve_old_version(self):
  from page_bundle import install_bundle,unpack_bundle
  from io import BytesIO
  import zipfile
  def bundle(text):
   data=BytesIO()
   with zipfile.ZipFile(data,'w') as archive:archive.writestr('index.html','<html><body>'+text+'</body></html>');archive.writestr('app.js','document.body.dataset.ready="yes";')
   return data.getvalue()
  self.op('save',values={'name':'시놀트립','path':'/sinor-trip/','type':'planned','published':False})
  page=self.page('/sinor-trip/');first=bundle('첫 디자인')
  install_bundle(self.store,page['id'],first,self.store.read()['revision'])
  saved=self.page('/sinor-trip/');self.assertEqual(saved['type'],'page');self.assertFalse(saved['published']);first_version=saved['bundleVersion']
  self.assertTrue((self.root/saved['source']).is_file())
  self.op('save',id=page['id'],values={'published':True})
  install_bundle(self.store,page['id'],bundle('수정한 디자인'),self.store.read()['revision'])
  self.assertNotEqual(self.page('/sinor-trip/')['bundleVersion'],first_version)
  self.assertEqual(self.page('/sinor-trip/')['publishedBundleVersion'],first_version)
  self.op('save',id=page['id'],values={'published':True})
  self.assertEqual(self.page('/sinor-trip/')['publishedBundleVersion'],self.page('/sinor-trip/')['bundleVersion'])
  self.assertEqual((self.root/'server/.pages-data/page-bundles'/page['id']/(first_version+'.zip')).read_bytes(),first)
  with self.assertRaises(Conflict):install_bundle(self.store,page['id'],first,0)
  for name in ['../index.html','/index.html','index.php']:
   bad=BytesIO()
   with zipfile.ZipFile(bad,'w') as archive:archive.writestr(name,'bad')
   with self.assertRaises(ValueError):unpack_bundle(bad.getvalue())
 def test_zip_bundle_preserves_design_and_handoff_documents(self):
  from page_bundle import unpack_bundle
  from io import BytesIO
  import zipfile
  data=BytesIO()
  with zipfile.ZipFile(data,'w') as archive:
   archive.writestr('sinor-benefit/index.html','<html><body>혜택</body></html>')
   archive.writestr('sinor-benefit/docs/DESIGN_NOTES.md','# 디자인 전달 사항')
   archive.writestr('sinor-benefit/docs/HANDOFF.markdown','# 개발 전달 사항')
  files=unpack_bundle(data.getvalue())
  self.assertIn('index.html',files)
  self.assertEqual(files['docs/DESIGN_NOTES.md'].decode(),'# 디자인 전달 사항')
  self.assertIn('docs/HANDOFF.markdown',files)

 def test_uploaded_private_page_assets_are_guarded_and_sandboxed(self):
  from page_bundle import install_bundle
  from io import BytesIO
  import zipfile
  data=BytesIO()
  with zipfile.ZipFile(data,'w') as archive:archive.writestr('index.html','<html><body>디자인</body></html>');archive.writestr('app.js','const ready=true;')
  self.op('save',values={'name':'테스트','path':'/bundle-test/','type':'planned','published':False})
  page=self.page('/bundle-test/');install_bundle(self.store,page['id'],data.getvalue(),self.store.read()['revision']);page=self.page('/bundle-test/')
  server=ThreadingHTTPServer(('127.0.0.1',0),partial(module.PreviewHandler,directory=str(self.root)));server.pages=self.store;server.page_token='test-token';thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  def get(path):
   c=http.client.HTTPConnection('127.0.0.1',server.server_port);c.request('GET',path);r=c.getresponse();result=(r.status,dict(r.getheaders()),r.read());c.close();return result
  try:
   assets='/page-uploads/'+page['id']+'/'+page['bundleVersion']+'/'
   self.assertEqual(get('/bundle-test/')[0],404);self.assertEqual(get(assets+'index.html')[0],404)
   status,headers,rendered=get('/dev/bundle-test/');self.assertEqual(status,200);self.assertIn('sandbox',headers['Content-Security-Policy']);self.assertNotIn(b'<iframe',rendered);self.assertIn('디자인'.encode(),rendered);self.assertIn(b'<base href=',rendered)
   status,headers,body=get('/dev'+assets+'index.html');self.assertEqual(status,200);self.assertIn('sandbox',headers['Content-Security-Policy']);self.assertNotIn(b'sinor-bundle-height',body)
   self.assertEqual(get('/dev'+assets+'app.js')[1]['Access-Control-Allow-Origin'],'*')
   self.op('save',id=page['id'],values={'published':True});self.assertEqual(get('/bundle-test/')[0],200);self.assertEqual(get(assets+'index.html')[0],200)
   self.assertEqual(get('/_page-management/page-bundle?id='+page['id'])[2],data.getvalue())
   previous=page['bundleVersion'];updated=BytesIO()
   with zipfile.ZipFile(updated,'w') as archive:archive.writestr('index.html','<html><body>수정한 디자인</body></html>')
   install_bundle(self.store,page['id'],updated.getvalue(),self.store.read()['revision'])
   draft=self.page('/bundle-test/');self.assertEqual(draft['publishedBundleVersion'],previous)
   import re
   live_context=json.loads(re.search(r'window.SINOR_PAGE_ROUTE=(.*?);</script>',get('/bundle-test/')[2].decode()).group(1))
   draft_context=json.loads(re.search(r'window.SINOR_PAGE_ROUTE=(.*?);</script>',get('/dev/bundle-test/')[2].decode()).group(1))
   self.assertIn(previous,live_context['bundleBase']);self.assertIn(draft['bundleVersion'],draft_context['bundleBase'])
   draft_assets='/page-uploads/'+page['id']+'/'+draft['bundleVersion']+'/'
   self.assertEqual(get(draft_assets+'index.html')[0],404)
   self.op('save',id=page['id'],values={'published':True});self.assertEqual(get(draft_assets+'index.html')[0],200)

  finally:server.shutdown();server.server_close();thread.join()

 def test_inventory_patterns_and_exclusions(self):
  self.assertFalse(any(p['path'].startswith('/admin') for p in self.manifest['pages']))
  self.assertTrue(any(p['path']=='/columns/:id/' for p in self.manifest['pages']))
  self.assertFalse(any(p['path']=='/columns/1/' for p in self.manifest['pages']))
 def test_subtree_move_redirects_and_atomic_failure(self):
  p=self.page('/company/');state=self.op('save',id=p['id'],values={'path':'/about/'})
  self.assertTrue(any(p['path']=='/about/team/' for p in state['pages']))
  self.assertEqual({r['from']:r['to'] for r in state['redirects']},{'/company/':'/about/','/company/team/':'/about/team/'})
  before=self.store.read()
  with self.assertRaises(ValueError):self.op('save',id=p['id'],values={'path':'/forms/'})
  self.assertEqual(before,self.store.read())
 def test_no_cycle_and_system_protection(self):
  p=self.page('/company/');child=self.page('/company/team/')
  with self.assertRaises(ValueError):self.op('move',id=p['id'],parentId=child['id'])
  with self.assertRaises(ValueError):self.op('save',id=p['id'],values={'path':'/company/team/inside/'})
  with self.assertRaises(ValueError):self.op('save',id=self.page('/')['id'],values={'path':'/other/'})
  with self.assertRaises(ValueError):self.op('save',id=p['id'],values={'path':'/assets/new/'})
 def test_sync_does_not_reset_overrides(self):
  p=self.page('/company/');self.op('save',id=p['id'],values={'path':'/about/','seo':{'title':'관리자 제목'},'headerMenu':True})
  (self.root/'new').mkdir();(self.root/'new/index.html').write_text('<title>신규 페이지</title>')
  self.op('sync');state=self.store.read()
  p=next(p for p in state['pages'] if p['path']=='/about/')
  self.assertEqual(p['seo']['title'],'관리자 제목');self.assertTrue(p['headerMenu']);self.assertTrue(any(p['path']=='/new/' for p in state['pages']))
 def test_redirect_validation_flatten_and_restore(self):
  self.op('redirect',values={'from':'/old/','to':'/company/','status':301,'active':True,'keepQuery':True})
  self.op('save',id=self.page('/company/')['id'],values={'path':'/about/'})
  self.assertEqual(next(r for r in self.store.read()['redirects'] if r['from']=='/old/')['to'],'/about/')
  with self.assertRaises(ValueError):self.op('redirect',values={'from':'/loop/','to':'/loop/','status':302,'active':True})
  before=self.store.read();self.op('restore',historyId=before['history'][0]['id']);self.assertTrue(any(p['path']=='/company/' for p in self.store.read()['pages']))
 def test_revision_conflict_and_preview_no_write(self):
  before=self.store.read();self.store.operation({'kind':'save','id':self.page('/company/')['id'],'values':{'path':'/about/'},'revision':0},preview=True)
  self.assertEqual(before,self.store.read())
  with self.assertRaises(Conflict):self.store.operation({'kind':'sync','revision':99})
 def test_planned_page_cannot_publish(self):
  with self.assertRaises(ValueError):self.op('save',values={'name':'개발 예정','path':'/soon/','type':'planned','published':True})
 def test_reorder_keeps_url_and_does_not_create_redirect(self):
  p=self.page('/company/team/');parent=self.page('/company/')
  state=self.op('move',id=p['id'],parentId=parent['id'],order=1)
  self.assertEqual(next(x for x in state['pages'] if x['id']==p['id'])['path'],'/company/team/')
  self.assertFalse(state['redirects'])
  self.assertFalse(next(x for x in state['pages'] if x['id']==p['id']).get('menuCustomized',False))
 def test_arrow_reorder_keeps_urls_and_menu_settings(self):
  p=self.page('/company/');q=self.page('/forms/');paths={x['id']:x['path'] for x in self.store.read()['pages']}
  state=self.op('reorder',ids=[q['id'],p['id']])
  self.assertEqual({x['id']:x['path'] for x in state['pages']},paths)
  self.assertLess(next(x for x in state['pages'] if x['id']==q['id'])['order'],next(x for x in state['pages'] if x['id']==p['id'])['order'])
  self.assertFalse(state['redirects']);self.assertFalse(next(x for x in state['pages'] if x['id']==p['id']).get('menuCustomized',False))
 def test_encoded_collisions_and_resource_paths(self):
  p=self.page('/company/')
  for path in ['/co%6dpany/team/','/footer.js','/%61pi/secret/']:
   with self.assertRaises(ValueError):self.op('save',id=p['id'],values={'path':path})
 def test_failed_restore_is_atomic(self):
  self.op('save',id=self.page('/company/')['id'],values={'path':'/about/'})
  before=self.store.read()
  with self.assertRaises(ValueError):self.op('restore',historyId='missing')
  self.assertEqual(before,self.store.read())
 def test_linked_source_keeps_route_identity(self):
  from page_management import source_url
  state=self.op('save',values={'name':'폼 소스 연결','path':'/form-test/','type':'page','source':'forms/index.html','published':False})
  p=next(p for p in state['pages'] if p['path']=='/form-test/')
  self.assertEqual(p['sourceRoute'],'/forms/');self.assertEqual(source_url(p,p['path']),'/forms/')
 def test_actual_event_children_and_independent_display_name(self):
  source=self.root/'silovematch/events/view/index.html';source.parent.mkdir(parents=True);source.write_text('<title>이벤트 상세</title>')
  records=[{'id':'november','title':'11월 프로모션','slug':'montly-promotion','published':True},{'id':'hammanna','title':'함만나 출연 신청','slug':'hammanna-casting','published':True}]
  state=self.op('sync-events',records=records)
  children=[p for p in state['pages'] if p.get('contentKind')=='event'];self.assertEqual(len(children),2)
  p=next(p for p in children if p['contentId']=='november');oldpath=p['path']
  state=self.op('save',id=p['id'],values={'name':'알아보기 쉬운 이름'})
  changed=next(x for x in state['pages'] if x['id']==p['id']);self.assertEqual(changed['path'],oldpath);self.assertEqual(changed['name'],'알아보기 쉬운 이름');self.assertFalse(state['redirects'])
  self.op('delete',id=p['id']);state=self.op('sync-events',records=records);self.assertTrue(next(x for x in state['pages'] if x['id']==p['id'])['removed'])
 def test_header_visibility_is_explicit_and_not_inferred_from_moves(self):
  p=self.page('/company/')
  state=self.op('save',id=p['id'],values={'order':99,'name':'회사소개 표시 이름'})
  changed=next(x for x in state['pages'] if x['id']==p['id']);self.assertFalse(changed.get('headerVisibilitySet',False));self.assertFalse(changed.get('menuCustomized',False))
  state=self.op('save',id=p['id'],values={'showInHeader':False})
  changed=next(x for x in state['pages'] if x['id']==p['id']);self.assertTrue(changed['headerVisibilitySet']);self.assertEqual(changed['headerScope'],'/company/');self.assertFalse(changed['showInHeader'])
 def test_shared_footer_config_persists_and_rejects_scripts(self):
  before=self.store.read()['pages']
  state=self.op('site-settings',values={'footer':{'phone':'02-506-5670'},'footerDesign':{'background':'#eeeeee','mobilePaddingX':16},'footerLinks':[{'id':'link-2','label':'회사소개','url':'company/'}]})
  self.assertEqual(state['pages'],before);self.assertEqual(state['siteSettings']['footer']['phone'],'02-508-5670')
  reloaded=PageStore(self.root,self.root/'data/state.sqlite').read();self.assertEqual(reloaded['siteSettings']['footerDesign']['background'],'#eeeeee')
  with self.assertRaises(ValueError):self.op('site-settings',values={'footerLinks':[{'id':'link-2','label':'bad','url':'javascript:alert(1)'}]})
  self.assertEqual(self.store.read()['siteSettings'],state['siteSettings'])
 def test_http_redirect_seo_private_preview_and_csrf(self):
  handler=partial(module.PreviewHandler,directory=str(self.root))
  server=ThreadingHTTPServer(('127.0.0.1',0),handler);server.pages=self.store;server.page_token='test-token'
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  def get(path):
   c=http.client.HTTPConnection('127.0.0.1',server.server_port);c.request('GET',path);r=c.getresponse();res=(r.status,dict(r.getheaders()),r.read().decode());c.close();return res
  try:
   p=self.page('/company/');self.op('save',id=p['id'],values={'path':'/about/','seo':{'title':'검수 제목','description':'검수 설명','ogTitle':'공유 제목','indexable':False}})
   status,headers,body=get('/company/?campaign=test');self.assertEqual(status,301);self.assertEqual(headers['Location'],'/about/?campaign=test')
   status,_,body=get('/about/');self.assertEqual(status,200);self.assertIn('<title>검수 제목</title>',body);self.assertIn('content="공유 제목"',body);self.assertIn('<base href="/company/">',body)
   self.op('redirect',values={'from':'https://sinor.co.kr/legacy/?idx=123&bmode=view','to':'/about/','status':301,'active':True,'keepQuery':True,'pageId':p['id']})
   status,headers,_=get('/legacy/?bmode=view&idx=123');self.assertEqual(status,301);self.assertEqual(headers['Location'],'/about/?bmode=view&idx=123')
   self.assertEqual(get('/legacy/?bmode=view&idx=124')[0],404)
   self.op('save',id=p['id'],values={'published':False});self.assertEqual(get('/about/')[0],404);self.assertEqual(get('/company/index.html')[0],404)
   self.op('save',id=p['id'],values={'useSharedFooter':True});self.assertIn('data-shared-footer',get('/dev/about/')[2]);self.assertIn('/footer.js',get('/dev/about/')[2])
   self.op('save',id=p['id'],values={'useSharedFooter':False});self.assertNotIn('data-shared-footer',get('/dev/about/')[2])
   self.assertEqual(get('/dev/about/')[0],200);self.assertIn('noindex',get('/dev/about/')[2]);self.assertEqual(get('/server/.pages-data/pages.sqlite')[0],404)
   c=http.client.HTTPConnection('127.0.0.1',server.server_port);c.request('POST','/_page-management/change',body='{}',headers={'Content-Type':'application/json'});r=c.getresponse();self.assertEqual(r.status,403);r.read();c.close()
  finally:server.shutdown();server.server_close();thread.join()

if __name__=='__main__':unittest.main()
