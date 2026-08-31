// MW JOYERÍA — Apartados Staff
// DATOS DE EJEMPLO — ventanas de apartado (ver js/apartados-modelo.js)
// ⚠️ TEMPORAL: estos datos serán reemplazados por Firestore en Fase 3.

const PERSONAL_EJEMPLO = [
  {
    usuario: "staff01",
    nombre: "Ana López",
    password: "1234"
  },
  {
    usuario: "MW0005",
    nombre: "María Camila Sánchez Calles",
    password: "2896"
  },
  {
    usuario: "admin01",
    nombre: "Claudia",
    password: "1234"
  }
];

// Crédito ya guardado de una ventana anterior (Sección 3, opción B):
// Andrea Castillo canceló su última pieza y su $50 quedó disponible
// para su próximo apartado, sin volver a pagar depósito.
const CREDITOS_STAFF_EJEMPLO = {
  "andrea-castillo": 50
};

function construirVentanasStaffEjemplo() {

  const ventanas = [];

  // 1) Ventana activa con VARIAS piezas — el ejemplo de la Sección 5
  //    del documento: dos piezas activas comparten el mismo depósito.
  const v1 = crearVentanaApartado({
    id: "VENT-EJ-01",
    usuarioId: "maria-fernanda",
    usuarioNombre: "María Fernanda",
    telefono: "444 123 4567",
    categoria: "normal",
    fechaInicio: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    depositoApartadoDisponible: 50,
    metodoDeposito: "local",
    estado: "activa"
  });
  v1.apartados.push(
    crearApartadoPieza({ id: "PZ-EJ-01", producto: "Anillo Corazón", variante: "Talla 6 · Rosa", total: 690 }),
    crearApartadoPieza({ id: "PZ-EJ-02", producto: "Dije Luna", variante: "Mediano · Dorado", total: 520 })
  );
  v1.auditoria.push({ texto: "Depósito de $50 confirmado", usuario: "Ana López", fecha: v1.fechaInicio });
  ventanas.push(v1);

  // 2) Ventana activa — categoría foránea (15 días)
  const v2 = crearVentanaApartado({
    id: "VENT-EJ-02",
    usuarioId: "sofia-hernandez",
    usuarioNombre: "Sofía Hernández",
    telefono: "444 234 5678",
    categoria: "foranea",
    fechaInicio: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    depositoApartadoDisponible: 50,
    metodoDeposito: "transferencia",
    referenciaDeposito: "REF88213",
    estado: "activa"
  });
  v2.apartados.push(
    crearApartadoPieza({ id: "PZ-EJ-03", producto: "Cadena Fina", variante: "45 cm · Amarillo", total: 650 })
  );
  v2.auditoria.push({ texto: "Depósito de $50 confirmado", usuario: "Ana López", fecha: v2.fechaInicio });
  ventanas.push(v2);

  // 3) Ventana activa — líder VIP, sin depósito y sin vencimiento
  const v3 = crearVentanaApartado({
    id: "VENT-EJ-03",
    usuarioId: "valeria-ramirez",
    usuarioNombre: "Valeria Ramírez",
    telefono: "444 345 6789",
    categoria: "vip",
    fechaInicio: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    estado: "activa"
  });
  v3.apartados.push(
    crearApartadoPieza({ id: "PZ-EJ-04", producto: "Huggies Pequeños", variante: "Blanco", total: 430 })
  );
  v3.auditoria.push({ texto: "Ventana VIP creada (sin depósito)", usuario: "Ana López", fecha: v3.fechaInicio });
  ventanas.push(v3);

  // 4) Pendiente de depósito — todavía no llega el efectivo
  const v4 = crearVentanaApartado({
    id: "VENT-EJ-04",
    usuarioId: "daniela-martinez",
    usuarioNombre: "Daniela Martínez",
    telefono: "444 456 7890",
    categoria: "normal",
    fechaInicio: new Date().toISOString(),
    estado: "pendiente_deposito"
  });
  v4.apartados.push(
    crearApartadoPieza({ id: "PZ-EJ-05", producto: "Pulsera Eslabón", variante: "17 cm · Dorado", total: 790 })
  );
  v4.auditoria.push({ texto: "Solicitud creada", usuario: "Sistema", fecha: v4.fechaInicio });
  ventanas.push(v4);

  // 5) Se agotaron los 3 días con una pieza activa: se muestra como
  //    "vencida" (aviso), pero la pieza y el depósito siguen intactos
  //    hasta que Staff decida "Desapartar".
  const v5 = crearVentanaApartado({
    id: "VENT-EJ-05",
    usuarioId: "paola-gonzalez",
    usuarioNombre: "Paola González",
    telefono: "444 567 8901",
    categoria: "normal",
    fechaInicio: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    depositoApartadoDisponible: 50,
    metodoDeposito: "local",
    estado: "activa"
  });
  v5.apartados.push(
    crearApartadoPieza({ id: "PZ-EJ-06", producto: "Dije Estrella", variante: "Grande · Dorado", total: 580 })
  );
  ventanas.push(v5); // ventanaEstaVencida(v5) da true al calcular, sin cancelar nada

  // 6) Cerrada — la última pieza se canceló y el depósito quedó como
  //    crédito automático (Andrea ya lo tiene disponible arriba).
  const v6 = crearVentanaApartado({
    id: "VENT-EJ-06",
    usuarioId: "andrea-castillo",
    usuarioNombre: "Andrea Castillo",
    telefono: "444 678 9012",
    categoria: "normal",
    fechaInicio: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    estado: "cerrada",
    resolucionDeposito: "credito"
  });
  const piezaCancelada = crearApartadoPieza({ id: "PZ-EJ-07", producto: "Aretes Flor", variante: "Pequeños · Rosa", total: 480 });
  piezaCancelada.estado = "cancelada";
  v6.apartados.push(piezaCancelada);
  v6.auditoria.push(
    { texto: "Depósito de $50 confirmado", usuario: "Ana López", fecha: v6.fechaInicio },
    { texto: "Pieza cancelada: Aretes Flor", usuario: "Mariana Torres", fecha: v6.fechaInicio },
    { texto: "Sin piezas activas tras cancelación — depósito de $50 guardado como crédito", usuario: "Mariana Torres", fecha: v6.fechaInicio }
  );
  ventanas.push(v6);

  // 7) Cerrada — se liquidaron todas las piezas y al final se aplicó
  //    el depósito a la última compra.
  const v7 = crearVentanaApartado({
    id: "VENT-EJ-07",
    usuarioId: "camila-rojas",
    usuarioNombre: "Camila Rojas",
    telefono: "444 789 0123",
    categoria: "foranea",
    fechaInicio: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    estado: "cerrada",
    resolucionDeposito: "aplicado"
  });
  const piezaLiquidada = crearApartadoPieza({ id: "PZ-EJ-08", producto: "Dije Estrella", variante: "Grande · Dorado", total: 580 });
  piezaLiquidada.estado = "liquidada";
  piezaLiquidada.pagos = [
    { monto: 530, tipo: "liquidacion", metodo: "local", referencia: null, fecha: v7.fechaInicio },
    { monto: 50, tipo: "credito_deposito", metodo: null, referencia: null, fecha: v7.fechaInicio }
  ];
  piezaLiquidada.saldo = 0;
  v7.apartados.push(piezaLiquidada);
  v7.auditoria.push(
    { texto: "Depósito de $50 confirmado", usuario: "Ana López", fecha: v7.fechaInicio },
    { texto: "Pieza liquidada: Dije Estrella", usuario: "Ana López", fecha: v7.fechaInicio },
    { texto: "Depósito de $50 aplicado a la compra", usuario: "Ana López", fecha: v7.fechaInicio }
  );
  ventanas.push(v7);

  return ventanas;

}

// Fuente única de verdad: la usan tanto la página de Apartados como
// el resumen de Inicio, para que ambas muestren siempre los mismos
// datos. Que una ventana esté vencida (ventanaEstaVencida) es un
// cálculo en vivo, no un barrido que cancele nada — las piezas y el
// depósito siguen intactos hasta que Staff decida "Desapartar".
function calcularVentanasStaffActuales() {

  let ventanas = obtenerVentanasApartado();

  if (!ventanas.length) {

    ventanas = construirVentanasStaffEjemplo();
    guardarVentanasApartado(ventanas);

    if (!Object.keys(obtenerCreditosApartado()).length) {
      guardarCreditosApartado({ ...CREDITOS_STAFF_EJEMPLO });
    }

  }

  return ventanas;

}
