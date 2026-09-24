// MW JOYERÍA — Mi equipo (Líder)
// Depende de EQUIPO_ARBOL_EJEMPLO (equipo-ejemplo.js) para las tarjetas
// de nivel y el árbol visual — dataset de ejemplo, sin vínculo por
// sesión a una persona real todavía (limitación conocida y ya
// reportada). "Gestionar equipo" (solicitar baja/cambio de rama) y
// "Alertas de tu equipo" (js/alertas-inactividad-modelo.js) SÍ usan el
// registro real de personas (js/personas-ejemplo.js): una solicitud de
// cambio de rama y un aviso de inactividad necesitan actuar sobre una
// persona real que Admin/la propia líder puedan encontrar — no tendría
// sentido pedirlos, o avisarlos, sobre alguien que no existe en el
// sistema real.
// ⚠️ TEMPORAL: 'ana-torres' se usa como identidad fija de "la Líder con
// sesión abierta" (misma convención que RH_EMPLEADO/ADMIN_EMPLEADO en
// otros portales) hasta que exista sesión real vinculada a una persona.
const LIDER_ACTUAL_ID_REAL = 'ana-torres';

document.addEventListener('DOMContentLoaded', () => {
  // No hay ningún otro "tick" que corra en el portal de Líder (a
  // diferencia de Admin, donde admin-comun.js ya lo hace al abrir la
  // campana) — se corre aquí para que la alerta de inactividad esté al
  // día apenas la líder entra a Mi equipo.
  if (typeof procesarAlertasInactividadTodas === 'function') procesarAlertasInactividadTodas();

  renderNivelCards();
  renderArbolVisual();
  renderAlertasInactividadEquipo();
  renderGestionEquipo();
  renderReclamarEmprendedora();

  const btnExcel = document.getElementById('descargarArbolBtn');
  if (btnExcel) btnExcel.addEventListener('click', descargarArbolExcel);

  document.getElementById('reclamarBuscarInput')?.addEventListener('input', renderReclamarEmprendedora);
});

