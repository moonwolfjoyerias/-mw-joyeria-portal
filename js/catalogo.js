// MW JOYERÍA — Catálogo de mayoreo (portal privado)
//
// Antes filtraba un arreglo estático propio (CATALOGO_EJEMPLO de
// catalogo-productos-ejemplo.js) y "Apartar" era una vista de prueba
// que no reservaba nada de verdad. Ahora lee el MISMO catálogo real
// con variantes (Modelo→Color→Talla, stock por variante) que usan
// Staff/Encargado/Admin — obtenerCatalogoStaffStorage() de
// catalogo-variantes-modelo.js — y "Apartar" crea/agrega una pieza real
// en apartados-modelo.js (la misma fuente que ya usa "Mis apartados" y
// las páginas de Staff/Encargado/Admin), descontando existencia real de la
// variante elegida.

const MATERIALES = [
  { key: 'oro-laminado', label: 'Oro Laminado' },
  { key: 'acero-inoxidable', label: 'Acero Inoxidable' },
  { key: 'exhibidores', label: 'Exhibidores' },
  { key: 'souvenirs', label: 'Souvenirs' },
  { key: 'fantasia', label: 'Fantasía' },
  { key: 'otros', label: 'Otros' },
];

// Antes vivían en catalogo-productos-ejemplo.js (el catálogo estático
// que este archivo ya no usa) — se quedan aquí porque son solo la
// taxonomía de filtros, no datos de producto.
const CATEGORIAS_ORO = [
  'Arracadas', 'Aretes', 'Anillos', 'Broqueles', 'Brazaletes', 'Cadenas', 'Collares',
  'Dijes', 'Fin de semana', 'Huggies', 'Juegos', 'Misterios', 'Pulseras', 'Prendedores',
  'Relicarios', 'Rosarios', 'Simuladores', 'Semanarios', 'Tobilleras', 'Tiaras',
];
const CATEGORIAS_ACERO = ['Aretes', 'Pulseras', 'Cadenas', 'Anillos', 'Collares'];
// Misma lista que el formulario de producto (js/staff-catalogo-ejemplo.js).
const COLORES_ORO = COLORES_ORO_STAFF;

const filtro = {
  materiales: new Set(),
  categorias: new Set(),
  coloresOro: new Set(),
  talla: '',
  texto: '',
};

let usuarioIdActual = '';
let usuarioNombreActual = '';

document.addEventListener('DOMContentLoaded', async () => {
  usuarioIdActual = (typeof obtenerIdPersonaActualPortal === 'function' && obtenerIdPersonaActualPortal()) || '';
  usuarioNombreActual = (typeof obtenerNombrePersonaActualPortal === 'function' && obtenerNombrePersonaActualPortal()) || '';

  await catalogoRepoListo; // FASE 2 (Firebase): espera a que obtenerCatalogoReal() tenga datos reales, no un caché vacío
  await apartadosRepoListo; // ídem para obtenerVentanasApartado() — el botón "Apartar" lo necesita listo

  renderFiltroMateriales();
  renderFiltroCategorias();
  renderFiltroColorOro();
  renderFiltroTalla();
  aplicarFiltros();
  // Los − N + de cada pieza siguen en vivo lo que cambie en su apartado
  // (desde Mis apartados en otra pestaña, o lo que haga el equipo).
  let refrescoApartadosCatalogo = null;
  window.addEventListener('mw:apartados-actualizados', () => {
    clearTimeout(refrescoApartadosCatalogo);
    refrescoApartadosCatalogo = setTimeout(aplicarFiltros, 150);
  });

  const clearBtn = document.getElementById('clearFiltersBtn');
  if (clearBtn) clearBtn.addEventListener('click', limpiarFiltros);

  document.getElementById('catalogoBuscar')?.addEventListener('input', (e) => {
    filtro.texto = e.target.value;
    aplicarFiltros();
  });
  document.getElementById('ordenCatalogo')?.addEventListener('change', aplicarFiltros);

  iniciarLinkCatalogoClientas();

  // FEAT-03 pedida tras lanzar a producción: enlace directo desde la
  // notificación de "ya está disponible lo que pediste" (lista de
  // deseos) — abre de una vez el modal de Apartar para ese producto.
  const productoIdDesdeUrl = new URLSearchParams(window.location.search).get('apartar');
  if (productoIdDesdeUrl) abrirModalApartar(productoIdDesdeUrl);
});

// ---------- Link de catálogo para sus clientas ----------
// Cada e/l comparte catalogo-vivo.html?e={personaId}: solo el catálogo
// con precio etiqueta, su nombre y su WhatsApp — sin menú ni nada más
// del sitio. Esa página es pública (las clientas no inician sesión), así
// que no puede leer personas/; lo que muestra sale de
// catalogoTarjetas/{personaId}, que se escribe aquí (ver
// firestore.rules). Se escribe al copiar/compartir el link y, si ya lo
// había compartido desde este dispositivo, al abrir el catálogo cuando
// cambió su nombre o teléfono.
const TARJETA_CATALOGO_STORAGE_PREFIJO = 'mw_tarjetaCatalogo_';
// Título que la e/l le pone a su catálogo ("Joyería de Cami"). Vacío = "Catálogo de <su nombre>".
let tituloCatalogoActual = '';
const TITULO_CATALOGO_MAX = 60;

function urlCatalogoClientas() {
  return new URL(`../../catalogo-vivo?e=${encodeURIComponent(usuarioIdActual)}`, window.location.href).href;
}

function datosTarjetaCatalogo() {
  const persona = typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(usuarioIdActual) : null;
  const nombre = (persona ? [persona.nombre, persona.apellidos].filter(Boolean).join(' ') : '') || usuarioNombreActual || '';
  return { nombre: nombre.trim().slice(0, 120), telefono: String(persona?.telefono || '').replace(/\D/g, '').slice(0, 20), titulo: tituloCatalogoActual.trim().slice(0, TITULO_CATALOGO_MAX) };
}

