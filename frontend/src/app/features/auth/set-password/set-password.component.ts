import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { timeout, catchError } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { throwError } from 'rxjs';

declare const google: any;

@Component({
  selector: 'app-set-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HttpClientModule],
  template: `
    <div *ngIf="isLoading" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div class="bg-white px-7 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3 border border-slate-100">
        <svg class="w-8 h-8 text-brand-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div class="text-slate-700 font-semibold text-sm">{{ loadingMessage || 'Traitement en cours...' }}</div>
      </div>
    </div>

    <div class="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 font-sans">
      <div class="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div class="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-20 filter grayscale"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-slate-950/80"></div>
        <div class="absolute -top-32 -left-32 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"></div>
      </div>

      <div class="w-full max-w-md relative z-10 animate-slide-up">
        <div class="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div class="p-8">

            <!-- ETAT 1: Chargement -->
            <div *ngIf="isCheckingToken" class="text-center py-8 space-y-3">
              <svg class="w-8 h-8 text-brand-600 animate-spin mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p class="text-sm font-medium text-slate-600">Vérification de la sécurité du lien...</p>
            </div>

            <!-- ETAT 2: Lien invalide -->
            <div *ngIf="!isCheckingToken && tokenInvalid" class="space-y-6 text-center animate-fade-in py-2">
              <div class="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <svg class="w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 class="text-lg font-bold text-slate-900">Lien expiré ou invalide</h2>
                <p class="text-slate-600 text-xs mt-2 leading-relaxed">{{ invalidReason }}</p>
              </div>
              <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 text-left space-y-2">
                <div class="flex items-center gap-2 font-bold text-slate-800">
                  <svg class="w-4 h-4 text-brand-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Que faire ?
                </div>
                <p>Veuillez contacter l'administrateur de votre établissement pour recevoir un nouveau lien.</p>
              </div>
              <a routerLink="/" class="block w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all">
                Retour à la page d'accueil
              </a>
            </div>

            <!-- ETAT 3: Vérification Google -->
            <div *ngIf="!isCheckingToken && !tokenInvalid && !googleVerified && !showPasswordForm" class="space-y-6 text-center animate-fade-in">
              <div class="w-16 h-16 rounded-full bg-brand-50 border-2 border-brand-200 text-brand-600 flex items-center justify-center mx-auto">
                <svg class="w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              
              <div>
                <h2 class="text-lg font-bold text-slate-800">Vérification d'identité requise</h2>
                <p class="text-slate-600 text-xs mt-1">
                  Pour des raisons de sécurité, veuillez confirmer votre identité avec Google.
                </p>
              </div>

              <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-left">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Compte à activer</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                    {{ userInfo.role || 'Personnel' }}
                  </span>
                </div>
                <div class="text-sm font-bold text-slate-900">{{ userInfo.nomComplet }}</div>
                <div class="text-xs text-slate-600">{{ userInfo.nomEcole }}</div>
              </div>

              <button (click)="startGoogleVerification()"
                      class="w-full py-3.5 px-4 bg-white border-2 border-slate-200 hover:border-brand-300 text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center gap-3 text-sm hover:shadow-md">
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Vérifier avec Google
              </button>

              <p class="text-[10px] text-slate-400 mt-2">
                Google est utilisé uniquement pour vérifier votre identité.
              </p>
            </div>

            <!-- ETAT 4: Formulaire mot de passe -->
            <div *ngIf="!isCheckingToken && !tokenInvalid && showPasswordForm" class="space-y-5 animate-fade-in">
              <div class="text-center mb-6">
                <h2 class="text-xl font-bold text-slate-800">Définition du mot de passe</h2>
                <p class="text-slate-500 text-xs mt-1">Choisissez un mot de passe sécurisé pour votre compte</p>
              </div>

              <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Identité vérifiée</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {{ userInfo.role || 'Personnel' }}
                  </span>
                </div>
                <div class="text-sm font-bold text-slate-900">{{ userInfo.nomComplet }}</div>
                <div class="flex items-center gap-1.5 text-xs text-slate-600">
                  <svg class="w-4 h-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span class="font-mono font-semibold text-slate-800">{{ userInfo.maskedEmail || userInfo.email }}</span>
                </div>
                <div *ngIf="userInfo.nomEcole" class="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-200/60">
                  <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {{ userInfo.nomEcole }}
                </div>
              </div>

              <form (ngSubmit)="onSubmitPassword()" class="space-y-4">
                <div>
                  <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nouveau mot de passe <span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input [type]="showPassword ? 'text' : 'password'" 
                           [(ngModel)]="formData.mot_de_passe" 
                           name="mot_de_passe" 
                           required 
                           autocomplete="new-password"
                           class="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-all outline-none text-slate-900 text-sm placeholder:text-slate-400 font-medium" 
                           placeholder="••••••••" />
                    <button type="button" 
                            (click)="showPassword = !showPassword"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                      <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path *ngIf="!showPassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path *ngIf="!showPassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        <path *ngIf="showPassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    </button>
                  </div>
                  <p class="text-[11px] text-slate-400 mt-1">Au moins 6 caractères.</p>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirmer le mot de passe <span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <input [type]="showConfirmPassword ? 'text' : 'password'" 
                           [(ngModel)]="formData.confirm_mot_de_passe" 
                           name="confirm_mot_de_passe" 
                           required 
                           autocomplete="new-password"
                           class="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-all outline-none text-slate-900 text-sm placeholder:text-slate-400 font-medium" 
                           placeholder="••••••••" />
                    <button type="button" 
                            (click)="showConfirmPassword = !showConfirmPassword"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                      <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path *ngIf="!showConfirmPassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path *ngIf="!showConfirmPassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        <path *ngIf="showConfirmPassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div *ngIf="errorMsg" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
                  <svg class="w-4 h-4 text-red-500 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{{ errorMsg }}</span>
                </div>

                <div *ngIf="successMsg" class="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
                  <svg class="w-4 h-4 text-emerald-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span class="font-bold">{{ successMsg }}</span>
                </div>

                <button type="submit" 
                        [disabled]="isLoading"
                        class="w-full py-3.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer">
                  <span>Enregistrer mon mot de passe</span>
                  <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </form>

              <div class="text-center pt-3">
                <a routerLink="/" class="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                  Retour à la page d'accueil
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .animate-fade-in { animation: fadeIn 0.25s ease-out; }
    .animate-slide-up { animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class SetPasswordComponent implements OnInit {
  token = '';
  email = '';

  isCheckingToken = true;
  tokenInvalid = false;
  invalidReason = '';
  googleVerified = false;
  showPasswordForm = false;

  userInfo = {
    nomComplet: '',
    maskedEmail: '',
    email: '',
    nomEcole: '',
    role: ''
  };

  formData = {
    mot_de_passe: '',
    confirm_mot_de_passe: ''
  };

  showPassword = false;
  showConfirmPassword = false;

  isLoading = false;
  loadingMessage = '';
  errorMsg = '';
  successMsg = '';

  private API_BASE = 'http://207.180.205.248:3007';
  private googleClientId: string = '';

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    // Charger la configuration Google en premier
    this.loadGoogleConfig().then(() => {
      // Ensuite vérifier le token
      this.route.queryParams.subscribe(params => {
        this.token = params['token'] || '';
        this.email = params['email'] || '';

        if (!this.token || !this.email) {
          this.isCheckingToken = false;
          this.tokenInvalid = true;
          this.invalidReason = 'Lien incomplet.';
          return;
        }

        this.verifyToken();
      });
    }).catch(() => {
      // Si la config Google échoue, on continue quand même
      this.route.queryParams.subscribe(params => {
        this.token = params['token'] || '';
        this.email = params['email'] || '';
        if (!this.token || !this.email) {
          this.isCheckingToken = false;
          this.tokenInvalid = true;
          this.invalidReason = 'Lien incomplet.';
        } else {
          this.verifyToken();
        }
      });
    });
  }

  /**
   * Charge la configuration Google depuis le backend
   */
  async loadGoogleConfig(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.API_BASE}/api/auth/google-config`)
      );
      this.googleClientId = response.clientId;
      console.log('[Google Config] Client ID chargé depuis le backend');
    } catch (error) {
      console.error('[Google Config] Erreur de chargement:', error);
    }
  }

  verifyToken() {
    this.isCheckingToken = true;
    this.tokenInvalid = false;

    this.http.get<any>(`${this.API_BASE}/api/auth/verify-password-token`, {
      params: {
        token: this.token,
        email: this.email
      }
    })
    .pipe(
      timeout(10000),
      catchError((err: any) => {
        this.isCheckingToken = false;
        if (err?.error?.requiresGoogleVerification) {
          this.tokenInvalid = false;
          this.googleVerified = false;
          this.showPasswordForm = false;
          this.isCheckingToken = false;
          // On va afficher l'étape de vérification Google
          this.userInfo = {
            nomComplet: err?.error?.nomComplet || 'Utilisateur',
            maskedEmail: '',
            email: this.email,
            nomEcole: err?.error?.nomEcole || '',
            role: err?.error?.role || ''
          };
          this.cdr.detectChanges();
          return throwError(() => err);
        }
        this.tokenInvalid = true;
        this.invalidReason = err?.error?.message || 'Ce lien est invalide ou a expiré.';
        this.cdr.detectChanges();
        return throwError(() => err);
      })
    )
    .subscribe({
      next: (res: any) => {
        this.isCheckingToken = false;
        this.googleVerified = true;
        this.showPasswordForm = true;
        this.userInfo = {
          nomComplet: res.nomComplet || 'Utilisateur',
          maskedEmail: res.maskedEmail || this.email,
          email: res.email || this.email,
          nomEcole: res.nomEcole || '',
          role: res.role || ''
        };
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (!this.tokenInvalid && err?.error?.requiresGoogleVerification) {
          // Déjà géré dans catchError
          return;
        }
        this.isCheckingToken = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadGoogleScript(): Promise<void> {
    return new Promise((resolve) => {
      if (document.getElementById('google-oauth-script')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-oauth-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  }

  startGoogleVerification() {
    this.isLoading = true;
    this.loadingMessage = 'Préparation de la vérification Google...';

    // Vérifier que le client ID est disponible
    if (!this.googleClientId) {
      this.isLoading = false;
      this.errorMsg = 'Configuration Google non disponible. Veuillez contacter l\'administrateur.';
      this.cdr.detectChanges();
      return;
    }

    this.loadGoogleScript().then(() => {
      this.initializeGoogleSignIn();
    });
  }

  initializeGoogleSignIn() {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.googleClientId,
      scope: 'email profile',
      callback: (response: any) => {
        this.ngZone.run(() => {
          this.verifyGoogleIdentity(response.access_token);
        });
      }
    });

    tokenClient.requestAccessToken();
  }

  verifyGoogleIdentity(accessToken: string) {
    this.isLoading = true;
    this.loadingMessage = 'Vérification de votre identité...';

    this.http.post<any>(`${this.API_BASE}/api/auth/verify-google-identity`, {
      token: this.token,
      email: this.email,
      googleIdToken: accessToken
    })
    .pipe(
      timeout(15000),
      catchError((err: any) => {
        this.isLoading = false;
        this.tokenInvalid = true;
        this.invalidReason = err?.error?.message || 'Erreur lors de la vérification Google.';
        this.cdr.detectChanges();
        return throwError(() => err);
      })
    )
    .subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.googleVerified = true;
        this.showPasswordForm = true;
        this.userInfo = {
          nomComplet: res.nomComplet || 'Utilisateur',
          maskedEmail: res.email || this.email,
          email: res.email || this.email,
          nomEcole: res.nomEcole || '',
          role: res.role || ''
        };
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSubmitPassword() {
  this.errorMsg = '';
  this.successMsg = '';

  if (!this.formData.mot_de_passe || this.formData.mot_de_passe.length < 6) {
    this.errorMsg = 'Le mot de passe doit comporter au moins 6 caractères.';
    return;
  }

  if (this.formData.mot_de_passe !== this.formData.confirm_mot_de_passe) {
    this.errorMsg = 'Les deux mots de passe ne correspondent pas.';
    return;
  }

  this.isLoading = true;
  this.loadingMessage = 'Enregistrement sécurisé de votre mot de passe...';

  this.http.post<any>(`${this.API_BASE}/api/auth/set-password`, {
    token: this.token,
    email: this.email,
    mot_de_passe: this.formData.mot_de_passe
  })
  .pipe(
    timeout(12000),
    catchError((err: any) => {
      this.isLoading = false;
      this.errorMsg = err?.error?.message || 'Erreur lors de la configuration du mot de passe.';
      this.cdr.detectChanges();
      return throwError(() => err);
    })
  )
  .subscribe({
    next: (res: any) => {
      // ✅ GARDE LE SPINNER ACTIF
      this.loadingMessage = 'Chargement de votre tableau de bord...';
      
      sessionStorage.setItem('token', res.token);
      sessionStorage.setItem('user', JSON.stringify(res.user));
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));

      this.cdr.detectChanges();

      // ✅ REDIRECTION - SPINNER RESTE VISIBLE
      this.redirectByRole(res.user?.role);
    },
    error: () => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  });
}

  private redirectByRole(role?: string): void {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        this.router.navigate(['/admin/dashboard']);
        break;
      case 'GESTIONNAIRE':
        this.router.navigate(['/gestionnaire/dashboard']);
        break;
      case 'SECRETAIRE':
        this.router.navigate(['/secretariat/dashboard']);
        break;
      case 'TITULAIRE':
        this.router.navigate(['/titulaire/dashboard']);
        break;
      default:
        this.router.navigate(['/admin/dashboard']);
        break;
    }
  }
}