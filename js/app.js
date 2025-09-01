// Al inicio de app.js, antes de inicializar Firebase
const isFirebaseAvailable =
  typeof firebase !== "undefined" && firebase.apps.length > 0;

if (!isFirebaseAvailable) {
  console.log("Firebase no disponible, usando modo offline");
  // Aquí cargarías datos desde localStorage
}

console.log("🎯 app.js cargado correctamente");

// DEBUG: Verificar que Firebase está disponible
console.log("Firebase disponible:", typeof firebase !== "undefined");
if (typeof firebase !== "undefined") {
  console.log("Apps de Firebase:", firebase.apps.length);
}
// Variables globales para Firebase
let dbFirebase = null;
let authFirebase = null;
let userUID = null;
let isAuthenticated = false;

// Configuración de la base de datos (ahora con Firebase + localStorage para offline)
let db = {
  clientes: JSON.parse(localStorage.getItem("clientes")) || [],
  pagos: JSON.parse(localStorage.getItem("pagos")) || [],
  configuracion: JSON.parse(localStorage.getItem("configuracion")) || {
    nombreGimnasio: "Mi Gimnasio",
    direccion: "",
    telefono: "",
    precios: {
      basica: 1000,
      premium: 1500,
      oro: 2000,
      platino: 2500,
    },
    notificaciones: {
      vencimientos: true,
      pagos: true,
      nuevosClientes: true,
      diasAnticipacion: 3,
    },
  },
};

// Variable para almacenar el ID del cliente a eliminar
let clienteIdAEliminar = null;

// Inicializar Firebase
function inicializarFirebase() {
  try {
    if (typeof firebase !== "undefined") {
      dbFirebase = firebase.firestore();
      authFirebase = firebase.auth();
      console.log("✅ Firebase inicializado correctamente");

      // Configurar persistencia de autenticación
      authFirebase
        .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
          console.log("✅ Persistencia de autenticación configurada");

          // Configurar observador de autenticación
          authFirebase.onAuthStateChanged((user) => {
            console.log(
              "🔄 Estado de autenticación cambiado:",
              user ? "Autenticado" : "No autenticado"
            );

            if (user) {
              // Usuario autenticado
              userUID = user.uid;
              isAuthenticated = true;
              console.log("✅ Usuario autenticado:", userUID);

              // Ocultar modal de login si está visible
              const modalLogin = document.getElementById("modal-login");
              if (modalLogin) {
                modalLogin.classList.remove("active");
              }

              // Actualizar UI de autenticación
              actualizarUIautenticado();

              // Cargar datos desde Firebase
              cargarDatosDesdeFirebase();
            } else {
              // Usuario no autenticado - NO CARGAR DATOS LOCALES
              console.log("❌ Usuario no autenticado - Mostrando modal");
              isAuthenticated = false;
              userUID = null;

              // LIMPIAR DATOS LOCALES
              db.clientes = [];
              db.pagos = [];

              // Mostrar modal de login inmediatamente
              mostrarModalLogin();

              // Limpiar la UI
              actualizarUI(); // Esto mostrará tablas vacías
            }
          });
        })
        .catch((error) => {
          console.error("❌ Error configurando persistencia:", error);
          // NO cargar datos locales aquí tampoco
          db.clientes = [];
          db.pagos = [];
          mostrarModalLogin();
          actualizarUI();
        });
    } else {
      console.log("⚠️ Firebase no disponible");
      // Mostrar modal de login igualmente
      mostrarModalLogin();
    }
  } catch (error) {
    console.error("❌ Error inicializando Firebase:", error);
    // Mostrar modal de login en caso de error
    mostrarModalLogin();
  }
}

function mostrarModalLogin() {
  // ✅ VERIFICAR SI YA ESTÁ AUTENTICADO PRIMERO
  if (isAuthenticated) {
    console.log("✅ Usuario ya autenticado, no mostrar modal");
    return; // No mostrar modal si ya está logueado
  }

  // Solo crear el modal si no existe
  if (!document.getElementById("modal-login")) {
    const modalHTML = `
        <div class="modal-backdrop active" id="modal-login" style="z-index: 10000; display: flex;">
            <div class="modal" style="max-width: 400px; margin: auto;">
                <div class="modal-header">
                    <h3><i class="fas fa-lock"></i> Iniciar Sesión</h3>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="login-email">Email</label>
                        <input type="email" id="login-email" placeholder="tu@email.com" value="">
                    </div>
                    <div class="form-group">
                        <label for="login-password">Contraseña</label>
                        <input type="password" id="login-password" placeholder="Tu contraseña" value="">
                    </div>
                    <div class="form-group" style="display: flex; flex-direction: column; gap: 10px;">
                        <button id="btn-registrar" style="background: #27ae60;">
                            <i class="fas fa-user-plus"></i> Crear Cuenta
                        </button>
                        <button id="btn-login" style="background: #3498db;">
                            <i class="fas fa-sign-in-alt"></i> Iniciar Sesión
                        </button>
                    </div>
                    <p style="text-align: center; margin-top: 15px; font-size: 12px; color: #666;">
                        Usa test@test.com / 123456 para probar
                    </p>
                </div>
            </div>
        </div>
        `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // Configurar event listeners
    document
      .getElementById("btn-login")
      .addEventListener("click", iniciarSesion);
    document
      .getElementById("btn-registrar")
      .addEventListener("click", registrarUsuario);

    // Permitir login con Enter
    document
      .getElementById("login-password")
      .addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          iniciarSesion();
        }
      });
  } else {
    // Si ya existe, mostrarlo SOLO si no está autenticado
    if (!isAuthenticated) {
      document.getElementById("modal-login").classList.add("active");
    } else {
      // Si está autenticado, asegurarse de ocultarlo
      ocultarModalLogin();
    }
  }
}


function ocultarModalLogin() {
  const modal = document.getElementById("modal-login");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";

    // Opcional: eliminar el modal completamente del DOM
    // modal.remove();
  }
}



// Función para registrar usuario
async function registrarUsuario() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    alert("Por favor, completa ambos campos");
    return;
  }

  if (password.length < 6) {
    alert("La contraseña debe tener al menos 6 caracteres");
    return;
  }

  try {
    const userCredential = await authFirebase.createUserWithEmailAndPassword(
      email,
      password
    );
    console.log("✅ Usuario registrado:", userCredential.user.uid);

    // Crear configuración inicial para el nuevo usuario
    await guardarConfiguracionEnFirebase(db.configuracion);

    alert("Cuenta creada exitosamente. Ya puedes usar la aplicación.");
  } catch (error) {
    console.error("❌ Error al registrar:", error);
    alert("Error al crear cuenta: " + error.message);
  }
}

// Función para iniciar sesión
async function iniciarSesion() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    alert("Por favor, completa ambos campos");
    return;
  }

  try {
    await authFirebase.signInWithEmailAndPassword(email, password);
    console.log("✅ Sesión iniciada correctamente");

    // ✅ OCULTAR MODAL INMEDIATAMENTE DESPUÉS DE LOGIN EXITOSO
    ocultarModalLogin();
  } catch (error) {
    console.error("❌ Error al iniciar sesión:", error);

    // Si el usuario no existe, ofrecer crearlo
    if (error.code === "auth/user-not-found") {
      if (confirm("Usuario no encontrado. ¿Deseas crear una nueva cuenta?")) {
        registrarUsuario();
      }
    } else {
      alert("Error al iniciar sesión: " + error.message);
    }
  }
}

// Función para cerrar sesión
function cerrarSesion() {
  authFirebase
    .signOut()
    .then(() => {
      console.log("✅ Sesión cerrada");
      // Recargar la página para limpiar el estado
      window.location.reload();
    })
    .catch((error) => {
      console.error("❌ Error al cerrar sesión:", error);
    });
}

