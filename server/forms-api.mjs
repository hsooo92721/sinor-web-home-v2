import {formSlug,formPath,legacyMatches,withPreviousFormUrl,assertUniqueFormUrls} from '../cms/form-urls.js';
/** Mount this handler after company authentication middleware. No public webhook URL is returned. */
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv,webcrypto} from 'node:crypto';
import {formRegions} from '../cms/form-regions.js';
import {validateForm,templateForm,defaultSlack,validateSlack,slackPayload} from '../cms/form-schema.js';
globalThis.crypto??=webcrypto;
function hook(value){const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='hooks.slack.com'||url.port||url.username||url.password||!/^\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(url.pathname)||url.search||url.hash)throw Error('Slack Incoming Webhook 주소를 확인해 주세요.');return url.href}
const idPattern=/^[a-zA-Z0-9_-]{1,100}$/;
function encrypt(value,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),bytes=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),bytes].map(b=>b.toString('base64')).join('.')}
function decrypt(value,key){const [iv,tag,bytes]=value.split('.').map(v=>Buffer.from(v,'base64')),cipher=createDecipheriv('aes-256-gcm',key,iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(bytes),cipher.final()]).toString('utf8')}
async function body(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024)throw Error('요청 용량은 32MB 이하여야 합니다.');chunks.push(chunk)}return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{}}
function photo(field,file){if(!file||!field.accept.includes(file.type)||typeof file.data!=='string')throw Error('사진 형식을 확인해 주세요.');const match=file.data.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);if(!match||match[1]!==file.type)throw Error('사진 데이터가 올바르지 않습니다.');const bytes=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>field.maxMB*1024*1024)throw Error('사진 용량을 확인해 주세요.');const valid=file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:file.type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):file.type==='image/gif'?/^GIF8[79]a/.test(bytes.subarray(0,6).toString()):bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';if(!valid)throw Error('실제 이미지 파일을 올려 주세요.');return {bytes,type:file.type,name:String(file.name||'image').replace(/[\r\n<>"]/g,'').slice(0,150)}}
export function createFormsHandler({dataDir,secretKey,authenticateAdmin=async()=>false,getProfile=async()=>null,fetchImpl=fetch}){
 const directory=resolve(dataDir),key=Buffer.isBuffer(secretKey)?secretKey:Buffer.from(secretKey||'','base64');if(key.length!==32)throw Error('Forms secretKey must be a stable 32-byte server-side key.');
 let cached,loading,queue=Promise.resolve();async function state(){if(cached)return cached;if(loading)return loading;loading=(async()=>{await mkdir(directory,{recursive:true,mode:0o700});try{cached=JSON.parse(await readFile(join(directory,'forms.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;cached={forms:['consult','casting'].map(type=>{const f=templateForm(type);f.id=type==='consult'?'silove-consult':'hammanna-casting';return validateForm(f)}),integrations:{},submissions:[]}}return cached})();return loading}
 async function persist(){const file=join(directory,'forms.json'),temp=file+'.tmp';await writeFile(temp,JSON.stringify(cached),{mode:0o600});await rename(temp,file)}
 function exclusive(work){const next=queue.then(work);queue=next.catch(()=>{});return next}
 async function send(url,payload){const response=await fetchImpl(hook(url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Error('Slack 전송에 실패했습니다. 웹훅 주소를 확인해 주세요.')}
 function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
 return async function handler(req,res){
 const path=new URL(req.url,'http://localhost').pathname.replace(/^\/api(?=\/)/,''),admin=path.startsWith('/admin/forms');
 try{
 const actual=new URL(req.url,'http://'+(req.headers.host||'localhost'));
 if(!admin&&!actual.pathname.startsWith('/api/')){if(req.method!=='GET'&&req.method!=='HEAD')return false;const data=await state(),active=data.forms.filter(f=>!f.deleted&&f.active),old=active.find(f=>(f.legacyUrls||[]).some(value=>legacyMatches(value,actual)));if(old){res.writeHead(301,{Location:formPath(old),'Cache-Control':'no-store'});res.end();return true}const found=active.find(f=>formPath(f)===actual.pathname.replace(/\/$/,''));if(found){const html=await readFile(new URL('../forms/index.html',import.meta.url),'utf8');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?'':html.replace('<head>','<head><base href="/forms/">'));return true}return false}
 if(!admin&&!path.startsWith('/forms/'))return false;
 if(admin&&!await authenticateAdmin(req)){json(res,401,{message:'관리자 인증이 필요합니다.'});return true}
 const data=await state(),parts=path.split('/').filter(Boolean),id=admin?parts[2]:parts[1],suffix=admin?parts.slice(3):parts.slice(2);if(id&&!idPattern.test(id))throw Error('양식 ID가 올바르지 않습니다.');
 if(admin&&!id&&req.method==='GET'){json(res,200,data.forms.filter(f=>!f.deleted));return true}
 if(!admin&&id==='resolve'&&req.method==='GET'){const slug=actual.searchParams.get('slug'),form=data.forms.find(f=>!f.deleted&&f.active&&(formSlug(f)===slug||(f.legacyUrls||[]).some(u=>legacyMatches(u,new URL('/forms/'+slug,actual.origin)))));if(!form){json(res,404,{message:'사용할 수 없는 입력폼입니다.'});return true}json(res,200,{form,path:formPath(form),redirect:formSlug(form)!==slug});return true}
 const form=data.forms.find(f=>f.id===id&&!f.deleted);
 if(admin&&id&&!suffix.length&&req.method==='PUT'){let input=validateForm({...await body(req),id});await exclusive(async()=>{input=validateForm(withPreviousFormUrl(input,form));assertUniqueFormUrls(input,data.forms);const at=data.forms.findIndex(f=>f.id===id);if(at<0)data.forms.push(input);else data.forms[at]=input;await persist()});json(res,200,input);return true}
 if(!form){json(res,404,{message:'양식을 찾을 수 없습니다.'});return true}
 if(admin&&!suffix.length&&req.method==='DELETE'){await exclusive(async()=>{form.deleted=true;delete data.integrations[id];await persist()});json(res,200,{deleted:true});return true}
 if(!admin&&!suffix.length&&req.method==='GET'){if(!form.active){json(res,404,{message:'사용할 수 없는 양식입니다.'});return true}json(res,200,form);return true}
 if(admin&&suffix[0]==='integration'){
 const stored=data.integrations[id]||{message:defaultSlack(form)};
 if(req.method==='GET'&&suffix.length===1){json(res,200,{message:stored.message,webhookConfigured:!!stored.secret});return true}
 const input=await body(req),message=validateSlack(input.message,form),url=input.webhookUrl?hook(input.webhookUrl):stored.secret?decrypt(stored.secret,key):'';
 if(suffix[1]==='test'&&req.method==='POST'){if(!url)throw Error('웹훅 URL을 입력해 주세요.');await send(url,slackPayload(message,form,{},'',true));json(res,200,{sent:true,test:true});return true}
 if(suffix.length===1&&req.method==='PUT'){if(message.enabled&&!url)throw Error('웹훅 URL을 입력해 주세요.');await exclusive(async()=>{data.integrations[id]={message,...(url?{secret:encrypt(url,key)}:{})};await persist()});json(res,200,{message,webhookConfigured:!!url});return true}
 }
 if(admin&&suffix[0]==='submissions'&&suffix.length===1&&req.method==='GET'){json(res,200,data.submissions.filter(e=>e.formId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(entry=>{const {privateFiles,...publicEntry}=entry;return publicEntry}));return true}
 if(admin&&suffix[0]==='submissions'&&suffix[2]==='files'&&req.method==='GET'){
 const entry=data.submissions.find(e=>e.id===suffix[1]&&e.formId===id),file=entry?.privateFiles?.[suffix[3]]?.[Number(suffix[4])];if(!file){json(res,404,{message:'사진을 찾을 수 없습니다.'});return true}res.writeHead(200,{'Content-Type':file.type,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.name),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(join(directory,file.path)));return true
 }
 if(!admin&&suffix[0]==='submissions'&&req.method==='POST'){
 if(!form.active)throw Error('현재 신청할 수 없는 양식입니다.');const input=await body(req),profile=await getProfile(req);if(form.loginRequired&&!profile){json(res,401,{message:'로그인 후 신청해 주세요.'});return true}if(!idPattern.test(input.requestId||''))throw Error('접수 요청 ID가 필요합니다.');
 const result=await exclusive(async()=>{
 const duplicate=data.submissions.find(e=>e.formId===id&&e.requestId===input.requestId);if(duplicate)return {entry:duplicate,fresh:false};
 const values={},photos={};for(const f of form.fields){if(['heading','paragraph'].includes(f.type))continue;const bound=f.profileKey&&profile?.[f.profileKey]!==undefined&&profile?.[f.profileKey]!==null,v=f.locked&&bound?profile[f.profileKey]:input.values?.[f.id];
 if(f.type==='photo'){const files=input.photos?.[f.id]||[];if(!Array.isArray(files)||files.length>f.maxFiles||f.required&&!files.length)throw Error(f.label+' 사진 개수를 확인해 주세요.');photos[f.id]=files.map(file=>photo(f,file));continue}
 if(f.type==='consent'){if(f.required&&v!==true)throw Error(f.label+' 동의가 필요합니다.');values[f.id]=v===true;continue}
 if(f.type==='checkboxes'){const list=Array.isArray(v)?[...new Set(v)]:[];if(f.required&&!list.length||list.some(x=>!f.options.includes(x)))throw Error(f.label+' 선택값을 확인해 주세요.');values[f.id]=list;continue}
 if(f.type==='region'){const value=String(v??'').trim(),province=Object.keys(formRegions).find(p=>value.startsWith(p+' '));if((f.required||value)&&(!province||!formRegions[province].includes(value.slice(province.length+1))))throw Error('거주지를 선택해 주세요.');values[f.id]=value;continue}
 const value=String(v??'').trim();if(f.required&&!value)throw Error(f.label+' 항목을 입력해 주세요.');if(value.length>f.maxLength)throw Error(f.label+' 글자 수를 확인해 주세요.');if(value&&['radio','select'].includes(f.type)&&!f.options.includes(value))throw Error(f.label+' 선택값이 올바르지 않습니다.');if(value&&f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('이메일을 확인해 주세요.');if(value&&f.type==='number'&&!Number.isFinite(Number(value)))throw Error('숫자를 입력해 주세요.');if(value&&f.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value).toISOString().slice(0,10)!==value))throw Error('날짜를 확인해 주세요.');values[f.id]=value;
 }
 const entry={id:crypto.randomUUID(),requestId:input.requestId,formId:id,createdAt:new Date().toISOString(),sourcePage:String(input.sourcePage||'').slice(0,500),fields:form.fields.map(f=>({id:f.id,label:f.label,type:f.type})),values,files:{},privateFiles:{},slackStatus:'not-configured'};
 for(const [fieldId,files]of Object.entries(photos)){if(!idPattern.test(fieldId))throw Error('사진 항목 ID가 올바르지 않습니다.');for(const [index,file]of files.entries()){const rel=join('uploads',entry.id,fieldId+'-'+index);await mkdir(join(directory,'uploads',entry.id),{recursive:true,mode:0o700});await writeFile(join(directory,rel),file.bytes,{mode:0o600});(entry.privateFiles[fieldId]??=[]).push({path:rel,name:file.name,type:file.type});(entry.files[fieldId]??=[]).push({name:file.name,type:file.type,url:'/api/admin/forms/'+id+'/submissions/'+entry.id+'/files/'+fieldId+'/'+index})}}
 if(data.integrations[id]?.message.enabled)entry.slackStatus='pending';data.submissions.push(entry);await persist();return {entry,fresh:true}
 });
 if(result.fresh&&result.entry.slackStatus==='pending'){try{const integration=data.integrations[id];await send(decrypt(integration.secret,key),slackPayload(integration.message,form,result.entry.values,result.entry.sourcePage));result.entry.slackStatus='sent'}catch{result.entry.slackStatus='failed'}await exclusive(persist)}
 json(res,200,{id:result.entry.id,received:true,notificationStatus:result.entry.slackStatus});return true
 }
 json(res,404,{message:'지원하지 않는 입력폼 API입니다.'});return true
 }catch(error){json(res,400,{message:error.message});return true}
 }
}
