// secretariat.component.ts - Version avec recherche d'élèves pour réinscription

import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, finalize, timeout, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxChartsModule } from '@swimlane/ngx-charts';

interface Eleve {
    id: number;
    matricule: string;
    nom: string;
    postnom: string | null;
    prenom: string;
    sexe: 'M' | 'F';
    date_naissance: string | null;
    lieu_naissance: string | null;
    nom_pere: string | null;
    nom_mere: string | null;
    numero_parent: string | null;
    adresse: string | null;
    niveau_etude: string | null;
    created_at: string;
    classe_nom: string | null;
    classe_section: string | null;
    classe_option: string | null;
    classe_id: number | null;
    inscription_id: number | null;
    annee_scolaire_id: number | null;
    date_inscription: string | null;
}

interface Classe {
    id: number;
    nom: string;
    section: string | null;
    option_classe: string | null;
    titulaire_id: number | null;
    titulaire_nom: string | null;
    titulaire_prenom: string | null;
    effectif: number;
}

interface ClasseForSelect {
    id: number;
    nom: string;
    section: string | null;
    option_classe: string | null;
    displayName: string;
}

interface Inscription {
    id: number;
    date_inscription: string;
    eleve_id: number;
    eleve_matricule: string;
    eleve_nom: string;
    eleve_postnom: string | null;
    eleve_prenom: string;
    eleve_sexe: 'M' | 'F';
    classe_id: number;
    classe_nom: string;
    classe_section: string | null;
    classe_option: string | null;
    annee_scolaire_id: number;
    annee_scolaire_nom: string;
}

interface AnneeScolaire {
    id: number;
    nom: string;
    date_debut: string;
    date_fin: string;
    statut: 'OUVERTE' | 'CLOTUREE';
    total_inscriptions: number;
}

interface Titulaire {
    id: number;
    nom: string;
    prenom: string;
    matricule: string;
}

