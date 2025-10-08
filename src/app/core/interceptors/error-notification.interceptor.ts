import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

const extractErrorMessages = (error: HttpErrorResponse): string[] => {
  if (error.status === 0) {
    return ['No fue posible comunicarse con el servidor. Verifica tu conexion e intentalo nuevamente.'];
  }

  const payload = error.error;
  const messages = new Set<string>();
  const push = (value?: unknown) => {
    if (value === null || value === undefined) {
      return;
    }
    const normalized = String(value).trim();
    if (normalized.length) {
      messages.add(normalized);
    }
  };

  if (typeof payload === 'string') {
    push(payload);
  } else if (Array.isArray(payload)) {
    payload.forEach((item) => {
      if (typeof item === 'string') {
        push(item);
      } else if (item && typeof item === 'object') {
        push((item as Record<string, unknown>)['mensaje']);
        push((item as Record<string, unknown>)['message']);
        push((item as Record<string, unknown>)['msg']);
      }
    });
  } else if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    push(data['mensaje']);
    push(data['message']);
    if (Array.isArray(data['errores'])) {
      data['errores'].forEach((detalle) => {
        if (typeof detalle === 'string') {
          push(detalle);
        } else if (detalle && typeof detalle === 'object') {
          const errorObj = detalle as Record<string, unknown>;
          push(errorObj['msg']);
          push(errorObj['mensaje']);
          push(errorObj['message']);
        }
      });
    }
    if (Array.isArray(data['errors'])) {
      data['errors'].forEach((detalle) => {
        if (typeof detalle === 'string') {
          push(detalle);
        } else if (detalle && typeof detalle === 'object') {
          const errorObj = detalle as Record<string, unknown>;
          push(errorObj['msg']);
          push(errorObj['mensaje']);
          push(errorObj['message']);
        }
      });
    }

    if (!messages.size) {
      Object.values(data).forEach((value) => {
        if (typeof value === 'string') {
          push(value);
        } else if (Array.isArray(value)) {
          value.forEach((inner) => {
            if (typeof inner === 'string') {
              push(inner);
            } else if (inner && typeof inner === 'object') {
              const errorObj = inner as Record<string, unknown>;
              push(errorObj['msg']);
              push(errorObj['mensaje']);
              push(errorObj['message']);
            }
          });
        }
      });
    }
  }

  if (!messages.size) {
    push('Ocurrio un error inesperado. Intentalo nuevamente.');
  }

  return Array.from(messages);
};

export const errorNotificationInterceptor: HttpInterceptorFn = (req, next) => {
  const notifier = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const mensajes = extractErrorMessages(error);
      mensajes.forEach((mensaje) => notifier.error(mensaje));
      return throwError(() => error);
    })
  );
};