// Cargar datos desde Firebase
async function cargarDatosDesdeFirebase() {
  if (!dbFirebase || !userUID) {
    console.log("⚠️ Firebase no disponible, usando datos locales");
    return; // No cargar datos locales aquí, ya se hicieron antes
  }

  try {
    console.log("📥 Cargando datos desde Firebase para usuario:", userUID);

    // Cargar clientes
    const clientesSnapshot = await dbFirebase
      .collection("clientes")
      .where("userId", "==", userUID)
      .get();

    db.clientes = [];
    clientesSnapshot.forEach((doc) => {
      const data = doc.data();
      db.clientes.push({
        id: doc.id,
        nombre: data.nombre,
        dni: data.dni,
        telefono: data.telefono,
        email: data.email,
        membresia: data.membresia,
        vencimiento: data.vencimiento,
        activo: data.activo,
        fechaCreacion:
          data.fechaCreacion?.toDate?.()?.toISOString() ||
          new Date().toISOString(),
      });
    });

    // Cargar pagos
    const pagosSnapshot = await dbFirebase
      .collection("pagos")
      .where("userId", "==", userUID)
      .get();

    db.pagos = [];
    pagosSnapshot.forEach((doc) => {
      const data = doc.data();
      db.pagos.push({
        id: doc.id,
        clienteId: data.clienteId,
        monto: data.monto,
        fecha: data.fecha,
        timestamp:
          data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
      });
    });

    // Guardar en localStorage para offline
    localStorage.setItem("clientes", JSON.stringify(db.clientes));
    localStorage.setItem("pagos", JSON.stringify(db.pagos));

    console.log("✅ Datos cargados desde Firebase");

    // Actualizar UI con los datos de Firebase
    actualizarUI();
    cargarNotificaciones();
  } catch (error) {
    console.error("❌ Error cargando datos desde Firebase:", error);
    // No llamar cargarDatosIniciales() aquí para evitar duplicación
  }
}

