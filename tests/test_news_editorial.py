import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('editorial', Path(__file__).resolve().parents[1] / 'scripts/news-editorial.py')
editorial = importlib.util.module_from_spec(spec)
spec.loader.exec_module(editorial)


def story(source, title='코웨이라이프솔루션, 시놀과 재혼 서비스 제휴', day=16):
    return {'title': title, 'date': [2026, 10, day], 'meta': f'{source} 2026.10.{day:02}', 'image': 'assets/photo.jpg'}


class EditorialTests(unittest.TestCase):
    def test_three_representatives_prioritize_major_outlets_not_fixed_daily(self):
        records = [story(name) for name in ['싱글리스트', '매일일보', '서울경제TV', '연합뉴스', '중앙일보', 'MBC']]
        editorial.curate(records)
        visible = [editorial.publisher(i) for i in records if not i.get('editorialHidden')]
        self.assertEqual(set(visible), {'연합뉴스', 'MBC', '중앙일보'})
        self.assertEqual(len(records), 6)  # archive is retained

    def test_aliases_group_but_different_event_and_later_news_are_kept(self):
        records = [story(name, '코라솔, 시놀과 맞손…재혼 서비스 할인') for name in ['A', 'B', 'C', 'D']]
        unrelated = story('연합뉴스', '시놀, 여행 멤버십 출시')
        later = story('연합뉴스');later['date'] = [2026, 12, 1]
        records += [unrelated, later]
        editorial.curate(records)
        self.assertEqual(sum(not i.get('editorialHidden') for i in records), 5)
        self.assertFalse(unrelated.get('editorialHidden'))
        self.assertFalse(later.get('editorialHidden'))

    def test_new_major_report_replaces_lower_priority_choice(self):
        records = [story(name) for name in ['A', 'B', 'C', 'D']]
        editorial.curate(records)
        new = story('연합뉴스')
        records.append(new)
        editorial.curate(records)
        self.assertFalse(new.get('editorialHidden'))
        self.assertEqual(sum(not i.get('editorialHidden') for i in records), 3)
