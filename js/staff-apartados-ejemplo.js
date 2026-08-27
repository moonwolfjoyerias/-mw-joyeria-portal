// ============================================================
// MW JOYERÍA — Panel de Staff — Apartados: datos de ejemplo
// ⚠️ TEMPORAL: se reemplaza por Firestore/Auth en Fase 3.
// ============================================================

// ------------------------------------------------------------
// CREDENCIALES DE PERSONAL — SOLO DEMO
// En producción NUNCA deben almacenarse contraseñas aquí.
// ------------------------------------------------------------

const PERSONAL_EJEMPLO = [
  {
    usuario: 'staff.sofia',
    password: 'MW2025',
    nombre: 'Staff Sofía',
    rol: 'Vendedora'
  },
  {
    usuario: 'staff.mariana',
    password: 'MW2025',
    nombre: 'Staff Mariana',
    rol: 'Vendedora'
  },
  {
    usuario: 'admin.mw',
    password: 'MW2025',
    nombre: 'Admin MW',
    rol: 'Administrador'
  }
];


// ------------------------------------------------------------
// DATOS DE APARTADOS DE EJEMPLO
// ------------------------------------------------------------

const APARTADOS_STAFF_EJEMPLO = [

  // ==========================================================
  // PENDIENTE DE DEPÓSITO
  // ==========================================================

  {
    id: 'APT-0001',

    cliente: {
      nombre: 'Ana Martínez',
      id: 'CLI-00245',
      iniciales: 'AM',
      telefono: '444 123 4567'
    },

    pieza: {
      nombre: 'Collar Corazón',
      codigo: 'AN0123',
      variante: 'Dorado · 45 cm',
      imagen: '../assets/images/isotipo-morado.png'
    },

    fechaSolicitud: '12/05/2025',
    horaSolicitud: '10:24 a.m.',

    deposito: {
      monto: 50,
      estado: 'pendiente'
    },

    estado: 'pendiente-deposito',

    ultimaAccion: {
      usuario: 'staff.sofia',
      nombre: 'Staff Sofía',
      fecha: '12/05/2025',
      hora: '10:24 a.m.'
    }
  },


  {
    id: 'APT-0002',

    cliente: {
      nombre: 'Carmen López',
      id: 'CLI-00246',
      iniciales: 'CL',
      telefono: '444 222 3344'
    },

    pieza: {
      nombre: 'Arracadas Lisas',
      codigo: 'AR0098',
      variante: 'Dorado · Medianas',
      imagen: '../assets/images/isotipo-morado.png'
    },

    fechaSolicitud: '11/05/2025',
    horaSolicitud: '06:45 p.m.',

    deposito: {
      monto: 50,
      estado: 'pendiente'
    },

    estado: 'pendiente-deposito',

    ultimaAccion: {
      usuario: 'staff.sofia',
      nombre: 'Staff Sofía',
      fecha: '11/05/2025',
      hora: '06:45 p.m.'
    }
  },


  // ==========================================================
  // DEPÓSITO CONFIRMADO
  // ==========================================================

  {
    id: 'APT-0003',

    cliente: {
      nombre: 'Laura Rodríguez',
      id: 'CLI-00244',
      iniciales: 'LR',
      telefono: '444 333 4455'
    },

    pieza: {
      nombre: 'Anillo Brillante',
      codigo: 'AN0456',
      variante: 'Dorado · Talla 7',
      imagen: '../assets/images/isotipo-morado.png'
    },

    fechaSolicitud: '12/05/2025',
    horaSolicitud: '09:15 a.m.',

    deposito: {
      monto: 50,
      estado: 'confirmado'
    },

    estado: 'deposito-confirmado',

    ultimaAccion: {
      usuario: 'staff.mariana',
      nombre: 'Staff Mariana',
      fecha: '12/05/2025',
      hora: '09:18 a.m.'
    }
  },


  {
    id: 'APT-0004',

    cliente: {
      nombre: 'Fernanda Torres',
      id: 'CLI-00247',
      iniciales: 'FT',
      telefono: '444 444 5566'
    },

    pieza: {
      nombre: 'Cadena Fina',
      codigo: 'CA0234',
      variante: 'Dorado · 50 cm',
      imagen: '../assets/images/isotipo-morado.png'
    },

    fechaSolicitud: '12/05/2025',
    horaSolicitud: '08:42 a.m.',

    deposito: {
      monto: 50,
      estado: 'confirmado'
    },

    estado: 'deposito-confirmado',

    ultimaAccion: {
      usuario: 'staff.sofia',
      nombre: 'Staff Sofía',
      fecha: '12/05/2025',
      hora: '08:50 a.m.'
    }
  },


  // ==========================================================
  // APARTADO ACTIVO
  // ==========================================================

  {
    id: 'APT-0005',

    cliente: {
      nombre: 'Julia García',
      id: 'CLI-00242',
      iniciales: 'JG',
      telefono: '444 555 6677'
    },

    pieza: {
      nombre: 'Pulsera Figaro',
      codigo: 'PU0234',
      variante: 'Dorado · 18 cm',
      imagen: '../assets/images/isotipo-morado.png'
    },

    fechaSolicitud: '11/05/2025',
    horaSolicitud: '03:30 p.m.',

    deposito: {
      monto: 50,
      estado: 'confirmado'
    },

    estado: 'apartado-activo',

    ultimaAccion: {
      usuario: 'staff.mariana',
      nombre: 'Staff Mariana',
      fecha: '11/05/2025',
      hora: '03:32 p.m.'
    }
  },


  {
    id: 'APT-0006',

    cliente: {
      nombre: 'Mariana Sánchez',
      id: 'CLI-00248',
      iniciales: 'MS',
      telefono: '444 666 7788'
    },

    pieza: {
      nombre: 'Dije Estrella',
      codigo: 'DI0567',
      variante: 'Dorado',
      imagen: '../assets/images/isotipo-morado.png'
    },

    fechaSolicitud: '10/05/2025',
    horaSolicitud: '01:20 p.m.',

    deposito: {
      monto: 50,
      estado: 'confirmado'
    },

    estado: 'apartado-activo',

    ultimaAccion: {
      usuario: 'staff.sofia',
      nombre: 'Staff Sofía',
      fecha: '10/05/2025',
      hora: '01:25 p.m.'
    }
  },


  // ==========================================================
  // VENCIDO
  // ==========================================================

  {
    id: 'APT-0007',

    cliente: {
      nombre: 'Paola Hernández',
      id: 'CLI-00249',
      iniciales: 'PH',
      telefono: '444 777 8899'
    },

    pieza: {
      nombre: 'Aretes Perla',
      codigo: 'AR0789',
      variante: 'Blanco · Medianos',
      imagen: '../assets/images/isotipo-morado.png'
    },

    fechaSolicitud: '08/05/2025',
    horaSolicitud: '11:10 a.m.',

    deposito: {
      monto: 50,
      estado: 'confirmado'
    },

    estado: 'vencido',

    ultimaAccion: {
      usuario: 'staff.sofia',
      nombre: 'Staff Sofía',
      fecha: '11/05/2025',
      hora: '11:10 a.m.'
    }
  },


  // ==========================================================
  // DESAPARTADO / CANCELADO
  // ==========================================================

  {
    id: 'APT-0008',

    cliente: {
      nombre: 'Daniela Ramírez',
      id: 'CLI-00250',
      iniciales: 'DR',
      telefono: '444 888 9900'
    },

    pieza: {
      nombre: 'Anillo Luna',
      codigo: 'AN0890',
      variante: 'Dorado · Talla 6',
      imagen: '../assets/images/isotipo-morado.png'
    },

    fechaSolicitud: '07/05/2025',
    horaSolicitud: '04:15 p.m.',

    deposito: {
      monto: 50,
      estado: 'confirmado'
    },

    estado: 'desapartado',

    ultimaAccion: {
      usuario: 'staff.mariana',
      nombre: 'Staff Mariana',
      fecha: '09/05/2025',
      hora: '05:20 p.m.'
    }
  }

];


// ------------------------------------------------------------
// OPCIONES GENERALES DEL PANEL
// ------------------------------------------------------------

const CONFIG_STAFF_APARTADOS_EJEMPLO = {

  nombrePanel: 'Panel de Staff',

  titulo: 'Apartados',

  descripcion:
    'Gestiona las solicitudes, depósitos y apartados de las emprendedoras.',

  depositoInicial: 50,

  diasResguardo: 3,

  moneda: 'MXN',

  paginaActual: 1,

  filasPorPagina: 10

};