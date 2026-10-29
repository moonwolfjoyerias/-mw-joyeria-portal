// MW JOYERÍA — Admin → Compras (Aronium)
//
// Flujo: Admin elige la quincena, sube el reporte de Aronium "Ventas por
// formas de pago y cliente" (.xlsx), revisa a qué emprendedora/líder se
// ligó cada cliente de Aronium, corrige o asigna a mano los que falten y
// guarda. Ver js/aronium-xlsx.js (lectura del archivo) y
// js/compras-aronium-firestore-sync.js (dónde se guarda y cómo se usa).
//
// Cómo se liga cada cliente de Aronium con su e/l, en este orden:
//   1. Número de cliente de Aronium ya recordado en su cuenta
//      (persona.aroniumClienteIds — el número entre paréntesis).
//   2. Código de Aronium ya recordado (persona.codigosAronium — "MW25xxx",
//      que NO es su usuario del portal ni su número de tarjeta).
//   3. Nombre completo idéntico (sin acentos ni mayúsculas), si solo hay
//      una persona con ese nombre.
//   4. A mano: Admin la elige de la lista. Al guardar, el número y el
//      código de Aronium quedan recordados en su cuenta para la próxima.
// Los clientes que Admin marca como "No es e/l" (público en general) se
// recuerdan también y ya no se vuelven a preguntar.

let reporteAroniumActual = null; // { clientes, formas, totalReporte, advertencias, archivo }
let filasAronium = [];           // [{ cliente, personaId, via, ignorar }]
let filtroAronium = 'pendientes';

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof personasRepoListo !== 'undefined') await personasRepoListo;
  if (typeof comprasAroniumListo !== 'undefined') await comprasAroniumListo;

  const mes = document.getElementById('aroniumMes');
  if (mes && !mes.value) {
    const hoy = new Date();
    // Por defecto, la quincena que acaba de terminar.
    const enP1 = hoy.getDate() <= 15;
    const ref = enP1 ? new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1) : hoy;
    mes.value = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('aroniumQuincena').value = enP1 ? 'p2' : 'p1';
  }

  document.getElementById('aroniumArchivo')?.addEventListener('change', (e) => leerArchivoAronium(e.target.files?.[0]));
  renderHistorialAronium();
  iniciarHistorialPersonaAronium();
});

