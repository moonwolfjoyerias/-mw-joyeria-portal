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
const COLORES_ORO = ['Blanco', 'Amarillo', 'Dorado', 'Rosa', 'Negro'];

const filtro = {
  materiales: new Set(),
  categorias: new Set(),
  calidades: new Set(),
  coloresOro: new Set(),
  talla: '',
};

let usuarioIdActual = '';
let usuarioNombreActual = '';

document.addEventListener('DOMContentLoaded', () => {
  usuarioIdActual = (typeof obtenerIdPersonaActualPortal === 'function' && obtenerIdPersonaActualPortal()) || '';
  usuarioNombreActual = (typeof obtenerNombrePersonaActualPortal === 'function' && obtenerNombrePersonaActualPortal()) || '';

  renderFiltroMateriales();
  renderFiltroCategorias();
  renderFiltroCalidad();
  renderFiltroColorOro();
  renderFiltroTalla();
  aplicarFiltros();

  const clearBtn = document.getElementById('clearFiltersBtn');
  if (clearBtn) clearBtn.addEventListener('click', limpiarFiltros);
});

// ---------- Catálogo real (mismo que Staff/Encargado/Admin) ----------
function obtenerCatalogoReal() {
  return typeof obtenerCatalogoStaffStorage === 'function' ? obtenerCatalogoStaffStorage() : [];
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
  filtro.categorias.forEach(c => { if (!cats.includes(c)) filtro.categorias.delete(c); });
  wrap.innerHTML = cats.map(c => `
    <label class="filter-option">
      <input type="checkbox" value="${c}" data-filter="categoria" ${filtro.categorias.has(c) ? 'checked' : ''}>
      ${c}
    </label>
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', (e) => {
    if (e.target.checked) filtro.categorias.add(e.target.value); else filtro.categorias.delete(e.target.value);
    aplicarFiltros();
  }));
}

function renderFiltroCalidad() {
  const wrap = document.getElementById('filterCalidad');
  if (!wrap) return;
  wrap.innerHTML = ['estandar', 'premium'].map(q => `
    <label class="filter-option">
      <input type="checkbox" value="${q}" data-filter="calidad">
      ${q === 'estandar' ? 'Estándar' : 'Premium'}
    </label>
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', (e) => {
    if (e.target.checked) filtro.calidades.add(e.target.value); else filtro.calidades.delete(e.target.value);
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
  filtro.calidades.clear();
  filtro.coloresOro.clear();
  filtro.talla = '';
  document.querySelectorAll('.filter-panel input[type="checkbox"]').forEach(cb => cb.checked = false);
  const tallaSelect = document.getElementById('filterTalla');
  if (tallaSelect) tallaSelect.value = '';
  renderFiltroCategorias();
  toggleOroGroups();
  aplicarFiltros();
}

function aplicarFiltros() {
  const resultado = obtenerCatalogoReal().filter((p) => {
    if (filtro.materiales.size > 0 && !filtro.materiales.has(p.material)) return false;
    if (filtro.categorias.size > 0 && !filtro.categorias.has(p.categoria)) return false;
    if (filtro.calidades.size > 0 && !filtro.calidades.has(p.calidad)) return false;
    const variantes = p.variantes || [];
    if (filtro.coloresOro.size > 0 && !variantes.some(v => filtro.coloresOro.has(v.colorOro))) return false;
    if (filtro.talla && !variantes.some(v => v.talla === filtro.talla)) return false;
    return true;
  });
  renderProductos(resultado);
}

function renderProductos(productos) {
  const grid = document.getElementById('catalogGrid');
  const count = document.getElementById('resultCount');
  if (!grid) return;

  if (count) count.textContent = `${productos.length} pieza${productos.length === 1 ? '' : 's'}`;

  if (productos.length === 0) {
    grid.innerHTML = '<div class="catalog-empty">No hay piezas que coincidan con estos filtros.</div>';
    return;
  }

  grid.innerHTML = productos.map((p) => {
    const disponibles = variantesDisponibles(p);
    const metaVariantes = Array.from(new Set(disponibles.map(v => etiquetaVariante(v)).filter(v => v !== 'Única'))).join(' · ');
    return `
    <div class="catalog-product-card">
      <div class="cp-photo">
        <img src="../../assets/images/isotipo-morado.png" alt="">
      </div>
      <div class="cp-body">
        <h4>${escapeHTMLCatalogoVariantes(p.nombre)}</h4>
        <div class="cp-meta">${escapeHTMLCatalogoVariantes([p.categoria, metaVariantes].filter(Boolean).join(' · ')) || '&nbsp;'}</div>
        <div class="cp-price">
          <span class="price-public">$${p.precioEtiqueta} MXN</span>
          <span class="price-emprendedora">$${precioConDescuento(p)} MXN</span>
        </div>
        ${disponibles.length
          ? `<button class="btn btn-primary btn-apartar" data-apartar="${p.id}">Apartar</button>`
          : `<button class="btn btn-outline btn-apartar" disabled style="opacity:0.5;cursor:not-allowed;">No disponible</button>`}
      </div>
    </div>
  `;
  }).join('');

  grid.querySelectorAll('[data-apartar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalApartar(btn.getAttribute('data-apartar')));
  });
}

