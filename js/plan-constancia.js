// MW JOYERÍA — Plan de Constancia (lo que ve cada e/l en Mi cuenta)
//
// Lo administra BRILLO (Emprendedoras → Plan de constancia): se importa la
// hoja "PLAN DE CONSTANCIA" del Excel de Administración y luego Admin carga
// lo que va del mes al corte del día 14 y al cierre. Vive en
// planConstancia/{personaId} (solo la persona y Administración lo leen).
//
// Reglas: cada $8,000 acumulados es "1 compra"; los premios salen por
// compras (6, 8, 10, 12). Cada mes del reto pide $8,000, pero lo que sobró
// cubre lo que falte (en el mes N hay que llevar N × $8,000). Un mes sin
// compras hace perder el reto. Los meses libres no se exigen. Quien
// completó el reto sigue acumulando. Misma cuenta que BRILLO
// src/constancia/plan.ts: si cambia una, cambia la otra.
(function () {
  const META = 8000;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const mesKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const sumarMeses = (mk, n) => { const [y, m] = mk.split('-').map(Number); return mesKey(new Date(y, m - 1 + n, 1)); };
  const etiquetaMes = mk => { const [y, m] = mk.split('-').map(Number); const n = MESES[m - 1]; return n ? `${n[0].toUpperCase()}${n.slice(1)} ${y}` : mk; };
  const dinero = n => '$' + Math.round(n).toLocaleString('es-MX');
  const montoDe = m => (m && Number.isFinite(Number(m.monto)) ? Math.max(0, Number(m.monto)) : 0);

  function calcular(plan, hitos, hoy) {
    hoy = hoy || mesKey(new Date());
    const ultimo = hitos.length ? hitos[hitos.length - 1].meses : 0;
    let acumulado = 0, exigidos = 0, caidaEn = null, motivoCaida = null, montoMesActual = 0, requeridoActual = 0;
    for (let mk = plan.inicio, v = 0; mk <= hoy && v < 600; mk = sumarMeses(mk, 1), v++) {
      const m = (plan.meses || {})[mk];
      const monto = montoDe(m);
      const enCurso = mk === hoy;
      if (enCurso) montoMesActual = monto;
      if (m && m.libre) { acumulado += monto; if (enCurso) requeridoActual = exigidos * META; continue; }
      exigidos++;
      acumulado += monto;
      const requerido = exigidos * META;
      if (enCurso) { requeridoActual = requerido; break; }
      if (ultimo && acumulado - monto >= ultimo * META) continue;
      if ((m && m.sinCompra) || monto <= 0) { caidaEn = mk; motivoCaida = `En ${etiquetaMes(mk)} no hubo compras.`; break; }
      if (acumulado < requerido) { caidaEn = mk; motivoCaida = `Al cerrar ${etiquetaMes(mk)} llevabas ${dinero(acumulado)} y el reto pedía ${dinero(requerido)}.`; break; }
    }
    const compras = Math.floor(acumulado / META);
    const siguiente = hitos.find(h => compras < h.meses) || null;
    const completado = !!ultimo && compras >= ultimo;
    return {
      estado: caidaEn ? 'caida' : 'activa', caidaEn, motivoCaida, acumulado, compras, mesDelReto: exigidos, montoMesActual,
      faltaMes: caidaEn || (ultimo && acumulado - montoMesActual >= ultimo * META) ? 0 : Math.max(0, requeridoActual - acumulado),
      requeridoActual, completado, siguiente, faltaSiguiente: siguiente ? Math.max(0, siguiente.meses * META - acumulado) : 0
    };
  }

  let miPlan = null;
  let resolver;
  const listo = new Promise(r => { resolver = r; });
  setTimeout(() => resolver(false), 6000);
  window.mwEsperas = window.mwEsperas || [];
  window.mwEsperas.push(listo);

  // Lee el plan propio (la sesión es de una e/l). Al cargar la página, porque
  // auth-service.js (obtenerSesionActiva) se carga después de este archivo.
  async function cargar() {
    try {
      if (typeof dbFirestore === 'undefined' || !dbFirestore || typeof obtenerSesionActiva !== 'function') { resolver(false); return; }
      // Las reglas piden sesión de Firebase: se espera a que esté lista.
      if (typeof authFirebase !== 'undefined' && authFirebase && !authFirebase.currentUser) {
        await new Promise(ok => { const corte = authFirebase.onAuthStateChanged(u => { if (u) { corte(); ok(); } }); setTimeout(ok, 5000); });
      }
      const sesion = obtenerSesionActiva();
      if (!sesion || !sesion.personaId) { resolver(false); return; }
      const s = await dbFirestore.collection('planConstancia').doc(String(sesion.personaId)).get();
      miPlan = s.exists && typeof s.data().inicio === 'string' ? s.data() : null;
    } catch (e) {
      miPlan = null;
    }
    resolver(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cargar); else cargar();

  const hitosConfigurados = () => (typeof obtenerHitosConstanciaConfigurados === 'function' ? obtenerHitosConstanciaConfigurados() : (typeof HITOS_CONSTANCIA_PERSONA !== 'undefined' ? HITOS_CONSTANCIA_PERSONA : []));
  const poner = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };

  // Pinta "Reto de Constancia" de Mi cuenta con el plan. Devuelve false si no hay plan
  // (entonces la página sigue con su cálculo anterior).
  function render() {
    if (!miPlan) return false;
    const hitos = hitosConfigurados();
    const r = calcular(miPlan, hitos);
    const entregados = miPlan.entregados || {};
    const fill = document.getElementById('constanciaFill');
    const nodos = document.getElementById('constanciaNodes');
    if (!fill || !nodos) return false;

    // Avance a lo largo de los premios (0 → 6 → 8 → 10 → 12 compras), con fracción de la compra en curso.
    const puntos = [0, ...hitos.map(h => h.meses)];
    const comprasExactas = r.acumulado / META;
    let seg = puntos.length - 2;
    for (let i = 0; i < puntos.length - 1; i++) { if (comprasExactas <= puntos[i + 1]) { seg = i; break; } }
    const frac = puntos[seg + 1] > puntos[seg] ? Math.min(1, (comprasExactas - puntos[seg]) / (puntos[seg + 1] - puntos[seg])) : 1;
    fill.style.width = `${Math.min(100, ((seg + frac) / (puntos.length - 1)) * 100)}%`;
    nodos.innerHTML = hitos.map(h => {
      const alcanzado = r.compras >= h.meses;
      const entregado = !!entregados[String(h.meses)];
      return `
      <div class="timeline-node ${alcanzado ? 'reached' : ''}">
        <div class="node-circle">
          ${alcanzado ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' : `<span style="font-family:var(--font-heading); font-weight:700; font-size:0.85rem;">${h.meses}</span>`}
        </div>
        <span class="node-label">${h.meses}° compra<br>${h.premio}${alcanzado ? `<br><small>${entregado ? 'Entregado' : 'Por recoger'}</small>` : ''}</span>
      </div>`;
    }).join('');

    poner('constanciaResumen', r.estado === 'caida'
      ? `Tu reto terminó en ${etiquetaMes(r.caidaEn)} con ${r.compras} compra${r.compras === 1 ? '' : 's'} (${dinero(r.acumulado)} acumulados).`
      : `Llevas ${dinero(r.acumulado)} acumulados: ${r.compras} compra${r.compras === 1 ? '' : 's'} de ${dinero(META)}. Vas en tu mes ${r.mesDelReto} del reto.`);
    const nota = document.getElementById('constanciaNota');
    if (nota) {
      if (r.estado === 'caida') nota.textContent = `${r.motivoCaida} Pregunta en el local cómo empezar un reto nuevo.`;
      else if (r.completado) nota.textContent = `¡Completaste todas las recompensas! Tus compras se siguen acumulando.`;
      else nota.textContent = `Te faltan ${dinero(r.faltaSiguiente)} para tu siguiente recompensa: ${r.siguiente.premio} (${r.siguiente.meses} compras).`;
    }

    // Este mes: lo que lleva contra lo que el reto pide para no perderse.
    const meta = r.estado === 'caida' ? META : Math.max(r.montoMesActual + r.faltaMes, r.faltaMes ? 0 : r.montoMesActual, 1);
    const pct = r.faltaMes ? Math.min(100, (r.montoMesActual / meta) * 100) : 100;
    const barra = document.getElementById('mesFill');
    if (barra) barra.style.width = `${r.estado === 'caida' ? 0 : pct}%`;
    poner('mesMontoActual', dinero(r.montoMesActual));
    poner('mesMontoMeta', r.estado === 'caida' ? '—' : r.faltaMes ? `Te faltan ${dinero(r.faltaMes)}` : 'Mes cubierto');
    const logro = document.getElementById('mesFechaLogro');
    if (logro) {
      logro.style.display = r.estado === 'caida' ? 'none' : '';
      logro.textContent = r.faltaMes
        ? `Para no perder tu reto, este mes necesitas ${dinero(r.faltaMes)} más en compras (lo que te sobró de meses anteriores ya cuenta).`
        : (r.completado ? 'Tus compras de este mes se siguen sumando.' : 'Con lo que llevas acumulado, este mes ya está cubierto. Lo que compres de más se suma para los siguientes.');
      if (!r.faltaMes && r.montoMesActual <= 0 && !r.completado) logro.textContent = 'Con tu acumulado este mes ya está cubierto, pero necesitas hacer al menos una compra antes de que termine el mes para no perder tu reto.';
    }
    return true;
  }

  window.PlanConstanciaMW = { listo, calcular, render, get plan() { return miPlan; } };
})();
