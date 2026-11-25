"""Run automatically on deployment or manually to audit routes."""
import sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'server'))
from page_registry import write_manifest
if __name__=='__main__':
    data=write_manifest(root)
    print(f"페이지 {len(data['pages'])}개 (경로 그룹 포함), 제외 {len(data['excluded'])}개")
    for reason,count in data['excludedCounts'].items(): print(f'  {reason}: {count}')
