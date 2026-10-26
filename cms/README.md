# 시놀칼럼 CMS 연동 안내

## 현재 동작

- 관리자: `admin/columns/`, 작성: `admin/columns/new/`, 수정: `admin/columns/edit/?id=ID`
- 카테고리: `admin/columns/categories/`
- 독자 목록: `columns/`, 상세: `columns/view/?id=ID`
- 관리자·독자 페이지·홈 칼럼 카드가 `client.js`를 함께 사용합니다.
- 현재 `config.js`의 `mode: demo`는 같은 사이트 경로·같은 브라우저의 IndexedDB에 저장합니다. 다른 기기나 방문자와 공유되지 않으며 브라우저 데이터 삭제 시 사라집니다.
- 공개 글만 독자 목록·홈에 노출됩니다. 비공개 저장 및 휴지통 이동 시 제외됩니다. 홈은 추천 글 우선, 그다음 최신 공개 글 2개입니다.
- 로그인과 실제 회사 API 연결은 포함하지 않았습니다.

## 회사 API 연결

`config.js`에서 mode를 `api`로 바꾸고 apiBase와 credentials를 설정합니다. 아래는 클라이언트가 기대하는 계약이며 기존 회사 API와 다르면 `client.js`의 request 및 cms 메서드에서 매핑합니다. 설정 변경만으로 임의의 회사 API와 자동 호환되지는 않습니다.

| 메서드 | apiBase 아래 경로 | 응답 |
| --- | --- | --- |
| GET | /columns | 공개 칼럼 배열 |
| GET | /columns/:id | 공개 칼럼 객체, 비공개는 404 |
| GET | /columns/categories | 카테고리 배열 |
| GET | /admin/columns | 관리자 칼럼 배열, 휴지통 포함 |
| GET | /admin/columns/:id | 관리자 칼럼 객체 |
| POST | /admin/columns | 저장된 칼럼 객체 |
| PUT | /admin/columns/:id | 저장된 칼럼 객체 |
| POST | /admin/columns/categories | 카테고리 객체 |
| PUT | /admin/columns/categories/:id | 카테고리 객체 |
| DELETE | /admin/columns/categories/:id | 204 |
| POST | /admin/media | multipart file 업로드, {"url":"https://..."} |

칼럼 필드: id, title, excerpt, bodyHtml, categoryId, author, thumbnail, featured(boolean), status(draft/published/trash), createdAt, updatedAt, publishedAt(ISO 8601 또는 null), version(정수). 카테고리 필드: id, name, order(숫자). 목록 응답은 페이지 객체가 아닌 배열입니다. 요청 본문은 업로드를 제외하고 JSON입니다. 오류 응답은 {"message":"설명"}입니다.

현재 클라이언트는 수정 요청에 증가된 version을 보냅니다. 서버는 기존 version + 1인지 원자적으로 확인하고 충돌이면 409를 반환해야 합니다. 작성·수정 일시와 권한은 서버에서 검증해야 합니다. 사용 중인 카테고리 삭제도 서버에서 막아야 합니다.

운영 전 관리자·업로드 API에 회사 인증/권한 및 요청 검증을 적용하고, 본문 HTML을 서버에서도 정화해야 합니다. 공개 API에서는 비공개·휴지통 내용을 반환하면 안 됩니다. 교차 출처 API라면 CORS와 쿠키 정책도 회사 서버에 맞춥니다. 비밀 키는 config.js에 넣지 않습니다.

정적 클라이언트 렌더링이므로 검색엔진용 글별 메타데이터·소셜 공유 이미지는 회사 서버 연동 시 SSR 또는 사전 생성으로 보완해야 합니다.


## 회사소개 콘텐츠 관리

