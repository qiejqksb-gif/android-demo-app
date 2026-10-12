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

// عناصر الواجهة
const dlg = document.getElementById("dlg");
const addBtn = document.getElementById("add");
const cancelBtn = document.getElementById("cancel");
const form = document.getElementById("form");
const listContainer = document.getElementById("list");
const countEl = document.getElementById("count");
const todayEl = document.getElementById("today");
const searchInput = document.getElementById("search");
const filterDateInput = document.getElementById("filterDate");
const exportBtn = document.getElementById("export");

let allBookings = []; // مصفوفة لتخزين البيانات محلياً للبحث والفلترة السريعة

// فتح وإغلاق نافذة إضافة حجز
addBtn.addEventListener("click", () => dlg.showModal());
cancelBtn.addEventListener("click", () => dlg.close());

// دالة جلب الحجوزات من الفايربيس وعرضها
async function loadBookings() {
  listContainer.innerHTML = "<p>جاري تحميل الحجوزات...</p>";
  try {
    const q = query(collection(db, "bookings"), orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    
    allBookings = [];
    querySnapshot.forEach((doc) => {
      allBookings.push({ id: doc.id, ...doc.data() });
    });
    
    renderList(allBookings);
    updateStats();
  } catch (error) {
    console.error("خطأ أثناء تحميل البيانات: ", error);
    listContainer.innerHTML = "<p>فشل في تحميل الحجوزات.</p>";
  }
}

// دالة بناء كروت المرضى وتحديث القائمة في الواجهة
function renderList(bookingsArray) {
  listContainer.innerHTML = "";
  if (bookingsArray.length === 0) {
    listContainer.innerHTML = "<p>لا توجد حجوزات متطابقة.</p>";
    return;
  }
  
  bookingsArray.forEach((data) => {
    const card = document.createElement("div");
    card.className = "booking-card";
    card.innerHTML = `
      <h3>${data.name} (${data.age || 'غير محدد'} سنة)</h3>
      <p><b>الهاتف:</b> ${data.phone || 'لا يوجد'} | <b>الطبيب:</b> ${data.doctor || 'غير محدد'}</p>
      <p><b>التاريخ:</b> ${data.date} | <b>الوقت:</b> ${data.time || '--:--'}</p>
      <p><b>الحالة:</b> <span class="status-${data.status}">${data.status}</span></p>
      ${data.notes ? `<p><b>ملاحظات:</b> \${data.notes}</p>` : ''}
      <hr>
    `;
    listContainer.appendChild(card);
  });
}

// دالة تحديث الإحصائيات (العدد الكلي وحجوزات اليوم)
function updateStats() {
  countEl.textContent = allBookings.length;
  
  // الحصول على تاريخ اليوم بصيغة YYYY-MM-DD المتوافقة مع حقول الإدخال
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = allBookings.filter(b => b.date === todayStr).length;
  todayEl.textContent = todayCount;
}

// تفعيل خاصية البحث الفوري أثناء الكتابة
searchInput.addEventListener("input", () => {
  const queryText = searchInput.value.toLowerCase();
  const filtered = allBookings.filter(b => 
    b.name.toLowerCase().includes(queryText) || 
    (b.phone && b.phone.includes(queryText))
  );
  renderList(filtered);
});

// تفعيل فلتر التصفية حسب التاريخ
filterDateInput.addEventListener("change", () => {
  const selectedDate = filterDateInput.value;
  if (!selectedDate) {
    renderList(allBookings);
    return;
  }
  const filtered = allBookings.filter(b => b.date === selectedDate);
  renderList(filtered);
});

// دالة حفظ الحجز الجديد
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
    loadBookings();
  } catch (error) {
    alert("حدث خطأ أثناء الحفظ!");
    console.error(error);
  }
});

// تفعيل زر تصدير البيانات إلى ملف CSV (Excel)
exportBtn.addEventListener("click", () => {
  if (allBookings.length === 0) {
    alert("لا توجد بيانات لتصديرها!");
    return;
  }
  
  // إعداد عناوين الأعمدة
  let csvContent = "\uFEFFاسم المريض,العمر,رقم الهاتف,الطبيب,التاريخ,الوقت,الحالة,ملاحظات\n";
  
  // تجميع البيانات
  allBookings.forEach(b => {
    csvContent += `"${b.name}","${b.age || ''}","${b.phone || ''}","${b.doctor || ''}","${b.date}","${b.time || ''}","${b.status}","${b.notes || ''}"\n`;
  });
  
  // تحميل الملف للمستخدم
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `سجل_الحجوزات_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// تشغيل جلب البيانات عند بدء التطبيق
loadBookings();