// Guardar cliente en Firebase y localmente
async function guardarClienteEnFirebase(cliente) {
  // Guardar localmente primero para respuesta inmediata
  const nuevoCliente = {
    id: Date.now(),
    nombre: cliente.nombre,
    dni: cliente.dni,
    telefono: cliente.telefono,
    email: cliente.email,
    membresia: cliente.membresia,
    vencimiento: cliente.vencimiento,
    activo: cliente.activo,
    fechaCreacion: new Date().toISOString(),
  };

  db.clientes.push(nuevoCliente);
  localStorage.setItem("clientes", JSON.stringify(db.clientes));

  // Actualizar UI inmediatamente
  actualizarUI();
  cargarNotificaciones();

  // Guardar en Firebase si está disponible
  if (dbFirebase && userUID) {
    try {
      const clienteFirebase = {
        userId: userUID,
        nombre: cliente.nombre,
        dni: cliente.dni,
        telefono: cliente.telefono,
        email: cliente.email,
        membresia: cliente.membresia,
        vencimiento: cliente.vencimiento,
        activo: cliente.activo,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await dbFirebase
        .collection("clientes")
        .add(clienteFirebase);
      console.log("Cliente guardado en Firebase con ID:", docRef.id);

      // Actualizar el ID local con el ID de Firebase
      const index = db.clientes.findIndex((c) => c.id === nuevoCliente.id);
      if (index !== -1) {
        db.clientes[index].id = docRef.id;
        localStorage.setItem("clientes", JSON.stringify(db.clientes));
      }
    } catch (error) {
      console.error("Error guardando cliente en Firebase:", error);
    }
  }
}

async function eliminarClienteDeFirebase(id) {
  // Eliminar de Firebase si está disponible
  if (dbFirebase) {
    try {
      // Intentar eliminar con el ID tal cual
      await dbFirebase.collection("clientes").doc(id.toString()).delete();
      console.log("Cliente eliminado de Firebase");

      // También eliminar pagos asociados en Firebase
      const pagosSnapshot = await dbFirebase
        .collection("pagos")
        .where("clienteId", "==", id)
        .get();

      const batch = dbFirebase.batch();
      pagosSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error eliminando cliente de Firebase:", error);
      throw error; // Relanzar el error para manejarlo arriba
    }
  }
}

// Guardar pago en Firebase и localmente
async function guardarPagoEnFirebase(pago) {
  // Guardar localmente primero
  const nuevoPago = {
    id: Date.now().toString(),
    clienteId: pago.clienteId,
    monto: pago.monto,
    fecha: pago.fecha,
    timestamp: new Date().toISOString(),
  };

  db.pagos.push(nuevoPago);
  localStorage.setItem("pagos", JSON.stringify(db.pagos));

  // Actualizar UI
  actualizarUI();

  // Guardar en Firebase si está disponible
  if (dbFirebase && userUID) {
    try {
      const pagoFirebase = {
        userId: userUID,
        clienteId: pago.clienteId,
        monto: pago.monto,
        fecha: pago.fecha,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await dbFirebase.collection("pagos").add(pagoFirebase);
      console.log("Pago guardado en Firebase con ID:", docRef.id);
    } catch (error) {
      console.error("Error guardando pago en Firebase:", error);
    }
  }
}

// Guardar configuración en Firebase y localmente
async function guardarConfiguracionEnFirebase(config) {
  // Guardar localmente
  db.configuracion = config;
  localStorage.setItem("configuracion", JSON.stringify(config));

  // Guardar en Firebase si está disponible
  if (dbFirebase && userUID) {
    try {
      await dbFirebase
        .collection("configuracion")
        .doc(userUID)
        .set(config, { merge: true });

      console.log("Configuración guardada en Firebase");
    } catch (error) {
      console.error("Error guardando configuración en Firebase:", error);
    }
  }
}

// Función para guardar nuevo cliente (modificada para Firebase)
// function guardarCliente() {
//   const nombre = document.getElementById("nombre").value;
//   const dni = document.getElementById("dni").value;
//   const telefono = document.getElementById("telefono").value;
//   const email = document.getElementById("email").value;
//   const membresia = document.getElementById("membresia").value;
//   const vencimiento = document.getElementById("vencimiento").value;
//   const estado = document.getElementById("estado").value === "true";

//   if (!nombre || !dni || !telefono || !membresia || !vencimiento) {
//     alert("Por favor, complete todos los campos obligatorios");
//     return;
//   }

//   // Verificar si ya existe un cliente con el mismo DNI (localmente)
//   if (db.clientes.some((cliente) => cliente.dni === dni)) {
//     alert("Ya existe un cliente con este DNI");
//     return;
//   }

//   const nuevoCliente = {
//     nombre: nombre,
//     dni: dni,
//     telefono: telefono,
//     email: email,
//     membresia: membresia,
//     vencimiento: vencimiento,
//     activo: estado,
//   };

//   guardarClienteEnFirebase(nuevoCliente);

//   // Cerrar modal
//   document.getElementById("modal-cliente").classList.remove("active");

//   alert("Cliente guardado correctamente");
// }

// Función para guardar nuevo cliente (modificada para Firebase)
function guardarCliente() {
  const nombre = document.getElementById("nombre").value;
  const dni = document.getElementById("dni").value;
  const telefono = document.getElementById("telefono").value;
  const email = document.getElementById("email").value;
  const membresia = document.getElementById("membresia").value;
  const vencimiento = document.getElementById("vencimiento").value;
  const estado = document.getElementById("estado").value === "true";

  if (!nombre || !dni || !telefono || !membresia || !vencimiento) {
    alert("Por favor, complete todos los campos obligatorios");
    return;
  }

  // Verificar si ya existe un cliente con el mismo DNI (localmente)
  if (db.clientes.some((cliente) => cliente.dni === dni)) {
    alert("Ya existe un cliente con este DNI");
    return;
  }

  // Mapear nombres de membresía para guardar en la base de datos
  function mapearMembresiaParaGuardar(membresiaSeleccionada) {
    const mapeoMembresias = {
      '3 DIAS': 'basica',
      'SEMANA COMPLETA': 'premium', 
      'OTROS': 'oro'
    };
    
    return mapeoMembresias[membresiaSeleccionada] || membresiaSeleccionada;
  }

  const membresiaParaGuardar = mapearMembresiaParaGuardar(membresia);

  const nuevoCliente = {
    nombre: nombre,
    dni: dni,
    telefono: telefono,
    email: email,
    membresia: membresiaParaGuardar,
    vencimiento: vencimiento,
    activo: estado,
  };

  guardarClienteEnFirebase(nuevoCliente);

  // Cerrar modal
  document.getElementById("modal-cliente").classList.remove("active");

  alert("Cliente guardado correctamente");
}

////Funcion eliminar clientes
function inicializarEliminarClientes() {
  console.log("🔧 Inicializando sistema de eliminación...");

  // Verificar que los elementos existan
  const modalEliminar = document.getElementById("modal-eliminar");
  const cancelarEliminar = document.getElementById("cancelar-eliminar");
  const confirmarEliminar = document.getElementById("confirmar-eliminar");
  const nombreEliminar = document.getElementById("cliente-eliminar-nombre");

  if (
    !modalEliminar ||
    !cancelarEliminar ||
    !confirmarEliminar ||
    !nombreEliminar
  ) {
    console.error("❌ Elementos del modal de eliminación no encontrados");
    return;
  }

  // DELEGACIÓN DE EVENTOS - MANERA CORRECTA
  document.addEventListener("click", function (e) {
    // Si se hace click en un botón de eliminar o en el icono de trash dentro de él
    if (e.target.closest(".eliminar-cliente")) {
      const button = e.target.closest(".eliminar-cliente");
      const id = button.getAttribute("data-id");
      const nombre = button.getAttribute("data-nombre") || "este cliente";

      console.log("🟢 Botón eliminar clickeado - ID:", id, "Nombre:", nombre);

      clienteIdAEliminar = id;
      nombreEliminar.textContent = nombre;
      modalEliminar.classList.add("active");
    }
  });

  // Configurar botones del modal
  cancelarEliminar.addEventListener("click", function () {
    modalEliminar.classList.remove("active");
    clienteIdAEliminar = null;
  });

  confirmarEliminar.addEventListener("click", function () {
    if (clienteIdAEliminar) {
      console.log(
        "✅ Confirmando eliminación del cliente ID:",
        clienteIdAEliminar
      );
      eliminarCliente(clienteIdAEliminar);
      modalEliminar.classList.remove("active");
      clienteIdAEliminar = null;
    }
  });

  // Cerrar modal con el botón X
  const closeButton = modalEliminar.querySelector(".modal-close");
  if (closeButton) {
    closeButton.addEventListener("click", function () {
      modalEliminar.classList.remove("active");
      clienteIdAEliminar = null;
    });
  }

  console.log("✅ Sistema de eliminación inicializado correctamente");
}

// Función para eliminar cliente

async function eliminarCliente(id) {
  console.log("🗑️ Eliminando cliente ID:", id, "Tipo:", typeof id);

  try {
    // Buscar el cliente
    const clienteIndex = db.clientes.findIndex(
      (cliente) => cliente.id == id || cliente.id.toString() === id.toString()
    );

    if (clienteIndex === -1) {
      console.error("❌ Cliente no encontrado");
      alert("Cliente no encontrado");
      return;
    }

    const cliente = db.clientes[clienteIndex];
    const clienteNombre = cliente.nombre || "Cliente";

    console.log("👤 Eliminando cliente:", clienteNombre);

    // Eliminar localmente
    db.clientes.splice(clienteIndex, 1);

    // Eliminar pagos asociados
    db.pagos = db.pagos.filter((pago) => pago.clienteId != id);

    // Guardar en localStorage
    localStorage.setItem("clientes", JSON.stringify(db.clientes));
    localStorage.setItem("pagos", JSON.stringify(db.pagos));

    // Actualizar UI
    mostrarTodosLosClientes();
    cargarNotificaciones();

    // Eliminar de Firebase si está disponible
    if (dbFirebase) {
      try {
        console.log("🔥 Intentando eliminar de Firebase...");
        await eliminarClienteDeFirebase(id);
        console.log("✅ Cliente eliminado de Firebase");
      } catch (firebaseError) {
        console.error("❌ Error eliminando de Firebase:", firebaseError);
      }
    }

    alert(`✅ ${clienteNombre} eliminado correctamente`);
  } catch (error) {
    console.error("❌ Error eliminando cliente:", error);
    alert("Error al eliminar el cliente");
  }
}

// Función para registrar pago (modificada para Firebase)
function registrarPago() {
  const dni = document.getElementById("buscar-dni").value;
  const cliente = db.clientes.find((c) => c.dni && c.dni === dni);
  const monto = parseFloat(document.getElementById("monto").value);
  const fecha = document.getElementById("fecha").value;

  if (!cliente || !monto || !fecha) {
    alert("Por favor, complete todos los campos");
    return;
  }

  const nuevoPago = {
    clienteId: cliente.id,
    monto: monto,
    fecha: fecha,
  };

  guardarPagoEnFirebase(nuevoPago);

  // Limpiar formulario
  document.getElementById("buscar-dni").value = "";
  document.getElementById("monto").value = "";
  document.getElementById("fecha").value = "";
  document.getElementById("cliente-info").style.display = "none";

  alert("Pago registrado correctamente");
}

// Funciones de configuración (modificadas para Firebase)
function guardarConfiguracionGeneral() {
  const nuevaConfig = {
    ...db.configuracion,
    nombreGimnasio: document.getElementById("nombre-gimnasio").value,
    direccion: document.getElementById("direccion").value,
    telefono: document.getElementById("telefono-gimnasio").value,
  };

  guardarConfiguracionEnFirebase(nuevaConfig);
  alert("Configuración general guardada correctamente");
}

function guardarPrecios() {
  const nuevaConfig = {
    ...db.configuracion,
    precios: {
      basica: parseFloat(document.getElementById("precio-basica").value) || 0,
      premium: parseFloat(document.getElementById("precio-premium").value) || 0,
      oro: parseFloat(document.getElementById("precio-oro").value) || 0,
    },
  };

  guardarConfiguracionEnFirebase(nuevaConfig);
  alert("Precios guardados correctamente");
}

function guardarConfiguracionNotificaciones() {
  const nuevaConfig = {
    ...db.configuracion,
    notificaciones: {
      vencimientos: document.getElementById("notif-vencimientos").checked,
      pagos: document.getElementById("notif-pagos").checked,
      nuevosClientes: document.getElementById("notif-nuevos-clientes").checked,
      diasAnticipacion: parseInt(
        document.getElementById("dias-anticipacion").value
      ),
    },
  };

  guardarConfiguracionEnFirebase(nuevaConfig);
  cargarNotificaciones();
  alert("Configuración de notificaciones guardada correctamente");
}

// Sincronizar datos con Firebase
async function sincronizarDatos() {
  if (!dbFirebase || !userUID) {
    console.log("Firebase no disponible para sincronización");
    return;
  }

  try {
    console.log("Sincronizando datos con Firebase...");

    // Sincronizar clientes
    for (const cliente of db.clientes) {
      if (!cliente.sincronizado) {
        const clienteFirebase = {
          userId: userUID,
          nombre: cliente.nombre,
          dni: cliente.dni,
          telefono: cliente.telefono,
          email: cliente.email,
          membresia: cliente.membresia,
          vencimiento: cliente.vencimiento,
          activo: cliente.activo,
          fechaCreacion: cliente.fechaCreacion || new Date().toISOString(),
        };

        if (cliente.id && cliente.id.length < 20) {
          // Es un ID local, crear nuevo documento
          const docRef = await dbFirebase
            .collection("clientes")
            .add(clienteFirebase);

          // Actualizar ID local
          const index = db.clientes.findIndex((c) => c.id === cliente.id);
          if (index !== -1) {
            db.clientes[index].id = docRef.id;
            db.clientes[index].sincronizado = true;
          }
        } else {
          // Actualizar documento existente
          await dbFirebase
            .collection("clientes")
            .doc(cliente.id)
            .set(clienteFirebase);
          cliente.sincronizado = true;
        }
      }
    }

    // Sincronizar pagos
    for (const pago of db.pagos) {
      if (!pago.sincronizado) {
        const pagoFirebase = {
          userId: userUID,
          clienteId: pago.clienteId,
          monto: pago.monto,
          fecha: pago.fecha,
          timestamp: pago.timestamp || new Date().toISOString(),
        };

        if (pago.id && pago.id.length < 20) {
          // Es un ID local, crear nuevo documento
          const docRef = await dbFirebase.collection("pagos").add(pagoFirebase);

          // Actualizar ID local
          const index = db.pagos.findIndex((p) => p.id === pago.id);
          if (index !== -1) {
            db.pagos[index].id = docRef.id;
            db.pagos[index].sincronizado = true;
          }
        } else {
          // Actualizar documento existente
          await dbFirebase.collection("pagos").doc(pago.id).set(pagoFirebase);
          pago.sincronizado = true;
        }
      }
    }

    // Sincronizar configuración
    await dbFirebase
      .collection("configuracion")
      .doc(userUID)
      .set(db.configuracion, { merge: true });

    // Guardar cambios locales
    localStorage.setItem("clientes", JSON.stringify(db.clientes));
    localStorage.setItem("pagos", JSON.stringify(db.pagos));

    console.log("Datos sincronizados con Firebase");
  } catch (error) {
    console.error("Error sincronizando datos con Firebase:", error);
  }
}

// Modificar la función updateConnectionStatus para sincronizar cuando hay conexión
function updateConnectionStatus() {
  const connectionStatus = document.getElementById("connection-status");
  if (!connectionStatus) return;

  // Simulación: 90% de probabilidad de estar online
  const isOnline = Math.random() > 0.1;

  if (isOnline) {
    connectionStatus.textContent = "En línea";
    connectionStatus.className = "connection-status online";
    connectionStatus.innerHTML = '<i class="fas fa-wifi"></i> En línea';

    // Sincronizar con Firebase cuando hay conexión
    if (userUID) {
      sincronizarDatos();
    }
  } else {
    connectionStatus.textContent = "Sin conexión - Modo offline";
    connectionStatus.className = "connection-status offline";
    connectionStatus.innerHTML =
      '<i class="fas fa-wifi-slash"></i> Sin conexión';
  }
}

// Cargar header en todas las páginas
// function cargarHeader() {
//   const headerContainer = document.getElementById("header-container");
//   if (!headerContainer) return;

//   fetch("/partials/header.html")
//     .then((response) => response.text())
//     .then((data) => {
//       headerContainer.innerHTML = data;
//       inicializarNavegacion();
//       // Marcar la página activa en el menú
//       const currentPage = window.location.pathname.split("/").pop();
//       document.querySelectorAll("nav a").forEach((link) => {
//         if (
//           link.getAttribute("href") === currentPage ||
//           (currentPage === "" && link.getAttribute("href") === "index.html")
//         ) {
//           link.classList.add("active");
//         }
//       });
//     })
//     .catch((error) => {
//       console.error("Error cargando el header:", error);
//     });
// }

function cargarHeader() {
  const headerContainer = document.getElementById("header-container");
  if (!headerContainer) return;

  // Determinar la ruta correcta según el entorno
  const isGitHubPages = window.location.hostname.includes("github.io");
  const headerPath = isGitHubPages
    ? "/gymadmin/partials/header.html"
    : "/partials/header.html";

  fetch(headerPath)
    .then((response) => {
      if (!response.ok) {
        throw new Error("No se pudo cargar el header: " + response.status);
      }
      return response.text();
    })
    .then((data) => {
      headerContainer.innerHTML = data;
      inicializarNavegacion();

      // Marcar la página activa en el menú - CORREGIDO
      const currentPage =
        window.location.pathname.split("/").pop() || "index.html";
      const repoName = window.location.pathname.split("/")[1] || "";

      document.querySelectorAll("nav a").forEach((link) => {
        let linkHref = link.getAttribute("href");

        // Si estamos en GitHub Pages, remover el nombre del repo de la comparación
        if (isGitHubPages && linkHref.includes(repoName)) {
          linkHref = linkHref.replace(`/${repoName}`, "");
        }

        if (
          linkHref === currentPage ||
          (currentPage === "index.html" && linkHref === "/") ||
          (currentPage === "" && linkHref === "index.html")
        ) {
          link.classList.add("active");
        }
      });
    })
    .catch((error) => {
      console.error("Error cargando el header:", error);
      // Fallback: mostrar un header básico
      headerContainer.innerHTML = `
        <header>
          <div class="header-content">
            <div class="logo">
              <i class="fas fa-dumbbell"></i>
              <span>GymAdmin</span>
            </div>
            <nav>
              <a href="${
                isGitHubPages ? "/gymadmin/" : "/"
              }" class="nav-link">Inicio</a>
              <a href="${
                isGitHubPages
                  ? "/gymadmin/pages/clientes.html"
                  : "/pages/clientes.html"
              }" class="nav-link">Clientes</a>
              <a href="${
                isGitHubPages
                  ? "/gymadmin/pages/rendimientos.html"
                  : "/pages/rendimientos.html"
              }" class="nav-link">Rendimientos</a>
              <a href="${
                isGitHubPages
                  ? "/gymadmin/pages/configuracion.html"
                  : "/pages/configuracion.html"
              }" class="nav-link">Configuración</a>
            </nav>
            <button class="menu-toggle">☰</button>
          </div>
        </header>
      `;
    });
}


// Inicializar navegación
function inicializarNavegacion() {
  const menuToggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector("nav");

  if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
      nav.classList.toggle("active");
    });
  }

  // Inicializar notificaciones
  const notificationBell = document.querySelector(".notification-bell");
  const notificationDropdown = document.querySelector(".notification-dropdown");
  const closeNotifications = document.querySelector(".close-notifications");

  if (notificationBell && notificationDropdown) {
    notificationBell.addEventListener("click", (e) => {
      e.stopPropagation();
      notificationDropdown.classList.toggle("active");
    });
  }

  if (closeNotifications && notificationDropdown) {
    closeNotifications.addEventListener("click", () => {
      notificationDropdown.classList.remove("active");
    });
  }

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (
      notificationDropdown &&
      !notificationDropdown.contains(e.target) &&
      notificationBell &&
      !notificationBell.contains(e.target)
    ) {
      notificationDropdown.classList.remove("active");
    }
  });
}

