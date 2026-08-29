// MW JOYERÍA — Calendario editable (Staff / RH / Admin)
// DATOS DE EJEMPLO
// ⚠️ TEMPORAL: se reemplazará por Firestore en Fase 3.
//
// Según el documento de requisitos (Sección 9), el calendario de
// actividades es editable por Staff, RH y Administrativos.
//
// IMPORTANTE:
// Las credenciales de abajo son únicamente para simulación.
// En producción se utilizará autenticación real.

const CALENDARIO_USUARIOS_EJEMPLO = [
  {
    usuario: 'staff01',
    nombre: 'Staff MW',
    password: '1234'
  },
  {
    usuario: 'MW0005',
    nombre: 'María Camila Sánchez Calles',
    password: '2896'
  },
  {
    usuario: 'rh01',
    nombre: 'Recursos Humanos',
    password: '1234'
  },
  {
    usuario: 'admin01',
    nombre: 'Claudia',
    password: '1234'
  }
];

const TIPOS_EVENTO_CALENDARIO = [
  { key: 'presencial', label: 'Presencial' },
  { key: 'virtual', label: 'Virtual' }
];
