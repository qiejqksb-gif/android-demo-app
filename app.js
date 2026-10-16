
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* إعدادات مشروع العيادة */
const firebaseConfig = {
  apiKey: "AIzaSyAWwyEb0DUY0Q_ZBluwtM4-gLQv4wNdwE",
  authDomain: "clinic-bookings-yousef.firebaseapp.com",
  projectId: "clinic-bookings-yousef",
  storageBucket: "clinic-bookings-yousef.firebasestorage.app",
  messagingSenderId: "287479628978",
  appId: "1:287479628978:web:19acd76bd2f3f9fe7ff5ab"
};

/*
 * معرّف المدير الذي أرسلته سابقاً.
 * تأكد أنه UID لحساب المدير في Authentication.
 */
const MANAGER_UID = "A0GUrFHbRdWeKWw35HqsQ9Ffbp43";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentRole = null;
let unsubscribeBookings = null;
let allBookings = [];
let loadingMessage = null;

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function showMessage(message) {
  let el = $("app-message");
  if (!el) {
    el = document.createElement("div");
    el.id = "app-message";
    el.setAttribute("role", "status");
    el.style.cssText =
      "position:sticky;top:0;z-index:9999;padding:12px;margin:8px;border-radius:10px;background:#152238;color:#f2cc70;text-align:center;direction:rtl";
    document.body.prepend(el);
  }
  el.textContent = message;
}

function friendlyError(error) {
  const messages = {
    "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة.",
    "auth/invalid-login-credentials": "البريد أو كلمة المرور غير صحيحة.",
    "auth/user-not-found": "الحساب غير موجود.",
    "auth/wrong-password": "كلمة المرور غير صحيحة.",
    "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
    "auth/email-already-in-use": "هذا البريد مسجل مسبقاً.",
    "auth/weak-password": "كلمة المرور ضعيفة؛ استخدم 6 أحرف أو أكثر.",
    "auth/too-many-requests": "محاولات كثيرة. انتظر قليلاً ثم حاول.",
    "auth/network-request-failed": "تحقق من اتصال الإنترنت.",
    "permission-denied": "صلاحيات Firestore تمنع العملية. لا تغيّر القواعد عشوائياً."
  };
  return messages[error?.code] ||
    `حدث خطأ: ${error?.message || "تعذر إكمال العملية."}`;
}

/* إنشاء شاشة دخول احتياطية إذا لم تكن موجودة في index.html */
function ensureLoginUI() {
  let screen = $("login-screen-ui");
  if (!screen) {
    screen = document.createElement("section");
    screen.id = "login-screen-ui";
    document.body.prepend(screen);
  }

  if (!$("login-email") || !$("login-password")) {
    screen.innerHTML = `
      <div style="max-width:420px;margin:35px auto;padding:24px;
      background:#101722;color:#f4d477;border:1px solid #b99442;
      border-radius:18px;direction:rtl;font-family:Arial,sans-serif">
        <h2 style="text-align:center">يوسف | إدارة العيادة</h2>
        <p style="text-align:center">تسجيل الدخول الآمن</p>
        <form id="firebase-login-form">
          <label for="login-email">البريد الإلكتروني</label>
          <input id="login-email" type="email" autocomplete="username"
            required style="box-sizing:border-box;width:100%;padding:12px;margin:8px 0 16px">
          <label for="login-password">كلمة المرور</label>
          <input id="login-password" type="password"
            autocomplete="current-password" required minlength="6"
            style="box-sizing:border-box;width:100%;padding:12px;margin:8px 0 16px">
          <button type="submit" style="width:100%;padding:13px;
            background:#c5a04b;color:#111;border:0;border-radius:9px">
            دخول
          </button>
          <p id="login-error" role="alert"></p>
        </form>
      </div>`;
  }

  const form = $("firebase-login-form");
  if (form && !form.dataset.bound) {
    form.dataset.bound = "1";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = $("login-email")?.value.trim();
      const password = $("login-password")?.value;
      const errorBox = $("login-error");
      if (errorBox) errorBox.textContent = "";

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        if (errorBox) errorBox.textContent = friendlyError(error);
        else showMessage(friendlyError(error));
      }
    });
  }
}

