# 시놀 웹사이트 작업본

회사소개, 사회공헌·협력, 연혁, 언론보도, 채용, 광고제휴문의 및 이용정책 5개 페이지의 최신 소스입니다. 이미지·로컬 폰트·Font Awesome 아이콘을 포함합니다.

## GitHub에 올리기

1. 압축을 풉니다.
2. 압축 안의 파일과 폴더를 저장소 최상위에 업로드합니다. `index.html`이 최상위에 있어야 합니다.
3. 웹사이트로 미리 보려면 저장소 Settings → Pages → Deploy from a branch → main → /(root)를 선택합니다.
4. GitHub가 표시하는 Pages 주소로 접속합니다. 하위 경로 링크는 프로젝트 Pages에서도 동작하도록 상대경로로 정리했습니다.

별도의 npm 설치나 빌드가 필요 없는 HTML/CSS/JavaScript 정적 사이트입니다. 로컬에서는 폴더에서 `python3 -m http.server 8775`를 실행한 후 http://127.0.0.1:8775/ 로 접속하세요. 파일을 더블클릭하면 채용 상세 JSON을 읽지 못할 수 있습니다.

## 주요 경로

- `/` : 홈 웹 레이아웃 시안
- `/company/` : 회사소개
- `/company/social/` : 사회공헌·협력
- `/company/history/` : 연혁
- `/company/news/` : 언론보도
- `/recruit/` : 채용
- `/adv/` : 광고제휴문의
- `/policy/terms/` : 서비스 이용약관
- `/policy/privacy/` : 개인정보 처리방침
- `/policy/travel/` : 여행약관
- `/policy/travel-special/` : 여행특별약관
- `/policy/child-safety/` : 아동 안전 표준 정책

## 동작 범위

홈 중앙은 Flutter 운영 앱 자체가 아닌 웹 레이아웃 시안입니다. 운영 데이터와 기존 앱의 연결은 개발자가 기존 서비스에 통합해야 합니다. 언론보도는 네이버 API 키 등록 후 GitHub Actions로 자동 수집합니다(아래 설정 참고). 연혁·채용 정보는 저장된 정적 자료이며 자동 업데이트되지 않습니다. 이메일 문의는 이메일 앱을 여는 방식으로, 접수 서버가 포함되어 있지 않습니다. 지도는 카카오맵 공식 퍼가기 방식으로 인터넷 연결이 필요합니다.

검토용 캡처, 임시 복사본, 압축파일 및 인증정보는 포함하지 않았습니다.

## 공통 푸터 수정

`components/footer.html`을 수정한 뒤 `python3 scripts/sync-footer.py`를 실행하면 홈·회사·채용·정책 등 모든 푸터에 반영됩니다. 페이지별 `<base>`를 고려해 링크를 생성합니다. 공통 스타일은 `footer.css`, 펼침 및 자동 스크롤은 `footer.js`에 있습니다. 앱 다운로드는 기존 운영 사이트를 연결하며, 나머지 메뉴는 이 저장소의 새 페이지로 연결됩니다.

## 언론보도 자동 수집

- 수집: 네이버 공식 뉴스 검색 API에서 `시놀`을 최신순으로 조회합니다. 하루 두 번 한국시간 09:17 / 18:17 예정이며 GitHub 실행은 지연될 수 있습니다.
- `시놀로지` 등 다른 단어만 포함된 기사는 제외합니다. 검색어가 제목이나 요약에 있는지 검사하지만 동명이인·문맥 판단을 완벽히 보장하지는 않습니다.
- 중복 URL(추적 파라미터 제외) 또는 동일 제목은 추가하지 않습니다. 기존 기사와 수동 썸네일을 보존합니다.
- 신규 기사는 제목·네이버 제공 날짜·원문 링크를 수집합니다. 공식 API에 썸네일·언론사명 필드가 없어 신규 기사의 언론사 표시는 원문 도메인, 이미지는 공통 기본 이미지입니다. 기사 본문이나 이미지는 별도 크롤링하지 않습니다.
- 화면은 `company/news-data.json`을 읽고 날짜순 정렬·연도 필터·8건 단위 페이지 나누기를 적용합니다. 데이터 조회 실패 시 기존 HTML 목록을 유지합니다.
- GitHub Pages에서는 Actions 봇 커밋이 Pages 빌드를 유발하지 않는 점을 고려해 공개 저장소의 raw JSON을 읽습니다. 회사 서버로 이관하면 같은 서버의 `company/news-data.json`을 읽습니다. 회사 서버에는 변경된 JSON을 전달하는 배포 과정 또는 회사 API/배치 연결이 필요하며, 단순히 HTML만 옮겨도 회사 서버 데이터까지 자동 갱신되는 것은 아닙니다.

### 최초 설정

1. https://developers.naver.com/apps/#/register 에서 앱을 등록하고 검색 API를 선택합니다.
2. 저장소 Settings → Secrets and variables → Actions → New repository secret에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 두 값을 등록합니다. 코드·HTML·채팅에 키를 넣지 않습니다.
3. 저장소 Actions → Collect Sinor news → Run workflow를 실행합니다.
4. 키가 없으면 수집을 건너뛰고 설정 대기 안내를 남깁니다. 키 등록 전에는 실제 자동 수집이 활성화되지 않습니다.
5. API 오류 시 기존 JSON을 수정하지 않고 작업을 실패 처리합니다. 실패 내역은 Actions에서 확인합니다.

### 개발·운영

- 수동 실행: 환경변수에 두 키를 설정한 뒤 `python3 scripts/collect-news.py`.
- 테스트: `python3 -m unittest discover -s tests -p test_news.py`.
- 자동 수집 파일: `.github/workflows/collect-news.yml` / `scripts/collect-news.py`.
- 필요하면 등록한 기사 제목·메타·이미지를 JSON에서 수동 보완할 수 있습니다. 같은 URL/제목의 기존 정보는 후속 수집에서 덮어쓰지 않습니다.
- 데이터 원문: https://developers.naver.com/docs/serviceapi/search/news/news.md
