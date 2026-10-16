
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* إعدادات Firebase الموجودة في مشروعك */
const firebaseConfig = {
  apiKey: "AIzaSyAWwyEb0DUY0Q_ZBluwtM4-gLQv4wNdwE",
  authDomain: "clinic-bookings-yousef.firebaseapp.com",
  projectId: "clinic-bookings-yousef",
  storageBucket: "clinic-bookings-yousef.firebasestorage.app",
  messagingSenderId: "287479628978",
  appId: "1:287479628978:web:19acd76bd2f3f9fe7ff5ab"
};

/* UID المدير الموجود في إعدادات المشروع */
const MANAGER_UID = "A0GUrFHbRdWeKWw35HqsQ9Ffbp43";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

let currentUser = null;
let currentRole = null;
let stopBookings = null;
let bookings = [];

function message(text) {
  let box = $("app-message");
  if (!box) {
    box = document.createElement("div");
    box.id = "app-message";
    box.style.cssText =
      "position:fixed;top:8px;left:8px;right:8px;z-index:10001;" +
      "padding:12px;background:#172238;color:#f5d477;" +
      "border:1px solid #c6a34c;border-radius:10px;text-align:center;direction:rtl";
    document.body.appendChild(box);
  }
  box.textContent = text;
}

function errorText(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") ||
      code.includes("wrong-password") ||
      code.includes("user-not-found")) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  }
  if (code.includes("invalid-email")) return "صيغة البريد الإلكتروني غير صحيحة.";
  if (code.includes("too-many-requests")) return "محاولات كثيرة؛ انتظر قليلاً.";
  if (code.includes("network-request-failed")) return "تحقق من اتصال الإنترنت.";
  if (code.includes("permission-denied")) return "الصلاحيات تمنع الوصول؛ لا تغيّر القواعد الآن.";
  return "تعذر إكمال العملية: " + (error?.message || code || "خطأ غير معروف");
}

/* شاشة الدخول: تظهر حقول الإيميل والرمز فعلياً */
function makeLogin() {
  let screen = $("login-screen-ui");
  if (!screen) {
    screen = document.createElement("section");
    screen.id = "login-screen-ui";
    document.body.prepend(screen);
  }

  screen.innerHTML = `
    <div style="min-height:100vh;box-sizing:border-box;display:flex;
      align-items:center;justify-content:center;padding:20px;
      background:#070a10;color:#f2d276;direction:rtl;font-family:Arial">
      <form id="clinic-login-form" style="box-sizing:border-box;width:100%;
        max-width:420px;padding:25px;background:#111827;
        border:1px solid #b99745;border-radius:18px">
        <h2 style="text-align:center">يوسف | إدارة العيادة</h2>
        <p style="text-align:center;color:#ddd">تسجيل دخول المدير أو الموظف</p>

        <label for="clinic-email">البريد الإلكتروني</label>
        <input id="clinic-email" type="email" autocomplete="username"
          required placeholder="name@example.com"
          style="box-sizing:border-box;width:100%;padding:13px;margin:10px 0 18px;
          border-radius:8px;border:1px solid #b99745;font-size:16px">

        <label for="clinic-password">كلمة المرور</label>
        <input id="clinic-password" type="password"
          autocomplete="current-password" required
          style="box-sizing:border-box;width:100%;padding:13px;margin:10px 0 18px;
          border-radius:8px;border:1px solid #b99745;font-size:16px">

        <button id="clinic-login-button" type="submit"
          style="width:100%;padding:14px;background:#c6a34c;color:#111;
          border:0;border-radius:9px;font-size:17px;font-weight:bold">
          تسجيل الدخول
        </button>
        <p id="clinic-login-error" role="alert" style="color:#ffaaaa"></p>
      </form>
    </div>`;

  screen.hidden = false;

  $("clinic-login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("clinic-email").value.trim();
    const password = $("clinic-password").value;
    const button = $("clinic-login-button");
    const error = $("clinic-login-error");

    error.textContent = "";
    button.disabled = true;
    button.textContent = "جارٍ التحقق...";

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      error.textContent = errorText(e);
    } finally {
      button.disabled = false;
      button.textContent = "تسجيل الدخول";
    }
  });
}

