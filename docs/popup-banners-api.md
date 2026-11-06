# 팝업배너

관리 화면: `/admin/popups/`. 홈 중앙 `#centerShell` 영역의 하단 팝업으로 표시한다.

현재 demo 모드는 IndexedDB에 저장하며 같은 브라우저 홈과 연결한다. 공개 기본 데이터는 `cms/popup-banners.json`이며 초기 배너는 없다. API 모드로 변경하면 아래 계약을 사용한다.

- GET `/admin/popup-banners`: 관리자 전체 설정
- GET `/site/popup-banners`: 공개 설정
- PUT `/admin/popup-banners`: 전체 설정 원자 저장
- 이미지 업로드: 기존 POST `/admin/media` 재사용

응답/저장 구조:
```json
{"orderMode":"fixed","items":[{"id":"uuid","title":"이벤트 이름","image":"https://.../banner.jpg","link":"https://web.sinor.co.kr/hammanna-casting/","newTab":false,"enabled":true,"startAt":"","endAt":"","order":0}]}
```
`orderMode`는 fixed/random. 시작·종료는 ISO 날짜 또는 빈 문자열. 시작 포함, 종료 제외. 공개이면서 기간에 해당하는 배너만 표시하고, random은 표시할 때 중복 없이 섞는다. 기본 정렬은 배열 순서이며 저장 시 order를 다시 부여한다. 서버는 관리자 권한, URL·파일 형식·기간·ID를 검증해야 한다.

검은 배경은 중앙 앱의 화면상 위치/너비로 제한된다. 배경 클릭·닫기·Escape는 동일하게 닫는다. 오늘 하루 숨김은 한국 날짜를 기준으로 다음 자정까지 브라우저에 보관한다. 미리보기 `?popup-preview=1`은 오늘 숨김만 무시하고 공개/기간 조건은 유지한다. 여러 배너는 좌우 버튼·방향키·스와이프로 넘긴다.

성과 보기: demo는 브라우저별 실제 노출·클릭을 집계한다. 팝업을 열 때 배너별 첫 노출만 집계하고 미리보기는 제외한다. API 모드는 POST `/site/popup-banners/{id}/events`에 `{type:"impression"|"click"}`을 보내며, GET `/admin/popup-banners/{id}/metrics` 응답은 `{impressions,clicks,lastAt}` 또는 기록이 없을 때 null이다. 통계 수치를 배너 설정과 분리해 보관한다.

관리 갤러리는 페이지당 9개, PC 3열이며 왼쪽 위 순서 손잡이로 드래그한다. 작은 관리 화면은 2열/1열로 줄어든다. 사용자 PC 팝업은 중앙 영역 가운데에 최대 360px로 표시하며, 실제 이미지 비율과 화면 높이에 맞춰 가로·세로를 함께 줄인다. 모바일은 하단 배치와 좌우 화살표 숨김을 유지한다. 여러 배너는 5초마다 자동 전환하고 직접 넘기면 간격을 다시 시작한다. 사용자 조작·마우스 호버·비활성 탭에서는 자동 전환을 잠시 멈춘다.
