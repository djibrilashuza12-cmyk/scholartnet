import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';

@Component({
  selector: 'app-bulletins',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 animate-fade-in">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <i class="ph ph-file-text text-brand-600"></i> Bulletins Scolaires
          </h2>
          <p class="text-zinc-500 text-sm mt-1">Visualisation et publication des bulletins par période</p>
        </div>
        <button class="saas-btn-secondary" (click)="chargerClasses()" [disabled]="isLoading">
          <i class="ph ph-arrows-clockwise mr-1.5" [class.animate-spin]="isLoading"></i>
          Actualiser
        </button>
      </div>

      <!-- Sélection Classe et Période -->
      <div class="saas-card p-5 bg-gradient-to-br from-white to-zinc-50/50">
        <div class="flex flex-col md:flex-row gap-5 items-end">
          <div class="w-full md:flex-1">
            <label class="saas-label">Classe</label>
            <div class="relative">
              <i class="ph ph-books absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
              <select class="saas-input pl-10" [(ngModel)]="classeSelectionnee" (change)="onClasseChange()">
                <option [ngValue]="null">--- Choisir la classe ---</option>
                <option *ngFor="let c of classes" [ngValue]="c.id">{{ getClasseDisplay(c) }}</option>
              </select>
            </div>
          </div>
          <div class="w-full md:w-64">
            <label class="saas-label">Période</label>
            <div class="relative">
              <i class="ph ph-calendar-blank absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></i>
              <select class="saas-input pl-10" [(ngModel)]="periodeSelectionnee" (change)="chargerBulletins()" [disabled]="!classeSelectionnee">
                <option [ngValue]="null">--- Sélectionner ---</option>
                <option *ngFor="let p of periodes" [ngValue]="p.id">{{ p.nom }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Liste des bulletins -->
      <div *ngIf="classeSelectionnee && periodeSelectionnee" class="saas-card overflow-hidden">
        <div class="px-6 py-4 border-b border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-50/50">
          <h3 class="font-bold text-zinc-900 flex items-center gap-2">
            <i class="ph ph-users-three text-brand-600 text-lg"></i> 
            Bulletins - {{ periodeNom }}
          </h3>
          <button class="saas-btn-primary text-sm h-10 px-6" (click)="publierTout()" [disabled]="isLoading || bulletinsLoading || bulletins.length === 0">
            <i class="ph ph-paper-plane-tilt mr-2"></i> Publier tout
          </button>
        </div>

        <div class="p-0 overflow-x-auto">
          <table class="saas-table">
            <thead>
              <tr>
                <th class="w-16 text-center">RANG</th>
                <th>ÉLÈVE</th>
                <th class="text-center">TOTAL</th>
                <th class="text-center">%</th>
                <th class="text-center">STATUT</th>
                <th class="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let b of bulletins" class="hover:bg-zinc-50 transition-colors">
                <td class="text-center">
                  <span *ngIf="!b.nonClasse && b.rang" 
                        class="inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-xs"
                        [ngClass]="{
                          'bg-amber-100 text-amber-700': b.rang === 1,
                          'bg-zinc-200 text-zinc-700': b.rang === 2,
                          'bg-orange-100 text-orange-700': b.rang === 3,
                          'bg-zinc-100 text-zinc-400': b.rang > 3
                        }">
                    {{ b.rang }}
                  </span>
                  <span *ngIf="b.nonClasse" class="text-zinc-300 text-xs italic">-</span>
                </td>
                <td>
                  <div class="font-bold text-zinc-900 uppercase">{{ b.nom }} {{ b.prenom }}</div>
                  <div class="text-[10px] font-mono text-zinc-400">{{ b.matricule }}</div>
                </td>
                <td class="text-center font-medium">
                  <span *ngIf="!b.nonClasse" class="text-zinc-900 font-bold">{{ b.totalPointsObtenus | number:'1.0-1' }}</span>
                  <span class="text-zinc-400">/{{ b.totalPointsMax }}</span>
                  <span *ngIf="b.nonClasse" class="text-zinc-300 italic text-xs">Incomplet</span>
                </td>
                <td class="text-center">
                  <span *ngIf="!b.nonClasse" class="inline-flex items-center px-2 py-1 rounded font-black text-[10px]"
                        [ngClass]="b.pourcentageGlobal >= 50 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'">
                    {{ b.pourcentageGlobal | number:'1.1-1' }}%
                  </span>
                  <span *ngIf="b.nonClasse" class="text-zinc-300 text-xs">-</span>
                </td>
                <td class="text-center">
                  <span class="saas-badge-neutral text-[9px] font-black uppercase" 
                        [class.bg-emerald-50]="b.estPublie" 
                        [class.text-emerald-700]="b.estPublie">
                    {{ b.estPublie ? 'Publié' : 'Brouillon' }}
                  </span>
                </td>
                <td class="text-right">
                  <div class="flex justify-end gap-1.5">
                    <button class="saas-btn-secondary p-1.5 h-9 w-9 justify-center" (click)="voirBulletin(b)" [disabled]="isLoading">
                      <i class="ph ph-eye text-lg"></i>
                    </button>
                    <button class="saas-btn-primary p-1.5 h-9 w-9 justify-center" (click)="publierBulletin(b)" 
                            [disabled]="isLoading || b.estPublie || b.nonClasse">
                      <i class="ph ph-paper-plane-tilt text-lg"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="bulletinsLoading">
                <td colspan="6" class="py-12 text-center text-zinc-400">
                  <i class="ph ph-spinner-gap animate-spin text-3xl mb-2"></i>
                  <p class="text-sm">Chargement des bulletins...</p>
                </td>
              </tr>
              <tr *ngIf="!bulletinsLoading && bulletins.length === 0">
                <td colspan="6" class="py-12 text-center text-zinc-400">
                  <i class="ph ph-file-text text-3xl mb-2"></i>
                  <p class="text-sm">Aucun bulletin disponible pour cette période.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class BulletinsComponent implements OnInit {
  private API_BASE = 'http://207.180.205.248:3007';

  isLoading = false;
  bulletinsLoading = false;

  classes: any[] = [];
  periodes: any[] = [];
  bulletins: any[] = [];

  classeSelectionnee: number | null = null;
  periodeSelectionnee: number | null = null;
  periodeNom: string = '';

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
        next: (res: any) => { this.classes = res.results || []; },
        error: (err) => { console.error('Erreur chargement classes:', err); }
      });
  }

  getClasseDisplay(classe: any): string {
    let display = classe.nom || '';
    if (classe.section) display += ` ${classe.section}`;
    if (classe.option_classe) display += `/${classe.option_classe}`;
    return display;
  }

  onClasseChange() {
    this.bulletins = [];
    this.periodes = [];
    this.periodeSelectionnee = null;
    this.periodeNom = '';
    if (this.classeSelectionnee) {
      this.chargerPeriodes();
    }
  }

  chargerPeriodes() {
    this.http.get(`${this.API_BASE}/api/titulaire/classes/${this.classeSelectionnee}/periodes`, { headers: this.authHeaders() })
      .pipe(timeout(10000))
      .subscribe({
        next: (res: any) => {
          this.periodes = res.results || [];
          // Sélectionner automatiquement la première période
          if (this.periodes.length > 0) {
            this.periodeSelectionnee = this.periodes[0].id;
            this.periodeNom = this.periodes[0].nom;
            this.chargerBulletins();
          }
        },
        error: (err) => { console.error('Erreur chargement périodes:', err); }
      });
  }

  chargerBulletins() {
    if (!this.classeSelectionnee || !this.periodeSelectionnee) return;

    // Récupérer le nom de la période
    const periode = this.periodes.find(p => p.id === this.periodeSelectionnee);
    this.periodeNom = periode ? periode.nom : '';

    this.bulletinsLoading = true;
    this.bulletins = [];

    // 1. Récupérer les élèves de la classe
    this.http.get(`${this.API_BASE}/api/titulaire/classes/${this.classeSelectionnee}/eleves`, { headers: this.authHeaders() })
      .pipe(timeout(10000))
      .subscribe({
        next: (res: any) => {
          const eleves = res.results || [];
          if (eleves.length === 0) {
            this.bulletinsLoading = false;
            return;
          }

          // 2. Pour chaque élève, récupérer son bulletin
          let completed = 0;
          for (const eleve of eleves) {
            this.chargerBulletinEleve(eleve, () => {
              completed++;
              if (completed === eleves.length) {
                this.bulletinsLoading = false;
                // Trier par rang
                this.bulletins.sort((a, b) => {
                  if (a.nonClasse && !b.nonClasse) return 1;
                  if (!a.nonClasse && b.nonClasse) return -1;
                  return (a.rang || 999) - (b.rang || 999);
                });
              }
            });
          }
        },
        error: (err) => {
          console.error('Erreur chargement élèves:', err);
          this.bulletinsLoading = false;
        }
      });
  }

  chargerBulletinEleve(eleve: any, callback: () => void) {
    this.http.get(
      `${this.API_BASE}/api/titulaire/bulletin/${eleve.id}?periode=${this.periodeSelectionnee}`,
      { headers: this.authHeaders() }
    )
      .pipe(timeout(10000))
      .subscribe({
        next: (res: any) => {
          // Structure des données reçues du backend
          this.bulletins.push({
            id: eleve.id,
            matricule: eleve.matricule,
            nom: eleve.nom,
            prenom: eleve.prenom,
            sexe: eleve.sexe,
            // Données du bulletin
            rang: res.rang || null,
            totalPointsObtenus: res.totalPointsObtenus || 0,
            totalPointsMax: res.totalPointsMax || 0,
            pourcentageGlobal: res.pourcentageGlobal || null,
            nonClasse: res.nonClasse || false,
            estAutorise: res.estAutorise || false,
            estPublie: res.estPublie || false,
            resultats: res.resultats || [],
            appreciations: res.appreciations || [],
            presences: res.presences || { total: 0, presents: 0, absents: 0, justifies: 0 },
            bulletinData: res // Stocker les données complètes pour le PDF
          });
          callback();
        },
        error: () => {
          // En cas d'erreur, ajouter quand même l'élève avec des valeurs par défaut
          this.bulletins.push({
            id: eleve.id,
            matricule: eleve.matricule,
            nom: eleve.nom,
            prenom: eleve.prenom,
            sexe: eleve.sexe,
            rang: null,
            totalPointsObtenus: 0,
            totalPointsMax: 0,
            pourcentageGlobal: null,
            nonClasse: true,
            estAutorise: false,
            estPublie: false,
            resultats: [],
            appreciations: [],
            presences: { total: 0, presents: 0, absents: 0, justifies: 0 },
            bulletinData: null
          });
          callback();
        }
      });
  }

  voirBulletin(bulletin: any) {
    if (!bulletin.bulletinData) {
      alert('Données du bulletin indisponibles.');
      return;
    }

    this.isLoading = true;

    this.http.post(
      `${this.API_BASE}/api/titulaire/bulletin/${bulletin.id}/pdf`,
      { periode_id: this.periodeSelectionnee },
      { headers: this.authHeaders() }
    )
      .pipe(timeout(30000), finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (response: any) => {
          if (response.success && response.data) {
            const d = response.data;

            // Construction du HTML du bulletin
            let html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Bulletin Scolaire - ${d.eleve.nom} ${d.eleve.prenom}</title>
              <style>
                body { font-family: 'Times New Roman', serif; margin: 0; padding: 40px; background: #fff; }
                .bulletin { max-width: 900px; margin: 0 auto; border: 2px solid #000; padding: 30px; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                .header h2 { margin: 5px 0; text-transform: uppercase; font-size: 18px; }
                .header h3 { margin: 5px 0; text-transform: uppercase; font-size: 14px; font-weight: normal; }
                .header .titre { font-size: 22px; font-weight: bold; margin: 10px 0; }
                .info-grid { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
                .info-grid .left { width: 65%; }
                .info-grid .right { width: 30%; border: 1px solid #000; padding: 10px; text-align: center; }
                .info-grid p { margin: 4px 0; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                table th, table td { border: 1px solid #000; padding: 5px 8px; text-align: center; }
                table th { background: #f0f0f0; font-weight: bold; }
                table .total-row { font-weight: bold; background: #f9f9f9; }
                .footer { margin-top: 30px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; }
                .footer .signature { width: 30%; }
                .footer .signature .ligne { border-top: 1px solid #000; width: 80%; margin: 30px auto 5px; }
                .mention { text-align: center; margin-top: 20px; font-size: 9px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
                .non-classe { color: #e74c3c; font-weight: bold; font-size: 14px; text-align: center; padding: 10px; background: #fdf2f2; border: 1px solid #f5c6c6; border-radius: 5px; margin: 15px 0; }
                .autorise { color: #27ae60; }
                .bloque { color: #e74c3c; }
              </style>
            </head>
            <body>
              <div class="bulletin">
                <!-- EN-TÊTE -->
                <div class="header">
                  <h2>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</h2>
                  <h3>Ministère de l'Enseignement Primaire, Secondaire et Technique</h3>
                  <div class="titre">BULLETIN SCOLAIRE</div>
                  <p><strong>Année Scolaire:</strong> ${d.anneeScolaire || ''}</p>
                  <p><strong>Période:</strong> ${d.periode || ''}</p>
                </div>

                <!-- INFOS ÉLÈVE -->
                <div class="info-grid">
                  <div class="left">
                    <p><strong>École:</strong> ${d.ecole?.nom || ''}</p>
                    <p><strong>Élève:</strong> ${d.eleve?.nom || ''} ${d.eleve?.prenom || ''} ${d.eleve?.postnom || ''}</p>
                    <p><strong>Matricule:</strong> ${d.eleve?.matricule || ''} | <strong>Sexe:</strong> ${d.eleve?.sexe || ''}</p>
                    <p><strong>Classe:</strong> ${d.classe?.nom || ''} ${d.classe?.section || ''} ${d.classe?.option ? '/' + d.classe.option : ''}</p>
                  </div>
                  <div class="right">
                    <p style="font-size:10px;font-weight:bold;text-transform:uppercase;margin:0;">Cachet de l'école</p>
                    <div style="width:60px;height:60px;border:1px dashed #ccc;border-radius:50%;margin:10px auto;"></div>
                  </div>
                </div>

                <!-- TABLEAU DES NOTES -->
                <table>
                  <thead>
                    <tr>
                      <th style="text-align:left;">BRANCHES / MATIÈRES</th>
                      <th>NOTE</th>
                      <th>/ MAX</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
        `;

            // Lignes des cours
            if (d.notes && d.notes.length > 0) {
              for (const note of d.notes) {
                const noteDisplay = note.note !== null ? note.note : '-';
                const pourcentageDisplay = note.pourcentage !== null ? note.pourcentage.toFixed(1) : '-';
                html += `
                <tr>
                  <td style="text-align:left;font-weight:bold;">${note.cours}</td>
                  <td>${noteDisplay}</td>
                  <td>${note.max}</td>
                  <td>${pourcentageDisplay}</td>
                </tr>
              `;
              }
            } else {
              html += `
              <tr>
                <td colspan="4" style="text-align:center;color:#999;">Aucune note enregistrée</td>
              </tr>
            `;
            }

            // Total
            html += `
                  </tbody>
                  <tfoot>
                    <tr class="total-row">
                      <td style="text-align:left;">TOTAL GÉNÉRAL</td>
                      <td>${d.totalPointsObtenus || 0}</td>
                      <td>${d.totalPointsMax || 0}</td>
                      <td>${d.pourcentageGlobal !== null ? d.pourcentageGlobal.toFixed(1) + '%' : '-'}</td>
                    </tr>
                  </tfoot>
                </table>
          `;

            // Message non classé
            if (d.nonClasse) {
              html += `
              <div class="non-classe">
                ⚠️ L'élève est non classé : certaines notes sont manquantes.
              </div>
            `;
            }

            // Rang
            if (d.rang && !d.nonClasse) {
              html += `
              <div style="text-align:right;margin:10px 0;font-size:14px;font-weight:bold;">
                Rang: ${d.rang}${d.rang === 1 ? 'er' : 'ème'}
              </div>
            `;
            }

            // Présences
            html += `
            <div style="margin:15px 0;font-size:12px;">
              <p><strong>Présences:</strong> 
                Présent: ${d.presences?.presents || 0} | 
                Absent: ${d.presences?.absents || 0} | 
                Justifié: ${d.presences?.justifies || 0} | 
                Total: ${d.presences?.total || 0}
              </p>
            </div>
          `;

            // Appréciations
            if (d.appreciations && d.appreciations.length > 0) {
              html += `
              <div style="margin:10px 0;font-size:12px;">
                <p><strong>Appréciations:</strong></p>
                <ul style="margin:5px 0;padding-left:20px;">
            `;
              for (const app of d.appreciations) {
                html += `<li>${app.observation_discipline} (${app.date_jour})</li>`;
              }
              html += `
                </ul>
              </div>
            `;
            }

            // Signatures
            html += `
                <div class="footer">
                  <div class="signature">
                    <div class="ligne"></div>
                    Le Titulaire
                  </div>
                  <div class="signature">
                    <div class="ligne"></div>
                    Le Chef d'Établissement
                  </div>
                </div>

                <div class="mention">
                  Ce document est une preuve officielle délivrée par ${d.ecole?.nom || 'l\'établissement'}.<br>
                  Toute altération manuelle rend ce document invalide.
                </div>
              </div>
            </body>
            </html>
          `;

            // Ouvrir dans une nouvelle fenêtre
            const win = window.open('', '_blank');
            if (win) {
              win.document.write(html);
              win.document.close();
            }
          }
        },
        error: (err) => {
          console.error('Erreur génération PDF:', err);
          alert('Erreur lors de la génération du bulletin.');
        }
      });
  }

  publierBulletin(bulletin: any) {
    if (bulletin.nonClasse) {
      alert('Impossible de publier un bulletin avec des notes manquantes.');
      return;
    }

    this.isLoading = true;
    this.http.post(
      `${this.API_BASE}/api/titulaire/bulletin/${bulletin.id}/publier`,
      { periode_id: this.periodeSelectionnee },
      { headers: this.authHeaders() }
    )
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: () => {
          bulletin.estPublie = true;
          alert('Bulletin publié avec succès !');
        },
        error: (err) => {
          console.error('Erreur publication:', err);
          alert('Erreur lors de la publication du bulletin.');
        }
      });
  }

  publierTout() {
    const nonPublies = this.bulletins.filter(b => !b.estPublie && !b.nonClasse);

    if (nonPublies.length === 0) {
      alert('Tous les bulletins sont déjà publiés ou non classables.');
      return;
    }

    if (!confirm(`Publier les ${nonPublies.length} bulletins non publiés ?`)) return;

    this.isLoading = true;
    let count = 0;

    for (const b of nonPublies) {
      this.http.post(
        `${this.API_BASE}/api/titulaire/bulletin/${b.id}/publier`,
        { periode_id: this.periodeSelectionnee },
        { headers: this.authHeaders() }
      )
        .subscribe({
          next: () => {
            b.estPublie = true;
            count++;
            if (count === nonPublies.length) {
              this.isLoading = false;
              alert(`${count} bulletins publiés avec succès !`);
            }
          },
          error: (err) => {
            console.error('Erreur publication:', err);
            count++;
            if (count === nonPublies.length) {
              this.isLoading = false;
            }
          }
        });
    }
  }
}