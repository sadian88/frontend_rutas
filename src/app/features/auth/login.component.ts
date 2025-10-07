import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);

  mensajeError = '';
  readonly year = new Date().getFullYear();
  loading = false;
  private redirectTo = '/';

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    const redirect = this.route.snapshot.queryParamMap.get('redirectTo');
    if (redirect) {
      this.redirectTo = redirect;
    }
  }

  ingresar() {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.mensajeError = '';

    const raw = this.form.getRawValue();
    const payload = {
      email: raw.email.trim(),
      password: raw.password,
    };

    if (!payload.email) {
      this.loading = false;
      this.form.get('email')?.setErrors({ required: true });
      this.form.markAllAsTouched();
      return;
    }

    this.authService
      .login(payload)
      .pipe(
        catchError((error) => {
          this.mensajeError = error?.error?.mensaje || 'No fue posible iniciar sesion';
          this.loading = false;
          return of(null);
        }),
      )
      .subscribe((respuesta) => {
        if (respuesta) {
          this.loading = false;
          this.router.navigateByUrl(this.redirectTo);
        }
      });
  }
}
