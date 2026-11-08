/* ============================================================
   后会友期 · 性格底色鉴定所 —— 主逻辑（网页报告版）
   ============================================================ */
"use strict";

/* ---------------- 工具 ---------------- */
const $ = (id) => document.getElementById(id);
const LS_TICKET = "hhyq_ticket";
const LS_PROGRESS = "hhyq_progress";

const store = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, v) { try { localStorage.setItem(key, v); } catch (e) {} },
  remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
};

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(name).classList.add("active");
  window.scrollTo(0, 0);
}

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

/* ============================================================
   1. 卡密检票
   ============================================================ */
function initTicket() {
  const input = $("code-input");
  const err = $("code-error");

  if (store.get(LS_TICKET) === "1") {
    enterQuiz();
    return;
  }

  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase().replace(/\s+/g, "");
    err.textContent = "";
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryEnter();
  });
  $("btn-enter").addEventListener("click", tryEnter);

  function tryEnter() {
    const code = input.value.trim().toUpperCase().replace(/\s+/g, "");
    if (!code) {
      err.textContent = "请先输入卡密再检票～";
      input.focus();
      return;
    }
    if (VALID_CODES.indexOf(code) !== -1) {
      store.set(LS_TICKET, "1");
      err.textContent = "";
      enterQuiz();
    } else {
      err.textContent = "卡密无效，请核对后重试";
      input.focus();
      input.select();
    }
  }
}

/* ============================================================
   2. 测试流程
   ============================================================ */
const TOTAL = QUESTIONS.length; // 16
let answers = [];   // 每题所选选项索引
let currentIdx = 0;

function enterQuiz() {
  // 恢复未完成进度
  let saved = null;
  try { saved = JSON.parse(store.get(LS_PROGRESS) || "null"); } catch (e) { saved = null; }
  if (saved && Array.isArray(saved.answers) && saved.answers.length > 0 && saved.answers.length < TOTAL) {
    answers = saved.answers;
    currentIdx = answers.length;
    showScreen("screen-quiz");
    renderQuestion(true);
    return;
  }
  answers = [];
  currentIdx = 0;
  store.remove(LS_PROGRESS);
  showScreen("screen-quiz");
  renderQuestion(true);
}

const CN_NUM = ["一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五","十六"];

function renderQuestion(skipAnim) {
  const q = QUESTIONS[currentIdx];
  const card = $("q-card");

  $("q-current").textContent = currentIdx + 1;
  $("q-meta").textContent = "第" + CN_NUM[currentIdx] + "站";
  $("q-title").textContent = q.text;

  const box = $("q-options");
  box.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "q-option";
    btn.type = "button";
    btn.innerHTML =
      '<span class="opt-letter">' + "ABCD"[i] + "</span>" +
      '<span class="opt-text">' + opt.text + "</span>";
    btn.addEventListener("click", () => pick(i));
    box.appendChild(btn);
  });

  if (!skipAnim) {
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";
  }

  const pct = (currentIdx / TOTAL) * 100;
  $("progress-fill").style.width = pct + "%";
  $("progress-train").style.left = Math.max(2, Math.min(98, pct)) + "%";
}

function pick(optIdx) {
  if (currentIdx >= TOTAL) return;
  answers.push(optIdx);

  const opts = document.querySelectorAll(".q-option");
  opts.forEach((el, i) => { if (i === optIdx) el.classList.add("picked"); });
  opts.forEach((el) => (el.disabled = true));

  setTimeout(() => {
    if (answers.length < TOTAL) {
      currentIdx = answers.length;
      store.set(LS_PROGRESS, JSON.stringify({ answers }));
      renderQuestion();
    } else {
      store.remove(LS_PROGRESS);
      computeResult();
    }
  }, 320);
}

/* ============================================================
   3. 计分引擎（纯人格分）
   ============================================================ */
