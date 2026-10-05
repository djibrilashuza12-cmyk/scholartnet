import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject } from 'rxjs';
import { LogoComponent } from '../../logo/logo.component';

@Component({
  selector: 'app-titulaire-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LogoComponent],
  template: `
    <div class="min-h-screen flex bg-zinc-50">
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

        <!-- En-tête -->
        <div class="p-6 pb-4 border-b border-zinc-100">
          <h1 class="text-xl font-bold tracking-tight text-zinc-900">Titulaire</h1>
          <p class="text-xs text-zinc-500 mt-1 font-medium">{{ userNom || 'Chef de classe' }}</p>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
          <a routerLink="/titulaire/dashboard" 
             routerLinkActive="!bg-zinc-100 !text-zinc-900 font-semibold" 
             [routerLinkActiveOptions]="{exact: true}" 
             (click)="closeSidebarOnMobile()"
             class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
            <i class="ph ph-squares-four text-lg"></i>
            <span>Dashboard</span>
          </a>

          <a routerLink="/titulaire/notes" 
             routerLinkActive="!bg-zinc-100 !text-zinc-900 font-semibold" 
             [routerLinkActiveOptions]="{exact: true}" 
             (click)="closeSidebarOnMobile()"
             class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
            <i class="ph ph-exam text-lg"></i>
            <span>Notes</span>
          </a>

          <a routerLink="/titulaire/presences" 
             routerLinkActive="!bg-zinc-100 !text-zinc-900 font-semibold" 
             [routerLinkActiveOptions]="{exact: true}" 
             (click)="closeSidebarOnMobile()"
             class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
            <i class="ph ph-check-square text-lg"></i>
            <span>Présences</span>
          </a>

          <a routerLink="/titulaire/appreciations" 
             routerLinkActive="!bg-zinc-100 !text-zinc-900 font-semibold" 
             [routerLinkActiveOptions]="{exact: true}" 
             (click)="closeSidebarOnMobile()"
             class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
            <i class="ph ph-chat-centered-text text-lg"></i>
            <span>Appréciations</span>
          </a>

          <a routerLink="/titulaire/bulletins" 
             routerLinkActive="!bg-zinc-100 !text-zinc-900 font-semibold" 
             [routerLinkActiveOptions]="{exact: true}" 
             (click)="closeSidebarOnMobile()"
             class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
            <i class="ph ph-file-text text-lg"></i>
            <span>Bulletins</span>
          </a>

          <a routerLink="/titulaire/classement" 
             routerLinkActive="!bg-zinc-100 !text-zinc-900 font-semibold" 
             [routerLinkActiveOptions]="{exact: true}" 
             (click)="closeSidebarOnMobile()"
             class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
            <i class="ph ph-trophy text-lg"></i>
            <span>Classement</span>
          </a>
        </nav>

        <!-- Déconnexion -->
        <div class="p-4 border-t border-zinc-100">
          <button (click)="logout(); closeSidebarOnMobile()" 
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-red-50 hover:text-red-600 transition-colors">
            <i class="ph ph-sign-out text-lg"></i>
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <!-- Mobile Header -->
        <header class="md:hidden flex items-center justify-between p-4 bg-white border-b border-zinc-200 z-30">
            <app-logo [size]="32" [showText]="true"></app-logo>
            <button (click)="toggleSidebar()" class="p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">
                <i class="ph ph-list text-2xl"></i>
            </button>
        </header>

        <main class="flex-1 p-8 overflow-y-auto min-h-screen">
          <div class="max-w-7xl mx-auto">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [
    `
    :host { display: block; height: 100vh; }
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
export class TitulaireLayoutComponent implements OnInit, OnDestroy {
  userNom = '';
  sidebarOpen: boolean = false;
  private destroy$ = new Subject<void>();

  constructor(private router: Router) { }

  @HostListener('window:resize', ['$event'])
  onWindowResize() {
    if (window.innerWidth >= 768) {
      this.sidebarOpen = false;
      document.body.style.overflow = '';
    }
  }

  ngOnInit() {
    const token = sessionStorage.getItem('token');
    const userStr = sessionStorage.getItem('user');

    if (!token || !userStr) {
      this.router.navigate(['/']);
      return;
    }

    try {
      const user = JSON.parse(userStr);
      this.userNom = `${user.nom} ${user.prenom}`;
    } catch (e) {
      this.router.navigate(['/']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('school_token');
    this.router.navigate(['/']);
  }
}