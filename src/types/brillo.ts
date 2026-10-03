// BRILLO MW — Base de Registro de Inventarios, Líderes, Liquidaciones y
// Oficinas MW. Modelo de datos compartido (Firestore + Firebase Auth).
//
// Este archivo NO cambia nada de lo que hoy se sirve: el portal web sigue
// siendo HTML/JS sin compilar (ver README.md). Es la fuente única de
// "forma" de los documentos para las tres plataformas (web, escritorio
// con Tauri, tablet con Capacitor) — ver docs/BRILLO-MW-ARQUITECTURA.md.
//
// Se escribió sobre los modelos que YA existen en js/*-modelo.js, no en
// paralelo a ellos: los nombres de colecciones, campos y valores (roles,
// materiales, estados) son los mismos que ya viven en Firestore, para que
// los módulos actuales y los nuevos puedan leer los mismos documentos.
// Cada sección cita el archivo JS del que sale su forma.
//
// Convenciones (las mismas del código actual):
// - Fechas: cadena ISO 8601 (`new Date().toISOString()`), no Timestamp.
// - Dinero: pesos mexicanos como `number` (los módulos redondean a entero).
// - Periodos: mes 'YYYY-MM' (comisiones), semana ISO 'YYYY-Www' (nómina).

export type FechaISO = string;
export type Pesos = number;
/** 'YYYY-MM' — mismo periodoKey que usa js/comisiones-modelo.js. */
export type PeriodoMes = string;
/** 'YYYY-Www' (semana ISO) — periodo de la nómina semanal. */
export type SemanaISO = string;

// ============================================================
// PLATAFORMAS Y DISPOSITIVOS
// ============================================================

/** web = portal público/clientas · escritorio = PC de caja (Tauri) · tablet = piso de venta (Capacitor). */
export type Plataforma = 'web' | 'escritorio' | 'tablet';

/** dispositivos/{id} — una PC de caja o tablet dada de alta por Administrativo. */
export interface DispositivoRegistrado {
  id: string;
  nombre: string; // "Caja 1", "Tablet exhibidor norte"
  plataforma: Exclude<Plataforma, 'web'>;
  /** Cuenta compartida de Staff con la que el dispositivo mantiene su sesión abierta. */
  cuentaSesionUid: string;
  /** Prefijo de folio de los tickets de esta caja ("C1" → C1-000123). */
  prefijoFolio: string;
  tieneImpresoraTickets: boolean;
  activo: boolean;
  creadoEn: FechaISO;
}

// ============================================================
// ROLES Y CONTROL DE ACCESO
// ============================================================

/**
 * Mismos valores que ya guarda users/{uid}.rol y que leen firestore.rules
 * y js/auth-service.js. `encargado` ES el rol "RH" del documento de
 * requisitos (Sección 17): nómina semanal + mismos accesos que Staff.
 * Se conserva el valor guardado para no romper cuentas, reglas ni las
 * páginas de portal/encargado/ — solo cambia la etiqueta visible.
 */
export type RolBrillo = 'admin' | 'encargado' | 'staff' | 'lider' | 'emprendedora';

export const ETIQUETA_ROL: Record<RolBrillo, string> = {
  admin: 'Administrativo',
  encargado: 'RH',
  staff: 'Staff (Caja)',
  lider: 'Líder',
  emprendedora: 'Emprendedora'
};

export const ROLES_INTERNOS: readonly RolBrillo[] = ['admin', 'encargado', 'staff'];

/**
 * Custom claims de Firebase Auth (se fijan solo con el Admin SDK, nunca
 * desde el cliente). Deliberadamente mínimos: los claims viajan en cada
 * token y tardan hasta 1 h en refrescarse, así que aquí solo va lo que
 * las reglas necesitan para decidir rápido sin un get() extra.
 * Los flags de negocio (isVip, isForanea) viven en el documento del
 * usuario, donde un cambio surte efecto de inmediato.
 */
export interface ClaimsBrillo {
  rol: RolBrillo;
  /** Versión del esquema de claims, para migraciones futuras. */
  cv: 1;
}

/** Permisos derivados del rol — una sola tabla para UI y documentación. */
export type Permiso =
  | 'reportes_globales'
  | 'editar_valor_calculado'
  | 'nomina_gestionar'
  | 'nomina_ver_propia'
  | 'pos_cobrar'
  | 'depositos_capturar'
  | 'inventario_altas_bajas'
  | 'catalogo_ver'
  | 'calendario_ver'
  | 'apartados_gestionar'
  | 'apartados_propios'
  | 'equipo_ver'
  | 'comisiones_propias';

