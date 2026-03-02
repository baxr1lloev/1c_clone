'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  PiArrowsClockwiseBold,
  PiCaretLeftBold,
  PiCaretRightBold,
  PiEyeBold,
  PiMagnifyingGlassBold,
  PiPlusBold,
  PiPrinterBold,
} from 'react-icons/pi';
import { toast } from 'sonner';

import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { DocumentStatus, PaginatedResponse } from '@/types';

interface PurchaseListItem {
  id: number;
  number: string;
  date: string;
  status: DocumentStatus;
  status_display?: string;
  counterparty?: number | null;
  counterparty_name?: string;
  warehouse?: number | null;
  warehouse_name?: string;
  currency?: number | null;
  currency_code?: string;
  total_amount: number | string;
  total_amount_base?: number | string;
  posted_at?: string | null;
  comment?: string;
}

const fallbackPurchases: PurchaseListItem[] = [
  {
    id: 1,
    number: '450',
    date: '2026-01-02T12:00:00',
    status: 'posted',
    status_display: 'Проведен',
    counterparty: 1,
    counterparty_name: 'ООО LesTexSnab Plus',
    warehouse: 1,
    warehouse_name: 'BOZOR 6 QATOR',
    currency: 1,
    currency_code: 'USD',
    total_amount: 14763.48,
  },
  {
    id: 2,
    number: '451',
    date: '2026-01-05T12:00:00',
    status: 'draft',
    status_display: 'Черновик',
    counterparty: 2,
    counterparty_name: 'ООО PKP Almis',
    warehouse: 2,
    warehouse_name: 'TAMOJNI SKLAD',
    currency: 2,
    currency_code: 'RUB',
    total_amount: 14067.95,
  },
  {
    id: 3,
    number: '453',
    date: '2026-01-10T12:00:00',
    status: 'posted',
    status_display: 'Проведен',
    counterparty: 3,
    counterparty_name: 'BelKitforest',
    warehouse: 3,
    warehouse_name: 'Belarus Bor Sheriki 5 kas',
    currency: 1,
    currency_code: 'USD',
    total_amount: 24904.45,
  },
];

function normalizePurchaseListResponse(
  payload: PaginatedResponse<PurchaseListItem> | PurchaseListItem[] | undefined,
): PurchaseListItem[] {
  const rows = Array.isArray(payload) ? payload : payload?.results || [];

  return rows
    .map((row) => ({
      id: Number(row.id),
      number: String(row.number || ''),
      date: String(row.date || ''),
      status: (row.status || 'draft') as DocumentStatus,
      status_display: row.status_display,
      counterparty:
        row.counterparty === null || row.counterparty === undefined
          ? null
          : Number(row.counterparty),
      counterparty_name: row.counterparty_name || 'Без контрагента',
      warehouse:
        row.warehouse === null || row.warehouse === undefined
          ? null
          : Number(row.warehouse),
      warehouse_name: row.warehouse_name || 'Без склада',
      currency:
        row.currency === null || row.currency === undefined ? null : Number(row.currency),
      currency_code: row.currency_code || '-',
      total_amount: Number(row.total_amount || 0),
      total_amount_base: Number(row.total_amount_base || 0),
      posted_at: row.posted_at || null,
      comment: row.comment || '',
    }))
    .filter((row) => Number.isFinite(row.id));
}