// ---------- Gestionar equipo (solicitar cambio de rama) ----------
//
// Antes era "solicitar baja" — ver nota de arquitectura en
// personas-ejemplo.js (crearSolicitudCambioRama). Solo las
// Emprendedoras directas dentro de sus primeros 5 días desde la
// inscripción pueden cambiarse de rama; dar de baja a alguien de tu
// equipo se sigue pidiendo por otro medio (contacta a Administración).
function renderGestionEquipo() {

  const wrap = document.getElementById('gestionEquipoLista');
  if (!wrap || typeof calcularDescendenciaPersona !== 'function') return;

  const liderReal = obtenerPersonaPorId(LIDER_ACTUAL_ID_REAL);
  if (!liderReal) { wrap.innerHTML = '<p class="equipo-modal-empty">No se pudo cargar tu equipo.</p>'; return; }

  const { conNivel } = calcularDescendenciaPersona(LIDER_ACTUAL_ID_REAL);
  const directas = conNivel
    .filter(n => n.nivel === 1)
    .map(n => n.persona)
    .filter(p => p.tipo === 'emprendedora' && p.estado !== 'baja');

  if (!directas.length) {
    wrap.innerHTML = '<p class="equipo-modal-empty">Todavía no tienes emprendedoras directas en tu equipo.</p>';
    return;
  }

  wrap.innerHTML = directas.map(p => {
    if (p.solicitudCambioRamaPendiente) {
      return `
        <div class="equipo-modal-row">
          <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))}</span>
          <span class="badge badge-ascenso" style="background:#fbe7e9;color:#a3272f;">Cambio de rama pendiente</span>
        </div>
      `;
    }
    if (!puedeSolicitarCambioRama(p)) {
      return `
        <div class="equipo-modal-row">
          <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))}</span>
          <small style="color:var(--mw-text-muted);">Ya pasaron los 5 días desde su inscripción</small>
        </div>
      `;
    }
    return `
      <div class="equipo-modal-row">
        <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))}</span>
        <button class="btn btn-outline" type="button" data-solicitar-cambio-rama="${p.id}">Solicitar cambio de rama</button>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('[data-solicitar-cambio-rama]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalCambioRama(btn.getAttribute('data-solicitar-cambio-rama'), liderReal));
  });

}

function abrirModalCambioRama(personaId, liderReal) {

  const persona = obtenerPersonaPorId(personaId);
  if (!persona) return;

  const otrasLideres = obtenerPersonas().filter(p => p.tipo === 'lider' && p.estado !== 'baja' && p.id !== liderReal.id);

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Solicitar cambio de rama de ${escapeHTMLMiEquipo(nombreCompletoPersona(persona))}</h3>
    <p class="modal-sub">Administración revisará tu solicitud y decidirá si la confirma.</p>
    <label for="liderDestinoSelect">¿A la rama de qué líder debería pasar?</label>
    <select id="liderDestinoSelect" style="width:100%;border:1px solid #ddd5e3;border-radius:7px;padding:10px 12px;font:inherit;color:#312044;margin-bottom:1.1rem;">
      ${otrasLideres.map(l => `<option value="${l.id}">${escapeHTMLMiEquipo(nombreCompletoPersona(l))}</option>`).join('')}
    </select>
    <label for="motivoCambioRamaInput">Motivo (opcional)</label>
    <textarea id="motivoCambioRamaInput" rows="3" placeholder="Ej. se inscribió bajo mí por error, en realidad es invitada de..." style="width:100%;border:1px solid #ddd5e3;border-radius:7px;padding:10px 12px;font:inherit;color:#312044;resize:vertical;"></textarea>
    <div id="cambioRamaError" class="auth-error" style="display:none;"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="confirmarSolicitarCambioRamaBtn">Enviar solicitud</button>
  `;
  overlay.classList.add('open');

  document.getElementById('confirmarSolicitarCambioRamaBtn').addEventListener('click', () => {
    const liderPropuestaId = document.getElementById('liderDestinoSelect').value;
    const motivo = document.getElementById('motivoCambioRamaInput').value.trim();
    const resultado = crearSolicitudCambioRama(personaId, {
      liderPropuestaId,
      motivo,
      solicitadoPorId: liderReal.id,
      solicitadoPorNombre: nombreCompletoPersona(liderReal)
    });
    if (!resultado.ok) {
      const error = document.getElementById('cambioRamaError');
      if (error) { error.textContent = resultado.error; error.style.display = 'block'; }
      return;
    }
    overlay.classList.remove('open');
    renderGestionEquipo();
    mostrarToast(`Se envió la solicitud de cambio de rama de ${nombreCompletoPersona(persona)} a Administración.`);
  });

}

// ---------- Alertas de inactividad (datos reales) ----------
//
// A diferencia del árbol visual de abajo (todavía sobre datos de
// ejemplo, ver nota de arquitectura al inicio del archivo), esta
// sección SÍ usa el registro real de personas — calcularDescendenciaPersona
// y persona.alertaInactividad (js/alertas-inactividad-modelo.js) — para
// que la líder vea de verdad a quién de su equipo hay que contactar.
function renderAlertasInactividadEquipo() {

  const wrap = document.getElementById('alertasInactividadLista');
  if (!wrap || typeof calcularDescendenciaPersona !== 'function') return;

  const { conNivel } = calcularDescendenciaPersona(LIDER_ACTUAL_ID_REAL);
  const conAlerta = conNivel
    .map(n => n.persona)
    .filter(p => p.alertaInactividad)
    .sort((a, b) => a.alertaInactividad.desde.localeCompare(b.alertaInactividad.desde));

  if (!conAlerta.length) {
    wrap.innerHTML = '<p class="equipo-modal-empty">Todo tu equipo tiene actividad reciente — no hay alertas por ahora.</p>';
    return;
  }

  wrap.innerHTML = conAlerta.map(p => `
    <div class="equipo-modal-row">
      <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))} <span class="badge team-alert-badge">Sin actividad desde ${formatearFechaCortaMiEquipo(p.alertaInactividad.desde)}</span></span>
      <button class="btn btn-outline" type="button" data-contactar="${p.id}">Contactar por WhatsApp</button>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-contactar]').forEach(btn => {
    btn.addEventListener('click', () => abrirContactoWhatsappInactividad(obtenerPersonaPorId(btn.getAttribute('data-contactar'))));
  });

}

function formatearFechaCortaMiEquipo(fechaISO) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function abrirContactoWhatsappInactividad(persona) {

  if (!persona) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const numero = (persona.telefono || '').replace(/\D/g, '');
  const mensaje = `Hola ${persona.nombre}, ¿cómo estás? Hace tiempo no te veo comprar y quería saber cómo vas — ¿todo bien? Cualquier cosa que necesites, aquí estoy.`;
  const enlace = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : '#';

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Contactar a ${escapeHTMLMiEquipo(nombreCompletoPersona(persona))}</h3>
    <p class="modal-sub">Lleva sin llegar a la compra mínima desde el ${formatearFechaCortaMiEquipo(persona.alertaInactividad?.desde)}.</p>
    ${numero
      ? `<a class="btn btn-primary" style="width:100%;display:grid;place-items:center;text-decoration:none;" href="${enlace}" target="_blank" rel="noopener">Abrir WhatsApp</a>`
      : '<p class="auth-error">Esta persona no tiene un número de teléfono registrado.</p>'}
  `;

  overlay.classList.add('open');

}

// ---------- Reclamar una emprendedora de otra líder ----------
//
// La otra mitad del mismo flujo: si crees que una emprendedora recién
// inscrita (últimos 5 días) debía haber quedado bajo ti y no bajo
// quien la registró, puedes buscarla aquí y solicitar el cambio —
// misma solicitud que arriba, Admin decide igual.
function renderReclamarEmprendedora() {

  const wrap = document.getElementById('reclamarLista');
  if (!wrap) return;

  const liderReal = obtenerPersonaPorId(LIDER_ACTUAL_ID_REAL);
  if (!liderReal) return;

  const texto = (document.getElementById('reclamarBuscarInput')?.value || '').trim().toLowerCase();

  if (!texto) {
    wrap.innerHTML = '<p class="equipo-modal-empty">Escribe un nombre para buscar.</p>';
    return;
  }

  const candidatas = obtenerPersonas().filter(p =>
    p.tipo === 'emprendedora' &&
    p.liderId !== liderReal.id &&
    puedeSolicitarCambioRama(p) &&
    nombreCompletoPersona(p).toLowerCase().includes(texto)
  );

  if (!candidatas.length) {
    wrap.innerHTML = '<p class="equipo-modal-empty">No hay emprendedoras recién inscritas (últimos 5 días) que coincidan.</p>';
    return;
  }

  wrap.innerHTML = candidatas.map(p => {
    const liderActual = p.liderId ? obtenerPersonaPorId(p.liderId) : null;
    return `
      <div class="equipo-modal-row">
        <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))} <small style="color:var(--mw-text-muted);">(actualmente con ${liderActual ? escapeHTMLMiEquipo(nombreCompletoPersona(liderActual)) : 'sin líder'})</small></span>
        <button class="btn btn-outline" type="button" data-reclamar="${p.id}">Solicitar a mi equipo</button>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('[data-reclamar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalReclamar(btn.getAttribute('data-reclamar'), liderReal));
  });

}

function abrirModalReclamar(personaId, liderReal) {

  const persona = obtenerPersonaPorId(personaId);
  if (!persona) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Solicitar a ${escapeHTMLMiEquipo(nombreCompletoPersona(persona))} para tu equipo</h3>
    <p class="modal-sub">Administración revisará tu solicitud y decidirá si la confirma.</p>
    <label for="motivoReclamarInput">Motivo (opcional)</label>
    <textarea id="motivoReclamarInput" rows="3" placeholder="Ej. yo la invité, se inscribió bajo otra líder por error" style="width:100%;border:1px solid #ddd5e3;border-radius:7px;padding:10px 12px;font:inherit;color:#312044;resize:vertical;"></textarea>
    <div id="reclamarError" class="auth-error" style="display:none;"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="confirmarReclamarBtn">Enviar solicitud</button>
  `;
  overlay.classList.add('open');

  document.getElementById('confirmarReclamarBtn').addEventListener('click', () => {
    const motivo = document.getElementById('motivoReclamarInput').value.trim();
    const resultado = crearSolicitudCambioRama(personaId, {
      liderPropuestaId: liderReal.id,
      motivo,
      solicitadoPorId: liderReal.id,
      solicitadoPorNombre: nombreCompletoPersona(liderReal)
    });
    if (!resultado.ok) {
      const error = document.getElementById('reclamarError');
      if (error) { error.textContent = resultado.error; error.style.display = 'block'; }
      return;
    }
    overlay.classList.remove('open');
    renderReclamarEmprendedora();
    mostrarToast(`Se envió tu solicitud para que ${nombreCompletoPersona(persona)} pase a tu equipo.`);
  });

}

function escapeHTMLMiEquipo(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function calcularProfundidades() {
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

// ---------- Tarjetas de nivel ----------
function renderNivelCards() {
  const depths = calcularProfundidades();
  const porNivel = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  EQUIPO_ARBOL_EJEMPLO.forEach((m) => {
    const d = depths[m.id];
    if (d >= 1 && d <= 5) porNivel[d].push(m);
  });

  const grid = document.getElementById('nivelesGrid');
  grid.innerHTML = [1, 2, 3, 4, 5].map((nivel) => `
    <button class="team-level-card" style="text-align:left; cursor:pointer; width:100%;" data-nivel="${nivel}">
      <div class="icon-circle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
      </div>
      <h4>Nivel ${nivel}</h4>
      <span class="tl-count">${porNivel[nivel].length}</span>
      <span class="tl-sub">Personas activas · toca para ver</span>
    </button>
  `).join('');

  grid.querySelectorAll('[data-nivel]').forEach((btn) => {
    btn.addEventListener('click', () => abrirModalNivel(Number(btn.getAttribute('data-nivel')), porNivel[Number(btn.getAttribute('data-nivel'))]));
  });
}

function abrirModalNivel(nivel, personas) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  const filas = personas.length > 0
    ? personas.map(p => `
      <div class="equipo-modal-row">
        <span>${p.nombre}</span>
        <span class="em-puntos">${p.puntos != null ? p.puntos.toLocaleString('es-MX') + ' pts' : 'Sin datos'}</span>
      </div>
    `).join('')
    : '<div class="equipo-modal-empty">Todavía no hay integrantes en este nivel.</div>';

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Nivel ${nivel}</h3>
    <p class="modal-sub">Nombre y puntos de producción grupal acumulados este mes.</p>
    <div class="equipo-modal-list">${filas}</div>
  `;
  overlay.classList.add('open');
}

// ---------- Árbol visual conectado ----------
function renderArbolVisual() {
  const byId = {};
  EQUIPO_ARBOL_EJEMPLO.forEach(m => { byId[m.id] = { ...m, children: [] }; });
  EQUIPO_ARBOL_EJEMPLO.forEach(m => {
    if (m.leaderId && byId[m.leaderId]) byId[m.leaderId].children.push(byId[m.id]);
  });

  function renderNode(node, isSelf, depth) {
    const lvlClass = isSelf ? 'self' : `lvl-${((depth - 1) % 5) + 1}`;
    const puntosLine = node.puntos != null ? `<span class="on-points">${node.puntos.toLocaleString('es-MX')} pts</span>` : '';
    const nodeHtml = `
      <div class="org-node ${lvlClass}">
        <span class="on-name">${node.nombre}</span>
        <span class="on-tag">${isSelf ? 'Tú' : `Nivel ${depth}`}</span>
        ${puntosLine}
      </div>`;
    if (node.children.length === 0) return `<li>${nodeHtml}</li>`;
    return `<li>${nodeHtml}<ul>${node.children.map(c => renderNode(c, false, depth + 1)).join('')}</ul></li>`;
  }

  document.getElementById('orgTreeContainer').innerHTML = `<div class="org-tree"><ul>${renderNode(byId['yo'], true, 0)}</ul></div>`;

  // En pantallas angostas el árbol es más ancho que la ventana y queda
  // centrado dentro de sí mismo (justify-content:center) — sin esto, el
  // scroll inicial (0) muestra el borde izquierdo del árbol completo, no
  // la raíz. Centramos el scroll para que "Tú (Líder)" quede a la vista.
  const wrap = document.getElementById('orgTreeContainer')?.closest('.org-tree-wrap');
  if (wrap) {
    requestAnimationFrame(() => {
      wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;
    });
  }
}

// ---------- Descargar árbol en Excel ----------
// La captura de pantalla del árbol (html2canvas + jsPDF) se veía mal en
// árboles anchos o con muchos niveles — se reemplaza por una tabla real
// (Nivel / Nombre / Puntos por periodo), más útil para revisar cifras
// que una imagen. Los puntos por periodo se calculan de las mismas
// "compras" de cada persona (equipo-ejemplo.js) que ya suman su
// "puntos" total — mismo criterio p1 (días 1–15) / p2 (16–fin de mes)
// que usa el resto del Plan MW.
function calcularPuntosPorPeriodoArbol(persona) {
  let p1 = 0;
  let p2 = 0;
  (persona.compras || []).forEach(c => {
    const dia = new Date(c.fecha).getDate();
    if (dia <= 15) p1 += c.monto; else p2 += c.monto;
  });
  return { p1, p2 };
}

function descargarArbolExcel() {

  const depths = calcularProfundidades();

  const filas = EQUIPO_ARBOL_EJEMPLO
    .filter(m => m.id !== 'yo' && depths[m.id] >= 1 && depths[m.id] <= 5)
    .map(m => {
      const { p1, p2 } = calcularPuntosPorPeriodoArbol(m);
      return { nivel: depths[m.id], nombre: m.nombre, p1, p2 };
    })
    .sort((a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre));

  if (!filas.length) {
    mostrarToast('Todavía no hay integrantes en tu equipo para exportar.');
    return;
  }

  const encabezado = ['Nivel', 'Nombre', 'Puntos periodo 1', 'Puntos periodo 2', 'Puntos totales'];
  const cuerpo = filas.map(f => [f.nivel, f.nombre, f.p1.toFixed(2), f.p2.toFixed(2), (f.p1 + f.p2).toFixed(2)]);

  const csv = '﻿' + [encabezado, ...cuerpo]
    .map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mi-arbol-mw.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  mostrarToast('Excel generado.');

}