function setLoginVisible(visible) {
  const login = $("login-screen-ui");
  const main = $("app-main-content");
  if (login) login.hidden = !visible;
  if (main) main.hidden = visible;
}

/* واجهة حجوزات احتياطية إذا كانت الصفحة الرئيسية فارغة */
function ensureMainUI() {
  let main = $("app-main-content");
  if (!main) {
    main = document.createElement("main");
    main.id = "app-main-content";
    document.body.appendChild(main);
  }

  if (!$("form") || !$("list")) {
    main.innerHTML = `
      <div style="max-width:1000px;margin:auto;padding:16px;
      background:#080d16;color:#f3d47b;direction:rtl;font-family:Arial,sans-serif">
        <header style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center">
          <h2>يوسف | إدارة العيادة</h2>
          <button id="logout-button" type="button">تسجيل الخروج</button>
        </header>
        <p id="connection">جاري الاتصال...</p>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          <div>إجمالي الظاهر: <strong id="count">0</strong></div>
          <div>حجوزات اليوم: <strong id="today">0</strong></div>
          <div id="finance-box" hidden>إيرادات الظاهر: <strong id="revenue">0</strong></div>
        </div>
        <hr>
        <h3>إضافة حجز</h3>
        <form id="form">
          <label>اسم المريض *</label><input id="name" name="name" required>
          <label>العمر</label><input id="age" name="age" type="number" min="0">
          <label>رقم الهاتف</label><input id="phone" name="phone" type="tel">
          <label>الطبيب</label><input id="doctor" name="doctor">
          <label>التخصص</label><input id="specialty" name="specialty">
          <label>التاريخ *</label><input id="bookingDate" name="date" type="date" required>
          <label>الوقت</label><input id="time" name="time" type="time">
          <label>أجرة الكشفية</label><input id="fee" name="fee" type="number" min="0" step="0.01">
          <label>الحالة</label>
          <select id="status" name="status">
            <option value="محجوز">محجوز</option>
            <option value="حضر">حضر</option>
            <option value="ملغي">ملغي</option>
          </select>
          <label>ملاحظات</label><textarea id="notes" name="notes"></textarea>
          <button type="submit" id="saveBooking">حفظ الحجز</button>
        </form>
        <hr>
        <h3>قائمة الحجوزات</h3>
        <input id="search" placeholder="ابحث باسم المريض أو الهاتف">
        <input id="filterDate" type="date" aria-label="تصفية حسب التاريخ">
        <button id="clearFilters" type="button">مسح التصفية</button>
        <button id="export" type="button">تصدير CSV</button>
        <div id="list" style="display:grid;gap:10px;margin-top:12px"></div>
      </div>`;
  }

  const dateInput = $("bookingDate");
  if (dateInput && !dateInput.value) dateInput.value = todayISO();

  const logout = $("logout-button");
  if (logout && !logout.dataset.bound) {
    logout.dataset.bound = "1";
    logout.addEventListener("click", async () => {
      await signOut(auth);
    });
  }
}