async function guardarTarjetaCatalogo(soloSiCambio) {
  if (typeof dbFirestore === 'undefined' || !dbFirestore || !usuarioIdActual) return false;
  const clave = TARJETA_CATALOGO_STORAGE_PREFIJO + usuarioIdActual;
  const datos = datosTarjetaCatalogo();
  const texto = JSON.stringify(datos);
  let anterior = null;
  try { anterior = localStorage.getItem(clave); } catch (error) { /* noop */ }
  if (soloSiCambio && (anterior === null || anterior === texto)) return true;
  await dbFirestore.collection('catalogoTarjetas').doc(String(usuarioIdActual)).set({ ...datos, actualizado: new Date().toISOString() });
  try { localStorage.setItem(clave, texto); } catch (error) { /* noop */ }
  return true;
}

async function prepararLinkCatalogo() {
  try {
    await guardarTarjetaCatalogo(false);
  } catch (error) {
    mostrarToast('No se pudo preparar tu link. Revisa tu conexión e inténtalo de nuevo.');
    return null;
  }
  if (!datosTarjetaCatalogo().telefono) {
    mostrarToast('Tu link no tendrá botón de WhatsApp porque no tienes teléfono registrado — agrégalo en "Cambiar teléfono".');
  }
  return urlCatalogoClientas();
}

async function iniciarLinkCatalogoClientas() {
  const copiarBtn = document.getElementById('copiarLinkCatalogoBtn');
  const compartirBtn = document.getElementById('compartirLinkCatalogoBtn');
  if (!copiarBtn && !compartirBtn) return;

  copiarBtn?.addEventListener('click', async () => {
    const url = await prepararLinkCatalogo();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      mostrarToast('Link copiado. Pégalo donde quieras compartirlo con tus clientas.');
    } catch (error) {
      window.prompt('Copia tu link:', url);
    }
  });

  compartirBtn?.addEventListener('click', async () => {
    // La ventana se abre antes de esperar a Firestore: si se abre
    // después, el navegador del celular la bloquea como emergente.
    const ventana = window.open('', '_blank');
    const url = await prepararLinkCatalogo();
    if (!url) { ventana?.close(); return; }
    const mensaje = `¡Hola! Te comparto mi catálogo de MW Joyería, con todas las piezas disponibles y sus precios: ${url}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    if (ventana) ventana.location.href = wa; else window.location.href = wa;
  });

  // Botón para el título del catálogo (junto a Copiar / Compartir).
  const acciones = (copiarBtn || compartirBtn).parentNode;
  if (acciones && !document.getElementById('tituloCatalogoBtn')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'tituloCatalogoBtn';
    b.className = 'btn btn-outline btn-sm';
    b.textContent = 'Cambiar nombre';
    b.addEventListener('click', abrirModalTituloCatalogo);
    acciones.appendChild(b);
  }

  // Lo que ya tiene guardado (para no perder su título al actualizar nombre/teléfono).
  try {
    if (typeof dbFirestore !== 'undefined' && dbFirestore && usuarioIdActual) {
      const d = await dbFirestore.collection('catalogoTarjetas').doc(String(usuarioIdActual)).get();
      if (d.exists && typeof d.data().titulo === 'string') tituloCatalogoActual = d.data().titulo;
    }
  } catch (error) { /* sin título guardado */ }

  if (typeof personasRepoListo !== 'undefined') await personasRepoListo;
  guardarTarjetaCatalogo(true).catch(() => { /* se reintenta al copiar el link */ });
}

function tituloPorOmisionCatalogo() {
  const nombre = datosTarjetaCatalogo().nombre;
  return nombre ? `Catálogo de ${nombre}` : 'Catálogo MW';
}

// La e/l elige cómo se llama el catálogo que ven sus clientas.
function abrirModalTituloCatalogo() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Nombre de mi catálogo</h3>
    <p class="modal-sub">Así lo verán tus clientas arriba de tu catálogo. Si lo dejas vacío dice "${escapeHTMLCatalogoTitulo(tituloPorOmisionCatalogo())}".</p>
    <label for="tituloCatalogoInput">Título</label>
    <input type="text" id="tituloCatalogoInput" maxlength="${TITULO_CATALOGO_MAX}" placeholder="${escapeHTMLCatalogoTitulo(tituloPorOmisionCatalogo())}" value="${escapeHTMLCatalogoTitulo(tituloCatalogoActual)}">
    <p class="titulo-catalogo-cuenta" id="tituloCatalogoCuenta"></p>
    <div class="titulo-catalogo-vista"><span>Tus clientas verán:</span><strong id="tituloCatalogoVista"></strong></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-outline" id="tituloCatalogoQuitar">Usar el de siempre</button>
      <button type="button" class="btn btn-primary" id="tituloCatalogoGuardar">Guardar</button>
    </div>`;
  overlay.classList.add('open');
  const input = document.getElementById('tituloCatalogoInput');
  const pintar = () => {
    document.getElementById('tituloCatalogoVista').textContent = input.value.trim() || tituloPorOmisionCatalogo();
    document.getElementById('tituloCatalogoCuenta').textContent = `${input.value.length} / ${TITULO_CATALOGO_MAX}`;
  };
  input.addEventListener('input', pintar);
  pintar();
  input.focus();
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]').addEventListener('click', cerrar);
  const guardar = async (valor) => {
    const anterior = tituloCatalogoActual;
    tituloCatalogoActual = valor.trim().slice(0, TITULO_CATALOGO_MAX);
    try {
      await guardarTarjetaCatalogo(false);
      cerrar();
      mostrarToast(tituloCatalogoActual ? `Tu catálogo ahora se llama "${tituloCatalogoActual}".` : 'Tu catálogo vuelve a usar tu nombre.');
    } catch (error) {
      tituloCatalogoActual = anterior;
      mostrarToast('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
    }
  };
  document.getElementById('tituloCatalogoGuardar').addEventListener('click', () => guardar(input.value));
  document.getElementById('tituloCatalogoQuitar').addEventListener('click', () => guardar(''));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); guardar(input.value); } });
}

