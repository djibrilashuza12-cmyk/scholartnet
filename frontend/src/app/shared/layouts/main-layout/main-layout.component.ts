import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { LogoComponent } from '../../logo/logo.component';
@Component({
    selector: 'app-main-layout',
    standalone: true,
    imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LogoComponent],
    template: `
        <div class="min-h-screen flex bg-zinc-50 font-sans">
            <!-- Overlay pour fermer la sidebar sur mobile -->
            <div *ngIf="sidebarOpen" 
                 class="fixed inset-0 bg-black/50 z-30 md:hidden"
                 (click)="toggleSidebar()"></div>

            <!-- Sidebar -->
            <aside [class]="'w-64 bg-white border-r border-zinc-200 flex-shrink-0 min-h-screen flex flex-col z-40 ' + 
                   (sidebarOpen ? 'fixed inset-y-0 left-0 shadow-2xl' : 'hidden') + 
                   ' md:flex md:sticky md:top-0 md:h-screen md:shadow-sm'">
                
                <!-- Bouton de fermeture sur mobile -->
                <button (click)="toggleSidebar()" 
                        class="absolute top-4 right-4 p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg md:hidden">
                    <i class="ph ph-x text-2xl"></i>
                </button>

                <!-- Brand Logo -->
                <div class="p-6 pb-4 border-b border-zinc-100 bg-white">
                    <div class="flex items-center gap-2 mb-1">
                        <app-logo [size]="32" [showText]="true"></app-logo>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p class="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">{{ roleDisplay }}</p>
                    </div>
                </div>

                <!-- Navigation Scrollable Area -->
                <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
                    <!-- SECTION: Principal -->
                    <div class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 mb-2 mt-2">Menu Principal</div>
                    
                    <a (click)="navigateToDashboard(); closeSidebarOnMobile()"
                    [class]="isActiveTab('dashboard') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group">
                        <i class="ph ph-squares-four text-lg transition-transform group-hover:scale-110"></i>
                        <span>Tableau de bord</span>
                    </a>

                    <!-- NAVIGATION GESTIONNAIRE -->
                    <ng-container *ngIf="role === 'GESTIONNAIRE'">
                        <a routerLink="/gestionnaire/paiements" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-credit-card text-lg transition-transform group-hover:scale-110"></i>
                            <span>Paiements</span>
                        </a>
                        <a routerLink="/gestionnaire/frais" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-file-invoice text-lg transition-transform group-hover:scale-110"></i>
                            <span>Frais scolaires</span>
                        </a>
                        <a routerLink="/gestionnaire/impayes" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-warning-circle text-lg transition-transform group-hover:scale-110"></i>
                            <span>Impayés</span>
                        </a>
                        <a routerLink="/gestionnaire/stocks" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-package text-lg transition-transform group-hover:scale-110"></i>
                            <span>Stocks</span>
                        </a>
                        <a routerLink="/gestionnaire/rapports" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-chart-bar text-lg transition-transform group-hover:scale-110"></i>
                            <span>Rapports</span>
                        </a>
                        <a routerLink="/gestionnaire/periodes" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-calendar-blank text-lg transition-transform group-hover:scale-110"></i>
                            <span>Périodes</span>
                        </a>
                        <a routerLink="/gestionnaire/autorisations" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-lock-key-open text-lg transition-transform group-hover:scale-110"></i>
                            <span>Autorisations</span>
                        </a>
                    </ng-container>

                    <!-- NAVIGATION SECRETAIRE -->
                    <ng-container *ngIf="role === 'SECRETAIRE'">
                        <div class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 mb-2 mt-2">Menu Secrétariat</div>
                        
                        <a (click)="navigateToDashboard(); closeSidebarOnMobile()"
                        [class]="isActiveTab('dashboard') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'"
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group">
                            <i class="ph ph-squares-four text-lg transition-transform group-hover:scale-110"></i>
                            <span>Statistiques</span>
                        </a>
                        <a (click)="setActiveTab('eleves'); closeSidebarOnMobile()"
                        [class]="isActiveTab('eleves') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'"
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group">
                            <i class="ph ph-users text-lg transition-transform group-hover:scale-110"></i>
                            <span>Élèves</span>
                        </a>
                        <a (click)="setActiveTab('classes'); closeSidebarOnMobile()"
                        [class]="isActiveTab('classes') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'"
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group">
                            <i class="ph ph-books text-lg transition-transform group-hover:scale-110"></i>
                            <span>Classes</span>
                        </a>
                        <a (click)="setActiveTab('inscriptions'); closeSidebarOnMobile()"
                        [class]="isActiveTab('inscriptions') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'"
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group">
                            <i class="ph ph-clipboard-text text-lg transition-transform group-hover:scale-110"></i>
                            <span>Inscriptions</span>
                        </a>
                        <a (click)="setActiveTab('messages'); closeSidebarOnMobile()"
                        [class]="isActiveTab('messages') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'"
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group">
                            <i class="ph ph-whatsapp-logo text-lg transition-transform group-hover:scale-110 text-emerald-600"></i>
                            <span class="font-bold text-emerald-700">WhatsApp</span>
                        </a>
                    </ng-container>

                    <!-- NAVIGATION TITULAIRE -->
                    <ng-container *ngIf="role === 'TITULAIRE'">
                        <a routerLink="/titulaire/notes" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-exam text-lg transition-transform group-hover:scale-110"></i>
                            <span>Notes & Examens</span>
                        </a>
                        <a routerLink="/titulaire/presences" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-check-square text-lg transition-transform group-hover:scale-110"></i>
                            <span>Présences</span>
                        </a>
                        <a routerLink="/titulaire/appreciations" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-chat-centered-text text-lg transition-transform group-hover:scale-110"></i>
                            <span>Appréciations</span>
                        </a>
                        <a routerLink="/titulaire/bulletins" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-file-text text-lg transition-transform group-hover:scale-110"></i>
                            <span>Bulletins</span>
                        </a>
                        <a routerLink="/titulaire/classement" routerLinkActive="!bg-brand-50 !text-brand-700 font-semibold"
                           (click)="closeSidebarOnMobile()"
                           class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer group">
                            <i class="ph ph-trophy text-lg transition-transform group-hover:scale-110"></i>
                            <span>Classement</span>
                        </a>
                    </ng-container>

                    <!-- NAVIGATION ADMIN (INSPECTION) -->
                    <ng-container *ngIf="role === 'ADMIN'">
                        <div class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 mb-2 mt-6">Inspection (Vue Seule)</div>
                        <a routerLink="/gestionnaire/dashboard" (click)="closeSidebarOnMobile()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all">
                            <i class="ph ph-chart-line-up text-lg"></i>
                            <span>Suivi Financier</span>
                        </a>
                        <a routerLink="/gestionnaire/rapports" (click)="closeSidebarOnMobile()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all">
                            <i class="ph ph-chart-bar text-lg"></i>
                            <span>Rapports</span>
                        </a>
                        <a routerLink="/titulaire/dashboard" (click)="closeSidebarOnMobile()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-blue-50 hover:text-blue-700 transition-all">
                            <i class="ph ph-graduation-cap text-lg"></i>
                            <span>Suivi Pédagogique</span>
                        </a>
                        <a routerLink="/secretariat/dashboard" (click)="closeSidebarOnMobile()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-purple-50 hover:text-purple-700 transition-all">
                            <i class="ph ph-identification-card text-lg"></i>
                            <span>Secrétariat</span>
                        </a>
                    </ng-container>
                </nav>

                <!-- Profile & Logout -->
                <div class="p-4 border-t border-zinc-100 bg-zinc-50/30">
                    <div class="flex items-center gap-3 px-3 py-2 mb-2">
                        <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                            {{ userInitiales }}
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-zinc-900 truncate">{{ userNomComplet }}</p>
                            <p class="text-[10px] text-zinc-500 truncate">{{ userMatricule }}</p>
                        </div>
                    </div>
                    <button (click)="logout(); closeSidebarOnMobile()" 
                            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-red-50 hover:text-red-600 transition-colors group">
                        <i class="ph ph-sign-out text-lg transition-transform group-hover:translate-x-1"></i>
                        <span>Déconnexion</span>
                    </button>
                </div>
            </aside>

            <!-- Main Content Area -->
            <div class="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                <!-- Mobile Header -->
                <header class="md:hidden flex items-center justify-between p-4 bg-white border-b border-zinc-200 z-30">
                    <app-logo [size]="32" [showText]="true"></app-logo>
                    <button (click)="toggleSidebar()" class="p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">
                        <i class="ph ph-list text-2xl"></i>
                    </button>
                </header>

                <!-- Scrollable Viewport -->
                <main class="flex-1 overflow-y-auto p-4 md:p-8 bg-zinc-50 relative">
                    <div class="max-w-7xl mx-auto">
                        <router-outlet></router-outlet>
                    </div>
                    <!-- Background Decorator -->
                    <div class="fixed top-0 right-0 w-1/2 h-96 bg-gradient-to-bl from-brand-50/30 to-transparent pointer-events-none -z-10"></div>
                </main>
            </div>
        </div>
    `,
    styles: [
        `
        :host { display: block; }
        aside::-webkit-scrollbar { width: 4px; }
        aside::-webkit-scrollbar-track { background: transparent; }
        aside::-webkit-scrollbar-thumb {
            background: #e4e4e7;
            border-radius: 4px;
        }
        aside::-webkit-scrollbar-thumb:hover { background: #d4d4d8; }

        /* Animation pour la sidebar mobile */
        aside.fixed {
            transform: translateX(-100%);
            transition: transform 0.3s ease-in-out;
        }
        aside.fixed:not(.hidden) {
            transform: translateX(0);
        }
    `
    ]
})
export class MainLayoutComponent implements OnInit, OnDestroy {
    role = '';
    roleDisplay = '';
    basePath = '';
    userNomComplet = '';
    userInitiales = '';
    userMatricule = '';
    activeSecretariatTab: string = 'dashboard';
    sidebarOpen: boolean = false;
    private routeSubscription: Subscription | null = null;

