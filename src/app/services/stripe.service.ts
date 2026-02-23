import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';  // Import necessary operators
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private apiUrl = environment.apiBaseUrl;  // <-- Base URL for your API

  constructor(private http: HttpClient) {}

  // Helper function to get JWT token from localStorage
  private getAuthToken(): string | null {
    const user = localStorage.getItem('user');
    if (!user) {
      console.error('❌ No user found in localStorage');
      return null;
    }

    try {
      const parsedUser = JSON.parse(user);
      return parsedUser.authToken;
    } catch (error) {
      console.error('❌ Failed to parse user data from localStorage', error);
      return null;
    }
  }

  // Example function to create a checkout session
  createCheckoutSession(userId: string, planId: string): Observable<any> {
    const url = `${this.apiUrl}/stripe/checkout/${userId}/${planId}`;
    const jwtToken = this.getAuthToken();

    if (!jwtToken) {
      return new Observable(observer => {
        observer.error('❌ No valid JWT token found');
      });
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${jwtToken}`
    });

    return this.http.post<any>(url, {}, { headers }).pipe(
      catchError((err) => {
        console.error('Error creating checkout session:', err);
        throw err; // Propagate the error
      })
    );
  }

  // Example function to check subscription status
  checkSubscriptionStatus(userId: string): Observable<any> {
    return this.getStripeUserData(userId).pipe(
      switchMap((res) => {
        const customerId = res.stripeCustomerId;
        if (!customerId) {
          throw new Error('❌ Customer ID not found');
        }

        const url = `${this.apiUrl}/stripe/status/${customerId}`;
        const jwtToken = this.getAuthToken();

        if (!jwtToken) {
          throw new Error('❌ No valid JWT token found');
        }

        const headers = new HttpHeaders({
          Authorization: `Bearer ${jwtToken}`
        });

        return this.http.get<any>(url, { headers }).pipe(
          catchError((err) => {
            console.error('Error fetching subscription status:', err);
            throw err; // Propagate the error
          })
        );
      }),
      catchError((err) => {
        console.error('Error checking subscription status:', err);
        throw err; // Propagate the error
      })
    );
  }

  // Function to get Stripe user data
  private getStripeUserData(userId: string): Observable<any> {
    const url = `${this.apiUrl}/stripe/${userId}`;
    const jwtToken = this.getAuthToken();

    if (!jwtToken) {
      return new Observable(observer => {
        observer.error('❌ No valid JWT token found');
      });
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${jwtToken}`
    });

    return this.http.get<any>(url, { headers }).pipe(
      catchError((err) => {
        console.error('Error fetching Stripe user data:', err);
        throw err;  // Propagate the error
      })
    );
  }
}
