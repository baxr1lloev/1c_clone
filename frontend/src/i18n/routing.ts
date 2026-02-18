import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    locales: ['en', 'ru', 'uz'],
    defaultLocale: 'ru',
});

export type Locale = (typeof routing.locales)[number];