// Cargar datos iniciales
function cargarDatosIniciales() {
  // NO cargar datos de ejemplo
  // Solo mantener la configuración por defecto si no existe
  if (!localStorage.getItem("configuracion")) {
    localStorage.setItem("configuracion", JSON.stringify(db.configuracion));
  } else {
    db.configuracion = JSON.parse(localStorage.getItem("configuracion"));
  }

  // Limpiar clientes y pagos
  db.clientes = [];
  db.pagos = [];
  localStorage.removeItem("clientes");
  localStorage.removeItem("pagos");

  console.log("✅ Datos locales limpiados - Esperando autenticación");
}

// Formatear fecha a YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Calcular días entre dos fechas
function diasEntreFechas(fecha1, fecha2) {
  const unDia = 24 * 60 * 60 * 1000; // milisegundos en un día
  const diffDias = Math.round(Math.abs((fecha1 - fecha2) / unDia));
  return diffDias;
}

// Cargar notificaciones de membresías próximas a vencer
function cargarNotificaciones() {
  const hoy = new Date();
  let notificaciones = [];
  let count = 0;

  db.clientes.forEach((cliente) => {
    if (cliente.activo && cliente.vencimiento) {
      const vencimiento = new Date(cliente.vencimiento);
      const diasRestantes = diasEntreFechas(hoy, vencimiento);

      if (
        diasRestantes <= db.configuracion.notificaciones.diasAnticipacion &&
        diasRestantes >= 0
      ) {
        notificaciones.push({
          tipo: "warning",
          mensaje: `La membresía de <span class="member-name">${
            cliente.nombre || "Cliente"
          }</span> vence en <strong>${diasRestantes}</strong> días.`,
          dias: diasRestantes,
        });
        count++;
      } else if (diasRestantes < 0) {
        notificaciones.push({
          tipo: "danger",
          mensaje: `La membresía de <span class="member-name">${
            cliente.nombre || "Cliente"
          }</span> venció hace <strong>${Math.abs(
            diasRestantes
          )}</strong> días.`,
          dias: diasRestantes,
        });
        count++;
      }
    }
  });

  // Ordenar notificaciones: primero las vencidas, luego por días a vencer
  notificaciones.sort((a, b) => a.dias - b.dias);

  // Actualizar contador de notificaciones
  const notificationCount = document.querySelector(".notification-count");
  if (notificationCount) {
    notificationCount.textContent = count;
  }

  // Generar HTML de notificaciones
  const notificationContent = document.querySelector(".notification-content");
  if (notificationContent) {
    notificationContent.innerHTML = "";

    if (notificaciones.length === 0) {
      notificationContent.innerHTML =
        '<div class="notification-item">No hay notificaciones</div>';
    } else {
      notificaciones.forEach((notif) => {
        const div = document.createElement("div");
        div.className = `notification-item ${notif.tipo}`;
        div.innerHTML = notif.mensaje;
        notificationContent.appendChild(div);
      });
    }
  }

  // Cargar notificaciones en la página de notificaciones si existe
  const listaNotificaciones = document.getElementById("lista-notificaciones");
  if (listaNotificaciones) {
    listaNotificaciones.innerHTML = "";

    if (notificaciones.length === 0) {
      listaNotificaciones.innerHTML =
        "<p>No hay notificaciones pendientes.</p>";
    } else {
      notificaciones.forEach((notif) => {
        const div = document.createElement("div");
        div.className = `notification-list-item ${notif.tipo}`;

        let icono = "fa-info-circle";
        if (notif.tipo === "warning") icono = "fa-exclamation-triangle";
        if (notif.tipo === "danger") icono = "fa-exclamation-circle";

        div.innerHTML = `
                    <i class="fas ${icono}"></i>
                    <div>${notif.mensaje}</div>
                `;
        listaNotificaciones.appendChild(div);
      });
    }
  }
}

