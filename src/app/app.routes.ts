import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { SignupComponent } from './auth/signup/signup.component';
import { DashboardHomeComponent } from './dashboard/dashboard-home/dashboard-home.component';
import { ContributeWeavaComponent } from './contribute-weava/contribute-weava.component';
import { AuthGuard } from './auth/auth.guard';
import { AuthCallbackGuard } from './guards/auth-callback.guard';
import { SubscriptionComponent } from './subscription/subscription.component';
import { SuccessComponent } from './success/success.component';
import { CancelComponent } from './cancel/cancel.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' }, // ✅ Default page is /login
  { path: 'login', component: LoginComponent },
  { path: 'auth/callback', canActivate: [AuthCallbackGuard], component: LoginComponent }, // component optional
  { path: 'signup', component: SignupComponent },
  { path: 'dashboard', component: DashboardHomeComponent, canActivate: [AuthGuard] },
  { path: 'contribute-weava', component: ContributeWeavaComponent },
  { path: 'subscription', component: SubscriptionComponent },
  { path: 'success', component: SuccessComponent },
  { path: 'cancel', component: CancelComponent },
  { path: '**', redirectTo: '/login' } // Redirect unknown routes to /login
];
