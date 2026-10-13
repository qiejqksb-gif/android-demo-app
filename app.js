import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// الكود السري الخاص بدخول الموظفين (يمكنك تعديله من هنا)
const SECRET_CODE = "2026"; 

// دالة التحقق من الكود وحفظ الحالة في ذاكرة الهاتف
window.checkEmployeeCode = function() {
  const userInput = document.getElementById("employee-code-input").value;
  
  if (userInput === SECRET_CODE) {
      localStorage.setItem("app_activated", "true");
      const loginScreen = document.getElementById("login-screen-ui");
      if (loginScreen) loginScreen.style.display = "none";
      alert("أهلاً بك! تم تفعيل نظام الموظف بنجاح.");
  } else {
      alert("الكود السري خطأ! يرجى المحاولة مجدداً.");
  }
};

// الفحص التلقائي عند تشغيل التطبيق للتأكد إن كان الموظف مسجلاً سابقاً
window.addEventListener('DOMContentLoaded', () => {
  const isActivated = localStorage.getItem("app_activated");
  if (isActivated === "true") {
      const loginScreen = document.getElementById("login-screen-ui");
      if (loginScreen) loginScreen.style.display = "none";
  }
});

/* إعدادات Firebase الخاصة بك */
const firebaseConfig = {
  apiKey: "AIzaSyAWwyEb0DUY0Q_ZBluwtM4-gLQv4wNdwE",
  authDomain: "clinic-bookings-yousef.firebaseapp.com",
  projectId: "clinic-bookings-yousef",
  storageBucket: "clinic-bookings-yousef.firebasestorage.app",
  messagingSenderId: "287479628978",
  appId: "1:287479628978:web:19acd76bd2f3f9fe7ff5ab",
  measurementId: "G-7395STP39Y"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const bookingsRef = collection(db, "bookings");

const $ = id => document.getElementById(id);

const dlg = $("dlg");
const addBtn = $("add");
const cancelBtn = $("cancel");
const form = $("form");
const listContainer = $("list");
const countEl = $("count");
const todayEl = $("today");
const revenueEl = $("revenue");
const revenueReportEl = $("revenue-report");
const searchInput = $("search");
const filterDateInput = $("filterDate");
const exportBtn = $("export");
const clearFiltersBtn = $("clearFilters");
const saveBtn = $("saveBooking");
const connectionEl = $("connection");

let allBookings = [];

/* التاريخ حسب توقيت الهاتف المحلي */
function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("ar-IQ", {
    maximumFractionDigits: 0
  }).format(value);
}

function safeText(value, fallback = "غير محدد") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

