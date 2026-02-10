'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CommandBar } from '@/components/ui/command-bar';
import { ReportFilterBar } from '@/components/ui/report-filter-bar';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { PiCalculatorBold, PiArrowRightBold } from 'react-icons/pi';
import { Badge } from '@/components/ui/badge';
import { ReferenceLink } from '@/components/ui/reference-link';

// Mock Type
interface LedgerEntry {
  id: string;
  date: string;
  documentType: string;
  documentNumber: string;
  documentId: number | null; // ID for linking
  documentRefType: string | null; // Type for ReferenceLink
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function GeneralLedgerPage() {
  const t = useTranslations('accounting'); // Ensure this namespace exists or use 'common'
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account');
  const filterType = searchParams.get('type'); // 'debit' or 'credit' filter

  // Mock Data Generator based on Account ID
  const entries: LedgerEntry[] = accountId ? [
    { id: '1', date: '2024-01-01', documentType: 'Opening Balance', documentNumber: '-', documentId: null, documentRefType: null, description: 'Opening Balance', debit: 150000, credit: 0, balance: 150000 },
    { id: '2', date: '2024-01-05', documentType: 'Sales Invoice', documentNumber: 'SL-2024-0001', documentId: 1, documentRefType: 'sales-document', description: 'Sale to Customer A', debit: 25000, credit: 0, balance: 175000 },
    { id: '3', date: '2024-01-10', documentType: 'Payment', documentNumber: 'PAY-2024-0001', documentId: 1, documentRefType: 'payment-document', description: 'Payment for Utilities', debit: 0, credit: 5000, balance: 170000 },
    { id: '4', date: '2024-01-15', documentType: 'Purchase Invoice', documentNumber: 'PR-2024-0001', documentId: 1, documentRefType: 'purchase-document', description: 'Purchase of Goods', debit: 0, credit: 5000, balance: 165000 },
  ] : [];

  const columns: ColumnDef<LedgerEntry>[] = [
    {
      accessorKey: 'date',
      header: tc('date'),
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.date}</span>
    },
    {
      accessorKey: 'document',
      header: 'Document',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-xs">{row.original.documentType}</span>
          {row.original.documentId && row.original.documentRefType ? (
            <ReferenceLink
              id={row.original.documentId}
              type={row.original.documentRefType}
              label={row.original.documentNumber}
              className="text-xs"
            />
          ) : (
            <span className="text-xs text-muted-foreground">{row.original.documentNumber}</span>
          )}
        </div>
      )
    },
    {
      accessorKey: 'description',
      header: tc('description'),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.description}</span>
    },
    {
      accessorKey: 'debit',
      header: () => <div className="text-right">Debit</div>,
      cell: ({ row }) => <div className="text-right font-mono text-xs">{row.original.debit > 0 ? row.original.debit.toLocaleString() : '-'}</div>
    },
    {
      accessorKey: 'credit',
      header: () => <div className="text-right">Credit</div>,
      cell: ({ row }) => <div className="text-right font-mono text-xs">{row.original.credit > 0 ? row.original.credit.toLocaleString() : '-'}</div>
    },
    {
      accessorKey: 'balance',
      header: () => <div className="text-right font-bold">Balance</div>,
      cell: ({ row }) => <div className="text-right font-mono text-xs font-bold">{row.original.balance.toLocaleString()}</div>
    }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <CommandBar
        mainActions={[
          { label: 'Generate', onClick: () => { }, shortcut: 'F5', variant: 'default' },
          { label: 'Print', onClick: () => window.print(), variant: 'ghost' },
        ]}
        className="border-b"
      />
      <div className="p-4 border-b bg-muted/5 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <PiCalculatorBold className="h-5 w-5 text-primary" />
          {t('generalLedger')}
          {accountId && (
            <div className="flex items-center text-base font-normal ml-2">
              <PiArrowRightBold className="mx-2 text-muted-foreground" />
              <Badge variant="outline" className="text-foreground">Account #{accountId}</Badge>
            </div>
          )}
        </h1>
      </div>

      <ReportFilterBar />

      <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950 p-4">
        {entries.length > 0 ? (
          <div className="border rounded-md">
            <DataTable
              columns={columns}
              data={entries}
              searchColumn="description"
              searchPlaceholder="Search transactions..."
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
            <PiCalculatorBold className="h-12 w-12 mb-4" />
            <p>{accountId ? 'No transactions found for this account.' : 'Select an account from Trial Balance to view details.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
