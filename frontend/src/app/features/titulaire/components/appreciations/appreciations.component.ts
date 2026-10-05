import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';

@Component({
  selector: 'app-appreciations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 animate-fade-in">
      <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <i class="ph ph-chat-centered-text text-brand-600"></i> Suivi & Appréciations
          </h2>
          <p class="text-zinc-500 text-sm mt-1">Évaluation du comportement et observations pédagogiques</p>
        </div>
        <button class="saas-btn-secondary" (click)="chargerClasses()" [disabled]="isLoading">
          <i class="ph ph-arrows-clockwise mr-1.5" [class.animate-spin]="isLoading"></i>
          Actualiser
        </button>
      </header>

      <!-- Sélection -->
      <div class="saas-card p-5 bg-gradient-to-br from-white to-zinc-50/50">
        <div class="flex flex-col md:flex-row gap-5 items-end">
          <div class="w-full md:flex-1">
            <label class="saas-label">Sélectionner une classe</label>
            <div class="relative">
              <i class="ph ph-books absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
              <select class="saas-input pl-10" [(ngModel)]="classeSelectionnee" (change)="onClasseChange()">
                <option [ngValue]="null">--- Choisir la classe ---</option>
                <option *ngFor="let c of classes" [ngValue]="c.id">{{ getClasseDisplay(c) }}</option>
              </select>
            </div>
          </div>
          <div class="w-full md:flex-1">
            <label class="saas-label">Élève concerné</label>
            <div class="relative">
              <i class="ph ph-user absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
              <select class="saas-input pl-10" [(ngModel)]="eleveSelectionne" (change)="chargerAppreciations()" [disabled]="!classeSelectionnee">
                <option [ngValue]="null">--- Choisir l'élève ---</option>
                <option *ngFor="let e of eleves" [ngValue]="e.id">{{ e.nom }} {{ e.prenom }} ({{ e.matricule }})</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Feed d'appréciations -->
      <div *ngIf="eleveSelectionne" class="space-y-4">
        <div class="flex items-center justify-between px-2">
          <h3 class="font-bold text-zinc-900 flex items-center gap-2">
            <i class="ph ph-clock-counter-clockwise text-brand-500"></i> Historique des observations
          </h3>
          <button class="saas-btn-primary text-sm" (click)="openAjoutModal()" [disabled]="isLoading">
            <i class="ph ph-plus-circle mr-1.5"></i> Nouvelle appréciation
          </button>
        </div>

        <div *ngIf="appreciationsLoading" class="saas-card p-12 flex flex-col items-center justify-center">
            <i class="ph ph-spinner-gap text-3xl text-zinc-400 animate-spin mb-3"></i>
            <p class="text-zinc-500 font-medium">Chargement des données...</p>
        </div>

        <!-- Chronologie (Timeline Feed) -->
        <div class="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-zinc-200" *ngIf="!appreciationsLoading && appreciations.length > 0">
          <div *ngFor="let app of appreciations" class="relative flex items-start gap-6 group">
            <!-- Icon Point -->
            <div class="mt-1 w-10 h-10 rounded-full bg-white border-2 border-brand-500 flex items-center justify-center shrink-0 z-10 shadow-sm transition-transform group-hover:scale-110">
                <i class="ph ph-note text-brand-600"></i>
            </div>
            
            <!-- Message Card -->
            <div class="saas-card flex-1 p-5 hover:border-brand-200 transition-all">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded">{{ app.date_jour | date:'dd MMMM yyyy' }}</span>
                        <span class="saas-badge-info text-[10px]">{{ app.statut }}</span>
                    </div>
                    <button class="p-1.5 text-zinc-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors" (click)="editAppreciation(app)" [disabled]="isLoading">
                        <i class="ph ph-pencil-simple text-lg"></i>
                    </button>
                </div>
                <p class="text-zinc-700 leading-relaxed font-medium">"{{ app.observation_discipline }}"</p>
                <div class="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    <i class="ph ph-signature"></i> Signature Titulaire
                </div>
            </div>
          </div>
        </div>

        <div *ngIf="!appreciationsLoading && appreciations.length === 0" class="saas-card p-12 text-center border-dashed border-zinc-300 shadow-none">
          <div class="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
            <i class="ph ph-chat-slash text-3xl"></i>
          </div>
          <h3 class="text-lg font-semibold text-zinc-900 mb-1">Aucune observation</h3>
          <p class="text-zinc-500 text-sm">Le dossier de cet élève est vierge pour le moment.</p>
        </div>
      </div>
    </div>

    <!-- MODALE: Ajouter/Modifier appréciation -->
    <div *ngIf="modalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in"
         (click)="fermerModal($event)" aria-modal="true" role="dialog">
      <div class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
      <div class="saas-card w-full max-w-md p-0 relative z-10 animate-slide-up shadow-modal flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
        <div class="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div>
            <h3 class="text-lg font-bold text-zinc-900">{{ editMode ? 'Modifier' : 'Nouvelle' }} observation</h3>
            <p class="text-zinc-500 text-xs mt-0.5">Élève sélectionné</p>
          </div>
          <button class="text-zinc-400 hover:text-zinc-700 transition-colors" (click)="modalOpen = false"><i class="ph ph-x text-xl"></i></button>
        </div>

        <div class="p-6 space-y-5 overflow-y-auto">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="saas-label">Date du jour</label>
              <input class="saas-input" type="date" [(ngModel)]="appForm.date_jour" />
            </div>
            <div>
              <label class="saas-label">Statut disciplinaire</label>
              <select class="saas-input" [(ngModel)]="appForm.statut">
                <option value="PRESENT">Régulier</option>
                <option value="ABSENT">Signalement Absence</option>
                <option value="JUSTIFIE">Absence Justifiée</option>
              </select>
            </div>
          </div>
          
          <div>
            <label class="saas-label">Texte de l'appréciation</label>
            <textarea class="saas-input min-h-[120px]" rows="4" [(ngModel)]="appForm.observation_discipline"
                      placeholder="Décrivez ici le comportement ou les résultats de l'élève..."></textarea>
          </div>

          <div *ngIf="appFormError" class="bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 text-xs font-medium flex items-start gap-2">
            <i class="ph ph-x-circle text-lg shrink-0"></i>
            <span>{{ appFormError }}</span>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3 shrink-0">
          <button class="saas-btn-secondary" (click)="modalOpen = false" [disabled]="isLoading">Annuler</button>
          <button class="saas-btn-primary" (click)="submitAppreciation()" [disabled]="isLoading || appFormSubmitting">
            <i class="ph ph-check-circle mr-1.5" *ngIf="!appFormSubmitting"></i>
            <i class="ph ph-spinner-gap animate-spin mr-1.5" *ngIf="appFormSubmitting"></i>
            {{ editMode ? 'Enregistrer' : 'Publier' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class AppreciationsComponent implements OnInit {
  private API_BASE = 'http://207.180.205.248:3007';

  isLoading = false;
  appreciationsLoading = false;
  appFormSubmitting = false;
  appFormError = '';

  classes: any[] = [];
  eleves: any[] = [];
  appreciations: any[] = [];

  classeSelectionnee: number | null = null;
  eleveSelectionne: number | null = null;

  modalOpen = false;
  editMode = false;
  editId: number | null = null;

  appForm = {
    date_jour: '',
    observation_discipline: '',
    statut: 'PRESENT'
  };

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
    } else {
      this.eleves = [];
      this.eleveSelectionne = null;
    }
  }

  chargerEleves() {
    if (!this.classeSelectionnee) return;

    this.isLoading = true;
    this.http.get(`${this.API_BASE}/api/titulaire/classes/${this.classeSelectionnee}/eleves`, { headers: this.authHeaders() })
      .pipe(timeout(10000), finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (res: any) => {
          this.eleves = res.results || [];
        },
        error: (err) => {
          console.error('Erreur chargement élèves:', err);
        }
      });
  }

  chargerAppreciations() {
    if (!this.eleveSelectionne) return;

    this.appreciationsLoading = true;
    this.http.get(`${this.API_BASE}/api/titulaire/eleves/${this.eleveSelectionne}/appreciations`, { headers: this.authHeaders() })
      .pipe(timeout(10000), finalize(() => { this.appreciationsLoading = false; }))
      .subscribe({
        next: (res: any) => {
          this.appreciations = res.results || [];
        },
        error: (err) => {
          console.error('Erreur chargement appréciations:', err);
        }
      });
  }

  openAjoutModal() {
    this.editMode = false;
    this.editId = null;
    this.appForm = {
      date_jour: new Date().toISOString().split('T')[0],
      observation_discipline: '',
      statut: 'PRESENT'
    };
    this.appFormError = '';
    this.modalOpen = true;
  }

  editAppreciation(app: any) {
    this.editMode = true;
    this.editId = app.id;
    this.appForm = {
      date_jour: app.date_jour ? new Date(app.date_jour).toISOString().split('T')[0] : '',
      observation_discipline: app.observation_discipline || '',
      statut: app.statut || 'PRESENT'
    };
    this.appFormError = '';
    this.modalOpen = true;
  }

  submitAppreciation() {
    if (!this.appForm.observation_discipline.trim()) {
      this.appFormError = 'L\'appréciation est obligatoire.';
      return;
    }

    this.appFormSubmitting = true;
    this.isLoading = true;

    const payload = {
      date_jour: this.appForm.date_jour || new Date().toISOString().split('T')[0],
      observation_discipline: this.appForm.observation_discipline,
      statut: this.appForm.statut || 'PRESENT'
    };

    let url = `${this.API_BASE}/api/titulaire/eleves/${this.eleveSelectionne}/appreciations`;
    let method = 'POST';

    if (this.editMode && this.editId) {
      url = `${this.API_BASE}/api/titulaire/appreciations/${this.editId}`;
      method = 'PUT';
    }

    this.http.request(method, url, {
      body: payload,
      headers: this.authHeaders()
    })
      .pipe(timeout(15000), finalize(() => {
        this.appFormSubmitting = false;
        this.isLoading = false;
      }))
      .subscribe({
        next: () => {
          this.modalOpen = false;
          this.chargerAppreciations();
          this.appFormError = '';
        },
        error: (err) => {
          this.appFormError = err?.error?.message || 'Erreur lors de l\'enregistrement.';
        }
      });
  }

  fermerModal(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('fixed') || target.classList.contains('absolute')) {
      this.modalOpen = false;
    }
  }
}