// MW JOYERÍA — Admin: Importar/Exportar árbol completo (Comisiones)
//
// Fusión de la Lista A (prototipo "mi-equipo"): a diferencia del
// original, que REEMPLAZABA todo el árbol con cada importación, aquí
// es aditivo/actualiza y NUNCA borra a nadie — decisión explícita de
// Admin, porque el portal ya guarda login/historial de rango/comisiones
// por persona, algo que el prototipo (dataset plano) no tenía. Lo que sí
// se conserva del original es la "foto de quién estuvo en la última
// importación": cualquiera que quede fuera se marca con un aviso, nunca
// se elimina ni se oculta.
//
// Reutiliza el registro real (js/personas-ejemplo.js: obtenerPersonas,
// guardarPersonas, crearPersonaEjemplo, nombreCompletoPersona) — no crea
// un almacén de árbol paralelo.

const IMPORTAR_ARBOL_STORAGE_KEY = 'mw-importar-arbol-ultima-v1';

// ============================================================
// EMPAREJAR POR NOMBRE (también usado por otras pantallas de Admin)
// ============================================================

function normalizarNombrePersona(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Empareja un nombre completo (columna del Excel) contra el registro
// real de personas. Nunca decide solo entre dos personas con el mismo
// nombre — regresa "ambiguo" y deja que Admin lo resuelva a mano en la
// vista previa, para no fusionar por error registros de gente distinta.
function emparejarPersonaPorNombre(nombreCompleto, personas) {
  const buscado = normalizarNombrePersona(nombreCompleto);
  if (!buscado) return { persona: null, ambiguo: false, candidatos: [] };
  const candidatos = personas.filter(p => normalizarNombrePersona(nombreCompletoPersona(p)) === buscado);
  if (candidatos.length === 1) return { persona: candidatos[0], ambiguo: false, candidatos };
  if (candidatos.length > 1) return { persona: null, ambiguo: true, candidatos };
  return { persona: null, ambiguo: false, candidatos: [] };
}

// ============================================================
// ÚLTIMA IMPORTACIÓN (para el marcador de "no estaba en el archivo")
// ============================================================

function obtenerUltimaImportacionArbol() {
  try {
    const datos = JSON.parse(localStorage.getItem(IMPORTAR_ARBOL_STORAGE_KEY));
    if (datos && Array.isArray(datos.idsIncluidos)) return datos;
  } catch (error) {
    // sigue abajo, no hay importación previa
  }
  return null;
}

function guardarUltimaImportacionArbol(idsIncluidos) {
  localStorage.setItem(IMPORTAR_ARBOL_STORAGE_KEY, JSON.stringify({ fecha: new Date().toISOString(), idsIncluidos }));
}

// true si ya hubo al menos una importación y esta persona quedó fuera
// del archivo más reciente. Nunca oculta ni bloquea nada — solo es la
// señal que pidió Admin para revisar a quién ya no incluye su Excel.
function personaFueraDeUltimaImportacionArbol(personaId) {
  const ultima = obtenerUltimaImportacionArbol();
  if (!ultima) return false;
  return !ultima.idsIncluidos.includes(personaId);
}

// ============================================================
// CSV — lectura/escritura (mismo formato "Excel-compatible" que ya usa
// el resto del portal: CSV con BOM, comillas dobles, coma como
// separador — se abre y guarda sin problema desde Excel).
// ============================================================

function parsearCSVTextoArbol(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let dentroComillas = false;
  const limpio = texto.replace(/^﻿/, '');

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (dentroComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i++; } else { dentroComillas = false; }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      dentroComillas = true;
    } else if (c === ',') {
      fila.push(campo); campo = '';
    } else if (c === '\r') {
      // se ignora, \n cierra la fila
    } else if (c === '\n') {
      fila.push(campo); campo = '';
      filas.push(fila); fila = [];
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }

  return filas.filter(f => f.some(v => String(v).trim() !== ''));
}

