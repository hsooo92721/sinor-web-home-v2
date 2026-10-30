"""Import one manually supplied public article using its metadata and cached image."""
import importlib.util
import json
import os
import re
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('news_images', ROOT / 'scripts/news-images.py')
images = importlib.util.module_from_spec(spec)
spec.loader.exec_module(images)

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta, self.title, self.title_open, self.time = {}, '', False, ''
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta':
            key = (a.get('property') or a.get('name') or a.get('itemprop') or '').lower()
            if a.get('content'): self.meta.setdefault(key, a['content'].strip())
        if tag == 'title': self.title_open = True
        if tag == 'time' and a.get('datetime') and not self.time: self.time = a['datetime']
    def handle_endtag(self, tag):
        if tag == 'title': self.title_open = False
    def handle_data(self, text):
        if self.title_open: self.title += text

def article_from_html(url, html):
    parser = Metadata(); parser.feed(html); meta = parser.meta
    title = ' '.join((meta.get('og:title') or meta.get('twitter:title') or parser.title).split())
    if not title: raise ValueError('Article title metadata is unavailable')
    date_text = next((meta[k] for k in ('article:published_time','datepublished','pubdate','parsely-pub-date','date','og:regdate') if meta.get(k)), parser.time)
    match = re.search(r'(\d{4})[-./](\d{1,2})[-./](\d{1,2})', date_text)
    published = datetime(*map(int, match.groups()), tzinfo=timezone(timedelta(hours=9))) if match else datetime.now(timezone(timedelta(hours=9)))
    publisher = meta.get('og:site_name') or meta.get('twitter:site') or urlsplit(url).hostname.removeprefix('www.')
    return {'title':title,'url':url,'meta':publisher+' '+published.strftime('%Y.%m.%d')+(' (등록일)' if not match else ''),'date':[published.year,published.month,published.day],'year':str(published.year),'publishedAt':published.isoformat(),'dateEstimated':not bool(match),'image':images.PLACEHOLDER,'source':'manual-url','description':meta.get('og:description') or meta.get('description') or ''}

def main():
    supplied = os.environ['ARTICLE_URL'].strip()
    data, final_url, headers = images.read_public(supplied, 2_000_000)
    item = article_from_html(final_url, data.decode(headers.get_content_charset() or 'utf-8', errors='replace'))
    try: item['image'] = images.cache_article_image(final_url) or images.PLACEHOLDER
    except Exception: pass
    path = ROOT / 'company/news-data.json'; records = json.loads(path.read_text())
    existing = next((r for r in records if r['url'].rstrip('/') in (supplied.rstrip('/'), final_url.rstrip('/'))), None)
    if existing is None:
        item['manualSourceUrl'] = supplied; records.append(item)
    else:
        existing['manualSourceUrl'] = supplied
        if existing.get('image') in (None, '', images.PLACEHOLDER): existing['image'] = item['image']
    temporary = path.with_suffix('.json.tmp'); temporary.write_text(json.dumps(records, ensure_ascii=False, indent=2)+'\n'); temporary.replace(path)
    print('Article registered successfully')

if __name__ == '__main__': main()