function computeResult() {
  const guestScores = {};
  const lastIdx = {}; // 每个人格最后出现的题号（并列裁决用）
  Object.keys(PERSONAS).forEach((k) => ((guestScores[k] = 0), (lastIdx[k] = -1)));

  answers.forEach((optIdx, qIdx) => {
    const opt = QUESTIONS[qIdx].options[optIdx];
    guestScores[opt.g] += 2;
    lastIdx[opt.g] = qIdx;
  });

  const ranked = rankGuests(guestScores, lastIdx);
  const main = PERSONAS[ranked[0]];
  const sub = PERSONAS[ranked[1]];

  // 五维：主 80% + 副 20%
  const dims = {};
  DIMS.forEach((d) => {
    dims[d.key] = Math.round(main.dims[d.key] * 0.8 + sub.dims[d.key] * 0.2);
  });

  const ticketNo = "K2026-" + String(Math.floor(Math.random() * 900000) + 100000);

  renderResultPage({ main, sub, dims, ticketNo });
}

/* 排序：分数降序；同分组内按"最后出现的题号"裁决，保证结果由作答本身决定 */
function rankGuests(guestScores, lastIdx) {
  const keys = Object.keys(PERSONAS);
  const sorted = keys.slice().sort((a, b) => guestScores[b] - guestScores[a]);
  const order = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && guestScores[sorted[j]] === guestScores[sorted[i]]) j++;
    const grp = sorted.slice(i, j);
    if (grp.length === 1) order.push(grp[0]);
    else order.push(...grp.slice().sort((a, b) => lastIdx[b] - lastIdx[a]));
    i = j;
  }
  return order;
}

/* ============================================================
   4. 情景解析 —— 从真实作答中挑出最暴露底色的瞬间
   ============================================================ */