function renderBookings() {
  const list = $("list");
  if (!list) return;

  const search = ($("search")?.value || "").trim().toLowerCase();
  const date = $("filterDate")?.value || "";

  const filtered = allBookings.filter((b) => {
    const text = [b.name, b.phone, b.doctor, b.specialty]
      .filter(Boolean).join(" ").toLowerCase();
    return (!search || text.includes(search)) &&
      (!date || b.date === date);
  });

  list.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = "لا توجد حجوزات مطابقة.";
    list.appendChild(empty);
  }

  for (const b of filtered) {
    const card = document.createElement("article");
    card.style.cssText =
      "padding:12px;border:1px solid #9c803c;border-radius:12px;background:#111927;color:#fff";
    const title = document.createElement("h3");
    title.textContent = b.name || "مريض بدون اسم";
    const details = document.createElement("p");
    details.textContent =
      `العمر: ${b.age || "—"} | الهاتف: ${b.phone || "—"}\n` +
      `الطبيب: ${b.doctor || "—"} | التخصص: ${b.specialty || "—"}\n` +
      `التاريخ: ${b.date || "—"} | الوقت: ${b.time || "—"}\n` +
      `الحالة: ${b.status || "محجوز"}`;
    details.style.whiteSpace = "pre-line";

    card.append(title, details);

    if (currentRole === "manager") {
      const fee = document.createElement("p");
      fee.textContent = `أجرة الكشفية: ${Number(b.fee || 0).toLocaleString("ar-IQ")}`;
      card.appendChild(fee);
    }

    if (b.notes) {
      const notes = document.createElement("p");
      notes.textContent = `ملاحظات: ${b.notes}`;
      card.appendChild(notes);
    }

    list.appendChild(card);
  }

  if ($("count")) $("count").textContent = String(filtered.length);
  if ($("today")) {
    $("today").textContent = String(
      filtered.filter((b) => b.date === todayISO()).length
    );
  }

  const revenueBox = $("finance-box");
  if (revenueBox) revenueBox.hidden = currentRole !== "manager";
  const revenueEl = $("revenue");
  if (revenueEl && currentRole === "manager") {
    revenueEl.textContent = filtered
      .filter((b) => b.status !== "ملغي")
      .reduce((sum, b) => sum + Number(b.fee || 0), 0)
      .toLocaleString("ar-IQ");
  }

  if ($("revenue-report")) {
    $("revenue-report").hidden = currentRole !== "manager";
  }
}

/*
 * دور المستخدم يقرأ من users/{uid}.
 * لا نعتمد على قيمة role محفوظة في localStorage.
 */
async function resolveRole(user) {
  if (user.uid === MANAGER_UID) return "manager";

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists() && userSnap.data().active === false) {
    throw new Error("تم إيقاف هذا الحساب. راجع المدير.");
  }

  if (userSnap.exists() && userSnap.data().role === "manager") {
    throw new Error("حساب المدير يجب أن يكون محدداً في إعدادات موثوقة.");
  }

  if (userSnap.exists() && userSnap.data().role === "employee") {
    return "employee";
  }

  /*
   * الحساب الجديد يصبح موظفاً.
   * قد تمنع قواعد Firestore هذه العملية حتى تضبط قواعد التسجيل.
   */
  await setDoc(userRef, {
    uid: user.uid,
    email: user.email || "",
    role: "employee",
    active: true,
    createdAt: serverTimestamp()
  }, { merge: true });

  return "employee";
}

function startBookings() {
  if (unsubscribeBookings) unsubscribeBookings();

  const bookingsRef = collection(db, "bookings");

  /*
   * المدير يقرأ الحجوزات كلها.
   * الموظف يقرأ فقط الحجوزات المسندة إلى UID الخاص به.
   * الحجوزات القديمة بلا ownerUid لا تظهر للموظفين.
   */
  const q = currentRole === "manager"
    ? query(bookingsRef, orderBy("date", "desc"))
    : query(
        bookingsRef,
        where("ownerUid", "==", currentUser.uid),
        orderBy("date", "desc")
      );

  unsubscribeBookings = onSnapshot(q, (snapshot) => {
    allBookings = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));
    if ($("connection")) $("connection").textContent = "متصل — المزامنة تعمل";
    renderBookings();
  }, (error) => {
    if ($("connection")) $("connection").textContent = "تعذر تحميل الحجوزات";
    showMessage(friendlyError(error));
  });
}

