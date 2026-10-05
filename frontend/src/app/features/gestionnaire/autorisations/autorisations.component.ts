import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { bbFadeScaleIn } from '../../../animations/bb-ui.animations';
import { Subject, takeUntil, finalize, timeout, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

@Component({
    selector: 'app-autorisations',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule],
    animations: [bbFadeScaleIn],
    template: `
        <div class="space-y-6 animate-fade-in">
            <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-lock-open text-brand-600"></i> Autorisations
                    </h2>
                    <p class="text-zinc-500 text-sm mt-1">Gestion des autorisations pour les bulletins et la proclamation</p>
                </div>
                <button class="saas-btn-secondary" (click)="loadAutorisations()" [disabled]="isLoading">
                    <i class="ph ph-arrows-clockwise mr-2"></i> Rafraîchir
                </button>
            </header>

            <!-- BARRE DE RECHERCHE -->
            <div class="saas-card">
                <div class="flex flex-wrap gap-4 items-end">
                    <div class="flex-1 min-w-[280px]">
                        <label class="saas-label">Rechercher un élève</label>
                        <div class="relative">
                            <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
                            <input class="saas-input pl-10" 
                                   type="text" 
                                   [(ngModel)]="searchQuery" 
                                   (input)="onSearch()" 
                                   placeholder="Matricule, nom ou prénom..." 
                                   [disabled]="isLoading || eleveSelected" />
                        </div>
                        <div *ngIf="searchLoading" class="flex items-center gap-2 text-brand-600 text-xs mt-2">
                            <div class="sc-spin-tiny"></div>
                            <span>Recherche en cours...</span>
                        </div>
                    </div>
                    <button class="saas-btn-secondary h-[42px]" 
                            (click)="resetSearch()" 
                            [disabled]="isLoading || (!searchQuery && !eleveSelected)">
                        <i class="ph ph-x mr-2"></i> Effacer
                    </button>
                </div>

                <!-- Résultats de recherche d'élèves -->
                <div *ngIf="searchResults.length > 0" class="mt-6 border-t border-zinc-100 pt-6">
                    <div class="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">{{ searchResults.length }} élève(s) trouvé(s)</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div *ngFor="let eleve of searchResults" 
                             class="flex items-center justify-between p-3 bg-zinc-50 hover:bg-brand-50 border border-zinc-100 hover:border-brand-100 cursor-pointer rounded-xl transition-all group"
                             (click)="selectEleve(eleve)">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center text-zinc-400 group-hover:text-brand-600 shadow-sm border border-zinc-100 group-hover:border-brand-200">
                                    <i class="ph ph-user text-xl"></i>
                                </div>
                                <div class="flex flex-col">
                                    <span class="font-bold text-zinc-900">{{ eleve.nom }} {{ eleve.prenom }}</span>
                                    <div class="flex items-center gap-2 text-xs text-zinc-500">
                                        <span class="font-mono">{{ eleve.matricule }}</span>
                                        <span>•</span>
                                        <span>{{ getClasseDisplay(eleve) }}</span>
                                    </div>
                                </div>
                            </div>
                            <i class="ph ph-arrow-right text-zinc-300 group-hover:text-brand-600 group-hover:translate-x-1 transition-all"></i>
                        </div>
                    </div>
                </div>
                <div *ngIf="!searchLoading && searchQuery && searchResults.length === 0" class="mt-6 text-center py-4 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-zinc-500 text-sm">
                    Aucun élève trouvé pour "<span class="font-bold text-zinc-900">{{ searchQuery }}</span>"
                </div>
            </div>

            <!-- DÉTAIL DES AUTORISATIONS D'UN ÉLÈVE -->
            <div *ngIf="eleveSelected" class="saas-card border-brand-100 bg-brand-50/10" [@bbFadeScaleIn]>
                <div class="flex items-start justify-between flex-wrap gap-4 mb-6 pb-6 border-b border-brand-100">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center text-brand-600 shadow-sm">
                            <i class="ph ph-user-focus text-3xl"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-zinc-900">{{ eleveSelected.nom }} {{ eleveSelected.prenom }}</h2>
                            <div class="flex flex-wrap gap-3 mt-1">
                                <span class="text-xs px-2 py-0.5 bg-white border border-zinc-200 rounded-md text-zinc-500 font-mono">Mat: {{ eleveSelected.matricule }}</span>
                                <span class="text-xs px-2 py-0.5 bg-white border border-zinc-200 rounded-md text-zinc-500 font-medium">{{ getClasseDisplay(eleveSelected) }}</span>
                                <span *ngIf="!eleveSelected.inscription_id" class="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md font-bold uppercase">⚠️ Non inscrit</span>
                            </div>
                        </div>
                    </div>
                    <button class="saas-btn-secondary h-[36px] text-xs" (click)="clearSelectedEleve()">
                        <i class="ph ph-x mr-1"></i> Fermer
                    </button>
                </div>

                <!-- Autorisations de l'élève -->
                <div>
                    <div *ngIf="eleveAutorisationsLoading" class="flex flex-col items-center justify-center py-8 text-zinc-500">
                        <div class="sc-spin-small mb-2"></div>
                        <p class="text-xs">Chargement des autorisations...</p>
                    </div>
                    
                    <div class="saas-table-container shadow-none border-none bg-transparent" *ngIf="!eleveAutorisationsLoading">
                        <table class="saas-table bg-white/50 backdrop-blur-sm rounded-xl overflow-hidden border border-brand-100">
                            <thead>
                                <tr class="bg-brand-50/50">
                                    <th>Période</th>
                                    <th>Statut</th>
                                    <th>Source / Gestionnaire</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let auth of eleveAutorisations">
                                    <td class="font-bold">{{ auth.periode_nom }}</td>
                                    <td>
                                        <span *ngIf="auth.statut === 'AUTORISE'" class="saas-badge-success flex items-center gap-1 w-fit">
                                            <i class="ph ph-check-circle"></i> Autorisé
                                        </span>
                                        <span *ngIf="auth.statut !== 'AUTORISE'" class="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 w-fit">
                                            <i class="ph ph-prohibit"></i> Bloqué
                                        </span>
                                    </td>
                                    <td>
                                        <div class="flex flex-col gap-1 text-sm">
                                            <!-- Cas 1: AUTO (paiement complet) -->
                                            <span *ngIf="auth.autorisation_auto" class="flex items-center gap-1 text-brand-600 font-medium">
                                                <i class="ph ph-robot"></i> Automatique (paiement complet)
                                            </span>
                                            
                                            <!-- Cas 2: DÉROGATION ACTIVE -->
                                            <div *ngIf="!auth.autorisation_auto && auth.date_expiration" class="flex flex-col gap-1">
                                                <span class="flex items-center gap-1 text-amber-600 font-bold text-xs">
                                                    <i class="ph ph-clock-countdown"></i>
                                                    Expire le {{ auth.date_expiration | date:'dd/MM/yyyy HH:mm' }}
                                                </span>
                                                <span class="text-[10px] text-zinc-400">
                                                    par {{ auth.gestionnaire_nom }} {{ auth.gestionnaire_prenom }} • {{ auth.duree_jours }}j
                                                </span>
                                                <span *ngIf="auth.motif_autorisation" class="text-[10px] text-zinc-400 italic">
                                                    "{{ auth.motif_autorisation }}"
                                                </span>
                                            </div>
                                            
                                            <!-- Cas 3: À définir -->
                                            <span *ngIf="!auth.autorisation_id && !auth.autorisation_auto" class="text-amber-600 font-bold text-[10px] uppercase">
                                                À définir
                                            </span>
                                        </div>
                                    </td>
                                    <td class="text-right">
                                        <div class="flex justify-end gap-2">
                                            <!-- Si BLOQUÉ → bouton "Autoriser" qui ouvre le modal -->
                                            <button *ngIf="auth.statut !== 'AUTORISE'" 
                                                    class="saas-btn-primary py-1 px-3 text-xs bg-amber-500 hover:bg-amber-600 border-amber-600" 
                                                    (click)="autoriserDerogation(auth)" 
                                                    [disabled]="isLoading">
                                                <i class="ph ph-star mr-1"></i> Autoriser
                                            </button>
                                            
                                            <!-- Si AUTORISÉ → bouton "Bloquer" -->
                                            <button *ngIf="auth.statut === 'AUTORISE'" 
                                                    class="saas-btn-secondary py-1 px-3 text-xs" 
                                                    (click)="bloquerAutorisation(auth)" 
                                                    [disabled]="isLoading">
                                                <i class="ph ph-lock"></i> Bloquer
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                <tr *ngIf="eleveAutorisations.length === 0">
                                    <td colspan="4" class="text-center py-8 text-zinc-500 text-sm">
                                        Aucune période configurée pour cette année.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- LISTE COMPLÈTE DES AUTORISATIONS -->
            <div *ngIf="!eleveSelected" class="saas-card">
                <div *ngIf="autorisationsLoading" class="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <div class="sc-spin-small mb-3"></div>
                    <p>Chargement des dernières autorisations...</p>
                </div>

                <div class="saas-table-container" *ngIf="!autorisationsLoading">
                    <div class="saas-table-scroll">
                        <table class="saas-table">
                            <thead>
                                <tr>
                                    <th>Élève</th>
                                    <th>Classe</th>
                                    <th>Période</th>
                                    <th>Statut</th>
                                    <th>Gestionnaire</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let auth of autorisationsResults">
                                    <td>
                                        <div class="flex flex-col">
                                            <span class="font-medium text-zinc-900">{{ auth.eleve_nom }} {{ auth.eleve_prenom }}</span>
                                            <span class="text-xs text-zinc-500">{{ auth.eleve_matricule }}</span>
                                        </div>
                                    </td>
                                    <td>{{ getClasseDisplayFromAuth(auth) }}</td>
                                    <td>{{ auth.periode_nom }}</td>
                                    <td>
                                        <span *ngIf="auth.statut === 'AUTORISE'" class="saas-badge-success flex items-center gap-1 w-fit">
                                            <i class="ph ph-check-circle"></i> Autorisé
                                        </span>
                                        <span *ngIf="auth.statut !== 'AUTORISE'" class="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 w-fit">
                                            <i class="ph ph-prohibit"></i> Bloqué
                                        </span>
                                    </td>
                                    <td class="text-sm">
                                        <div class="flex items-center gap-1">
                                            <i *ngIf="auth.autorisation_auto" class="ph ph-robot text-brand-600"></i>
                                            <span [class.text-brand-600]="auth.autorisation_auto" [class.font-medium]="auth.autorisation_auto">
                                                {{ auth.autorisation_auto ? 'Auto' : (auth.gestionnaire_nom || '-') }}
                                            </span>
                                        </div>
                                    </td>
                                    <td class="text-right">
                                        <div class="flex justify-end gap-2">
                                            <!-- Si BLOQUÉ → bouton "Autoriser" -->
                                            <button *ngIf="auth.statut !== 'AUTORISE'" 
                                                    class="saas-btn-primary py-1 px-3 text-xs bg-amber-500 hover:bg-amber-600 border-amber-600" 
                                                    (click)="autoriserDerogation(auth)" 
                                                    [disabled]="isLoading">
                                                <i class="ph ph-star mr-1"></i> Autoriser
                                            </button>
                                            
                                            <!-- Si AUTORISÉ → bouton "Bloquer" -->
                                            <button *ngIf="auth.statut === 'AUTORISE'" 
                                                    class="saas-btn-secondary py-1 px-3 text-xs" 
                                                    (click)="bloquerAutorisationListe(auth)" 
                                                    [disabled]="isLoading">
                                                <i class="ph ph-lock"></i> Bloquer
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                <tr *ngIf="autorisationsResults.length === 0">
                                    <td colspan="6" class="text-center py-12 text-zinc-500">Aucune autorisation trouvée.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Pagination -->
                <div class="mt-6 flex items-center justify-between border-t border-zinc-100 pt-6">
                    <div class="text-zinc-500 text-sm">
                        Total: <span class="font-medium text-zinc-900">{{ autorisationsTotal }}</span>
                    </div>
                    <div class="flex items-center gap-4">
                        <button class="saas-btn-secondary py-1 px-3" (click)="changePage(-1)" 
                                [disabled]="autorisationsPage <= 1 || autorisationsLoading || isLoading">
                            <i class="ph ph-caret-left"></i>
                        </button>
                        <div class="text-sm font-medium text-zinc-900">Page {{ autorisationsPage }} / {{ autorisationsLastPage }}</div>
                        <button class="saas-btn-secondary py-1 px-3" (click)="changePage(1)" 
                                [disabled]="autorisationsPage >= autorisationsLastPage || autorisationsLoading || isLoading">
                            <i class="ph ph-caret-right"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- MODAL DÉROGATION TEMPORAIRE -->
            <div *ngIf="derogationModalOpen" 
                 class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in"
                 (click)="cancelDerogation()">
                <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
                <div class="saas-card w-full max-w-md p-0 relative z-10 animate-slide-up shadow-modal"
                     (click)="$event.stopPropagation()">
                    
                    <!-- Header -->
                    <div class="px-6 py-4 border-b border-zinc-100 bg-amber-50/50 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                                <i class="ph ph-star text-xl"></i>
                            </div>
                            <div>
                                <h3 class="text-base font-bold text-zinc-900">Autoriser l'élève</h3>
                                <p class="text-xs text-zinc-500">Saisir la durée d'autorisation</p>
                            </div>
                        </div>
                        <button class="text-zinc-400 hover:text-zinc-700" (click)="cancelDerogation()">
                            <i class="ph ph-x text-xl"></i>
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="p-6 space-y-5">
                        <!-- Info élève -->
                        <div class="bg-zinc-50 rounded-lg p-3 border border-zinc-100">
                            <div class="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Élève</div>
                            <div class="font-bold text-zinc-900">{{ derogationEleveNom }} {{ derogationElevePrenom }}</div>
                            <div class="text-xs text-zinc-500 mt-1">
                                <span class="font-mono">{{ derogationEleveMatricule }}</span>
                                • Période : <span class="font-bold text-brand-600">{{ derogationAuth?.periode_nom }}</span>
                            </div>
                        </div>

                        <!-- Durée -->
                        <div>
                            <label class="saas-label">Durée de l'autorisation *</label>
                            <div class="flex items-center gap-2">
                                <input class="saas-input flex-1" 
                                       type="number" 
                                       min="1" max="365"
                                       [(ngModel)]="derogationDuree" />
                                <span class="text-sm font-bold text-zinc-600 whitespace-nowrap">jour(s)</span>
                            </div>
                            <div class="flex flex-wrap gap-2 mt-2">
                                <button type="button" class="text-xs px-2 py-1 bg-zinc-100 hover:bg-amber-100 hover:text-amber-700 rounded font-medium" 
                                        (click)="derogationDuree = 1">1j</button>
                                <button type="button" class="text-xs px-2 py-1 bg-zinc-100 hover:bg-amber-100 hover:text-amber-700 rounded font-medium" 
                                        (click)="derogationDuree = 3">3j</button>
                                <button type="button" class="text-xs px-2 py-1 bg-zinc-100 hover:bg-amber-100 hover:text-amber-700 rounded font-medium" 
                                        (click)="derogationDuree = 7">7j</button>
                                <button type="button" class="text-xs px-2 py-1 bg-zinc-100 hover:bg-amber-100 hover:text-amber-700 rounded font-medium" 
                                        (click)="derogationDuree = 14">14j</button>
                                <button type="button" class="text-xs px-2 py-1 bg-zinc-100 hover:bg-amber-100 hover:text-amber-700 rounded font-medium" 
                                        (click)="derogationDuree = 30">30j</button>
                            </div>
                            <p class="text-[11px] text-amber-600 mt-2 flex items-start gap-1">
                                <i class="ph ph-info"></i>
                                <span>L'autorisation redeviendra <b>bloquée automatiquement</b> après {{ derogationDuree }} jour(s).</span>
                            </p>
                        </div>

                        <!-- Motif -->
                        <div>
                            <label class="saas-label">Motif (optionnel)</label>
                            <textarea class="saas-input min-h-[80px] text-sm"
                                      [(ngModel)]="derogationMotif"
                                      placeholder="Ex: Situation familiale, grâce exceptionnelle..."></textarea>
                        </div>

                        <!-- Erreur -->
                        <div *ngIf="derogationError" class="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-xs font-bold">
                            {{ derogationError }}
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
                        <button class="saas-btn-secondary" (click)="cancelDerogation()" [disabled]="derogationSubmitting">
                            Annuler
                        </button>
                        <button class="saas-btn-primary bg-amber-500 hover:bg-amber-600 border-amber-600"
                                (click)="submitDerogation()"
                                [disabled]="derogationSubmitting">
                            <i class="ph ph-spinner-gap animate-spin mr-1.5" *ngIf="derogationSubmitting"></i>
                            <i class="ph ph-check-circle mr-1.5" *ngIf="!derogationSubmitting"></i>
                            Autoriser {{ derogationDuree }} jour(s)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .sc-spin-small { width: 24px; height: 24px; border-radius: 9999px; border: 2px solid #e4e4e7; border-top-color: #4f46e5; animation: sc-spin 0.9s linear infinite; }
        .sc-spin-tiny { width: 14px; height: 14px; border-radius: 9999px; border: 2px solid #e0e7ff; border-top-color: #4f46e5; animation: sc-spin 0.9s linear infinite; }
        @keyframes sc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `]
})
export class AutorisationsComponent implements OnInit, OnDestroy {
    private API_BASE = 'http://207.180.205.248:3007';
    private destroy$ = new Subject<void>();
    private searchSubject = new Subject<string>();