function escapeHTMLCatalogoTitulo(t) {
  return String(t || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------- Catálogo real (mismo que Staff/Encargado/Admin) ----------
// Solo lo marcado "Mostrar en catálogo" (las piezas premium). Lo demás que
// está a la venta en la joyería se ve en Productos de BRILLO, no aquí.
function obtenerCatalogoReal() {
  const todo = typeof obtenerCatalogoStaffStorage === 'function' ? obtenerCatalogoStaffStorage() : [];
  return todo.filter(p => p.mostrarEnCatalogo !== false);
}

function categoriasDisponibles() {
  const incluyeOro = filtro.materiales.size === 0 || filtro.materiales.has('oro-laminado');
  const incluyeAcero = filtro.materiales.size === 0 || filtro.materiales.has('acero-inoxidable');
  const set = new Set();
  if (incluyeOro) CATEGORIAS_ORO.forEach(c => set.add(c));
  if (incluyeAcero) CATEGORIAS_ACERO.forEach(c => set.add(c));
  return Array.from(set).sort();
}

function renderFiltroMateriales() {
  const wrap = document.getElementById('filterMateriales');
  if (!wrap) return;
  wrap.innerHTML = MATERIALES.map(m => `
    <label class="filter-option">
      <input type="checkbox" value="${m.key}" data-filter="material">
      ${m.label}
    </label>
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', onMaterialChange));
}

function onMaterialChange(e) {
  const val = e.target.value;
  if (e.target.checked) filtro.materiales.add(val); else filtro.materiales.delete(val);
  renderFiltroCategorias();
  toggleOroGroups();
  aplicarFiltros();
}

function renderFiltroCategorias() {
  const wrap = document.getElementById('filterCategorias');
  if (!wrap) return;
  const cats = categoriasDisponibles();
  // conserva selección previa que siga siendo válida
  const validos = valoresFiltroCategorias(cats);
  filtro.categorias.forEach(c => { if (!validos.includes(c)) filtro.categorias.delete(c); });
  wrap.innerHTML = cats.map(c => `
    <label class="filter-option">
      <input type="checkbox" value="${c}" data-filter="categoria" ${filtro.categorias.has(c) ? 'checked' : ''}>
      ${c}
    </label>
    ${c === 'Dijes' ? htmlFiltroSubcategoriasDijes(filtro.categorias) : ''}
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', (e) => {
    if (e.target.checked) filtro.categorias.add(e.target.value); else filtro.categorias.delete(e.target.value);
    aplicarFiltros();
  }));
}

