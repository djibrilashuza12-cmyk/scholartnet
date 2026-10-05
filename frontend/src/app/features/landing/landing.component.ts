// ============================================================
// SCOLARNET - LANDING COMPONENT
// Version Production Professionnelle
// ============================================================
import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  Renderer2,
  HostListener,
  Inject,
  PLATFORM_ID,
  ChangeDetectorRef,
  OnDestroy
} from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { timeout, catchError } from 'rxjs/operators';
import { throwError, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LogoComponent } from '../../shared/logo/logo.component';

// ============================================
// INTERFACES
// ============================================
interface SchoolOption {
  ecole_id: number;
  nom_ecole: string;
  code_epst: string;
  role: string;
}

interface SuggestionData {
  nom: string;
  email: string;
  sujet: string;
  message: string;
}

interface LoginCredentials {
  email: string;
  mot_de_passe: string;
  ecole_id: number | null;
}

interface RegisterData {
  code_epst: string;
  nom_ecole: string;
  adresse: string;
  bp: string;
  telephone: string;
  email_ecole: string;
  nom: string;
  prenom: string;
  email: string;
  mot_de_passe: string;
}

interface NavLink {
  name: string;
  href: string;
}

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  open: boolean;
}

// ============================================
// COMPONENT
// ============================================
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HttpClientModule, LogoComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {

  // ============ VIEW CHILDREN ============
  @ViewChild('videoModal') videoModal!: ElementRef;
  @ViewChild('demoVideo') demoVideo!: ElementRef;

  // ============ ÉTAT UI ============
  isMobileMenuOpen = false;
  isNavbarFixed = false;
  isLoginModalOpen = false;
  isRegisterModalOpen = false;
  registerStep: 1 | 2 = 1;
  activeTab: 'login' | 'register' = 'login';

  // ============ DONNÉES STATIQUES ============
  readonly navLinks: NavLink[] = [
    { name: 'Fonctionnalités', href: '#features' },
    { name: 'Consultation', href: '#resultats' },
    { name: 'Pour qui ?', href: '#for-whom' },
    { name: 'Suggestions', href: '#suggestions' },
    { name: 'FAQ', href: '#faq' }
  ];

  faqs: FaqItem[] = [
    {
      id: 1,
      question: 'Comment se passe la migration de mes données existantes ?',
      answer: 'Nous accompagnons chaque établissement avec une équipe dédiée. Nous importons vos données depuis vos fichiers Excel, bases de données ou autres logiciels. La migration se fait en toute sécurité et sans interruption de service.',
      open: false
    },
    {
      id: 2,
      question: 'Où sont hébergées les données de mon école ?',
      answer: 'Vos données sont hébergées dans des data centers certifiés ISO 27001, avec des sauvegardes quotidiennes. Chaque établissement dispose d\'un espace totalement isolé et sécurisé.',
      open: false
    },
    {
      id: 3,
      question: 'Comment consulter les résultats en ligne ?',
      answer: 'Rendez-vous sur le portail de consultation à l\'adresse http://207.180.205.248:8088 et saisissez le matricule de l\'élève. Les résultats publiés s\'afficheront automatiquement, période par période.',
      open: false
    },
    {
      id: 4,
      question: 'Puis-je personnaliser ScolarNet selon les besoins de mon école ?',
      answer: 'Absolument ! Nous proposons des modules personnalisables et des API pour intégrer vos outils existants. Notre équipe technique peut développer des fonctionnalités spécifiques à votre établissement.',
      open: false
    }
  ];

  // ============ LOGIN ============
  loginCredentials: LoginCredentials = {
    email: '',
    mot_de_passe: '',
    ecole_id: null
  };
  loginShowPassword = false;
  loginIsLoading = false;
  loginLoadingMessage = '';
  loginError = '';
  loginShowErrors = false;
  loginErrors: Record<string, string> = {};
  showForgotPasswordModal = false;
  showVerificationModal = false;
  pendingVerificationEmail = '';
  schoolsList: SchoolOption[] = [];
  loginStep: 'LOGIN' | 'SELECT_SCHOOL' = 'LOGIN';

  // ============ REGISTER ============
  registerData: RegisterData = {
    code_epst: '',
    nom_ecole: '',
    adresse: '',
    bp: '',
    telephone: '',
    email_ecole: '',
    nom: '',
    prenom: '',
    email: '',
    mot_de_passe: ''
  };
  registerConfirmPassword = '';
  registerShowPassword = false;
  registerShowConfirmPassword = false;
  registerIsLoading = false;
  registerLoadingMessage = '';
  registerShowErrors = false;
  registerErrors: Record<string, string> = {};
  registerServerError = '';

  // ============ SUGGESTIONS ============
  suggestionData: SuggestionData = {
    nom: '',
    email: '',
    sujet: '',
    message: ''
  };
  suggestionSubmitting = false;
  suggestionSuccess = false;
  suggestionError = '';

  // ============ CONFIG API ============
  private readonly API_BASE = 'http://207.180.205.248:3007';

  // ============ CLEANUP ============
  private destroy$ = new Subject<void>();
  private scrollHandler?: () => void;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private renderer: Renderer2,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  // ==========================================
  // LIFECYCLE
  // ==========================================
  ngOnInit(): void { }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setupIntersectionObserver();
      this.setupNavbarScroll();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
    // Sécurité : restaure le scroll body si on quitte avec une modale ouverte
    if (isPlatformBrowser(this.platformId)) {
      this.renderer.setStyle(document.body, 'overflow', 'auto');
    }
  }

  // ==========================================
  // SCROLL REVEAL
  // ==========================================
  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    const sections = document.querySelectorAll('.section-animate');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const animation = target.getAttribute('data-animation') || 'fadeInUp';
            target.classList.add(animation);
            observer.unobserve(target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    sections.forEach(section => observer.observe(section));
  }

  // ==========================================
  // NAVBAR SCROLL (avec cleanup)
  // ==========================================
  private setupNavbarScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.scrollHandler = () => {
      const y = window.scrollY;
      const shouldBeFixed = y > 20;
      if (this.isNavbarFixed !== shouldBeFixed) {
        this.isNavbarFixed = shouldBeFixed;
        this.cdr.detectChanges();
      }
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void { /* géré via setupNavbarScroll */ }

  // ==========================================
  // UI ACTIONS
  // ==========================================
  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.toggleBodyScroll(!this.isMobileMenuOpen);
  }

  toggleFaq(index: number): void {
    this.faqs[index].open = !this.faqs[index].open;
  }

  scrollToSection(sectionId: string): void {
    this.isMobileMenuOpen = false;
    this.toggleBodyScroll(true);

    if (!isPlatformBrowser(this.platformId)) return;

    const element = document.querySelector(sectionId);
    if (!element) return;

    const yOffset = -80;
    const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  private toggleBodyScroll(allow: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.renderer.setStyle(document.body, 'overflow', allow ? 'auto' : 'hidden');
  }

  // ==========================================
  // MODALES
  // ==========================================
  openLoginModal(): void {
    this.activeTab = 'login';
    this.isLoginModalOpen = true;
    this.isRegisterModalOpen = false;
    this.loginStep = 'LOGIN';
    this.loginError = '';
    this.toggleBodyScroll(false);
  }

  closeLoginModal(): void {
    this.isLoginModalOpen = false;
    this.resetLogin();
    this.checkAndRestoreScroll();
  }

  openRegisterModal(): void {
    this.activeTab = 'register';
    this.isRegisterModalOpen = true;
    this.isLoginModalOpen = false;
    this.registerStep = 1;
    this.registerServerError = '';
    this.toggleBodyScroll(false);
  }

  closeRegisterModal(): void {
    this.isRegisterModalOpen = false;
    this.resetRegister();
    this.checkAndRestoreScroll();
  }

  private checkAndRestoreScroll(): void {
    if (!this.isLoginModalOpen && !this.isRegisterModalOpen
      && !this.showForgotPasswordModal && !this.showVerificationModal) {
      this.toggleBodyScroll(true);
    }
  }

  switchToRegister(): void {
    this.closeLoginModal();
    setTimeout(() => this.openRegisterModal(), 250);
  }

  switchToLogin(): void {
    this.closeRegisterModal();
    setTimeout(() => this.openLoginModal(), 250);
  }

  // ==========================================
  // LOGIN
  // ==========================================
  private resetLogin(): void {
    this.loginCredentials = { email: '', mot_de_passe: '', ecole_id: null };
    this.loginError = '';
    this.loginErrors = {};
    this.loginShowErrors = false;
    this.loginStep = 'LOGIN';
    this.schoolsList = [];
    this.showForgotPasswordModal = false;
    this.showVerificationModal = false;
    this.loginIsLoading = false;
    this.loginShowPassword = false;
  }

  toggleLoginPassword(): void {
    this.loginShowPassword = !this.loginShowPassword;
  }

  private validateLogin(): boolean {
    this.loginErrors = {};
    const email = this.loginCredentials.email?.trim();
    const pwd = this.loginCredentials.mot_de_passe;

    if (!email) {
      this.loginErrors['email'] = 'Veuillez saisir votre email.';
    } else if (!this.isValidEmail(email)) {
      this.loginErrors['email'] = 'Format d\'email invalide.';
    }

    if (!pwd) {
      this.loginErrors['mot_de_passe'] = 'Veuillez saisir votre mot de passe.';
    }

    return Object.keys(this.loginErrors).length === 0;
  }

  onLogin(): void {
    this.loginShowErrors = true;
    this.loginError = '';

    if (!this.validateLogin()) return;

    this.loginIsLoading = true;
    this.loginLoadingMessage = 'Vérification de vos identifiants...';

    this.http.post<any>(`${this.API_BASE}/api/auth/login`, {
      email: this.loginCredentials.email.trim(),
      mot_de_passe: this.loginCredentials.mot_de_passe,
      ecole_id: this.loginCredentials.ecole_id
    })
      .pipe(
        timeout(10000),
        takeUntil(this.destroy$),
        catchError((err: any) => {
          this.loginIsLoading = false;

          if (err?.error?.requiresVerification) {
            this.pendingVerificationEmail = err.error.email || this.loginCredentials.email.trim();
            this.showVerificationModal = true;
            this.loginError = 'Votre compte doit être vérifié.';
          } else if (err?.name === 'TimeoutError') {
            this.loginError = 'Le serveur ne répond pas. Veuillez réessayer.';
          } else {
            this.loginError = err?.error?.message || 'Identifiants incorrects.';
          }
          this.cdr.detectChanges();
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (res: any) => {
          if (res.requiresSchoolSelection && res.schools?.length > 1) {
            this.loginIsLoading = false;
            this.schoolsList = res.schools;
            this.loginStep = 'SELECT_SCHOOL';
            this.cdr.detectChanges();
            return;
          }

          this.loginLoadingMessage = 'Chargement de votre tableau de bord...';
          this.cdr.detectChanges();

          this.persistSession(res.token, res.user);

          this.router.navigate([this.getRouteForRole(res.user?.role)])
            .then(() => {
              this.loginIsLoading = false;
              this.closeLoginModal();
              this.cdr.detectChanges();
            })
            .catch(() => {
              this.loginIsLoading = false;
              this.cdr.detectChanges();
            });
        },
        error: () => {
          this.loginIsLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  onSelectSchool(school: SchoolOption): void {
    this.loginCredentials.ecole_id = school.ecole_id;
    this.onLogin();
  }

  private persistSession(token: string, user: any): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.removeItem('school_token');
    } catch {
      /* stockage indisponible : mode privé */
    }
  }

  private getRouteForRole(role?: string): string {
    switch (role?.toUpperCase()) {
      case 'ADMIN': return '/admin/dashboard';
      case 'GESTIONNAIRE': return '/gestionnaire/dashboard';
      case 'SECRETAIRE': return '/secretariat/dashboard';
      case 'TITULAIRE': return '/titulaire/dashboard';
      default: return '/admin/dashboard';
    }
  }

  // ==========================================
  // REGISTER
  // ==========================================
  private resetRegister(): void {
    this.registerData = {
      code_epst: '', nom_ecole: '', adresse: '', bp: '',
      telephone: '', email_ecole: '', nom: '', prenom: '',
      email: '', mot_de_passe: ''
    };
    this.registerConfirmPassword = '';
    this.registerErrors = {};
    this.registerShowErrors = false;
    this.registerServerError = '';
    this.registerStep = 1;
    this.registerIsLoading = false;
    this.registerShowPassword = false;
    this.registerShowConfirmPassword = false;
  }

  toggleRegisterPassword(): void {
    this.registerShowPassword = !this.registerShowPassword;
  }

  toggleRegisterConfirmPassword(): void {
    this.registerShowConfirmPassword = !this.registerShowConfirmPassword;
  }

  goToRegisterStep2(): void {
    this.registerShowErrors = true;
    this.registerErrors = {};

    if (!this.registerData.code_epst?.trim()) {
      this.registerErrors['code_epst'] = 'Le Code EPST est obligatoire.';
    }
    if (!this.registerData.nom_ecole?.trim()) {
      this.registerErrors['nom_ecole'] = 'Le nom de l\'école est obligatoire.';
    }

    if (Object.keys(this.registerErrors).length === 0) {
      this.registerShowErrors = false;
      this.registerStep = 2;
      this.registerServerError = '';
    }
  }

  onRegister(): void {
    this.registerShowErrors = true;
    this.registerErrors = {};
    this.registerServerError = '';

    if (!this.registerData.nom?.trim()) {
      this.registerErrors['nom'] = 'Le nom est obligatoire.';
    }
    if (!this.registerData.prenom?.trim()) {
      this.registerErrors['prenom'] = 'Le prénom est obligatoire.';
    }
    if (!this.registerData.email?.trim()) {
      this.registerErrors['email'] = 'L\'email est obligatoire.';
    } else if (!this.isValidEmail(this.registerData.email.trim())) {
      this.registerErrors['email'] = 'Format d\'email invalide.';
    }

    if (!this.registerData.mot_de_passe) {
      this.registerErrors['mot_de_passe'] = 'Le mot de passe est obligatoire.';
    } else if (this.registerData.mot_de_passe.length < 6) {
      this.registerErrors['mot_de_passe'] = 'Minimum 6 caractères requis.';
    }

    if (this.registerData.mot_de_passe !== this.registerConfirmPassword) {
      this.registerErrors['confirmPassword'] = 'Les mots de passe ne correspondent pas.';
    }

    if (Object.keys(this.registerErrors).length > 0) return;

    this.registerIsLoading = true;
    this.registerLoadingMessage = 'Création de votre établissement...';

    this.http.post<any>(`${this.API_BASE}/api/auth/register`, this.registerData)
      .pipe(
        timeout(15000),
        takeUntil(this.destroy$),
        catchError((err: any) => {
          this.registerIsLoading = false;
          this.registerServerError = err?.error?.message || 'Erreur lors de la création. Veuillez réessayer.';
          this.cdr.detectChanges();
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (res: any) => {
          this.registerLoadingMessage = 'Chargement de votre tableau de bord...';
          this.cdr.detectChanges();

          this.persistSession(res.token, res.user);

          this.router.navigate(['/admin/dashboard'])
            .then(() => {
              this.registerIsLoading = false;
              this.closeRegisterModal();
              this.cdr.detectChanges();
            })
            .catch(() => {
              this.registerIsLoading = false;
              this.cdr.detectChanges();
            });
        },
        error: () => {
          this.registerIsLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  // ==========================================
  // SUGGESTIONS
  // ==========================================
  onSubmitSuggestion(): void {
    this.suggestionError = '';

    if (!this.suggestionData.nom?.trim()) {
      this.suggestionError = 'Veuillez saisir votre nom.';
      return;
    }
    if (!this.suggestionData.email?.trim()) {
      this.suggestionError = 'Veuillez saisir votre email.';
      return;
    }
    if (!this.isValidEmail(this.suggestionData.email.trim())) {
      this.suggestionError = 'Format d\'email invalide.';
      return;
    }
    if (!this.suggestionData.sujet?.trim()) {
      this.suggestionError = 'Veuillez saisir un sujet.';
      return;
    }
    if (!this.suggestionData.message?.trim()) {
      this.suggestionError = 'Veuillez saisir votre message.';
      return;
    }

    this.suggestionSubmitting = true;

    const payload = {
      nom: this.suggestionData.nom.trim(),
      email: this.suggestionData.email.trim(),
      sujet: this.suggestionData.sujet.trim(),
      message: this.suggestionData.message.trim()
    };

    this.http.post<any>(`${this.API_BASE}/api/suggestions`, payload)
      .pipe(
        timeout(15000),
        takeUntil(this.destroy$),
        catchError((err: any) => {
          this.suggestionSubmitting = false;
          if (err?.name === 'TimeoutError') {
            this.suggestionError = 'Le serveur ne répond pas. Veuillez réessayer.';
          } else {
            this.suggestionError = err?.error?.message || 'Erreur lors de l\'envoi. Veuillez réessayer.';
          }
          this.cdr.detectChanges();
          return throwError(() => err);
        })
      )
      .subscribe({
        next: () => {
          this.suggestionSubmitting = false;
          this.suggestionSuccess = true;
          this.cdr.detectChanges();
        },
        error: () => {
          this.suggestionSubmitting = false;
          this.cdr.detectChanges();
        }
      });
  }

  resetSuggestionForm(): void {
    this.suggestionData = { nom: '', email: '', sujet: '', message: '' };
    this.suggestionSuccess = false;
    this.suggestionError = '';
  }

  // ==========================================
  // HELPERS
  // ==========================================
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}