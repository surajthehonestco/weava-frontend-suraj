import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';   // <-- IMPORTANT

@Component({
  selector: 'app-cancel',
  standalone: true,             // <-- add standalone true if missing
  imports: [CommonModule],      // <-- FIXED
  templateUrl: './cancel.component.html',
  styleUrl: './cancel.component.css'
})
export class CancelComponent implements OnInit {

  sessionId: string | null = null;
  failureReason: string | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    this.sessionId = params.get("session_id");
    this.failureReason = params.get("reason") || null;
  }

  retryPayment() {
    this.router.navigate(['/subscription']);
  }

  contactSupport() {
    window.location.href = "mailto:support@weava.com";
  }
}
