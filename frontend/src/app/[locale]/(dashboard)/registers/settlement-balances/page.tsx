'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { PiUsersBold } from 'react-icons/pi';
import type { SettlementBalance, PaginatedResponse } from '@/types';

const demoBalances: SettlementBalance[] = [
  { id: 1, tenant: 1, counterparty: 1, contract: 1, currency: 1, receivable_amount: 0, payable_amount: 0, net_balance: 0, base_receivable: 0, base_payable: 0, base_net_balance: 0, last_settlement_date: '2024-01-20' },
  { id: 2, tenant: 1, counterparty: 2, contract: null, currency: 1, receivable_amount: 0, payable_amount: 0, net_balance: 0, base_receivable: 0, base_payable: 0, base_net_balance: 0, last_settlement_date: '2024-01-21' },
  { id: 3, tenant: 1, counterparty: 3, contract: 2, currency: 1, receivable_amount: 2640, payable_amount: 0, net_balance: 2640, base_receivable: 2640, base_payable: 0, base_net_balance: 2640, last_settlement_date: '2024-01-21' },
  { id: 4, tenant: 1, counterparty: 4, contract: null, currency: 1, receivable_amount: 0, payable_amount: 3520, net_balance: -3520, base_receivable: 0, base_payable: 3520, base_net_balance: -3520, last_settlement_date: '2024-01-19' },
];

export default function SettlementBalancesPage() {
  const t = useTranslations('registers');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settlement-balances'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<SettlementBalance>>('/registers/settlement-balances/');
        return response.results;
      } catch { return demoBalances; }
    },
  });

  const columns: ColumnDef<SettlementBalance>[] = [
    {
      accessorKey: 'counterparty',
      header: tf('counterparty'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PiUsersBold className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Counterparty #{row.getValue('counterparty')}</span>
        </div>
      ),
    },
    { accessorKey: 'contract', header: tf('contract'), cell: ({ row }) => row.getValue('contract') ? `Contract #${row.getValue('contract')}` : '-' },
    { accessorKey: 'receivable_amount', header: 'Receivable', cell: ({ row }) => <span className="font-mono text-emerald-600">${parseFloat(row.getValue('receivable_amount')).toFixed(2)}</span> },
    { accessorKey: 'payable_amount', header: 'Payable', cell: ({ row }) => <span className="font-mono text-rose-600">${parseFloat(row.getValue('payable_amount')).toFixed(2)}</span> },
    {
      accessorKey: 'net_balance',
      header: 'Net Balance',
      cell: ({ row }) => {
        const balance = parseFloat(row.getValue('net_balance'));
        return <span className={`font-mono font-bold ${balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-rose-600' : 'text-slate-500'}`}>${balance.toFixed(2)}</span>;
      },
    },
    { accessorKey: 'last_settlement_date', header: 'Last Activity', cell: ({ row }) => row.getValue('last_settlement_date') ? new Date(row.getValue('last_settlement_date') as string).toLocaleDateString() : '-' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('settlementBalances')}</h1>
        <p className="text-muted-foreground">Current balances by counterparty and contract</p>
      </div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} onRefresh={() => refetch()} onExport={() => {}} />
    </div>
  );
}

