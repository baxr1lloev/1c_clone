'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  PiArrowsDownUpBold,
  PiCheckCircleBold,
  PiPencilBold,
  PiPlusBold,
  PiTrashBold,
  PiXCircleBold,
} from 'react-icons/pi';

import api from '@/lib/api';
import type { PaginatedResponse, PaymentDocument } from '@/types';
import { DataTable } from '@/components/data-table/data-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { LinkableCell } from '@/components/ui/linkable-cell';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CommandBar, type CommandBarAction } from '@/components/ui/command-bar';

const DEFAULT_DEPARTMENT_LABEL = 'Оптовая торговля (общая)';
const DEFAULT_CREATOR_LABEL = 'Admin';

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function PaymentsPage() {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const localePath = (path: string) =>
    `/${locale}${path.startsWith('/') ? path : `/${path}`}`;

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PaymentDocument | null>(null);
  const [searchValue, setSearchValue] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      try {
        const response =
          await api.get<PaginatedResponse<PaymentDocument>>('/documents/payments/');
        return response.results;
      } catch {
        return [];
      }
    },
  });

  const postMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/payments/${id}/post/`),
    onSuccess: () => {
      toast.success('Документ проведен');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: () => toast.error('Не удалось провести документ'),
  });

  const unpostMutation = useMutation({
    mutationFn: async (id: number) => api.post(`/documents/payments/${id}/unpost/`),
    onSuccess: () => {
      toast.success('Проведение отменено');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: () => toast.error('Не удалось отменить проведение'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/documents/payments/${id}/`),
    onSuccess: () => {
      toast.success('Документ удален');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setIsDeleteOpen(false);
      setSelectedItem(null);
    },
    onError: () => toast.error('Не удалось удалить документ'),
  });

  const handleCreate = () => {
    router.push(localePath('/documents/payments/new'));
  };

  const handleEdit = (doc: PaymentDocument) => {
    router.push(localePath(`/documents/payments/${doc.id}`));
  };

  const totalSum = useMemo(() => {
    if (!data) return 0;
    return data.reduce((sum, doc) => sum + Number(doc.amount || 0), 0);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data) return [];

    if (!searchValue.trim()) {
      return data;
    }

    const term = searchValue.toLowerCase();
    return data.filter((doc) =>
      (doc.number || '').toLowerCase().includes(term) ||
      String(doc.id).includes(term) ||
      (doc.counterparty_name || '').toLowerCase().includes(term) ||
      (doc.bank_account_name || '').toLowerCase().includes(term) ||
      (doc.currency_code || '').toLowerCase().includes(term) ||
      (doc.purpose || '').toLowerCase().includes(term)
    );
  }, [data, searchValue]);

  const mainActions: CommandBarAction[] = [
    {
      label: tc('create'),
      icon: <PiPlusBold />,
      onClick: handleCreate,
      variant: 'default',
      shortcut: 'Ins',
    },
  ];

  const selectionActions: CommandBarAction[] = selectedItem
    ? [
      {
        label: tc('edit'),
        icon: <PiPencilBold />,
        onClick: () => handleEdit(selectedItem),
        shortcut: 'F2',
      },
      {
        label: t('post'),
        icon: <PiCheckCircleBold />,
        onClick: () => postMutation.mutate(selectedItem.id),
        disabled: selectedItem.status === 'posted',
        variant: 'ghost',
      },
      {
        label: t('unpost'),
        icon: <PiXCircleBold />,
        onClick: () => unpostMutation.mutate(selectedItem.id),
        disabled: selectedItem.status !== 'posted',
        variant: 'ghost',
      },
      {
        label: tc('delete'),
        icon: <PiTrashBold />,
        onClick: () => setIsDeleteOpen(true),
        variant: 'destructive',
        shortcut: 'Del',
      },
    ]
    : [];

  const columns: ColumnDef<PaymentDocument>[] = [
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4 h-8 text-xs"
        >
          {tc('date')}
          <PiArrowsDownUpBold className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {formatDateTime(row.original.date)}
        </span>
      ),
      footer: () => <span className="text-muted-foreground">{tc('total')}:</span>,
    },
    {
      accessorKey: 'number',
      header: tc('number'),
      cell: ({ row }) => (
        <ReferenceLink
          id={row.original.id}
          type="payment-document"
          label={row.original.number || String(row.original.id)}
          className="font-mono font-semibold text-primary"
        />
      ),
    },
    {
      accessorKey: 'bank_account_name',
      header: 'Касса',
      cell: ({ row }) => <span>{row.original.bank_account_name || '-'}</span>,
    },
    {
      accessorKey: 'counterparty',
      header: 'Контрагент',
      cell: ({ row }) => {
        const id = row.original.counterparty;
        const name = row.original.counterparty_name || (id ? `CP #${id}` : '-');

        if (!id) return <span>{name}</span>;
        return <LinkableCell id={id} type="counterparty" label={name} />;
      },
    },
    {
      accessorKey: 'currency_code',
      header: 'Валюта',
      cell: ({ row }) => (
        <span className="font-mono">{row.original.currency_code || 'USD'}</span>
      ),
    },
    {
      accessorKey: 'amount',
      header: tc('amount'),
      cell: ({ row }) => (
        <span className="font-mono">{Number(row.original.amount || 0).toFixed(2)}</span>
      ),
      footer: () => (
        <span className="font-mono text-primary">{totalSum.toFixed(2)}</span>
      ),
    },
    {
      accessorKey: 'purpose',
      header: 'Примечание',
      cell: ({ row }) => (
        <span className="block max-w-[220px] truncate text-xs text-muted-foreground">
          {row.original.purpose || '-'}
        </span>
      ),
    },
    {
      id: 'creator',
      header: 'Создатель',
      cell: () => <span>{DEFAULT_CREATOR_LABEL}</span>,
    },
    {
      id: 'department',
      header: 'Подразделение',
      cell: () => <span>{DEFAULT_DEPARTMENT_LABEL}</span>,
    },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-card">
      <div className="border-b border-[#cecece] bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[#1d1d1d]">
            Безналичные операции
          </h1>
          <span className="text-xs text-muted-foreground">Рабочий стол</span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        onRowClick={setSelectedItem}
        onRowDoubleClick={(row) => handleEdit(row)}
        commandBar={(
          <CommandBar
            mainActions={mainActions}
            selectionActions={selectionActions}
            onRefresh={() => refetch()}
            onSearch={setSearchValue}
            searchValue={searchValue}
            searchPlaceholder="Поиск (Ctrl+F)"
          />
        )}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить {selectedItem?.number || 'документ'}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? 'Удаление...' : tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
