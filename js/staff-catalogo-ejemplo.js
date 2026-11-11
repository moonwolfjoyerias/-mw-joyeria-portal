// MW JOYERÍA — Catálogo Staff
// DATOS DE EJEMPLO
// ⚠️ TEMPORAL: se reemplazará por Firestore en Fase 3.
//
// Este archivo contiene productos de demostración.
// La existencia (stock) SOLO se muestra en Staff/Encargado/Admin.
//
// IMPORTANTE:
// Las credenciales de abajo son únicamente para simulación.
// En producción se utilizará autenticación real.

// SEC-03 de la auditoría: igual que PERSONAL_EJEMPLO en
// staff-apartados-ejemplo.js — credenciales de ejemplo duplicadas, ya
// vaciadas por el mismo motivo (ver cuentas-internas-modelo.js).
const STAFF_USUARIOS_EJEMPLO = [];

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
    calidad: 'premium',
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
    calidad: 'premium',
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
    calidad: 'premium',
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
    calidad: 'premium',
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
  'Arracadas', 'Aretes', 'Anillos', 'Broqueles', 'Brazaletes', 'Cadenas', 'Collares',
  'Dijes', 'Fin de semana', 'Huggies', 'Juegos', 'Misterios', 'Pulseras', 'Prendedores',
  'Relicarios', 'Rosarios', 'Simuladores', 'Semanarios', 'Tobilleras', 'Tiaras'
];

// Subcategorías de Dijes (campo `subcategoria` del producto). Al dar de
// alta un dije, S/E/A marca "Religioso" o "Cruz" (solo una); si no marca
// ninguna, queda como dije normal ('otros'). En los filtros salen debajo
// de "Dijes" con el valor "Dijes:<clave>"; marcar "Dijes" trae todos.
// BRILLO usa las mismas claves (src/pagina/producto.ts).
const SUBCATEGORIAS_DIJES = [
  { key: 'religiosos', label: 'Dijes religiosos', casilla: 'Religioso' },
  { key: 'cruces', label: 'Cruces', casilla: 'Cruz' },
  { key: 'otros', label: 'Otros dijes' }
];

function subcategoriaDije(producto) {
  if (!producto || producto.categoria !== 'Dijes') return '';
  return producto.subcategoria === 'religiosos' || producto.subcategoria === 'cruces' ? producto.subcategoria : 'otros';
}

// "Dijes religiosos", "Cruces" o la categoría tal cual.
function etiquetaCategoriaProducto(producto) {
  const sub = subcategoriaDije(producto);
  if (sub === 'religiosos' || sub === 'cruces') return SUBCATEGORIAS_DIJES.find(s => s.key === sub).label;
  return producto?.categoria || '';
}

// ¿El producto entra en este valor de filtro ("Anillos", "Dijes" o "Dijes:cruces")?
function productoEnCategoriaFiltro(producto, valor) {
  if (!valor) return true;
  const [categoria, sub] = String(valor).split(':');
  if (producto?.categoria !== categoria) return false;
  return !sub || subcategoriaDije(producto) === sub;
}

// Con varios valores marcados (filtros de casillas): entra si coincide con alguno.
function productoEnCategoriasFiltro(producto, valores) {
  const lista = Array.from(valores || []);
  return !lista.length || lista.some(v => productoEnCategoriaFiltro(producto, v));
}

// Valores válidos de filtro para una lista de categorías (agrega las de Dijes).
function valoresFiltroCategorias(categorias) {
  return categorias.flatMap(c => (c === 'Dijes' ? [c, ...SUBCATEGORIAS_DIJES.map(s => `Dijes:${s.key}`)] : [c]));
}

// Casillas de las subcategorías de Dijes para los filtros de casillas.
function htmlFiltroSubcategoriasDijes(seleccion, escapar) {
  const esc = escapar || (s => String(s));
  return SUBCATEGORIAS_DIJES.map(s => `
    <label class="filter-option filter-sub">
      <input type="checkbox" value="Dijes:${s.key}" data-filter="categoria" ${seleccion && seleccion.has(`Dijes:${s.key}`) ? 'checked' : ''}>
      ${esc(s.label)}
    </label>`).join('');
}

// Opciones de <select> de categorías con las de Dijes debajo.
function opcionesFiltroCategoriasSelect(categorias) {
  return categorias.map(c => `<option value="${c}">${c}</option>` +
    (c === 'Dijes' ? SUBCATEGORIAS_DIJES.map(s => `<option value="Dijes:${s.key}">— ${s.label}</option>`).join('') : '')
  ).join('');
}

// Campo del formulario de producto: casillas "Religioso" / "Cruz", visibles
// solo cuando la categoría es Dijes (ver conectarCampoSubcategoriaDije).
function htmlCampoSubcategoriaDije(producto) {
  const actual = subcategoriaDije(producto);
  return `
      <div class="form-field full" id="productoSubcategoriaCampo" ${producto?.categoria === 'Dijes' ? '' : 'hidden'}>
        <label>Tipo de dije</label>
        <div class="subcategoria-dije">
          ${SUBCATEGORIAS_DIJES.filter(s => s.casilla).map(s => `
            <label class="check-catalogo"><input type="checkbox" data-subcategoria-dije="${s.key}" ${actual === s.key ? 'checked' : ''}> ${s.casilla}</label>`).join('')}
        </div>
        <small class="field-help">Marca solo una. Si no marcas ninguna, se queda como dije normal.</small>
      </div>`;
}

function conectarCampoSubcategoriaDije() {
  const select = document.getElementById('productoCategoria');
  const campo = document.getElementById('productoSubcategoriaCampo');
  if (!select || !campo) return;
  select.addEventListener('change', () => { campo.hidden = select.value !== 'Dijes'; });
  campo.querySelectorAll('[data-subcategoria-dije]').forEach(cb => cb.addEventListener('change', () => {
    if (cb.checked) campo.querySelectorAll('[data-subcategoria-dije]').forEach(o => { if (o !== cb) o.checked = false; });
  }));
}

// Exhibidores no llevan color de oro: el campo se oculta al elegir ese
// material (y se guarda vacío, ver colorOroParaGuardar).
function conectarColorOroSegunMaterial() {
  const material = document.getElementById('productoMaterial');
  const campo = document.getElementById('productoColorOro')?.closest('.form-field');
  if (!material || !campo) return;
  const ajustar = () => { campo.hidden = material.value === 'exhibidores'; };
  material.addEventListener('change', ajustar);
  ajustar();
}

function colorOroParaGuardar(material, colorOro) {
  return material === 'exhibidores' ? '' : (colorOro || '');
}

// Lo que se guarda: '' si no es dije o no se marcó nada.
function leerCampoSubcategoriaDije(categoria) {
  if (categoria !== 'Dijes') return '';
  return document.querySelector('#productoSubcategoriaCampo [data-subcategoria-dije]:checked')?.dataset.subcategoriaDije || '';
}


const COLORES_ORO_STAFF = [
  'Amarillo',
  'Blanco',
  'Dorado',
  'Florentino',
  'Negro',
  'Rosa'
];