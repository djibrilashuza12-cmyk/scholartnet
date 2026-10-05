// periodes.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { bbFadeScaleIn } from '../../../animations/bb-ui.animations';
import { Subject, takeUntil, finalize, timeout } from 'rxjs';

interface Periode {
    id: number;
    nom: string;
    date_debut: string;
    date_fin: string;
    ordre: number;
    est_active: boolean;
}

@Component({
    selector: 'app-periodes',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule],
    animations: [bbFadeScaleIn],
    template: `
        <div class="space-y-6 animate-fade-in">
            <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-calendar text-brand-600"></i> Périodes scolaires
                    </h2>
                    <p class="text-zinc-500 text-sm mt-1">Configuration des périodes pour bulletins et frais</p>
                </div>
                <button class="saas-btn-primary" (click)="openCreatePeriodeModal()" [disabled]="isLoading">
                    <i class="ph ph-plus mr-2"></i> Nouvelle période
                </button>
            </header>

            <div class="saas-card">
                <div *ngIf="periodesLoading" class="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <div class="sc-spin-small mb-3"></div>
                    <p>Chargement des périodes...</p>
                </div>

                <div class="saas-table-container" *ngIf="!periodesLoading">
                    <div class="saas-table-scroll">
                        <table class="saas-table">
                            <thead>
                                <tr>
                                    <th>Période</th>
                                    <th>Dates</th>
                                    <th>Ordre</th>
                                    <th>Statut</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let periode of periodesResults">
                                    <td>
                                        <span class="font-bold text-zinc-900">{{ periode.nom }}</span>
                                    </td>
                                    <td>
                                        <div class="flex items-center gap-2 text-zinc-500 text-sm">
                                            <i class="ph ph-calendar-blank"></i>
                                            {{ periode.date_debut | date:'dd/MM/yyyy' }} 
                                            <i class="ph ph-arrow-right"></i> 
                                            {{ periode.date_fin | date:'dd/MM/yyyy' }}
                                        </div>
                                    </td>
                                    <td>
                                        <span class="text-zinc-500">#{{ periode.ordre }}</span>
                                    </td>
                                    <td>
                                        <span *ngIf="periode.est_active" class="saas-badge-success flex items-center gap-1 w-fit">
                                            <i class="ph ph-check-circle"></i> Active
                                        </span>
                                        <span *ngIf="!periode.est_active" class="bg-zinc-100 text-zinc-500 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 w-fit">
                                            <i class="ph ph-minus-circle"></i> Inactive
                                        </span>
                                    </td>
                                    <td class="text-right">
                                        <div class="flex justify-end gap-2">
                                            <button class="saas-btn-secondary py-1 px-3 text-xs" (click)="togglePeriodeActive(periode)" [disabled]="isLoading">
                                                <i class="ph" [class]="periode.est_active ? 'ph-speaker-slash' : 'ph-speaker-high'"></i>
                                                {{ periode.est_active ? ' Désactiver' : ' Activer' }}
                                            </button>
                                            <button class="saas-btn-secondary p-2" (click)="openEditPeriodeModal(periode)" [disabled]="isLoading">
                                                <i class="ph ph-pencil-simple"></i>
                                            </button>
                                            <button class="saas-btn-secondary p-2 text-red-600 hover:bg-red-50" (click)="deletePeriode(periode.id)" [disabled]="isLoading">
                                                <i class="ph ph-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                <tr *ngIf="!periodesLoading && periodesResults.length === 0">
                                    <td colspan="5" class="text-center py-12 text-zinc-500">Aucune période configurée.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODALE: Créer/Éditer Période -->
        <div *ngIf="periodeModalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4" (click)="closeModal($event, 'periodeModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"></div>
            <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md" [@bbFadeScaleIn] (click)="$event.stopPropagation()">
                <div class="p-6 border-b border-zinc-100">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-bold text-zinc-900">{{ periodeEditMode ? 'Modifier' : 'Créer' }} une période</h3>
                        <button class="text-zinc-400 hover:text-zinc-600 transition-colors" (click)="periodeModalOpen = false">
                            <i class="ph ph-x text-2xl"></i>
                        </button>
                    </div>
                </div>

                <div class="p-6 space-y-4">
                    <div>
                        <label class="saas-label">Nom de la période *</label>
                        <input class="saas-input" type="text" [(ngModel)]="periodeForm.nom" placeholder="Ex: 1ère Période" [disabled]="isLoading" />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="saas-label">Date début *</label>
                            <input class="saas-input" type="date" [value]="periodeForm.date_debut | date:'yyyy-MM-dd'" (input)="periodeForm.date_debut = $any($event.target).value" [disabled]="isLoading" />
                        </div>
                        <div>
                            <label class="saas-label">Date fin *</label>
                            <input class="saas-input" type="date" [value]="periodeForm.date_fin | date:'yyyy-MM-dd'" (input)="periodeForm.date_fin = $any($event.target).value" [disabled]="isLoading" />
                        </div>
                    </div>
                    <div>
                        <label class="saas-label">Ordre d'affichage</label>
                        <input class="saas-input" type="number" [(ngModel)]="periodeForm.ordre" [disabled]="isLoading" />
                    </div>
                    <div class="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                        <input type="checkbox" id="active-checkbox" class="w-4 h-4 text-brand-600 rounded border-zinc-300 focus:ring-brand-500" [(ngModel)]="periodeForm.est_active" [disabled]="isLoading" />
                        <label for="active-checkbox" class="text-sm font-medium text-zinc-700 cursor-pointer">Période active (visible pour les enseignants)</label>
                    </div>

                    <div *ngIf="periodeFormError" class="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-center gap-2">
                        <i class="ph ph-warning-circle"></i>
                        {{ periodeFormError }}
                    </div>
                </div>

                <div class="p-6 border-t border-zinc-100 flex gap-3">
                    <button class="saas-btn-secondary flex-1" (click)="periodeModalOpen = false" [disabled]="periodeSubmitting || isLoading">Annuler</button>
                    <button class="saas-btn-primary flex-1" (click)="submitPeriodeForm()" [disabled]="periodeSubmitting || isLoading">
                        <span *ngIf="!periodeSubmitting">{{ periodeEditMode ? 'Mettre à jour' : 'Créer' }}</span>
                        <span *ngIf="periodeSubmitting" class="flex items-center justify-center gap-2">
                            <span class="sc-spin-small-white inline-block"></span> {{ periodeEditMode ? 'Mise à jour...' : 'Création...' }}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .sc-spin-small { width: 24px; height: 24px; border-radius: 9999px; border: 2px solid #e4e4e7; border-top-color: #4f46e5; animation: sc-spin 0.9s linear infinite; }
        .sc-spin-small-white { width: 18px; height: 18px; border-radius: 9999px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; animation: sc-spin 0.9s linear infinite; }
        @keyframes sc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `]
})
export class PeriodesComponent implements OnInit, OnDestroy {
    private API_BASE = 'http://207.180.205.248:3007';
    private destroy$ = new Subject<void>();

