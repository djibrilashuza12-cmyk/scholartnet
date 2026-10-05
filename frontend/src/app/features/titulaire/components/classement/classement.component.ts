import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-classement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 animate-fade-in">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <i class="ph ph-trophy text-brand-600"></i> Classement de la Classe
          </h2>
          <p class="text-zinc-500 text-sm mt-1">Classement automatique des élèves par pourcentage</p>
        </div>
        <button class="saas-btn-secondary" (click)="chargerClasses()" [disabled]="isLoading">
          <i class="ph ph-arrows-clockwise mr-1.5" [class.animate-spin]="isLoading || classementLoading"></i>
          Actualiser
        </button>
      </div>

      <!-- Sélection de la classe et période -->
      <div class="saas-card p-5 bg-gradient-to-br from-white to-zinc-50/50">
        <div class="flex flex-col md:flex-row gap-5 items-end">
          <div class="w-full md:flex-1">
            <label class="saas-label">Sélectionner une classe</label>
            <div class="relative">
              <i class="ph ph-books absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
              <select class="saas-input pl-10" [(ngModel)]="classeSelectionnee" (change)="onClasseChange()">
                <option [ngValue]="null">--- Choisir ---</option>
                <option *ngFor="let c of classes" [ngValue]="c.id">{{ getClasseDisplay(c) }}</option>
              </select>
            </div>
          </div>
          <div class="w-full md:w-64">
            <label class="saas-label">Période d'évaluation</label>
            <div class="relative">
              <i class="ph ph-calendar-blank absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
              <select class="saas-input pl-10" [(ngModel)]="periodeSelectionnee" (change)="chargerClassement()" [disabled]="!classeSelectionnee">
                <option [ngValue]="null" disabled>Sélectionner une période</option>
                <option *ngFor="let p of periodes" [ngValue]="p.nom">{{ p.nom }}</option>
              </select>
            </div>
            <p *ngIf="classeSelectionnee && !periodeSelectionnee" class="text-xs text-red-500 font-medium flex items-center gap-1 mt-1.5">
                <i class="ph ph-warning-circle"></i> Veuillez sélectionner une période
            </p>
          </div>
        </div>
      </div>

      <!-- Classement -->
      <div *ngIf="classeSelectionnee" class="saas-card overflow-hidden">
        
        <div class="px-6 py-4 border-b border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-50/50">
          <h3 class="font-bold text-zinc-900 flex items-center gap-2">
            <i class="ph ph-medal text-brand-600 text-lg"></i> Résultats
          </h3>
          <span class="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 px-3 py-1.5 rounded-lg shadow-sm">
            <i class="ph ph-users-three"></i> Total: {{ classement.length }} élèves
          </span>
        </div>

        <div class="p-0">
            <div *ngIf="classementLoading" class="flex flex-col items-center justify-center py-12">
                <i class="ph ph-spinner-gap text-3xl text-zinc-400 animate-spin mb-3"></i>
                <p class="text-zinc-500 font-medium">Calcul du classement...</p>
            </div>

            <div *ngIf="!classementLoading && classement.length === 0" class="text-center py-12 text-zinc-500 border-dashed border-zinc-300">
                <div class="mx-auto w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                    <i class="ph ph-chart-bar text-3xl text-zinc-400"></i>
                </div>
                <h3 class="text-lg font-semibold text-zinc-900 mb-1">Aucune donnée disponible</h3>
                <p class="text-sm">Les notes n'ont pas encore été saisies ou l'évaluation est en cours.</p>
            </div>

            <div class="saas-table-scroll" *ngIf="!classementLoading && classement.length > 0">
                <table class="saas-table">
                <thead>
                    <tr>
                    <th class="w-24 text-center">Rang</th>
                    <th class="w-32">Matricule</th>
                    <th>Identité de l'élève</th>
                    <th class="text-center">Points obtenus</th>
                    <th class="text-center w-24">Moyenne</th>
                    <th class="text-center w-32">Mention</th>
                    </tr>
                </thead>
                <tbody>
                    <tr *ngFor="let item of classement; let i = index" class="hover:bg-zinc-50/50 transition-colors"
                        [ngClass]="{
                            'bg-zinc-50/80': item.nonClasse,
                            'bg-amber-50/30': i === 0 && !item.nonClasse,
                            'bg-zinc-50/50': i === 1 && !item.nonClasse,
                            'bg-orange-50/30': i === 2 && !item.nonClasse
                        }">
                    <td class="text-center">
                        <ng-container *ngIf="!item.nonClasse; else nc">
                        <span class="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm"
                                [ngClass]="{
                                'bg-amber-100 text-amber-700': i === 0,
                                'bg-zinc-200 text-zinc-700': i === 1,
                                'bg-orange-100 text-orange-700': i === 2,
                                'bg-zinc-100 text-zinc-600': i > 2
                                }">
                            {{ item.position }}
                        </span>
                        </ng-container>
                        <ng-template #nc><span class="saas-badge-neutral text-[10px] uppercase">N/C</span></ng-template>
                    </td>
                    <td class="font-mono text-xs text-zinc-500">{{ item.matricule }}</td>
                    <td>
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-white border border-zinc-200 shadow-sm text-zinc-700">
                                {{ item.nom.charAt(0) }}{{ item.prenom.charAt(0) }}
                            </div>
                            <div class="font-medium text-zinc-900">{{ item.nom }} {{ item.prenom }}</div>
                        </div>
                    </td>
                    <td class="text-center">
                        <ng-container *ngIf="!item.nonClasse; else tiret">
                        <span class="font-bold text-zinc-900">{{ item.total_points_obtenus | number:'1.0-1' }}</span>
                        <span class="text-xs text-zinc-400">/{{ item.total_points_max }}</span>
                        </ng-container>
                        <ng-template #tiret><span class="text-zinc-400 italic text-sm">—</span></ng-template>
                    </td>
                    <td class="text-center font-bold">
                        <ng-container *ngIf="item.pourcentage !== null && !item.nonClasse; else pourcVide">
                        <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold w-16"
                                [class.bg-emerald-50]="item.pourcentage >= 50" [class.text-emerald-700]="item.pourcentage >= 50"
                                [class.bg-red-50]="item.pourcentage < 50" [class.text-red-700]="item.pourcentage < 50">
                            {{ item.pourcentage | number:'1.1-1' }}%
                        </span>
                        </ng-container>
                        <ng-template #pourcVide><span class="text-zinc-400 italic text-sm">—</span></ng-template>
                    </td>
                    <td class="text-center">
                        <ng-container *ngIf="!item.nonClasse; else mentionVide">
                        <span class="inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap"
                                [ngClass]="getMentionClass(item.pourcentage)">
                            {{ getMention(item.pourcentage) }}
                        </span>
                        </ng-container>
                        <ng-template #mentionVide><span class="text-zinc-400 italic text-sm">—</span></ng-template>
                    </td>
                    </tr>
                </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class ClassementComponent implements OnInit {
  private API_BASE = 'http://207.180.205.248:3007';

  isLoading = false;
  classementLoading = false;

  classes: any[] = [];
  periodes: any[] = [];
  classement: any[] = [];

  classeSelectionnee: number | null = null;
  periodeSelectionnee: string | null = null;

  constructor(private http: HttpClient, private route: ActivatedRoute) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['classe']) {
        this.classeSelectionnee = Number(params['classe']);
      }
    });
    this.chargerClasses();
  }

  private authHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('token') || '';
    return new HttpHeaders().set('Authorization', 'Bearer ' + token);
  }

  chargerClasses() {
    this.isLoading = true;
    this.http.get(`${this.API_BASE}/api/titulaire/classes`, { headers: this.authHeaders() })
      .pipe(timeout(10000), finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (res: any) => {
          this.classes = res.results || [];
          if (this.classeSelectionnee) {
            this.chargerPeriodes();
          }
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

  onClasseChange() {
    if (this.classeSelectionnee) {
      this.chargerPeriodes();
    } else {
      this.periodes = [];
      this.classement = [];
    }
  }

  chargerPeriodes() {
    this.http.get(`${this.API_BASE}/api/titulaire/classes/${this.classeSelectionnee}/periodes`, { headers: this.authHeaders() })
      .pipe(timeout(10000))
      .subscribe({
        next: (res: any) => {
          this.periodes = res.results || [];
        },
        error: (err) => {
          console.error('Erreur chargement périodes:', err);
        }
      });
  }

  chargerClassement() {
    if (!this.classeSelectionnee) return;

    this.classementLoading = true;
    let url = `${this.API_BASE}/api/titulaire/classes/${this.classeSelectionnee}/classement`;
    if (this.periodeSelectionnee) {
      url += `?periode=${encodeURIComponent(this.periodeSelectionnee)}`;
    }

    this.http.get(url, { headers: this.authHeaders() })
      .pipe(timeout(10000), finalize(() => { this.classementLoading = false; }))
      .subscribe({
        next: (res: any) => {
          this.classement = res.results || [];
        },
        error: (err) => {
          console.error('Erreur chargement classement:', err);
        }
      });
  }

  getMention(pourcentage: number): string {
    if (pourcentage >= 80) return 'Très Bien';
    if (pourcentage >= 70) return 'Bien';
    if (pourcentage >= 60) return 'Assez Bien';
    if (pourcentage >= 50) return 'Passable';
    return 'Insuffisant';
  }

  getMentionClass(pourcentage: number): string {
    if (pourcentage >= 80) return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    if (pourcentage >= 70) return 'bg-blue-100 text-blue-800 border border-blue-200';
    if (pourcentage >= 60) return 'bg-amber-100 text-amber-800 border border-amber-200';
    if (pourcentage >= 50) return 'bg-orange-100 text-orange-800 border border-orange-200';
    return 'bg-red-100 text-red-800 border border-red-200';
  }
}