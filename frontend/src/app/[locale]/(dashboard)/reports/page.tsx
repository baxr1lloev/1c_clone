'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PiChartBarBold,
  PiTrendUpBold,
  PiChartPieBold,
  PiFileTextBold,
  PiDownloadBold,
  PiCalendarBold,
  PiArrowRightBold,
} from 'react-icons/pi';
import Link from 'next/link';

interface ReportCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

export default function ReportsPage() {
  const t = useTranslations('reports');
  const ta = useTranslations('accounting');

  const reportCards: ReportCard[] = [
    {
      title: ta('balanceSheet'),
      description: t('balanceSheetDesc'),
      icon: PiChartBarBold,
      href: '/accounting/balance-sheet',
    },
    {
      title: ta('profitLoss'),
      description: t('profitLossDesc'),
      icon: PiTrendUpBold,
      href: '/accounting/profit-loss',
    },
    {
      title: ta('trialBalance'),
      description: t('trialBalanceDesc'),
      icon: PiChartPieBold,
      href: '/accounting/trial-balance',
    },
    {
      title: ta('journalEntries'),
      description: t('journalEntriesDesc'),
      icon: PiFileTextBold,
      href: '/accounting/journal-entries',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {/* Quick Reports */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {reportCards.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.href} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={report.href}>
                      <PiArrowRightBold className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg mb-1">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Accounting Reports Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiChartBarBold className="h-5 w-5 text-primary" />
            {t('accountingReports')}
          </CardTitle>
          <CardDescription>
            {t('accountingReportsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Link href="/accounting/chart-of-accounts">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <PiFileTextBold className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{ta('chartOfAccounts')}</p>
                  <p className="text-sm text-muted-foreground">{t('chartOfAccountsDesc')}</p>
                </div>
              </div>
            </Link>
            <Link href="/accounting/general-ledger">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <PiFileTextBold className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('generalLedger')}</p>
                  <p className="text-sm text-muted-foreground">{t('generalLedgerDesc')}</p>
                </div>
              </div>
            </Link>
            <Link href="/accounting/period-closing">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <PiCalendarBold className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{ta('periodClosing')}</p>
                  <p className="text-sm text-muted-foreground">{t('periodClosingDesc')}</p>
                </div>
              </div>
            </Link>
            <Link href="/accounting/reports">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <PiChartPieBold className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('advancedReports')}</p>
                  <p className="text-sm text-muted-foreground">{t('advancedReportsDesc')}</p>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Operational Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiTrendUpBold className="h-5 w-5 text-primary" />
            {t('operationalReports')}
          </CardTitle>
          <CardDescription>
            {t('operationalReportsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Link href="/registers/stock-balance">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <PiFileTextBold className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('stockBalanceReport')}</p>
                  <p className="text-sm text-muted-foreground">{t('stockBalanceReportDesc')}</p>
                </div>
              </div>
            </Link>
            <Link href="/registers/stock-movements">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <PiFileTextBold className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('stockMovementsReport')}</p>
                  <p className="text-sm text-muted-foreground">{t('stockMovementsReportDesc')}</p>
                </div>
              </div>
            </Link>
            <Link href="/registers/settlements">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <PiFileTextBold className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('settlementsReport')}</p>
                  <p className="text-sm text-muted-foreground">{t('settlementsReportDesc')}</p>
                </div>
              </div>
            </Link>
            <Link href="/documents/sales">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <PiFileTextBold className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('salesReport')}</p>
                  <p className="text-sm text-muted-foreground">{t('salesReportDesc')}</p>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
