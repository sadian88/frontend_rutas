import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from './api.service';
import { Gasto, GastoPayload, Recarga, RecargaPayload, Ruta, RutaPayload } from '../models';

@Injectable({ providedIn: 'root' })
export class RutasService {
  constructor(private readonly api: ApiService) {}

  listar(params?: Record<string, string | number | boolean | undefined>) {
    return this.api.get<{ rutas: Ruta[] }>('/rutas', params).pipe(map((res) => res.rutas));
  }

  crear(payload: RutaPayload) {
    return this.api.post<{ mensaje: string; ruta: Ruta }>('/rutas', payload);
  }

  detalle(id: string) {
    return this.api.get<{ ruta: Ruta; gastos: Gasto[]; recargas: Recarga[] }>(`/rutas/${id}`);
  }

  actualizar(id: string, payload: Partial<RutaPayload>) {
    return this.api.put<{ mensaje: string; ruta: Ruta }>(`/rutas/${id}`, payload);
  }

  registrarGasto(id: string, payload: GastoPayload) {
    return this.api.post<{ mensaje: string; gasto: Gasto }>(`/rutas/${id}/gastos`, payload);
  }

  actualizarGasto(rutaId: string, gastoId: string, payload: Partial<GastoPayload>) {
    return this.api.put<{ mensaje: string; gasto: Gasto }>(`/rutas/${rutaId}/gastos/${gastoId}`, payload);
  }

  eliminarGasto(rutaId: string, gastoId: string) {
    return this.api.delete<{ mensaje: string }>(`/rutas/${rutaId}/gastos/${gastoId}`);
  }

  obtenerGastos(id: string) {
    return this.api.get<{ gastos: Gasto[] }>(`/rutas/${id}/gastos`).pipe(map((res) => res.gastos));
  }

  registrarRecarga(id: string, payload: RecargaPayload) {
    return this.api.post<{ mensaje: string; recarga: Recarga }>(`/rutas/${id}/recargas`, payload);
  }

  actualizarRecarga(rutaId: string, recargaId: string, payload: Partial<RecargaPayload>) {
    return this.api.put<{ mensaje: string; recarga: Recarga }>(`/rutas/${rutaId}/recargas/${recargaId}`, payload);
  }

  eliminarRecarga(rutaId: string, recargaId: string) {
    return this.api.delete<{ mensaje: string }>(`/rutas/${rutaId}/recargas/${recargaId}`);
  }

  obtenerRecargas(id: string) {
    return this.api.get<{ recargas: Recarga[] }>(`/rutas/${id}/recargas`).pipe(map((res) => res.recargas));
  }

  resumenConductor() {
    return this.api.get<{ rutas: Ruta[]; gastos: Gasto[]; totalesPorRuta: Record<string, { totalGastos: number; totalRecargas: number; balance: number }> }>(
      '/rutas/resumen/conductor'
    );
  }

  resumenJefe() {
    return this.api.get<{ rutas: Ruta[]; totalesPorRuta: Record<string, { totalGastos: number; totalRecargas: number; balance: number }> }>(
      '/rutas/resumen/jefe'
    );
  }
}
