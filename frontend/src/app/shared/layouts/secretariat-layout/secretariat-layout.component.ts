import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LogoComponent } from '../../logo/logo.component';

@Component({
    selector: 'app-secretariat-layout',
    standalone: true,
    imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LogoComponent],
    template: `
        <div class="min-h-screen bg-zinc-50">
            <!-- Mobile Header -->
            <header class="md:hidden flex items-center justify-between p-4 bg-white border-b border-zinc-200 sticky top-0 z-30">
                <app-logo [size]="32" [showText]="true"></app-logo>
                <button (click)="toggleMobileMenu()" class="p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">
                    <i class="ph ph-list text-2xl"></i>
                </button>
            </header>

            <!-- Mobile Menu -->
            <div *ngIf="mobileMenuOpen" 
                 class="md:hidden fixed inset-0 bg-black/50 z-40"
                 (click)="toggleMobileMenu()"></div>
            
            <div [class]="'md:hidden fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ' + 
                   (mobileMenuOpen ? 'translate-x-0' : '-translate-x-full')">
                <div class="p-4 border-b border-zinc-100 flex items-center justify-between">
                    <h2 class="font-bold text-zinc-900">Menu Secrétariat</h2>
                    <button (click)="toggleMobileMenu()" class="p-2 hover:bg-zinc-100 rounded-lg">
                        <i class="ph ph-x text-xl"></i>
                    </button>
                </div>
                <nav class="p-4 space-y-2">
                    <a routerLink="/secretariat/dashboard" 
                       routerLinkActive="bg-brand-50 text-brand-700 font-semibold"
                       (click)="closeMobileMenu()"
                       class="block px-4 py-3 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                        <i class="ph ph-squares-four mr-3"></i>Dashboard
                    </a>
                    <a routerLink="/secretariat/eleves" 
                       routerLinkActive="bg-brand-50 text-brand-700 font-semibold"
                       (click)="closeMobileMenu()"
                       class="block px-4 py-3 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                        <i class="ph ph-users mr-3"></i>Élèves
                    </a>
                    <a routerLink="/secretariat/classes" 
                       routerLinkActive="bg-brand-50 text-brand-700 font-semibold"
                       (click)="closeMobileMenu()"
                       class="block px-4 py-3 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                        <i class="ph ph-books mr-3"></i>Classes
                    </a>
                    <a routerLink="/secretariat/inscriptions" 
                       routerLinkActive="bg-brand-50 text-brand-700 font-semibold"
                       (click)="closeMobileMenu()"
                       class="block px-4 py-3 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                        <i class="ph ph-clipboard-text mr-3"></i>Inscriptions
                    </a>
                    <a routerLink="/secretariat/messages" 
                       routerLinkActive="bg-brand-50 text-brand-700 font-semibold"
                       (click)="closeMobileMenu()"
                       class="block px-4 py-3 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                        <i class="ph ph-whatsapp-logo mr-3 text-emerald-600"></i>WhatsApp
                    </a>
                    <hr class="my-4">
                    <button (click)="logout(); closeMobileMenu()" 
                            class="w-full text-left px-4 py-3 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors">
                        <i class="ph ph-sign-out mr-3"></i>Déconnexion
                    </button>
                </nav>
            </div>

            <!-- Main Content -->
            <main class="p-4 md:p-8 min-h-screen max-w-7xl mx-auto">
                <router-outlet></router-outlet>
            </main>
        </div>
    `,
    styles: [`
        :host { display: block; }
    `]
})
export class SecretariatLayoutComponent implements OnInit {
    mobileMenuOpen: boolean = false;

    constructor(private router: Router) { }

    @HostListener('window:resize', ['$event'])
    onWindowResize() {
        if (window.innerWidth >= 768) {
            this.mobileMenuOpen = false;
            document.body.style.overflow = '';
        }
    }

    ngOnInit(): void {
        const token = sessionStorage.getItem('token');
        const userStr = sessionStorage.getItem('user');

        if (!token || !userStr) {
            this.router.navigate(['/']);
            return;
        }

        try {
            JSON.parse(userStr);
        } catch (e) {
            this.router.navigate(['/']);
        }
    }

    toggleMobileMenu(): void {
        this.mobileMenuOpen = !this.mobileMenuOpen;
        if (this.mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    closeMobileMenu(): void {
        this.mobileMenuOpen = false;
        document.body.style.overflow = '';
    }

    logout(): void {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        localStorage.removeItem('school_token');
        this.router.navigate(['/']);
    }
}