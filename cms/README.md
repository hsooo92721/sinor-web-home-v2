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
