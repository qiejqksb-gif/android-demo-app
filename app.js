// 1. استيراد مكتبات Firebase و Firestore من خوادم الويب مباشرة
import { initializeApp } from "https://gstatic.com";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot } from "https://gstatic.com";

// 2. إعدادات Firebase الخاصة بمشروعك (المأخوذة من صورتك)
const firebaseConfig = {
  apiKey: "AIzaSyAWwyEb0DUyDQ_Z8LuwcgM-gLQvv4eWdzE",
  authDomain: "://firebaseapp.com",
  projectId: "clinic-bookings-yousef",
  storageBucket: "clinic-bookings-yousef.firebasestorage.app",
  messagingSenderId: "287479628978",
  appId: "1:287479628978:web:19acd76bd2f3f91ef075ab",
  measurementId: "G-7395STP3BY"
};

// 3. تهيئة Firebase و Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// مرجع لمجموعة الحجوزات في قاعدة البيانات
const bookingsCollection = collection(db, "users");

const \$=s=>document.querySelector(s);
let rows = [];
const today=()=>new Date().toISOString().slice(0,10);

function esc(s){return String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}

// 4. جلب البيانات والمزامنة الفورية من Firebase Firestore بدلاً من localStorage
onSnapshot(bookingsCollection, (snapshot) => {
    rows = [];
    snapshot.forEach((doc) => {
        rows.push({ id: doc.id, ...doc.data() });
    });
    render();
});

function render(){
    let q=\(("#search").value.toLowerCase(),d=\)("#filterDate").value;
    let list=rows.filter(x=>(!q||[x.name,x.phone,x.doctor].some(v=>String(v||"").toLowerCase().includes(q)))&&(!d||x.date===d));
    \$("#count").textContent=rows.length;
    \$("#today").textContent=rows.filter(x=>x.date===today()).length;
    \$("#list").innerHTML=list.map(x=>`<div class="booking"><div><b>${esc(x.name)}</b><div class="muted">${esc(x.doctor)} ${x.specialty?"— "+esc(x.specialty):""}</div><div class="muted">${esc(x.date)} ${esc(x.time)} · ${esc(x.phone)}</div><div class="muted">الكشفية: ${esc(x.fee)} · ${esc(x.status)}</div></div><div class="actions"><button onclick="editRow('${x.id}')">تعديل</button><button onclick="delRow('${x.id}')">حذف</button></div></div>`).join("")||'<div class="empty">لا توجد حجوزات مطابقة.</div>'
}

\$("#add").onclick=()=>openForm();
\(("#cancel").onclick=()=>\)("#dlg").close();

function openForm(id){
    let x=rows.find(r=>r.id===id)||{id:"",date:today(),status:"محجوز"};
    let f=\$("#form");
    for(let e of f.elements){if(e.name)e.value=x[e.name]||""}
    f.dataset.id=x.id;
    \$("#dlg").showModal()
}

window.editRow=id=>openForm(id);

// 5. الحذف من قاعدة البيانات أونلاين
window.delRow=async id=>{
    if(confirm("تأكيد حذف الحجز؟")){
        await deleteDoc(doc(db, "users", id));
    }
};

// 6. الإرسال والتعديل في قاعدة البيانات أونلاين
\$("#form").onsubmit=async e=>{
    e.preventDefault();
    let x=Object.fromEntries(new FormData(e.target));
    let id=e.target.dataset.id;
    
    \$("#dlg").close();
    
    if(!id) {
        // إضافة حجز جديد
        await addDoc(bookingsCollection, x);
    } else {
        // تعديل حجز الحالي
        await updateDoc(doc(db, "users", id), x);
    }
};

\$("#search").oninput=render;
\$("#filterDate").onchange=render;

\$("#export").onclick=()=>{
    let keys=["name","age","phone","doctor","specialty","date","time","fee","status","notes"];
    let csv="\ufeff"+keys.join(",")+"\n"+rows.map(x=>keys.map(k=>'"'+String(x[k]||"").replaceAll('"','""')+'"').join(",")).join("\n");
    let a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    a.download="سجل_الحجوزات.csv";
    a.click()
};