export const PERMISOS_POR_ROL: Record<RolBrillo, readonly Permiso[]> = {
  admin: [
    'reportes_globales', 'editar_valor_calculado', 'nomina_gestionar', 'nomina_ver_propia',
    'pos_cobrar', 'depositos_capturar', 'inventario_altas_bajas', 'catalogo_ver',
    'calendario_ver', 'apartados_gestionar'
  ],
  encargado: [
    'nomina_gestionar', 'nomina_ver_propia', 'catalogo_ver', 'calendario_ver', 'apartados_gestionar'
  ],
  staff: [
    'pos_cobrar', 'depositos_capturar', 'inventario_altas_bajas', 'catalogo_ver',
    'calendario_ver', 'apartados_gestionar', 'nomina_ver_propia'
  ],
  lider: ['catalogo_ver', 'calendario_ver', 'apartados_propios', 'equipo_ver', 'comisiones_propias'],
  emprendedora: ['catalogo_ver', 'calendario_ver', 'apartados_propios']
};

// ============================================================
// USUARIOS — users/{uid} (js/auth-service.js, js/personas-*.js)
// ============================================================

interface UsuarioBase {
  uid: string;
  usuario: string; // nombre de login (MW0001, staff01...)
  nombre: string;
  telefono?: string; // WhatsApp — seguimiento de ventanas vencidas
  rol: RolBrillo;
  /** false = cuenta desactivada (auth-service.js la rechaza al entrar). */
  activa: boolean;
  creadoEn: FechaISO;
}

/** Empleado con sueldo: Administrativo, RH o Staff (Sección 17). */
export interface UsuarioInterno extends UsuarioBase {
  rol: 'admin' | 'encargado' | 'staff';
  cuentaId: string;
  /** nominaEmpleados/{id} — roster de nómina separado a propósito (ver js/nomina-modelo.js). */
  empleadoNominaId?: string;
}

/** Fuerza de venta: Emprendedora o Líder (compensación por comisiones, no nómina). */
export interface UsuarioVenta extends UsuarioBase {
  rol: 'lider' | 'emprendedora';
  personaId: string;
  /** Líder directa (árbol de equipo — calcularDescendenciaPersona). */
  liderId: string | null;
  /** Emprendedora foránea: ventana de apartado de 15 días en vez de 3. */
  isForanea: boolean;
  /** Líder VIP: apartados sin depósito y sin vencimiento (con aprobación de Staff). */
  isVip: boolean;
  rangoActual?: RangoMW;
  creditoApartadoDisponible?: Pesos;
}

export type Usuario = UsuarioInterno | UsuarioVenta;

/**
 * pinesStaff/{empleadoId} — PIN individual de Staff (4-6 dígitos).
 *
 * Staff sigue usando UNA cuenta compartida (requisitos, Sección 16:
 * "cuenta compartida con registro de nombre por acción"); las 8 personas
 * NO tienen cuenta propia de Firebase Auth. Por eso el PIN se identifica
 * por empleado de nómina (nominaEmpleados/{id}), no por uid, y se guarda
 * solo como hash PBKDF2-SHA256 con sal propia — nunca en claro.
 * Límite conocido: ver "Firma con PIN" en docs/BRILLO-MW-ARQUITECTURA.md.
 */
export interface PinStaff {
  empleadoId: string;
  empleadoNombre: string;
  /** Base64 de PBKDF2-SHA256(PIN, sal, iteraciones). */
  hash: string;
  sal: string;
  iteraciones: number;
  longitud: 4 | 5 | 6;
  /** Se reinicia al acertar; al llegar a PIN_MAX_INTENTOS se fija bloqueadoHasta. */
  intentosFallidos: number;
  bloqueadoHasta: FechaISO | null;
  /** Solo Administrativo crea o restablece un PIN (requisitos 19.2). */
  actualizadoPor: string;
  actualizadoEn: FechaISO;
}

export const PIN_MAX_INTENTOS = 5;
export const PIN_MINUTOS_BLOQUEO = 15;

// ============================================================
// FIRMA DE ACCIONES (Nombre + PIN en dispositivo compartido)
// ============================================================