    constructor(
        private router: Router,
        private cdr: ChangeDetectorRef,
        private route: ActivatedRoute
    ) { }

    @HostListener('window:resize', ['$event'])
    onWindowResize() {
        if (window.innerWidth >= 768) {
            this.sidebarOpen = false;
            document.body.style.overflow = '';
        }
    }

    ngOnInit(): void {
        const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');

        if (!token || !userStr) {
            this.router.navigate(['/']);
            return;
        }

        try {
            const user = JSON.parse(userStr);
            this.role = user.role || '';
            this.userNomComplet = `${user.nom} ${user.prenom}`;
            this.userInitiales = `${user.nom?.charAt(0) || ''}${user.prenom?.charAt(0) || ''}`.toUpperCase();
            this.userMatricule = user.matricule || '';

            const roleMap: Record<string, string> = {
                'ADMIN': 'Administrateur',
                'GESTIONNAIRE': 'Gestionnaire',
                'SECRETAIRE': 'Secrétariat',
                'TITULAIRE': 'Titulaire'
            };
            this.roleDisplay = roleMap[this.role] || this.role;

            const roleToPath: Record<string, string> = {
                'ADMIN': '/admin',
                'GESTIONNAIRE': '/gestionnaire',
                'SECRETAIRE': '/secretariat',
                'TITULAIRE': '/titulaire'
            };
            this.basePath = roleToPath[this.role] || '/development';

            // ✅ Écouter les changements d'URL pour synchroniser l'onglet actif
            this.routeSubscription = this.route.queryParams.subscribe(params => {
                const tabParam = params['tab'];
                if (tabParam && ['dashboard', 'eleves', 'classes', 'inscriptions', 'messages'].includes(tabParam)) {
                    this.activeSecretariatTab = tabParam;
                    this.cdr.detectChanges();
                }
            });

            // Lecture initiale
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');
            if (tabParam && ['dashboard', 'eleves', 'classes', 'inscriptions', 'messages'].includes(tabParam)) {
                this.activeSecretariatTab = tabParam;
            }

            const currentPath = this.router.url;
            if (currentPath === '/' || currentPath === '/admin' || currentPath === '/gestionnaire' || currentPath === '/secretariat' || currentPath === '/titulaire') {
                this.router.navigate([this.basePath + '/dashboard']);
            }

        } catch (e) {
            console.error('Erreur parsing user session', e);
            this.router.navigate(['/']);
        }
        this.cdr.detectChanges();
    }

