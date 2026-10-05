import { Routes } from '@angular/router';

export const TITULAIRE_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('./titulaire.component').then(m => m.TitulaireComponent),
        children: [
            {
                path: 'dashboard',
                loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
            },
            {
                path: 'notes',
                loadComponent: () => import('./components/notes/notes.component').then(m => m.NotesComponent)
            },
            {
                path: 'presences',
                loadComponent: () => import('./components/presences/presences.component').then(m => m.PresencesComponent)
            },
            {
                path: 'appreciations',
                loadComponent: () => import('./components/appreciations/appreciations.component').then(m => m.AppreciationsComponent)
            },
            {
                path: 'bulletins',
                loadComponent: () => import('./components/bulletins/bulletins.component').then(m => m.BulletinsComponent)
            },
            {
                path: 'classement',
                loadComponent: () => import('./components/classement/classement.component').then(m => m.ClassementComponent)
            },
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
        ]
    }
];