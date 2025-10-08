export type Rol = 'ADMIN' | 'JEFE' | 'CONDUCTOR';

export interface Usuario {
  _id: string;
  nombre: string;
  email: string;
  rol: Rol;
  sede?: Sede | null;
  activo: boolean;
}

export interface UsuarioCreatePayload {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
  sede?: string | null;
}

export interface UsuarioUpdatePayload {
  nombre?: string;
  rol?: Rol;
  sede?: string | null;
  activo?: boolean;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
}

export interface Sede {
  _id: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  descripcion?: string;
  jefe?: Usuario | null;
}

export interface SedePayload {
  nombre: string;
  direccion?: string;
  telefono?: string;
  descripcion?: string;
  jefe?: string | null;
}

export type EstadoGrua = 'EN_SERVICIO' | 'MANTENIMIENTO' | 'INACTIVA';

export interface Grua {
  _id: string;
  codigo: string;
  placa: string;
  modelo?: string;
  capacidadToneladas?: number;
  sede: Sede;
  estado: EstadoGrua;
  descripcion?: string;
}

export interface GruaPayload {
  codigo: string;
  placa: string;
  modelo?: string;
  capacidadToneladas?: number;
  sede: string;
  estado: EstadoGrua;
  descripcion?: string;
}

export type EstadoRuta = 'PROGRAMADA' | 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA';

export interface RutaResumen {
  totalGastos: number;
  totalRecargas: number;
  balance: number;
  cantidadGastos: number;
  cantidadRecargas: number;
}

export interface Ruta {
  _id: string;
  nombre: string;
  sedeOrigen: Sede;
  sedeDestino: Sede;
  grua: Grua;
  conductor: Usuario;
  fechaInicio: string;
  fechaFin?: string;
  estado: EstadoRuta;
  kilometros?: number;
  observaciones?: string;
  resumen?: RutaResumen;
}

export interface RutaPayload {
  nombre: string;
  sedeOrigen: string;
  sedeDestino: string;
  grua: string;
  conductor: string;
  fechaInicio: string;
  fechaFin?: string;
  estado: EstadoRuta;
  kilometros?: number;
  observaciones?: string;
}

export type CategoriaGasto = 'PEAJE' | 'COMBUSTIBLE' | 'ALIMENTACION' | 'HOSPEDAJE' | 'MANTENIMIENTO' | 'OTRO';

export interface Gasto {
  _id: string;
  ruta: string | Ruta;
  conductor: Usuario;
  descripcion: string;
  categoria: CategoriaGasto;
  monto: number;
  fecha: string;
  comprobanteUrl?: string;
}

export interface GastoPayload {
  descripcion: string;
  categoria: CategoriaGasto;
  monto: number;
  fecha: string;
  comprobanteUrl?: string | null;
}

export interface Recarga {
  _id: string;
  ruta: string | Ruta;
  jefe: Usuario;
  descripcion: string;
  monto: number;
  fecha: string;
}

export interface RecargaPayload {
  descripcion: string;
  monto: number;
  fecha: string;
}

export interface BalanceEntry {
  key: string;
  etiqueta: string;
  totalGastos: number;
  totalRecargas: number;
  balance: number;
}

export interface BalanceGroupTotal {
  key: string;
  etiqueta: string;
  total: number;
}

export interface BalanceDetalleRuta {
  rutaId: string;
  nombreRuta: string;
  fechaInicio: string;
  fechaFin?: string | null;
  totalGastos: number;
  totalRecargas: number;
  balance: number;
  conductor: {
    _id: string;
    nombre: string;
  };
  sedeOrigen: {
    _id: string;
    nombre: string;
  };
  sedeDestino: {
    _id: string;
    nombre: string;
  };
}

export interface BalanceSumatorias {
  gastosPorSede: BalanceGroupTotal[];
  gastosPorConductor: BalanceGroupTotal[];
  gastosPorRuta: BalanceGroupTotal[];
  recargasPorSede: BalanceGroupTotal[];
  recargasPorRuta: BalanceGroupTotal[];
}

export interface BalanceResponse {
  filtrosAplicados: Record<string, unknown>;
  resultados: BalanceEntry[];
  totalesGenerales: {
    totalGastos: number;
    totalRecargas: number;
    balance: number;
  };
  detalleRutas: BalanceDetalleRuta[];
  sumatorias: BalanceSumatorias;
}
