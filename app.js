import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

// إعدادات Firebase الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyAWwyEb0DUY0Q_ZBluwtM4-gLQv4wNdwE",
  authDomain: "://firebaseapp.com",
  projectId: "clinic-bookings-yousef",
  storageBucket: "clinic-bookings-yousef.firebasestorage.app",
  messagingSenderId: "287479628978",
  appId: "1:287479628978:web:19acd76bd2f3f9fe7ff5ab"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ربط عناصر الواجهة بكود الجافاسكريبت
document.getElementById("saveBtn").addEventListener("click", async () => {
  const nameValue = document.getElementById("productName").value;

  if (nameValue.trim() === "") {
    alert("برجاء كتابة اسم المنتج أولاً!");
    return;
  }

  try {
    // إرسال الاسم المكتوب إلى قاعدة البيانات
    const docRef = await addDoc(collection(db, "المنتجات"), {
      name: nameValue,
      createdAt: new Date()
    });
    alert("تم الحفظ بنجاح في Firebase!");
    document.getElementById("productName").value = ""; // تفريغ الحقل بعد الحفظ
  } catch (error) {
    console.error("خطأ أثناء الحفظ: ", error);
  }
});