function fmtMoneyAronium(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function etiquetaQuincenaAronium(clave) {
  const [anio, mes, sub] = clave.split('-');
  const nombreMes = new Date(Number(anio), Number(mes) - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return `${sub === 'p1' ? '1ª' : '2ª'} quincena de ${nombreMes}`;
}

function mostrarErrorAronium(texto) {
  const el = document.getElementById('aroniumError');
  if (!el) return;
  el.textContent = texto || '';
  el.style.display = texto ? 'block' : 'none';
}

// ============================================================
// LIGAR CLIENTES DE ARONIUM CON PERSONAS
// ============================================================

function personasLigablesAronium() {
  return (typeof obtenerPersonas === 'function' ? obtenerPersonas() : [])
    .filter(p => p.tipo === 'emprendedora' || p.tipo === 'lider');
}

function etiquetaPersonaAronium(p) {
  return `${nombreCompletoPersona(p)}${p.usuario ? ' · ' + p.usuario : ''}`;
}

function ligarClientesAronium(clientes) {
  const personas = personasLigablesAronium();
  const porId = new Map();
  const porCodigo = new Map();
  const porNombre = new Map();
  personas.forEach(p => {
    (p.aroniumClienteIds || []).forEach(id => porId.set(String(id), p.id));
    (p.codigosAronium || []).forEach(c => porCodigo.set(String(c).toUpperCase(), p.id));
    const clave = normalizarNombreAronium(nombreCompletoPersona(p));
    porNombre.set(clave, porNombre.has(clave) ? null : p.id); // null = nombre repetido, no se liga solo
  });

  return clientes.map(cliente => {
    if (cliente.interno) return { cliente, personaId: null, via: 'interno', ignorar: true };
    if (porId.has(cliente.aroniumId)) return { cliente, personaId: porId.get(cliente.aroniumId), via: 'numero' };
    if (cliente.codigoAronium && porCodigo.has(cliente.codigoAronium)) return { cliente, personaId: porCodigo.get(cliente.codigoAronium), via: 'codigo' };
    const porNombreId = porNombre.get(cliente.nombreNormalizado);
    if (porNombreId) return { cliente, personaId: porNombreId, via: 'nombre' };
    if (typeof COMPRAS_ARONIUM_IGNORADOS !== 'undefined' && COMPRAS_ARONIUM_IGNORADOS.has(cliente.aroniumId)) {
      return { cliente, personaId: null, via: 'ignorado', ignorar: true };
    }
    return { cliente, personaId: null, via: 'pendiente' };
  });
}

// ============================================================
// LEER ARCHIVO → VISTA PREVIA
// ============================================================

// El reporte de Aronium no trae fechas, pero el archivo suele llamarse
// con ellas: "16-30-09" (del 16 al 30 de septiembre), "1-15-10",
// "16-31-08-2026"… Si el nombre trae una quincena válida, se elige sola
// (Mes + Quincena) y se avisa, para no guardarla por error en otra.
// Sin año en el nombre, se toma la más reciente que ya empezó.
function detectarQuincenaArchivoAronium(nombreArchivo, hoy = new Date()) {
  const numeros = String(nombreArchivo || '').replace(/\.xlsx$/i, '').match(/\d+/g) || [];
  for (let i = 0; i + 2 < numeros.length; i++) {
    const [desde, hasta, mes] = numeros.slice(i, i + 3).map(Number);
    if (mes < 1 || mes > 12) continue;
    const subPeriodo = desde === 1 && hasta === 15 ? 'p1'
      : (desde === 16 && hasta >= 28 && hasta <= 31 ? 'p2' : null);
    if (!subPeriodo) continue;
    const anioEnNombre = /^\d{4}$/.test(numeros[i + 3] || '') ? Number(numeros[i + 3]) : null;
    let anio = anioEnNombre || hoy.getFullYear();
    if (!anioEnNombre && new Date(anio, mes - 1, desde) > hoy) anio -= 1;
    return { mesKey: `${anio}-${String(mes).padStart(2, '0')}`, subPeriodo };
  }
  return null;
}

function aplicarQuincenaDetectadaAronium(nombreArchivo) {
  const aviso = document.getElementById('aroniumQuincenaDetectada');
  const detectada = detectarQuincenaArchivoAronium(nombreArchivo);
  if (!detectada) { if (aviso) aviso.hidden = true; return; }
  document.getElementById('aroniumMes').value = detectada.mesKey;
  document.getElementById('aroniumQuincena').value = detectada.subPeriodo;
  if (aviso) {
    const { desde, hasta } = rangoFechasQuincenaAronium(detectada.mesKey, detectada.subPeriodo);
    aviso.textContent = `Quincena tomada del nombre del archivo: ${etiquetaQuincenaAronium(claveQuincenaAronium(detectada.mesKey, detectada.subPeriodo))} (${desde} al ${hasta}). Si no es la correcta, cámbiala arriba antes de guardar.`;
    aviso.hidden = false;
  }
}

async function leerArchivoAronium(archivo) {
  mostrarErrorAronium('');
  const vista = document.getElementById('aroniumVistaPrevia');
  if (!archivo) { if (vista) vista.hidden = true; return; }
  if (!/\.xlsx$/i.test(archivo.name)) {
    mostrarErrorAronium('El archivo debe ser el Excel (.xlsx) que exporta Aronium.');
    return;
  }
  aplicarQuincenaDetectadaAronium(archivo.name);
  try {
    reporteAroniumActual = await leerReporteAronium(archivo);
    reporteAroniumActual.archivo = archivo.name;
  } catch (error) {
    console.error('No se pudo leer el reporte de Aronium:', error);
    mostrarErrorAronium(error && error.message ? error.message : 'No se pudo leer el archivo.');
    if (vista) vista.hidden = true;
    return;
  }
  filasAronium = ligarClientesAronium(reporteAroniumActual.clientes);
  filtroAronium = filasAronium.some(f => f.via === 'pendiente') ? 'pendientes' : 'todas';
  renderVistaPreviaAronium();
  if (colaLigarAronium().length) abrirLigarUnoPorUnoAronium();
}

// ============================================================
// LIGAR UNO POR UNO (modal)
// ============================================================
// En vez de buscar fila por fila en la tabla: un modal con un cliente de
// Aronium a la vez — se elige a su e/l (de las que ya están en la
// página/BRILLO) o se descarta si no está, y pasa solo al siguiente.
// Solo entran los clientes sin ligar que SÍ tienen compras que cuentan
// (Efectivo/Terminal/Transferencia), de mayor a menor monto; los que no
// tienen nada que cuente no cambian nada y se quedan en la tabla.

function colaLigarAronium() {
  return filasAronium
    .filter(f => !f.personaId && !f.ignorar && f.via !== 'interno' && f.cliente.cuenta > 0)
    .sort((a, b) => b.cliente.cuenta - a.cliente.cuenta);
}

// Sugerencias por parecido de nombre: cuántas palabras del nombre de
// Aronium (sin acentos, de 3+ letras) tiene el nombre de cada e/l. Pide
// al menos 2 en común (un solo apellido igual no basta), salvo que el
// nombre de Aronium sea de una sola palabra.
function sugerenciasPersonaAronium(cliente, personas, maximo = 3) {
  const palabras = new Set(cliente.nombreNormalizado.split(' ').filter(p => p.length >= 3));
  if (!palabras.size) return [];
  const minimo = Math.min(2, palabras.size);
  return personas
    .map(p => {
      const suyas = normalizarNombreAronium(nombreCompletoPersona(p)).split(' ').filter(x => x.length >= 3);
      const comunes = new Set(suyas.filter(x => palabras.has(x))).size;
      return { p, comunes, parecido: comunes / Math.max(palabras.size, suyas.length, 1) };
    })
    .filter(x => x.comunes >= minimo)
    .sort((a, b) => b.comunes - a.comunes || b.parecido - a.parecido)
    .slice(0, maximo)
    .map(x => x.p);
}

function abrirLigarUnoPorUnoAronium() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const cola = colaLigarAronium();
  const totalInicial = cola.length;
  const personas = personasLigablesAronium().sort((a, b) => nombreCompletoPersona(a).localeCompare(nombreCompletoPersona(b), 'es'));
  const hechos = [];

  const terminar = () => {
    overlay.classList.remove('open');
    renderVistaPreviaAronium();
    const ligados = hechos.filter(h => h === 'ligado').length;
    const descartados = hechos.length - ligados;
    if (hechos.length) mostrarToast(`Listo: ${ligados} ligado${ligados === 1 ? '' : 's'}, ${descartados} descartado${descartados === 1 ? '' : 's'}. Revisa y guarda la quincena.`);
  };

  const mostrar = () => {
    const fila = cola[hechos.length];
    if (!fila) { terminar(); return; }
    const c = fila.cliente;
    const sugeridas = sugerenciasPersonaAronium(c, personas);
    box.style.maxWidth = '520px';
    box.innerHTML = `
      <button class="modal-close" data-close aria-label="Terminar después">&times;</button>
      <p class="aronium-uno-progreso">Cliente ${hechos.length + 1} de ${totalInicial}</p>
      <div class="aronium-uno-barra"><span style="width:${Math.round(hechos.length / totalInicial * 100)}%"></span></div>
      <h3 class="aronium-uno-nombre">${escapeHTML(c.nombre)}</h3>
      <p class="aronium-meta" style="margin-top:0;">Cliente ${escapeHTML(c.aroniumId)} en Aronium${c.codigoAronium ? ' · código ' + escapeHTML(c.codigoAronium) : ''} · cuenta como compra <strong>${fmtMoneyAronium(c.cuenta)}</strong>${c.totalReporte !== c.cuenta ? ` (total ${fmtMoneyAronium(c.totalReporte)})` : ''}</p>

      <label for="aroniumUnoInput">¿Quién es en la página/BRILLO?</label>
      <input id="aroniumUnoInput" class="aronium-persona-input" list="aroniumPersonasListaModal" placeholder="Escribe su nombre o usuario…" autocomplete="off">
      <datalist id="aroniumPersonasListaModal">
        ${personas.map(p => `<option value="${escapeAttribute(etiquetaPersonaAronium(p))}"></option>`).join('')}
      </datalist>
      ${sugeridas.length ? `
        <div class="aronium-uno-sugerencias">
          <span class="aronium-meta">¿Es alguna de estas?</span>
          ${sugeridas.map(p => `<button type="button" class="filtro-chip" data-sugerida-aronium="${escapeAttribute(p.id)}">${escapeHTML(etiquetaPersonaAronium(p))}</button>`).join('')}
        </div>` : ''}
      <div id="aroniumUnoError" class="auth-error" style="display:none;"></div>

      <button type="button" class="btn btn-primary" style="width:100%;margin-top:14px;" id="aroniumUnoLigarBtn">Ligar y seguir</button>
      <button type="button" class="btn btn-outline" style="width:100%;margin-top:8px;" id="aroniumUnoDescartarBtn">No está en la página/BRILLO — descartar</button>
      <div class="aronium-uno-pie">
        <button type="button" class="link-btn" id="aroniumUnoNoEsBtn" title="Público en general: ya no se vuelve a preguntar por este cliente">No es e/l, no volver a preguntar</button>
        <button type="button" class="link-btn" data-close>Terminar después</button>
      </div>
    `;
    overlay.classList.add('open');

    const input = document.getElementById('aroniumUnoInput');
    const error = document.getElementById('aroniumUnoError');
    input.focus();

    const ligar = (persona) => {
      fila.personaId = persona.id; fila.via = 'manual'; fila.ignorar = false;
      hechos.push('ligado');
      renderVistaPreviaAronium();
      mostrar();
    };
    const descartar = (via) => {
      fila.personaId = null; fila.ignorar = true; fila.via = via;
      hechos.push(via);
      renderVistaPreviaAronium();
      mostrar();
    };

    document.getElementById('aroniumUnoLigarBtn').addEventListener('click', () => {
      const valor = input.value.trim();
      const persona = personas.find(p => etiquetaPersonaAronium(p) === valor);
      if (!persona) {
        error.textContent = valor ? 'Elige a la persona de la lista que aparece al escribir.' : 'Escribe y elige a la persona, o descarta este cliente.';
        error.style.display = 'block';
        return;
      }
      ligar(persona);
    });
    box.querySelectorAll('[data-sugerida-aronium]').forEach(b => b.addEventListener('click', () => {
      const persona = personas.find(p => p.id === b.getAttribute('data-sugerida-aronium'));
      if (persona) ligar(persona);
    }));
    document.getElementById('aroniumUnoDescartarBtn').addEventListener('click', () => descartar('descartado'));
    document.getElementById('aroniumUnoNoEsBtn').addEventListener('click', () => descartar('ignorado'));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('aroniumUnoLigarBtn').click(); });
    box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', terminar));
  };

  mostrar();
}

