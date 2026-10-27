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

## 공통 칼럼 스타일 관리

`/admin/columns/styles/`에서 법률(law)·여행 후기(travel) 기본 스타일을 관리하고 새 스타일을 만들 수 있습니다. 강조색·본문색·부제목색·카드 배경·인사이트 배경·고딕/명조·본문/소제목 크기·행간·모서리를 조절하며 옆 미리보기에 즉시 적용합니다. 고급 CSS도 지원합니다. ‘좁은 너비’는 편집 화면 안의 너비 미리보기이며 실제 기기 미디어쿼리 전체를 시뮬레이션하는 기능은 아닙니다.

칼럼의 styleId에 선택한 스타일 ID를 저장합니다. 미설정 기존 글은 law를 사용합니다. 스타일 선택은 내용을 교체하지 않으며 편집기·미리보기·독자 화면의 모양만 바꿉니다. 저장된 공통 스타일 변경은 해당 스타일을 사용하는 모든 글에 연결되며 같은 브라우저의 다른 탭에도 반영합니다. 공통 스타일을 개인 customCss 뒤에 적용해, 기존 아임웹 공통 CSS를 포함한 글도 새 스타일을 선택하면 테마 속성이 바뀌도록 했습니다. 인라인 스타일은 CSS 규칙에 따라 별도 우선순위를 가집니다.

데모 스타일은 사이트 경로별 IndexedDB `sinor-column-styles`에 저장하며 다른 방문자와 공유되지 않습니다. 기본 두 스타일은 수정 가능하고 삭제는 막습니다. 추가 스타일도 사용 중인 칼럼(휴지통 포함)이 있으면 삭제를 막습니다. 회사 API에서는 서버에서도 사용 여부 검증·권한·동시 수정 제어를 적용해야 합니다.

회사 API 계약:
- `GET /columns/styles` → 스타일 객체 배열 (독자에게 공통 제공)
- `PUT /admin/columns/styles/:id` → 저장된 스타일 객체. 신규 ID 생성도 이 경로로 처리합니다.
- `DELETE /admin/columns/styles/:id` → 204. 기본 스타일 및 사용 중인 스타일 삭제 거부.
- 스타일 필드: id, name, primary/text/muted/surface/insight(HEX), bodySize, headingSize, lineHeight, radius, font(sans/serif), extraCss.
- 칼럼 API는 styleId를 저장·반환합니다. 서버가 처음 구축될 때 law와 travel 기본 스타일도 함께 등록해야 합니다. 운영 HTML/SSR에서도 동일 스타일을 적용해야 합니다.

## 로고 검색 보완

기관명 검색에서 Wikidata 한글/영문 기관 식별 → P154 로고 파일 조회 → 영문명 Commons 보조 검색을 병행합니다. P856 홈페이지가 있으면 /favicon.ico 사이트 아이콘도 별도 후보로 표시합니다. 해당 데이터에 없는 기관이나 정식 로고가 없는 기관도 있으므로 결과를 보장하지 않습니다. 홈페이지 아이콘은 실제 로고와 구분하고 로드 실패 시 적용 버튼을 비활성화합니다.

홈페이지 주소의 사이트 아이콘 후보, 직접 이미지 URL 입력, 웹 이미지 검색 링크도 제공합니다. 직접 입력한 이미지는 URL 참조로 저장하며 미디어 서버에 복제하지 않습니다. 운영 API 모드는 기존 /admin/company/partners/logos 계약을 유지하고 검색 제공자는 서버에서 교체할 수 있습니다.

## 협력사 구분과 다중 선택

협력사 관리의 ‘구분별 보기’에서 기본 구분과 추가 구분을 필터링합니다. ‘구분 추가’는 1~40자 이름을 받고 중복 이름을 막습니다. 새 구분은 파트너 영역에 구분명별로 공개되며, 비어 있으면 독자 화면에 보이지 않습니다. 이미지가 없는 항목은 기관명으로 표시합니다.

