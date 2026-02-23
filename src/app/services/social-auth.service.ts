import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    google?: any;
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

@Injectable({ providedIn: 'root' })
export class SocialAuthService {
  private gisReady = false;
  private fbReady = false;

  // ---------- Safe accessors ----------
  private getGoogle(): any | null {
    return typeof window !== 'undefined' ? window.google ?? null : null;
  }
  private getFB(): any | null {
    return typeof window !== 'undefined' ? window.FB ?? null : null;
  }

  // ---------- Small utility: wait for condition ----------
  private waitFor(predicate: () => boolean, timeoutMs = 10000, stepMs = 50): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (predicate()) return resolve();
        if (Date.now() - start >= timeoutMs) return reject(new Error('Timeout waiting for condition'));
        setTimeout(tick, stepMs);
      };
      tick();
    });
  }

  // ================== GOOGLE (GIS) ==================
  private async loadGis(): Promise<void> {
    // Already available?
    if (this.getGoogle()?.accounts?.id) return;

    // Inject script if not present
    const id = 'google-gis-sdk';
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Wait until the global is ready
    await this.waitFor(() => !!this.getGoogle()?.accounts?.id);
  }

  async initGoogle(onCredential: (idToken: string) => void) {
    await this.loadGis();
    const g = this.getGoogle();
    if (!g?.accounts?.id) throw new Error('Google Identity Services not available');

    g.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (res: { credential: string }) => onCredential(res.credential),
      ux_mode: 'popup',
      context: 'signin', // or 'signup'
      // itp_support: true,
    });
    this.gisReady = true;
  }

  renderGoogleButton(el: HTMLElement, options: Record<string, any> = {}) {
    const g = this.getGoogle();
    if (!this.gisReady || !g?.accounts?.id) return;
    g.accounts.id.renderButton(el, {
      type: 'standard',
      shape: 'rectangular',
      theme: 'outline',
      text: 'signup_with', // or 'continue_with'
      size: 'large',
      width: 400,
      ...options,
    });
  }

  promptOneTap() {
    const g = this.getGoogle();
    if (this.gisReady && g?.accounts?.id) g.accounts.id.prompt();
  }

  // ================== FACEBOOK ==================
  private getValidFbVersion(v?: string): string | undefined {
    if (!v) return undefined;
    return /^v\d+\.\d+$/.test(v) ? v : undefined;
  }

  private async loadFacebookSdk(): Promise<void> {
    // If FB global already exists, just init (if not already)
    const existingFB = this.getFB();
    if (existingFB && !this.fbReady) {
      this.initFbInstance(existingFB);
      return;
    }
    if (existingFB && this.fbReady) return;

    // If script tag already injected, wait for global, then init
    const id = 'facebook-jssdk';
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      // Chain fbAsyncInit safely (preserve any existing handler)
      const previousInit = window.fbAsyncInit;
      window.fbAsyncInit = () => {
        previousInit?.();
        const FB = this.getFB();
        if (FB) this.initFbInstance(FB);
      };

      script = document.createElement('script');
      script.id = id;
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    // Wait for FB global and for our init to set fbReady
    await this.waitFor(() => !!this.getFB());
    if (!this.fbReady) {
      const FB = this.getFB();
      if (FB) this.initFbInstance(FB);
    }
  }

  private initFbInstance(FB: any) {
    const initOptions: any = {
      appId: environment.facebookAppId,
      cookie: true,
      xfbml: false,
      // version added only if valid
    };
    const v = this.getValidFbVersion((environment as any).facebookGraphVersion);
    if (v) initOptions.version = v; // omit if not valid/empty

    try {
      FB.init(initOptions);
    } catch {
      // If FB.init was already called or version invalid, try without version
      try {
        FB.init({ appId: environment.facebookAppId, cookie: true, xfbml: false });
      } catch {
        // swallow; subsequent calls will fail fast
      }
    }
    this.fbReady = true;
  }

  async initFacebook(): Promise<void> {
    if (this.fbReady) return;
    await this.loadFacebookSdk();
  }

  facebookLogin(scope = 'public_profile,email'): Promise<{ accessToken: string; profile: any }> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.initFacebook();
      } catch (e) {
        return reject(e);
      }

      const FB = this.getFB();
      if (!FB) return reject(new Error('Facebook SDK not loaded'));

      FB.login(
        (response: any) => {
          const accessToken = response?.authResponse?.accessToken;
          if (accessToken) {
            FB.api('/me', { fields: 'id,name,email,picture' }, (profile: any) => {
              resolve({ accessToken, profile });
            });
          } else {
            reject(new Error('Facebook login cancelled'));
          }
        },
        { scope, return_scopes: true }
      );
    });
  }
}
