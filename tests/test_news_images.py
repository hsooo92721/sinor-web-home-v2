import importlib.util
from email.message import Message
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('images', Path(__file__).resolve().parents[1] / 'scripts/news-images.py')
images = importlib.util.module_from_spec(spec)
spec.loader.exec_module(images)


class ImageTests(unittest.TestCase):
    def test_meta_attribute_order_and_entities(self):
        parser = images.PreviewMetadata()
        parser.feed('<meta content="https://example.com/photo.jpg?a=1&amp;b=2" property="og:image"><meta name="twitter:image" content="/fallback.png">')
        self.assertEqual(parser.og, ['https://example.com/photo.jpg?a=1&b=2'])
        self.assertEqual(parser.twitter, ['/fallback.png'])

    @patch.object(images.socket, 'getaddrinfo')
    def test_rejects_private_destination_and_credentials(self, resolver):
        resolver.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 443))]
        with self.assertRaises(ValueError):images.public_url('https://example.com/photo.jpg')
        with self.assertRaises(ValueError):images.public_url('file:///etc/passwd')
        with self.assertRaises(ValueError):images.public_url('https://user:pass@example.com')

    def test_rejects_html_error_or_svg_instead_of_photo(self):
        for data in [b'<html>forbidden</html>', b'<svg></svg>']:
            with self.assertRaises(ValueError):images.image_extension(data)
        self.assertEqual(images.image_extension(b'\xff\xd8\xffdata'), '.jpg')

    @patch.object(images, 'read_public')
    def test_relative_preview_saved_locally_and_invalid_og_uses_twitter(self, reader):
        headers = Message(); headers['Content-Type'] = 'text/html; charset=utf-8'
        reader.side_effect = [
            (b'<meta property="og:image" content="/broken"><meta name="twitter:image" content="/photo.png">', 'https://example.com/news/item', headers),
            (b'forbidden', 'https://example.com/broken', headers),
            (b'\x89PNG\r\n\x1a\nphoto', 'https://example.com/photo.png', headers),
        ]
        with tempfile.TemporaryDirectory() as folder, patch.object(images, 'ROOT', Path(folder)):
            (Path(folder) / 'company/assets').mkdir(parents=True)
            result = images.cache_article_image('https://example.com/news/item')
            self.assertTrue(result.startswith('assets/press-auto-'))
            self.assertTrue((Path(folder) / 'company' / result).exists())
        self.assertEqual(reader.call_args.args[0], 'https://example.com/photo.png')

    @patch.object(images, 'cache_article_image', side_effect=TimeoutError)
    def test_unavailable_photo_preserves_fallback_and_existing_images(self, reader):
        records = [{'url': 'https://example.com/new', 'image': images.PLACEHOLDER},
                   {'url': 'https://example.com/old', 'image': 'assets/original.jpg'}]
        self.assertEqual(images.enrich_images(records), 0)
        self.assertEqual(records[0]['image'], images.PLACEHOLDER)
        self.assertEqual(records[1]['image'], 'assets/original.jpg')
        reader.assert_called_once()
