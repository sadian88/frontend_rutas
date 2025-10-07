import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Rol } from '../models';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { redirectTo: state.url } });
    return false;
  }

  const roles = route.data?.['roles'] as Rol[] | undefined;
  if (roles && !auth.hasAnyRole(roles)) {
    router.navigate(['/']);
    return false;
  }

  return true;
};
