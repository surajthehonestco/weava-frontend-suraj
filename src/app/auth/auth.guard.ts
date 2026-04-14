import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp * 1000;
      return Date.now() > expiry;
    } catch (error) {
      return true;
    }
  }

  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }

  private redirectToDashboard(): void {
    const activeFolderId = localStorage.getItem('activeFolderId') || this.getCookie('activeFolderId');

    if (activeFolderId) {
      this.router.navigate(['/dashboard'], { queryParams: { folder: activeFolderId } });
      return;
    }

    this.router.navigate(['/dashboard']);
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const userString = localStorage.getItem('user');
    const isLoginOrSignup = route.routeConfig?.path === 'login' || route.routeConfig?.path === 'signup';

    if (userString) {
      try {
        const user = JSON.parse(userString);
        const token = user?.authToken;

        if (token && !this.isTokenExpired(token)) {
          if (isLoginOrSignup) {
            this.redirectToDashboard();
            return false;
          }
          return true;
        }

        localStorage.removeItem('user');
        this.router.navigate(['/login']);
        return false;
      } catch (error) {
        localStorage.removeItem('user');
        this.router.navigate(['/login']);
        return false;
      }
    }

    if (!userString && !isLoginOrSignup) {
      this.router.navigate(['/login']);
      return false;
    }

    return true;
  }
}
