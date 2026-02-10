'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PiDownloadBold, PiPrinterBold, PiCalendarBold } from 'react-icons/pi';
import { useState } from 'react';
import { BankBalanceReport } from '@/components/reports/bank-balance-report';
import { ArApAgingReport } from '@/components/reports/ar-ap-aging-report';
import { GrossProfitReport } from '@/components/reports/gross-profit-report';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function ReportSection({ title, items, totalLabel }: { title: string; items: { name: string; amount: number }[]; totalLabel?: string }) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{title}</h4>
      {items.map((item, i) => (
        <div key={i} className="flex justify-between py-1 text-sm">
          <span>{item.name}</span>
          <span className={`font-mono ${item.amount < 0 ? 'text-rose-600' : ''}`}>{formatCurrency(item.amount)}</span>
        </div>
      ))}
      {totalLabel && (
        <div className="flex justify-between py-2 border-t font-semibold">
          <span>{totalLabel}</span>
          <span className="font-mono">{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  );
}

export default function FinancialReportsPage() {
  const t = useTranslations('accounting');
  const tc = useTranslations('common');
  const [period, setPeriod] = useState('2024-01');

  // Demo financial data
  const balanceSheetData = {
    assets: {
      current: [
        { name: t('accounts.cash'), amount: 11650 },
        { name: t('accounts.accountsReceivable'), amount: 5990 },
        { name: t('accounts.inventory'), amount: 104000 },
        { name: t('accounts.prepaidExpenses'), amount: 2500 },
      ],
      nonCurrent: [
        { name: t('accounts.propertyPlantEquipment'), amount: 85000 },
        { name: t('accounts.accumulatedDepreciation'), amount: -15000 },
        { name: t('accounts.intangibleAssets'), amount: 12000 },
      ],
    },
    liabilities: {
      current: [
        { name: t('accounts.accountsPayable'), amount: 2500 },
        { name: t('accounts.accruedExpenses'), amount: 3500 },
        { name: t('accounts.shortTermLoans'), amount: 10000 },
      ],
      nonCurrent: [
        { name: t('accounts.longTermDebt'), amount: 50000 },
      ],
    },
    equity: [
      { name: t('accounts.shareCapital'), amount: 100000 },
      { name: t('accounts.retainedEarnings'), amount: 38140 },
      { name: t('accounts.currentYearEarnings'), amount: 2000 },
    ],
  };

  const incomeStatementData = {
    revenue: [
      { name: t('accounts.salesRevenue'), amount: 85000 },
      { name: t('accounts.serviceRevenue'), amount: 12000 },
      { name: t('accounts.otherIncome'), amount: 1500 },
    ],
    expenses: [
      { name: t('accounts.cogs'), amount: 54000 },
      { name: t('accounts.salariesWages'), amount: 18000 },
      { name: t('accounts.rentExpense'), amount: 6000 },
      { name: t('accounts.utilities'), amount: 2500 },
      { name: t('accounts.depreciation'), amount: 3000 },
      { name: t('accounts.marketing'), amount: 4500 },
      { name: t('accounts.administrative'), amount: 3500 },
      { name: t('accounts.interestExpense'), amount: 2000 },
      { name: t('accounts.taxExpense'), amount: 3000 },
    ],
  };

  const totalCurrentAssets = balanceSheetData.assets.current.reduce((s, i) => s + i.amount, 0);
  const totalNonCurrentAssets = balanceSheetData.assets.nonCurrent.reduce((s, i) => s + i.amount, 0);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  const totalCurrentLiabilities = balanceSheetData.liabilities.current.reduce((s, i) => s + i.amount, 0);
  const totalNonCurrentLiabilities = balanceSheetData.liabilities.nonCurrent.reduce((s, i) => s + i.amount, 0);
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

  const totalEquity = balanceSheetData.equity.reduce((s, i) => s + i.amount, 0);

  const totalRevenue = incomeStatementData.revenue.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = incomeStatementData.expenses.reduce((s, i) => s + i.amount, 0);
  const netIncome = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('reports')}</h1>
          <p className="text-muted-foreground">Financial statements and reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[200px]">
              <PiCalendarBold className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024-01">January 2024</SelectItem>
              <SelectItem value="2023-12">December 2023</SelectItem>
              <SelectItem value="2023-Q4">Q4 2023</SelectItem>
              <SelectItem value="2023">Year 2023</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon"><PiPrinterBold className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon"><PiDownloadBold className="h-4 w-4" /></Button>
        </div>
      </div>

      <Tabs defaultValue="balance-sheet">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="balance-sheet">{t('balanceSheet')}</TabsTrigger>
          <TabsTrigger value="gross-profit" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900 font-bold">Gross Profit</TabsTrigger>
          <TabsTrigger value="income-statement">{t('incomeStatement')}</TabsTrigger>
          <TabsTrigger value="cash-flow">{t('cashFlow')}</TabsTrigger>
          <TabsTrigger value="bank-balance">Bank Balance</TabsTrigger>
          <TabsTrigger value="ar-ap">AR/AP Aging</TabsTrigger>
        </TabsList>

        <TabsContent value="balance-sheet">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('assets')}</CardTitle>
                <CardDescription>{t('assetsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ReportSection title={t('currentAssets')} items={balanceSheetData.assets.current} totalLabel={t('totalCurrentAssets')} />
                <ReportSection title={t('nonCurrentAssets')} items={balanceSheetData.assets.nonCurrent} totalLabel={t('totalNonCurrentAssets')} />
                <div className="flex justify-between py-3 border-t-2 font-bold text-lg">
                  <span>{t('totalAssets')}</span>
                  <span className="font-mono">{formatCurrency(totalAssets)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('liabilitiesEquity')}</CardTitle>
                <CardDescription>{t('liabilitiesEquityDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ReportSection title={t('currentLiabilities')} items={balanceSheetData.liabilities.current} totalLabel={t('totalCurrentLiabilities')} />
                <ReportSection title={t('nonCurrentLiabilities')} items={balanceSheetData.liabilities.nonCurrent} totalLabel={t('totalNonCurrentLiabilities')} />
                <div className="flex justify-between py-2 border-t font-semibold">
                  <span>{t('totalLiabilities')}</span>
                  <span className="font-mono">{formatCurrency(totalLiabilities)}</span>
                </div>
                <ReportSection title={t('equity')} items={balanceSheetData.equity} totalLabel={t('totalEquity')} />
                <div className="flex justify-between py-3 border-t-2 font-bold text-lg">
                  <span>{t('totalLiabilitiesEquity')}</span>
                  <span className="font-mono">{formatCurrency(totalLiabilities + totalEquity)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gross-profit">
          <GrossProfitReport />
        </TabsContent>

        <TabsContent value="income-statement">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('incomeStatement')}</CardTitle>
              <CardDescription>{t('incomeStatementDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="max-w-2xl space-y-6">
              <ReportSection title={t('revenue')} items={incomeStatementData.revenue} totalLabel={t('totalRevenue')} />
              <ReportSection title={t('expenses')} items={incomeStatementData.expenses} totalLabel={t('totalExpenses')} />
              <div className={`flex justify-between py-3 border-t-2 font-bold text-lg ${netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                <span>{t('netIncome')}</span>
                <span className="font-mono">{formatCurrency(netIncome)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-flow">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('cashFlowStatement')}</CardTitle>
              <CardDescription>{t('cashFlowDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="max-w-2xl space-y-6">
              <ReportSection
                title={t('operatingActivities')}
                items={[
                  { name: t('netIncome'), amount: netIncome },
                  { name: t('depreciation'), amount: 3000 },
                  { name: t('changesInWorkingCapital'), amount: -2500 },
                ]}
                totalLabel={t('netCashFromOperations')}
              />
              <ReportSection
                title={t('investingActivities')}
                items={[
                  { name: t('purchaseOfEquipment'), amount: -5000 },
                  { name: t('saleOfInvestments'), amount: 2000 },
                ]}
                totalLabel={t('netCashFromInvesting')}
              />
              <ReportSection
                title={t('financingActivities')}
                items={[
                  { name: t('loanRepayment'), amount: -3000 },
                  { name: t('dividendsPaid'), amount: -1500 },
                ]}
                totalLabel={t('netCashFromFinancing')}
              />
              <div className="flex justify-between py-3 border-t-2 font-bold text-lg">
                <span>{t('netChangeInCash')}</span>
                <span className="font-mono text-emerald-600">{formatCurrency(netIncome + 3000 - 2500 - 5000 + 2000 - 3000 - 1500)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank-balance">
          <BankBalanceReport />
        </TabsContent>

        <TabsContent value="ar-ap">
          <ArApAgingReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
