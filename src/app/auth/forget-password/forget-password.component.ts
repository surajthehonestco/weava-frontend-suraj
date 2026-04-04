import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-forget-password',
  standalone: true,
  templateUrl: './forget-password.component.html',
  styleUrls: ['./forget-password.component.css'],
  imports: [CommonModule, FormsModule, FontAwesomeModule]
})
export class ForgetPasswordComponent implements OnInit {
  email = '';
  token = '';
  newPassword = '';
  confirmPassword = '';
  errorMessage = '';
  isSubmitting = false;
  isSuccess = false;
  isResetMode = false;
  showNewPassword = false;
  showConfirmPassword = false;

  readonly faEye = faEye;
  readonly faEyeSlash = faEyeSlash;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      const searchParams = new URLSearchParams(window.location.search);
      this.token = params.get('token')?.trim() || searchParams.get('token')?.trim() || '';
      this.isResetMode = !!this.token;
    });
  }

  get isEmailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
  }

  get isPasswordValid(): boolean {
    return this.newPassword.trim().length > 0;
  }

  get passwordsMatch(): boolean {
    return !!this.newPassword && this.newPassword === this.confirmPassword;
  }

  get canSubmitReset(): boolean {
    return !!this.token && this.isPasswordValid && this.passwordsMatch && !this.isSubmitting;
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  onSubmit() {
    if (this.isResetMode) {
      this.updatePassword();
      return;
    }

    this.requestPasswordReset();
  }

  toggleNewPasswordVisibility() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  private requestPasswordReset() {
    if (!this.isEmailValid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.isSuccess = false;
    this.errorMessage = '';

    this.authService.forgotPassword(this.email.trim()).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.isSuccess = true;
      },
      error: (error) => {
        this.isSubmitting = false;
        this.isSuccess = false;
        this.errorMessage =
          error?.error?.errorMessage ||
          error?.error?.message ||
          'Unable to reset password. Please try again.';
        this.snackBar.open(
          this.errorMessage,
          'Close',
          { duration: 3000, panelClass: 'error-toast' }
        );
      }
    });
  }

  private updatePassword() {
    if (!this.canSubmitReset) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    this.authService
      .resetPassword(this.token, this.newPassword.trim(), this.confirmPassword.trim())
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.errorMessage = '';
          this.snackBar.open('Password updated successfully. Please log in.', 'Close', {
            duration: 3000,
            panelClass: 'success-toast'
          });
          this.router.navigate(['/login']);
        },
        error: (error) => {
          this.isSubmitting = false;
          this.errorMessage =
            error?.error?.errorMessage ||
            error?.error?.message ||
            'Unable to update password. Please try again.';
          this.snackBar.open(
            this.errorMessage,
            'Close',
            { duration: 3000, panelClass: 'error-toast' }
          );
        }
      });
  }
}
