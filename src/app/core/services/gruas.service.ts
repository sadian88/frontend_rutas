import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from './api.service';
import { Grua, GruaPayload } from '../models';

@Injectable({ providedIn: 'root' })
export class GruasService {
  constructor(private readonly api: ApiService) {}

  obtenerTodas() {
    return this.api.get<{ gruas: Grua[] }>('/gruas').pipe(map((res) => res.gruas));
  }

  crear(payload: GruaPayload) {
    return this.api.post<{ mensaje: string; grua: Grua }>('/gruas', payload);
  }

  actualizar(id: string, payload: Partial<GruaPayload>) {
    return this.api.put<{ mensaje: string; grua: Grua }>(`/gruas/${id}`, payload);
  }

  eliminar(id: string) {
    return this.api.delete<{ mensaje: string }>(`/gruas/${id}`);
  }
}