// Modificar el evento DOMContentLoaded para inicializar Firebase
document.addEventListener("DOMContentLoaded", function () {

    setupNavigation();

  // Cargar el header
  cargarHeader();

  // Inicializar Firebase
  inicializarFirebase();

  setTimeout(() => {
    if (!isAuthenticated && !document.getElementById("modal-login")) {
      console.log("🔄 Mostrando modal por timeout de seguridad");
      mostrarModalLogin();
    }
  }, 1000);

  // Inicializar la página específica
  const currentPage = window.location.pathname.split("/").pop();
  inicializarPagina(currentPage);

  // Configurar event listeners globales
  configurarEventListenersGlobales();

  // Establecer fecha actual por defecto en los campos de fecha
  const hoy = formatDate(new Date());
  const campoFecha = document.getElementById("fecha");
  const campoVencimiento = document.getElementById("vencimiento");

  if (campoFecha) campoFecha.value = hoy;
  if (campoVencimiento) campoVencimiento.value = hoy;

  // Verificar estado de conexión periódicamente
  setInterval(updateConnectionStatus, 30000);
  updateConnectionStatus();
});

// Configurar event listeners globales
function configurarEventListenersGlobales() {
  // Cerrar modales
  const modalCloseButtons = document.querySelectorAll(".modal-close");
  modalCloseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".modal-backdrop").forEach((modal) => {
        modal.classList.remove("active");
      });
      clienteIdAEliminar = null;
    });
  });

  // Cerrar modales al hacer clic fuera
  document.querySelectorAll(".modal-backdrop").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        if (modal.id === "modal-eliminar") {
          clienteIdAEliminar = null;
        }
      }
    });
  });
}

// Inicializar página específica
function inicializarPagina(pagina) {
  switch (pagina) {
    case "index.html":
    case "":
      inicializarDashboard();
      break;
    case "clientes.html":
      inicializarClientes();
      break;
    case "rendimientos.html":
      inicializarRendimientos();
      break;
    case "configuracion.html":
      inicializarConfiguracion();
      break;
    case "notificaciones.html":
      inicializarNotificaciones();
      break;
  }
}

// Inicializar dashboard
function inicializarDashboard() {
  // Actualizar UI
  actualizarUI();

  // Configurar event listeners específicos del dashboard
  const btnBuscarDni = document.getElementById("btn-buscar-dni");
  const inputBuscarDni = document.getElementById("buscar-dni");
  const btnRegistrarPago = document.getElementById("registrar-pago");

  if (btnBuscarDni && inputBuscarDni) {
    btnBuscarDni.addEventListener("click", buscarClientePorDni);
    inputBuscarDni.addEventListener("keyup", buscarClientePorDni);
  }

  if (btnRegistrarPago) {
    btnRegistrarPago.addEventListener("click", registrarPago);
  }
}

// Inicializar página de clientes (VERSIÓN CORREGIDA)
function inicializarClientes() {
  console.log("📋 Inicializando página de clientes...");

  // Mostrar todos los clientes
  mostrarTodosLosClientes();

  // Configurar event listeners para el buscador
  const btnBuscarCliente = document.getElementById("btn-buscar-cliente");
  const inputBuscarCliente = document.getElementById("input-buscar-cliente");

  console.log("🔍 Elementos de búsqueda:", {
    btnBuscarCliente: !!btnBuscarCliente,
    inputBuscarCliente: !!inputBuscarCliente,
  });

  if (btnBuscarCliente && inputBuscarCliente) {
    btnBuscarCliente.addEventListener("click", buscarClientes);
    inputBuscarCliente.addEventListener("keyup", buscarClientes);
    console.log("✅ Event listeners de búsqueda configurados");
  } else {
    console.error("❌ No se encontraron los elementos de búsqueda");
  }

  // Configurar otros event listeners
  const btnNuevoCliente = document.getElementById("nuevo-cliente");
  const btnGuardarCliente = document.getElementById("guardar-cliente");
  const btnCancelarCliente = document.getElementById("cancelar-cliente");

  if (btnNuevoCliente) {
    btnNuevoCliente.addEventListener("click", () => {
      document.getElementById("modal-cliente").classList.add("active");
    });
  }

  if (btnGuardarCliente) {
    btnGuardarCliente.addEventListener("click", guardarCliente);
  }

  if (btnCancelarCliente) {
    btnCancelarCliente.addEventListener("click", () => {
      document.getElementById("modal-cliente").classList.remove("active");
    });
  }

  // Inicializar eliminación de clientes con un pequeño delay
  setTimeout(() => {
    inicializarEliminarClientes();
  }, 300);

  console.log("✅ Página de clientes inicializada correctamente");
}

// Inicializar página de rendimientos
function inicializarRendimientos() {
  actualizarEstadisticasRendimiento();
}

// Inicializar página de configuración
function inicializarConfiguracion() {
  // Cargar valores actuales de configuración
  document.getElementById("nombre-gimnasio").value =
    db.configuracion.nombreGimnasio || "";
  document.getElementById("direccion").value = db.configuracion.direccion || "";
  document.getElementById("telefono-gimnasio").value =
    db.configuracion.telefono || "";
  document.getElementById("precio-basica").value =
    db.configuracion.precios.basica || "";
  document.getElementById("precio-premium").value =
    db.configuracion.precios.premium || "";
  document.getElementById("precio-oro").value =
    db.configuracion.precios.oro || "";

  // Configurar event listeners
  document
    .getElementById("guardar-configuracion")
    .addEventListener("click", guardarConfiguracionGeneral);
  document
    .getElementById("guardar-precios")
    .addEventListener("click", guardarPrecios);
  document
    .getElementById("exportar-datos")
    .addEventListener("click", exportarDatos);
  document
    .getElementById("importar-datos")
    .addEventListener("click", importarDatos);
  document
    .getElementById("limpiar-datos")
    .addEventListener("click", limpiarDatos);
}

// Inicializar página de notificaciones
function inicializarNotificaciones() {
  // Cargar configuración de notificaciones
  document.getElementById("notif-vencimientos").checked =
    db.configuracion.notificaciones.vencimientos;
  document.getElementById("notif-pagos").checked =
    db.configuracion.notificaciones.pagos;
  document.getElementById("notif-nuevos-clientes").checked =
    db.configuracion.notificaciones.nuevosClientes;
  document.getElementById("dias-anticipacion").value =
    db.configuracion.notificaciones.diasAnticipacion;

  // Configurar event listener
  document
    .getElementById("guardar-notificaciones")
    .addEventListener("click", guardarConfiguracionNotificaciones);
}
/// Funcion formatear numeros de telefono///////
// function formatearTelefonoWhatsApp(telefono) {
//   // Eliminar cualquier carácter que no sea número
//   let numero = telefono.replace(/\D/g, "");

//   // Si el número empieza con 0 (para números argentinos), reemplazar por 54
//   if (numero.startsWith("0")) {
//     numero = "54" + numero.substring(1);
//   }

//   // Si el número tiene 10 dígitos y empieza con 15 (para móviles argentinos)
//   if (numero.length === 10 && numero.startsWith("15")) {
//     numero = "549" + numero.substring(2);
//   }

//   // Si el número no tiene código de país, agregar el de Argentina (54)
//   if (numero.length === 10 && !numero.startsWith("54")) {
//     numero = "54" + numero;
//   }

//   return numero;
// }
function formatearTelefonoWhatsApp(telefono) {
  if (!telefono) return "";

  // Eliminar cualquier carácter que no sea número
  let numero = telefono.replace(/\D/g, "");

  // Si el número está vacío después de limpiar, retornar vacío
  if (!numero) return "";

  // Si el número empieza con 0 (para números argentinos), reemplazar por 54
  if (numero.startsWith("0")) {
    numero = "54" + numero.substring(1);
  }

  // Si el número tiene 10 dígitos y empieza con 15 (para móviles argentinos)
  if (numero.length === 10 && numero.startsWith("15")) {
    numero = "549" + numero.substring(2);
  }

  // Si el número no tiene código de país y tiene 10 dígitos, agregar 54
  if (numero.length === 10 && !numero.startsWith("54")) {
    numero = "54" + numero;
  }

  // Si el número tiene 8 dígitos (sin 15), asumir que es de Argentina y agregar 549
  if (numero.length === 8) {
    numero = "549" + numero;
  }

  return numero;
}
// Manejar navegación entre páginas
function setupNavigation() {
  document.addEventListener("click", function (e) {
    const link = e.target.closest("a");
    if (link && link.href && link.getAttribute("href").endsWith(".html")) {
      e.preventDefault();
      const pageUrl = link.getAttribute("href");

      // SI ESTÁS EN LOCALHOST, usa navegación normal
      if (
        window.location.hostname.includes("localhost") ||
        window.location.hostname.includes("127.0.0.1")
      ) {
        window.location.href = pageUrl; // ← Navegación tradicional
      } else {
        navigateToPage(pageUrl); // ← SPA solo para producción
      }
    }
  });
}

