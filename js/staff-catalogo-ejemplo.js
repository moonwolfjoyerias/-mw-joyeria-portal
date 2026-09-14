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

// Cada producto es un MODELO con un arreglo `variantes`: una entrada por
// cada combinación Color+Talla real que existe en inventario, con su
// propio stock. Un producto sin color relevante o sin talla (la mayoría
// fuera de Anillos/Cadenas en oro) simplemente trae esos campos vacíos
// en su(s) variante(s) — ver js/catalogo-variantes-modelo.js.
const CATALOGO_EJEMPLO = [
  {
    id: 'prod-001',
    nombre: 'Anillo Corazón',
    descripcion: 'Anillo de corazón con acabado elegante para uso diario.',
    material: 'oro-laminado',
    categoria: 'Anillos',
    calidad: 'premium',
    precioEtiqueta: 690,
    descuento: 60,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png',
    variantes: [
      { id: 'prod-001-v1', colorOro: 'Amarillo', talla: '6', stock: 10 },
      { id: 'prod-001-v2', colorOro: 'Amarillo', talla: '7', stock: 8 },
      { id: 'prod-001-v3', colorOro: 'Blanco', talla: '6', stock: 5 },
      { id: 'prod-001-v4', colorOro: 'Blanco', talla: '7', stock: 0 }
    ]
  },

  {
    id: 'prod-002',
    nombre: 'Cadena Fina 45cm',
    descripcion: 'Cadena fina de 45 cm, ideal para combinar con dijes.',
    material: 'oro-laminado',
    categoria: 'Cadenas',
    calidad: 'estandar',
    precioEtiqueta: 650,
    descuento: 60,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png',
    variantes: [
      { id: 'prod-002-v1', colorOro: 'Amarillo', talla: '45cm', stock: 15 },
      { id: 'prod-002-v2', colorOro: 'Rosa', talla: '45cm', stock: 12 }
    ]
  },

  {
    id: 'prod-003',
    nombre: 'Huggies Pequeños',
    descripcion: 'Aretes tipo huggie pequeños y ligeros.',
    material: 'oro-laminado',
    categoria: 'Aretes',
    calidad: 'premium',
    precioEtiqueta: 430,
    descuento: 60,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png',
    variantes: [
      { id: 'prod-003-v1', colorOro: 'Blanco', talla: '', stock: 12 }
    ]
  },

  {
    id: 'prod-004',
    nombre: 'Pulsera Eslabón',
    descripcion: 'Pulsera de eslabón con acabado dorado.',
    material: 'oro-laminado',
    categoria: 'Pulseras',
    calidad: 'premium',
    precioEtiqueta: 750,
    descuento: 60,
    disponible: false,
    imagen: '../assets/images/isotipo-morado.png',
    variantes: [
      { id: 'prod-004-v1', colorOro: 'Amarillo', talla: '18 cm', stock: 0 }
    ]
  },

  {
    id: 'prod-005',
    nombre: 'Aretes Flor',
    descripcion: 'Aretes con diseño floral elegante.',
    material: 'acero-inoxidable',
    categoria: 'Aretes',
    calidad: 'estandar',
    precioEtiqueta: 320,
    descuento: 40,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png',
    variantes: [
      { id: 'prod-005-v1', colorOro: '', talla: '', stock: 35 }
    ]
  },

  {
    id: 'prod-006',
    nombre: 'Dije Estrella',
    descripcion: 'Dije de estrella para combinar con diferentes cadenas.',
    material: 'oro-laminado',
    categoria: 'Dijes',
    calidad: 'premium',
    precioEtiqueta: 350,
    descuento: 60,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png',
    variantes: [
      { id: 'prod-006-v1', colorOro: 'Amarillo', talla: '', stock: 21 }
    ]
  },

  {
    id: 'prod-007',
    nombre: 'Exhibidor Individual',
    descripcion: 'Exhibidor individual para presentación de joyería.',
    material: 'exhibidores',
    categoria: 'Exhibidores',
    calidad: 'estandar',
    precioEtiqueta: 149,
    descuento: 30,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png',
    variantes: [
      { id: 'prod-007-v1', colorOro: '', talla: '', stock: 44 }
    ]
  },

  {
    id: 'prod-008',
    nombre: 'Souvenir MW',
    descripcion: 'Souvenir de MW Joyería para obsequio.',
    material: 'souvenirs',
    categoria: 'Souvenirs',
    calidad: 'estandar',
    precioEtiqueta: 120,
    descuento: 0,
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png',
    variantes: [
      { id: 'prod-008-v1', colorOro: '', talla: '', stock: 8 }
    ]
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