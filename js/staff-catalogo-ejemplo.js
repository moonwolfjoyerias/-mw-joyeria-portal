// MW JOYERÍA — Catálogo Staff
// DATOS DE EJEMPLO
// ⚠️ TEMPORAL: se reemplazará por Firestore en Fase 3.
//
// Este archivo contiene productos de demostración.
// La existencia (stock) SOLO se muestra en Staff/RH/Admin.
//
// IMPORTANTE:
// Las credenciales de abajo son únicamente para simulación.
// En producción se utilizará autenticación real.

const STAFF_USUARIOS_EJEMPLO = [
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
  }
];

const CATALOGO_EJEMPLO = [
  {
    id: 'prod-001',
    nombre: 'Anillo Corazón',
    descripcion: 'Anillo de corazón con acabado elegante para uso diario.',
    material: 'oro-laminado',
    categoria: 'Anillos',
    calidad: 'premium',
    colorOro: 'Amarillo',
    talla: '6',
    precioEtiqueta: 690,
    descuento: 60,
    stock: 18,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png'
  },

  {
    id: 'prod-002',
    nombre: 'Cadena Fina 45cm',
    descripcion: 'Cadena fina de 45 cm, ideal para combinar con dijes.',
    material: 'oro-laminado',
    categoria: 'Cadenas',
    calidad: 'estandar',
    colorOro: 'Amarillo',
    talla: '',
    precioEtiqueta: 650,
    descuento: 60,
    stock: 27,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png'
  },

  {
    id: 'prod-003',
    nombre: 'Huggies Pequeños',
    descripcion: 'Aretes tipo huggie pequeños y ligeros.',
    material: 'oro-laminado',
    categoria: 'Aretes',
    calidad: 'premium',
    colorOro: 'Blanco',
    talla: '',
    precioEtiqueta: 430,
    descuento: 60,
    stock: 12,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png'
  },

  {
    id: 'prod-004',
    nombre: 'Pulsera Eslabón',
    descripcion: 'Pulsera de eslabón con acabado dorado.',
    material: 'oro-laminado',
    categoria: 'Pulseras',
    calidad: 'premium',
    colorOro: 'Amarillo',
    talla: '18 cm',
    precioEtiqueta: 750,
    descuento: 60,
    stock: 0,
    disponible: false,
    imagen: '../assets/images/isotipo-morado.png'
  },

  {
    id: 'prod-005',
    nombre: 'Aretes Flor',
    descripcion: 'Aretes con diseño floral elegante.',
    material: 'acero-inoxidable',
    categoria: 'Aretes',
    calidad: 'estandar',
    colorOro: '',
    talla: '',
    precioEtiqueta: 320,
    descuento: 40,
    stock: 35,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png'
  },

  {
    id: 'prod-006',
    nombre: 'Dije Estrella',
    descripcion: 'Dije de estrella para combinar con diferentes cadenas.',
    material: 'oro-laminado',
    categoria: 'Dijes',
    calidad: 'premium',
    colorOro: 'Amarillo',
    talla: '',
    precioEtiqueta: 350,
    descuento: 60,
    stock: 21,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png'
  },

  {
    id: 'prod-007',
    nombre: 'Exhibidor Individual',
    descripcion: 'Exhibidor individual para presentación de joyería.',
    material: 'exhibidores',
    categoria: 'Exhibidores',
    calidad: 'estandar',
    colorOro: '',
    talla: '',
    precioEtiqueta: 149,
    descuento: 30,
    stock: 44,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png'
  },

  {
    id: 'prod-008',
    nombre: 'Souvenir MW',
    descripcion: 'Souvenir de MW Joyería para obsequio.',
    material: 'souvenirs',
    categoria: 'Souvenirs',
    calidad: 'estandar',
    colorOro: '',
    talla: '',
    precioEtiqueta: 120,
    descuento: 0,
    stock: 8,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png'
  }
];

const MATERIALES_STAFF = [
  { key: 'oro-laminado', label: 'Oro Laminado' },
  { key: 'acero-inoxidable', label: 'Acero Inoxidable' },
  { key: 'exhibidores', label: 'Exhibidores' },
  { key: 'souvenirs', label: 'Souvenirs' },
  { key: 'fantasia', label: 'Fantasía' },
  { key: 'otros', label: 'Otros' }
];

const CATEGORIAS_STAFF = [
  'Anillos',
  'Aretes',
  'Cadenas',
  'Pulseras',
  'Dijes',
  'Exhibidores',
  'Souvenirs',
  'Fantasía',
  'Otros'
];

const CALIDADES_STAFF = [
  { key: 'estandar', label: 'Estándar' },
  { key: 'premium', label: 'Premium' }
];

const COLORES_ORO_STAFF = [
  'Amarillo',
  'Blanco',
  'Rosa'
];