// ELIMINA navigateToPage para desarrollo o simplifícalo:
function navigateToPage(pageUrl) {
  // Solo para producción (GitHub Pages)
  history.pushState(null, null, pageUrl);
  loadPageContent(pageUrl);
}

function loadPageContent(pageUrl) {
  // Solo para producción
  const pageName = pageUrl.split("/").pop();
  fetch(`pages/${pageName}`)
    .then((response) => response.text())
    .then((html) => {
      document.getElementById("main-content").innerHTML = html;
      initializePage(pageName);
    });
}

function navigateToPage(pageUrl) {
  // Si es desarrollo, usa navegación normal
  if (window.location.hostname.includes('localhost') || 
      window.location.hostname.includes('127.0.0.1')) {
    window.location.href = pageUrl;
    return;
  }
  
  // Si es producción, usa History API para SPA
  history.pushState(null, null, pageUrl);
  loadPageContent(pageUrl);
}

function loadPageContent(pageUrl) {
  const pageName = pageUrl.split('/').pop();
  
  fetch(`pages/${pageName}`)
    .then(response => response.text())
    .then(html => {
      document.getElementById('main-content').innerHTML = html;
      initializePage(pageName);
    })
    .catch(error => {
      console.error('Error loading page:', error);
      window.location.href = pageUrl; // Fallback
    });
}


// Función para mostrar todos los clientes (faltante en tu código original)

// function mostrarTodosLosClientes() {
//   const listaClientes = document.getElementById("lista-clientes");
//   if (!listaClientes) {
//     console.error("❌ No se encontró el elemento lista-clientes");
//     return;
//   }

//   listaClientes.innerHTML = "";

//   if (db.clientes.length === 0) {
//     listaClientes.innerHTML =
//       '<tr><td colspan="7" style="text-align: center;">No hay clientes registrados</td></tr>';
//     return;
//   }

//   db.clientes.forEach((cliente) => {
//     const tr = document.createElement("tr");
//     tr.innerHTML = `
//             <td>${cliente.nombre || "N/A"}</td>
//             <td>${cliente.dni || "N/A"}</td>
//             <td>${cliente.telefono || "N/A"}</td>
//             <td>${cliente.email || "N/A"}</td>
//             <td>${cliente.vencimiento || "N/A"}</td>
//             <td><span class="status ${
//               cliente.activo ? "status-active" : "status-inactive"
//             }">${cliente.activo ? "Activo" : "Inactivo"}</span></td>
//             <td>
//                 <button class="editar-cliente" data-id="${cliente.id}">
//                     <i class="fas fa-edit"></i>
//                 </button>
//                 <button class="eliminar-cliente" data-id="${
//                   cliente.id
//                 }" data-nombre="${cliente.nombre || "Cliente"}">
//                     <i class="fas fa-trash"></i>
//                 </button>
//             </td>
//         `;
//     listaClientes.appendChild(tr);
//   });

//   console.log("✅ Lista de clientes mostrada. Total:", db.clientes.length);
// }
function mostrarTodosLosClientes() {
  const listaClientes = document.getElementById("lista-clientes");
  if (!listaClientes) {
    console.error("❌ No se encontró el elemento lista-clientes");
    return;
  }

  listaClientes.innerHTML = "";

  if (db.clientes.length === 0) {
    listaClientes.innerHTML =
      '<tr><td colspan="7" style="text-align: center;">No hay clientes registrados</td></tr>';
    return;
  }

  db.clientes.forEach((cliente) => {
    const tr = document.createElement("tr");

    // Formatear el teléfono para WhatsApp si existe
    const telefonoWhatsApp = cliente.telefono
      ? formatearTelefonoWhatsApp(cliente.telefono)
      : "";

    tr.innerHTML = `
      <td>${cliente.nombre || "N/A"}</td>
      <td>${cliente.dni || "N/A"}</td>
      <td>
        ${
          cliente.telefono
            ? `<a href="https://wa.me/${telefonoWhatsApp}" 
            target="_blank" class="whatsapp-link" title="Enviar mensaje por WhatsApp">
             ${cliente.telefono}
          </a>`
            : "N/A"
        }
      </td>
      <td>${cliente.email || "N/A"}</td>
      <td>${cliente.vencimiento || "N/A"}</td>
      <td><span class="status ${
        cliente.activo ? "status-active" : "status-inactive"
      }">
          ${cliente.activo ? "Activo" : "Inactivo"}
      </span></td>
      <td>
        <button class="editar-cliente" data-id="${cliente.id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="eliminar-cliente" data-id="${cliente.id}" data-nombre="${
      cliente.nombre || "Cliente"
    }">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    listaClientes.appendChild(tr);
  });

  console.log("✅ Lista de clientes mostrada. Total:", db.clientes.length);
}


// Función para confirmar eliminación (faltante en tu código original)
function confirmarEliminacion() {
  if (clienteIdAEliminar) {
    eliminarCliente(clienteIdAEliminar);
    document.getElementById("modal-eliminar").classList.remove("active");
    clienteIdAEliminar = null;
  }
}

// Función para buscar clientes (faltante en tu código original)
function buscarClientes() {
  const searchTerm = document
    .getElementById("input-buscar-cliente")
    .value.toLowerCase();
  const listaClientes = document.getElementById("lista-clientes");

  if (!listaClientes) {
    console.error("No se encontró el elemento lista-clientes");
    return;
  }

  listaClientes.innerHTML = "";

  // Si no hay término de búsqueda, mostrar todos los clientes
  if (!searchTerm) {
    mostrarTodosLosClientes();
    return;
  }

  // Verificar que las propiedades existan antes de usarlas
  const clientesFiltrados = db.clientes.filter((cliente) => {
    // Verificar que el cliente tenga nombre y dni
    const nombre = cliente.nombre ? cliente.nombre.toLowerCase() : "";
    const dni = cliente.dni || "";

    return nombre.includes(searchTerm) || dni.includes(searchTerm);
  });

  if (clientesFiltrados.length === 0) {
    listaClientes.innerHTML =
      '<tr><td colspan="7" style="text-align: center;">No se encontraron clientes</td></tr>';
    return;
  }

  clientesFiltrados.forEach((cliente) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cliente.nombre || "N/A"}</td>
      <td>${cliente.dni || "N/A"}</td>
      <td>
          ${
            cliente.telefono
              ? `<a href="https://wa.me/${formatearTelefonoWhatsApp(
                  cliente.telefono
                )}" 
            target="_blank" class="whatsapp-link" title="Enviar mensaje por WhatsApp">
             ${cliente.telefono}
              </a>`
              : "N/A"
          }
      </td>
      <td>${cliente.email || "N/A"}</td>
      <td>${cliente.vencimiento || "N/A"}</td>
      <td><span class="status ${
        cliente.activo ? "status-active" : "status-inactive"
      }">${cliente.activo ? "Activo" : "Inactivo"}</span></td>
      <td>
        <button class="editar-cliente" data-id="${
          cliente.id
        }"><i class="fas fa-edit"></i></button>
        <button class="eliminar-cliente" data-id="${
          cliente.id
        }"><i class="fas fa-trash"></i></button>
      </td>
    `;
    listaClientes.appendChild(tr);
  });

  // Agregar event listeners a los botones de eliminar
  document.querySelectorAll(".eliminar-cliente").forEach((button) => {
    button.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      const cliente = db.clientes.find((c) => c.id === id);

      if (cliente) {
        clienteIdAEliminar = id;
        document.getElementById("cliente-eliminar-nombre").textContent =
          cliente.nombre || "este cliente";
        document.getElementById("modal-eliminar").classList.add("active");
      }
    });
  });
}

// Buscar cliente por DNI para pago (adaptada para Firebase)
// function buscarClientePorDni() {
//   const dni = document.getElementById("buscar-dni").value;
//   const clienteInfo = document.getElementById("cliente-info");
//   const clienteNombre = document.getElementById("cliente-nombre");

//   // Permitir búsqueda con al menos 4 caracteres o DNI completo
//   if (dni.length < 4 && dni.length !== 8) {
//     clienteInfo.style.display = "none";
//     return;
//   }

