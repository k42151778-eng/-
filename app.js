// ============================================================
// KHALIL ACCOUNTING — app.js
// المنطق الكامل للتطبيق
// ============================================================

const CURRENCY = "₪";

let DB = {
  user: { name: "مستخدم", role: "مدير", email: "" },
  company: { name: "KHALIL ACCOUNTING", currency: "₪", tax: 0 },
  customers: [],
  invoices: []
};

let editingInvoiceId  = null;
let editingCustomerId = null;
let resetUserIndex    = -1;

// ===================== DB / Auth Helpers =====================

function getCurrentUserEmail() {
  return sessionStorage.getItem("ka_email") || "admin@khalil.com";
}

function getDBKey() {
  const email = getCurrentUserEmail().toLowerCase().trim();
  return "khalil_accounting_db_" + email;
}

function loadDB() {
  const email = getCurrentUserEmail().toLowerCase().trim();
  const key   = getDBKey();
  const saved = localStorage.getItem(key);

  if (saved) {
    try {
      DB = JSON.parse(saved);
      if (!DB.customers) DB.customers = [];
      if (!DB.invoices)  DB.invoices  = [];
    } catch(e) { console.error("DB parse error", e); }
  } else {
    const userName = sessionStorage.getItem("ka_name")    || "مستخدم جديد";
    const userComp = sessionStorage.getItem("ka_company") || "شركتي";
    DB = {
      user:     { name: userName, role: "مدير", email },
      company:  { name: userComp, currency: "₪", tax: 0 },
      customers: [],
      invoices:  []
    };
    saveDB();
  }
}

function saveDB() {
  localStorage.setItem(getDBKey(), JSON.stringify(DB));
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem("ka_users") || "[]"); }
  catch(e) { return []; }
}

function saveUsers(users) {
  localStorage.setItem("ka_users", JSON.stringify(users));
}

// ===================== Formatting =====================

function fmt(n) {
  return new Intl.NumberFormat("ar-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}
function fmtCurr(n) { return `${CURRENCY} ${fmt(n)}`; }
function fmtDate(d) {
  if (!d) return "-";
  try { return new Intl.DateTimeFormat("ar-IL", { year:"numeric", month:"short", day:"numeric" }).format(new Date(d)); }
  catch(e) { return d; }
}
function today()    { return new Date().toISOString().split("T")[0]; }
function genId(arr) { return arr && arr.length ? Math.max(...arr.map(i=>i.id)) + 1 : 1; }

// ===================== UI Helpers =====================

function statusBadge(status) {
  const map = { "مدفوعة": "badge-green", "غير مدفوعة": "badge-navy", "متأخرة": "badge-red", "جزئية": "badge-gold" };
  return `<span class="badge ${map[status] || "badge-gray"}">${status || "غير مدفوعة"}</span>`;
}

function showToast(msg, type = "success") {
  const icons = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type] || "ℹ️"}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function openModal(id)  { const m = document.getElementById(id); if (m) m.classList.add("active"); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove("active"); }
function confirmAction(msg, cb) { if (confirm(msg)) cb(); }

function togglePass(id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === "password" ? "text" : "password";
}

function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("open");
  document.getElementById("sidebar-overlay")?.classList.toggle("open");
}

// ===================== Auth =====================

function checkAuth() {
  const auth      = sessionStorage.getItem("ka_auth");
  const screenAuth = document.getElementById("screen-auth");
  const screenApp  = document.getElementById("screen-app");
  const bottomNav  = document.getElementById("bottom-nav");

  if (!auth) {
    screenAuth.style.display = "flex";
    screenApp.style.display  = "none";
    bottomNav.style.display  = "none";
    showAuthBox("login");
    renderLoginHint();
  } else {
    screenAuth.style.display = "none";
    screenApp.style.display  = "flex";
    bottomNav.style.display  = "block";
    loadDB();
    updateAppUserInfo();
    switchView("dashboard");
  }
}

function showAuthBox(box) {
  document.getElementById("box-login").style.display    = box === "login"    ? "block" : "none";
  document.getElementById("box-register").style.display = box === "register" ? "block" : "none";
  document.getElementById("auth-left-quote").textContent = box === "login"
    ? "إدارة مالية ذكية تبدأ من هنا"
    : "لوحة تحكم خاصة وجديدة كلياً لشركتك";
}

function renderLoginHint() {
  const users = getUsers();
  const hintEl = document.getElementById("login-users-hint");
  if (users.length > 0) {
    hintEl.style.display = "block";
    hintEl.innerHTML = "👤 الحسابات المسجلة:<br>" +
      users.map(u => `<strong>${u.username || u.email}</strong> — ${u.name}`).join("<br>");
  } else {
    hintEl.style.display = "none";
  }
}

function handleLogin(e) {
  e.preventDefault();
  const inputUser = document.getElementById("login-email").value.trim();
  const pass      = document.getElementById("login-pass").value;

  if (!inputUser || !pass) { showToast("يرجى إدخال اسم المستخدم وكلمة المرور", "error"); return; }

  const users = getUsers();
  const found = users.find(u => 
    ((u.username && u.username.toLowerCase() === inputUser.toLowerCase()) || 
     (u.email && u.email.toLowerCase() === inputUser.toLowerCase())) && 
    u.password === pass
  );
  const isAdmin = (inputUser.toLowerCase() === "admin@khalil.com" || inputUser.toLowerCase() === "admin") && pass === "123456";

  if (!found && !isAdmin) { showToast("اسم المستخدم أو كلمة المرور غير صحيحة", "error"); return; }

  const userName = found ? (found.name || found.username) : "Admin";
  const userComp = found ? (found.company || "KHALIL ACCOUNTING") : "KHALIL ACCOUNTING";
  const userRole = found ? (found.role || "مدير") : "مدير";
  const userKey  = found ? (found.username || found.email) : inputUser;

  sessionStorage.setItem("ka_auth",    "1");
  sessionStorage.setItem("ka_email",   userKey);
  sessionStorage.setItem("ka_name",    userName);
  sessionStorage.setItem("ka_company", userComp);
  sessionStorage.setItem("ka_role",    userRole);

  showToast(`مرحباً ${userName}! جاري فتح لوحة التحكم...`, "success");
  setTimeout(() => checkAuth(), 500);
}

