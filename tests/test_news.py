import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import URLError

spec = importlib.util.spec_from_file_location('collector', Path(__file__).resolve().parents[1] / 'scripts/collect-news.py')
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


def article(title='시놀, 새로운 소식', url='https://example.com/news/123?utm_source=naver'):
    return {'title': title, 'description': '중장년 모임 서비스 시놀의 새 소식',
            'originallink': url, 'link': 'https://n.news.naver.com/article/001/123',
            'pubDate': 'Sun, 18 Oct 2026 09:10:00 +0900'}


class NewsTests(unittest.TestCase):
    def test_normalize_and_timezone(self):
        item = article('<b>시놀</b>, 만남 &amp; 여행')
        item['pubDate'] = 'Sat, 17 Oct 2026 16:10:00 +0000'
        record = collector.normalize(item)
        self.assertEqual(record['title'], '시놀, 만남 & 여행')
        self.assertEqual(record['date'], [2026, 10, 18])
        self.assertEqual(record['source'], 'naver-search')

    def test_company_not_synology_or_unrelated(self):
        for title in ['시놀로지 NAS 출시', '다른 회사의 소식']:
            item = article(title); item['description'] = title
            self.assertIsNone(collector.normalize(item))
        self.assertIsNotNone(collector.normalize(article('시놀은 중장년의 만남을 연결합니다')))

    def test_url_and_title_dedup_preserves_existing_thumbnail(self):
        old = collector.normalize(article()); old['image'] = 'assets/existing.jpg'
        duplicate = collector.normalize(article(url='http://example.com/news/123?utm_source=other'))
        syndicated = collector.normalize(article(url='https://other.com/story'))
        merged, added = collector.merge([old], [duplicate, syndicated])
        self.assertEqual(added, 0)
        self.assertEqual(merged, [old])

    def test_sort_and_empty_results_keep_history(self):
        old = collector.normalize(article('시놀, 과거 기사', 'https://example.com/old'))
        old['date'] = [2025, 1, 1]
        new = collector.normalize(article())
        merged, added = collector.merge([old], [new])
        self.assertEqual(added, 1)
        self.assertEqual(merged[0], new)
        self.assertEqual(collector.merge(merged, [])[0], merged)

    def test_reject_bad_urls_dates(self):
        for url in ['javascript:alert(1)', 'https://user:password@example.com/']:
            with self.assertRaises(ValueError):collector.normalize(article(url=url))
        item = article();item['pubDate'] = 'invalid'
        with self.assertRaises(ValueError):collector.normalize(item)

    @patch.object(collector.time, 'sleep')
    @patch.object(collector, 'urlopen', side_effect=URLError('offline'))
    def test_network_failure_leaves_data_unchanged(self, opener, sleeper):
        before = collector.DATA.read_bytes()
        with self.assertRaises(URLError):collector.fetch_news('test-id', 'test-secret')
        self.assertEqual(opener.call_count, 3)
        self.assertEqual(collector.DATA.read_bytes(), before)

    @patch.object(collector, 'urlopen')
    def test_official_endpoint_and_pagination(self, opener):
        from io import BytesIO
        items = [article(url=f'https://example.com/{i}', title=f'시놀 뉴스 {i}') for i in range(101)]
        opener.side_effect = [BytesIO(json.dumps({'total': 101, 'items': items[:100]}).encode()),
                              BytesIO(json.dumps({'total': 101, 'items': items[100:]}).encode())]
        result = collector.fetch_news('test-id', 'test-secret')
        self.assertEqual(len(result), 101)
        self.assertIn('start=101', opener.call_args_list[1].args[0].full_url)
        self.assertEqual(opener.call_args_list[0].args[0].get_header('X-naver-client-id'), 'test-id')

class GoogleNewsTests(unittest.TestCase):
    def feed(self, title='시놀, 새로운 소식 - 테스트신문', date='Sun, 18 Oct 2026 09:10:00 +0900'):
        from xml.sax.saxutils import escape
        return f'''<rss version="2.0"><channel><item><title>{escape(title)}</title>
        <link>https://news.google.com/rss/articles/test-article</link>
        <source url="https://example.com">테스트신문</source>
        <description>{escape(title)}</description><pubDate>{date}</pubDate>
        </item></channel></rss>'''.encode()

    def test_google_title_publisher_and_dedup_with_existing(self):
        result = collector.parse_google_feed(self.feed())
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['title'], '시놀, 새로운 소식')
        self.assertEqual(result[0]['meta'], '테스트신문 2026.10.18')
        self.assertEqual(result[0]['source'], 'google-news-rss')
        existing = collector.normalize(article())
        self.assertEqual(collector.merge([existing], result)[1], 0)

    def test_wrapped_link_and_revised_title_do_not_duplicate_same_publisher(self):
        old = collector.normalize(article('코웨이라이프솔루션, 시놀과 맞손…중장년 재혼·결혼정보 서비스 할인'))
        old['meta'] = '서울경제TV 2026.10.18'
        new = collector.normalize({**article('코라솔, 시놀과 맞손…중장년 재혼·결혼정보 서비스 할인', 'https://news.google.com/rss/articles/example'), 'publisher': '서울경제TV', 'provider': 'google-news-rss'})
        self.assertEqual(collector.merge([old], [new])[1], 0)

    def test_invalid_feed_and_irrelevant_results(self):
        with self.assertRaises(ValueError):collector.parse_google_feed(b'<html>service unavailable</html>')
        self.assertEqual(collector.parse_google_feed(self.feed('시놀로지 NAS 출시 - 테스트신문')), [])
        self.assertEqual(collector.parse_google_feed(self.feed(date='not-a-date')), [])

    @patch.object(collector, 'urlopen')
    def test_google_has_no_api_headers(self, opener):
        from io import BytesIO
        opener.return_value = BytesIO(self.feed())
        self.assertEqual(len(collector.fetch_google_news()), 1)
        request = opener.call_args.args[0]
        self.assertTrue(request.full_url.startswith('https://news.google.com/rss/search?'))
        self.assertNotIn('X-naver-client-secret', request.headers)


if __name__ == '__main__':unittest.main()
