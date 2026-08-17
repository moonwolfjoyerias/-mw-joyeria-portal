// MW JOYERÍA — Datos de ejemplo del catálogo
// ⚠️ TEMPORAL: esta lista fija se reemplazará por una consulta real a
// Firestore cuando esté conectada (Fase 3). El resto del código (colecciones.js)
// no necesita cambiar — solo espera un array de objetos con esta misma forma:
//   { id, nombre, categoria, precioEtiqueta, destacado }
//
// categoria debe ser una de: 'oro-laminado' | 'acero-inoxidable' | 'exhibidores' | 'souvenirs'
// destacado: true = aparece en la vista previa de Colecciones (lo marca Staff/Admin)

const PRODUCTOS_EJEMPLO = [
  // Oro Laminado
  { id: 'ol-1', nombre: 'Collar Corazón Luz', categoria: 'oro-laminado', precioEtiqueta: 499, destacado: true },
  { id: 'ol-2', nombre: 'Pulsera Brillo Eterno', categoria: 'oro-laminado', precioEtiqueta: 459, destacado: true },
  { id: 'ol-3', nombre: 'Aretes Destello', categoria: 'oro-laminado', precioEtiqueta: 399, destacado: true },
  { id: 'ol-4', nombre: 'Anillo Luz Dorada', categoria: 'oro-laminado', precioEtiqueta: 429, destacado: true },

  // Acero Inoxidable
  { id: 'ai-1', nombre: 'Collar Esencia', categoria: 'acero-inoxidable', precioEtiqueta: 299, destacado: true },
  { id: 'ai-2', nombre: 'Pulsera Minimal', categoria: 'acero-inoxidable', precioEtiqueta: 259, destacado: true },
  { id: 'ai-3', nombre: 'Aretes Gota', categoria: 'acero-inoxidable', precioEtiqueta: 219, destacado: true },
  { id: 'ai-4', nombre: 'Anillo Infinito', categoria: 'acero-inoxidable', precioEtiqueta: 239, destacado: true },

  // Exhibidores y cajas de regalo
  { id: 'ex-1', nombre: 'Caja Terciopelo Chica', categoria: 'exhibidores', precioEtiqueta: 89, destacado: true },
  { id: 'ex-2', nombre: 'Exhibidor de Collares', categoria: 'exhibidores', precioEtiqueta: 149, destacado: true },
  { id: 'ex-3', nombre: 'Caja Regalo Dorada', categoria: 'exhibidores', precioEtiqueta: 99, destacado: true },
  { id: 'ex-4', nombre: 'Exhibidor de Anillos', categoria: 'exhibidores', precioEtiqueta: 119, destacado: true },

  // Souvenirs
  { id: 'sv-1', nombre: 'Playera MW Bordada', categoria: 'souvenirs', precioEtiqueta: 249, destacado: true },
  { id: 'sv-2', nombre: 'Libreta MW', categoria: 'souvenirs', precioEtiqueta: 129, destacado: true },
  { id: 'sv-3', nombre: 'Diadema Perlada', categoria: 'souvenirs', precioEtiqueta: 99, destacado: true },
  { id: 'sv-4', nombre: 'Sudadera MW', categoria: 'souvenirs', precioEtiqueta: 449, destacado: true },
];