function handleRegister(e) {
  e.preventDefault();
  const name    = document.getElementById("reg-name").value.trim();
  const company = document.getElementById("reg-company").value.trim() || "شركتي";
  const email   = document.getElementById("reg-email").value.trim();
  const pass    = document.getElementById("reg-pass").value;
  const pass2   = document.getElementById("reg-pass2").value;

  if (!name)           { showToast("أدخل الاسم الكامل", "error"); return; }
  if (!email)          { showToast("أدخل البريد الإلكتروني أو رقم الهاتف", "error"); return; }
  if (pass.length < 6) { showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error"); return; }
  if (pass !== pass2)  { showToast("كلمتا المرور غير متطابقتين", "error"); return; }

  const users = getUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    showToast("هذا البريد أو الرقم مسجل بالفعل", "error"); return;
  }

  users.push({ id: Date.now(), name, company, email, password: pass, role: "مدير", createdAt: new Date().toISOString() });
  saveUsers(users);

  const cleanDB = {
    user:     { name, role: "مدير", email },
    company:  { name: company, currency: "₪", tax: 0 },
    customers: [],
    invoices:  []
  };
  localStorage.setItem("khalil_accounting_db_" + email.toLowerCase(), JSON.stringify(cleanDB));

  sessionStorage.setItem("ka_auth",    "1");
  sessionStorage.setItem("ka_email",   email);
  sessionStorage.setItem("ka_name",    name);
  sessionStorage.setItem("ka_company", company);
  sessionStorage.setItem("ka_role",    "مدير");

  showToast("تم إنشاء حسابك بنجاح! مرحباً بك", "success");
  setTimeout(() => checkAuth(), 600);
}

function logout() {
  ["ka_auth","ka_email","ka_name","ka_company","ka_role"].forEach(k => sessionStorage.removeItem(k));
  checkAuth();
}

// ===================== Reset Password =====================

function openResetModal() {
  resetUserIndex = -1;
  ["reset-email","reset-new-pass","reset-confirm-pass"].forEach(id => document.getElementById(id).value = "");
  ["reset-err1","reset-err2"].forEach(id => document.getElementById(id).style.display = "none");
  goResetStep(1);
  openModal("modal-reset");
}

function goResetStep(s) {
  document.querySelectorAll(".reset-step").forEach(el => el.classList.remove("active"));
  document.getElementById("reset-step" + s).classList.add("active");
}

function verifyResetEmail() {
  const email = document.getElementById("reset-email").value.trim();
  const users = getUsers();
  resetUserIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (resetUserIndex === -1) { document.getElementById("reset-err1").style.display = "block"; return; }
  document.getElementById("reset-err1").style.display = "none";
  document.getElementById("reset-user-found").textContent = users[resetUserIndex].name;
  goResetStep(2);
}

function saveNewPassword() {
  const p1 = document.getElementById("reset-new-pass").value;
  const p2 = document.getElementById("reset-confirm-pass").value;
  if (p1.length < 6 || p1 !== p2) { document.getElementById("reset-err2").style.display = "block"; return; }
  document.getElementById("reset-err2").style.display = "none";
  const users = getUsers();
  if (resetUserIndex !== -1 && users[resetUserIndex]) {
    users[resetUserIndex].password = p1;
    saveUsers(users);
    goResetStep(3);
  }
}

// ===================== Navigation =====================

function switchView(viewName) {
  document.querySelectorAll(".app-view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById("view-" + viewName);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(el =>
    el.classList.toggle("active", el.dataset.view === viewName));
  document.querySelectorAll(".bottom-nav-item").forEach(el =>
    el.classList.toggle("active", el.dataset.view === viewName));

  const titles = { dashboard: "لوحة التحكم", invoices: "الفواتير", customers: "الزبائن" };
  document.getElementById("topbar-page-title").textContent = titles[viewName] || "لوحة التحكم";

  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebar-overlay")?.classList.remove("open");

  if (viewName === "dashboard") renderDashboard();
  if (viewName === "invoices")  { renderInvoiceStats(); renderInvoices(); fillCustomerSelect(); }
  if (viewName === "customers") { renderCustomerStats(); renderCustomers(); }
}

function updateAppUserInfo() {
  const userName = DB.user?.name || "مستخدم";
  const userComp = DB.company?.name ? ` (${DB.company.name})` : "";
  document.getElementById("topbar-greeting").textContent = "مرحباً، " + userName + userComp;
  document.getElementById("topbar-date").textContent = new Intl.DateTimeFormat("ar-IL", {
    weekday:"long", year:"numeric", month:"long", day:"numeric"
  }).format(new Date());
  document.querySelectorAll(".js-user-name").forEach(el => el.textContent = userName);
  document.querySelectorAll(".js-user-role").forEach(el => el.textContent = DB.user?.role || "مدير");
  const initials = userName.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("") || "خ";
  document.querySelectorAll(".js-user-initials").forEach(el => el.textContent = initials);
}

// ===================== Dashboard =====================