    isLoading = false;
    periodesLoading = false;
    periodesResults: Periode[] = [];

    periodeModalOpen = false;
    periodeEditMode = false;
    periodeEditId: number | null = null;
    periodeSubmitting = false;
    periodeFormError = '';
    periodeForm = {
        nom: '',
        date_debut: '',
        date_fin: '',
        ordre: 0,
        est_active: true
    };

    constructor(private http: HttpClient, private cdr: ChangeDetectorRef) { }

    ngOnInit(): void {
        this.loadPeriodes();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private authHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    }

    loadPeriodes(): void {
        this.periodesLoading = true;
        this.http.get(`${this.API_BASE}/api/gestionnaire/periodes`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => { this.periodesLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    this.periodesResults = res.results || [];
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur chargement périodes:', err);
                    this.cdr.detectChanges();
                }
            });
    }

    openCreatePeriodeModal(): void {
        this.periodeEditMode = false;
        this.periodeEditId = null;
        const today = new Date().toISOString().split('T')[0];
        this.periodeForm = {
            nom: '',
            date_debut: today,
            date_fin: today,
            ordre: this.periodesResults.length + 1,
            est_active: true
        };
        this.periodeFormError = '';
        this.periodeModalOpen = true;
        this.cdr.detectChanges();
    }

    openEditPeriodeModal(periode: Periode): void {
        this.periodeEditMode = true;
        this.periodeEditId = periode.id;
        // Garder les dates telles quelles, le pipe les formatera dans le template
        this.periodeForm = {
            nom: periode.nom,
            date_debut: periode.date_debut,
            date_fin: periode.date_fin,
            ordre: periode.ordre || 0,
            est_active: periode.est_active
        };
        this.periodeFormError = '';
        this.periodeModalOpen = true;
        this.cdr.detectChanges();
    }

    submitPeriodeForm(): void {
        this.periodeFormError = '';
        if (!this.periodeForm.nom.trim()) {
            this.periodeFormError = 'Le nom est obligatoire.';
            this.cdr.detectChanges();
            return;
        }
        if (!this.periodeForm.date_debut || !this.periodeForm.date_fin) {
            this.periodeFormError = 'Les dates sont obligatoires.';
            this.cdr.detectChanges();
            return;
        }

        this.periodeSubmitting = true;
        this.isLoading = true;

        let url = `${this.API_BASE}/api/gestionnaire/periodes`;
        let method = 'POST';
        if (this.periodeEditMode && this.periodeEditId) {
            url = `${this.API_BASE}/api/gestionnaire/periodes/${this.periodeEditId}`;
            method = 'PUT';
        }

        this.http.request(method, url, { body: this.periodeForm, headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.periodeSubmitting = false; this.isLoading = false; }))
            .subscribe({
                next: () => {
                    this.periodeModalOpen = false;
                    this.loadPeriodes();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.periodeFormError = err?.error?.message || 'Erreur lors de l\'enregistrement.';
                    this.cdr.detectChanges();
                }
            });
    }

    togglePeriodeActive(periode: Periode): void {
        this.isLoading = true;
        const payload = { ...periode, est_active: !periode.est_active };
        this.http.put(`${this.API_BASE}/api/gestionnaire/periodes/${periode.id}`, payload, { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.isLoading = false; }))
            .subscribe({
                next: () => {
                    this.loadPeriodes();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    alert(err?.error?.message || 'Erreur lors de la modification.');
                    this.cdr.detectChanges();
                }
            });
    }

    deletePeriode(id: number): void {
        if (!confirm('Voulez-vous vraiment supprimer cette période ?')) return;
        this.isLoading = true;
        this.http.delete(`${this.API_BASE}/api/gestionnaire/periodes/${id}`, { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.isLoading = false; }))
            .subscribe({
                next: () => {
                    this.loadPeriodes();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    alert(err?.error?.message || 'Erreur lors de la suppression.');
                    this.cdr.detectChanges();
                }
            });
    }

    closeModal(event: MouseEvent, modalKey: string): void {
        const target = event.target as HTMLElement;
        if (target.classList.contains('bb-backdrop') || target.classList.contains('fixed')) {
            (this as any)[modalKey] = false;
            this.cdr.detectChanges();
        }
    }
}