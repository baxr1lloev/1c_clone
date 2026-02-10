'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PiPencilBold, PiTrashBold, PiArrowsDownUpBold, PiCheckCircleBold, PiXCircleBold } from 'react-icons/pi';
import { useRouter } from 'next/navigation';
import type { InventoryDocument, PaginatedResponse, DocumentStatus } from '@/types';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';

const decorationInventory: InventoryDocument[] = [
  { id: 1, tenant: 1, number: 'INV-2024-0001', date: '2024-01-15', status: 'posted', is_posted: true, comment: 'Monthly inventory', warehouse: 1, lines: [], created_by: 1, posted_by: 1, posted_at: '2024-01-15', created_at: '2024-01-15', updated_at: '2024-01-15' },
  { id: 2, tenant: 1, number: 'INV-2024-0002', date: '2024-01-31', status: 'draft', is_posted: false, comment: 'End of month', warehouse: 2, lines: [], created_by: 1, posted_by: null, posted_at: null, created_at: '2024-01-31', updated_at: '2024-01-31' },
];

const statusColors: Record<DocumentStatus, string> = {
  draft: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  posted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
};

export default function InventoryPage() {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryDocument | null>(null);
  const [searchValue, setSearchValue] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<InventoryDocument>>('/documents/inventory/');
        return response.results;
      } catch { return decorationInventory; }
    },
  });

  const postMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/inventory/${id}/post/`),
    onSuccess: () => {
      toast.success('Document posted successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: () => toast.error('Failed to post document'),
  });

  const unpostMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/inventory/${id}/unpost/`),
    onSuccess: () => {
      toast.success('Document unposted');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: () => toast.error('Failed to unpost document'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/documents/inventory/${id}/`),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsDeleteOpen(false);
      setSelectedItem(null);
    },
    onError: () => toast.error('Failed to delete document'),
  });

  const handleCreate = () => router.push('/documents/inventory/new');
  const handleEdit = (doc: InventoryDocument) => router.push(`/documents/inventory/${doc.id}`);
  const handleView = (doc: InventoryDocument) => router.push(`/documents/inventory/${doc.id}`);

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

  const columns: ColumnDef<InventoryDocument>[] = [
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4 h-8 text-xs">
          {tc('date')} <PiArrowsDownUpBold className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono">{new Date(row.getValue('date')).toLocaleDateString()}</span>,
    },
    {
      accessorKey: 'number',
      header: tc('number'),
      cell: ({ row }) => (
        <ReferenceLink
          id={row.original.id}
          type="inventory-document"
          label={row.getValue('number')}
          className="font-mono text-primary font-bold"
        />
      ),
    },
    {
      accessorKey: 'warehouse',
      header: tf('warehouse'),
      cell: ({ row }) => {
        const val = row.getValue('warehouse');
        return <ReferenceLink id={val as number} type="warehouse" label={`WH-#${val}`} />;
      },
    },
    {
      accessorKey: 'comment',
      header: tf('comment'),
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.getValue('comment') || '-'}</span>,
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

