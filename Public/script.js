document.addEventListener('DOMContentLoaded', function () {
    const API_BASE = '/api';

    const matriculeInput = document.getElementById('matriculeInput');
    const rechercherBtn = document.getElementById('rechercherBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const resultatsContainer = document.getElementById('resultatsContainer');

    rechercherBtn.addEventListener('click', rechercher);

    matriculeInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            rechercher();
        }
    });

    async function rechercher() {
        const matricule = matriculeInput.value.trim();

        if (!matricule) {
            afficherErreur('Veuillez entrer un matricule valide.');
            return;
        }

        cacherErreur();
        resultatsContainer.classList.add('hidden');
        resultatsContainer.innerHTML = '';
        loadingIndicator.classList.remove('hidden');
        rechercherBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE}/titulaire/public/resultats/${encodeURIComponent(matricule)}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Le matricule est introuvable ou incorrect.');
            }

            const data = await response.json();
            afficherResultats(data);
        } catch (error) {
            afficherErreur(error.message || 'Une erreur réseau est survenue.');
        } finally {
            loadingIndicator.classList.add('hidden');
            rechercherBtn.disabled = false;
        }
    }

    function formatRang(rang) {
        if (rang === null || rang === undefined) return 'Non classé';
        if (rang === 1) return '1ère';
        if (rang === 2) return '2ème';
        return rang + 'ème';
    }

    function getClasseDisplay(classe) {
        if (!classe) return '-';
        let display = classe.nom || '';
        if (classe.section) display += ' ' + classe.section;
        const optionValue = classe.option || classe.option_classe || '';
        if (optionValue) display += '/' + optionValue;
        return display;
    }

    function afficherResultats(data) {
        if (!data || !data.eleve) {
            afficherErreur('Désolé, aucun dossier trouvé.');
            return;
        }

        const classeDisplay = getClasseDisplay(data.classe);
        const periodesAvecResultats = data.resultats ? data.resultats.filter(p => p.estEligible && p.aDesNotes) : [];

        let html = `
            <div class="resultats-card animate-slide-up">
                <div class="eleve-header">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-brand-500 rounded-full flex items-center justify-center font-bold text-white shadow-lg">
                            ${data.eleve.nom.charAt(0)}${data.eleve.prenom.charAt(0)}
                        </div>
                        <div>
                            <h2 class="text-xl font-bold uppercase tracking-tight">${data.eleve.nom} ${data.eleve.prenom}</h2>
                            <p class="text-zinc-400 text-xs font-mono">${data.eleve.matricule}</p>
                        </div>
                    </div>
                </div>
                
                <div class="eleve-info-grid">
                    <div class="info-item"><span class="label">Établissement</span><span class="value">${data.ecole?.nom || '-'}</span></div>
                    <div class="info-item"><span class="label">Année Scolaire</span><span class="value">${data.anneeScolaire || '-'}</span></div>
                    <div class="info-item"><span class="label">Classe</span><span class="value">${classeDisplay}</span></div>
                    <div class="info-item"><span class="label">Statut</span><span class="value text-passed">Inscrit</span></div>
                </div>
        `;

        if (periodesAvecResultats.length === 0) {
            const premierePeriode = data.resultats?.[0];
            let message = premierePeriode?.message || (data.estPublie ? 'Aucun résultat éligible.' : 'Les résultats ne sont pas encore publiés.');
            html += `<div class="p-12 text-center text-zinc-500 font-medium italic"><i class="ph ph-info text-2xl block mb-2 opacity-30"></i>${message}</div>`;
        } else {
            for (const periode of periodesAvecResultats) {
                html += `
                    <div class="periode-section">
                        <div class="periode-title"><i class="ph-fill ph-bookmarks text-brand-500"></i> ${periode.periode}</div>
                        <table class="saas-table">
                            <thead>
                                <tr><th>Branche</th><th>Note</th><th>Max</th><th>%</th></tr>
                            </thead>
                            <tbody>
                `;

                for (const note of periode.notes) {
                    const noteVal = note.note_obtenue !== null ? note.note_obtenue : '-';
                    const pourc = note.pourcentage !== null ? note.pourcentage.toFixed(1) + '%' : '-';
                    const color = note.pourcentage !== null ? (note.pourcentage >= 50 ? 'text-passed' : 'text-failed') : '';
                    html += `<tr><td>${note.cours_nom}</td><td>${noteVal}</td><td>${note.max_points}</td><td class="${color}">${pourc}</td></tr>`;
                }

                html += `
                            </tbody>
                        </table>
                        <div class="periode-summary">
                            <div class="badge-rang"><i class="ph ph-trophy mr-1"></i> ${periode.nonClasse ? 'N/C' : formatRang(periode.rang)}</div>
                            <div class="badge-moyenne ${periode.pourcentageGlobal >= 50 ? 'passed' : 'failed'}">
                                ${periode.pourcentageGlobal !== null ? periode.pourcentageGlobal.toFixed(2) + '%' : '-'}
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // Section périodes verrouillées
        const periodesBloquees = data.resultats ? data.resultats.filter(p => !p.estEligible || !p.aDesNotes) : [];
        if (periodesBloquees.length > 0) {
            html += `
                <div class="p-6 bg-zinc-50 border-t border-zinc-100">
                    <h4 class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Autres Périodes</h4>
                    <div class="flex flex-wrap gap-2">
            `;
            for (const p of periodesBloquees) {
                html += `<span class="px-3 py-1 bg-white border border-zinc-200 rounded-full text-[10px] font-bold text-zinc-500"><i class="ph ph-lock-key mr-1"></i>${p.periode}</span>`;
            }
            html += `</div></div>`;
        }

        html += `</div>`;
        resultatsContainer.innerHTML = html;
        resultatsContainer.classList.remove('hidden');
    }

    function afficherErreur(message) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function cacherErreur() {
        errorMessage.classList.add('hidden');
    }
});