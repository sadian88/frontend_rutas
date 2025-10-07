import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ReportesService } from '../../core/services/reportes.service';
import { SedesService } from '../../core/services/sedes.service';
import { RutasService } from '../../core/services/rutas.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { AuthService } from '../../core/services/auth.service';
import { BalanceEntry, Ruta, Sede, Usuario } from '../../core/models';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { NgApexchartsModule } from 'ng-apexcharts';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AgGridAngular, NgApexchartsModule],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.scss',
})
export class ReportesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly sedes = signal<Sede[]>([]);
  readonly rutas = signal<Ruta[]>([]);
  readonly conductores = signal<Usuario[]>([]);
  readonly resultados = signal<BalanceEntry[]>([]);
  readonly totales = signal<{ totalGastos: number; totalRecargas: number; balance: number } | null>(null);
  readonly cargando = signal(false);
  readonly usuario = signal<Usuario | null>(null);
  readonly chartOptions = signal<any | null>(null);
  readonly chartTitle = signal('');

  private readonly currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  });

  readonly defaultColDef: ColDef<BalanceEntry> = {
    sortable: true,
    resizable: true,
    flex: 1,
  };

  readonly resultadoColumnDefs: ColDef<BalanceEntry>[] = [
    { headerName: 'Clave', field: 'key', minWidth: 140 },
    { headerName: 'Descripcion', field: 'etiqueta', flex: 1.5 },
    {
      headerName: 'Gastos',
      field: 'totalGastos',
      type: 'numericColumn',
      valueFormatter: ({ value }) => this.formatCurrency(value as number),
    },
    {
      headerName: 'Recargas',
      field: 'totalRecargas',
      type: 'numericColumn',
      valueFormatter: ({ value }) => this.formatCurrency(value as number),
    },
    {
      headerName: 'Balance',
      field: 'balance',
      type: 'numericColumn',
      cellClass: (params) => (params.value < 0 ? 'saldo-negativo' : undefined),
      valueFormatter: ({ value }) => this.formatCurrency(value as number),
    },
  ];

  readonly form = this.fb.group({
    agrupacion: ['mes'],
    desde: [''],
    hasta: [''],
    sede: [''],
    ruta: [''],
    conductor: [''],
  });

  constructor(
    private readonly reportesService: ReportesService,
    private readonly sedesService: SedesService,
    private readonly rutasService: RutasService,
    private readonly usuariosService: UsuariosService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.sedesService.obtenerTodas().subscribe((sedes) => this.sedes.set(sedes));
    this.rutasService.listar().subscribe((rutas) => this.rutas.set(rutas));
    this.usuariosService.listar({ rol: 'CONDUCTOR' }).subscribe((conductores) => this.conductores.set(conductores));
    this.authService.usuario$.subscribe((usuario) => this.usuario.set(usuario));
  }

  generarReporte() {
    const filtros = this.form.getRawValue();
    this.cargando.set(true);
    this.reportesService
      .balance({
        agrupacion: filtros.agrupacion || undefined,
        desde: filtros.desde || undefined,
        hasta: filtros.hasta || undefined,
        sede: filtros.sede || undefined,
        ruta: filtros.ruta || undefined,
        conductor: filtros.conductor || undefined,
      })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe((respuesta) => {
        this.resultados.set(respuesta.resultados);
        this.totales.set(respuesta.totalesGenerales);
        this.actualizarGrafico();
      });
  }

  private formatCurrency(value: number): string {
    return this.currencyFormatter.format(value ?? 0);
  }

  formatoMoneda(value: number): string {
    return this.formatCurrency(value);
  }

  private actualizarGrafico() {
    const data = this.resultados();
    const user = this.usuario();
    if (!data.length) {
      this.chartOptions.set(null);
      return;
    }

    const categorias = data.map((item) => item.etiqueta);
    const gastos = data.map((item) => item.totalGastos);
    const recargas = data.map((item) => item.totalRecargas);
    const balances = data.map((item) => item.balance);

    if (!user || user.rol === 'ADMIN') {
      this.chartOptions.set({
        series: [
          { name: 'Gastos', data: gastos },
          { name: 'Recargas', data: recargas },
        ],
        chart: {
          type: 'bar',
          height: 360,
          toolbar: { show: false },
        },
        dataLabels: { enabled: false },
        xaxis: {
          categories: categorias,
          labels: { rotate: categorias.length > 6 ? -45 : 0 },
        },
        legend: { position: 'top' },
        responsive: [
          {
            breakpoint: 600,
            options: {
              chart: { height: 320 },
              xaxis: { labels: { rotate: -45 } },
            },
          },
        ],
        colors: ['#ef4444', '#22c55e'],
      });
      this.chartTitle.set('Comparativo de gastos y recargas');
      return;
    }

    this.chartOptions.set({
      series: [
        {
          name: 'Balance',
          data: balances,
        },
      ],
      chart: {
        type: 'line',
        height: 360,
        toolbar: { show: false },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: categorias,
        labels: { rotate: categorias.length > 6 ? -45 : 0 },
      },
      legend: { position: 'top' },
      colors: ['#2563eb'],
    });
    this.chartTitle.set('Balance por agrupación seleccionada');
  }
}
