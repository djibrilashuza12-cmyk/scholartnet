import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-logo',
    standalone: true,
    imports: [CommonModule],
    template: `
    <img
      src="favicon.ico"
      [alt]="alt"
      [style.width.px]="size"
      [style.height.px]="size"
      class="logo-img"
      loading="eager"
    />
    <span class="logo-text" *ngIf="showText">
      Scolar<span>Net</span>
    </span>
  `,
    styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .logo-img {
      border-radius: 10px;
      object-fit: contain;
      flex-shrink: 0;
      display: block;
    }
    .logo-text {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0F172A;
      line-height: 1;
    }
    .logo-text span {
      color: #3B82F6;
    }
    :host(.compact) .logo-text {
      font-size: 18px;
    }
  `]
})
export class LogoComponent {
    @Input() size = 40;
    @Input() showText = true;
    @Input() alt = 'ScolarNet';
}