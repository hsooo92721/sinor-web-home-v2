"""Keep up to three representative publishers for each identifiable news story.

Publisher preferences are editorial choices, not a company-size measurement.
All collected records remain in the archive; only display flags change.
"""
from datetime import date
from difflib import SequenceMatcher
import json
from pathlib import Path
import re

CONFIG = Path(__file__).resolve().parents[1] / 'company/news-editorial.json'


def publisher(record):
    return re.sub(r'\s+\d{4}\.\d{2}\.\d{2}$', '', record['meta']).strip()


def title_key(title):
    return re.sub(r'\W+', '', title).casefold()


def classify(record, config):
    title = record['title']
    for rule in config.get('storyRules', []):
        if all(any(term in title for term in alternatives) for alternatives in rule['allOf']):
            return rule['id']
    return None


def curate(records, config=None):
    config = config or json.loads(CONFIG.read_text())
    preference = {name: index for index, name in enumerate(config['preferredPublishers'])}
    groups = []
    for record in records:
        for key in ('editorialHidden', 'storyGroup'):
            record.pop(key, None)
        day = date(*record['date'])
        label = classify(record, config)
        group = next((group for group in groups
                      if abs((group['day'] - day).days) <= config['storyWindowDays']
                      and ((label and label == group['label'])
                           or (not label and not group['label']
                               and SequenceMatcher(None, title_key(record['title']), group['title']).ratio() >= .82))), None)
        if group is None:
            group = {'day': day, 'label': label, 'title': title_key(record['title']), 'records': []}
            groups.append(group)
        group['records'].append(record)
    for index, group in enumerate(groups):
        if len(group['records']) <= config['maxPerStory']:
            continue
        ranked = sorted(group['records'], key=lambda item: (
            preference.get(publisher(item), len(preference)),
            not bool(item.get('image') and item['image'] != 'assets/news-placeholder.svg'),
            tuple(-n for n in item['date']),
        ))
        selected = set()
        sources = set()
        for item in ranked:
            name = publisher(item)
            if name in sources:
                continue
            selected.add(id(item))
            sources.add(name)
            if len(selected) >= config['maxPerStory']:
                break
        for item in group['records']:
            item['storyGroup'] = f"{group['label'] or 'similar-headline'}-{group['day'].isoformat()}-{index}"
            item['editorialHidden'] = id(item) not in selected
    return records
