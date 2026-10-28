"""GitHub Pages requires real files for HTTP 200 numeric article entry points.
Reserve 1..1000; the shared loader always reads the current article template.
Company hosting should route /columns/:number to the article renderer directly.
"""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>시놀칼럼</title><script type="module" src="../number-route.js?v=1"></script></head><body>칼럼을 불러오는 중입니다.</body></html>\n'
for number in range(1,1001):
 path=root/'columns'/str(number)/'index.html'
 path.parent.mkdir(exist_ok=True)
 path.write_text(html)
