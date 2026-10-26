"""Collect Sinor news from public Google News RSS; Naver API remains optional."""
import argparse
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from difflib import SequenceMatcher
import html
import json
import os
from pathlib import Path
import re
import sys
import time
import xml.etree.ElementTree as ET
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'company/news-data.json'
KST = timezone(timedelta(hours=9))


def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', '', value or ''))).strip()


def url_key(value):
    u = urlsplit(value)
    if u.scheme not in ('https', 'http') or not u.hostname or u.username or u.password:
        raise ValueError('Invalid article URL')
    query = [(k, v) for k, v in parse_qsl(u.query, keep_blank_values=True)
             if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    return urlunsplit(('https', u.netloc.lower(), u.path.rstrip('/'), urlencode(sorted(query)), ''))


def title_key(title):
    return re.sub(r'\W+', '', plain(title).casefold())


def normalize(item):
    title = plain(item.get('title'))
    description = plain(item.get('description'))
    # Exact company name required; arbitrary broad keyword matches are not published.
    if not title or not re.search(r'(?<![가-힣A-Za-z])시놀(?=$|[^가-힣A-Za-z]|은|는|이|가|을|를|의|과|와|에서|에|도)', title + ' ' + description):
        return None
    original = item.get('originallink') or item.get('link', '')
    url_key(original)
    try:
        published = parsedate_to_datetime(item['pubDate'])
    except (ValueError, TypeError) as error:
        raise ValueError('Invalid article date') from error
    if published.tzinfo is None:
        raise ValueError('Article date must include a timezone')
    published = published.astimezone(KST)
    if published > datetime.now(KST) + timedelta(days=1):
        raise ValueError('Future article date')
    source = plain(item.get('publisher')) or urlsplit(original).hostname.removeprefix('www.')
    return {
        'title': title,
        'meta': f'{source} {published:%Y.%m.%d}',
        'url': original,
        'date': [published.year, published.month, published.day],
        'year': str(published.year),
        'publishedAt': published.isoformat(),
        'image': 'assets/news-placeholder.svg',
        'source': item.get('provider', 'naver-search'),
    }


def merge(existing, incoming):
    result = list(existing)
    urls = {url_key(item['url']) for item in result}
    titles = {title_key(item['title']) for item in result}
    added = 0
    for item in incoming:
        u, t = url_key(item['url']), title_key(item['title'])
        if u in urls or t in titles:
            continue
        # RSS may wrap an existing publisher URL and use a slightly revised headline.
        publisher = re.sub(r'\s+\d{4}\.\d{2}\.\d{2}$', '', item['meta'])
        if item.get('source') == 'google-news-rss' and any(
            old['date'] == item['date']
            and re.sub(r'\s+\d{4}\.\d{2}\.\d{2}$', '', old['meta']) == publisher
            and SequenceMatcher(None, title_key(old['title']), t).ratio() >= 0.86
            for old in result
        ):
            continue
        result.append(item)
        urls.add(u)
        titles.add(t)
        added += 1
    # Stable order for ties; old manually curated thumbnails/metadata are preserved.
    result.sort(key=lambda item: (tuple(item['date']), item.get('publishedAt', '')), reverse=True)
    return result, added


def fetch_news(client_id, client_secret):
    collected = []
    for start in range(1, 1001, 100):
        query = urlencode({'query': '시놀', 'display': 100, 'start': start, 'sort': 'date'})
        request = Request('https://openapi.naver.com/v1/search/news.json?' + query, headers={
            'X-Naver-Client-Id': client_id,
            'X-Naver-Client-Secret': client_secret,
            'User-Agent': 'SinorNewsCollector/1.0',
        })
        payload = None
        for attempt in range(3):
            try:
                with urlopen(request, timeout=25) as response:
                    payload = json.load(response)
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(2 ** attempt)
        if not isinstance(payload, dict) or not isinstance(payload.get('items'), list) or 'total' not in payload:
            raise ValueError('Unexpected Naver API response')
        for item in payload['items']:
            try:
                record = normalize(item)
            except (ValueError, KeyError, TypeError, OverflowError):
                print('Skipping a result with invalid URL/date metadata', file=sys.stderr)
                continue
            if record:
                collected.append(record)
        if start + len(payload['items']) > int(payload['total']) or len(payload['items']) < 100:
            break
    return collected


def parse_google_feed(payload):
    root = ET.fromstring(payload)
    if root.tag != 'rss' or root.find('channel') is None:
        raise ValueError('Unexpected Google News RSS response')
    records = []
    for element in root.findall('./channel/item'):
        publisher = plain(element.findtext('source'))
        title = plain(element.findtext('title'))
        suffix = ' - ' + publisher
        if publisher and title.endswith(suffix):
            title = title[:-len(suffix)]
        try:
            record = normalize({
                'title': title,
                'description': element.findtext('description', ''),
                'link': element.findtext('link', ''),
                'pubDate': element.findtext('pubDate', ''),
                'publisher': publisher,
                'provider': 'google-news-rss',
            })
        except (ValueError, TypeError, KeyError, OverflowError):
            print('Skipping an RSS result with invalid URL/date metadata', file=sys.stderr)
            continue
        if record:
            records.append(record)
    return records


def fetch_google_news():
    # A recent window prioritizes new coverage; collected history is retained forever.
    query = urlencode({'q': '"시놀" when:30d', 'hl': 'ko', 'gl': 'KR', 'ceid': 'KR:ko'})
    request = Request('https://news.google.com/rss/search?' + query,
                      headers={'User-Agent': 'SinorNewsCollector/1.0'})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=25) as response:
                payload = response.read(4_000_001)
            if len(payload) > 4_000_000:
                raise ValueError('RSS response too large')
            return parse_google_feed(payload)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture', type=Path, help='Offline Naver response JSON for validation')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--source', choices=['google', 'naver'], default='google')
    args = parser.parse_args()
    if args.fixture:
        incoming = [record for item in json.loads(args.fixture.read_text())['items']
                    if (record := normalize(item))]
    elif args.source == 'google':
        incoming = fetch_google_news()
    else:
        client_id, secret = os.environ.get('NAVER_CLIENT_ID'), os.environ.get('NAVER_CLIENT_SECRET')
        if not client_id or not secret:
            parser.error('Set NAVER_CLIENT_ID and NAVER_CLIENT_SECRET (GitHub Actions repository secrets)')
        # Fetch every page successfully before touching the published data.
        incoming = fetch_news(client_id, secret)
    existing = json.loads(DATA.read_text())
    merged, added = merge(existing, incoming)
    print(f'Collected {len(incoming)} matching results; {added} new; {len(merged)} total')
    if not args.dry_run and merged != existing:
        temp = DATA.with_suffix('.json.tmp')
        temp.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n')
        temp.replace(DATA)


if __name__ == '__main__':
    main()