    isLoading = false;
    autorisationsLoading = false;
    autorisationsResults: any[] = [];
    autorisationsTotal = 0;
    autorisationsPage = 1;
    autorisationsPageSize = 15;
    autorisationsLastPage = 1;

    // ============================================
    // RECHERCHE
    // ============================================
    searchQuery = '';
    searchLoading = false;
    searchResults: any[] = [];

    // ============================================
    // ÉLÈVE SÉLECTIONNÉ
    // ============================================
    eleveSelected: any = null;
    eleveAutorisations: any[] = [];
    eleveAutorisationsLoading = false;
    derogationModalOpen = false;
    derogationAuth: any = null;
    derogationDuree: number = 3;
    derogationMotif: string = '';
    derogationSubmitting = false;
    derogationError = '';

    // 🔥 Propriétés du modal (pour gérer vue élève ET liste générale)
    derogationEleveId: number | null = null;
    derogationEleveNom: string = '';
    derogationElevePrenom: string = '';
    derogationEleveMatricule: string = '';

    constructor(private http: HttpClient, private cdr: ChangeDetectorRef) { }

    ngOnInit(): void {
        this.loadAutorisations();
        this.setupSearch();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private authHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    }

    // ============================================
    // FONCTION D'AFFICHAGE DES CLASSES
    // ============================================
    getClasseDisplay(eleve: any): string {
        if (!eleve) return '-';
        let display = eleve.classe_nom || '-';
        if (eleve.classe_section) {
            display = display + ' ' + eleve.classe_section;
        }
        if (eleve.classe_option) {
            if (eleve.classe_section) {
                display = display + '/' + eleve.classe_option;
            } else {
                display = display + ' ' + eleve.classe_option;
            }
        }
        return display;
    }

