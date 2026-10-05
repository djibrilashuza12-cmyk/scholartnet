import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent) },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'register-school',
    loadComponent: () => import('./features/auth/register-school/register-school.component').then((m) => m.RegisterSchoolComponent)
  },
  {
    path: 'set-password',
    loadComponent: () => import('./features/auth/set-password/set-password.component').then((m) => m.SetPasswordComponent)
  },
  {
    path: 'reset-password',
    redirectTo: '/set-password'
  },
  // ============ Module Admin ============
  {
    path: 'admin',
    loadComponent: () => import('./shared/layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  // ============ Module Secrétariat ============
  {
    path: 'secretariat',
    loadComponent: () => import('./shared/layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/secretariat/secretariat.component').then((m) => m.SecretariatComponent)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  // ============ Module Gestionnaire ============
  {
    path: 'gestionnaire',
    loadComponent: () => import('./shared/layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/gestionnaire/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'frais',
        loadComponent: () => import('./features/gestionnaire/frais/frais.component').then((m) => m.FraisComponent)
      },
      {
        path: 'paiements',
        loadComponent: () => import('./features/gestionnaire/paiements/paiements.component').then((m) => m.PaiementsComponent)
      },
      {
        path: 'paiements/nouveau',
        loadComponent: () => import('./features/gestionnaire/paiements/nouveau-paiement/nouveau-paiement.component').then((m) => m.NouveauPaiementComponent)
      },
      {
        path: 'recu/:id',
        loadComponent: () => import('./features/gestionnaire/recu/recu.component').then((m) => m.RecuComponent)
      },
      {
        path: 'impayes',
        loadComponent: () => import('./features/gestionnaire/impayes/impayes.component').then((m) => m.ImpayesComponent)
      },
      {
        path: 'stocks',
        loadComponent: () => import('./features/gestionnaire/stocks/stocks.component').then((m) => m.StocksComponent)
      },
      {
        path: 'rapports',
        loadComponent: () => import('./features/gestionnaire/rapports/rapports.component').then((m) => m.RapportsComponent)
      },
      {
        path: 'periodes',
        loadComponent: () => import('./features/gestionnaire/periodes/periodes.component').then((m) => m.PeriodesComponent)
      },
      {
        path: 'autorisations',
        loadComponent: () => import('./features/gestionnaire/autorisations/autorisations.component').then((m) => m.AutorisationsComponent)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  // ============ Module Titulaire ============
  {
    path: 'titulaire',
    loadComponent: () => import('./shared/layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/titulaire/components/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'notes',
        loadComponent: () => import('./features/titulaire/components/notes/notes.component').then((m) => m.NotesComponent)
      },
      {
        path: 'presences',
        loadComponent: () => import('./features/titulaire/components/presences/presences.component').then((m) => m.PresencesComponent)
      },
      {
        path: 'appreciations',
        loadComponent: () => import('./features/titulaire/components/appreciations/appreciations.component').then((m) => m.AppreciationsComponent)
      },
      {
        path: 'bulletins',
        loadComponent: () => import('./features/titulaire/components/bulletins/bulletins.component').then((m) => m.BulletinsComponent)
      },
      {
        path: 'classement',
        loadComponent: () => import('./features/titulaire/components/classement/classement.component').then((m) => m.ClassementComponent)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];