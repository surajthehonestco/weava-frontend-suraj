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
    const token =
      route.queryParamMap.get('authToken') ||
      route.queryParamMap.get('token') ||
      route.queryParamMap.get('idToken');
    const userId =
      route.queryParamMap.get('uid') ||
      route.queryParamMap.get('userId') ||
      route.queryParamMap.get('localId');
    const email = route.queryParamMap.get('email');

    if (token) {
      const normalizedUser = {
        authToken: token,
        token,
        uid: userId,
        userId,
        email
      };

      localStorage.setItem('user', JSON.stringify(normalizedUser));
      if (userId) {
        localStorage.setItem('userId', userId);
      }
      this.auth.setToken(token);

      try {
        this.socket.connect(token);
        if (userId) this.socket.emitLogin(userId);
      } catch {}

      return this.router.parseUrl('/dashboard');
    }

    return this.router.parseUrl('/login');
  }
}
