# 자치법규 자가검토 도우미

법제처 「자치법규 입안 길라잡이」·「행정규칙 입안·심사 기준」·「법령 입안·심사 기준」과 지방자치법·행정기본법·헌법에 근거해, **조례·규칙 초안을 4개 관점(법령 적합성·형식 적정성·내용 타당성·정합성)으로 자가점검**하는 무료 웹서비스입니다.

## 핵심 설계: 완전 무료 + 무한 확장 (시나리오 1)

- **서버·DB 없음**: 순수 정적 파일(HTML/CSS/JS). GitHub Pages·Cloudflare Pages 무료 배포.
- **BYOK(Bring Your Own Key)**: 이용자가 **본인의 무료 Gemini API 키**로 검토를 실행합니다.
  → AI 추론 비용을 운영자가 부담하지 않으므로 **이용자가 1만 명이어도 운영비 0원**.
- **개인정보 안전**: 입력한 조례 내용과 API 키는 운영자 서버를 거치지 않고, 사용자의 브라우저에서 Google로만 직접 전송됩니다. 키는 브라우저 `localStorage`에만 저장.

```
사용자 브라우저 ──(본인 키)──▶ Google Gemini API
       │
       └─ 정적 파일(HTML/JS/rules.json)은 GitHub Pages/Cloudflare Pages에서 무료 호스팅
```

## 파일 구조

```
index.html      화면
style.css       스타일
app.js          로직 (KB 로드 → 프롬프트 구성 → Gemini 호출 → 보고서 렌더)
kb/rules.json   지식베이스 (체크리스트 104개 / 4개 관점) ← 여기만 고치면 검토 기준이 갱신됨
```

## 로컬에서 실행

`file://`로 열면 `rules.json` 로드가 차단되므로 간이 서버로 엽니다.

```bash
cd jachibeop-review-app
python -m http.server 8000
# 브라우저에서 http://localhost:8000
```

## 무료 배포

### 방법 A — GitHub Pages
1. GitHub에 새 저장소 생성 후 이 폴더를 push
   ```bash
   git init && git add . && git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<아이디>/<저장소>.git
   git push -u origin main
   ```
2. 저장소 **Settings → Pages → Source: main / (root)** 선택 → 1~2분 후 `https://<아이디>.github.io/<저장소>/` 공개

### 방법 B — Cloudflare Pages (상업적 이용·대량 트래픽에 유리)
1. dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**
2. 위 GitHub 저장소 선택 → 빌드 설정 **없음(정적)** → Deploy
3. `https://<프로젝트>.pages.dev` 주소 생성. 이후 GitHub에 push할 때마다 자동 재배포.

> 참고: Vercel 무료(Hobby) 플랜은 상업적 사용이 제한될 수 있어, 공공·대중 서비스에는 Cloudflare Pages 또는 GitHub Pages를 권장합니다.

## 검토 기준(지식베이스) 갱신 방법

`kb/rules.json`의 `rules` 배열에 항목을 추가/수정하면 됩니다.

```json
{ "id": "L-09", "category": "legality", "severity": "high",
  "title": "규정 제목", "question": "점검 질문?",
  "basis": "근거 법령·기준", "keywords": ["감지키워드"] }
```

`category`는 `legality`(법령) / `form`(형식) / `substance`(내용) / `coherence`(정합성) 중 하나. 저장 후 push하면 자동 반영됩니다.

## 면책

본 도구는 입법 실무 **자가점검을 돕기 위한 참고용**이며 법적 효력이 있는 심사가 아닙니다. 최종 판단은 법제처·자치법규 담당부서의 정식 검토를 따라야 합니다.
