// MW JOYERÍA — Apartados Staff
// DATOS DE EJEMPLO
// ⚠️ TEMPORAL: estos datos serán reemplazados por Firestore en Fase 3.

const PERSONAL_EJEMPLO = [
  {
    usuario: "staff01",
    nombre: "Ana López",
    password: "1234"
  },
  {
    usuario: "MW0005",
    nombre: "María Camila Sánchez Calles",
    password: "2896"
  },
  {
    usuario: "admin01",
    nombre: "Claudia",
    password: "1234"
  }
];

const APARTADOS_STAFF_EJEMPLO = [
  {
    id: "AP-001",
    emprendedora: "María Fernanda",
    iniciales: "MF",
    telefono: "444 123 4567",
    categoria: "normal",

    pieza: "Anillo Corazón",
    variante: "Talla 6 · Rosa",
    precio: 690,

    fechaSolicitud: "12 mayo 2025",
    horaSolicitud: "10:42 AM",
    fechaConfirmacion: null,

    deposito: "pendiente",

    estado: "pendiente_deposito",

    ultimaAccion: {
      texto: "Solicitud creada",
      fecha: "12 mayo 2025 · 10:42 AM",
      usuario: "Sistema"
    }
  },

  {
    id: "AP-002",
    emprendedora: "Sofía Hernández",
    iniciales: "SH",
    telefono: "444 234 5678",
    categoria: "foranea",

    pieza: "Cadena Fina",
    variante: "45 cm · Amarillo",
    precio: 650,

    fechaSolicitud: "12 mayo 2025",
    horaSolicitud: "09:18 AM",
    fechaConfirmacion: "2025-05-12T11:05:00",

    deposito: "confirmado",

    estado: "deposito_confirmado",

    ultimaAccion: {
      texto: "Depósito confirmado",
      fecha: "12 mayo 2025 · 11:05 AM",
      usuario: "Ana López"
    }
  },

  {
    id: "AP-003",
    emprendedora: "Valeria Ramírez",
    iniciales: "VR",
    telefono: "444 345 6789",
    categoria: "vip",

    pieza: "Huggies Pequeños",
    variante: "Blanco",
    precio: 430,

    fechaSolicitud: "11 mayo 2025",
    horaSolicitud: "04:35 PM",
    fechaConfirmacion: "2025-05-11T17:10:00",

    deposito: "confirmado",

    estado: "activo",

    ultimaAccion: {
      texto: "Apartado confirmado",
      fecha: "11 mayo 2025 · 05:10 PM",
      usuario: "Mariana Torres"
    }
  },

  {
    id: "AP-004",
    emprendedora: "Daniela Martínez",
    iniciales: "DM",
    telefono: "444 456 7890",
    categoria: "normal",

    pieza: "Pulsera Eslabón",
    variante: "17 cm · Dorado",
    precio: 790,

    fechaSolicitud: "10 mayo 2025",
    horaSolicitud: "01:25 PM",
    fechaConfirmacion: "2025-05-10T14:02:00",

    deposito: "confirmado",

    estado: "activo",

    ultimaAccion: {
      texto: "Apartado confirmado",
      fecha: "10 mayo 2025 · 02:02 PM",
      usuario: "Ana López"
    }
  },

  {
    id: "AP-005",
    emprendedora: "Paola González",
    iniciales: "PG",
    telefono: "444 567 8901",
    categoria: "normal",

    pieza: "Dije Luna",
    variante: "Mediano · Dorado",
    precio: 520,

    fechaSolicitud: "9 mayo 2025",
    horaSolicitud: "11:20 AM",
    fechaConfirmacion: "2025-05-09T11:20:00",

    deposito: "confirmado",

    estado: "vencido",

    ultimaAccion: {
      texto: "Apartado vencido",
      fecha: "12 mayo 2025 · 11:20 AM",
      usuario: "Sistema"
    }
  },

  {
    id: "AP-006",
    emprendedora: "Andrea Castillo",
    iniciales: "AC",
    telefono: "444 678 9012",
    categoria: "vip",

    pieza: "Aretes Flor",
    variante: "Pequeños · Rosa",
    precio: 480,

    fechaSolicitud: "8 mayo 2025",
    horaSolicitud: "03:50 PM",
    fechaConfirmacion: "2025-05-08T15:50:00",

    deposito: "confirmado",

    estado: "cancelado",

    ultimaAccion: {
      texto: "Desapartado",
      fecha: "9 mayo 2025 · 10:30 AM",
      usuario: "Mariana Torres"
    }
  }
  ,
  {
    id: "AP-007",
    emprendedora: "Camila Rojas",
    iniciales: "CR",
    telefono: "444 789 0123",
    categoria: "foranea",
    pieza: "Dije Estrella",
    variante: "Grande · Dorado",
    precio: 580,
    fechaSolicitud: "12 mayo 2025",
    horaSolicitud: "08:45 AM",
    fechaConfirmacion: null,
    deposito: "pendiente",
    estado: "pendiente_deposito",
    ultimaAccion: {
      texto: "Solicitud creada",
      fecha: "12 mayo 2025 · 08:45 AM",
      usuario: "Sistema"
    }
  },
  {
    id: "AP-008",
    emprendedora: "Laura Méndez",
    iniciales: "LM",
    telefono: "444 890 1234",
    categoria: "normal",
    pieza: "Anillo Solitario",
    variante: "Talla 7 · Blanco",
    precio: 720,
    fechaSolicitud: "12 mayo 2025",
    horaSolicitud: "08:12 AM",
    fechaConfirmacion: null,
    deposito: "pendiente",
    estado: "pendiente_deposito",
    ultimaAccion: {
      texto: "Solicitud creada",
      fecha: "12 mayo 2025 · 08:12 AM",
      usuario: "Sistema"
    }
  },
  {
    id: "AP-009",
    emprendedora: "Nadia Torres",
    iniciales: "NT",
    telefono: "444 901 2345",
    categoria: "vip",
    pieza: "Pulsera Estrella",
    variante: "18 cm · Rosa",
    precio: 860,
    fechaSolicitud: "11 mayo 2025",
    horaSolicitud: "06:30 PM",
    fechaConfirmacion: null,
    deposito: "no_requiere",
    estado: "deposito_confirmado",
    ultimaAccion: {
      texto: "Solicitud creada",
      fecha: "11 mayo 2025 · 06:30 PM",
      usuario: "Sistema"
    }
  }
];

