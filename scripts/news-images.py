"""Resolve public article URLs and cache Open Graph / Twitter preview images."""
import hashlib
from html.parser import HTMLParser
import ipaddress
from pathlib import Path
import socket
import sys
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
PLACEHOLDER = 'assets/news-placeholder.svg'


def public_url(url):
    parsed = urlsplit(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Invalid public URL')
    if parsed.port not in (None, 80, 443):
        raise ValueError('Unsupported port')
    addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == 'https' else 80))
    if not addresses or any(not ipaddress.ip_address(address[4][0]).is_global for address in addresses):
        raise ValueError('Non-public address')
    return url


class PublicRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def read_public(url, limit):
    public_url(url)
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; SinorNewsPreview/1.0)'})
    with build_opener(PublicRedirects()).open(req, timeout=12) as response:
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError('Response too large')
        return data, response.geturl(), response.headers


class PreviewMetadata(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.og = []
        self.twitter = []

    def handle_starttag(self, tag, attrs):
        if tag != 'meta':
            return
        attrs = dict(attrs)
        kind = (attrs.get('property') or attrs.get('name') or '').lower()
        value = attrs.get('content', '').strip()
        if kind in ('og:image', 'og:image:url') and value:
            self.og.append(value)
        elif kind in ('twitter:image', 'twitter:image:src') and value:
            self.twitter.append(value)


def image_extension(data):
    # Store raster images only; an HTML error page or SVG is never cached as an image.
    if data.startswith(b'\xff\xd8\xff'):
        return '.jpg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return '.png'
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return '.gif'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return '.webp'
    raise ValueError('Unsupported image bytes')


def cache_article_image(url):
    data, final_url, headers = read_public(url, 2_000_000)
    charset = headers.get_content_charset() or 'utf-8'
    parser = PreviewMetadata()
    parser.feed(data.decode(charset, errors='replace'))
    for image in dict.fromkeys(parser.og + parser.twitter):
        try:
            image_url = urljoin(final_url, image)
            content, _, _ = read_public(image_url, 5_000_000)
            extension = image_extension(content)
            name = 'press-auto-' + hashlib.sha256(image_url.encode()).hexdigest()[:20] + extension
            path = ROOT / 'company/assets' / name
            path.write_bytes(content)
            return 'assets/' + name
        except Exception:
            continue
    return None


def enrich_images(records, limit=20):
    candidates = [item for item in records if not item.get('image') or item['image'] == PLACEHOLDER][:limit]
    google = [item for item in candidates if urlsplit(item['url']).hostname == 'news.google.com']
    if google:
        try:
            from googlenewsdecoder import gnewsdecoder
            results = gnewsdecoder([item['url'] for item in google], interval=.3, timeout=12)
            if isinstance(results, dict):
                results = [results]
            for item, result in zip(google, results):
                if result.get('success'):
                    resolved = result['decoded_url']
                    public_url(resolved)
                    item.setdefault('discoveryUrl', item['url'])
                    item['url'] = resolved
        except Exception:
            print('Some Google article URLs could not be resolved; keeping their current links', file=sys.stderr)
    downloaded = 0
    for item in candidates:
        if urlsplit(item['url']).hostname == 'news.google.com':
            continue
        try:
            image = cache_article_image(item['url'])
            if image:
                item['image'] = image
                downloaded += 1
        except Exception:
            print('Article preview unavailable; preserving fallback image', file=sys.stderr)
    return downloaded
