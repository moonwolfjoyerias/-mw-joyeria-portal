// MW JOYERÍA — Mi cuenta (Líder)
// Depende de: PERFIL_LIDER_EJEMPLO, RIFA_LIDER_EJEMPLO, CONSTANCIA_LIDER_EJEMPLO,
// COMISIONES_PCT (lider-cuenta-ejemplo.js) + RANGOS_MW, LIDER_EJEMPLO (lider-ejemplo.js)
// + EQUIPO_ARBOL_EJEMPLO (equipo-ejemplo.js).

document.addEventListener('DOMContentLoaded', () => {
  renderPerfilLider();
  renderRifaLider();
  renderConstanciaLider();
  renderProgresoRangoCuenta();
  renderTicketComisiones();
  renderProximoPago();

  document.getElementById('editarDatosBancariosBtn')?.addEventListener('click', abrirModalDatosBancarios);

  document.getElementById('perfilFotoInput')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      e.target.value = '';
      mostrarToast('Selecciona un archivo de imagen válido.');
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      e.target.value = '';
      mostrarToast('La imagen no puede superar 2 MB.');
      return;
    }

    const idActual = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
    if (!idActual) { mostrarToast('No se pudo identificar tu cuenta — vuelve a iniciar sesión.'); return; }

    const lector = new FileReader();
    lector.onload = () => {
      actualizarFotoPersona(idActual, lector.result);
      mostrarToast('Foto de perfil actualizada.');
      renderPerfilLider();
    };
    lector.readAsDataURL(archivo);
  });
});

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function fmtMoney(n) {
  return `$${Math.round(n).toLocaleString('es-MX')}`;
}
// Producción grupal (requisito de rango) se mide en "puntos", no en
// pesos (Plan MW, Sección 1) — aunque hoy 1 punto = 1 peso de compra,
// nunca se le pone signo de $.
function fmtPuntos(n) {
  return `${Math.round(n).toLocaleString('es-MX')} puntos`;
}
// Misma regla que js/plan-mw-admin.js → cumpleCompraPersonalRango: Plata
// y Oro exigen $1,500 en AMBOS periodos; Diamante y Corona, $3,000 pero
// solo en el periodo de consolidación (el mayor de los dos). Copiada
// aquí (no importada) porque esta página todavía usa datos de ejemplo
// desconectados del motor real de Plan MW — ver nota de arquitectura.
function cumpleCompraPersonalRangoCuenta(rangoKey, p1, p2, montoRequerido) {
  const soloUnPeriodo = rangoKey === 'diamante' || rangoKey === 'corona';
  const valorComparado = soloUnPeriodo ? Math.max(p1, p2) : Math.min(p1, p2);
  return { cumple: valorComparado >= montoRequerido, soloUnPeriodo };
}
function idxRango(key) {
  return RANGOS_MW.findIndex(r => r.key === key);
}
// Admin → Configuración → Comisiones es dueño de este valor (fórmula:
// comisión = (compra ÷ divisor) × %). Antes este archivo repetía el
// 1.16 aparte del de comisiones-modelo.js — ahora ambos leen del mismo
// lugar cuando está disponible, para que nunca queden desincronizados.
function obtenerIvaDivisorLider() {
  return (typeof obtenerValorVigente === 'function' && obtenerValorVigente('formula', 'iva_divisor')) || 1.16;
}

// ---------- Perfil ----------
function renderPerfilLider() {
  const iniciales = typeof obtenerInicialesPerfil === 'function' ? obtenerInicialesPerfil(PERFIL_LIDER_EJEMPLO.nombre) : 'L';

  const idActual = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
  const persona = idActual && typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(idActual) : null;
  const fotoBox = document.getElementById('perfilIniciales');
  if (fotoBox) {
    fotoBox.innerHTML = persona?.fotoUrl
      ? `<img src="${persona.fotoUrl}" alt="Foto de ${PERFIL_LIDER_EJEMPLO.nombre}" style="width:100%;height:100%;object-fit:cover;">`
      : iniciales;
  }

  setText('perfilNombre', PERFIL_LIDER_EJEMPLO.nombre);
  setText('perfilLider', `Líder ${RANGOS_MW[idxRango(LIDER_EJEMPLO.rangoActualKey)].label}`);
  setText('perfilTelefono', PERFIL_LIDER_EJEMPLO.telefono);
  setText('perfilCorreo', PERFIL_LIDER_EJEMPLO.correo);

  const datosBancarios = persona?.datosBancarios;
  setText('perfilDatosBancarios', (datosBancarios && (datosBancarios.titular || datosBancarios.banco || datosBancarios.clabe))
    ? `${datosBancarios.titular || '(sin titular)'}\n${datosBancarios.banco || '(sin banco)'} · CLABE ${datosBancarios.clabe || '(sin CLABE)'}`
    : 'Todavía no los registras');
}

