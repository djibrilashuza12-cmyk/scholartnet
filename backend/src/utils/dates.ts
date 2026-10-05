// date.ts

export function parseFrDateToISO(fr: string): string {
    const s = (fr || '').trim();
    if (!s) throw new Error('Format de date invalide. La date est vide.');

    // 1. Si la date est DÉJÀ au format ISO (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
            return s;
        }
        throw new Error('Date ISO invalide.');
    }

    // 2. Si la date est au format Français (JJ/MM/AAAA ou J/M/AAAA)
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (!m) {
        throw new Error('Format de date invalide. Utiliser jj/mm/aaaa.');
    }

    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);

    const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
    const iso = dt.toISOString().slice(0, 10);

    // Validation de la date réelle (ex: éviter le 31/02/2026)
    const [y, mo, d] = iso.split('-').map(Number);
    if (y !== yyyy || mo !== mm || d !== dd) {
        throw new Error('Date invalide.');
    }

    return iso; // Retourne YYYY-MM-DD
}

export function validateAnnéeScolaireDatesOrThrow(dateDebutISO: string, dateFinISO: string): void {
    const debut = new Date(dateDebutISO + 'T00:00:00Z');
    const fin = new Date(dateFinISO + 'T00:00:00Z');

    if (isNaN(debut.getTime()) || isNaN(fin.getTime())) {
        throw new Error("Dates d'année scolaire invalides.");
    }

    if (fin <= debut) {
        throw new Error("La date de fin doit être supérieure à la date de début.");
    }

    // Vérifier que l'année scolaire ne dépasse pas une durée raisonnable (ex: max 2 ans / 730 jours)
    const diffDays = (fin.getTime() - debut.getTime()) / (1000 * 3600 * 24);
    if (diffDays > 730) {
        throw new Error("Une année scolaire ne peut pas dépasser 2 ans.");
    }
}