import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-titulaire-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6 animate-fade-in">
      <header class="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <i class="ph ph-squares-four text-brand-600"></i> Dashboard Titulaire
          </h1>
          <p class="text-zinc-500 text-sm mt-1">Gestion des classes, notes et évaluations</p>
        </div>
        <button class="saas-btn-secondary" (click)="chargerDonnees()" [disabled]="isLoading">
          <i class="ph ph-arrows-clockwise mr-1.5" [class.animate-spin]="isLoading || statsLoading || classesLoading"></i>
          Actualiser
        </button>
      </header>

      <!-- Statistiques -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="saas-card p-5 flex flex-col hover:border-zinc-300 transition-colors">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <i class="ph ph-books text-xl"></i>
            </div>
            <h3 class="text-zinc-500 text-sm font-medium">Classes</h3>
          </div>
          <div class="text-3xl font-bold text-zinc-900 mt-2" *ngIf="!statsLoading">{{ stats.totalClasses || 0 }}</div>
          <div class="text-3xl font-bold text-zinc-300 animate-pulse mt-2" *ngIf="statsLoading">...</div>
        </div>
        <div class="saas-card p-5 flex flex-col hover:border-zinc-300 transition-colors">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <i class="ph ph-users text-xl"></i>
            </div>
            <h3 class="text-zinc-500 text-sm font-medium">Élèves</h3>
          </div>
          <div class="text-3xl font-bold text-zinc-900 mt-2" *ngIf="!statsLoading">{{ stats.totalEleves || 0 }}</div>
          <div class="text-3xl font-bold text-zinc-300 animate-pulse mt-2" *ngIf="statsLoading">...</div>
        </div>
        <div class="saas-card p-5 flex flex-col hover:border-zinc-300 transition-colors">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <i class="ph ph-calendar-blank text-xl"></i>
            </div>
            <h3 class="text-zinc-500 text-sm font-medium">Périodes actives</h3>
          </div>
          <div class="text-3xl font-bold text-zinc-900 mt-2" *ngIf="!statsLoading">{{ stats.totalPeriodes || 0 }}</div>
          <div class="text-3xl font-bold text-zinc-300 animate-pulse mt-2" *ngIf="statsLoading">...</div>
        </div>
      </div>

      <!-- Liste des classes -->
      <div class="saas-card overflow-hidden">
        <div class="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <i class="ph ph-chalkboard-teacher text-brand-600"></i> Mes classes assignées
            </h3>
        </div>
        
        <div class="p-6">
            <div *ngIf="classesLoading" class="flex flex-col items-center justify-center py-12">
                <i class="ph ph-spinner-gap text-3xl text-zinc-400 animate-spin mb-3"></i>
                <p class="text-zinc-500">Chargement de vos classes...</p>
            </div>
            <div *ngIf="!classesLoading && classes.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                    <i class="ph ph-folder-open text-2xl text-zinc-400"></i>
                </div>
                <p class="text-zinc-900 font-medium">Aucune classe assignée</p>
                <p class="text-zinc-500 text-sm mt-1">Vous n'avez pas encore de classes assignées pour l'année en cours.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" *ngIf="!classesLoading && classes.length > 0">
            <div *ngFor="let classe of classes" class="border border-zinc-200 rounded-xl p-5 hover:border-brand-300 hover:shadow-soft transition-all bg-white group relative overflow-hidden">
                <div class="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-bl-full -mr-12 -mt-12 transition-transform group-hover:scale-110 pointer-events-none"></div>
                
                <div class="flex items-start justify-between relative z-10 mb-4">
                <div>
                    <h4 class="font-bold text-lg text-zinc-900">{{ getClasseDisplay(classe) }}</h4>
                    <span class="inline-flex items-center gap-1.5 mt-1.5 text-xs font-medium text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-md">
                        <i class="ph ph-users"></i> {{ classe.effectif || 0 }} élèves
                    </span>
                </div>
                <div class="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                    <i class="ph ph-chalkboard text-lg"></i>
                </div>
                </div>

                <div class="grid grid-cols-2 gap-2 relative z-10">
                <a [routerLink]="['/titulaire/notes']" [queryParams]="{classe: classe.id}" class="inline-flex items-center justify-center gap-1.5 text-xs font-medium bg-zinc-50 text-zinc-700 hover:bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-2 transition-colors">
                    <i class="ph ph-exam text-sm text-zinc-400"></i> Notes
                </a>
                <a [routerLink]="['/titulaire/presences']" [queryParams]="{classe: classe.id}" class="inline-flex items-center justify-center gap-1.5 text-xs font-medium bg-zinc-50 text-zinc-700 hover:bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-2 transition-colors">
                    <i class="ph ph-check-square text-sm text-zinc-400"></i> Présences
                </a>
                <a [routerLink]="['/titulaire/bulletins']" [queryParams]="{classe: classe.id}" class="inline-flex items-center justify-center gap-1.5 text-xs font-medium bg-zinc-50 text-zinc-700 hover:bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-2 transition-colors">
                    <i class="ph ph-file-text text-sm text-zinc-400"></i> Bulletins
                </a>
                <a [routerLink]="['/titulaire/classement']" [queryParams]="{classe: classe.id}" class="inline-flex items-center justify-center gap-1.5 text-xs font-medium bg-zinc-50 text-zinc-700 hover:bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-2 transition-colors">
                    <i class="ph ph-trophy text-sm text-zinc-400"></i> Classement
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
  `]
})
export class DashboardComponent implements OnInit {
  private API_BASE = 'http://207.180.205.248:3007';

  isLoading = false;
  statsLoading = true;
  classesLoading = true;

  stats: any = { totalClasses: 0, totalEleves: 0, totalPeriodes: 0 };
  classes: any[] = [];

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.chargerDonnees();
  }

  private authHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('token') || '';
    return new HttpHeaders().set('Authorization', 'Bearer ' + token);
  }

  chargerDonnees() {
    this.chargerStats();
    this.chargerClasses();
  }

  chargerStats() {
    this.statsLoading = true;
    this.http.get(`${this.API_BASE}/api/titulaire/dashboard`, { headers: this.authHeaders() })
      .pipe(timeout(10000), finalize(() => { this.statsLoading = false; }))
      .subscribe({
        next: (res: any) => {
          this.stats = {
            totalClasses: res.totalClasses || 0,
            totalEleves: res.totalEleves || 0,
            totalPeriodes: 0
          };
        },
        error: (err) => {
          console.error('Erreur chargement stats:', err);
        }
      });
  }

  chargerClasses() {
    this.classesLoading = true;
    this.http.get(`${this.API_BASE}/api/titulaire/classes`, { headers: this.authHeaders() })
      .pipe(timeout(10000), finalize(() => { this.classesLoading = false; }))
      .subscribe({
        next: (res: any) => {
          this.classes = res.results || [];
        },
        error: (err) => {
          console.error('Erreur chargement classes:', err);
        }
      });
  }

  getClasseDisplay(classe: any): string {
    let display = classe.nom || '';
    if (classe.section) display += ` ${classe.section}`;
    if (classe.option_classe) display += `/${classe.option_classe}`;
    return display;
  }
}