'use client';

import { KeyboardEvent, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PiCaretLeftBold, PiCaretRightBold, PiStarFill } from 'react-icons/pi';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SalesReportId =
  | 'reconciliation'
  | 'debtors'
  | 'materials'
  | 'customers'
  | 'sales';

interface SalesReportOption {
  id: SalesReportId;
  title: string;
  href: string;
  highlighted?: boolean;
}

type ReportsLocale = 'ru' | 'en' | 'uz';

const LABELS: Record<
  ReportsLocale,
  {
    title: string;
    reconciliation: string;
    debtors: string;
    materials: string;
    customers: string;
    sales: string;
  }
> = {
  ru: {
    title: 'Отчеты',
    reconciliation: 'Акт сверки',
    debtors: 'Дебеторы со сроком',
    materials: 'Материальный отчет',
    customers: 'Отчет по покупателям',
    sales: 'Отчет по продажам',
  },
  en: {
    title: 'Reports',
    reconciliation: 'Reconciliation Act',
    debtors: 'Aged Debtors',
    materials: 'Material Report',
    customers: 'Customer Report',
    sales: 'Sales Report',
  },
  uz: {
    title: 'Hisobotlar',
    reconciliation: 'Solishtirma dalolatnoma',
    debtors: 'Muddatli debitorlar',
    materials: 'Material hisobot',
    customers: 'Xaridorlar hisoboti',
    sales: 'Sotuvlar hisoboti',
  },
};

export default function SalesReportsMenuPage() {
  const params = useParams<{ locale: string }>();
  const router = useRouter();

  const rawLocale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
  const locale = (rawLocale && rawLocale in LABELS ? rawLocale : 'ru') as ReportsLocale;
  const labels = LABELS[locale];

  const options: SalesReportOption[] = [
    {
      id: 'reconciliation',
      title: labels.reconciliation,
      href: '/reports/act-reconciliation',
      highlighted: true,
    },
    {
      id: 'debtors',
      title: labels.debtors,
      href: '/reports/aged-debtors',
    },
    {
      id: 'materials',
      title: labels.materials,
      href: '/reports/stock-as-of-date',
    },
    {
      id: 'customers',
      title: labels.customers,
      href: '/reports/customers',
    },
    {
      id: 'sales',
      title: labels.sales,
      href: '/reports/sales',
    },
  ];

  const [selectedId, setSelectedId] = useState<SalesReportId>('debtors');
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.id === selectedId),
  );

  const openReport = (href: string) => {
    router.push(href);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = Math.min(selectedIndex + 1, options.length - 1);
      setSelectedId(options[nextIndex].id);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = Math.max(selectedIndex - 1, 0);
      setSelectedId(options[nextIndex].id);
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      openReport(options[selectedIndex].href);
    }
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-[#efefef] px-6 py-5 text-black">
      <div className="mb-5 flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-none border-[#9e9e9e] bg-[#f5f5f5] text-black shadow-none"
        >
          <PiCaretLeftBold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-none border-[#9e9e9e] bg-[#f5f5f5] text-black shadow-none"
        >
          <PiCaretRightBold className="h-4 w-4" />
        </Button>
      </div>

      <div tabIndex={0} onKeyDown={handleKeyDown} className="max-w-[500px] outline-none">
        <h1 className="mb-6 text-[52px] font-normal leading-none text-[#2f9c57]">
          {labels.title}
        </h1>

        <div className="space-y-2 pl-3">
          {options.map((option) => {
            const isSelected = option.id === selectedId;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedId(option.id)}
                onDoubleClick={() => openReport(option.href)}
                className={cn(
                  'flex w-full max-w-[360px] items-center gap-3 border border-transparent px-3 py-1 text-left text-[18px] leading-8 outline-none',
                  isSelected && 'border-dotted border-black bg-white',
                )}
              >
                <span className="w-5 text-center">
                  {option.highlighted ? (
                    <PiStarFill className="h-4 w-4 text-[#e6a54b]" />
                  ) : null}
                </span>
                <span>{option.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
