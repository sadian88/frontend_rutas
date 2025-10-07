import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { RutasService } from '../../core/services/rutas.service';
import { Gasto, Ruta } from '../../core/models';

@Component({
  selector: 'app-mis-gastos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mis-gastos.component.html',
  styleUrl: './mis-gastos.component.scss',
})
export class MisGastosComponent implements OnInit {
  readonly rutas = signal<Ruta[]>([]);
  readonly gastos = signal<Gasto[]>([]);
  readonly totales = signal<Record<string, { totalGastos: number; totalRecargas: number; balance: number }>>({});

  private readonly currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });

  constructor(private readonly rutasService: RutasService) {}

  ngOnInit(): void {
    this.rutasService.resumenConductor().subscribe((resumen) => {
      this.rutas.set(resumen.rutas);
      this.gastos.set(resumen.gastos);
      this.totales.set(resumen.totalesPorRuta);
    });
  }

  totalPorRuta(id: string) {
    return this.totales()[id] || { totalGastos: 0, totalRecargas: 0, balance: 0 };
  }

  gastosPorRuta(id: string) {
    return this.gastos().filter((gasto) => {
      if (typeof gasto.ruta === 'string') {
        return gasto.ruta === id;
      }
      return gasto.ruta?._id === id;
    });
  }

  formatoMoneda(valor: number) {
    return this.currencyFormatter.format(valor ?? 0);
  }
}
