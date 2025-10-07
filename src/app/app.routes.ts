import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ResumenComponent } from './features/dashboard/resumen.component';
import { SedesComponent } from './features/sedes/sedes.component';
import { GruasComponent } from './features/gruas/gruas.component';
import { RutasComponent } from './features/rutas/rutas.component';
import { RutaDetalleComponent } from './features/rutas/ruta-detalle.component';
import { ReportesComponent } from './features/reportes/reportes.component';
import { UsuariosComponent } from './features/usuarios/usuarios.component';
import { MisGastosComponent } from './features/conductores/mis-gastos.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: '',
    component: DashboardComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', component: ResumenComponent },
      { path: 'usuarios', component: UsuariosComponent, data: { roles: ['ADMIN'] } },
      { path: 'sedes', component: SedesComponent, data: { roles: ['ADMIN'] } },
      { path: 'gruas', component: GruasComponent, data: { roles: ['ADMIN', 'JEFE'] } },
      { path: 'rutas', component: RutasComponent },
      { path: 'rutas/:id', component: RutaDetalleComponent },
      { path: 'reportes', component: ReportesComponent, data: { roles: ['ADMIN'] } },
      { path: 'mis-gastos', component: MisGastosComponent, data: { roles: ['CONDUCTOR'] } },
    ],
  },
  { path: '**', redirectTo: '' },
];