// ---------- Datos bancarios (para el pago de comisiones) ----------
let caratulaClabeArchivoTemporal = null;

async function abrirModalDatosBancarios() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const idActual = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
  const persona = idActual && typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(idActual) : null;
  const actuales = persona?.datosBancarios || {};
  caratulaClabeArchivoTemporal = null;

  box.style.maxWidth = '420px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Datos bancarios</h3>
    <p class="modal-sub">Administración usa estos datos para depositarte tus comisiones.</p>
    <label for="inputBancoTitular">Nombre del titular</label>
    <input type="text" id="inputBancoTitular" value="${(actuales.titular || '').replace(/"/g, '&quot;')}">
    <label for="inputBancoNombre" style="margin-top:10px;">Banco</label>
    <input type="text" id="inputBancoNombre" value="${(actuales.banco || '').replace(/"/g, '&quot;')}">
    <label for="inputBancoClabe" style="margin-top:10px;">CLABE interbancaria</label>
    <input type="text" id="inputBancoClabe" inputmode="numeric" maxlength="18" value="${(actuales.clabe || '').replace(/"/g, '&quot;')}">
    <label for="inputCaratulaClabe" style="margin-top:10px;">Carátula de la CLABE (foto o PDF)</label>
    <input type="file" id="inputCaratulaClabe" accept="image/*,application/pdf">
    <small class="field-help" id="caratulaClabeActual">${actuales.caratulaClabeUrl ? 'Ya tienes una carátula guardada — sube otra solo si quieres reemplazarla.' : 'Todavía no subes tu carátula.'}</small>
    <div id="datosBancariosError" class="auth-error" style="display:none;"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px;" id="guardarDatosBancariosBtn">Guardar</button>
  `;
  overlay.classList.add('open');

  document.getElementById('inputCaratulaClabe')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) { caratulaClabeArchivoTemporal = null; return; }
    const validacion = validarArchivoDocumento(archivo, { permitirPdf: true });
    if (!validacion.ok) {
      const error = document.getElementById('datosBancariosError');
      if (error) { error.textContent = validacion.error; error.style.display = 'block'; }
      e.target.value = '';
      caratulaClabeArchivoTemporal = null;
      return;
    }
    caratulaClabeArchivoTemporal = archivo;
  });

  document.getElementById('guardarDatosBancariosBtn')?.addEventListener('click', async () => {
    if (!idActual) { mostrarToast('No se pudo identificar tu cuenta — vuelve a iniciar sesión.'); return; }
    const titular = document.getElementById('inputBancoTitular').value.trim();
    const banco = document.getElementById('inputBancoNombre').value.trim();
    const clabe = document.getElementById('inputBancoClabe').value.trim();
    if (clabe && !/^\d{18}$/.test(clabe)) { mostrarToast('La CLABE interbancaria debe tener 18 dígitos.'); return; }

    let caratulaClabeUrl;
    if (caratulaClabeArchivoTemporal) {
      caratulaClabeUrl = `datos-bancarios/${idActual}-caratula-${Date.now()}`;
      await guardarBlobDocumento(caratulaClabeUrl, caratulaClabeArchivoTemporal);
    }

    actualizarDatosBancariosPersona(idActual, { titular, banco, clabe, caratulaClabeUrl });
    overlay.classList.remove('open');
    mostrarToast('Datos bancarios actualizados.');
    renderPerfilLider();
  });
}

// ---------- Rifa mensual ----------
function renderRifaLider() {
  const { montoAcumuladoMes } = RIFA_LIDER_EJEMPLO;
  // Admin → Configuración → Plan MW es dueña de estas dos reglas; si no
  // está cargada aquí, se usan los mismos valores fijos de siempre.
  const meta = (typeof obtenerValorVigente === 'function' && obtenerValorVigente('rifa', 'meta_mensual')) || RIFA_LIDER_EJEMPLO.meta;
  const montoPorBoletoExtra = (typeof obtenerValorVigente === 'function' && obtenerValorVigente('rifa', 'monto_por_boleto_extra')) || 1000;

  const pctBase = Math.min(100, (montoAcumuladoMes / meta) * 100);
  document.getElementById('rifaFill').style.width = `${pctBase}%`;
  setText('rifaMontoActual', fmtMoney(montoAcumuladoMes));
  setText('rifaMontoMeta', fmtMoney(meta));

  const msg = document.getElementById('rifaMensaje');
  if (montoAcumuladoMes < meta) {
    msg.textContent = `Te faltan ${fmtMoney(meta - montoAcumuladoMes)} en compras este mes para ganar tu boleto de la rifa.`;
  } else {
    const extra = montoAcumuladoMes - meta;
    const boletosExtra = Math.floor(extra / montoPorBoletoExtra);
    const totalBoletos = 1 + boletosExtra;
    const faltanteSiguiente = montoPorBoletoExtra - (extra % montoPorBoletoExtra);
    let texto = totalBoletos === 1 ? '¡Ya tienes tu boleto para la rifa de este mes! <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v1a1.5 1.5 0 000 3v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a1.5 1.5 0 000-3V9z"/><path d="M9 7v10"/></svg></span>' : `¡Llevas ${totalBoletos} boletos para la rifa de este mes! <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v1a1.5 1.5 0 000 3v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a1.5 1.5 0 000-3V9z"/><path d="M9 7v10"/></svg></span>`;
    texto += ` Te faltan ${fmtMoney(faltanteSiguiente)} para tu siguiente boleto extra.`;
    msg.innerHTML = texto;
  }
}

