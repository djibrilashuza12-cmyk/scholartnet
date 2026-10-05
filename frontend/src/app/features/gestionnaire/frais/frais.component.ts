import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize, timeout } from 'rxjs';

interface TypeFrais {
    id: number;
    nom: string;
    montant: number;
    devise: string;
    est_obligatoire: boolean;
    periodicite: string;
    par_defaut_autorise: boolean;
    nb_paiements: number;
    nb_periodes: number;
    created_at: string;
}

interface Periode {
    id: number;
    nom: string;
    date_debut: string;
    date_fin: string;
    ordre: number;
    est_active: boolean;
}

@Component({
    selector: 'app-frais',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule],
    template: `
        <div class="space-y-6 animate-fade-in">
            <!-- En-tête -->
            <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-list-dashes text-brand-600"></i> Frais scolaires
                    </h1>
                    <p class="text-zinc-500 text-sm mt-1">Configuration des grilles tarifaires par année et par période</p>
                </div>
                <button class="saas-btn-primary" (click)="openCreateFraisModal()" [disabled]="isLoading">
                    <i class="ph ph-plus-circle mr-1.5 text-lg"></i> Nouveau frais
                </button>
            </header>

            <!-- Liste des frais -->
            <div class="saas-card overflow-hidden">
                <div class="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
                    <h3 class="font-bold text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-squares-four text-brand-600 text-lg"></i> Types de frais configurés
                    </h3>
                    <span class="inline-flex items-center justify-center bg-white border border-zinc-200 text-zinc-600 px-3 py-1 rounded-full text-xs font-medium shadow-sm">
                        {{ fraisResults.length }} configurés
                    </span>
                </div>

                <div class="p-0">
                    <div *ngIf="fraisLoading" class="flex flex-col items-center justify-center py-12">
                        <i class="ph ph-spinner-gap text-3xl text-zinc-400 animate-spin mb-3"></i>
                        <p class="text-zinc-500 font-medium">Chargement des frais...</p>
                    </div>

                    <div *ngIf="!fraisLoading && fraisResults.length === 0" class="text-center py-12 text-zinc-500">
                        <div class="mx-auto w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                            <i class="ph ph-money text-3xl text-zinc-400"></i>
                        </div>
                        <h3 class="text-lg font-semibold text-zinc-900 mb-1">Aucun frais configuré</h3>
                        <p class="text-sm max-w-sm mx-auto">Commencez par ajouter les frais scolaires applicables à votre établissement.</p>
                    </div>

                    <div class="saas-table-scroll" *ngIf="!fraisLoading && fraisResults.length > 0">
                        <table class="saas-table">
                            <thead>
                                <tr>
                                    <th>Désignation</th>
                                    <th>Montant Base</th>
                                    <th>Périodicité</th>
                                    <th>Nature</th>
                                    <th>Paiements enregistrés</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let frais of fraisResults" class="hover:bg-zinc-50/50 transition-colors group">
                                    <td>
                                        <div class="font-bold text-zinc-900">{{ frais.nom }}</div>
                                        <div class="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                                            <i class="ph ph-shield-check" *ngIf="frais.par_defaut_autorise"></i>
                                            <i class="ph ph-shield" *ngIf="!frais.par_defaut_autorise"></i>
                                            {{ frais.par_defaut_autorise ? 'Autorisation auto' : 'Validation manuelle' }}
                                        </div>
                                    </td>
                                    <td>
                                        <span class="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                            {{ frais.montant | number:'1.0-2' }} {{ frais.devise }}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="saas-badge-info">{{ frais.periodicite }}</span>
                                    </td>
                                    <td>
                                        <span class="inline-flex items-center gap-1.5" [class]="frais.est_obligatoire ? 'text-brand-600' : 'text-zinc-500'">
                                            <span class="w-1.5 h-1.5 rounded-full" [class]="frais.est_obligatoire ? 'bg-brand-500' : 'bg-zinc-400'"></span>
                                            <span class="text-xs font-medium">{{ frais.est_obligatoire ? 'Obligatoire' : 'Optionnel' }}</span>
                                        </span>
                                    </td>
                                    <td>
                                        <span class="text-sm font-medium text-zinc-600">{{ frais.nb_paiements }} trans.</span>
                                    </td>
                                    <td class="text-right">
                                        <div class="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button class="p-1.5 text-zinc-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors" (click)="openPeriodesModal(frais)" [disabled]="isLoading" title="Configuration par période">
                                                <i class="ph ph-calendar-blank text-lg"></i>
                                            </button>
                                            <button class="p-1.5 text-zinc-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors" (click)="openEditFraisModal(frais)" [disabled]="isLoading" title="Modifier">
                                                <i class="ph ph-pencil-simple text-lg"></i>
                                            </button>
                                            <button class="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" (click)="deleteFrais(frais.id)" [disabled]="isLoading || frais.nb_paiements > 0" title="Supprimer">
                                                <i class="ph ph-trash text-lg"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODALE: Créer/Éditer Frais -->
        <div *ngIf="fraisModalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'fraisModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-lg p-0 relative z-10 animate-slide-up shadow-modal flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
                <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
                    <div>
                        <h3 class="text-lg font-bold text-zinc-900 flex items-center gap-2">
                            <i class="ph ph-money text-brand-600"></i> {{ fraisEditMode ? 'Modifier le frais' : 'Nouveau type de frais' }}
                        </h3>
                        <p class="text-zinc-500 text-xs mt-0.5">{{ fraisEditMode ? 'Ajustez les paramètres du frais sélectionné' : 'Définissez les paramètres du nouveau frais' }}</p>
                    </div>
                    <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="fraisModalOpen = false"><i class="ph ph-x text-xl"></i></button>
                </div>

                <div class="p-6 overflow-y-auto space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div class="md:col-span-2">
                            <label class="saas-label">Désignation du frais *</label>
                            <input class="saas-input" type="text" [(ngModel)]="fraisForm.nom" placeholder="Ex: Minerval, Frais de l'État..." [disabled]="isLoading" />
                        </div>
                        <div>
                            <label class="saas-label">Montant de base *</label>
                            <input class="saas-input font-bold" type="number" [(ngModel)]="fraisForm.montant" placeholder="0.00" [disabled]="isLoading" step="0.01" />
                        </div>
                        <div>
                            <label class="saas-label">Devise</label>
                            <select class="saas-input" [(ngModel)]="fraisForm.devise" [disabled]="isLoading">
                                <option value="USD">USD ($)</option>
                                <option value="CDF">CDF (FC)</option>
                                <option value="EUR">EUR (€)</option>
                            </select>
                        </div>
                        <div class="md:col-span-2">
                            <label class="saas-label">Périodicité de paiement</label>
                            <select class="saas-input" [(ngModel)]="fraisForm.periodicite" [disabled]="isLoading">
                                <option value="ANNUELLE">Annuelle (1 fois par an)</option>
                                <option value="SEMESTRIELLE">Semestrielle (2 fois par an)</option>
                                <option value="TRIMESTRIELLE">Trimestrielle (3 fois par an)</option>
                                <option value="MENSUELLE">Mensuelle (Chaque mois)</option>
                                <option value="UNIQUE">Unique (Paiement exceptionnel)</option>
                            </select>
                        </div>
                    </div>

                    <div class="border border-zinc-200 rounded-lg overflow-hidden">
                        <label class="flex items-center gap-3 p-4 bg-white hover:bg-zinc-50 cursor-pointer transition-colors border-b border-zinc-200">
                            <input type="checkbox" class="w-4 h-4 text-brand-600 rounded border-zinc-300 focus:ring-brand-500" [(ngModel)]="fraisForm.est_obligatoire" [disabled]="isLoading" />
                            <div>
                                <div class="text-sm font-bold text-zinc-900">Frais obligatoire</div>
                                <div class="text-xs text-zinc-500">Ce frais est imposé à tous les élèves de l'établissement.</div>
                            </div>
                        </label>
                        <label class="flex items-center gap-3 p-4 bg-white hover:bg-zinc-50 cursor-pointer transition-colors">
                            <input type="checkbox" class="w-4 h-4 text-brand-600 rounded border-zinc-300 focus:ring-brand-500" [(ngModel)]="fraisForm.par_defaut_autorise" [disabled]="isLoading" />
                            <div>
                                <div class="text-sm font-bold text-zinc-900">Autorisation par défaut</div>
                                <div class="text-xs text-zinc-500">Les paiements sont automatiquement validés et donnent accès aux services sans intervention manuelle.</div>
                            </div>
                        </label>
                    </div>

                    <div *ngIf="fraisFormError" class="text-red-500 text-sm font-medium flex items-center gap-1.5">
                        <i class="ph ph-warning-circle"></i> {{ fraisFormError }}
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3 shrink-0">
                    <button class="saas-btn-secondary" (click)="fraisModalOpen = false" [disabled]="fraisSubmitting || isLoading">Annuler</button>
                    <button class="saas-btn-primary" (click)="submitFraisForm()" [disabled]="fraisSubmitting || isLoading">
                        <i class="ph ph-check-circle mr-1.5" *ngIf="!fraisSubmitting"></i>
                        <i class="ph ph-spinner-gap animate-spin mr-1.5" *ngIf="fraisSubmitting"></i>
                        {{ fraisEditMode ? 'Enregistrer les modifications' : 'Créer le frais' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- MODALE: Configuration des périodes (Version améliorée) -->
        <div *ngIf="periodesModalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'periodesModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-2xl p-0 relative z-10 animate-slide-up shadow-modal flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
                <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
                    <div>
                        <h3 class="text-lg font-bold text-zinc-900 flex items-center gap-2">
                            <i class="ph ph-calendar-blank text-brand-600"></i> Ventilation par période
                        </h3>
                        <p class="text-zinc-500 text-xs mt-0.5">
                            Configurer les montants attendus pour: <strong class="text-zinc-700">{{ selectedFrais?.nom }}</strong>
                            <span class="ml-2 text-emerald-600 font-bold">
                                (Total: {{ selectedFrais?.montant || 0 }} {{ selectedFrais?.devise }})
                            </span>
                        </p>
                    </div>
                    <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="periodesModalOpen = false"><i class="ph ph-x text-xl"></i></button>
                </div>

                <div class="p-6 overflow-y-auto flex-1">
                    <!-- Indicateur de progression -->
                    <div *ngIf="!periodesLoading" class="mb-4 flex items-center justify-between text-sm">
                        <span class="text-zinc-600">
                            Somme des périodes: 
                            <span [class]="sommePeriodes > (selectedFrais?.montant || 0) ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'">
                                {{ sommePeriodes | number:'1.0-2' }} {{ selectedFrais?.devise }}
                            </span>
                        </span>
                        <span class="text-zinc-500">
                            Reste: {{ ((selectedFrais?.montant || 0) - sommePeriodes) | number:'1.0-2' }} {{ selectedFrais?.devise }}
                        </span>
                    </div>

                    <!-- Message d'erreur si dépassement -->
                    <div *ngIf="sommePeriodes > (selectedFrais?.montant || 0)" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                        <i class="ph ph-warning-circle text-lg"></i>
                        La somme des montants ({{ sommePeriodes | number:'1.0-2' }}) dépasse le montant total du frais ({{ selectedFrais?.montant | number:'1.0-2' }}). 
                        Réduisez les montants de {{ (sommePeriodes - (selectedFrais?.montant || 0)) | number:'1.0-2' }}.
                    </div>

                    <div *ngIf="periodesLoading" class="flex flex-col items-center justify-center py-8 text-zinc-500">
                        <i class="ph ph-spinner-gap animate-spin text-3xl mb-2"></i>
                        <span>Chargement des périodes...</span>
                    </div>

                    <div *ngIf="!periodesLoading" class="space-y-3">
                        <div *ngFor="let periode of periodesList" class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-zinc-200 rounded-xl bg-white hover:border-brand-300 transition-colors group">
                            <div>
                                <div class="font-bold text-zinc-900">{{ periode.nom }}</div>
                                <div class="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                    <i class="ph ph-clock"></i> Du {{ periode.date_debut | date:'dd/MM/yyyy' }} au {{ periode.date_fin | date:'dd/MM/yyyy' }}
                                </div>
                            </div>
                            <div class="flex items-center gap-2 w-full sm:w-auto">
                                <div class="relative flex-1 sm:w-32">
                                    <input 
                                        class="saas-input w-full pr-12 font-bold" 
                                        type="number" 
                                        [(ngModel)]="periode.montant" 
                                        [disabled]="isLoading" 
                                        step="0.01" 
                                        placeholder="0.00"
                                        (ngModelChange)="onPeriodeMontantChange()"
                                    />
                                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">{{ selectedFrais?.devise }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div *ngIf="periodesList.length === 0 && !periodesLoading" class="text-center py-8 text-zinc-500 border-dashed border-zinc-300 border rounded-xl bg-zinc-50 mt-4">
                        <i class="ph ph-calendar-x text-3xl text-zinc-400 mb-2"></i>
                        <p class="text-sm font-medium text-zinc-900">Aucune période disponible</p>
                        <p class="text-xs mt-1">Vous devez d'abord créer des périodes scolaires dans l'onglet "Périodes".</p>
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3 shrink-0">
                    <button class="saas-btn-secondary" (click)="periodesModalOpen = false" [disabled]="isLoading">Fermer</button>
                    <button 
                        class="saas-btn-primary" 
                        (click)="saveAllPeriodes()" 
                        [disabled]="isLoading || sommePeriodes > (selectedFrais?.montant || 0) || periodesList.length === 0"
                    >
                        <i class="ph ph-check-circle mr-1.5" *ngIf="!isLoading"></i>
                        <i class="ph ph-spinner-gap animate-spin mr-1.5" *ngIf="isLoading"></i>
                        Enregistrer toutes les périodes
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; }
    `]
})
export class FraisComponent implements OnInit, OnDestroy {
    private API_BASE = 'http://207.180.205.248:3007';
    private destroy$ = new Subject<void>();

