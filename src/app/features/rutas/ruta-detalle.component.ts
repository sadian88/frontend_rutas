import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { RutasService } from '../../core/services/rutas.service';
import { Gasto, GastoPayload, Recarga, RecargaPayload, Ruta, Usuario } from '../../core/models';

@Component({
  selector: 'app-ruta-detalle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ruta-detalle.component.html',
  styleUrl: './ruta-detalle.component.scss',
})
export class RutaDetalleComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly location = inject(Location);

  readonly ruta = signal<Ruta | null>(null);
  readonly gastos = signal<Gasto[]>([]);
  readonly recargas = signal<Recarga[]>([]);
  readonly usuario = signal<Usuario | null>(null);
  readonly cargando = signal(false);
  readonly mensaje = signal('');
  readonly gastoEditando = signal<Gasto | null>(null);
  readonly recargaEditando = signal<Recarga | null>(null);

  private subs = new Subscription();

  readonly categorias = ['PEAJE', 'COMBUSTIBLE', 'ALIMENTACION', 'HOSPEDAJE', 'MANTENIMIENTO', 'OTRO'];

  readonly gastoForm = this.fb.nonNullable.group({
    descripcion: ['', Validators.required],
    categoria: ['PEAJE', Validators.required],
    monto: [0, [Validators.required, Validators.min(1)]],
    fecha: [this.obtenerFechaHoy(), Validators.required],
    comprobanteUrl: [''],
  });

  readonly recargaForm = this.fb.nonNullable.group({
    descripcion: ['', Validators.required],
    monto: [0, [Validators.required, Validators.min(1)]],
    fecha: [this.obtenerFechaHoy(), Validators.required],
  });

  readonly puedeRegistrarGasto = computed(() => {
    const user = this.usuario();
    const ruta = this.ruta();
    if (!user || !ruta) {
      return false;
    }
    if (user.rol === 'ADMIN') {
      return true;
    }
    return user.rol === 'CONDUCTOR' && ruta.conductor?._id === user._id;
  });

  readonly puedeRegistrarRecarga = computed(() => {
    const user = this.usuario();
    if (!user) {
      return false;
    }
    return user.rol === 'ADMIN' || user.rol === 'JEFE';
  });

  constructor(
    private readonly rutasService: RutasService,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService,
  ) {
    this.subs.add(this.authService.usuario$.subscribe((usuario) => this.usuario.set(usuario)));
  }

  volver() {
    this.location.back();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.cargarDetalle(id);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  registrarGasto() {
    const rutaActual = this.ruta();
    if (!rutaActual) {
      return;
    }

    if (this.gastoForm.invalid || this.cargando()) {
      this.gastoForm.markAllAsTouched();
      return;
    }

    const raw = this.gastoForm.getRawValue();
    const descripcion = (raw.descripcion ?? '').trim();
    if (!descripcion) {
      this.gastoForm.get('descripcion')?.setErrors({ required: true });
      this.gastoForm.markAllAsTouched();
      return;
    }

    const monto = Number(raw.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      this.gastoForm.get('monto')?.setErrors({ min: true });
      this.gastoForm.markAllAsTouched();
      return;
    }

    const payload: GastoPayload = {
      descripcion,
      categoria: raw.categoria as GastoPayload['categoria'],
      monto,
      fecha: raw.fecha || this.obtenerFechaHoy(),
    };

    const comprobante = (raw.comprobanteUrl ?? '').trim();
    if (comprobante) {
      payload.comprobanteUrl = comprobante;
    } else {
      payload.comprobanteUrl = null;
    }

    this.cargando.set(true);
    this.mensaje.set('');

    const gastoEnEdicion = this.gastoEditando();
    const request$ = gastoEnEdicion
      ? this.rutasService.actualizarGasto(rutaActual._id, gastoEnEdicion._id, payload)
      : this.rutasService.registrarGasto(rutaActual._id, payload);

    request$
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe((respuesta) => {
        const gasto = respuesta.gasto;
        if (gastoEnEdicion) {
          this.gastos.set(this.gastos().map((item) => (item._id === gasto._id ? gasto : item)));
          this.mensaje.set('Gasto actualizado');
        } else {
          this.gastos.set([gasto, ...this.gastos()]);
          this.mensaje.set('Gasto registrado');
        }
        this.resetGastoForm();
        this.actualizarResumen();
      });
  }

  registrarRecarga() {
    const rutaActual = this.ruta();
    if (!rutaActual) {
      return;
    }

    if (this.recargaForm.invalid || this.cargando()) {
      this.recargaForm.markAllAsTouched();
      return;
    }

    const raw = this.recargaForm.getRawValue();
    const descripcion = (raw.descripcion ?? '').trim();
    if (!descripcion) {
      this.recargaForm.get('descripcion')?.setErrors({ required: true });
      this.recargaForm.markAllAsTouched();
      return;
    }

    const monto = Number(raw.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      this.recargaForm.get('monto')?.setErrors({ min: true });
      this.recargaForm.markAllAsTouched();
      return;
    }

    const payload: RecargaPayload = {
      descripcion,
      monto,
      fecha: raw.fecha || this.obtenerFechaHoy(),
    };

    this.cargando.set(true);
    this.mensaje.set('');

    const recargaEnEdicion = this.recargaEditando();
    const request$ = recargaEnEdicion
      ? this.rutasService.actualizarRecarga(rutaActual._id, recargaEnEdicion._id, payload)
      : this.rutasService.registrarRecarga(rutaActual._id, payload);

    request$
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe((respuesta) => {
        const recarga = respuesta.recarga;
        if (recargaEnEdicion) {
          this.recargas.set(this.recargas().map((item) => (item._id === recarga._id ? recarga : item)));
          this.mensaje.set('Recarga actualizada');
        } else {
          this.recargas.set([recarga, ...this.recargas()]);
          this.mensaje.set('Recarga registrada');
        }
        this.resetRecargaForm();
        this.actualizarResumen();
      });
  }

  editarGasto(gasto: Gasto) {
    if (!this.puedeGestionarGasto(gasto)) {
      return;
    }
    this.gastoEditando.set(gasto);
    this.gastoForm.setValue({
      descripcion: gasto.descripcion,
      categoria: gasto.categoria,
      monto: gasto.monto,
      fecha: this.toInputDate(gasto.fecha),
      comprobanteUrl: gasto.comprobanteUrl ?? '',
    });
    this.mensaje.set('');
  }

  cancelarEdicionGasto() {
    this.resetGastoForm();
  }

  eliminarGasto(gasto: Gasto) {
    const rutaActual = this.ruta();
    if (!rutaActual || !this.puedeGestionarGasto(gasto)) {
      return;
    }
    const confirmar = window.confirm(`Eliminar el gasto "${gasto.descripcion}"?`);
    if (!confirmar) {
      return;
    }
    this.cargando.set(true);
    this.mensaje.set('');
    this.rutasService
      .eliminarGasto(rutaActual._id, gasto._id)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe(() => {
        this.gastos.set(this.gastos().filter((item) => item._id !== gasto._id));
        if (this.gastoEditando()?._id === gasto._id) {
          this.resetGastoForm();
        }
        this.mensaje.set('Gasto eliminado');
        this.actualizarResumen();
      });
  }

  editarRecarga(recarga: Recarga) {
    if (!this.puedeGestionarRecarga(recarga)) {
      return;
    }
    this.recargaEditando.set(recarga);
    this.recargaForm.setValue({
      descripcion: recarga.descripcion,
      monto: recarga.monto,
      fecha: this.toInputDate(recarga.fecha),
    });
    this.mensaje.set('');
  }

  cancelarEdicionRecarga() {
    this.resetRecargaForm();
  }

  eliminarRecarga(recarga: Recarga) {
    const rutaActual = this.ruta();
    if (!rutaActual || !this.puedeGestionarRecarga(recarga)) {
      return;
    }
    const confirmar = window.confirm(`Eliminar la recarga "${recarga.descripcion}"?`);
    if (!confirmar) {
      return;
    }
    this.cargando.set(true);
    this.mensaje.set('');
    this.rutasService
      .eliminarRecarga(rutaActual._id, recarga._id)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe(() => {
        this.recargas.set(this.recargas().filter((item) => item._id !== recarga._id));
        if (this.recargaEditando()?._id === recarga._id) {
          this.resetRecargaForm();
        }
        this.mensaje.set('Recarga eliminada');
        this.actualizarResumen();
      });
  }

  puedeGestionarGasto(gasto: Gasto) {
    const user = this.usuario();
    if (!user) {
      return false;
    }
    if (user.rol === 'ADMIN') {
      return true;
    }
    if (user.rol === 'CONDUCTOR') {
      const conductorRef = gasto.conductor as unknown;
      if (!conductorRef) {
        return false;
      }
      if (typeof conductorRef === 'string') {
        return conductorRef === user._id;
      }
      return (conductorRef as Usuario)._id === user._id;
    }
    return false;
  }

  puedeGestionarRecarga(recarga: Recarga) {
    const user = this.usuario();
    if (!user) {
      return false;
    }
    if (user.rol === 'ADMIN') {
      return true;
    }
    if (user.rol === 'JEFE') {
      const jefeRef = recarga.jefe as unknown;
      if (!jefeRef) {
        return false;
      }
      if (typeof jefeRef === 'string') {
        return jefeRef === user._id;
      }
      return (jefeRef as Usuario)._id === user._id;
    }
    return false;
  }

  private cargarDetalle(id: string) {
    this.cargando.set(true);
    this.rutasService
      .detalle(id)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe(({ ruta, gastos, recargas }) => {
        this.ruta.set(ruta);
        this.gastos.set(gastos);
        this.recargas.set(recargas);
        this.resetGastoForm();
        this.resetRecargaForm();
      });
  }

  private actualizarResumen() {
    const rutaActual = this.ruta();
    if (!rutaActual) {
      return;
    }
    this.rutasService.detalle(rutaActual._id).subscribe(({ ruta, gastos, recargas }) => {
      this.ruta.set(ruta);
      this.gastos.set(gastos);
      this.recargas.set(recargas);
      const gastoEdit = this.gastoEditando();
      if (gastoEdit && !gastos.some((item) => item._id === gastoEdit._id)) {
        this.resetGastoForm();
      }
      const recargaEdit = this.recargaEditando();
      if (recargaEdit && !recargas.some((item) => item._id === recargaEdit._id)) {
        this.resetRecargaForm();
      }
    });
  }

  private resetGastoForm() {
    this.gastoForm.reset({
      descripcion: '',
      categoria: 'PEAJE',
      monto: 0,
      fecha: this.obtenerFechaHoy(),
      comprobanteUrl: '',
    });
    this.gastoEditando.set(null);
  }

  private resetRecargaForm() {
    this.recargaForm.reset({
      descripcion: '',
      monto: 0,
      fecha: this.obtenerFechaHoy(),
    });
    this.recargaEditando.set(null);
  }

  private toInputDate(value?: string) {
    if (!value) {
      return this.obtenerFechaHoy();
    }
    const fecha = new Date(value);
    if (Number.isNaN(fecha.getTime())) {
      return this.obtenerFechaHoy();
    }
    return fecha.toISOString().substring(0, 10);
  }

  private obtenerFechaHoy(): string {
    return new Date().toISOString().substring(0, 10);
  }
}
