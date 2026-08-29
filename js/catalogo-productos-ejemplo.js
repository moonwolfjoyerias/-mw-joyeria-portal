// MW JOYERÍA — Catálogo de mayoreo: datos de ejemplo
// ⚠️ TEMPORAL: esta lista se reemplaza por Firestore en Fase 3. El resto
// del código (catalogo.js) no necesita cambiar — solo espera un array de
// objetos con esta misma forma.
//
// material: 'oro-laminado' | 'acero-inoxidable' | 'exhibidores' | 'souvenirs' | 'fantasia' | 'otros'
// categoria: tipo de pieza (Aretes, Pulseras, etc.) — solo aplica a oro-laminado y acero-inoxidable
// calidad: 'estandar' | 'premium' — SOLO aplica a oro-laminado (no afecta precio, es descriptivo)
// colorOro: 'blanco'|'amarillo'|'dorado'|'rosa'|'negro' — SOLO aplica a oro-laminado
// talla: string — solo en Anillos y Cadenas
// precioMayoreo: precio ya con el % de descuento de mayoreo aplicado

const CATEGORIAS_ORO = [
  'Arracadas', 'Aretes', 'Anillos', 'Broqueles', 'Brazaletes', 'Cadenas', 'Collares',
  'Dijes', 'Fin de semana', 'Huggies', 'Juegos', 'Misterios', 'Pulseras', 'Prendedores',
  'Relicarios', 'Rosarios', 'Simuladores', 'Semanarios', 'Tobilleras', 'Tiaras',
];
const CATEGORIAS_ACERO = ['Aretes', 'Pulseras', 'Cadenas', 'Anillos', 'Collares'];
const COLORES_ORO = ['Blanco', 'Amarillo', 'Dorado', 'Rosa', 'Negro'];

const CATALOGO_EJEMPLO = [
  { id: 'c1', nombre: 'Arracadas Luna', material: 'oro-laminado', categoria: 'Arracadas', calidad: 'estandar', colorOro: 'Amarillo', precioMayoreo: 380, disponible: true },
  { id: 'c2', nombre: 'Aretes Destello', material: 'oro-laminado', categoria: 'Aretes', calidad: 'premium', colorOro: 'Dorado', precioMayoreo: 420, disponible: true },
  { id: 'c3', nombre: 'Anillo Infinito', material: 'oro-laminado', categoria: 'Anillos', calidad: 'estandar', colorOro: 'Blanco', talla: '7', precioMayoreo: 350, disponible: true },
  { id: 'c4', nombre: 'Anillo Corazón', material: 'oro-laminado', categoria: 'Anillos', calidad: 'premium', colorOro: 'Rosa', talla: '6', precioMayoreo: 410, disponible: true },
  { id: 'c5', nombre: 'Broqueles Mini', material: 'oro-laminado', categoria: 'Broqueles', calidad: 'estandar', colorOro: 'Amarillo', precioMayoreo: 210, disponible: true },
  { id: 'c6', nombre: 'Brazalete Cadena', material: 'oro-laminado', categoria: 'Brazaletes', calidad: 'premium', colorOro: 'Dorado', precioMayoreo: 480, disponible: false },
  { id: 'c7', nombre: 'Cadena Fina 45cm', material: 'oro-laminado', categoria: 'Cadenas', calidad: 'estandar', colorOro: 'Amarillo', talla: '45cm', precioMayoreo: 390, disponible: true },
  { id: 'c8', nombre: 'Cadena Gruesa 50cm', material: 'oro-laminado', categoria: 'Cadenas', calidad: 'premium', colorOro: 'Negro', talla: '50cm', precioMayoreo: 520, disponible: true },
  { id: 'c9', nombre: 'Collar Gota', material: 'oro-laminado', categoria: 'Collares', calidad: 'estandar', colorOro: 'Rosa', precioMayoreo: 340, disponible: true },
  { id: 'c10', nombre: 'Dije Corazón', material: 'oro-laminado', categoria: 'Dijes', calidad: 'estandar', colorOro: 'Dorado', precioMayoreo: 190, disponible: true },
  { id: 'c11', nombre: 'Huggies Pequeños', material: 'oro-laminado', categoria: 'Huggies', calidad: 'premium', colorOro: 'Blanco', precioMayoreo: 260, disponible: true },
  { id: 'c12', nombre: 'Pulsera Tenis', material: 'oro-laminado', categoria: 'Pulseras', calidad: 'premium', colorOro: 'Dorado', precioMayoreo: 610, disponible: true },
  { id: 'c13', nombre: 'Aretes Acero Clásicos', material: 'acero-inoxidable', categoria: 'Aretes', precioMayoreo: 180, disponible: true },
  { id: 'c14', nombre: 'Pulsera Acero Minimal', material: 'acero-inoxidable', categoria: 'Pulseras', precioMayoreo: 220, disponible: true },
  { id: 'c15', nombre: 'Caja Regalo Dorada', material: 'exhibidores', precioMayoreo: 99, disponible: true },
  { id: 'c16', nombre: 'Playera MW Bordada', material: 'souvenirs', precioMayoreo: 249, disponible: true },
  { id: 'c17', nombre: 'Set de fantasía floral', material: 'fantasia', categoria: 'Fantasía', precioMayoreo: 280, disponible: true },
  { id: 'c18', nombre: 'Pulsera de regalo especial', material: 'otros', categoria: 'Otros', precioMayoreo: 310, disponible: true },
];
