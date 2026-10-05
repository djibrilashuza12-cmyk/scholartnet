// recu.component.ts - Version avec génération PDF

import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { bbFadeScaleIn } from '../../../animations/bb-ui.animations';
import { Subject, takeUntil, finalize, timeout } from 'rxjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
    selector: 'app-recu',
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule, RouterLink],
    animations: [bbFadeScaleIn],
    template: `
        <div class="space-y-6">
            <!-- En-tête - Caché à l'impression -->
            <header class="flex items-start justify-between gap-4 flex-wrap no-print">
                <div>
                    <h1 class="text-3xl font-bold mb-2">📄 Reçu de paiement</h1>
                    <p class="text-muted text-sm" *ngIf="recuData">Détails du paiement - {{ recuData.numero_recu }}</p>
                </div>
                <div class="flex gap-2">
                    <button class="glass-button" (click)="downloadPDF()" [disabled]="isLoading || !recuData">
                        📄 Télécharger PDF
                    </button>
                    <a routerLink="/gestionnaire/paiements" class="glass-button">← Retour</a>
                </div>
            </header>

            <div *ngIf="recuLoading" class="text-center py-12 text-muted">Chargement du reçu...</div>

            <!-- ============================================ -->
            <!-- RECU - FORMAT COMPACT POUR PDF               -->
            <!-- ============================================ -->
            <div *ngIf="recuData" class="recu-wrapper">
                <div #recuContent id="recu-content" class="recu-content">
                    <!-- En-tête école -->
                    <div class="text-center border-b border-gray-300 pb-2 mb-2">
                        <div class="ecole-nom">{{ recuData.ecole_nom || 'École' }}</div>
                        <div class="ecole-info">{{ recuData.ecole_adresse || '' }}</div>
                        <div class="ecole-info" *ngIf="recuData.ecole_telephone || recuData.ecole_bp">
                            <span *ngIf="recuData.ecole_telephone">Tél: {{ recuData.ecole_telephone }}</span>
                            <span *ngIf="recuData.ecole_bp"> | BP: {{ recuData.ecole_bp }}</span>
                        </div>
                    </div>

                    <!-- Titre -->
                    <div class="text-center">
                        <div class="titre">RECU DE PAIEMENT</div>
                        <div class="numero-recu">N° {{ recuData.numero_recu }}</div>
                        <div class="ecole-info">{{ recuData.date_paiement | date:'dd/MM/yyyy HH:mm' }}</div>
                    </div>

                    <!-- Infos élève -->
                    <div class="info-eleve">
                        <div class="flex justify-between">
                            <span><span class="label">Élève:</span> <strong>{{ recuData.eleve_nom || '' }} {{ recuData.eleve_prenom || '' }}</strong></span>
                            <span><span class="label">Mat:</span> {{ recuData.eleve_matricule || '' }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span><span class="label">Classe:</span> {{ getClasseDisplay(recuData) }}</span>
                            <span><span class="label">Année:</span> {{ recuData.annee_scolaire_nom || '' }}</span>
                        </div>
                    </div>

                    <!-- Type de frais -->
                    <div class="ligne">
                        <span class="label">Frais</span>
                        <span class="valeur">{{ recuData.type_frais || '' }}</span>
                    </div>

                    <!-- RÉPARTITION -->
                    <div class="mt-1" *ngIf="recuData.repartition && recuData.repartition.length > 0">
                        <div class="repart-titre">Détail des paiements :</div>
                        <div *ngFor="let ligne of recuData.repartition; let i = index" 
                             class="repart-ligne" [class.alt]="i % 2 === 0">
                            <span>{{ ligne.periode_nom || 'Surplus' }}</span>
                            <span class="font-medium">{{ ligne.montant_paye | number:'1.0-2' }} {{ recuData.devise || 'USD' }}</span>
                        </div>
                    </div>

                    <!-- TOTAL - ✅ Affiche le bon total -->
                    <div class="total">
                        <span>TOTAL PAYÉ</span>
                        <span>{{ recuData.montant_total | number:'1.0-2' }} {{ recuData.devise || 'USD' }}</span>
                    </div>

                    <!-- Mode paiement & Référence -->
                    <div class="flex justify-between text-xs py-1">
                        <span class="label">Mode:</span>
                        <span class="font-medium">{{ recuData.mode_paiement || 'CASH' }}</span>
                    </div>
                    <div class="flex justify-between text-xs py-1" *ngIf="recuData.reference_externe">
                        <span class="label">Réf:</span>
                        <span class="font-mono text-xs">{{ recuData.reference_externe }}</span>
                    </div>
                    <div class="flex justify-between text-xs py-1" *ngIf="recuData.commentaire">
                        <span class="label">Commentaire:</span>
                        <span>{{ recuData.commentaire }}</span>
                    </div>

                    <!-- Signature -->
                    <div class="signature">
                        <div>
                            <div class="label">Encaissé par</div>
                            <div class="font-semibold">{{ recuData.gestionnaire_nom || '' }} {{ recuData.gestionnaire_prenom || '' }}</div>
                        </div>
                        <div class="text-right">
                            <div class="label">Cachet & signature</div>
                            <div class="cachet"></div>
                        </div>
                    </div>

                    <!-- ✅ Pied de page - SUPPRIMÉ le remerciement -->
                    <div class="footer">
                        <!-- Pas de remerciement -->
                    </div>
                </div>
            </div>

            <div *ngIf="!recuLoading && !recuData" class="text-center py-8 text-muted">
                Reçu non trouvé.
            </div>
        </div>
    `,
    styles: [`
        /* ============================================
           STYLE POUR L'ÉCRAN
        ============================================ */
        .recu-wrapper {
            max-width: 400px;
            margin: 0 auto;
        }

        .recu-content {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px 20px;
            font-size: 11px;
            font-family: 'Courier New', monospace;
            color: #1f2937;
        }

        .recu-content .ecole-nom {
            font-size: 16px;
            font-weight: 700;
            text-transform: uppercase;
            color: #1f2937;
        }

        .recu-content .ecole-info {
            font-size: 10px;
            color: #6b7280;
        }

        .recu-content .titre {
            font-size: 14px;
            font-weight: 700;
            color: #1f2937;
            text-align: center;
            margin: 4px 0;
        }

        .recu-content .numero-recu {
            font-size: 11px;
            font-weight: 600;
            text-align: center;
            color: #4b5563;
        }

        .recu-content .info-eleve {
            background: #f9fafb;
            padding: 6px 8px;
            border-radius: 4px;
            margin: 6px 0;
            font-size: 10px;
        }

        .recu-content .label {
            color: #6b7280;
        }

        .recu-content .ligne {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            border-bottom: 1px dashed #e5e7eb;
        }

        .recu-content .ligne:last-child {
            border-bottom: none;
        }

        .recu-content .valeur {
            font-weight: 600;
            color: #1f2937;
        }

        .recu-content .repart-titre {
            font-size: 10px;
            color: #6b7280;
            font-weight: 500;
            margin-bottom: 2px;
        }

        .recu-content .repart-ligne {
            display: flex;
            justify-content: space-between;
            padding: 2px 4px;
            font-size: 10px;
            border-bottom: 1px solid #f3f4f6;
        }

        .recu-content .repart-ligne.alt {
            background: #f9fafb;
        }

        .recu-content .total {
            font-size: 13px;
            font-weight: 700;
            color: #16a34a;
            padding: 4px 0;
            border-top: 2px solid #16a34a;
            margin-top: 4px;
            display: flex;
            justify-content: space-between;
        }

        .recu-content .signature {
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px solid #d1d5db;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
        }

        .recu-content .cachet {
            width: 60px;
            height: 30px;
            border-bottom: 2px solid #9ca3af;
            margin-left: auto;
        }

        .recu-content .footer {
            text-align: center;
            font-size: 8px;
            color: transparent;
            margin-top: 4px;
            padding-top: 2px;
            border-top: none;
            height: 4px;
        }

        @media print {
            .no-print { display: none !important; }
            body { background: white !important; margin: 0 !important; padding: 0 !important; }
            #recu-content {
                box-shadow: none !important;
                background: white !important;
                color: black !important;
                padding: 6px 10px !important;
                margin: 0 auto !important;
                max-width: 100% !important;
                border: none !important;
                border-radius: 0 !important;
                font-size: 9px !important;
                font-family: 'Courier New', monospace !important;
            }
        }
    `]
})
export class RecuComponent implements OnInit, OnDestroy {
    @ViewChild('recuContent', { static: false }) recuContent!: ElementRef;

