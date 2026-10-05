import { animate, style, transition, trigger } from '@angular/animations';

export const bbFadeScaleIn = trigger('bbFadeScaleIn', [
    transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px) scale(0.985)', filter: 'blur(2px)' }),
        animate(
            '220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            style({ opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0px)' })
        ),
    ]),
    transition(':leave', [
        animate(
            '160ms ease-in',
            style({ opacity: 0, transform: 'translateY(-4px) scale(0.99)', filter: 'blur(2px)' })
        ),
    ]),
]);

export const bbPanelState = trigger('bbPanelState', [
    transition('* => *', [
        animate('200ms ease', style({ transform: 'translateY(0) scale(1)', opacity: 1 }))
    ]),
]);

