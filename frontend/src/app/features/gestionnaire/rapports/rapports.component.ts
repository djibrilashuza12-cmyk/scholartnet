import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { bbFadeScaleIn } from '../../../animations/bb-ui.animations';
import { Subject, takeUntil, finalize, timeout } from 'rxjs';

@Component({
    selector: 'app-rapports',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule],
    animations: [bbFadeScaleIn],
    template: `
        <div class="space-y-6 animate-fade-in">
            <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-chart-line-up text-brand-600"></i> Rapports financiers
                    </h2>
                    <p class="text-zinc-500 text-sm mt-1">État de caisse journalier et mensuel</p>
                </div>
            </header>

            <!-- Onglets -->
            <div class="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg w-fit">
                <button class="px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2" 
                        [class]="activeTab === 'journalier' ? 'bg-white text-brand-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'"
                        (click)="activeTab = 'journalier'; loadRapportJournalier()">
                    <i class="ph ph-calendar"></i> Journalier
                </button>
                <button class="px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2" 
                        [class]="activeTab === 'mensuel' ? 'bg-white text-brand-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'"
                        (click)="activeTab = 'mensuel'; loadRapportMensuel()">
                    <i class="ph ph-calendar-blank"></i> Mensuel
                </button>
            </div>

            <!-- RAPPORT JOURNALIER -->
            <div *ngIf="activeTab === 'journalier'" class="space-y-6" [@bbFadeScaleIn]>
                <div class="saas-card">
                    <div class="flex flex-wrap gap-4 items-end">
                        <div class="flex-1 min-w-[200px]">
                            <label class="saas-label">Sélectionner une date</label>
                            <input class="saas-input" type="date" [(ngModel)]="journalierDate" (change)="loadRapportJournalier()" [disabled]="isLoading" />
                        </div>
                        <button class="saas-btn-secondary" (click)="loadRapportJournalier()" [disabled]="isLoading">
                            <i class="ph ph-arrows-clockwise mr-2"></i> Actualiser
                        </button>
                    </div>
                </div>

                <div *ngIf="rapportJournalierLoading" class="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <div class="sc-spin-small mb-3"></div>
                    <p>Calcul des statistiques journalières...</p>
                </div>

                <div *ngIf="!rapportJournalierLoading && rapportJournalier" class="space-y-6">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div class="saas-card flex flex-col items-center justify-center text-center p-8">
                            <div class="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                                <i class="ph ph-money text-2xl"></i>
                            </div>
                            <div class="text-sm font-medium text-zinc-500 mb-1">Total encaissé</div>
                            <div class="text-3xl font-bold text-emerald-600">{{ rapportJournalier.total | number:'1.0-2' }} $</div>
                        </div>
                        <div class="saas-card flex flex-col items-center justify-center text-center p-8">
                            <div class="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 mb-4">
                                <i class="ph ph-receipt text-2xl"></i>
                            </div>
                            <div class="text-sm font-medium text-zinc-500 mb-1">Nombre de paiements</div>
                            <div class="text-3xl font-bold text-zinc-900">{{ rapportJournalier.nb_paiements }}</div>
                        </div>
                        <div class="saas-card flex flex-col items-center justify-center text-center p-8">
                            <div class="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-600 mb-4">
                                <i class="ph ph-calendar-event text-2xl"></i>
                            </div>
                            <div class="text-sm font-medium text-zinc-500 mb-1">Date du rapport</div>
                            <div class="text-2xl font-bold text-zinc-900">{{ rapportJournalier.date | date:'dd MMMM yyyy' }}</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <!-- Par mode de paiement -->
                        <div class="saas-card lg:col-span-1">
                            <h3 class="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                                <i class="ph ph-credit-card text-brand-600"></i> Par mode
                            </h3>
                            <div class="space-y-4">
                                <div *ngFor="let mode of rapportJournalier.par_mode_paiement" class="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                                    <div class="flex flex-col">
                                        <span class="font-bold text-zinc-900">{{ mode.mode_paiement }}</span>
                                        <span class="text-xs text-zinc-500">{{ mode.count }} paiement(s)</span>
                                    </div>
                                    <span class="font-bold text-emerald-600">{{ mode.total | number:'1.0-2' }} $</span>
                                </div>
                            </div>
                        </div>

                        <!-- Liste des paiements -->
                        <div class="saas-card lg:col-span-2">
                            <h3 class="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                                <i class="ph ph-list-bullets text-brand-600"></i> Détail des paiements
                            </h3>
                            <div class="saas-table-container">
                                <div class="saas-table-scroll max-h-[400px]">
                                    <table class="saas-table">
                                        <thead>
                                            <tr>
                                                <th>Reçu</th>
                                                <th>Élève</th>
                                                <th>Type</th>
                                                <th class="text-right">Montant</th>
                                                <th>Mode</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr *ngFor="let p of rapportJournalier.paiements">
                                                <td class="font-mono text-xs">{{ p.numero_recu }}</td>
                                                <td>
                                                    <div class="flex flex-col">
                                                        <span class="font-medium text-zinc-900">{{ p.eleve_nom }} {{ p.eleve_prenom }}</span>
                                                        <span class="text-xs text-zinc-500">{{ p.classe_nom || '-' }}</span>
                                                    </div>
                                                </td>
                                                <td class="text-xs">{{ p.type_frais }}</td>
                                                <td class="text-right font-bold text-emerald-600">{{ p.montant_paye | number:'1.0-2' }} $</td>
                                                <td>{{ p.mode_paiement }}</td>
                                            </tr>
                                            <tr *ngIf="rapportJournalier.paiements?.length === 0">
                                                <td colspan="5" class="text-center py-8 text-zinc-500">Aucun paiement ce jour.</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- RAPPORT MENSUEL -->
            <div *ngIf="activeTab === 'mensuel'" class="space-y-6" [@bbFadeScaleIn]>
                <div class="saas-card">
                    <div class="flex flex-wrap gap-4 items-end">
                        <div class="flex-1 min-w-[200px]">
                            <label class="saas-label">Sélectionner un mois</label>
                            <input class="saas-input" type="month" [(ngModel)]="mensuelMois" (change)="loadRapportMensuel()" [disabled]="isLoading" />
                        </div>
                        <button class="saas-btn-secondary" (click)="loadRapportMensuel()" [disabled]="isLoading">
                            <i class="ph ph-arrows-clockwise mr-2"></i> Actualiser
                        </button>
                    </div>
                </div>

                <div *ngIf="rapportMensuelLoading" class="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <div class="sc-spin-small mb-3"></div>
                    <p>Calcul des statistiques mensuelles...</p>
                </div>

                <div *ngIf="!rapportMensuelLoading && rapportMensuel" class="space-y-6">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div class="saas-card flex flex-col items-center justify-center text-center p-8">
                            <div class="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                                <i class="ph ph-bank text-2xl"></i>
                            </div>
                            <div class="text-sm font-medium text-zinc-500 mb-1">Total encaissé</div>
                            <div class="text-3xl font-bold text-emerald-600">{{ rapportMensuel.total | number:'1.0-2' }} $</div>
                        </div>
                        <div class="saas-card flex flex-col items-center justify-center text-center p-8">
                            <div class="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 mb-4">
                                <i class="ph ph-receipt text-2xl"></i>
                            </div>
                            <div class="text-sm font-medium text-zinc-500 mb-1">Nombre de paiements</div>
                            <div class="text-3xl font-bold text-zinc-900">{{ rapportMensuel.nb_paiements }}</div>
                        </div>
                        <div class="saas-card flex flex-col items-center justify-center text-center p-8">
                            <div class="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-600 mb-4">
                                <i class="ph ph-calendar-blank text-2xl"></i>
                            </div>
                            <div class="text-sm font-medium text-zinc-500 mb-1">Période</div>
                            <div class="text-2xl font-bold text-zinc-900">{{ rapportMensuel.mois }}</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <!-- Évolution journalière -->
                        <div class="saas-card">
                            <h3 class="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                                <i class="ph ph-chart-line text-brand-600"></i> Évolution journalière
                            </h3>
                            <div class="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                                <div *ngFor="let jour of rapportMensuel.paiements_par_jour" class="flex justify-between items-center p-3 bg-zinc-50 rounded-lg">
                                    <div class="flex flex-col">
                                        <span class="text-sm font-bold text-zinc-900">{{ jour.date | date:'dd/MM/yyyy' }}</span>
                                        <span class="text-[10px] text-zinc-500 uppercase">{{ jour.nb_paiements }} paiements</span>
                                    </div>
                                    <span class="font-bold text-emerald-600">{{ jour.total | number:'1.0-2' }} $</span>
                                </div>
                            </div>
                        </div>

                        <!-- Par type de frais -->
                        <div class="saas-card">
                            <h3 class="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                                <i class="ph ph-tag text-brand-600"></i> Par type de frais
                            </h3>
                            <div class="space-y-2">
                                <div *ngFor="let f of rapportMensuel.par_frais" class="flex justify-between items-center p-3 bg-zinc-50 rounded-lg">
                                    <div class="flex flex-col">
                                        <span class="text-sm font-bold text-zinc-900">{{ f.nom }}</span>
                                        <span class="text-[10px] text-zinc-500 uppercase">{{ f.nb_paiements }} paiements</span>
                                    </div>
                                    <span class="font-bold text-emerald-600">{{ f.total | number:'1.0-2' }} $</span>
                                </div>
                            </div>
                        </div>

                        <!-- Par classe -->
                        <div class="saas-card">
                            <h3 class="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                                <i class="ph ph-users text-brand-600"></i> Par classe
                            </h3>
                            <div class="space-y-2">
                                <div *ngFor="let c of rapportMensuel.par_classe" class="flex justify-between items-center p-3 bg-zinc-50 rounded-lg">
                                    <div class="flex flex-col">
                                        <span class="text-sm font-bold text-zinc-900">{{ c.classe_nom }}</span>
                                        <span class="text-[10px] text-zinc-500 uppercase">{{ c.nb_paiements }} paiements</span>
                                    </div>
                                    <span class="font-bold text-emerald-600">{{ c.total | number:'1.0-2' }} $</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .sc-spin-small { width: 24px; height: 24px; border-radius: 9999px; border: 2px solid #e4e4e7; border-top-color: #4f46e5; animation: sc-spin 0.9s linear infinite; }
        @keyframes sc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `]
})
export class RapportsComponent implements OnInit, OnDestroy {
    private API_BASE = 'http://207.180.205.248:3007';
    private destroy$ = new Subject<void>();

