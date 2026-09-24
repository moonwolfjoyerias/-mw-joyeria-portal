// MW JOYERÍA — Mi cuenta
// Depende de CUENTA_EJEMPLO (cuenta-ejemplo.js) solo para los datos de
// perfil (nombre, líder, teléfono, correo) — la foto de perfil, la Rifa
// mensual y el Reto de Constancia usan el registro REAL de la persona
// con sesión abierta (personas-ejemplo.js + plan-mw-admin.js, vía
// obtenerIdPersonaActualPortal()), no RIFA_EJEMPLO/CONSTANCIA_EJEMPLO.

document.addEventListener('DOMContentLoaded', () => {
  renderPerfil();
  renderRifa();
  renderConstancia();
  renderRifaMesCuenta();

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
      renderPerfil();
    };
    lector.readAsDataURL(archivo);
  });
});

function renderPerfil() {
  const iniciales = typeof obtenerInicialesPerfil === 'function' ? obtenerInicialesPerfil(CUENTA_EJEMPLO.nombre) : CUENTA_EJEMPLO.nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  const idActual = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
  const persona = idActual && typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(idActual) : null;
  const fotoBox = document.getElementById('perfilIniciales');
  if (fotoBox) {
    fotoBox.innerHTML = persona?.fotoUrl
      ? `<img src="${persona.fotoUrl}" alt="Foto de ${CUENTA_EJEMPLO.nombre}" style="width:100%;height:100%;object-fit:cover;">`
      : iniciales;
  }

  setText('perfilNombre', CUENTA_EJEMPLO.nombre);
  setText('perfilLider', `Equipo de ${CUENTA_EJEMPLO.lider}`);
  setText('perfilTelefono', CUENTA_EJEMPLO.telefono);
  setText('perfilCorreo', CUENTA_EJEMPLO.correo);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// Persona real con sesión abierta, con su Plan MW (Rifa/Constancia) al
// día — misma función de cierre idempotente que usa Admin en cada
// carga (js/plan-mw-admin.js), así nunca se desincroniza de lo que ve
// Administración de esta misma persona.
function obtenerPersonaConPlanMWAlDia() {
  const idActual = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
  if (!idActual || typeof obtenerPersonas !== 'function') return null;
  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === idActual);
  if (!persona) return null;
  if (typeof procesarCierresMensualesPlanMW === 'function' && procesarCierresMensualesPlanMW(persona)) {
    guardarPersonas(personas);
  }
  return persona;
}

// ---------- Rifa mensual ----------
function renderRifa() {
  const persona = obtenerPersonaConPlanMWAlDia();
  if (!persona) return;

  // Admin → Configuración → Plan MW es dueña de estas dos reglas; si no
  // está cargada aquí, se usan los mismos valores fijos de siempre.
  const meta = (typeof obtenerValorVigente === 'function' && obtenerValorVigente('rifa', 'meta_mensual')) || (persona.rifa && persona.rifa.meta) || 3000;
  const montoPorBoletoExtra = (typeof obtenerValorVigente === 'function' && obtenerValorVigente('rifa', 'monto_por_boleto_extra')) || 1000;
  const montoAcumuladoMes = (persona.rifa && persona.rifa.montoAcumuladoMes) || 0;

  const pctBase = Math.min(100, (montoAcumuladoMes / meta) * 100);

  document.getElementById('rifaFill').style.width = `${pctBase}%`;
  setText('rifaMontoActual', `$${montoAcumuladoMes.toLocaleString('es-MX')}`);
  setText('rifaMontoMeta', `$${meta.toLocaleString('es-MX')}`);

  const msg = document.getElementById('rifaMensaje');
  if (montoAcumuladoMes < meta) {
    const faltante = meta - montoAcumuladoMes;
    msg.textContent = `Te faltan $${faltante.toLocaleString('es-MX')} en compras este mes para ganar tu boleto de la rifa.`;
  } else {
    const extra = montoAcumuladoMes - meta;
    const boletosExtra = Math.floor(extra / montoPorBoletoExtra);
    const totalBoletos = 1 + boletosExtra;
    const faltanteSiguiente = montoPorBoletoExtra - (extra % montoPorBoletoExtra);
    let texto = totalBoletos === 1
      ? '¡Ya tienes tu boleto para la rifa de este mes! <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v1a1.5 1.5 0 000 3v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a1.5 1.5 0 000-3V9z"/><path d="M9 7v10"/></svg></span>'
      : `¡Llevas ${totalBoletos} boletos para la rifa de este mes! <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v1a1.5 1.5 0 000 3v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a1.5 1.5 0 000-3V9z"/><path d="M9 7v10"/></svg></span>`;
    texto += ` Te faltan $${faltanteSiguiente.toLocaleString('es-MX')} para tu siguiente boleto extra.`;
    msg.innerHTML = texto;
  }
}