export type AccionRegistrable =
  | 'venta'
  | 'cancelacion_venta'
  | 'deposito'
  | 'cancelacion_apartado'
  | 'liquidacion_apartado'
  | 'alta_inventario'
  | 'baja_inventario'
  | 'ajuste_inventario'
  | 'apertura_caja'
  | 'corte_caja'
  | 'consulta_nomina_propia';

/**
 * Se adjunta a todo documento creado/modificado tras el modal de
 * Nombre + PIN. `empleadoId` es nominaEmpleados/{id} (quién lo hizo);
 * `sesionUid` es la cuenta con la que estaba abierto el dispositivo
 * (la compartida de Staff, o la individual de RH/Administrativo).
 * Las reglas comprueban sesionUid == request.auth.uid.
 */
export interface FirmaEmpleado {
  empleadoId: string;
  empleadoNombre: string;
  sesionUid: string;
  accion: AccionRegistrable;
  dispositivoId: string;
  plataforma: Plataforma;
  fecha: FechaISO;
}

/** bitacoraAcciones/{id} — append-only, nunca se edita ni se borra. */
export interface RegistroAccion extends FirmaEmpleado {
  id: string;
  /** Ruta del documento afectado: 'ventas/V-123', 'ventanasApartado/VENT-9'... */
  referencia: string;
  resumen: string;
}

// ============================================================
// VALORES CALCULADOS CON AJUSTE MANUAL (Administrativo)
// ============================================================

/**
 * Cualquier valor que el sistema calcula solo (comisión, total de
 * nómina, fecha de vencimiento...) y que Administrativo puede
 * sobrescribir y/o congelar. Mismo patrón valorCalculado/valorNuevo/
 * motivo que ya usan comisionesAjustes y nominaHistorialAjustes.
 */
export interface ValorCalculado<T = Pesos> {
  calculado: T;
  ajuste?: AjusteManual<T>;
}

export interface AjusteManual<T = Pesos> {
  valor: T;
  /** Congelado: los recálculos automáticos ya no lo tocan hasta descongelar. */
  congelado: boolean;
  motivo: string;
  usuarioAdminId: string;
  usuarioAdminNombre: string;
  fecha: FechaISO;
}

export function valorEfectivo<T>(v: ValorCalculado<T>): T {
  return v.ajuste ? v.ajuste.valor : v.calculado;
}

// ============================================================
// PRODUCTOS Y VARIANTES — productos/{id}
// (js/catalogo-modelo.js, js/catalogo-variantes-modelo.js)
// ============================================================

/** Mismas claves que DESCUENTOS_POR_MATERIAL en js/catalogo-modelo.js. */
export type Material =
  | 'oro-laminado'
  | 'acero-inoxidable'
  | 'exhibidores'
  | 'fantasia'
  | 'souvenirs'
  | 'otros';

/** Descuento de mayoreo fijo por categoría (requisitos 4.1). null = se captura por artículo. */
export const DESCUENTO_MAYOREO_FIJO: Record<Material, number | null> = {
  'oro-laminado': 60,
  'acero-inoxidable': 40,
  exhibidores: 30,
  fantasia: 40,
  souvenirs: null,
  otros: null
};

/**
 * Jerarquía Modelo → Color → Talla/Tamaño (requisitos 4.3). Se guarda
 * aplanada — una variante por combinación color+talla con su propio
 * stock — porque así ya vive en Firestore y así el descuento de stock
 * es una transacción sobre UN solo documento (LOG-01 de la auditoría).
 * Para agrupar por color en pantalla basta con agrupar por `color`.
 */
export interface VarianteProducto {
  id: string;
  /** Joyería: tono de oro/zirconia ("Amarillo", "Zirconia roja"). Souvenirs: color de la prenda. '' = sin color. */
  color: string;
  /** Joyería: talla de anillo / largo de cadena. Souvenirs: talla de ropa o tamaño ("M", "Libreta A5"). '' = única. */
  tallaOTamano: string;
  /** Visible solo para roles internos — Emprendedora/Líder solo ven "Disponible". */
  stock: number;
  /** Código de barras / SKU que lee el escáner USB de caja. */
  codigoBarras?: string;
}