    isLoading = false;
    activeTab: 'journalier' | 'mensuel' = 'journalier';

    // Journalier
    journalierDate = new Date().toISOString().split('T')[0];
    rapportJournalierLoading = false;
    rapportJournalier: any = null;

    // Mensuel
    mensuelMois = new Date().toISOString().slice(0, 7);
    rapportMensuelLoading = false;
    rapportMensuel: any = null;

    constructor(private http: HttpClient, private cdr: ChangeDetectorRef) { }

    ngOnInit(): void {
        this.loadRapportJournalier();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private authHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    }

    loadRapportJournalier(): void {
        this.rapportJournalierLoading = true;
        this.http.get(`${this.API_BASE}/api/gestionnaire/rapports/journalier?date=${this.journalierDate}`,
            { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.rapportJournalierLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    this.rapportJournalier = res;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur rapport journalier:', err);
                    this.cdr.detectChanges();
                }
            });
    }

    loadRapportMensuel(): void {
        this.rapportMensuelLoading = true;
        this.http.get(`${this.API_BASE}/api/gestionnaire/rapports/mensuel?mois=${this.mensuelMois}`,
            { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.rapportMensuelLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    this.rapportMensuel = res;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur rapport mensuel:', err);
                    this.cdr.detectChanges();
                }
            });
    }
}