function showLogin(show) {
  const screen = $("login-screen-ui");
  if (screen) screen.hidden = !show;

  /* إخفاء واجهة الحجوزات أثناء تسجيل الخروج */
  document.querySelectorAll("body > header, body > main").forEach(el => {
    el.hidden = show;
  });
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function displayBookings() {
  const list = $("list");
  if (!list) return;

  const search = ($("search")?.value || "").trim().toLowerCase();
  const date = $("filterDate")?.value || "";

  const shown = bookings.filter(b => {
    const words = [b.name, b.phone, b.doctor, b.specialty]
      .filter(Boolean).join(" ").toLowerCase();
    return (!search || words.includes(search)) &&
           (!date || b.date === date);
  });

  list.replaceChildren();

  if (!shown.length) {
    const empty = document.createElement("p");
    empty.textContent = "لا توجد حجوزات مطابقة.";
    list.appendChild(empty);
  }

  shown.forEach(b => {
    const card = document.createElement("article");
    card.style.cssText =
      "margin:8px 0;padding:14px;background:#111827;color:white;" +
      "border:1px solid #b99745;border-radius:12px";

    const title = document.createElement("h3");
    title.textContent = b.name || "مريض";
    const details = document.createElement("p");
    details.style.whiteSpace = "pre-line";
    details.textContent =
      `العمر: ${b.age || "—"} | الهاتف: ${b.phone || "—"}\n` +
      `الطبيب: ${b.doctor || "—"} | الاختصاص: ${b.specialty || "—"}\n` +
      `التاريخ: ${b.date || "—"} | الوقت: ${b.time || "—"}\n` +
      `الحالة: ${b.status || "محجوز"}`;

    card.append(title, details);

    if (currentRole === "manager") {
      const fee = document.createElement("p");
      fee.textContent = "أجرة الكشفية: " +
        Number(b.fee || 0).toLocaleString("ar-IQ") + " د.ع";
      card.appendChild(fee);
    }

    if (b.notes) {
      const notes = document.createElement("p");
      notes.textContent = "ملاحظات: " + b.notes;
      card.appendChild(notes);
    }
    list.appendChild(card);
  });

  if ($("count")) $("count").textContent = shown.length;
  if ($("today")) {
    $("today").textContent = shown.filter(b => b.date === today()).length;
  }
  if ($("revenue")) {
    $("revenue").textContent = currentRole === "manager"
      ? shown.filter(b => b.status !== "ملغي")
          .reduce((sum,b) => sum + Number(b.fee || 0), 0)
          .toLocaleString("ar-IQ") + " د.ع"
      : "—";
  }
}

async function resolveRole(user) {
  if (user.uid === MANAGER_UID) return "manager";

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists() &&
      snap.data().active !== false &&
      snap.data().role === "employee") {
    return "employee";
  }

  throw new Error("هذا الحساب غير مفعّل كموظف. راجع المدير.");
}

function loadBookings() {
  if (stopBookings) stopBookings();

  const ref = collection(db, "bookings");
  const q = currentRole === "manager"
    ? ref
    : query(ref, where("ownerUid", "==", currentUser.uid));

  stopBookings = onSnapshot(q, snapshot => {
    bookings = snapshot.docs.map(d => ({id:d.id, ...d.data()}));
    bookings.sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    if ($("connection")) $("connection").textContent = "متصل — المزامنة تعمل";
    displayBookings();
  }, error => {
    if ($("connection")) $("connection").textContent = "تعذر تحميل الحجوزات";
    message(errorText(error));
  });
}

function bindApp() {
  if ($("logout-button") && !$("logout-button").dataset.ready) {
    $("logout-button").dataset.ready = "1";
    $("logout-button").addEventListener("click", () => signOut(auth));
  }

  if ($("form") && !$("form").dataset.ready) {
    $("form").dataset.ready = "1";
    $("form").addEventListener("submit", async event => {
      event.preventDefault();
      if (!currentUser) return message("سجّل الدخول أولاً.");

      const val = id => $(id)?.value?.trim() || "";
      const name = val("name");
      const date = val("bookingDate") || val("date");
      if (!name || !date) return message("أدخل اسم المريض وتاريخ الحجز.");

      const booking = {
        name,
        age: val("age"),
        phone: val("phone"),
        doctor: val("doctor"),
        specialty: val("specialty"),
        date,
        time: val("time"),
        fee: Number(val("fee") || 0),
        status: val("status") || "محجوز",
        notes: val("notes"),
        ownerUid: currentUser.uid,
        ownerEmail: currentUser.email || "",
        createdAt: serverTimestamp()
      };

      try {
        await addDoc(collection(db, "bookings"), booking);
        $("form").reset();
        if ($("bookingDate")) $("bookingDate").value = today();
        if ($("dlg")?.open) $("dlg").close();
        message("تم حفظ الحجز.");
      } catch (e) {
        message(errorText(e));
      }
    });
  }

  if ($("add") && !$("add").dataset.ready) {
    $("add").dataset.ready = "1";
    $("add").addEventListener("click", () => {
      if ($("bookingDate")) $("bookingDate").value = today();
      if ($("dlg")?.showModal) $("dlg").showModal();
    });
  }

  if ($("cancel") && !$("cancel").dataset.ready) {
    $("cancel").dataset.ready = "1";
    $("cancel").addEventListener("click", () => $("dlg")?.close());
  }

  ["search", "filterDate"].forEach(id => {
    const el = $(id);
    if (el && !el.dataset.ready) {
      el.dataset.ready = "1";
      el.addEventListener("input", displayBookings);
      el.addEventListener("change", displayBookings);
    }
  });

  if ($("clearFilters") && !$("clearFilters").dataset.ready) {
    $("clearFilters").dataset.ready = "1";
    $("clearFilters").addEventListener("click", () => {
      if ($("search")) $("search").value = "";
      if ($("filterDate")) $("filterDate").value = "";
      displayBookings();
    });
  }
}

makeLogin();
bindApp();

onAuthStateChanged(auth, async user => {
  currentUser = user;
  bookings = [];

  if (stopBookings) {
    stopBookings();
    stopBookings = null;
  }

  if (!user) {
    currentRole = null;
    showLogin(true);
    return;
  }

  try {
    currentRole = await resolveRole(user);
    showLogin(false);
    bindApp();
    loadBookings();
    message(currentRole === "manager" ? "أهلاً بك — المدير" : "أهلاً بك — الموظف");
  } catch (e) {
    currentRole = null;
    await signOut(auth);
    showLogin(true);
    const error = $("clinic-login-error");
    if (error) error.textContent = errorText(e);
  }
});
  
