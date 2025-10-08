import { Injectable } from '@angular/core';
import { HotToastService, ToastOptions } from '@ngneat/hot-toast';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private readonly toast: HotToastService) {}

  private readonly baseOptions: ToastOptions<unknown> = {
    dismissible: true,
  };

  success(message: string, options?: Partial<ToastOptions<unknown>>) {
    this.toast.success(message, {
      ...this.baseOptions,
      duration: 4000,
      ...options,
    });
  }

  error(message: string, options?: Partial<ToastOptions<unknown>>) {
    this.toast.error(message, {
      ...this.baseOptions,
      duration: 6000,
      ...options,
    });
  }

  warning(message: string, options?: Partial<ToastOptions<unknown>>) {
    this.toast.warning(message, {
      ...this.baseOptions,
      duration: 5000,
      ...options,
    });
  }

  info(message: string, options?: Partial<ToastOptions<unknown>>) {
    this.toast.info(message, {
      ...this.baseOptions,
      duration: 4000,
      ...options,
    });
  }
}
