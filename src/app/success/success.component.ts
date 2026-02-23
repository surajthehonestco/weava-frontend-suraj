import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-success',
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.css']
})
export class SuccessComponent implements OnInit {

  sessionId: string | null = null;
  planName = "Weava Premium";

  constructor(private router: Router) {}

  ngOnInit(): void {
    const urlParams = new URLSearchParams(window.location.search);
    this.sessionId = urlParams.get("session_id");
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}
