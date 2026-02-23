import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { SocketService } from '../../services/socket.service'; // ✅ Add import
import { environment } from '../../../environments/environment';

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
export class LoginComponent {
  email = '';
  password = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private socketService: SocketService
  ) {}

  loginWithGoogle() {
    window.location.href = 'https://weavadev1.azurewebsites.net/auth/google';
  }  

  onLogin() {
    if (!this.email || !this.password) {
      this.showToast('Please enter email and password', 'error');
      return;
    }
  
    const credentials = { email: this.email, password: this.password };
  
    this.authService.login(credentials).subscribe(
      (response) => {
        console.log('Login Response:', response);
  
        const token = response.body?.authToken;
        const userId = response.body?.uid; // Use 'uid' from the API response
        console.log("UserId:", userId);  // Ensure you have userId here
  
        if (token) {
          // ✅ Save token in localStorage
          localStorage.setItem('authToken', token);
      
          // Optional: Save userId
          if (userId) {
            localStorage.setItem('userId', userId);
          }
      
          // ✅ Connect WebSocket
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
  

  showToast(message: string, type: 'success' | 'error') {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: type === 'success' ? 'success-toast' : 'error-toast'
    });
  }

  goToSignup() {
    this.router.navigate(['/signup']);
  }
}