function renderDashboard() {
  const invs  = DB.invoices  || [];
  const custs = DB.customers || [];
  const totalSales = invs.reduce((s, i) => s + (i.price || 0), 0);
  const paidSales  = invs.filter(i => i.status === "مدفوعة").reduce((s, i) => s + (i.price || 0), 0);
  const unpaid     = totalSales - paidSales;

  document.getElementById("dash-stats").innerHTML = `
    <div class="stat-card navy"><div class="stat-card-icon">🧾</div><div class="stat-card-label">إجمالي الفواتير</div><div class="stat-card-value">${invs.length}</div></div>
    <div class="stat-card green"><div class="stat-card-icon">💰</div><div class="stat-card-label">إجمالي المبيعات</div><div class="stat-card-value text-green">${fmtCurr(totalSales)}</div></div>
    <div class="stat-card gold"><div class="stat-card-icon">✅</div><div class="stat-card-label">المحصّل</div><div class="stat-card-value text-gold">${fmtCurr(paidSales)}</div></div>
    <div class="stat-card red"><div class="stat-card-icon">⏳</div><div class="stat-card-label">المتبقي</div><div class="stat-card-value text-red">${fmtCurr(unpaid)}</div></div>
    <div class="stat-card orange"><div class="stat-card-icon">👥</div><div class="stat-card-label">إجمالي الزبائن</div><div class="stat-card-value">${custs.length}</div></div>
  `;

  const listEl = document.getElementById("dash-activity-list");
  if (invs.length === 0) {
    listEl.innerHTML = `<div class="empty-box"><span style="font-size:2rem;margin-bottom:6px;">🧾</span><strong style="color:var(--text-2);">لا توجد عمليات بعد</strong><span style="font-size:0.8rem;margin-top:2px;">اضغط "+ فاتورة جديدة" لإضافة أول معاملة</span></div>`;
  } else {
    const recent = invs.slice(-5).reverse();
    listEl.innerHTML = recent.map(inv => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(27,42,74,0.08);display:flex;align-items:center;justify-content:center;font-size:1.1rem;">🧾</div>
        <div style="flex:1;">
          <div style="font-size:0.88rem;font-weight:700;">${inv.number} - ${inv.customer}</div>
          <div style="font-size:0.75rem;color:var(--text-3);">${inv.date} &bull; ${inv.simtype || "SIM"}</div>
        </div>
        <div style="font-size:0.92rem;font-weight:800;color:var(--navy);">${fmtCurr(inv.price)}</div>
      </div>
    `).join("");
  }

  drawMonthlyChart();
}

function drawMonthlyChart() {
  const canvas = document.getElementById("dash-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const now = new Date();
  const months = [], sales = [0,0,0,0,0,0];

  for (let i = 5; i >= 0; i--) {
    const d    = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mKey = d.toISOString().slice(0, 7);
    months.push(monthNames[d.getMonth()]);
    const idx = 5 - i;
    (DB.invoices || []).forEach(inv => {
      if (inv.date && inv.date.startsWith(mKey)) sales[idx] += (inv.price || 0);
    });
  }

  const W = canvas.width = canvas.parentElement.clientWidth || 500;
  canvas.height = 230;
  const H = 230, pad = 36, barW = Math.max(22, (W - pad*2) / 14);
  const gap = (W - pad*2) / months.length;
  const maxV = Math.max(1000, ...sales) * 1.2;

  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = "#E2E8F0"; ctx.lineWidth = 1;
  for (let g = 0; g <= 3; g++) {
    const y = pad + g * ((H - pad*2) / 3);
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
  }

  months.forEach((m, i) => {
    const x = pad + i * gap + (gap - barW) / 2;
    const h = (sales[i] / maxV) * (H - pad*2);
    ctx.fillStyle = "#1B2A4A";
    ctx.beginPath(); ctx.roundRect(x, H - pad - h, barW, Math.max(3, h), [4,4,0,0]); ctx.fill();
    ctx.fillStyle = "#718096"; ctx.font = "12px Tajawal"; ctx.textAlign = "center";
    ctx.fillText(m, x + barW / 2, H - 12);
  });
}

// ===================== Invoices =====================

function renderInvoiceStats() {
  const invs   = DB.invoices || [];
  const total  = invs.reduce((s, i) => s + (i.price || 0), 0);
  const paid   = invs.filter(i => i.status === "مدفوعة").reduce((s, i) => s + (i.price || 0), 0);
  const unpaid = total - paid;
  document.getElementById("inv-stats").innerHTML = `
    <div class="stat-card navy"><div class="stat-card-icon">🧾</div><div class="stat-card-label">إجمالي الفواتير</div><div class="stat-card-value">${invs.length}</div></div>
    <div class="stat-card green"><div class="stat-card-icon">✅</div><div class="stat-card-label">إجمالي المبيعات</div><div class="stat-card-value text-green">${fmtCurr(total)}</div></div>
    <div class="stat-card gold"><div class="stat-card-icon">💰</div><div class="stat-card-label">المحصّل</div><div class="stat-card-value text-gold">${fmtCurr(paid)}</div></div>
    <div class="stat-card red"><div class="stat-card-icon">⏳</div><div class="stat-card-label">المتبقي</div><div class="stat-card-value text-red">${fmtCurr(unpaid)}</div></div>
  `;
}

function renderInvoices() {
  const q  = document.getElementById("inv-search").value.toLowerCase();
  const st = document.getElementById("inv-filter-status").value;
  let list = (DB.invoices || []).filter(inv => {
    const text = (inv.number + inv.customer + (inv.serial||"") + (inv.simno||"") + (inv.simtype||"")).toLowerCase();
    return (!q || text.includes(q)) && (!st || inv.status === st);
  }).reverse();

  const tbody = document.getElementById("inv-tbody");
  const empty = document.getElementById("inv-empty");
  if (list.length === 0) { tbody.innerHTML = ""; empty.classList.remove("hidden"); return; }
  empty.classList.add("hidden");

  tbody.innerHTML = list.map((inv, idx) => {
    const simkind = inv.simkind || "SIM";
    const simtype = inv.simtype || "سكاي";
    const kindBadge = simkind === "SIM"
      ? `<span style="background:#2E8B6E;color:#fff;padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:800;">📱 SIM</span>`
      : `<span style="background:#5a4fa3;color:#fff;padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:800;">☁️ E-SIM</span>`;
    const simBadge = simtype === "سكاي"
      ? `<span style="background:#1B2A4A;color:#fff;padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:800;">☁️ سكاي</span>`
      : `<span style="background:#c07a00;color:#fff;padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:800;">📱 ليان</span>`;
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${inv.number}</strong></td>
        <td>${inv.customer}</td>
        <td style="white-space:nowrap;">${kindBadge} ${simBadge}</td>
        <td>${inv.serial ? `<code style="background:rgba(27,42,74,0.08);padding:2px 8px;border-radius:4px;font-weight:700;">${inv.serial}</code>` : '<span style="color:var(--text-3);">-</span>'}</td>
        <td>${inv.simno  ? `<span style="font-weight:700;color:var(--navy);">${inv.simno}</span>` : '<span style="color:var(--text-3);">-</span>'}</td>
        <td>${fmtDate(inv.date)}</td>
        <td class="${inv.status === "مدفوعة" ? "text-green" : "text-red"}" style="font-weight:800;">${fmtCurr(inv.price)}</td>
        <td>${statusBadge(inv.status)}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="viewInvoice(${inv.id})"   title="عرض">👁️</button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="editInvoice(${inv.id})"   title="تعديل">✏️</button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="printInvoice(${inv.id})"  title="طباعة">🖨️</button>
            <button class="btn btn-red   btn-sm btn-icon" onclick="deleteInvoice(${inv.id})" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

function fillCustomerSelect() {
  const sel = document.getElementById("inv-customer");
  sel.innerHTML = '<option value="">اختر الزبون</option>';
  (DB.customers || []).forEach(c => {
    const o = document.createElement("option");
    o.value = c.id;
    const loc = c.location ? ` [📍 ${c.location}]` : "";
    const ph  = c.phone    ? ` - ${c.phone}`        : "";
    o.textContent = `${c.name}${ph}${loc}`;
    sel.appendChild(o);
  });
}

function setSimKind(kind) {
  document.getElementById("inv-simkind").value = kind;
  const b1 = document.getElementById("btn-simkind-sim");
  const b2 = document.getElementById("btn-simkind-esim");
  if (kind === "SIM") {
    b1.style.background = "var(--navy)"; b1.style.color = "#fff";
    b2.style.background = "#f0f0f0";     b2.style.color = "var(--text-3)";
  } else {
    b2.style.background = "var(--navy)"; b2.style.color = "#fff";
    b1.style.background = "#f0f0f0";     b1.style.color = "var(--text-3)";
  }
}

function setSimType(type) {
  document.getElementById("inv-simtype").value = type;
  const b1 = document.getElementById("btn-type-esim"); // سكاي
  const b2 = document.getElementById("btn-type-sim");  // ليان
  if (type === "سكاي") {
    b1.style.background = "var(--navy)"; b1.style.color = "#fff";
    b2.style.background = "#f0f0f0";     b2.style.color = "var(--text-3)";
  } else {
    b2.style.background = "var(--navy)"; b2.style.color = "#fff";
    b1.style.background = "#f0f0f0";     b1.style.color = "var(--text-3)";
  }
}

function calcInvSummary() {
  const price = parseFloat(document.getElementById("inv-price").value) || 0;
  document.getElementById("inv-summary-total").textContent = fmtCurr(price);
}

function openAddInvoiceModal() {
  editingInvoiceId = null;
  fillCustomerSelect();
  document.getElementById("modal-inv-title").textContent = "فاتورة جديدة";
  document.getElementById("inv-customer").value = "";
  document.getElementById("inv-date").value     = today();
  const d = new Date(); d.setDate(d.getDate() + 30);
  document.getElementById("inv-due").value      = d.toISOString().split("T")[0];
  document.getElementById("inv-status").value   = "غير مدفوعة";
  document.getElementById("inv-serial").value   = "";
  document.getElementById("inv-simno").value    = "";
  document.getElementById("inv-price").value    = "";
  setSimKind("SIM");
  setSimType("سكاي");
  calcInvSummary();
  openModal("modal-invoice");
}

function saveInvoice() {
  const cid  = parseInt(document.getElementById("inv-customer").value);
  const cust = (DB.customers || []).find(c => c.id === cid);
  if (!cust) { showToast("يرجى اختيار الزبون أولاً", "error"); return; }

  const price = parseFloat(document.getElementById("inv-price").value);
  if (!price || price <= 0) { showToast("يرجى إدخال المبلغ", "error"); return; }

  const serial  = document.getElementById("inv-serial").value.trim();
  const simno   = document.getElementById("inv-simno").value.trim();

  if (serial) {
    if (!/^\d+$/.test(serial)) {
      showToast("سري نمبر الشريحة يجب أن يحتوي على أرقام فقط", "error");
      return;
    }
    if (serial.length < 15 || serial.length > 20) {
      showToast("سري نمبر الشريحة يجب أن يكون بين 15 و 20 رقماً", "error");
      return;
    }
  }

  if (simno) {
    if (!/^\d+$/.test(simno)) {
      showToast("رقم الشريحة يجب أن يحتوي على أرقام فقط", "error");
      return;
    }
    if (simno.length !== 10) {
      showToast("رقم الشريحة يجب أن يتكون من 10 أرقام تماماً", "error");
      return;
    }
  }

  const simkind = document.getElementById("inv-simkind").value || "SIM";
  const simtype = document.getElementById("inv-simtype").value || "سكاي";

  if (!DB.invoices) DB.invoices = [];
  const newId = editingInvoiceId || genId(DB.invoices);
  const inv = {
    id: newId,
    number:     editingInvoiceId ? (DB.invoices.find(i=>i.id===editingInvoiceId)||{}).number : "INV-" + String(newId).padStart(3,"0"),
    customer:   cust.name,
    customerId: cid,
    date:       document.getElementById("inv-date").value,
    due:        document.getElementById("inv-due").value,
    status:     document.getElementById("inv-status").value,
    serial, simno, simkind, simtype, price
  };

  if (editingInvoiceId) {
    const idx = DB.invoices.findIndex(i => i.id === editingInvoiceId);
    DB.invoices[idx] = inv;
  } else {
    DB.invoices.push(inv);
  }

  saveDB();
  renderInvoiceStats();
  renderInvoices();
  closeModal("modal-invoice");
  showToast(editingInvoiceId ? "تم تعديل الفاتورة بنجاح" : "تم إنشاء الفاتورة بنجاح", "success");
  editingInvoiceId = null;
}

function editInvoice(id) {
  const inv = (DB.invoices || []).find(i => i.id === id);
  if (!inv) return;
  editingInvoiceId = id;
  fillCustomerSelect();
  document.getElementById("modal-inv-title").textContent = "تعديل الفاتورة";
  document.getElementById("inv-customer").value = inv.customerId;
  document.getElementById("inv-date").value     = inv.date;
  document.getElementById("inv-due").value      = inv.due;
  document.getElementById("inv-status").value   = inv.status;
  document.getElementById("inv-serial").value   = inv.serial || "";
  document.getElementById("inv-simno").value    = inv.simno  || "";
  document.getElementById("inv-price").value    = inv.price  || "";
  setSimKind(inv.simkind || "SIM");
  setSimType(inv.simtype || "سكاي");
  calcInvSummary();
  openModal("modal-invoice");
}

function viewInvoice(id) {
  const inv = (DB.invoices || []).find(i => i.id === id);
  if (!inv) return;
  const simtype  = inv.simtype  || "سكاي";
  const simkind  = inv.simkind  || "SIM";
  const kindBadge = simkind === "SIM"
    ? `<span style="background:#2E8B6E;color:#fff;padding:3px 12px;border-radius:20px;font-size:0.82rem;font-weight:800;">📱 SIM</span>`
    : `<span style="background:#5a4fa3;color:#fff;padding:3px 12px;border-radius:20px;font-size:0.82rem;font-weight:800;">☁️ E-SIM</span>`;
  const simBadge = simtype === "سكاي"
    ? `<span style="background:#1B2A4A;color:#fff;padding:3px 12px;border-radius:20px;font-size:0.82rem;font-weight:800;">☁️ سكاي</span>`
    : `<span style="background:#c07a00;color:#fff;padding:3px 12px;border-radius:20px;font-size:0.82rem;font-weight:800;">📱 ليان</span>`;

  document.getElementById("view-inv-title").textContent = "فاتورة " + inv.number;
  document.getElementById("view-inv-body").innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
      <div style="line-height:1.9;">
        <div><strong>الزبون:</strong> ${inv.customer}</div>
        <div><strong>التاريخ:</strong> ${fmtDate(inv.date)}</div>
        <div><strong>الاستحقاق:</strong> ${fmtDate(inv.due)}</div>
      </div>
      <div style="text-align:left;">${statusBadge(inv.status)}<br><strong>${inv.number}</strong></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
      <div class="sim-info-box"><label>📶 نوع الشريحة</label><div style="margin-top:4px;">${kindBadge}</div></div>
      <div class="sim-info-box"><label>🌐 نظام الشريحة</label><div style="margin-top:4px;">${simBadge}</div></div>
      ${inv.serial ? `<div class="sim-info-box"><label>🔐 سري نمبر</label><div class="val">${inv.serial}</div></div>` : ""}
      ${inv.simno  ? `<div class="sim-info-box"><label>📱 رقم الشريحة</label><div class="val">${inv.simno}</div></div>` : ""}
    </div>
    <div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;">
      <div style="display:flex;justify-content:space-between;font-weight:800;font-size:1.15rem;color:var(--navy);">
        <span>إجمالي المبلغ:</span><span>${fmtCurr(inv.price)}</span>
      </div>
    </div>
  `;
  document.getElementById("btn-print-inv").onclick = () => printInvoice(id);
  openModal("modal-inv-view");
}

function deleteInvoice(id) {
  confirmAction("هل أنت متأكد من حذف هذه الفاتورة؟", () => {
    DB.invoices = (DB.invoices || []).filter(i => i.id !== id);
    saveDB(); renderInvoiceStats(); renderInvoices();
    showToast("تم حذف الفاتورة بنجاح", "success");
  });
}

function printInvoice(id) {
  const inv = (DB.invoices || []).find(i => i.id === id);
  if (!inv) return;
  const w = window.open("", "_blank");
  w.document.write(`
    <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>فاتورة ${inv.number}</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
    <style>
      body { font-family:'Tajawal',sans-serif; direction:rtl; padding:40px; color:#1a202c; }
      .header { display:flex; justify-content:space-between; border-bottom:3px solid #1B2A4A; padding-bottom:20px; margin-bottom:24px; }
      .title  { font-size:1.8rem; font-weight:900; color:#1B2A4A; }
      .grid   { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:24px; }
      .box    { background:#f7fafc; padding:14px; border-radius:8px; }
      .total  { font-size:1.4rem; font-weight:900; color:#1B2A4A; border-top:2px solid #1B2A4A; padding-top:10px; margin-top:20px; }
    </style></head><body>
    <div class="header">
      <div><h2>KHALIL ACCOUNTING</h2><p>فاتورة مبيعات</p></div>
      <div style="text-align:left;"><div class="title">${inv.number}</div><div>التاريخ: ${inv.date}</div></div>
    </div>
    <div class="grid">
      <div class="box"><strong>الزبون:</strong> ${inv.customer}</div>
      <div class="box"><strong>نظام الشريحة:</strong> ${inv.simtype || "ليان"}</div>
      ${inv.serial ? `<div class="box"><strong>سري نمبر:</strong> ${inv.serial}</div>` : ""}
      ${inv.simno  ? `<div class="box"><strong>رقم الشريحة:</strong> ${inv.simno}</div>` : ""}
    </div>
    <div class="total">الإجمالي النهائي: ₪ ${fmt(inv.price)}</div>
    <script>window.onload=()=>window.print();<\/script>
    </body></html>
  `);
  w.document.close();
}

function exportInvCSV() {
  const headers = ["رقم الفاتورة","الزبون","نظام الشريحة","سري نمبر","رقم الشريحة","التاريخ","المبلغ","الحالة"];
  const rows    = (DB.invoices || []).map(i => [
    i.number, i.customer, i.simtype||"ليان", i.serial||"-", i.simno||"-", i.date, (i.price||0).toFixed(2), i.status
  ]);
  const csv  = "\uFEFF" + [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "فواتير_" + today() + ".csv";
  a.click(); URL.revokeObjectURL(url);
}

// ===================== Customers =====================

function renderCustomerStats() {
  const custs      = DB.customers || [];
  const invs       = DB.invoices  || [];
  const totalSales = invs.reduce((s, i) => s + (i.price || 0), 0);
  document.getElementById("cust-stats").innerHTML = `
    <div class="stat-card navy"><div class="stat-card-icon">👥</div><div class="stat-card-label">إجمالي الزبائن</div><div class="stat-card-value">${custs.length}</div></div>
    <div class="stat-card green"><div class="stat-card-icon">💰</div><div class="stat-card-label">إجمالي المبيعات</div><div class="stat-card-value text-green">${fmtCurr(totalSales)}</div></div>
    <div class="stat-card gold"><div class="stat-card-icon">🧾</div><div class="stat-card-label">إجمالي الفواتير</div><div class="stat-card-value">${invs.length}</div></div>
  `;
}

function renderCustomers() {
  const q    = document.getElementById("cust-search").value.toLowerCase();
  const list = (DB.customers || []).filter(c =>
    !q || (c.name + (c.phone||"") + (c.location||"")).toLowerCase().includes(q)
  );

  const tbody = document.getElementById("cust-tbody");
  const empty = document.getElementById("cust-empty");
  if (list.length === 0) { tbody.innerHTML = ""; empty.classList.remove("hidden"); return; }
  empty.classList.add("hidden");

  tbody.innerHTML = list.map((c, idx) => {
    const custInvs = (DB.invoices || []).filter(i => i.customerId === c.id);
    const total    = custInvs.reduce((s, i) => s + (i.price || 0), 0);
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${c.name}</strong></td>
        <td style="font-weight:700;letter-spacing:1px;">${c.phone || "-"}</td>
        <td><span class="badge badge-navy" style="font-weight:800;padding:4px 10px;">📍 ${c.location || "غزة"}</span></td>
        <td class="text-green" style="font-weight:800;">${fmtCurr(total)}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="viewStatement(${c.id})"  title="كشف حساب">📋</button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="editCustomer(${c.id})"   title="تعديل">✏️</button>
            <button class="btn btn-red   btn-sm btn-icon" onclick="deleteCustomer(${c.id})" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

function openAddCustomerModal() {
  editingCustomerId = null;
  document.getElementById("modal-cust-title").textContent = "زبون جديد";
  document.getElementById("cust-name").value     = "";
  document.getElementById("cust-phone").value    = "";
  document.getElementById("cust-location").value = "غزة";
  openModal("modal-customer");
}

function saveCustomer() {
  const name     = document.getElementById("cust-name").value.trim();
  const phone    = document.getElementById("cust-phone").value.trim();
  const location = document.getElementById("cust-location").value;

  if (!name) { showToast("يرجى إدخال اسم الزبون", "error"); return; }
  if (phone && phone.length !== 10) { showToast("رقم الهاتف يجب أن يكون 10 أرقام", "error"); return; }

  if (!DB.customers) DB.customers = [];
  const cust = { id: editingCustomerId || genId(DB.customers), name, phone, location, balance: 0 };

  if (editingCustomerId) {
    const idx = DB.customers.findIndex(c => c.id === editingCustomerId);
    DB.customers[idx] = cust;
  } else {
    DB.customers.push(cust);
  }

  saveDB(); renderCustomerStats(); renderCustomers();
  closeModal("modal-customer");
  showToast(editingCustomerId ? "تم تعديل الزبون بنجاح" : "تمت إضافة الزبون بنجاح", "success");
  editingCustomerId = null;
}

function editCustomer(id) {
  const c = (DB.customers || []).find(x => x.id === id);
  if (!c) return;
  editingCustomerId = id;
  document.getElementById("modal-cust-title").textContent = "تعديل بيانات الزبون";
  document.getElementById("cust-name").value     = c.name;
  document.getElementById("cust-phone").value    = c.phone    || "";
  document.getElementById("cust-location").value = c.location || "غزة";
  openModal("modal-customer");
}

function deleteCustomer(id) {
  confirmAction("هل أنت متأكد من حذف هذا الزبون؟", () => {
    DB.customers = (DB.customers || []).filter(c => c.id !== id);
    saveDB(); renderCustomerStats(); renderCustomers();
    showToast("تم الحذف بنجاح", "success");
  });
}

let currentStatementId = null;

function viewStatement(id) {
  const c    = (DB.customers || []).find(x => x.id === id);
  if (!c) return;
  currentStatementId = id;
  const invs  = (DB.invoices || []).filter(i => i.customerId === id);
  const total = invs.reduce((s, i) => s + (i.price || 0), 0);
  const paid  = invs.filter(i => i.status === "مدفوعة").reduce((s, i) => s + (i.price || 0), 0);

  document.getElementById("stmt-title").textContent = "كشف حساب: " + c.name;
  document.getElementById("stmt-body").innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;background:rgba(27,42,74,0.05);border-radius:10px;padding:14px;">
      <div style="font-size:2.2rem;">👤</div>
      <div>
        <div style="font-size:1.15rem;font-weight:900;color:var(--navy);">${c.name}</div>
        <div style="display:flex;gap:12px;margin-top:6px;align-items:center;">
          ${c.phone ? `<span style="font-weight:700;letter-spacing:1px;color:var(--text-3);">📱 ${c.phone}</span>` : ""}
          <span class="badge badge-navy" style="font-size:0.8rem;font-weight:800;">📍 ${c.location || "غزة"}</span>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
      <div class="stat-card navy"><div class="stat-card-label">عدد الفواتير</div><div class="stat-card-value">${invs.length}</div></div>
      <div class="stat-card green"><div class="stat-card-label">إجمالي المبيعات</div><div class="stat-card-value text-green">${fmtCurr(total)}</div></div>
      <div class="stat-card gold"><div class="stat-card-label">المحصّل</div><div class="stat-card-value text-gold">${fmtCurr(paid)}</div></div>
    </div>
    <table class="table">
      <thead><tr><th>رقم الفاتورة</th><th>نوع الشريحة</th><th>رقم الشريحة</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th></tr></thead>
      <tbody>
        ${invs.length ? invs.map(inv => {
          const simBadge = (inv.simtype || "SIM") === "E-SIM"
            ? `<span style="background:#1B2A4A;color:#fff;padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:800;">☁️ E-SIM</span>`
            : `<span style="background:#2E8B6E;color:#fff;padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:800;">📱 SIM</span>`;
          return `<tr>
            <td><strong>${inv.number}</strong></td>
            <td>${simBadge}</td>
            <td>${inv.simno || "-"}</td>
            <td>${fmtDate(inv.date)}</td>
            <td style="font-weight:800;">${fmtCurr(inv.price)}</td>
            <td>${statusBadge(inv.status)}</td>
          </tr>`;
        }).join("") : '<tr><td colspan="6" class="text-center text-muted" style="padding:24px;">لا توجد فواتير لهذا الزبون بعد</td></tr>'}
      </tbody>
    </table>
  `;
  openModal("modal-statement");
}

// تحويل الصورة إلى base64 لتعمل في نافذة الطباعة
function getLogoBase64(callback) {
  const img    = new Image();
  const canvas = document.createElement('canvas');
  img.onload = function () {
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    callback(canvas.toDataURL('image/jpeg'));
  };
  img.onerror = function () { callback(null); };
  img.src = 'assets/img/logo.jpg';
}

function printStatement() {
  const id = currentStatementId;
  const c  = (DB.customers || []).find(x => x.id === id);
  if (!c) return;

  // نحمّل الشعار كـ base64 أولاً لتظهر الصورة في نافذة الطباعة
  getLogoBase64(function(logoSrc) {
    const logoHtml = logoSrc
      ? `<img src="${logoSrc}" alt="Logo" style="width:90px;height:90px;object-fit:cover;border-radius:14px;border:2px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.12);">`
      : `<div style="width:90px;height:90px;border-radius:14px;background:#1B2A4A;color:#C9A84C;display:flex;align-items:center;justify-content:center;font-size:2.8rem;font-weight:900;">K</div>`;

    const invs    = (DB.invoices || []).filter(i => i.customerId === id);
    const total   = invs.reduce((s, i) => s + (i.price || 0), 0);
    const paid    = invs.filter(i => i.status === "مدفوعة").reduce((s, i) => s + (i.price || 0), 0);
    const unpaid  = total - paid;
    const company = DB.company?.name || "KHALIL ACCOUNTING";
    const printDate = new Date().toLocaleDateString('ar-IL', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    const statusColor = { "مدفوعة": "#d1fae5", "متأخرة": "#fee2e2", "جزئية": "#fef3c7", "غير مدفوعة": "#dbeafe" };
    const statusText  = { "مدفوعة": "#065f46", "متأخرة": "#991b1b", "جزئية": "#92400e", "غير مدفوعة": "#1e3a5f" };

    const tableRows = invs.length ? invs.map((inv, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${inv.number}</strong></td>
        <td>${inv.simtype || "SIM"}</td>
        <td>${inv.simno || "-"}</td>
        <td>${inv.serial || "-"}</td>
        <td>${inv.date || "-"}</td>
        <td style="font-weight:800;">₪ ${fmt(inv.price)}</td>
        <td><span style="background:${statusColor[inv.status]||'#e2e8f0'};color:${statusText[inv.status]||'#333'};padding:3px 12px;border-radius:20px;font-size:0.8rem;font-weight:700;">${inv.status}</span></td>
      </tr>
    `).join("") : `<tr><td colspan="8" style="text-align:center;padding:28px;color:#718096;">لا توجد فواتير لهذا الزبون</td></tr>`;

    const w = window.open("", "_blank");
    w.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب - ${c.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Tajawal', sans-serif; color: #1a202c; direction: rtl; padding: 40px; background: #fff; }

          .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; padding-bottom:22px; border-bottom:3px solid #1B2A4A; }
          .doc-title  { font-size:2.4rem; font-weight:900; color:#1B2A4A; line-height:1; }
          .doc-date   { font-size:0.85rem; color:#718096; margin-top:6px; }
          .header-left { display:flex; flex-direction:column; align-items:flex-end; gap:8px; text-align:left; }
          .company-name { font-size:1rem; font-weight:800; color:#1B2A4A; letter-spacing:1px; }

          .customer-box {
            background: linear-gradient(135deg, #1B2A4A 0%, #243660 100%);
            border-radius:14px; padding:22px 26px; margin-bottom:24px;
            display:flex; justify-content:space-between; align-items:center; color:#fff;
          }
          .customer-name  { font-size:1.8rem; font-weight:900; margin-bottom:8px; }
          .customer-meta  { display:flex; gap:20px; font-size:0.9rem; opacity:0.85; }
          .customer-meta span { display:flex; align-items:center; gap:6px; font-weight:600; }
          .inv-count-box  { text-align:center; background:rgba(201,168,76,0.2); border:2px solid #C9A84C; border-radius:10px; padding:10px 20px; min-width:90px; }
          .inv-count-lbl  { font-size:0.72rem; font-weight:700; opacity:0.8; margin-bottom:2px; }
          .inv-count-val  { font-size:2rem; font-weight:900; color:#C9A84C; }

          .summary-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-bottom:28px; }
          .summary-card { border-radius:12px; padding:18px 22px; text-align:center; border:1.5px solid; }
          .sc-navy  { border-color:#1B2A4A; background:rgba(27,42,74,0.06); }
          .sc-green { border-color:#2E8B6E; background:rgba(46,139,110,0.06); }
          .sc-red   { border-color:#E53935; background:rgba(229,57,53,0.05); }
          .sum-label { font-size:0.75rem; font-weight:700; color:#718096; margin-bottom:8px; }
          .sum-value { font-size:1.6rem; font-weight:900; }
          .sc-navy  .sum-value { color:#1B2A4A; }
          .sc-green .sum-value { color:#2E8B6E; }
          .sc-red   .sum-value { color:#E53935; }

          table { width:100%; border-collapse:collapse; margin-bottom:24px; }
          thead tr { background:#1B2A4A; }
          thead th { padding:13px 14px; color:#fff; font-weight:700; text-align:right; font-size:0.82rem; }
          tbody td { padding:11px 14px; border-bottom:1px solid #e2e8f0; }
          tbody tr:last-child td { border-bottom:none; }
          tbody tr:nth-child(even) { background:#fafbfc; }

          .totals-wrap { display:flex; justify-content:flex-end; margin-bottom:32px; }
          .totals-box  { width:300px; border-radius:12px; overflow:hidden; border:1.5px solid #e2e8f0; }
          .t-row { display:flex; justify-content:space-between; padding:11px 18px; font-size:0.9rem; border-bottom:1px solid #e2e8f0; }
          .t-row.final { background:#1B2A4A; color:#fff; font-weight:900; border:none; padding:14px 18px; }
          .t-lbl { font-weight:600; } .t-val { font-weight:800; }
          .val-green { color:#2E8B6E; }

          footer { text-align:center; color:#a0aec0; font-size:0.8rem; border-top:1px solid #e2e8f0; padding-top:18px; margin-top:4px; }
          @media print { body { padding:16px; } }
        </style>
      </head>
      <body>

        <div class="header">
          <div>
            <div class="doc-title">كشف حساب</div>
            <div class="doc-date">${printDate}</div>
          </div>
          <div class="header-left">
            ${logoHtml}
            <div class="company-name">${company}</div>
          </div>
        </div>

        <div class="customer-box">
          <div>
            <div class="customer-name">${c.name}</div>
            <div class="customer-meta">
              ${c.phone    ? `<span>📱 ${c.phone}</span>`    : ""}
              ${c.location ? `<span>📍 ${c.location}</span>` : ""}
            </div>
          </div>
          <div class="inv-count-box">
            <div class="inv-count-lbl">الفواتير</div>
            <div class="inv-count-val">${invs.length}</div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card sc-navy">
            <div class="sum-label">إجمالي المبيعات</div>
            <div class="sum-value">₪ ${fmt(total)}</div>
          </div>
          <div class="summary-card sc-green">
            <div class="sum-label">المحصّل</div>
            <div class="sum-value">₪ ${fmt(paid)}</div>
          </div>
          <div class="summary-card sc-red">
            <div class="sum-label">المتبقي</div>
            <div class="sum-value">₪ ${fmt(unpaid)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th><th>رقم الفاتورة</th><th>نوع الشريحة</th>
              <th>رقم الشريحة</th><th>سري نمبر</th>
              <th>التاريخ</th><th>المبلغ</th><th>الحالة</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        <div class="totals-wrap">
          <div class="totals-box">
            <div class="t-row"><span class="t-lbl">إجمالي المبيعات</span><span class="t-val">₪ ${fmt(total)}</span></div>
            <div class="t-row"><span class="t-lbl">المحصّل</span><span class="t-val val-green">₪ ${fmt(paid)}</span></div>
            <div class="t-row final"><span class="t-lbl">المتبقي</span><span class="t-val">₪ ${fmt(unpaid)}</span></div>
          </div>
        </div>

        <footer>${company} — كشف حساب: ${c.name} — شكراً لثقتكم</footer>

        <script>window.onload = () => window.print();<\/script>
      </body>
      </html>
    `);
    w.document.close();
  });
}

// ===================== Init =====================

window.addEventListener("DOMContentLoaded", () => {
  checkAuth();
});
