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
// precioEtiqueta: precio que aparece en todos los catálogos
// descuento: % aplicado sobre precioEtiqueta para el precio de emprendedora

const CATEGORIAS_ORO = [
  'Arracadas', 'Aretes', 'Anillos', 'Broqueles', 'Brazaletes', 'Cadenas', 'Collares',
  'Dijes', 'Fin de semana', 'Huggies', 'Juegos', 'Misterios', 'Pulseras', 'Prendedores',
  'Relicarios', 'Rosarios', 'Simuladores', 'Semanarios', 'Tobilleras', 'Tiaras',
];
const CATEGORIAS_ACERO = ['Aretes', 'Pulseras', 'Cadenas', 'Anillos', 'Collares'];
const COLORES_ORO = ['Blanco', 'Amarillo', 'Dorado', 'Rosa', 'Negro'];

const CATALOGO_EJEMPLO = [
  { id: 'c1', nombre: 'Arracadas Luna', material: 'oro-laminado', categoria: 'Arracadas', calidad: 'estandar', colorOro: 'Amarillo', precioEtiqueta: 380, descuento: 60, disponible: true },
  { id: 'c2', nombre: 'Aretes Destello', material: 'oro-laminado', categoria: 'Aretes', calidad: 'premium', colorOro: 'Dorado', precioEtiqueta: 420, descuento: 60, disponible: true },
  { id: 'c3', nombre: 'Anillo Infinito', material: 'oro-laminado', categoria: 'Anillos', calidad: 'estandar', colorOro: 'Blanco', talla: '7', precioEtiqueta: 350, descuento: 60, disponible: true },
  { id: 'c4', nombre: 'Anillo Corazón', material: 'oro-laminado', categoria: 'Anillos', calidad: 'premium', colorOro: 'Rosa', talla: '6', precioEtiqueta: 410, descuento: 60, disponible: true },
  { id: 'c5', nombre: 'Broqueles Mini', material: 'oro-laminado', categoria: 'Broqueles', calidad: 'estandar', colorOro: 'Amarillo', precioEtiqueta: 210, descuento: 60, disponible: true },
  { id: 'c6', nombre: 'Brazalete Cadena', material: 'oro-laminado', categoria: 'Brazaletes', calidad: 'premium', colorOro: 'Dorado', precioEtiqueta: 480, descuento: 60, disponible: false },
  { id: 'c7', nombre: 'Cadena Fina 45cm', material: 'oro-laminado', categoria: 'Cadenas', calidad: 'estandar', colorOro: 'Amarillo', talla: '45cm', precioEtiqueta: 390, descuento: 60, disponible: true },
  { id: 'c8', nombre: 'Cadena Gruesa 50cm', material: 'oro-laminado', categoria: 'Cadenas', calidad: 'premium', colorOro: 'Negro', talla: '50cm', precioEtiqueta: 520, descuento: 60, disponible: true },
  { id: 'c9', nombre: 'Collar Gota', material: 'oro-laminado', categoria: 'Collares', calidad: 'estandar', colorOro: 'Rosa', precioEtiqueta: 340, descuento: 60, disponible: true },
  { id: 'c10', nombre: 'Dije Corazón', material: 'oro-laminado', categoria: 'Dijes', calidad: 'estandar', colorOro: 'Dorado', precioEtiqueta: 190, descuento: 60, disponible: true },
  { id: 'c11', nombre: 'Huggies Pequeños', material: 'oro-laminado', categoria: 'Huggies', calidad: 'premium', colorOro: 'Blanco', precioEtiqueta: 260, descuento: 60, disponible: true },
  { id: 'c12', nombre: 'Pulsera Tenis', material: 'oro-laminado', categoria: 'Pulseras', calidad: 'premium', colorOro: 'Dorado', precioEtiqueta: 610, descuento: 60, disponible: true },
  { id: 'c13', nombre: 'Aretes Acero Clásicos', material: 'acero-inoxidable', categoria: 'Aretes', precioEtiqueta: 180, descuento: 40, disponible: true },
  { id: 'c14', nombre: 'Pulsera Acero Minimal', material: 'acero-inoxidable', categoria: 'Pulseras', precioEtiqueta: 220, descuento: 40, disponible: true },
  { id: 'c15', nombre: 'Caja Regalo Dorada', material: 'exhibidores', precioEtiqueta: 99, descuento: 30, disponible: true },
  { id: 'c16', nombre: 'Playera MW Bordada', material: 'souvenirs', precioEtiqueta: 249, descuento: 0, disponible: true },
  { id: 'c17', nombre: 'Set de fantasía floral', material: 'fantasia', categoria: 'Fantasía', precioEtiqueta: 280, descuento: 0, disponible: true },
  { id: 'c18', nombre: 'Pulsera de regalo especial', material: 'otros', categoria: 'Otros', precioEtiqueta: 310, descuento: 0, disponible: true },
];