    private API_BASE = 'http://207.180.205.248:3007';
    private destroy$ = new Subject<void>();

    isLoading = false;
    recuLoading = true;
    recuData: any = null;
    recuId: number = 0;

    constructor(
        private http: HttpClient,
        private cdr: ChangeDetectorRef,
        private route: ActivatedRoute,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.recuId = parseInt(params['id']);
            if (this.recuId) {
                this.loadRecu();
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private authHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', 'Bearer ' + token);
    }

    loadRecu(): void {
        this.recuLoading = true;
        console.log('🔍 Chargement du reçu pour l\'ID:', this.recuId);

        this.http.get(`${this.API_BASE}/api/gestionnaire/paiements/recu/${this.recuId}`, { headers: this.authHeaders() })
            .pipe(timeout(15000), finalize(() => { this.recuLoading = false; this.cdr.detectChanges(); }))
            .subscribe({
                next: (res: any) => {
                    if (res.recu) {
                        this.recuData = res.recu;
                        console.log('✅ Reçu chargé avec succès');
                        console.log('📊 Transaction ID:', this.recuData.transaction_id);
                        console.log('📊 Nombre de paiements:', this.recuData.repartition?.length || 1);
                        console.log('📊 Total:', this.recuData.montant_total);
                    } else {
                        console.error('❌ Aucune donnée de reçu trouvée');
                        this.showError('Reçu non trouvé. Veuillez vérifier que le paiement existe.');
                    }
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('❌ Erreur chargement reçu:', err);
                    console.error('❌ Détails:', err.error);
                    this.showError('Erreur lors du chargement du reçu. Veuillez réessayer.');
                    this.cdr.detectChanges();
                }
            });
    }

    private showError(message: string): void {
        alert(message);
        this.router.navigate(['/gestionnaire/paiements']);
    }

    getClasseDisplay(recu: any): string {
        if (!recu) return '-';
        let display = recu.classe_nom || '';
        if (recu.classe_section) display += ` ${recu.classe_section}`;
        if (recu.classe_option) {
            if (recu.classe_section) display += `/${recu.classe_option}`;
            else display += ` ${recu.classe_option}`;
        }
        return display || '-';
    }

    // ============================================
    // 📄 GÉNÉRATION PDF AVEC jspdf + html2canvas
    // ============================================
    async downloadPDF(): Promise<void> {
        if (!this.recuContent) {
            console.error('❌ Contenu du reçu non trouvé');
            return;
        }

        this.isLoading = true;

        try {
            const element = this.recuContent.nativeElement;

            // Capturer le contenu HTML
            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: element.scrollWidth,
                height: element.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');

            // Créer le PDF (format A6: 105x148mm)
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a6'  // 105 x 148 mm
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Calculer le ratio pour adapter l'image
            const imgRatio = canvas.width / canvas.height;
            let imgWidth = pdfWidth;
            let imgHeight = pdfWidth / imgRatio;

            // Si l'image est trop haute, l'adapter à la hauteur
            if (imgHeight > pdfHeight) {
                imgHeight = pdfHeight;
                imgWidth = pdfHeight * imgRatio;
            }

            // Centrer l'image
            const x = (pdfWidth - imgWidth) / 2;
            const y = (pdfHeight - imgHeight) / 2;

            // Ajouter l'image au PDF
            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);

            // Générer le nom du fichier
            const fileName = `recu_${this.recuData?.numero_recu || this.recuId}_${new Date().toISOString().slice(0, 10)}.pdf`;

            // Télécharger le PDF
            pdf.save(fileName);

            console.log('✅ PDF téléchargé avec succès');

        } catch (error) {
            console.error('❌ Erreur lors de la génération du PDF:', error);
            alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }
}