function contarFilasAronium() {
  const ligadas = filasAronium.filter(f => f.personaId);
  return {
    ligadas,
    pendientes: filasAronium.filter(f => !f.personaId && !f.ignorar),
    ignoradas: filasAronium.filter(f => !f.personaId && f.ignorar),
    totalCuentaLigado: ligadas.reduce((s, f) => s + f.cliente.cuenta, 0)
  };
}

function renderVistaPreviaAronium() {
  const vista = document.getElementById('aroniumVistaPrevia');
  if (!vista || !reporteAroniumActual) return;
  vista.hidden = false;

  const { ligadas, pendientes, ignoradas, totalCuentaLigado } = contarFilasAronium();
  const totalCuentaReporte = reporteAroniumActual.clientes.reduce((s, c) => s + c.cuenta, 0);
  const personas = personasLigablesAronium().sort((a, b) => nombreCompletoPersona(a).localeCompare(nombreCompletoPersona(b), 'es'));
  const repetidas = (() => {
    const cuenta = {};
    ligadas.forEach(f => { cuenta[f.personaId] = (cuenta[f.personaId] || 0) + 1; });
    return new Set(Object.keys(cuenta).filter(id => cuenta[id] > 1));
  })();

  const visibles = filasAronium.filter(f =>
    filtroAronium === 'todas' ? true
      : filtroAronium === 'pendientes' ? (!f.personaId && !f.ignorar)
        : filtroAronium === 'ligadas' ? !!f.personaId
          : (!f.personaId && f.ignorar));

  const viaTexto = { numero: 'Por número de Aronium', codigo: 'Por código de Aronium', nombre: 'Por nombre', manual: 'Elegida a mano', interno: 'Cliente interno', ignorado: 'No es e/l', descartado: 'Descartado: no está en la página/BRILLO', pendiente: 'Sin ligar' };
  const porLigarUno = colaLigarAronium().length;

  vista.innerHTML = `
    <h3 class="cfg-card-title">Revisa el archivo: ${escapeHTML(reporteAroniumActual.archivo || '')}</h3>
    <p class="cfg-card-sub">Antes de guardar, revisa a quién se ligó cada cliente de Aronium. Los que queden <strong>sin ligar</strong> no se le cuentan a nadie.</p>

    <div class="aronium-resumen">
      <div><span>Clientes en el reporte</span><strong>${reporteAroniumActual.clientes.length}</strong></div>
      <div><span>Ligados a una e/l</span><strong>${ligadas.length}</strong></div>
      <div><span>Sin ligar</span><strong class="${pendientes.length ? 'aronium-alerta' : ''}">${pendientes.length}</strong></div>
      <div><span>Descartados / no son e/l</span><strong>${ignoradas.length}</strong></div>
      <div><span>Cuenta como compra (ligados)</span><strong>${fmtMoneyAronium(totalCuentaLigado)}</strong></div>
      <div><span>Total del reporte</span><strong>${fmtMoneyAronium(reporteAroniumActual.totalReporte)}</strong></div>
    </div>
    <p class="cfg-card-sub" style="margin-top:6px;">De ${fmtMoneyAronium(reporteAroniumActual.totalReporte)} del reporte, ${fmtMoneyAronium(totalCuentaReporte)} son Efectivo + Terminal + Transferencia (lo que cuenta).</p>
    ${reporteAroniumActual.advertencias.length ? `<div class="modal-note">${reporteAroniumActual.advertencias.map(escapeHTML).join('<br>')}</div>` : ''}

    ${porLigarUno ? `<button type="button" class="btn btn-primary aronium-uno-btn" id="aroniumUnoPorUnoBtn">Ligar uno por uno (${porLigarUno} con compras)</button>` : ''}

    <div class="filtro-chips aronium-filtros">
      ${[['pendientes', `Sin ligar (${pendientes.length})`], ['ligadas', `Ligados (${ligadas.length})`], ['ignoradas', `Descartados / no son e/l (${ignoradas.length})`], ['todas', `Todos (${filasAronium.length})`]]
        .map(([v, t]) => `<button type="button" class="filtro-chip ${filtroAronium === v ? 'active' : ''}" data-filtro-aronium="${v}">${t}</button>`).join('')}
    </div>

    <datalist id="aroniumPersonasLista">
      ${personas.map(p => `<option value="${escapeAttribute(etiquetaPersonaAronium(p))}"></option>`).join('')}
    </datalist>

    <div class="catalog-table-wrap">
      <table class="catalog-table aronium-tabla">
        <thead>
          <tr>
            <th>Cliente en Aronium</th>
            <th>Emprendedora / Líder</th>
            <th>Cuenta como compra</th>
            <th>No cuenta</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${visibles.length ? visibles.map(f => {
            const i = filasAronium.indexOf(f);
            const c = f.cliente;
            const persona = f.personaId ? personas.find(p => p.id === f.personaId) : null;
            const noCuenta = Math.round((c.totalReporte - c.cuenta) * 100) / 100;
            return `
              <tr>
                <td>
                  <strong>${escapeHTML(c.nombre)}</strong>
                  <div class="aronium-meta">Cliente ${escapeHTML(c.aroniumId)}${c.codigoAronium ? ' · ' + escapeHTML(c.codigoAronium) : ''}</div>
                </td>
                <td>
                  ${f.via === 'interno' ? '<span class="aronium-meta">Cliente interno de la tienda (no cuenta)</span>' : `
                    <input class="aronium-persona-input" list="aroniumPersonasLista" data-fila-aronium="${i}" placeholder="Busca a la e/l…" value="${persona ? escapeAttribute(etiquetaPersonaAronium(persona)) : ''}">
                    <div class="aronium-meta">
                      <span class="aronium-via aronium-via-${f.via}">${viaTexto[f.via] || ''}</span>
                      ${repetidas.has(f.personaId) ? ' · <span class="aronium-alerta">esta e/l tiene otro cliente ligado (se suman)</span>' : ''}
                      ${f.personaId ? ` · <button type="button" class="link-btn" data-quitar-aronium="${i}">quitar</button>` : ''}
                      ${!f.personaId ? (f.ignorar
                        ? ` · <button type="button" class="link-btn" data-ignorar-aronium="${i}" data-valor="0">sí es e/l</button>`
                        : ` · <button type="button" class="link-btn" data-ignorar-aronium="${i}" data-valor="1">no es e/l</button>`) : ''}
                    </div>`}
                </td>
                <td>${fmtMoneyAronium(c.cuenta)}</td>
                <td title="${escapeAttribute(Object.entries(c.pagos).filter(([k]) => !FORMAS_PAGO_QUE_CUENTAN.includes(k)).map(([k, v]) => `${ETIQUETAS_FORMAS_PAGO[k] || k}: ${fmtMoneyAronium(v)}`).join(' · '))}">${fmtMoneyAronium(noCuenta)}</td>
                <td>${fmtMoneyAronium(c.totalReporte)}</td>
              </tr>`;
          }).join('') : '<tr><td colspan="5" class="aronium-meta">No hay clientes en este filtro.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="aronium-acciones">
      <button type="button" class="btn btn-outline" id="aroniumCancelarBtn">Cancelar</button>
      <button type="button" class="btn btn-primary" id="aroniumGuardarBtn">Guardar quincena</button>
    </div>
  `;

  document.getElementById('aroniumUnoPorUnoBtn')?.addEventListener('click', abrirLigarUnoPorUnoAronium);
  vista.querySelectorAll('[data-filtro-aronium]').forEach(b => b.addEventListener('click', () => { filtroAronium = b.getAttribute('data-filtro-aronium'); renderVistaPreviaAronium(); }));

  vista.querySelectorAll('.aronium-persona-input').forEach(input => {
    input.addEventListener('change', () => {
      const fila = filasAronium[Number(input.getAttribute('data-fila-aronium'))];
      const valor = input.value.trim();
      const persona = personas.find(p => etiquetaPersonaAronium(p) === valor);
      if (!valor) { fila.personaId = null; fila.via = 'pendiente'; fila.ignorar = false; }
      else if (persona) { fila.personaId = persona.id; fila.via = 'manual'; fila.ignorar = false; }
      else { input.setCustomValidity('Elige una persona de la lista.'); input.reportValidity(); return; }
      renderVistaPreviaAronium();
    });
  });
  vista.querySelectorAll('[data-quitar-aronium]').forEach(b => b.addEventListener('click', () => {
    const fila = filasAronium[Number(b.getAttribute('data-quitar-aronium'))];
    fila.personaId = null; fila.via = 'pendiente'; fila.ignorar = false;
    renderVistaPreviaAronium();
  }));
  vista.querySelectorAll('[data-ignorar-aronium]').forEach(b => b.addEventListener('click', () => {
    const fila = filasAronium[Number(b.getAttribute('data-ignorar-aronium'))];
    fila.ignorar = b.getAttribute('data-valor') === '1';
    fila.via = fila.ignorar ? 'ignorado' : 'pendiente';
    renderVistaPreviaAronium();
  }));

  document.getElementById('aroniumCancelarBtn')?.addEventListener('click', () => {
    reporteAroniumActual = null; filasAronium = [];
    vista.hidden = true;
    const input = document.getElementById('aroniumArchivo');
    if (input) input.value = '';
  });
  document.getElementById('aroniumGuardarBtn')?.addEventListener('click', confirmarGuardarAronium);
}