function renderFiltroColorOro() {
  const wrap = document.getElementById('filterColorOro');
  if (!wrap) return;
  wrap.innerHTML = COLORES_ORO.map(c => `
    <label class="filter-option">
      <input type="checkbox" value="${c}" data-filter="colorOro">
      ${c}
    </label>
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', (e) => {
    if (e.target.checked) filtro.coloresOro.add(e.target.value); else filtro.coloresOro.delete(e.target.value);
    aplicarFiltros();
  }));
}

function renderFiltroTalla() {
  const wrap = document.getElementById('filterTalla');
  if (!wrap) return;
  const tallas = Array.from(new Set(
    obtenerCatalogoReal().flatMap(p => (p.variantes || []).map(v => v.talla)).filter(Boolean)
  )).sort();
  wrap.innerHTML = `<option value="">Todas</option>` + tallas.map(t => `<option value="${t}">${t}</option>`).join('');
  wrap.addEventListener('change', (e) => {
    filtro.talla = e.target.value;
    aplicarFiltros();
  });
}

function toggleOroGroups() {
  const showOro = filtro.materiales.size === 0 || filtro.materiales.has('oro-laminado');
  document.querySelectorAll('.filter-group.conditional').forEach(g => g.classList.toggle('visible', showOro));
}

function limpiarFiltros() {
  filtro.materiales.clear();
  filtro.categorias.clear();
  filtro.coloresOro.clear();
  filtro.talla = '';
  filtro.texto = '';
  const buscar = document.getElementById('catalogoBuscar');
  if (buscar) buscar.value = '';
  document.querySelectorAll('.filter-panel input[type="checkbox"]').forEach(cb => cb.checked = false);
  const tallaSelect = document.getElementById('filterTalla');
  if (tallaSelect) tallaSelect.value = '';
  renderFiltroCategorias();
  toggleOroGroups();
  aplicarFiltros();
}

// Buscador: cada palabra escrita debe aparecer (sin importar acentos ni
// mayúsculas) en el nombre, descripción, categoría, color de oro,
// material o color/talla de alguna variante.
function _normalizarBusquedaCatalogo(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function productoCoincideBusqueda(p) {
  const palabras = _normalizarBusquedaCatalogo(filtro.texto).trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return true;
  const material = MATERIALES.find(m => m.key === p.material)?.label || p.material || '';
  const donde = _normalizarBusquedaCatalogo([
    p.nombre, p.descripcion, p.categoria, etiquetaCategoriaProducto(p), p.colorOro, material,
    ...(p.variantes || []).map(v => [v.color, v.talla].filter(Boolean).join(' '))
  ].join(' '));
  return palabras.every(palabra => donde.includes(palabra));
}

function aplicarFiltros() {
  const resultado = obtenerCatalogoReal().filter((p) => {
    if (!productoCoincideBusqueda(p)) return false;
    if (filtro.materiales.size > 0 && !filtro.materiales.has(p.material)) return false;
    if (!productoEnCategoriasFiltro(p, filtro.categorias)) return false;
    if (filtro.coloresOro.size > 0 && !filtro.coloresOro.has(p.colorOro)) return false;
    const variantes = p.variantes || [];
    if (filtro.talla && !variantes.some(v => v.talla === filtro.talla)) return false;
    return true;
  });
  renderProductos(ordenarProductosCatalogo(resultado));
}

// "Ordenar" de la barra (si la página lo tiene): más nuevas (como
// siempre), o por el precio de la e/l de menor a mayor y al revés.
function ordenarProductosCatalogo(productos) {
  const orden = document.getElementById('ordenCatalogo')?.value || 'nuevas';
  if (orden === 'nuevas') return ordenarProductosMasRecientes(productos);
  const signo = orden === 'mayor' ? -1 : 1;
  return [...productos].sort((a, b) => signo * (Number(precioConDescuento(a)) - Number(precioConDescuento(b))));
}

function renderProductos(productos) {
  const grid = document.getElementById('catalogGrid');
  const count = document.getElementById('resultCount');
  if (!grid) return;

  if (count) count.textContent = `${productos.length} modelo${productos.length === 1 ? '' : 's'}`;

  if (productos.length === 0) {
    grid.innerHTML = '<div class="catalog-empty">No hay piezas que coincidan con tu búsqueda o filtros.</div>';
    return;
  }

  grid.innerHTML = productos.map((p) => {
    const disponibles = variantesDisponibles(p);
    const metaVariantes = Array.from(new Set(disponibles.map(v => etiquetaVariante(v)).filter(v => v !== 'Única'))).join(' · ');
    const fotoProducto = normalizarImagenProducto(p);
    const fotoGenerica = esFotoGenericaProducto(p);
    return `
    <div class="catalog-product-card" data-producto="${p.id}">
      <div class="cp-photo" data-detalle="${p.id}" role="button" tabindex="0" aria-label="Ver detalles: ${escapeAttribute(p.nombre)}">
        <img src="${fotoProducto}" alt="${escapeAttribute(p.nombre)}" class="${fotoGenerica ? 'foto-generica' : ''}">
      </div>
      <div class="cp-body">
        <h4>${escapeHTMLCatalogoVariantes(p.nombre)}</h4>
        <div class="cp-meta">${escapeHTMLCatalogoVariantes([p.colorOro, etiquetaCategoriaProducto(p), metaVariantes].filter(Boolean).join(' · ')) || '&nbsp;'}</div>
        <div class="cp-price">
          <span class="price-public">$${p.precioEtiqueta} MXN</span>
          <span class="price-emprendedora">$${precioConDescuento(p)} MXN</span>
        </div>
        ${controlCantidadCatalogo(p, disponibles)}
      </div>
    </div>
  `;
  }).join('');

  grid.querySelectorAll('[data-cat-mas]').forEach(btn => {
    btn.addEventListener('click', () => sumarPiezaCatalogo(btn.getAttribute('data-cat-mas'), btn));
  });
  grid.querySelectorAll('[data-cat-menos]').forEach(btn => {
    btn.addEventListener('click', () => restarPiezaCatalogo(btn.getAttribute('data-cat-menos')));
  });

  // Tocar cualquier parte de la tarjeta (menos sus botones) abre la
  // ficha de la pieza; con teclado, Enter/Espacio sobre la foto.
  grid.querySelectorAll('[data-producto]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, a, .cp-cantidad')) return;
      abrirModalDetalleProducto(card.getAttribute('data-producto'));
    });
  });
  grid.querySelectorAll('[data-detalle]').forEach(el => {
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      abrirModalDetalleProducto(el.getAttribute('data-detalle'));
    });
  });

  // El botón "Apartar" conserva su atajo de siempre: con una sola
  // variante disponible va directo a confirmar, sin abrir ningún modal.
  // Con varias, ahora abre el mismo modal enriquecido (antes era un
  // <select> simple) — ver abrirModalDetalleProducto.
  grid.querySelectorAll('[data-apartar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const productoId = btn.getAttribute('data-apartar');
      const producto = obtenerCatalogoReal().find(p => p.id === productoId);
      if (!producto) return;
      const disponibles = variantesDisponibles(producto);
      if (!disponibles.length) { mostrarToast('Ya no hay existencia de esta pieza.'); return; }
      if (disponibles.length === 1) { mostrarPasoConfirmarApartar(producto, disponibles[0]); return; }
      abrirModalDetalleProducto(productoId);
    });
  });
}

// ---------- − N + en cada pieza del catálogo ----------
// Cuántas piezas de este modelo lleva ya en su apartado (cualquier
// color/talla). Con 0 se ve el botón "Apartar" de siempre; con 1 o más,
// "− N +": el − quita la última que apartó de ese modelo (como en Mis
// apartados) y el + aparta otra al momento si solo hay una opción
// disponible, o abre el elegir color/talla si hay varias.
function piezasPropiasDeProductoCatalogo(productoId) {
  if (!usuarioIdActual || typeof obtenerVentanasApartado !== 'function') return [];
  return obtenerVentanasApartado()
    .filter(v => v.usuarioId === usuarioIdActual && v.estado !== 'cerrada' && Array.isArray(v.apartados))
    .flatMap(ventana => ventana.apartados
      .filter(p => p.estado === 'activa' && p.productoId === productoId)
      .map(pieza => ({ pieza, ventana })));
}

function controlCantidadCatalogo(p, disponibles) {
  const n = piezasPropiasDeProductoCatalogo(p.id).length;
  if (!n) {
    return disponibles.length
      ? `<button class="btn btn-primary btn-apartar" data-apartar="${p.id}">Seleccionar</button>`
      : `<button class="btn btn-outline btn-apartar" disabled style="opacity:0.5;cursor:not-allowed;">No disponible</button>`;
  }
  const nombre = escapeAttribute(p.nombre);
  const hayMas = disponibles.length > 0;
  return `
    <div class="cp-cantidad" role="group" aria-label="Piezas de ${nombre} en tu pedido">
      <button type="button" data-cat-menos="${p.id}" aria-label="Quitar una pieza de tu pedido" title="Quitar una de tu pedido">−</button>
      <span class="cp-cantidad-num" title="${n} en tu pedido">${n}</span>
      <button type="button" data-cat-mas="${p.id}" aria-label="Seleccionar otra pieza" ${hayMas ? '' : 'disabled'} title="${hayMas ? (disponibles.length > 1 ? 'Seleccionar otra (elige color/talla)' : 'Seleccionar otra') : 'Ya no hay más piezas disponibles'}">+</button>
    </div>
    <small class="cp-cantidad-ayuda">${n === 1 ? 'Ya está en tu pedido' : `${n} en tu pedido`}</small>`;
}

let sumandoPiezaCatalogo = false;
async function sumarPiezaCatalogo(productoId, boton) {
  if (sumandoPiezaCatalogo) return;
  const producto = obtenerCatalogoReal().find(p => p.id === productoId);
  if (!producto) return;
  const disponibles = variantesDisponibles(producto);
  if (!disponibles.length) { mostrarToast('Ya no hay más piezas disponibles de este modelo.'); return; }
  if (disponibles.length > 1) { abrirModalDetalleProducto(productoId); return; }
  const ventana = buscarVentanaParaApartar(obtenerVentanasApartado(), usuarioIdActual);
  // Sin ventana abierta (p. ej. ya venció) sigue el camino normal, que
  // pide el depósito si hace falta.
  if (!ventana) { mostrarPasoConfirmarApartar(producto, disponibles[0]); return; }
  const variante = disponibles[0];
  const datosPieza = {
    producto: producto.nombre, variante: etiquetaVariante(variante), colorOro: producto.colorOro || '',
    total: precioConDescuento(producto), productoId: producto.id, varianteId: variante.id
  };
  sumandoPiezaCatalogo = true;
  if (boton) boton.disabled = true;
  try {
    const resultado = await agregarPiezaAVentana(ventana, datosPieza, null);
    if (!resultado.ok) { mostrarToast(resultado.error || 'Ya no hay más piezas de este modelo.'); return; }
    guardarVentanasApartado(obtenerVentanasApartado().map(v => v.id === ventana.id ? ventana : v));
    notificarEquipoCatalogo(`${ventana.usuarioNombre || usuarioNombreActual} pidió otra pieza de "${producto.nombre}" (${datosPieza.variante}).`, ventana.usuarioNombre || usuarioNombreActual);
    if (ventana.estado !== 'activa') notificarDisponibilidadCondicionadaADeposito(ventana);
    mostrarToast(ventana.estado === 'activa' ? 'Se agregó otra pieza a tu pedido' : 'Se agregó otra pieza a tu pedido. Sigue pendiente tu depósito.');
  } finally {
    sumandoPiezaCatalogo = false;
    aplicarFiltros();
  }
}

function restarPiezaCatalogo(productoId) {
  const propias = piezasPropiasDeProductoCatalogo(productoId);
  if (!propias.length) { aplicarFiltros(); return; }
  // La última que apartó, de preferencia una sin abonos (igual que Mis apartados).
  const elegida = propias.slice().reverse().find(({ pieza }) => !(pieza.pagos || []).length) || propias[propias.length - 1];
  const { pieza } = elegida;
  // Pide confirmación y le dice si ya estaba guardada en su bolsita.
  if (typeof confirmarQuitarPiezasEL === 'function') confirmarQuitarPiezasEL([pieza], () => quitarPiezaCatalogo(elegida));
  else quitarPiezaCatalogo(elegida);
}

function quitarPiezaCatalogo(elegida) {
  const { pieza } = elegida;
  const ventanas = obtenerVentanasApartado();
  const ventana = ventanas.find(v => v.id === elegida.ventana.id);
  const real = ventana && ventana.apartados.find(x => x.id === pieza.id && x.estado === 'activa');
  if (!real) { aplicarFiltros(); return; }
  real.estado = 'cancelada';
  real.cancelacion = { motivo: 'La quitaste tú', fecha: new Date().toISOString(), propia: true };
  if (typeof restaurarStockVariante === 'function') restaurarStockVariante(real.productoId, real.varianteId);
  ventana.cambioClienteSinRevisar = { texto: `Quitó "${real.producto}" (${real.variante}) · ${real.enBolsita ? 'estaba en bolsita' : 'no estaba en bolsita'}`, fecha: new Date().toISOString() };
  guardarVentanasApartado(ventanas);
  const textoBolsita = typeof textoBolsitaPiezasQuitadas === 'function' ? textoBolsitaPiezasQuitadas([real]) : '';
  notificarEquipoCatalogo(`Se quitó "${real.producto}" (${real.variante}) del pedido de ${ventana.usuarioNombre}. ${textoBolsita}`.trim(), ventana.usuarioNombre);
  aplicarFiltros();
  mostrarToast(`Se quitó 1 pieza (${real.variante}) de tu pedido. Se le avisó al equipo.`);
}

// Mismo aviso que manda Mis apartados (js/apartados.js
// notificarEquipoOperativo), que no se carga en esta página.
function notificarEquipoCatalogo(texto, nombrePersona) {
  if (typeof agregarNotificacion !== 'function') return;
  const query = nombrePersona ? `?buscar=${encodeURIComponent(nombrePersona)}` : '';
  agregarNotificacion({ texto, link: `staff-apartados.html${query}`, rolDestino: 'staff', origen: 'emprendedora_lider' });
}

// Modal enriquecido de Apartar (solo Emprendedora/Líder — Staff,
// Encargado y Admin conservan su lightbox simple sin cambios): foto
// grande + toda la información del artículo + selector de color de
// piedra/talla que cambia la foto mostrada. Lo abre tanto el clic en la
// foto de la tarjeta como el botón "Apartar" cuando hay más de una
// variante disponible (con una sola, ese botón salta directo a
// mostrarPasoConfirmarApartar sin pasar por aquí).
function abrirModalDetalleProducto(productoId) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const producto = obtenerCatalogoReal().find(p => p.id === productoId);
  if (!producto) return;

  const disponibles = variantesDisponibles(producto);
  const material = MATERIALES.find(m => m.key === producto.material)?.label || producto.material || '';
  const fotoGenerica = esFotoGenericaProducto(producto);
  const seleccionUnica = disponibles.length === 1 ? disponibles[0] : null;
  const precioEl = precioConDescuento(producto);
  const ganancia = Math.round((Number(producto.precioEtiqueta) - Number(precioEl)) * 100) / 100;
  // Hasta 12 opciones de color/talla se ven como botones para elegir;
  // con más, la lista desplegable de siempre.
  const conOpciones = disponibles.length > 0 && disponibles.length <= 12;

  box.classList.add('modal-box-xwide');

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="detalle-producto-layout">
      <div class="detalle-producto-foto">
        <img id="detalleProductoImg" src="${seleccionUnica ? fotoVarianteProducto(producto, seleccionUnica) : normalizarImagenProducto(producto, true)}" alt="${escapeAttribute(producto.nombre)}" class="${fotoGenerica ? 'foto-generica' : ''}">
        <button type="button" class="galeria-flecha galeria-anterior" id="galeriaAnterior" aria-label="Foto anterior" hidden>&#8249;</button>
        <button type="button" class="galeria-flecha galeria-siguiente" id="galeriaSiguiente" aria-label="Foto siguiente" hidden>&#8250;</button>
        <span class="galeria-contador" id="galeriaContador" aria-live="polite" hidden></span>
      </div>
      <div class="detalle-producto-info">
        <div>
          <h3>${escapeHTMLCatalogoVariantes(producto.nombre)}</h3>
          <p class="detalle-meta">${escapeHTMLCatalogoVariantes([material, producto.colorOro].filter(Boolean).join(' · '))}</p>
        </div>
        <div class="detalle-precio">
          <b>$${precioEl} MXN</b>
          <s>$${producto.precioEtiqueta} MXN</s>
          ${ganancia > 0 ? `<span class="detalle-ganas">Ganas $${ganancia} al venderla</span>` : ''}
        </div>
        ${producto.descripcion ? `<p class="detalle-descripcion">${escapeHTMLCatalogoVariantes(producto.descripcion)}</p>` : ''}
        <dl class="detalle-caracteristicas">
          <div><dt>Categoría</dt><dd>${escapeHTMLCatalogoVariantes(etiquetaCategoriaProducto(producto) || 'Sin categoría')}</dd></div>
          <div><dt>Material</dt><dd>${escapeHTMLCatalogoVariantes(material)}</dd></div>
          ${producto.colorOro ? `<div><dt>Color de oro</dt><dd>${escapeHTMLCatalogoVariantes(producto.colorOro)}</dd></div>` : ''}
          <div><dt>Precio etiqueta</dt><dd>$${producto.precioEtiqueta} MXN</dd></div>
          <div><dt>Tu descuento</dt><dd>${producto.descuento || 0}%</dd></div>
        </dl>

        ${disponibles.length ? `
          <div class="detalle-variantes">
            <span class="detalle-etiqueta" id="detalleVarianteEt">Color / talla</span>
            ${conOpciones ? `
              <div class="detalle-opciones" role="radiogroup" aria-labelledby="detalleVarianteEt">
                ${disponibles.map(v => `<label class="opcion-variante"><input type="radio" name="detalleVariante" value="${v.id}" ${seleccionUnica && seleccionUnica.id === v.id ? 'checked' : ''}><span>${escapeHTMLCatalogoVariantes(etiquetaVariante(v))}</span></label>`).join('')}
              </div>` : ''}
            <select id="detalleVarianteSelect" aria-labelledby="detalleVarianteEt" ${conOpciones ? 'hidden' : ''}>
              ${seleccionUnica ? '' : '<option value="">Selecciona...</option>'}
              ${disponibles.map(v => `<option value="${v.id}" ${seleccionUnica && seleccionUnica.id === v.id ? 'selected' : ''}>${escapeHTMLCatalogoVariantes(etiquetaVariante(v))}</option>`).join('')}
            </select>
          </div>
        ` : `<p class="modal-sub">Ya no hay existencia de esta pieza.</p>`}
        ${window.MWCompartirPieza ? `<p class="detalle-ayuda">Al compartir por WhatsApp, la imagen lleva solo el precio etiqueta.</p>` : ''}
        <div class="detalle-acciones">
          ${window.MWCompartirPieza ? `
            <button class="btn btn-outline compartir-detalle-btn" type="button" id="detalleCompartirBtn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>
              Compartir
            </button>` : ''}
          ${disponibles.length ? `<button class="btn btn-primary" type="button" id="detalleApartarBtn" ${seleccionUnica ? '' : 'disabled'}>${seleccionUnica ? 'Seleccionar' : 'Elige color / talla'}</button>` : ''}
        </div>
      </div>
    </div>
  `;
  overlay.classList.add('open');

  // Compartir por WhatsApp: la misma imagen que usa S/E/A (foto, isotipo y
  // datos con el precio etiqueta — nunca el precio emprendedora), con solo
  // las variantes disponibles y sin mostrar cuántas piezas hay.
  document.getElementById('detalleCompartirBtn')?.addEventListener('click', () => {
    const elegida = document.getElementById('detalleVarianteSelect')?.value || seleccionUnica?.id || '';
    window.MWCompartirPieza?.abrir(producto, { soloDisponibles: true, varianteId: elegida });
  });

  const select = document.getElementById('detalleVarianteSelect');
  const apartarBtn = document.getElementById('detalleApartarBtn');
  const img = document.getElementById('detalleProductoImg');

  // Galería: TODAS las fotos del producto (de cualquier variante o sin
  // variante), con flechas, contador, deslizar el dedo y teclado ← →.
  // Elegir un color/talla salta a la foto de esa variante.
  const galeria = { fotos: [], indice: 0 };
  const anterior = document.getElementById('galeriaAnterior');
  const siguiente = document.getElementById('galeriaSiguiente');
  const contador = document.getElementById('galeriaContador');

  function mostrarFoto(i) {
    const n = galeria.fotos.length;
    if (!n || !img) return;
    galeria.indice = (i + n) % n;
    img.src = galeria.fotos[galeria.indice].src;
    img.classList.remove('foto-generica');
    if (contador) contador.textContent = `${galeria.indice + 1} / ${n}`;
  }

  function irAFotoDeVariante(variante) {
    if (!galeria.fotos.length) return false;
    const i = variante && variante.fotoId ? galeria.fotos.findIndex(f => f.id === variante.fotoId) : -1;
    mostrarFoto(i >= 0 ? i : 0);
    return true;
  }

  (async () => {
    let fotos = fotosEmbebidasProducto(producto);
    if (!fotos.length && !(Array.isArray(producto.fotosIds) && !producto.fotosIds.length)) {
      try { fotos = await cargarGaleriaProducto(producto.id); } catch (error) { fotos = []; }
    }
    if (!img || !img.isConnected) return; // ya cerró el modal
    galeria.fotos = (fotos || []).filter(f => f && f.src);
    if (!galeria.fotos.length) return;
    const elegida = select && select.value ? buscarVariante(producto, select.value) : seleccionUnica;
    irAFotoDeVariante(elegida);
    const varias = galeria.fotos.length > 1;
    [anterior, siguiente, contador].forEach(el => { if (el) el.hidden = !varias; });
  })();

  anterior?.addEventListener('click', () => mostrarFoto(galeria.indice - 1));
  siguiente?.addEventListener('click', () => mostrarFoto(galeria.indice + 1));

  let inicioX = null;
  img?.addEventListener('touchstart', (e) => { inicioX = e.touches[0].clientX; }, { passive: true });
  img?.addEventListener('touchend', (e) => {
    if (inicioX === null || galeria.fotos.length < 2) return;
    const dx = e.changedTouches[0].clientX - inicioX;
    inicioX = null;
    if (Math.abs(dx) > 40) mostrarFoto(galeria.indice + (dx < 0 ? 1 : -1));
  });

  const alTeclear = (e) => {
    if (!img || !img.isConnected || !overlay.classList.contains('open')) { document.removeEventListener('keydown', alTeclear); return; }
    if (galeria.fotos.length < 2 || e.target.closest?.('select, input, textarea')) return;
    if (e.key === 'ArrowLeft') mostrarFoto(galeria.indice - 1);
    if (e.key === 'ArrowRight') mostrarFoto(galeria.indice + 1);
  };
  document.addEventListener('keydown', alTeclear);

  select?.addEventListener('change', () => {
    const variante = buscarVariante(producto, select.value);
    if (!irAFotoDeVariante(variante) && img) img.src = variante ? fotoVarianteProducto(producto, variante) : normalizarImagenProducto(producto, true);
    if (apartarBtn) {
      apartarBtn.disabled = !select.value;
      apartarBtn.textContent = select.value ? 'Seleccionar' : 'Elige color / talla';
    }
  });
  // Los botones de color/talla solo mueven el <select> (que sigue
  // siendo el que manda: foto de la variante y botón Apartar).
  box.querySelectorAll('input[name="detalleVariante"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (!select || !radio.checked) return;
      select.value = radio.value;
      select.dispatchEvent(new Event('change'));
    });
  });

  apartarBtn?.addEventListener('click', () => {
    const variante = buscarVariante(producto, select.value);
    if (!variante) return;
    mostrarPasoConfirmarApartar(producto, variante);
  });
}

