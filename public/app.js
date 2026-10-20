const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "");
const list = (items, ordered = false) => {
  if (!Array.isArray(items) || !items.length) return null;
  const node = document.createElement(ordered ? "ol" : "ul");
  items.forEach((item) => { const li = document.createElement("li"); li.textContent = esc(item); node.appendChild(li); });
  return node;
};

function animateNumber(node, value, suffix = "") {
  const start = Number(node.dataset.current || 0), end = Math.max(0, Number(value) || 0);
  const duration = 850, startTime = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - startTime) / duration), eased = 1 - (1 - progress) ** 4;
    node.textContent = `${Math.round(start + (end - start) * eased)}${suffix}`;
    if (progress < 1) requestAnimationFrame(tick); else node.dataset.current = String(end);
  };
  requestAnimationFrame(tick);
}

function renderDashboard(items) {
  const total = items.length;
  const counts = { repair: 0, professional: 0, recycle: 0 };
  items.forEach((entry) => {
    const verdict = String(entry.result?.verdict || "").toLowerCase();
    if (Object.hasOwn(counts, verdict)) counts[verdict] += 1;
  });
  const repairRate = total ? Math.round((counts.repair / total) * 100) : 0;
  const keptRate = total ? Math.round(((counts.repair + counts.professional) / total) * 100) : 0;
  animateNumber(document.querySelector('[data-stat="total"]'), total);
  animateNumber(document.querySelector('[data-stat="repair"]'), repairRate, "%");
  animateNumber(document.querySelector('[data-stat="saved"]'), keptRate, "%");
  document.querySelector('[data-progress="repair"]').style.width = `${repairRate}%`;
  document.querySelector('[data-progress="saved"]').style.width = `${keptRate}%`;
  animateNumber($("outlook-total"), total);
  Object.entries(counts).forEach(([key, value]) => animateNumber(document.querySelector(`[data-legend="${key}"]`), value));
  const denominator = Math.max(total, 1);
  const repairAngle = counts.repair / denominator * 100;
  const proAngle = counts.professional / denominator * 100;
  $("outlook-chart").style.setProperty("--repair", `${repairAngle}%`);
  $("outlook-chart").style.setProperty("--pro", `${proAngle}%`);
  $("history-count").textContent = `${total} ${total === 1 ? "SAVED CHECK" : "SAVED CHECKS"}`;

  const chart = $("activity-chart"), today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today); date.setHours(0, 0, 0, 0); date.setDate(today.getDate() - (6 - index));
    return { date, label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date).slice(0, 1), value: 0 };
  });
  items.forEach((entry) => {
    const date = new Date(entry.createdAt); date.setHours(0, 0, 0, 0);
    const day = days.find((candidate) => candidate.date.getTime() === date.getTime());
    if (day) day.value += 1;
  });
  const peak = Math.max(...days.map((day) => day.value), 1);
  chart.replaceChildren(...days.map((day, index) => {
    const group = document.createElement("div"); group.className = "bar-group";
    const value = document.createElement("span"); value.className = "bar-value"; value.textContent = day.value || "";
    const bar = document.createElement("span"); bar.className = `bar${index === 6 ? " today-bar" : ""}`;
    bar.style.height = `${day.value ? Math.max(9, day.value / peak * 46) : 3}px`;
    const label = document.createElement("span"); label.className = "bar-label"; label.textContent = day.label;
    group.append(value, bar, label); return group;
  }));
  $("activity-total").textContent = `${days.reduce((sum, day) => sum + day.value, 0)} / 7`;
}

function addBlock(parent, title, items, ordered = false, extraClass = "") {
  const content = list(items, ordered);
  if (!content) return;
  const block = document.createElement("section"); block.className = `result-block${extraClass ? ` ${extraClass}` : ""}`;
  const heading = document.createElement("h4"); heading.textContent = title;
  block.append(heading, content); parent.appendChild(block);
}

