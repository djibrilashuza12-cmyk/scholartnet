import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-presences',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="space-y-6 animate-fade-in">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <i class="ph ph-check-square text-brand-600"></i> Gestion des Présences
          </h2>
          <p class="text-zinc-500 text-sm mt-1">Marquer les présences et absences quotidiennes</p>
        </div>
        <button class="saas-btn-secondary" (click)="chargerClasses()" [disabled]="isLoading">
          <i class="ph ph-arrows-clockwise mr-1.5" [class.animate-spin]="isLoading || elevesLoading"></i>
          Actualiser
        </button>
      </div>

      <!-- Sélection de la classe et date -->
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
            <label class="saas-label">Date du jour</label>
            <div class="relative">
              <i class="ph ph-calendar-blank absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
              <input class="saas-input pl-10" type="date" [(ngModel)]="dateSelectionnee" (change)="chargerPresences()" />
            </div>
          </div>
        </div>
      </div>

      <!-- Liste des présences -->
      <div *ngIf="classeSelectionnee" class="saas-card overflow-hidden">
        
        <div class="px-6 py-4 border-b border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-50/50">
          <h3 class="font-bold text-zinc-900 flex items-center gap-2">
            <i class="ph ph-users-three text-brand-600 text-lg"></i> Élèves de la classe
          </h3>
          <div class="flex gap-2">
            <button class="saas-btn-secondary text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-sm" (click)="marquerTous('PRESENT')" [disabled]="isLoading || elevesLoading || eleves.length === 0">
              <i class="ph ph-check-circle mr-1.5"></i> Tous présents
            </button>
            <button class="saas-btn-secondary text-red-700 bg-red-50 border-red-200 hover:bg-red-100 text-sm" (click)="marquerTous('ABSENT')" [disabled]="isLoading || elevesLoading || eleves.length === 0">
              <i class="ph ph-x-circle mr-1.5"></i> Tous absents
            </button>
          </div>
        </div>

        <div class="p-0">
            <div *ngIf="elevesLoading" class="flex flex-col items-center justify-center py-12">
                <i class="ph ph-spinner-gap text-3xl text-zinc-400 animate-spin mb-3"></i>
                <p class="text-zinc-500 font-medium">Chargement des élèves...</p>
            </div>

            <div *ngIf="!elevesLoading && eleves.length === 0" class="text-center py-12 text-zinc-500 border-dashed border-zinc-300">
                <div class="mx-auto w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                    <i class="ph ph-users text-3xl text-zinc-400"></i>
                </div>
                <h3 class="text-lg font-semibold text-zinc-900 mb-1">Aucun élève trouvé</h3>
                <p class="text-sm">Il n'y a pas d'élèves inscrits dans cette classe pour le moment.</p>
            </div>

            <div class="saas-table-scroll" *ngIf="!elevesLoading && eleves.length > 0">
                <table class="saas-table">
                    <thead>
                        <tr>
                            <th class="w-32">Matricule</th>
                            <th>Identité de l'élève</th>
                            <th class="w-48">Statut du jour</th>
                            <th>Observation / Discipline</th>
                            <th class="w-32 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr *ngFor="let eleve of eleves" class="hover:bg-zinc-50/50 group transition-colors" [class.bg-red-50]="eleve.statut === 'ABSENT'">
                            <td class="font-mono text-xs text-zinc-500">{{ eleve.matricule }}</td>
                            <td>
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                        [ngClass]="{
                                            'bg-emerald-100 text-emerald-700': eleve.statut === 'PRESENT',
                                            'bg-red-100 text-red-700': eleve.statut === 'ABSENT',
                                            'bg-amber-100 text-amber-700': eleve.statut === 'JUSTIFIE'
                                        }">
                                        {{ eleve.nom.charAt(0) }}{{ eleve.prenom.charAt(0) }}
                                    </div>
                                    <div class="font-medium text-zinc-900">{{ eleve.nom }} {{ eleve.prenom }}</div>
                                </div>
                            </td>
                            <td>
                                <div class="relative">
                                    <select class="saas-input py-1.5 text-sm w-full font-medium" 
                                            [ngClass]="{
                                                'text-emerald-700 border-emerald-200 bg-emerald-50': eleve.statut === 'PRESENT',
                                                'text-red-700 border-red-200 bg-red-50': eleve.statut === 'ABSENT',
                                                'text-amber-700 border-amber-200 bg-amber-50': eleve.statut === 'JUSTIFIE'
                                            }"
                                            [(ngModel)]="eleve.statut" (change)="updatePresence(eleve)">
                                        <option value="PRESENT">✓ Présent</option>
                                        <option value="ABSENT">✕ Absent</option>
                                        <option value="JUSTIFIE">⚠ Justifié</option>
                                    </select>
                                </div>
                            </td>
                            <td>
                                <div class="relative">
                                    <i class="ph ph-chat-text absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
                                    <input class="saas-input py-1.5 text-sm pl-9" type="text" [(ngModel)]="eleve.observation"
                                        placeholder="Note optionnelle..." (blur)="updatePresence(eleve)" />
                                </div>
                            </td>
                            <td class="text-right">
                                <button class="saas-btn-secondary py-1.5 px-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity" 
                                        (click)="ajouterPresence(eleve)" [disabled]="isLoading">
                                    <i class="ph ph-floppy-disk mr-1 text-brand-600"></i> Sauver
                                </button>
                                <span class="text-emerald-500 text-xs font-medium ml-2 opacity-100 group-hover:opacity-0 transition-opacity flex items-center justify-end" *ngIf="eleve.presence_id">
                                    <i class="ph ph-check-circle"></i> 
                                </span>
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
export class PresencesComponent implements OnInit {
    private API_BASE = 'http://207.180.205.248:3007';

