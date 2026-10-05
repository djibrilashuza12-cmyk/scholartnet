// middleware/dateFormatter.ts
import { Request, Response, NextFunction } from 'express';

// Liste des champs de date à formater
const DATE_FIELDS = [
    'date_debut', 'date_fin', 'date_naissance', 'date_inscription',
    'date_paiement', 'date_autorisation', 'date_creation',
    'date_mouvement', 'date_annulation', 'date_jour'
];

function formatDateForMySQL(dateStr: string): string {
    if (!dateStr) return dateStr;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toISOString().split('T')[0];
    } catch {
        return dateStr;
    }
}

function formatDatesInObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    // Si c'est un tableau, parcourir chaque élément
    if (Array.isArray(obj)) {
        return obj.map(item => formatDatesInObject(item));
    }

    // Parcourir les propriétés de l'objet
    Object.keys(obj).forEach(key => {
        if (obj[key] && typeof obj[key] === 'object') {
            obj[key] = formatDatesInObject(obj[key]);
        } else if (typeof obj[key] === 'string' && DATE_FIELDS.includes(key)) {
            obj[key] = formatDateForMySQL(obj[key]);
        }
    });

    return obj;
}

export const dateFormatter = (req: Request, res: Response, next: NextFunction) => {
    if (req.body) {
        formatDatesInObject(req.body);
    }
    if (req.query) {
        formatDatesInObject(req.query);
    }
    if (req.params) {
        formatDatesInObject(req.params);
    }
    next();
};