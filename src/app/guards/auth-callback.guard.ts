import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SocketService } from '../services/socket.service';

@Injectable({ providedIn: 'root' })
export class AuthCallbackGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
    private socket: SocketService
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    // Backend sends `idToken` instead of `token`
    const token = route.queryParamMap.get('idToken'); 
    const userId = route.queryParamMap.get('localId'); // optional, your backend sends this

    if (token) {
      // Save token and user info in localStorage
      this.auth.setToken(token);
      localStorage.setItem('user', JSON.stringify({
        authToken: token,
        userId,
        email: route.queryParamMap.get('email')
      }));

      // Optional: connect socket
      try {
        this.socket.connect(token);
        if (userId) this.socket.emitLogin(userId);
      } catch {}

      // Redirect to dashboard
      return this.router.parseUrl('/dashboard');
    }

    return this.router.parseUrl('/login'); // fallback
  }
}