// ---------- Reto de Constancia ----------
function renderConstanciaLider() {
  const { comprasCumplidas, montoMesActual, metaMes, hitos } = CONSTANCIA_LIDER_EJEMPLO;
  const puntosLinea = [0, ...hitos.map(h => h.compras)];
  let segmentoActual = puntosLinea.length - 2;
  for (let i = 0; i < puntosLinea.length - 1; i++) {
    if (comprasCumplidas <= puntosLinea[i + 1]) { segmentoActual = i; break; }
  }
  const inicioSeg = puntosLinea[segmentoActual];
  const finSeg = puntosLinea[segmentoActual + 1];
  const fracSeg = finSeg > inicioSeg ? (comprasCumplidas - inicioSeg) / (finSeg - inicioSeg) : 1;
  const pctGeneral = Math.min(100, ((segmentoActual + fracSeg) / (puntosLinea.length - 1)) * 100);
  document.getElementById('constanciaFill').style.width = `${pctGeneral}%`;

  document.getElementById('constanciaNodes').innerHTML = hitos.map(h => {
    const alcanzado = comprasCumplidas >= h.compras;
    return `
      <div class="timeline-node ${alcanzado ? 'reached' : ''}">
        <div class="node-circle">
          ${alcanzado ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' : `<span style="font-family:var(--font-heading); font-weight:700; font-size:0.85rem;">${h.compras}</span>`}
        </div>
        <span class="node-label">${h.compras}° compra<br>${h.premio}</span>
      </div>
    `;
  }).join('');

  setText('constanciaResumen', `Llevas ${comprasCumplidas} compras cumplidas.`);
  const siguienteHito = hitos.find(h => h.compras > comprasCumplidas);
  const nota = document.getElementById('constanciaNota');
  nota.textContent = siguienteHito
    ? `Te falta${siguienteHito.compras - comprasCumplidas === 1 ? '' : 'n'} ${siguienteHito.compras - comprasCumplidas} compra${siguienteHito.compras - comprasCumplidas === 1 ? '' : 's'} para tu siguiente recompensa: ${siguienteHito.premio}.`
    : '¡Has alcanzado todas las recompensas! Pronto habrá una nueva categoría.';

  const pctMes = Math.min(100, (montoMesActual / metaMes) * 100);
  document.getElementById('mesFill').style.width = `${pctMes}%`;
  setText('mesMontoActual', fmtMoney(montoMesActual));
  setText('mesMontoMeta', fmtMoney(metaMes));
}