function spreadPick(arr, n) {
  if (n <= 0 || arr.length === 0) return [];
  if (arr.length <= n) return arr.slice();
  if (n === 1) return [arr[Math.floor(arr.length / 2)]];
  const out = [];
  const step = (arr.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(arr[Math.round(i * step)]);
  // 去重（防边界碰撞）
  const seen = new Set();
  return out.filter((x) => (seen.has(x.qIdx) ? false : (seen.add(x.qIdx), true)));
}

function pickScenarios(main, sub) {
  const byMain = [], bySub = [], rest = [];
  answers.forEach((optIdx, qIdx) => {
    const g = QUESTIONS[qIdx].options[optIdx].g;
    const item = { qIdx, optIdx, g };
    if (g === main.id) byMain.push(item);
    else if (g === sub.id) bySub.push(item);
    else rest.push(item);
  });

  let picked = spreadPick(byMain, 3);
  if (picked.length < 3) {
    const have = new Set(picked.map((p) => p.qIdx));
    picked = picked.concat(spreadPick(bySub.filter((s) => !have.has(s.qIdx)), 3 - picked.length));
  }
  if (picked.length < 3) {
    const have = new Set(picked.map((p) => p.qIdx));
    picked = picked.concat(spreadPick(rest.filter((s) => !have.has(s.qIdx)), 3 - picked.length));
  }
  return picked.slice(0, 3).sort((a, b) => a.qIdx - b.qIdx);
}

/* ============================================================
   5. 六维雷达图（SVG）
   ============================================================ */
function radarSVG(dims, color) {
  const N = DIMS.length;
  const cx = 250, cy = 176, R = 96;
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (i, r) => {
    const x = cx + r * Math.cos(angle(i));
    const y = cy + r * Math.sin(angle(i));
    return [x.toFixed(1), y.toFixed(1)];
  };

  let svg = '<svg viewBox="0 0 500 352" class="radar-svg" role="img" aria-label="五维友情雷达图">';

  // 网格层
  for (let layer = 3; layer >= 1; layer--) {
    const pts = DIMS.map((_, i) => pt(i, (R * layer) / 3).join(",")).join(" ");
    svg += '<polygon points="' + pts + '" fill="none" stroke="rgba(58,49,38,.16)" stroke-width="1.3"/>';
  }
  // 轴线
  DIMS.forEach((_, i) => {
    const p = pt(i, R);
    svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="rgba(58,49,38,.14)" stroke-width="1.3"/>';
  });
  // 数据多边形
  const dpts = DIMS.map((_, i) => pt(i, (R * dims[DIMS[i].key]) / 100));
  svg += '<polygon points="' + dpts.map((p) => p.join(",")).join(" ") + '" fill="' + hexToRgba(color, .28) + '" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round"/>';
  dpts.forEach((p) => {
    svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.5" fill="' + color + '"/>';
  });
  // 轴标签
  DIMS.forEach((d, i) => {
    const a = angle(i);
    const lx = cx + (R + 30) * Math.cos(a);
    const ly = cy + (R + 30) * Math.sin(a);
    const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : (Math.cos(a) > 0 ? "start" : "end");
    const dy = Math.sin(a) > 0.3 ? 16 : (Math.sin(a) < -0.3 ? 0 : 5);
    svg += '<text x="' + lx.toFixed(1) + '" y="' + (ly + dy).toFixed(1) + '" text-anchor="' + anchor + '" class="radar-label">' + d.label + "</text>";
  });

  svg += "</svg>";
  return svg;
}

/* ============================================================
   6. 结果页渲染（网页报告，模块舒展排布）
   ============================================================ */
function rpModule(title, body, extraCls) {
  return '<div class="rp-card' + (extraCls ? " " + extraCls : "") + '"><div class="rp-mod-title">' + title + "</div>" + body + "</div>";
}

function renderResultPage(result) {
  const { main, sub, dims, ticketNo } = result;

  $("result-title").textContent = main.archetype;
  $("result-sub").textContent = "测出 · " + main.name + " ｜ 隐藏底色：" + sub.name;

  const best = PERSONAS[main.match.id];
  const worst = PERSONAS[main.clash.id];
  const scenarios = pickScenarios(main, sub);

  let html = "";

  /* ---- 车票头 ---- */
  html +=
    '<div class="rp-ticket">' +
      '<div class="rp-ticket-row"><span>开往 · 你的底色站</span><span>NO. ' + ticketNo + "</span></div>" +
      '<div class="rp-ticket-route">' +
        '<span class="rp-station">出发站</span>' +
        '<span class="rp-route-line"><i class="rp-train">🚂</i></span>' +
        '<span class="rp-station rp-to">' + main.guest + "的底色站</span>" +
      "</div>" +
      '<div class="rp-ticket-sub">后会友期号 · 性格底色鉴定所</div>' +
    "</div>";

  /* ---- 人格主卡：徽章 / 金句 / 标签 / 稀有度 ---- */
  html +=
    '<div class="rp-card rp-hero" style="--pc:' + main.color + '">' +
      '<div class="rp-badge">你是「' + main.guest + "」· " + main.name + "</div>" +
      '<p class="rp-quote">「 ' + main.quote + " 」</p>" +
      '<div class="rp-tags">' + main.tags.map((t) => '<span class="rp-tag">#' + t + "</span>").join("") + "</div>" +
      '<p class="rp-rare">仅 ' + main.rarePct + "% 的人测出" + main.name + " · 稀有度拉满</p>" +
    "</div>";

  /* ---- 友情底色解读 ---- */
  html += rpModule("你的友情底色", '<p class="rp-desc">' + main.baseDesc + "</p>");

  /* ---- 剪票虚线 ---- */
  html += '<div class="rp-divider"><span>✂ 检票后请继续阅读</span></div>';

  /* ---- 六维底色图谱 ---- */
  const dimRows = DIMS.map((d) =>
    '<div class="rp-dim-row">' +
      '<span class="rp-dim-label">' + d.label + "</span>" +
      '<span class="rp-dim-track"><i style="width:' + dims[d.key] + "%;background:" + main.color + '"></i></span>' +
      '<b class="rp-dim-val">' + dims[d.key] + "</b>" +
    "</div>"
  ).join("");
  html += rpModule(
    "五维友情图谱",
    radarSVG(dims, main.color) +
    '<div class="rp-dims">' + dimRows + "</div>"
  );

  /* ---- 情景解析（新增） ---- */
  const scenHtml = scenarios.map((s) => {
    const q = QUESTIONS[s.qIdx];
    const opt = q.options[s.optIdx];
    const pg = PERSONAS[s.g];
    return (
      '<div class="rp-scene">' +
        '<div class="rp-scene-head"><span class="rp-scene-station">第' + CN_NUM[s.qIdx] + '站</span>' +
        '<span class="rp-scene-g" style="color:' + pg.color + '">' + pg.name + "选项</span></div>" +
        '<p class="rp-scene-q">' + q.text + "</p>" +
        '<p class="rp-scene-a">你的选择：<b>' + opt.text + "</b></p>" +
        '<p class="rp-scene-reveal">🔍 ' + opt.reveal + "</p>" +
      "</div>"
    );
  }).join("");
  html += rpModule("情景解析", '<p class="rp-mod-note">从你的 16 次作答中，挑出最能暴露友情底色的三个瞬间：</p>' + scenHtml);

  /* ---- 友情相性 ---- */
  html += rpModule(
    "你的友情相性",
    '<div class="rp-match-grid">' +
      '<div class="rp-match-card" style="--pc:' + best.color + '">' +
        '<div class="rp-match-t">✦ 最合拍的旅行搭子</div>' +
        '<div class="rp-match-name">' + best.name + "</div>" +
        '<p class="rp-match-why">' + main.match.why + "</p>" +
      "</div>" +
      '<div class="rp-match-card" style="--pc:' + worst.color + '">' +
        '<div class="rp-match-t">⚠ 最容易闹掰的对象</div>' +
        '<div class="rp-match-name">' + worst.name + "</div>" +
        '<p class="rp-match-why">' + main.clash.why + "</p>" +
      "</div>" +
    "</div>" +
    '<p class="rp-rare-note">✦ ' + main.rareNote + "</p>"
  );

  /* ---- 友情优势 & 雷区 ---- */
  html += rpModule(
    "友情优势 & 雷区",
    '<div class="rp-two-col">' +
      '<div class="rp-list rp-strength"><div class="rp-list-t">✦ 友情优势</div>' +
        main.strengths.map((s) => "<p>· " + s + "</p>").join("") + "</div>" +
      '<div class="rp-list rp-risk"><div class="rp-list-t">⚠ 友情雷区</div>' +
        main.risks.map((s) => "<p>· " + s + "</p>").join("") + "</div>" +
    "</div>"
  );

  /* ---- 友情经营建议 ---- */
  html += rpModule(
    "友情经营建议",
    main.lifeAdvice.map((a) => '<div class="rp-advice"><span class="rp-advice-ico">✦</span><p>' + a + "</p></div>").join("")
  );

  /* ---- 名场面台词 ---- */
  html += '<div class="rp-quoteband">🎤 你的名场面台词：<b>「' + main.sceneLine + "」</b></div>";

  /* ---- 友情总评（压轴） ---- */
  html +=
    '<div class="rp-card rp-summary" style="--pc:' + main.color + '">' +
      '<div class="rp-mod-title">友情总评</div>' +
      '<p class="rp-summary-text">' + main.summary + "</p>" +
      '<div class="rp-summary-stamp">友情已鉴定</div>' +
    "</div>";

  $("result-report").innerHTML = html;
  showScreen("screen-result");
}

/* ============================================================
   7. 重测 / 回顶部
   ============================================================ */
function initResultActions() {
  $("btn-retest").addEventListener("click", () => {
    answers = [];
    currentIdx = 0;
    store.remove(LS_PROGRESS);
    enterQuiz();
  });

  $("btn-back-top").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ============================================================
   启动
   ============================================================ */
initTicket();
initResultActions();