//   // Buscar cliente localmente primero para respuesta inmediata
//   const clienteLocal = db.clientes.find(
//     (c) => c.dni && c.dni === dni && c.activo
//   );

//   if (clienteLocal) {
//     clienteInfo.style.display = "block";
//     clienteNombre.textContent = `${clienteLocal.nombre || "Cliente"} - ${
//       clienteLocal.membresia || "Sin membresía"
//     }`;
//     return;
//   }

//   // Si no se encuentra localmente y hay conexión a Firebase, buscar allí
//   if (dbFirebase && userUID) {
//     try {
//       // Buscar en Firebase
//       dbFirebase
//         .collection("clientes")
//         .where("userId", "==", userUID)
//         .where("dni", "==", dni)
//         .where("activo", "==", true)
//         .get()
//         .then((querySnapshot) => {
//           if (!querySnapshot.empty) {
//             const clienteDoc = querySnapshot.docs[0];
//             const clienteFirebase = {
//               id: clienteDoc.id,
//               ...clienteDoc.data(),
//             };

//             clienteInfo.style.display = "block";
//             clienteNombre.textContent = `${
//               clienteFirebase.nombre || "Cliente"
//             } - ${clienteFirebase.membresia || "Sin membresía"}`
//                         clienteNombre.textContent = `${
//                           clienteFirebase.vencimiento || "Sin membresía"
//                         }`;

//             // Guardar localmente para futuras búsquedas
//             if (!db.clientes.some((c) => c.id === clienteFirebase.id)) {
//               db.clientes.push(clienteFirebase);
//               localStorage.setItem("clientes", JSON.stringify(db.clientes));
//             }
//           } else {
//             clienteInfo.style.display = "none";
//             if (dni.length === 8) {
//               alert("No se encontró un cliente activo con ese DNI");
//             }
//           }
//         })
//         .catch((error) => {
//           console.error("Error buscando cliente en Firebase:", error);
//           clienteInfo.style.display = "none";
//         });
//     } catch (error) {
//       console.error("Error en búsqueda Firebase:", error);
//       clienteInfo.style.display = "none";
//     }
//   } else {
//     clienteInfo.style.display = "none";
//     if (dni.length === 8) {
//       alert("No se encontró un cliente activo con ese DNI");
//     }
//   }
// }

// Buscar cliente por DNI para pago (adaptada para Firebase)
function buscarClientePorDni() {
  const dni = document.getElementById("buscar-dni").value;
  const clienteInfo = document.getElementById("cliente-info");
  const clienteNombre = document.getElementById("cliente-nombre");
  const clienteMembresia = document.getElementById("cliente-membresia").querySelector("span");
  const clienteDias = document.getElementById("cliente-dias").querySelector("span");

  // Permitir búsqueda con al menos 4 caracteres o DNI completo
  if (dni.length < 4 && dni.length !== 8) {
    clienteInfo.style.display = "none";
    return;
  }

  // Buscar cliente localmente primero para respuesta inmediata
  const clienteLocal = db.clientes.find(
    (c) => c.dni && c.dni === dni && c.activo
  );

  if (clienteLocal) {
    clienteInfo.style.display = "block";
    
    // Mostrar nombre del cliente
    clienteNombre.textContent = clienteLocal.nombre || "Cliente";
    
    // Función para mapear nombres de membresía
    function obtenerNombreMembresia(tipoMembresia) {
      const nombresMembresias = {
        'basica': '3 DIAS',
        'premium': 'SEMANA COMPLETA', 
        'oro': 'OTROS',
        'platino': 'OTROS',
        'Básica': '3 DIAS',
        'Premium': 'SEMANA COMPLETA', 
        'Oro': 'OTROS',
        'Platino': 'OTROS',
        '3 DIAS': '3 DIAS',
        'SEMANA COMPLETA': 'SEMANA COMPLETA',
        'OTROS': 'OTROS'
      };
      
      return nombresMembresias[tipoMembresia] || tipoMembresia;
    }
    
    // Mostrar tipo de membresía
    const nombreMembresia = obtenerNombreMembresia(clienteLocal.membresia);
    clienteMembresia.textContent = nombreMembresia;
    
    // Calcular y mostrar días restantes para el vencimiento
    const hoy = new Date();
    const vencimiento = new Date(clienteLocal.vencimiento);
    const diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
    
    if (diasRestantes > 7) {
      clienteDias.textContent = "TODA LA SEMANA";
    } else if (diasRestantes > 0) {
      clienteDias.textContent = `${diasRestantes} DÍAS`;
    } else if (diasRestantes === 0) {
      clienteDias.textContent = "HOY VENCE";
    } else {
      clienteDias.textContent = `VENCIDO HACE ${Math.abs(diasRestantes)} DÍAS`;
    }
    
    return;
  }

  // Si no se encuentra localmente y hay conexión a Firebase, buscar allí
  if (dbFirebase && userUID) {
    try {
      // Buscar en Firebase
      dbFirebase
        .collection("clientes")
        .where("userId", "==", userUID)
        .where("dni", "==", dni)
        .where("activo", "==", true)
        .get()
        .then((querySnapshot) => {
          if (!querySnapshot.empty) {
            const clienteDoc = querySnapshot.docs[0];
            const clienteFirebase = {
              id: clienteDoc.id,
              ...clienteDoc.data(),
            };

            clienteInfo.style.display = "block";
            
            // Mostrar nombre del cliente
            clienteNombre.textContent = clienteFirebase.nombre || "Cliente";
            
            // Función para mapear nombres de membresía
            function obtenerNombreMembresia(tipoMembresia) {
              const nombresMembresias = {
                'basica': '3 DIAS',
                'premium': 'SEMANA COMPLETA', 
                'oro': 'OTROS',
                'platino': 'OTROS',
                'Básica': '3 DIAS',
                'Premium': 'SEMANA COMPLETA', 
                'Oro': 'OTROS',
                'Platino': 'OTROS',
                '3 DIAS': '3 DIAS',
                'SEMANA COMPLETA': 'SEMANA COMPLETA',
                'OTROS': 'OTROS'
              };
              
              return nombresMembresias[tipoMembresia] || tipoMembresia;
            }
            
            // Mostrar tipo de membresía
            const nombreMembresia = obtenerNombreMembresia(clienteFirebase.membresia);
            clienteMembresia.textContent = nombreMembresia;
            
            // Calcular y mostrar días restantes para el vencimiento
            const hoy = new Date();
            const vencimiento = new Date(clienteFirebase.vencimiento);
            const diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
            
            if (diasRestantes > 7) {
              clienteDias.textContent = "TODA LA SEMANA";
            } else if (diasRestantes > 0) {
              clienteDias.textContent = `${diasRestantes} DÍAS`;
            } else if (diasRestantes === 0) {
              clienteDias.textContent = "HOY VENCE";
            } else {
              clienteDias.textContent = `VENCIDO HACE ${Math.abs(diasRestantes)} DÍAS`;
            }

            // Guardar localmente para futuras búsquedas
            if (!db.clientes.some((c) => c.id === clienteFirebase.id)) {
              db.clientes.push(clienteFirebase);
              localStorage.setItem("clientes", JSON.stringify(db.clientes));
            }
          } else {
            clienteInfo.style.display = "none";
            if (dni.length === 8) {
              alert("No se encontró un cliente activo con ese DNI");
            }
          }
        })
        .catch((error) => {
          console.error("Error buscando cliente en Firebase:", error);
          clienteInfo.style.display = "none";
        });
    } catch (error) {
      console.error("Error en búsqueda Firebase:", error);
      clienteInfo.style.display = "none";
    }
  } else {
    clienteInfo.style.display = "none";
    if (dni.length === 8) {
      alert("No se encontró un cliente activo con ese DNI");
    }
  }
}

