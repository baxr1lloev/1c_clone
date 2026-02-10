'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { DrillDownModal } from '@/components/ui/drilldown-modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

export default function TrialBalancePage() {
  const [period, setPeriod] = useState('');
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownConfig, setDrillDownConfig] = useState<{
    title: string;
    endpoint: string;
  } | null>(null);

  const { data: trialBalanceData, isLoading } = useQuery({
    queryKey: ['trial-balance', period],
    queryFn: async () => {
      const params = period ? `?period=${period}` : '';
      const response = await api.get(`/api/reports/trial-balance/${params}`);
      return response.data;
    },
  });

  const handleDrillDown = (account: string, side: 'debit' | 'credit') => {
    setDrillDownConfig({
      title: `${side === 'debit' ? 'Debit' : 'Credit'} for Account ${account}`,
      endpoint: `/api/reports/trial-balance/drilldown/?account=${account}&side=${side}&period=${period}`,
    });
    setDrillDownOpen(true);
  };

  const columns: ColumnDef<TrialBalanceRow>[] = [
    {
      accessorKey: 'account_code',
      header: 'Account',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.account_code}</div>
          <div className="text-sm text-muted-foreground">
            {row.original.account_name}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'opening_debit',
      header: 'Opening Debit',
      cell: ({ row }) => (
        <Button
          variant="link"
          className="p-0 h-auto font-normal"
          onClick={() => handleDrillDown(row.original.account_code, 'debit')}
        >
          ${row.original.opening_debit.toFixed(2)}
        </Button>
      ),
    },
    {
      accessorKey: 'opening_credit',
      header: 'Opening Credit',
      cell: ({ row }) => (
        <Button
          variant="link"
          className="p-0 h-auto font-normal"
          onClick={() => handleDrillDown(row.original.account_code, 'credit')}
        >
          ${row.original.opening_credit.toFixed(2)}
        </Button>
      ),
    },
    {
      accessorKey: 'period_debit',
      header: 'Period Debit',
      cell: ({ row }) => (
        <Button
          variant="link"
          className="p-0 h-auto font-normal"
          onClick={() => handleDrillDown(row.original.account_code, 'debit')}
        >
          ${row.original.period_debit.toFixed(2)}
        </Button>
      ),
    },
    {
      accessorKey: 'period_credit',
      header: 'Period Credit',
      cell: ({ row }) => (
        <Button
          variant="link"
          className="p-0 h-auto font-normal"
          onClick={() => handleDrillDown(row.original.account_code, 'credit')}
        >
          ${row.original.period_credit.toFixed(2)}
        </Button>
      ),
    },
    {
      accessorKey: 'closing_debit',
      header: 'Closing Debit',
      cell: ({ row }) => `$${row.original.closing_debit.toFixed(2)}`,
    },
    {
      accessorKey: 'closing_credit',
      header: 'Closing Credit',
      cell: ({ row }) => `$${row.original.closing_credit.toFixed(2)}`,
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trial Balance</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Period Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-64">
            <Label>Period</Label>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trial Balance Report</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={trialBalanceData?.rows || []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {drillDownConfig && (
        <DrillDownModal
          title={drillDownConfig.title}
          endpoint={drillDownConfig.endpoint}
          isOpen={drillDownOpen}
          onClose={() => setDrillDownOpen(false)}
        />
      )}
    </div>
  );
}