// Paso 1: si el producto tiene varias variantes con existencia, primero
// hay que elegir color/talla (igual que hace Staff al crear una
// ventana). Si solo hay una, se salta directo a confirmar.
function abrirModalApartar(productoId) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const producto = obtenerCatalogoReal().find(p => p.id === productoId);
  if (!producto) return;

  const disponibles = variantesDisponibles(producto);
  if (!disponibles.length) {
    mostrarToast('Ya no hay existencia de esta pieza.');
    return;
  }

  if (disponibles.length === 1) {
    mostrarPasoConfirmarApartar(producto, disponibles[0]);
    return;
  }

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Apartar: ${escapeHTMLCatalogoVariantes(producto.nombre)}</h3>
    <p class="modal-sub">Elige la variante que quieres apartar.</p>
    <label for="apartarVarianteSelect">Color / talla</label>
    <select id="apartarVarianteSelect" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:#312044;">
      <option value="">Selecciona...</option>
      ${disponibles.map(v => `<option value="${v.id}">${escapeHTMLCatalogoVariantes(etiquetaVariante(v))}</option>`).join('')}
    </select>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;" id="continuarApartarBtn" disabled>Continuar</button>
  `;
  overlay.classList.add('open');

  const select = document.getElementById('apartarVarianteSelect');
  const continuarBtn = document.getElementById('continuarApartarBtn');
  select.addEventListener('change', () => { continuarBtn.disabled = !select.value; });
  continuarBtn.addEventListener('click', () => {
    const variante = buscarVariante(producto, select.value);
    if (variante) mostrarPasoConfirmarApartar(producto, variante);
  });
}

// Paso 2: ya con la variante elegida, decide el camino real según si
// esta persona ya tiene una ventana/crédito o si tiene que pedirlo —
// exactamente lo que hace Staff al abrir una ventana nueva
// (abrirVentanaApartado ya reutiliza el crédito guardado sola).
function mostrarPasoConfirmarApartar(producto, variante) {
  if (!usuarioIdActual) { mostrarToast('No se pudo identificar tu cuenta — vuelve a iniciar sesión.'); return; }

  const datosPieza = {
    producto: producto.nombre, variante: etiquetaVariante(variante),
    total: precioConDescuento(producto), productoId: producto.id, varianteId: variante.id
  };

  const ventanaExistente = obtenerVentanasApartado().find(v =>
    v.usuarioId === usuarioIdActual && v.estado !== 'vencida' && v.estado !== 'cerrada'
  );

  if (ventanaExistente) {
    const resultado = agregarPiezaAVentana(ventanaExistente, datosPieza, null);
    if (!resultado.ok) { mostrarToast(resultado.error); return; }
    guardarVentanasApartado(obtenerVentanasApartado().map(v => v.id === ventanaExistente.id ? ventanaExistente : v));
    aplicarFiltros(); // refresca el grid: la existencia de la variante ya bajó

    if (ventanaExistente.estado === 'activa') {
      mostrarPasoExito('Esta pieza se agregó a tu ventana activa — no necesitas volver a depositar.');
    } else {
      notificarDisponibilidadCondicionadaADeposito(ventanaExistente);
      mostrarPasoExito('Esta pieza se agregó a tu apartado. Sigue pendiente tu depósito — deposita pronto: mientras no se confirme, tu pieza no está garantizada.');
    }
    return;
  }

  const persona = typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(usuarioIdActual) : null;
  const nuevaVentana = abrirVentanaApartado({
    usuarioId: usuarioIdActual, usuarioNombre: usuarioNombreActual, telefono: persona?.telefono || '', categoria: 'normal'
  }, null);
  const resultado = agregarPiezaAVentana(nuevaVentana, datosPieza, null);
  if (!resultado.ok) { mostrarToast(resultado.error); return; }

  const ventanas = obtenerVentanasApartado();
  ventanas.push(nuevaVentana);
  guardarVentanasApartado(ventanas);
  aplicarFiltros(); // refresca el grid: la existencia de la variante ya bajó

  if (nuevaVentana.estado === 'activa') {
    mostrarPasoExito('Ya tenías depósito guardado de una ventana anterior — esta pieza quedó apartada de una vez, sin volver a depositar.');
  } else {
    notificarDisponibilidadCondicionadaADeposito(nuevaVentana);
    mostrarPasoPedirDeposito();
  }
}

// Aviso persistente (no solo el modal, que se puede cerrar y olvidar):
// mientras no se confirme el depósito, la disponibilidad de la pieza
// no está garantizada — si tarda en depositar, Staff puede liberarla.
function notificarDisponibilidadCondicionadaADeposito(ventana) {
  if (typeof agregarNotificacion !== 'function' || !usuarioIdActual) return;
  agregarNotificacion({
    texto: 'Tu pieza quedó registrada, pero su disponibilidad depende de tu depósito — mientras no se confirme, no está garantizada y podría dejar de estar disponible. Deposita pronto para asegurarla.',
    link: 'apartados',
    paraId: usuarioIdActual,
    rolDestino: 'emprendedora_lider',
    origen: 'emprendedora_lider'
  });
}

function mostrarPasoExito(mensaje) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="confirm-box">
      <div class="check-circle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <h3>¡Apartado!</h3>
      <p class="modal-sub">${mensaje}</p>
      <button class="btn btn-primary" style="width:100%;" data-close>Cerrar</button>
    </div>
  `;
  overlay.classList.add('open');
}

function mostrarPasoPedirDeposito() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const mensajeWa = encodeURIComponent('¡Hola! Te envío mi comprobante de pago');

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Necesitas depositar $50</h3>
    <p class="modal-sub">Tu pieza ya quedó registrada. Para que tu ventana se active, confirma tu depósito de $50 — esto abre tu ventana para apartar piezas sin pagar de nuevo.</p>

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
      agregarNotificacion({ texto, link: `staff-apartados.html${query}`, rolDestino: 'staff' });
    }
    box.innerHTML = `
      <button class="modal-close" data-close>&times;</button>
      <div class="confirm-box">
        <div class="check-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h3>¡Listo!</h3>
        <p class="modal-sub">Ya se notificó al equipo, en breve confirmarán tu depósito y se abrirá tu ventana para apartar.</p>
        <button class="btn btn-primary" style="width:100%;" data-close>Cerrar</button>
      </div>
    `;
  });
}
