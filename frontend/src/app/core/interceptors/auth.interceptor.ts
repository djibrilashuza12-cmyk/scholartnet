// src/app/core/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  
  // Routes publiques à ignorer (pas de redirection)
  private publicRoutes: string[] = [
    '/set-password',
    '/reset-password'
  ];

  constructor(private router: Router) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    let authRequest = request;
    if (token) {
      authRequest = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
    
    return next.handle(authRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        // ✅ Vérifier si on est sur une route publique
        const currentUrl = this.router.url;
        const isPublicRoute = this.publicRoutes.some(route => 
          currentUrl.startsWith(route)
        );
        
        // ✅ Si route publique → NE PAS rediriger, laisser le composant gérer
        if (isPublicRoute) {
          return throwError(() => error);
        }
        
        // ✅ SI TOKEN EXPIRE → REDIRECTION VERS /
        if (error.status === 401 || error.status === 403) {
          // Nettoyer la session
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('school_token');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          sessionStorage.removeItem('school_token');
          
          // ✅ REDIRIGER VERS LA PAGE D'ACCUEIL
          this.router.navigate(['/']);
        }
        return throwError(() => error);
      })
    );
  }
}