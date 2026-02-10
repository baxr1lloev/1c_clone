'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PiCaretRightBold, PiHouseBold } from 'react-icons/pi';
import { useTranslations } from 'next-intl';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import React from 'react';

export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const td = useTranslations('directories');
  const tdoc = useTranslations('documents');
  const tr = useTranslations('registers');
  const ta = useTranslations('accounting');

  // Remove locale prefix
  const pathWithoutLocale = pathname.replace(/^\/(en|ru|uz)/, '');
  const segments = pathWithoutLocale.split('/').filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const getSegmentLabel = (segment: string, index: number): string => {
    const labelMap: Record<string, string> = {
      // Nav
      directories: td('title'),
      documents: tdoc('title'),
      registers: tr('title'),
      accounting: ta('title'),
      settings: t('settings'),
      profile: t('profile'),
      // Directories
      currencies: td('currencies'),
      'exchange-rates': td('exchangeRates'),
      counterparties: td('counterparties'),
      contracts: td('contracts'),
      warehouses: td('warehouses'),
      items: td('items'),
      // Documents
      sales: tdoc('sales'),
      purchases: tdoc('purchases'),
      payments: tdoc('payments'),
      transfers: tdoc('transfers'),
      orders: tdoc('orders'),
      inventory: tdoc('inventory'),
      transit: tdoc('transit'),
      // Registers
      'stock-movements': tr('stockMovements'),
      'stock-balance': tr('stockBalance'),
      settlements: tr('settlements'),
      reservations: tr('reservations'),
      batches: tr('batches'),
      // Accounting
      'chart-of-accounts': ta('chartOfAccounts'),
      'journal-entries': ta('journalEntries'),
      'period-closing': ta('periodClosing'),
      'trial-balance': ta('trialBalance'),
      'balance-sheet': ta('balanceSheet'),
      'profit-loss': ta('profitLoss'),
    };

    return labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
  };

  const buildHref = (index: number): string => {
    const locale = pathname.match(/^\/(en|ru|uz)/)?.[0] || '/en';
    return locale + '/' + segments.slice(0, index + 1).join('/');
  };

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/" className="flex items-center gap-1">
              <PiHouseBold className="h-4 w-4" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const label = getSegmentLabel(segment, index);

          return (
            <React.Fragment key={segment + index}>
              <BreadcrumbSeparator>
                <PiCaretRightBold className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={buildHref(index)}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
