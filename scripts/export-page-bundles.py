"""Export uploaded, published HTML pages for static GitHub Pages previews.
Local API features still require serve-preview.py or an operating service backend.
"""
from pathlib import Path
import re,shutil
root=Path(__file__).resolve().parents[1]
db=root/'server/.pages-data/pages.sqlite'
import sys
sys.path.insert(0,str(root/'server'))
from page_management import PageStore,metadata_html
state=PageStore(root,db).read()
for page in state['pages']:
    if not page.get('bundleVersion') or not page.get('published') or page.get('removed'):continue
    version=page.get('publishedBundleVersion') or page['bundleVersion']
    source=root/'page-uploads'/page['id']/version
    relative=page['path'].strip('/')
    if not relative or '..' in Path(relative).parts:raise ValueError('Unsafe export path')
    target=root/relative
    if target.exists() and not (target/'index.html').is_file():raise ValueError('Export destination is not a page')
    target.mkdir(parents=True,exist_ok=True)
    shutil.copytree(source,target,dirs_exist_ok=True)
    text=(source/'index.html').read_text()
    text=re.sub(r'<base\b[^>]*>','',text,flags=re.I)
    text=re.sub(r'<footer\b[^>]*>[\s\S]*?</footer>','',text,flags=re.I)
    text=re.sub(r'<script\b[^>]*src=["\'][^"\']*footer\.js[^"\']*["\'][^>]*>[\s\S]*?</script>','',text,flags=re.I)
    text=re.sub(r'<link\b[^>]*href=["\'][^"\']*footer\.css[^"\']*["\'][^>]*>','',text,flags=re.I)
    parent='../'*len(Path(relative).parts)
    text=text.replace('</head>',f'<meta name="page-id" content="{page["id"]}"><meta name="page-route" content="{page["path"]}"><link rel="stylesheet" href="{parent}footer.css"></head>')
    text=text.replace('</body>',f'<footer class="app-footer" data-shared-footer></footer><script src="{parent}footer.js" defer></script></body>')
    text=metadata_html(text,page,state.get('defaults',{}),'https://web.sinor.co.kr'+page['path'])
    (target/'index.html').write_text(text)
    print(page['path'])
