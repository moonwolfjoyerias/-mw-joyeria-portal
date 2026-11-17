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
  const FIREBASE_MI_EQUIPO = {
    apiKey: 'AIzaSyCl_am3ptjgU6j8ykRrCItBIJK8qCLNi6c',
    authDomain: 'gala-mw-2026-f82f1.firebaseapp.com',
    projectId: 'gala-mw-2026-f82f1',
    storageBucket: 'gala-mw-2026-f82f1.firebasestorage.app',
    messagingSenderId: '560061816519',
    appId: '1:560061816519:web:c423c0de2cb1e8f0f168e2'
  };

  const TASAS = {
    1: { sinRango: 10, plata: 10, oro: 10, diamante: 10, corona: 10 },
    2: { sinRango: 5, plata: 10, oro: 10, diamante: 10, corona: 10 },
    3: { sinRango: 0, plata: 0, oro: 5, diamante: 5, corona: 5 },
    4: { sinRango: 0, plata: 0, oro: 0, diamante: 2, corona: 3 },
    5: { sinRango: 0, plata: 0, oro: 0, diamante: 0, corona: 1 }
  };
  const RANGOS = [
    { key: 'corona', label: 'Corona', activas: 30, produccion: 180000, compraLider: 3000, calificadas: 15 },
    { key: 'diamante', label: 'Diamante', activas: 15, produccion: 75000, compraLider: 3000, calificadas: 9 },
    { key: 'oro', label: 'Oro', activas: 10, produccion: 52500, compraLider: 1500, calificadas: 6 },
    { key: 'plata', label: 'Plata', activas: 5, produccion: 22500, compraLider: 1500, calificadas: 3 }
  ];
  const SIN_RANGO = { key: 'sinRango', label: 'Sin rango' };
  const POR_KEY = { sinRango: SIN_RANGO, plata: RANGOS[3], oro: RANGOS[2], diamante: RANGOS[1], corona: RANGOS[0] };
  const ORDEN = { sinRango: 0, plata: 1, oro: 2, diamante: 3, corona: 4 };
  const TOPE_LINEA = 0.5, MIN_ACTIVA = 500, MIN_CALIFICADA = 1500, IVA = 0.16;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  let miembros = [];
  let yo = null;
  let mk = null;
  let zoom = 1;
  let coincidencias = [];
  let iCoincidencia = 0;

  // ---------- utilidades ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const mesKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const etiquetaMes = k => { const [y, m] = k.split('-').map(Number); const n = MESES[m - 1]; return n ? `${n[0].toUpperCase()}${n.slice(1)} ${y}` : k; };
  const mesAnterior = k => { const [y, m] = k.split('-').map(Number); return mesKey(new Date(y, m - 2, 1)); };
  const mesSiguiente = k => { const [y, m] = k.split('-').map(Number); return mesKey(new Date(y, m, 1)); };
  const pts = n => Math.round(n).toLocaleString('es-MX');
  const mxn = n => '$' + (Math.round(n * 100) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const piso = n => { if (n === null || n === undefined || n === '') return null; const x = Number(n); return Number.isNaN(x) ? null : Math.floor(x); };
  const normalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  function puntosDelMes(m, k) {
    if (!m) return null;
    if (m.pointsHistory && m.pointsHistory[k]) return m.pointsHistory[k];
    if (m.pointsMonthKey && m.pointsMonthKey === k) return { p1: piso(m.pointsP1), p2: piso(m.pointsP2) };
    return null;
  }
  function puntos(m, k) {
    const p = puntosDelMes(m, k);
    return { p1: p && p.p1 != null ? p.p1 : 0, p2: p && p.p2 != null ? p.p2 : 0 };
  }
  function hijosDe() {
    const h = new Map();
    miembros.forEach(m => { if (m.leaderId) { if (!h.has(m.leaderId)) h.set(m.leaderId, []); h.get(m.leaderId).push(m); } });
    return h;
  }
  function conLinea(raiz) {
    const h = hijosDe();
    const prof = new Map([[raiz, 0]]);
    const cola = [raiz];
    while (cola.length) {
      const id = cola.shift();
      (h.get(id) || []).forEach(x => { if (!prof.has(x.id)) { prof.set(x.id, prof.get(id) + 1); cola.push(x.id); } });
    }
    return prof;
  }

  // ---------- rango y comisiones (igual que mi-equipo) ----------
  function rangoDelMes(liderId, k) {
    const lider = miembros.find(m => m.id === liderId);
    const h = hijosDe();
    const vistos = new Set([liderId]);
    let activas = 0, calificadas = 0, calificadasP1 = 0, calificadasP2 = 0;
    const lines = (h.get(liderId) || []).map(directa => {
      let p1 = 0, p2 = 0, personas = 0;
      const propia = puntos(directa, k);
      const pila = [directa];
      while (pila.length) {
        const m = pila.pop();
        if (vistos.has(m.id)) continue;
        vistos.add(m.id);
        personas++;
        const p = puntos(m, k);
        p1 += p.p1; p2 += p.p2;
        if (p.p1 >= MIN_ACTIVA && p.p2 >= MIN_ACTIVA) activas++;
        if (p.p1 >= MIN_CALIFICADA) calificadasP1++;
        if (p.p2 >= MIN_CALIFICADA) calificadasP2++;
        if (p.p1 >= MIN_CALIFICADA && p.p2 >= MIN_CALIFICADA) calificadas++;
        (h.get(m.id) || []).forEach(c => pila.push(c));
      }
      const p1SinLider = p1 - propia.p1, p2SinLider = p2 - propia.p2;
      return { id: directa.id, nombre: directa.fullName, personas, p1, p2, total: p1 + p2, totalSinLider: p1SinLider + p2SinLider, p1SinLider };
    }).sort((a, b) => b.total - a.total);
    const propia = puntos(lider, k);
    const produccionP1 = lines.reduce((s, l) => s + l.p1, 0);
    const produccionP2 = lines.reduce((s, l) => s + l.p2, 0);
    const validaP1 = lines.reduce((s, l, i) => (i !== 0 ? s + l.p1 : s + (l.p1 - l.p1SinLider) + l.p1SinLider * TOPE_LINEA), 0);
    const validaMes = lines.reduce((s, l, i) => (i !== 0 ? s + l.total : s + (l.total - l.totalSinLider) + l.totalSinLider * TOPE_LINEA), 0);
    const evaluaciones = RANGOS.map(r => {
      const consolidaEn = validaP1 >= r.produccion ? 1 : (validaMes >= r.produccion ? 2 : null);
      const soloUnPeriodo = r.key === 'diamante' || r.key === 'corona';
      const valorCompra = soloUnPeriodo ? Math.max(propia.p1, propia.p2) : Math.min(propia.p1, propia.p2);
      const e = { rango: r, validaMes, consolidaEn, soloUnPeriodo, valorCompra, okProduccion: consolidaEn !== null, okActivas: activas >= r.activas, okCalificadas: calificadas >= r.calificadas, okCompra: valorCompra >= r.compraLider };
      e.califica = e.okProduccion && e.okActivas && e.okCalificadas && e.okCompra;
      return e;
    });
    const ganadora = evaluaciones.find(e => e.califica) || null;
    return { lines, activas, calificadas, calificadasP1, calificadasP2, compraP1: propia.p1, compraP2: propia.p2, produccionP1, produccionP2, produccion: produccionP1 + produccionP2, validaMes, lineaMasFuerte: lines[0] || null, evaluaciones, consolidaEn: ganadora ? ganadora.consolidaEn : null, rango: ganadora ? ganadora.rango : SIN_RANGO };
  }
  const rangoManual = (m, k) => (m && m.manualRank && POR_KEY[m.manualRank[k]] ? m.manualRank[k] : null);
  function rangoHistorico(id, hasta) {
    const lider = miembros.find(m => m.id === id);
    if (!lider) return SIN_RANGO;
    const meses = new Set(mesesConPuntos());
    if (lider.manualRank) Object.keys(lider.manualRank).forEach(k => meses.add(k));
    let mejor = SIN_RANGO;
    meses.forEach(k => {
      if (k > hasta) return;
      const man = rangoManual(lider, k);
      if (man && ORDEN[man] > ORDEN[mejor.key]) mejor = POR_KEY[man];
      const calc = rangoDelMes(id, k).rango;
      if (ORDEN[calc.key] > ORDEN[mejor.key]) mejor = calc;
    });
    return mejor;
  }
  function comisionesDelMes(id, k) {
    const lider = miembros.find(m => m.id === id);
    let info = rangoDelMes(id, mesAnterior(k));
    const man = rangoManual(lider, k);
    if (man) info = Object.assign({}, info, { rango: POR_KEY[man] });
    const propia = puntos(lider, k);
    const prof = conLinea(id);
    const equipo = miembros.filter(m => prof.has(m.id) && m.id !== id).map(m => Object.assign({ linea: prof.get(m.id) }, puntos(m, k)));
    const periodo = (campo, compra) => {
      const min = (info.rango.key === 'diamante' || info.rango.key === 'corona') ? 3000 : MIN_CALIFICADA;
      if (compra < min) return 0;
      return equipo.reduce((s, t) => s + (t[campo] * (t.linea <= 5 ? (TASAS[t.linea][info.rango.key] || 0) : 0) / 100) / (1 + IVA), 0);
    };
    return { info, esManual: !!man, total: periodo('p1', propia.p1) + periodo('p2', propia.p2) };
  }
  const tasasTexto = k => { const t = [1, 2, 3, 4, 5].map(l => TASAS[l][k]).filter(r => r > 0); return t.length ? t.map(r => r + '%').join(' – ') : 'Ninguno'; };
  function mesesConPuntos() {
    const s = new Set([mesKey(new Date())]);
    miembros.forEach(m => { if (m.pointsHistory) Object.keys(m.pointsHistory).forEach(k => s.add(k)); if (m.pointsMonthKey) s.add(m.pointsMonthKey); });
    return Array.from(s).sort().reverse();
  }

  // ---------- encontrar a la persona ----------
  // Primero el vínculo que pone Administración en BRILLO (Árbol → Vincular
  // con la página); luego la membresía igual al usuario, y al final el nombre.
  function buscarme() {
    const id = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
    const p = id && typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(id) : null;
    if (!p) return null;
    const vinculada = miembros.find(m => m.portalPersonaId === p.id);
    if (vinculada) return vinculada;
    const libres = miembros.filter(m => !m.portalPersonaId);
    const u = String(p.usuario || '').trim().toUpperCase();
    if (u) {
      const porCodigo = libres.filter(m => String(m.clientCode || '').trim().toUpperCase() === u);
      if (porCodigo.length === 1) return porCodigo[0];
    }
    const n = normalizar(typeof nombreCompletoPersona === 'function' ? nombreCompletoPersona(p) : p.nombre);
    const porNombre = n ? libres.filter(m => normalizar(m.fullName) === n) : [];
    return porNombre.length === 1 ? porNombre[0] : null;
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
    el.innerHTML = `
      <div class="org-tree-card-header">
        <h3>Árbol de tu equipo</h3>
        <label class="arbol-me-mes">Mes <select id="arbolMeMes">${meses.map(k => `<option value="${k}" ${k === mk ? 'selected' : ''}>${etiquetaMes(k)}</option>`).join('')}</select></label>
      </div>
      <div class="arbol-me-cifras">
        <div><span>Periodo 1</span><b>${pts(p.p1)}</b></div>
        <div><span>Periodo 2</span><b>${pts(p.p2)}</b></div>
        <div><span>Total del mes</span><b>${pts(total)}</b></div>
        ${equipo ? `<div><span>Personas en tu equipo</span><b>${equipo}</b></div><div><span>Rango del mes</span><b>${esc(r.rango.label)}</b></div>` : ''}
      </div>
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
    miembros.forEach(m => { const d = prof.get(m.id); if (!d) return; if (!niveles.has(d)) niveles.set(d, []); niveles.get(d).push(m); });
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
    const hist = rangoHistorico(yo.id, mk);
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
      return `<tr><td>${esc(l.nombre)}${i === 0 ? ' <small>(más fuerte)</small>' : ''}</td><td>${l.personas}</td><td>${pts(l.p1)}</td><td>${pts(l.p2)}</td><td><b>${pts(l.total)}</b></td><td>${pts(i === 0 ? propia + l.totalSinLider * TOPE_LINEA : l.total)}</td></tr>`;
    }).join('');
    modal(`<h3>Mi auditoría de rango</h3><p class="modal-sub">${esc(yo.fullName)} — ${etiquetaMes(mk)}</p>
      <div class="arbol-me-cifras">
        ${dato('Rango histórico', hist.label)}
        ${dato('Rango recalificado este mes', info.rango.label + (info.consolidaEn ? ` (consolida en P${info.consolidaEn})` : ''))}
        ${dato('Producción mensual', pts(info.produccion) + ' pts')}
        ${dato(`Activas (≥${MIN_ACTIVA} en P1 y P2)`, info.activas)}
        ${dato(`Calificadas (≥${MIN_CALIFICADA} en P1 y P2)`, info.calificadas)}
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
    const filas = miembros.filter(m => prof.has(m.id) && m.id !== yo.id)
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
    if (!el || typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return;
    el.innerHTML = '<p class="hint">Cargando el árbol de tu equipo…</p>';
    if (typeof personasRepoListo !== 'undefined') { try { await personasRepoListo; } catch (e) { /* sigue */ } }
    let db;
    try {
      const app = firebase.apps.find(a => a.name === 'mi-equipo') || firebase.initializeApp(FIREBASE_MI_EQUIPO, 'mi-equipo');
      db = app.firestore();
    } catch (e) {
      el.innerHTML = '<p class="hint">No se pudo cargar el árbol de tu equipo.</p>';
      return;
    }
    mk = mesKey(new Date());
    db.collection('arbolEquipo').doc('team-tree-v2').onSnapshot(s => {
      try { miembros = s.exists ? JSON.parse(s.data().value || '[]') : []; } catch (e) { miembros = []; }
      if (!Array.isArray(miembros)) miembros = [];
      miembros = miembros.filter(m => m && typeof m.id === 'string').map(m => Object.assign({}, m, { fullName: String(m.fullName || '') }));
      yo = buscarme();
      pintar();
    }, () => { el.innerHTML = '<p class="hint">No se pudo cargar el árbol de tu equipo. Revisa tu conexión.</p>'; });
  });
})();
