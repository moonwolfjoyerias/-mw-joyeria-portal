// MW JOYERÍA — Ventana de depósito y piezas apartadas: datos de ejemplo
// ⚠️ TEMPORAL: se reemplaza por Firestore en Fase 3.

// Cuántas horas faltan para que venza la ventana (demo). En producción esto
// vendría calculado desde fechaConfirmacion + 3 días (o 15 si es foránea).
const VENTANA_EJEMPLO = {
  horasRestantes: 62.5, // ~2 días 14 horas y media
};

// variante: texto libre para mostrar (ej. "Talla 6 · Rosa")
const APARTADOS_EJEMPLO = [
  { id: 'a1', nombre: 'Anillo Corazón', variante: 'Talla 6 · Rosa', precioPublico: 690, precioEmprendedora: 410, emprendedora: 'María Fernanda', categoria: 'normal', telefono: '444 123 4567' },
  { id: 'a2', nombre: 'Cadena Fina 45cm', variante: '45cm · Amarillo', precioPublico: 650, precioEmprendedora: 390, emprendedora: 'Sofía Hernández', categoria: 'foranea', telefono: '444 234 5678' },
  { id: 'a3', nombre: 'Huggies Pequeños', variante: 'Blanco', precioPublico: 430, precioEmprendedora: 260, emprendedora: 'Valeria Ramírez', categoria: 'vip', telefono: '444 345 6789' },
];

// Datos bancarios de ejemplo — reemplazar por los reales de MW Joyería
const DATOS_BANCARIOS_EJEMPLO = {
  banco: 'BBVA (ejemplo)',
  titular: 'MW Joyería y Accesorios',
  clabe: '0121800123456789',
  cuenta: '0123456789',
};