// ---------- Reto de Constancia ----------
function renderConstancia() {
  const persona = obtenerPersonaConPlanMWAlDia();
  if (!persona) return;

  // Admin → Configuración → Plan MW puede tener premios propios por
  // hito; si no, se usan los mismos hitos reales de siempre.
  const hitos = typeof obtenerHitosConstanciaConfigurados === 'function' ? obtenerHitosConstanciaConfigurados() : HITOS_CONSTANCIA_PERSONA;
  const mesesCumplidos = (persona.constancia && persona.constancia.mesesCumplidos) || 0;
  const montoMesActual = (persona.constancia && persona.constancia.montoMesActual) || 0;
  const metaMes = (persona.constancia && persona.constancia.metaMes) || 8000;

  // Progreso general a lo largo de la línea (0 -> primer hito -> ... -> último hito)
  const puntosLinea = [0, ...hitos.map(h => h.meses)];
  let segmentoActual = puntosLinea.length - 2;
  for (let i = 0; i < puntosLinea.length - 1; i++) {
    if (mesesCumplidos <= puntosLinea[i + 1]) { segmentoActual = i; break; }
  }
  const inicioSeg = puntosLinea[segmentoActual];
  const finSeg = puntosLinea[segmentoActual + 1];
  const fracSeg = finSeg > inicioSeg ? (mesesCumplidos - inicioSeg) / (finSeg - inicioSeg) : 1;
  const pctGeneral = Math.min(100, ((segmentoActual + fracSeg) / (puntosLinea.length - 1)) * 100);

  document.getElementById('constanciaFill').style.width = `${pctGeneral}%`;

  const nodesWrap = document.getElementById('constanciaNodes');
  nodesWrap.innerHTML = hitos.map(h => {
    const alcanzado = mesesCumplidos >= h.meses;
    return `
      <div class="timeline-node ${alcanzado ? 'reached' : ''}">
        <div class="node-circle">
          ${alcanzado
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
            : `<span style="font-family:var(--font-heading); font-weight:700; font-size:0.85rem;">${h.meses}</span>`}
        </div>
        <span class="node-label">${h.meses}° compra<br>${h.premio}</span>
      </div>
    `;
  }).join('');

  setText('constanciaResumen', `Llevas ${mesesCumplidos} compras cumplidas de por vida.`);

  const siguienteHito = hitos.find(h => h.meses > mesesCumplidos);
  const nota = document.getElementById('constanciaNota');
  if (siguienteHito) {
    const faltan = siguienteHito.meses - mesesCumplidos;
    nota.textContent = `Te falta${faltan === 1 ? '' : 'n'} ${faltan} compra${faltan === 1 ? '' : 's'} cumplida${faltan === 1 ? '' : 's'} para tu siguiente recompensa: ${siguienteHito.premio}.`;
  } else {
    nota.textContent = '¡Has alcanzado todas las recompensas! Pronto habrá una nueva categoría.';
  }

  const pctMes = Math.min(100, (montoMesActual / metaMes) * 100);
  document.getElementById('mesFill').style.width = `${pctMes}%`;
  setText('mesMontoActual', `$${montoMesActual.toLocaleString('es-MX')}`);
  setText('mesMontoMeta', `$${metaMes.toLocaleString('es-MX')}`);

  const fechaLogroEl = document.getElementById('mesFechaLogro');
  if (fechaLogroEl) {
    const fechaLogro = typeof obtenerFechaLogroMesActual === 'function' ? obtenerFechaLogroMesActual(persona) : null;
    if (fechaLogro) {
      const texto = new Date(fechaLogro).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
      fechaLogroEl.textContent = `Llegaste a tus $8,000 de este mes el ${texto}.`;
      fechaLogroEl.style.display = '';
    } else {
      fechaLogroEl.style.display = 'none';
    }
  }
}

