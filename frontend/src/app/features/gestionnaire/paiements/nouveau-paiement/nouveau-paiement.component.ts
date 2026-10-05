import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize, timeout, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

interface EleveSearchResult {
    id: number;
    matricule: string;
    nom: string;
    postnom: string | null;
    prenom: string;
    sexe: string;
    classe_id: number | null;
    classe_nom: string | null;
    classe_section: string | null;
    classe_option: string | null;
    inscription_id: number | null;
    annee_scolaire_id: number | null;
}

interface FraisEleve {
    type_frais_id: number;
    nom: string;
    montant_annuel: number;
    devise: string;
    est_obligatoire: boolean;
    periodicite: string;
    inscription_id: number | null;
    total_paye: number;
}

@Component({
    selector: 'app-nouveau-paiement',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule, RouterLink],
    template: `
        <div class="space-y-6 animate-fade-in">
            <!-- En-tête -->
            <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-plus-circle text-brand-600"></i> Nouveau Paiement
                    </h1>
                    <p class="text-zinc-500 text-sm mt-1">Enregistrer un encaissement pour un élève</p>
                </div>
                <a routerLink="/gestionnaire/paiements" class="saas-btn-secondary">
                    <i class="ph ph-arrow-left mr-1.5"></i> Retour à la liste
                </a>
            </header>

            <!-- ÉTAPE 1: Recherche de l'élève -->
            <div class="saas-card p-6" [class.opacity-50]="eleveSelected">
                <div class="flex items-center gap-4 mb-4">
                    <div class="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm">1</div>
                    <h3 class="font-bold text-zinc-900 text-lg">Sélectionner l'élève</h3>
                </div>

                <div class="relative max-w-2xl">
                    <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg"></i>
                    <input class="saas-input pl-10 py-3 text-base" type="text" [(ngModel)]="searchQuery" 
                           (input)="onSearch()" [disabled]="isLoading || !!eleveSelected"
                           placeholder="Rechercher par nom ou matricule..." />
                    
                    <!-- Résultats Dropdown -->
                    <div *ngIf="searchResults.length > 0 && !eleveSelected" 
                         class="absolute z-30 left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-xl shadow-floating overflow-hidden max-h-64 overflow-y-auto animate-slide-up">
                        <div *ngFor="let eleve of searchResults" 
                             class="flex items-center justify-between p-4 hover:bg-zinc-50 cursor-pointer transition-colors border-b border-zinc-100 last:border-0"
                             (click)="selectEleve(eleve)">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center text-xs font-bold uppercase">
                                    {{ eleve.nom.charAt(0) }}{{ eleve.prenom.charAt(0) }}
                                </div>
                                <div>
                                    <div class="font-bold text-zinc-900 text-sm">{{ eleve.nom }} {{ eleve.prenom }}</div>
                                    <div class="text-xs text-zinc-500 font-mono">{{ eleve.matricule }} • {{ eleve.classe_nom || 'Non inscrit' }}</div>
                                </div>
                            </div>
                            <i class="ph ph-caret-right text-zinc-300"></i>
                        </div>
                    </div>
                </div>

                <div *ngIf="searchLoading" class="mt-3 text-zinc-400 text-sm flex items-center gap-2">
                    <i class="ph ph-spinner-gap animate-spin"></i> Recherche...
                </div>
            </div>

            <!-- ÉTAPE 2: Détails et Choix du Frais -->
            <div *ngIf="eleveSelected" class="saas-card p-6 animate-slide-up border-brand-200 bg-brand-50/10">
                <div class="flex items-start justify-between mb-6">
                    <div class="flex items-center gap-4">
                        <div class="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">2</div>
                        <div>
                            <h3 class="font-bold text-zinc-900 text-lg">{{ eleveSelected.nom }} {{ eleveSelected.prenom }}</h3>
                            <div class="flex items-center gap-3 mt-1 text-xs font-medium text-zinc-500">
                                <span class="bg-white px-2 py-1 rounded border border-zinc-200 font-mono">{{ eleveSelected.matricule }}</span>
                                <span class="bg-white px-2 py-1 rounded border border-zinc-200 uppercase">{{ eleveSelected.sexe }}</span>
                                <span class="bg-zinc-900 text-white px-2 py-1 rounded">{{ eleveSelected.classe_nom || 'Non inscrit' }}</span>
                            </div>
                        </div>
                    </div>
                    <button class="saas-btn-secondary text-xs" (click)="clearSearch()">
                        <i class="ph ph-user-minus mr-1"></i> Changer d'élève
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div *ngFor="let frais of eleveFrais" 
                         class="saas-card p-4 bg-white hover:border-brand-500 transition-all cursor-pointer group relative overflow-hidden"
                         [class.border-emerald-500]="frais.total_paye >= frais.montant_annuel"
                         (click)="openPaiementModal(frais)">
                        
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <div class="font-bold text-zinc-900">{{ frais.nom }}</div>
                                <div class="text-[10px] uppercase font-bold text-zinc-400 tracking-widest mt-1">{{ frais.periodicite }}</div>
                            </div>
                            <div *ngIf="frais.total_paye >= frais.montant_annuel" class="text-emerald-500 flex items-center gap-1 text-xs font-bold">
                                <i class="ph ph-check-circle-fill text-lg"></i> SOLDE
                            </div>
                            <div *ngIf="frais.total_paye < frais.montant_annuel" class="text-brand-600 bg-brand-50 px-2 py-1 rounded text-[10px] font-bold">
                                EN COURS
                            </div>
                        </div>

                        <div class="space-y-1.5 relative z-10">
                            <div class="flex justify-between text-xs">
                                <span class="text-zinc-500">Montant total:</span>
                                <span class="font-bold text-zinc-900">{{ frais.montant_annuel | number:'1.0-2' }} {{ frais.devise }}</span>
                            </div>
                            <div class="flex justify-between text-xs">
                                <span class="text-zinc-500">Déjà payé:</span>
                                <span class="font-bold text-emerald-600">{{ frais.total_paye | number:'1.0-2' }} {{ frais.devise }}</span>
                            </div>
                            
                            <!-- Progress Bar -->
                            <div class="w-full h-1.5 bg-zinc-100 rounded-full mt-3 overflow-hidden">
                                <div class="h-full bg-emerald-500 transition-all duration-500" 
                                     [style.width.%]="(frais.total_paye / frais.montant_annuel) * 100"></div>
                            </div>
                            <div class="flex justify-between text-[10px] mt-1">
                                <span class="text-zinc-400">Reste à payer:</span>
                                <span class="font-bold text-brand-600">{{ (frais.montant_annuel - frais.total_paye) | number:'1.0-2' }} {{ frais.devise }}</span>
                            </div>
                        </div>

                        <!-- Hover Action -->
                        <div class="absolute inset-0 bg-brand-600/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <span class="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                <i class="ph ph-credit-card mr-2"></i> Enregistrer un paiement
                            </span>
                        </div>
                    </div>
                </div>
                
                <div *ngIf="!fraisLoading && eleveFrais.length === 0" class="text-center py-8 text-zinc-400">
                    <i class="ph ph-info text-3xl mb-2 opacity-50"></i>
                    <p>Aucun frais configuré pour cet élève.</p>
                </div>
            </div>
        </div>

        <!-- MODALE: Paiement -->
        <div *ngIf="paiementModalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'paiementModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-md p-0 relative z-10 animate-slide-up shadow-modal flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
                <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                    <div>
                        <h3 class="text-lg font-bold text-zinc-900">💸 Encaissement</h3>
                        <p class="text-zinc-500 text-xs mt-0.5">{{ paiementFrais?.nom }} • {{ eleveSelected?.nom }}</p>
                    </div>
                    <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="paiementModalOpen = false"><i class="ph ph-x text-xl"></i></button>
                </div>

                <div class="p-6 space-y-5 overflow-y-auto">
                    <div class="bg-zinc-50 p-4 rounded-xl border border-zinc-200 grid grid-cols-2 gap-4">
                        <div>
                            <div class="text-[10px] uppercase font-bold text-zinc-400 tracking-widest mb-1">Montant annuel</div>
                            <div class="font-bold text-zinc-900">{{ paiementFrais?.montant_annuel | number:'1.0-2' }} {{ paiementFrais?.devise }}</div>
                        </div>
                        <div>
                            <div class="text-[10px] uppercase font-bold text-zinc-400 tracking-widest mb-1">Reste à solder</div>
                            <div class="font-bold text-brand-600">{{ (paiementFrais ? paiementFrais.montant_annuel - paiementFrais.total_paye : 0) | number:'1.0-2' }} {{ paiementFrais?.devise }}</div>
                        </div>
                    </div>

                    <div>
                        <label class="saas-label">Montant du versement ({{ paiementFrais?.devise }})</label>
                        <input class="saas-input py-3 text-lg font-bold text-emerald-600" type="number" [(ngModel)]="paiementForm.montant" 
                               [disabled]="isLoading" step="0.01" placeholder="0.00" (input)="validateMontant()" />
                        <p *ngIf="montantError" class="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                            <i class="ph ph-warning-circle"></i> {{ montantError }}
                        </p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="saas-label">Mode de paiement</label>
                            <select class="saas-input" [(ngModel)]="paiementForm.mode_paiement" [disabled]="isLoading">
                                <option value="CASH">💵 Cash (Espèces)</option>
                                <option value="M-PESA">📱 Vodacom M-Pesa</option>
                                <option value="AIRTELL_MONEY">📱 Airtel Money</option>
                                <option value="ORANGE_MONEY">📱 Orange Money</option>
                                <option value="VIREMENT">🏦 Virement bancaire</option>
                                <option value="CHEQUE">📄 Chèque</option>
                            </select>
                        </div>
                        <div>
                            <label class="saas-label">Réf. transaction (optionnel)</label>
                            <input class="saas-input" type="text" [(ngModel)]="paiementForm.reference_externe" 
                                   [disabled]="isLoading" placeholder="N° de pièce..." />
                        </div>
                    </div>

                    <div>
                        <label class="saas-label">Commentaire interne</label>
                        <textarea class="saas-input" [(ngModel)]="paiementForm.commentaire" 
                                  [disabled]="isLoading" rows="2" placeholder="Ex: Paiement groupé avec frère..."></textarea>
                    </div>

                    <div *ngIf="paiementError" class="bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 text-xs font-medium flex items-start gap-2">
                        <i class="ph ph-x-circle text-lg shrink-0"></i>
                        <span>{{ paiementError }}</span>
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
                    <button class="saas-btn-secondary" (click)="paiementModalOpen = false" [disabled]="paiementSubmitting || isLoading">Annuler</button>
                    <button class="saas-btn-primary h-11" (click)="submitPaiement()" [disabled]="paiementSubmitting || isLoading || montantError || !paiementForm.montant">
                        <i class="ph ph-check-circle mr-1.5" *ngIf="!paiementSubmitting"></i>
                        <i class="ph ph-spinner-gap animate-spin mr-1.5" *ngIf="paiementSubmitting"></i>
                        Confirmer l'encaissement
                    </button>
                </div>
            </div>
        </div>

        <!-- MODALE: Succès -->
        <div *ngIf="successModalOpen" class="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in">
            <div class="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"></div>
            <div class="saas-card w-full max-w-sm p-8 relative z-10 animate-slide-up text-center shadow-2xl">
                <div class="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 scale-110">
                    <i class="ph-fill ph-check-circle text-5xl"></i>
                </div>
                <h3 class="text-2xl font-bold text-zinc-900 mb-2">Paiement enregistré !</h3>
                <p class="text-zinc-500 text-sm mb-6">L'encaissement a été validé et le reçu est prêt.</p>
                
                <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-8">
                    <div class="text-[10px] uppercase font-bold text-zinc-400 tracking-widest mb-1">Numéro de reçu</div>
                    <div class="font-mono text-lg font-bold text-zinc-900">{{ successNumeroRecu }}</div>
                </div>

                <div class="flex flex-col gap-3">
                    <button class="saas-btn-primary h-12 w-full text-base" (click)="viewRecu(successPaiementId)">
                        <i class="ph ph-printer text-xl mr-2"></i> Imprimer le reçu
                    </button>
                    <button class="saas-btn-secondary h-12 w-full" (click)="successModalOpen = false; clearSearch()">
                        Effectuer un autre paiement
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; }
    `]
})
export class NouveauPaiementComponent implements OnInit, OnDestroy {
    private API_BASE = 'http://207.180.205.248:3007';
    private destroy$ = new Subject<void>();
    private searchSubject = new Subject<string>();