카드 체크박스와 ‘현재 목록 전체 선택’으로 다중 선택한 뒤 구분을 한꺼번에 변경합니다. 선택은 검색·구분 필터를 바꿔도 유지하며 필터 밖 선택이 있으면 표시합니다. 일괄 변경은 선택 항목의 group만 바꾸고 이름·이미지·출처·순서는 유지합니다. 데모에서는 하나의 IndexedDB 트랜잭션으로 갱신하여 부분 변경을 방지합니다. 구분 데이터는 기존 회사 콘텐츠 DB의 partner-groups 키에 저장합니다.

회사 API 추가 계약:
- `GET /company/partner-groups` → `[{id,name,layout}]`. 기본 social/partner/directory를 포함합니다.
- `POST /admin/company/partner-groups` → 새 구분 객체 `{id,name,layout:'logos'}` 저장 및 반환.
- `PUT /admin/company/partners/bulk-group` → `{ids:[선택 ID],group:대상 구분 ID}`, 응답은 변경 후 전체 협력사 배열.
- 단건 협력사 저장도 동적 구분 ID를 허용합니다. 서버는 모든 ID와 구분 존재 여부·권한을 검증하고 일괄 변경은 원자적으로 처리해야 합니다. 새 구분으로 기존 이미지 없는 항목을 이동할 수 있습니다.

‘구분 이름 수정’에서 기본·추가 구분명을 수정할 수 있습니다. 변경은 구분 ID와 소속 항목·순서를 유지하며 필터·일괄 변경 목록·카드·독자 화면 구분명에 반영합니다. 회사 API는 `PUT /admin/company/partner-groups/:id`에 구분 객체를 받아 수정 후 객체를 반환하고 빈 이름·40자 초과·다른 구분과 중복 이름을 거부해야 합니다. 회사·기관명 자체는 개별 카드의 수정 기능으로 관리합니다.

## 협력사 복사

카드의 ‘복사’를 누르면 ‘어느 구분으로 복사할까요?’ 창에서 대상 구분을 고릅니다. 원본 이름·이미지·출처를 복사하되 새 id를 부여하고 copiedFromId로 원본 id를 기록합니다. 기존 원본은 유지하고 대상 구분의 끝에 추가합니다. 원본과 복사본의 수정·삭제는 독립적입니다. 복사 후 대상 구분으로 이동해 결과를 보여줍니다.

회사 API: `POST /admin/company/partners/:id/copy`, 본문 `{group:대상 구분 ID}`, 응답은 새 협력사 객체입니다. 서버는 원본·대상 구분 존재 여부와 권한을 확인하고 새 id 및 마지막 order를 원자적으로 배정해야 합니다. 이미지가 없는 기관명 항목도 복사할 수 있으며 독자 화면에는 이름으로 표시합니다.

## 구분 삭제

‘구분 삭제’에서 삭제할 구분을 고릅니다. 빈 구분은 바로 삭제하고, 소속 협력사가 있으면 다른 구분을 필수로 선택해 먼저 이동시킵니다. 원본 협력사 ID·로고·이름·출처·순서는 보존하며 구분 데이터와 협력사 이동을 하나의 트랜잭션으로 저장합니다. 다른 구분이 없으면 먼저 새 구분을 추가하도록 안내합니다. 기본 구분도 삭제할 수 있고, 삭제된 기본 영역은 독자 화면에서 숨깁니다.

회사 API: `DELETE /admin/company/partner-groups/:id`, 본문 `{moveTo:대상 ID 또는 null}`. 응답 200 JSON `{groups:전체 구분 배열,partners:전체 협력사 배열,movedCount:이동 수}`. 기존 협력사가 있으면 유효한 다른 구분을 필수로 검증하고 이동·삭제를 원자적으로 처리해야 합니다. 협력사 자체를 삭제하는 기능이 아닙니다.