// ============================================================
// GUARDAR
// ============================================================

function confirmarGuardarAronium() {
  const mesKey = document.getElementById('aroniumMes')?.value;
  const subPeriodo = document.getElementById('aroniumQuincena')?.value;
  if (!/^\d{4}-\d{2}$/.test(mesKey || '')) { mostrarErrorAronium('Elige el mes de la quincena.'); return; }
  const clave = claveQuincenaAronium(mesKey, subPeriodo);
  const { ligadas, pendientes } = contarFilasAronium();
  if (!ligadas.length) { mostrarErrorAronium('Ningún cliente quedó ligado a una emprendedora/líder.'); return; }

  const reemplaza = COMPRAS_ARONIUM_IMPORTADAS.has(clave);
  const { desde, hasta } = rangoFechasQuincenaAronium(mesKey, subPeriodo);
  abrirAutorizacionAdmin({
    titulo: reemplaza ? 'Reemplazar quincena' : 'Guardar quincena',
    peligrosa: reemplaza,
    mensaje: `${etiquetaQuincenaAronium(clave)} (${desde} al ${hasta}): ${ligadas.length} e/l, ${fmtMoneyAronium(contarFilasAronium().totalCuentaLigado)} que cuentan como compra.`
      + (pendientes.length ? ` <strong>${pendientes.length} cliente(s) quedan sin ligar y no se le contarán a nadie.</strong>` : '')
      + (reemplaza ? ' <strong>Esta quincena ya tenía un archivo: se reemplaza por completo.</strong>' : ''),
    onConfirmar: () => guardarAronium(mesKey, subPeriodo)
  });
}

