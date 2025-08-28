// Al inicio de app.js, antes de inicializar Firebase
const isFirebaseAvailable =
  typeof firebase !== "undefined" && firebase.apps.length > 0;

if (!isFirebaseAvailable) {
  console.log("Firebase no disponible, usando modo offline");
  // Aquí cargarías datos desde localStorage
}
// Variables globales para Firebase
let dbFirebase = null;
let authFirebase = null;
let userUID = null;

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
    // Verificar si Firebase está disponible
    if (typeof firebase !== "undefined" && firebase.apps.length > 0) {
      dbFirebase = firebase.firestore();
      authFirebase = firebase.auth();
      console.log("Firebase inicializado correctamente");

      // Configurar observador de autenticación
      authFirebase.onAuthStateChanged((user) => {
        if (user) {
          userUID = user.uid;
          console.log("Usuario autenticado:", userUID);
          // Cargar datos desde Firebase
          cargarDatosDesdeFirebase();
        } else {
          console.log("Usuario no autenticado, usando datos locales");
          // Usar datos locales
          cargarDatosIniciales();
          cargarNotificaciones();
        }
      });
    } else {
      console.log("Firebase no disponible, usando modo offline");
      cargarDatosIniciales();
    }
  } catch (error) {
    console.error("Error inicializando Firebase:", error);
    cargarDatosIniciales();
  }
}

