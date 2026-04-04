import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

const normalizedPath = window.location.pathname.replace(/\/{2,}/g, '/');
if (normalizedPath !== window.location.pathname) {
  window.history.replaceState(
    window.history.state,
    '',
    `${normalizedPath}${window.location.search}${window.location.hash}`
  );
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
