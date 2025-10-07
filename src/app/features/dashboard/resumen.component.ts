import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { GruasService } from '../../core/services/gruas.service';
import { RutasService } from '../../core/services/rutas.service';
import { SedesService } from '../../core/services/sedes.service';
import { Usuario } from '../../core/models';
import { NgApexchartsModule } from 'ng-apexcharts';

interface ResumenCard {
  titulo: string;
  valor: string;
  detalle?: string;
}

@Component({
  selector: 'app-resumen',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './resumen.component.html',
  styleUrl: './resumen.component.scss',
})
export class ResumenComponent implements OnInit {
  readonly usuario = signal<Usuario | null>(null);
  readonly tarjetas = signal<ResumenCard[]>([]);
  readonly chartOptions = signal<any | null>(null);
  readonly chartDescription = signal('');

  readonly titulo = computed(() => {
    const user = this.usuario();
    switch (user?.rol) {
      case 'ADMIN':
        return 'Resumen general';
      case 'JEFE':
        return 'Resumen de sede';
      case 'CONDUCTOR':
        return 'Resumen de rutas asignadas';
      default:
        return 'Bienvenido';
    }
  });

  readonly descripcion = computed(() => {
    const user = this.usuario();
    if (!user) {
      return '';
    }
    if (user.rol === 'ADMIN') {
      return 'Revisa el estado global de sedes, gruas y rutas.';
    }
    if (user.rol === 'JEFE') {
      return 'Totaliza gastos y recargas asociadas a tu sede.';
    }
    return 'Consulta el balance de tus rutas y gastos registrados.';
  });

  constructor(
    private readonly authService: AuthService,
    private readonly sedesService: SedesService,
    private readonly gruasService: GruasService,
    private readonly rutasService: RutasService,
  ) {
    this.authService.usuario$.subscribe((usuario) => this.usuario.set(usuario));
  }

  ngOnInit() {
    const user = this.usuario();
    if (!user) {
      return;
    }

    if (user.rol === 'ADMIN') {
      forkJoin({
        sedes: this.sedesService.obtenerTodas(),
        gruas: this.gruasService.obtenerTodas(),
        rutas: this.rutasService.listar(),
      }).subscribe(({ sedes, gruas, rutas }) => {
        this.tarjetas.set([
          { titulo: 'Sedes registradas', valor: sedes.length.toString() },
          { titulo: 'Gruas activas', valor: gruas.length.toString() },
          {
            titulo: 'Rutas totales',
            valor: rutas.length.toString(),
            detalle: `${rutas.filter((r) => r.estado === 'EN_CURSO').length} en curso`,
          },
        ]);
        this.chartOptions.set({
          series: [
            {
              name: 'Cantidad',
              data: [sedes.length, gruas.length, rutas.length],
            },
          ],
          chart: {
            type: 'bar',
            height: 320,
            toolbar: { show: false },
          },
          dataLabels: { enabled: false },
          xaxis: {
            categories: ['Sedes', 'Gruas', 'Rutas'],
          },
          colors: ['#2563eb'],
        });
        this.chartDescription.set('Distribución general de recursos');
      });
      return;
    }

    if (user.rol === 'JEFE') {
      this.rutasService.resumenJefe().subscribe((resumen) => {
        const totalGastos = Object.values(resumen.totalesPorRuta).reduce((acc, item) => acc + item.totalGastos, 0);
        const totalRecargas = Object.values(resumen.totalesPorRuta).reduce((acc, item) => acc + item.totalRecargas, 0);
        this.tarjetas.set([
          { titulo: 'Rutas vinculadas', valor: resumen.rutas.length.toString() },
          { titulo: 'Gastos acumulados', valor: `$${totalGastos.toFixed(2)}` },
          { titulo: 'Recargas acumuladas', valor: `$${totalRecargas.toFixed(2)}` },
        ]);
        const categorias = resumen.rutas.map((ruta) => ruta.nombre);
        const gastosSerie = resumen.rutas.map((ruta) => {
          const totales = resumen.totalesPorRuta[ruta._id] || { totalGastos: 0 };
          return totales.totalGastos;
        });
        const recargasSerie = resumen.rutas.map((ruta) => {
          const totales = resumen.totalesPorRuta[ruta._id] || { totalRecargas: 0 };
          return totales.totalRecargas;
        });
        this.chartOptions.set({
          series: [
            { name: 'Gastos', data: gastosSerie },
            { name: 'Recargas', data: recargasSerie },
          ],
          chart: {
            type: 'bar',
            height: 320,
            stacked: true,
            toolbar: { show: false },
          },
          dataLabels: { enabled: false },
          xaxis: {
            categories: categorias,
            labels: { rotate: -45 },
          },
          colors: ['#ef4444', '#22c55e'],
        });
        this.chartDescription.set('Comparativo de gastos vs recargas por ruta');
      });
      return;
    }

    if (user.rol === 'CONDUCTOR') {
      this.rutasService.resumenConductor().subscribe((resumen) => {
        const totalGastos = resumen.gastos.reduce((acc, item) => acc + item.monto, 0);
        const balance = Object.values(resumen.totalesPorRuta).reduce(
          (acc, item) => acc + (item.totalRecargas - item.totalGastos),
          0,
        );
        this.tarjetas.set([
          { titulo: 'Rutas asignadas', valor: resumen.rutas.length.toString() },
          { titulo: 'Gastos reportados', valor: `$${totalGastos.toFixed(2)}` },
          { titulo: 'Balance neto', valor: `$${balance.toFixed(2)}` },
        ]);
        const categorias = resumen.rutas.map((ruta) => ruta.nombre);
        const balances = resumen.rutas.map((ruta) => {
          const totales = resumen.totalesPorRuta[ruta._id] || {
            totalGastos: 0,
            totalRecargas: 0,
          };
          return totales.totalRecargas - totales.totalGastos;
        });
        this.chartOptions.set({
          series: balances,
          chart: {
            type: 'donut',
            height: 320,
          },
          labels: categorias.length ? categorias : ['Sin rutas'],
          responsive: [
            {
              breakpoint: 480,
              options: {
                chart: { height: 280 },
              },
            },
          ],
        });
        this.chartDescription.set('Balance por ruta asignada');
      });
    }
  }
}