- `/admin/news/`: 중복을 포함한 수집 기사 전체 카드와 개별 ON/OFF. 기존 `editorialHidden` 자동 선별보다 관리자 토글을 우선하며 미설정·신규 기사는 ON입니다. OFF 상태는 기사 URL을 키로 저장하므로 자동 수집 시에도 유지됩니다. 수집 파일 자체는 수정하지 않습니다.
- `/admin/history/`: 기존 연혁 74건을 초기값으로 추가·수정·삭제합니다. 연도·월 내림차순이며 사진과 설명도 관리합니다.
- `/admin/partners/`: 사회공헌 로고, 제휴·협력사 로고, 기존 업무협약 기관명 목록을 관리합니다. 기존 로고의 실제 회사명이 소스에 없는 경우 번호 이름을 유지했습니다. 로고와 회사명 목록을 임의로 연결하지 않았으며 관리자가 확인 후 이름을 수정할 수 있습니다. 새 제휴·협력사에는 회사명과 로고가 필요하고, 기관명만 관리하는 구분에는 로고가 선택입니다.
- 초기 데이터는 `company/cms-seed.json`, 브라우저 변경값은 별도 IndexedDB `sinor-company`에 저장합니다. 이 모드 역시 같은 브라우저에서만 독자 페이지와 연동됩니다.

회사 API 모드에서는 `company-client.js`가 다음 계약을 사용합니다. 목록은 배열, 저장은 저장된 객체를 반환합니다.

| 메서드 | 경로 | 데이터 |
| --- | --- | --- |
| GET | /admin/company/news | 전체 기사 배열, 중복 포함 |
| GET | /company/news | enabled=true 기사만 |
| PUT | /admin/company/news/visibility | {id, enabled} |
| GET | /admin/company/history 또는 /company/history | 연혁 배열 |
| GET | /admin/company/partners 또는 /company/partners | 협력사 배열 |
| POST | /admin/company/history 또는 /admin/company/partners | 새 항목 |
| PUT | /admin/company/history/:id 또는 /admin/company/partners/:id | 수정 항목 |
| DELETE | /admin/company/history/:id 또는 /admin/company/partners/:id | 204 |

기사 필드: id, title, meta, url, date([연,월,일]), image(company/ 기준 상대경로), enabled, storyGroup(선택). 토글 id는 API에서 고유하고 안정적인 식별자여야 합니다. 데모에서는 url을 사용합니다. 자동 수집 서버는 ON/OFF를 별도 저장하고 재수집 시 덮어쓰지 않도록 해야 합니다.
연혁 필드: id, year, month, text, image, caption, order. 협력사 필드: id, group(social/partner/directory), name, image, order. 이미지 업로드는 기존 `/admin/media`를 공유합니다. 관리자 인증·권한, 파일 검증 및 동시 수정 처리는 회사 서버에서 적용해야 합니다.


## 코드 없이 칼럼 작성

칼럼 작성 화면의 ‘구성 요소 추가’에서 기본 구성, 본문, 부제목, 소제목, 요약 박스, 인사이트, 통계 카드 3개, 표, 사진·설명, 핵심 문장, 해시태그, 작성자 소개, 출처를 추가합니다. 입력창에 텍스트를 넣으면 공통 디자인이 자동 적용됩니다. 추가 후 본문을 클릭해 수정하며 선택 블록을 위·아래로 이동하거나 삭제할 수 있습니다. 표는 셀에 직접 입력하고 행·열 도구로 구조를 바꿉니다. 선택 문장은 밑줄 강조할 수 있습니다.

`columns/content.css`를 편집기·미리보기·독자 상세가 공유합니다. 본문 HTML의 `sinor-column` 계열 클래스와 안전한 구조 태그를 보존하며 스크립트·이벤트 속성은 제거합니다. 회사 서버의 HTML 정화 정책도 해당 클래스와 section/figure/table/mark 구조를 허용해야 디자인이 유지됩니다. 본문 편집에는 HTML/CSS 입력이 필요하지 않습니다.


## 협력사 순서와 로고 검색

협력사 관리 카드의 드래그 손잡이로 순서를 바꿉니다. 모바일 터치와 위·아래 버튼도 지원하며 검색 중에는 보이는 항목 사이에서 이동합니다. 각 공개 영역은 해당 구분 내 order 순서를 따릅니다. 저장 API는 `PUT /admin/company/partners/order`, 본문 `{ids: [전체 항목 ID 순서]}`이며 서버는 항목 목록을 검증한 뒤 order를 원자적으로 갱신해야 합니다.