@Component({
    selector: 'app-secretariat',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        HttpClientModule,
        NgxChartsModule
    ],
    template: `
        <div class="space-y-6 animate-fade-in">
            <!-- En-tête -->
            <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <i class="ph ph-identification-card text-brand-600"></i> Secrétariat & Registre
                    </h1>
                    <p class="text-zinc-500 text-sm mt-1">Gestion des inscriptions, des élèves et des classes</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-medium text-zinc-500 bg-white px-3 py-1.5 rounded-lg border border-zinc-200 shadow-sm flex items-center gap-2">
                        <i class="ph ph-calendar-blank text-zinc-400"></i> {{ currentDate | date:'dd MMMM yyyy' }}
                    </span>
                    <button class="saas-btn-secondary h-9 w-9 p-0 justify-center" (click)="refreshData()" [disabled]="isLoading">
                        <i class="ph ph-arrows-clockwise text-lg" [class.animate-spin]="isLoading"></i>
                    </button>
                </div>
            </header>

            <!-- Navigation par Onglets (Tabs) -->
            <div class="flex items-center gap-1 border-b border-zinc-200 overflow-x-auto no-scrollbar">
                <button (click)="setActiveTab('dashboard')" 
                        [class]="activeTab === 'dashboard' ? 'border-brand-600 text-brand-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'"
                        class="px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap">
                    <i class="ph ph-chart-pie-slice"></i> Statistiques
                </button>
                <button (click)="setActiveTab('eleves')" 
                        [class]="activeTab === 'eleves' ? 'border-brand-600 text-brand-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'"
                        class="px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap">
                    <i class="ph ph-users"></i> Élèves
                </button>
                <button (click)="setActiveTab('classes')" 
                        [class]="activeTab === 'classes' ? 'border-brand-600 text-brand-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'"
                        class="px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap">
                    <i class="ph ph-books"></i> Classes
                </button>
                <button (click)="setActiveTab('inscriptions')" 
                        [class]="activeTab === 'inscriptions' ? 'border-brand-600 text-brand-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'"
                        class="px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap">
                    <i class="ph ph-clipboard-text"></i> Confirmations & Inscriptions
                </button>
                <button (click)="setActiveTab('messages')" 
                        [class]="activeTab === 'messages' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'"
                        class="px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap">
                    <i class="ph ph-whatsapp-logo text-emerald-500"></i> WhatsApp
                </button>
            </div>

            <!-- CONTENU DES ONGLETS -->

            <!-- 1. DASHBOARD -->
            <div *ngIf="activeTab === 'dashboard'" class="space-y-6 animate-fade-in">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="saas-card p-5">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                                <i class="ph ph-student text-xl"></i>
                            </div>
                            <h3 class="text-zinc-500 text-xs font-bold uppercase tracking-widest">Total Élèves</h3>
                        </div>
                        <div class="text-3xl font-black text-zinc-900" *ngIf="!statsLoading">{{ stats.totalEleves }}</div>
                        <div class="text-3xl font-black text-zinc-100 animate-pulse" *ngIf="statsLoading">...</div>
                    </div>
                    <div class="saas-card p-5">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                                <i class="ph ph-books text-xl"></i>
                            </div>
                            <h3 class="text-zinc-500 text-xs font-bold uppercase tracking-widest">Classes</h3>
                        </div>
                        <div class="text-3xl font-black text-zinc-900" *ngIf="!statsLoading">{{ stats.totalClasses }}</div>
                        <div class="text-3xl font-black text-zinc-100 animate-pulse" *ngIf="statsLoading">...</div>
                    </div>
                    <div class="saas-card p-5">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <i class="ph ph-check-circle text-xl"></i>
                            </div>
                            <h3 class="text-zinc-500 text-xs font-bold uppercase tracking-widest">Inscriptions</h3>
                        </div>
                        <div class="text-3xl font-black text-zinc-900" *ngIf="!statsLoading">{{ stats.totalInscriptions }}</div>
                        <div class="text-3xl font-black text-zinc-100 animate-pulse" *ngIf="statsLoading">...</div>
                    </div>
                    <div class="saas-card p-5 bg-zinc-900 text-white border-zinc-800">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-10 h-10 rounded-lg bg-zinc-800 text-brand-400 flex items-center justify-center">
                                <i class="ph ph-calendar-check text-xl"></i>
                            </div>
                            <h3 class="text-zinc-400 text-xs font-bold uppercase tracking-widest">Année Scolaire</h3>
                        </div>
                        <div class="text-xl font-bold truncate" *ngIf="!statsLoading">{{ stats.activeYear?.nom || 'Aucune' }}</div>
                        <div class="text-xl font-bold text-zinc-700 animate-pulse" *ngIf="statsLoading">...</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Répartition H/F -->
                    <div class="saas-card overflow-hidden">
                        <div class="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                            <h3 class="text-sm font-bold text-zinc-900 uppercase tracking-wider">Répartition par sexe</h3>
                        </div>
                        <div class="p-6 h-[300px]">
                            <ngx-charts-pie-chart
                                [results]="repartitionData"
                                [scheme]="repartitionColorScheme"
                                [doughnut]="true"
                                [legend]="true"
                                [labels]="true"
                                [animations]="true">
                            </ngx-charts-pie-chart>
                        </div>
                    </div>
                    <!-- Effectifs par classe -->
                    <div class="saas-card overflow-hidden">
                        <div class="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                            <h3 class="text-sm font-bold text-zinc-900 uppercase tracking-wider">Effectifs par classe</h3>
                        </div>
                        <div class="p-6 h-[300px]">
                            <ngx-charts-bar-vertical
                                [results]="effectifsData"
                                [scheme]="'ocean'"
                                [xAxis]="true"
                                [yAxis]="true"
                                [showXAxisLabel]="false"
                                [showYAxisLabel]="false"
                                [animations]="true">
                            </ngx-charts-bar-vertical>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. ÉLÈVES -->
            <div *ngIf="activeTab === 'eleves'" class="space-y-4 animate-fade-in">
                <!-- Filtres et Actions -->
                <div class="saas-card p-5 bg-gradient-to-br from-white to-zinc-50/50">
                    <div class="flex flex-col md:flex-row gap-4">
                        <div class="relative flex-1">
                            <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
                            <input class="saas-input pl-10" type="text" [(ngModel)]="elevesSearch" 
                                   (input)="onElevesSearch()" placeholder="Rechercher par nom ou matricule..." />
                        </div>
                        <div class="flex gap-2">
                            <select class="saas-input w-40" [(ngModel)]="elevesFiltreClasse" (change)="appliquerFiltres()">
                                <option [ngValue]="null">Toutes les classes</option>
                                <option *ngFor="let c of classesForSelect" [ngValue]="c.id">{{ c.displayName }}</option>
                            </select>
                            <button class="saas-btn-primary whitespace-nowrap" (click)="openCreateEleveModal()">
                                <i class="ph ph-plus-circle mr-1.5"></i> Nouvel Élève
                            </button>
                        </div>
                    </div>
                </div>

                <div class="saas-table-container">
                    <div class="saas-table-scroll">
                        <table class="saas-table">
                            <thead>
                                <tr>
                                    <th>Matricule</th>
                                    <th>Identité de l'élève</th>
                                    <th>Sexe</th>
                                    <th>Classe Actuelle</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let e of elevesResults" class="group">
                                    <td class="font-mono text-xs font-bold text-zinc-500">{{ e.matricule }}</td>
                                    <td>
                                        <div class="font-bold text-zinc-900">{{ e.nom }} {{ e.prenom }}</div>
                                        <div class="text-[10px] text-zinc-400 font-medium">Inscrit le {{ e.created_at | date:'dd/MM/yyyy' }}</div>
                                    </td>
                                    <td>
                                        <span class="saas-badge-neutral" [class.bg-blue-50]="e.sexe === 'M'" [class.text-blue-700]="e.sexe === 'M'" [class.bg-pink-50]="e.sexe === 'F'" [class.text-pink-700]="e.sexe === 'F'">
                                            {{ e.sexe === 'M' ? 'Masculin' : 'Féminin' }}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="text-sm font-medium text-zinc-700" *ngIf="e.classe_nom">{{ getClasseDisplayNameFromEleve(e) }}</span>
                                        <span class="text-xs text-zinc-400 italic" *ngIf="!e.classe_nom">Non inscrit</span>
                                    </td>
                                    <td class="text-right">
                                        <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button class="p-1.5 text-zinc-400 hover:text-brand-600 hover:bg-brand-50 rounded-md" (click)="generateAttestation(e.id)" title="Attestation">
                                                <i class="ph ph-file-pdf text-lg"></i>
                                            </button>
                                            <button class="p-1.5 text-zinc-400 hover:text-brand-600 hover:bg-brand-50 rounded-md" (click)="openEditEleveModal(e)" title="Éditer">
                                                <i class="ph ph-pencil-simple text-lg"></i>
                                            </button>
                                            <button class="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md" (click)="openDeleteModal(e.id, 'eleve')" title="Supprimer">
                                                <i class="ph ph-trash text-lg"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                <tr *ngIf="elevesLoading">
                                    <td colspan="5" class="py-12 text-center text-zinc-400">
                                        <i class="ph ph-spinner-gap animate-spin text-3xl mb-2"></i>
                                        <p class="text-sm">Chargement des élèves...</p>
                                    </td>
                                </tr>
                                <tr *ngIf="!elevesLoading && elevesResults.length === 0">
                                    <td colspan="5" class="py-12 text-center text-zinc-400">
                                        <i class="ph ph-users text-3xl mb-2"></i>
                                        <p class="text-sm">Aucun élève trouvé.</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                        <div class="text-xs text-zinc-500 font-bold uppercase tracking-widest">Total: {{ elevesTotal }} élèves</div>
                        <div class="flex items-center gap-2">
                            <button class="saas-btn-secondary px-3 py-1.5 h-8" (click)="changePage(-1)" [disabled]="elevesPage <= 1 || elevesLoading">
                                <i class="ph ph-caret-left"></i>
                            </button>
                            <span class="text-sm font-bold text-zinc-900">Page {{ elevesPage }} / {{ elevesLastPage }}</span>
                            <button class="saas-btn-secondary px-3 py-1.5 h-8" (click)="changePage(1)" [disabled]="elevesPage >= elevesLastPage || elevesLoading">
                                <i class="ph ph-caret-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3. CLASSES -->
            <div *ngIf="activeTab === 'classes'" class="space-y-4 animate-fade-in">
                <div class="flex justify-end">
                    <button class="saas-btn-primary" (click)="openCreateClasseModal()">
                        <i class="ph ph-plus-circle mr-1.5"></i> Nouvelle Classe
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div *ngFor="let c of classesResults" class="saas-card p-5 hover:border-brand-300 transition-all group">
                        <div class="flex items-start justify-between mb-4">
                            <div>
                                <h3 class="text-lg font-black text-zinc-900">{{ getClasseDisplayNameFromClasse(c) }}</h3>
                                <p class="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{{ c.section || 'Général' }}</p>
                            </div>
                            <div class="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm">
                                {{ c.effectif }}
                            </div>
                        </div>
                        
                        <div class="space-y-2 mb-6">
                            <div class="flex items-center gap-2 text-sm text-zinc-600 font-medium">
                                <i class="ph ph-chalkboard-teacher text-brand-500"></i>
                                <span>{{ c.titulaire_nom ? c.titulaire_nom + ' ' + c.titulaire_prenom : 'Aucun titulaire' }}</span>
                            </div>
                        </div>

                        <div class="flex gap-2 pt-4 border-t border-zinc-100">
                            <button class="saas-btn-secondary flex-1 text-xs" (click)="viewClasseEleves(c.id)">
                                <i class="ph ph-users mr-1.5"></i> Élèves
                            </button>
                            <button class="saas-btn-secondary text-xs p-2" (click)="openEditClasseModal(c)" title="Éditer">
                                <i class="ph ph-pencil-simple text-lg"></i>
                            </button>
                            <button class="saas-btn-secondary text-xs p-2 text-red-400 hover:text-red-600 hover:bg-red-50" (click)="openDeleteModal(c.id, 'classe')" title="Supprimer">
                                <i class="ph ph-trash text-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div *ngIf="classesLoading" class="py-12 text-center">
                    <i class="ph ph-spinner-gap animate-spin text-3xl text-zinc-300"></i>
                </div>
            </div>

            <!-- 4. INSCRIPTIONS / RÉINSCRIPTIONS AVEC RECHERCHE -->
            <div *ngIf="activeTab === 'inscriptions'" class="space-y-4 animate-fade-in">
                <div class="flex justify-end">
                    <button class="saas-btn-primary" (click)="openInscriptionModal()">
                        <i class="ph ph-user-plus mr-1.5"></i> Confirmer un Élève (Réinscription)
                    </button>
                </div>

                <div class="saas-table-container">
                    <div class="saas-table-scroll">
                        <table class="saas-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Élève</th>
                                    <th>Classe</th>
                                    <th>Année</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let i of inscriptionsResults" class="group">
                                    <td class="text-xs font-bold text-zinc-500 uppercase">{{ i.date_inscription | date:'dd MMM yyyy' }}</td>
                                    <td>
                                        <div class="font-bold text-zinc-900">{{ i.eleve_nom }} {{ i.eleve_prenom }}</div>
                                        <div class="text-[10px] font-mono text-zinc-400">{{ i.eleve_matricule }}</div>
                                    </td>
                                    <td>
                                        <span class="text-sm font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded border border-brand-100">
                                            {{ getClasseDisplayNameFromInscription(i) }}
                                        </span>
                                    </td>
                                    <td><span class="saas-badge-neutral">{{ i.annee_scolaire_nom }}</span></td>
                                    <td class="text-right">
                                        <button class="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" 
                                                (click)="openDeleteModal(i.id, 'inscription')" title="Annuler l'inscription">
                                            <i class="ph ph-x-circle text-xl"></i>
                                        </button>
                                    </td>
                                </tr>
                                <tr *ngIf="inscriptionsLoading">
                                    <td colspan="5" class="py-12 text-center text-zinc-400">
                                        <i class="ph ph-spinner-gap animate-spin text-3xl mb-2"></i>
                                        <p class="text-sm">Chargement des inscriptions...</p>
                                    </td>
                                </tr>
                                <tr *ngIf="!inscriptionsLoading && inscriptionsResults.length === 0">
                                    <td colspan="5" class="py-12 text-center text-zinc-400">
                                        <i class="ph ph-tray text-3xl mb-2"></i>
                                        <p class="text-sm">Aucune inscription pour l'année en cours.</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 5. COMMUNICATIONS / MESSAGES WHATSAPP -->
            <div *ngIf="activeTab === 'messages'" class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                
                <!-- COMPOSITEUR DE CAMPAGNE -->
                <div class="lg:col-span-2 space-y-6">
                    <div class="saas-card p-6">
                        <div class="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-6">
                            <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <i class="ph ph-paper-plane-tilt text-xl"></i>
                            </div>
                            <div>
                                <h3 class="text-base font-bold text-zinc-900">Nouvelle Communication WhatsApp</h3>
                                <p class="text-zinc-500 text-xs mt-0.5">Diffusez des alertes ou rappels directement aux parents d'élèves</p>
                            </div>
                        </div>

                        <!-- Filtres de Ciblage -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label class="saas-label font-bold text-zinc-700">Cible de la diffusion *</label>
                                <select class="saas-input" [(ngModel)]="whatsAppTargetType">
                                    <option value="ecole">Toute l'école (tous les parents d'élèves inscrits)</option>
                                    <option value="classe">Une classe spécifique</option>
                                </select>
                            </div>
                            <div *ngIf="whatsAppTargetType === 'classe'">
                                <label class="saas-label font-bold text-zinc-700">Sélectionner la classe *</label>
                                <select class="saas-input" [(ngModel)]="whatsAppTargetId">
                                    <option [ngValue]="null">--- Choisir une classe ---</option>
                                    <option *ngFor="let c of classesForSelect" [ngValue]="c.id">{{ c.displayName }}</option>
                                </select>
                            </div>
                        </div>

                        <!-- Champ Saisie Message -->
                        <div class="mb-6">
                            <label class="saas-label font-bold text-zinc-700">Message *</label>
                            <textarea 
                                class="saas-input min-h-[160px] font-medium text-sm leading-relaxed" 
                                [value]="whatsAppMessage"
                                (input)="onWhatsAppMessageInput($event)"
                                [attr.maxlength]="WHATSAPP_MAX_LENGTH"
                                placeholder="Saisissez votre communiqué ici... (Vous pouvez utiliser *gras* ou _italique_ pour formater le texte)"></textarea>
                            
                            <div class="flex justify-between items-center mt-2 text-xs">
                                <span class="text-zinc-400">
                                    Note: L'en-tête de l'école sera injecté automatiquement.
                                </span>
                                <span class="font-bold {{ getWhatsAppCounterClass() }}">
                                    {{ whatsAppMessage.length }} / {{ WHATSAPP_MAX_LENGTH }} caractères
                                </span>
                            </div>
                        </div>

                        <!-- Bouton d'action -->
                        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                            <button class="saas-btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 focus:ring-emerald-500 font-extrabold w-full md:w-auto md:px-8" 
                                    (click)="sendWhatsAppCampaign()"
                                    [disabled]="whatsAppSubmitting 
                                                || !whatsAppMessage.trim() 
                                                || whatsAppMessage.length > WHATSAPP_MAX_LENGTH
                                                || (whatsAppTargetType === 'classe' && !whatsAppTargetId)">
                                <i class="ph ph-spinner-gap animate-spin mr-1.5" *ngIf="whatsAppSubmitting"></i>
                                <i class="ph ph-whatsapp-logo mr-1.5" *ngIf="!whatsAppSubmitting"></i>
                                Lancer la diffusion
                            </button>
                        </div>

                        <!-- Erreurs et succès de la campagne -->
                        <div *ngIf="whatsAppCampaignError" class="mt-4 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm font-medium flex items-start gap-3">
                            <i class="ph ph-x-circle text-lg shrink-0 mt-0.5"></i>
                            <span>{{ whatsAppCampaignError }}</span>
                        </div>
                        <div *ngIf="whatsAppCampaignSuccess" class="mt-4 bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200 text-sm font-medium flex items-start gap-3">
                            <i class="ph ph-check-circle text-lg shrink-0 mt-0.5"></i>
                            <span>{{ whatsAppCampaignSuccess }}</span>
                        </div>
                    </div>

                    <!-- APERCU DU MESSAGE (WhatsApp Live Preview) -->
                    <div class="saas-card p-6 bg-zinc-50 border-zinc-200 shadow-inner">
                        <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <i class="ph ph-eye"></i> Aperçu en temps réel (sur WhatsApp)
                        </h4>
                        <!-- Mockup de discussion WhatsApp -->
                        <div class="max-w-md mx-auto bg-[#efeae2] border border-zinc-300 rounded-2xl shadow-md overflow-hidden relative" style="min-height: 250px;">
                            <div class="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-zinc-300 flex items-center justify-center text-zinc-700 font-bold text-xs">
                                    🏫
                                </div>
                                <div>
                                    <div class="text-xs font-bold tracking-tight">Scolarnet Communication</div>
                                    <div class="text-[10px] text-zinc-300">En ligne</div>
                                </div>
                            </div>
                            <div class="p-4 space-y-3 flex flex-col justify-end" style="min-height: 190px;">
                                <!-- Message Bubble -->
                                <div class="self-start bg-white text-zinc-800 p-3 rounded-lg rounded-tl-none shadow-sm max-w-[85%] text-xs relative leading-relaxed whitespace-pre-line">
                                    <span class="font-extrabold text-[#075e54] block">🏫 {{ (whatsAppSchoolName || "NOM DE L'ECOLE") | uppercase }}</span>
                                    <span class="text-zinc-400 text-[10px] tracking-tighter block mb-2">━━━━━━━━━━━━━━━━━━━━━</span>
                                    <span>{{ whatsAppMessage || '(Votre message apparaîtra ici...)' }}</span>
                                    <span class="text-[9px] text-zinc-400 block text-right mt-1.5 font-mono">12:00</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONFIGURATION ET LIVE MONITORING -->
                <div class="space-y-6">
                    
                    <!-- SUIVI D'ENVOI EN DIRECT -->
                    <div class="saas-card p-6 bg-zinc-900 border-zinc-800 text-white" *ngIf="currentJobStatus">
                        <div class="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                            <div class="flex items-center gap-2">
                                <i class="ph ph-broadcast text-emerald-400 text-lg"></i>
                                <h3 class="text-sm font-black uppercase tracking-wider text-emerald-400">Diffusion Active</h3>
                            </div>
                            <span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest"
                                  [class.bg-emerald-500]="currentJobStatus.status === 'termine'"
                                  [class.bg-blue-500]="currentJobStatus.status === 'en_cours'"
                                  [class.bg-red-500]="currentJobStatus.status === 'erreur'">
                                {{ currentJobStatus.status === 'en_cours' ? 'En cours' : currentJobStatus.status === 'termine' ? 'Terminé' : 'Erreur' }}
                            </span>
                        </div>

                        <!-- Progress Bar -->
                        <div class="space-y-2 mb-4">
                            <div class="flex justify-between text-xs font-bold text-zinc-400">
                                <span>Progression d'envoi</span>
                                <span>{{ currentJobStatus.sent + currentJobStatus.failed }} / {{ currentJobStatus.total }}</span>
                            </div>
                            <div class="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300" 
                                     [style.width.%]="(currentJobStatus.sent + currentJobStatus.failed) / currentJobStatus.total * 100"></div>
                            </div>
                        </div>

                        <!-- Statistiques détaillées -->
                        <div class="grid grid-cols-2 gap-3 mb-4">
                            <div class="bg-zinc-800/50 p-3 rounded-lg border border-zinc-800 text-center">
                                <div class="text-[10px] font-bold text-emerald-400 uppercase">Succès ✅</div>
                                <div class="text-xl font-black mt-1">{{ currentJobStatus.sent }}</div>
                            </div>
                            <div class="bg-zinc-800/50 p-3 rounded-lg border border-zinc-800 text-center">
                                <div class="text-[10px] font-bold text-red-400 uppercase">Échecs ❌</div>
                                <div class="text-xl font-black mt-1">{{ currentJobStatus.failed }}</div>
                            </div>
                        </div>

                        <!-- Table des Erreurs d'envois -->
                        <div class="space-y-2" *ngIf="currentJobStatus.errors.length > 0">
                            <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 text-red-400">
                                <i class="ph ph-warning"></i> Échecs détaillés ({{ currentJobStatus.errors.length }})
                            </h4>
                            <div class="max-h-[150px] overflow-y-auto space-y-2 pr-1 no-scrollbar text-xs">
                                <div *ngFor="let err of currentJobStatus.errors" class="p-2 bg-red-950/40 border border-red-900/30 rounded text-red-300 space-y-1">
                                    <div class="flex justify-between font-bold">
                                        <span>{{ err.parentName }}</span>
                                        <span>{{ err.number }}</span>
                                    </div>
                                    <div class="text-[10px] text-red-400/90 leading-tight">
                                        {{ err.error }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODALES (Élève, Classe, Inscription, Suppression, Confirmation) -->
        
        <!-- MODALE ÉLÈVE -->
        <div *ngIf="eleveModalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'eleveModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-2xl p-0 relative z-10 animate-slide-up shadow-modal flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
                <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 flex-shrink-0">
                    <div>
                        <h3 class="text-lg font-bold text-zinc-900">{{ eleveModalEditMode ? "Modifier l'élève" : "Nouvel élève" }}</h3>
                        <p class="text-zinc-500 text-xs mt-0.5">Le matricule sera généré automatiquement.</p>
                    </div>
                    <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="eleveModalOpen = false"><i class="ph ph-x text-xl"></i></button>
                </div>
                
                <div class="p-6 overflow-y-auto flex-1 space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div class="md:col-span-1">
                            <label class="saas-label">Nom *</label>
                            <input class="saas-input" type="text" [(ngModel)]="eleveForm.nom" />
                        </div>
                        <div class="md:col-span-1">
                            <label class="saas-label">Postnom</label>
                            <input class="saas-input" type="text" [(ngModel)]="eleveForm.postnom" />
                        </div>
                        <div class="md:col-span-1">
                            <label class="saas-label">Prénom *</label>
                            <input class="saas-input" type="text" [(ngModel)]="eleveForm.prenom" />
                        </div>
                        
                        <div>
                            <label class="saas-label">Sexe *</label>
                            <select class="saas-input" [(ngModel)]="eleveForm.sexe">
                                <option value="M">Masculin</option>
                                <option value="F">Féminin</option>
                            </select>
                        </div>
                        <div>
                            <label class="saas-label">Date de naissance</label>
                            <input class="saas-input" type="date" [(ngModel)]="eleveForm.date_naissance" />
                        </div>
                        <div>
                            <label class="saas-label">Lieu de naissance</label>
                            <input class="saas-input" type="text" [(ngModel)]="eleveForm.lieu_naissance" placeholder="Ex: Kinshasa" />
                        </div>
                        
                        <div>
                            <label class="saas-label">Nom du père</label>
                            <input class="saas-input" type="text" [(ngModel)]="eleveForm.nom_pere" />
                        </div>
                        <div>
                            <label class="saas-label">Nom de la mère</label>
                            <input class="saas-input" type="text" [(ngModel)]="eleveForm.nom_mere" />
                        </div>
                        
                        <div class="md:col-span-2">
                            <label class="saas-label">Numéro du parent</label>

                            <!-- Conteneur unique style "input" avec 2 cases collées -->
                            <div class="flex items-stretch w-full rounded-lg border border-zinc-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-all">

                                <!-- CASE GAUCHE : Drapeau + Indicatif (select) -->
                                <div class="relative shrink-0 border-r border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors">
                                    <select
                                        class="appearance-none bg-transparent h-full pl-3 pr-7 font-mono text-sm font-bold text-zinc-800 cursor-pointer focus:outline-none"
                                        [(ngModel)]="selectedPays"
                                        (ngModelChange)="onPaysChange()">
                                        <option *ngFor="let p of paysList" [ngValue]="p">
                                            {{ p.drapeau }} {{ p.indicatif }}
                                        </option>
                                    </select>
                                    <!-- Petite flèche pour indiquer que c'est un select -->
                                    <i class="ph ph-caret-down absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none text-xs"></i>
                                </div>

                                <!-- CASE DROITE : Numéro local -->
                                <input
                                    class="flex-1 px-3 py-2.5 font-mono tracking-wider text-sm text-zinc-900 focus:outline-none bg-transparent"
                                    type="tel"
                                    inputmode="numeric"
                                    [attr.maxlength]="selectedPays.longueur"
                                    [(ngModel)]="numeroParentLocal"
                                    (input)="onNumeroParentInput($event)"
                                    [placeholder]="'0'.repeat(selectedPays.longueur)" />
                            </div>

                            <p class="text-[10px] text-zinc-400 mt-1">
                                Entrez {{ selectedPays.longueur }} chiffres <strong>sans le 0 initial</strong>
                                (ex: {{ selectedPays.indicatif }} {{ '9'.repeat(selectedPays.longueur) }})
                            </p>
                        </div>
                        
                        <div class="md:col-span-3">
                            <label class="saas-label">Adresse de résidence</label>
                            <input class="saas-input" type="text" [(ngModel)]="eleveForm.adresse" placeholder="Quartier, Avenue, N°..." />
                        </div>

                        <!-- Classe obligatoire -->
                        <div class="md:col-span-3">
                            <label class="saas-label">Classe *</label>
                            <select class="saas-input" [(ngModel)]="eleveForm.classe_id">
                                <option [ngValue]="null">--- Sélectionner une classe ---</option>
                                <option *ngFor="let c of classesForSelect" [ngValue]="c.id">{{ c.displayName }}</option>
                            </select>
                            <p class="text-xs text-red-500 mt-1" *ngIf="eleveFormError && !eleveForm.classe_id">La classe est obligatoire pour l'inscription.</p>
                        </div>
                    </div>
                    
                    <div *ngIf="eleveFormError" class="bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 text-xs font-bold flex items-start gap-2">
                        <i class="ph ph-x-circle text-lg shrink-0"></i>
                        <span>{{ eleveFormError }}</span>
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3 flex-shrink-0">
                    <button class="saas-btn-secondary" (click)="eleveModalOpen = false">Annuler</button>
                    <button class="saas-btn-primary" (click)="submitEleveForm()" [disabled]="eleveFormSubmitting || isLoading">
                        <i class="ph ph-check-circle mr-1.5" *ngIf="!eleveFormSubmitting"></i>
                        <i class="ph ph-spinner-gap animate-spin mr-1.5" *ngIf="eleveFormSubmitting"></i>
                        {{ eleveModalEditMode ? 'Mettre à jour' : 'Créer' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- MODALE CLASSE -->
        <div *ngIf="classeModalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'classeModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-md p-0 relative z-10 animate-slide-up shadow-modal" (click)="$event.stopPropagation()">
                <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                    <h3 class="text-lg font-bold text-zinc-900">{{ classeModalEditMode ? 'Modifier la classe' : 'Nouvelle Classe' }}</h3>
                    <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="classeModalOpen = false"><i class="ph ph-x text-xl"></i></button>
                </div>
                
                <div class="p-6 space-y-4">
                    <div>
                        <label class="saas-label">Nom de la classe (Ex: 1ère Année)</label>
                        <input class="saas-input" type="text" [(ngModel)]="classeForm.nom" />
                    </div>
                    <div>
                        <label class="saas-label">Section (Optionnel, Ex: Secondaire)</label>
                        <input class="saas-input" type="text" [(ngModel)]="classeForm.section" />
                    </div>
                    <div>
                        <label class="saas-label">Option / Orientation (Ex: Pédagogie)</label>
                        <input class="saas-input" type="text" [(ngModel)]="classeForm.option_classe" />
                    </div>
                    <div>
                        <label class="saas-label">Professeur Titulaire</label>
                        <select class="saas-input" [(ngModel)]="classeForm.titulaire_id">
                            <option [ngValue]="null">--- Aucun titulaire ---</option>
                            <option *ngFor="let t of titulairesList" [ngValue]="t.id">{{ t.nom }} {{ t.prenom }} ({{ t.matricule }})</option>
                        </select>
                    </div>
                    <div *ngIf="classeFormError" class="text-red-500 text-xs font-bold">{{ classeFormError }}</div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
                    <button class="saas-btn-secondary" (click)="classeModalOpen = false">Annuler</button>
                    <button class="saas-btn-primary" (click)="submitClasseForm()" [disabled]="classeFormSubmitting || isLoading">
                        {{ classeModalEditMode ? 'Mettre à jour' : 'Créer la classe' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- MODALE INSCRIPTION / CONFIRMATION AVEC RECHERCHE -->
        <div *ngIf="inscriptionModalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'inscriptionModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-lg p-0 relative z-10 animate-slide-up shadow-modal" (click)="$event.stopPropagation()">
                <div class="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-zinc-900">Confirmer l'inscription (Réinscription)</h3>
                    <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="inscriptionModalOpen = false"><i class="ph ph-x text-xl"></i></button>
                </div>
                
                <div class="p-6 space-y-4">
                    <!-- RECHERCHE D'ÉLÈVES -->
                    <div>
                        <label class="saas-label">Rechercher un élève *</label>
                        <div class="relative">
                            <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
                            <input class="saas-input pl-10" 
                                   type="text" 
                                   [(ngModel)]="inscriptionSearchQuery"
                                   (input)="onInscriptionSearch()"
                                   placeholder="Nom, postnom, prénom ou matricule..." />
                        </div>
                        <!-- Résultats de recherche -->
                        <div *ngIf="inscriptionSearchResults.length > 0" class="mt-2 border border-zinc-200 rounded-lg overflow-hidden shadow-sm max-h-[200px] overflow-y-auto">
                            <div *ngFor="let e of inscriptionSearchResults" 
                                 class="px-4 py-2 hover:bg-brand-50 cursor-pointer border-b border-zinc-100 last:border-0 flex items-center justify-between"
                                 (click)="selectEleveForInscription(e)">
                                <div>
                                    <span class="font-bold text-zinc-900">{{ e.nom }} {{ e.prenom }}</span>
                                    <span class="text-xs text-zinc-400 ml-2 font-mono">{{ e.matricule }}</span>
                                    <div class="text-xs text-zinc-500">
                                        <span *ngIf="e.derniere_classe_nom">Dernière: {{ e.derniere_classe_nom }}</span>
                                        <span *ngIf="!e.derniere_classe_nom" class="text-zinc-400">Nouvel élève</span>
                                        <span *ngIf="e.derniere_annee_nom" class="text-zinc-400 ml-1">({{ e.derniere_annee_nom }})</span>
                                    </div>
                                </div>
                                <button class="saas-btn-primary text-xs py-1 px-3" [disabled]="e.isAlreadyInscribed">
                                    {{ e.isAlreadyInscribed ? 'Déjà inscrit' : 'Sélectionner' }}
                                </button>
                            </div>
                        </div>
                        <div *ngIf="inscriptionSearchResults.length === 0 && inscriptionSearchQuery.trim().length > 0" class="mt-2 text-sm text-zinc-500 p-3 border border-zinc-200 rounded-lg text-center">
                            Aucun élève trouvé pour "<strong>{{ inscriptionSearchQuery }}</strong>"
                        </div>
                        <!-- Élève sélectionné -->
                        <div *ngIf="inscriptionForm.eleve_id" class="mt-3 p-3 bg-brand-50 border border-brand-200 rounded-lg flex items-center justify-between">
                            <div>
                                <span class="font-bold text-brand-700">{{ inscriptionSelectedEleve?.nom }} {{ inscriptionSelectedEleve?.prenom }}</span>
                                <span class="text-xs text-brand-500 ml-2 font-mono">{{ inscriptionSelectedEleve?.matricule }}</span>
                                <div class="text-xs text-brand-400">
                                    <span *ngIf="inscriptionSelectedEleve?.derniere_classe_nom">Dernière classe: {{ inscriptionSelectedEleve?.derniere_classe_nom }}</span>
                                    <span *ngIf="!inscriptionSelectedEleve?.derniere_classe_nom" class="text-brand-300">Nouvel élève</span>
                                    <span *ngIf="inscriptionSelectedEleve?.derniere_annee_nom" class="text-brand-300 ml-1">({{ inscriptionSelectedEleve?.derniere_annee_nom }})</span>
                                </div>
                            </div>
                            <button class="text-zinc-400 hover:text-red-500" (click)="clearSelectedEleve()">
                                <i class="ph ph-x-circle text-xl"></i>
                            </button>
                        </div>
                    </div>

                    <!-- CLASSE DE DESTINATION -->
                    <div>
                        <label class="saas-label">Nouvelle classe (Classe de destination) *</label>
                        <select class="saas-input" [(ngModel)]="inscriptionForm.classe_id">
                            <option [ngValue]="null">--- Sélectionner la nouvelle classe ---</option>
                            <option *ngFor="let c of classesForSelect" [ngValue]="c.id">{{ c.displayName }}</option>
                        </select>
                    </div>

                    <div *ngIf="inscriptionFormError" class="text-red-500 text-xs font-bold">{{ inscriptionFormError }}</div>
                    <div class="bg-brand-50 text-brand-700 p-3 rounded-lg border border-brand-100 text-[10px] uppercase font-bold tracking-wider leading-relaxed">
                        Cette confirmation affectera l'élève à la nouvelle classe pour la nouvelle année scolaire active automatiquement. Les traces de ses anciennes classes et anciennes notes seront intégralement préservées pour l'archivage.
                    </div>
                </div>

                <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
                    <button class="saas-btn-secondary" (click)="inscriptionModalOpen = false">Annuler</button>
                    <button class="saas-btn-primary" (click)="submitInscriptionForm()" [disabled]="inscriptionFormSubmitting || isLoading || !inscriptionForm.eleve_id || !inscriptionForm.classe_id">
                        Valider la confirmation
                    </button>
                </div>
            </div>
        </div>

        <!-- ✅ MODALE DE CONFIRMATION APRÈS INSCRIPTION -->
        <div *ngIf="confirmationModalOpen" class="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'confirmationModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-md p-8 relative z-10 animate-slide-up shadow-modal text-center" (click)="$event.stopPropagation()">
                <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="ph ph-check-circle text-3xl"></i>
                </div>
                <h3 class="text-xl font-bold text-zinc-900 mb-2">Inscription réussie ! 🎉</h3>
                <p class="text-zinc-600 text-sm mb-6">L'élève a été enregistré avec succès dans le système.</p>
                
                <div class="bg-zinc-50 rounded-xl p-4 mb-6 text-left space-y-2">
                    <div class="flex justify-between">
                        <span class="text-zinc-500 font-medium">Nom complet :</span>
                        <span class="text-zinc-900 font-bold">{{ confirmationData?.nom }} {{ confirmationData?.prenom }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-zinc-500 font-medium">Matricule :</span>
                        <span class="text-brand-600 font-mono font-bold">{{ confirmationData?.matricule }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-zinc-500 font-medium">Classe :</span>
                        <span class="text-zinc-900 font-medium">{{ confirmationData?.classe }}</span>
                    </div>
                </div>
                
                <p class="text-xs text-zinc-400 mb-4">Veuillez communiquer le matricule à l'élève.</p>
                
                <div class="flex gap-3">
                    <button class="saas-btn-secondary flex-1" (click)="confirmationModalOpen = false">Fermer</button>
                    <button class="saas-btn-primary flex-1" (click)="confirmationModalOpen = false; openCreateEleveModal()">
                        <i class="ph ph-plus-circle mr-1.5"></i> Nouveau
                    </button>
                </div>
            </div>
        </div>

        <!-- MODALE SUPPRESSION -->
        <div *ngIf="deleteModalOpen" class="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in" (click)="closeModal($event, 'deleteModalOpen')">
            <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            <div class="saas-card w-full max-w-sm p-8 relative z-10 animate-slide-up shadow-modal text-center" (click)="$event.stopPropagation()">
                <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="ph ph-warning-circle text-3xl"></i>
                </div>
                <h3 class="text-xl font-bold text-zinc-900 mb-2">Confirmer la suppression</h3>
                <p class="text-zinc-500 text-sm mb-8">Cette action est définitive et pourrait affecter d'autres données liées. Continuer ?</p>
                
                <div class="flex gap-3">
                    <button class="saas-btn-secondary flex-1" (click)="deleteModalOpen = false" [disabled]="deleteSubmitting">Annuler</button>
                    <button class="saas-btn-danger flex-1" (click)="confirmDelete()" [disabled]="deleteSubmitting">
                        {{ deleteSubmitting ? '...' : 'Supprimer' }}
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `]
})
export class SecretariatComponent implements OnInit, OnDestroy {
    private API_BASE = 'http://207.180.205.248:3007';
    readonly WHATSAPP_MAX_LENGTH = 1000;
    private destroy$ = new Subject<void>();
    private elevesSearchSubject = new Subject<string>();
    private inscriptionSearchSubject = new Subject<string>();
    private routeSubscription: any;
    paysList = [
        { code: 'CD', nom: 'Congo (RDC)', indicatif: '+243', drapeau: '🇨🇩', longueur: 9 },
        { code: 'CG', nom: 'Congo (Brazzaville)', indicatif: '+242', drapeau: '🇨🇬', longueur: 9 },
        { code: 'CI', nom: "Côte d'Ivoire", indicatif: '+225', drapeau: '🇨🇮', longueur: 10 },
        { code: 'SN', nom: 'Sénégal', indicatif: '+221', drapeau: '🇸🇳', longueur: 9 },
        { code: 'CM', nom: 'Cameroun', indicatif: '+237', drapeau: '🇨🇲', longueur: 9 },
        { code: 'RW', nom: 'Rwanda', indicatif: '+250', drapeau: '🇷🇼', longueur: 9 },
        { code: 'BI', nom: 'Burundi', indicatif: '+257', drapeau: '🇧🇮', longueur: 8 },
        { code: 'TZ', nom: 'Tanzanie', indicatif: '+255', drapeau: '🇹🇿', longueur: 9 },
        { code: 'KE', nom: 'Kenya', indicatif: '+254', drapeau: '🇰🇪', longueur: 9 },
        { code: 'UG', nom: 'Ouganda', indicatif: '+256', drapeau: '🇺🇬', longueur: 9 },
        { code: 'SS', nom: 'Soudan du Sud', indicatif: '+211', drapeau: '🇸🇸', longueur: 9 },
        { code: 'GA', nom: 'Gabon', indicatif: '+241', drapeau: '🇬🇦', longueur: 8 },
        { code: 'ML', nom: 'Mali', indicatif: '+223', drapeau: '🇲🇱', longueur: 8 },
        { code: 'BF', nom: 'Burkina Faso', indicatif: '+226', drapeau: '🇧🇫', longueur: 8 },
        { code: 'TG', nom: 'Togo', indicatif: '+228', drapeau: '🇹🇬', longueur: 8 },
        { code: 'BJ', nom: 'Bénin', indicatif: '+229', drapeau: '🇧🇯', longueur: 8 },
        { code: 'BE', nom: 'Belgique', indicatif: '+32', drapeau: '🇧🇪', longueur: 9 },
        { code: 'FR', nom: 'France', indicatif: '+33', drapeau: '🇫🇷', longueur: 9 },
        { code: 'US', nom: 'États-Unis', indicatif: '+1', drapeau: '🇺🇸', longueur: 10 },
        { code: 'CA', nom: 'Canada', indicatif: '+1', drapeau: '🇨🇦', longueur: 10 },
    ];

