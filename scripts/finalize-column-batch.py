"""Finalize a downloaded batch locally; no commit, deployment or CMS writes."""
from pathlib import Path
from PIL import Image
import json,csv,sys
root=Path(__file__).resolve().parent.parent
folder=root/'migration/columns'/sys.argv[1]
report=json.loads((folder/'report.json').read_text())
data=json.loads((root/'cms/imported-columns.json').read_text())
ids={p['sourceUrl'].split('idx=')[-1] for p in report['posts']}
small=[]
for image in report['images']:
 with Image.open(root/image['path']) as im:image['dimensions']=list(im.size)
 if image['dimensions'][0]<=200:small.append(image['path'])
for post in data['posts']:
 if post.get('sourceId') not in ids:continue
 for src in small:
  post['bodyHtml']=post['bodyHtml'].replace('<figure class="sinor-column-figure"><img src="'+src+'"','<figure class="sinor-column-figure sinor-column-source-logo"><img src="'+src+'"')
(root/'cms/imported-columns.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(folder/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
with (folder/'url-map.csv').open('w',encoding='utf-8-sig',newline='') as f:
 writer=csv.writer(f);writer.writerow(['번호','기존 URL','새 URL','제목','발행일'])
 for post in report['posts']:writer.writerow([post['number'],post['sourceUrl'],'/columns/'+str(post['number']),post['title'],post['publishedAt']])
manifest_path=root/'deployment/redirects/manifest.json'
manifest=json.loads(manifest_path.read_text())
for post in data['posts']:
 if post.get('sourceId') not in ids:continue
 rule={'sourceUrl':post['migration']['sourceUrl'],'sourcePath':'/information/','sourceId':post['sourceId'],'targetPath':'/columns/'+str(post['migration']['number']),'postId':post['id']}
 manifest['columns']=[r for r in manifest['columns'] if r.get('postId')!=post['id']]+[rule]
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(folder/'README.md').write_text('# 과거 칼럼 추가 이전\n\n원문 발행일 순서로 추가하며 기존 데이터를 유지합니다.\n\n- originals/: 원문 본문 HTML\n- report.json: 원문 주소·발행일·작성자·카테고리·이미지 자체 경로/해시/크기\n- url-map.csv: 기존 주소와 새 번호 주소 대응표\n- 본문은 변환 시 텍스트 일치를 확인하고 이미지는 자체 파일로 저장했습니다.\n- 기존 카테고리와 작성자를 연결하며 미표기 작성자는 김시놀 / 시놀(주) / 에디터를 사용합니다.\n- 리디렉션 설정은 준비 파일일 뿐 운영 서버에 적용하지 않았습니다.\n- 사용자 요청으로 커밋·배포 전 로컬 상태로 보관합니다.\n')
print('Total posts:',len(data['posts']),'Batch:',len(report['posts']),'Image URLs:',len(report['images']))
