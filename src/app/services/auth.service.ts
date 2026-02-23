import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSubject = new BehaviorSubject<any>(null);
  private apiUrl = environment.apiBaseUrl;
  private signupUrl = 'https://weavadev1.azurewebsites.net/auth/signup';
  private TOKEN_KEY = 'authToken';
  private USER_KEY = 'user';
  private USER_ACTIVE_FOLDER_ID = 'activeFolderId';

  constructor(private http: HttpClient) {
    // Initialize user from local storage if available
    const user = localStorage.getItem(this.USER_KEY);
    if (user) {
      this.userSubject.next(JSON.parse(user));
    }
  }

  // Save token in localStorage and cookies
  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.setCookie(this.TOKEN_KEY, token, 7);  // Store token in cookies for your extension
    
    const user = this.userSubject.value;
    if (user) {
      this.setCookie('userId', user.uid, 7);  // Store userId in cookies
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));  // Store entire user object
    }
  }

  // Get token from localStorage or cookies
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY) || this.getCookie(this.TOKEN_KEY);
  }

  // Check if the user is authenticated based on token presence
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Clear auth data from localStorage and cookies
  clearAuth(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.userSubject.next(null);
    this.clearCookie(this.TOKEN_KEY);
    this.clearCookie(this.USER_KEY);
    this.clearCookie(this.USER_ACTIVE_FOLDER_ID);
  }

  // Get the current authenticated user data
  getUser(): any {
    return this.userSubject.value;
  }

  // Observable to get user changes
  getUserObservable(): Observable<any> {
    return this.userSubject.asObservable();
  }

  // Login with credentials
  login(credentials: { email: string; password: string }): Observable<HttpResponse<any>> {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, credentials, { observe: 'response' }).pipe(
      tap(response => {
        const body = response.body || {};
        const authToken = body.authToken || body.token || body.accessToken;
        if (authToken) {
          localStorage.setItem(this.USER_KEY, JSON.stringify(body));  // Store entire user object
          this.userSubject.next(body);
          this.setToken(authToken);
        }
      }),
      catchError(error => { throw error; })
    );
  }

  // Signup with user details
  signup(userData: { email: string; password: string; firstName: string; lastName: string }): Observable<HttpResponse<any>> {
    return this.http.post<any>(this.signupUrl, userData, { observe: 'response' }).pipe(
      tap(response => {
        const body = response.body || {};
        const authToken = body.authToken || body.token || body.accessToken;
        if (authToken) {
          localStorage.setItem(this.USER_KEY, JSON.stringify(body));  // Store entire user object
          this.userSubject.next(body);
          this.setToken(authToken);
        }
      }),
      catchError(error => { throw error; })
    );
  }

  // Social auth (Google ID token or Facebook access token)
  socialAuth(provider: 'google' | 'facebook', token: string): Observable<HttpResponse<any>> {
    return this.http.post<any>(`${this.apiUrl}/auth/${provider}`, { token }, { observe: 'response' }).pipe(
      tap(response => {
        const body = response.body || {};
        const authToken = body.authToken || body.token || body.accessToken;
        if (authToken) {
          localStorage.setItem(this.USER_KEY, JSON.stringify(body));  // Store entire user object
          this.userSubject.next(body);
          this.setToken(authToken);
        }
      }),
      catchError(error => { throw error; })
    );
  }

  // Logout the user
  logout() {
    this.clearAuth();  // Call clearAuth() to remove data from localStorage and cookies
  }

  // Set cookie (useful for reading in your Chrome extension)
  private setCookie(name: string, value: string, days: number): void {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    const cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    document.cookie = cookie;
  }

  // Get cookie value
  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  // Clear cookie
  private clearCookie(name: string): void {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
  }
}
