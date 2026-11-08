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

  // 上一题按钮状态：第一站不可回退
  const prevBtn = $("btn-prev");
  if (prevBtn) prevBtn.disabled = currentIdx === 0;
}

let pickTimer = null;

function pick(optIdx) {
  if (currentIdx >= TOTAL) return;
  answers.push(optIdx);

  const opts = document.querySelectorAll(".q-option");
  opts.forEach((el, i) => { if (i === optIdx) el.classList.add("picked"); });
  opts.forEach((el) => (el.disabled = true));

  pickTimer = setTimeout(() => {
    pickTimer = null;
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

/* 回到上一题：丢弃最近一次作答，允许重新选择 */
function goPrev() {
  if (currentIdx === 0) return;
  if (pickTimer) { clearTimeout(pickTimer); pickTimer = null; }
  if (answers.length > currentIdx) {
    answers.length = currentIdx;      // 撤销本题刚点的选择
  } else {
    answers.pop();                    // 丢弃上一题的作答
  }
  currentIdx = answers.length;
  if (currentIdx === 0) store.remove(LS_PROGRESS);
  else store.set(LS_PROGRESS, JSON.stringify({ answers }));
  renderQuestion(true);
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
  lastResult = result;
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

  /* ---- 免责声明 ---- */
  html += '<div class="rp-disclaimer">本测试为综艺《后会友期》主题的娱乐化性格测试，结果仅供参考，不构成任何专业心理测评或建议。人生和友情，请以你的真实感受为准。</div>';

  $("result-report").innerHTML = html;
  showScreen("screen-result");
}

/* ============================================================
   6.5 结果海报生成（Canvas 1080×1920，一键下载）
   ============================================================ */
let lastResult = null;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  let line = "", yy = y;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW) {
      ctx.fillText(line, x, yy);
      line = ch;
      yy += lh;
    } else {
      line += ch;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

const PS = {
  SERIF: '"Noto Serif SC", "SimSun", serif',
  SANS: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  INK: "#3a3126", INK_SOFT: "#7a6c58",
  GREEN: "#2d4a3e", GOLD: "#d89a3d",
  PAPER: "#f6eeda", PAPER_DEEP: "#efe3c8", CARD: "#fbf5e6",
};

async function drawPoster() {
  if (!lastResult) return null;
  const { main, dims, ticketNo } = lastResult;
  const best = PERSONAS[main.match.id];
  const worst = PERSONAS[main.clash.id];

  await document.fonts.ready;

  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "alphabetic";

  /* ---- 背景 ---- */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, PS.PAPER);
  bg.addColorStop(1, PS.PAPER_DEEP);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -80, 20, W / 2, -80, 520);
  glow.addColorStop(0, "rgba(217,154,61,.32)");
  glow.addColorStop(1, "rgba(217,154,61,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 620);

  /* ---- 车票头 ---- */
  const headGrad = ctx.createLinearGradient(0, 0, 0, 130);
  headGrad.addColorStop(0, "#34584a");
  headGrad.addColorStop(1, "#27423a");
  ctx.fillStyle = headGrad;
  ctx.fillRect(0, 0, W, 130);
  ctx.textAlign = "left";
  ctx.fillStyle = "#f3ead2";
  ctx.font = "900 38px " + PS.SERIF;
  ctx.fillText("后会友期号 · 友情底色鉴定所", 60, 80);
  ctx.font = "500 20px " + PS.SANS;
  ctx.fillStyle = "rgba(243,234,210,.6)";
  ctx.textAlign = "right";
  ctx.fillText("PERSONALITY TEST", W - 60, 80);
  ctx.strokeStyle = "rgba(243,234,210,.4)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath(); ctx.moveTo(0, 133); ctx.lineTo(W, 133); ctx.stroke();
  ctx.setLineDash([]);

  /* ---- 大车票 ---- */
  ctx.fillStyle = "rgba(58,49,38,.14)";
  rr(ctx, 60, 172, 960, 156, 20); ctx.fill();
  ctx.fillStyle = PS.CARD;
  rr(ctx, 60, 165, 960, 156, 20); ctx.fill();
  ctx.textAlign = "right";
  ctx.fillStyle = PS.INK_SOFT;
  ctx.font = "500 20px " + PS.SANS;
  ctx.fillText("NO. " + ticketNo, 985, 202);
  ctx.textAlign = "left";
  ctx.fillStyle = PS.INK;
  ctx.font = "900 46px " + PS.SERIF;
  ctx.fillText("出发站", 110, 272);
  ctx.strokeStyle = "rgba(45,74,62,.55)";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath(); ctx.moveTo(285, 258); ctx.lineTo(580, 258); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = "40px " + PS.SANS;
  ctx.textAlign = "center";
  ctx.fillText("🚂", 442, 272);
  ctx.textAlign = "right";
  ctx.fillStyle = PS.GOLD;
  ctx.font = "900 46px " + PS.SERIF;
  ctx.fillText(main.guest + "的友情底色站", 985, 272);
  ctx.textAlign = "center";
  ctx.fillStyle = PS.INK_SOFT;
  ctx.font = "500 22px " + PS.SANS;
  ctx.fillText("后会友期号 · 性格底色鉴定所", 540, 298);

  /* ---- 人格徽章 ---- */
  const badgeText = "你是「" + main.guest + "」· " + main.name;
  ctx.font = "700 34px " + PS.SANS;
  const bw = ctx.measureText(badgeText).width + 88;
  ctx.fillStyle = main.color;
  rr(ctx, W / 2 - bw / 2, 368, bw, 72, 36); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(badgeText, W / 2, 414);

  /* ---- 金句 / 标签 / 稀有度 ---- */
  ctx.fillStyle = PS.INK_SOFT;
  ctx.font = "italic 600 32px " + PS.SERIF;
  ctx.fillText("「 " + main.quote + " 」", W / 2, 500);

  ctx.font = "500 24px " + PS.SANS;
  const gap = 24;
  const tws = main.tags.map((t) => ctx.measureText("#" + t).width + 52);
  const tTotal = tws.reduce((a, b) => a + b, 0) + gap * (main.tags.length - 1);
  let tx = W / 2 - tTotal / 2;
  main.tags.forEach((t, i) => {
    ctx.fillStyle = hexToRgba(main.color, .12);
    rr(ctx, tx, 532, tws[i], 50, 25); ctx.fill();
    ctx.strokeStyle = hexToRgba(main.color, .6);
    ctx.lineWidth = 2.5;
    rr(ctx, tx, 532, tws[i], 50, 25); ctx.stroke();
    ctx.fillStyle = main.color;
    ctx.fillText("#" + t, tx + tws[i] / 2, 566);
    tx += tws[i] + gap;
  });

  ctx.fillStyle = PS.INK_SOFT;
  ctx.font = "500 26px " + PS.SANS;
  ctx.fillText("仅 " + main.rarePct + "% 的人测出" + main.name + " · 稀有度拉满", W / 2, 630);

  /* ---- 剪票虚线 ---- */
  ctx.strokeStyle = "rgba(58,49,38,.3)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 10]);
  ctx.beginPath(); ctx.moveTo(120, 672); ctx.lineTo(W - 120, 672); ctx.stroke();
  ctx.setLineDash([]);

  /* ---- 五维友情图谱（五边形雷达） ---- */
  ctx.fillStyle = PS.GREEN;
  ctx.font = "900 40px " + PS.SERIF;
  ctx.textAlign = "center";
  ctx.fillText("— 五维友情图谱 —", W / 2, 732);

  const cx = W / 2, cy = 960, R = 140, N = DIMS.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];

  for (let layer = 3; layer >= 1; layer--) {
    ctx.strokeStyle = "rgba(58,49,38,.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    DIMS.forEach((_, i) => {
      const p = pt(i, (R * layer) / 3);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath(); ctx.stroke();
  }
  DIMS.forEach((_, i) => {
    const p = pt(i, R);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p[0], p[1]); ctx.stroke();
  });
  ctx.beginPath();
  DIMS.forEach((_, i) => {
    const p = pt(i, (R * dims[DIMS[i].key]) / 100);
    if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
  });
  ctx.closePath();
  ctx.fillStyle = hexToRgba(main.color, .28); ctx.fill();
  ctx.strokeStyle = main.color; ctx.lineWidth = 4; ctx.stroke();
  DIMS.forEach((_, i) => {
    const p = pt(i, (R * dims[DIMS[i].key]) / 100);
    ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, Math.PI * 2);
    ctx.fillStyle = main.color; ctx.fill();
  });
  ctx.font = "600 26px " + PS.SANS;
  ctx.fillStyle = PS.INK;
  DIMS.forEach((d, i) => {
    const a = ang(i);
    const lx = cx + (R + 42) * Math.cos(a);
    const ly = cy + (R + 42) * Math.sin(a);
    ctx.textAlign = Math.abs(Math.cos(a)) < .3 ? "center" : (Math.cos(a) > 0 ? "left" : "right");
    ctx.fillText(d.label, lx, ly + (Math.sin(a) > .3 ? 16 : Math.sin(a) < -.3 ? 0 : 8));
  });

  /* ---- 数值条 ---- */
  let by = 1162;
  DIMS.forEach((d) => {
    ctx.textAlign = "left";
    ctx.fillStyle = PS.INK;
    ctx.font = "500 26px " + PS.SANS;
    ctx.fillText(d.label, 150, by);
    ctx.fillStyle = "rgba(58,49,38,.12)";
    rr(ctx, 420, by - 18, 440, 20, 10); ctx.fill();
    ctx.fillStyle = main.color;
    rr(ctx, 420, by - 18, Math.max((440 * dims[d.key]) / 100, 20), 20, 10); ctx.fill();
    ctx.textAlign = "right";
    ctx.font = "700 27px " + PS.SANS;
    ctx.fillText(String(dims[d.key]), 930, by);
    by += 42;
  });

  /* ---- 友情相性 ---- */
  ctx.strokeStyle = "rgba(58,49,38,.3)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 10]);
  ctx.beginPath(); ctx.moveTo(120, 1372); ctx.lineTo(W - 120, 1372); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = PS.GREEN;
  ctx.font = "900 40px " + PS.SERIF;
  ctx.textAlign = "center";
  ctx.fillText("— 友情相性 —", W / 2, 1420);
  ctx.textAlign = "left";
  ctx.fillStyle = best.color;
  ctx.font = "700 30px " + PS.SERIF;
  ctx.fillText("✦ 最合拍的搭子 · " + best.name, 120, 1470);
  ctx.fillStyle = PS.INK;
  ctx.font = "400 26px " + PS.SANS;
  ctx.fillText(main.match.why, 120, 1508);
  ctx.fillStyle = worst.color;
  ctx.font = "700 30px " + PS.SERIF;
  ctx.fillText("⚠ 最容易闹掰 · " + worst.name, 120, 1554);
  ctx.fillStyle = PS.INK;
  ctx.fillText(main.clash.why, 120, 1592);

  /* ---- 友情总评（深绿卡） ---- */
  ctx.fillStyle = PS.GREEN;
  rr(ctx, 60, 1630, 960, 236, 22); ctx.fill();
  ctx.fillStyle = PS.GOLD;
  ctx.font = "900 32px " + PS.SERIF;
  ctx.textAlign = "center";
  ctx.fillText("— 友情总评 —", W / 2, 1678);
  ctx.fillStyle = "#f3ead2";
  ctx.font = "400 25px " + PS.SANS;
  ctx.textAlign = "left";
  wrapText(ctx, main.summary, 105, 1718, 870, 38);

  /* ---- 底注（含免责声明） ---- */
  ctx.fillStyle = PS.INK_SOFT;
  ctx.font = "500 19px " + PS.SANS;
  ctx.textAlign = "center";
  ctx.fillText("本测试仅供娱乐 · 结果不构成专业心理建议 ｜ 后会友期 · 性格底色鉴定所", W / 2, 1912);

  return canvas;
}

async function savePoster() {
  const btn = $("btn-poster");
  const hint = $("poster-hint");
  try {
    btn.disabled = true;
    hint.textContent = "海报生成中…";
    const canvas = await drawPoster();
    if (!canvas) throw new Error("no-result");
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "后会友期-友情底色海报-" + lastResult.main.guest + ".png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    hint.textContent = "✅ 海报已生成并开始下载（手机端若未弹出，可长按保存图片）";
  } catch (e) {
    hint.textContent = "生成失败，请重试一次";
  } finally {
    btn.disabled = false;
  }
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

  $("btn-prev").addEventListener("click", goPrev);
  $("btn-poster").addEventListener("click", savePoster);
}

/* ============================================================
   启动
   ============================================================ */
initTicket();
initResultActions();
