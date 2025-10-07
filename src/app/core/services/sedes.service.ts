import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from './api.service';
import { Sede, SedePayload } from '../models';

@Injectable({ providedIn: 'root' })
export class SedesService {
  constructor(private readonly api: ApiService) {}

  obtenerTodas() {
    return this.api.get<{ sedes: Sede[] }>('/sedes').pipe(map((res) => res.sedes));
  }

  crear(payload: SedePayload) {
    return this.api.post<{ mensaje: string; sede: Sede }>('/sedes', payload);
  }

  actualizar(id: string, payload: Partial<SedePayload>) {
    return this.api.put<{ mensaje: string; sede: Sede }>(`/sedes/${id}`, payload);
  }

  eliminar(id: string) {
    return this.api.delete<{ mensaje: string }>(`/sedes/${id}`);
  }
}