// Paso 2: ya con la variante elegida, decide el camino real según si
// esta persona ya tiene una ventana/crédito o si tiene que pedirlo —
// exactamente lo que hace Staff al abrir una ventana nueva
// (abrirVentanaApartado ya reutiliza el crédito guardado sola).
async function mostrarPasoConfirmarApartar(producto, variante) {
  if (!usuarioIdActual) { mostrarToast('No se pudo identificar tu cuenta — vuelve a iniciar sesión.'); return; }

  const datosPieza = {
    producto: producto.nombre, variante: etiquetaVariante(variante), colorOro: producto.colorOro || '',
    total: precioConDescuento(producto), productoId: producto.id, varianteId: variante.id
  };

  const ventanaExistente = buscarVentanaParaApartar(obtenerVentanasApartado(), usuarioIdActual);

  if (ventanaExistente) {
    const resultado = await agregarPiezaAVentana(ventanaExistente, datosPieza, null);
    if (!resultado.ok) { mostrarToast(resultado.error); return; }
    guardarVentanasApartado(obtenerVentanasApartado().map(v => v.id === ventanaExistente.id ? ventanaExistente : v));
    aplicarFiltros(); // refresca el grid: la existencia de la variante ya bajó

    if (ventanaExistente.estado === 'activa') {
      mostrarPasoExito('Esta pieza se agregó a tu ventana activa — no necesitas volver a depositar.');
    } else {
      notificarDisponibilidadCondicionadaADeposito(ventanaExistente);
      mostrarPasoExito('Esta pieza se agregó a tu pedido. Sigue pendiente tu depósito — deposita pronto: mientras no se confirme, tu pieza no está garantizada.');
    }
    return;
  }

  cerrarVentanasVencidasSinPiezas(obtenerVentanasApartado(), usuarioIdActual, null);
  const persona = typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(usuarioIdActual) : null;
  const nuevaVentana = abrirVentanaApartado({
    // La etiqueta de su cuenta (Normal/Foránea/VIP): antes siempre se
    // abría como Normal sin importar la cuenta.
    usuarioId: usuarioIdActual, usuarioNombre: usuarioNombreActual, telefono: persona?.telefono || '', categoria: persona?.categoria || 'normal'
  }, null);
  const resultado = await agregarPiezaAVentana(nuevaVentana, datosPieza, null);
  if (!resultado.ok) { mostrarToast(resultado.error); return; }

  const ventanas = obtenerVentanasApartado();
  ventanas.push(nuevaVentana);
  guardarVentanasApartado(ventanas);
  aplicarFiltros(); // refresca el grid: la existencia de la variante ya bajó

  if (nuevaVentana.estado === 'activa') {
    mostrarPasoExito('Ya tenías depósito guardado de una ventana anterior — esta pieza quedó seleccionada de una vez, sin volver a depositar.');
  } else {
    notificarDisponibilidadCondicionadaADeposito(nuevaVentana);
    mostrarPasoPedirDeposito(nuevaVentana);
  }
}

