// MW JOYERÍA — Inscribir a una Emprendedora debajo de otra persona
// ================================================================
// Si la persona elegida como líder todavía es Emprendedora, se pregunta:
// "X aún no es líder, ¿deseas ascenderla?" con "Cambiar cuenta a Líder"
// (la asciende, igual que "Convertir en Líder" de Emprendedoras/Líderes)
// o "Poner otra líder" (se regresa a elegir). Lo usan Configuración
// (Crear cuenta) y Solicitudes (Aprobar).
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const nombreDe = p => (typeof nombreCompletoPersona === 'function' ? nombreCompletoPersona(p) : [p.nombre, p.apellidos].filter(Boolean).join(' '));
  const personas = () => (typeof obtenerPersonas === 'function' ? obtenerPersonas() : []);

  function dialogo(html) {
    const fondo = document.createElement('div');
    fondo.className = 'lider-fondo';
    fondo.innerHTML = `<div class="lider-caja" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(fondo);
    return { fondo, caja: fondo.firstElementChild, cerrar: () => fondo.remove() };
  }

  /** Pregunta si se asciende a la Emprendedora. Resuelve 'ascender', 'otra' o null (cerró). */
  function preguntarAscender(persona) {
    return new Promise(resolve => {
      const d = dialogo(`
        <h3>${esc(nombreDe(persona))} aún no es líder</h3>
        <p class="lider-texto">¿Deseas ascenderla? Para inscribir a alguien debajo de ella, su cuenta tiene que ser de Líder.</p>
        <div class="lider-acciones">
          <button type="button" class="btn btn-outline" data-r="otra">Poner otra líder</button>
          <button type="button" class="btn btn-primary" data-r="ascender">Cambiar cuenta a Líder</button>
        </div>`);
      d.fondo.addEventListener('click', e => {
        const r = e.target.closest('[data-r]')?.dataset.r || (e.target === d.fondo ? null : undefined);
        if (r === undefined) return;
        d.cerrar();
        resolve(r);
      });
    });
  }

  /** Asciende a Líder (mismo cambio que "Convertir en Líder"). */
  function ascenderALider(personaId) {
    const lista = personas();
    const actual = lista.find(p => p.id === personaId);
    if (!actual) return null;
    actual.tipo = 'lider';
    actual.rangoActualKey = actual.rangoActualKey || 'sin_rango';
    actual.stats = actual.stats || { personasActivas: 0, produccionGrupalMes: 0, personasCalificadas: 0, compraPersonalPeriodo1: 0, compraPersonalPeriodo2: 0 };
    if (typeof guardarPersonas === 'function') guardarPersonas(lista);
    if (typeof registrarAuditoriaAdmin === 'function') {
      registrarAuditoriaAdmin({ modulo: 'personas', accion: 'convertir_lider', descripcion: `${nombreDe(actual)} fue convertida de Emprendedora a Líder (para inscribir a alguien en su equipo)` });
    }
    return actual;
  }

  /**
   * ¿Se puede usar a esta persona como líder? Si es Emprendedora, pregunta.
   * true = sí (ya era líder o se ascendió); false = elegir otra.
   */
  async function confirmarLider(personaId) {
    if (!personaId) return true;
    const p = personas().find(x => x.id === personaId);
    if (!p || p.tipo === 'lider') return true;
    const r = await preguntarAscender(p);
    if (r !== 'ascender') return false;
    return !!ascenderALider(personaId);
  }

  /** Personas que pueden quedar como líder: activas (las Emprendedoras se ascienden al elegirlas). */
  function candidatas() {
    return personas()
      .filter(p => p.estado !== 'baja')
      .map(p => ({ id: p.id, nombre: nombreDe(p), tipo: p.tipo, usuario: p.usuario || '' }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }

  function opciones(lista, textoNinguna) {
    return `<option value="">${esc(textoNinguna)}</option>` +
      lista.map(l => `<option value="${esc(l.id)}">${esc(l.nombre)}${l.usuario ? ` · ${esc(l.usuario)}` : ''} — ${l.tipo === 'lider' ? 'Líder' : 'Emprendedora'}</option>`).join('');
  }

  /**
   * Paso "¿Debajo de quién queda?" (Solicitudes): buscar y elegir a
   * cualquier e/l activa. Resuelve { liderId } (null = sin líder) o null si cancela.
   */
  function elegirLider({ titulo, mensaje, preseleccionId = '', buscarInicial = '' }) {
    return new Promise(resolve => {
      const lista = candidatas();
      const d = dialogo(`
        <h3>${esc(titulo)}</h3>
        ${mensaje ? `<p class="lider-texto">${mensaje}</p>` : ''}
        <label class="lider-campo">Buscar
          <input type="search" placeholder="Nombre o membresía" autocomplete="off" value="${esc(buscarInicial)}">
        </label>
        <label class="lider-campo">Queda debajo de
          <select></select>
        </label>
        <div class="lider-acciones">
          <button type="button" class="btn btn-outline" data-r="cancelar">Cancelar</button>
          <button type="button" class="btn btn-primary" data-r="continuar">Continuar</button>
        </div>`);
      const input = d.caja.querySelector('input');
      const select = d.caja.querySelector('select');
      const pintar = () => {
        const t = normal(input.value);
        const previa = select.value;
        const coinciden = t ? lista.filter(l => normal(`${l.nombre} ${l.usuario}`).includes(t)) : lista;
        select.innerHTML = opciones(coinciden, '— Sin líder por ahora —');
        if (coinciden.some(l => l.id === previa)) select.value = previa;
        else if (t && coinciden.length) select.value = coinciden[0].id;
      };
      pintar();
      if (preseleccionId && lista.some(l => l.id === preseleccionId)) {
        input.value = '';
        pintar();
        select.value = preseleccionId;
      }
      input.addEventListener('input', pintar);
      d.caja.addEventListener('click', async e => {
        const r = e.target.closest('[data-r]')?.dataset.r;
        if (r === 'cancelar') { d.cerrar(); resolve(null); }
        if (r === 'continuar') {
          const id = select.value || null;
          d.fondo.style.visibility = 'hidden';
          const ok = await confirmarLider(id);
          d.fondo.style.visibility = '';
          if (!ok) { input.focus(); input.select(); return; }
          d.cerrar();
          resolve({ liderId: id });
        }
      });
      input.focus();
    });
  }

  window.MWLider = { confirmarLider, elegirLider, ascenderALider, candidatas, opciones };
})();
