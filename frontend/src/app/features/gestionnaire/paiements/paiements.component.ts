import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize, timeout } from 'rxjs';

@Component({
    selector: 'app-paiements',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule, RouterLink],
    template: `
        <div class="space-y-6 animate-fade-in">
            <!-- En-tête -->
            <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-receipt text-brand-600"></i> Historique des Paiements
                    </h1>
                    <p class="text-zinc-500 text-sm mt-1">Consultez et gérez l'ensemble des transactions financières de l'établissement</p>
                </div>
                <div class="flex gap-2 w-full sm:w-auto">
                    <a routerLink="/gestionnaire/paiements/nouveau" class="saas-btn-primary w-full sm:w-auto">
                        <i class="ph ph-plus-circle mr-1.5 text-lg"></i> Nouveau paiement
                    </a>
                </div>
            </header>

            <!-- Filtres -->
            <div class="saas-card p-5 bg-gradient-to-br from-white to-zinc-50/50">
                <div class="flex flex-col md:flex-row gap-4 items-center">
                    <div class="relative w-full">
                        <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg"></i>
                        <input class="saas-input pl-10 py-2.5 w-full bg-white shadow-sm" type="text" [(ngModel)]="searchQuery" 
                               (keyup.enter)="onSearch()" placeholder="Rechercher par nom, matricule ou n° de reçu..." [disabled]="isLoading" />
                    </div>
                    <div class="flex gap-2 w-full md:w-auto shrink-0">
                        <button class="saas-btn-secondary w-full md:w-auto flex-1" (click)="onSearch()" [disabled]="isLoading">
                            Rechercher
                        </button>
                        <button class="saas-btn-secondary text-zinc-500 hover:text-zinc-700 w-10 md:w-auto shrink-0 justify-center" (click)="resetFilters()" [disabled]="isLoading" title="Effacer les filtres">
                            <i class="ph ph-x"></i>
                        </button>
                        <button class="saas-btn-secondary text-zinc-500 hover:text-zinc-700 w-10 md:w-auto shrink-0 justify-center" (click)="loadPaiements()" [disabled]="isLoading" title="Rafraîchir">
                            <i class="ph ph-arrows-clockwise" [class.animate-spin]="paiementsLoading"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tableau -->
            <div class="saas-card overflow-hidden">
                <div class="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
                    <h3 class="font-bold text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-list-numbers text-brand-600 text-lg"></i> Transactions enregistrées
                    </h3>
                    <span class="inline-flex items-center justify-center bg-white border border-zinc-200 text-zinc-600 px-3 py-1 rounded-full text-xs font-medium shadow-sm">
                        {{ paiementsTotal }} paiements
                    </span>
                </div>

                <div class="p-0">
                    <div *ngIf="paiementsLoading" class="flex flex-col items-center justify-center py-12">
                        <i class="ph ph-spinner-gap text-3xl text-zinc-400 animate-spin mb-3"></i>
                        <p class="text-zinc-500 font-medium">Chargement des transactions...</p>
                    </div>
                    
                    <div class="saas-table-scroll" *ngIf="!paiementsLoading">
                        <table class="saas-table">
                            <thead>
                                <tr>
                                    <th class="w-32">N° Reçu</th>
                                    <th>Élève</th>
                                    <th>Détails du paiement</th>
                                    <th class="text-right w-32">Montant</th>
                                    <th class="w-32">Date & Mode</th>
                                    <th class="w-24 text-center">Statut</th>
                                    <th class="w-24 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let p of paiementsResults" class="hover:bg-zinc-50/50 transition-colors group" [class.bg-red-50]="p.annule">
                                    <td class="font-mono text-xs font-medium text-zinc-600">{{ p.numero_recu }}</td>
                                    <td>
                                        <div class="font-bold text-zinc-900">{{ p.eleve_nom }} {{ p.eleve_prenom }}</div>
                                        <div class="text-xs text-zinc-500 font-mono mt-0.5">{{ p.eleve_matricule }}</div>
                                    </td>
                                    <td>
                                        <div class="text-sm font-medium text-zinc-800">{{ p.type_frais }}</div>
                                        <div class="text-xs text-zinc-500 mt-0.5 flex items-center gap-1"><i class="ph ph-chalkboard-teacher"></i> {{ p.classe_nom || 'Non assigné' }}</div>
                                    </td>
                                    <td class="text-right">
                                        <span class="font-bold" [ngClass]="p.annule ? 'text-red-500 line-through' : 'text-emerald-600'">
                                            {{ p.montant_paye | number:'1.0-2' }} $
                                        </span>
                                    </td>
                                    <td>
                                        <div class="text-sm text-zinc-800">{{ p.date_paiement | date:'dd/MM/yyyy' }}</div>
                                        <div class="text-[10px] uppercase font-bold text-zinc-500 mt-0.5 tracking-wider">{{ p.mode_paiement }}</div>
                                    </td>
                                    <td class="text-center">
                                        <span class="saas-badge-success" *ngIf="!p.annule">Valide</span>
                                        <span class="saas-badge-error" *ngIf="p.annule">Annulé</span>
                                    </td>
                                    <td class="text-right">
                                        <div class="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button class="p-1.5 text-zinc-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors" (click)="viewRecu(p.id)" [disabled]="p.annule" title="Voir le reçu">
                                                <i class="ph ph-receipt text-lg"></i>
                                            </button>
                                            <button *ngIf="!p.annule" class="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" (click)="annulerPaiement(p.id)" [disabled]="isLoading" title="Annuler le paiement">
                                                <i class="ph ph-x-circle text-lg"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                <tr *ngIf="paiementsResults.length === 0">
                                    <td colspan="7" class="py-12 text-center text-zinc-500">
                                        <div class="mx-auto w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mb-3">
                                            <i class="ph ph-magnifying-glass text-2xl text-zinc-400"></i>
                                        </div>
                                        <p class="font-medium text-zinc-900">Aucun paiement trouvé.</p>
                                        <p class="text-sm mt-1">Modifiez vos critères de recherche ou ajoutez un nouveau paiement.</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Pagination -->
                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between flex-wrap gap-4" *ngIf="!paiementsLoading && paiementsTotal > 0">
                    <div class="text-sm text-zinc-500 font-medium">Affichage de <span class="text-zinc-900">{{ paiementsResults.length }}</span> sur <span class="text-zinc-900">{{ paiementsTotal }}</span> transactions</div>
                    <div class="flex items-center gap-2">
                        <button class="saas-btn-secondary px-2.5 py-1.5" (click)="changePage(-1)" [disabled]="paiementsPage <= 1 || isLoading">
                            <i class="ph ph-caret-left text-lg"></i>
                        </button>
                        <div class="text-sm font-medium text-zinc-700 px-2">Page {{ paiementsPage }} sur {{ paiementsLastPage }}</div>
                        <button class="saas-btn-secondary px-2.5 py-1.5" (click)="changePage(1)" [disabled]="paiementsPage >= paiementsLastPage || isLoading">
                            <i class="ph ph-caret-right text-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; }
    `]
})
export class PaiementsComponent implements OnInit, OnDestroy {
    private API_BASE = 'http://207.180.205.248:3007';
    private destroy$ = new Subject<void>();