async function guardarAronium(mesKey, subPeriodo) {
  const boton = document.getElementById('aroniumGuardarBtn');
  if (boton) { boton.disabled = true; boton.textContent = 'Guardando…'; }
  const clave = claveQuincenaAronium(mesKey, subPeriodo);
  const { ligadas, pendientes, ignoradas, totalCuentaLigado } = contarFilasAronium();
  try {
    await guardarImportacionAronium({
      mesKey, subPeriodo,
      ligadas: ligadas.map(f => ({ personaId: f.personaId, cliente: f.cliente })),
      resumen: {
        clientesReporte: filasAronium.length,
        ligados: ligadas.length,
        sinLigar: pendientes.length,
        noSonEL: ignoradas.length,
        totalReporte: reporteAroniumActual.totalReporte,
        totalCuentaLigado: Math.round(totalCuentaLigado * 100) / 100
      },
      archivo: reporteAroniumActual.archivo,
      importadoPor: (typeof ADMIN_IDENTIDAD !== 'undefined' && ADMIN_IDENTIDAD.usuarioNombre) || ''
    });

    // Recordar en cada cuenta su número/código de Aronium (para ligarla
    // sola la próxima vez) y los clientes que no son e/l.
    const personas = obtenerPersonas();
    let cambiaron = false;
    ligadas.forEach(f => {
      const p = personas.find(x => x.id === f.personaId);
      if (!p) return;
      const ids = new Set((p.aroniumClienteIds || []).map(String));
      const codigos = new Set((p.codigosAronium || []).map(String));
      const antes = ids.size + codigos.size;
      ids.add(f.cliente.aroniumId);
      if (f.cliente.codigoAronium) codigos.add(f.cliente.codigoAronium);
      if (ids.size + codigos.size !== antes) {
        p.aroniumClienteIds = [...ids];
        p.codigosAronium = [...codigos];
        cambiaron = true;
      }
    });
    if (cambiaron) await guardarPersonas(personas);
    await guardarIgnoradosAronium(
      filasAronium.filter(f => f.via === 'ignorado').map(f => f.cliente.aroniumId),
      filasAronium.filter(f => f.personaId && COMPRAS_ARONIUM_IGNORADOS.has(f.cliente.aroniumId)).map(f => f.cliente.aroniumId)
    );

    if (typeof registrarAuditoriaAdmin === 'function') {
      registrarAuditoriaAdmin({ modulo: 'compras', accion: 'importar_aronium', descripcion: `Cargó compras de Aronium de la ${etiquetaQuincenaAronium(clave)}: ${ligadas.length} e/l, ${fmtMoneyAronium(totalCuentaLigado)} que cuentan (archivo ${reporteAroniumActual.archivo}).` });
    }
    mostrarToast(`Quincena guardada: ${ligadas.length} emprendedoras/líderes.`);
    reporteAroniumActual = null; filasAronium = [];
    const vista = document.getElementById('aroniumVistaPrevia');
    if (vista) vista.hidden = true;
    const input = document.getElementById('aroniumArchivo');
    if (input) input.value = '';
    renderHistorialAronium();
  } catch (error) {
    console.error('No se pudo guardar la quincena de Aronium:', error);
    mostrarErrorAronium('No se pudo guardar: ' + (error && error.message ? error.message : 'error desconocido') + '. Inténtalo de nuevo.');
    if (boton) { boton.disabled = false; boton.textContent = 'Guardar quincena'; }
  }
}

