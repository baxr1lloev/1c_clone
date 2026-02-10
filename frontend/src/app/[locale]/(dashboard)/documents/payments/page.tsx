'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { LinkableCell } from '@/components/ui/linkable-cell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PiPencilBold, PiTrashBold, PiArrowsDownUpBold, PiCheckCircleBold, PiXCircleBold, PiArrowCircleDownBold, PiArrowCircleUpBold } from 'react-icons/pi';
import { useRouter } from 'next/navigation';
import type { PaymentDocument, PaginatedResponse, DocumentStatus, PaymentType } from '@/types';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';

const decorationPayments: PaymentDocument[] = [
  { id: 1, tenant: 1, number: 'PAY-2024-0001', date: '2024-01-20', status: 'posted', is_posted: true, comment: '', payment_type: 'INCOMING', payment_method: 'bank_transfer', counterparty: 1, contract: 1, currency: 1, rate: 1, amount: 1650, purpose: 'Payment for SL-2024-0001', created_by: 1, posted_by: 1, posted_at: '2024-01-20', created_at: '2024-01-20', updated_at: '2024-01-20' },
  { id: 2, tenant: 1, number: 'PAY-2024-0002', date: '2024-01-21', status: 'posted', is_posted: true, comment: '', payment_type: 'OUTGOING', payment_method: 'bank_transfer', counterparty: 2, contract: null, currency: 1, rate: 1, amount: 5500, purpose: 'Payment for PR-2024-0001', created_by: 1, posted_by: 1, posted_at: '2024-01-21', created_at: '2024-01-21', updated_at: '2024-01-21' },
  { id: 3, tenant: 1, number: 'PAY-2024-0003', date: '2024-01-22', status: 'draft', is_posted: false, comment: '', payment_type: 'INCOMING', payment_method: 'cash', counterparty: 3, contract: null, currency: 1, rate: 1, amount: 2000, purpose: 'Advance payment', created_by: 1, posted_by: null, posted_at: null, created_at: '2024-01-22', updated_at: '2024-01-22' },
];

const statusColors: Record<DocumentStatus, string> = {
  draft: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  posted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
};

export default function PaymentsPage() {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PaymentDocument | null>(null);
  const [searchValue, setSearchValue] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<PaymentDocument>>('/documents/payments/');
        return response.results;
      } catch { return decorationPayments; }
    },
  });

  const postMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/payments/${id}/post/`),
    onSuccess: () => {
      toast.success('Document posted successfully');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: () => toast.error('Failed to post document'),
  });

  const unpostMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/payments/${id}/unpost/`),
    onSuccess: () => {
      toast.success('Document unposted');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: () => toast.error('Failed to unpost document'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/documents/payments/${id}/`),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setIsDeleteOpen(false);
      setSelectedItem(null);
    },
    onError: () => toast.error('Failed to delete document'),
  });

  const handleCreate = () => router.push('/documents/payments/new');
  const handleEdit = (doc: PaymentDocument) => router.push(`/documents/payments/${doc.id}`);
  const handleView = (doc: PaymentDocument) => router.push(`/documents/payments/${doc.id}`);

  const mainActions: CommandBarAction[] = [
    {
      label: tc('create'),
      icon: <PiPencilBold />,
      onClick: handleCreate,
      variant: 'default',
      shortcut: 'Ins',
    },
  ];

  const selectionActions: CommandBarAction[] = selectedItem ? [
    {
      label: tc('edit'),
      icon: <PiPencilBold />,
      onClick: () => handleEdit(selectedItem),
      disabled: selectedItem.status !== 'draft',
      shortcut: 'F2'
    },
    {
      label: t('post'),
      icon: <PiCheckCircleBold />,
      onClick: () => postMutation.mutate(selectedItem.id),
      disabled: selectedItem.status === 'posted',
      variant: 'ghost'
    },
    {
      label: t('unpost'),
      icon: <PiXCircleBold />,
      onClick: () => unpostMutation.mutate(selectedItem.id),
      disabled: selectedItem.status !== 'posted',
      variant: 'ghost'
    },
    {
      label: tc('delete'),
      icon: <PiTrashBold />,
      onClick: () => setIsDeleteOpen(true),
      variant: 'destructive',
      shortcut: 'Del'
    }
  ] : [];

  const totalSum = useMemo(() => {
    if (!data) return 0;
    return data.reduce((sum, doc) => sum + Number(doc.amount || 0), 0);
  }, [data]);

  const columns: ColumnDef<PaymentDocument>[] = [
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4 h-8 text-xs">
          {tc('date')} <PiArrowsDownUpBold className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono">{new Date(row.getValue('date')).toLocaleDateString()}</span>,
      footer: () => <span className="text-muted-foreground">{tc('total')}:</span>,
    },
    {
      accessorKey: 'number',
      header: tc('number'),
      cell: ({ row }) => (
        <ReferenceLink
          id={row.original.id}
          type="payment-document"
          label={row.getValue('number')}
          className="font-mono text-primary font-bold"
        />
      ),
    },
    {
      accessorKey: 'payment_type',
      header: tf('paymentType'),
      cell: ({ row }) => {
        const type = row.getValue('payment_type') as PaymentType;
        return (
          <Badge variant="outline" className={cn("text-[10px] h-5 px-1", type === 'INCOMING' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200')}>
            {type === 'INCOMING' ? <PiArrowCircleDownBold className="mr-1 h-3 w-3 inline" /> : <PiArrowCircleUpBold className="mr-1 h-3 w-3 inline" />}
            {tf(type)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'counterparty',
      header: tf('counterparty'),
      cell: ({ row }) => {
        const val = row.getValue('counterparty');
        return <LinkableCell id={val as number} type="counterparty" label={`CP #${val}`} />;
      },
    },
    {
      accessorKey: 'amount',
      header: tc('amount'),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('amount'));
        return <span className="font-mono font-bold">${amount.toFixed(2)}</span>;
      },
      footer: () => <span className="font-mono text-primary">${totalSum.toFixed(2)}</span>,
    },
    {
      accessorKey: 'purpose',
      header: tf('purpose'),
      cell: ({ row }) => <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{row.getValue('purpose')}</span>,
    },
    {
      accessorKey: 'status',
      header: tc('status'),
      cell: ({ row }) => {
        const status = row.getValue('status') as DocumentStatus;
        return (
          <Badge variant="outline" className={cn("text-[10px] h-5 px-1", statusColors[status])}>
            {t(status)}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        onRowClick={setSelectedItem}
        onRowDoubleClick={(row) => row.status === 'draft' ? handleEdit(row) : handleView(row)}
        commandBar={
          <CommandBar
            mainActions={mainActions}
            selectionActions={selectionActions}
            onRefresh={() => refetch()}
            onSearch={setSearchValue}
            searchValue={searchValue}
            searchPlaceholder="Search number..."
          />
        }
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark for deletion?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedItem?.number}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)} className="bg-destructive text-destructive-foreground">
              {deleteMutation.isPending ? 'Deleting...' : tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

