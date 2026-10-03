// BRILLO MW — Documentos que son de la PÁGINA WEB (solo lectura para BRILLO)
//
// Estas interfaces copian EXACTAMENTE la forma en que la página ya guarda
// sus documentos en Firestore (ver el archivo js/ citado en cada una). No
// proponen cambios: si la página cambia un campo, este archivo se ajusta
// a ella, nunca al revés.
//
// Regla de convivencia: BRILLO LEE estas colecciones y NUNCA las escribe.
// Motivo concreto: la página guarda `productos` y `ventanasApartado`
// reescribiendo la colección COMPLETA desde la copia que tiene en memoria
// y borrando cualquier documento que no conozca
// (sincronizarCatalogoConFirestore / sincronizarVentanasConFirestore). Si
// BRILLO escribiera ahí, el siguiente guardado de la página borraría o
// sobrescribiría ese cambio. Ver docs/BRILLO-MW-ARQUITECTURA.md §3.
//
// Lo que BRILLO necesite guardar de más sobre estos documentos (códigos de
// barras, costos...) va en sus propias colecciones, ligado por id.

export type FechaISO = string;
export type Pesos = number;

/** Colecciones de la página que BRILLO puede leer. */
export const COLECCIONES_PAGINA = {
  usuarios: 'users',
  personas: 'personas',
  productos: 'productos',
  ventanasApartado: 'ventanasApartado'
} as const;

// ============================================================
// users/{uid} — js/auth-service.js, scripts/seed-firebase.js
// ============================================================

/** `encargado` es el rol que los requisitos llaman RH. */
export type RolPagina = 'admin' | 'encargado' | 'staff' | 'lider' | 'emprendedora';

export interface UsuarioPagina {
  usuario: string;
  nombre: string;
  rol: RolPagina;
  personaId: string | null;
  cuentaId: string | null;
  /** false = cuenta desactivada. Ausente = activa. */
  activa?: boolean;
}

// ============================================================
// personas/{id} — js/personas-ejemplo.js (crearPersonaEjemplo)
// ============================================================

/** Foránea y VIP NO son banderas sueltas: son esta categoría de la persona. */
export type CategoriaPersona = 'normal' | 'vip' | 'foranea';

export type RangoMW = 'sin_rango' | 'plata' | 'oro' | 'diamante' | 'corona';

export interface Persona {
  id: string;
  nombre: string;
  apellidos: string;
  tipo: 'emprendedora' | 'lider';
  categoria: CategoriaPersona;
  estado: 'activa' | 'inactiva' | 'baja';
  telefono: string;
  correo: string;
  usuario: string;
  fechaAlta: FechaISO;
  liderId: string | null;
  invitadaPor: string | null;
  rangoActualKey: RangoMW;
  // La página guarda más campos (stats, historialLogros, hitos...); BRILLO
  // no los necesita y no los toca.
}

/** Equivalente a `isVip` de la especificación de BRILLO, sin guardar nada nuevo. */
export function esVip(p: Pick<Persona, 'categoria'>): boolean {
  return p.categoria === 'vip';
}

/** Equivalente a `isForanea`: ventana de 15 días en vez de 3. */
export function esForanea(p: Pick<Persona, 'categoria'>): boolean {
  return p.categoria === 'foranea';
}

// ============================================================
// productos/{id} — js/staff-catalogo.js, js/catalogo-variantes-modelo.js
// ============================================================

/** Mismas claves que DESCUENTOS_POR_MATERIAL en js/catalogo-modelo.js. */
export type Material =
  | 'oro-laminado'
  | 'acero-inoxidable'
  | 'exhibidores'
  | 'fantasia'
  | 'souvenirs'
  | 'otros';

/**
 * Una combinación Color + Talla/Tamaño con su stock (Modelo → Color →
 * Talla, aplanado). Para Souvenirs, `colorOro` y `talla` guardan el color
 * y la talla/tamaño del artículo, o quedan vacíos.
 */
export interface VarianteProducto {
  id: string;
  colorOro: string;
  talla: string;
  stock: number;
}

export interface Producto {
  id: string;
  /** Nombre del modelo. */
  nombre: string;
  descripcion: string;
  material: Material;
  categoria: string;
  calidad: string;
  /** Código interno ("AN-045"). */
  codigo: string;
  variantes: VarianteProducto[];
  /** Precio al público. */
  precioEtiqueta: Pesos;
  /** % de descuento de mayoreo. Souvenirs: lo asigna Staff/Admin por artículo. */
  descuento: number;
  disponible: boolean;
  /** Data URL o ruta relativa. */
  imagen: string;
}

export function esSouvenir(p: Pick<Producto, 'material'>): boolean {
  return p.material === 'souvenirs';
}

/** Mismo redondeo que calcularPrecioEmprendedora() de la página. */
export function precioMayoreo(p: Pick<Producto, 'precioEtiqueta' | 'descuento'>): Pesos {
  return Math.round(p.precioEtiqueta * (1 - p.descuento / 100));
}

// ============================================================
// ventanasApartado/{id} — js/apartados-modelo.js
// ============================================================

export const DEPOSITO_BASE: Pesos = 50;

/** Valores por defecto; la página los toma de Admin → Configuración. */
export const DIAS_VENTANA: Record<CategoriaPersona, number | null> = {
  normal: 3,
  foranea: 15,
  vip: null
};

export type EstadoVentana =
  | 'pendiente_deposito'
  | 'pendiente_aprobacion'
  | 'activa'
  | 'vencida'
  | 'cerrada';

export type EstadoPieza = 'activa' | 'liquidada' | 'cancelada';

export interface PagoPieza {
  monto: Pesos;
  tipo: 'liquidacion' | 'excedente_aplicado';
  metodo: 'transferencia' | 'local' | null;
  referencia: string | null;
  fecha: FechaISO;
}

export interface PiezaApartada {
  id: string;
  productoId: string;
  varianteId: string;
  producto: string;
  variante: string;
  /** Congelado al apartar: decide si cuenta como souvenir. */
  material: Material | null;
  precio: Pesos;
  total: Pesos;
  pagos: PagoPieza[];
  saldo: Pesos;
  estado: EstadoPieza;
  fechaSolicitud: FechaISO;
}

export interface VentanaApartado {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  telefono: string;
  categoria: CategoriaPersona;
  fechaInicio: FechaISO;
  /** null en VIP. */
  fechaVencimiento: FechaISO | null;
  metodoDeposito: 'transferencia' | 'local' | null;
  referenciaDeposito: string | null;
  estado: EstadoVentana;
  resolucionDeposito: 'aplicado' | 'credito' | 'perdido' | 'no_aplica' | null;
  /** Piso de $50: solo se resuelve al cerrar la ventana completa. */
  depositoPiso: Pesos;
  /** Excedente sobre $50: aplicable a cualquier pago. */
  depositoExcedente: Pesos;
  depositoApartadoDisponible: Pesos;
  apartados: PiezaApartada[];
  auditoria: { texto: string; usuario: string; fecha: FechaISO }[];
  avisoVencimientoEnviado?: boolean;
}