// ============================================================
// HISTORIAL
// ============================================================

function renderHistorialAronium() {
  const wrap = document.getElementById('aroniumHistorial');
  if (!wrap) return;
  const claves = quincenasAroniumImportadas().reverse();
  if (!claves.length) {
    wrap.innerHTML = '<p class="cfg-card-sub" style="margin:0;">Todavía no se ha cargado ninguna quincena.</p>';
    return;
  }
  wrap.innerHTML = `
    <div class="catalog-table-wrap">
      <table class="catalog-table">
        <thead><tr><th>Quincena</th><th>E/L ligadas</th><th>Cuenta como compra</th><th>Sin ligar</th><th>Archivo</th><th>Cargado</th><th></th></tr></thead>
        <tbody>
          ${claves.map(clave => {
            const q = COMPRAS_ARONIUM_QUINCENAS[clave] || {};
            const r = q.resumen || {};
            const fecha = q.importadoEn ? new Date(q.importadoEn).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '';
            return `
              <tr>
                <td><strong>${etiquetaQuincenaAronium(clave)}</strong><div class="aronium-meta">${q.desde || ''} al ${q.hasta || ''}</div></td>
                <td>${r.ligados ?? Object.keys(q.montos || {}).length}</td>
                <td>${fmtMoneyAronium(r.totalCuentaLigado)}</td>
                <td>${r.sinLigar ?? '—'}</td>
                <td>${escapeHTML(q.archivo || '')}</td>
                <td>${escapeHTML(q.importadoPor || '')}<div class="aronium-meta">${fecha}</div></td>
                <td><button type="button" class="btn btn-outline btn-sm" data-eliminar-aronium="${clave}">Eliminar</button></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  wrap.querySelectorAll('[data-eliminar-aronium]').forEach(b => b.addEventListener('click', () => {
    const clave = b.getAttribute('data-eliminar-aronium');
    abrirAutorizacionAdmin({
      titulo: 'Eliminar quincena',
      peligrosa: true,
      mensaje: `Se borrarán las compras de Aronium de la ${etiquetaQuincenaAronium(clave)}. En esa quincena se volverán a usar los apartados liquidados para rango, comisiones, rifa y constancia.`,
      onConfirmar: async () => {
        try {
          await eliminarImportacionAronium(clave);
          if (typeof registrarAuditoriaAdmin === 'function') {
            registrarAuditoriaAdmin({ modulo: 'compras', accion: 'eliminar_aronium', descripcion: `Eliminó las compras de Aronium de la ${etiquetaQuincenaAronium(clave)}.` });
          }
          mostrarToast('Quincena eliminada.');
        } catch (error) {
          console.error('No se pudo eliminar la quincena:', error);
          mostrarToast('No se pudo eliminar la quincena. Inténtalo de nuevo.');
        }
        renderHistorialAronium();
      }
    });
  }));
}