interface ProductoBase {
  id: string;
  /** Nombre del modelo ("Arete corazón"). */
  modelo: string;
  descripcion?: string;
  coleccion?: string;
  /** Precio al público — base de todos los catálogos. */
  precioEtiqueta: Pesos;
  /** % de descuento de mayoreo vigente para Emprendedora/Líder. */
  descuento: number;
  fotos: string[];
  variantes: VarianteProducto[];
  activo: boolean;
  actualizadoEn: FechaISO;
  actualizadoPor?: FirmaEmpleado;
}

/** Joyería y demás categorías con descuento fijo por material. */
export interface ProductoJoyeria extends ProductoBase {
  material: Exclude<Material, 'souvenirs'>;
}

/**
 * Souvenirs (playeras, sudaderas, libretas, diademas...): requisitos 4.2.
 * - Sin % fijo: Staff/Administrativo asigna `descuento` libremente por artículo.
 * - SÍ cuentan para: estatus "activa", compra personal mínima de la
 *   líder y "equipo calificado".
 * - NO cuentan para: comisión de la líder, puntos de producción grupal,
 *   Reto de Constancia ni rifas mensuales.
 * Por eso toda venta guarda el subtotal de souvenirs por separado.
 */
export interface ProductoSouvenir extends ProductoBase {
  material: 'souvenirs';
  /** Tipo de artículo, para agrupar en catálogo ("Playera", "Libreta"). */
  tipoArticulo: string;
}

export type Producto = ProductoJoyeria | ProductoSouvenir;

export function esSouvenir(p: Pick<Producto, 'material'>): boolean {
  return p.material === 'souvenirs';
}

/** Precio con descuento de mayoreo — mismo redondeo que calcularPrecioEmprendedora(). */
export function precioMayoreo(p: Pick<Producto, 'precioEtiqueta' | 'descuento'>): Pesos {
  return Math.round(p.precioEtiqueta * (1 - p.descuento / 100));
}

// ============================================================
// VENTANAS DE DEPÓSITO / APARTADOS — ventanasApartado/{id}
// (js/apartados-modelo.js, requisitos Sección 5)
// ============================================================

export const DEPOSITO_BASE: Pesos = 50;

export type CategoriaVentana = 'normal' | 'foranea' | 'vip';

/** Días por categoría (configurables en Admin → Configuración). null = sin vencimiento. */
export const DIAS_VENTANA: Record<CategoriaVentana, number | null> = {
  normal: 3,
  foranea: 15,
  vip: null
};

/** isVip gana sobre isForanea: una líder VIP nunca necesita depósito. */
export function categoriaVentanaDe(u: Pick<UsuarioVenta, 'rol' | 'isVip' | 'isForanea'>): CategoriaVentana {
  if (u.rol === 'lider' && u.isVip) return 'vip';
  return u.isForanea ? 'foranea' : 'normal';
}

export type EstadoVentana =
  | 'pendiente_deposito'
  | 'pendiente_aprobacion'
  | 'activa'
  | 'vencida'
  | 'cerrada';

export type EstadoPieza = 'activa' | 'liquidada' | 'cancelada';

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'local';

export interface Pago {
  monto: Pesos;
  metodo: MetodoPago;
  referencia?: string | null;
  fecha: FechaISO;
  firma?: FirmaEmpleado;
}

export interface PiezaApartada {
  id: string;
  productoId: string;
  varianteId: string;
  producto: string; // nombre del modelo al momento de apartar
  variante: string; // etiqueta color · talla
  /** Material congelado al apartar: decide si es souvenir aunque el producto cambie después. */
  material: Material | null;
  precio: Pesos; // ya con descuento de mayoreo
  total: Pesos;
  pagos: Pago[];
  saldo: Pesos;
  estado: EstadoPieza;
  fechaSolicitud: FechaISO;
  /** VIP: Staff aprueba cada pieza manualmente (requisitos 5.5). */
  aprobadaPor?: FirmaEmpleado;
}

/**
 * El depósito pertenece a la PERSONA y respalda toda la ventana, no una
 * pieza. Se separa en piso ($50, se resuelve solo al cerrar la ventana
 * completa) y excedente (libre, aplicable a cualquier pago) — LOG-06.
 * depositoApartadoDisponible = depositoPiso + depositoExcedente, siempre
 * derivado (ver fijarDepositoVentana).
 */
