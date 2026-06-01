"use strict";

const $ = (id) => document.getElementById(id);
const LS = { key: "jbr_key", model: "jbr_model" };
let KB = null;

/* ---------- 지식베이스 로드 ---------- */
async function loadKB() {
  try {
    const res = await fetch("kb/rules.json", { cache: "no-store" });
    KB = await res.json();
    $("disc").textContent = KB.disclaimer || "";
    $("kbMeta").textContent = `지식베이스 v${KB.version} · 규칙 ${KB.rules.length}개 · 출처: ${KB.source}`;
  } catch (e) {
    $("disc").textContent = "지식베이스를 불러오지 못했습니다. (로컬에서 file:// 로 열면 차단될 수 있어요. 간이 서버나 배포 주소로 여세요.)";
  }
}

/* ---------- 키 저장/복원 ---------- */
function restore() {
  const k = localStorage.getItem(LS.key);
  if (k) { $("apiKey").value = k; $("keyStatus").textContent = "저장된 키 불러옴 ✓"; }
  const m = localStorage.getItem(LS.model);
  if (m) $("model").value = m;
}
function persist() {
  if ($("remember").checked) {
    localStorage.setItem(LS.key, $("apiKey").value.trim());
    localStorage.setItem(LS.model, $("model").value);
  } else {
    localStorage.removeItem(LS.key);
  }
}

/* ---------- 관련 규칙 선별 (키워드 매칭 + 전체 포함) ---------- */
function pickRules(text) {
  // KB가 작으므로 전부 포함하되, 본문에 키워드가 잡히는 규칙을 우선 표시
  const t = text.replace(/\s/g, "");
  return KB.rules.map((r) => {
    const hit = (r.keywords || []).some((kw) => t.includes(kw.replace(/\s/g, "")));
    return { ...r, hit };
  });
}

/* ---------- 조문 자동 분할 ---------- */
// 본문을 제N조(의M) 단위로 쪼개고, 본칙/부칙을 구분한다.
function splitArticles(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const marker = /^\s*(제\s*\d+\s*조(?:\s*의\s*\d+)?)\s*(\([^)]*\))?/;
  const items = [];
  let cur = null, inBuchik = false;
  for (const raw of lines) {
    const ln = raw.trim();
    if (/^부\s*칙/.test(ln)) { if (cur) items.push(cur); cur = null; inBuchik = true; continue; }
    const m = ln.match(marker);
    if (m) {
      if (cur) items.push(cur);
      const num = m[1].replace(/\s+/g, "");
      const titleM = m[2] ? m[2].replace(/[()]/g, "") : "";
      cur = { num, title: titleM, section: inBuchik ? "부칙" : "본칙", body: ln };
    } else if (cur) {
      cur.body += "\n" + ln;
    }
  }
  if (cur) items.push(cur);
  return items;
}

function outlineText(arts) {
  if (!arts.length) return "(자동 분할 실패 — 조문 형태가 아니어서 본문 전체를 기준으로 검토)";
  return arts.map((a) => `- ${a.num}${a.title ? "(" + a.title + ")" : ""} [${a.section}]`).join("\n");
}

/* ---------- 프롬프트 구성 ---------- */
function buildPrompt(kind, title, draft) {
  const rules = pickRules(draft);
  const catName = Object.fromEntries(KB.categories.map((c) => [c.id, c.name]));
  const ruleLines = rules.map((r) =>
    `- [${r.id}] (${catName[r.category]}/${r.severity})${r.hit ? " ★관련" : ""} ${r.title}: ${r.question} (근거: ${r.basis})`
  ).join("\n");
  const arts = splitArticles(draft);
  const bonchik = arts.filter((a) => a.section === "본칙").length;
  const buchik = arts.filter((a) => a.section === "부칙").length;
  const outline = `[자동 분할된 조문 목차 — 본칙 ${bonchik}개·부칙 ${buchik}개. Ⅲ 표는 이 목차의 조문번호를 그대로 사용할 것]\n${outlineText(arts)}`;

  return `당신은 대한민국 지방자치단체의 자치법규(조례·규칙) 및 행정규칙 입안·심사를 담당하는 전문 법제관입니다.
법제처 「자치법규 입안 길라잡이」, 「행정규칙 입안·심사 기준」, 「법령 입안·심사 기준」과 지방자치법·행정기본법·헌법에 근거하여, 아래 초안을 4개 관점(법령 적합성·형식 적정성·내용 타당성·정합성)에서 검토하세요.

[검토 대상]
- 종류: ${kind}
- 제명: ${title || "(미입력)"}
- 본문:
"""
${draft}
"""

${outline}

[검토 체크리스트 — 이 항목들을 근거로 판단할 것. ★관련 표시는 본문에서 키워드가 감지된 항목]
${ruleLines}

[작성 지침]
1. 아래 Markdown 형식을 정확히 따르세요. 표는 | 구분자 사용.
2. 근거 없는 추측은 피하고, 위반·미흡이 의심되면 해당 규칙ID와 근거 법령을 명시하세요.
3. 위험도는 [높음]/[중간]/[낮음]으로 표기하세요.
4. 실제 수정 문구(권고안)를 가능한 한 구체적으로 제시하세요.
5. 한국어 공문체로, 과장 없이 사실 기반으로 작성하세요.
6. Ⅲ. 개별 조문 검토는 위 '조문 목차'의 모든 조문을 빠짐없이 검토하되, 지적사항이 있는 조문만 표에 적으세요.

[출력 형식]
## Ⅰ. 제안 개요
- 목적:
- 주요 내용: (3~5개 불릿)

## Ⅱ. 관점별 검토 의견
### 1) 법령 적합성
(위임근거·위임범위·법률유보 중심. 문제 없으면 "특이사항 없음"이라고 적되 확인한 근거를 1줄)
### 2) 형식 적정성
### 3) 내용 타당성
### 4) 정합성

## Ⅲ. 개별 조문 검토
| 조문 | 쟁점 | 위험도 | 근거(규칙ID·법령) | 수정 권고 |
| --- | --- | --- | --- | --- |
(문제가 된 조문만, 없으면 "지적사항 없음" 행 1개)

## Ⅳ. 종합 검토 의견
- 결론: (수용 / 조건부 수용 / 재검토 권고 중 택1)
- 우선 보완사항: (번호 매긴 1~5개)
`;
}

