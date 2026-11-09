import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFormsHandler} from '../server/forms-api.mjs';
import {templateForm,newField,defaultSlack} from '../cms/form-schema.js';
test('independent forms, protected webhook, test sending and durable submissions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sinor-forms-')),sent=[];let fail=false;
 const handler=createFormsHandler({dataDir:dir,secretKey:Buffer.alloc(32,7),authenticateAdmin:async r=>r.headers.authorization==='admin',getProfile:async()=>({name:'로그인 이름'}),fetchImpl:async(url,opts)=>{sent.push(JSON.parse(opts.body));return {ok:!fail}}});
 const server=http.createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,method='GET',value,admin=true)=>{const r=await fetch(base+'/api'+path,{method,headers:{...(admin?{Authorization:'admin'}:{}),'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});return {status:r.status,data:await r.json()}};
 try{
 assert.equal((await call('/admin/forms','GET',undefined,false)).status,401);
 assert.equal((await call('/admin/forms')).data.length,2);
 const form=templateForm(),name={...newField('text'),label:'이름',required:true,profileKey:'name',locked:true};form.fields=[name];
 assert.equal((await call('/admin/forms/'+form.id,'PUT',form)).status,200);
 const changed={...form,slug:'consult-special',legacyUrls:['/old-consult?from=imweb']};
 assert.equal((await call('/admin/forms/'+form.id,'PUT',changed)).status,200);
 const redirected=await fetch(base+'/old-consult?from=imweb',{redirect:'manual'});assert.equal(redirected.status,301);assert.equal(redirected.headers.get('location'),'/forms/consult-special');
 const oldPath=await fetch(base+'/forms/'+form.id,{redirect:'manual'});assert.equal(oldPath.status,301);
 assert.equal((await call('/forms/resolve?slug=consult-special')).data.form.id,form.id);
 const duplicate={...templateForm(),slug:'consult-special'};assert.equal((await call('/admin/forms/'+duplicate.id,'PUT',duplicate)).status,400);
 const url='https://hooks.slack.com/services/T_TEST/B_TEST/FAKE_TOKEN',message={...defaultSlack(form),enabled:true};
 await call('/admin/forms/'+form.id+'/integration','PUT',{message,webhookUrl:url});
 const config=(await call('/admin/forms/'+form.id+'/integration')).data;
 assert.equal(config.webhookConfigured,true);assert.ok(!JSON.stringify(config).includes(url));
 assert.ok(!(await readFile(join(dir,'forms.json'),'utf8')).includes(url));
 await call('/admin/forms/'+form.id+'/integration/test','POST',{message});
 assert.ok(sent[0].text.startsWith('[테스트]'));assert.equal((await call('/admin/forms/'+form.id+'/submissions')).data.length,0);
 fail=true;const input={requestId:'request-1',values:{[name.id]:'위조된 이름'}};
 const result=await call('/forms/'+form.id+'/submissions','POST',input,false);assert.equal(result.data.notificationStatus,'failed');
 let entries=(await call('/admin/forms/'+form.id+'/submissions')).data;assert.equal(entries.length,1);assert.equal(entries[0].values[name.id],'로그인 이름');
 await call('/forms/'+form.id+'/submissions','POST',input,false);assert.equal(sent.length,2);assert.equal((await call('/admin/forms/'+form.id+'/submissions')).data.length,1);
 assert.equal((await call('/admin/forms/silove-consult/submissions')).data.length,0);
 await call('/admin/forms/'+form.id,'DELETE');assert.equal((await call('/forms/'+form.id)).status,404);
 assert.equal(JSON.parse(await readFile(join(dir,'forms.json'),'utf8')).submissions.length,1);
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
});

test('reference templates retain application fields and editable schema settings',()=>{
 const consult=templateForm('consult'),casting=templateForm('casting');
 assert.equal(consult.fields.length,12);assert.equal(consult.loginRequired,false);assert.equal(consult.theme.fontSize,20);
 assert.equal(consult.fields.find(f=>f.label==='거주지').type,'region');
 assert.equal(casting.fields.filter(f=>f.type==='photo').length,2);
 assert.equal(casting.fields.filter(f=>f.type==='consent'&&f.required).length,3);
 assert.equal(casting.fields.find(f=>f.label==='키').unit,'cm');
});
