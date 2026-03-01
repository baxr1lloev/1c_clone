'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, SortingState } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { LinkableCell } from '@/components/ui/linkable-cell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBar } from '@/components/ui/status-bar';
import { GroupBySelector } from '@/components/data-table/group-by-selector';
import { SavedViews, SavedView } from '@/components/data-table/saved-views';
import { HelpPanel } from '@/components/layout/help-panel';
import { ColumnCustomization } from '@/components/data-table/column-customization';
import { getDocumentRowClassName } from '@/components/data-table/row-styles';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PiPencilBold, PiTrashBold, PiArrowsDownUpBold, PiCheckCircleBold, PiXCircleBold } from 'react-icons/pi';
import { useRouter } from 'next/navigation';
import type { TransferDocument, PaginatedResponse, DocumentStatus } from '@/types';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';

const decorationTransfers: TransferDocument[] = [
  { id: 1, tenant: 1, number: 'TR-2024-0001', date: '2024-01-20', status: 'posted', is_posted: true, comment: '', source_warehouse: 1, target_warehouse: 2, lines: [], created_by: 1, posted_by: 1, posted_at: '2024-01-20', created_at: '2024-01-20', updated_at: '2024-01-20' },
  { id: 2, tenant: 1, number: 'TR-2024-0002', date: '2024-01-21', status: 'draft', is_posted: false, comment: '', source_warehouse: 2, target_warehouse: 1, lines: [], created_by: 1, posted_by: null, posted_at: null, created_at: '2024-01-21', updated_at: '2024-01-21' },
];

const statusColors: Record<DocumentStatus, string> = {
  draft: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  posted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
};

export default function TransfersPage() {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const localePath = (path: string) => `/${locale}${path.startsWith('/') ? path : `/${path}`}`;

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TransferDocument | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<TransferDocument>>('/documents/transfers/');
        return response.results;
      } catch { return decorationTransfers; }
    },
  });

  const postMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/transfers/${id}/post/`),
    onSuccess: () => {
      toast.success('Document posted successfully');
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
    onError: () => toast.error('Failed to post document'),
  });

  const unpostMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/transfers/${id}/unpost/`),
    onSuccess: () => {
      toast.success('Document unposted');
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
    onError: () => toast.error('Failed to unpost document'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/documents/transfers/${id}/`),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      setIsDeleteOpen(false);
      setSelectedItem(null);
    },
    onError: () => toast.error('Failed to delete document'),
  });

  const handleCreate = () => router.push(localePath('/documents/transfers/new'));
  const handleEdit = (doc: TransferDocument) => router.push(localePath(`/documents/transfers/${doc.id}`));
  const handleView = (doc: TransferDocument) => router.push(localePath(`/documents/transfers/${doc.id}`));

  // Load saved view
  const handleLoadView = (view: SavedView) => {
    setStatusFilter(view.filters.status || 'all');
    setSorting(view.sorting);
    setColumnVisibility(view.columnVisibility);
    setGroupBy(view.groupBy);
  };

  // Filtering
  const filteredData = useMemo(() => {
    if (!data) return [];
    let filtered = data;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    if (searchValue) {
      filtered = filtered.filter(doc =>
        doc.number.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    return filtered;
  }, [data, statusFilter, searchValue]);

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

  const columns: ColumnDef<TransferDocument>[] = [
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4 h-8 text-xs">
          {tc('date')} <PiArrowsDownUpBold className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const rawValue = row.getValue('date') as string;
        const parsed = rawValue ? new Date(rawValue) : null;
        const label = parsed && !Number.isNaN(parsed.getTime())
          ? parsed.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
          : String(rawValue || '-');

        return (
          <button
            type="button"
            className="font-mono text-left text-xs text-[#2e56a6] hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedItem(row.original);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (row.original.status === 'draft') {
                handleEdit(row.original);
                return;
              }
              handleView(row.original);
            }}
          >
            {label}
          </button>
        );
      },
    },
    {
      accessorKey: 'number',
      header: tc('number'),
      cell: ({ row }) => (
        <ReferenceLink
          id={row.original.id}
          type="transfer-document"
          label={row.getValue('number')}
          href={localePath(`/documents/transfers/${row.original.id}`)}
          className="font-mono text-primary font-bold"
        />
      ),
    },
    {
      accessorKey: 'source_warehouse',
      header: tf('sourceWarehouse'),
      cell: ({ row }) => {
        const val = row.getValue('source_warehouse');
        return <LinkableCell id={val as number} type="warehouse" label={`WH-#${val}`} />;
      },
    },
    {
      accessorKey: 'target_warehouse',
      header: tf('targetWarehouse'),
      cell: ({ row }) => {
        const val = row.getValue('target_warehouse');
        return <LinkableCell id={val as number} type="warehouse" label={`WH-#${val}`} />;
      },
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
        data={filteredData}
        isLoading={isLoading}
        onRowClick={setSelectedItem}
        onRowDoubleClick={(row) => row.status === 'draft' ? handleEdit(row) : handleView(row)}
        commandBar={
          <div className="flex items-center justify-between w-full">
            <CommandBar
              mainActions={mainActions}
              selectionActions={selectionActions}
              onRefresh={() => refetch()}
              onSearch={setSearchValue}
              searchValue={searchValue}
              searchPlaceholder="Search number..."
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === 'draft' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setStatusFilter('draft')}
                >
                  Draft
                </Button>
                <Button
                  variant={statusFilter === 'posted' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setStatusFilter('posted')}
                >
                  Posted
                </Button>
                <Button
                  variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setStatusFilter('cancelled')}
                >
                  Cancelled
                </Button>
                {statusFilter !== 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setStatusFilter('all')}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <GroupBySelector
                columns={columns}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
                tableName="transfer_documents"
              />
              <SavedViews
                tableName="transfer_documents"
                currentState={{
                  filters: { status: statusFilter },
                  sorting,
                  columnVisibility,
                  groupBy
                }}
                onLoadView={handleLoadView}
              />
              <ColumnCustomization
                columns={columns}
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
                tableName="transfer_documents"
              />
              <HelpPanel context="transfer-list" />
            </div>
          </div>
        }
        getRowClassName={(row) => getDocumentRowClassName(row.status)}
      />

      {/* Status Bar */}
      <StatusBar
        totalRecords={data?.length || 0}
        filteredCount={statusFilter !== 'all' || searchValue ? filteredData.length : undefined}
        selectedCount={selectedItem ? 1 : 0}
        isLoading={isLoading}
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

