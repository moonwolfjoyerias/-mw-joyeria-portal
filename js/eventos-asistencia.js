// MW JOYERÍA — Asistencia a eventos del calendario (con acompañantes)
//
// Cada e/l confirma su asistencia en SU propio documento:
//   eventosAsistencia/{eventoId}__{personaId}
//   { eventoId, personaId, nombre, fecha, actualizadoEn,
//     acompanantes: [{ nombre, telefono? }] }
// Antes se agregaba a evento.asistentes, pero las reglas de Firestore no
// dejan a una e/l escribir en "eventos" (es del equipo), así que su
// confirmación no llegaba a la base. Las confirmaciones viejas que sí
// quedaron en evento.asistentes se siguen mostrando.
//
// Acompañantes: Staff/Encargado/Admin (o BRILLO) los permiten por evento:
//   evento.acompanantes = { permitido, limite (por e/l), prospectos, motivo }
// Si son prospectos se pide nombre y teléfono (opcional); si no, solo el
// nombre y el evento dice el motivo por el que van. La e/l puede cambiar
// sus acompañantes o cancelar su asistencia hasta el día del evento.
// Lo mismo hace BRILLO (src/calendario/asistencia.ts).
const EVENTOS_ASISTENCIA_COLECCION = 'eventosAsistencia';
const ACOMPANANTES_LIMITE_MAXIMO = 20;

function configAcompanantesEvento(ev) {
  const a = ev && ev.acompanantes;
  if (!a || a.permitido !== true) return null;
  const limite = Math.max(1, Math.min(ACOMPANANTES_LIMITE_MAXIMO, Math.floor(Number(a.limite) || 1)));
  return { permitido: true, limite, prospectos: a.prospectos === true, motivo: String(a.motivo || '').trim() };
}

// El evento ya pasó (su fecha es anterior a hoy): ya no se confirma ni se cambia.
function eventoYaPasoAsistencia(ev) {
  if (!ev || !ev.fecha) return false;
  const h = new Date();
  const hoy = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
  return String(ev.fecha).slice(0, 10) < hoy;
}

function idAsistenciaEvento(eventoId, personaId) {
  return `${eventoId}__${personaId}`;
}

// Nombres sin vacíos, teléfono solo si son prospectos, y nunca más del límite.
function normalizarAcompanantesEvento(lista, config) {
  if (!config) return [];
  return (Array.isArray(lista) ? lista : [])
    .map(a => ({ nombre: String((a && a.nombre) || '').trim().slice(0, 80), telefono: String((a && a.telefono) || '').replace(/[^\d+\s-]/g, '').trim().slice(0, 20) }))
    .filter(a => a.nombre)
    .slice(0, config.limite)
    .map(a => (config.prospectos && a.telefono ? { nombre: a.nombre, telefono: a.telefono } : { nombre: a.nombre }));
}

function _asistenciaDesdeDoc(id, d) {
  return {
    id,
    eventoId: String(d.eventoId || ''),
    personaId: String(d.personaId || ''),
    nombre: String(d.nombre || 'Sin nombre'),
    fecha: d.fecha || null,
    actualizadoEn: d.actualizadoEn || null,
    acompanantes: Array.isArray(d.acompanantes) ? d.acompanantes.map(a => ({ nombre: String(a.nombre || ''), telefono: String(a.telefono || '') })).filter(a => a.nombre) : []
  };
}

async function leerMiAsistenciaEvento(eventoId, personaId) {
  if (typeof dbFirestore === 'undefined' || !dbFirestore || !personaId) return null;
  try {
    const s = await dbFirestore.collection(EVENTOS_ASISTENCIA_COLECCION).doc(idAsistenciaEvento(eventoId, personaId)).get();
    return s.exists ? _asistenciaDesdeDoc(s.id, s.data()) : null;
  } catch (error) {
    return null;
  }
}