async function saveBooking(event) {
  event.preventDefault();
  if (!currentUser || !currentRole) {
    showMessage("سجل الدخول أولاً.");
    return;
  }

  const value = (id) => $(id)?.value?.trim() || "";
  const name = value("name");
  const date = value("bookingDate") || value("date");

  if (!name || !date) {
    showMessage("اكتب اسم المريض وتاريخ الحجز.");
    return;
  }

  const feeText = value("fee");
  const fee = feeText === "" ? 0 : Number(feeText);

  if (!Number.isFinite(fee) || fee < 0) {
    showMessage("أدخل أجرة كشفية صحيحة.");
    return;
  }

  const booking = {
    name,
    age: value("age"),
    phone: value("phone"),
    doctor: value("doctor"),
    specialty: value("specialty"),
    date,
    time: value("time"),
    fee,
    status: value("status") || "محجوز",
    notes: value("notes"),
    ownerUid: currentUser.uid,
    ownerEmail: currentUser.email || "",
    createdAt: serverTimestamp()
  };

  try {
    const button = $("saveBooking") ||
      $("form")?.querySelector('[type="submit"]');
    if (button) button.disabled = true;

    await addDoc(collection(db, "bookings"), booking);
    $("form")?.reset();
    if ($("bookingDate")) $("bookingDate").value = todayISO();
    showMessage("تم حفظ الحجز بنجاح.");
  } catch (error) {
    showMessage(friendlyError(error));
  } finally {
    const button = $("saveBooking") ||
      $("form")?.querySelector('[type="submit"]');
    if (button) button.disabled = false;
  }
}

function exportCSV() {
  if (currentRole !== "manager") {
    showMessage("تصدير التقارير المالية متاح للمدير فقط.");
    return;
  }

  const fields = [
    ["name", "اسم المريض"],
    ["age", "العمر"],
    ["phone", "الهاتف"],
    ["doctor", "الطبيب"],
    ["specialty", "التخصص"],
    ["date", "التاريخ"],
    ["time", "الوقت"],
    ["fee", "أجرة الكشفية"],
    ["status", "الحالة"],
    ["notes", "ملاحظات"]
  ];

  const quote = (v) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const rows = [
    fields.map((f) => quote(f[1])).join(","),
    ...allBookings.map((b) =>
      fields.map((f) => quote(b[f[0]])).join(",")
    )
  ];

  const blob = new Blob(
    ["\uFEFF" + rows.join("\r\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clinic-bookings-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function bindControls() {
  const form = $("form");
  if (form && !form.dataset.bound) {
    form.dataset.bound = "1";
    form.addEventListener("submit", saveBooking);
  }

  for (const id of ["search", "filterDate"]) {
    const el = $(id);
    if (el && !el.dataset.bound) {
      el.dataset.bound = "1";
      el.addEventListener("input", renderBookings);
      el.addEventListener("change", renderBookings);
    }
  }

  const clear = $("clearFilters");
  if (clear && !clear.dataset.bound) {
    clear.dataset.bound = "1";
    clear.addEventListener("click", () => {
      if ($("search")) $("search").value = "";
      if ($("filterDate")) $("filterDate").value = "";
      renderBookings();
    });
  }

  const exportButton = $("export");
  if (exportButton && !exportButton.dataset.bound) {
    exportButton.dataset.bound = "1";
    exportButton.addEventListener("click", exportCSV);
  }
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  allBookings = [];

  if (unsubscribeBookings) {
    unsubscribeBookings();
    unsubscribeBookings = null;
  }

  if (!user) {
    currentRole = null;
    ensureLoginUI();
    setLoginVisible(true);
    return;
  }

  try {
    ensureMainUI();
    bindControls();

    currentRole = await resolveRole(user);
    setLoginVisible(false);

    const roleLabel = currentRole === "manager" ? "المدير" : "الموظف";
    showMessage(`أهلاً بك — ${roleLabel}`);

    startBookings();
  } catch (error) {
    currentRole = null;
    setLoginVisible(true);
    showMessage(friendlyError(error));
  }
});

ensureLoginUI();
  