function formatDateTime(value: string): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(value: number | string): string {
  const numericValue = Number(value || 0);
  return numericValue.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getStatusLabel(status: DocumentStatus, statusDisplay?: string): string {
  if (statusDisplay) {
    return statusDisplay;
  }

  if (status === 'posted') return 'Проведен';
  if (status === 'cancelled') return 'Отменен';
  return 'Черновик';
}

export default function PurchasesPage() {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<'stock' | 'settlements'>('stock');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<PurchaseListItem> | PurchaseListItem[]>(
        '/documents/purchases/',
      );
      return normalizePurchaseListResponse(response);
    },
    retry: false,
  });

  const filteredRows = useMemo(() => {
    const rows = data || [];
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((row) => {
      const searchable = [
        row.number,
        row.counterparty_name,
        row.warehouse_name,
        row.currency_code,
        row.comment,
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [data, searchValue]);

  const openSelectedReport = () => {
    setIsReportsOpen(false);
    router.push(
      selectedReport === 'stock'
        ? '/reports/stock-as-of-date'
        : '/reports/settlements-as-of-date',
    );
  };

  const effectiveSelectedId = useMemo(() => {
    if (filteredRows.length === 0) {
      return null;
    }

    return filteredRows.some((row) => row.id === selectedId)
      ? selectedId
      : filteredRows[0].id;
  }, [filteredRows, selectedId]);

  const selectedRow = useMemo(
    () => filteredRows.find((row) => row.id === effectiveSelectedId) || null,
    [effectiveSelectedId, filteredRows],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = Boolean(
        target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName),
      );

      if (event.key === 'Enter' && !isEditable && selectedRow) {
        event.preventDefault();
        router.push(`/documents/purchases/${selectedRow.id}`);
        return;
      }

      if (isEditable || filteredRows.length === 0) {
        return;
      }

      const currentIndex = filteredRows.findIndex((row) => row.id === effectiveSelectedId);

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex =
          currentIndex < 0 ? 0 : Math.min(currentIndex + 1, filteredRows.length - 1);
        setSelectedId(filteredRows[nextIndex].id);
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        setSelectedId(filteredRows[nextIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectiveSelectedId, filteredRows, router, selectedRow]);

  const handleOpenSelected = () => {
    if (!selectedRow) {
      return;
    }

    router.push(`/documents/purchases/${selectedRow.id}`);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#efefef] text-[#2f2f2f]">
      <div className="border-b border-[#cfcfcf] bg-[#f7f7f7] px-3 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon-sm" disabled>
              <PiCaretLeftBold className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon-sm" disabled>
              <PiCaretRightBold className="h-4 w-4" />
            </Button>
            <h1 className="ml-2 text-lg font-semibold">Поступление номенклатуры</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7f7f7f]" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                className="h-8 w-[240px] border-[#cfcfcf] bg-background pl-8 text-sm"
                placeholder="Поиск (Ctrl+F)"
              />
            </div>
            <Button type="button" variant="outline" size="icon-sm" onClick={() => refetch()}>
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-8 bg-background" onClick={() => router.push('/documents/purchases/new')}>
            <PiPlusBold className="h-4 w-4" />
            Создать
          </Button>
          <Button type="button" variant="outline" className="h-8 bg-background" onClick={() => setIsReportsOpen(true)}>
            РћС‚С‡РµС‚С‹
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 bg-background"
            onClick={handleOpenSelected}
            disabled={!selectedRow}
          >
            <PiEyeBold className="h-4 w-4" />
            Открыть
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 bg-background"
            onClick={() => toast.info('Печать будет открываться из карточки документа.')}
          >
            <PiPrinterBold className="h-4 w-4" />
            Печать
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="shrink-0 text-[#666]">Ссылка:</span>
          <button
            type="button"
            className="flex h-8 min-w-0 flex-1 items-center rounded border border-[#cfcfcf] bg-background px-2 text-left hover:border-[#b9b9b9]"
            onClick={handleOpenSelected}
            disabled={!selectedRow}
          >
            <span className="truncate">
              {selectedRow
                ? `Поступление номенклатуры ${selectedRow.number} от ${formatDateTime(selectedRow.date)}`
                : 'Выберите документ'}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-3">
        <div className="flex h-full flex-col overflow-hidden rounded border border-[#cfcfcf] bg-background">
          <div className="grid grid-cols-[40px_180px_100px_minmax(220px,1fr)_220px_90px_140px] border-b border-[#cfcfcf] bg-[#f3f3f3] text-xs font-medium text-[#575757]">
            <div className="px-2 py-2"> </div>
            <div className="border-l border-[#d8d8d8] px-2 py-2">Дата</div>
            <div className="border-l border-[#d8d8d8] px-2 py-2">Номер</div>
            <div className="border-l border-[#d8d8d8] px-2 py-2">Контрагент</div>
            <div className="border-l border-[#d8d8d8] px-2 py-2">Склад</div>
            <div className="border-l border-[#d8d8d8] px-2 py-2">Валюта</div>
            <div className="border-l border-[#d8d8d8] px-2 py-2 text-right">Сумма</div>
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-6 text-sm text-[#6f6f6f]">Загрузка списка документов...</div>
            ) : isError ? (
              <div className="p-6 text-sm text-[#8a5a5a]">
                Не удалось загрузить список документов. Проверьте вход в систему и попробуйте
                обновить список.
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-6 text-sm text-[#6f6f6f]">
                Документы пока не созданы. Используйте кнопку &quot;Создать&quot;, чтобы
                оформить первое поступление.
                {fallbackPurchases.length > 0
                  ? ' Демо-строки отключены, чтобы не открывать несуществующие документы.'
                  : ''}
              </div>
            ) : (
              filteredRows.map((row) => {
                const isSelected = row.id === effectiveSelectedId;

                return (
                  <button
                    key={row.id}
                    type="button"
                    className={cn(
                      'grid w-full grid-cols-[40px_180px_100px_minmax(220px,1fr)_220px_90px_140px] border-b border-border text-left text-sm',
                      'hover:bg-muted',
                      isSelected && 'bg-accent',
                    )}
                    onClick={() => setSelectedId(row.id)}
                    onDoubleClick={() => router.push(`/documents/purchases/${row.id}`)}
                  >
                    <div className="flex items-center justify-center px-2 py-2 text-[#5f9f5f]">
                      {row.status === 'posted' ? '▣' : '▢'}
                    </div>
                    <div className="truncate border-l border-[#f2f2f2] px-2 py-2 font-mono">
                      {formatDateTime(row.date)}
                    </div>
                    <div className="truncate border-l border-[#f2f2f2] px-2 py-2 font-mono">
                      {row.number}
                    </div>
                    <div className="truncate border-l border-[#f2f2f2] px-2 py-2">
                      {row.counterparty_name}
                    </div>
                    <div className="truncate border-l border-[#f2f2f2] px-2 py-2">
                      {row.warehouse_name}
                    </div>
                    <div className="truncate border-l border-[#f2f2f2] px-2 py-2 font-mono">
                      {row.currency_code || '-'}
                    </div>
                    <div className="border-l border-[#f2f2f2] px-2 py-2 text-right font-mono">
                      {formatAmount(row.total_amount)}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#cfcfcf] bg-[#f7f7f7] px-3 py-2 text-xs text-[#676767]">
            <span>
              Записей: {filteredRows.length}
              {selectedRow ? ` | Выбрано: ${selectedRow.number} (${getStatusLabel(selectedRow.status, selectedRow.status_display)})` : ''}
            </span>
            <span>Двойной клик или Enter открывает документ</span>
          </div>
        </div>
      </div>

      <Dialog open={isReportsOpen} onOpenChange={setIsReportsOpen}>
        <DialogContent className="sm:max-w-md border border-[#c9c9c9] bg-[#efefef] p-0">
          <DialogHeader>
            <DialogTitle className="border-b border-[#d2d2d2] px-4 py-3 text-left text-[18px] font-medium text-black">
              Отчеты
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 py-4">
            <div className="space-y-1">
            <button
              type="button"
              className={`block w-full px-3 py-2 text-left text-[16px] ${
                selectedReport === 'stock'
                  ? 'bg-background outline outline-1 outline-[#3a3a3a] outline-dotted'
                  : 'hover:bg-muted'
              }`}
              onClick={() => setSelectedReport('stock')}
              onDoubleClick={() => {
                setSelectedReport('stock');
                setIsReportsOpen(false);
                router.push('/reports/stock-as-of-date');
              }}
            >
              Материальный отчет
            </button>
            <button
              type="button"
              className={`block w-full px-3 py-2 text-left text-[16px] ${
                selectedReport === 'settlements'
                  ? 'bg-background outline outline-1 outline-[#3a3a3a] outline-dotted'
                  : 'hover:bg-muted'
              }`}
              onClick={() => setSelectedReport('settlements')}
              onDoubleClick={() => {
                setSelectedReport('settlements');
                setIsReportsOpen(false);
                router.push('/reports/settlements-as-of-date');
              }}
            >
              Отчет по поставщикам
            </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="h-9 rounded-sm border border-[#bcbcbc] bg-background px-4 text-sm text-black hover:bg-[#f3f3f3]"
                onClick={() => setIsReportsOpen(false)}
              >
                Закрыть
              </button>
              <button
                type="button"
                className="h-9 rounded-sm border border-[#9b8e00] bg-[#f4d000] px-4 text-sm text-black hover:bg-[#ffe04d]"
                onClick={openSelectedReport}
              >
                Открыть
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