// Todas las confirmaciones, en vivo (para el equipo): cb(Map eventoId → lista).
function escucharAsistenciasEventos(cb) {
  if (typeof dbFirestore === 'undefined' || !dbFirestore) return () => {};
  return dbFirestore.collection(EVENTOS_ASISTENCIA_COLECCION).onSnapshot(s => {
    const mapa = new Map();
    s.docs.forEach(doc => {
      const a = _asistenciaDesdeDoc(doc.id, doc.data());
      if (!mapa.has(a.eventoId)) mapa.set(a.eventoId, []);
      mapa.get(a.eventoId).push(a);
    });
    cb(mapa);
  }, () => cb(new Map()));
}

// Las confirmaciones de una e/l, en vivo: cb(Map eventoId → asistencia).
function escucharMisAsistenciasEventos(personaId, cb) {
  if (typeof dbFirestore === 'undefined' || !dbFirestore || !personaId) return () => {};
  return dbFirestore.collection(EVENTOS_ASISTENCIA_COLECCION).where('personaId', '==', personaId).onSnapshot(s => {
    const mapa = new Map();
    s.docs.forEach(doc => { const a = _asistenciaDesdeDoc(doc.id, doc.data()); mapa.set(a.eventoId, a); });
    cb(mapa);
  }, () => cb(new Map()));
}

