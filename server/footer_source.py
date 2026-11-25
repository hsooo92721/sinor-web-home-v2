"""Versioned editing of the two shared footer source files, local admin only."""
import hashlib,json,re,os
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

def read_footer_source(root):
    root=Path(root);html=(root/'components/footer.html').read_text();css=(root/'footer.css').read_text()
    version=hashlib.sha256((html+'\0'+css).encode()).hexdigest()
    return {'html':html,'css':css,'version':version}

class FooterValidator(HTMLParser):
    def __init__(self):super().__init__(convert_charrefs=True);self.roots=0
    def handle_starttag(self,tag,attrs):
        if tag not in {'footer','div','span','a','img','nav','details','summary','dl','dt','dd','p','br','strong','small','ul','ol','li','address','section','h2','h3','i','b','em'}:raise ValueError('푸터 HTML에 사용할 수 없는 태그입니다: '+tag)
        attrs=dict(attrs)
        if tag=='footer':
            self.roots+=1
            if 'app-footer' not in attrs.get('class','').split():raise ValueError('footer의 app-footer 클래스는 유지해 주세요.')
        for key,value in attrs.items():
            value=value or ''
            if key.lower().startswith('on') or key.lower() in {'srcdoc','formaction'}:raise ValueError('스크립트 및 이벤트 속성은 지원하지 않습니다.')
            if key.lower() in {'href','src'}:
                if any(ord(c)<32 for c in value) or urlsplit(value).scheme.lower() not in {'','http','https','mailto','tel'} or value.startswith('//'):raise ValueError('링크 또는 이미지 주소를 확인해 주세요.')
            if key=='style' and re.search(r'expression|javascript:|vbscript:|behavior\s*:|-moz-binding',value,re.I):raise ValueError('안전하지 않은 스타일입니다.')

def validate_footer_source(html,css):
    if not isinstance(html,str) or not isinstance(css,str) or len(html)>200000 or len(css)>200000:raise ValueError('푸터 코드는 HTML·CSS 각각 200KB 이내로 입력해 주세요.')
    parser=FooterValidator();parser.feed(html)
    if parser.roots!=1:raise ValueError('app-footer 클래스를 가진 footer 한 개가 필요합니다.')
    if re.search(r'@import|expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|-moz-binding|</?style',css,re.I):raise ValueError('외부 CSS 가져오기 및 스크립트 스타일은 지원하지 않습니다.')
    plain=re.sub(r'/\*[\s\S]*?\*/','',css)
    for selectors in re.findall(r'([^{}]+)\{',plain):
        selectors=selectors.strip()
        if selectors.startswith(('@media','@supports','@container','@font-face')):continue
        if any(not any(scope in s for scope in ['.app-footer','.company-common-footer','.reader-footer']) or re.search(r'[+~]',s) for s in selectors.split(',')):raise ValueError('CSS 선택자는 .app-footer 안에만 적용해 주세요.')

def save_footer_source(root,values):
    root=Path(root);current=read_footer_source(root)
    if values.get('version')!=current['version']:raise ValueError('푸터 코드가 변경되었습니다. 새로고침 후 다시 저장해 주세요.')
    html,css=values.get('html'),values.get('css');validate_footer_source(html,css)
    history=root/'server/.pages-data/footer-source-history';history.mkdir(parents=True,exist_ok=True)
    (history/(current['version']+'.json')).write_text(json.dumps(current,ensure_ascii=False))
    # Prepare both files before replacing either; restore both if replacement fails.
    targets=[(root/'components/footer.html',html),(root/'footer.css',css)]
    try:
        for path,text in targets:path.with_suffix(path.suffix+'.pending').write_text(text)
        for path,_ in targets:os.replace(path.with_suffix(path.suffix+'.pending'),path)
    except OSError:
        (root/'components/footer.html').write_text(current['html']);(root/'footer.css').write_text(current['css']);raise
    finally:
        for path,_ in targets:path.with_suffix(path.suffix+'.pending').unlink(missing_ok=True)
    return read_footer_source(root)