export interface VentanaDeposito {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  telefono: string;
  categoria: CategoriaVentana;
  /** Empieza a correr al CONFIRMAR el depósito (o el crédito), no al solicitar. */
  fechaInicio: FechaISO;
  /** null en VIP. Calculado, pero Administrativo puede extenderlo/congelarlo. */
  fechaVencimiento: ValorCalculado<FechaISO | null>;
  depositoPiso: Pesos;
  depositoExcedente: Pesos;
  depositoApartadoDisponible: Pesos;
  metodoDeposito: MetodoPago | null;
  referenciaDeposito: string | null;
  /** Origen del piso: depósito físico nuevo o crédito guardado de una ventana anterior. */
  origenDeposito: 'deposito' | 'credito' | 'vip_sin_deposito';
  depositoConfirmadoPor?: FirmaEmpleado;
  estado: EstadoVentana;
  /** Al cerrar: aplicar los $50 a la compra, guardarlos como crédito, o perderlos (desapartar vencida). */
  resolucionDeposito: 'aplicado' | 'credito' | 'perdido' | null;
  apartados: PiezaApartada[];
  auditoria: { texto: string; fecha: FechaISO; firma?: FirmaEmpleado }[];
}

// ============================================================
// VENTAS / TRANSACCIONES — ventas/{id}
// ============================================================

/**
 * BRILLO reemplaza a Aronium como caja registradora (decisión del
 * 3-oct-2026, sustituye la Sección 20 de los requisitos v8): toda venta
 * se cobra en el POS de BRILLO. La compra directa de una emprendedora/
 * líder en tienda es simplemente una venta 'pos' con compradorId, y
 * cuenta igual que un apartado liquidado para activación, comisión,
 * producción, equipo calificado, Reto de Constancia y rifas.
 * 'importada_aronium' solo existe para el historial migrado al arrancar.
 */
export type OrigenVenta = 'pos' | 'apartado_liquidado' | 'importada_aronium';

export interface LineaVenta {
  productoId: string;
  varianteId: string;
  descripcion: string;
  material: Material;
  cantidad: number;
  precioEtiqueta: Pesos;
  descuentoPct: number;
  precioUnitario: Pesos;
  importe: Pesos;
}

export interface Venta {
  id: string;
  folio: string; // impreso en el ticket
  origen: OrigenVenta;
  /** null = cliente de mostrador (público general) — no genera comisión. */
  compradorId: string | null;
  compradorNombre: string;
  /** Líder de la compradora al momento de la venta (congelado para comisiones). */
  liderIdAlVender: string | null;
  ventanaApartadoId?: string;
  /** Turno de caja en que se cobró (null en apartado liquidado desde portal o importada). */
  turnoCajaId: string | null;
  lineas: LineaVenta[];
  /**
   * Desglose obligatorio (requisitos 4.2), derivado de `lineas`. En el
   * historial importado de Aronium puede venir sin líneas, solo con
   * estos dos importes.
   */
  subtotalNormal: Pesos;
  subtotalSouvenirs: Pesos;
  depositoAplicado: Pesos;
  total: Pesos;
  pagos: Pago[];
  estado: 'completada' | 'cancelada';
  cancelacion?: { motivo: string; firma: FirmaEmpleado };
  firma: FirmaEmpleado;
  ticketImpreso: boolean;
  creadoEn: FechaISO;
}

// ============================================================
// INVENTARIO — movimientosInventario/{id}
// ============================================================

/**
 * Con BRILLO como fuente de verdad del inventario físico, el `stock` de
 * cada variante ya no se captura copiando Aronium: solo cambia mediante
 * un movimiento, escrito en la MISMA transacción que actualiza el
 * producto. El historial es append-only y explica cada pieza.
 */
export type TipoMovimientoInventario =
  | 'entrada' // compra a proveedor / alta de piezas
  | 'venta'
  | 'apartado' // reserva: sale del disponible
  | 'liberacion_apartado' // pieza cancelada o desapartada: regresa
  | 'cancelacion_venta' // devolución: regresa
  | 'ajuste' // conteo físico (positivo o negativo)
  | 'merma' // daño, pérdida
  | 'carga_inicial'; // migración desde Aronium

export interface MovimientoInventario {
  id: string;
  productoId: string;
  varianteId: string;
  tipo: TipoMovimientoInventario;
  /** Positivo entra, negativo sale. */
  cantidad: number;
  stockAntes: number;
  stockDespues: number;
  /** 'ventas/V-123', 'ventanasApartado/VENT-9'... */
  referencia?: string;
  motivo?: string;
  costoUnitario?: Pesos;
  firma: FirmaEmpleado;
}

