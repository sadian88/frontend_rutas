import { Injectable } from '@angular/core';
import { BalanceResponse } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ReportesService {
  constructor(private readonly api: ApiService) {}

  balance(params?: Record<string, string | number | boolean | undefined>) {
    return this.api.get<BalanceResponse>('/reportes/balance', params);
  }
}