    isLoading = false;
    paiementsLoading = false;
    paiementsResults: any[] = [];
    paiementsTotal = 0;
    paiementsPage = 1;
    paiementsPageSize = 15;
    paiementsLastPage = 1;
    searchQuery = '';

    constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private router: Router) { }

    ngOnInit(): void {
        this.loadPaiements();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private authHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    }

    loadPaiements(): void {
        this.paiementsLoading = true;
        const params = new URLSearchParams();
        params.set('page', String(this.paiementsPage));
        params.set('pageSize', String(this.paiementsPageSize));
        if (this.searchQuery.trim()) params.set('search', this.searchQuery);

        this.http.get(`${this.API_BASE}/api/gestionnaire/paiements?${params.toString()}`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => { this.paiementsLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    this.paiementsResults = res.results || [];
                    this.paiementsTotal = res.total || 0;
                    this.paiementsLastPage = Math.max(1, Math.ceil(this.paiementsTotal / this.paiementsPageSize));
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur chargement paiements:', err);
                    this.cdr.detectChanges();
                }
            });
    }

    onSearch(): void {
        this.paiementsPage = 1;
        this.loadPaiements();
    }

    resetFilters(): void {
        this.searchQuery = '';
        this.paiementsPage = 1;
        this.loadPaiements();
    }

    changePage(delta: number): void {
        const newPage = this.paiementsPage + delta;
        if (newPage >= 1 && newPage <= this.paiementsLastPage) {
            this.paiementsPage = newPage;
            this.loadPaiements();
        }
    }

    viewRecu(id: number): void {
        this.router.navigate(['/gestionnaire/recu', id]);
    }

    annulerPaiement(id: number): void {
        if (!confirm('Voulez-vous vraiment annuler ce paiement ? Cette action est irréversible.')) return;
        this.isLoading = true;
        this.http.put(`${this.API_BASE}/api/gestionnaire/paiements/${id}/annuler`, {}, { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.isLoading = false; }))
            .subscribe({
                next: () => {
                    this.loadPaiements();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    alert(err?.error?.message || 'Erreur lors de l\'annulation.');
                    this.cdr.detectChanges();
                }
            });
    }
}