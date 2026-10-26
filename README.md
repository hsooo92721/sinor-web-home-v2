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

홈 중앙은 Flutter 운영 앱 자체가 아닌 웹 레이아웃 시안입니다. 운영 데이터와 기존 앱의 연결은 개발자가 기존 서비스에 통합해야 합니다. 언론보도는 API 키 없이 구글 뉴스 RSS를 GitHub Actions로 자동 수집합니다(아래 설정 참고). 연혁·채용 정보는 저장된 정적 자료이며 자동 업데이트되지 않습니다. 이메일 문의는 이메일 앱을 여는 방식으로, 접수 서버가 포함되어 있지 않습니다. 지도는 카카오맵 공식 퍼가기 방식으로 인터넷 연결이 필요합니다.

검토용 캡처, 임시 복사본, 압축파일 및 인증정보는 포함하지 않았습니다.

## 공통 푸터 수정

`components/footer.html`을 수정한 뒤 `python3 scripts/sync-footer.py`를 실행하면 홈·회사·채용·정책 등 모든 푸터에 반영됩니다. 페이지별 `<base>`를 고려해 링크를 생성합니다. 공통 스타일은 `footer.css`, 펼침 및 자동 스크롤은 `footer.js`에 있습니다. 앱 다운로드는 기존 운영 사이트를 연결하며, 나머지 메뉴는 이 저장소의 새 페이지로 연결됩니다.

## 언론보도 자동 수집

- 기본 수집원은 구글 뉴스 공개 RSS입니다. API 키·별도 회원가입 없이 실행됩니다.
- 검색어: `"시놀" when:30d`, 한국어·대한민국 뉴스. 최근 30일의 검색 결과를 주기적으로 확인하고 이미 모은 과거 기사는 보존합니다. 구글에 색인된 검색 결과 범위의 수집이며 모든 언론사의 모든 기사를 보장하지 않습니다.
- 하루 두 번 한국시간 09:17 / 18:17 실행 예정입니다. GitHub Actions 일정은 지연될 수 있습니다.
- `시놀로지` 등 다른 단어만 포함된 기사는 제외합니다. 제목/요약의 회사 이름을 검사하지만 동명이인·문맥 판단을 완벽히 보장하지는 않습니다.
- 중복 URL(추적 파라미터 제외) 또는 동일 제목은 추가하지 않습니다. 기존 기사와 수동 썸네일을 보존합니다.
- 신규 기사에는 RSS의 제목·언론사·날짜·기사 연결 URL을 사용합니다. URL은 구글 뉴스 경유 링크일 수 있습니다. 썸네일이 제공되지 않으면 기본 이미지를 사용합니다. 기사 본문이나 이미지는 별도 크롤링하지 않습니다.
- 화면은 `company/news-data.json`을 읽고 날짜순 정렬·연도 필터·8건 단위 페이지 나누기를 적용합니다. 데이터 조회 실패 시 기존 HTML 목록을 유지합니다.
- GitHub Pages에서는 Actions 봇 커밋이 Pages 빌드를 유발하지 않는 점을 고려해 공개 저장소의 raw JSON을 읽습니다. 회사 서버로 이관하면 같은 서버의 `company/news-data.json`을 읽습니다. 회사 서버에는 변경된 JSON을 전달하는 배포 과정 또는 회사 API/배치 연결이 필요합니다.
- 구글 RSS 응답 형식 변경·차단 시 수집 작업이 실패할 수 있습니다. 이때 기존 데이터는 유지하고 Actions에 실패 기록을 남깁니다.

### 실행·설정

- GitHub Actions → Collect Sinor news → Run workflow에서 즉시 수집할 수 있습니다. API 비밀키 등록은 필요 없습니다.
- 로컬 수동 수집: `python3 scripts/collect-news.py` (기본값 구글).
- 데이터 변경 없는 검증: `python3 scripts/collect-news.py --dry-run`.
- 테스트: `python3 -m unittest discover -s tests -p test_news.py`.
- 자동 수집 파일: `.github/workflows/collect-news.yml` / `scripts/collect-news.py`.
- 네이버 공식 API도 선택적으로 지원합니다. `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 환경변수 설정 후 `python3 scripts/collect-news.py --source naver`. 구글 기본 수집에는 이 키를 사용하지 않습니다.
- API 문서: https://developers.naver.com/docs/serviceapi/search/news/news.md
- 수집한 기사 제목·메타·이미지는 JSON에서 수동 보완할 수 있습니다. 같은 URL/제목의 기존 정보는 후속 수집에서 덮어쓰지 않습니다.