// ============================================================
// HISTORIAL DE UNA PERSONA — ver y limpiar
// ============================================================

let personaHistorialAroniumId = null;

function iniciarHistorialPersonaAronium() {
  const input = document.getElementById('aroniumBuscarPersona');
  const lista = document.getElementById('aroniumBuscarPersonaLista');
  if (!input || !lista) return;
  const personas = personasLigablesAronium().sort((a, b) => nombreCompletoPersona(a).localeCompare(nombreCompletoPersona(b), 'es'));
  lista.innerHTML = personas.map(p => `<option value="${escapeAttribute(etiquetaPersonaAronium(p))}"></option>`).join('');
  input.addEventListener('change', () => {
    const persona = personas.find(p => etiquetaPersonaAronium(p) === input.value.trim());
    const id = persona ? persona.id : null;
    // Al salir del buscador (ej. clic en "Limpiar historial") el navegador
    // vuelve a disparar "change": si la persona no cambió, no se vuelve a
    // pintar — si no, el botón se reemplazaba y el clic se perdía.
    if (id === personaHistorialAroniumId) return;
    personaHistorialAroniumId = id;
    renderHistorialPersonaAronium();
  });
}

function renderHistorialPersonaAronium() {
  const wrap = document.getElementById('aroniumHistorialPersona');
  if (!wrap) return;
  const persona = personaHistorialAroniumId ? obtenerPersonaPorId(personaHistorialAroniumId) : null;
  if (!persona) { wrap.innerHTML = ''; return; }

  const claves = quincenasAroniumImportadas().reverse()
    .filter(clave => (COMPRAS_ARONIUM_QUINCENAS[clave]?.montos || {})[persona.id] !== undefined);
  const total = claves.reduce((s, clave) => s + Number(COMPRAS_ARONIUM_QUINCENAS[clave].montos[persona.id] || 0), 0);
  const ligas = [...(persona.aroniumClienteIds || []).map(id => `cliente ${id}`), ...(persona.codigosAronium || [])];

  wrap.innerHTML = `
    <p class="aronium-meta" style="margin:0 0 8px;">${ligas.length ? `Se liga en Aronium como: ${escapeHTML(ligas.join(' · '))}` : 'Todavía no está ligada a ningún cliente de Aronium.'}</p>
    ${claves.length ? `
      <div class="catalog-table-wrap">
        <table class="catalog-table">
          <thead><tr><th>Quincena</th><th style="text-align:right;">Cuenta como compra</th></tr></thead>
          <tbody>
            ${claves.map(clave => `<tr><td>${etiquetaQuincenaAronium(clave)}</td><td style="text-align:right;">${fmtMoneyAronium(COMPRAS_ARONIUM_QUINCENAS[clave].montos[persona.id])}</td></tr>`).join('')}
            <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>${fmtMoneyAronium(total)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div class="aronium-acciones">
        <button type="button" class="btn btn-danger" id="aroniumLimpiarPersonaBtn">Limpiar historial de compras</button>
      </div>` : '<p class="cfg-card-sub" style="margin:0;">No tiene compras de Aronium registradas.</p>'}
  `;
  document.getElementById('aroniumLimpiarPersonaBtn')?.addEventListener('click', () => confirmarLimpiarHistorialPersonaAronium(persona, claves, total));
}

function confirmarLimpiarHistorialPersonaAronium(persona, claves, total) {
  const nombre = nombreCompletoPersona(persona);
  const tieneLiga = (persona.aroniumClienteIds || []).length || (persona.codigosAronium || []).length;
  abrirAutorizacionAdmin({
    titulo: 'Limpiar historial de compras',
    peligrosa: true,
    mensaje: `Se borrarán las compras de Aronium de <strong>${escapeHTML(nombre)}</strong> en ${claves.length} quincena${claves.length === 1 ? '' : 's'} (${fmtMoneyAronium(total)}). Dejarán de contar para su rango, comisiones, rifa y constancia, y ya no las verá en Mis compras. No se puede deshacer, salvo volviendo a subir esas quincenas.`
      + (tieneLiga ? `<label class="aronium-olvidar"><input type="checkbox" id="aroniumOlvidarLiga"> También olvidar con qué cliente de Aronium se liga (si las compras eran de otra persona; la próxima vez habrá que ligarla a mano).</label>` : ''),
    onConfirmar: () => limpiarHistorialPersonaAronium(persona, document.getElementById('aroniumOlvidarLiga')?.checked)
  });
}

async function limpiarHistorialPersonaAronium(persona, olvidarLiga) {
  const nombre = nombreCompletoPersona(persona);
  try {
    const claves = await limpiarHistorialComprasAroniumPersona(persona.id);
    if (olvidarLiga) {
      const personas = obtenerPersonas();
      const p = personas.find(x => x.id === persona.id);
      if (p) { p.aroniumClienteIds = []; p.codigosAronium = []; guardarPersonas(personas); }
    }
    if (typeof registrarAuditoriaAdmin === 'function') {
      registrarAuditoriaAdmin({
        modulo: 'compras',
        accion: 'limpiar_historial_compras',
        descripcion: `Limpió el historial de compras de Aronium de ${nombre} (${claves.length} quincena${claves.length === 1 ? '' : 's'}${claves.length ? ': ' + claves.map(etiquetaQuincenaAronium).join(', ') : ''})${olvidarLiga ? ' y olvidó su liga con Aronium' : ''}.`
      });
    }
    mostrarToast(`Historial de compras de ${nombre} limpiado.`);
  } catch (error) {
    console.error('No se pudo limpiar el historial de compras:', error);
    mostrarToast('No se pudo limpiar el historial. Inténtalo de nuevo.');
  }
  renderHistorialPersonaAronium();
  renderHistorialAronium();
}
