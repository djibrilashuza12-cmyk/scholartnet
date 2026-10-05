import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

@Component({
    selector: 'app-titulaire',
    standalone: true,
    imports: [CommonModule, RouterOutlet, HttpClientModule],
    template: `<router-outlet></router-outlet>`
})
export class TitulaireComponent { }