function render(entry) {
  const result = entry.result || {}, card = document.createElement("article"); card.className = "diagnosis-card";
  const top = document.createElement("div"); top.className = "diagnosis-top";
  const verdict = String(result.verdict || "Assessment").toLowerCase();
  const badge = document.createElement("span"); badge.className = `verdict-pill ${verdict}`; badge.textContent = verdict === "professional" ? "Expert repair" : verdict;
  top.appendChild(badge);
  [["Difficulty", result.difficulty], ["Estimated time", result.time]].forEach(([label, value]) => {
    if (!value) return; const pill = document.createElement("span"); pill.className = "meta-pill"; pill.textContent = `${label} · ${value}`; top.appendChild(pill);
  });
  const title = document.createElement("h3"); title.className = "diagnosis-title"; title.textContent = `${esc(entry.device)} diagnosis`;
  const cause = document.createElement("p"); cause.className = "diagnosis-cause"; cause.textContent = esc(result.likely_cause);
  card.append(top, title, cause);

  const confidence = String(result.confidence || "unknown").toLowerCase();
  const confidenceValue = ({ low: "Low", medium: "Medium", high: "High" })[confidence] || "Not rated";
  const confidenceRank = ({ low: 1, medium: 2, high: 3 })[confidence] || 0;
  const metrics = document.createElement("div"); metrics.className = "diagnosis-metrics";
  [["Confidence", confidenceValue], ["Repair route", verdict === "professional" ? "Expert help" : verdict === "recycle" ? "Recycle" : "DIY repair"], ["Next step", result.steps?.length ? `${result.steps.length} guided steps` : "Review the advice"]].forEach(([label, value]) => {
    const metric = document.createElement("div"); metric.className = "result-metric";
    const caption = document.createElement("span"); caption.textContent = label;
    const strong = document.createElement("strong"); strong.textContent = value; metric.append(caption, strong); metrics.appendChild(metric);
  });
  card.appendChild(metrics);
  const confidenceLine = document.createElement("div"); confidenceLine.className = "diagnosis-bottom";
  confidenceLine.append("Assessment confidence");
  const dots = document.createElement("span"); dots.className = "confidence-dots";
  for (let i = 1; i <= 3; i += 1) { const dot = document.createElement("i"); if (i <= confidenceRank) dot.className = "active"; dots.appendChild(dot); }
  confidenceLine.append(dots, document.createTextNode(confidenceValue)); card.appendChild(confidenceLine);

  const columns = document.createElement("div"); columns.className = "result-columns";
  addBlock(columns, "Tools to gather", result.tools);
  addBlock(columns, "Parts to consider", result.parts);
  addBlock(columns, "Repair steps", result.steps, true);
  addBlock(columns, "Safety notes", result.safety, false, "safety-block");
  card.appendChild(columns);
  if (result.disposal) {
    const disposal = document.createElement("section"); disposal.className = "result-block disposal-block";
    const heading = document.createElement("h4"); heading.textContent = "If repair isn’t the right option";
    const copy = document.createElement("p"); copy.textContent = esc(result.disposal); copy.style.cssText = "font-size:9px;color:#748073;margin:0;line-height:1.7";
    disposal.append(heading, copy); card.appendChild(disposal);
  }
  $("out").replaceChildren(card);
  $("results-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadHistory() {
  try {
    const response = await fetch("/api/history");
    if (!response.ok) throw new Error("Could not load history.");
    const items = await response.json();
    renderDashboard(items);
    const box = $("history"); box.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p"); empty.className = "history-empty"; empty.textContent = "Your repair log is ready when you are. Your diagnoses will show up here."; box.appendChild(empty); return;
    }
    items.forEach((item, index) => {
      const card = document.createElement("article"); card.className = "history-item"; card.style.animationDelay = `${Math.min(index, 8) * 35}ms`;
      const row = document.createElement("div"); row.className = "history-row";
      const device = document.createElement("strong"); device.className = "history-device"; device.textContent = esc(item.device);
      const date = document.createElement("span"); date.className = "history-date"; date.textContent = new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      const del = document.createElement("button"); del.className = "delete-item"; del.type = "button"; del.setAttribute("aria-label", `Delete ${esc(item.device)} diagnosis`); del.textContent = "×";
      del.addEventListener("click", async (event) => {
        event.stopPropagation(); del.disabled = true;
        try { const response = await fetch(`/api/history/${encodeURIComponent(item.id)}`, { method: "DELETE" }); if (!response.ok) throw new Error(); await loadHistory(); }
        catch { del.disabled = false; }
      });
      row.append(device, date, del);
      const symptoms = document.createElement("p"); symptoms.className = "history-symptoms"; symptoms.textContent = esc(item.symptoms);
      const path = document.createElement("span"); path.className = `history-path ${String(item.result?.verdict || "").toLowerCase()}`; path.textContent = item.result?.verdict === "professional" ? "Expert repair" : esc(item.result?.verdict || "Assessed");
      card.append(row, symptoms, path); card.addEventListener("click", () => render(item)); box.appendChild(card);
    });
  } catch {
    const box = $("history"); box.replaceChildren();
    const empty = document.createElement("p"); empty.className = "history-empty"; empty.textContent = "History is temporarily unavailable."; box.appendChild(empty);
  }
}

$("today").textContent = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date());
const fileInput = $("image"), uploadZone = document.querySelector(".upload-zone");
fileInput.addEventListener("change", () => { $("file-name").textContent = fileInput.files?.[0]?.name || ""; });
for (const eventName of ["dragenter", "dragover"]) uploadZone.addEventListener(eventName, (event) => { event.preventDefault(); uploadZone.classList.add("drag-over"); });
for (const eventName of ["dragleave", "drop"]) uploadZone.addEventListener(eventName, (event) => { event.preventDefault(); uploadZone.classList.remove("drag-over"); });
uploadZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { $("status").className = "status err"; $("status").textContent = "Choose an image file to attach."; return; }
  const transfer = new DataTransfer(); transfer.items.add(file); fileInput.files = transfer.files; $("file-name").textContent = file.name;
});

$("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("go"), status = $("status");
  button.disabled = true; button.querySelector("span:first-child").textContent = "Looking into it…";
  status.className = "status"; status.textContent = "Checking the symptoms and repair options…";
  try {
    const response = await fetch("/api/diagnose", { method: "POST", body: new FormData(event.currentTarget) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The diagnosis could not be completed.");
    render(data); status.textContent = ""; await loadHistory();
  } catch (error) { status.className = "status err"; status.textContent = error.message || "Something went wrong. Please try again."; }
  finally { button.disabled = false; button.querySelector("span:first-child").textContent = "Get my diagnosis"; }
});

loadHistory();
