# 사이트 CMS 구현 및 회사 서버 연결

## 구현 위치
- `/admin/news/`: 고정 9개, 상태별 건수·검색·보기 전환·기사 직접 추가·사용자 PC/모바일 노출 설정
- `/admin/pages/`: 실제 페이지 직접 편집, 다단계 메뉴, 설정/복제/삭제, 하위 페이지 추가, 드래그 정렬, 저장/실행취소
- `/admin/policies/`: 같은 편집 시스템으로 기존 약관을 편집
- `/admin/design/`: 중앙 실제 화면 + 우측 공통 디자인, 저장 전 미리보기, 실행취소
- 회사연혁·협력사는 기존 관리 화면을 재사용. 편집 화면에서 연혁/기사 블록 클릭 시 기존 관리로 이동.
- 슬라이드 설정은 사회공헌 로고 블록 클릭. 개별 설정이 공통 기본값보다 우선.
- 이미지 파일은 기존 업로드 제한/경로를 재사용. 직접 텍스트 스타일은 인라인이며 공통 CSS보다 우선.

## 현재 정적 사이트에서의 저장 범위
현재 `mode: demo`에서는 IndexedDB에 저장하므로 **동일 브라우저** 사용자 화면에 반영한다. 다른 방문자에게 자동 배포되지는 않는다. 비공개/삭제는 접근 제어가 아니며 로그인도 아직 구현하지 않았다.

페이지 편집 상단 `배포 데이터 다운로드`는 마지막 저장 상태만 JSON으로 내보낸다. 공통 디자인도 같은 저장소에 포함된다. 정적 배포 파일 준비:

```sh
python3 scripts/prepare-site-content.py /path/sinor-site-content.json --output /tmp/sinor-site-build --base-path /sinor-web-home-v2/ --origin https://hsooo92721.github.io
```

새 출력 폴더에 HTML 경로, 이미지, 공개 설정 JSON, 리디렉션 매핑을 생성한다. 검토 후 기존 소스에 합쳐 커밋/배포한다. 생성 HTML에 공유 메타가 포함된다. 브라우저에서만 바꾼 OG 메타는 카카오 등 크롤러에 보장되지 않으므로 회사 서버에서는 저장 시 정적 HTML 재생성 또는 서버 렌더링이 필요하다.

GitHub Pages의 임의 새 경로는 배포 전 404 문서에서 같은 브라우저의 설정으로 표시한다. 이는 HTTP 200/301 서버 응답이 아니다. `_redirects`는 지원 호스팅용이며 GitHub Pages는 실행하지 않는다. `redirect-map.json`을 회사 서버/프록시의 301 규칙으로 적용해야 한다. 기존 칼럼의 쿼리 기반 이전 주소는 별도 칼럼 리디렉션 매핑도 함께 유지한다.

## 회사 API 연결 계약
기존 `window.SINOR_CMS_CONFIG`의 mode/apiBase/credentials를 그대로 사용한다. 공개 GET 응답과 관리자 PUT 응답은 같은 구조. 인증·권한은 반드시 서버에서 적용한다.

- GET `/site/content` → `{version:1,pages:[...],patches:{pageId:[...]},design:{...},carousel:{pageId:{visible,mobileVisible,auto,control}}}`
- PUT `/admin/site/content` → 위 전체 문서. 서버에서 원자 저장, 버전/수정일 충돌 검사, URL 중복/경로 검증, HTML 정제 후 공개 데이터 제공.
- page: `id,name,path,originalPath,template,parentId,order,title,description,image,legacyUrls,deleted`. template은 허용된 사이트 템플릿만 사용. 복제 시 패치 독립 복사.
- patch: `selector,html/text,style(fontSize/fontWeight/color/borderRadius),src/imageData,url,open,mapAddress`. 서버 HTML·URL 검증 필수. selector는 현재 템플릿 기준이므로 개발 시 DOM 구조 변경 후 패치 유효성 검토.
- GET `/company/news/layout` / PUT `/admin/company/news/layout` → `{pcColumns,mobileColumns,pcSize,mobileSize}`
- POST `/admin/company/news` → `{url,id,title,meta,date:[year,month,day],image,description}`
- POST `/admin/company/news/metadata` ← `{url}` → `{url,title,meta,date:'YYYY-MM-DD',image,description}`
- 기존 뉴스 목록/공개 토글, 연혁, 협력사, 업로드 API는 그대로 재사용.

기사 URL 불러오기는 기존 수집 데이터부터 조회하고, 데모에서는 기사 원문 요청이 허용될 때 OG 정보를 읽는다. 대부분의 언론사는 CORS를 막으므로 회사 서버 메타데이터 API가 필요하다. 서버는 공개 HTTP(S)만 허용하고 사설망·로컬 주소 차단, 리디렉션마다 재검증, 크기/시간 제한을 적용해야 한다. 실패 시 직접 입력으로 저장할 수 있다.

## 공통 디자인
`docs/typography-inventory.json`에 기존 크기 분포를 기록했다. 공통 역할 색상은 `--site-primary/secondary/black/gray/surface`, 제목/본문/모바일 크기·여백·카드도 CSS 변수 기반. 폰트 선택은 Pretendard 및 Google Fonts 6종. 공통 크기 입력 최솟값은 14px. 개별 인라인 크기 역시 14px 이상. 페이지네이션은 언론보도/칼럼 두 스타일, TOP은 PC만 표시.