function generarCSVArbol(encabezado, cuerpo) {
  const filas = [encabezado, ...cuerpo];
  return '﻿' + filas.map(fila => fila.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

function descargarCSVArbol(csv, nombreArchivo) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const IMPORTAR_ARBOL_ENCABEZADO = ['ID (no editar)', 'Nombre', 'Apellidos', 'Tipo (emprendedora/lider)', 'Líder (nombre completo)', 'Teléfono', 'Correo', 'Categoría (normal/vip/foranea)'];

// ============================================================
// PLANTILLA / EXPORTAR ÁRBOL COMPLETO
// ============================================================
//
// Misma función sirve para "Descargar plantilla" (Admin la llena desde
// cero) y para "Exportar árbol completo" (ya trae a todo el mundo, con
// ID — así una reimportación de ese mismo archivo actualiza por ID en
// vez de por nombre, evitando duplicados por variaciones de escritura).

function exportarArbolCompletoCSV() {
  const personas = obtenerPersonas();
  const porId = {};
  personas.forEach(p => { porId[p.id] = p; });

  const cuerpo = personas
    .slice()
    .sort((a, b) => nombreCompletoPersona(a).localeCompare(nombreCompletoPersona(b)))
    .map(p => {
      const lider = p.liderId ? porId[p.liderId] : null;
      return [p.id, p.nombre, p.apellidos, p.tipo, lider ? nombreCompletoPersona(lider) : '', p.telefono || '', p.correo || '', p.categoria || 'normal'];
    });

  const csv = generarCSVArbol(IMPORTAR_ARBOL_ENCABEZADO, cuerpo);
  descargarCSVArbol(csv, `arbol-completo-mw-${new Date().toISOString().slice(0, 10)}.csv`);
}

function descargarPlantillaArbolCSV() {
  const ejemplo = [
    ['', 'María', 'Ejemplo López', 'lider', '', '444 000 0000', 'maria.ejemplo@correo.com', 'normal'],
    ['', 'Sofía', 'Ejemplo Ramírez', 'emprendedora', 'María Ejemplo López', '444 000 0001', '', 'normal']
  ];
  const csv = generarCSVArbol(IMPORTAR_ARBOL_ENCABEZADO, ejemplo);
  descargarCSVArbol(csv, 'plantilla-arbol-mw.csv');
}

// ============================================================
// IMPORTAR — vista previa (no toca el registro todavía)
// ============================================================
//
// Devuelve una fila por renglón del archivo con la acción que se haría
// (nuevo/actualizado/sin_cambios/ambiguo/error), para que Admin la
// revise y pueda destildar renglones antes de aplicar nada.

function generarIdPersonaImportada(nombre, apellidos) {
  const base = normalizarNombrePersona(`${nombre} ${apellidos}`).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'persona';
  let id = `imp-${base}`;
  let n = 2;
  while (obtenerPersonas().some(p => p.id === id) || id === '__usado__') {
    id = `imp-${base}-${n}`;
    n++;
  }
  return id;
}

function previsualizarImportacionArbol(filas) {
  const personasExistentes = obtenerPersonas();
  const encabezadoDetectado = filas[0] && normalizarNombrePersona(filas[0][1] || '') === 'nombre';
  const filasDatos = encabezadoDetectado ? filas.slice(1) : filas;

  // Pool de trabajo: personas reales + las que este mismo archivo va a
  // crear (para que la columna "Líder" pueda apuntar a alguien que
  // también viene nuevo en el mismo archivo, en cualquier orden).
  const pool = personasExistentes.map(p => ({ ...p, _esNueva: false }));
  const idsUsadosEnArchivo = new Set();

  const filasProcesadas = filasDatos.map((cols, indice) => {
    const [idExcel, nombre, apellidos, tipoRaw, liderNombre, telefono, correo, categoriaRaw] = cols.map(v => (v || '').trim());

    if (!nombre) {
      return { indice, error: 'Falta el nombre.', accion: 'error', cols };
    }

    const tipo = normalizarNombrePersona(tipoRaw) === 'lider' ? 'lider' : 'emprendedora';
    const categoria = ['vip', 'foranea'].includes(normalizarNombrePersona(categoriaRaw)) ? normalizarNombrePersona(categoriaRaw) : 'normal';

    let matchExistente = null;
    if (idExcel) matchExistente = pool.find(p => p.id === idExcel) || null;
    let ambiguo = false;
    let candidatos = [];
    if (!matchExistente) {
      const resultado = emparejarPersonaPorNombre(`${nombre} ${apellidos}`, pool);
      matchExistente = resultado.persona;
      ambiguo = resultado.ambiguo;
      candidatos = resultado.candidatos;
    }

    if (ambiguo) {
      return { indice, error: `Hay ${candidatos.length} personas con ese mismo nombre — indica el ID exacto en la columna "ID" para saber a cuál actualizar.`, accion: 'ambiguo', cols, candidatos };
    }

    const nombreCompletoImportado = `${nombre} ${apellidos}`.trim();

    let filaResultado;
    if (matchExistente) {
      const cambios = {};
      if (matchExistente.nombre !== nombre) cambios.nombre = nombre;
      if (matchExistente.apellidos !== apellidos) cambios.apellidos = apellidos;
      if (matchExistente.tipo !== tipo) cambios.tipo = tipo;
      if (telefono && matchExistente.telefono !== telefono) cambios.telefono = telefono;
      if (correo && matchExistente.correo !== correo) cambios.correo = correo;
      if (matchExistente.categoria !== categoria) cambios.categoria = categoria;

      filaResultado = {
        indice, cols, accion: Object.keys(cambios).length ? 'actualizado' : 'sin_cambios',
        personaId: matchExistente.id, nombreCompleto: nombreCompletoImportado, tipo, liderNombre, cambios
      };

      Object.assign(matchExistente, cambios);
    } else {
      const idNuevo = generarIdPersonaImportada(nombre, apellidos);
      const nuevaPersona = { id: idNuevo, nombre, apellidos, tipo, telefono, correo, categoria, _esNueva: true };
      pool.push(nuevaPersona);
      filaResultado = { indice, cols, accion: 'nuevo', personaId: idNuevo, nombreCompleto: nombreCompletoImportado, tipo, liderNombre, cambios: null };
    }

    idsUsadosEnArchivo.add(filaResultado.personaId);
    return filaResultado;
  });

  // Segunda pasada: resolver el líder de cada fila contra el pool ya
  // completo (existentes + nuevas de este mismo archivo).
  filasProcesadas.forEach(f => {
    if (f.accion === 'error' || f.accion === 'ambiguo') return;
    if (!f.liderNombre) { f.liderId = null; return; }

    if (normalizarNombrePersona(f.liderNombre) === normalizarNombrePersona(f.nombreCompleto)) {
      f.errorLider = 'No puede ser su propia líder — se deja sin cambiar de líder.';
      f.liderId = undefined;
      return;
    }

    const resultado = emparejarPersonaPorNombre(f.liderNombre, pool);
    if (resultado.persona) {
      f.liderId = resultado.persona.id;
    } else {
      f.errorLider = resultado.ambiguo
        ? 'Hay varias personas con el nombre de esa líder — no se pudo asignar automáticamente.'
        : `No se encontró a "${f.liderNombre}" en el árbol ni en este archivo — se deja sin cambiar de líder.`;
      f.liderId = undefined;
    }
  });

  const resumen = {
    total: filasProcesadas.length,
    nuevos: filasProcesadas.filter(f => f.accion === 'nuevo').length,
    actualizados: filasProcesadas.filter(f => f.accion === 'actualizado').length,
    sinCambios: filasProcesadas.filter(f => f.accion === 'sin_cambios').length,
    conProblema: filasProcesadas.filter(f => f.accion === 'error' || f.accion === 'ambiguo').length
  };

  return { filas: filasProcesadas, resumen };
}

// ============================================================
// IMPORTAR — aplicar (persiste solo las filas que Admin dejó marcadas)
// ============================================================

function aplicarImportacionArbol(filasAprobadas) {
  const personas = obtenerPersonas();
  const porId = {};
  personas.forEach(p => { porId[p.id] = p; });

  const idsIncluidos = [];

  filasAprobadas.forEach(f => {
    if (f.accion === 'error' || f.accion === 'ambiguo') return;

    if (f.accion === 'nuevo') {
      const nueva = crearPersonaEjemplo({
        id: f.personaId, nombre: f.cols[1]?.trim(), apellidos: f.cols[2]?.trim(),
        tipo: f.tipo, telefono: f.cols[5]?.trim(), correo: f.cols[6]?.trim(),
        categoria: ['vip', 'foranea'].includes(f.cols[7]?.trim()) ? f.cols[7].trim() : 'normal',
        liderId: f.liderId || null
      });
      personas.push(nueva);
      porId[nueva.id] = nueva;
    } else {
      const persona = porId[f.personaId];
      if (!persona) return;
      if (f.cambios) Object.assign(persona, f.cambios);
      if (f.liderId !== undefined) persona.liderId = f.liderId;
    }

    idsIncluidos.push(f.personaId);
  });

  guardarPersonas(personas);
  guardarUltimaImportacionArbol(idsIncluidos);

  return { idsIncluidos };
}