// ---------- Rifa del mes (solicitud o votación, según decida Admin) ----------
function formatearMesLabelRifaCuenta(mesKey) {
  const [anio, mes] = mesKey.split('-').map(Number);
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${nombres[mes - 1].charAt(0).toUpperCase()}${nombres[mes - 1].slice(1)} ${anio}`;
}

function renderRifaMesCuenta() {
  if (typeof obtenerConfigRifaMes !== 'function') return;

  const persona = obtenerPersonaConPlanMWAlDia();
  if (!persona) return;

  const mesKey = obtenerMesKeyActualRifaMensual();
  const config = obtenerConfigRifaMes(mesKey);
  setText('rifaMesLabelCuenta', formatearMesLabelRifaCuenta(mesKey));

  const contenido = document.getElementById('rifaMesContenido');
  const sub = document.getElementById('rifaMesSub');
  if (!contenido || !sub) return;

  if (!config.modo) {
    sub.textContent = 'Administración todavía no elige cómo va a funcionar la rifa de este mes.';
    contenido.innerHTML = '';
    return;
  }

  if (config.modo === 'solicitud') {
    sub.textContent = 'Escribe y sube una foto de algo que te gustaría que se rifara este mes.';
    const solicitud = obtenerSolicitudRifaPersona(persona.id, mesKey);

    contenido.innerHTML = `
      <label for="rifaMesTexto">¿Qué te gustaría que se rifara?</label>
      <textarea id="rifaMesTexto" rows="3">${solicitud ? solicitud.texto.replace(/</g, '&lt;') : ''}</textarea>
      <label for="rifaMesFoto" style="margin-top:10px;">Foto (opcional)</label>
      <input type="file" id="rifaMesFoto" accept="image/*">
      ${solicitud && solicitud.fotoUrl ? `<img src="${solicitud.fotoUrl}" alt="Tu foto" class="rifa-solicitud-foto-propia">` : ''}
      <button class="btn btn-primary" type="button" id="rifaMesGuardarBtn" style="margin-top:12px;">${solicitud ? 'Actualizar mi solicitud' : 'Enviar mi solicitud'}</button>
      ${solicitud ? `<p class="bp-sub" style="margin-top:8px;margin-bottom:0;">Enviada el ${new Date(solicitud.actualizadoEn || solicitud.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}.</p>` : ''}
    `;

    let fotoTemporal = solicitud ? solicitud.fotoUrl : '';
    document.getElementById('rifaMesFoto')?.addEventListener('change', (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      if (!archivo.type.startsWith('image/')) { e.target.value = ''; mostrarToast('Selecciona un archivo de imagen válido.'); return; }
      if (archivo.size > 2 * 1024 * 1024) { e.target.value = ''; mostrarToast('La imagen no puede superar 2 MB.'); return; }
      const lector = new FileReader();
      lector.onload = () => { fotoTemporal = lector.result; };
      lector.readAsDataURL(archivo);
    });

    document.getElementById('rifaMesGuardarBtn')?.addEventListener('click', () => {
      const texto = document.getElementById('rifaMesTexto').value.trim();
      const resultado = guardarSolicitudRifaPersona({ personaId: persona.id, personaNombre: nombreCompletoPersona(persona), mesKey, texto, fotoUrl: fotoTemporal });
      if (!resultado.ok) { mostrarToast(resultado.error); return; }
      mostrarToast('¡Gracias! Tu solicitud para la rifa de este mes quedó guardada.');
      renderRifaMesCuenta();
    });

    return;
  }

  // modo votación
  sub.textContent = 'Vota por el regalo que te gustaría que se rifara este mes — puedes cambiar tu voto mientras siga abierta.';
  const voto = obtenerVotoRifaPersona(persona.id, mesKey);

  if (!config.opciones || !config.opciones.length) {
    contenido.innerHTML = '<p class="bp-sub" style="margin:0;">Todavía no hay opciones para votar este mes.</p>';
    return;
  }

  contenido.innerHTML = `<div class="rifa-opciones-grid">${config.opciones.map(op => {
    const esMiVoto = voto && voto.opcionId === op.id;
    return `
      <div class="rifa-opcion-card${esMiVoto ? ' votada' : ''}">
        ${op.fotoUrl ? `<img src="${op.fotoUrl}" alt="${op.nombre.replace(/</g, '&lt;')}">` : '<div class="rifa-opcion-sinfoto">Sin foto</div>'}
        <div class="rifa-opcion-body">
          <strong>${op.nombre.replace(/</g, '&lt;')}</strong>
          ${op.descripcion ? `<p>${op.descripcion.replace(/</g, '&lt;')}</p>` : ''}
        </div>
        <button class="btn ${esMiVoto ? 'btn-outline' : 'btn-primary'}" type="button" data-votar-opcion="${op.id}">${esMiVoto ? 'Tu voto' : 'Votar'}</button>
      </div>
    `;
  }).join('')}</div>`;

  contenido.querySelectorAll('[data-votar-opcion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const opcionId = btn.getAttribute('data-votar-opcion');
      const votoActual = obtenerVotoRifaPersona(persona.id, mesKey);
      if (votoActual && votoActual.opcionId === opcionId) return;
      votarOpcionRifaMes({ personaId: persona.id, personaNombre: nombreCompletoPersona(persona), mesKey, opcionId });
      mostrarToast('¡Listo! Tu voto quedó registrado.');
      renderRifaMesCuenta();
    });
  });
}
