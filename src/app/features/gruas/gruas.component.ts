import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { GruasService } from '../../core/services/gruas.service';
import { SedesService } from '../../core/services/sedes.service';
import { EstadoGrua, Grua, GruaPayload, Sede, Usuario } from '../../core/models';
import { AgGridAngular } from 'ag-grid-angular';
import { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';

interface GruaRow {
  id: string;
  codigo: string;
  placa: string;
  modelo: string;
  capacidadToneladas: number | null;
  sedeId: string;
  estado: EstadoGrua;
  descripcion: string;
}

@Component({
  selector: 'app-gruas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AgGridAngular],
  templateUrl: './gruas.component.html',
  styleUrl: './gruas.component.scss',
})
export class GruasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly gruas = signal<Grua[]>([]);
  readonly sedes = signal<Sede[]>([]);
  readonly usuario = signal<Usuario | null>(null);
  readonly mensaje = signal('');
  readonly cargando = signal(false);
  private gridApi: GridApi<GruaRow> | null = null;

  readonly seleccionadaId = signal<string | null>(null);
  readonly gruaSeleccionada = computed(() => {
    const id = this.seleccionadaId();
    if (!id) {
      return null;
    }
    return this.gruas().find((grua) => grua._id === id) ?? null;
  });

  readonly rowSelection: 'single' = 'single';

  readonly defaultColDef: ColDef<GruaRow> = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
  };

  readonly gruasColumnDefs: ColDef<GruaRow>[] = [
    { headerName: 'Codigo', field: 'codigo', editable: true },
    { headerName: 'Placa', field: 'placa', editable: true },
    { headerName: 'Modelo', field: 'modelo', editable: true, valueFormatter: ({ value }) => value || 'N/A' },
    {
      headerName: 'Capacidad (ton)',
      field: 'capacidadToneladas',
      editable: true,
      type: 'numericColumn',
      valueFormatter: ({ value }) => (value || value === 0 ? `${value} ton` : 'N/A'),
    },
    {
      headerName: 'Sede',
      field: 'sedeId',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: this.sedeOptions() }),
      valueFormatter: ({ value }) => this.nombreSede(value as string),
    },
    {
      headerName: 'Estado',
      field: 'estado',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: this.estados }),
    },
    {
      headerName: 'Descripcion',
      field: 'descripcion',
      flex: 2,
      editable: true,
      valueFormatter: ({ value }) => value || 'N/A',
    },
  ];

  readonly form = this.fb.group({
    codigo: ['', Validators.required],
    placa: ['', Validators.required],
    modelo: [''],
    capacidadToneladas: [null as number | null],
    sede: ['', Validators.required],
    estado: ['EN_SERVICIO'],
    descripcion: [''],
  });

  readonly gruasRowData = computed<GruaRow[]>(() =>
    this.gruas().map((grua) => ({
      id: grua._id,
      codigo: grua.codigo,
      placa: grua.placa,
      modelo: grua.modelo ?? '',
      capacidadToneladas: grua.capacidadToneladas ?? null,
      sedeId: this.obtenerSedeId(grua),
      estado: grua.estado,
      descripcion: grua.descripcion ?? '',
    })),
  );

  estados = ['EN_SERVICIO', 'MANTENIMIENTO', 'INACTIVA'];

  constructor(
    private readonly gruasService: GruasService,
    private readonly sedesService: SedesService,
    private readonly authService: AuthService,
  ) {
    this.authService.usuario$.subscribe((usuario) => this.usuario.set(usuario));
  }

  onGruaCellValueChanged(event: CellValueChangedEvent<GruaRow>) {
    if (!event.data) {
      return;
    }

    const field = event.colDef.field;
    if (!field) {
      return;
    }

    const nuevoValor = event.newValue;
    const valorAnterior = event.oldValue;

    if (nuevoValor === valorAnterior) {
      return;
    }

    const payload: Record<string, unknown> = {};
    let valido = true;

    if (field === 'codigo') {
      const codigo = String(nuevoValor ?? '').trim();
      if (!codigo) {
        valido = false;
      } else {
        payload['codigo'] = codigo;
      }
    } else if (field === 'placa') {
      const placa = String(nuevoValor ?? '').trim();
      if (!placa) {
        valido = false;
      } else {
        payload['placa'] = placa;
      }
    } else if (field === 'modelo') {
      const modelo = String(nuevoValor ?? '').trim();
      payload['modelo'] = modelo || null;
    } else if (field === 'capacidadToneladas') {
      if (nuevoValor === '' || nuevoValor === null || nuevoValor === undefined) {
        payload['capacidadToneladas'] = null;
      } else {
        const capacidad = Number(nuevoValor);
        if (!Number.isFinite(capacidad) || capacidad < 0) {
          valido = false;
        } else {
          payload['capacidadToneladas'] = capacidad;
        }
      }
    } else if (field === 'sedeId') {
      const sedeId = String(nuevoValor ?? '');
      if (!sedeId || !this.sedes().some((sede) => sede._id === sedeId)) {
        valido = false;
      } else {
        payload['sede'] = sedeId;
      }
    } else if (field === 'estado') {
      const estado = String(nuevoValor ?? '').toUpperCase() as EstadoGrua;
      if (!this.estados.includes(estado)) {
        valido = false;
      } else {
        payload['estado'] = estado;
      }
    } else if (field === 'descripcion') {
      const descripcion = String(nuevoValor ?? '').trim();
      payload['descripcion'] = descripcion || null;
    } else {
      valido = false;
    }

    if (!valido || !Object.keys(payload).length) {
      event.node.setDataValue(field, valorAnterior);
      return;
    }

    this.cargando.set(true);
    this.mensaje.set('');

    this.gruasService
      .actualizar(event.data.id, payload as Partial<GruaPayload>)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.gruas.set(this.gruas().map((item) => (item._id === respuesta.grua._id ? respuesta.grua : item)));
          this.mensaje.set('Grua actualizada');
        },
        error: () => {
          event.node.setDataValue(field, valorAnterior);
          this.mensaje.set('No fue posible actualizar la grua');
        },
      });
  }

  onGridReady(event: GridReadyEvent<GruaRow>) {
    this.gridApi = event.api;
  }

  onSelectionChanged(event: SelectionChangedEvent<GruaRow>) {
    const seleccion = event.api.getSelectedRows()[0] ?? null;
    this.seleccionadaId.set(seleccion ? seleccion.id : null);
  }

  eliminarGrua() {
    const seleccion = this.gruaSeleccionada();
    if (!seleccion) {
      return;
    }
    const confirmar = window.confirm(`Eliminar la grua ${seleccion.codigo} - ${seleccion.placa}?`);
    if (!confirmar) {
      return;
    }

    this.cargando.set(true);
    this.mensaje.set('');

    this.gruasService
      .eliminar(seleccion._id)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: () => {
          this.gruas.set(this.gruas().filter((grua) => grua._id !== seleccion._id));
          this.seleccionadaId.set(null);
          this.gridApi?.deselectAll();
          this.mensaje.set('Grua eliminada');
        },
        error: () => {
          this.mensaje.set('No fue posible eliminar la grua');
        },
      });
  }

  seleccionarParaEliminar(id: string) {
    this.seleccionadaId.set(id);
    this.eliminarGrua();
  }

  verEnTabla(id: string) {
    if (!this.gridApi) {
      return;
    }
    let targetNode: any = null;
    this.gridApi.forEachNode((node) => {
      if (node.data?.id === id) {
        targetNode = node;
      }
    });
    if (targetNode) {
      this.gridApi.ensureNodeVisible(targetNode);
      targetNode.setSelected(true);
      this.seleccionadaId.set(id);
    }
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  crearGrua() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.mensaje.set('');

    const raw = this.form.getRawValue();
    const codigo = raw.codigo?.trim() ?? '';
    const placa = raw.placa?.trim() ?? '';
    if (!codigo || !placa) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: GruaPayload = {
      codigo,
      placa,
      sede: raw.sede!,
      estado: (raw.estado || 'EN_SERVICIO') as EstadoGrua,
    };

    if (raw.modelo) {
      const modelo = raw.modelo.trim();
      if (modelo) {
        payload.modelo = modelo;
      }
    }
    if (raw.capacidadToneladas !== null && raw.capacidadToneladas !== undefined) {
      payload.capacidadToneladas = raw.capacidadToneladas;
    }
    if (raw.descripcion) {
      const descripcion = raw.descripcion.trim();
      if (descripcion) {
        payload.descripcion = descripcion;
      }
    }

    this.gruasService
      .crear(payload)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe((respuesta) => {
        this.gruas.set([respuesta.grua, ...this.gruas()]);
        this.gridApi?.deselectAll();
        this.seleccionadaId.set(null);
        this.form.reset({ estado: 'EN_SERVICIO', sede: this.form.get('sede')?.value || '' });
        this.mensaje.set('Grua registrada correctamente');
      });
  }

  private obtenerSedeId(grua: Grua) {
    const sedeRef = grua.sede as unknown;
    if (!sedeRef) {
      return '';
    }
    if (typeof sedeRef === 'string') {
      return sedeRef;
    }
    return (sedeRef as Sede)._id;
  }

  private sedeOptions() {
    return this.sedes().map((sede) => sede._id);
  }

  private nombreSede(id: string | null | undefined) {
    if (!id) {
      return 'Sin asignar';
    }
    const sede = this.sedes().find((item) => item._id === id);
    return sede ? sede.nombre : 'Sin asignar';
  }

  sedeNombre(grua: Grua) {
    const sedeRef = grua.sede as unknown;
    if (!sedeRef) {
      return 'Sin asignar';
    }
    if (typeof sedeRef === 'string') {
      const sede = this.sedes().find((item) => item._id === sedeRef);
      return sede ? sede.nombre : 'Sin asignar';
    }
    return (sedeRef as Sede).nombre ?? 'Sin asignar';
  }

  private cargarDatos() {
    this.cargando.set(true);
    this.gruasService
      .obtenerTodas()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe((gruas) => {
        this.gruas.set(gruas);
        this.seleccionadaId.set(null);
        this.gridApi?.deselectAll();
      });

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
        const sedeAsignada = sedeId ? sedes.find((s) => s._id === sedeId) : undefined;
        this.sedes.set(sedeAsignada ? [sedeAsignada] : []);
        if (sedeAsignada) {
          this.form.patchValue({ sede: sedeAsignada._id });
        }
      } else {
        this.sedes.set(sedes);
      }
    });
  }
}
