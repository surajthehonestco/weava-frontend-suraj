import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NotificationModalComponent } from '../notification-modal/notification-modal.component';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { SocketService } from '../../services/socket.service';
import { Router } from '@angular/router';
import { StripeService } from '../../services/stripe.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  imports: [CommonModule]
})
export class HeaderComponent implements OnInit {

  @Input() activeFolderName: string = '';
  @Output() sidebarToggle = new EventEmitter<void>();

  notificationCount: number = 0;
  isPremiumActive: boolean = true;

  // ✅ FIX 1 — Declare dynamic values properly
  userId: string | null = null;
  jwtToken: string | null = null;

  constructor(
    private modalService: NgbModal,
    private http: HttpClient,
    private socketService: SocketService,
    private router: Router,
    private stripeService: StripeService
  ) {}

  ngOnInit(): void {
    this.loadUser();                // Load uid + token from localStorage
    this.fetchNotificationCount();  // Load notification count
    this.checkSubscriptionStatus(); // API: is user premium?

    // Real-time notification updates
    this.socketService.subscribeToChannel('notificationUpdated', () => {
      this.fetchNotificationCount();
    });
  }

  // ---------------------------------------------------------------
  // 🔥 Fetch Notification Count
  // ---------------------------------------------------------------
  fetchNotificationCount() {
    if (!this.jwtToken) return;

    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.jwtToken}`
    });

    this.http.get<{ message: string, data: { count: number } }>(
      'https://weavadev1.azurewebsites.net/notification/count',
      { headers }
    )
    .subscribe({
      next: (res) => this.notificationCount = res.data?.count || 0,
      error: (err) => console.error('❌ Failed to fetch notification count', err)
    });
  }

  openNotificationModal() {
    this.modalService.open(NotificationModalComponent, {
      centered: true,
      windowClass: 'custom-wide-modal modal-top-centered'
    });
  }

  toggleSidebar(): void {
    this.sidebarToggle.emit();
  }

  goToSubscription() {
    this.router.navigate(['/subscription']);
  }

  // ---------------------------------------------------------------
  // 🔥 Load User from LocalStorage
  // ---------------------------------------------------------------
  loadUser() {
    const saved = localStorage.getItem('user');
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      // Correct keys based on your real localstorage
      this.userId = parsed.uid;
      this.jwtToken = parsed.authToken;

    } catch (err) {
      console.error("❌ Failed to parse user from localStorage", err);
    }
  }

  // ---------------------------------------------------------------
  // 🔥 Check Subscription Status
  // ---------------------------------------------------------------
  checkSubscriptionStatus() {
    if (!this.userId || !this.jwtToken) {
      console.error("❌ Missing userId or jwtToken");
      return;
    }

    this.stripeService.checkSubscriptionStatus(this.userId).subscribe({
      next: (res) => {
        this.isPremiumActive = res.active;
      },
      error: (err) => {
        console.error("❌ Error checking subscription status:", err);
        this.isPremiumActive = false;
      }
    });
  }
}
