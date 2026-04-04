import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { SocialAuthService } from '../../services/social-auth.service';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FontAwesomeModule
  ]
})
export class LoginComponent implements AfterViewInit {
  @ViewChild('googleBtn', { static: true }) googleBtn!: ElementRef<HTMLDivElement>;

  email = '';
  password = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private socketService: SocketService,
    private social: SocialAuthService
  ) {}

  async ngAfterViewInit() {
    try {
      await this.social.initGoogle(
        async (idToken: string) => {
          try {
            const resp = await this.authService.socialAuth('google', idToken).toPromise();
            this.completeSocialLogin(resp?.body, 'Signed in with Google');
          } catch (err: any) {
            this.showToast(err?.error?.message || 'Google sign-in error', 'error');
            console.error(err);
          }
        },
        { context: 'signin' }
      );

      this.social.renderGoogleButton(this.googleBtn.nativeElement, {
        text: 'continue_with',
        width: 400
      });
    } catch (err: any) {
      this.showToast(err?.message || 'Unable to load Google sign-in', 'error');
      console.error(err);
    }
  }

  onLogin() {
    if (!this.email || !this.password) {
      this.showToast('Please enter email and password', 'error');
      return;
    }

    const credentials = { email: this.email, password: this.password };

    this.authService.login(credentials).subscribe(
      (response) => {
        const body = response.body || {};
        const token = body?.authToken || body?.token || body?.accessToken;
        const userId = body?.uid || body?.userId || body?.localId;

        if (token) {
          localStorage.setItem('authToken', token);

          if (userId) {
            localStorage.setItem('userId', userId);
          }

          this.socketService.connect(token);

          if (userId) {
            this.socketService.emitLogin(userId);
          }

          this.router.navigate(['/dashboard']);
        } else {
          this.showToast('Invalid credentials. Please try again.', 'error');
        }
      },
      (error) => {
        this.showToast(
          error.error?.message || 'Login failed. Please check your credentials.',
          'error'
        );
        console.error('Login failed:', error);
      }
    );
  }

  private completeSocialLogin(body: any, successMessage: string) {
    const token = body?.authToken || body?.token || body?.accessToken || body?.idToken;
    const userId = body?.uid || body?.userId || body?.localId;
    const normalizedUser = {
      ...body,
      authToken: token,
      uid: userId,
      userId
    };

    if (!token) {
      this.showToast('Google sign-in failed', 'error');
      return;
    }

    localStorage.setItem('user', JSON.stringify(normalizedUser));
    localStorage.setItem('authToken', token);
    if (userId) {
      localStorage.setItem('userId', userId);
    }

    this.socketService.connect(token);
    if (userId) {
      this.socketService.emitLogin(userId);
    }

    this.showToast(successMessage, 'success');
    this.router.navigate(['/dashboard']);
  }

  showToast(message: string, type: 'success' | 'error') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'success' ? 'success-toast' : 'error-toast'
    });
  }

  goToSignup() {
    this.router.navigate(['/signup']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forget-password']);
  }
}
