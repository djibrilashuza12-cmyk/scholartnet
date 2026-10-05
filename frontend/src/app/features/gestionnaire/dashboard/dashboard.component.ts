import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize, timeout } from 'rxjs';
import { NgxChartsModule } from '@swimlane/ngx-charts';

interface DashboardData {
    activeYear: { id: number; nom: string } | null;
    totalEncaissement: number;
    paiementsAujourdhui: number;
    montantAujourdhui: number;
    totalRecus: number;
    impayes: number;
    derniersPaiements: any[];
    paiementsParJour: { date: string; total: number; count: number }[];
    repartitionFrais: { nom: string; total: number }[];
}

@Component({
    selector: 'app-gestionnaire-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule, NgxChartsModule, RouterLink],
    template: `
        <div class="space-y-6 animate-fade-in">
            <!-- En-tête -->
            <header class="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-chart-pie-slice text-brand-600"></i> Dashboard Financier
                    </h1>
                    <p class="text-zinc-500 text-sm mt-1">Suivi financier et gestion de l'établissement</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-medium text-zinc-500 bg-white px-3 py-1.5 rounded-lg border border-zinc-200 shadow-sm flex items-center gap-2">
                        <i class="ph ph-calendar-blank text-zinc-400"></i> {{ currentDate | date:'dd MMMM yyyy' }}
                    </span>
                    <button class="saas-btn-secondary" (click)="refreshData()" [disabled]="isLoading || statsLoading">
                        <i class="ph ph-arrows-clockwise mr-1.5" [class.animate-spin]="isLoading || statsLoading"></i>
                        Actualiser
                    </button>
                </div>
            </header>

            <!-- Stats Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="saas-card p-5 hover:border-zinc-300 transition-colors">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <i class="ph ph-coins text-xl"></i>
                        </div>
                        <h3 class="text-zinc-500 text-sm font-medium">Total encaissé</h3>
                    </div>
                    <div class="text-3xl font-bold text-zinc-900" *ngIf="!statsLoading">
                        {{ dashboardData.totalEncaissement | number:'1.0-2' }} $
                    </div>
                    <div class="text-3xl font-bold text-zinc-200 animate-pulse" *ngIf="statsLoading">...</div>
                </div>

                <div class="saas-card p-5 hover:border-zinc-300 transition-colors">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                                <i class="ph ph-trend-up text-xl"></i>
                            </div>
                            <h3 class="text-zinc-500 text-sm font-medium">Aujourd'hui</h3>
                        </div>
                        <span class="text-xs font-medium bg-brand-50 text-brand-700 px-2 py-1 rounded-md border border-brand-100" *ngIf="!statsLoading">
                            {{ dashboardData.paiementsAujourdhui }} trans.
                        </span>
                    </div>
                    <div class="text-3xl font-bold text-zinc-900" *ngIf="!statsLoading">
                        {{ dashboardData.montantAujourdhui | number:'1.0-2' }} $
                    </div>
                    <div class="text-3xl font-bold text-zinc-200 animate-pulse" *ngIf="statsLoading">...</div>
                </div>

                <div class="saas-card p-5 hover:border-zinc-300 transition-colors">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <i class="ph ph-receipt text-xl"></i>
                        </div>
                        <h3 class="text-zinc-500 text-sm font-medium">Reçus émis</h3>
                    </div>
                    <div class="text-3xl font-bold text-zinc-900" *ngIf="!statsLoading">{{ dashboardData.totalRecus }}</div>
                    <div class="text-3xl font-bold text-zinc-200 animate-pulse" *ngIf="statsLoading">...</div>
                </div>

                <div class="saas-card p-5 hover:border-zinc-300 transition-colors">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                            <i class="ph ph-warning-circle text-xl"></i>
                        </div>
                        <h3 class="text-zinc-500 text-sm font-medium">Impayés (Signalements)</h3>
                    </div>
                    <div class="text-3xl font-bold text-red-600" *ngIf="!statsLoading">{{ dashboardData.impayes }}</div>
                    <div class="text-3xl font-bold text-zinc-200 animate-pulse" *ngIf="statsLoading">...</div>
                </div>
            </div>

            <!-- Graphiques -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="saas-card overflow-hidden">
                    <div class="px-6 py-4 border-b border-zinc-100">
                        <h3 class="text-base font-bold text-zinc-900 flex items-center gap-2">
                            <i class="ph ph-chart-line-up text-brand-500"></i> Évolution (30 jours)
                        </h3>
                    </div>
                    <div class="p-4" style="height: 320px;">
                        <ngx-charts-line-chart
                            *ngIf="evolutionData && evolutionData.length > 0 && !statsLoading"
                            [results]="evolutionData"
                            [scheme]="'ocean'"
                            [legend]="false"
                            [xAxis]="true"
                            [yAxis]="true"
                            [animations]="true">
                        </ngx-charts-line-chart>
                        <div *ngIf="(!evolutionData || evolutionData.length === 0) && !statsLoading" class="h-full flex flex-col items-center justify-center text-zinc-400">
                            <i class="ph ph-chart-line text-3xl mb-2 opacity-50"></i>
                            <p class="text-sm">Données insuffisantes</p>
                        </div>
                        <div *ngIf="statsLoading" class="h-full flex items-center justify-center">
                            <i class="ph ph-spinner-gap text-2xl text-zinc-300 animate-spin"></i>
                        </div>
                    </div>
                </div>

                <div class="saas-card overflow-hidden">
                    <div class="px-6 py-4 border-b border-zinc-100">
                        <h3 class="text-base font-bold text-zinc-900 flex items-center gap-2">
                            <i class="ph ph-chart-pie-slice text-brand-500"></i> Répartition par Frais
                        </h3>
                    </div>
                    <div class="p-4" style="height: 320px;">
                        <ngx-charts-pie-chart
                            *ngIf="repartitionData && repartitionData.length > 0 && !statsLoading"
                            [results]="repartitionData"
                            [scheme]="'vivid'"
                            [legend]="true"
                            [labels]="false"
                            [animations]="true"
                            [doughnut]="true"
                            [arcWidth]="0.35">
                        </ngx-charts-pie-chart>
                        <div *ngIf="(!repartitionData || repartitionData.length === 0) && !statsLoading" class="h-full flex flex-col items-center justify-center text-zinc-400">
                            <i class="ph ph-chart-pie text-3xl mb-2 opacity-50"></i>
                            <p class="text-sm">Données insuffisantes</p>
                        </div>
                        <div *ngIf="statsLoading" class="h-full flex items-center justify-center">
                            <i class="ph ph-spinner-gap text-2xl text-zinc-300 animate-spin"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Conteneur pour Actions & Derniers Paiements -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Actions rapides -->
                <div class="lg:col-span-1 space-y-4">
                    <h3 class="text-base font-bold text-zinc-900 mb-2">Actions rapides</h3>
                    
                    <a routerLink="/gestionnaire/paiements/nouveau" class="group flex items-center p-4 bg-white border border-zinc-200 rounded-xl hover:border-brand-300 hover:shadow-soft transition-all">
                        <div class="w-12 h-12 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                            <i class="ph ph-plus-circle text-2xl"></i>
                        </div>
                        <div>
                            <div class="font-semibold text-zinc-900">Encaisser</div>
                            <div class="text-xs text-zinc-500 mt-0.5">Nouveau paiement élève</div>
                        </div>
                        <i class="ph ph-caret-right text-zinc-300 ml-auto group-hover:text-brand-500"></i>
                    </a>
                    
                    <a routerLink="/gestionnaire/impayes" class="group flex items-center p-4 bg-white border border-zinc-200 rounded-xl hover:border-red-300 hover:shadow-soft transition-all">
                        <div class="w-12 h-12 bg-red-50 text-red-600 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                            <i class="ph ph-warning-circle text-2xl"></i>
                        </div>
                        <div>
                            <div class="font-semibold text-zinc-900">Suivre impayés</div>
                            <div class="text-xs text-zinc-500 mt-0.5">Relances et soldes débiteurs</div>
                        </div>
                        <i class="ph ph-caret-right text-zinc-300 ml-auto group-hover:text-red-500"></i>
                    </a>

                    <a routerLink="/gestionnaire/frais" class="group flex items-center p-4 bg-white border border-zinc-200 rounded-xl hover:border-brand-300 hover:shadow-soft transition-all">
                        <div class="w-12 h-12 bg-zinc-100 text-zinc-600 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                            <i class="ph ph-list-dashes text-2xl"></i>
                        </div>
                        <div>
                            <div class="font-semibold text-zinc-900">Grille tarifaire</div>
                            <div class="text-xs text-zinc-500 mt-0.5">Configuration des frais</div>
                        </div>
                        <i class="ph ph-caret-right text-zinc-300 ml-auto group-hover:text-brand-500"></i>
                    </a>
                </div>

                <!-- Derniers paiements -->
                <div class="lg:col-span-2 saas-card overflow-hidden">
                    <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                        <h3 class="text-base font-bold text-zinc-900 flex items-center gap-2">
                            <i class="ph ph-clock-counter-clockwise text-brand-500"></i> Transactions récentes
                        </h3>
                        <a routerLink="/gestionnaire/paiements" class="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline">
                            Voir l'historique complet
                        </a>
                    </div>
                    
                    <div class="p-0">
                        <table class="saas-table" *ngIf="dashboardData.derniersPaiements && dashboardData.derniersPaiements.length > 0">
                            <thead>
                                <tr>
                                    <th>Élève</th>
                                    <th>Frais & Classe</th>
                                    <th class="text-right">Montant</th>
                                    <th class="text-center w-16">Reçu</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let p of dashboardData.derniersPaiements" class="hover:bg-zinc-50/50">
                                    <td>
                                        <div class="font-medium text-zinc-900">{{ p.eleve_nom }} {{ p.eleve_prenom }}</div>
                                        <div class="text-xs text-zinc-500 mt-0.5">{{ p.eleve_matricule }}</div>
                                    </td>
                                    <td>
                                        <div class="text-sm text-zinc-700">{{ p.type_frais }}</div>
                                        <div class="text-xs text-zinc-500 mt-0.5">{{ p.classe_nom }}</div>
                                    </td>
                                    <td class="text-right">
                                        <div class="font-bold text-emerald-600">{{ p.montant_paye | number:'1.0-2' }} $</div>
                                        <div class="text-[10px] text-zinc-400 mt-0.5">{{ p.date_paiement | date:'dd/MM HH:mm' }}</div>
                                    </td>
                                    <td class="text-center">
                                        <button class="text-zinc-400 hover:text-brand-600 transition-colors p-1.5 rounded-md hover:bg-brand-50" (click)="viewRecu(p.id)" title="Voir le reçu">
                                            <i class="ph ph-receipt text-lg"></i>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div *ngIf="(!dashboardData.derniersPaiements || dashboardData.derniersPaiements.length === 0) && !statsLoading" class="p-8 text-center text-zinc-500">
                            <div class="mx-auto w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mb-3">
                                <i class="ph ph-tray text-2xl text-zinc-400"></i>
                            </div>
                            Aucune transaction récente à afficher.
                        </div>
                        <div *ngIf="statsLoading" class="p-8 text-center">
                            <i class="ph ph-spinner-gap text-2xl text-zinc-300 animate-spin"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; }
    `]
})
export class DashboardComponent implements OnInit, OnDestroy {
    private API_BASE = 'http://207.180.205.248:3007';
    private destroy$ = new Subject<void>();