const CONFIG_STAFF_APARTADOS_EJEMPLO = {
  filasPorPagina: 6
};

const APARTADOS_STORAGE_KEY = "mw-staff-apartados-v3";

function obtenerIniciales(nombre) {
  return nombre.split(" ").map(parte => parte[0]).join("").slice(0, 2).toUpperCase();
}

function diasPermitidosApartado(categoria) {
  return categoria === "foranea" ? 15 : 3;
}

// Fuente única de verdad para "cuántos apartados hay y en qué estado":
// la usan tanto la página de Apartados como el resumen de Inicio, para
// que ambas muestren siempre los mismos números.
function calcularApartadosStaffActuales() {

  const apartadosEjemploCompartidos = (typeof APARTADOS_EJEMPLO === "undefined" ? [] : APARTADOS_EJEMPLO).map((apartado, index) => ({
    id: `EJ-${apartado.id || index + 1}`,
    emprendedora: apartado.emprendedora || "Usuario de ejemplo",
    iniciales: obtenerIniciales(apartado.emprendedora || "Usuario de ejemplo"),
    telefono: apartado.telefono || "",
    categoria: apartado.categoria || "normal",
    pieza: apartado.nombre,
    variante: apartado.variante,
    precio: apartado.precioEmprendedora,
    fechaSolicitud: "12 mayo 2025",
    horaSolicitud: "09:00 AM",
    fechaConfirmacion: new Date().toISOString(),
    deposito: apartado.categoria === "vip" ? "no_requiere" : "confirmado",
    estado: "activo",
    ultimaAccion: { texto: "Apartado confirmado", fecha: "12 mayo 2025 · 09:00 AM", usuario: "Sistema" }
  }));

  const datosIniciales = [...APARTADOS_STAFF_EJEMPLO, ...apartadosEjemploCompartidos];

  let apartados;

  try {
    const guardados = JSON.parse(localStorage.getItem(APARTADOS_STORAGE_KEY));
    apartados = Array.isArray(guardados) ? guardados : null;
  } catch (error) {
    apartados = null;
  }

  if (!apartados) {
    apartados = datosIniciales.map(apartado => ({
      ...apartado,
      ultimaAccion: apartado.ultimaAccion ? { ...apartado.ultimaAccion } : null
    }));
  }

  const ahora = Date.now();

  apartados.forEach(apartado => {
    if (apartado.estado !== "activo" || apartado.categoria === "vip" || apartado.deposito !== "confirmado" || !apartado.fechaConfirmacion) return;
    const limite = new Date(apartado.fechaConfirmacion).getTime() + diasPermitidosApartado(apartado.categoria) * 24 * 60 * 60 * 1000;
    if (ahora >= limite) apartado.estado = "vencido";
  });

  return apartados;

}