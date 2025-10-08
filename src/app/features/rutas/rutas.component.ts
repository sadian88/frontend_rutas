import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { GruasService } from '../../core/services/gruas.service';
import { RutasService } from '../../core/services/rutas.service';
import { SedesService } from '../../core/services/sedes.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { Grua, Ruta, RutaPayload, Sede, Usuario } from '../../core/models';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, RowDoubleClickedEvent } from 'ag-grid-community';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-rutas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AgGridAngular],
  templateUrl: './rutas.component.html',
  styleUrl: './rutas.component.scss',
})
export class RutasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly rutas = signal<Ruta[]>([]);
  readonly sedes = signal<Sede[]>([]);
  readonly gruas = signal<Grua[]>([]);
  readonly conductores = signal<Usuario[]>([]);
  readonly usuario = signal<Usuario | null>(null);
  readonly cargando = signal(false);
  readonly mensaje = signal('');
  private readonly notifier = inject(NotificationService);

  readonly estados = ['PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA'];

  private readonly currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  });

  readonly defaultColDef: ColDef<Ruta> = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 140,
  };

  readonly rutasColumnDefs: ColDef<Ruta>[] = [
    { headerName: 'Nombre', field: 'nombre', flex: 1.3 },
    { headerName: 'Estado', field: 'estado' },
    {
      headerName: 'Sede origen',
      valueGetter: ({ data }) => data?.sedeOrigen?.nombre ?? 'N/A',
    },
    {
      headerName: 'Sede destino',
      valueGetter: ({ data }) => data?.sedeDestino?.nombre ?? 'N/A',
    },
    {
      headerName: 'Grua',
      valueGetter: ({ data }) =>
        data?.grua ? `${data.grua.codigo} - ${data.grua.placa}` : 'N/A',
      flex: 1.4,
    },
    {
      headerName: 'Conductor',
      valueGetter: ({ data }) => data?.conductor?.nombre ?? 'N/A',
    },
    {
      headerName: 'Inicio',
      field: 'fechaInicio',
      valueFormatter: ({ value }) => this.formatFecha(value as string),
    },
    {
      headerName: 'Fin',
      field: 'fechaFin',
      valueFormatter: ({ value }) => this.formatFecha(value as string | undefined),
    },
    {
      headerName: 'Kilometros',
      field: 'kilometros',
      type: 'numericColumn',
      valueFormatter: ({ value }) => (value || value === 0 ? `${value} km` : 'N/A'),
    },
    {
      headerName: 'Gastos',
      valueGetter: ({ data }) => data?.resumen?.totalGastos ?? 0,
      valueFormatter: ({ value }) => this.formatMoneda(value as number),
    },
    {
      headerName: 'Recargas',
      valueGetter: ({ data }) => data?.resumen?.totalRecargas ?? 0,
      valueFormatter: ({ value }) => this.formatMoneda(value as number),
    },
    {
      headerName: 'Balance',
      valueGetter: ({ data }) => data?.resumen?.balance ?? 0,
      cellClass: (params) => (params.value < 0 ? 'saldo-negativo' : undefined),
      valueFormatter: ({ value }) => this.formatMoneda(value as number),
    },
  ];

  readonly filtrosForm = this.fb.group({
    estado: [''],
    sede: [''],
    conductor: [''],
  });

  readonly crearForm = this.fb.group({
    nombre: ['', Validators.required],
    sedeOrigen: ['', Validators.required],
    sedeDestino: ['', Validators.required],
    grua: ['', Validators.required],
    conductor: ['', Validators.required],
    fechaInicio: ['', Validators.required],
    fechaFin: [''],
    estado: ['PROGRAMADA'],
    kilometros: [null as number | null],
    observaciones: [''],
  });

  readonly gruasDisponibles = computed(() => {
    const origen = this.crearForm.get('sedeOrigen')?.value;
    if (!origen) {
      return this.gruas();
    }
    return this.gruas().filter((grua) => {
      const sedeRef = grua.sede as unknown;
      if (typeof sedeRef === 'string') {
        return sedeRef === origen;
      }
      const sedeObj = sedeRef as Sede | null | undefined;
      return sedeObj?._id === origen;
    });
  });

  readonly puedeCrear = computed(() => {
    const user = this.usuario();
    return user?.rol === 'ADMIN' || user?.rol === 'JEFE';
  });

  constructor(
    private readonly rutasService: RutasService,
    private readonly sedesService: SedesService,
    private readonly gruasService: GruasService,
    private readonly usuariosService: UsuariosService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.authService.usuario$.subscribe((usuario) => this.usuario.set(usuario));
  }

  ngOnInit(): void {
    this.cargarDatos();
    this.filtrosForm.valueChanges.subscribe(() => this.aplicarFiltros());
  }

  aplicarFiltros() {
    const filtros = this.filtrosForm.getRawValue();
    this.rutasService
      .listar({
        estado: filtros.estado || undefined,
        sede: filtros.sede || undefined,
        conductor: filtros.conductor || undefined,
      })
      .subscribe((rutas) => this.rutas.set(rutas));
  }

  crearRuta() {
    if (this.crearForm.invalid) {
      this.crearForm.markAllAsTouched();
      return;
    }

    const raw = this.crearForm.getRawValue();

    const nombre = raw.nombre?.trim() ?? '';
    if (!nombre) {
      this.crearForm.get('nombre')?.setErrors({ required: true });
      this.crearForm.markAllAsTouched();
      return;
    }

    const sedeOrigen = raw.sedeOrigen;
    const sedeDestino = raw.sedeDestino;
    const grua = raw.grua;
    const conductor = raw.conductor;
    const fechaInicio = raw.fechaInicio;

    if (!sedeOrigen || !sedeDestino || !grua || !conductor || !fechaInicio) {
      this.crearForm.markAllAsTouched();
      return;
    }

    const payload: RutaPayload = {
      nombre,
      sedeOrigen,
      sedeDestino,
      grua,
      conductor,
      fechaInicio,
      estado: (raw.estado || 'PROGRAMADA') as RutaPayload['estado'],
    };

    if (raw.fechaFin) {
      payload.fechaFin = raw.fechaFin;
    }
    if (raw.kilometros !== null && raw.kilometros !== undefined) {
      payload.kilometros = raw.kilometros;
    }
    if (raw.observaciones) {
      const observaciones = raw.observaciones.trim();
      if (observaciones) {
        payload.observaciones = observaciones;
      }
    }

    this.cargando.set(true);
    this.mensaje.set('');

    this.rutasService
      .crear(payload)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe((respuesta) => {
        this.rutas.set([respuesta.ruta, ...this.rutas()]);
        this.mensaje.set('Ruta registrada correctamente');
        this.notifier.success('Ruta registrada correctamente');
        this.crearForm.reset({ estado: 'PROGRAMADA' });
        this.aplicarFiltros();
      });
  }

  onRutaRowDoubleClicked(event: RowDoubleClickedEvent<Ruta>) {
    if (!event.data?._id) {
      return;
    }
    this.router.navigate(['/rutas', event.data._id]);
  }

  irADetalle(id: string) {
    if (!id) {
      return;
    }
    this.router.navigate(['/rutas', id]);
  }

  formatoMoneda(valor: number) {
    return this.formatMoneda(valor);
  }

  private formatFecha(valor?: string): string {
    if (!valor) {
      return 'N/A';
    }
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
      return valor;
    }
    return new Intl.DateTimeFormat('es-CO').format(fecha);
  }

  private formatMoneda(valor: number): string {
    return this.currencyFormatter.format(valor ?? 0);
  }

  private cargarDatos() {
    this.cargando.set(true);

    this.rutasService
      .listar()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe((rutas) => this.rutas.set(rutas));

    this.sedesService.obtenerTodas().subscribe((sedes) => {
      const user = this.usuario();
      if (user?.rol === 'JEFE' && user.sede) {
        const sedeUsuario = user.sede as unknown;
        let sedeId: string | null = null;
        if (typeof sedeUsuario === 'string') {
          sedeId = sedeUsuario;
        } else if (sedeUsuario && typeof sedeUsuario === 'object' && '_id' in sedeUsuario) {
          sedeId = (sedeUsuario as Sede)._id;
        }
        const sedesFiltradas = sedeId ? sedes.filter((sede) => sede._id === sedeId) : [];
        this.sedes.set(sedesFiltradas);
        if (sedesFiltradas.length) {
          this.crearForm.patchValue({ sedeOrigen: sedesFiltradas[0]._id });
        }
      } else {
        this.sedes.set(sedes);
      }
    });

    this.gruasService.obtenerTodas().subscribe((gruas) => this.gruas.set(gruas));
    this.usuariosService.listar({ rol: 'CONDUCTOR' }).subscribe((conductores) => this.conductores.set(conductores));
  }
}

