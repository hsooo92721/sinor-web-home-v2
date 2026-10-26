"""Sync the common footer, resolving paths against each page's <base> URL."""
from pathlib import Path
import os
import re

ROOT = Path(__file__).resolve().parents[1]
template = (ROOT / 'components/footer.html').read_text().strip()
for page in ROOT.rglob('*.html'):
    if page == ROOT / 'components/footer.html':
        continue
    source = page.read_text()
    if not re.search(r'<footer\b[^>]*class="[^"]*\bapp-footer\b', source):
        continue
    base = re.search(r'<base\b[^>]*href="([^"]+)"', source)
    base_dir = (page.parent / base[1]).resolve() if base else page.parent
    prefix = Path(os.path.relpath(ROOT, base_dir)).as_posix() + '/'
    footer = template.replace('="../', '="' + prefix)
    source = re.sub(r'<footer\b[^>]*class="[^"]*\bapp-footer\b[^>]*>.*?</footer>', lambda _: footer, source, flags=re.S)
    source = re.sub(r'<link\b[^>]*href="[^"]*footer\.css[^\"]*"[^>]*>', '', source)
    source = re.sub(r'<script\b[^>]*src="[^"]*footer\.js[^\"]*"[^>]*>\s*</script>', '', source)
    source = source.replace('</head>', f'<link rel="stylesheet" href="{prefix}footer.css?v=20261026"></head>')
    source = source.replace('</body>', f'<script src="{prefix}footer.js?v=20261026" defer></script></body>')
    page.write_text(source)
    print(page.relative_to(ROOT))
