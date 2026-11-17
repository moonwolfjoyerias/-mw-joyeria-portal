// MW JOYERÍA — Datos del árbol de mi-equipo (la verdad para rangos, comisiones y boletos)
//
// El árbol de "mi-equipo" (proyecto gala-mw-2026, arbolEquipo/team-tree-v2)
// es la calculadora aprobada de rangos y comisiones. Este archivo lo lee y
// expone sus resultados por persona del portal (window.ArbolMW), para que
// el resto de la página (Mi cuenta, Inicio, Plan MW, ascensos, comisiones,
// rifa) use esos números en vez de calcularlos con sus propias compras.
//
// - A cada e/l se le encuentra en el árbol por el vínculo que pone Admin
//   en BRILLO (portalPersonaId); si no tiene, por su usuario igual a la
//   "Membresía", y si no, por su nombre completo.
// - Quien NO esté en el árbol sigue con los cálculos de siempre de la página.
// - arbolMWListo se resuelve con la primera lectura (o a los 6 s, para no
//   dejar la página colgada sin internet); personas-ejemplo.js lo espera
//   junto con personasRepoListo, así todas las páginas ya lo tienen al pintar.
//
// Los cálculos son copia fiel de mi-equipo/index.html (y de BRILLO
// src/arbol/modelo.ts). Si cambia uno, cambian los tres.
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
  // Claves del árbol ↔ claves de la página (RANGOS_MW).
  const A_PAGINA = { sinRango: 'sin_rango', plata: 'plata', oro: 'oro', diamante: 'diamante', corona: 'corona' };

  let miembros = [];
  let cargado = false;
  let cache = new Map();
  let hijosCache = null;

  const mesKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const etiquetaMes = k => { const [y, m] = k.split('-').map(Number); const n = MESES[m - 1]; return n ? `${n[0].toUpperCase()}${n.slice(1)} ${y}` : k; };
  const mesAnterior = k => { const [y, m] = k.split('-').map(Number); return mesKey(new Date(y, m - 2, 1)); };
  const mesSiguiente = k => { const [y, m] = k.split('-').map(Number); return mesKey(new Date(y, m, 1)); };
  const piso = n => { if (n === null || n === undefined || n === '') return null; const x = Number(n); return Number.isNaN(x) ? null : Math.floor(x); };
  const normalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const memo = (clave, f) => { if (!cache.has(clave)) cache.set(clave, f()); return cache.get(clave); };

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
    if (hijosCache) return hijosCache;
    const h = new Map();
    miembros.forEach(m => { if (m.leaderId) { if (!h.has(m.leaderId)) h.set(m.leaderId, []); h.get(m.leaderId).push(m); } });
    hijosCache = h;
    return h;
  }
  function conLinea(raiz) {
    return memo('linea|' + raiz, () => {
      const h = hijosDe();
      const prof = new Map([[raiz, 0]]);
      const cola = [raiz];
      while (cola.length) {
        const id = cola.shift();
        (h.get(id) || []).forEach(x => { if (!prof.has(x.id)) { prof.set(x.id, prof.get(id) + 1); cola.push(x.id); } });
      }
      return prof;
    });
  }
  function mesesConPuntos() {
    return memo('meses', () => {
      const s = new Set([mesKey(new Date())]);
      miembros.forEach(m => { if (m.pointsHistory) Object.keys(m.pointsHistory).forEach(k => s.add(k)); if (m.pointsMonthKey) s.add(m.pointsMonthKey); });
      return Array.from(s).sort().reverse();
    });
  }

  // Rango que se recalifica en el mes k (igual que getMonthlyRankInfo de mi-equipo).
  function rangoDelMes(liderId, k) {
    return memo('rango|' + liderId + '|' + k, () => {
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
    });
  }
  const rangoManual = (m, k) => (m && m.manualRank && POR_KEY[m.manualRank[k]] ? m.manualRank[k] : null);

  // El mejor rango logrado (calculado o capturado a mano) hasta ese mes, y en qué mes.
  function rangoHistorico(id, hasta) {
    return memo('hist|' + id + '|' + hasta, () => {
      const lider = miembros.find(m => m.id === id);
      if (!lider) return { rango: SIN_RANGO, mesKey: null };
      const meses = new Set(mesesConPuntos());
      if (lider.manualRank) Object.keys(lider.manualRank).forEach(k => meses.add(k));
      let mejor = SIN_RANGO, mejorMes = null;
      Array.from(meses).sort().forEach(k => {
        if (k > hasta) return;
        const man = rangoManual(lider, k);
        if (man && ORDEN[man] > ORDEN[mejor.key]) { mejor = POR_KEY[man]; mejorMes = k; }
        const calc = rangoDelMes(id, k).rango;
        if (ORDEN[calc.key] > ORDEN[mejor.key]) { mejor = calc; mejorMes = k; }
      });
      return { rango: mejor, mesKey: mejorMes };
    });
  }

  // Comisiones del mes k: con el rango recalificado el mes anterior (o el capturado a mano para k).
  function comisionesDelMes(id, k) {
    return memo('com|' + id + '|' + k, () => {
      const lider = miembros.find(m => m.id === id);
      let info = rangoDelMes(id, mesAnterior(k));
      const man = rangoManual(lider, k);
      if (man) info = Object.assign({}, info, { rango: POR_KEY[man] });
      const propia = puntos(lider, k);
      const prof = conLinea(id);
      const equipo = miembros.filter(m => prof.has(m.id) && m.id !== id).map(m => Object.assign({ linea: prof.get(m.id) }, puntos(m, k)));
      const min = (info.rango.key === 'diamante' || info.rango.key === 'corona') ? 3000 : MIN_CALIFICADA;
      const periodo = (campo, compra) => (compra < min ? 0 : equipo.reduce((s, t) => s + (t[campo] * (t.linea <= 5 ? (TASAS[t.linea][info.rango.key] || 0) : 0) / 100) / (1 + IVA), 0));
      const p1 = periodo('p1', propia.p1), p2 = periodo('p2', propia.p2);
      return { info, esManual: !!man, periodo1: p1, periodo2: p2, total: p1 + p2 };
    });
  }
  const tasasTexto = k => { const t = [1, 2, 3, 4, 5].map(l => TASAS[l][k]).filter(r => r > 0); return t.length ? t.map(r => r + '%').join(' – ') : 'Ninguno'; };
  // Un boleto al llegar a 3,000 puntos en el mes y uno más por cada 1,000.
  const boletos = total => (total < 3000 ? 0 : Math.floor((total - 3000) / 1000) + 1);

  // ---------- persona del portal → persona del árbol ----------
  function miembroDePersona(persona) {
    if (!cargado || !persona) return null;
    return memo('persona|' + persona.id, () => {
      const vinculada = miembros.find(m => m.portalPersonaId === persona.id);
      if (vinculada) return vinculada;
      const libres = miembros.filter(m => !m.portalPersonaId);
      const u = String(persona.usuario || '').trim().toUpperCase();
      if (u) {
        const porCodigo = libres.filter(m => String(m.clientCode || '').trim().toUpperCase() === u);
        if (porCodigo.length === 1) return porCodigo[0];
      }
      const nombre = typeof nombreCompletoPersona === 'function' ? nombreCompletoPersona(persona) : [persona.nombre, persona.apellidos].filter(Boolean).join(' ');
      const n = normalizar(nombre);
      const porNombre = n ? libres.filter(m => normalizar(m.fullName) === n) : [];
      return porNombre.length === 1 ? porNombre[0] : null;
    });
  }

  // ---------- API para el resto de la página ----------
  window.ArbolMW = {
    // Utilidades y cálculos crudos (la tarjeta "Árbol de tu equipo" los usa).
    RANGOS, SIN_RANGO, POR_KEY, ORDEN, TOPE_LINEA, MIN_ACTIVA, MIN_CALIFICADA,
    mesKey, etiquetaMes, mesAnterior, mesSiguiente, normalizar, puntos, conLinea, hijosDe, mesesConPuntos,
    rangoDelMes, rangoHistorico, comisionesDelMes, tasasTexto, boletos,
    get miembros() { return miembros; },
    get cargado() { return cargado; },
    miembroDePersona,
    aPagina: k => A_PAGINA[k] || 'sin_rango',

    // Lo mismo que calcularStatsRangoLider(persona, mes) pero con los puntos del árbol.
    statsRango(persona, k) {
      const m = miembroDePersona(persona);
      if (!m) return null;
      const r = rangoDelMes(m.id, k);
      return {
        personasActivas: r.activas,
        produccionGrupalMes: r.produccion,
        personasCalificadas: r.calificadas,
        compraPersonalPeriodo1: r.compraP1,
        compraPersonalPeriodo2: r.compraP2,
        produccionValidaRango: r.validaMes,
        deArbol: true
      };
    },
    // Rango recalificado en ese mes (clave de la página).
    rangoMes(persona, k) { const m = miembroDePersona(persona); return m ? A_PAGINA[rangoDelMes(m.id, k).rango.key] : null; },
    // Rango vigente en ese mes: el recalificado el mes anterior, o el que Admin capturó a mano.
    rangoVigente(persona, k) {
      const m = miembroDePersona(persona);
      if (!m) return null;
      const c = comisionesDelMes(m.id, k);
      return { rangoKey: A_PAGINA[c.info.rango.key], esManual: c.esManual, mesBase: mesAnterior(k) };
    },
    // Mejor rango logrado hasta ese mes (clave de la página) y el mes en que lo logró.
    rangoHistoricoPersona(persona, hasta) {
      const m = miembroDePersona(persona);
      if (!m) return null;
      const h = rangoHistorico(m.id, hasta || mesKey(new Date()));
      return { rangoKey: A_PAGINA[h.rango.key], label: h.rango.label, mesKey: h.mesKey };
    },
    // Boletos de rifa de ese mes según los puntos del árbol.
    boletosMes(persona, k) { const m = miembroDePersona(persona); if (!m) return null; const p = puntos(m, k); return boletos(p.p1 + p.p2); },
    puntosMes(persona, k) { const m = miembroDePersona(persona); return m ? puntos(m, k) : null; },
    // Rango a mostrar en su portal: el mayor entre el registrado en la página y el que ya calificó en mi-equipo.
    rangoMostrar(persona) {
      const registrado = (persona && persona.rangoActualKey) || 'sin_rango';
      const h = this.rangoHistoricoPersona(persona);
      if (!h) return registrado;
      const orden = ['sin_rango', 'plata', 'oro', 'diamante', 'corona'];
      return orden.indexOf(h.rangoKey) > orden.indexOf(registrado) ? h.rangoKey : registrado;
    }
  };

  // ---------- carga ----------
  let resolver;
  window.arbolMWListo = new Promise(r => { resolver = r; });
  setTimeout(() => resolver(false), 6000);

  function arrancar() {
    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') { resolver(false); return; }
    let db;
    try {
      const app = firebase.apps.find(a => a.name === 'mi-equipo') || firebase.initializeApp(FIREBASE_MI_EQUIPO, 'mi-equipo');
      db = app.firestore();
    } catch (e) { resolver(false); return; }
    db.collection('arbolEquipo').doc('team-tree-v2').onSnapshot(s => {
      let lista;
      try { lista = s.exists ? JSON.parse(s.data().value || '[]') : []; } catch (e) { lista = []; }
      miembros = (Array.isArray(lista) ? lista : []).filter(m => m && typeof m.id === 'string').map(m => Object.assign({}, m, { fullName: String(m.fullName || '') }));
      cache = new Map();
      hijosCache = null;
      const primera = !cargado;
      cargado = true;
      resolver(true);
      if (!primera) window.dispatchEvent(new CustomEvent('mw:arbol-actualizado'));
    }, () => resolver(false));
  }
  arrancar();
})();
