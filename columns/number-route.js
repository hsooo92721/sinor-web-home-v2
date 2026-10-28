// Load the shared article document while retaining the public number URL.
const base=new URL('view/',import.meta.url);
try{const response=await fetch(new URL('index.html',base),{cache:'no-store'});if(!response.ok)throw Error('칼럼 화면을 불러오지 못했습니다.');const html=await response.text();document.open();document.write(html.replace('<head>',`<head><base href="${base.href}">`));document.close()}catch(error){document.body.textContent=error.message}
