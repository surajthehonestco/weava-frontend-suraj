import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { SocialAuthService } from '../../services/social-auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, RouterModule, FontAwesomeModule]
})
export class SignupComponent implements AfterViewInit {
  @ViewChild('googleBtn', { static: true }) googleBtn!: ElementRef<HTMLDivElement>;

  firstName = '';
  lastName = '';
  email = '';
  password = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private social: SocialAuthService
  ) {}

  async ngAfterViewInit() {
    // Initialize Google and render the button
    await this.social.initGoogle(async (idToken: string) => {
      try {
        const resp = await this.authService.socialAuth('google', idToken).toPromise();
        if (resp?.body?.authToken) {
          this.showToast('Signed in with Google', 'success');
          this.router.navigate(['/dashboard']);
        } else {
          this.showToast('Google sign-in failed', 'error');
        }
      } catch (err: any) {
        this.showToast(err?.error?.message || 'Google sign-in error', 'error');
        console.error(err);
      }
    });

    this.social.renderGoogleButton(this.googleBtn.nativeElement, { text: 'signup_with' });
  }

  onFacebook = async () => {
    try {
      const { accessToken } = await this.social.facebookLogin();
      const resp = await this.authService.socialAuth('facebook', accessToken).toPromise();
      if (resp?.body?.authToken) {
        this.showToast('Signed in with Facebook', 'success');
        this.router.navigate(['/dashboard']);
      } else {
        this.showToast('Facebook sign-in failed', 'error');
      }
    } catch (err: any) {
      this.showToast(err?.message || 'Facebook sign-in error', 'error');
      console.error(err);
    }
  };

  onSignup() {
    if (!this.firstName || !this.lastName || !this.email || !this.password) {
      this.showToast('All fields are required', 'error');
      return;
    }

    const userData = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      password: this.password,
    };

    this.authService.signup(userData).subscribe(
      (response) => {
        if (response.body?.authToken) {
          this.showToast('Signup successful! Redirecting...', 'success');
          this.router.navigate(['/dashboard']);
        } else {
          this.showToast('Signup failed. Please try again.', 'error');
        }
      },
      (error) => {
        this.showToast(error.error?.message || 'Signup failed. Please check your details.', 'error');
        console.error('Signup failed:', error);
      }
    );
  }

  showToast(message: string, type: 'success' | 'error') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'success' ? 'success-toast' : 'error-toast',
    });
  }
}