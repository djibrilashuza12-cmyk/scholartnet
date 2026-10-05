import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 animate-fade-in">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <i class="ph ph-exam text-brand-600"></i> Gestion des Notes
          </h2>
          <p class="text-zinc-500 text-sm mt-1">Saisir et gérer les notes par élève, cours et période</p>
        </div>
        <button class="saas-btn-secondary" (click)="chargerClasses()" [disabled]="isLoading">
          <i class="ph ph-arrows-clockwise mr-1.5" [class.animate-spin]="isLoading || elevesLoading || coursLoading"></i>
          Actualiser
        </button>
      </div>

      <!-- Sélection de la classe -->
      <div class="saas-card p-5 bg-gradient-to-br from-white to-zinc-50/50">
        <div class="flex flex-col md:flex-row gap-5 items-end">
          <div class="w-full md:flex-1">
            <label class="saas-label">Sélectionner une classe</label>
            <div class="relative">
              <i class="ph ph-books absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
              <select class="saas-input pl-10" [(ngModel)]="classeSelectionnee" (change)="onClasseChange()">
                <option [ngValue]="null">--- Choisir ---</option>
                <option *ngFor="let c of classes" [ngValue]="c.id">{{ getClasseDisplay(c) }}</option>
              </select>
            </div>
          </div>
          <div class="w-full md:w-64">
            <label class="saas-label">Filtrer par période</label>
            <div class="relative">
              <i class="ph ph-calendar-blank absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
              <select class="saas-input pl-10" [(ngModel)]="periodeSelectionnee" (change)="chargerNotes()" [disabled]="!classeSelectionnee">
                <option [ngValue]="null">Toutes les périodes</option>
                <option *ngFor="let p of periodes" [ngValue]="p.nom">{{ p.nom }}</option>
              </select>
            </div>
          </div>
          <div class="w-full md:w-auto">
            <button class="saas-btn-primary w-full" (click)="openGestionCours()" [disabled]="isLoading || !classeSelectionnee">
              <i class="ph ph-gear-six mr-1.5"></i> Configurer les cours
            </button>
          </div>
        </div>
      </div>

      <!-- Liste des élèves -->
      <div *ngIf="classeSelectionnee" class="space-y-6">
        <div *ngIf="elevesLoading" class="saas-card p-12 flex flex-col items-center justify-center">
            <i class="ph ph-spinner-gap text-3xl text-zinc-400 animate-spin mb-3"></i>
            <p class="text-zinc-500 font-medium">Chargement des élèves...</p>
        </div>

        <div *ngIf="!elevesLoading && eleves.length === 0" class="saas-card p-12 text-center border-dashed border-zinc-300 shadow-none">
            <div class="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="ph ph-users text-3xl text-zinc-400"></i>
            </div>
            <h3 class="text-lg font-semibold text-zinc-900 mb-1">Aucun élève trouvé</h3>
            <p class="text-zinc-500 text-sm">Il n'y a pas d'élèves inscrits dans cette classe pour le moment.</p>
        </div>

        <div *ngFor="let eleve of eleves" class="saas-card overflow-hidden group">
          <div class="px-6 py-4 bg-zinc-50/80 border-b border-zinc-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-white border border-zinc-200 shadow-sm rounded-lg flex items-center justify-center text-zinc-700 font-bold">
                {{ eleve.nom.charAt(0) }}{{ eleve.prenom.charAt(0) }}
              </div>
              <div>
                <h3 class="font-bold text-zinc-900">{{ eleve.nom }} {{ eleve.prenom }}</h3>
                <span class="text-xs font-mono text-zinc-500 bg-white px-2 py-0.5 rounded border border-zinc-200">{{ eleve.matricule }}</span>
              </div>
            </div>
            <button class="saas-btn-primary text-sm" (click)="ouvrirModalNotesBulk(eleve)" [disabled]="isLoading">
              <i class="ph ph-plus-circle mr-1.5"></i> Saisir les notes
            </button>
          </div>

          <div class="p-0 overflow-x-auto">
            <table class="saas-table w-full text-sm">
              <thead>
                <tr>
                  <th class="w-1/4">Matière</th>
                  <th class="w-32">Note obtenue</th>
                  <th class="w-24 text-center">Max</th>
                  <th class="w-24 text-center">Pourcentage</th>
                  <th class="w-32">Période</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let note of getNotes(eleve.id)" class="hover:bg-zinc-50/50">
                  <td class="font-medium text-zinc-900">{{ note.cours_nom }}</td>
                  <td>
                    <ng-container *ngIf="note.note_obtenue !== null; else noteVide">
                      <span class="font-bold"
                            [class.text-red-600]="note.note_obtenue < note.max_points / 2"
                            [class.text-emerald-600]="note.note_obtenue >= note.max_points / 2">
                        {{ note.note_obtenue }} / {{ note.max_points }}
                      </span>
                    </ng-container>
                    <ng-template #noteVide>
                      <span class="text-zinc-400 italic text-sm px-3">—</span>
                    </ng-template>
                  </td>
                  <td class="text-center text-zinc-500">{{ note.max_points }}</td>
                  <td class="text-center">
                    <ng-container *ngIf="note.pourcentage !== null; else pourcVide">
                      <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold w-16"
                            [class.bg-emerald-50]="note.pourcentage >= 50" [class.text-emerald-700]="note.pourcentage >= 50"
                            [class.bg-red-50]="note.pourcentage < 50" [class.text-red-700]="note.pourcentage < 50">
                        {{ note.pourcentage }}%
                      </span>
                    </ng-container>
                    <ng-template #pourcVide>
                      <span class="text-zinc-400 italic text-sm">—</span>
                    </ng-template>
                  </td>
                  <td><span class="saas-badge-neutral">{{ note.periode }}</span></td>
                </tr>
                <tr *ngIf="getNotes(eleve.id).length === 0">
                  <td colspan="5" class="text-center text-zinc-500 py-6">
                    <div class="flex flex-col items-center gap-2">
                        <i class="ph ph-books text-2xl text-zinc-300"></i>
                        <span>Aucun cours configuré pour cette classe.</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 🎯 MODALE BULK: Saisir TOUTES les notes pour une période -->
    <div *ngIf="modalBulkOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in"
         (click)="fermerModalBulk($event)" aria-modal="true" role="dialog">
      <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
      <div class="saas-card w-full max-w-3xl p-0 relative z-10 animate-slide-up shadow-modal flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="px-6 py-4 border-b border-zinc-100 bg-amber-50/50 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <i class="ph ph-exam text-xl"></i>
            </div>
            <div>
              <h3 class="text-base font-bold text-zinc-900">Saisir les notes</h3>
              <p class="text-xs text-zinc-500">
                <span class="font-bold text-zinc-700">{{ eleveBulk?.nom }} {{ eleveBulk?.prenom }}</span>
                • Mat: <span class="font-mono">{{ eleveBulk?.matricule }}</span>
              </p>
            </div>
          </div>
          <button class="text-zinc-400 hover:text-zinc-700" (click)="fermerModalBulkForce()">
            <i class="ph ph-x text-xl"></i>
          </button>
        </div>

        <!-- ÉTAPE 1: Choix période (si pas encore choisie) -->
        <div *ngIf="!bulkPeriodeChoisie" class="p-6 space-y-5">
          <div class="text-sm text-zinc-600 mb-2">
            <i class="ph ph-info text-brand-600 mr-1"></i>
            Sélectionnez la période pour laquelle vous voulez saisir les notes.
          </div>

          <div>
            <label class="saas-label">Période d'évaluation *</label>
            <select class="saas-input" [(ngModel)]="bulkPeriode" (change)="onBulkPeriodeChange()">
              <option [ngValue]="null">--- Sélectionner une période ---</option>
              <option *ngFor="let p of periodes" [ngValue]="p.nom">{{ p.nom }}</option>
            </select>
          </div>

          <div class="bg-brand-50 border border-brand-100 rounded-lg p-3 text-xs text-brand-700">
            <i class="ph ph-info mr-1"></i>
            <b>Étape suivante :</b> Un tableau complet s'affichera avec tous les cours de la classe.
            Vous pourrez saisir les notes en une fois et les enregistrer toutes ensemble.
          </div>
        </div>

        <!-- ÉTAPE 2: Tableau complet de saisie -->
        <div *ngIf="bulkPeriodeChoisie" class="flex-1 overflow-y-auto">
          <!-- En-tête avec période sélectionnée + bouton changer -->
          <div class="px-6 py-3 bg-brand-50/50 border-b border-brand-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="ph ph-calendar-blank text-brand-600"></i>
              <span class="text-sm font-bold text-zinc-900">Période : {{ bulkPeriode }}</span>
            </div>
            <button class="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                    (click)="changerPeriode()">
              <i class="ph ph-arrows-clockwise"></i> Changer
            </button>
          </div>

          <!-- Tableau de saisie -->
          <div class="p-6">
            <table class="w-full">
              <thead>
                <tr class="border-b border-zinc-200">
                  <th class="text-left py-3 px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Matière</th>
                  <th class="text-center py-3 px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider w-40">Note obtenue</th>
                  <th class="text-center py-3 px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider w-24">Max</th>
                  <th class="text-center py-3 px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider w-32">Pourcentage</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of bulkNotes; let i = index"
                    class="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                  <td class="py-3 px-3">
                    <div class="font-medium text-zinc-900">{{ item.cours_nom }}</div>
                    <div *ngIf="item.existing_note_id" class="text-[10px] text-emerald-600 font-bold uppercase mt-0.5">
                      <i class="ph ph-check-circle"></i> Note existante
                    </div>
                  </td>
                  <td class="py-3 px-3">
                    <div class="relative">
                      <input class="saas-input py-1.5 text-sm font-bold pr-3 text-center"
                             [class.text-red-600]="item.note_obtenue !== null && item.note_obtenue < item.max_points / 2 && !item.is_invalid"
                             [class.text-emerald-600]="item.note_obtenue !== null && item.note_obtenue >= item.max_points / 2 && !item.is_invalid"
                             [class.border-red-500]="item.is_invalid"
                             [class.bg-red-50]="item.is_invalid"
                             [class.border-2]="item.is_invalid"
                             type="number" step="0.1"
                             [(ngModel)]="item.note_obtenue"
                             (ngModelChange)="onNoteChange(i)"
                             [max]="item.max_points"
                             min="0"
                             placeholder="—" />
                    </div>
                    <div *ngIf="item.is_invalid" class="text-[10px] text-red-600 font-bold mt-1 text-center">
                      <i class="ph ph-warning"></i> Max : {{ item.max_points }}
                    </div>
                  </td>
                  <td class="py-3 px-3 text-center">
                    <span class="text-sm font-bold text-zinc-500">/{{ item.max_points }}</span>
                  </td>
                  <td class="py-3 px-3 text-center">
                    <span *ngIf="item.note_obtenue !== null && item.note_obtenue !== undefined"
                          class="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold"
                          [class.bg-emerald-50]="getPourcentage(item) >= 50" [class.text-emerald-700]="getPourcentage(item) >= 50"
                          [class.bg-red-50]="getPourcentage(item) < 50" [class.text-red-700]="getPourcentage(item) < 50">
                      {{ getPourcentage(item) }}%
                    </span>
                    <span *ngIf="item.note_obtenue === null || item.note_obtenue === undefined"
                          class="text-zinc-400 italic text-xs">—</span>
                  </td>
                </tr>
                <tr *ngIf="bulkNotes.length === 0">
                  <td colspan="4" class="text-center py-8 text-zinc-500">
                    <i class="ph ph-books text-2xl mb-2 block text-zinc-300"></i>
                    <p class="text-sm">Aucun cours configuré pour cette période.</p>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Erreur -->
            <div *ngIf="bulkError" class="mt-4 bg-red-50 text-red-700 p-4 rounded-lg border-2 border-red-300 text-xs flex items-start gap-3">
              <i class="ph ph-warning-circle text-xl shrink-0 text-red-600"></i>
              <div class="flex-1">
                  <div class="font-bold text-red-800 mb-2">
                      <i class="ph ph-prohibit"></i> Enregistrement refusé — corrigez ces erreurs :
                  </div>
                  <ul class="space-y-1">
                      <li *ngFor="let line of bulkError.split('\n')"
                          class="text-red-700 leading-relaxed font-medium">
                          {{ line.replace('❌ ', '') }}
                      </li>
                  </ul>
              </div>
            </div>

            <!-- Info -->
            <div *ngIf="bulkNotes.length > 0 && !bulkError" class="mt-4 bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs text-zinc-600">
              <i class="ph ph-info mr-1 text-brand-600"></i>
              Vous pouvez saisir toutes les notes en une fois. Laissez vide les matières non évaluées.
              <b>{{ getNombreNotesSaisies() }}</b> note(s) prête(s) à être enregistrée(s).
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3 shrink-0">
          <button class="saas-btn-secondary" (click)="fermerModalBulkForce()" [disabled]="bulkSubmitting">
            Annuler
          </button>
          <button *ngIf="bulkPeriodeChoisie"
                  class="saas-btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                  (click)="submitBulkNotes()"
                  [disabled]="bulkSubmitting || bulkNotes.length === 0">
            <i class="ph ph-spinner-gap animate-spin mr-1.5" *ngIf="bulkSubmitting"></i>
            <i class="ph ph-check-circle mr-1.5" *ngIf="!bulkSubmitting"></i>
            Enregistrer toutes les notes
          </button>
        </div>
      </div>
    </div>

    <!-- MODALE: Gestion des cours -->
    <div *ngIf="modalCoursOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in"
         (click)="fermerModalCours($event)" aria-modal="true" role="dialog">
      <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
      <div class="saas-card w-full max-w-2xl p-0 relative z-10 animate-slide-up shadow-modal flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
        <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div>
            <h3 class="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <i class="ph ph-gear-six text-brand-600"></i> Configuration des cours
            </h3>
            <p class="text-zinc-500 text-xs mt-0.5">Classe: {{ getClasseDisplay({id: classeSelectionnee, nom: 'Sélectionnée'}) }}</p>
          </div>
          <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="modalCoursOpen = false"><i class="ph ph-x text-xl"></i></button>
        </div>

        <div class="p-6 overflow-y-auto flex-1 bg-zinc-50/30">
          <h4 class="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-3">Cours existants</h4>
          <div class="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-8">
              <div *ngIf="coursLoading" class="text-center py-6 text-zinc-500">
                  <i class="ph ph-spinner-gap animate-spin text-2xl mb-2"></i>
                  <p class="text-sm">Chargement...</p>
              </div>

              <ul class="divide-y divide-zinc-100" *ngIf="!coursLoading && cours.length > 0">
                <li *ngFor="let c of cours" class="px-4 py-3 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                  <span class="font-medium text-zinc-900">{{ c.nom }}</span>
                  <div class="flex gap-1">
                    <button class="p-1.5 text-zinc-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors" (click)="editCours(c)" [disabled]="isLoading" title="Éditer">
                        <i class="ph ph-pencil-simple text-lg"></i>
                    </button>
                    <button class="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" (click)="supprimerCours(c.id)" [disabled]="isLoading" title="Supprimer">
                        <i class="ph ph-trash text-lg"></i>
                    </button>
                  </div>
                </li>
              </ul>

              <div *ngIf="!coursLoading && cours.length === 0" class="text-center text-zinc-500 py-8">
                <i class="ph ph-books text-3xl text-zinc-300 mb-2"></i>
                <p class="text-sm">Aucun cours configuré.</p>
              </div>
          </div>

          <div class="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
            <h4 class="text-base font-bold text-zinc-900 flex items-center gap-2 mb-4">
                <i class="ph ph-plus-circle text-brand-600" *ngIf="!coursEditMode"></i>
                <i class="ph ph-pencil-simple text-amber-600" *ngIf="coursEditMode"></i>
                {{ coursEditMode ? 'Modifier le cours' : 'Ajouter un nouveau cours' }}
            </h4>

            <div class="space-y-4">
                <div>
                <label class="saas-label">Nom de la matière</label>
                <input class="saas-input w-full font-medium" type="text" [(ngModel)]="coursForm.nom" placeholder="Ex: Mathématiques, Physique..." />
                </div>

                <div>
                <label class="saas-label mb-2">Notes maximales (sur /x) par période</label>
                <div class="bg-zinc-50 border border-zinc-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div *ngFor="let periode of periodes" class="flex flex-col gap-1.5">
                        <span class="text-xs font-semibold text-zinc-600">{{ periode.nom }}</span>
                        <div class="relative">
                            <input class="saas-input w-full pr-8" type="number" step="0.5"
                                [ngModel]="coursPeriodesConfig[periode.id].max_points"
                                (ngModelChange)="onMaxPointsChange(periode.id, $event)"
                                placeholder="10, 20..." min="1" />
                            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">pts</span>
                        </div>
                    </div>
                </div>
                </div>

                <div *ngIf="coursFormError" class="text-red-500 text-sm mt-2 font-medium flex items-center gap-1.5">
                    <i class="ph ph-warning-circle"></i> {{ coursFormError }}
                </div>

                <div class="flex gap-3 justify-end pt-2">
                <button *ngIf="coursEditMode" class="saas-btn-secondary" (click)="annulerEditCours()">Annuler</button>
                <button class="saas-btn-primary" (click)="submitCours()" [disabled]="isLoading || coursFormSubmitting">
                    <i class="ph ph-check-circle mr-1.5" *ngIf="!coursFormSubmitting"></i>
                    <i class="ph ph-spinner-gap animate-spin mr-1.5" *ngIf="coursFormSubmitting"></i>
                    {{ coursEditMode ? 'Mettre à jour' : 'Ajouter le cours' }}
                </button>
                </div>
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
export class NotesComponent implements OnInit {
  private API_BASE = 'http://207.180.205.248:3007';