// Cargar datos desde Firebase
async function cargarDatosDesdeFirebase() {
  if (!dbFirebase || !userUID) {
    console.log("Firebase no disponible, usando datos locales");
    cargarDatosIniciales();
    return;
  }

  try {
    console.log("Cargando datos desde Firebase...");

    // Cargar clientes
    const clientesSnapshot = await dbFirebase
      .collection("clientes")
      .where("userId", "==", userUID)
      .get();

    db.clientes = [];
    clientesSnapshot.forEach((doc) => {
      db.clientes.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Cargar pagos
    const pagosSnapshot = await dbFirebase
      .collection("pagos")
      .where("userId", "==", userUID)
      .get();

    db.pagos = [];
    pagosSnapshot.forEach((doc) => {
      db.pagos.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Cargar configuración
    const configDoc = await dbFirebase
      .collection("configuracion")
      .doc(userUID)
      .get();

    if (configDoc.exists) {
      db.configuracion = configDoc.data();
    }

    // Guardar en localStorage para offline
    localStorage.setItem("clientes", JSON.stringify(db.clientes));
    localStorage.setItem("pagos", JSON.stringify(db.pagos));
    localStorage.setItem("configuracion", JSON.stringify(db.configuracion));

    console.log("Datos cargados desde Firebase");

    // Actualizar UI
    actualizarUI();
    cargarNotificaciones();
  } catch (error) {
    console.error("Error cargando datos desde Firebase:", error);
    cargarDatosIniciales();
  }
}

// Guardar cliente en Firebase y localmente
async function guardarClienteEnFirebase(cliente) {
  // Guardar localmente primero para respuesta inmediata
  const nuevoCliente = {
    id: Date.now().toString(),
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

// Eliminar cliente de Firebase y localmente
async function eliminarClienteDeFirebase(id) {
  // Eliminar localmente primero
  const index = db.clientes.findIndex((cliente) => cliente.id === id);
  if (index !== -1) {
    db.clientes.splice(index, 1);
    // Eliminar pagos asociados al cliente
    db.pagos = db.pagos.filter((pago) => pago.clienteId !== id);

    localStorage.setItem("clientes", JSON.stringify(db.clientes));
    localStorage.setItem("pagos", JSON.stringify(db.pagos));

    // Actualizar UI
    actualizarUI();
    cargarNotificaciones();
  }

  // Eliminar de Firebase si está disponible
  if (dbFirebase) {
    try {
      await dbFirebase.collection("clientes").doc(id).delete();
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

  const nuevoCliente = {
    nombre: nombre,
    dni: dni,
    telefono: telefono,
    email: email,
    membresia: membresia,
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
  const modalEliminar = document.getElementById("modal-eliminar");
  const cancelarEliminar = document.getElementById("cancelar-eliminar");
  const confirmarEliminar = document.getElementById("confirmar-eliminar");
  const nombreEliminar = document.getElementById("cliente-eliminar-nombre");

  let clienteIdAEliminar = null;

  // Delegación: escuchar clicks en toda la tabla
  document.addEventListener("click", (e) => {
    if (e.target.closest(".btn-eliminar")) {
      const btn = e.target.closest(".btn-eliminar");
      clienteIdAEliminar = btn.dataset.id;
      const nombre = btn.dataset.nombre;

      nombreEliminar.textContent = nombre;
      modalEliminar.style.display = "flex";
    }
  });

  // Cancelar
  cancelarEliminar.addEventListener("click", () => {
    modalEliminar.style.display = "none";
    clienteIdAEliminar = null;
  });

  // Confirmar
  confirmarEliminar.addEventListener("click", async () => {
    if (!clienteIdAEliminar) return;

    try {
      await db.collection("clientes").doc(clienteIdAEliminar).delete();

      // Quitar la fila de la tabla
      const fila = document
        .querySelector(`.btn-eliminar[data-id="${clienteIdAEliminar}"]`)
        ?.closest("tr");

      if (fila) fila.remove();

      alert("✅ Cliente eliminado con éxito");
    } catch (error) {
      console.error("❌ Error eliminando cliente:", error);
      alert("Error eliminando cliente");
    }

    modalEliminar.style.display = "none";
    clienteIdAEliminar = null;
  });
}

// Función para eliminar cliente (modificada para Firebase)
function eliminarCliente(id) {
  eliminarClienteDeFirebase(id);
  alert("Cliente eliminado correctamente");
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
      platino: parseFloat(document.getElementById("precio-platino").value) || 0,
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
function cargarHeader() {
  const headerContainer = document.getElementById("header-container");
  if (!headerContainer) return;

  fetch("partials/header.html")
    .then((response) => response.text())
    .then((data) => {
      headerContainer.innerHTML = data;
      inicializarNavegacion();
      // Marcar la página activa en el menú
      const currentPage = window.location.pathname.split("/").pop();
      document.querySelectorAll("nav a").forEach((link) => {
        if (
          link.getAttribute("href") === currentPage ||
          (currentPage === "" && link.getAttribute("href") === "index.html")
        ) {
          link.classList.add("active");
        }
      });
    })
    .catch((error) => {
      console.error("Error cargando el header:", error);
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
  // Si no hay datos, cargar algunos de ejemplo
  if (db.clientes.length === 0) {
    const today = new Date();

    // Crear fechas de vencimiento próximas para notificaciones
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const inThreeDays = new Date(today);
    inThreeDays.setDate(today.getDate() + 3);

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);

    // db.clientes = [
    //   {
    //     id: 1,
    //     nombre: "Juan Pérez",
    //     dni: "12345678",
    //     telefono: "123456789",
    //     email: "juan@email.com",
    //     membresia: "Premium",
    //     vencimiento: formatDate(nextMonth),
    //     activo: true,
    //   },
    //   {
    //     id: 2,
    //     nombre: "María García",
    //     dni: "87654321",
    //     telefono: "987654321",
    //     email: "maria@email.com",
    //     membresia: "Básica",
    //     vencimiento: formatDate(tomorrow),
    //     activo: true,
    //   },
    //   {
    //     id: 3,
    //     nombre: "Carlos López",
    //     dni: "55555555",
    //     telefono: "555123456",
    //     email: "carlos@email.com",
    //     membresia: "Premium",
    //     vencimiento: formatDate(yesterday),
    //     activo: false,
    //   },
    //   {
    //     id: 4,
    //     nombre: "Ana Martínez",
    //     dni: "11111111",
    //     telefono: "444789123",
    //     email: "ana@email.com",
    //     membresia: "Premium",
    //     vencimiento: formatDate(inThreeDays),
    //     activo: true,
    //   },
    //   {
    //     id: 5,
    //     nombre: "Luis Rodríguez",
    //     dni: "22222222",
    //     telefono: "333456789",
    //     email: "luis@email.com",
    //     membresia: "Oro",
    //     vencimiento: formatDate(nextMonth),
    //     activo: true,
    //   },
    //   {
    //     id: 6,
    //     nombre: "Marta Sánchez",
    //     dni: "33333333",
    //     telefono: "222987654",
    //     email: "marta@email.com",
    //     membresia: "Básica",
    //     vencimiento: formatDate(yesterday),
    //     activo: false,
    //   },
    //   {
    //     id: 7,
    //     nombre: "Pedro Gómez",
    //     dni: "44444444",
    //     telefono: "111222333",
    //     email: "pedro@email.com",
    //     membresia: "Platino",
    //     vencimiento: formatDate(nextWeek),
    //     activo: true,
    //   },
    // ];
    localStorage.setItem("clientes", JSON.stringify(db.clientes));
  }

  // Generar algunos pagos de ejemplo
  if (db.pagos.length === 0) {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);

    db.pagos = [
      {
        id: 1,
        clienteId: 1,
        monto: 1500,
        fecha: formatDate(today),
        timestamp: today.toISOString(),
      },
      {
        id: 2,
        clienteId: 2,
        monto: 1000,
        fecha: formatDate(today),
        timestamp: today.toISOString(),
      },
      {
        id: 3,
        clienteId: 4,
        monto: 1500,
        fecha: formatDate(today),
        timestamp: today.toISOString(),
      },
      {
        id: 4,
        clienteId: 5,
        monto: 2000,
        fecha: formatDate(today),
        timestamp: today.toISOString(),
      },
      {
        id: 5,
        clienteId: 1,
        monto: 1500,
        fecha: formatDate(lastMonth),
        timestamp: lastMonth.toISOString(),
      },
      {
        id: 6,
        clienteId: 3,
        monto: 1500,
        fecha: formatDate(lastMonth),
        timestamp: lastMonth.toISOString(),
      },
    ];
    localStorage.setItem("pagos", JSON.stringify(db.pagos));
  }

  // Guardar configuración por defecto si no existe
  if (!localStorage.getItem("configuracion")) {
    localStorage.setItem("configuracion", JSON.stringify(db.configuracion));
  } else {
    db.configuracion = JSON.parse(localStorage.getItem("configuracion"));
  }
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
  // Cargar el header
  cargarHeader();

  // Inicializar Firebase
  inicializarFirebase();

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
  console.log("Inicializando página de clientes...");

  // Mostrar todos los clientes
  mostrarTodosLosClientes();

  // Configurar event listeners para el buscador
  const btnBuscarCliente = document.getElementById("btn-buscar-cliente");
  const inputBuscarCliente = document.getElementById("input-buscar-cliente");

  console.log("Elementos de búsqueda:", {
    btnBuscarCliente: !!btnBuscarCliente,
    inputBuscarCliente: !!inputBuscarCliente,
  });

  if (btnBuscarCliente && inputBuscarCliente) {
    btnBuscarCliente.addEventListener("click", buscarClientes);
    inputBuscarCliente.addEventListener("keyup", buscarClientes);
    console.log("Event listeners de búsqueda configurados correctamente");
  } else {
    console.error("No se encontraron los elementos de búsqueda");
  }

  // Configurar event listeners para otros elementos
  const btnNuevoCliente = document.getElementById("nuevo-cliente");
  const btnGuardarCliente = document.getElementById("guardar-cliente");
  const btnCancelarCliente = document.getElementById("cancelar-cliente");
  const btnCancelarEliminar = document.getElementById("cancelar-eliminar");
  const btnConfirmarEliminar = document.getElementById("confirmar-eliminar");

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

  if (btnCancelarEliminar) {
    btnCancelarEliminar.addEventListener("click", () => {
      document.getElementById("modal-eliminar").classList.remove("active");
      clienteIdAEliminar = null;
    });
  }

  if (btnConfirmarEliminar) {
    btnConfirmarEliminar.addEventListener("click", confirmarEliminacion);
  }
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
  document.getElementById("precio-platino").value =
    db.configuracion.precios.platino || "";

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
function formatearTelefonoWhatsApp(telefono) {
  // Eliminar cualquier carácter que no sea número
  let numero = telefono.replace(/\D/g, "");

  // Si el número empieza con 0 (para números argentinos), reemplazar por 54
  if (numero.startsWith("0")) {
    numero = "54" + numero.substring(1);
  }

  // Si el número tiene 10 dígitos y empieza con 15 (para móviles argentinos)
  if (numero.length === 10 && numero.startsWith("15")) {
    numero = "549" + numero.substring(2);
  }

  // Si el número no tiene código de país, agregar el de Argentina (54)
  if (numero.length === 10 && !numero.startsWith("54")) {
    numero = "54" + numero;
  }

  return numero;
}

// Función para mostrar todos los clientes (faltante en tu código original)
function mostrarTodosLosClientes() {
  const listaClientes = document.getElementById("lista-clientes");
  if (!listaClientes) return;

  listaClientes.innerHTML = "";

  if (db.clientes.length === 0) {
    listaClientes.innerHTML =
      '<tr><td colspan="7" style="text-align: center;">No hay clientes registrados</td></tr>';
    return;
  }

  db.clientes.forEach((cliente) => {
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
function buscarClientePorDni() {
  const dni = document.getElementById("buscar-dni").value;
  const clienteInfo = document.getElementById("cliente-info");
  const clienteNombre = document.getElementById("cliente-nombre");

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
    clienteNombre.textContent = `${clienteLocal.nombre || "Cliente"} - ${
      clienteLocal.membresia || "Sin membresía"
    }`;
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
            clienteNombre.textContent = `${
              clienteFirebase.nombre || "Cliente"
            } - ${clienteFirebase.membresia || "Sin membresía"}`;

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
        .register("/service-worker.js")
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
