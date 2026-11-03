const STORAGE_KEY = "miumiu-care-v2";
const SHEET_CONFIG_KEY = "miumiu-sheet-config-v1";
const PENDING_SYNC_KEY = "miumiu-sheet-pending-v1";
const DEFAULT_SHEET_CONFIG = Object.freeze({
  spreadsheetId: "1mH7ED4KA5mIn0XwgV_pLl_OUi0Ae6glOG3XB_3Xb3ME",
  clientId: "1088312332581-7njumujovcs200m601v9n0h46b4ogllj.apps.googleusercontent.com"
});
const today = new Date();
const localDate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const shiftDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDate(date);
};
const monthDate = (daysAgo) => {
  const date = new Date();
  date.setDate(Math.max(1, date.getDate() - daysAgo));
  return localDate(date);
};
const defaultState = {
  cat: { name: "Miu", breed: "Mèo mướp", birthDate: "2025-11-02", weight: 3.8, gender: "Cái" },
  vaccines: [
    { id: "v1", name: "Vắc-xin tổng hợp", date: shiftDate(3), clinic: "Phòng khám thú y Miu Miu", note: "Nhắc bác sĩ kiểm tra sức khỏe trước khi tiêm.", done: false },
    { id: "v2", name: "Tẩy giun định kỳ", date: shiftDate(10), clinic: "Chăm sóc tại nhà", note: "", done: false },
    { id: "v3", name: "Khám sức khỏe định kỳ", date: shiftDate(-25), clinic: "Phòng khám thú y Miu Miu", note: "", done: true }
  ],
  transactions: [
    { id: "t1", title: "Thức ăn hạt", category: "Thức ăn", amount: 320000, date: monthDate(1), type: "expense", note: "" },
    { id: "t2", title: "Cát vệ sinh", category: "Vệ sinh", amount: 185000, date: monthDate(3), type: "expense", note: "" },
    { id: "t3", title: "Khám sức khỏe", category: "Thú y", amount: 250000, date: monthDate(5), type: "expense", note: "Khám định kỳ" },
    { id: "t4", title: "Pate thưởng", category: "Thức ăn", amount: 95000, date: monthDate(7), type: "expense", note: "" }
  ],
  meals: [
    { id: "m1", time: "07:30", title: "Bữa sáng", detail: "Thức ăn hạt · 35 g", emoji: "🌤️", done: false, completedDate: "" },
    { id: "m2", time: "13:00", title: "Bữa trưa", detail: "Pate ướt · 40 g", emoji: "🥫", done: false, completedDate: "" },
    { id: "m3", time: "19:00", title: "Bữa tối", detail: "Thức ăn hạt · 35 g", emoji: "🌙", done: false, completedDate: "" }
  ]
};
let state = loadState();
let activePage = "overview";
let toastTimer;
let sheetAccessToken = null;
let sheetTokenClient = null;
let sheetSyncQueue = Promise.resolve();
let localRevision = 0;
let pendingSheetChanges = localStorage.getItem(PENDING_SYNC_KEY) === "true";
let sheetConfig = loadSheetConfig();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultState);
    const parsed = JSON.parse(saved);
    return {
      cat: { ...defaultState.cat, ...parsed.cat },
      vaccines: Array.isArray(parsed.vaccines) ? parsed.vaccines : defaultState.vaccines,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : defaultState.transactions,
      meals: Array.isArray(parsed.meals) ? parsed.meals : defaultState.meals
    };
  } catch (error) {
    console.error("Không thể đọc dữ liệu chăm sóc mèo đã lưu:", error);
    return structuredClone(defaultState);
  }
}
function loadSheetConfig() {
  try {
    const saved = localStorage.getItem(SHEET_CONFIG_KEY);
    return saved ? { ...DEFAULT_SHEET_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_SHEET_CONFIG };
  } catch (error) {
    console.error("Không thể đọc cấu hình Google Sheets:", error);
    return { ...DEFAULT_SHEET_CONFIG };
  }
}
function persistLocalState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Không thể lưu dữ liệu chăm sóc mèo:", error);
    showToast("Không thể lưu dữ liệu. Sen hãy kiểm tra dung lượng trình duyệt nhé.");
    return false;
  }
}
function setPendingSheetChanges(pending) {
  pendingSheetChanges = pending;
  try {
    if (pending) localStorage.setItem(PENDING_SYNC_KEY, "true");
    else localStorage.removeItem(PENDING_SYNC_KEY);
  } catch (error) {
    console.error("Không thể lưu trạng thái đồng bộ Google Sheets:", error);
  }
}
function setSheetStatus(status, message) {
  const label = document.getElementById("sheet-status-text");
  const dot = document.getElementById("sheet-status-dot");
  label.textContent = message;
  dot.dataset.status = status;
  document.getElementById("sheet-settings-button").title = message;
}
function saveState() {
  if (!persistLocalState()) return;
  localRevision++;
  setPendingSheetChanges(true);
  if (sheetAccessToken && sheetConfig) {
    setSheetStatus("syncing", "Đang đồng bộ...");
    const revision = localRevision;
    const snapshot = JSON.parse(JSON.stringify(state));
    sheetSyncQueue = sheetSyncQueue.catch(() => {}).then(async () => {
      await window.MiuSheets.write(sheetConfig.spreadsheetId, sheetAccessToken, snapshot);
      if (revision === localRevision) {
        setPendingSheetChanges(false);
        setSheetStatus("connected", "Đã đồng bộ Google Sheets");
      }
    }).catch((error) => {
      console.error("Không thể đồng bộ dữ liệu lên Google Sheets:", error);
      setPendingSheetChanges(true);
      setSheetStatus("error", "Đồng bộ lỗi · dữ liệu vẫn lưu trên thiết bị");
      showToast(`Chưa đồng bộ được Sheet: ${error.message}`);
    });
  } else {
    setSheetStatus(sheetConfig ? "pending" : "local", sheetConfig ? "Cần đăng nhập Google" : "Chỉ lưu trên thiết bị");
  }
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function money(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}
function formatDate(value, options = { day: "2-digit", month: "2-digit", year: "numeric" }) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", options).format(new Date(`${value}T00:00:00`));
}
function dateOffset(value) {
  const target = new Date(`${value}T00:00:00`);
  const base = new Date(`${localDate()}T00:00:00`);
  return Math.round((target - base) / 86400000);
}
function shortDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return { day: String(date.getDate()).padStart(2, "0"), month: `TH${date.getMonth() + 1}` };
}
function ageInfo(birthDate) {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (!birthDate || Number.isNaN(birth.getTime())) return { months: 12, label: "1 tuổi" };
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months--;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  const label = years ? `${years} tuổi${remaining ? ` ${remaining} tháng` : ""}` : `${months} tháng tuổi`;
  return { months, label };
}
function estimatedCalories() {
  const weight = Number(state.cat.weight) || 4;
  const months = ageInfo(state.cat.birthDate).months;
  const factor = months < 4 ? 2.5 : months < 12 ? 2 : months >= 120 ? 1.1 : 1.2;
  return Math.round(70 * Math.pow(weight, 0.75) * factor);
}
function stageName(months) {
  if (months < 12) return "Mèo con";
  if (months < 120) return "Trưởng thành";
  return "Mèo lớn tuổi";
}
function monthTransactions() {
  const ym = localDate().slice(0, 7);
  return state.transactions.filter((item) => item.date.startsWith(ym));
}
function expenseTotal(items) {
  return items.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
}
function emptyState(icon, message) {
  return `<div class="empty-state"><span>${icon}</span>${message}</div>`;
}
function refreshCatDetails() {
  const cat = state.cat;
  const age = ageInfo(cat.birthDate).label;
  ["sidebar-cat-name", "header-cat-name", "profile-cat-name"].forEach((id) => { document.getElementById(id).textContent = cat.name; });
  document.getElementById("sidebar-cat-meta").textContent = `${cat.breed} · ${age}`;
  document.querySelectorAll(".cat-name-inline").forEach((el) => { el.textContent = cat.name; });
  document.getElementById("profile-cat-bio").textContent = `${cat.breed} · Thành viên 4 chân của gia đình`;
  document.getElementById("profile-age").textContent = age;
  document.getElementById("profile-weight").textContent = `${Number(cat.weight).toLocaleString("vi-VN")} kg`;
  document.getElementById("profile-gender").textContent = cat.gender || "Chưa cập nhật";
  document.getElementById("nutrition-age").textContent = age;
  document.getElementById("nutrition-weight").textContent = `${Number(cat.weight).toLocaleString("vi-VN")} kg`;
  document.getElementById("nutrition-stage").textContent = stageName(ageInfo(cat.birthDate).months);
  document.getElementById("calorie-target").textContent = estimatedCalories().toLocaleString("vi-VN");
  document.getElementById("nutrition-summary").textContent = `Ước tính cho ${Number(cat.weight).toLocaleString("vi-VN")} kg · ${stageName(ageInfo(cat.birthDate).months).toLowerCase()}.`;
}
function vaccineStatus(item) {
  if (item.done) return { text: "Hoàn thành", className: "done" };
  const offset = dateOffset(item.date);
  if (offset < 0) return { text: "Đã quá hạn", className: "overdue" };
  if (offset === 0) return { text: "Hôm nay", className: "" };
  return { text: offset <= 7 ? `${offset} ngày nữa` : "Sắp tới", className: "" };
}
function renderVaccines() {
  const filter = document.getElementById("vaccine-filter").value;
  const items = [...state.vaccines].sort((a, b) => a.date.localeCompare(b.date)).filter((item) => filter === "all" || (filter === "done" ? item.done : !item.done));
  document.getElementById("vaccine-summary").textContent = `${state.vaccines.filter((item) => !item.done).length} lịch sắp tới · ${state.vaccines.filter((item) => item.done).length} lịch đã hoàn thành`;
  document.getElementById("vaccine-nav-count").style.display = state.vaccines.some((item) => !item.done && dateOffset(item.date) <= 7) ? "block" : "none";
  document.getElementById("vaccine-list").innerHTML = items.length ? items.map((item) => {
    const status = vaccineStatus(item);
    return `<div class="record-row"><div class="record-main"><span class="record-icon">♡</span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.clinic || "Chưa có địa điểm")}</small></span></div><div class="record-cell"><strong>${formatDate(item.date)}</strong><span>${escapeHTML(item.note || "Lịch chăm sóc")}</span></div><div class="record-cell"><span class="status-badge ${status.className}">${status.text}</span></div><div class="record-actions">${item.done ? "" : `<button class="small-action" data-vaccine-done="${escapeHTML(item.id)}">Đã tiêm</button>`}<button class="small-action delete" data-delete-vaccine="${escapeHTML(item.id)}" aria-label="Xóa lịch">×</button></div></div>`;
  }).join("") : emptyState("💉", "Chưa có lịch nào ở đây. Thêm một lịch để sen dễ nhớ nhé!");
}
function renderUpcoming() {
  const items = [...state.vaccines].filter((item) => !item.done).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  document.getElementById("upcoming-list").innerHTML = items.length ? items.map((item) => {
    const date = shortDate(item.date);
    const status = vaccineStatus(item);
    return `<div class="upcoming-item"><span class="calendar-tile"><small>${date.month}</small><strong>${date.day}</strong></span><span class="upcoming-info"><strong>${escapeHTML(item.name)}</strong><small>${formatDate(item.date)} · ${escapeHTML(item.clinic || "Chưa có địa điểm")}</small></span><span class="status-badge ${status.className}">${status.text}</span></div>`;
  }).join("") : emptyState("🐾", "Chưa có lịch chăm sóc sắp tới.");
}
function renderMeals() {
  const meals = state.meals;
  const completed = meals.filter((meal) => meal.completedDate === localDate()).length;
  document.getElementById("meal-progress").innerHTML = `${completed} <small>/ ${meals.length} bữa</small>`;
  const months = ageInfo(state.cat.birthDate).months;
  document.getElementById("meal-plan-label").textContent = months < 6
    ? "Mèo con dưới 6 tháng thường cần 3–4 bữa nhỏ."
    : months < 12
      ? "Mèo con thường cần khoảng 3 bữa nhỏ mỗi ngày."
      : "Có thể chia khẩu phần thành 2–3 bữa nhỏ mỗi ngày.";
  document.getElementById("meal-list").innerHTML = meals.length ? meals.map((meal) => {
    const doneToday = meal.completedDate === localDate();
    return `<div class="meal-row"><span class="meal-time">${escapeHTML(meal.time)}</span><span class="meal-emoji">${escapeHTML(meal.emoji || "🥣")}</span><span class="meal-desc"><strong>${escapeHTML(meal.title)}</strong><small>${escapeHTML(meal.detail || "Bữa ăn của bé")}</small></span><button class="meal-check ${doneToday ? "checked" : ""}" data-meal-toggle="${escapeHTML(meal.id)}" aria-label="${doneToday ? "Đánh dấu chưa ăn" : "Đánh dấu đã ăn"}">${doneToday ? "✓" : "·"}</button></div>`;
  }).join("") : emptyState("🥣", "Chưa có bữa ăn nào. Sen thêm bữa mới cho bé nhé!");
}
function renderTransactions() {
  const filter = document.getElementById("finance-filter").value;
  const items = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).filter((item) => filter === "all" || item.type === filter);
  document.getElementById("transaction-list").innerHTML = items.length ? items.map((item) => `<div class="record-row"><div class="record-main"><span class="record-icon money">${item.type === "income" ? "↙" : "↗"}</span><span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.category)}${item.note ? ` · ${escapeHTML(item.note)}` : ""}</small></span></div><div class="record-cell"><strong>${formatDate(item.date)}</strong><span>${item.type === "income" ? "Khoản thu" : "Chi tiêu"}</span></div><div class="record-cell"><strong style="color:${item.type === "income" ? "#6d9c75" : "#55564f"}">${item.type === "income" ? "+" : "−"}${money(Number(item.amount))}</strong></div><div class="record-actions"><button class="small-action delete" data-delete-transaction="${escapeHTML(item.id)}" aria-label="Xóa giao dịch">×</button></div></div>`).join("") : emptyState("🧾", "Chưa có giao dịch phù hợp.");
}
function renderSummary() {
  const expenses = expenseTotal(monthTransactions());
  const monthlyItems = monthTransactions();
  document.getElementById("month-total").textContent = money(expenses);
  document.getElementById("spend-total").textContent = money(expenses);
  document.getElementById("finance-month-total").textContent = money(expenses);
  document.getElementById("transaction-count").textContent = `${state.transactions.length} khoản`;
  document.getElementById("month-compare").textContent = monthlyItems.length ? `${monthlyItems.length} giao dịch trong tháng này` : "Chưa có giao dịch tháng này";
  renderSpendChart(monthlyItems);
  const next = [...state.vaccines].filter((item) => !item.done && dateOffset(item.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  document.getElementById("next-vaccine-date").textContent = next ? formatDate(next.date, { day: "2-digit", month: "short" }) : "Chưa có";
  document.getElementById("next-vaccine-name").textContent = next ? next.name : "Thêm lịch để tiện theo dõi";
}
function renderSpendChart(items) {
  const totals = [0, 0, 0, 0];
  items.filter((item) => item.type === "expense").forEach((item) => {
    const day = Number(item.date.slice(8, 10));
    const week = Math.min(3, Math.floor((day - 1) / 7));
    totals[week] += Number(item.amount || 0);
  });
  const ceiling = Math.max(500000, Math.ceil(Math.max(...totals) / 500000) * 500000);
  const points = totals.map((total, index) => ({
    x: index * 140,
    y: 108 - (total / ceiling) * 96
  }));
  const line = `M${points.map((point) => `${point.x},${point.y}`).join(" L")}`;
  document.querySelector(".chart-line").setAttribute("d", line);
  document.querySelector(".chart-area").setAttribute("d", `${line} L420,125 L0,125 Z`);
  const last = document.querySelector(".spend-chart circle");
  last.setAttribute("cx", points[points.length - 1].x);
  last.setAttribute("cy", points[points.length - 1].y);
  const labels = document.querySelector(".chart-y-labels");
  labels.innerHTML = `<span>${ceiling >= 1000000 ? `${ceiling / 1000000}tr` : `${ceiling / 1000}k`}</span><span>${ceiling / 2 >= 1000000 ? `${ceiling / 2000000}tr` : `${ceiling / 2000}k`}</span><span>0</span>`;
}
function renderAll() {
  refreshCatDetails();
  renderSummary();
  renderVaccines();
  renderUpcoming();
  renderMeals();
  renderTransactions();
}
function setPage(page) {
  if (!document.getElementById(`page-${page}`)) return;
  activePage = page;
  document.querySelectorAll(".page-view").forEach((el) => el.classList.toggle("active", el.id === `page-${page}`));
  document.querySelectorAll(".nav-link[data-page]").forEach((el) => el.classList.toggle("active", el.dataset.page === page));
  document.getElementById("sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function spreadsheetIdFromInput(value) {
  const input = value.trim();
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input;
}
function connectToGoogleSheets() {
  if (!sheetConfig) {
    openDialog("sheet-settings");
    return;
  }
  if (!window.google?.accounts?.oauth2) {
    setSheetStatus("error", "Không tải được đăng nhập Google");
    showToast("Không tải được Google Sign-In. Kiểm tra kết nối mạng rồi thử lại nhé.");
    return;
  }
  sheetTokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: sheetConfig.clientId,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    callback: (response) => {
      if (response.error || !response.access_token) {
        console.error("Google OAuth không cấp quyền:", response);
        setSheetStatus("error", "Chưa cấp quyền Google Sheets");
        showToast(`Đăng nhập Google thất bại: ${response.error_description || response.error || "không nhận được quyền truy cập"}`);
        return;
      }
      sheetAccessToken = response.access_token;
      void initializeGoogleSheetsSync();
    },
    error_callback: (error) => {
      console.error("Không thể mở cửa sổ Google OAuth:", error);
      setSheetStatus("error", "Không mở được đăng nhập Google");
      showToast("Không mở được cửa sổ đăng nhập Google. Sen hãy cho phép cửa sổ bật lên rồi thử lại.");
    }
  });
  try {
    sheetTokenClient.requestAccessToken({ prompt: "" });
  } catch (error) {
    console.error("Không thể bắt đầu đăng nhập Google:", error);
    setSheetStatus("error", "Không thể bắt đầu đăng nhập");
    showToast(`Không thể bắt đầu đăng nhập Google: ${error.message}`);
  }
}
async function initializeGoogleSheetsSync() {
  setSheetStatus("syncing", "Đang kết nối Google Sheets...");
  try {
    await window.MiuSheets.ensureTabs(sheetConfig.spreadsheetId, sheetAccessToken);
    const remote = await window.MiuSheets.read(sheetConfig.spreadsheetId, sheetAccessToken);
    if (remote.hasData) {
      if (pendingSheetChanges && window.confirm("Có dữ liệu mới chỉ lưu trên thiết bị này. Chọn OK để dùng dữ liệu trên thiết bị và ghi đè các tab trong Google Sheet; chọn Hủy để tải dữ liệu từ Sheet về thiết bị và thay thế dữ liệu chưa đồng bộ.")) {
        await window.MiuSheets.write(sheetConfig.spreadsheetId, sheetAccessToken, state);
      } else {
        state = {
          cat: { ...state.cat, ...(remote.state.cat || {}) },
          vaccines: remote.state.vaccines,
          transactions: remote.state.transactions,
          meals: remote.state.meals
        };
        if (!persistLocalState()) throw new Error("Không thể lưu dữ liệu vừa tải xuống thiết bị.");
        renderAll();
      }
    } else {
      await window.MiuSheets.write(sheetConfig.spreadsheetId, sheetAccessToken, state);
    }
    setPendingSheetChanges(false);
    setSheetStatus("connected", "Đã đồng bộ Google Sheets");
    showToast(remote.hasData ? "Đã kết nối và đồng bộ với Google Sheets." : "Đã lưu dữ liệu hiện tại vào Google Sheets.");
  } catch (error) {
    console.error("Không thể kết nối Google Sheets:", error);
    sheetAccessToken = null;
    setSheetStatus("error", "Kết nối Sheet thất bại");
    showToast(`Chưa kết nối được Google Sheets: ${error.message}`);
  }
}
const field = (name, label, type, value = "", options = {}) => {
  const required = options.required !== false ? "required" : "";
  const min = options.min ? `min="${options.min}"` : "";
  const step = options.step ? `step="${options.step}"` : "";
  const placeholder = options.placeholder ? `placeholder="${escapeHTML(options.placeholder)}"` : "";
  if (type === "select") return `<div class="form-field"><label for="${name}">${label}</label><select id="${name}" name="${name}" ${required}>${options.choices.map(([val, text]) => `<option value="${escapeHTML(val)}" ${val === value ? "selected" : ""}>${escapeHTML(text)}</option>`).join("")}</select></div>`;
  return `<div class="form-field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHTML(value)}" ${min} ${step} ${placeholder} ${required}>${options.hint ? `<p class="form-hint">${options.hint}</p>` : ""}</div>`;
};
function openDialog(kind) {
  const dialog = document.getElementById("app-dialog");
  const title = document.getElementById("dialog-title");
  const eyebrow = document.getElementById("dialog-eyebrow");
  const fields = document.getElementById("dialog-fields");
  document.getElementById("dialog-form").dataset.kind = kind;
  if (kind === "sheet-settings") {
    eyebrow.textContent = "ĐỒNG BỘ DỮ LIỆU RIÊNG TƯ";
    title.textContent = "Kết nối Google Sheets";
    fields.innerHTML = field("spreadsheetId", "Link hoặc ID Google Sheet", "text", sheetConfig.spreadsheetId, { placeholder: "Dán link Google Sheets của sen" })
      + field("clientId", "Google OAuth Client ID", "text", sheetConfig.clientId, { placeholder: "…apps.googleusercontent.com" })
      + `<div class="sheet-setup-note"><strong>Quyền riêng tư</strong><p>App đăng nhập Google và ghi trực tiếp vào Sheet của sen; không gửi dữ liệu qua máy chủ trung gian. Cần bật Google Sheets API và dùng địa chỉ HTTPS hoặc localhost.</p><a href="README.md" target="_blank" rel="noopener">Xem hướng dẫn thiết lập và cài lên iPhone →</a></div>`;
    document.getElementById("dialog-submit-label").textContent = "Đăng nhập & đồng bộ";
  } else if (kind === "vaccine") {
    document.getElementById("dialog-submit-label").textContent = "Lưu thông tin";
    eyebrow.textContent = "SỨC KHỎE CỦA BÉ";
    title.textContent = "Thêm lịch chăm sóc";
    fields.innerHTML = field("name", "Tên mũi tiêm / lịch chăm sóc", "text", "", { placeholder: "VD: Vắc-xin tổng hợp" }) + field("date", "Ngày hẹn", "date", shiftDate(7), { min: localDate() }) + field("clinic", "Phòng khám / địa điểm", "text", "", { required: false, placeholder: "VD: Phòng khám thú y" }) + field("note", "Ghi chú", "text", "", { required: false, placeholder: "Lưu ý cho lần hẹn này" });
  } else if (kind === "transaction") {
    document.getElementById("dialog-submit-label").textContent = "Lưu thông tin";
    eyebrow.textContent = "SỔ THU CHI CỦA SEN";
    title.textContent = "Ghi giao dịch mới";
    fields.innerHTML = field("title", "Tên khoản thu / chi", "text", "", { placeholder: "VD: Mua thức ăn cho bé" }) + field("type", "Loại giao dịch", "select", "expense", { choices: [["expense", "Chi tiêu"], ["income", "Khoản thu"]] }) + field("category", "Danh mục", "select", "Thức ăn", { choices: [["Thức ăn", "Thức ăn"], ["Thú y", "Thú y"], ["Vệ sinh", "Vệ sinh"], ["Đồ chơi", "Đồ chơi"], ["Phụ kiện", "Phụ kiện"], ["Khác", "Khác"]] }) + field("amount", "Số tiền (₫)", "number", "", { min: "1", step: "1", placeholder: "VD: 150000" }) + field("date", "Ngày giao dịch", "date", localDate()) + field("note", "Ghi chú", "text", "", { required: false, placeholder: "Ghi chú thêm (nếu có)" });
  } else if (kind === "meal") {
    document.getElementById("dialog-submit-label").textContent = "Lưu thông tin";
    eyebrow.textContent = "BỮA NGON CỦA BÉ";
    title.textContent = "Thêm bữa ăn";
    fields.innerHTML = field("title", "Tên bữa ăn", "text", "", { placeholder: "VD: Bữa xế" }) + field("time", "Giờ ăn", "time", "16:00") + field("detail", "Món ăn / khẩu phần", "text", "", { placeholder: "VD: Pate ướt · 30 g" });
  } else {
    document.getElementById("dialog-submit-label").textContent = "Lưu thông tin";
    eyebrow.textContent = "THÀNH VIÊN ĐÁNG YÊU NHẤT NHÀ";
    title.textContent = "Chỉnh sửa hồ sơ bé";
    fields.innerHTML = field("name", "Tên gọi ở nhà", "text", state.cat.name) + field("breed", "Giống mèo", "text", state.cat.breed, { placeholder: "VD: Mèo mướp" }) + field("birthDate", "Ngày sinh (ước tính)", "date", state.cat.birthDate, { hint: "Nếu không biết ngày sinh chính xác, sen có thể nhập ngày ước tính." }) + field("weight", "Cân nặng (kg)", "number", state.cat.weight, { min: "0.1", step: "0.1" }) + field("gender", "Giới tính", "select", state.cat.gender, { choices: [["Cái", "Cái"], ["Đực", "Đực"], ["Chưa rõ", "Chưa rõ"]] });
  }
  dialog.showModal();
}
function closeDialog() {
  document.getElementById("app-dialog").close();
}
function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const kind = form.dataset.kind;
  if (kind === "sheet-settings") {
    const spreadsheetId = spreadsheetIdFromInput(data.spreadsheetId);
    const clientId = data.clientId.trim();
    if (!spreadsheetId || !clientId) {
      showToast("Sen nhập link Google Sheet và OAuth Client ID nhé.");
      return;
    }
    sheetConfig = { spreadsheetId, clientId };
    try {
      localStorage.setItem(SHEET_CONFIG_KEY, JSON.stringify(sheetConfig));
    } catch (error) {
      console.error("Không thể lưu cấu hình Google Sheets:", error);
      showToast("Không thể lưu cấu hình. Sen hãy kiểm tra dung lượng trình duyệt nhé.");
      return;
    }
    closeDialog();
    connectToGoogleSheets();
    return;
  }
  if (kind === "vaccine") {
    state.vaccines.push({ id: crypto.randomUUID(), name: data.name.trim(), date: data.date, clinic: data.clinic.trim(), note: data.note.trim(), done: false });
    showToast("Đã thêm lịch chăm sóc cho bé!");
  } else if (kind === "transaction") {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Sen nhập số tiền lớn hơn 0 nhé.");
      return;
    }
    state.transactions.push({ id: crypto.randomUUID(), title: data.title.trim(), category: data.category, amount, date: data.date, type: data.type, note: data.note.trim() });
    showToast("Đã lưu giao dịch!");
  } else if (kind === "meal") {
    state.meals.push({ id: crypto.randomUUID(), time: data.time, title: data.title.trim(), detail: data.detail.trim(), emoji: "🥣", done: false, completedDate: "" });
    state.meals.sort((a, b) => a.time.localeCompare(b.time));
    showToast("Đã thêm bữa ăn vào lịch!");
  } else {
    const weight = Number(data.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      showToast("Sen nhập cân nặng lớn hơn 0 nhé.");
      return;
    }
    state.cat = { name: data.name.trim(), breed: data.breed.trim() || "Mèo", birthDate: data.birthDate, weight, gender: data.gender };
    showToast("Hồ sơ của bé đã được cập nhật!");
  }
  saveState();
  renderAll();
  closeDialog();
}
document.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) { setPage(pageButton.dataset.page); return; }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    if (actionButton.dataset.action === "sheet-settings") openDialog("sheet-settings");
    else openDialog(actionButton.dataset.action.replace("add-", ""));
    return;
  }
  const vaccineDone = event.target.closest("[data-vaccine-done]");
  if (vaccineDone) {
    const item = state.vaccines.find((entry) => entry.id === vaccineDone.dataset.vaccineDone);
    if (item) { item.done = true; saveState(); renderAll(); showToast("Đã cập nhật lịch tiêm hoàn thành."); }
    return;
  }
  const vaccineDelete = event.target.closest("[data-delete-vaccine]");
  if (vaccineDelete) {
    state.vaccines = state.vaccines.filter((item) => item.id !== vaccineDelete.dataset.deleteVaccine);
    saveState(); renderAll(); showToast("Đã xóa lịch chăm sóc.");
    return;
  }
  const transactionDelete = event.target.closest("[data-delete-transaction]");
  if (transactionDelete) {
    state.transactions = state.transactions.filter((item) => item.id !== transactionDelete.dataset.deleteTransaction);
    saveState(); renderAll(); showToast("Đã xóa giao dịch.");
    return;
  }
  const mealToggle = event.target.closest("[data-meal-toggle]");
  if (mealToggle) {
    const meal = state.meals.find((item) => item.id === mealToggle.dataset.mealToggle);
    if (meal) {
      meal.done = meal.completedDate !== localDate();
      meal.completedDate = meal.done ? localDate() : "";
      saveState();
      renderAll();
    }
    return;
  }
  if (event.target.closest("#edit-profile-button")) openDialog("profile");
  if (event.target.closest("#notification-button")) {
    const dueSoon = state.vaccines.filter((item) => !item.done && dateOffset(item.date) >= 0 && dateOffset(item.date) <= 7).length;
    showToast(dueSoon ? `Sen có ${dueSoon} lịch chăm sóc trong 7 ngày tới.` : "Chưa có lịch chăm sóc nào trong 7 ngày tới.");
  }
});
document.getElementById("dialog-form").addEventListener("submit", handleSubmit);
document.getElementById("dialog-close").addEventListener("click", closeDialog);
document.getElementById("dialog-cancel").addEventListener("click", closeDialog);
document.getElementById("vaccine-filter").addEventListener("change", renderVaccines);
document.getElementById("finance-filter").addEventListener("change", renderTransactions);
document.getElementById("menu-toggle").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
document.getElementById("profile-shortcut").addEventListener("click", () => setPage("profile"));
document.getElementById("today-label").textContent = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long" }).format(today);
setSheetStatus(sheetConfig ? "pending" : "local", sheetConfig ? "Cần đăng nhập Google" : "Chỉ lưu trên thiết bị");
renderAll();
window.addEventListener("online", () => {
  if (sheetAccessToken && sheetConfig && pendingSheetChanges) saveState();
});
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("./service-worker.js").catch((error) => {
    console.error("Không thể đăng ký chế độ PWA:", error);
  });
}
