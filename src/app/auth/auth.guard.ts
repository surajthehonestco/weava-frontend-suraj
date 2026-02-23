import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  // ✅ Function to decode JWT and check expiration
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1])); // ✅ Decode JWT payload
      const expiry = payload.exp * 1000; // Convert expiry time to milliseconds
      return Date.now() > expiry; // ✅ Check if expired
    } catch (error) {
      return true; // ✅ If decoding fails, assume token is invalid
    }
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const userString = localStorage.getItem('user'); // ✅ Get user from localStorage
    const isLoginOrSignup = route.routeConfig?.path === 'login' || route.routeConfig?.path === 'signup';

    if (userString) {
      try {
        const user = JSON.parse(userString); // ✅ Parse user object
        const token = user?.authToken; // ✅ Extract JWT token

        if (token && !this.isTokenExpired(token)) {
          console.log("✅ Token valid"); // ✅ Log when the token is valid
          if (isLoginOrSignup) {
            // ✅ Redirect logged-in users from `/login` or `/signup` to `/dashboard`
            this.router.navigate(['/dashboard']);
            return false;
          }
          return true; // ✅ Allow access if the token is valid
        } else {
          console.log("❌ Token expired or invalid");
          // ✅ Remove expired user data and redirect to `/login`
          localStorage.removeItem('user');
          this.router.navigate(['/login']);
          return false;
        }
      } catch (error) {
        console.log("❌ Error parsing user data, redirecting to login");
        // ✅ If parsing fails, clear storage and redirect to login
        localStorage.removeItem('user');
        this.router.navigate(['/login']);
        return false;
      }
    }

    if (!userString && !isLoginOrSignup) {
      console.log("❌ No user found, redirecting to login");
      // ✅ If no user is logged in and trying to access a protected route, redirect to `/login`
      this.router.navigate(['/login']);
      return false;
    }

    return true; // ✅ Allow access to `/login` and `/signup` for unauthenticated users
  }
}
