import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardHomeComponent } from './dashboard-home/dashboard-home.component';
import { LayoutModule } from '../layout/layout.module'; // 👈 Import LayoutModule

@NgModule({
  declarations: [DashboardHomeComponent],
  imports: [CommonModule, LayoutModule],
})
export class DashboardModule {}