협력사 드래그 손잡이는 카드 맨 왼쪽의 아이콘만 표시합니다. 누른 채 이동하면 실제 카드를 고정 좌표로 포인터에 따라 이동하고 원래 자리에 빈칸을 유지합니다. 놓을 위치를 강조하고 마우스·터치 해제 시 순서를 저장합니다. 화면 가장자리에서는 자동 스크롤하며 Esc·포인터 취소·창 포커스 해제 시 원래 상태로 복구합니다. 위·아래 버튼도 유지합니다.

관리자 HTML은 `admin/boot.js`로 진입하여 캐시를 우회한 `admin/release.json`의 버전을 읽고 해당 버전의 JS/CSS를 불러옵니다. 관리자 내부 링크에도 같은 버전 쿼리를 붙여 예전 HTML 캐시로 돌아가는 현상을 방지합니다. 관리자 코드 배포 시 release.json의 version을 갱신하고, 변경된 하위 모듈 import 버전도 함께 올립니다. 이미 열려 있는 예전 페이지는 새 버전 주소로 한 번 진입해야 이 로더를 사용합니다. IndexedDB 저장 데이터는 변경하지 않습니다.

## 함께한 기관·단체 로고 슬라이드

사회공헌의 ‘함께한 기관단체’(공백·구분기호 무관, 함께…기관…단체 이름) 구분을 우선으로 읽어 사회공헌 설명과 활동 사진 사이에 표시합니다. 해당 이름이 없으면 기존 social 구분을 사용합니다. 선택된 구분의 제목은 숨기고, 같은 구분을 하단 파트너 영역에 중복 렌더링하지 않습니다. 기존 social이 다른 구분으로 쓰이는 경우 그 데이터는 하단 구분 영역에 유지합니다.

원형 로고는 PC 5개·767px 이하 3.5개가 보이도록 실제 컨테이너 너비에 맞춰 계산합니다. 원본 배열과 복제 배열의 주기를 일치시켜 무한 이동하며 정지/재생·마우스 올림 정지를 제공합니다. 모션 줄이기 설정에서는 자동 이동 대신 가로 스크롤을 제공합니다. 출처가 필요한 이미지는 별도 출처 목록을 유지합니다.

social HTML은 company-boot.js가 company-release.json 버전을 캐시 우회 조회해 최신 렌더러·CSS를 불러옵니다. 데이터 로드 전 기존 로고가 잠깐 표시되는 것을 막고, 관리자 ‘독자 화면 보기’ 링크도 갱신된 사회공헌 주소로 연결합니다.

## 이름과 독립적인 구분 표시 위치

구분별 displayArea를 `social-carousel` 또는 `partners`로 저장합니다. 독자 렌더러는 구분 이름을 비교하지 않고 이 필드와 구분 ID만 사용합니다. 이름 수정 시 displayArea는 그대로 유지됩니다. 관리자 ‘구분 이름 수정’에서 표시 위치도 별도로 지정할 수 있으며, social-carousel은 한 구분만 지정합니다.

기존 데이터에 displayArea가 없을 때만 1회 마이그레이션합니다. 이전 ‘함께한 기관단체’ 명칭 또는 현재 ‘사회공헌 협력기관’ 명칭에 해당하는 기존 구분을 찾고, 없으면 기존 social을 선택해 표시 위치를 저장합니다. 한 번 저장한 이후에는 이름 변경으로 재판정하지 않습니다. 원형 슬라이드 구분을 삭제한 경우에도 다른 구분을 임의로 재선정하지 않습니다.

회사 API는 구분 객체의 displayArea를 저장·반환하고, 구분 수정에서 social-carousel 선택 시 다른 구분은 partners로 바꾸는 작업을 원자적으로 처리해야 합니다. 기존 데이터 마이그레이션 역시 서버에 적용해야 합니다.

