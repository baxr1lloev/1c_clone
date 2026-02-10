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
import { StatusBar } from '@/components/ui/status-bar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PiPencilBold, PiTrashBold, PiArrowsDownUpBold, PiCheckCircleBold, PiXCircleBold, PiEyeBold } from 'react-icons/pi';
import { useRouter } from 'next/navigation';
import { getDocumentRowClassName } from '@/components/data-table/row-styles';
import { GroupBySelector } from '@/components/data-table/group-by-selector';
import { SavedViews, SavedView } from '@/components/data-table/saved-views';
import { HelpPanel } from '@/components/layout/help-panel';
import { ColumnCustomization } from '@/components/data-table/column-customization';
import type { PurchaseDocument, PaginatedResponse, DocumentStatus } from '@/types';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';

const decorationPurchases: PurchaseDocument[] = [
  {
    id: 1, tenant: 1, number: 'PUR-2024-0001', date: '2024-01-15', status: 'posted', is_posted: true,
    comment: 'Office supplies', warehouse: 1, supplier: 1, contract: null, currency: 1, exchange_rate: 1, base_currency_rate: 1,
    subtotal: 100, tax_amount: 12, total_amount: 112, total_amount_base: 112,
    lines: [], created_by: 1, posted_by: 1, posted_at: '2024-01-15', created_at: '2024-01-15', updated_at: '2024-01-15',
    supplier_detail: { id: 1, name: 'Office Depot', ...({} as any) }
  },
  { id: 2, tenant: 1, number: 'PR-2024-0002', date: '2024-01-19', status: 'draft', is_posted: false, comment: '', supplier: 2, contract: null, warehouse: 1, currency: 1, exchange_rate: 1, base_currency_rate: 1, subtotal: 3200, tax_amount: 320, total_amount: 3520, total_amount_base: 3520, lines: [], created_by: 1, posted_by: null, posted_at: null, created_at: '2024-01-19', updated_at: '2024-01-19' },
  { id: 3, tenant: 1, number: 'PR-2024-0003', date: '2024-01-20', status: 'posted', is_posted: true, comment: '', supplier: 1, contract: 1, warehouse: 2, currency: 1, exchange_rate: 1, base_currency_rate: 1, subtotal: 1800, tax_amount: 180, total_amount: 1980, total_amount_base: 1980, lines: [], created_by: 1, posted_by: 1, posted_at: '2024-01-20', created_at: '2024-01-20', updated_at: '2024-01-20' },
];

const statusColors: Record<DocumentStatus, string> = {
  draft: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  posted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
};

// 1C-Style Purchase Document List
export default function PurchasesPage() {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PurchaseDocument | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [sorting, setSorting] = useState<any>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<PurchaseDocument>>('/documents/purchases/');
        return response.results;
      } catch { return decorationPurchases; }
    },
  });

  const postMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/purchases/${id}/post/`),
    onSuccess: () => {
      toast.success('Document posted successfully');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: () => toast.error('Failed to post document'),
  });

  const unpostMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/purchases/${id}/unpost/`),
    onSuccess: () => {
      toast.success('Document unposted');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: () => toast.error('Failed to unpost document'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/documents/purchases/${id}/`),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setIsDeleteOpen(false);
      setSelectedItem(null);
    },
    onError: () => toast.error('Failed to delete document'),
  });

  // Actions
  const handleCreate = () => router.push('/documents/purchases/new');
  const handleEdit = (doc: PurchaseDocument) => router.push(`/documents/purchases/${doc.id}`);
  const handleView = (doc: PurchaseDocument) => router.push(`/documents/purchases/${doc.id}`);

  // Load saved view
  const handleLoadView = (view: SavedView) => {
    setStatusFilter(view.filters.status || 'all');
    setSorting(view.sorting);
    setColumnVisibility(view.columnVisibility);
    setGroupBy(view.groupBy);
  };

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

  // Calculate totals
  const totalSum = useMemo(() => {
    if (!data) return 0;
    return data.reduce((sum, doc) => sum + Number(doc.total_amount || 0), 0);
  }, [data]);

  // Filter data based on status filter and search
  const filteredData = useMemo(() => {
    if (!data) return [];
    let filtered = data;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    if (searchValue) {
      filtered = filtered.filter(doc =>
        doc.number.toLowerCase().includes(searchValue.toLowerCase()) ||
        doc.comment?.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    return filtered;
  }, [data, statusFilter, searchValue]);

  const columns: ColumnDef<PurchaseDocument>[] = [
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
          type="purchase-document"
          label={row.getValue('number')}
          className="font-mono text-primary font-bold"
        />
      ),
    },
    {
      accessorKey: 'supplier',
      header: tf('supplier'),
      cell: ({ row }) => {
        const val = row.getValue('supplier');
        return <LinkableCell id={val as number} type="counterparty" label={`Supplier #${val}`} />;
      },
    },
    {
      accessorKey: 'warehouse',
      header: tf('warehouse'),
      cell: ({ row }) => {
        const val = row.getValue('warehouse');
        return <LinkableCell id={val as number} type="warehouse" label={`WH-#${val}`} />;
      },
    },

    {
      accessorKey: 'total_amount',
      header: tc('total'),
      cell: ({ row }) => {
        const total = parseFloat(row.getValue('total_amount'));
        return <span className="font-mono font-bold">${total.toFixed(2)}</span>;
      },
      footer: () => <span className="font-mono text-primary">${totalSum.toFixed(2)}</span>,
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
      {/* Quick Filters */}
      <div className="border-b px-4 py-2 bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Status:</span>
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
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}

        // Interaction
        onRowClick={setSelectedItem}
        onRowDoubleClick={(row) => row.status === 'draft' ? handleEdit(row) : handleView(row)}
        getRowClassName={(row) => getDocumentRowClassName(row.status)}

        // Toolbar
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
              <GroupBySelector
                columns={columns}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
                tableName="purchase_documents"
              />
              <SavedViews
                tableName="purchase_documents"
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
                tableName="purchase_documents"
              />
              <HelpPanel context="purchase-list" />
            </div>
          </div>
        }
      />

      {/* Status Bar */}
      <StatusBar
        totalRecords={data?.length || 0}
        filteredCount={filteredData.length}
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