/* إنشاء عناصر النص بطريقة آمنة */
function addTextElement(parent, tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

/* عرض رسالة الحالة */
function setConnection(message, state = "") {
  if (!connectionEl) return;
  connectionEl.textContent = message;
  connectionEl.className = "connection " + state;
}

/* فتح وإغلاق نموذج الحجز */
if (addBtn) {
  addBtn.addEventListener("click", () => {
    if (form) form.reset();
    const bDate = $("bookingDate");
    if (bDate) bDate.value = localDateString();
    if (dlg) dlg.showModal();
  });
}

if (cancelBtn) cancelBtn.addEventListener("click", () => dlg && dlg.close());

if (dlg) {
  dlg.addEventListener("click", event => {
    if (event.target === dlg) dlg.close();
  });
}

/* تحديث الإحصائيات */
function updateStats() {
  const today = localDateString();

  const todayCount = allBookings.filter(
    booking => booking.date === today
  ).length;

  const totalFees = allBookings.reduce((sum, booking) => {
    const fee = Number(booking.fee);
    return sum + (
      Number.isFinite(fee) && fee > 0 ? fee : 0
    );
  }, 0);

  if (countEl) countEl.textContent = formatMoney(allBookings.length);
  if (todayEl) todayEl.textContent = formatMoney(todayCount);
  if (revenueEl) revenueEl.textContent = formatMoney(totalFees);
  if (revenueReportEl) {
    revenueReportEl.textContent = formatMoney(totalFees) + " د.ع";
  }
}

/* بناء بطاقة الحجز */
function createBookingCard(data) {
  const card = document.createElement("article");
  card.className = "booking-card";

  addTextElement(
    card,
    "h3",
    `${safeText(data.name, "مريض بدون اسم")} (${safeText(data.age, "العمر غير محدد")} سنة)`
  );

  const patientDetails = document.createElement("p");
  addTextElement(patientDetails, "b", "الهاتف:");
  patientDetails.appendChild(
    document.createTextNode(" " + safeText(data.phone, "لا يوجد") + " | ")
  );
  addTextElement(patientDetails, "b", "الطبيب:");
  patientDetails.appendChild(
    document.createTextNode(" " + safeText(data.doctor))
  );
  card.appendChild(patientDetails);

  const dateDetails = document.createElement("p");
  addTextElement(dateDetails, "b", "التاريخ:");
  dateDetails.appendChild(
    document.createTextNode(" " + safeText(data.date) + " | ")
  );
  addTextElement(dateDetails, "b", "الوقت:");
  dateDetails.appendChild(
    document.createTextNode(" " + safeText(data.time, "--:--"))
  );
  card.appendChild(dateDetails);

  const specialty = safeText(data.specialty, "");
  if (specialty) {
    const p = document.createElement("p");
    addTextElement(p, "b", "الاختصاص:");
    p.appendChild(document.createTextNode(" " + specialty));
    card.appendChild(p);
  }

  const statusRow = document.createElement("p");
  addTextElement(statusRow, "b", "الحالة:");

  const status = document.createElement("span");
  status.className = "status-badge";
  status.dataset.status = safeText(data.status, "محجوز");
  status.textContent = safeText(data.status, "محجوز");
  statusRow.appendChild(status);
  card.appendChild(statusRow);

  const fee = Number(data.fee);
  if (Number.isFinite(fee) && fee >= 0 && data.fee !== "") {
    const feeRow = document.createElement("p");
    addTextElement(feeRow, "b", "الكشفية:");
    feeRow.appendChild(
      document.createTextNode(" " + formatMoney(fee) + " د.ع")
    );
    card.appendChild(feeRow);
  }

  if (data.notes) {
    const notes = document.createElement("p");
    addTextElement(notes, "b", "ملاحظات:");
    notes.appendChild(document.createTextNode(" " + String(data.notes)));
    card.appendChild(notes);
  }

  card.appendChild(document.createElement("hr"));
  return card;
}

/* البحث والتصفية */
function renderList() {
  if (!listContainer) return;
  const searchText = searchInput ? searchInput.value.trim().toLocaleLowerCase() : "";
  const selectedDate = filterDateInput ? filterDateInput.value : "";

  const filtered = allBookings.filter(booking => {
    const name = safeText(booking.name, "").toLocaleLowerCase();
    const phone = safeText(booking.phone, "");
    const matchesSearch =
      name.includes(searchText) || phone.includes(searchText);

    const matchesDate =
      !selectedDate || booking.date === selectedDate;

    return matchesSearch && matchesDate;
  });

  listContainer.replaceChildren();

  if (filtered.length === 0) {
    addTextElement(
      listContainer,
      "p",
      allBookings.length
        ? "لا توجد حجوزات مطابقة للبحث أو التاريخ المحدد."
        : "لا توجد حجوزات مسجلة حتى الآن.",
      "message"
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach(booking => {
    fragment.appendChild(createBookingCard(booking));
  });

  listContainer.appendChild(fragment);
}

if (searchInput) searchInput.addEventListener("input", renderList);
if (filterDateInput) filterDateInput.addEventListener("change", renderList);

if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (filterDateInput) filterDateInput.value = "";
    renderList();
  });
}

/* حفظ حجز جديد */
if (form) {
  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();

    if (!name) {
      alert("يرجى إدخال اسم المريض.");
      return;
    }

    const rawAge = String(formData.get("age") || "").trim();
    const rawFee = String(formData.get("fee") || "").trim();

    const bookingData = {
      name,
      age: rawAge,
      phone: String(formData.get("phone") || "").trim(),
      doctor: String(formData.get("doctor") || "").trim(),
      specialty: String(formData.get("specialty") || "").trim(),
      date: String(formData.get("date") || ""),
      time: String(formData.get("time") || ""),
      fee: rawFee,
      status: String(formData.get("status") || "محجوز"),
      notes: String(formData.get("notes") || "").trim(),
      createdAt: serverTimestamp()
    };

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "جارٍ الحفظ...";
    }

    try {
      await addDoc(bookingsRef, bookingData);
      form.reset();
      if (dlg) dlg.close();
      alert("تم حفظ الحجز بنجاح.");
    } catch (error) {
      console.error("فشل حفظ الحجز:", error);
      alert("تعذر حفظ الحجز. تحقق من اتصال الإنترنت وقواعد أمان Firestore.");
    } finally {
      if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = "حفظ الحجز";
      }
    }
  });
}

// تشغيل الاستماع الفوري لقاعدة البيانات لعرض الحجوزات واكتملت بنجاح هنا
const q = query(bookingsRef, orderBy("createdAt", "desc"));
onSnapshot(q, (snapshot) => {
  allBookings = [];
  snapshot.forEach((doc) => {
      allBookings.push(doc.data());
  });
  updateStats();
  renderList();
  setConnection("متصل بشكل آمن وقيد المزامنة...", "success");
}, (error) => {
    