  isLoading = false;
  elevesLoading = false;
  coursLoading = false;
  noteFormSubmitting = false;
  noteFormError = '';
  coursFormSubmitting = false;
  coursFormError = '';

  classes: any[] = [];
  eleves: any[] = [];
  cours: any[] = [];
  periodes: any[] = [];

  classeSelectionnee: number | null = null;
  periodeSelectionnee: string | null = null;

  notesParEleve: { [key: number]: any[] } = {};

  // Cache pour les max par cours et période
  coursMaxCache: { [coursId: number]: { [periodeNom: string]: number } } = {};

  modalCoursOpen = false;
  coursEditMode = false;
  coursEditId: number | null = null;
  coursForm = {
    nom: ''
  };
  coursPeriodesConfig: { [periodeId: number]: { max_points: number } } = {};

  // 🎯 NOUVEAU: Modal BULK
  modalBulkOpen = false;
  eleveBulk: any = null;
  bulkPeriodeChoisie = false;
  bulkPeriode: string | null = null;
  bulkNotes: any[] = [];
  bulkSubmitting = false;
  bulkError = '';

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.chargerClasses();
  }

  private authHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('token') || '';
    return new HttpHeaders().set('Authorization', 'Bearer ' + token);
  }

  chargerClasses() {
    this.isLoading = true;
    this.http.get(`${this.API_BASE}/api/titulaire/classes`, { headers: this.authHeaders() })
      .pipe(timeout(10000), finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (res: any) => {
          this.classes = res.results || [];
        },
        error: (err) => {
          console.error('Erreur chargement classes:', err);
        }
      });
  }

  getClasseDisplay(classe: any): string {
    let display = classe.nom || '';
    if (classe.section) display += ` ${classe.section}`;
    if (classe.option_classe) display += `/${classe.option_classe}`;
    return display;
  }

  onClasseChange() {
    if (this.classeSelectionnee) {
      this.chargerEleves();
      this.chargerCours();
      this.chargerPeriodes();
    } else {
      this.eleves = [];
      this.cours = [];
      this.periodes = [];
      this.notesParEleve = {};
      this.coursMaxCache = {};
    }
  }

  chargerEleves() {
    if (!this.classeSelectionnee) return;
    this.elevesLoading = true;

    this.http.get(`${this.API_BASE}/api/titulaire/classes/${this.classeSelectionnee}/eleves`, { headers: this.authHeaders() })
      .pipe(timeout(10000), finalize(() => { this.elevesLoading = false; }))
      .subscribe({
        next: (res: any) => {
          this.eleves = res.results || [];
          this.chargerNotes();
        },
        error: (err) => {
          console.error('Erreur chargement élèves:', err);
        }
      });
  }

  chargerCours() {
    if (!this.classeSelectionnee) return;

    this.coursLoading = true;
    this.http.get(`${this.API_BASE}/api/titulaire/classes/${this.classeSelectionnee}/cours`, { headers: this.authHeaders() })
      .pipe(timeout(10000), finalize(() => { this.coursLoading = false; }))
      .subscribe({
        next: (res: any) => {
          this.cours = res.results || [];
          this.buildCoursMaxCache();
        },
        error: (err) => {
          console.error('Erreur chargement cours:', err);
        }
      });
  }

  buildCoursMaxCache() {
    this.coursMaxCache = {};

    for (const cours of this.cours) {
      this.coursMaxCache[cours.id] = {};

      if (cours.periodes_config && Array.isArray(cours.periodes_config)) {
        for (const config of cours.periodes_config) {
          const periode = this.periodes.find(p => p.id === config.periode_id);
          if (periode) {
            const maxPoints = parseFloat(config.max_points) || 10;
            this.coursMaxCache[cours.id][periode.nom] = maxPoints;
          }
        }
      }
    }
  }

  chargerPeriodes() {
    this.http.get(`${this.API_BASE}/api/titulaire/classes/${this.classeSelectionnee}/periodes`, { headers: this.authHeaders() })
      .pipe(timeout(10000))
      .subscribe({
        next: (res: any) => {
          this.periodes = res.results || [];
          this.buildCoursMaxCache();
        },
        error: (err) => {
          console.error('Erreur chargement périodes:', err);
        }
      });
  }

  chargerNotes() {
    if (!this.classeSelectionnee) return;

    this.notesParEleve = {};

    for (const eleve of this.eleves) {
      let url = `${this.API_BASE}/api/titulaire/eleves/${eleve.id}/notes`;
      if (this.periodeSelectionnee) {
        url += `?periode=${encodeURIComponent(this.periodeSelectionnee)}`;
      }

      this.http.get(url, { headers: this.authHeaders() })
        .pipe(timeout(10000))
        .subscribe({
          next: (res: any) => {
            this.notesParEleve[eleve.id] = res.results || [];
          },
          error: (err) => {
            console.error('Erreur chargement notes:', err);
            this.notesParEleve[eleve.id] = [];
          }
        });
    }
  }

  getNotes(eleveId: number): any[] {
    return this.notesParEleve[eleveId] || [];
  }

  // ============================================
  // 🎯 MODAL BULK: Saisir toutes les notes en une fois
  // ============================================

  ouvrirModalNotesBulk(eleve: any) {
    this.eleveBulk = eleve;
    this.bulkPeriode = null;
    this.bulkPeriodeChoisie = false;
    this.bulkNotes = [];
    this.bulkError = '';
    this.modalBulkOpen = true;
  }

  onBulkPeriodeChange() {
    if (!this.bulkPeriode) return;

    // Construire le tableau des notes pour cette période
    this.bulkNotes = [];

    for (const cours of this.cours) {
      const maxPoints = this.coursMaxCache[cours.id]?.[this.bulkPeriode] || 10;

      // Chercher une note existante pour ce cours et cette période
      const notesEleve = this.getNotes(this.eleveBulk.id);
      const existingNote = notesEleve.find((n: any) =>
        n.cours_id === cours.id && n.periode === this.bulkPeriode
      );

      this.bulkNotes.push({
        cours_id: cours.id,
        cours_nom: cours.nom,
        max_points: maxPoints,
        note_obtenue: existingNote?.note_obtenue ?? null,
        existing_note_id: existingNote?.id ?? null,
        is_invalid: false
      });
    }

    this.bulkPeriodeChoisie = true;
  }

  changerPeriode() {
    this.bulkPeriodeChoisie = false;
    this.bulkPeriode = null;
    this.bulkNotes = [];
  }

  getPourcentage(item: any): number {
    if (item.note_obtenue === null || item.note_obtenue === undefined) return 0;
    if (!item.max_points || item.max_points === 0) return 0;
    return Math.round((item.note_obtenue / item.max_points) * 100);
  }

  onNoteChange(index: number) {
    // ⚠️ On NE corrige PAS automatiquement — on laisse le titulaire corriger lui-même
    // On ajoute juste un flag pour savoir si la note est invalide (pour l'affichage)
    const item = this.bulkNotes[index];

    if (item.note_obtenue === null || item.note_obtenue === undefined || item.note_obtenue === '') {
      item.is_invalid = false;
      return;
    }

    const val = Number(item.note_obtenue);
    item.is_invalid = isNaN(val) || val < 0 || val > item.max_points;
  }

  getNombreNotesSaisies(): number {
    return this.bulkNotes.filter(n => n.note_obtenue !== null && n.note_obtenue !== undefined && n.note_obtenue !== '').length;
  }

  submitBulkNotes() {
    if (!this.bulkPeriode || this.bulkNotes.length === 0) return;

    // ============================================
    // 🔥 VALIDATION : on REFUSE d'envoyer si une note est invalide
    // ============================================
    const erreurs: string[] = [];

    for (const item of this.bulkNotes) {
      // Ignorer les cases vides
      if (item.note_obtenue === null || item.note_obtenue === undefined || item.note_obtenue === '') {
        continue;
      }

      const val = Number(item.note_obtenue);

      if (isNaN(val)) {
        erreurs.push(`❌ "${item.cours_nom}" : la valeur "${item.note_obtenue}" n'est pas un nombre valide.`);
      } else if (val < 0) {
        erreurs.push(`❌ "${item.cours_nom}" : la note ${val} est négative. Minimum autorisé : 0.`);
      } else if (val > item.max_points) {
        erreurs.push(`❌ "${item.cours_nom}" : la note ${val} dépasse le maximum autorisé (${item.max_points}).`);
      }
    }

    // Si erreurs → on REFUSE et on affiche la liste
    if (erreurs.length > 0) {
      this.bulkError = erreurs.join('\n');
      // Marquer les items en erreur pour l'affichage
      for (const item of this.bulkNotes) {
        if (item.note_obtenue === null || item.note_obtenue === undefined || item.note_obtenue === '') {
          item.is_invalid = false;
          continue;
        }
        const val = Number(item.note_obtenue);
        item.is_invalid = isNaN(val) || val < 0 || val > item.max_points;
      }
      return; // ⛔️ ON NE FAIT PAS L'APPEL API
    }

    // ============================================
    // Tout est OK → on envoie
    // ============================================
    const notesASauver = this.bulkNotes.map(n => {
      const estVide = (
        n.note_obtenue === null ||
        n.note_obtenue === undefined ||
        n.note_obtenue === '' ||
        (typeof n.note_obtenue === 'string' && n.note_obtenue.trim() === '')
      );
      return {
        cours_id: n.cours_id,
        note_obtenue: estVide ? null : n.note_obtenue
      };
    });

    const aDesNotesAEnregistrer = notesASauver.some(n => n.note_obtenue !== null);
    const aDesNotesAsupprimer = this.bulkNotes.some(n =>
      n.existing_note_id !== null &&
      (n.note_obtenue === null || n.note_obtenue === undefined || n.note_obtenue === '')
    );

    if (!aDesNotesAEnregistrer && !aDesNotesAsupprimer) {
      this.bulkError = 'Aucune action à effectuer (aucune note à enregistrer ou à supprimer).';
      return;
    }

    this.bulkSubmitting = true;
    this.bulkError = '';

    const payload = {
      periode: this.bulkPeriode,
      notes: notesASauver
    };

    this.http.post(
      `${this.API_BASE}/api/titulaire/eleves/${this.eleveBulk.id}/notes/bulk`,
      payload,
      { headers: this.authHeaders() }
    )
      .pipe(timeout(20000), finalize(() => { this.bulkSubmitting = false; }))
      .subscribe({
        next: (res: any) => {
          this.modalBulkOpen = false;
          this.chargerNotes();
          console.log('Bulk save:', res.message);
        },
        error: (err) => {
          // Si le backend refuse aussi (double sécurité)
          if (err?.error?.errors && Array.isArray(err.error.errors)) {
            this.bulkError = err.error.errors.join('\n');
          } else {
            this.bulkError = err?.error?.message || 'Erreur lors de l\'enregistrement.';
          }
        }
      });
  }

  fermerModalBulk(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('fixed') || target.classList.contains('absolute')) {
      this.modalBulkOpen = false;
    }
  }

  fermerModalBulkForce() {
    this.modalBulkOpen = false;
    this.eleveBulk = null;
    this.bulkPeriodeChoisie = false;
    this.bulkPeriode = null;
    this.bulkNotes = [];
    this.bulkError = '';
  }

  // ============ GESTION DES COURS ============

  onMaxPointsChange(periodeId: number, value: any) {
    if (value === '' || value === null || value === undefined) {
      if (this.coursPeriodesConfig[periodeId]) {
        this.coursPeriodesConfig[periodeId].max_points = undefined as any;
      }
      return;
    }

    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      if (this.coursPeriodesConfig[periodeId]) {
        this.coursPeriodesConfig[periodeId].max_points = numValue;
      }
    }
  }

  openGestionCours() {
    if (!this.classeSelectionnee) {
      alert('Veuillez d\'abord sélectionner une classe.');
      return;
    }

    this.coursForm = { nom: '' };
    this.coursEditMode = false;
    this.coursEditId = null;
    this.coursFormError = '';
    this.coursPeriodesConfig = {};

    for (const periode of this.periodes) {
      this.coursPeriodesConfig[periode.id] = {
        max_points: 10
      };
    }

    this.chargerCours();
    this.modalCoursOpen = true;
  }

  editCours(cours: any) {
    this.coursEditMode = true;
    this.coursEditId = cours.id;
    this.coursForm = {
      nom: cours.nom
    };
    this.coursFormError = '';

    this.coursPeriodesConfig = {};

    if (cours.periodes_config && Array.isArray(cours.periodes_config)) {
      for (const config of cours.periodes_config) {
        const maxPoints = parseFloat(config.max_points) || 10;
        this.coursPeriodesConfig[config.periode_id] = {
          max_points: maxPoints
        };
      }
    }

    for (const periode of this.periodes) {
      if (!this.coursPeriodesConfig[periode.id]) {
        this.coursPeriodesConfig[periode.id] = {
          max_points: 10
        };
      }
    }
  }

  // 🔥 CORRIGÉ : Ne vide plus complètement les configs, remet 10 par défaut
  annulerEditCours() {
    this.coursEditMode = false;
    this.coursEditId = null;
    this.coursForm = { nom: '' };

    // ✅ Remettre 10 par défaut au lieu de vider
    this.coursPeriodesConfig = {};
    for (const periode of this.periodes) {
      this.coursPeriodesConfig[periode.id] = { max_points: 10 };
    }

    this.coursFormError = '';
  }

  // 🔥 CORRIGÉ : Le formulaire reste utilisable après un ajout réussi
  submitCours() {
    // Protection anti-double-clic
    if (this.coursFormSubmitting) return;

    // Réinitialiser les erreurs
    this.coursFormError = '';

    if (!this.coursForm.nom.trim()) {
      this.coursFormError = 'Le nom du cours est obligatoire.';
      return;
    }

    // 🔥 Vérifier que les périodes existent
    if (this.periodes.length === 0) {
      this.coursFormError = 'Aucune période configurée. Contactez l\'administrateur.';
      return;
    }

    // 🔥 Vérifier que TOUTES les périodes ont un max_points valide
    for (const periode of this.periodes) {
      const config = this.coursPeriodesConfig[periode.id];
      if (!config || config.max_points === undefined || config.max_points === null || config.max_points <= 0) {
        this.coursFormError = `Le maximum pour la période "${periode.nom}" doit être supérieur à 0.`;
        return;
      }
    }

    this.coursFormSubmitting = true;
    this.isLoading = true;

    // 🔥 Construire le payload depuis les périodes (garantie qu'il n'est jamais vide)
    const periodesConfig = this.periodes.map(periode => ({
      periode_id: periode.id,
      max_points: this.coursPeriodesConfig[periode.id].max_points
    }));

    const payload = {
      nom: this.coursForm.nom.trim(),
      periodes_config: periodesConfig
    };

    let url = `${this.API_BASE}/api/titulaire/classes/${this.classeSelectionnee}/cours`;
    let method = 'POST';

    if (this.coursEditMode && this.coursEditId) {
      url = `${this.API_BASE}/api/titulaire/cours/${this.coursEditId}`;
      method = 'PUT';
    }

    this.http.request(method, url, {
      body: payload,
      headers: this.authHeaders()
    })
      .pipe(timeout(15000), finalize(() => {
        this.coursFormSubmitting = false;
        this.isLoading = false;
      }))
      .subscribe({
        next: () => {
          this.coursFormError = '';
          this.chargerCours();

          // 🔥 CORRIGÉ : Reset manuel SANS vider les max_points
          this.coursEditMode = false;
          this.coursEditId = null;
          this.coursForm = { nom: '' };

          // ✅ Re-remplir les configs avec 10 par défaut (au lieu de vider)
          this.coursPeriodesConfig = {};
          for (const periode of this.periodes) {
            this.coursPeriodesConfig[periode.id] = { max_points: 10 };
          }
        },
        error: (err) => {
          const backendMessage = err?.error?.message;
          if (backendMessage) {
            this.coursFormError = backendMessage;
          } else if (err?.status === 0) {
            this.coursFormError = 'Impossible de contacter le serveur.';
          } else if (err?.status === 401) {
            this.coursFormError = 'Session expirée. Reconnectez-vous.';
          } else {
            this.coursFormError = 'Erreur lors de l\'enregistrement. Réessayez.';
          }
        }
      });
  }

  supprimerCours(coursId: number) {
    if (!confirm('Voulez-vous vraiment supprimer ce cours ? Les notes associées seront également supprimées.')) return;

    this.isLoading = true;
    this.http.delete(`${this.API_BASE}/api/titulaire/cours/${coursId}`, { headers: this.authHeaders() })
      .pipe(timeout(10000), finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: () => {
          this.chargerCours();
        },
        error: (err) => {
          alert(err?.error?.message || 'Erreur lors de la suppression.');
        }
      });
  }

  fermerModalCours(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('fixed') || target.classList.contains('absolute')) {
      this.modalCoursOpen = false;
    }
  }
}