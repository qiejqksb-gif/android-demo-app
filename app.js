import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";

// إعدادات Firebase الخاصة بمشروعك
const firebaseConfig = {
  apiKey: "AIzaSyAWwyEb0DUY0Q_ZBluwtM4-gLQv4wNdwE",
  authDomain: "://firebaseapp.com",
  projectId: "clinic-bookings-yousef",
  storageBucket: "clinic-bookings-yousef.firebasestorage.app",
  messagingSenderId: "287479628978",
  appId: "1:287479628978:web:19acd76bd2f3f9fe7ff5ab",
  measurementId: "G-7395STP39Y"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// عناصر الواجهة المأخوذة من الـ HTML
const dlg = document.getElementById("dlg");
const addBtn = document.getElementById("add");
const cancelBtn = document.getElementById("cancel");
const form = document.getElementById("form");
const listContainer = document.getElementById("list");
const countEl = document.getElementById("count");

// فتح وإغلاق نافذة إضافة حجز (Dialog)
addBtn.addEventListener("click", () => dlg.showModal());
cancelBtn.addEventListener("click", () => dlg.close());

// دالة لجلب الحجوزات وعرضها في الصفحة
async function loadBookings() {
  listContainer.innerHTML = "<p>جاري تحميل الحجوزات...</p>";
  try {
    const q = query(collection(db, "bookings"), orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    listContainer.innerHTML = "";
    
    let total = 0;
    querySnapshot.forEach((doc) => {
      total++;
      const data = doc.data();
      
      // إنشاء كارد لكل مريض في الواجهة
      const card = document.createElement("div");
      card.className = "booking-card";
      card.innerHTML = `
        <h3>${data.name} (${data.age || 'غير محدد'} سنة)</h3>
        <p><b>الهاتف:</b> ${data.phone || 'لا يوجد'} | <b>الطبيب:</b> ${data.doctor || 'غير محدد'}</p>
        <p><b>التاريخ:</b> ${data.date} | <b>الوقت:</b> ${data.time || '--:--'}</p>
        <p><b>الحالة:</b> <span>${data.status}</span></p>
        <hr>
      `;
      listContainer.appendChild(card);
    });
    
    countEl.textContent = total;
  } catch (error) {
    console.error("خطأ أثناء تحميل البيانات: ", error);
    listContainer.innerHTML = "<p>فشل في تحميل الحجوزات.</p>";
  }
}

// دالة إرسال وحفظ الحجز الجديد عند الضغط على زر حفظ
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const formData = new FormData(form);
  const bookingData = {
    name: formData.get("name"),
    age: formData.get("age"),
    phone: formData.get("phone"),
    doctor: formData.get("doctor"),
    specialty: formData.get("specialty"),
    date: formData.get("date"),
    time: formData.get("time"),
    fee: formData.get("fee"),
    status: formData.get("status"),
    notes: formData.get("notes"),
    createdAt: new Date()
  };

  try {
    await addDoc(collection(db, "bookings"), bookingData);
    alert("تم تسجيل الحجز بنجاح!");
    form.reset();
    dlg.close();
    loadBookings(); // تحديث القائمة فوراً بعد الإضافة
  } catch (error) {
    alert("حدث خطأ أثناء الحفظ، يرجى المحاولة لاحقاً.");
    console.error(error);
  }
});

// تشغيل جلب البيانات بمجرد فتح التطبيق
loadBookings();
