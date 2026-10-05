import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { bbFadeScaleIn } from '../../../animations/bb-ui.animations';
import { Subject, takeUntil, finalize, timeout } from 'rxjs';

@Component({
    selector: 'app-impayes',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule, RouterLink],
    animations: [bbFadeScaleIn],
    template: `
        <div class="space-y-6 animate-fade-in">
            <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-warning-circle text-brand-600"></i> Impayés
                    </h2>
                    <p class="text-zinc-500 text-sm mt-1">Élèves avec frais obligatoires non payés</p>
                </div>
                <button class="saas-btn-secondary" (click)="loadImpayes()" [disabled]="isLoading">
                    <i class="ph ph-arrows-clockwise mr-2"></i> Rafraîchir
                </button>
            </header>

            <div class="saas-card">
                <div *ngIf="impayesLoading" class="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <div class="sc-spin-small mb-3"></div>
                    <p>Chargement des impayés...</p>
                </div>

                <div *ngIf="!impayesLoading && impayesResults.length === 0" class="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <i class="ph ph-check-circle text-4xl text-green-500 mb-4"></i>
                    <p class="text-lg font-medium text-zinc-900">Tout est à jour</p>
                    <p>Tous les élèves ont payé leurs frais obligatoires !</p>
                </div>

                <div class="saas-table-container" *ngIf="!impayesLoading && impayesResults.length > 0">
                    <div class="saas-table-scroll">
                        <table class="saas-table">
                            <thead>
                                <tr>
                                    <th>Élève</th>
                                    <th>Classe</th>
                                    <th>Type de frais</th>
                                    <th>Montant</th>
                                    <th>Payé</th>
                                    <th>Reste</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let impaye of impayesResults">
                                    <td>
                                        <div class="flex flex-col">
                                            <span class="font-medium text-zinc-900">{{ impaye.nom }} {{ impaye.prenom }}</span>
                                            <span class="text-xs text-zinc-500">{{ impaye.matricule }}</span>
                                        </div>
                                    </td>
                                    <td>{{ getClasseDisplay(impaye) }}</td>
                                    <td>{{ impaye.type_frais }}</td>
                                    <td>{{ impaye.frais_montant | number:'1.0-2' }} $</td>
                                    <td class="text-emerald-600 font-medium">{{ impaye.total_paye | number:'1.0-2' }} $</td>
                                    <td class="font-bold text-red-600">{{ impaye.reste_a_payer | number:'1.0-2' }} $</td>
                                    <td class="text-right">
                                        <button class="saas-btn-secondary py-1 px-3 text-xs" (click)="goToPaiement(impaye.eleve_id)">
                                            <i class="ph ph-hand-coins mr-1"></i> Payer
                                        </button>
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
        .sc-spin-small { width: 24px; height: 24px; border-radius: 9999px; border: 2px solid #e4e4e7; border-top-color: #4f46e5; animation: sc-spin 0.9s linear infinite; }
        @keyframes sc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `]
})
export class ImpayesComponent implements OnInit, OnDestroy {
    private API_BASE = 'http://207.180.205.248:3007';
    private destroy$ = new Subject<void>();

    isLoading = false;
    impayesLoading = false;
    impayesResults: any[] = [];

    constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private router: Router) { }

    ngOnInit(): void {
        this.loadImpayes();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private authHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    }

    loadImpayes(): void {
        this.impayesLoading = true;
        this.http.get(`${this.API_BASE}/api/gestionnaire/impayes`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => { this.impayesLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    this.impayesResults = res.results || [];
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur chargement impayés:', err);
                    this.cdr.detectChanges();
                }
            });
    }

    getClasseDisplay(impaye: any): string {
        let display = impaye.classe_nom || '';
        if (impaye.classe_section) display += ` ${impaye.classe_section}`;
        if (impaye.classe_option) {
            if (impaye.classe_section) display += `/${impaye.classe_option}`;
            else display += ` ${impaye.classe_option}`;
        }
        return display || '-';
    }

    goToPaiement(eleveId: number): void {
        this.router.navigate(['/gestionnaire/paiements/nouveau'], { queryParams: { eleve: eleveId } });
    }
}