    isLoading = false;
    searchQuery = '';
    searchLoading = false;
    searchResults: EleveSearchResult[] = [];

    eleveSelected: EleveSearchResult | null = null;
    eleveFrais: FraisEleve[] = [];
    fraisLoading = false;
    totalPaye = 0;

    // MODALE Paiement
    paiementModalOpen = false;
    paiementFrais: FraisEleve | null = null;
    paiementSubmitting = false;
    paiementError = '';
    montantError = '';
    paiementForm = {
        montant: 0,
        mode_paiement: 'CASH',
        reference_externe: '',
        commentaire: ''
    };

    // MODALE Succès
    successModalOpen = false;
    successNumeroRecu = '';
    successPaiementId = 0;

    constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private router: Router) { }

    ngOnInit(): void {
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

    setupSearch(): void {
        this.searchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query.trim() || this.eleveSelected) {
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

    clearSearch(): void {
        this.searchQuery = '';
        this.searchResults = [];
        this.eleveSelected = null;
        this.eleveFrais = [];
        this.totalPaye = 0;
        this.cdr.detectChanges();
    }

    selectEleve(eleve: EleveSearchResult): void {
        this.eleveSelected = eleve;
        this.searchResults = [];
        this.searchQuery = '';
        this.loadEleveFrais(eleve.id);
        this.cdr.detectChanges();
    }

    loadEleveFrais(eleveId: number): void {
        this.fraisLoading = true;
        this.http.get(`${this.API_BASE}/api/gestionnaire/eleves/${eleveId}/paiements`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => { this.fraisLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    this.eleveFrais = res.frais || [];
                    this.totalPaye = res.totalPaye || 0;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur chargement frais:', err);
                    this.cdr.detectChanges();
                }
            });
    }

    validateMontant(): void {
        this.montantError = '';
        if (!this.paiementFrais) return;

        const maxMontant = this.paiementFrais.montant_annuel - this.paiementFrais.total_paye;
        if (this.paiementForm.montant > maxMontant) {
            this.montantError = `Le montant dépasse le solde restant (${maxMontant.toFixed(2)} ${this.paiementFrais.devise})`;
        }
    }

    openPaiementModal(frais: FraisEleve): void {
        if (!frais.inscription_id) {
            alert('Cet élève n\'est pas inscrit pour cette année.');
            return;
        }
        if (frais.total_paye >= frais.montant_annuel) {
            alert('Ce frais est déjà entièrement payé.');
            return;
        }

        this.paiementFrais = frais;
        const reste = frais.montant_annuel - frais.total_paye;
        this.paiementForm = {
            montant: reste,
            mode_paiement: 'CASH',
            reference_externe: '',
            commentaire: ''
        };
        this.paiementError = '';
        this.montantError = '';
        this.paiementModalOpen = true;
        this.cdr.detectChanges();
    }

    submitPaiement(): void {
        this.paiementError = '';
        if (!this.paiementForm.montant || this.paiementForm.montant <= 0) {
            this.paiementError = 'Veuillez saisir un montant valide.';
            this.cdr.detectChanges();
            return;
        }

        if (!this.eleveSelected || !this.paiementFrais) return;

        const reste = this.paiementFrais.montant_annuel - this.paiementFrais.total_paye;
        if (this.paiementForm.montant > (reste + 0.01)) { // Petit delta pour les arrondis
            this.paiementError = `Le montant ne peut pas dépasser ${reste.toFixed(2)} ${this.paiementFrais.devise}`;
            this.cdr.detectChanges();
            return;
        }

        this.paiementSubmitting = true;
        this.isLoading = true;

        const payload = {
            eleve_id: this.eleveSelected.id,
            type_frais_id: this.paiementFrais.type_frais_id,
            montant_paye: this.paiementForm.montant,
            mode_paiement: this.paiementForm.mode_paiement,
            reference_externe: this.paiementForm.reference_externe || undefined,
            commentaire: this.paiementForm.commentaire || undefined
        };

        this.http.post(`${this.API_BASE}/api/gestionnaire/paiements`, payload, { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.paiementSubmitting = false; this.isLoading = false; }))
            .subscribe({
                next: (res: any) => {
                    this.paiementModalOpen = false;
                    this.successPaiementId = res.paiement_id;
                    if (!this.successPaiementId && res.paiements_effectues && res.paiements_effectues.length > 0) {
                        this.successPaiementId = res.paiements_effectues[0].paiement_id;
                    }
                    this.successNumeroRecu = res.numero_recu || 'REC-XXXX';
                    this.successModalOpen = true;
                    this.loadEleveFrais(this.eleveSelected!.id);
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.paiementError = err?.error?.message || 'Erreur lors de l\'enregistrement.';
                    this.cdr.detectChanges();
                }
            });
    }

    viewRecu(id: number): void {
        this.successModalOpen = false;
        this.router.navigate(['/gestionnaire/recu', id]);
    }

    closeModal(event: MouseEvent, modalKey: string): void {
        const target = event.target as HTMLElement;
        if (target.classList.contains('fixed') || target.classList.contains('absolute')) {
            (this as any)[modalKey] = false;
            this.cdr.detectChanges();
        }
    }
}