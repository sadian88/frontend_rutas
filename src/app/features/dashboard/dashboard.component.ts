import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Rol, Usuario } from '../../core/models';

interface NavItem {
  label: string;
  path: string;
  icon?: string;
  roles?: Rol[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly usuario = signal<Usuario | null>(null);

  private readonly navItems: NavItem[] = [
    { label: 'Resumen', path: '' },
    { label: 'Usuarios', path: 'usuarios', roles: ['ADMIN'] },
    { label: 'Sedes', path: 'sedes', roles: ['ADMIN'] },
    { label: 'Gruas', path: 'gruas', roles: ['ADMIN', 'JEFE'] },
    { label: 'Rutas', path: 'rutas' },
    { label: 'Reportes', path: 'reportes', roles: ['ADMIN'] },
    { label: 'Mis gastos', path: 'mis-gastos', roles: ['CONDUCTOR'] },
  ];

  readonly links = computed(() => {
    const user = this.usuario();
    if (!user) {
      return [] as NavItem[];
    }
    return this.navItems.filter((item) => !item.roles || item.roles.includes(user.rol));
  });

  constructor(private readonly authService: AuthService) {
    this.authService.usuario$.subscribe((usuario) => this.usuario.set(usuario));
  }

  cerrarSesion() {
    this.authService.logout();
  }
}