// ---------- Progreso de rango (detalle completo) ----------
function renderProgresoRangoCuenta() {
  const idxActual = idxRango(LIDER_EJEMPLO.rangoActualKey);
  const esUltimo = idxActual === RANGOS_MW.length - 1;
  const siguiente = esUltimo ? null : RANGOS_MW[idxActual + 1];
  const { personasActivas, produccionGrupalMes, personasCalificadas, compraPersonalPeriodo1, compraPersonalPeriodo2 } = LIDER_EJEMPLO.stats;

  setText('cuentaRangoActual', RANGOS_MW[idxActual].label.toUpperCase());

  document.getElementById('cuentaRankNodes').innerHTML = RANGOS_MW.map(r => {
    const alcanzado = produccionGrupalMes >= r.produccion;
    return `
      <div class="timeline-node ${alcanzado ? 'reached' : ''}">
        <div class="node-circle">
          ${alcanzado ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/></svg>'}
        </div>
        <span class="node-label">${r.label}<br>${fmtPuntos(r.produccion)}</span>
      </div>
    `;
  }).join('');

  const maxProduccion = RANGOS_MW[RANGOS_MW.length - 1].produccion;
  document.getElementById('cuentaRankFill').style.width = `${Math.min(100, (produccionGrupalMes / maxProduccion) * 100)}%`;

  const titulo = document.getElementById('cuentaProgresoTitulo');
  const sub = document.getElementById('cuentaProgresoSub');
  if (siguiente) {
    titulo.textContent = `Progreso hacia ${siguiente.label.toUpperCase()}`;
    const faltante = Math.max(0, siguiente.produccion - produccionGrupalMes);
    sub.textContent = faltante > 0
      ? `Te faltan ${fmtPuntos(faltante)} de producción grupal para alcanzar ${siguiente.label}.`
      : `¡Ya cumples la producción grupal para ${siguiente.label}!`;

    const compra = cumpleCompraPersonalRangoCuenta(siguiente.key, compraPersonalPeriodo1, compraPersonalPeriodo2, siguiente.compra);
    const items = [
      { label: 'Personas activas', cumple: personasActivas >= siguiente.personas, valores: `${personasActivas} / ${siguiente.personas}` },
      { label: compra.soloUnPeriodo ? 'Compra personal (periodo de consolidación)' : 'Compra personal (ambos periodos)', cumple: compra.cumple, valores: `${fmtMoney(compraPersonalPeriodo1)} y ${fmtMoney(compraPersonalPeriodo2)} / ${fmtMoney(siguiente.compra)}` },
      { label: 'Equipo calificado', cumple: personasCalificadas >= siguiente.calificado, valores: `${personasCalificadas} / ${siguiente.calificado} personas` },
    ];
    document.getElementById('cuentaChecklist').innerHTML = items.map(it => `
      <div class="check-item light ${it.cumple ? 'met' : 'unmet'}">
        <span class="check-icon">${it.cumple ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>'}</span>
        <span class="check-label">${it.label}</span>
        <span class="check-values">${it.valores}</span>
      </div>
    `).join('');
  } else {
    titulo.textContent = '¡Estás en el rango más alto!';
    sub.textContent = 'Sigue así para mantenerte en Corona el próximo mes.';
    document.getElementById('cuentaChecklist').innerHTML = '';
  }
}

// ---------- Ticket de comisiones ----------
function calcularProfundidadesEquipo() {
  const depthById = { yo: 0 };
  let added = true;
  while (added) {
    added = false;
    EQUIPO_ARBOL_EJEMPLO.forEach((m) => {
      if (m.leaderId && depthById.hasOwnProperty(m.leaderId) && !depthById.hasOwnProperty(m.id)) {
        depthById[m.id] = depthById[m.leaderId] + 1;
        added = true;
      }
    });
  }
  return depthById;
}

