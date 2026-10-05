// src/app/features/admin/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, takeUntil, finalize, timeout } from 'rxjs';

import { NgxChartsModule } from '@swimlane/ngx-charts';

interface AnneeScolaire {
    id: number;
    nom: string;
    date_debut: string;
    date_fin: string;
    statut: 'OUVERTE' | 'CLOTUREE';
    total_inscriptions: number;
}

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule, NgxChartsModule],
    template: `
        <!-- Spinner global -->
        <div *ngIf="isLoading" class="fixed inset-0 z-[9999] flex items-center justify-center bg-white/50 backdrop-blur-sm animate-fade-in">
            <div class="flex flex-col items-center">
                <i class="ph ph-spinner-gap text-4xl text-brand-600 animate-spin"></i>
                <div class="mt-3 text-zinc-600 text-sm font-medium">Chargement...</div>
            </div>
        </div>

        <div class="space-y-6 animate-fade-in">
            <!-- En-tête avec déconnexion -->
            <header class="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-shield-star text-brand-600"></i> Administration
                    </h1>
                    <p class="text-zinc-500 text-sm mt-1">Gestion globale de l'établissement</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-medium text-zinc-500 hidden sm:inline-block bg-white px-3 py-1.5 border border-zinc-200 rounded-lg shadow-sm">
                        {{ currentDate | date:'dd MMMM yyyy' }}
                    </span>
                    <button class="saas-btn-secondary h-9" (click)="refreshData()" [disabled]="isLoading">
                        <i class="ph ph-arrows-clockwise text-lg"></i>
                    </button>
                    <!-- Le bouton déconnexion est dans la sidebar en principe, mais gardons-le s'il est ici -->
                </div>
            </header>

            <!-- Statistiques Rapides -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="saas-card p-5 flex flex-col hover:border-brand-200 transition-colors cursor-default relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 text-brand-50 opacity-50 pointer-events-none">
                        <i class="ph-fill ph-student text-8xl"></i>
                    </div>
                    <h3 class="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Élèves</h3>
                    <div class="text-3xl font-bold text-zinc-900 relative z-10" *ngIf="!statsLoading">{{ stats.eleves || 0 }}</div>
                    <div class="text-3xl font-bold text-zinc-200 animate-pulse relative z-10" *ngIf="statsLoading">...</div>
                </div>
                <div class="saas-card p-5 flex flex-col hover:border-purple-200 transition-colors cursor-default relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 text-purple-50 opacity-50 pointer-events-none">
                        <i class="ph-fill ph-users text-8xl"></i>
                    </div>
                    <h3 class="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Utilisateurs</h3>
                    <div class="text-3xl font-bold text-zinc-900 relative z-10" *ngIf="!statsLoading">{{ stats.utilisateurs || 0 }}</div>
                    <div class="text-3xl font-bold text-zinc-200 animate-pulse relative z-10" *ngIf="statsLoading">...</div>
                </div>
                <div class="saas-card p-5 flex flex-col hover:border-blue-200 transition-colors cursor-default relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 text-blue-50 opacity-50 pointer-events-none">
                        <i class="ph-fill ph-books text-8xl"></i>
                    </div>
                    <h3 class="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Classes</h3>
                    <div class="text-3xl font-bold text-zinc-900 relative z-10" *ngIf="!statsLoading">{{ stats.classes || 0 }}</div>
                    <div class="text-3xl font-bold text-zinc-200 animate-pulse relative z-10" *ngIf="statsLoading">...</div>
                </div>
                <div class="saas-card p-5 flex flex-col hover:border-emerald-200 transition-colors cursor-default relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 text-emerald-50 opacity-50 pointer-events-none">
                        <i class="ph-fill ph-calendar-check text-8xl"></i>
                    </div>
                    <h3 class="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">Année active</h3>
                    <div class="text-lg font-bold text-zinc-900 truncate relative z-10" *ngIf="!yearLoading && activeYear">{{ activeYear.nom }}</div>
                    <div class="text-lg font-bold text-zinc-200 animate-pulse relative z-10" *ngIf="yearLoading">...</div>
                    <div class="text-xs font-medium text-emerald-600 bg-emerald-50 w-max px-2 py-0.5 rounded mt-1 relative z-10" *ngIf="!yearLoading && activeYear">Ouverte</div>
                    <div class="text-sm text-zinc-400 relative z-10" *ngIf="!yearLoading && !activeYear">Aucune année</div>
                </div>
            </div>

            <!-- Onglets (Tabs) Façon SaaS -->
            <div class="flex items-center gap-2 border-b border-zinc-200 pb-0 mt-8">
                <button 
                    class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
                    [ngClass]="activeTab === 'dashboard' ? 'border-brand-600 text-brand-600' : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'"
                    (click)="activeTab = 'dashboard'">
                    <i class="ph ph-magnifying-glass"></i> Recherche
                </button>
                <button 
                    class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
                    [ngClass]="activeTab === 'users' ? 'border-brand-600 text-brand-600' : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'"
                    (click)="activeTab = 'users'; loadUsers()">
                    <i class="ph ph-users-three"></i> Comptes
                </button>
                <button 
                    class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
                    [ngClass]="activeTab === 'annee' ? 'border-brand-600 text-brand-600' : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'"
                    (click)="activeTab = 'annee'">
                    <i class="ph ph-calendar-plus"></i> Année
                </button>
                <button 
                    class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
                    [ngClass]="activeTab === 'archives' ? 'border-brand-600 text-brand-600' : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'"
                    (click)="activeTab = 'archives'; loadArchives()">
                    <i class="ph ph-archive"></i> Archives
                </button>
            </div>

            <!-- TAB: Dashboard (Recherche) -->
            <div *ngIf="activeTab === 'dashboard'" class="animate-fade-in mt-6">
                <div class="saas-card p-8 bg-gradient-to-br from-white to-zinc-50/50">
                    <div class="max-w-2xl mx-auto text-center">
                        <div class="w-16 h-16 bg-white border border-zinc-200 shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <i class="ph ph-address-book text-3xl text-brand-600"></i>
                        </div>
                        <h2 class="text-xl font-bold text-zinc-900 mb-2">Registre Numérique Central</h2>
                        <p class="text-zinc-500 text-sm mb-6">Recherchez instantanément un élève, enseignant ou membre du personnel par son nom, prénom ou numéro de matricule.</p>
                        
                        <div class="relative max-w-xl mx-auto">
                            <i class="ph ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-xl text-zinc-400"></i>
                            <input 
                                class="saas-input pl-12 pr-12 py-3 text-base shadow-sm" 
                                type="text" 
                                [(ngModel)]="searchQuery" 
                                (input)="onSearchInput()"
                                placeholder="Taper un matricule (MAT-...) ou un nom..." 
                                [disabled]="isLoading"
                            />
                            <div *ngIf="searchLoading" class="absolute right-4 top-1/2 -translate-y-1/2">
                                <i class="ph ph-spinner-gap animate-spin text-brand-500 text-xl"></i>
                            </div>
                        </div>
                        
                        <!-- Résultats de recherche -->
                        <div *ngIf="searchResults.length > 0" class="mt-6 text-left border border-zinc-200 rounded-xl bg-white shadow-sm overflow-hidden max-h-80 overflow-y-auto">
                            <div 
                                *ngFor="let result of searchResults; let last = last" 
                                class="flex items-center justify-between p-4 hover:bg-zinc-50 cursor-pointer transition-colors"
                                [class.border-b]="!last"
                                [class.border-zinc-100]="!last"
                                (click)="openProfileModal(result)"
                            >
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm">
                                        {{ result.utilisateur_nom?.charAt(0) }}{{ result.utilisateur_prenom?.charAt(0) }}
                                    </div>
                                    <div>
                                        <div class="font-semibold text-zinc-900">{{ result.utilisateur_nom }} {{ result.utilisateur_prenom }}</div>
                                        <div class="text-xs text-zinc-500 font-mono mt-0.5">{{ result.utilisateur_matricule }}</div>
                                    </div>
                                </div>
                                <div>
                                    <span class="px-2.5 py-1 rounded-md text-xs font-medium border bg-white shadow-sm"
                                          [ngClass]="{
                                            'text-blue-700 border-blue-200': result.role === 'ADMIN',
                                            'text-emerald-700 border-emerald-200': result.role === 'GESTIONNAIRE',
                                            'text-purple-700 border-purple-200': result.role === 'SECRETAIRE',
                                            'text-amber-700 border-amber-200': result.role === 'TITULAIRE'
                                          }">
                                        {{ result.role }}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div *ngIf="searchError" class="text-red-500 text-sm mt-4 font-medium flex justify-center items-center gap-1.5">
                            <i class="ph ph-warning-circle"></i> {{ searchError }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB: Utilisateurs -->
            <div *ngIf="activeTab === 'users'" class="animate-fade-in mt-6 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 class="text-lg font-bold text-zinc-900">Comptes Utilisateurs</h2>
                    <button class="saas-btn-primary text-sm" (click)="openCreateUserModal = true" [disabled]="isLoading">
                        <i class="ph ph-plus-circle mr-1.5 text-lg"></i> Nouveau compte
                    </button>
                </div>

                <div *ngIf="usersError" class="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                    <i class="ph ph-warning-circle mt-0.5 text-lg"></i> {{ usersError }}
                </div>

                <div class="saas-table-container">
                    <div class="saas-table-scroll">
                        <table class="saas-table">
                            <thead>
                                <tr>
                                    <th>Matricule</th>
                                    <th>Identité</th>
                                    <th>Rôle</th>
                                    <th>Statut</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let u of usersResults" class="group">
                                    <td class="font-mono text-xs text-zinc-500">{{ u.matricule }}</td>
                                    <td>
                                        <div class="font-medium text-zinc-900">{{ u.nom }} {{ u.prenom }}</div>
                                        <div class="text-xs text-zinc-400">{{ u.email || '-' }}</div>
                                    </td>
                                    <td>
                                        <span class="saas-badge-neutral">{{ u.role }}</span>
                                    </td>
                                    <td>
                                        <span class="inline-flex items-center gap-1.5" [class]="u.is_active ? 'text-emerald-600' : 'text-red-600'">
                                            <span class="w-1.5 h-1.5 rounded-full" [class]="u.is_active ? 'bg-emerald-500' : 'bg-red-500'"></span>
                                            <span class="text-xs font-medium">{{ u.is_active ? 'Actif' : 'Inactif' }}</span>
                                        </span>
                                    </td>
                                    <td class="text-right">
                                        <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button class="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" (click)="resendUserInvite(u)" title="Renvoyer le lien d'activation / mot de passe (valable 1 mois)">
                                                <i class="ph ph-paper-plane-tilt text-lg"></i>
                                            </button>
                                            <button class="p-1.5 text-zinc-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors" (click)="openEditUserModal(u)" title="Éditer">
                                                <i class="ph ph-pencil-simple text-lg"></i>
                                            </button>
                                            <button class="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" (click)="openDeleteUserModal(u.id)" title="Supprimer">
                                                <i class="ph ph-trash text-lg"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                <tr *ngIf="usersLoading">
                                    <td colspan="5" class="py-12 text-center text-zinc-400">
                                        <i class="ph ph-spinner-gap animate-spin text-3xl mb-2"></i>
                                        <p class="text-sm">Chargement des comptes...</p>
                                    </td>
                                </tr>
                                <tr *ngIf="!usersLoading && usersResults.length === 0">
                                    <td colspan="5" class="py-12 text-center text-zinc-400">
                                        <i class="ph ph-users-three text-3xl mb-2"></i>
                                        <p class="text-sm">Aucun compte trouvé.</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Pagination (Si on veut l'intégrer au footer du tableau) -->
                    <div class="px-4 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between sm:px-6">
                        <div class="hidden sm:block text-sm text-zinc-500">
                            Total: <span class="font-medium text-zinc-900">{{ usersTotal }}</span> résultats
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="saas-btn-secondary px-2.5 py-1.5" (click)="prevPage()" [disabled]="usersPage <= 1 || usersLoading || isLoading">
                                <i class="ph ph-caret-left text-lg"></i>
                            </button>
                            <span class="text-sm text-zinc-600 font-medium px-2">Page {{ usersPage }} sur {{ usersLastPage }}</span>
                            <button class="saas-btn-secondary px-2.5 py-1.5" (click)="nextPage()" [disabled]="usersPage >= usersLastPage || usersLoading || isLoading">
                                <i class="ph ph-caret-right text-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB: Année scolaire -->
            <div *ngIf="activeTab === 'annee'" class="animate-fade-in mt-6 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 class="text-lg font-bold text-zinc-900">Année Scolaire Active</h2>
                    <button class="saas-btn-primary text-sm" (click)="openYearModal = true" [disabled]="yearSubmitting || isLoading || activeYear">
                        <i class="ph ph-calendar-plus mr-1.5 text-lg"></i> Ouvrir une nouvelle année
                    </button>
                </div>

                <div *ngIf="!yearLoading && activeYear" class="saas-card p-6 md:p-8 bg-gradient-to-r from-emerald-50 to-white border-emerald-100">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                            <i class="ph ph-calendar-check text-2xl"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-bold text-zinc-900">{{ activeYear.nom }}</h3>
                            <span class="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Année Ouverte
                            </span>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-emerald-100/50">
                        <div>
                            <div class="text-xs font-semibold uppercase tracking-wider text-emerald-600/70 mb-1">Période</div>
                            <div class="text-zinc-800 font-medium">Du {{ formatDateDisplay(activeYear.date_debut) }} au {{ formatDateDisplay(activeYear.date_fin) }}</div>
                        </div>
                        <div>
                            <div class="text-xs font-semibold uppercase tracking-wider text-emerald-600/70 mb-1">Inscriptions enregistrées</div>
                            <div class="text-zinc-800 font-medium text-xl">{{ activeYear.total_inscriptions || 0 }}</div>
                        </div>
                    </div>
                </div>

                <div *ngIf="!yearLoading && !activeYear" class="saas-card p-12 text-center border-dashed border-zinc-300 bg-transparent shadow-none">
                    <div class="w-16 h-16 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="ph ph-calendar-slash text-3xl"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-zinc-900 mb-1">Aucune année active</h3>
                    <p class="text-zinc-500 text-sm mb-6 max-w-sm mx-auto">Toutes les opérations système sont bloquées jusqu'à l'ouverture officielle d'une nouvelle année scolaire.</p>
                    <button class="saas-btn-primary" (click)="openYearModal = true">Ouvrir l'année maintenant</button>
                </div>

                <div *ngIf="yearLoading" class="py-12 text-center text-zinc-400">
                    <i class="ph ph-spinner-gap animate-spin text-3xl mb-2"></i>
                </div>
            </div>

            <!-- TAB: Archives -->
            <div *ngIf="activeTab === 'archives'" class="animate-fade-in mt-6 space-y-4">
                
                <!-- Sous-navigation des Archives -->
                <div class="flex items-center gap-1 border-b border-zinc-200 pb-px mb-4 overflow-x-auto no-scrollbar">
                    <button (click)="activeArchiveSubTab = 'years'"
                            class="px-4 py-2 text-xs uppercase font-extrabold tracking-wider transition-all whitespace-nowrap"
                            [class]="activeArchiveSubTab === 'years' ? 'border-brand-600 text-brand-600 border-b-2' : 'border-transparent text-zinc-500 hover:text-zinc-800'">
                        <i class="ph ph-calendar-blank mr-1.5 text-sm"></i> Années scolaires
                    </button>
                    <button (click)="activeArchiveSubTab = 'search'; initArchiveSearchTab()"
                            class="px-4 py-2 text-xs uppercase font-extrabold tracking-wider transition-all whitespace-nowrap"
                            [class]="activeArchiveSubTab === 'search' ? 'border-brand-600 text-brand-600 border-b-2' : 'border-transparent text-zinc-500 hover:text-zinc-800'">
                        <i class="ph ph-magnifying-glass mr-1.5 text-sm"></i> Recherche & Bulletins
                    </button>
                </div>

                <!-- Sous-onglet: Liste des années -->
                <div *ngIf="activeArchiveSubTab === 'years'" class="space-y-4">
                    <div class="flex items-center justify-between">
                        <h2 class="text-lg font-bold text-zinc-900">Historique des Années Scolaires</h2>
                    </div>
                    
                    <div class="saas-table-container">
                        <div class="saas-table-scroll">
                            <table class="saas-table">
                                <thead>
                                    <tr>
                                        <th>Année</th>
                                        <th>Période</th>
                                        <th>Statut</th>
                                        <th class="text-right">Inscriptions</th>
                                        <th class="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr *ngFor="let annee of archivesResults">
                                        <td class="font-semibold text-zinc-900">{{ annee.nom }}</td>
                                        <td class="text-sm text-zinc-600">
                                            {{ formatDate(annee.date_debut) }} — {{ formatDate(annee.date_fin) }}
                                        </td>
                                        <td>
                                            <span class="inline-flex items-center gap-1.5" [class]="annee.statut === 'OUVERTE' ? 'text-emerald-600' : 'text-zinc-500'">
                                                <span class="w-1.5 h-1.5 rounded-full" [class]="annee.statut === 'OUVERTE' ? 'bg-emerald-500' : 'bg-zinc-400'"></span>
                                                <span class="text-xs font-medium">{{ annee.statut === 'OUVERTE' ? 'Ouverte' : 'Clôturée' }}</span>
                                            </span>
                                        </td>
                                        <td class="text-right font-medium text-zinc-900">{{ annee.total_inscriptions || 0 }}</td>
                                        <td class="text-center">
                                            <button *ngIf="annee.statut === 'OUVERTE'" class="saas-btn-danger text-xs px-3 py-1.5" 
                                                    (click)="cloturerAnnee(annee.id)" [disabled]="isLoading">
                                                <i class="ph ph-lock-key mr-1"></i> Clôturer
                                            </button>
                                            <span *ngIf="annee.statut === 'CLOTUREE'" class="text-xs text-zinc-400 font-medium">
                                                <i class="ph ph-check-circle mr-1"></i> Archivée
                                            </span>
                                        </td>
                                    </tr>
                                    <tr *ngIf="archivesLoading">
                                        <td colspan="5" class="py-12 text-center text-zinc-400">
                                            <i class="ph ph-spinner-gap animate-spin text-3xl mb-2"></i>
                                            <p class="text-sm">Chargement des archives...</p>
                                        </td>
                                    </tr>
                                    <tr *ngIf="!archivesLoading && archivesResults.length === 0">
                                        <td colspan="5" class="py-12 text-center text-zinc-400">
                                            <i class="ph ph-archive-box text-3xl mb-2"></i>
                                            <p class="text-sm">Aucune archive disponible.</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Sous-onglet: Recherche & Bulletins -->
                <div *ngIf="activeArchiveSubTab === 'search'" class="space-y-4">
                    <div class="saas-card p-5 bg-gradient-to-br from-white to-zinc-50/50">
                        <div class="flex flex-col md:flex-row gap-4 items-end">
                            <div class="flex-1 md:max-w-xs">
                                <label class="saas-label font-bold text-zinc-700">Année Scolaire *</label>
                                <select class="saas-input h-10" [(ngModel)]="archiveSearchYearId">
                                    <option [ngValue]="null">--- Choisir une année ---</option>
                                    <option *ngFor="let a of archivesResults" [ngValue]="a.id">
                                        {{ a.nom }} {{ a.statut === 'OUVERTE' ? '(En cours)' : '(Archivée)' }}
                                    </option>
                                </select>
                            </div>
                            <div class="flex-1">
                                <label class="saas-label font-bold text-zinc-700">Nom ou Matricule de l'Élève</label>
                                <div class="relative">
                                    <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
                                    <input class="saas-input pl-10 h-10" type="text" [(ngModel)]="archiveSearchQuery" 
                                           (keyup.enter)="searchArchivedEleves()" placeholder="Rechercher par nom, prénom ou matricule..." />
                                </div>
                            </div>
                            <div>
                                <button class="saas-btn-primary h-10 px-6 font-extrabold whitespace-nowrap" (click)="searchArchivedEleves()" [disabled]="archiveSearchLoading">
                                    <i class="ph ph-spinner-gap animate-spin mr-1.5" *ngIf="archiveSearchLoading"></i>
                                    <i class="ph ph-magnifying-glass mr-1.5" *ngIf="!archiveSearchLoading"></i>
                                    Rechercher dans l'archive
                                </button>
                            </div>
                        </div>
                        <div *ngIf="archiveSearchError" class="text-red-500 text-xs font-bold mt-2">{{ archiveSearchError }}</div>
                    </div>

                    <div class="saas-table-container">
                        <div class="saas-table-scroll">
                            <table class="saas-table">
                                <thead>
                                    <tr>
                                        <th>Matricule</th>
                                        <th>Élève</th>
                                        <th>Sexe</th>
                                        <th>Classe Historique</th>
                                        <th class="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr *ngFor="let row of archiveSearchResults" class="group">
                                        <td class="font-mono text-xs font-bold text-zinc-500">{{ row.eleve_matricule }}</td>
                                        <td>
                                            <div class="font-bold text-zinc-900">{{ row.eleve_nom }} {{ row.eleve_prenom }} {{ row.eleve_postnom || '' }}</div>
                                        </td>
                                        <td>
                                            <span class="saas-badge-neutral" [class.bg-blue-50]="row.eleve_sexe === 'M'" [class.text-blue-700]="row.eleve_sexe === 'M'" [class.bg-pink-50]="row.eleve_sexe === 'F'" [class.text-pink-700]="row.eleve_sexe === 'F'">
                                                {{ row.eleve_sexe === 'M' ? 'Masculin' : 'Féminin' }}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="text-sm font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded border border-brand-100">
                                                {{ row.classe_nom }} {{ row.classe_section ? '(' + row.classe_section + ')' : '' }}
                                            </span>
                                        </td>
                                        <td class="text-center">
                                            <button class="saas-btn-secondary text-xs px-3 py-1.5 font-bold" (click)="openArchivedBulletin(row.inscription_id)">
                                                <i class="ph ph-file-text mr-1"></i> Voir le bulletin
                                            </button>
                                        </td>
                                    </tr>
                                    <tr *ngIf="archiveSearchLoading">
                                        <td colspan="5" class="py-12 text-center text-zinc-400">
                                            <i class="ph ph-spinner-gap animate-spin text-3xl mb-2"></i>
                                            <p class="text-sm">Recherche en cours dans les archives...</p>
                                        </td>
                                    </tr>
                                    <tr *ngIf="!archiveSearchLoading && archiveSearchResults.length === 0">
                                        <td colspan="5" class="py-12 text-center text-zinc-400">
                                            <i class="ph ph-tray text-3xl mb-2"></i>
                                            <p class="text-sm">Sélectionnez l'année et saisissez une recherche pour charger les bulletins.</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Les modales gardent leur logique, on met juste à jour leur style -->
        
        <!-- MODALE: Bulletin Archivé -->
        <div *ngIf="bulletinModalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'bulletinModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-4xl p-0 relative z-10 animate-slide-up shadow-modal flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
                <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 flex-shrink-0">
                    <div>
                        <h3 class="text-lg font-bold text-zinc-900">Bulletin de Notes Historique</h3>
                        <p class="text-zinc-500 text-xs mt-0.5">Consultation administrative et impression du bulletin</p>
                    </div>
                    <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="bulletinModalOpen = false"><i class="ph ph-x text-xl"></i></button>
                </div>
                
                <!-- Sélection de la Période -->
                <div class="px-6 py-3 bg-zinc-50 border-b border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-shrink-0">
                    <div class="flex items-center gap-3">
                        <label class="text-xs font-bold uppercase tracking-wider text-zinc-400 whitespace-nowrap">Période scolaire :</label>
                        <select class="saas-input h-8 py-0.5 text-xs font-bold w-48" [(ngModel)]="selectedPeriodeIdForBulletin" (change)="onArchivePeriodChange()">
                            <option *ngFor="let p of periodsList" [ngValue]="p.id">{{ p.nom }}</option>
                        </select>
                    </div>
                    <div>
                        <button class="saas-btn-primary h-8 text-xs font-extrabold px-4" (click)="imprimerBulletinArchive()" [disabled]="!bulletinData || bulletinLoading">
                            <i class="ph ph-printer mr-1"></i> Imprimer / Exporter PDF
                        </button>
                    </div>
                </div>

                <div class="p-6 overflow-y-auto flex-1">
                    <!-- Loading state -->
                    <div *ngIf="bulletinLoading" class="py-24 text-center text-zinc-400">
                        <i class="ph ph-spinner-gap animate-spin text-4xl mb-3 text-brand-500"></i>
                        <p class="text-sm font-bold">Calcul des points, pourcentages et classements...</p>
                    </div>

                    <!-- Error state -->
                    <div *ngIf="bulletinError" class="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm font-bold">
                        {{ bulletinError }}
                    </div>

                    <!-- Bulletin Content -->
                    <div *ngIf="!bulletinLoading && bulletinData" class="space-y-6">
                        
                        <!-- Header / Info élève -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-xs">
                            <div class="space-y-1">
                                <div class="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Identité de l'Élève</div>
                                <div class="text-sm font-black text-zinc-900">{{ bulletinData.eleve.nom }} {{ bulletinData.eleve.prenom }} {{ bulletinData.eleve.postnom || '' }}</div>
                                <div class="font-mono text-zinc-500">Matricule : {{ bulletinData.eleve.matricule }}</div>
                                <div class="text-zinc-500 font-medium">Sexe : {{ bulletinData.eleve.sexe === 'M' ? 'Masculin' : 'Féminin' }}</div>
                            </div>
                            <div class="space-y-1">
                                <div class="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Classe et Année</div>
                                <div class="text-sm font-bold text-brand-700">{{ bulletinData.classe.nom }} {{ bulletinData.classe.section ? '(' + bulletinData.classe.section + ')' : '' }}</div>
                                <div class="text-zinc-600 font-medium">Option : {{ bulletinData.classe.option || 'Générale' }}</div>
                                <div class="text-zinc-600 font-medium">Année Scolaire : {{ bulletinData.anneeScolaire }}</div>
                            </div>
                            <div class="space-y-1 md:text-right">
                                <div class="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Période Consultée</div>
                                <div class="text-sm font-bold text-zinc-900 uppercase">{{ bulletinData.periode }}</div>
                                <div class="text-zinc-500 font-medium">Établissement : {{ bulletinData.ecole.nom }}</div>
                            </div>
                        </div>

                        <!-- Tableau des branches / Notes -->
                        <div class="saas-table-container">
                            <table class="saas-table">
                                <thead>
                                    <tr>
                                        <th class="text-left">Branches / Cours</th>
                                        <th class="text-center">Note Obtenue</th>
                                        <th class="text-center">Pourcentage branché</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr *ngFor="let item of bulletinData.notes">
                                        <td class="font-bold text-zinc-800 text-left">{{ item.cours }}</td>
                                        <td class="text-center font-bold">
                                            <span *ngIf="item.note !== null" [class.text-red-600]="item.note < (item.max / 2)">{{ item.note }} / {{ item.max }}</span>
                                            <span *ngIf="item.note === null" class="text-zinc-400 italic">Non encodée</span>
                                        </td>
                                        <td class="text-center">
                                            <span *ngIf="item.pourcentage !== null" [class.text-red-600]="item.pourcentage < 50" class="font-bold">{{ item.pourcentage }} %</span>
                                            <span *ngIf="item.pourcentage === null" class="text-zinc-400">-</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Totaux, Rangs et Pourcentages -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div class="saas-card p-4 bg-brand-50 border-brand-100 text-center">
                                <div class="text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-1">Total Points</div>
                                <div class="text-lg font-black text-brand-900">
                                    {{ bulletinData.totalPointsObtenus }} / {{ bulletinData.totalPointsMax }}
                                </div>
                            </div>
                            <div class="saas-card p-4 bg-emerald-50 border-emerald-100 text-center">
                                <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Pourcentage Global</div>
                                <div class="text-lg font-black text-emerald-900">
                                    {{ bulletinData.pourcentageGlobal !== null ? bulletinData.pourcentageGlobal + ' %' : '-' }}
                                </div>
                            </div>
                            <div class="saas-card p-4 bg-purple-50 border-purple-100 text-center">
                                <div class="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-1">Rang de l'Élève</div>
                                <div class="text-lg font-black text-purple-900">
                                    <span *ngIf="bulletinData.rang !== null">{{ bulletinData.rang }}<sup>e</sup></span>
                                    <span *ngIf="bulletinData.rang === null" class="text-xs text-zinc-400 font-medium">Non classé</span>
                                </div>
                            </div>
                            <div class="saas-card p-4 bg-zinc-50 border-zinc-200 text-center">
                                <div class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Présence / Conduite</div>
                                <div class="text-lg font-bold text-zinc-700">
                                    {{ bulletinData.presences.presents }} / {{ bulletinData.presences.total }} Jours
                                </div>
                            </div>
                        </div>

                        <!-- Observations de discipline / appréciations -->
                        <div class="border border-zinc-200 p-4 rounded-xl bg-zinc-50/50">
                            <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Remarques de discipline & appréciations</h4>
                            <div class="space-y-2">
                                <div *ngFor="let app of bulletinData.appreciations" class="text-xs text-zinc-600 flex justify-between border-b border-zinc-100 pb-1.5 last:border-b-0">
                                    <span>• {{ app.observation_discipline }}</span>
                                    <span class="text-[10px] font-mono text-zinc-400">{{ formatDate(app.date_jour) }}</span>
                                </div>
                                <div *ngIf="bulletinData.appreciations.length === 0" class="text-xs text-zinc-400 italic">Aucune observation enregistrée pour cette période.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end flex-shrink-0">
                    <button class="saas-btn-secondary" (click)="bulletinModalOpen = false">Fermer</button>
                </div>
            </div>
        </div>

        <!-- Modale Profil Utilisateur -->
        <div *ngIf="profileModalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'profileModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-2xl p-0 relative z-10 animate-slide-up shadow-modal overflow-hidden flex flex-col max-h-[90vh]">
                <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                    <h3 class="text-lg font-bold text-zinc-900">Profil Utilisateur</h3>
                    <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="profileModalOpen = false"><i class="ph ph-x text-xl"></i></button>
                </div>
                
                <div class="p-6 overflow-y-auto">
                    <!-- En-tête profil -->
                    <div class="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100">
                        <div class="w-16 h-16 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xl font-bold">
                            {{ profileData?.utilisateur_nom?.charAt(0) }}{{ profileData?.utilisateur_prenom?.charAt(0) }}
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-zinc-900">{{ profileData?.utilisateur_nom }} {{ profileData?.utilisateur_prenom }}</h2>
                            <div class="flex items-center gap-3 mt-1">
                                <span class="text-sm text-zinc-500 font-mono"><i class="ph ph-identification-badge"></i> {{ profileData?.utilisateur_matricule }}</span>
                                <span class="saas-badge-neutral text-[10px]">{{ profileData?.role }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Grille d'infos -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <div>
                            <div class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Sexe</div>
                            <div class="text-sm text-zinc-900 font-medium">{{ profileData?.genre === 'M' ? 'Masculin' : profileData?.genre === 'F' ? 'Féminin' : '-' }}</div>
                        </div>
                        <div>
                            <div class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Date et lieu de naissance</div>
                            <div class="text-sm text-zinc-900 font-medium">{{ profileData?.date_naissance || '-' }} à {{ profileData?.lieu_naissance || '-' }}</div>
                        </div>
                        <div class="sm:col-span-2">
                            <div class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Adresse complète</div>
                            <div class="text-sm text-zinc-900 font-medium">{{ profileData?.adresse || '-' }}</div>
                        </div>
                        <hr class="sm:col-span-2 border-zinc-100 my-2">
                        <div>
                            <div class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Niveau d'étude</div>
                            <div class="text-sm text-zinc-900 font-medium">{{ profileData?.niveau_etude || '-' }}</div>
                        </div>
                        <div>
                            <div class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Postnom</div>
                            <div class="text-sm text-zinc-900 font-medium">{{ profileData?.postnom || '-' }}</div>
                        </div>
                        <div>
                            <div class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Nom du père</div>
                            <div class="text-sm text-zinc-900 font-medium">{{ profileData?.nom_pere || '-' }}</div>
                        </div>
                        <div>
                            <div class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Nom de la mère</div>
                            <div class="text-sm text-zinc-900 font-medium">{{ profileData?.nom_mere || '-' }}</div>
                        </div>
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
                    <button class="saas-btn-secondary" (click)="profileModalOpen = false">Fermer</button>
                    <button class="saas-btn-primary" (click)="profileModalOpen = false; openEditUserModal(profileData)">
                        <i class="ph ph-pencil-simple mr-1.5"></i> Éditer
                    </button>
                </div>
            </div>
        </div>

        <!-- MODALE: Ouvrir Année -->
        <div *ngIf="openYearModal" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'openYearModal')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-md p-0 relative z-10 animate-slide-up shadow-modal" (click)="$event.stopPropagation()">
                <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-zinc-900">Ouvrir l'année scolaire</h3>
                    <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="openYearModal = false"><i class="ph ph-x text-xl"></i></button>
                </div>
                
                <div class="p-6 space-y-4">
                    <div>
                        <label class="saas-label">Intitulé généré</label>
                        <input class="saas-input bg-zinc-50 text-zinc-500" type="text" [(ngModel)]="yearForm.nom" placeholder="Ex: 2023-2024" disabled />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="saas-label">Date de début</label>
                            <input class="saas-input" type="date" [(ngModel)]="yearForm.date_debut" (change)="updateYearName()" />
                        </div>
                        <div>
                            <label class="saas-label">Date de fin</label>
                            <input class="saas-input" type="date" [(ngModel)]="yearForm.date_fin" (change)="updateYearName()" />
                        </div>
                    </div>
                    <div *ngIf="yearError" class="text-red-500 text-sm mt-2 font-medium flex items-center gap-1.5">
                        <i class="ph ph-warning-circle"></i> {{ yearError }}
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
                    <button class="saas-btn-secondary" (click)="openYearModal = false">Annuler</button>
                    <button class="saas-btn-primary" (click)="submitOpenYear()" [disabled]="yearSubmitting || isLoading">
                        <i class="ph ph-check-circle mr-1.5" *ngIf="!yearSubmitting"></i>
                        <i class="ph ph-spinner-gap animate-spin mr-1.5" *ngIf="yearSubmitting"></i>
                        Confirmer
                    </button>
                </div>
            </div>
        </div>

        <!-- MODALE: Supprimer utilisateur -->
        <div *ngIf="openDeleteUserModalFlag" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'openDeleteUserModalFlag')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-sm p-6 relative z-10 animate-slide-up shadow-modal text-center" (click)="$event.stopPropagation()">
                <div class="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="ph ph-trash text-2xl"></i>
                </div>
                <h3 class="text-lg font-bold text-zinc-900 mb-2">Supprimer le compte ?</h3>
                <p class="text-zinc-500 text-sm mb-6">Cette action est définitive et supprimera l'accès au système pour cet utilisateur.</p>
                
                <div *ngIf="deleteUserError" class="text-red-500 text-sm mb-4 font-medium">{{ deleteUserError }}</div>
                
                <div class="flex gap-3">
                    <button class="saas-btn-secondary flex-1" (click)="openDeleteUserModalFlag = false">Annuler</button>
                    <button class="saas-btn-danger flex-1" (click)="submitDeleteUser()" [disabled]="deleteUserSubmitting || isLoading">
                        Supprimer
                    </button>
                </div>
            </div>
        </div>

        <!-- MODALE: Créer/Éditer Utilisateur (Version raccourcie pour l'exemple, à styliser similairement avec saas-input) -->
        <!-- Je garde l'implémentation complète TS en dessous, je n'ai touché qu'au template principal -->
        
        <!-- Créer -->
        <div *ngIf="openCreateUserModal" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'openCreateUserModal')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-3xl p-0 relative z-10 animate-slide-up shadow-modal max-h-[90vh] flex flex-col" (click)="$event.stopPropagation()">
                <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                    <div>
                        <h3 class="text-lg font-bold text-zinc-900">Nouveau compte utilisateur</h3>
                        <p class="text-xs text-zinc-500 mt-0.5">Le matricule sera généré automatiquement.</p>
                    </div>
                    <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="openCreateUserModal = false"><i class="ph ph-x text-xl"></i></button>
                </div>
                
                <div class="p-6 overflow-y-auto space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div><label class="saas-label">Nom *</label><input class="saas-input" type="text" [(ngModel)]="createUserForm.nom" /></div>
                        <div><label class="saas-label">Prénom *</label><input class="saas-input" type="text" [(ngModel)]="createUserForm.prenom" /></div>
                        <div><label class="saas-label">Email de connexion *</label><input class="saas-input" type="email" [(ngModel)]="createUserForm.email" placeholder="utilisateur@ecole.cd" /></div>
                        <div>
                            <label class="saas-label">Rôle *</label>
                            <select class="saas-input" [(ngModel)]="createUserForm.role">
                                <option value="ADMIN">Administrateur</option>
                                <option value="GESTIONNAIRE">Gestionnaire (Finance)</option>
                                <option value="SECRETAIRE">Secrétaire</option>
                                <option value="TITULAIRE">Titulaire (Professeur)</option>
                            </select>
                        </div>
                        <div>
                            <label class="saas-label">Sexe</label>
                            <select class="saas-input" [(ngModel)]="createUserForm.sexe">
                                <option [ngValue]="null">—</option>
                                <option value="M">Masculin</option>
                                <option value="F">Féminin</option>
                            </select>
                        </div>
                        <!-- Reste des champs -->
                        <div><label class="saas-label">Date naissance</label><input class="saas-input" type="date" [(ngModel)]="createUserForm.date_naissance" /></div>
                        <div><label class="saas-label">Lieu naissance</label><input class="saas-input" type="text" [(ngModel)]="createUserForm.lieu_naissance" /></div>
                        <div class="md:col-span-3"><label class="saas-label">Adresse complète</label><input class="saas-input" type="text" [(ngModel)]="createUserForm.adresse" /></div>
                    </div>
                    <div *ngIf="createUserError" class="text-red-500 text-sm mt-2 font-medium flex items-center gap-1.5">
                        <i class="ph ph-warning-circle"></i> {{ createUserError }}
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
                    <button class="saas-btn-secondary" (click)="openCreateUserModal = false">Annuler</button>
                    <button class="saas-btn-primary" (click)="submitCreateUser()" [disabled]="createUserSubmitting || isLoading">
                        Créer le compte
                    </button>
                </div>
            </div>
        </div>

        <!-- Éditer (Même logique visuelle) -->
        <div *ngIf="openEditUserModalFlag" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'openEditUserModalFlag')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-3xl p-0 relative z-10 animate-slide-up shadow-modal max-h-[90vh] flex flex-col" (click)="$event.stopPropagation()">
                <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                    <h3 class="text-lg font-bold text-zinc-900">Éditer le compte</h3>
                    <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="openEditUserModalFlag = false"><i class="ph ph-x text-xl"></i></button>
                </div>
                
                <div class="p-6 overflow-y-auto space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div><label class="saas-label">Nom</label><input class="saas-input" type="text" [(ngModel)]="editUserForm.nom" /></div>
                        <div><label class="saas-label">Prénom</label><input class="saas-input" type="text" [(ngModel)]="editUserForm.prenom" /></div>
                        <div>
                            <label class="saas-label">Rôle</label>
                            <select class="saas-input" [(ngModel)]="editUserForm.role">
                                <option value="ADMIN">Administrateur</option>
                                <option value="GESTIONNAIRE">Gestionnaire</option>
                                <option value="SECRETAIRE">Secrétaire</option>
                                <option value="TITULAIRE">Titulaire</option>
                            </select>
                        </div>
                        <div>
                            <label class="saas-label">Statut</label>
                            <select class="saas-input" [(ngModel)]="editUserForm.is_active">
                                <option [ngValue]="true">Actif</option>
                                <option [ngValue]="false">Inactif</option>
                            </select>
                        </div>
                        <div>
                            <label class="saas-label">Sexe</label>
                            <select class="saas-input" [(ngModel)]="editUserForm.sexe">
                                <option [ngValue]="null">—</option>
                                <option value="M">Masculin</option>
                                <option value="F">Féminin</option>
                            </select>
                        </div>
                        <div><label class="saas-label">Date naissance</label><input class="saas-input" type="date" [(ngModel)]="editUserForm.date_naissance" /></div>
                        <div class="md:col-span-3"><label class="saas-label">Adresse</label><input class="saas-input" type="text" [(ngModel)]="editUserForm.adresse" /></div>
                    </div>
                    <div *ngIf="editUserError" class="text-red-500 text-sm mt-2 font-medium flex items-center gap-1.5">
                        <i class="ph ph-warning-circle"></i> {{ editUserError }}
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
                    <button class="saas-btn-secondary" (click)="openEditUserModalFlag = false">Annuler</button>
                    <button class="saas-btn-primary" (click)="submitEditUser()" [disabled]="editUserSubmitting || isLoading">
                        Mettre à jour
                    </button>
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
    private searchSubject = new Subject<string>();
    private loadingWatchdog: any = null;

    // Onglet actif
    activeTab: 'dashboard' | 'users' | 'annee' | 'archives' = 'dashboard';

    // Statistiques
    stats = { eleves: 0, utilisateurs: 0, classes: 0 };
    statsLoading = true;

    // Année scolaire
    activeYear: any = null;
    yearLoading = true;
    archivesLoading = false;
    archivesResults: AnneeScolaire[] = [];

    // Recherche
    searchQuery = '';
    searchLoading = false;
    searchError = '';
    searchResults: any[] = [];
    profileModalOpen = false;
    profileData: any = null;

    // Utilisateurs
    usersLoading = false;
    usersError = '';
    usersResults: any[] = [];
    usersTotal = 0;
    usersPage = 1;
    usersPageSize = 10;
    usersLastPage = 1;

    // État global
    isLoading = false;
    currentDate = new Date();

    // Modales
    openYearModal = false;
    yearSubmitting = false;
    yearError = '';
    yearForm = { nom: '', date_debut: '', date_fin: '' };

    openCreateUserModal = false;
    createUserSubmitting = false;
    createUserError = '';
    createUserForm: any = {
        nom: '',
        prenom: '',
        email: '',
        role: 'SECRETAIRE',
        mot_de_passe: '',
        sexe: null,
        date_naissance: '',
        lieu_naissance: '',
        adresse: '',
        niveau_etude: '',
        postnom: '',
        nom_pere: '',
        nom_mere: '',
    };

    openEditUserModalFlag = false;
    editUserSubmitting = false;
    editUserError = '';
    editUserId: number | null = null;
    editUserForm: any = {
        nom: '',
        prenom: '',
        role: 'SECRETAIRE',
        is_active: true,
        sexe: null,
        date_naissance: '',
        lieu_naissance: '',
        adresse: '',
        niveau_etude: '',
        postnom: '',
        nom_pere: '',
        nom_mere: '',
    };

    openDeleteUserModalFlag = false;
    deleteUserSubmitting = false;
    deleteUserError = '';
    deleteUserId: number | null = null;

    // Archives historiques - Recherche d'élèves et Bulletins
    activeArchiveSubTab: 'years' | 'search' = 'years';
    archiveSearchYearId: number | null = null;
    archiveSearchQuery = '';
    archiveSearchResults: any[] = [];
    archiveSearchLoading = false;
    archiveSearchError = '';

    // Bulletin Modal State
    bulletinModalOpen = false;
    bulletinLoading = false;
    bulletinError = '';
    selectedInscriptionIdForBulletin: number | null = null;
    selectedPeriodeIdForBulletin: number | null = null;
    periodsList: any[] = [];
    bulletinData: any = null;

    constructor(
        private http: HttpClient,
        private cdr: ChangeDetectorRef,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.loadAllData();
        this.setupSearch();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.clearLoadingWatchdog();
    }

    private setupSearch(): void {
        this.searchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query.trim()) {
                    this.searchResults = [];
                    this.searchLoading = false;
                    return of({ results: [] });
                }
                this.searchLoading = true;
                this.searchError = '';
                this.cdr.detectChanges();
                return this.http.get<any>(
                    `${this.API_BASE}/api/admin/users/search?q=${encodeURIComponent(query)}`,
                    { headers: this.authHeaders() }
                ).pipe(
                    timeout(10000),
                    catchError(err => {
                        this.searchError = err?.error?.message || 'Erreur de recherche.';
                        this.searchLoading = false;
                        this.cdr.detectChanges();
                        return of({ results: [] });
                    }),
                    finalize(() => {
                        this.searchLoading = false;
                        this.cdr.detectChanges();
                    })
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => {
            this.searchResults = res.results || [];
            this.searchLoading = false;
            if (this.searchResults.length === 0 && this.searchQuery.trim()) {
                this.searchError = 'Aucun résultat trouvé.';
            } else {
                this.searchError = '';
            }
            this.cdr.detectChanges();
        });
    }

    private authHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    }

    private startLoadingWatchdog(ms: number): void {
        this.clearLoadingWatchdog();
        this.loadingWatchdog = setTimeout(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
        }, ms);
    }

    private clearLoadingWatchdog(): void {
        if (this.loadingWatchdog) {
            clearTimeout(this.loadingWatchdog);
            this.loadingWatchdog = null;
        }
    }

    private setLoading(loading: boolean): void {
        this.isLoading = loading;
        if (loading) {
            this.startLoadingWatchdog(20000);
        } else {
            this.clearLoadingWatchdog();
        }
        this.cdr.detectChanges();
    }

    closeModal(event: MouseEvent, modalKey: string): void {
        const target = event.target as HTMLElement;
        if (target.classList.contains('fixed') || target.classList.contains('absolute')) {
            (this as any)[modalKey] = false;
            this.cdr.detectChanges();
        }
    }

    logout(): void {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        localStorage.removeItem('school_token');
        this.router.navigate(['/']);
    }

    loadAllData(): void {
        this.loadStats();
        this.loadActiveYear();
        this.loadUsers();
        this.loadArchives();
    }

    refreshData(): void {
        this.loadAllData();
    }

    loadStats(): void {
        this.statsLoading = true;
        this.cdr.detectChanges();
        this.http.get(`${this.API_BASE}/api/admin/stats`, { headers: this.authHeaders() })
            .pipe(timeout(10000))
            .pipe(finalize(() => {
                this.statsLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res: any) => {
                    this.stats = res;
                    this.cdr.detectChanges();
                },
                error: (err: any) => {
                    console.error('Erreur chargement stats', err);
                    this.cdr.detectChanges();
                }
            });
    }

    loadActiveYear(): void {
        this.yearLoading = true;
        this.cdr.detectChanges();
        this.http.get(`${this.API_BASE}/api/admin/annee-scolaire/active`, { headers: this.authHeaders() })
            .pipe(timeout(10000))
            .pipe(finalize(() => {
                this.yearLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res: any) => {
                    this.activeYear = res.activeYear || null;
                    this.cdr.detectChanges();
                },
                error: (err: any) => {
                    console.error('Erreur chargement année active', err);
                    this.activeYear = null;
                    this.cdr.detectChanges();
                }
            });
    }

    loadArchives(): void {
        if (this.activeTab !== 'archives') return;
        this.archivesLoading = true;
        this.cdr.detectChanges();
        this.http.get(`${this.API_BASE}/api/secretariat/annees`, { headers: this.authHeaders() })
            .pipe(timeout(10000))
            .pipe(finalize(() => {
                this.archivesLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res: any) => {
                    this.archivesResults = res.results || [];
                    this.cdr.detectChanges();
                },
                error: (err: any) => {
                    console.error('Erreur chargement archives', err);
                    this.archivesResults = [];
                    this.cdr.detectChanges();
                }
            });
    }

    onSearchInput(): void {
        this.searchSubject.next(this.searchQuery);
    }

    openProfileModal(user: any): void {
        this.profileData = user;
        this.profileModalOpen = true;
        this.cdr.detectChanges();
    }

    loadUsers(): void {
        this.usersLoading = true;
        this.usersError = '';
        this.cdr.detectChanges();
        this.http.get(
            `${this.API_BASE}/api/admin/users?page=${this.usersPage}&pageSize=${this.usersPageSize}`,
            { headers: this.authHeaders() }
        )
            .pipe(timeout(10000))
            .pipe(finalize(() => {
                this.usersLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res: any) => {
                    this.usersResults = res.results || [];
                    this.usersTotal = Number(res.total || 0);
                    this.usersLastPage = Math.max(1, Math.ceil(this.usersTotal / this.usersPageSize));
                    this.cdr.detectChanges();
                },
                error: (err: any) => {
                    console.error('Erreur load users', err);
                    this.usersError = err?.error?.message || 'Erreur lors du chargement.';
                    this.usersResults = [];
                    this.usersTotal = 0;
                    this.usersLastPage = 1;
                    this.cdr.detectChanges();
                }
            });
    }

    nextPage(): void {
        if (this.usersPage < this.usersLastPage && !this.usersLoading) {
            this.usersPage++;
            this.loadUsers();
        }
    }

    prevPage(): void {
        if (this.usersPage > 1 && !this.usersLoading) {
            this.usersPage--;
            this.loadUsers();
        }
    }

    // ============================================================
    // 1. MÉTHODES DE GESTION DES DATES - ROBUSTES ET COMPLÈTES
    // ============================================================

    /**
     * Détecte automatiquement le format d'une date et la convertit en DD/MM/YYYY
     * Supporte: YYYY-MM-DD, DD/MM/YYYY, YYYY-MM-DD HH:MM:SS, et autres formats parsables
     */
    private parseDateToDDMMYYYY(dateStr: string): string {
        if (!dateStr) return '';

        // Nettoyer la chaîne
        dateStr = dateStr.trim();

        // Si c'est déjà au format DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            return dateStr;
        }

        // Si c'est au format YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const parts = dateStr.split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        // Si c'est au format YYYY-MM-DD HH:MM:SS (datetime MySQL)
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
            const parts = dateStr.split(' ')[0].split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        // Si c'est au format YYYY-MM-DDTHH:MM:SS (ISO)
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateStr)) {
            const parts = dateStr.split('T')[0].split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        // Essayer de parser avec Date() pour les formats exotiques
        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${day}/${month}/${year}`;
            }
        } catch (e) {
            // Ignorer
        }

        // Si on ne peut pas parser, retourner la chaîne originale
        return dateStr;
    }

    /**
     * Détecte automatiquement le format d'une date et la convertit en YYYY-MM-DD
     * Supporte: DD/MM/YYYY, YYYY-MM-DD, YYYY-MM-DD HH:MM:SS, et autres formats parsables
     */
    private parseDateToYYYYMMDD(dateStr: string): string {
        if (!dateStr) return '';

        // Nettoyer la chaîne
        dateStr = dateStr.trim();

        // Si c'est déjà au format YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }

        // Si c'est au format DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Si c'est au format YYYY-MM-DD HH:MM:SS (datetime MySQL)
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
            return dateStr.split(' ')[0];
        }

        // Si c'est au format YYYY-MM-DDTHH:MM:SS (ISO)
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateStr)) {
            return dateStr.split('T')[0];
        }

        // Essayer de parser avec Date() pour les formats exotiques
        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        } catch (e) {
            // Ignorer
        }

        // Si on ne peut pas parser, retourner la chaîne originale
        return dateStr;
    }

    /**
     * Formate une date pour l'affichage (DD/MM/YYYY)
     * Supporte tous les formats
     */
    formatDateDisplay(dateStr: string): string {
        if (!dateStr) return '';
        return this.parseDateToDDMMYYYY(dateStr);
    }

    /**
     * Formate une date pour l'affichage (DD/MM/YYYY) avec gestion des null
     * Supporte tous les formats
     */
    formatDate(dateStr: string | null): string {
        if (!dateStr) return '-';
        return this.parseDateToDDMMYYYY(dateStr);
    }

    /**
     * Formate une date pour le backend (DD/MM/YYYY)
     * Supporte tous les formats
     */
    private formatDateForBackend(dateStr: string): string {
        if (!dateStr) return '';
        return this.parseDateToDDMMYYYY(dateStr);
    }

    /**
     * Formate une date pour les inputs HTML type="date" (YYYY-MM-DD)
     * Supporte tous les formats
     */
    private formatDateForInput(dateStr: string): string {
        if (!dateStr) return '';
        return this.parseDateToYYYYMMDD(dateStr);
    }

    /**
     * Normalise un objet entier : convertit toutes les dates en DD/MM/YYYY pour le backend
     */
    private normalizeDatesForBackend(obj: any, dateFields: string[]): any {
        const result = { ...obj };
        for (const field of dateFields) {
            if (result[field]) {
                result[field] = this.formatDateForBackend(result[field]);
            }
        }
        return result;
    }

    /**
     * Normalise un objet entier : convertit toutes les dates en YYYY-MM-DD pour les inputs
     */
    private normalizeDatesForInput(obj: any, dateFields: string[]): any {
        const result = { ...obj };
        for (const field of dateFields) {
            if (result[field]) {
                result[field] = this.formatDateForInput(result[field]);
            }
        }
        return result;
    }

    /**
     * Extrait l'année d'une date (format YYYY)
     */
    private extractYear(dateStr: string): string {
        if (!dateStr) return '';
        try {
            const normalized = this.parseDateToYYYYMMDD(dateStr);
            if (normalized) {
                return normalized.split('-')[0];
            }
        } catch (e) {
            // Ignorer
        }
        return '';
    }

    // ============================================================
    // 2. MÉTHODES METIER AVEC CORRECTIONS DES DATES
    // ============================================================

    /**
     * Met à jour le nom de l'année basé sur les dates sélectionnées
     */
    updateYearName(): void {
        const debut = this.yearForm.date_debut;
        const fin = this.yearForm.date_fin;

        if (debut && fin) {
            const anneeDebut = this.extractYear(debut);
            const anneeFin = this.extractYear(fin);

            if (anneeDebut && anneeFin) {
                if (anneeDebut !== anneeFin) {
                    this.yearForm.nom = `${anneeDebut}-${anneeFin}`;
                } else {
                    this.yearForm.nom = anneeDebut;
                }
                this.cdr.detectChanges();
            }
        }
    }

    /**
     * Clôture une année scolaire
     */
    cloturerAnnee(id: number): void {
        if (!confirm('Êtes-vous sûr de vouloir clôturer cette année scolaire ? Cette action est irréversible.')) return;

        this.setLoading(true);
        this.http.put(`${this.API_BASE}/api/secretariat/annees/${id}/archiver`, {}, { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.setLoading(false); }))
            .subscribe({
                next: () => {
                    this.loadArchives();
                    this.loadActiveYear();
                    this.cdr.detectChanges();
                },
                error: (err: any) => {
                    alert(err?.error?.message || 'Erreur lors de la clôture.');
                    this.cdr.detectChanges();
                }
            });
    }

    /**
     * Soumet l'ouverture d'une nouvelle année scolaire
     * Les dates sont automatiquement converties au format attendu par le backend (DD/MM/YYYY)
     */
    submitOpenYear(): void {
        this.yearError = '';

        // Vérifier que les dates sont sélectionnées
        if (!this.yearForm.date_debut || !this.yearForm.date_fin) {
            this.yearError = 'Veuillez sélectionner les dates de début et de fin.';
            this.cdr.detectChanges();
            return;
        }

        // Vérifier que les dates ne sont pas vides
        if (this.yearForm.date_debut.trim() === '' || this.yearForm.date_fin.trim() === '') {
            this.yearError = 'Veuillez sélectionner des dates valides.';
            this.cdr.detectChanges();
            return;
        }

        // Générer le nom si vide
        if (!this.yearForm.nom.trim()) {
            this.updateYearName();
            if (!this.yearForm.nom.trim()) {
                this.yearError = 'Impossible de générer le nom de l\'année.';
                this.cdr.detectChanges();
                return;
            }
        }

        this.yearSubmitting = true;
        this.setLoading(true);

        // 🔧 FORCER LA CONVERSION EN DD/MM/YYYY
        let dateDebut = this.yearForm.date_debut;
        let dateFin = this.yearForm.date_fin;

        // Si la date est au format YYYY-MM-DD (input type date), convertir en DD/MM/YYYY
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateDebut)) {
            const parts = dateDebut.split('-');
            dateDebut = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateFin)) {
            const parts = dateFin.split('-');
            dateFin = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        // 🔧 VÉRIFICATION FINALE : Doit être DD/MM/YYYY
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateDebut)) {
            this.yearError = `Format de date_debut invalide: "${dateDebut}". Utiliser JJ/MM/AAAA`;
            this.yearSubmitting = false;
            this.setLoading(false);
            this.cdr.detectChanges();
            return;
        }

        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateFin)) {
            this.yearError = `Format de date_fin invalide: "${dateFin}". Utiliser JJ/MM/AAAA`;
            this.yearSubmitting = false;
            this.setLoading(false);
            this.cdr.detectChanges();
            return;
        }

        const payload = {
            nom: this.yearForm.nom,
            date_debut: dateDebut,
            date_fin: dateFin
        };

        this.http.post(
            `${this.API_BASE}/api/admin/annee-scolaire`,
            payload,
            { headers: this.authHeaders() }
        )
            .pipe(timeout(15000))
            .pipe(finalize(() => {
                this.yearSubmitting = false;
                this.setLoading(false);
            }))
            .subscribe({
                next: () => {
                    this.openYearModal = false;
                    this.yearForm = { nom: '', date_debut: '', date_fin: '' };
                    this.loadAllData();
                    this.cdr.detectChanges();
                },
                error: (err: any) => {
                    this.yearError = err?.error?.message || 'Erreur lors de l\'ouverture.';
                    this.cdr.detectChanges();
                }
            });
    }

    /**
     * Soumet la création d'un utilisateur
     * Les dates sont automatiquement normalisées pour le backend
     */
    submitCreateUser(): void {
        if (!this.createUserForm.nom?.trim() || !this.createUserForm.prenom?.trim() || !this.createUserForm.email?.trim() || !this.createUserForm.role) {
            this.createUserError = 'Nom, prénom, email et rôle sont obligatoires.';
            this.cdr.detectChanges();
            return;
        }

        this.createUserSubmitting = true;
        this.setLoading(true);

        const payload = this.normalizeDatesForBackend(
            { ...this.createUserForm },
            ['date_naissance']
        );

        this.http.post(
            `${this.API_BASE}/api/admin/users`,
            payload,
            { headers: this.authHeaders() }
        )
            .pipe(timeout(15000))
            .pipe(finalize(() => {
                this.createUserSubmitting = false;
                this.setLoading(false);
            }))
            .subscribe({
                next: () => {
                    this.openCreateUserModal = false;
                    this.createUserForm = {
                        nom: '',
                        prenom: '',
                        email: '',
                        role: 'SECRETAIRE',
                        mot_de_passe: '',
                        sexe: null,
                        date_naissance: '',
                        lieu_naissance: '',
                        adresse: '',
                        niveau_etude: '',
                        postnom: '',
                        nom_pere: '',
                        nom_mere: '',
                    };
                    this.loadUsers();
                    this.loadStats();
                    this.createUserError = '';
                    this.cdr.detectChanges();
                },
                error: (err: any) => {
                    this.createUserError = err?.error?.message || 'Erreur lors de la création.';
                    this.cdr.detectChanges();
                }
            });
    }

    /**
     * Renvoyer le lien d'activation / réinitialisation de mot de passe (valable 1 mois)
     */
    resendUserInvite(user: any): void {
        if (!confirm(`Renvoyer le lien d'activation (valable 1 mois) à ${user.prenom} ${user.nom} (${user.email}) ?`)) {
            return;
        }
        this.setLoading(true);
        this.http.post<any>(
            `${this.API_BASE}/api/admin/users/${user.id}/resend-invite`,
            {},
            { headers: this.authHeaders() }
        )
            .pipe(
                timeout(10000),
                finalize(() => this.setLoading(false))
            )
            .subscribe({
                next: (res: any) => {
                    alert(res.message || 'Lien d\'activation envoyé avec succès.');
                    this.loadUsers();
                },
                error: (err: any) => {
                    alert(err?.error?.message || 'Erreur lors du renvoi du lien.');
                }
            });
    }

    /**
     * Ouvre la modale d'édition d'un utilisateur
     * Les dates sont automatiquement normalisées pour les inputs HTML
     */
    openEditUserModal(user: any): void {
        this.editUserError = '';
        this.editUserId = user.id || user.user_id;

        const normalizedDates = this.normalizeDatesForInput(
            {
                date_naissance: user.date_naissance || ''
            },
            ['date_naissance']
        );

        this.editUserForm = {
            nom: user.nom || user.utilisateur_nom || '',
            prenom: user.prenom || user.utilisateur_prenom || '',
            role: user.role || 'SECRETAIRE',
            is_active: user.is_active !== undefined ? !!user.is_active : true,
            sexe: user.sexe ?? null,
            date_naissance: normalizedDates.date_naissance,
            lieu_naissance: user.lieu_naissance || '',
            adresse: user.adresse || '',
            niveau_etude: user.niveau_etude || '',
            postnom: user.postnom || '',
            nom_pere: user.nom_pere || '',
            nom_mere: user.nom_mere || '',
        };
        this.openEditUserModalFlag = true;
        this.cdr.detectChanges();
    }

    /**
     * Soumet la mise à jour d'un utilisateur
     * Les dates sont automatiquement normalisées pour le backend
     */
    submitEditUser(): void {
        if (!this.editUserId) return;
        this.editUserError = '';
        this.editUserSubmitting = true;
        this.setLoading(true);

        const payload = this.normalizeDatesForBackend(
            { ...this.editUserForm },
            ['date_naissance']
        );

        this.http.put(
            `${this.API_BASE}/api/admin/users/${this.editUserId}`,
            payload,
            { headers: this.authHeaders() }
        )
            .pipe(timeout(15000))
            .pipe(finalize(() => {
                this.editUserSubmitting = false;
                this.setLoading(false);
            }))
            .subscribe({
                next: () => {
                    this.openEditUserModalFlag = false;
                    this.profileModalOpen = false;
                    this.loadUsers();
                    this.loadStats();
                    this.cdr.detectChanges();
                },
                error: (err: any) => {
                    this.editUserError = err?.error?.message || 'Erreur lors de la mise à jour.';
                    this.cdr.detectChanges();
                }
            });
    }

    /**
     * Ouvre la modale de suppression d'un utilisateur
     */
    openDeleteUserModal(userId: number): void {
        this.deleteUserError = '';
        this.deleteUserId = userId;
        this.openDeleteUserModalFlag = true;
        this.cdr.detectChanges();
    }

    /**
     * Soumet la suppression d'un utilisateur
     */
    submitDeleteUser(): void {
        if (!this.deleteUserId) return;
        this.deleteUserSubmitting = true;
        this.setLoading(true);

        this.http.delete(
            `${this.API_BASE}/api/admin/users/${this.deleteUserId}`,
            { headers: this.authHeaders() }
        )
            .pipe(timeout(15000))
            .pipe(finalize(() => {
                this.deleteUserSubmitting = false;
                this.setLoading(false);
            }))
            .subscribe({
                next: () => {
                    this.openDeleteUserModalFlag = false;
                    this.searchResults = [];
                    this.profileModalOpen = false;
                    this.loadUsers();
                    this.loadStats();
                    this.cdr.detectChanges();
                },
                error: (err: any) => {
                    this.deleteUserError = err?.error?.message || 'Erreur lors de la suppression.';
                    this.cdr.detectChanges();
                }
            });
    }

    // ============================================================
    // 3. MÉTHODES ARCHIVES ET BULLETINS
    // ============================================================

    initArchiveSearchTab(): void {
        if (!this.archiveSearchYearId && this.archivesResults.length > 0) {
            const activeYear = this.archivesResults.find((a: any) => a.statut === 'OUVERTE');
            this.archiveSearchYearId = activeYear ? activeYear.id : this.archivesResults[0].id;
        }

        if (this.periodsList.length === 0) {
            this.http.get(`${this.API_BASE}/api/gestionnaire/periodes`, { headers: this.authHeaders() })
                .subscribe({
                    next: (res: any) => {
                        this.periodsList = res.results || [];
                        if (this.periodsList.length > 0) {
                            this.selectedPeriodeIdForBulletin = this.periodsList[0].id;
                        }
                    },
                    error: (err) => {
                        console.error('Erreur chargement périodes pour archives:', err);
                    }
                });
        }
    }

    searchArchivedEleves(): void {
        if (!this.archiveSearchYearId) {
            this.archiveSearchError = 'Veuillez sélectionner une année scolaire.';
            return;
        }

        this.archiveSearchLoading = true;
        this.archiveSearchError = '';
        this.archiveSearchResults = [];

        const params = new URLSearchParams();
        params.set('annee_scolaire_id', String(this.archiveSearchYearId));
        if (this.archiveSearchQuery.trim()) {
            params.set('q', this.archiveSearchQuery.trim());
        }

        this.http.get(`${this.API_BASE}/api/admin/archives/eleves?${params.toString()}`, { headers: this.authHeaders() })
            .pipe(timeout(10000), finalize(() => {
                this.archiveSearchLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res: any) => {
                    this.archiveSearchResults = res.results || [];
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.archiveSearchError = err?.error?.message || 'Erreur lors de la recherche des archives.';
                    this.cdr.detectChanges();
                }
            });
    }

    openArchivedBulletin(inscriptionId: number): void {
        this.selectedInscriptionIdForBulletin = inscriptionId;
        this.bulletinModalOpen = true;
        this.bulletinData = null;
        this.bulletinError = '';

        if (!this.selectedPeriodeIdForBulletin && this.periodsList.length > 0) {
            this.selectedPeriodeIdForBulletin = this.periodsList[0].id;
        }

        if (this.selectedPeriodeIdForBulletin) {
            this.loadArchivedBulletinData();
        }
    }

    onArchivePeriodChange(): void {
        if (this.selectedInscriptionIdForBulletin && this.selectedPeriodeIdForBulletin) {
            this.loadArchivedBulletinData();
        }
    }

    loadArchivedBulletinData(): void {
        if (!this.selectedInscriptionIdForBulletin || !this.selectedPeriodeIdForBulletin) return;

        this.bulletinLoading = true;
        this.bulletinError = '';
        this.bulletinData = null;
        this.cdr.detectChanges();

        this.http.get(`${this.API_BASE}/api/admin/archives/bulletin/${this.selectedInscriptionIdForBulletin}?periode_id=${this.selectedPeriodeIdForBulletin}`, { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => {
                this.bulletinLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res: any) => {
                    if (res.success && res.data) {
                        this.bulletinData = res.data;
                    } else {
                        this.bulletinError = 'Impossible de charger les données du bulletin.';
                    }
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur bulletin archive:', err);
                    this.bulletinError = err?.error?.message || 'Erreur lors du chargement du bulletin.';
                    this.cdr.detectChanges();
                }
            });
    }

    imprimerBulletinArchive(): void {
        if (!this.bulletinData) return;

        const b = this.bulletinData;
        const totalNote = b.totalPointsObtenus !== null ? b.totalPointsObtenus : '-';
        const totalMax = b.totalPointsMax !== null ? b.totalPointsMax : '-';
        const pct = b.pourcentageGlobal !== null ? b.pourcentageGlobal + ' %' : '-';
        const position = b.rang !== null ? b.rang + '<sup>e</sup>' : '-';

        let coursesRows = '';
        for (const n of b.notes) {
            const noteObtenue = n.note !== null ? n.note : '-';
            const pctRow = n.pourcentage !== null ? n.pourcentage + ' %' : '-';
            coursesRows += `
                <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 10px; font-weight: bold; text-align: left;">${n.cours}</td>
                    <td style="padding: 10px; text-align: center; font-weight: bold;">${noteObtenue} / ${n.max}</td>
                    <td style="padding: 10px; text-align: center;">${pctRow}</td>
                </tr>
            `;
        }

        let disciplineRows = '';
        if (b.appreciations && b.appreciations.length > 0) {
            for (const app of b.appreciations) {
                disciplineRows += `
                    <div style="font-size: 11px; margin-bottom: 5px; color: #374151;">
                        • ${app.observation_discipline}
                    </div>
                `;
            }
        } else {
            disciplineRows = '<div style="font-style: italic; color: #9ca3af; font-size: 11px;">Aucune remarque enregistrée</div>';
        }

        const html = `
            <html>
                <head>
                    <title>Bulletin - ${b.eleve.nom} ${b.eleve.prenom}</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1f2937; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
                        .school-info h1 { margin: 0; font-size: 20px; font-weight: 900; color: #1e3a8a; }
                        .school-info p { margin: 2px 0 0 0; font-size: 12px; color: #4b5563; }
                        .student-info { background: #f3f4f6; padding: 15px 20px; border-radius: 8px; margin-bottom: 30px; }
                        .student-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 10px; font-size: 13px; }
                        .title { text-align: center; margin-bottom: 25px; text-transform: uppercase; font-weight: 800; font-size: 18px; color: #1e3a8a; letter-spacing: 1px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        th { background: #1e3a8a; color: white; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
                        .totals-card { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; text-align: center; margin-bottom: 30px; }
                        .total-item-title { font-size: 10px; text-transform: uppercase; font-weight: bold; color: #2563eb; letter-spacing: 0.5px; margin-bottom: 5px; }
                        .total-item-val { font-size: 18px; font-weight: 900; color: #1e3a8a; }
                        .footer-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; font-size: 12px; margin-top: 50px; text-align: center; }
                        .signature-box { border-top: 1px dashed #d1d5db; padding-top: 15px; height: 80px; }
                        @media print {
                            body { padding: 0; }
                            button { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    <div style="text-align: right; margin-bottom: 20px;">
                        <button onclick="window.print()" style="background: #1e3a8a; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">Imprimer le Bulletin</button>
                    </div>

                    <div class="header">
                        <div class="school-info">
                            <h1>${b.ecole.nom.toUpperCase()}</h1>
                            <p>${b.ecole.adresse}</p>
                            <p>Tél: ${b.ecole.telephone} | Email: ${b.ecole.email}</p>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 11px; font-weight: bold; background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px;">BULLETIN HISTORIQUE</span>
                        </div>
                    </div>

                    <div class="title">Bulletin Scolaire — ${b.periode}</div>

                    <div class="student-info">
                        <div class="student-grid">
                            <div><strong>Élève :</strong> ${b.eleve.nom} ${b.eleve.prenom} ${b.eleve.postnom || ''}</div>
                            <div><strong>Classe :</strong> ${b.classe.nom} ${b.classe.section || ''} ${b.classe.option ? '/ ' + b.classe.option : ''}</div>
                            <div><strong>Matricule :</strong> ${b.eleve.matricule}</div>
                            <div><strong>Année Scolaire :</strong> ${b.anneeScolaire}</div>
                            <div><strong>Sexe :</strong> ${b.eleve.sexe === 'M' ? 'Masculin' : 'Féminin'}</div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="text-align: left;">Branches</th>
                                <th style="text-align: center;">Cotes Obtenues</th>
                                <th style="text-align: center;">Pourcentage branché</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${coursesRows}
                        </tbody>
                    </table>

                    <div class="totals-card">
                        <div>
                            <div class="total-item-title">Total Points</div>
                            <div class="total-item-val">${totalNote} / ${totalMax}</div>
                        </div>
                        <div>
                            <div class="total-item-title">Pourcentage Global</div>
                            <div class="total-item-val">${pct}</div>
                        </div>
                        <div>
                            <div class="total-item-title">Rang</div>
                            <div class="total-item-val">${position}</div>
                        </div>
                        <div>
                            <div class="total-item-title">Conduite / Présences</div>
                            <div class="total-item-val">${b.presences.presents} / ${b.presences.total} Jours</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-cols: 1fr; gap: 15px; margin-bottom: 40px;">
                        <div style="border: 1px solid #e4e4e7; border-radius: 8px; padding: 15px; background: #fafafa;">
                            <strong style="font-size: 11px; text-transform: uppercase; color: #6b7280; display: block; margin-bottom: 8px;">Conduite & Remarques Disciplinaires</strong>
                            ${disciplineRows}
                        </div>
                    </div>

                    <div class="footer-grid">
                        <div>
                            <div class="signature-box">Signature du Titulaire</div>
                        </div>
                        <div>
                            <div class="signature-box">Le Chef d'Établissement</div>
                        </div>
                    </div>
                </body>
            </html>
        `;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        }
    }
}