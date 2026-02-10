'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';
import { ReferenceLink } from '@/components/ui/reference-link';
import { SettlementsBalance, PaginatedResponse } from '@/types';
import { PiArrowsClockwiseBold, PiPrinterBold } from 'react-icons/pi';
import { cn } from '@/lib/utils';

export default function SettlementsBalancePage() {
  const t = useTranslations('registers');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');

  const [searchValue, setSearchValue] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settlements-balance', searchValue],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchValue) params.append('search', searchValue);

      const response = await api.get<PaginatedResponse<SettlementsBalance>>(`/registers/settlements/?${params.toString()}`);
      return response.results;
    },
  });

  const columns: ColumnDef<SettlementsBalance>[] = [
    {
      accessorKey: 'counterparty',
      header: tf('counterparty'),
      cell: ({ row }) => (
        <ReferenceLink
          id={row.original.counterparty}
          type="counterparty"
          label={row.original.counterparty_detail?.name || `CP #${row.original.counterparty}`}
          showIcon={true}
          className="font-medium"
        />
      ),
    },
    {
      accessorKey: 'contract',
      header: tf('contract'),
      cell: ({ row }) => (
        <ReferenceLink
          id={row.original.contract || 0}
          type="contract"
          label={row.original.contract_detail?.number || `Main Contract`}
        />
      ),
    },
    {
      accessorKey: 'currency',
      header: tf('currency'),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.currency_detail?.code || 'USD'}</span>
    },
    {
      accessorKey: 'debit',
      header: "Debit (Receivable)",
      cell: ({ row }) => {
        const val = row.original.debit;
        return val > 0 ? <span className="font-mono text-emerald-600 font-bold">{val.toLocaleString()}</span> : <span className="text-muted-foreground">-</span>;
      }
    },
    {
      accessorKey: 'credit',
      header: "Credit (Payable)",
      cell: ({ row }) => {
        const val = row.original.credit;
        return val > 0 ? <span className="font-mono text-rose-600 font-bold">{val.toLocaleString()}</span> : <span className="text-muted-foreground">-</span>;
      }
    },
    {
      accessorKey: 'balance',
      header: "Balance",
      cell: ({ row }) => {
        const val = row.original.balance;
        const isNegative = val < 0;
        return (
          <span className={cn("font-mono font-bold", isNegative ? "text-rose-600" : "text-emerald-600")}>
            {val.toLocaleString()}
          </span>
        );
      }
    }
  ];

  const actions: CommandBarAction[] = [
    {
      label: tc('refresh'),
      icon: <PiArrowsClockwiseBold />,
      onClick: () => refetch(),
      variant: 'ghost',
      shortcut: 'F5'
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        commandBar={
          <CommandBar
            mainActions={actions}
            onSearch={setSearchValue}
            searchValue={searchValue}
            searchPlaceholder="Search Counterparty..."
          />
        }
      />
    </div>
  );
}