    isLoading = false;
    elevesLoading = false;

    classes: any[] = [];
    eleves: any[] = [];

    classeSelectionnee: number | null = null;
    dateSelectionnee: string = new Date().toISOString().split('T')[0];

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
                        this.chargerEleves();
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
            this.chargerEleves();
        }
    }

    chargerEleves() {
        if (!this.classeSelectionnee) return;

        this.elevesLoading = true;
        this.http.get(`${this.API_BASE}/api/titulaire/classes/${this.classeSelectionnee}/eleves`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => { this.elevesLoading = false; }))
            .subscribe({
                next: (res: any) => {
                    this.eleves = (res.results || []).map((e: any) => ({
                        ...e,
                        statut: 'PRESENT',
                        observation: '',
                        presence_id: null
                    }));
                    this.chargerPresences();
                },
                error: (err) => {
                    console.error('Erreur chargement élèves:', err);
                }
            });
    }

    chargerPresences() {
        if (!this.classeSelectionnee || !this.dateSelectionnee) return;

        for (const eleve of this.eleves) {
            this.http.get(
                `${this.API_BASE}/api/titulaire/eleves/${eleve.id}/presences`,
                { headers: this.authHeaders() }
            )
                .pipe(timeout(10000))
                .subscribe({
                    next: (res: any) => {
                        const presences = res.results || [];
                        const today = presences.find((p: any) =>
                            new Date(p.date_jour).toISOString().split('T')[0] === this.dateSelectionnee
                        );
                        if (today) {
                            eleve.statut = today.statut || 'PRESENT';
                            eleve.observation = today.observation_discipline || '';
                            eleve.presence_id = today.id;
                        } else {
                            eleve.statut = 'PRESENT';
                            eleve.observation = '';
                            eleve.presence_id = null;
                        }
                    },
                    error: (err) => {
                        console.error('Erreur chargement présences:', err);
                    }
                });
        }
    }

    ajouterPresence(eleve: any) {
        this.isLoading = true;

        const payload = {
            date_jour: this.dateSelectionnee,
            statut: eleve.statut || 'PRESENT',
            observation_discipline: eleve.observation || null
        };

        if (eleve.presence_id) {
            // Mise à jour
            this.http.put(
                `${this.API_BASE}/api/titulaire/presences/${eleve.presence_id}`,
                payload,
                { headers: this.authHeaders() }
            )
                .pipe(timeout(15000), finalize(() => { this.isLoading = false; }))
                .subscribe({
                    next: () => {
                        console.log('Présence mise à jour');
                    },
                    error: (err) => {
                        console.error('Erreur mise à jour présence:', err);
                    }
                });
        } else {
            // Création
            this.http.post(
                `${this.API_BASE}/api/titulaire/eleves/${eleve.id}/presences`,
                payload,
                { headers: this.authHeaders() }
            )
                .pipe(timeout(15000), finalize(() => { this.isLoading = false; }))
                .subscribe({
                    next: (res: any) => {
                        eleve.presence_id = res.id;
                        console.log('Présence enregistrée');
                    },
                    error: (err) => {
                        console.error('Erreur enregistrement présence:', err);
                    }
                });
        }
    }

    updatePresence(eleve: any) {
        if (eleve.presence_id) {
            this.ajouterPresence(eleve);
        }
    }

    marquerTous(statut: string) {
        if (!confirm(`Marquer tous les élèves comme ${statut === 'PRESENT' ? 'présents' : 'absents'} ?`)) return;

        for (const eleve of this.eleves) {
            eleve.statut = statut;
            this.ajouterPresence(eleve);
        }
    }
}