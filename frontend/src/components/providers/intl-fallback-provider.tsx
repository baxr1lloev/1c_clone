'use client';

import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

export function IntlFallbackProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      getMessageFallback={({ namespace, key }) =>
        [namespace, key].filter(Boolean).join('.')
      }
    >
      {children}
    </NextIntlClientProvider>
  );
}
