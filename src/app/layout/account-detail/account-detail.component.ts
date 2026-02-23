import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';

/* =======================
   UI Model
======================= */
export interface AccountDetailsData {
  name: string;
  email: string;
  subscriptionPlan: string;
  cardNote: string;
  referralId: string;
  avatarUrl?: string;
  realtimeNotification?: boolean;
}

/* =======================
   API Response Model
======================= */
interface AccountApiResponse {
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  subscription: {
    plan: string;
    status: string;
  };
  stripeData: {
    stripeCustomerId: string;
  };
}

@Component({
  selector: 'account-detail-folder',
  standalone: true,
  templateUrl: './account-detail.component.html',
  styleUrls: ['./account-detail.component.css'],
  imports: [FormsModule]
})
export class AccountDetailComponent implements OnInit {

  model: AccountDetailsData = {
    name: '',
    email: '',
    subscriptionPlan: '',
    cardNote: '',
    referralId: '',
    avatarUrl: '',
    realtimeNotification: false
  };

  // Same pattern as HeaderComponent
  userId: string | null = null;
  jwtToken: string | null = null;

  private readonly ACCOUNT_API =
    'https://weavadev1.azurewebsites.net/users/account';

  private readonly API_BASE = '/api/account';

  isToggling = false;
  isDeleting = false;
  isDownloading = false;

  constructor(
    public dialogRef: MatDialogRef<AccountDetailComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  /* =======================
     Lifecycle
  ======================= */
  ngOnInit(): void {
    this.loadUser();           // 🔥 same as Header
    this.fetchAccountDetails();
  }

  /* =======================
     Load user from localStorage
     (copied logic from Header)
  ======================= */
  private loadUser(): void {
    const saved = localStorage.getItem('user');
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      this.userId = parsed.uid;
      this.jwtToken = parsed.authToken;
    } catch (err) {
      console.error('❌ Failed to parse user from localStorage', err);
    }
  }

  /* =======================
     API CALL (AUTHORIZED)
  ======================= */
  private fetchAccountDetails(): void {
    if (!this.userId || !this.jwtToken) {
      this.toast('Authentication missing', true);
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.jwtToken}`
    });

    this.http
      .get<AccountApiResponse>(
        `${this.ACCOUNT_API}/${this.userId}`,
        { headers }
      )
      .subscribe({
        next: (res) => {
          console.log('✅ Account API response:', res);

          this.model = {
            name: `${res.user.firstName} ${res.user.lastName}`,
            email: res.user.email,
            subscriptionPlan: res.subscription?.plan || 'Free',
            cardNote: res.stripeData?.stripeCustomerId
              ? 'Card available'
              : 'Credit card details not found.',
            referralId: this.userId!,
            avatarUrl:
              'https://lh3.googleusercontent.com/a/default-avatar',
            realtimeNotification: false
          };
        },
        error: (err) => {
          console.error('❌ Account API error:', err);
          this.toast('Failed to load account details', true);
        }
      });
  }

  /* =======================
     UI Actions
  ======================= */
  onCancel(): void {
    this.dialogRef.close();
  }

  async copyReferralId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.model.referralId || '');
      this.toast('Referral ID copied');
    } catch {
      this.toast('Unable to copy Referral ID', true);
    }
  }

  onToggleRealtime(): void {
    const enabled = !!this.model.realtimeNotification;
    this.isToggling = true;

    this.http
      .patch(`${this.API_BASE}/realtime-notification`, { enabled })
      .subscribe({
        next: () => {
          this.toast(
            `Real-time notification ${enabled ? 'enabled' : 'disabled'}`
          );
          this.isToggling = false;
        },
        error: () => {
          this.model.realtimeNotification = !enabled;
          this.toast('Failed to update notification preference', true);
          this.isToggling = false;
        }
      });
  }

  downloadInvoice(): void {
    this.isDownloading = true;

    this.http
      .get(`${this.API_BASE}/invoice/latest`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'invoice.pdf';
          a.click();
          window.URL.revokeObjectURL(url);
          this.isDownloading = false;
        },
        error: () => {
          this.toast('Unable to download invoice', true);
          this.isDownloading = false;
        }
      });
  }

  changePassword(): void {
    this.dialogRef.close({ action: 'change-password' });
  }

  deleteAccount(): void {
    const yes = confirm(
      'Are you sure you want to delete this account? This action cannot be undone.'
    );
    if (!yes) return;

    if (!this.jwtToken) {
      this.toast('Authorization token missing', true);
      return;
    }

    this.isDeleting = true;

    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.jwtToken}`,
      'Content-Type': 'application/json'
    });

    this.http
      .post(
        'https://weavadev1.azurewebsites.net/users/delete',
        {},               // 🔴 empty body (same as curl)
        { headers }
      )
      .subscribe({
        next: () => {
          this.toast('Account deleted successfully');
          localStorage.clear();   // 🔐 logout user
          this.isDeleting = false;
          this.dialogRef.close({ action: 'deleted' });
          window.location.href = '/login';
        },
        error: (err) => {
          console.error('❌ Delete account failed', err);
          this.toast('Failed to delete account', true);
          this.isDeleting = false;
        }
      });
  }

  editEmail(): void {
    this.dialogRef.close({
      action: 'edit-email',
      email: this.model.email
    });
  }

  sendEmail(): void {
    window.location.href = `mailto:${this.model.email}`;
  }

  linkGoogle(): void {
    window.location.href = `${this.API_BASE}/link/google`;
  }

  getInitials(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(' ');
    const first = parts[0]?.charAt(0) || '';
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  }

  /* =======================
     Toast
  ======================= */
  private toast(message: string, isError = false): void {
    this.snackBar.open(message, 'OK', {
      duration: 2500,
      panelClass: isError ? ['snack-error'] : ['snack-success']
    });
  }
}