로고 검색은 데모에서 Wikimedia Commons API를 사용합니다. 기관명 또는 영문명으로 후보를 검색해 선택하며, 후보 부재·연결 실패 시 업로드를 사용할 수 있습니다. 모든 기관을 찾거나 공식 최신 로고임을 보장하지 않습니다. 선택 시 외부 이미지 URL 및 logoSource({source, author, license, licenseUrl})를 저장하고 독자 페이지에 출처를 표시합니다. 운영 시 서버에서 필요한 이용조건을 확인하고 이미지를 회사 미디어 저장소에 보관하는 방식으로 교체할 수 있습니다.

회사 API 모드 로고 검색: `GET /admin/company/partners/logos?query=기관명`, 응답 배열 `[{title,url,source,author,license,licenseUrl}]`. 이 API는 검색용이며 사용자가 ‘적용’ 후 ‘저장’을 눌러야 협력사 정보가 바뀝니다.


## 기본값이 채워진 문서 편집

새 칼럼은 제목·부제목·작성자·세무사·읽는 시간(6분)·날짜(한국 시간 오늘) 및 예시 본문이 채워진 상태로 시작합니다. 안내 라벨 아래 내용을 클릭해 직접 수정합니다. 기존 저장 글은 기본값으로 덮어쓰지 않습니다.

추가 칼럼 필드: subtitle(최대 300자), expertName(최대 100자, 선택), readMinutes(1~120 정수), displayDate(YYYY-MM-DD). 회사 API는 이 필드도 저장·반환해야 합니다. displayDate는 독자에게 보이는 날짜이며 실제 공개 일시 publishedAt과 분리됩니다.

‘아임웹 HTML 붙여넣기’는 시놀칼럼 작업실의 HTML 전체를 받습니다. .sinor-column 내부의 표준 제목·부제목·메타 정보를 읽어 상단 필드로 옮기고 본문과 분리하여 중복 제목을 방지합니다. 공통 디자인을 사용하며 스크립트는 제거합니다. style 내용은 customCss로 분리해 칼럼 범위에만 적용합니다. 가져온 본문도 비주얼 에디터에서 수정할 수 있습니다. 임의 HTML의 모든 스타일을 그대로 재현하는 범용 웹페이지 임포터는 아닙니다.

## 칼럼 키워드와 메타 정보

게시 설정의 ‘키워드 (쉼표로 구분)’는 keywords 배열로 저장합니다. 쉼표·전각 쉼표 기준으로 나누며 공백·빈 항목·대소문자 중복을 정리합니다. 최대 30개, 항목당 60자입니다. 기존 keywords 문자열도 읽을 수 있습니다. 아임웹 HTML에 meta[name=keywords]가 있으면 가져오기에서 채웁니다.

독자 상세는 글마다 title, description(소개글→부제목→본문 순), meta keywords, author, Open Graph, canonical 및 Article JSON-LD를 생성합니다. 미리보기와 브라우저 저장 데모는 noindex이며, 조회 실패 시 이전 글의 메타 정보를 제거합니다. 키워드는 접근성 기능이 아니며 Google은 meta keywords를 검색 순위에 사용하지 않습니다.

현재는 클라이언트 렌더링입니다. 회사 API는 keywords 배열을 저장·반환하고, 실제 운영에서는 같은 글별 메타 정보·canonical·구조화 데이터를 서버 HTML 또는 사전 생성 HTML의 head에도 렌더링해야 합니다. 브라우저 데모의 로컬 글은 검색 로봇과 공유되지 않습니다. 소셜 공유 크롤러와 검색 노출을 이 데모만으로 검증한 것은 아닙니다.


## HTML 코드 편집

HTML 편집 버튼은 어두운 배경, 고정폭 글꼴, 줄 번호, 태그·주석 색상과 Tab 들여쓰기를 제공합니다. 비주얼 복귀·저장·미리보기 시 HTML을 다시 읽어 본문·상단 정보·CSS를 적용합니다. CSS는 customCss 문자열(최대 200,000자)로 별도 저장하므로 회사 API에서도 이 필드를 보존해야 합니다. 비주얼·미리보기·독자 화면에 선택자를 각각 한정해 적용하며 @media/@supports를 지원합니다. 외부 url/import, 스크립트 관련 표현, 형제 선택자 및 지원하지 않는 at-rule은 제외합니다. 스크립트와 이벤트 속성은 계속 제거합니다.
