import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { NgApexchartsModule } from 'ng-apexcharts';
import { BalanceDetalleRuta, BalanceEntry, BalanceSumatorias, Ruta, Sede, Usuario } from '../../core/models';
import { ReportesService } from '../../core/services/reportes.service';
import { SedesService } from '../../core/services/sedes.service';
import { RutasService } from '../../core/services/rutas.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { AuthService } from '../../core/services/auth.service';

interface FiltrosSeleccionados {
  agrupacion: string | null;
  desde: string | null;
  hasta: string | null;
  sede: string | null;
  ruta: string | null;
  conductor: string | null;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AgGridAngular, NgApexchartsModule],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.scss',
})
export class ReportesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly reportesService = inject(ReportesService);
  private readonly sedesService = inject(SedesService);
  private readonly rutasService = inject(RutasService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly authService = inject(AuthService);

  readonly sedes = signal<Sede[]>([]);
  readonly rutas = signal<Ruta[]>([]);
  readonly conductores = signal<Usuario[]>([]);
  readonly resultados = signal<BalanceEntry[]>([]);
  readonly totales = signal<{ totalGastos: number; totalRecargas: number; balance: number } | null>(null);
  readonly detalleRutas = signal<BalanceDetalleRuta[]>([]);
  readonly sumatorias = signal<BalanceSumatorias>({
    gastosPorSede: [],
    gastosPorConductor: [],
    gastosPorRuta: [],
    recargasPorSede: [],
    recargasPorRuta: [],
  });
  readonly cargando = signal(false);
  readonly usuario = toSignal(this.authService.usuario$, { initialValue: null });
  readonly chartOptions = signal<any | null>(null);
  readonly chartTitle = signal('');

  readonly form = this.fb.group({
    agrupacion: ['mes'],
    desde: [''],
    hasta: [''],
    sede: [''],
    ruta: [''],
    conductor: [''],
  });

  private readonly filtrosSeleccionados = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue() as FiltrosSeleccionados,
  });

  readonly filtrosActivos = computed(() => {
    const filtros = this.filtrosSeleccionados();
    const badges: string[] = [];
    if (filtros.desde) {
      badges.push(`Desde ${filtros.desde}`);
    }
    if (filtros.hasta) {
      badges.push(`Hasta ${filtros.hasta}`);
    }
    if (filtros.sede) {
      const sede = this.sedes().find((item) => item._id === filtros.sede);
      badges.push(`Sede: ${sede?.nombre ?? filtros.sede}`);
    }
    if (filtros.ruta) {
      const ruta = this.rutas().find((item) => item._id === filtros.ruta);
      badges.push(`Ruta: ${ruta?.nombre ?? filtros.ruta}`);
    }
    if (filtros.conductor) {
      const conductor = this.conductores().find((item) => item._id === filtros.conductor);
      badges.push(`Conductor: ${conductor?.nombre ?? filtros.conductor}`);
    }
    return badges;
  });

  readonly sinResultados = computed(() => !this.cargando() && this.detalleRutas().length === 0);

  readonly rutasFiltradas = computed(() => {
    const filtros = this.filtrosSeleccionados();
    if (!filtros.sede) {
      return this.rutas();
    }
    return this.rutas().filter(
      (ruta) =>
        ruta.sedeOrigen?._id === filtros.sede ||
        ruta.sedeDestino?._id === filtros.sede
    );
  });

  readonly conductoresFiltrados = computed(() => {
    const filtros = this.filtrosSeleccionados();
    if (!filtros.sede) {
      return this.conductores();
    }
    return this.conductores().filter((conductor) => conductor.sede?._id === filtros.sede);
  });

  private readonly currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  });
  private readonly dateFormatter = new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  private reporteInicialGenerado = false;

  readonly defaultColDef: ColDef<BalanceDetalleRuta> = {
    sortable: true,
    resizable: true,
    flex: 1,
  };

  readonly rutasColumnDefs: ColDef<BalanceDetalleRuta>[] = [
    { headerName: 'Nombre ruta', field: 'nombreRuta', minWidth: 160 },
    {
      headerName: 'Fecha inicio',
      field: 'fechaInicio',
      minWidth: 140,
      valueFormatter: ({ value }) => this.formatDate(value as string | null | undefined),
    },
    {
      headerName: 'Fecha fin',
      field: 'fechaFin',
      minWidth: 140,
      valueFormatter: ({ value }) => this.formatDate(value as string | null | undefined),
    },
    {
      headerName: 'Recargas',
      field: 'totalRecargas',
      type: 'numericColumn',
      valueFormatter: ({ value }) => this.formatCurrency(value as number),
    },
    {
      headerName: 'Conductor',
      valueGetter: ({ data }) => data?.conductor?.nombre ?? 'N/A',
      minWidth: 160,
    },
    {
      headerName: 'Gastos',
      field: 'totalGastos',
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
    {
      headerName: 'Sede origen',
      valueGetter: ({ data }) => data?.sedeOrigen?.nombre ?? 'N/A',
      minWidth: 150,
    },
    {
      headerName: 'Sede destino',
      valueGetter: ({ data }) => data?.sedeDestino?.nombre ?? 'N/A',
      minWidth: 150,
    },
  ];

  ngOnInit(): void {
    this.sedesService.obtenerTodas().subscribe((sedes) => this.sedes.set(sedes));
    this.rutasService.listar().subscribe((rutas) => this.rutas.set(rutas));
    this.usuariosService
      .listar({ rol: 'CONDUCTOR' })
      .subscribe((conductores) => this.conductores.set(conductores));

    effect(() => {
      const usuario = this.usuario();
      if (!usuario) {
        return;
      }
      this.aplicarRestriccionesPorRol(usuario);
      if (!this.reporteInicialGenerado) {
        this.generarReporte();
        this.reporteInicialGenerado = true;
      }
    });
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
        this.detalleRutas.set(respuesta.detalleRutas ?? []);
        this.sumatorias.set(
          respuesta.sumatorias ?? {
            gastosPorSede: [],
            gastosPorConductor: [],
            gastosPorRuta: [],
            recargasPorSede: [],
            recargasPorRuta: [],
          }
        );
        this.actualizarGrafico();
      });
  }

  formatoMoneda(value: number): string {
    return this.formatCurrency(value);
  }

  descargarCsv() {
    const data = this.detalleRutas();
    if (!data.length) {
      return;
    }

    const encabezado = [
      'Nombre ruta',
      'Fecha inicio',
      'Fecha fin',
      'Total recargas',
      'Total gastos',
      'Balance',
      'Conductor',
      'Sede origen',
      'Sede destino',
    ];
    const filas = data.map((item) => [
      this.sanitizeCsvValue(item.nombreRuta),
      this.formatDate(item.fechaInicio),
      this.formatDate(item.fechaFin),
      item.totalRecargas.toFixed(2),
      item.totalGastos.toFixed(2),
      item.balance.toFixed(2),
      this.sanitizeCsvValue(item.conductor.nombre),
      this.sanitizeCsvValue(item.sedeOrigen.nombre),
      this.sanitizeCsvValue(item.sedeDestino.nombre),
    ]);

    const contenido = [encabezado, ...filas]
      .map((fila) => fila.map((valor) => `"${valor}"`).join(','))
      .join('\r\n');

    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 10);
    const agrupacion = this.form.getRawValue().agrupacion ?? 'general';
    enlace.href = url;
    enlace.download = `reporte_balance_${agrupacion}_${fecha}.csv`;
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }

  private formatCurrency(value: number): string {
    return this.currencyFormatter.format(value ?? 0);
  }

  private formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'N/A';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }
    return this.dateFormatter.format(date);
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
    this.chartTitle.set('Balance por agrupacion seleccionada');
  }

  private aplicarRestriccionesPorRol(usuario: Usuario) {
    if (usuario.rol === 'JEFE' && usuario.sede?._id) {
      this.form.controls.sede.setValue(usuario.sede._id);
      this.form.controls.sede.disable({ emitEvent: false });
    }

    if (usuario.rol === 'CONDUCTOR') {
      this.form.controls.conductor.setValue(usuario._id);
      this.form.controls.conductor.disable({ emitEvent: false });
      if (usuario.sede?._id) {
        this.form.controls.sede.setValue(usuario.sede._id);
        this.form.controls.sede.disable({ emitEvent: false });
      }
    }
  }

  private sanitizeCsvValue(value: string): string {
    return value.replace(/"/g, '""');
  }
}
