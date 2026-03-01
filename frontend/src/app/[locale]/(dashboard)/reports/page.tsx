'use client';

import { KeyboardEvent, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PiCaretLeftBold, PiCaretRightBold } from 'react-icons/pi';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReportOption {
  id: 'stock' | 'suppliers';
  title: string;
  href: string;
}

type ReportsLocale = 'ru' | 'en' | 'uz';

const REPORT_LABELS: Record<
  ReportsLocale,
  {
    title: string;
    materialsReport: string;
    suppliersReport: string;
  }
> = {
  ru: {
    title: 'Отчеты',
    materialsReport: 'Материальный отчет',
    suppliersReport: 'Отчет по поставщикам',
  },
  en: {
    title: 'Reports',
    materialsReport: 'Material Report',
    suppliersReport: 'Supplier Report',
  },
  uz: {
    title: 'Hisobotlar',
    materialsReport: 'Material hisobot',
    suppliersReport: 'Yetkazib beruvchilar hisoboti',
  },
};

export default function ReportsPage() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const rawLocale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
  const locale = (rawLocale && rawLocale in REPORT_LABELS ? rawLocale : 'ru') as ReportsLocale;
  const labels = REPORT_LABELS[locale];

  const reportOptions: ReportOption[] = [
    {
      id: 'stock',
      title: labels.materialsReport,
      href: '/reports/stock-as-of-date',
    },
    {
      id: 'suppliers',
      title: labels.suppliersReport,
      href: '/reports/settlements-as-of-date',
    },
  ];

  const [selectedReportId, setSelectedReportId] = useState<ReportOption['id']>('stock');

  const selectedIndex = Math.max(
    0,
    reportOptions.findIndex((option) => option.id === selectedReportId),
  );

  const openReport = (href: string) => {
    const target = locale ? `/${locale}${href}` : href;
    router.push(target);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = Math.min(selectedIndex + 1, reportOptions.length - 1);
      setSelectedReportId(reportOptions[nextIndex].id);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = Math.max(selectedIndex - 1, 0);
      setSelectedReportId(reportOptions[nextIndex].id);
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      openReport(reportOptions[selectedIndex].href);
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

      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="max-w-[420px] outline-none"
      >
        <h1 className="mb-6 text-[52px] font-normal leading-none text-[#2f9c57]">
          {labels.title}
        </h1>

        <div className="space-y-3 pl-8">
          {reportOptions.map((option) => {
            const isSelected = option.id === selectedReportId;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedReportId(option.id)}
                onDoubleClick={() => openReport(option.href)}
                className={cn(
                  'block w-full max-w-[320px] border border-transparent px-3 py-1 text-left text-[18px] leading-7 outline-none',
                  isSelected && 'border-dotted border-black bg-white',
                )}
              >
                {option.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
