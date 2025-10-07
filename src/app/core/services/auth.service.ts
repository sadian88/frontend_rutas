import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthResponse, Rol, Usuario } from '../models';

interface StoredSession {
  token: string;
  usuario: Usuario;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'gestion-gruas-session';
  private readonly currentUserSubject = new BehaviorSubject<Usuario | null>(null);
  private token: string | null = null;

  readonly usuario$: Observable<Usuario | null> = this.currentUserSubject.asObservable();

  constructor(private readonly api: ApiService, private readonly router: Router) {
    this.restoreSession();
  }

  login(credentials: { email: string; password: string }) {
    return this.api.post<AuthResponse>('/auth/login', credentials).pipe(
      tap((response) => {
        this.persistSession(response);
      })
    );
  }

  logout() {
    this.token = null;
    this.currentUserSubject.next(null);
    localStorage.removeItem(this.storageKey);
    this.router.navigate(['/login']);
  }

  cargarPerfil() {
    return this.api.get<{ usuario: Usuario }>('/auth/perfil').pipe(
      tap(({ usuario }) => {
        this.currentUserSubject.next(usuario);
        const stored = this.getStoredSession();
        if (stored) {
          this.persistSession({ token: stored.token, usuario });
        }
      })
    );
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return Boolean(this.token && this.currentUserSubject.value);
  }

  hasRole(rol: Rol): boolean {
    return this.currentUserSubject.value?.rol === rol;
  }

  hasAnyRole(roles: Rol[]): boolean {
    const usuario = this.currentUserSubject.value;
    return !!usuario && roles.includes(usuario.rol);
  }

  private persistSession(response: AuthResponse) {
    this.token = response.token;
    this.currentUserSubject.next(response.usuario);
    const session: StoredSession = {
      token: response.token,
      usuario: response.usuario,
    };
    localStorage.setItem(this.storageKey, JSON.stringify(session));
  }

  private restoreSession() {
    const stored = this.getStoredSession();
    if (stored) {
      this.token = stored.token;
      this.currentUserSubject.next(stored.usuario);
    }
  }

  private getStoredSession(): StoredSession | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as StoredSession;
    } catch (error) {
      console.warn('No fue posible restaurar la sesion', error);
      return null;
    }
  }
}
