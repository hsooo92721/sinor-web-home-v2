# 팝업배너

관리 화면: `/admin/popups/`. 홈 중앙 `#centerShell` 영역의 하단 팝업으로 표시한다.

현재 demo 모드는 IndexedDB에 저장하며 같은 브라우저 홈과 연결한다. 공개 기본 데이터는 `cms/popup-banners.json`이며 초기 배너는 없다. API 모드로 변경하면 아래 계약을 사용한다.

- GET `/admin/popup-banners`: 관리자 전체 설정
- GET `/site/popup-banners`: 공개 설정
- PUT `/admin/popup-banners`: 전체 설정 원자 저장
- 이미지 업로드: 기존 POST `/admin/media` 재사용

응답/저장 구조:
```json
{"layout":{"pcPlacement":"center","pcWidth":360,"pcMaxHeight":600,"mobilePlacement":"bottom"},"orderMode":"fixed","items":[{"id":"uuid","title":"이벤트 이름","image":"https://.../banner.jpg","link":"https://web.sinor.co.kr/hammanna-casting/","newTab":false,"enabled":true,"startAt":"","endAt":"","order":0}]}
```
`orderMode`는 fixed/random. 시작·종료는 ISO 날짜 또는 빈 문자열. 시작 포함, 종료 제외. 공개이면서 기간에 해당하는 배너만 표시하고, random은 표시할 때 중복 없이 섞는다. 기본 정렬은 배열 순서이며 저장 시 order를 다시 부여한다. 서버는 관리자 권한, URL·파일 형식·기간·ID를 검증해야 한다.

검은 배경은 중앙 앱의 화면상 위치/너비로 제한된다. 배경 클릭·닫기·Escape는 동일하게 닫는다. 오늘 하루 숨김은 한국 날짜를 기준으로 다음 자정까지 브라우저에 보관한다. 미리보기 `?popup-preview=1`은 오늘 숨김만 무시하고 공개/기간 조건은 유지한다. 여러 배너는 좌우 버튼·방향키·스와이프로 넘긴다.

성과 보기: demo는 브라우저별 실제 노출·클릭을 집계한다. 팝업을 열 때 배너별 첫 노출만 집계하고 미리보기는 제외한다. API 모드는 POST `/site/popup-banners/{id}/events`에 `{type:"impression"|"click"}`을 보내며, GET `/admin/popup-banners/{id}/metrics` 응답은 `{impressions,clicks,lastAt}` 또는 기록이 없을 때 null이다. 통계 수치를 배너 설정과 분리해 보관한다.

관리 화면은 세로 목록형이다. 상단의 기본 설정 버튼으로 모달을 열어 데스크탑·모바일 배치, PC 중앙 팝업 너비/최대 높이, 지정 순서/랜덤을 저장한다. 데스크탑은 중앙, 모바일 전체(가로 모드 포함)는 하단이 기본값이다. 중앙 배치는 center, 하단은 bottom. 기존 데이터에 layout이 없으면 기본값으로 보완하며 배너는 보존한다. 화면 크기에 맞춰 이미지 비율을 유지하며 축소한다. 여러 배너는 5초마다 자동 전환하고 모바일에서는 화살표를 숨긴다.

팝업 관리 모달은 동일한 좌우 곡률을 적용하고 외곽은 overflow:hidden으로 유지한다. 헤더와 하단 취소/저장 영역은 고정하고 가운데 내용만 세로 스크롤한다. 배너 노출 기간은 날짜 달력과 24시간 시간 선택을 분리하며, 종료일 없음 선택 시 계속 노출한다. 사용자 팝업 닫기 버튼은 최소 80×48px이다.