## Codex 개발 수정 바로가기

관리자 사이드 메뉴·상단에 ‘Codex로 개발 수정’ 버튼을 제공합니다. 수정 내용을 적고 개인/회사 연결을 선택할 수 있습니다. 연결 설정은 브라우저별 localStorage `sinor-development-chat`에 저장하며 로그인 정보·토큰·API 키는 저장하지 않습니다.

기본 개인 연결은 이 저장소 originUrl을 지정한 Codex 새 채팅입니다. `codex://new?originUrl=...&prompt=...`는 요청을 입력창에 준비할 뿐 자동 전송하지 않습니다. 기존 수정 채팅 링크를 지정하면 해당 채팅을 열며 요청문을 복사해 붙여넣을 수 있습니다. 공유 보기 링크(/share)는 수정 채팅으로 받지 않습니다.

개인/회사 프로필 선택은 링크·저장소 설정만 바꾸며 ChatGPT 계정이나 워크스페이스를 자동으로 전환하지 않습니다. 회사 Codex 로그인·저장소 권한·로컬 작업공간 연결은 Codex에서 별도로 준비해야 합니다. `originUrl`은 Codex에 등록된 작업공간 중 같은 Git remote를 찾는 방식이며 저장소 권한을 새로 부여하거나 자동 복제하는 기능이 아닙니다. API 기반 자동 실행·자동 커밋·메시지 전송 기능은 아닙니다.

공식 Deep link 문서: https://learn.chatgpt.com/docs/app/commands#deep-links

### 공통 사이트 설정
- 관리자: `/admin/settings/` (사이트 이름·기본 설명·파비콘·공유 이미지), `/admin/settings/footer/` (공통 사업자 정보).
- demo는 `sinor-site-settings:<siteRoot.pathname>` localStorage를 사용합니다. 같은 브라우저·도메인에서만 공유되며 회사 서버에 게시하지 않습니다. 이미지는 최대 5MB data URL로 저장하며 브라우저 저장 한도 초과 시 오류를 표시합니다.
- API 모드 계약: 관리자 `GET/PUT /admin/site/settings`, 공개용 `GET /site/settings`. JSON `{basic:{siteName,description,favicon,image},footer:{company,representative,address,businessNumber,commerce,tourism,marriage,email,phone,copyright}}`. PUT은 전체 객체, 응답은 저장된 객체입니다. 회사 API 구현 시 관리자 쓰기 인증과 이미지 업로드 저장을 연결해야 합니다.
- 공개 페이지는 명시적인 페이지별 SEO 정보를 우선하고 기본 설명·공유 이미지를 보완합니다. 사이트 이름은 `og:site_name`, 파비콘은 탭 아이콘에 연결합니다. 푸터의 로고/내부 링크 구조는 유지하고 사업자 정보만 공통 적용합니다.
- `/admin/statistics/`는 현재 저장된 칼럼 상태별 개수입니다. 방문자·조회 수 집계가 아닙니다.

## 시놀 공통 비주얼 칼럼 에디터

