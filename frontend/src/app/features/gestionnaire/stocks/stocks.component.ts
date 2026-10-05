// stocks.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { bbFadeScaleIn } from '../../../animations/bb-ui.animations';
import { Subject, takeUntil, finalize, timeout } from 'rxjs';

interface Stock {
    id: number;
    nom: string;
    categorie: string | null;
    reference: string | null;
    quantite: number;
    unite: string | null;
    seuil_alerte: number;
    prix_unitaire: number;
    fournisseur: string | null;
    emplacement: string | null;
}

@Component({
    selector: 'app-stocks',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule],
    animations: [bbFadeScaleIn],
    template: `
        <div class="space-y-6 animate-fade-in">
            <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-package text-brand-600"></i> Gestion des stocks
                    </h2>
                    <p class="text-zinc-500 text-sm mt-1">Inventaire du matériel et fournitures</p>
                </div>
                <button class="saas-btn-primary" (click)="openCreateStockModal()" [disabled]="isLoading">
                    <i class="ph ph-plus mr-2"></i> Ajouter un article
                </button>
            </header>

            <!-- Alertes -->
            <div *ngIf="alertes.length > 0" class="saas-card border-red-100 bg-red-50/30">
                <div class="flex items-center gap-2 text-red-700 font-bold mb-3">
                    <i class="ph ph-warning-circle text-xl"></i>
                    <h3>Alertes de stock</h3>
                </div>
                <div class="space-y-2">
                    <div *ngFor="let alerte of alertes" class="flex items-center justify-between py-2 border-b border-red-100 last:border-0">
                        <span class="text-sm font-medium text-zinc-900">{{ alerte.nom }}</span>
                        <div class="flex items-center gap-4">
                            <span class="text-xs text-zinc-500">Stock: {{ alerte.quantite }} {{ alerte.unite || 'u' }}</span>
                            <span class="saas-badge-warning text-xs">Seuil: {{ alerte.seuil_alerte }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Filtres -->
            <div class="saas-card">
                <div class="flex flex-wrap gap-4 items-end">
                    <div class="flex-1 min-w-[240px]">
                        <label class="saas-label">Rechercher</label>
                        <div class="relative">
                            <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
                            <input class="saas-input pl-10" type="text" [(ngModel)]="searchQuery" 
                                   (input)="onSearch()" placeholder="Nom, référence..." [disabled]="isLoading" />
                        </div>
                    </div>
                    <div class="w-full sm:w-auto">
                        <label class="saas-label">Catégorie</label>
                        <select class="saas-input" [(ngModel)]="categorieFilter" (change)="loadStocks()">
                            <option [ngValue]="null">Toutes les catégories</option>
                            <option *ngFor="let cat of categories" [ngValue]="cat">{{ cat }}</option>
                        </select>
                    </div>
                    <button class="saas-btn-secondary h-[42px]" (click)="resetFilters()" [disabled]="isLoading">
                        <i class="ph ph-x mr-2"></i> Effacer
                    </button>
                </div>
            </div>

            <!-- Tableau -->
            <div class="saas-card">
                <div *ngIf="stocksLoading" class="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <div class="sc-spin-small mb-3"></div>
                    <p>Chargement des stocks...</p>
                </div>

                <div class="saas-table-container" *ngIf="!stocksLoading">
                    <div class="saas-table-scroll">
                        <table class="saas-table">
                            <thead>
                                <tr>
                                    <th>Article</th>
                                    <th>Catégorie</th>
                                    <th>Quantité</th>
                                    <th>Unité</th>
                                    <th>Seuil</th>
                                    <th>Prix unit.</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let stock of stocksResults" [ngClass]="{'bg-red-50/50': stock.quantite <= stock.seuil_alerte && stock.seuil_alerte > 0}">
                                    <td>
                                        <div class="flex flex-col">
                                            <span class="font-medium text-zinc-900">{{ stock.nom }}</span>
                                            <span class="text-xs text-zinc-500" *ngIf="stock.reference">Ref: {{ stock.reference }}</span>
                                        </div>
                                    </td>
                                    <td>{{ stock.categorie || '-' }}</td>
                                    <td>
                                        <span class="font-bold" [ngClass]="{'text-red-600': stock.quantite <= stock.seuil_alerte && stock.seuil_alerte > 0}">
                                            {{ stock.quantite | number:'1.0-0' }}
                                        </span>
                                        <span *ngIf="stock.quantite <= stock.seuil_alerte && stock.seuil_alerte > 0" class="ml-2 saas-badge-warning text-[10px] py-0 px-1">Bas</span>
                                    </td>
                                    <td>{{ stock.unite || 'u' }}</td>
                                    <td>{{ stock.seuil_alerte || '-' }}</td>
                                    <td>{{ stock.prix_unitaire | number:'1.0-2' }} $</td>
                                    <td class="text-right">
                                        <div class="flex justify-end gap-2">
                                            <button class="saas-btn-secondary p-2" (click)="openEditStockModal(stock)" [disabled]="isLoading" title="Modifier">
                                                <i class="ph ph-pencil-simple"></i>
                                            </button>
                                            <button class="saas-btn-secondary p-2 text-red-600 hover:bg-red-50" (click)="deleteStock(stock.id)" [disabled]="isLoading" title="Supprimer">
                                                <i class="ph ph-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                <tr *ngIf="stocksResults.length === 0">
                                    <td colspan="7" class="text-center py-12 text-zinc-500">Aucun article en stock.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Pagination -->
                <div class="mt-6 flex items-center justify-between border-t border-zinc-100 pt-6">
                    <div class="text-zinc-500 text-sm">
                        Total: <span class="font-medium text-zinc-900">{{ stocksTotal }}</span> articles
                    </div>
                    <div class="flex items-center gap-4">
                        <button class="saas-btn-secondary py-1 px-3" (click)="changePage(-1)" 
                                [disabled]="stocksPage <= 1 || stocksLoading || isLoading">
                            <i class="ph ph-caret-left"></i>
                        </button>
                        <div class="text-sm font-medium text-zinc-900">Page {{ stocksPage }} / {{ stocksLastPage }}</div>
                        <button class="saas-btn-secondary py-1 px-3" (click)="changePage(1)" 
                                [disabled]="stocksPage >= stocksLastPage || stocksLoading || isLoading">
                            <i class="ph ph-caret-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODALE: Créer/Éditer Stock -->
        <div *ngIf="stockModalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4" (click)="closeModal($event, 'stockModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"></div>
            <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col" [@bbFadeScaleIn] (click)="$event.stopPropagation()">
                <!-- En-tête fixe -->
                <div class="p-6 border-b border-zinc-100">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-bold text-zinc-900">{{ stockEditMode ? 'Modifier' : 'Ajouter' }} un article</h3>
                        <button class="text-zinc-400 hover:text-zinc-600 transition-colors" (click)="stockModalOpen = false">
                            <i class="ph ph-x text-2xl"></i>
                        </button>
                    </div>
                </div>

                <!-- Corps défilant -->
                <div class="flex-1 overflow-y-auto p-6 space-y-4">
                    <div class="grid grid-cols-1 gap-4">
                        <div>
                            <label class="saas-label">Nom de l'article *</label>
                            <input class="saas-input" type="text" [(ngModel)]="stockForm.nom" [disabled]="isLoading" placeholder="Ex: Rame de papier A4" />
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="saas-label">Catégorie</label>
                                <input class="saas-input" type="text" [(ngModel)]="stockForm.categorie" [disabled]="isLoading" placeholder="Fournitures" />
                            </div>
                            <div>
                                <label class="saas-label">Référence</label>
                                <input class="saas-input" type="text" [(ngModel)]="stockForm.reference" [disabled]="isLoading" placeholder="REF-001" />
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="saas-label">Quantité *</label>
                                <input class="saas-input" type="number" [(ngModel)]="stockForm.quantite" [disabled]="isLoading" step="0.01" />
                            </div>
                            <div>
                                <label class="saas-label">Unité</label>
                                <input class="saas-input" type="text" [(ngModel)]="stockForm.unite" [disabled]="isLoading" placeholder="kg, L, u..." />
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="saas-label">Seuil d'alerte</label>
                                <input class="saas-input" type="number" [(ngModel)]="stockForm.seuil_alerte" [disabled]="isLoading" step="0.01" />
                            </div>
                            <div>
                                <label class="saas-label">Prix unitaire ($)</label>
                                <input class="saas-input" type="number" [(ngModel)]="stockForm.prix_unitaire" [disabled]="isLoading" step="0.01" />
                            </div>
                        </div>
                        <div>
                            <label class="saas-label">Fournisseur</label>
                            <input class="saas-input" type="text" [(ngModel)]="stockForm.fournisseur" [disabled]="isLoading" />
                        </div>
                        <div>
                            <label class="saas-label">Emplacement</label>
                            <input class="saas-input" type="text" [(ngModel)]="stockForm.emplacement" [disabled]="isLoading" placeholder="Rayon A, Étagère 2" />
                        </div>
                    </div>

                    <div *ngIf="stockFormError" class="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-center gap-2">
                        <i class="ph ph-warning-circle"></i>
                        {{ stockFormError }}
                    </div>
                </div>

                <!-- Boutons fixes en bas -->
                <div class="p-6 border-t border-zinc-100 flex gap-3">
                    <button class="saas-btn-secondary flex-1" (click)="stockModalOpen = false" [disabled]="stockSubmitting || isLoading">Annuler</button>
                    <button class="saas-btn-primary flex-1" (click)="submitStockForm()" [disabled]="stockSubmitting || isLoading">
                        <span *ngIf="!stockSubmitting">{{ stockEditMode ? 'Mettre à jour' : 'Ajouter' }}</span>
                        <span *ngIf="stockSubmitting" class="flex items-center justify-center gap-2">
                            <span class="sc-spin-small-white inline-block"></span> {{ stockEditMode ? 'Mise à jour...' : 'Ajout...' }}
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
export class StocksComponent implements OnInit, OnDestroy {
    private API_BASE = 'http://207.180.205.248:3007';
    private destroy$ = new Subject<void>();

    isLoading = false;
    stocksLoading = false;
    stocksResults: Stock[] = [];
    stocksTotal = 0;
    stocksPage = 1;
    stocksPageSize = 10;
    stocksLastPage = 1;
    searchQuery = '';
    categorieFilter: string | null = null;
    categories: string[] = [];
    alertes: Stock[] = [];

    // MODALE
    stockModalOpen = false;
    stockEditMode = false;
    stockEditId: number | null = null;
    stockSubmitting = false;
    stockFormError = '';
    stockForm = {
        nom: '',
        categorie: '',
        reference: '',
        quantite: 0,
        unite: '',
        seuil_alerte: 0,
        prix_unitaire: 0,
        fournisseur: '',
        emplacement: ''
    };

    constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private router: Router) { }

    ngOnInit(): void {
        this.loadStocks();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private authHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    }

    loadStocks(): void {
        this.stocksLoading = true;
        const params = new URLSearchParams();
        params.set('page', String(this.stocksPage));
        params.set('pageSize', String(this.stocksPageSize));
        if (this.searchQuery.trim()) params.set('search', this.searchQuery);
        if (this.categorieFilter) params.set('categorie', this.categorieFilter);

        this.http.get(`${this.API_BASE}/api/gestionnaire/stocks?${params.toString()}`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => { this.stocksLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    this.stocksResults = res.results || [];
                    this.stocksTotal = res.total || 0;
                    this.stocksLastPage = Math.max(1, Math.ceil(this.stocksTotal / this.stocksPageSize));
                    this.categories = res.categories || [];
                    this.alertes = res.alertes || [];
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur chargement stocks:', err);
                    this.cdr.detectChanges();
                }
            });
    }

    onSearch(): void {
        this.stocksPage = 1;
        this.loadStocks();
    }

    resetFilters(): void {
        this.searchQuery = '';
        this.categorieFilter = null;
        this.stocksPage = 1;
        this.loadStocks();
    }

    changePage(delta: number): void {
        const newPage = this.stocksPage + delta;
        if (newPage >= 1 && newPage <= this.stocksLastPage) {
            this.stocksPage = newPage;
            this.loadStocks();
        }
    }

    openCreateStockModal(): void {
        this.stockEditMode = false;
        this.stockEditId = null;
        this.stockForm = { nom: '', categorie: '', reference: '', quantite: 0, unite: '', seuil_alerte: 0, prix_unitaire: 0, fournisseur: '', emplacement: '' };
        this.stockFormError = '';
        this.stockModalOpen = true;
        this.cdr.detectChanges();
    }

    openEditStockModal(stock: Stock): void {
        this.stockEditMode = true;
        this.stockEditId = stock.id;
        this.stockForm = {
            nom: stock.nom,
            categorie: stock.categorie || '',
            reference: stock.reference || '',
            quantite: stock.quantite,
            unite: stock.unite || '',
            seuil_alerte: stock.seuil_alerte || 0,
            prix_unitaire: stock.prix_unitaire || 0,
            fournisseur: stock.fournisseur || '',
            emplacement: stock.emplacement || ''
        };
        this.stockFormError = '';
        this.stockModalOpen = true;
        this.cdr.detectChanges();
    }

    submitStockForm(): void {
        this.stockFormError = '';
        if (!this.stockForm.nom.trim()) {
            this.stockFormError = 'Le nom est obligatoire.';
            this.cdr.detectChanges();
            return;
        }

        this.stockSubmitting = true;
        this.isLoading = true;

        let url = `${this.API_BASE}/api/gestionnaire/stocks`;
        let method = 'POST';
        if (this.stockEditMode && this.stockEditId) {
            url = `${this.API_BASE}/api/gestionnaire/stocks/${this.stockEditId}`;
            method = 'PUT';
        }

        this.http.request(method, url, { body: this.stockForm, headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.stockSubmitting = false; this.isLoading = false; }))
            .subscribe({
                next: () => {
                    this.stockModalOpen = false;
                    this.loadStocks();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.stockFormError = err?.error?.message || 'Erreur lors de l\'enregistrement.';
                    this.cdr.detectChanges();
                }
            });
    }

    deleteStock(id: number): void {
        if (!confirm('Voulez-vous vraiment supprimer cet article ?')) return;
        this.isLoading = true;
        this.http.delete(`${this.API_BASE}/api/gestionnaire/stocks/${id}`, { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.isLoading = false; }))
            .subscribe({
                next: () => {
                    this.loadStocks();
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