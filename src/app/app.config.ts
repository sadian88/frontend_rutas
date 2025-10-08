import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HotToastModule } from '@ngneat/hot-toast';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorNotificationInterceptor } from './core/interceptors/error-notification.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorNotificationInterceptor])),
    provideAnimations(),
    importProvidersFrom(
      HotToastModule.forRoot({
        position: 'top-right',
        duration: 5000,
        dismissible: true,
        ariaLive: 'assertive',
      })
    ),
  ],
};
