import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StripeService } from '../services/stripe.service';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.css']
})
export class SubscriptionComponent implements OnInit {

  plans: any[] = [];
  selectedPlan: any = null;
  isAgreed = false;

  userId: string | null = null;
  jwtToken: string | null = null;

  constructor(
    private router: Router,
    private stripeService: StripeService
  ) {}

  ngOnInit(): void {
    this.loadUserFromLocalStorage();
    this.initializePlans();
    
    // Set the first plan (Plan 1) as the default selected plan
    this.selectedPlan = this.plans[0];  // Automatically select the first plan
  }

  // ----------------------------------------------------
  // 🔥 Load user details dynamically
  // ----------------------------------------------------
  loadUserFromLocalStorage() {
    const saved = localStorage.getItem('user');

    if (!saved) {
      console.error("❌ No user found in localStorage");
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      this.userId = parsed.uid;           // Set userId
      this.jwtToken = parsed.authToken;   // Set JWT token
    } catch (err) {
      console.error("❌ Failed to parse user JSON", err);
    }
  }

  // ----------------------------------------------------
  // 🔥 Use dynamic userId in plans
  // ----------------------------------------------------
  initializePlans() {
    this.plans = [
      {
        id: "price_1SaDu8KAKZN8LnMwktwfMgGj",  // Plan 1 ID
        name: "Plan 1",
        billingCycle: "BILLED MONTHLY",
        amount: 2.00,
        oldAmount: 7.99,
        isAnnual: false,
        userId: this.userId
      },
      {
        id: "price_1SVkI5KAKZN8LnMw73a0vqT1",  // Plan 2 ID
        name: "Plan 2",
        billingCycle: "BILLED ANNUALLY",
        amount: 1.00,
        oldAmount: 6.67,
        isAnnual: true,
        bestValue: true,
        userId: this.userId
      }
    ];
  }

  // ----------------------------------------------------
  // 🔥 Select a plan
  // ----------------------------------------------------
  selectPlan(plan: any) {
    this.selectedPlan = plan;
  }

  // ----------------------------------------------------
  // 🔥 Proceed to payment
  // ----------------------------------------------------
  proceedToPayment() {
    if (!this.selectedPlan || !this.isAgreed) return;

    if (!this.userId || !this.jwtToken) {
      console.error("❌ Missing userId or jwtToken");
      return;
    }

    // Use StripeService to redirect to Stripe checkout
    this.stripeService.createCheckoutSession(this.userId, this.selectedPlan.id).subscribe({
      next: (res) => window.location.href = res.url,  // Redirect to Stripe checkout
      error: (err) => console.error("Stripe error:", err)
    });
  }

  // ----------------------------------------------------
  // 🔥 Redirect to dashboard
  // ----------------------------------------------------
  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  // ----------------------------------------------------
  // 🔥 Redirect to Premium page
  // ----------------------------------------------------
  goToPremium() {
    window.location.href = 'https://www.weavatools.com/premium';
  }
}
