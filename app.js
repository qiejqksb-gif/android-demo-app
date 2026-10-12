// 1. استيراد المكتبات الأساسية المطلوبة لتشغيل Firebase
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// 2. كود الإعدادات الخاص بقاعدة بيانات تطبيقك
const firebaseConfig = {
  apiKey: "AIzaSyAWwyEb0DUY0Q_ZBluwtM4-gLQv4wNdwE",
  authDomain: "://firebaseapp.com",
  projectId: "clinic-bookings-yousef",
  storageBucket: "clinic-bookings-yousef.firebasestorage.app",
  messagingSenderId: "287479628978",
  appId: "1:287479628978:web:19acd76bd2f3f9fe7ff5ab",
  measurementId: "G-7395STP39Y"
};

// 3. تشغيل وتهيئة الخدمة داخل التطبيق
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
