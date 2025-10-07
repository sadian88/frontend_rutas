import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import {
  Rol,
  Sede,
  Usuario,
  UsuarioCreatePayload,
  UsuarioUpdatePayload,
} from '../../core/models';
import { UsuariosService } from '../../core/services/usuarios.service';
import { SedesService } from '../../core/services/sedes.service';

type UsuarioRow = Usuario & { sedeId: string };

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AgGridAngular],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss',
})
export class UsuariosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usuariosService = inject(UsuariosService);
  private readonly sedesService = inject(SedesService);
  private gridApi: GridApi<UsuarioRow> | null = null;

  readonly usuarios = signal<Usuario[]>([]);
  readonly sedes = signal<Sede[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mensaje = signal('');
  readonly seleccionado = signal<UsuarioRow | null>(null);

  readonly roles: Rol[] = ['ADMIN', 'JEFE', 'CONDUCTOR'];

  readonly defaultColDef: ColDef<UsuarioRow> = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 140,
  };

  readonly columnDefs: ColDef<UsuarioRow>[] = [
    { headerName: 'Nombre', field: 'nombre', editable: true },
    { headerName: 'Email', field: 'email' },
    {
      headerName: 'Rol',
      field: 'rol',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: this.roles }),
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
      field: 'activo',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['true', 'false'] },
      valueFormatter: ({ value }) => (value ? 'Activo' : 'Inactivo'),
    },
  ];

  readonly rowSelection: 'single' = 'single';

  readonly form = this.fb.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rol: ['CONDUCTOR' as Rol, Validators.required],
    sede: [''],
  });

  readonly usuariosRows = computed<UsuarioRow[]>(() =>
    this.usuarios().map((usuario) => ({
      ...usuario,
      sedeId: this.obtenerSedeId(usuario),
    }))
  );

  ngOnInit(): void {
    this.cargarDatos();
  }

  onGridReady(event: GridReadyEvent<UsuarioRow>) {
    this.gridApi = event.api;
  }

  onSelectionChanged(event: SelectionChangedEvent<UsuarioRow>) {
    const seleccion = event.api.getSelectedRows()[0] ?? null;
    this.seleccionado.set(seleccion);
  }

  onCellValueChanged(event: CellValueChangedEvent<UsuarioRow>) {
    if (!event.data || event.newValue === event.oldValue) {
      return;
    }

    const field = event.colDef.field;
    if (!field) {
      return;
    }

    const payload: UsuarioUpdatePayload = {};

    if (field === 'nombre') {
      const nombre = String(event.newValue || '').trim();
      if (!nombre) {
        event.node.setDataValue(field, event.oldValue);
        return;
      }
      payload.nombre = nombre;
    } else if (field === 'rol') {
      payload.rol = String(event.newValue).toUpperCase() as Rol;
    } else if (field === 'sedeId') {
      payload.sede = event.newValue ? String(event.newValue) : null;
    } else if (field === 'activo') {
      payload.activo = event.newValue === true || event.newValue === 'true';
    } else {
      return;
    }

    this.mensaje.set('');
    this.usuariosService.actualizar(String(event.data._id), payload).subscribe({
      next: (usuarioActualizado) => {
        this.reemplazarUsuario(usuarioActualizado);
        this.mensaje.set('Usuario actualizado');
      },
      error: () => {
        event.node.setDataValue(field, event.oldValue);
      },
    });
  }

  crearUsuario() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UsuarioCreatePayload = {
      nombre: (raw.nombre ?? '').trim(),
      email: (raw.email ?? '').trim(),
      password: raw.password ?? '',
      rol: raw.rol || 'CONDUCTOR',
      sede: raw.sede ? String(raw.sede) : null,
    };

    if (!payload.nombre || !payload.email || !payload.password) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.mensaje.set('');

    this.usuariosService
      .crear(payload)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe((usuario) => {
        this.usuarios.set([usuario, ...this.usuarios()]);
        this.form.reset({ rol: 'CONDUCTOR', sede: '' });
        this.mensaje.set('Usuario creado correctamente');
      });
  }

  eliminarSeleccionado() {
    const seleccionado = this.seleccionado();
    if (!seleccionado) {
      return;
    }

    const confirmacion = window.confirm(`Eliminar al usuario ${seleccionado.nombre}?`);
    if (!confirmacion) {
      return;
    }

    this.usuariosService.eliminar(String(seleccionado._id)).subscribe(() => {
      this.usuarios.set(this.usuarios().filter((usuario) => usuario._id !== seleccionado._id));
      this.seleccionado.set(null);
      this.mensaje.set('Usuario eliminado');
      if (this.gridApi) {
        this.gridApi.deselectAll();
      }
    });
  }

  private cargarDatos() {
    this.cargando.set(true);
    this.mensaje.set('');

    this.usuariosService
      .listar()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe((usuarios) => this.usuarios.set(usuarios));

    this.sedesService.obtenerTodas().subscribe((sedes) => this.sedes.set(sedes));
  }

  private reemplazarUsuario(actualizado: Usuario) {
    this.usuarios.set(this.usuarios().map((usuario) => (usuario._id === actualizado._id ? actualizado : usuario)));
  }

  private obtenerSedeId(usuario: Usuario) {
    const sede = usuario.sede as unknown;
    if (!sede) {
      return '';
    }
    if (typeof sede === 'string') {
      return sede;
    }
    return (sede as Sede)._id;
  }

  private sedeOptions() {
    return [''].concat(this.sedes().map((sede) => sede._id));
  }

  private nombreSede(id: string | null | undefined) {
    if (!id) {
      return 'Sin asignar';
    }
    const sede = this.sedes().find((item) => item._id === id);
    return sede ? sede.nombre : 'Sin asignar';
  }

  verEnTabla(id: string) {
    if (!this.gridApi) {
      return;
    }
    let targetNode: any = null;
    this.gridApi.forEachNode((node) => {
      if (node.data?._id === id) {
        targetNode = node;
      }
    });
    if (targetNode) {
      this.gridApi.ensureNodeVisible(targetNode);
      targetNode.setSelected(true);
      this.seleccionado.set(targetNode.data);
    }
  }

  eliminarDesdeCard(id: string) {
    const usuario = this.usuarios().find((item) => item._id === id);
    if (!usuario) {
      return;
    }
    const confirmacion = window.confirm(`Eliminar al usuario ${usuario.nombre}?`);
    if (!confirmacion) {
      return;
    }
    this.usuariosService.eliminar(id).subscribe(() => {
      this.usuarios.set(this.usuarios().filter((item) => item._id !== id));
      this.mensaje.set('Usuario eliminado');
      this.seleccionado.set(null);
      this.gridApi?.deselectAll();
    });
  }
}