    getClasseDisplayFromAuth(auth: any): string {
        if (!auth) return '-';
        let display = auth.classe_nom || '-';
        if (auth.classe_section) {
            display = display + ' ' + auth.classe_section;
        }
        if (auth.classe_option) {
            if (auth.classe_section) {
                display = display + '/' + auth.classe_option;
            } else {
                display = display + ' ' + auth.classe_option;
            }
        }
        return display;
    }

    // ============================================
    // RECHERCHE D'ÉLÈVES
    // ============================================
    setupSearch(): void {
        this.searchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query.trim()) {
                    this.searchResults = [];
                    this.searchLoading = false;
                    return of(null);
                }
                this.searchLoading = true;
                this.cdr.detectChanges();
                return this.http.get(`${this.API_BASE}/api/gestionnaire/search/eleves?q=${encodeURIComponent(query)}`,
                    { headers: this.authHeaders() });
            }),
            takeUntil(this.destroy$)
        ).subscribe((res: any) => {
            if (res) {
                this.searchResults = res.results || [];
            }
            this.searchLoading = false;
            this.cdr.detectChanges();
        });
    }

    onSearch(): void {
        if (this.eleveSelected) return;
        this.searchSubject.next(this.searchQuery);
    }

    resetSearch(): void {
        this.searchQuery = '';
        this.searchResults = [];
        this.eleveSelected = null;
        this.eleveAutorisations = [];
        this.loadAutorisations();
        this.cdr.detectChanges();
    }

    // ============================================
    // SÉLECTIONNER UN ÉLÈVE
    // ============================================
    selectEleve(eleve: any): void {
        this.eleveSelected = eleve;
        this.loadEleveAutorisations(eleve.id);
        this.cdr.detectChanges();
    }

    clearSelectedEleve(): void {
        this.eleveSelected = null;
        this.eleveAutorisations = [];
        if (this.searchQuery.trim()) {
            this.onSearch();
        }
        this.loadAutorisations();
        this.cdr.detectChanges();
    }

    // ============================================
    // CHARGER LES AUTORISATIONS D'UN ÉLÈVE
    // ============================================
    loadEleveAutorisations(eleveId: number): void {
        this.eleveAutorisationsLoading = true;
        this.http.get(`${this.API_BASE}/api/gestionnaire/eleves/${eleveId}/autorisations`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => { this.eleveAutorisationsLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    this.eleveAutorisations = res.results || [];
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur chargement autorisations élève:', err);
                    this.eleveAutorisations = [];
                    this.cdr.detectChanges();
                }
            });
    }

    // ============================================
    // LISTE COMPLÈTE DES AUTORISATIONS
    // ============================================
    loadAutorisations(): void {
        this.autorisationsLoading = true;
        const params = new URLSearchParams();
        params.set('page', String(this.autorisationsPage));
        params.set('pageSize', String(this.autorisationsPageSize));

        this.http.get(`${this.API_BASE}/api/gestionnaire/autorisations?${params.toString()}`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => { this.autorisationsLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    this.autorisationsResults = res.results || [];
                    this.autorisationsTotal = res.total || 0;
                    this.autorisationsLastPage = Math.max(1, Math.ceil(this.autorisationsTotal / this.autorisationsPageSize));
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur chargement autorisations:', err);
                    this.cdr.detectChanges();
                }
            });
    }

    changePage(delta: number): void {
        const newPage = this.autorisationsPage + delta;
        if (newPage >= 1 && newPage <= this.autorisationsLastPage) {
            this.autorisationsPage = newPage;
            this.loadAutorisations();
        }
    }

    // ============================================
    // AUTORISER — ouvre le modal (vue élève ET liste générale)
    // ============================================
    autoriserDerogation(auth: any): void {
        this.derogationAuth = auth;

        // 📌 2 sources possibles :
        // 1. eleveSelected (vue détail élève)
        // 2. auth.eleve_id (liste générale)
        if (this.eleveSelected) {
            this.derogationEleveId = this.eleveSelected.id;
            this.derogationEleveNom = this.eleveSelected.nom;
            this.derogationElevePrenom = this.eleveSelected.prenom;
            this.derogationEleveMatricule = this.eleveSelected.matricule;
        } else {
            this.derogationEleveId = auth.eleve_id;
            this.derogationEleveNom = auth.eleve_nom;
            this.derogationElevePrenom = auth.eleve_prenom;
            this.derogationEleveMatricule = auth.eleve_matricule;
        }

        this.derogationDuree = 3;
        this.derogationMotif = '';
        this.derogationError = '';
        this.derogationModalOpen = true;
        this.cdr.detectChanges();
    }

    // ============================================
    // SOUMETTRE LE MODAL
    // ============================================
    submitDerogation(): void {
        if (!this.derogationAuth || !this.derogationEleveId) return;

        if (!this.derogationDuree || this.derogationDuree < 1 || this.derogationDuree > 365) {
            this.derogationError = 'La durée doit être entre 1 et 365 jours.';
            this.cdr.detectChanges();
            return;
        }

        this.derogationSubmitting = true;
        this.derogationError = '';

        const payload = {
            eleve_id: this.derogationEleveId,
            periode_id: this.derogationAuth.periode_id,
            duree_jours: this.derogationDuree,
            motif: this.derogationMotif
        };

        this.http.post(`${this.API_BASE}/api/gestionnaire/autorisations/temporaire`,
            payload, { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => {
                this.derogationSubmitting = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: () => {
                    this.derogationModalOpen = false;
                    // Recharge selon le contexte
                    if (this.eleveSelected) {
                        this.loadEleveAutorisations(this.eleveSelected.id);
                    } else {
                        this.loadAutorisations();
                    }
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.derogationError = err?.error?.message || 'Erreur lors de l\'autorisation.';
                    this.cdr.detectChanges();
                }
            });
    }

    // ============================================
    // ANNULER LE MODAL
    // ============================================
    cancelDerogation(): void {
        this.derogationModalOpen = false;
        this.derogationAuth = null;
        this.derogationEleveId = null;
        this.derogationEleveNom = '';
        this.derogationElevePrenom = '';
        this.derogationEleveMatricule = '';
        this.derogationError = '';
        this.cdr.detectChanges();
    }

    // ============================================
    // BLOQUER (depuis la vue élève)
    // ============================================
    bloquerAutorisation(auth: any): void {
        if (!auth.autorisation_id) {
            return;
        }

        if (!confirm(`Voulez-vous bloquer ${this.eleveSelected?.nom} ${this.eleveSelected?.prenom} pour ${auth.periode_nom} ?`)) return;

        this.isLoading = true;
        this.http.put(`${this.API_BASE}/api/gestionnaire/autorisations/${auth.autorisation_id}`,
            { statut: 'BLOQUE' },
            { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.isLoading = false; }))
            .subscribe({
                next: () => {
                    if (this.eleveSelected) {
                        this.loadEleveAutorisations(this.eleveSelected.id);
                    }
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    alert(err?.error?.message || 'Erreur lors du blocage.');
                    this.cdr.detectChanges();
                }
            });
    }

    // ============================================
    // BLOQUER (depuis la liste complète)
    // ============================================
    bloquerAutorisationListe(auth: any): void {
        if (!confirm(`Voulez-vous bloquer ${auth.eleve_nom} ${auth.eleve_prenom} pour ${auth.periode_nom} ?`)) return;

        this.isLoading = true;
        this.http.put(`${this.API_BASE}/api/gestionnaire/autorisations/${auth.id}`,
            { statut: 'BLOQUE' },
            { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.isLoading = false; }))
            .subscribe({
                next: () => {
                    this.loadAutorisations();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    alert(err?.error?.message || 'Erreur lors du blocage.');
                    this.cdr.detectChanges();
                }
            });
    }
}