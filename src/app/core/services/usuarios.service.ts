import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from './api.service';
import { Usuario, UsuarioCreatePayload, UsuarioUpdatePayload } from '../models';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  constructor(private readonly api: ApiService) {}

  listar(params?: Record<string, string | number | boolean | undefined>) {
    return this.api.get<{ usuarios: Usuario[] }>('/usuarios', params).pipe(map((res) => res.usuarios));
  }

  crear(payload: UsuarioCreatePayload) {
    return this.api
      .post<{ mensaje: string; usuario: Usuario }>('/usuarios', payload)
      .pipe(map((res) => res.usuario));
  }

  actualizar(id: string, payload: UsuarioUpdatePayload) {
    return this.api
      .put<{ mensaje: string; usuario: Usuario }>(`/usuarios/${id}`, payload)
      .pipe(map((res) => res.usuario));
  }

  eliminar(id: string) {
    return this.api.delete<{ mensaje: string }>(`/usuarios/${id}`);
  }
}