    // 🎯 Pays actuellement sélectionné (RDC par défaut)
    selectedPays: any = this.paysList[0];

    // 🎯 Numéro local (chiffres uniquement, sans le 0 devant)
    numeroParentLocal: string = '';

    // État global
    isLoading = false;
    currentDate = new Date();

    // Statistiques
    stats: any = {
        totalEleves: 0,
        totalClasses: 0,
        totalInscriptions: 0,
        activeYear: null,
        repartition: [],
        classesEffectifs: [],
        recentInscriptions: [],
        evolution: []
    };
    statsLoading = true;

    // Onglet actif
    activeTab: 'dashboard' | 'eleves' | 'classes' | 'inscriptions' | 'messages' = 'dashboard';

    // Configuration WhatsApp
    whatsAppToken = '';
    whatsAppPhoneNumberId = '';
    whatsAppSchoolName = '';
    whatsAppConfigLoading = false;
    whatsAppConfigSaving = false;
    whatsAppConfigError = '';
    whatsAppConfigSuccess = '';

    // Campagne WhatsApp
    whatsAppMessage = '';
    whatsAppTargetType: 'classe' | 'ecole' = 'ecole';
    whatsAppTargetId: number | null = null;
    whatsAppSubmitting = false;
    whatsAppCampaignError = '';
    whatsAppCampaignSuccess = '';