/* ---------- Gemini 호출 (브라우저 직접, BYOK) ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 429 응답 본문에서 재시도 지연(초)과 한도 종류를 추출
function parse429(err) {
  const details = err?.error?.details || [];
  let retrySec = null, metric = "";
  for (const d of details) {
    if (d["@type"]?.includes("RetryInfo") && d.retryDelay) {
      const m = String(d.retryDelay).match(/(\d+(\.\d+)?)s/);
      if (m) retrySec = Math.ceil(parseFloat(m[1]));
    }
    if (d["@type"]?.includes("QuotaFailure") && d.violations?.length) {
      const id = d.violations[0].quotaId || "";
      if (/PerDay/i.test(id)) metric = "일일(하루) 한도";
      else if (/PerMinute/i.test(id)) metric = "분당 한도";
      else metric = id;
    }
  }
  return { retrySec, metric };
}

async function postGemini(key, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
  };
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function callGemini(key, model, prompt, onWait) {
  let res = await postGemini(key, model, prompt);

  // 429: 서버가 알려준 지연이 짧으면 1회 자동 재시도
  if (res.status === 429) {
    let err = {}; try { err = await res.json(); } catch (_) {}
    const { retrySec, metric } = parse429(err);
    if (retrySec != null && retrySec <= 60) {
      if (onWait) onWait(`사용량 한도(${metric || "분당"})에 걸려 ${retrySec}초 후 자동 재시도합니다…`);
      await sleep((retrySec + 1) * 1000);
      res = await postGemini(key, model, prompt);
    } else {
      const wait = metric.includes("일일")
        ? "오늘의 무료 일일 한도를 모두 사용했습니다. 내일(태평양시 자정 기준) 초기화되거나, 다른 모델을 선택해 보세요."
        : `사용량 한도(${metric || "분당/일일"})를 초과했습니다.${retrySec ? ` 약 ${retrySec}초 후` : " 잠시 후"} 다시 시도하거나, ① 섹션에서 더 가벼운 모델을 선택하세요.`;
      throw new Error(wait);
    }
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.error?.message || msg; } catch (_) {}
    if (res.status === 429) msg = "재시도 후에도 사용량 한도에 걸렸습니다. 1분 정도 기다렸다가 다시 시도하거나, ① 섹션에서 다른 모델을 선택하세요.";
    if (res.status === 400 && /API key/i.test(msg)) msg = "API 키가 올바르지 않습니다. AI Studio에서 다시 확인하세요.";
    if (res.status === 403) msg = "키 권한 오류입니다. AI Studio에서 'Generative Language API'가 사용 설정된 무료 키인지 확인하세요.";
    if (res.status === 404) msg = `모델(${model})을 사용할 수 없습니다. ① 섹션에서 다른 모델을 선택해 보세요.`;
    throw new Error(msg);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) throw new Error("응답이 비어 있습니다. (안전필터 차단 또는 한도 문제일 수 있어요)");
  return text;
}

/* ---------- 아주 작은 Markdown → HTML 렌더러 ---------- */
function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\[높음\]/g, '<span class="badge b-high">높음</span>')
    .replace(/\[중간\]/g, '<span class="badge b-mid">중간</span>')
    .replace(/\[낮음\]/g, '<span class="badge b-low">낮음</span>');
  const lines = md.split("\n");
  let html = "", i = 0, inUl = false;
  const closeUl = () => { if (inUl) { html += "</ul>"; inUl = false; } };
  while (i < lines.length) {
    const ln = lines[i];
    if (/^\s*\|.*\|\s*$/.test(ln)) {                    // 표
      closeUl();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      html += "<table>";
      rows.forEach((r, idx) => {
        if (/^\s*\|[\s:|-]+\|\s*$/.test(r)) return;      // 구분선
        const tag = idx === 0 ? "th" : "td";
        html += "<tr>" + cells(r).map((c) => `<${tag}>${inline(c)}</${tag}>`).join("") + "</tr>";
      });
      html += "</table>";
      continue;
    }
    if (/^###\s+/.test(ln)) { closeUl(); html += `<h4>${inline(ln.replace(/^###\s+/, ""))}</h4>`; i++; continue; }
    if (/^##\s+/.test(ln))  { closeUl(); html += `<h3>${inline(ln.replace(/^##\s+/, ""))}</h3>`; i++; continue; }
    if (/^\s*[-*]\s+/.test(ln)) { if (!inUl) { html += "<ul>"; inUl = true; } html += `<li>${inline(ln.replace(/^\s*[-*]\s+/, ""))}</li>`; i++; continue; }
    if (ln.trim() === "") { closeUl(); i++; continue; }
    closeUl(); html += `<p>${inline(ln)}</p>`; i++;
  }
  closeUl();
  return html;
}

/* ---------- 검토 실행 ---------- */
async function runReview() {
  const key = $("apiKey").value.trim();
  const model = $("model").value;
  const draft = $("draft").value.trim();
  const title = $("title").value.trim();
  const kind = $("kind").value;

  if (!key) { alert("먼저 Gemini API 키를 입력하세요. (무료 발급 링크는 ① 섹션에 있습니다)"); $("apiKey").focus(); return; }
  if (draft.length < 20) { alert("검토할 조례·규칙 본문을 충분히 입력하세요."); $("draft").focus(); return; }

  persist();
  $("resultCard").hidden = false;
  $("report").innerHTML = "";
  $("copyBtn").hidden = $("printBtn").hidden = true;
  const st = $("status"); st.className = "status";
  st.innerHTML = '<span class="spin"></span>검토 중입니다… (보통 10~30초)';
  $("reviewBtn").disabled = true;
  $("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const prompt = buildPrompt(kind, title, draft);
    const out = await callGemini(key, model, prompt, (m) => { st.innerHTML = '<span class="spin"></span>' + m; });
    window._lastReport = out;
    $("report").innerHTML = mdToHtml(out);
    st.textContent = `완료 · 모델 ${model} · ${new Date().toLocaleString("ko-KR")}`;
    $("copyBtn").hidden = $("printBtn").hidden = false;
  } catch (e) {
    st.className = "status err";
    st.textContent = "오류: " + e.message;
  } finally {
    $("reviewBtn").disabled = false;
  }
}

/* ---------- 예시 ---------- */
const SAMPLE = `제1조(목적) 이 조례는 ○○시에 거주하는 청년에게 청년수당을 지급하여 청년의 사회참여를 촉진함을 목적으로 한다.
제2조(정의) "청년"이란 ○○시에 주민등록을 둔 19세 이상 39세 이하인 사람을 말한다.
제3조(지급대상) 시장은 예산의 범위에서 청년에게 월 30만원의 청년수당을 지급한다.
제4조(지급제한) 시장은 부정한 방법으로 수당을 받은 사람에게 100만원 이하의 과태료를 부과한다.
제5조(위원회) 청년수당 지급에 관한 사항을 심의하기 위하여 청년수당심의위원회를 둔다.
부칙
이 조례는 공포한 날부터 시행한다.`;

/* ---------- 이벤트 ---------- */
function init() {
  loadKB(); restore();
  $("draft").addEventListener("input", (e) => $("charCount").textContent = e.target.value.length + "자");
  $("reviewBtn").addEventListener("click", runReview);
  $("sampleBtn").addEventListener("click", () => {
    $("title").value = "○○시 청년수당 지급 조례";
    $("draft").value = SAMPLE;
    $("draft").dispatchEvent(new Event("input"));
  });
  $("apiKey").addEventListener("change", persist);
  $("model").addEventListener("change", persist);
  $("copyBtn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(window._lastReport || ""); $("copyBtn").textContent = "복사됨 ✓"; setTimeout(() => $("copyBtn").textContent = "복사", 1500); } catch (_) {}
  });
  $("printBtn").addEventListener("click", () => window.print());
}
document.addEventListener("DOMContentLoaded", init);
