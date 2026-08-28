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

    pieza: "Anillo Corazón",
    variante: "Talla 6 · Rosa",
    precio: 690,

    fechaSolicitud: "12 mayo 2025",
    horaSolicitud: "10:42 AM",

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

    pieza: "Cadena Fina",
    variante: "45 cm · Amarillo",
    precio: 650,

    fechaSolicitud: "12 mayo 2025",
    horaSolicitud: "09:18 AM",

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

    pieza: "Huggies Pequeños",
    variante: "Blanco",
    precio: 430,

    fechaSolicitud: "11 mayo 2025",
    horaSolicitud: "04:35 PM",

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

    pieza: "Pulsera Eslabón",
    variante: "17 cm · Dorado",
    precio: 790,

    fechaSolicitud: "10 mayo 2025",
    horaSolicitud: "01:25 PM",

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

    pieza: "Dije Luna",
    variante: "Mediano · Dorado",
    precio: 520,

    fechaSolicitud: "9 mayo 2025",
    horaSolicitud: "11:20 AM",

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

    pieza: "Aretes Flor",
    variante: "Pequeños · Rosa",
    precio: 480,

    fechaSolicitud: "8 mayo 2025",
    horaSolicitud: "03:50 PM",

    deposito: "confirmado",

    estado: "cancelado",

    ultimaAccion: {
      texto: "Desapartado",
      fecha: "9 mayo 2025 · 10:30 AM",
      usuario: "Mariana Torres"
    }
  }
];

const CONFIG_STAFF_APARTADOS_EJEMPLO = {
  filasPorPagina: 6
};