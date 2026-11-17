// MW JOYERÍA — Árbol de tu equipo (Emprendedoras y Líderes), con los datos de mi-equipo
//
// Cada e/l ve SU rama del árbol de "mi-equipo" (la misma base que ya usan:
// proyecto gala-mw-2026, documento arbolEquipo/team-tree-v2), con sus
// puntos por periodo, resumen por línea, su auditoría de rango y el Excel
// de su equipo (los boletos de rifa se ven en Mi cuenta). Solo lee: lo edita
// Administración en BRILLO o en mi-equipo.
//
// Se encuentra a la persona por el vínculo que pone Administración en BRILLO
// (portalPersonaId); si no tiene, por su usuario (MW####) igual a la
// "Membresía" de mi-equipo, y si no, por su nombre completo. Los cálculos son
// copia de mi-equipo/index.html (y de BRILLO src/arbol/modelo.ts): si
// cambia uno, cambian los tres.
(function () {
  // Todos los cálculos viven en js/arbol-datos.js (window.ArbolMW).
  const A = () => window.ArbolMW;
  const etiquetaMes = k => A().etiquetaMes(k);
  const mesSiguiente = k => A().mesSiguiente(k);
  const mesAnterior = k => A().mesAnterior(k);
  const normalizar = s => A().normalizar(s);
  const puntos = (m, k) => A().puntos(m, k);
  const conLinea = id => A().conLinea(id);
  const hijosDe = () => A().hijosDe();
  const mesesConPuntos = () => A().mesesConPuntos();
  const rangoDelMes = (id, k) => A().rangoDelMes(id, k);
  const comisionesDelMes = (id, k) => A().comisionesDelMes(id, k);
  const tasasTexto = k => A().tasasTexto(k);

  let yo = null;
  let mk = null;
  let zoom = 1;
  let coincidencias = [];
  let iCoincidencia = 0;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pts = n => Math.round(n).toLocaleString('es-MX');
  const mxn = n => '$' + (Math.round(n * 100) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function buscarme() {
    const id = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
    const p = id && typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(id) : null;
    return p ? A().miembroDePersona(p) : null;
  }

  // ---------- pintar ----------
  const caja = () => document.getElementById('arbolMiEquipoCard');

  function pintar() {
    const el = caja();
    if (!el) return;
    if (!yo) {
      el.innerHTML = `<div class="org-tree-card-header"><h3>Árbol de tu equipo</h3></div>
        <p class="hint">Todavía no encontramos tu lugar en el árbol. Pide a Administración que vincule tu cuenta con tu membresía.</p>`;
      return;
    }
    const meses = mesesConPuntos();
    if (!meses.includes(mk)) mk = meses[0];
    const p = puntos(yo, mk);
    const total = p.p1 + p.p2;
    const prof = conLinea(yo.id);
    const equipo = prof.size - 1;
    const r = rangoDelMes(yo.id, mk);
    const vig = comisionesDelMes(yo.id, mk);
    el.innerHTML = `
      <div class="org-tree-card-header">
        <h3>Árbol de tu equipo</h3>
        <label class="arbol-me-mes">Mes <select id="arbolMeMes">${meses.map(k => `<option value="${k}" ${k === mk ? 'selected' : ''}>${etiquetaMes(k)}</option>`).join('')}</select></label>
      </div>
      <div class="arbol-me-cifras">
        <div><span>Periodo 1</span><b>${pts(p.p1)}</b></div>
        <div><span>Periodo 2</span><b>${pts(p.p2)}</b></div>
        <div><span>Total del mes</span><b>${pts(total)}</b></div>
        ${equipo ? `<div><span>Personas en tu equipo</span><b>${equipo}</b></div>` : ''}
        <div><span>Tu rango vigente en ${etiquetaMes(mk)}</span><b>${esc(vig.info.rango.label)}</b></div>
        <div><span>Rango que vas logrando en ${etiquetaMes(mk)}</span><b>${esc(r.rango.label)}${r.consolidaEn ? ` <small>(consolidado en P${r.consolidaEn})</small>` : ''}</b></div>
      </div>
      <p class="hint">Tu rango vigente es el que calificaste en ${etiquetaMes(mesAnterior(mk))}${vig.esManual ? ' (asignado por Administración)' : ''}: con él se pagan tus comisiones de ${etiquetaMes(mk)}. Lo que logres en ${etiquetaMes(mk)} será tu rango de ${etiquetaMes(mesSiguiente(mk))}; si lo cumples en el Periodo 1 (al día 15) queda consolidado desde ahí.</p>
      ${equipo ? `
      <div class="arbol-me-acciones">
        <button type="button" class="btn btn-secondary" id="arbolMeLineas">Resumen por línea</button>
        <button type="button" class="btn btn-secondary" id="arbolMeAuditoria">Mi auditoría de rango</button>
        <button type="button" class="btn btn-primary" id="arbolMeExcel">Descargar Excel de mi equipo</button>
      </div>
      <div class="tree-toolbar arbol-me-barra">
        <input type="text" id="arbolMeBuscar" placeholder="Buscar por nombre...">
        <span class="arbol-me-nav" id="arbolMeNav" style="display:none;"><button type="button" class="secondary" id="arbolMeAnt" aria-label="Anterior">‹</button> <span id="arbolMeCuenta"></span> <button type="button" class="secondary" id="arbolMeSig" aria-label="Siguiente">›</button></span>
        <span class="arbol-me-zoom"><button type="button" class="secondary" id="arbolMeMenos" aria-label="Reducir">－</button> <span id="arbolMeZoom">${Math.round(zoom * 100)}%</span> <button type="button" class="secondary" id="arbolMeMas" aria-label="Ampliar">＋</button></span>
      </div>
      <div class="org-tree-wrap arbol-me-lienzo" id="arbolMeLienzo"><div id="arbolMeArbol" style="zoom:${zoom}">${arbolHtml()}</div></div>` : '<p class="hint">Todavía no tienes personas debajo de ti en el árbol.</p>'}`;
    conectar();
  }

  function arbolHtml() {
    const h = hijosDe();
    const nodo = (m, d) => {
      const p = puntos(m, mk);
      const hs = (h.get(m.id) || []).slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
      const html = `<div class="org-node ${d === 0 ? 'self' : `lvl-${((d - 1) % 5) + 1}`}" data-nombre="${esc(normalizar(m.fullName))}">
        <span class="on-name">${esc(m.fullName)}</span>
        <span class="on-tag">${d === 0 ? 'Tú' : `Línea ${d}`}</span>
        <span class="on-points">P1 ${pts(p.p1)} · P2 ${pts(p.p2)}</span></div>`;
      return hs.length ? `<li>${html}<ul>${hs.map(x => nodo(x, d + 1)).join('')}</ul></li>` : `<li>${html}</li>`;
    };
    return `<div class="org-tree"><ul>${nodo(yo, 0)}</ul></div>`;
  }

  function conectar() {
    const $ = id => document.getElementById(id);
    $('arbolMeMes') && $('arbolMeMes').addEventListener('change', e => { mk = e.target.value; pintar(); });
    if (!$('arbolMeLienzo')) return;
    $('arbolMeLineas').addEventListener('click', abrirLineas);
    $('arbolMeAuditoria').addEventListener('click', abrirAuditoria);
    $('arbolMeExcel').addEventListener('click', descargarExcel);
    const ponerZoom = z => { zoom = Math.min(1.6, Math.max(0.4, +z.toFixed(2))); $('arbolMeArbol').style.zoom = zoom; $('arbolMeZoom').textContent = `${Math.round(zoom * 100)}%`; };
    $('arbolMeMenos').addEventListener('click', () => ponerZoom(zoom - 0.1));
    $('arbolMeMas').addEventListener('click', () => ponerZoom(zoom + 0.1));
    $('arbolMeBuscar').addEventListener('input', e => buscar(e.target.value));
    $('arbolMeAnt').addEventListener('click', () => irA(iCoincidencia - 1));
    $('arbolMeSig').addEventListener('click', () => irA(iCoincidencia + 1));
    const lienzo = $('arbolMeLienzo');
    requestAnimationFrame(() => { lienzo.scrollLeft = (lienzo.scrollWidth - lienzo.clientWidth) / 2; });
  }

  function buscar(texto) {
    const nodos = Array.from(document.querySelectorAll('#arbolMeArbol .org-node'));
    nodos.forEach(n => n.classList.remove('match', 'match-active'));
    const q = normalizar(texto);
    coincidencias = q ? nodos.filter(n => (n.getAttribute('data-nombre') || '').includes(q)) : [];
    coincidencias.forEach(n => n.classList.add('match'));
    document.getElementById('arbolMeNav').style.display = q ? '' : 'none';
    if (q && !coincidencias.length) document.getElementById('arbolMeCuenta').textContent = 'Sin resultados';
    if (coincidencias.length) irA(0);
  }
  function irA(i) {
    if (!coincidencias.length) return;
    iCoincidencia = (i + coincidencias.length) % coincidencias.length;
    coincidencias.forEach(n => n.classList.remove('match-active'));
    const n = coincidencias[iCoincidencia];
    n.classList.add('match-active');
    n.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    document.getElementById('arbolMeCuenta').textContent = `${iCoincidencia + 1} / ${coincidencias.length}`;
  }

  function modal(html) {
    const overlay = document.getElementById('modalOverlay');
    const box = document.getElementById('modalBox');
    if (!overlay || !box) return;
    box.className = 'modal-box modal-box-xwide';
    box.innerHTML = `<button type="button" class="modal-close" id="arbolMeCerrar" aria-label="Cerrar">×</button>${html}`;
    overlay.classList.add('open');
    const cerrar = () => { overlay.classList.remove('open'); box.className = 'modal-box'; };
    document.getElementById('arbolMeCerrar').addEventListener('click', cerrar);
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); }, { once: true });
  }

  function abrirLineas() {
    const prof = conLinea(yo.id);
    const niveles = new Map();
    A().miembros.forEach(m => { const d = prof.get(m.id); if (!d) return; if (!niveles.has(d)) niveles.set(d, []); niveles.get(d).push(m); });
    const html = Array.from(niveles.keys()).sort((a, b) => a - b).map(d => {
      const lista = niveles.get(d).slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
      const totalNivel = lista.reduce((s, m) => { const p = puntos(m, mk); return s + p.p1 + p.p2; }, 0);
      return `<details class="arbol-me-nivel" ${d === 1 ? 'open' : ''}><summary><b>Línea ${d}</b> · ${lista.length} persona(s) · ${pts(totalNivel)} pts total</summary>
        <ul>${lista.map(m => { const p = puntos(m, mk); return `<li><span>${esc(m.fullName)}</span><span>P1 <b>${pts(p.p1)}</b> · P2 <b>${pts(p.p2)}</b> · Total <b>${pts(p.p1 + p.p2)}</b></span></li>`; }).join('')}</ul></details>`;
    }).join('');
    modal(`<h3>Resumen por línea</h3><p class="modal-sub">${esc(yo.fullName)} — ${etiquetaMes(mk)}</p>${html}`);
  }

  function abrirAuditoria() {
    const info = rangoDelMes(yo.id, mk);
    const hist = A().rangoHistorico(yo.id, mk).rango;
    const vig = comisionesDelMes(yo.id, mk);
    const ok = b => (b ? '<span class="arbol-me-ok">✓</span>' : '<span class="arbol-me-no">✗</span>');
    const dato = (t, v) => `<div><span>${t}</span><b>${v}</b></div>`;
    const filas = info.evaluaciones.map(e => `<tr class="${e.rango.key === info.rango.key ? 'arbol-me-gana' : ''}">
      <td><b>${e.rango.label}</b></td>
      <td>${ok(e.okProduccion)} ${pts(e.validaMes)} / ${pts(e.rango.produccion)}</td>
      <td>${ok(e.okActivas)} ${info.activas} / ${e.rango.activas}</td>
      <td>${ok(e.okCalificadas)} ${info.calificadas} / ${e.rango.calificadas}</td>
      <td>${ok(e.okCompra)} ${mxn(e.valorCompra)} / ${mxn(e.rango.compraLider)}<br><small>${e.soloUnPeriodo ? 'el mayor de P1 o P2' : 'el menor de P1 y P2'}</small></td>
      <td>${e.rango.key === info.rango.key ? '<b class="arbol-me-ok">Recalifica</b>' : (e.califica ? 'También cumple' : '<span class="arbol-me-no">No</span>')}</td></tr>`).join('');
    const lineas = info.lines.map((l, i) => {
      const propia = l.total - l.totalSinLider;
      return `<tr><td>${esc(l.nombre)}${i === 0 ? ' <small>(más fuerte)</small>' : ''}</td><td>${l.personas}</td><td>${pts(l.p1)}</td><td>${pts(l.p2)}</td><td><b>${pts(l.total)}</b></td><td>${pts(i === 0 ? propia + l.totalSinLider * A().TOPE_LINEA : l.total)}</td></tr>`;
    }).join('');
    modal(`<h3>Mi auditoría de rango</h3><p class="modal-sub">${esc(yo.fullName)} — ${etiquetaMes(mk)}</p>
      <div class="arbol-me-cifras">
        ${dato('Rango histórico', hist.label)}
        ${dato('Rango recalificado este mes', info.rango.label + (info.consolidaEn ? ` (consolida en P${info.consolidaEn})` : ''))}
        ${dato('Producción mensual', pts(info.produccion) + ' pts')}
        ${dato(`Activas (≥${A().MIN_ACTIVA} en P1 y P2)`, info.activas)}
        ${dato(`Calificadas (≥${A().MIN_CALIFICADA} en P1 y P2)`, info.calificadas)}
        ${dato('Compra personal P1 / P2', `${mxn(info.compraP1)} / ${mxn(info.compraP2)}`)}
        ${dato('Puntos válidos para rango', pts(info.validaMes) + ' pts')}
        ${dato(`Niveles que cobra desde ${etiquetaMes(mesSiguiente(mk))}`, tasasTexto(info.rango.key))}
        ${dato(`Comisión de ${etiquetaMes(mk)} (neto sin IVA)`, `${mxn(vig.total)} · rango vigente ${vig.info.rango.label}${vig.esManual ? ' (asignado)' : ''}`)}
      </div>
      <p class="hint">El rango recalificado en ${etiquetaMes(mk)} se aplica a las comisiones de ${etiquetaMes(mesSiguiente(mk))}. La línea más fuerte cuenta 100% de la compra de quien la encabeza y 50% de su equipo; las demás líneas cuentan completas.</p>
      <div class="arbol-me-tabla"><table><thead><tr><th>Rango</th><th>Producción válida</th><th>Activas</th><th>Calificadas</th><th>Compra personal</th><th>Resultado</th></tr></thead><tbody>${filas}</tbody></table></div>
      <h4>Producción por líneas</h4>
      ${info.lines.length ? `<div class="arbol-me-tabla"><table><thead><tr><th>Patrocinada directa</th><th>Personas</th><th>P1</th><th>P2</th><th>Producción</th><th>Válidos para rango</th></tr></thead><tbody>${lineas}</tbody></table></div>` : '<p class="hint">No tienes patrocinadas directas.</p>'}`);
  }

  function descargarExcel() {
    if (!window.MWExcel) return;
    const prof = conLinea(yo.id);
    const filas = A().miembros.filter(m => prof.has(m.id) && m.id !== yo.id)
      .sort((a, b) => prof.get(a.id) - prof.get(b.id) || a.fullName.localeCompare(b.fullName))
      .map(m => { const p = puntos(m, mk); return [m.fullName, `Línea ${prof.get(m.id)}`, p.p1, p.p2, p.p1 + p.p2]; });
    const suma = i => filas.reduce((s, f) => s + f[i], 0);
    const hoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    MWExcel.descargar({
      nombre: 'Equipo',
      sinEncabezado: true,
      columnas: [{ ancho: 28 }, { ancho: 12 }, { ancho: 16 }, { ancho: 16 }, { ancho: 10 }],
      filas: [
        ['Líder', yo.fullName], ['Mes consultado', etiquetaMes(mk)], ['Generado', hoy], ['Personas en el equipo', filas.length], [],
        ['Nombre completo', 'Línea', 'Puntos Periodo 1', 'Puntos Periodo 2', 'Total'],
        ...filas, [], ['TOTAL', '', suma(2), suma(3), suma(4)]
      ]
    }, `equipo-${yo.fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-')}-${mk}.xlsx`);
  }

  // ---------- arranque ----------
  document.addEventListener('DOMContentLoaded', async () => {
    const el = caja();
    if (!el) return;
    el.innerHTML = '<p class="hint">Cargando el árbol de tu equipo…</p>';
    if (typeof personasRepoListo !== 'undefined') { try { await personasRepoListo; } catch (e) { /* sigue */ } }
    const ok = window.arbolMWListo ? await window.arbolMWListo : false;
    if (!ok || !A() || !A().cargado) { el.innerHTML = '<p class="hint">No se pudo cargar el árbol de tu equipo. Revisa tu conexión.</p>'; return; }
    mk = A().mesKey(new Date());
    const refrescar = () => { yo = buscarme(); pintar(); };
    refrescar();
    window.addEventListener('mw:arbol-actualizado', refrescar);
  });
})();