- `/admin/columns/new/` 및 `/admin/columns/edit/?id=...`는 카테고리 → 제목/부제목 → 작성자 → 읽는 시간/날짜 → 본문 순서입니다. 카테고리·작성자는 옆의 추가 버튼에서 생성하고 즉시 선택합니다.
- 글별 ‘법률/여행’ 스타일 선택은 제거했습니다. 본문 공통 스타일은 `columns/content.css`에 있고 관리자/미리보기/독자 화면에서 동일한 클래스를 사용합니다.
- 도구: 본문/H2/H3/H4, 글자 크기/색상, 굵게/기울임/밑줄/가운데줄, 정렬/목록, 인용 4종, 형광펜 4색, SINOR INSIGHT, 행·열 선택 표, 사진/설명/대표이미지 지정, 링크, HTML/CSS 전환입니다.
- 공통 클래스: `sinor-column-quote-label-pink`, `sinor-column-quote-label-blue`, `sinor-column-quote-quote-pink`, `sinor-column-quote-quote-blue`; `sinor-column-highlight-yellow/pink/blue/green`; 기존 `sinor-column-insight*`, `sinor-column-figure` 표/사진도 지원합니다.
- HTML 편집에서 `<style>`과 본문을 붙여넣고 비주얼로 돌아오면 CSS를 본문 안으로 한정해 표시합니다. 실행 스크립트/iframe/외부 CSS 가져오기는 제거하며, 원문 CSS를 별도 SEO 화면에 넣을 필요가 없습니다. 임의의 안전한 클래스와 허용된 인라인 서식을 보존합니다.
- 작성자 저장: 별도 IndexedDB `sinor-column-authors:<siteRoot.pathname>`. `{id,name,affiliation,image}`. 게시글은 `authorId`, `authorProfile` 스냅샷과 기존 `author` 이름을 함께 저장해 독자 화면에 사진·이름·소속을 표시합니다. 소속에 ‘시놀 대표’나 ‘세무회계 열린 · 세무사’처럼 입력합니다. 기존 author/expertName 데이터도 계속 표시합니다.
- 회사 API 계약: `GET /columns/authors`, `POST /admin/columns/authors`, `PUT /admin/columns/authors/:id`. 응답은 작성자 객체(목록은 배열). 작성자 사진은 기존 `/admin/media`를 사용합니다. 칼럼 API는 `authorId`, `authorProfile`, `styleId:'common'`을 저장·반환해야 합니다.
- 회사 API 연결 전에는 관리자 수정/작성자/카테고리가 같은 브라우저에만 저장됩니다. 기존 217개 칼럼 대량 이전은 중단했으며 관련 콘텐츠/이미지는 이 배포에 포함하지 않습니다.
- 디자인 모드 UI, 페이지 생성/복제/정렬, 페이지별 브라우저 라우팅 기능은 사용자 요청으로 제거했습니다. 기존 칼럼 저장소를 초기화하지 않습니다.

### 작성 화면의 관리 모달
카테고리와 작성자의 ‘편집’ 버튼은 전체 목록 관리 모달을 엽니다. 카테고리 이름, 작성자 사진·이름·소속을 수정하고 사용하지 않는 항목을 삭제할 수 있습니다. 저장 즉시 현재 작성 화면의 선택 목록을 갱신하며 입력 중인 제목/본문은 유지합니다. 작성자의 게시글 스냅샷은 해당 글을 저장할 때 갱신합니다. 사용 중인 작성자 삭제는 차단합니다. 회사 API는 `DELETE /admin/columns/authors/:id`에도 사용 여부 검증을 적용하고 성공 시 204 또는 JSON을 반환해야 합니다.

### 전문 HTML/CSS 코드 편집기
CodeMirror 6와 Prettier를 `assets/vendor/code-editor/editor.js`에 함께 번들링합니다. 외부 CDN 요청 없이 구문 색상, 태그 자동 닫기/완성, 줄 번호/접기, Tab 및 줄바꿈 자동 들여쓰기, 붙여넣기 자동 정리를 제공합니다. ‘코드 정리’ 버튼 또는 Shift+Alt+F로 HTML과 `<style>` 안의 CSS를 정돈합니다. 문법 오류가 있거나 정리 중 사용자가 내용을 변경하면 원문을 덮어쓰지 않습니다. CodeMirror의 실제 편집 DOM을 사용하므로 별도 표시층으로 인한 선택 위치 어긋남이 없습니다.

재빌드: `cd tools/code-editor && npm ci && npm run build`. 버전은 package-lock.json으로 고정하며 배포 파일과 LICENSES.json을 함께 보관합니다. 코드 모드의 문서는 기존 textarea 값과 동기화하므로 저장/비주얼 전환 계약을 유지합니다.
