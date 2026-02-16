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
import { PiPencilBold, PiTrashBold, PiArrowsDownUpBold, PiCheckCircleBold, PiXCircleBold, PiArrowCircleDownBold, PiArrowCircleUpBold, PiPlusBold } from 'react-icons/pi';
import { useRouter } from 'next/navigation';
import type { PaymentDocument, PaginatedResponse, DocumentStatus, PaymentType } from '@/types';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [activeTab, setActiveTab] = useState<'all' | 'incoming' | 'outgoing'>('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<PaymentDocument>>('/documents/payments/');
        return response.results;
      } catch { return []; }
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

  const handleCreate = (type: 'INCOMING' | 'OUTGOING' = 'INCOMING') =>
    router.push(`/documents/payments/new?type=${type}`);
  const handleEdit = (doc: PaymentDocument) => router.push(`/documents/payments/${doc.id}`);
  const handleView = (doc: PaymentDocument) => router.push(`/documents/payments/${doc.id}`);

  const mainActions: CommandBarAction[] = [
    {
      label: t('incoming'),
      icon: <PiPlusBold />,
      onClick: () => handleCreate('INCOMING'),
      variant: 'default',
      shortcut: 'Ins',
    },
    {
      label: t('outgoing'),
      icon: <PiPlusBold />,
      onClick: () => handleCreate('OUTGOING'),
      variant: 'secondary',
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

  const filteredData = useMemo(() => {
    if (!data) return [];
    let result = data;
    if (activeTab === 'incoming') result = result.filter((d) => d.payment_type === 'INCOMING');
    if (activeTab === 'outgoing') result = result.filter((d) => d.payment_type === 'OUTGOING');
    if (searchValue.trim()) {
      const term = searchValue.toLowerCase();
      result = result.filter((d) =>
        (d.number || '').toLowerCase().includes(term)
        || String(d.id).includes(term)
        || (d.counterparty_name || '').toLowerCase().includes(term)
        || (d.purpose || '').toLowerCase().includes(term)
      );
    }
    return result;
  }, [data, activeTab, searchValue]);

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
        const typeKey: 'incoming' | 'outgoing' = type === 'OUTGOING' ? 'outgoing' : 'incoming';
        return (
          <Badge variant="outline" className={cn("text-[10px] h-5 px-1", type === 'INCOMING' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200')}>
            {type === 'INCOMING' ? <PiArrowCircleDownBold className="mr-1 h-3 w-3 inline" /> : <PiArrowCircleUpBold className="mr-1 h-3 w-3 inline" />}
            {tf(typeKey)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'counterparty',
      header: tf('counterparty'),
      cell: ({ row }) => {
        const id = row.original.counterparty;
        const name = row.original.counterparty_name || (id ? `CP #${id}` : '-');
        if (!id) return <span>{name}</span>;
        return <LinkableCell id={id} type="counterparty" label={name} />;
      },
    },
    {
      accessorKey: 'amount',
      header: tc('amount'),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('amount'));
        const currency = row.original.currency_code || 'CUR';
        return <span className="font-mono font-bold">{amount.toFixed(2)} {currency}</span>;
      },
      footer: () => <span className="font-mono text-primary">{totalSum.toFixed(2)}</span>,
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
      <div className="px-4 py-3 border-b">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'incoming' | 'outgoing')}>
            <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="incoming">{t('incoming')}</TabsTrigger>
            <TabsTrigger value="outgoing">{t('outgoing')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <DataTable
        columns={columns}
        data={filteredData}
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