// Aviso persistente (no solo el modal, que se puede cerrar y olvidar):
// mientras no se confirme el depósito, la disponibilidad de la pieza
// no está garantizada — si tarda en depositar, Staff puede liberarla.
function notificarDisponibilidadCondicionadaADeposito(ventana) {
  if (typeof agregarNotificacion !== 'function' || !usuarioIdActual) return;
  agregarNotificacion({
    texto: `Tu pieza quedó registrada, pero su disponibilidad depende de tu depósito de $${depositoFaltanteVentana(ventana)} — mientras no se confirme, no está garantizada y podría dejar de estar disponible. Deposita pronto para asegurarla.`,
    link: 'apartados',
    paraId: usuarioIdActual,
    rolDestino: 'emprendedora_lider',
    origen: 'emprendedora_lider'
  });
}

function mostrarPasoExito(mensaje) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  box.classList.remove('modal-box-xwide'); // por si venía del modal enriquecido de detalle (ver abrirModalDetalleProducto)
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="confirm-box">
      <div class="check-circle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <h3>¡Pieza seleccionada!</h3>
      <p class="modal-sub">${mensaje}</p>
      <button class="btn btn-primary" style="width:100%;" data-close>Cerrar</button>
    </div>
  `;
  overlay.classList.add('open');
}

function mostrarPasoPedirDeposito(ventana) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  box.classList.remove('modal-box-xwide'); // por si venía del modal enriquecido de detalle (ver abrirModalDetalleProducto)
  const mensajeWa = encodeURIComponent('¡Hola! Te envío mi comprobante de pago');
  // $50 normal, $200 foránea (ver depositoMinimoCategoria), menos el
  // crédito anterior que ya se le haya aplicado.
  const monto = depositoFaltanteVentana(ventana);
  const creditoPrevio = Number(ventana.depositoApartadoDisponible || 0);

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Necesitas depositar $${monto}</h3>
    <p class="modal-sub">Tu pieza ya quedó registrada. Para que tu ventana se active, confirma tu depósito de $${monto}${creditoPrevio > 0 ? ` (ya se aplicaron $${creditoPrevio} de tu crédito anterior)` : ''} — esto abre tu ventana para apartar piezas sin pagar de nuevo.</p>

    <div class="bank-details-box">
      <div class="copy-field">
        <span><span class="cf-label">Banco</span><span class="cf-value">${DATOS_BANCARIOS_EJEMPLO.banco}</span></span>
      </div>
      <div class="copy-field">
        <span><span class="cf-label">Titular</span><span class="cf-value">${DATOS_BANCARIOS_EJEMPLO.titular}</span></span>
      </div>
      <div class="copy-field">
        <span><span class="cf-label">CLABE</span><span class="cf-value">${DATOS_BANCARIOS_EJEMPLO.clabe}</span></span>
        <button data-copy="${DATOS_BANCARIOS_EJEMPLO.clabe}">Copiar</button>
      </div>
    </div>

    <p class="whatsapp-note">
      Manda tu comprobante a este WhatsApp:<br>
      <a href="https://wa.me/524448100805?text=${mensajeWa}" target="_blank" rel="noopener">444 810 0805</a>
    </p>

    <button class="btn btn-primary" style="width:100%;" id="yaPagueDepositoBtn">Ya pagué mi depósito</button>
  `;
  overlay.classList.add('open');

  box.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard?.writeText(btn.getAttribute('data-copy'));
      const original = btn.textContent;
      btn.innerHTML = 'Copiado <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span>';
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  });

  document.getElementById('yaPagueDepositoBtn')?.addEventListener('click', () => {
    if (typeof agregarNotificacion === 'function') {
      const texto = `${usuarioNombreActual || 'Una emprendedora'} avisó que ya pagó su depósito de $50 — confirma el depósito para abrir su ventana.`;
      const query = usuarioNombreActual ? `?buscar=${encodeURIComponent(usuarioNombreActual)}` : '';
      agregarNotificacion({ texto, link: `staff-apartados.html${query}`, rolDestino: 'staff', origen: 'emprendedora_lider' });
    }
    box.innerHTML = `
      <button class="modal-close" data-close>&times;</button>
      <div class="confirm-box">
        <div class="check-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h3>¡Listo!</h3>
        <p class="modal-sub">Ya se notificó al equipo, en breve confirmarán tu depósito y se abrirá tu ventana para seleccionar piezas.</p>
        <button class="btn btn-primary" style="width:100%;" data-close>Cerrar</button>
      </div>
    `;
  });
}

// La tarjeta de producto nunca mostraba la foto real que sube Staff/
// Admin — siempre el logo MW fijo. Mismo respaldo que ya usa
// admin/encargado/staff-catalogo.js.
function normalizarImagenProducto(producto, completa = false) {

  const imagen = fotoPrincipalProducto(producto, completa);

  if (!imagen) return '../../assets/images/isotipo-morado.png';

  // Datos de ejemplo antiguos guardan la ruta relativa a /portal/ (un
  // nivel), pero esta página vive en /portal/emprendedora/ o
  // /portal/lider/ (dos niveles).
  if (imagen.startsWith('../assets/')) {
    return `../../${imagen.slice(3)}`;
  }

  return imagen;

}

// true si la foto principal no es una foto real (vacía, o la ruta del
// logo MW que trae la semilla de ejemplo) — para decidir si se pinta
// como marca de agua desvanecida (clase "foto-generica" en
// css/styles.css) o como foto completa.
function esFotoGenericaProducto(producto) {
  const imagen = fotoPrincipalProducto(producto);
  return !imagen || /isotipo-morado\.png/.test(imagen);
}