// Las de la base más las viejas guardadas dentro del evento (sin repetir).
function asistentesCombinadosEvento(ev, deLaBase) {
  const porPersona = new Map();
  (Array.isArray(ev && ev.asistentes) ? ev.asistentes : []).forEach(a => {
    if (a && a.personaId) porPersona.set(a.personaId, { id: `viejo-${a.personaId}`, eventoId: ev.id, personaId: a.personaId, nombre: a.nombre || 'Sin nombre', fecha: a.fecha || null, acompanantes: [] });
  });
  (deLaBase || []).forEach(a => porPersona.set(a.personaId, a));
  return Array.from(porPersona.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

async function guardarMiAsistenciaEvento(ev, persona, acompanantes) {
  if (typeof dbFirestore === 'undefined' || !dbFirestore) return { ok: false, error: 'Sin conexión con la base de datos.' };
  if (eventoYaPasoAsistencia(ev)) return { ok: false, error: 'Este evento ya pasó.' };
  const config = configAcompanantesEvento(ev);
  const lista = normalizarAcompanantesEvento(acompanantes, config);
  const ref = dbFirestore.collection(EVENTOS_ASISTENCIA_COLECCION).doc(idAsistenciaEvento(ev.id, persona.id));
  const ahora = new Date().toISOString();
  try {
    const antes = await ref.get();
    await ref.set({
      eventoId: ev.id,
      personaId: persona.id,
      nombre: persona.nombre || 'Sin nombre',
      fecha: antes.exists && antes.data().fecha ? antes.data().fecha : ahora,
      actualizadoEn: ahora,
      acompanantes: lista
    });
    return { ok: true, acompanantes: lista, nueva: !antes.exists };
  } catch (error) {
    return { ok: false, error: 'No se pudo guardar tu asistencia. Revisa tu conexión e inténtalo de nuevo.' };
  }
}

async function cancelarMiAsistenciaEvento(ev, personaId) {
  if (typeof dbFirestore === 'undefined' || !dbFirestore) return { ok: false, error: 'Sin conexión con la base de datos.' };
  if (eventoYaPasoAsistencia(ev)) return { ok: false, error: 'Este evento ya pasó.' };
  try {
    await dbFirestore.collection(EVENTOS_ASISTENCIA_COLECCION).doc(idAsistenciaEvento(ev.id, personaId)).delete();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'No se pudo cancelar. Revisa tu conexión e inténtalo de nuevo.' };
  }
}

// Texto corto para la e/l / el equipo sobre los acompañantes del evento.
function textoAcompanantesEvento(config) {
  if (!config) return '';
  const cuantos = config.limite === 1 ? 'hasta 1 acompañante' : `hasta ${config.limite} acompañantes`;
  return config.prospectos
    ? `Puedes llevar ${cuantos}: son prospectos (personas interesadas en unirse a MW).`
    : `Puedes llevar ${cuantos}.${config.motivo ? ` Motivo: ${config.motivo}` : ''}`;
}

// ============================================================
// PARA EL EQUIPO (Staff, Encargado, Admin): campos del formulario del
// evento y lista de asistencia. Los usan calendario-tabla.js,
// encargado-calendario.js y admin-calendario.js.
// ============================================================
let ASISTENCIAS_POR_EVENTO = new Map();

function _escAsistencia(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function htmlCamposAcompanantesEvento(evento) {
  const acomp = configAcompanantesEvento(evento);
  return `
      <div class="form-field full evento-acompanantes">
        <label class="check-linea"><input type="checkbox" id="eventoAcompPermitido" ${acomp ? 'checked' : ''}> Las Emprendedoras/Líderes pueden llevar acompañantes</label>
        <div id="eventoAcompOpciones" ${acomp ? '' : 'hidden'}>
          <label for="eventoAcompLimite">Máximo de acompañantes por e/l</label>
          <input id="eventoAcompLimite" type="number" min="1" max="${ACOMPANANTES_LIMITE_MAXIMO}" step="1" value="${acomp ? acomp.limite : 1}">
          <span class="etiqueta-campo">¿Los acompañantes son prospectos?</span>
          <div class="pregunta-si-no">
            <label class="opcion-si-no"><input type="radio" name="eventoAcompProspectos" value="si" ${acomp && acomp.prospectos ? 'checked' : ''}> Sí</label>
            <label class="opcion-si-no"><input type="radio" name="eventoAcompProspectos" value="no" ${acomp && !acomp.prospectos ? 'checked' : ''}> No</label>
          </div>
          <div id="eventoAcompMotivoCampo" ${acomp && !acomp.prospectos ? '' : 'hidden'}>
            <label for="eventoAcompMotivo">¿Por qué van los acompañantes? *</label>
            <textarea id="eventoAcompMotivo" rows="2" maxlength="200" placeholder="Ej. Es una comida familiar de fin de año">${_escAsistencia(acomp ? acomp.motivo : '')}</textarea>
          </div>
          <small class="field-help">Al confirmar su asistencia, la e/l marca "Llevaré acompañante" y escribe el nombre de cada uno (y su teléfono si son prospectos). Si son prospectos, se le avisa que no son parte de su equipo (personas que todavía no están en MW).</small>
        </div>
      </div>`;
}

function conectarCamposAcompanantesEvento() {
  document.getElementById('eventoAcompPermitido')?.addEventListener('change', e => {
    const op = document.getElementById('eventoAcompOpciones');
    if (op) op.hidden = !e.target.checked;
  });
  document.querySelectorAll('input[name="eventoAcompProspectos"]').forEach(r => r.addEventListener('change', () => {
    const campo = document.getElementById('eventoAcompMotivoCampo');
    if (campo) campo.hidden = document.querySelector('input[name="eventoAcompProspectos"]:checked')?.value !== 'no';
  }));
}

// { acompanantes } listo para guardar en el evento, o { error }.
function leerCamposAcompanantesEvento() {
  if (!document.getElementById('eventoAcompPermitido')?.checked) return { acompanantes: { permitido: false } };
  const limite = Math.floor(Number(document.getElementById('eventoAcompLimite')?.value));
  const prospectos = document.querySelector('input[name="eventoAcompProspectos"]:checked')?.value;
  const motivo = (document.getElementById('eventoAcompMotivo')?.value || '').trim();
  if (!(limite >= 1 && limite <= ACOMPANANTES_LIMITE_MAXIMO)) return { error: `El máximo de acompañantes por e/l va de 1 a ${ACOMPANANTES_LIMITE_MAXIMO}.` };
  if (!prospectos) return { error: 'Indica si los acompañantes son prospectos.' };
  if (prospectos === 'no' && !motivo) return { error: 'Escribe por qué van los acompañantes.' };
  return { acompanantes: { permitido: true, limite, prospectos: prospectos === 'si', motivo: prospectos === 'no' ? motivo : '' } };
}

function asistentesEventoEquipo(evento) {
  return asistentesCombinadosEvento(evento, ASISTENCIAS_POR_EVENTO.get(evento.id));
}

// Lista en vivo para el equipo; al cambiar se vuelve a pintar la tabla.
function iniciarAsistenciasEquipo(alCambiar) {
  escucharAsistenciasEventos(mapa => { ASISTENCIAS_POR_EVENTO = mapa; if (typeof alCambiar === 'function') alCambiar(); });
}

function abrirModalAsistenciaEventoEquipo(evento, formatearFecha) {
  if (!evento) return;
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;
  const asistentes = asistentesEventoEquipo(evento);
  const acomp = configAcompanantesEvento(evento);
  const totalAcomp = asistentes.reduce((s, a) => s + a.acompanantes.length, 0);
  box.style.maxWidth = '520px';
  box.innerHTML = `
    <button class="modal-close" data-close>×</button>
    <h3>Lista de asistencia</h3>
    <p class="modal-sub">${_escAsistencia(evento.titulo)} — ${asistentes.length} confirmación${asistentes.length === 1 ? '' : 'es'}${totalAcomp ? ` + ${totalAcomp} acompañante${totalAcomp === 1 ? '' : 's'} = ${asistentes.length + totalAcomp} personas` : ''}.</p>
    ${acomp ? `<p class="bp-sub">Acompañantes: hasta ${acomp.limite} por e/l · ${acomp.prospectos ? 'son prospectos' : `no son prospectos — ${_escAsistencia(acomp.motivo)}`}.</p>` : ''}
    ${asistentes.length ? `
      <div class="equipo-modal-list asistencia-lista">
        ${asistentes.map(a => `
          <div class="asistencia-persona">
            <strong>${_escAsistencia(a.nombre)}</strong>
            ${a.acompanantes.length ? `<ul class="asistencia-acompanantes">
              ${a.acompanantes.map(c => `<li>${_escAsistencia(c.nombre)}${c.telefono ? ` · <a href="tel:${_escAsistencia(c.telefono)}">${_escAsistencia(c.telefono)}</a>` : ''}${acomp && acomp.prospectos ? ' <span class="badge badge-prospecto">Prospecto</span>' : ''}</li>`).join('')}
            </ul>` : ''}
          </div>`).join('')}
      </div>` : '<p class="bp-sub">Todavía nadie ha confirmado su asistencia a este evento.</p>'}
    <button class="btn btn-outline" id="descargarAsistenciaBtn" style="width:100%;margin-top:12px;" type="button" ${asistentes.length ? '' : 'disabled'}>Descargar lista de asistencia (CSV)</button>`;
  overlay.classList.add('open');
  box.querySelector('[data-close]')?.addEventListener('click', () => overlay.classList.remove('open'));
  document.getElementById('descargarAsistenciaBtn')?.addEventListener('click', () => descargarAsistenciaEventoEquipoCSV(evento, formatearFecha));
}

function descargarAsistenciaEventoEquipoCSV(evento, formatearFecha) {
  const asistentes = asistentesEventoEquipo(evento);
  if (!asistentes.length) return;
  const acomp = configAcompanantesEvento(evento);
  const f = typeof formatearFecha === 'function' ? formatearFecha : (x => x || '');
  const encabezado = ['Evento', 'Fecha del evento', 'Nombre', 'Tipo', 'Acompañante de', 'Teléfono', 'Prospecto', 'Fecha de confirmación'];
  const cuerpo = asistentes.flatMap(a => [
    [evento.titulo, evento.fecha, a.nombre, 'Emprendedora/Líder', '', '', '', a.fecha ? f(a.fecha) : ''],
    ...a.acompanantes.map(c => [evento.titulo, evento.fecha, c.nombre, 'Acompañante', a.nombre, c.telefono || '', acomp && acomp.prospectos ? 'Sí' : 'No', ''])
  ]);
  const csv = '﻿' + [encabezado, ...cuerpo].map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `asistencia-${evento.id}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
