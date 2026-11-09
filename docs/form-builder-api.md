# 입력폼 관리 (2026-11-09)

관리자: `/admin/forms/` · 콘텐츠 → 입력폼.
양식별 고유 ID와 항목별 고유 ID를 유지한다. 향후 디자인모드에서는 양식 ID로 기존 양식을 연결하며, 복사본을 임의로 생성하지 않는다.

## 현재 제공

여러 양식 추가/수정/삭제, 항목 추가/제거/순서 이동, 사진 업로드 제한, 필수값·선택지·로그인 정보 매핑, 공통 렌더러의 실시간 미리보기, 양식별 Slack 메시지 편집.
기본 양식은 기존 시럽인연·함만나 신청폼의 실제 CSS 및 항목 구조를 기준으로 구성한다. 로그인 전/후 미리보기, 주소 2단 선택, 사진 슬롯, 동의 영역 및 하단 신청 버튼을 공통 렌더러에서 제공한다. 기존에 수정한 양식은 편집기의 원본 양식 적용 버튼으로 명시적으로 갱신할 수 있다. 기존 서비스의 전체 신청 페이지나 API를 대체한 것은 아니다.

GitHub Pages demo에서는 같은 브라우저의 IndexedDB에 양식과 메시지 디자인을 저장한다. 실제 접수 데이터는 생성하지 않는다. 웹훅 URL은 demo 저장소에 저장하지 않으며 실제 전송도 하지 않는다.

## 회사 서버 연결

`server/forms-api.mjs`의 `createFormsHandler`는 Node HTTP handler이다. 현재 배포 사이트에 서버가 실행되는 것은 아니다.

```js
const forms = createFormsHandler({
  dataDir: '/private/app-data/forms',
  secretKey: Buffer.from(process.env.FORMS_SECRET_KEY, 'base64'),
  authenticateAdmin: req => companyAuth.isAdmin(req),
  getProfile: req => companyAuth.getVerifiedProfile(req)
});
// 기존 HTTP 서버에서 await forms(req, res); false이면 기존 라우팅 진행
```

- `FORMS_SECRET_KEY`: 서버에서 생성한 고정 32바이트 키. 저장소에 커밋하지 않는다. 웹훅은 AES-256-GCM 암호화 저장, 브라우저에는 설정 여부만 반환한다.
- 회사의 관리자 인증·CSRF·요청 제한·개인정보 보관/삭제 정책을 기존 미들웨어에 연결한다. getProfile은 클라이언트 입력을 신뢰하지 않고 인증된 사용자 정보만 반환한다.
- 브라우저 `SINOR_CMS_CONFIG`에서 기존 CMS와 동일하게 `mode:'api'`, `apiBase`를 설정한다. 운영 연결 전 기존 CMS API들과 함께 준비해야 한다.
- 파일 기반 저장은 단일 Node 인스턴스용이다. 운영 다중 서버에서는 회사 DB/비공개 파일 스토리지로 교체하고 동일 API 계약을 유지한다.
- 테스트 전송은 `[테스트]`와 가상 값만 사용하며 접수 기록을 만들지 않는다.

## API 계약

| 기능 | 메서드/경로 (`/api` 접두사 가능) |
| --- | --- |
| 관리자 양식 목록 | GET `/admin/forms` |
| 양식 저장/삭제 | PUT / DELETE `/admin/forms/:id` |
| 공개 양식 데이터 | GET `/forms/:id` |
| 연동 확인/저장 | GET / PUT `/admin/forms/:id/integration` |
| Slack 테스트 | POST `/admin/forms/:id/integration/test` |
| 접수 목록 | GET `/admin/forms/:id/submissions` |
| 사진 다운로드 (관리자 인증) | GET `/admin/forms/:id/submissions/:entryId/files/:fieldId/:index` |
| 사용자 접수 | POST `/forms/:id/submissions` |

접수 본문: `{requestId, values:{[fieldId]:value}, photos:{[fieldId]:[{name,type,data}]}, sourcePage}`.
사진 data는 이미지 data URL. 요청 전체 32MB 이하. 사진 실제 헤더·형식·용량·개수를 서버에서 검증한다.
requestId는 재시도 동안 동일하게 유지하여 중복 접수를 막는다. 접수 저장 후 Slack을 보내며 실패해도 접수는 유지한다.
프로필 매핑 `name / phone / gender / birthDate / email`; 잠긴 항목은 서버에서 인증 프로필 값으로 덮어쓴다.

`cms/form-renderer.js`의 `mountSavedForm(container, formId, options)`로 저장된 양식을 렌더링할 수 있다. 실제 사용자 페이지 임베딩과 회사 로그인/사진 전송 어댑터는 다음 단계에서 연결한다. 기본 옵션은 미리보기이며 `preview:false,onSubmit`을 명시해야 실제 접수 어댑터를 호출한다.

검증: `node --test tests/forms-api.test.mjs`. 외부 Slack 전송은 mock으로 대체한다.

## 양식 URL 및 이전 주소 (2026-11-09)

관리자 목록 → 주소 설정 또는 편집기 → 주소 설정에서 `slug`, `legacyUrls`를 편집한다. 공개 URL은 `/forms/:slug`이며 URL 변경 시 이전 경로를 자동 보존한다. 다른 양식의 현재/이전 URL과 중복되면 저장하지 않는다.

- GET `/api/forms/resolve?slug=...`: 공개된 양식과 canonical 경로 반환.
- 회사 HTTP 서버에서 `createFormsHandler`를 정적 페이지/404 처리보다 먼저 호출하면 등록된 이전 주소에 HTTP 301 + Location을 반환한다. 기존 URL의 쿼리도 정확히 일치시킨다. absolute 이전 URL은 요청 host까지 같을 때 적용하며, 이전 도메인에서도 이 서버로 연결돼 있어야 한다.
- `/forms/:slug`에는 사용자 폼 HTML을 제공한다. 호스트의 `/cms/config.js`를 회사 API 설정으로 배포해야 하며 관리자 인증 및 사용자 인증/프로필 연동은 회사 서버에서 제공한다.
- GitHub Pages의 404 처리는 같은 브라우저에 저장한 양식을 여는 demo 보조 기능이다. HTTP 301이 아니며 방문자 전체 공유/검색엔진 이전을 보장하지 않는다. 다른 이전 페이지 경로는 Pages에서 자동 처리하지 않는다.
- 신청 페이지는 이전 관리자 변경사항과 동일 저장소/렌더러를 참조한다. demo에서는 접수하지 않으며, API 모드에서는 서버 접수 API에 사진 및 입력값을 전달한다.
