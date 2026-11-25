# 시놀혜택 랜딩페이지 — 개발 전달 문서

2026-11-25 기준 디자인 확정본. 빌드 도구 없는 정적 HTML/CSS/JS 프로토타입이에요.
화면·문구·인터랙션은 이 파일 그대로 옮기고, **서버 연동 부분(아래 3장)만 실제 API로 바꾸면** 돼요.

## 1. 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 페이지 마크업. 섹션 순서: 히어로 → 온유상조 → 아웃핏코드 → 함께 받기 → 나의 혜택(`#my-benefits`) → 자주 묻는 질문·유의사항 → 공용 푸터 |
| `page.css` | 페이지 디자인 (컬러·타이포 토큰은 맨 위 `:root`) |
| `sheet.css` | 신청 창(모바일 바텀시트 / PC 모달)·신청 현황·토스트 기능 스타일. `page.css`가 뒤에서 덮어씀 → **sheet.css 먼저, page.css 나중** 순서 유지 |
| `config.js` | 혜택 조건·가격·약관·동의 문구·설문 문항 등 **콘텐츠/정책 데이터** (`window.SINOR_CONFIG`) |
| `app.js` | 신청 흐름(정보 입력 → 동의), 사진 제출, 설문·포인트, 신청 상태, 하단 고정 버튼, 측정 호출 |
| `analytics.js` | 측정 이벤트 → `window.dataLayer` push (GTM/GA4). 허용 키만 통과시켜 개인정보 원문 차단 |
| `motion.js` | 스크롤 등장, 패럴랙스, FAQ 더 보기, 맨 위로 버튼, 해시 이동(`#my-benefits`) 등 화면 보조 동작. app.js와 독립 |
| `assets/` | 이미지 5개 (아래 표) |
| `docs/` | 디자인 결정 기록(`DESIGN_NOTES.md`), 카피 변경 이력(`COPY.md`) — 참고용 |

### 이미지

| 파일 | 크기 | 쓰는 곳 |
|---|---|---|
| `sinor-logo-white.png` | 1855×440 | 상단바 로고 (흰 글자, 검은 배경용) |
| `kv-gift-black.webp` | 1536×1024 | 히어로 선물 상자 (배경이 검은색인 이미지 — 검은 배경 위에서만 사용) |
| `num-6.webp` | 1254×1254 투명 | 6년 카드 배경 그래픽 (숫자 '6'은 실제 텍스트) |
| `oc-report-lime.webp` | 1536×1024 투명 | 아웃핏코드 스타일 리포트 연출 이미지 |
| `coin-p-front.webp` | 1254×1254 투명 | 함께 받기 포인트 코인 |

### 외부 의존

- 글꼴: Pretendard Variable (jsDelivr CDN) — 사내 정책에 따라 자체 호스팅으로 바꿔도 됨
- 공용 푸터: `/footer.css`, `/footer.js` (`<footer class="app-footer" data-shared-footer>`) — 서비스 루트의 공용 파일을 그대로 참조. 이 묶음에는 들어 있지 않음
- 그 외 라이브러리 없음

## 2. 로컬 실행

```bash
python3 -m http.server 5182
```
→ http://localhost:5182 (공용 푸터 파일은 로컬에 없어 404가 정상)

CSS/JS 링크 뒤 `?v=zb`는 캐시 무효화용 임시 값이에요. 실제 배포 방식(해시 파일명 등)에 맞게 바꿔 주세요.

## 3. 실제 서비스 연동이 필요한 곳 (프로토타입에서 가짜로 처리 중)

| 항목 | 지금 | 바꿔야 할 것 | 위치 |
|---|---|---|---|
| 회원 정보 | `config.js`의 `member`(김시놀) 고정값 | 로그인 세션의 회원 이름·전화·생년월일·성별 (수정 불가 표시) | `config.js` `member` |
| 신청 상태 | 브라우저 `localStorage`(`sinor-benefit-proto-v1`)에 저장 | 서버의 회원별 혜택 상태 조회 | `app.js` `load()` / `save()` |
| 신청 제출 | 1.1초 뒤 성공 처리(전송 없음) | 신청 API 호출, 실패 시 `F.failed` 흐름 그대로 사용 | `app.js` `submit()` — "실제 서비스에서는 여기서 서버 API 호출" 주석 |
| 사진 제출(아웃핏코드) | 1.1초 뒤 성공 처리 | 얼굴·전신 정면 사진 업로드 API, 최대 용량 `config.photos.maxMB`(15MB) | `app.js` 사진 제출 핸들러(`photo_submit`) |
| 설문·포인트 | 설문 완료 시 포인트 지급 '표시'만 | 설문 응답 저장 + 혜택별 500P(최대 1,000P) 즉시 지급 API | `app.js` `submitLater()` 등 |
| 상태 전환 | 테스트 도구로 수동 변경 | 서버 상태: `available` 신청 가능 / `photos_needed` 사진 제출 필요 / `applied` 신청 완료 / `processing` 처리 중 / `delivered` 혜택 제공 완료 / `failed` 확인 필요 | `app.js` `STATUS` |
| 테스트 도구 | 상단 "테스트" 버튼 + 패널(`#proto`) | **배포 전 제거** (버튼 `#proto-open`, 패널 `#proto`, `app.js` 맨 아래 proto 코드) | `index.html`, `app.js` |

