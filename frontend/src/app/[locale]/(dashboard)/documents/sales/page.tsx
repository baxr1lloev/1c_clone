'use client'
import { LinkableCell } from '@/components/ui/linkable-cell';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { StatusBar } from '@/components/ui/status-bar';
import { getDocumentRowClassName } from '@/components/data-table/row-styles';
import { GroupBySelector } from '@/components/data-table/group-by-selector';
import { SavedViews, SavedView } from '@/components/data-table/saved-views';
import { HelpPanel } from '@/components/layout/help-panel';
import { ColumnCustomization } from '@/components/data-table/column-customization';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PiDotsThreeOutlineBold, PiPencilBold, PiTrashBold, PiArrowsDownUpBold, PiReceiptBold, PiCheckCircleBold, PiXCircleBold, PiEyeBold } from 'react-icons/pi';
import Link from 'next/link';
import type { SalesDocument, PaginatedResponse, DocumentStatus } from '@/types';

const decorationSales: SalesDocument[] = [
  { id: 1, tenant: 1, number: 'SL-2024-0001', date: '2024-01-20', status: 'posted', is_posted: true, comment: '', counterparty: 1, contract: 1, warehouse: 1, currency: 1, exchange_rate: 1, base_currency_rate: 1, subtotal: 1500, tax_amount: 150, total: 1650, lines: [], created_by: 1, posted_by: 1, posted_at: '2024-01-20', created_at: '2024-01-20', updated_at: '2024-01-20' },
  { id: 2, tenant: 1, number: 'SL-2024-0002', date: '2024-01-21', status: 'draft', is_posted: false, comment: 'Pending approval', counterparty: 2, contract: null, warehouse: 1, currency: 1, exchange_rate: 1, base_currency_rate: 1, subtotal: 2400, tax_amount: 240, total: 2640, lines: [], created_by: 1, posted_by: null, posted_at: null, created_at: '2024-01-21', updated_at: '2024-01-21' },
  { id: 3, tenant: 1, number: 'SL-2024-0003', date: '2024-01-22', status: 'posted', is_posted: true, comment: '', counterparty: 3, contract: 2, warehouse: 2, currency: 2, exchange_rate: 0.92, base_currency_rate: 1.09, subtotal: 850, tax_amount: 85, total: 935, lines: [], created_by: 1, posted_by: 1, posted_at: '2024-01-22', created_at: '2024-01-22', updated_at: '2024-01-22' },
  { id: 4, tenant: 1, number: 'SL-2024-0004', date: '2024-01-23', status: 'cancelled', is_posted: false, comment: 'Cancelled by customer', counterparty: 1, contract: 1, warehouse: 1, currency: 1, exchange_rate: 1, base_currency_rate: 1, subtotal: 500, tax_amount: 50, total: 550, lines: [], created_by: 1, posted_by: null, posted_at: null, created_at: '2024-01-23', updated_at: '2024-01-23' },
];

const statusColors: Record<DocumentStatus, string> = {
  draft: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  posted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
};

// 1C-Style Sales Document List
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';
import { useRouter } from 'next/navigation';

export default function SalesDocumentsPage() {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SalesDocument | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [sorting, setSorting] = useState<any>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sales-documents'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<SalesDocument>>('/documents/sales/');
        return response.results;
      } catch { return decorationSales; }
    },
  });

  const postMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/sales/${id}/post/`),
    onSuccess: () => {
      toast.success('Document posted successfully');
      queryClient.invalidateQueries({ queryKey: ['sales-documents'] });
    },
    onError: () => toast.error('Failed to post document'),
  });

  const unpostMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/sales/${id}/unpost/`),
    onSuccess: () => {
      toast.success('Document unposted');
      queryClient.invalidateQueries({ queryKey: ['sales-documents'] });
    },
    onError: () => toast.error('Failed to unpost document'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/documents/sales/${id}/`),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['sales-documents'] });
      setIsDeleteOpen(false);
      setSelectedItem(null);
    },
    onError: () => toast.error('Failed to delete document'),
  });

  // Actions
  const handleCreate = () => router.push('/documents/sales/new');
  const handleEdit = (doc: SalesDocument) => router.push(`/documents/sales/${doc.id}/edit`);
  const handleView = (doc: SalesDocument) => router.push(`/documents/sales/${doc.id}`);

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
    return data.reduce((sum, doc) => sum + Number(doc.total || 0), 0);
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

  const columns: ColumnDef<SalesDocument>[] = [
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4 h-8 text-xs">
          {tc('date')} <PiArrowsDownUpBold className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        // 1C Format: DD.MM.YYYY HH:mm
        const d = new Date(row.getValue('date'));
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const time = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        return <span className="font-mono text-xs">{day}.{month}.{year} {time}</span>
      },
      footer: () => <span className="text-muted-foreground">{tc('total')}:</span>,
    },
    {
      accessorKey: 'number',
      header: tc('number'),
      cell: ({ row }) => (
        <ReferenceLink
          id={row.original.id}
          type="sales-document"
          label={row.getValue('number')}
          className="font-mono text-primary font-bold"
        />
      ),
    },
    {
      accessorKey: 'counterparty',
      header: tf('counterparty'),
      cell: ({ row }) => {
        const val = row.getValue('counterparty');
        return <LinkableCell id={val as number} type="counterparty" label={`Customer #${val}`} />;
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
      accessorKey: 'total',
      header: tc('total'),
      cell: ({ row }) => {
        const total = parseFloat(row.getValue('total'));
        return <span className="font-mono font-bold">${total.toFixed(2)}</span>;
      },
      footer: () => <span className="font-mono text-primary">${totalSum.toFixed(2)}</span>,
    },
    {
      accessorKey: 'status',
      header: tc('status'),
      cell: ({ row }) => {
        const status = row.getValue('status') as DocumentStatus;
        // Use new Badge component with 1C-style variants
        const variantMap: Record<DocumentStatus, any> = {
          posted: 'posted',
          draft: 'draft',
          cancelled: 'deleted'
        };
        return (
          <Badge variant={variantMap[status]}>
            {status === 'posted' && 'вњ“ '}{t(status)}
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
                tableName="sales_documents"
              />
              <SavedViews
                tableName="sales_documents"
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
                tableName="sales_documents"
              />
              <HelpPanel context="sales-list" />
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