    // Suivi de Job (Polling)
    currentJobId: string | null = null;
    currentJobStatus: any = null;
    pollingIntervalId: any = null;

    // Graphiques ngx-charts
    repartitionColorScheme: any = { domain: ['#3b82f6', '#ec4899'] };
    repartitionData: any[] = [
        { name: 'Masculin', value: 0 },
        { name: 'Féminin', value: 0 }
    ];

    effectifsData: any[] = [];
    effectifsColorScheme = ['#2196F3', '#FF5722', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4', '#E91E63'];

    evolutionData: any[] = [];
    evolutionColorScheme = ['#2196F3'];

    animations = true;
    xAxis = true;
    yAxis = true;
    timeline = true;

    // Élèves
    elevesLoading = false;
    elevesError = '';
    elevesResults: Eleve[] = [];
    elevesTotal = 0;
    elevesPage = 1;
    elevesPageSize = 10;
    elevesLastPage = 1;
    elevesSearch = '';
    elevesFiltreClasse: number | null = null;
    elevesFiltreSexe: string | null = null;

    // Classes
    classesLoading = false;
    classesResults: Classe[] = [];
    classesForSelect: ClasseForSelect[] = [];

    // Inscriptions
    inscriptionsLoading = false;
    inscriptionsError = '';
    inscriptionsResults: Inscription[] = [];

    // Titulaires
    titulairesList: Titulaire[] = [];

    // Élèves pour la recherche d'inscription
    inscriptionSearchQuery: string = '';
    inscriptionSearchResults: any[] = [];
    inscriptionSearchLoading: boolean = false;
    inscriptionSelectedEleve: any = null;

    // MODALE: Élève
    eleveModalOpen = false;
    eleveModalEditMode = false;
    eleveModalEditId: number | null = null;
    eleveFormSubmitting = false;
    eleveFormError = '';
    eleveForm = {
        nom: '',
        postnom: '',
        prenom: '',
        sexe: 'M' as 'M' | 'F',
        date_naissance: '',
        lieu_naissance: '',
        nom_pere: '',
        nom_mere: '',
        numero_parent: '',
        adresse: '',
        niveau_etude: '',
        classe_id: null as number | null
    };

    // MODALE: Classe
    classeModalOpen = false;
    classeModalEditMode = false;
    classeModalEditId: number | null = null;
    classeFormSubmitting = false;
    classeFormError = '';
    classeForm = {
        nom: '',
        section: '',
        option_classe: '',
        titulaire_id: null as number | null
    };

    // MODALE: Inscription
    inscriptionModalOpen = false;
    inscriptionFormSubmitting = false;
    inscriptionFormError = '';
    inscriptionForm = {
        eleve_id: null as number | null,
        classe_id: null as number | null
    };

    // ✅ MODALE: Confirmation
    confirmationModalOpen = false;
    confirmationData: any = null;

    // MODALE: Suppression
    deleteModalOpen = false;
    deleteSubmitting = false;
    deleteId: number | null = null;
    deleteType: 'eleve' | 'classe' | 'inscription' = 'eleve';

    constructor(
        private http: HttpClient,
        private cdr: ChangeDetectorRef,
        private router: Router,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        // ✅ S'abonner aux changements de query params
        this.routeSubscription = this.route.queryParams.subscribe(params => {
            const tabParam = params['tab'];
            if (tabParam && ['dashboard', 'eleves', 'classes', 'inscriptions', 'messages'].includes(tabParam)) {
                // Mettre à jour l'onglet actif
                this.activeTab = tabParam as any;
                if (this.activeTab === 'messages') {
                    this.loadWhatsAppConfig();
                }
                this.cdr.detectChanges();
            }
        });

        // Lecture initiale des paramètres (pour le cas où le composant est chargé avec un tab)
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam && ['dashboard', 'eleves', 'classes', 'inscriptions', 'messages'].includes(tabParam)) {
            this.activeTab = tabParam as any;
            if (this.activeTab === 'messages') {
                this.loadWhatsAppConfig();
            }
        }

        this.loadAllData();
        this.setupElevesSearch();
        this.setupInscriptionSearch();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.stopCampaignPolling();
        if (this.routeSubscription) {
            this.routeSubscription.unsubscribe();
        }
    }

