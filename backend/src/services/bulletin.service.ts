import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { format } from 'date-fns';

interface BulletinData {
    eleve: any;
    ecole: any;
    classe: any;
    anneeScolaire: string;
    notes: any[];
    moyenneGenerale: number;
    appreciations: any[];
    presences: any;
    periode: string;
    rang?: number;
    totalEleves?: number;
    mention?: string;
}

export async function generateBulletinPDF(data: BulletinData): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 50;
    const marginX = 72;
    const lineHeight = 20;
    const fontSize = 10;
    const fontSizeTitle = 18;
    const fontSizeHeader = 14;

    // En-tête
    page.drawText((data.ecole?.nom || 'ÉCOLE').toUpperCase(), {
        x: width / 2 - 80,
        y: y,
        size: fontSizeTitle,
        font: fontBold,
        color: rgb(0, 0, 0),
    });
    y -= 15;

    if (data.ecole?.adresse) {
        page.drawText(data.ecole.adresse, {
            x: width / 2 - 100,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
        });
        y -= 15;
    }

    // Titre
    page.drawText(`BULLETIN SCOLAIRE - ${data.periode || 'Période'}`, {
        x: width / 2 - 120,
        y: y,
        size: fontSizeHeader,
        font: fontBold,
        color: rgb(0, 0, 0),
    });
    y -= 30;

    // Informations élève
    const eleveInfo = [
        ['Matricule', data.eleve?.matricule || '-'],
        ['Nom', data.eleve?.nom || '-'],
        ['Postnom', data.eleve?.postnom || '-'],
        ['Prénom', data.eleve?.prenom || '-'],
        ['Sexe', data.eleve?.sexe === 'M' ? 'Masculin' : 'Féminin'],
        ['Classe', data.classe?.nom || '-'],
        ['Année scolaire', data.anneeScolaire || '-']
    ];

    for (const row of eleveInfo) {
        page.drawText(`${row[0]}:`, {
            x: marginX,
            y: y,
            size: fontSize,
            font: fontBold,
            color: rgb(0, 0, 0),
        });

        page.drawText(row[1], {
            x: marginX + 120,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });

        y -= lineHeight;
    }

    y -= 10;

    // Tableau des notes
    const tableHeaders = ['Cours', 'Note', 'Coef', 'Max'];
    const colWidths = [200, 80, 80, 80];
    let xPos = marginX;

    // En-têtes du tableau
    for (let i = 0; i < tableHeaders.length; i++) {
        page.drawText(tableHeaders[i], {
            x: xPos,
            y: y,
            size: fontSize,
            font: fontBold,
            color: rgb(0, 0, 0),
        });
        xPos += colWidths[i];
    }

    y -= 5;

    // Ligne de séparation
    page.drawLine({
        start: { x: marginX, y: y + 2 },
        end: { x: marginX + colWidths.reduce((a, b) => a + b, 0), y: y + 2 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
    });

    y -= 20;

    // Données du tableau
    for (const note of data.notes) {
        xPos = marginX;

        page.drawText(note.cours || '', {
            x: xPos,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });
        xPos += colWidths[0];

        page.drawText(String(note.note || 0), {
            x: xPos,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });
        xPos += colWidths[1];

        page.drawText(String(note.ponderation || 1), {
            x: xPos,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });
        xPos += colWidths[2];

        page.drawText(String(note.maxPoints || 10), {
            x: xPos,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });

        y -= lineHeight;
    }

    // Ligne de séparation
    page.drawLine({
        start: { x: marginX, y: y + 5 },
        end: { x: marginX + colWidths.reduce((a, b) => a + b, 0), y: y + 5 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
    });

    y -= 15;

    // Moyenne générale
    page.drawText(`Moyenne Générale: ${data.moyenneGenerale || 0}/10`, {
        x: marginX,
        y: y,
        size: fontSize + 2,
        font: fontBold,
        color: rgb(0, 0, 0),
    });

    y -= 30;

    // Présences
    page.drawText('Présences:', {
        x: marginX,
        y: y,
        size: fontSize,
        font: fontBold,
        color: rgb(0, 0, 0),
    });

    const pres = data.presences || { total: 0, presents: 0, absents: 0, justifies: 0 };
    page.drawText(
        `Total: ${pres.total} | Présents: ${pres.presents} | Absents: ${pres.absents} | Justifiés: ${pres.justifies}`,
        {
            x: marginX + 100,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        }
    );

    y -= 25;

    // Appréciations
    if (data.appreciations && data.appreciations.length > 0) {
        page.drawText('Appréciations:', {
            x: marginX,
            y: y,
            size: fontSize,
            font: fontBold,
            color: rgb(0, 0, 0),
        });
        y -= 20;

        for (const app of data.appreciations) {
            const text = `- ${app.date_jour ? format(new Date(app.date_jour), 'dd/MM/yyyy') : ''}: ${app.observation_discipline || ''}`;
            page.drawText(text, {
                x: marginX + 10,
                y: y,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });
            y -= lineHeight;
        }
    }

    // Classement
    if (data.rang !== undefined && data.totalEleves !== undefined) {
        y -= 15;
        page.drawText(`Classement: ${data.rang}/${data.totalEleves}`, {
            x: marginX,
            y: y,
            size: fontSize,
            font: fontBold,
            color: rgb(0, 0, 0),
        });

        if (data.mention) {
            page.drawText(`Mention: ${data.mention}`, {
                x: marginX + 250,
                y: y,
                size: fontSize,
                font: fontBold,
                color: data.mention === 'Très Bien' ? rgb(0, 0.6, 0) : rgb(0, 0, 0),
            });
        }
    }

    y -= 40;

    // Date
    const dateStr = format(new Date(), 'dd/MM/yyyy');
    page.drawText(`Fait à ${data.ecole?.adresse || '...'}, le ${dateStr}`, {
        x: marginX,
        y: y,
        size: fontSize,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
    });

    y -= 20;

    // Signature
    page.drawText('Le Chef d\'Établissement', {
        x: width - marginX - 180,
        y: y,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
    });
    y -= 30;

    page.drawText('_________________________', {
        x: width - marginX - 180,
        y: y,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}