    ngOnDestroy(): void {
        if (this.routeSubscription) {
            this.routeSubscription.unsubscribe();
        }
        document.body.style.overflow = '';
    }

    toggleSidebar(): void {
        this.sidebarOpen = !this.sidebarOpen;
        if (this.sidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    closeSidebarOnMobile(): void {
        if (window.innerWidth < 768) {
            this.sidebarOpen = false;
            document.body.style.overflow = '';
        }
    }

    isActiveTab(tab: string): boolean {
        // Pour le dashboard, vérifier si l'URL correspond au dashboard du rôle
        if (tab === 'dashboard') {
            const currentUrl = this.router.url;
            // Vérifier si on est sur le dashboard du rôle actuel
            return currentUrl === `${this.basePath}/dashboard` ||
                currentUrl.startsWith(`${this.basePath}/dashboard?`);
        }
        // Pour les autres onglets
        return this.activeSecretariatTab === tab;
    }

    setActiveTab(tab: string): void {
        // Pour le dashboard, rediriger vers le dashboard du rôle actuel
        if (tab === 'dashboard') {
            this.router.navigate([this.basePath, 'dashboard']);
            return;
        }

        // Pour les autres onglets du secrétariat
        this.activeSecretariatTab = tab;
        this.router.navigate(['/secretariat/dashboard'], {
            queryParams: { tab: tab }
        });
    }

    navigateToDashboard(): void {
        this.activeSecretariatTab = 'dashboard';
        this.router.navigate([this.basePath, 'dashboard']);
    }

    onMenuClick(path: string): void {
        if (this.router.url === path) {
            this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
                this.router.navigate([path]);
            });
        } else {
            this.router.navigate([path]);
        }
        this.cdr.detectChanges();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    logout(): void {
        sessionStorage.clear();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('school_token');
        this.router.navigate(['/']);
    }
}