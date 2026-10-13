
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

/*
 * إعداد Firebase:
 * تأكد من مطابقة authDomain لبنية مشروعك من Firebase Console.
 * بقية القيم أدناه مأخوذة من إعدادات مشروعك التي أرسلتها.
 */
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
let unsubscribeBookings = null;

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
addBtn.addEventListener("click", () => {
  form.reset();
  $("bookingDate").value = localDateString();
  dlg.showModal();
});

cancelBtn.addEventListener("click", () => dlg.close());

dlg.addEventListener("click", event => {
  if (event.target === dlg) dlg.close();
});

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

  countEl.textContent = formatMoney(allBookings.length);
  todayEl.textContent = formatMoney(todayCount);

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
  const searchText = searchInput.value.trim().toLocaleLowerCase();
  const selectedDate = filterDateInput.value;

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

searchInput.addEventListener("input", renderList);
filterDateInput.addEventListener("change", renderList);

clearFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  filterDateInput.value = "";
  renderList();
});

/* حفظ حجز جديد */
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

  saveBtn.disabled = true;
  saveBtn.textContent = "جارٍ الحفظ...";

  try {
    await addDoc(bookingsRef, bookingData);
    form.reset();
    dlg.close();
    alert("تم حفظ الحجز بنجاح.");
  } catch (error) {
    console.error("فشل حفظ الحجز:", error);
    alert(
      "تعذر حفظ الحجز. تحقق من اتصال الإنترنت وقواعد أمان Firestore."
    );
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "حفظ الحجز";
  }
});

/* تصدير الحجوزات إلى CSV */
function csvCell(value) {
  const text = String(value ?? "");
  return '"' + text.replace(/"/g, '""') + '"';
}

exportBtn.addEventListener("click", () => {
  if (allBookings.length === 0) {
    alert("لا توجد بيانات لتصديرها.");
    return;
  }

  const rows = [
    [
      "اسم المريض", "العمر", "رقم الهاتف", "الطبيب",
      "الاختصاص", "التاريخ", "الوقت", "الكشفية",
      "الحالة", "ملاحظات"
    ],
    ...allBookings.map(booking => [
      booking.name,
      booking.age,
      booking.phone,
      booking.doctor,
      booking.specialty,
      booking.date,
      booking.time,
      booking.fee,
      booking.status,
      booking.notes
    ])
  ];

  const csv = "\uFEFF" +
    rows.map(row => row.map(csvCell).join(",")).join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `سجل_الحجوزات_${localDateString()}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

/* مزامنة مباشرة من Firestore */
function startBookingsListener() {
  setConnection("جارٍ الاتصال...");

  const q = query(bookingsRef, orderBy("date", "desc"));

  unsubscribeBookings = onSnapshot(
    q,
    snapshot => {
      allBookings = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      }));

      updateStats();
      renderList();
      setConnection("متصل · البيانات محدثة", "online");
    },
    error => {
      console.error("خطأ في مزامنة Firestore:", error);
      setConnection("تعذر الاتصال", "offline");
      listContainer.replaceChildren();

      addTextElement(
        listContainer,
        "p",
        "تعذر تحميل الحجوزات. تحقق من إعداد Firebase وقواعد Firestore واتصال الإنترنت.",
        "message"
      );
    }
  );
}

window.addEventListener("pagehide", () => {
  if (typeof unsubscribeBookings === "function") {
    unsubscribeBookings();
  }
});

startBookingsListener();
    