    isLoading = false;
    fraisLoading = false;
    fraisResults: TypeFrais[] = [];
    periodesList: (Periode & { montant?: number; frais_par_periode_id?: number })[] = [];

    // MODALE Frais
    fraisModalOpen = false;
    fraisEditMode = false;
    fraisEditId: number | null = null;
    fraisSubmitting = false;
    fraisFormError = '';
    fraisForm = {
        nom: '',
        montant: 0,
        devise: 'USD',
        est_obligatoire: true,
        periodicite: 'ANNUELLE',
        par_defaut_autorise: false
    };

    // MODALE Périodes
    periodesModalOpen = false;
    periodesLoading = false;
    selectedFrais: TypeFrais | null = null;
    sommePeriodes = 0;

    constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private router: Router) { }

    ngOnInit(): void {
        this.loadFrais();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private authHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    }

    loadFrais(): void {
        this.fraisLoading = true;
        this.http.get(`${this.API_BASE}/api/gestionnaire/frais`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => { this.fraisLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    this.fraisResults = res.results || [];
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur chargement frais:', err);
                    this.cdr.detectChanges();
                }
            });
    }

    loadPeriodes(): void {
        this.periodesLoading = true;
        this.http.get(`${this.API_BASE}/api/gestionnaire/periodes`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => { this.periodesLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    const periodes = res.results || [];
                    this.loadFraisParPeriode(periodes);
                },
                error: (err) => {
                    console.error('Erreur chargement périodes:', err);
                    this.cdr.detectChanges();
                }
            });
    }

    loadFraisParPeriode(periodes: Periode[]): void {
        this.http.get(`${this.API_BASE}/api/gestionnaire/frais-par-periode`, { headers: this.authHeaders() })
            .pipe(timeout(10000))
            .subscribe({
                next: (res: any) => {
                    const existants = res.results || [];
                    this.periodesList = periodes.map(p => {
                        const existant = existants.find((e: any) => e.periode_id === p.id && e.type_frais_id === this.selectedFrais?.id);
                        return {
                            ...p,
                            montant: existant?.montant || 0,
                            frais_par_periode_id: existant?.id || undefined
                        };
                    });
                    this.calculerSommePeriodes();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur chargement frais par période:', err);
                    this.periodesList = periodes.map(p => ({ ...p, montant: 0 }));
                    this.calculerSommePeriodes();
                    this.cdr.detectChanges();
                }
            });
    }

    // Calculer la somme des montants des périodes
    calculerSommePeriodes(): void {
        this.sommePeriodes = this.periodesList.reduce((sum, p) => sum + (parseFloat(String(p.montant)) || 0), 0);
    }

    // Mettre à jour la somme quand un montant change
    onPeriodeMontantChange(): void {
        this.calculerSommePeriodes();
        this.cdr.detectChanges();
    }

    openCreateFraisModal(): void {
        this.fraisEditMode = false;
        this.fraisEditId = null;
        this.fraisForm = { nom: '', montant: 0, devise: 'USD', est_obligatoire: true, periodicite: 'ANNUELLE', par_defaut_autorise: false };
        this.fraisFormError = '';
        this.fraisModalOpen = true;
        this.cdr.detectChanges();
    }

    openEditFraisModal(frais: TypeFrais): void {
        this.fraisEditMode = true;
        this.fraisEditId = frais.id;
        this.fraisForm = {
            nom: frais.nom,
            montant: frais.montant,
            devise: frais.devise || 'USD',
            est_obligatoire: frais.est_obligatoire,
            periodicite: frais.periodicite || 'ANNUELLE',
            par_defaut_autorise: frais.par_defaut_autorise || false
        };
        this.fraisFormError = '';
        this.fraisModalOpen = true;
        this.cdr.detectChanges();
    }

    openPeriodesModal(frais: TypeFrais): void {
        this.selectedFrais = frais;
        this.sommePeriodes = 0;
        this.periodesModalOpen = true;
        this.loadPeriodes();
    }

    submitFraisForm(): void {
        this.fraisFormError = '';
        if (!this.fraisForm.nom.trim()) {
            this.fraisFormError = 'Le nom est obligatoire.';
            this.cdr.detectChanges();
            return;
        }
        if (!this.fraisForm.montant || this.fraisForm.montant <= 0) {
            this.fraisFormError = 'Le montant doit être supérieur à 0.';
            this.cdr.detectChanges();
            return;
        }

        this.fraisSubmitting = true;
        this.isLoading = true;

        let url = `${this.API_BASE}/api/gestionnaire/frais`;
        let method = 'POST';
        if (this.fraisEditMode && this.fraisEditId) {
            url = `${this.API_BASE}/api/gestionnaire/frais/${this.fraisEditId}`;
            method = 'PUT';
        }

        this.http.request(method, url, { body: this.fraisForm, headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.fraisSubmitting = false; this.isLoading = false; }))
            .subscribe({
                next: (res: any) => {
                    this.fraisModalOpen = false;

                    // 🔥 OUVERTURE AUTOMATIQUE DU MODAL PÉRIODES POUR LE NOUVEAU FRAIS
                    if (!this.fraisEditMode && res?.frais) {
                        // 👈 Utiliser directement le frais retourné par le backend
                        const createdFrais = res.frais;

                        // Ajouter le frais à la liste locale
                        this.fraisResults = [createdFrais, ...this.fraisResults];

                        // Ouvrir le modal avec le bon frais
                        this.openPeriodesModal(createdFrais);
                    } else {
                        // En mode édition, on recharge simplement
                        this.loadFrais();
                    }
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.fraisFormError = err?.error?.message || 'Erreur lors de l\'enregistrement.';
                    this.cdr.detectChanges();
                }
            });
    }

    // ✅ NOUVELLE MÉTHODE: Enregistrement groupé des périodes
    saveAllPeriodes(): void {
        if (!this.selectedFrais) return;

        // Vérifier que la somme ne dépasse pas le montant total
        if (this.sommePeriodes > this.selectedFrais.montant) {
            alert(`La somme des montants (${this.sommePeriodes}) dépasse le montant total du frais (${this.selectedFrais.montant}).`);
            return;
        }

        // Préparer les données pour l'envoi groupé
        const periodesData = this.periodesList.map(p => ({
            periode_id: p.id,
            periode_nom: p.nom,
            montant: parseFloat(String(p.montant)) || 0
        }));

        const payload = {
            type_frais_id: this.selectedFrais.id,
            periodes: periodesData
        };

        this.isLoading = true;

        this.http.post(`${this.API_BASE}/api/gestionnaire/frais-par-periodes/batch`, payload, { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.isLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    alert(`✅ Configuration enregistrée avec succès !\nTotal: ${res.somme_periodes} ${this.selectedFrais?.devise}\nReste: ${res.reste} ${this.selectedFrais?.devise}`);
                    this.periodesModalOpen = false;
                    this.loadFrais();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    const errorMsg = err?.error?.message || 'Erreur lors de l\'enregistrement.';
                    if (err?.error?.somme_periodes && err?.error?.montant_total) {
                        alert(`❌ ${errorMsg}\nTotal du frais: ${err.error.montant_total}\nSomme des périodes: ${err.error.somme_periodes}`);
                    } else {
                        alert(`❌ ${errorMsg}`);
                    }
                    this.cdr.detectChanges();
                }
            });
    }

    deleteFrais(id: number): void {
        if (!confirm('Voulez-vous vraiment supprimer ce frais ?')) return;
        this.isLoading = true;
        this.http.delete(`${this.API_BASE}/api/gestionnaire/frais/${id}`, { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.isLoading = false; }))
            .subscribe({
                next: () => {
                    this.loadFrais();
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
        if (target.classList.contains('fixed') || target.classList.contains('absolute')) {
            (this as any)[modalKey] = false;
            this.cdr.detectChanges();
        }
    }
}