### 확인 필요(`tbd`)로 남은 정책 값 — `config.js`

값이 `null`이면 화면에 "확인 필요"로 표시돼요. 확정되면 `value`만 채우면 됩니다.

- `eligibility` 신청 가능 회원 조건
- `links.editProfile` 회원정보 수정 경로
- `points.oncePerMember` 포인트 1인 1회 여부
- `benefits.outfitcode.leadTime` 리포트 발송까지 기간
- `benefits.outfitcode.reportNote` 실제 리포트 구성
- `benefits.onyu.contactFlow` 가입 확인 연락 방식
- 동의 항목 중 온유상조 단독 신청 시 이메일 전달 여부 (`consents` 내 `tbd`)

### 확정된 값

- 문의: 카카오톡 채널 '시놀' 1:1 채팅 `https://pf.kakao.com/_SBhxan/chat` (`config.links.customerCenter.chatUrl`) — 모든 문의 버튼이 이 값을 사용
- 온유상조 가격: 온유프리 290·390·490 = 290만·390만·490만 원(부가세 포함), 약정 가격 6년 유지, 6년 후 자동 해지
- 포인트: 혜택별 설문 1개당 500P, 최대 1,000P, 설문 완료 즉시 지급, 설문은 선택

## 4. 측정 (analytics.js → dataLayer)

- 섹션 노출 `section_view` — `section_id`: `hero` `benefit_onyu` `benefit_outfitcode` `all_benefits` `membership` `my_status` `faq`
- 버튼 클릭 `cta_click` — `cta_id`(페이지 고정):
  `hero_primary` `benefit_onyu` `benefit_outfitcode` `all_bundle` `sticky_bottom` `header_my_benefits` `membership_cost_link`(0원 아래 '비용 보기') `membership_check`('개인정보 제공 내용 보기') `faq_status_link` `notice_contact`(유의사항 '문의하기') `scroll_top`(맨 위로)
- 동적 `cta_id`: `status_board_apply_onyu` 등 `{위치}_{행동}_{혜택}` 형식 (apply / photos / reapply / contact / view)
- 그 밖의 이벤트: `apply_start` `apply_step_view` `apply_selection_change` `apply_field_complete` `apply_validation_error` `apply_submit` `apply_result` `apply_abandon` `apply_complete_view` `consent_change` `consent_all_change` `consent_detail_view` `photo_flow_start` `photo_selected` `photo_submit` `photo_result` `photo_abandon` `survey_answer` `survey_skip` `survey_later_start` `points_earned` `status_view` `benefit_status_change` `benefit_fulfilled` `faq_open` `benefit_page_view`
- 이름·전화·이메일·키·몸무게 원문은 이벤트에 들어가지 않도록 `ALLOWED` 키로 막혀 있음

## 5. 화면 동작 메모

- **반응형 기준**: 모바일 ~767px / 태블릿 768~1023px / PC 1024px~. 콘텐츠 최대 폭 1120px
- **모바일 전용 처리**: 상단은 작은 로고(18px) + '나의 혜택' 버튼만, 히어로 혜택 요약은 핵심 문구만
- **하단 고정 버튼**: 화면에 다른 신청 버튼이 보이면 자동으로 숨김. Safe Area 반영
- **맨 위로 버튼**: 히어로를 지나면 표시, 하단 고정 버튼 높이만큼 자동으로 띄움
- **신청 가능 말풍선**: 아직 신청하지 않은 혜택이 1개 이상일 때만 히어로 버튼 위에 표시
- **신청 창**: 모바일 바텀시트 / PC 가운데 모달(라운드 20px). 혜택을 하나만 고르면 남은 혜택 옆에 '함께 받기' 말풍선
- **바로가기 링크**: `페이지주소#my-benefits` → 나의 혜택으로 바로 이동 (예전 `#my-status`도 지원)
- **모션**: 장식 이미지만 짧게 움직이고 화면 밖이면 정지. `prefers-reduced-motion` 설정 시 전부 정지
- **브라우저**: 최신 Chrome·Safari·Samsung Internet 기준. CSS `:has()` 사용(사파리 15.4+), 미지원 시 일부 강조만 빠지고 기능은 동작