    isLoading = false;
    statsLoading = true;
    currentDate = new Date();

    dashboardData: DashboardData = {
        activeYear: null,
        totalEncaissement: 0,
        paiementsAujourdhui: 0,
        montantAujourdhui: 0,
        totalRecus: 0,
        impayes: 0,
        derniersPaiements: [],
        paiementsParJour: [],
        repartitionFrais: []
    };

    evolutionData: any[] = [];
    repartitionData: any[] = [];

    constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private router: Router) { }

    ngOnInit(): void {
        this.loadDashboard();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private authHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    }

    loadDashboard(): void {
        this.statsLoading = true;
        this.http.get(`${this.API_BASE}/api/gestionnaire/dashboard`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => { this.statsLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    this.dashboardData = res;
                    this.updateCharts();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur dashboard:', err);
                    this.cdr.detectChanges();
                }
            });
    }

    updateCharts(): void {
        // Évolution
        if (this.dashboardData.paiementsParJour && this.dashboardData.paiementsParJour.length > 0) {
            this.evolutionData = [{
                name: 'Encaissements',
                series: this.dashboardData.paiementsParJour.map(d => ({
                    name: d.date,
                    value: d.total
                }))
            }];
        }

        // Répartition
        if (this.dashboardData.repartitionFrais && this.dashboardData.repartitionFrais.length > 0) {
            this.repartitionData = this.dashboardData.repartitionFrais.map(f => ({
                name: f.nom,
                value: f.total
            }));
        }
    }

    refreshData(): void {
        this.loadDashboard();
    }

    viewRecu(id: number): void {
        this.router.navigate(['/gestionnaire/recu', id]);
    }
}