    private authHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    }

    private setLoading(loading: boolean): void {
        this.isLoading = loading;
        this.cdr.detectChanges();
    }

    setActiveTab(tab: 'dashboard' | 'eleves' | 'classes' | 'inscriptions' | 'messages'): void {
        this.activeTab = tab;
        if (tab === 'messages') {
            this.loadWhatsAppConfig();
        }
        this.router.navigate(['/secretariat/dashboard'], {
            queryParams: { tab: tab },
            replaceUrl: true
        });
        this.cdr.detectChanges();
    }

    closeModal(event: MouseEvent, modalKey: string): void {
        const target = event.target as HTMLElement;
        if (target.classList.contains('fixed') || target.classList.contains('absolute')) {
            (this as any)[modalKey] = false;
            this.cdr.detectChanges();
        }
    }

    // ===================== WHATSAPP METHODS =====================

    loadWhatsAppConfig(): void {
        this.whatsAppConfigLoading = true;
        this.whatsAppConfigError = '';
        this.whatsAppConfigSuccess = '';
        this.http.get<any>(`${this.API_BASE}/api/communication/whatsapp/config`, { headers: this.authHeaders() })
            .pipe(finalize(() => {
                this.whatsAppConfigLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res) => {
                    this.whatsAppToken = res.WHATSAPP_TOKEN || '';
                    this.whatsAppPhoneNumberId = res.WHATSAPP_PHONE_NUMBER_ID || '';
                    this.whatsAppSchoolName = res.schoolName || 'Mon Établissement';
                },
                error: (err) => {
                    console.error('Erreur config WhatsApp:', err);
                    this.whatsAppConfigError = 'Impossible de charger la configuration WhatsApp.';
                }
            });
    }

    saveWhatsAppConfig(): void {
        this.whatsAppConfigSaving = true;
        this.whatsAppConfigError = '';
        this.whatsAppConfigSuccess = '';
        const body = {
            WHATSAPP_TOKEN: this.whatsAppToken,
            WHATSAPP_PHONE_NUMBER_ID: this.whatsAppPhoneNumberId
        };
        this.http.post<any>(`${this.API_BASE}/api/communication/whatsapp/config`, body, { headers: this.authHeaders() })
            .pipe(finalize(() => {
                this.whatsAppConfigSaving = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: () => {
                    this.whatsAppConfigSuccess = 'Configuration WhatsApp enregistrée avec succès.';
                },
                error: (err) => {
                    console.error('Erreur sauvegarde config:', err);
                    this.whatsAppConfigError = err.error?.message || 'Erreur lors de la sauvegarde de la configuration.';
                }
            });
    }
    // 🎯 Contrôle de la saisie WhatsApp : coupe net au-delà de 1000 caractères
    onWhatsAppMessageInput(event: any): void {
        const input = event.target as HTMLTextAreaElement;
        let value = input.value;

        // ✂️ Coupure stricte à 1000 caractères
        if (value.length > this.WHATSAPP_MAX_LENGTH) {
            value = value.substring(0, this.WHATSAPP_MAX_LENGTH);
            input.value = value; // force la valeur dans le DOM
        }

        this.whatsAppMessage = value;
        this.cdr.detectChanges();
    }

    // 🎨 Classe de couleur du compteur
    getWhatsAppCounterClass(): string {
        const len = this.whatsAppMessage.length;
        if (len >= this.WHATSAPP_MAX_LENGTH) return 'text-red-500';
        if (len >= this.WHATSAPP_MAX_LENGTH * 0.8) return 'text-orange-500';
        return 'text-zinc-500';
    }
    sendWhatsAppCampaign(): void {
        // ✅ Validation : non vide
        if (!this.whatsAppMessage || !this.whatsAppMessage.trim()) {
            this.whatsAppCampaignError = 'Veuillez saisir un message à envoyer.';
            return;
        }

        // ✅ Validation : longueur max
        if (this.whatsAppMessage.length > this.WHATSAPP_MAX_LENGTH) {
            this.whatsAppCampaignError = `Le message est trop long (${this.whatsAppMessage.length} caractères). Maximum autorisé : ${this.WHATSAPP_MAX_LENGTH} caractères.`;
            return;
        }

        this.whatsAppSubmitting = true;
        this.whatsAppCampaignError = '';
        this.whatsAppCampaignSuccess = '';
        const body = {
            targetType: this.whatsAppTargetType,
            targetId: this.whatsAppTargetType === 'classe' ? this.whatsAppTargetId : null,
            message: this.whatsAppMessage
        };

        this.http.post<any>(`${this.API_BASE}/api/communication/whatsapp/campaign`, body, { headers: this.authHeaders() })
            .pipe(finalize(() => {
                this.whatsAppSubmitting = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res) => {
                    this.whatsAppCampaignSuccess = res.message;
                    this.whatsAppMessage = '';
                    if (res.jobId) {
                        this.startCampaignPolling(res.jobId);
                    }
                },
                error: (err) => {
                    console.error('Erreur envoi campagne:', err);
                    this.whatsAppCampaignError = err.error?.message || 'Erreur lors du lancement de la campagne.';
                }
            });
    }

    startCampaignPolling(jobId: string): void {
        this.stopCampaignPolling();
        this.currentJobId = jobId;
        this.getCampaignStatus(jobId);

        this.pollingIntervalId = setInterval(() => {
            if (this.currentJobId) {
                this.getCampaignStatus(this.currentJobId);
            }
        }, 2000);
    }

    stopCampaignPolling(): void {
        if (this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
            this.pollingIntervalId = null;
        }
    }

    getCampaignStatus(jobId: string): void {
        this.http.get<any>(`${this.API_BASE}/api/communication/whatsapp/campaign/${jobId}`, { headers: this.authHeaders() })
            .subscribe({
                next: (res) => {
                    this.currentJobStatus = res;
                    if (res.status === 'termine' || res.status === 'erreur') {
                        this.stopCampaignPolling();
                    }
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur de polling:', err);
                }
            });
    }

    // ===================== LOAD DATA METHODS =====================

    loadAllData(): void {
        this.loadStats();
        this.loadEleves();
        this.loadClasses();
        this.loadInscriptions();
        this.loadTitulaires();
    }

    refreshData(): void {
        this.loadAllData();
    }

    logout(): void {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        localStorage.removeItem('school_token');
        this.router.navigate(['/']);
    }

    // ===================== FONCTION D'AFFICHAGE DES CLASSES =====================

    getClasseDisplayName(nom: string | null, section: string | null, option: string | null): string {
        if (!nom) return '-';
        let display = nom;
        if (section && section.trim()) display = `${display} ${section}`;
        if (option && option.trim()) {
            if (section && section.trim()) display = `${display}/${option}`;
            else display = `${display} ${option}`;
        }
        return display;
    }

    getClasseDisplayNameFromClasse(classe: Classe | null): string {
        if (!classe) return '-';
        return this.getClasseDisplayName(classe.nom, classe.section, classe.option_classe);
    }

    getClasseDisplayNameFromInscription(inscription: Inscription | null): string {
        if (!inscription) return '-';
        return this.getClasseDisplayName(inscription.classe_nom, inscription.classe_section, inscription.classe_option);
    }

    getClasseDisplayNameFromEleve(eleve: Eleve | null): string {
        if (!eleve) return '-';
        return this.getClasseDisplayName(eleve.classe_nom, eleve.classe_section, eleve.classe_option);
    }

    // ===================== STATS ET GRAPHIQUES =====================

    loadStats(): void {
        this.statsLoading = true;
        this.http.get(`${this.API_BASE}/api/secretariat/stats`, { headers: this.authHeaders() })
            .pipe(timeout(10000))
            .pipe(finalize(() => {
                this.statsLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res: any) => {
                    this.stats = res;
                    this.updateCharts();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur stats secrétariat', err);
                    this.cdr.detectChanges();
                }
            });
    }

    updateCharts(): void {
        if (this.stats.repartition && this.stats.repartition.length > 0) {
            const males = this.stats.repartition.find((r: any) => r.sexe === 'M')?.count || 0;
            const females = this.stats.repartition.find((r: any) => r.sexe === 'F')?.count || 0;
            this.repartitionData = [
                { name: 'Masculin', value: males },
                { name: 'Féminin', value: females }
            ];
        }

        if (this.stats.classesEffectifs && this.stats.classesEffectifs.length > 0) {
            this.effectifsData = this.stats.classesEffectifs.map((c: any) => ({
                name: this.getClasseDisplayName(c.nom, c.section, c.option_classe),
                value: c.effectif
            }));
        }

        if (this.stats.evolution && this.stats.evolution.length > 0) {
            this.evolutionData = this.stats.evolution.map((e: any) => ({
                name: e.mois,
                value: e.count
            }));
        }

        this.cdr.detectChanges();
    }

    // ===================== ÉLÈVES =====================

    private setupElevesSearch(): void {
        this.elevesSearchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query.trim()) {
                    this.elevesPage = 1;
                    return of(null);
                }
                this.elevesPage = 1;
                this.elevesLoading = true;
                this.cdr.detectChanges();
                return this.loadElevesData();
            }),
            takeUntil(this.destroy$)
        ).subscribe((res: any) => {
            if (res) {
                this.elevesResults = res.results || [];
                this.elevesTotal = res.total || 0;
                this.elevesLastPage = Math.max(1, Math.ceil(this.elevesTotal / this.elevesPageSize));
                this.elevesError = '';
            }
            this.elevesLoading = false;
            this.cdr.detectChanges();
        });
    }

    loadElevesData(): any {
        const params = new URLSearchParams();
        params.set('page', String(this.elevesPage));
        params.set('pageSize', String(this.elevesPageSize));
        if (this.elevesSearch.trim()) params.set('search', this.elevesSearch);
        if (this.elevesFiltreClasse) params.set('classe_id', String(this.elevesFiltreClasse));
        if (this.elevesFiltreSexe) params.set('sexe', this.elevesFiltreSexe);

        return this.http.get(
            `${this.API_BASE}/api/secretariat/eleves?${params.toString()}`,
            { headers: this.authHeaders() }
        ).pipe(
            timeout(10000),
            catchError(err => {
                this.elevesError = err?.error?.message || 'Erreur de recherche.';
                this.elevesLoading = false;
                this.cdr.detectChanges();
                return of(null);
            })
        );
    }

    loadEleves(): void {
        this.elevesLoading = true;
        this.elevesError = '';
        this.cdr.detectChanges();

        this.loadElevesData().pipe(
            finalize(() => {
                this.elevesLoading = false;
                this.cdr.detectChanges();
            })
        ).subscribe((res: any) => {
            if (res) {
                this.elevesResults = res.results || [];
                this.elevesTotal = res.total || 0;
                this.elevesLastPage = Math.max(1, Math.ceil(this.elevesTotal / this.elevesPageSize));
            }
            this.cdr.detectChanges();
        });
    }

    onElevesSearch(): void {
        if (this.elevesSearch.trim()) {
            this.elevesSearchSubject.next(this.elevesSearch);
        } else {
            this.elevesPage = 1;
            this.loadEleves();
        }
    }

    appliquerFiltres(): void {
        this.elevesPage = 1;
        this.loadEleves();
    }

    resetFiltres(): void {
        this.elevesSearch = '';
        this.elevesFiltreClasse = null;
        this.elevesFiltreSexe = null;
        this.elevesPage = 1;
        this.loadEleves();
    }

    changePage(delta: number): void {
        const newPage = this.elevesPage + delta;
        if (newPage >= 1 && newPage <= this.elevesLastPage) {
            this.elevesPage = newPage;
            this.loadEleves();
        }
    }
    // 🔄 Changement de pays : on vide le numéro local
    onPaysChange(): void {
        this.numeroParentLocal = '';
        this.eleveForm.numero_parent = '';
        this.cdr.detectChanges();
    }

    // 🔢 Filtre la saisie : chiffres uniquement + suppression du 0 initial + limite
    onNumeroParentInput(event: any): void {
        let value = event.target.value.replace(/\D/g, ''); // que des chiffres

        // Enlever le 0 initial s'il est saisi
        if (value.startsWith('0')) {
            value = value.substring(1);
        }

        // Limiter à la longueur du pays
        value = value.substring(0, this.selectedPays.longueur);

        this.numeroParentLocal = value;
        event.target.value = value;

        // Reconstruire le numéro complet pour l'envoi
        this.eleveForm.numero_parent = value
            ? `${this.selectedPays.indicatif}${value}`
            : '';

        this.cdr.detectChanges();
    }
    openCreateEleveModal(): void {
        this.eleveModalEditMode = false;
        this.eleveModalEditId = null;
        this.selectedPays = this.paysList[0];
        this.numeroParentLocal = '';
        this.eleveForm = {
            nom: '',
            postnom: '',
            prenom: '',
            sexe: 'M',
            date_naissance: '',
            lieu_naissance: '',
            nom_pere: '',
            nom_mere: '',
            numero_parent: '',
            adresse: '',
            niveau_etude: '',
            classe_id: null
        };
        this.eleveFormError = '';
        this.eleveModalOpen = true;
        this.cdr.detectChanges();
    }

    openEditEleveModal(eleve: Eleve): void {
        this.eleveModalEditMode = true;
        this.eleveModalEditId = eleve.id;

        let dateNaissance = eleve.date_naissance || '';
        if (dateNaissance && (dateNaissance.includes(' ') || dateNaissance.includes('T'))) {
            dateNaissance = dateNaissance.split(' ')[0].split('T')[0];
        }

        // 🔎 Découper le numéro stocké (ex: +243973000000) en indicatif + numéro local
        const numeroComplet = eleve.numero_parent || '';
        let paysTrouve = this.paysList[0];
        let local = '';

        if (numeroComplet) {
            // Trier par indicatif le plus long pour éviter les conflits (+1 vs +243)
            const paysTries = [...this.paysList].sort(
                (a, b) => b.indicatif.length - a.indicatif.length
            );
            for (const p of paysTries) {
                if (numeroComplet.startsWith(p.indicatif)) {
                    paysTrouve = p;
                    local = numeroComplet.substring(p.indicatif.length).replace(/\D/g, '');
                    break;
                }
            }
            if (!local) local = numeroComplet.replace(/\D/g, '');
        }

        this.selectedPays = paysTrouve;
        this.numeroParentLocal = local;

        this.eleveForm = {
            nom: eleve.nom,
            postnom: eleve.postnom || '',
            prenom: eleve.prenom,
            sexe: eleve.sexe,
            date_naissance: dateNaissance,
            lieu_naissance: eleve.lieu_naissance || '',
            nom_pere: eleve.nom_pere || '',
            nom_mere: eleve.nom_mere || '',
            numero_parent: numeroComplet,
            adresse: eleve.adresse || '',
            niveau_etude: '',
            classe_id: eleve.classe_id || null
        };
        this.eleveFormError = '';
        this.eleveModalOpen = true;
        this.cdr.detectChanges();
    }

    submitEleveForm(): void {
        this.eleveFormError = '';

        if (!this.eleveForm.nom.trim() || !this.eleveForm.prenom.trim() || !this.eleveForm.sexe) {
            this.eleveFormError = 'Nom, prénom et sexe sont obligatoires.';
            this.cdr.detectChanges();
            return;
        }

        if (this.numeroParentLocal && this.numeroParentLocal.trim()) {
            const local = this.numeroParentLocal.trim();

            if (!/^\d+$/.test(local)) {
                this.eleveFormError = 'Le numéro ne doit contenir que des chiffres.';
                this.cdr.detectChanges();
                return;
            }
            if (local.length !== this.selectedPays.longueur) {
                this.eleveFormError = `Le numéro doit contenir exactement ${this.selectedPays.longueur} chiffres (sans le 0 initial).`;
                this.cdr.detectChanges();
                return;
            }
            // Reconstruction du numéro complet AVANT l'envoi
            this.eleveForm.numero_parent = `${this.selectedPays.indicatif}${local}`;
        } else {
            this.eleveForm.numero_parent = '';
        }

        if (!this.eleveForm.classe_id) {
            this.eleveFormError = 'Veuillez sélectionner une classe pour l\'élève.';
            this.cdr.detectChanges();
            return;
        }

        this.eleveFormSubmitting = true;
        this.setLoading(true);

        const payload = { ...this.eleveForm };
        if (payload.date_naissance && payload.date_naissance.includes('-')) {
            const parts = payload.date_naissance.split('-');
            if (parts.length === 3) payload.date_naissance = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        let url = `${this.API_BASE}/api/secretariat/eleves`;
        let method = 'POST';
        if (this.eleveModalEditMode && this.eleveModalEditId) {
            url = `${this.API_BASE}/api/secretariat/eleves/${this.eleveModalEditId}`;
            method = 'PUT';
        }

        this.http.request(method, url, { body: payload, headers: this.authHeaders() })
            .pipe(timeout(15000))
            .pipe(finalize(() => {
                this.eleveFormSubmitting = false;
                this.setLoading(false);
            }))
            .subscribe({
                next: (res: any) => {
                    this.eleveModalOpen = false;

                    const classeNom = this.classesForSelect.find(c => c.id === this.eleveForm.classe_id)?.displayName || 'Classe sélectionnée';
                    this.confirmationData = {
                        nom: this.eleveForm.nom,
                        prenom: this.eleveForm.prenom,
                        matricule: res.eleve?.matricule || 'Généré automatiquement',
                        classe: classeNom
                    };
                    this.confirmationModalOpen = true;

                    this.loadEleves();
                    this.loadStats();
                    this.eleveFormError = '';
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.eleveFormError = err?.error?.message || 'Erreur lors de l\'enregistrement.';
                    this.cdr.detectChanges();
                }
            });
    }

    // ===================== CLASSES =====================

    loadClasses(): void {
        this.classesLoading = true;
        this.cdr.detectChanges();
        this.http.get(`${this.API_BASE}/api/secretariat/classes`, { headers: this.authHeaders() })
            .pipe(timeout(10000))
            .pipe(finalize(() => {
                this.classesLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res: any) => {
                    this.classesResults = res.results || [];
                    this.classesForSelect = this.classesResults.map(c => ({
                        id: c.id,
                        nom: c.nom,
                        section: c.section,
                        option_classe: c.option_classe,
                        displayName: this.getClasseDisplayName(c.nom, c.section, c.option_classe)
                    }));
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur chargement classes', err);
                    this.cdr.detectChanges();
                }
            });
    }

    openCreateClasseModal(): void {
        this.classeModalEditMode = false;
        this.classeModalEditId = null;
        this.classeForm = { nom: '', section: '', option_classe: '', titulaire_id: null };
        this.classeFormError = '';
        this.classeModalOpen = true;
        this.cdr.detectChanges();
    }

    openEditClasseModal(classe: Classe): void {
        this.classeModalEditMode = true;
        this.classeModalEditId = classe.id;
        this.classeForm = {
            nom: classe.nom,
            section: classe.section || '',
            option_classe: classe.option_classe || '',
            titulaire_id: classe.titulaire_id || null
        };
        this.classeFormError = '';
        this.classeModalOpen = true;
        this.cdr.detectChanges();
    }

    submitClasseForm(): void {
        this.classeFormError = '';
        if (!this.classeForm.nom.trim()) {
            this.classeFormError = 'Le nom de la classe est obligatoire.';
            this.cdr.detectChanges();
            return;
        }

        this.classeFormSubmitting = true;
        this.setLoading(true);

        let url = `${this.API_BASE}/api/secretariat/classes`;
        let method = 'POST';
        if (this.classeModalEditMode && this.classeModalEditId) {
            url = `${this.API_BASE}/api/secretariat/classes/${this.classeModalEditId}`;
            method = 'PUT';
        }

        this.http.request(method, url, { body: this.classeForm, headers: this.authHeaders() })
            .pipe(timeout(15000))
            .pipe(finalize(() => {
                this.classeFormSubmitting = false;
                this.setLoading(false);
            }))
            .subscribe({
                next: () => {
                    this.classeModalOpen = false;
                    this.loadClasses();
                    this.loadStats();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.classeFormError = err?.error?.message || 'Erreur lors de l\'enregistrement.';
                    this.cdr.detectChanges();
                }
            });
    }

    // ===================== INSCRIPTIONS =====================

    loadInscriptions(): void {
        this.inscriptionsLoading = true;
        this.inscriptionsError = '';
        this.cdr.detectChanges();
        this.http.get(`${this.API_BASE}/api/secretariat/inscriptions`, { headers: this.authHeaders() })
            .pipe(timeout(10000))
            .pipe(finalize(() => {
                this.inscriptionsLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res: any) => {
                    this.inscriptionsResults = res.results || [];
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.inscriptionsError = err?.error?.message || 'Erreur lors du chargement.';
                    this.cdr.detectChanges();
                }
            });
    }

    // ===================== RECHERCHE D'ÉLÈVES POUR INSCRIPTION =====================

    private setupInscriptionSearch(): void {
        this.inscriptionSearchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query.trim()) {
                    this.inscriptionSearchResults = [];
                    this.inscriptionSearchLoading = false;
                    this.cdr.detectChanges();
                    return of(null);
                }
                this.inscriptionSearchLoading = true;
                this.cdr.detectChanges();
                return this.searchElevesNonInscrits(query);
            }),
            takeUntil(this.destroy$)
        ).subscribe((res: any) => {
            if (res) {
                this.inscriptionSearchResults = res.results || [];
            }
            this.inscriptionSearchLoading = false;
            this.cdr.detectChanges();
        });
    }

    searchElevesNonInscrits(query: string): any {
        const params = new URLSearchParams();
        params.set('q', query);
        return this.http.get(
            `${this.API_BASE}/api/secretariat/eleves-non-inscrits?${params.toString()}`,
            { headers: this.authHeaders() }
        ).pipe(
            timeout(10000),
            catchError(err => {
                console.error('Erreur recherche élèves:', err);
                this.inscriptionSearchLoading = false;
                this.cdr.detectChanges();
                return of(null);
            })
        );
    }

    onInscriptionSearch(): void {
        this.inscriptionSearchSubject.next(this.inscriptionSearchQuery);
    }

    selectEleveForInscription(eleve: any): void {
        if (eleve.isAlreadyInscribed) return;
        this.inscriptionSelectedEleve = eleve;
        this.inscriptionForm.eleve_id = eleve.id;
        this.inscriptionSearchResults = [];
        this.inscriptionSearchQuery = `${eleve.nom} ${eleve.prenom} (${eleve.matricule})`;
        this.inscriptionFormError = '';
        this.cdr.detectChanges();
    }

    clearSelectedEleve(): void {
        this.inscriptionSelectedEleve = null;
        this.inscriptionForm.eleve_id = null;
        this.inscriptionSearchQuery = '';
        this.inscriptionSearchResults = [];
        this.cdr.detectChanges();
    }

    openInscriptionModal(): void {
        this.inscriptionForm = { eleve_id: null, classe_id: null };
        this.inscriptionFormError = '';
        this.inscriptionSearchQuery = '';
        this.inscriptionSearchResults = [];
        this.inscriptionSelectedEleve = null;
        this.inscriptionModalOpen = true;
        this.cdr.detectChanges();
    }

    submitInscriptionForm(): void {
        this.inscriptionFormError = '';
        if (!this.inscriptionForm.eleve_id || !this.inscriptionForm.classe_id) {
            this.inscriptionFormError = 'Veuillez sélectionner un élève et une classe.';
            this.cdr.detectChanges();
            return;
        }

        // Vérifier si l'élève est déjà inscrit
        if (this.inscriptionSelectedEleve?.isAlreadyInscribed) {
            this.inscriptionFormError = 'Cet élève est déjà inscrit pour cette année.';
            this.cdr.detectChanges();
            return;
        }

        this.inscriptionFormSubmitting = true;
        this.setLoading(true);

        this.http.post(`${this.API_BASE}/api/secretariat/inscriptions`, this.inscriptionForm, { headers: this.authHeaders() })
            .pipe(timeout(15000))
            .pipe(finalize(() => {
                this.inscriptionFormSubmitting = false;
                this.setLoading(false);
            }))
            .subscribe({
                next: (res: any) => {
                    this.inscriptionModalOpen = false;

                    const eleve = this.inscriptionSelectedEleve;
                    const classe = this.classesForSelect.find(c => c.id === this.inscriptionForm.classe_id);
                    this.confirmationData = {
                        nom: eleve?.nom || '',
                        prenom: eleve?.prenom || '',
                        matricule: eleve?.matricule || 'N/A',
                        classe: classe?.displayName || 'Classe sélectionnée'
                    };
                    this.confirmationModalOpen = true;

                    this.loadInscriptions();
                    this.loadStats();
                    this.loadEleves();
                    this.clearSelectedEleve();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.inscriptionFormError = err?.error?.message || 'Erreur lors de l\'inscription.';
                    if (err?.error?.alreadyInscribed) {
                        this.inscriptionFormError = 'Cet élève est déjà inscrit pour cette année.';
                    }
                    this.cdr.detectChanges();
                }
            });
    }

    // ===================== EXPORTS & ATTESTATIONS =====================

    generateAttestation(eleveId: number): void {
        this.setLoading(true);
        this.http.get(`${this.API_BASE}/api/secretariat/eleves/${eleveId}/attestation`, {
            headers: this.authHeaders(),
            responseType: 'blob'
        })
            .pipe(timeout(30000), finalize(() => { this.setLoading(false); }))
            .subscribe({
                next: (blob) => {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `attestation_${eleveId}.pdf`;
                    link.click();
                    URL.revokeObjectURL(link.href);
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Erreur génération attestation', err);
                    alert('Erreur lors de la génération de l\'attestation.');
                    this.cdr.detectChanges();
                }
            });
    }

    // ===================== SUPPRESSION =====================

    openDeleteModal(id: number, type: 'eleve' | 'classe' | 'inscription'): void {
        this.deleteId = id;
        this.deleteType = type;
        this.deleteModalOpen = true;
        this.cdr.detectChanges();
    }

    confirmDelete(): void {
        if (!this.deleteId) return;
        this.deleteSubmitting = true;
        this.setLoading(true);

        let url = '';
        switch (this.deleteType) {
            case 'eleve': url = `${this.API_BASE}/api/secretariat/eleves/${this.deleteId}`; break;
            case 'classe': url = `${this.API_BASE}/api/secretariat/classes/${this.deleteId}`; break;
            case 'inscription': url = `${this.API_BASE}/api/secretariat/inscriptions/${this.deleteId}`; break;
        }

        this.http.delete(url, { headers: this.authHeaders() })
            .pipe(timeout(15000))
            .pipe(finalize(() => {
                this.deleteSubmitting = false;
                this.setLoading(false);
            }))
            .subscribe({
                next: () => {
                    this.deleteModalOpen = false;
                    this.loadAllData();
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    alert(err?.error?.message || 'Erreur lors de la suppression.');
                    this.cdr.detectChanges();
                }
            });
    }

    // ===================== UTILITAIRES =====================

    loadTitulaires(): void {
        this.http.get(`${this.API_BASE}/api/secretariat/titulaires`, { headers: this.authHeaders() })
            .pipe(timeout(10000))
            .subscribe({
                next: (res: any) => {
                    this.titulairesList = res.results || [];
                    this.cdr.detectChanges();
                },
                error: () => {
                    this.titulairesList = [];
                    this.cdr.detectChanges();
                }
            });
    }

    viewClasseEleves(classeId: number): void {
        this.setActiveTab('eleves');
        this.elevesFiltreClasse = classeId;
        this.elevesPage = 1;
        this.loadEleves();
        this.cdr.detectChanges();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    formatDate(dateStr: string | null): string {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateStr;
    }
}