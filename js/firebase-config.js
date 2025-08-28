// js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyDwAWPlMxU-9CgApr2c0kNRSw-YHjoxlKc",
  authDomain: "gymadmin-app.firebaseapp.com",
  projectId: "gymadmin-app",
  storageBucket: "gymadmin-app.firebasestorage.app",
  messagingSenderId: "898927441743",
  appId: "1:898927441743:web:7e6ebe29e87b608ae1b73a",
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar servicios de Firebase
const authFirebase = firebase.auth();
const dbFirebase = firebase.firestore();

// Función para obtener el UID del usuario actual
function getCurrentUserUID() {
  const user = authFirebase.currentUser;
  return user ? user.uid : null;
}

// Función para verificar autenticación
function checkAuth(callback) {
  authFirebase.onAuthStateChanged((user) => {
    if (callback) callback(user);
  });
}

// Exportar para uso global
window.authFirebase = authFirebase;
window.dbFirebase = dbFirebase;
window.getCurrentUserUID = getCurrentUserUID;
window.checkAuth = checkAuth;