// ============================================================
// CAJA — turnosCaja/{id}
// ============================================================

/**
 * Apertura y corte de caja por dispositivo (lo que hoy hace Aronium).
 * El efectivo esperado se calcula de las ventas y depósitos en efectivo
 * del turno; Administrativo puede ajustar la diferencia con motivo.
 */
export interface TurnoCaja {
  id: string;
  dispositivoId: string;
  estado: 'abierto' | 'cerrado';
  apertura: { fondoInicial: Pesos; firma: FirmaEmpleado };
  cierre?: {
    efectivoContado: Pesos;
    efectivoEsperado: ValorCalculado<Pesos>;
    diferencia: Pesos;
    totalesPorMetodo: Partial<Record<MetodoPago, Pesos>>;
    numVentas: number;
    numCancelaciones: number;
    firma: FirmaEmpleado;
  };
  /** Retiros/ingresos de efectivo durante el turno (pago a proveedor, cambio...). */
  movimientosEfectivo: { monto: Pesos; motivo: string; firma: FirmaEmpleado }[];
}

// ============================================================
// COMISIONES — comisiones/{id} (js/comisiones-modelo.js)
// ============================================================

export type RangoMW = 'sin_rango' | 'plata' | 'oro' | 'diamante' | 'corona';

/** Nivel de la emprendedora dentro del equipo de la líder (1 = directa). */
export type NivelEquipo = 1 | 2 | 3 | 4 | 5;

/** 1 = días 1-15, 2 = 16-fin de mes. */
export type SubPeriodo = 1 | 2;

/**
 * Una línea de comisión: la compra (no souvenir) de una integrante del
 * equipo, valuada con la fórmula (monto ÷ 1.16) × % según su nivel y el
 * rango vigente de la líder. Los souvenirs nunca generan comisión.
 */
export interface RegistroComision {
  id: string;
  liderId: string;
  emprendedoraId: string;
  periodo: PeriodoMes;
  subPeriodo: SubPeriodo;
  nivel: NivelEquipo;
  rangoAplicado: RangoMW;
  ventaIds: string[];
  /** Suma de subtotalNormal de las ventas — ya sin souvenirs. */
  baseConIva: Pesos;
  ivaDivisor: number; // 1.16 (configurable con vigencia)
  pct: number;
  monto: ValorCalculado<Pesos>;
  estado: 'calculada' | 'pagada';
  pago?: { fecha: FechaISO; metodo: MetodoPago; referencia?: string; pagadoPor: string };
}

// ============================================================
// NÓMINA SEMANAL — nominaRecibos/{id} (js/nomina-modelo.js, Sección 17)
// ============================================================

/** Mismos estados del flujo RH → Administración que ESTADOS_NOMINA_PERIODO. */
export type EstadoNomina =
  | 'pendiente'
  | 'necesita_validacion_admin'
  | 'validado_admin'
  | 'correccion_solicitada'
  | 'pagado';

export interface ConceptoNomina {
  concepto: string;
  monto: Pesos;
}

/**
 * Recibo semanal de un empleado con sueldo (Staff, RH, Administrativo).
 * La captura es manual (requisitos 17.2). Cada empleado ve SOLO el suyo:
 * RH/Administrativo por su cuenta individual (las reglas comparan
 * empleadoUid); Staff, al usar cuenta compartida, lo abre firmando con
 * Nombre + PIN (accion 'consulta_nomina_propia'), y la consulta queda
 * en bitácora.
 */
export interface ReciboNominaSemanal {
  id: string; // `${empleadoId}_${semana}`
  empleadoId: string; // nominaEmpleados/{id}
  /** users/{uid} de RH/Administrativo. null en Staff (cuenta compartida). */
  empleadoUid: string | null;
  empleadoNombre: string;
  cargo: 'admin' | 'encargado' | 'staff';
  semana: SemanaISO;
  fechaInicio: FechaISO;
  fechaFin: FechaISO;
  sueldoBase: Pesos;
  diasTrabajados: number;
  faltas: number;
  horasExtra: number;
  pagoHoraExtra: Pesos;
  bonos: ConceptoNomina[];
  deducciones: ConceptoNomina[];
  total: ValorCalculado<Pesos>;
  estado: EstadoNomina;
  capturadoPor: string;
  validadoPor?: string;
  pago?: { fecha: FechaISO; metodo: string; comprobanteUrl?: string };
}
