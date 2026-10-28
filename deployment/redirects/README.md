# 시놀 도메인/Flutter 전환용 URL 보존

이 폴더는 **서버 301 규칙과 누락 검사**를 준비합니다. GitHub Pages에서 생성 파일을 저장하는 것만으로 HTTP 301이 활성화되지는 않습니다. 현재 운영 중인 아임웹 도메인/DNS/서비스는 변경하지 않습니다.

## 현재 준비 범위

- 공식 sitemap.xml에서 기존 페이지 53개와 게시판 목록에서 칼럼 URL·제목 218개를 조사했습니다. 게시글 본문/이미지를 추가 이전하거나 발행하지 않았습니다.
- `manifest.json`의 11개 확인된 페이지 대응과 정책 쿼리 대응은 실행 가능한 규칙입니다. 새 페이지에 대응하지 않는 서비스·이전하지 않은 글은 `legacy-inventory.json`과 generated/pending.json에 남깁니다. 이 주소를 아무 관련 없는 홈/칼럼 목록으로 일괄 전환하지 않습니다.
- 칼럼은 에디터의 ‘기존 글 주소’에 저장합니다. 원문 canonical/og:url이 있는 HTML은 자동 추출합니다. 포함되어 있지 않으면 이전 시 제목이 정확히 하나 일치하는 글의 주소를 가져옵니다. 동일 제목이 여러 개이면 추정하지 않고 직접 입력하도록 합니다. 이 주소는 게시글 ID와 함께 유지하므로 표시 번호가 바뀌어도 목적 URL은 달라지지 않습니다.
- 관리자 칼럼 목록의 ‘이전 URL 내보내기’는 **현재 브라우저의 공개 글**에 등록한 주소를 합친 sinor-redirects.json을 내보냅니다. 비공개/임시저장 글은 새 목적지로 내보내지 않습니다. 내보내기만으로 서버에는 적용되지 않습니다.

## 회사 서버 적용

1. API/DB로 칼럼·작성자·카테고리를 이전합니다. 기존 UUID, 실제 발행일, legacyUrls를 유지합니다. 공개 글만 새 URL에서 실제로 제공해야 합니다.
2. 관리자에서 내보낸 파일로 `node scripts/build-redirects.mjs --manifest /path/sinor-redirects.json`을 실행합니다.
3. Node/Express 서버에서는 resolver.mjs의 `redirectMiddleware(manifest)`를 정적 파일/Flutter 라우터보다 먼저 설치합니다. 이 미들웨어는 실제 HTTP 301 + Location 응답을 보냅니다. 일치하지 않는 URL은 다음 라우터로 넘깁니다.
4. Nginx에서는 generated/nginx-map.conf를 `http {}`에, nginx-server.inc를 운영 도메인의 `server {}` 안에 포함합니다. Flutter 앱 라우팅보다 먼저 적용해야 합니다. HTTPS 인증서와 `sinor.co.kr`/`www.sinor.co.kr` 수신 설정은 운영 환경에 맞게 별도 연결합니다.
5. Flutter 전환 후에도 `/columns/view/?id=<UUID>` 및 나머지 새 사이트 경로를 그대로 수용하거나, manifest의 목적지를 최종 URL로 한 번에 바꿉니다. 새 앱의 실제 라우터에서 해당 페이지가 열려야 합니다. HTML 앱 셸이 모든 잘못된 주소에 200만 반환하는 방식으로 누락을 숨기지 않습니다.

## 아임웹 제거 / DNS 전환 전 필수 확인

`node scripts/build-redirects.mjs --manifest /path/sinor-redirects.json --strict`는 목적지가 없는 주소가 있으면 실패합니다. 남은 페이지/글은 실제 새 대응 페이지를 만들거나, 기존 내용을 보존한 아카이브를 만들어 대응시킨 뒤 처리해야 합니다. 도메인을 먼저 옮겨서 예전 내용을 잃으면 자동으로 복구할 수 없습니다. 모든 옛 URL을 ‘미리 301 활성화 완료’했다고 볼 수 없는 이유입니다.

각 주소가 `옛 URL → 301 → 최종 URL 200`으로 열리는지 확인하고, 새 canonical·메타 정보·sitemap을 최종 도메인으로 출력합니다. www/HTTP 변형도 같은 최종 주소로 연결합니다. 주소 대응/인증서/새 앱 제공을 모두 확인한 뒤 DNS를 전환하고 아임웹을 해제합니다. 301만으로 검색 순위 유지 자체를 보장할 수는 없습니다.

`?bmode=view&idx=123`는 추적 쿼리/q/t 순서와 관계없이 idx로 연결합니다. 등록되지 않은 글을 목록으로 보내지 않습니다. `/#doz_menu_moim` 같은 #조각은 HTTP 서버에 전달되지 않아 301로 구별할 수 없으므로, 새 홈의 legacy-hashes.js가 해당 기존 북마크만 새 소개 페이지로 연결합니다. 이는 서버 301과 별개의 보완입니다.

## URL 조사 갱신 / 검증

- `python3 scripts/collect-legacy-urls.py`: 공개 URL과 제목만 갱신 (본문 이전 아님).
- `node scripts/build-redirects.mjs`: 기본 페이지 규칙/누락 보고 생성.
- 기본 generated 파일에는 브라우저 전용 칼럼이 없습니다. 실제 이전 시 API의 공개 글 또는 관리자 내보내기로 다시 생성해야 합니다.
- 운영 API는 기존 주소의 중복을 DB에서 원자적으로 차단하고 legacyUrls/columnNumber를 저장·반환해야 합니다. 글 번호는 실제 발행일 오름차순의 표시 번호이며 URL 키로 사용하지 않습니다.

참고: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes

## 향후 페이지 관리 구현 시 반드시 반영

사용자가 요청한 [페이지별 기존 URL 입력·수정 및 301 관리 요구사항](../../docs/future-page-management.md)을 따른다. 기존에 만든 페이지와 앞으로 추가할 모든 페이지에 조사된 주소를 자동 입력하고 관리자에서 확인/수정할 수 있게 해야 한다. 페이지 생성·삭제·숨김 UI 자체는 현재 구현 범위가 아니다.