// Función para actualizar UI (faltante en tu código original)
function actualizarUI() {
  // Si no está autenticado, mostrar mensaje en lugar de datos
  if (!isAuthenticated) {
    const listaClientes = document.getElementById("lista-clientes");
    const clientesRecientes = document.getElementById("clientes-recientes");

    if (listaClientes) {
      listaClientes.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-lock" style="font-size: 24px; margin-bottom: 10px;"></i><br>
                        Inicia sesión para ver los clientes
                    </td>
                </tr>
            `;
    }

    if (clientesRecientes) {
      clientesRecientes.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 20px; color: #666;">
                        Inicia sesión para ver clientes recientes
                    </td>
                </tr>
            `;
    }

    // Limpiar estadísticas del dashboard
    const clientesActivosElement = document.getElementById("clientes-activos");
    const pagosMesElement = document.getElementById("pagos-mes");
    const ingresosElement = document.getElementById("ingresos");

    if (clientesActivosElement) clientesActivosElement.textContent = "0";
    if (pagosMesElement) pagosMesElement.textContent = "0";
    if (ingresosElement) ingresosElement.textContent = "0.00";

    return; // Salir de la función early
  }
  // Actualizar dashboard
  const clientesActivos = db.clientes.filter((c) => c.activo).length;
  const clientesActivosElement = document.getElementById("clientes-activos");
  if (clientesActivosElement) {
    clientesActivosElement.textContent = clientesActivos;
  }

  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const pagosEsteMes = db.pagos.filter((p) => {
    const fechaPago = new Date(p.fecha);
    return fechaPago >= primerDiaMes;
  });

  const pagosMesElement = document.getElementById("pagos-mes");
  if (pagosMesElement) {
    pagosMesElement.textContent = pagosEsteMes.length;
  }

  const ingresos = pagosEsteMes.reduce((total, pago) => total + pago.monto, 0);
  const ingresosElement = document.getElementById("ingresos");
  if (ingresosElement) {
    ingresosElement.textContent = ingresos.toFixed(2);
  }

  // Actualizar lista de clientes recientes
  const clientesRecientes = db.clientes.slice(-5).reverse();
  const tbodyRecientes = document.getElementById("clientes-recientes");
  if (tbodyRecientes) {
    tbodyRecientes.innerHTML = "";

    clientesRecientes.forEach((cliente) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${cliente.nombre || "N/A"}</td>
        <td>${cliente.dni || "N/A"}</td>
        <td><span class="status ${
          cliente.activo ? "status-active" : "status-inactive"
        }">${cliente.activo ? "Activo" : "Inactivo"}</span></td>
      `;
      tbodyRecientes.appendChild(tr);
    });
  }

  // Actualizar lista completa de clientes si estamos en esa página
  if (
    window.location.pathname.includes("clientes.html") ||
    window.location.pathname.endsWith("/")
  ) {
    mostrarTodosLosClientes();
  }

  // Actualizar estadísticas de rendimiento si estamos en esa página
  if (window.location.pathname.includes("rendimientos.html")) {
    actualizarEstadisticasRendimiento();
  }
}

///Funcion para actualizarUI autententicado
function actualizarUIautenticado() {
  // Mostrar botón de cerrar sesión
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.style.display = "block";
    logoutBtn.onclick = cerrarSesion;
  }

  // Mostrar info del usuario
  const userInfo = document.getElementById("user-info");
  if (userInfo && userUID) {
    userInfo.textContent = `Usuario: ${userUID.substring(0, 8)}...`;
  }

  // Actualizar estado de conexión
  const connectionStatus = document.getElementById("connection-status");
  if (connectionStatus) {
    connectionStatus.innerHTML = `<i class="fas fa-user-check"></i> Conectado`;
    connectionStatus.className = "connection-status online";
  }

  console.log("✅ UI de autenticación actualizada");
}

// Función para actualizar estadísticas de rendimiento (faltante en tu código original)
function actualizarEstadisticasRendimiento() {
  const clientesActivos = db.clientes.filter((c) => c.activo).length;
  const totalClientes = db.clientes.length;

  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const pagosEsteMes = db.pagos.filter((p) => {
    const fechaPago = new Date(p.fecha);
    return fechaPago >= primerDiaMes;
  });

  const ingresos = pagosEsteMes.reduce((total, pago) => total + pago.monto, 0);

  // Clientes nuevos este mes (que se registraron este mes)
  const clientesNuevosEsteMes = db.clientes.filter((cliente) => {
    const fechaRegistro = new Date(cliente.fechaCreacion || cliente.id);
    return fechaRegistro >= primerDiaMes;
  }).length;

  // Actualizar los elementos en la página de rendimientos
  const nuevosClientesElement = document.getElementById("nuevos-clientes");
  const ingresosMesElement = document.getElementById("ingresos-mes");
  const clientesActivosMesElement = document.getElementById(
    "clientes-activos-mes"
  );
  const renovacionesMesElement = document.getElementById("renovaciones-mes");

  if (nuevosClientesElement)
    nuevosClientesElement.textContent = clientesNuevosEsteMes;
  if (ingresosMesElement) ingresosMesElement.textContent = ingresos.toFixed(2);
  if (clientesActivosMesElement)
    clientesActivosMesElement.textContent =
      totalClientes > 0
        ? Math.round((clientesActivos / totalClientes) * 100) + "%"
        : "0%";
  if (renovacionesMesElement) renovacionesMesElement.textContent = "76%"; // Valor de ejemplo

  // Actualizar texto de proyección
  const textoProyeccion = document.getElementById("texto-proyeccion");
  const listaRecomendaciones = document.getElementById("lista-recomendaciones");

  if (textoProyeccion && listaRecomendaciones) {
    if (totalClientes === 0) {
      textoProyeccion.textContent =
        "Aún no hay suficientes datos para mostrar proyecciones.";
      listaRecomendaciones.innerHTML =
        "<li>Comience agregando clientes y registrando pagos</li>";
    } else {
      textoProyeccion.textContent = `Tu gimnasio tiene ${totalClientes} clientes registrados, con ${clientesActivos} activos actualmente.`;

      // Generar recomendaciones basadas en los datos
      const ratioActivos = clientesActivos / totalClientes;
      let recomendaciones = [];

      if (ratioActivos < 0.7) {
        recomendaciones.push(
          "Implementa un programa de fidelización para mejorar la retención de clientes."
        );
      }

      if (clientesNuevosEsteMes < 5) {
        recomendaciones.push(
          "Considera realizar promociones para atraer nuevos clientes."
        );
      }

      if (recomendaciones.length === 0) {
        recomendaciones.push(
          "Tu gimnasio está teniendo un buen rendimiento. ¡Sigue así!"
        );
      }

      // Mostrar recomendaciones
      listaRecomendaciones.innerHTML = "";
      recomendaciones.forEach((recomendacion) => {
        const li = document.createElement("li");
        li.textContent = recomendacion;
        listaRecomendaciones.appendChild(li);
      });
    }
  }
}

// ==============================================
// PWA - SERVICE WORKER REGISTRATION
// ==============================================

// Registrar Service Worker para PWA
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register("/gymadmin/service-worker.js")
        .then(function (registration) {
          console.log(
            "ServiceWorker registration successful with scope: ",
            registration.scope
          );

          // Verificar si hay una nueva versión del Service Worker
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            console.log("Nueva versión del Service Worker encontrada");

            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  // Hay una nueva versión disponible
                  console.log(
                    "Nueva versión disponible. Por favor, actualiza la página."
                  );
                  showUpdateNotification();
                }
              }
            });
          });
        })
        .catch(function (error) {
          console.log("ServiceWorker registration failed: ", error);
        });
    });
  }
}

// Mostrar notificación de actualización
function showUpdateNotification() {
  // Puedes implementar un mensaje para el usuario si lo deseas
  console.log("Hay una nueva versión de la aplicación disponible");
}

// Detectar si la app está instalada
function trackAppInstallation() {
  window.addEventListener("appinstalled", (event) => {
    console.log("GymAdmin fue instalado como PWA");
    // Puedes trackear la instalación o realizar acciones adicionales
  });
}

// Inicializar funcionalidades PWA
function initializePWA() {
  registerServiceWorker();
  trackAppInstallation();
  initializeInstallPrompt();
}

// ==============================================
// INSTALACIÓN DE LA PWA - PROMPT PERSONALIZADO
// ==============================================

let deferredPrompt;

function initializeInstallPrompt() {
  const installButton = document.getElementById("installButton");

  if (!installButton) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Mostrar botón de instalación después de 10 segundos
    setTimeout(() => {
      if (deferredPrompt) {
        installButton.style.display = "block";
      }
    }, 10000);
  });

  // Al hacer clic en el botón de instalación
  installButton.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    // Mostrar el prompt de instalación nativo
    deferredPrompt.prompt();

    // Esperar a que el usuario decida
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("Usuario aceptó instalar la PWA");
      installButton.style.display = "none";
    }

    deferredPrompt = null;
  });

  // Ocultar el botón si ya está instalado
  window.addEventListener("appinstalled", () => {
    if (installButton) {
      installButton.style.display = "none";
    }
    deferredPrompt = null;
  });
}

// ==============================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ==============================================

// Inicializar PWA cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePWA);
} else {
  initializePWA();
}
