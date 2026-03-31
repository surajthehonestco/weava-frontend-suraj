import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-forget-password',
  standalone: true,
  templateUrl: './forget-password.component.html',
  styleUrls: ['./forget-password.component.css'],
  imports: [CommonModule, FormsModule]
})
export class ForgetPasswordComponent {
  email = '';
  isSubmitting = false;
  isSuccess = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  get isEmailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  onSubmit() {
    if (!this.isEmailValid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.isSuccess = false;

    this.authService.forgotPassword(this.email.trim()).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.isSuccess = true;
      },
      error: (error) => {
        this.isSubmitting = false;
        this.isSuccess = false;
        this.snackBar.open(
          error?.error?.message || 'Unable to reset password. Please try again.',
          'Close',
          { duration: 3000, panelClass: 'error-toast' }
        );
      }
    });
  }
}
