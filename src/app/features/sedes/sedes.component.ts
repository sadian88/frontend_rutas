import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { SedesService } from '../../core/services/sedes.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { Sede, SedePayload, Usuario } from '../../core/models';
import { AgGridAngular } from 'ag-grid-angular';
import { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';

interface SedeRow {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  descripcion: string;
  jefeId: string;
}

@Component({
  selector: 'app-sedes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AgGridAngular],
  templateUrl: './sedes.component.html',
  styleUrl: './sedes.component.scss',
})
export class SedesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly sedes = signal<Sede[]>([]);
  readonly jefes = signal<Usuario[]>([]);
  readonly cargando = signal(false);
  readonly mensaje = signal('');
  private gridApi: GridApi<SedeRow> | null = null;

  readonly seleccionadaId = signal<string | null>(null);
  readonly sedeSeleccionada = computed(() => {
    const id = this.seleccionadaId();
    if (!id) {
      return null;
    }
    return this.sedes().find((sede) => sede._id === id) ?? null;
  });

  readonly rowSelection: 'single' = 'single';

  readonly defaultColDef: ColDef<SedeRow> = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
  };

  readonly sedesColumnDefs: ColDef<SedeRow>[] = [
    { headerName: 'Nombre', field: 'nombre', editable: true },
    {
      headerName: 'Direccion',
      field: 'direccion',
      editable: true,
      valueFormatter: ({ value }) => value || 'N/A',
    },
    {
      headerName: 'Telefono',
      field: 'telefono',
      editable: true,
      valueFormatter: ({ value }) => value || 'N/A',
    },
    {
      headerName: 'Descripcion',
      field: 'descripcion',
      flex: 2,
      editable: true,
      valueFormatter: ({ value }) => value || 'N/A',
    },
    {
      headerName: 'Jefe asignado',
      field: 'jefeId',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: this.jefeOptions() }),
      valueFormatter: ({ value }) => this.nombreJefe(value as string),
    },
  ];

  readonly sedesRowData = computed<SedeRow[]>(() =>
    this.sedes().map((sede) => ({
      id: sede._id,
      nombre: sede.nombre,
      direccion: sede.direccion ?? '',
      telefono: sede.telefono ?? '',
      descripcion: sede.descripcion ?? '',
      jefeId: sede.jefe?._id ?? '',
    })),
  );

  readonly form = this.fb.group({
    nombre: ['', Validators.required],
    direccion: [''],
    telefono: [''],
    descripcion: [''],
    jefe: [''],
  });

  constructor(
    private readonly sedesService: SedesService,
    private readonly usuariosService: UsuariosService,
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  crearSede() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.mensaje.set('');

    const raw = this.form.getRawValue();

    const body: SedePayload = {
      nombre: raw.nombre?.trim() ?? '',
      direccion: raw.direccion?.trim() || undefined,
      telefono: raw.telefono?.trim() || undefined,
      descripcion: raw.descripcion?.trim() || undefined,
      jefe: raw.jefe || undefined,
    };

    if (!body.nombre) {
      this.form.get('nombre')?.setErrors({ required: true });
      this.form.markAllAsTouched();
      return;
    }

    this.sedesService
      .crear(body)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe((respuesta) => {
        this.sedes.set([respuesta.sede, ...this.sedes()]);
        this.form.reset({ jefe: '' });
        this.mensaje.set('Sede creada correctamente');
      });
  }

  onSedeCellValueChanged(event: CellValueChangedEvent<SedeRow>) {
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

    if (field === 'jefeId') {
      const nuevoJefe = (nuevoValor as string) ?? '';
      const anterior = (valorAnterior as string) ?? '';
      if (nuevoJefe === anterior) {
        return;
      }
      this.asignarJefe(event.data.id, nuevoJefe);
      return;
    }

    const payload: Record<string, unknown> = {};
    let valido = true;

    if (field === 'nombre') {
      const nombre = String(nuevoValor ?? '').trim();
      if (!nombre) {
        valido = false;
      } else {
        payload['nombre'] = nombre;
      }
    } else if (field === 'direccion') {
      const direccion = String(nuevoValor ?? '').trim();
      payload['direccion'] = direccion || null;
    } else if (field === 'telefono') {
      const telefono = String(nuevoValor ?? '').trim();
      payload['telefono'] = telefono || null;
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
    this.sedesService
      .actualizar(event.data.id, payload as Partial<SedePayload>)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.sedes.set(this.sedes().map((sede) => (sede._id === respuesta.sede._id ? respuesta.sede : sede)));
          this.mensaje.set('Sede actualizada');
        },
        error: () => {
          event.node.setDataValue(field, valorAnterior);
        },
      });
  }

  asignarJefe(sedeId: string, jefeId: string) {
    this.cargando.set(true);
    this.mensaje.set('');
    const payload: Partial<SedePayload> = { jefe: jefeId || null };
    this.sedesService
      .actualizar(sedeId, payload)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe((respuesta) => {
        this.sedes.set(this.sedes().map((sede) => (sede._id === sedeId ? respuesta.sede : sede)));
        this.mensaje.set('Jefe actualizado');
      });
  }

  onGridReady(event: GridReadyEvent<SedeRow>) {
    this.gridApi = event.api;
  }

  onSelectionChanged(event: SelectionChangedEvent<SedeRow>) {
    const seleccion = event.api.getSelectedRows()[0] ?? null;
    this.seleccionadaId.set(seleccion ? seleccion.id : null);
  }

  eliminarSede() {
    const seleccion = this.sedeSeleccionada();
    if (!seleccion) {
      return;
    }
    const confirmar = window.confirm(`Eliminar la sede "${seleccion.nombre}"?`);
    if (!confirmar) {
      return;
    }

    this.cargando.set(true);
    this.mensaje.set('');

    this.sedesService
      .eliminar(seleccion._id)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: () => {
          this.sedes.set(this.sedes().filter((sede) => sede._id !== seleccion._id));
          this.seleccionadaId.set(null);
          this.gridApi?.deselectAll();
          this.mensaje.set('Sede eliminada');
        },
        error: () => {
          this.mensaje.set('No fue posible eliminar la sede');
        },
      });
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

  private jefeOptions(): string[] {
    return [''].concat(this.jefes().map((jefe) => jefe._id));
  }

  private nombreJefe(id: string | null | undefined): string {
    if (!id) {
      return 'Sin asignar';
    }
    const jefe = this.jefes().find((usuario) => usuario._id === id);
    return jefe ? `${jefe.nombre} - ${jefe.email}` : 'Sin asignar';
  }

  private cargarDatos() {
    this.cargando.set(true);
    this.sedesService
      .obtenerTodas()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe((sedes) => {
        this.sedes.set(sedes);
        this.seleccionadaId.set(null);
        this.gridApi?.deselectAll();
      });

    this.usuariosService
      .listar({ rol: 'JEFE' })
      .subscribe((usuarios) => this.jefes.set(usuarios));
  }
}
