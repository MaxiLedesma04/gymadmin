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
const auth = firebase.auth();
const firestore = firebase.firestore(); // Cambiado de 'db' a 'firestore'

// Referencias a las colecciones
const clientesRef = firestore.collection("clientes");
const pagosRef = firestore.collection("pagos");
const configuracionRef = firestore.collection("configuracion");

// Función para obtener el UID del usuario actual
function getCurrentUserUID() {
  const user = auth.currentUser;
  return user ? user.uid : null;
}

// Función para verificar autenticación
function checkAuth() {
  auth.onAuthStateChanged(user => {
    if (!user) {
      // Redirigir a página de login si no está autenticado
      window.location.href = "login.html";
    }
  });
}

// Exportar referencias y funciones si es necesario
window.firebaseAuth = auth;
window.firebaseDB = firestore; // Cambiado de 'db' a 'firestore'
window.firebaseConfig = {
  clientesRef,
  pagosRef,
  configuracionRef,
  getCurrentUserUID,
  checkAuth
};