function renderTicketComisiones() {

  const depths = calcularProfundidadesEquipo();
  const miembrosPorNivel = [[], [], [], [], []];
  EQUIPO_ARBOL_EJEMPLO.forEach((m) => {
    const d = depths[m.id];
    if (d >= 1 && d <= 5) miembrosPorNivel[d - 1].push(m);
  });

  // El % de comisión debe usar el rango CONGELADO del cierre del mes
  // anterior (Sección 7.4), nunca el rango en vivo — misma función que
  // usa el motor de Admin, para que la Líder nunca vea un % distinto
  // del que realmente se le va a pagar.
  const rangoAplicado = typeof calcularRangoAplicadoPeriodo === 'function'
    ? calcularRangoAplicadoPeriodo(LIDER_EJEMPLO, obtenerPeriodoActualKey()).rangoKey
    : LIDER_EJEMPLO.rangoActualKey;
  const pcts = COMISIONES_PCT[rangoAplicado];
  const wrap = document.getElementById('ticketNiveles');
  let total = 0;

  wrap.innerHTML = miembrosPorNivel.map((miembros, i) => {

    const pct = pcts[i];
    const produccion = miembros.reduce((suma, m) => suma + (m.puntos || 0), 0);
    const comisionNivel = (produccion / obtenerIvaDivisorLider()) * (pct / 100);
    total += comisionNivel;

    return `
      <div class="ct-row-wrap">
        <button type="button" class="ct-row" data-toggle-nivel="${i}" aria-expanded="false">
          <div>
            <span class="ct-level">Nivel ${i + 1}</span>
            <span class="ct-detail">${fmtMoney(produccion)} en compras × ${pct}%</span>
          </div>
          <span class="ct-amount">${fmtMoney(comisionNivel)} <span class="ct-chevron">▾</span></span>
        </button>
        <div class="ct-detail-list" id="ctDetalle${i}" hidden>
          ${construirDetalleNivelComisiones(miembros, pct)}
        </div>
      </div>
    `;

  }).join('');

  setText('ticketTotal', fmtMoney(total));
  setText('ticketRango', RANGOS_MW[idxRango(rangoAplicado)].label);

  wrap.querySelectorAll('[data-toggle-nivel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const detalle = document.getElementById(`ctDetalle${btn.getAttribute('data-toggle-nivel')}`);
      if (!detalle) return;
      detalle.hidden = !detalle.hidden;
      btn.classList.toggle('open', !detalle.hidden);
      btn.setAttribute('aria-expanded', String(!detalle.hidden));
    });
  });

}

// Desglose por emprendedora de un nivel: cada compra individual con su
// fecha, IVA y comisión — mismo % que ya se usó para el total del nivel.
function construirDetalleNivelComisiones(miembros, pct) {

  if (!miembros.length) {
    return `<div class="ct-detail-empty">Todavía no hay integrantes en este nivel.</div>`;
  }

  return miembros.map((m) => {

    const compras = (m.compras && m.compras.length) ? m.compras : [{ monto: m.puntos || 0, fecha: null }];

    return compras.map((c) => {
      const base = c.monto / obtenerIvaDivisorLider();
      const iva = c.monto - base;
      const comisionCompra = base * (pct / 100);
      return `
        <div class="ct-detail-row">
          <div>
            <strong>${m.nombre}</strong>
            <span class="ct-detail-sub">${c.fecha ? formatearFechaComision(c.fecha) : 'Sin fecha registrada'} · ${fmtMoney(c.monto)} en compra</span>
          </div>
          <div class="ct-detail-nums">
            <span>IVA ${fmtMoney(iva)}</span>
            <span>${pct}% comisión</span>
            <strong>${fmtMoney(comisionCompra)}</strong>
          </div>
        </div>
      `;
    }).join('');

  }).join('');

}

function formatearFechaComision(fechaISO) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}
// ---------- Próxima fecha de pago ----------
// El calendario real es día 5 y día 20 de cada mes, alternados (5, 20,
// 5, 20...) — los mismos dos días que ya usa obtenerInfoSubPeriodo()
// en comisiones-modelo.js para la fecha de pago de cada sub-periodo.
// Se busca la fecha más próxima de esa lista que todavía no llega.
function calcularProximoPagoLider(ahora = new Date()) {
  const candidatos = [];
  for (let offsetMes = 0; offsetMes <= 1; offsetMes++) {
    const base = new Date(ahora.getFullYear(), ahora.getMonth() + offsetMes, 1);
    candidatos.push(new Date(base.getFullYear(), base.getMonth(), 5));
    candidatos.push(new Date(base.getFullYear(), base.getMonth(), 20));
  }
  const hoyMedianoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return candidatos.filter(d => d > hoyMedianoche).sort((a, b) => a - b)[0];
}

function renderProximoPago() {
  const fechaPago = calcularProximoPagoLider();
  const diaSemana = fechaPago.toLocaleDateString('es-MX', { weekday: 'long' });
  const mes = fechaPago.toLocaleDateString('es-MX', { month: 'long' });
  const texto = `${diaSemana} ${fechaPago.getDate()} de ${mes}`;
  setText('proximoPago', texto.charAt(0).toUpperCase() + texto.slice(1));
}
