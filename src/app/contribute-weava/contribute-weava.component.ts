import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-contribute-weava',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './contribute-weava.component.html',
  styleUrl: './contribute-weava.component.css'
})
export class ContributeWeavaComponent {
  presetAmounts = [2, 5, 30];
  selectedAmount: number | null = null;
  customAmount = '20';

  selectPresetAmount(amount: number): void {
    this.selectedAmount = amount;
  }

  onCustomAmountFocus(): void {
    this.selectedAmount = null;
  }
}
