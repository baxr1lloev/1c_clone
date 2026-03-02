'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PaginatedResponse, SalesDocument, Warehouse } from '@/types';

type WarehouseListResponse = PaginatedResponse<Warehouse> | Warehouse[];

interface SalesDocumentListItem {
  id: number;
}

type SalesDocumentListResponse = PaginatedResponse<SalesDocumentListItem> | SalesDocumentListItem[];

type ReportMode = 'solid' | 'by-types' | 'by-groups' | 'by-days' | 'by-cars';

interface SalesChildRow {
  rowKey: string;
  documentId: number;
  label: string;
  quantity: number;
  cost: number;
  sale: number;
  profit: number;
}

interface SalesGroupRow {
  rowKey: string;
  itemId: number;
  itemName: string;
  unit: string;
  quantity: number;
  cost: number;
  sale: number;
  profit: number;
  children: SalesChildRow[];
}

const buttonClassName =
  'h-9 rounded-sm border border-border bg-background px-4 text-sm text-foreground hover:bg-muted';

function formatAmount(value: number): string {
  if (!value) return '';
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value: number): string {
  if (!value) return '';
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '';

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
    second: '2-digit',
  });
}

async function fetchAllSalesDocuments(): Promise<SalesDocument[]> {
  const listItems: SalesDocumentListItem[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext && page <= 100) {
    const response = await api.get<SalesDocumentListResponse>(`/documents/sales/?page=${page}`);

    if (Array.isArray(response)) {
      listItems.push(...response);
      break;
    }

    listItems.push(...response.results);
    hasNext = Boolean(response.next);
    page += 1;
  }

  const detailed = await Promise.all(
    listItems.map(async (item) => {
      try {
        return await api.get<SalesDocument>(`/documents/sales/${item.id}/`);
      } catch {
        return null;
      }
    }),
  );

  return detailed.filter((item): item is SalesDocument => Boolean(item));
}

export default function SalesReportPage() {
  const router = useRouter();
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('2026-03-01');
  const [dateTo, setDateTo] = useState('2026-03-01');
  const [warehouseId, setWarehouseId] = useState('');
  const [reportMode, setReportMode] = useState<ReportMode>('solid');

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-sales-report'],
    queryFn: async () => {
      const response = await api.get<WarehouseListResponse>('/directories/warehouses/');
      return Array.isArray(response) ? response : response.results;
    },
  });

  const { data: documents = [], isLoading, refetch } = useQuery({
    queryKey: ['sales-report-documents'],
    queryFn: fetchAllSalesDocuments,
  });

  const groups = useMemo<SalesGroupRow[]>(() => {
    const grouped = new Map<string, SalesGroupRow>();

    const filteredDocuments = documents
      .filter((document) => {
        const docDate = document.date?.slice(0, 10) ?? '';
        if (dateFrom && docDate < dateFrom) return false;
        if (dateTo && docDate > dateTo) return false;
        if (warehouseId && String(document.warehouse ?? '') !== warehouseId) return false;
        return true;
      })
      .sort((left, right) => String(right.date).localeCompare(String(left.date)));

    for (const document of filteredDocuments) {
      for (const line of document.lines || []) {
        const itemId = line.item;
        const itemName = line.item_detail?.name || `Товар #${itemId}`;
        const unit = line.item_detail?.unit || line.item_detail?.base_unit || 'шт';
        const groupKey =
          reportMode === 'by-days'
            ? `${document.date?.slice(0, 10) ?? 'day'}-${itemId}`
            : String(itemId);
        const groupName =
          reportMode === 'by-days'
            ? `${(document.date?.slice(0, 10) ?? '').split('-').reverse().join('.')} • ${itemName}`
            : itemName;

        const cost = Number(line.amount_base ?? line.amount ?? 0);
        const sale = Number(line.amount ?? 0);
        const profit = sale - cost;

        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, {
            rowKey: groupKey,
            itemId,
            itemName: groupName,
            unit,
            quantity: 0,
            cost: 0,
            sale: 0,
            profit: 0,
            children: [],
          });
        }

        const group = grouped.get(groupKey)!;
        group.quantity += Number(line.quantity || 0);
        group.cost += cost;
        group.sale += sale;
        group.profit += profit;
        group.children.push({
          rowKey: `sale-${document.id}-${line.id}`,
          documentId: document.id,
          label: `Продажа ${document.number ?? document.id} от ${formatDateTime(document.date)}`,
          quantity: Number(line.quantity || 0),
          cost,
          sale,
          profit,
        });
      }
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        children: group.children.sort((left, right) => right.label.localeCompare(left.label)),
      }))
      .sort((left, right) => right.sale - left.sale);
  }, [documents, dateFrom, dateTo, warehouseId, reportMode]);

  const totals = useMemo(
    () =>
      groups.reduce(
        (acc, group) => ({
          quantity: acc.quantity + group.quantity,
          cost: acc.cost + group.cost,
          sale: acc.sale + group.sale,
          profit: acc.profit + group.profit,
        }),
        { quantity: 0, cost: 0, sale: 0, profit: 0 },
      ),
    [groups],
  );

  const toggleExpanded = (groupKey: string) => {
    setExpandedGroupKeys((current) =>
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey],
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-1 py-1 text-foreground">
      <div className="mx-auto h-[calc(100vh-4.6rem)] w-full overflow-hidden border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" className="h-7 w-7 border border-border bg-background text-sm">←</button>
              <button type="button" className="h-7 w-7 border border-border bg-background text-sm">→</button>
            </div>
            <span className="text-2xl leading-none text-muted-foreground">☆</span>
            <h1 className="text-[18px] font-medium text-foreground">Отчет по продажам</h1>
          </div>
          <div className="flex items-center gap-3 text-lg text-muted-foreground">
            <span>💾</span>
            <span>🖨</span>
            <span>🔍</span>
            <span>🔗</span>
            <span>⋮</span>
          </div>
        </div>

        <div className="space-y-3 border-b border-[#d7d7d7] px-2 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" className={buttonClassName} onClick={() => refetch()}>
              Сформировать
            </Button>
            <span className="text-sm">Период с:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9 w-[150px] rounded-none border border-border bg-background shadow-none focus-visible:ring-0"
            />
            <span className="text-sm">по:</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9 w-[150px] rounded-none border border-border bg-background shadow-none focus-visible:ring-0"
            />
            <span className="text-sm">Склад:</span>
            <select
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              className="h-9 w-[320px] rounded-none border border-border bg-background px-2 text-sm"
            >
              <option value=""> </option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={String(warehouse.id)}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-0">
            <span className="mr-2 text-sm">Вид отчета:</span>
            {[
              { id: 'solid' as const, label: 'Сплошная' },
              { id: 'by-types' as const, label: 'По видам товара' },
              { id: 'by-groups' as const, label: 'По группам' },
              { id: 'by-days' as const, label: 'По дням' },
              { id: 'by-cars' as const, label: 'По номер машинам' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setReportMode(option.id)}
                className={`h-9 border px-3 text-sm ${
                  reportMode === option.id
                    ? 'border-[#76b46f] bg-emerald-50 dark:bg-emerald-950 text-[#198f38]'
                    : 'border-border bg-background'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[calc(100%-118px)] overflow-auto px-2 py-3">
          <div className="mb-2 text-center text-[15px] text-foreground">ООО &quot;XUSHNUR SHOHNUR OMAD OPTOVIY BAZA&quot;</div>
          <div className="mb-4 text-center text-[15px] font-semibold text-foreground">
            Отчет по продажам за {dateFrom.split('-').reverse().join('.')} - {dateTo.split('-').reverse().join('.')}
          </div>

          <table className="min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="w-10 border border-[#bdbdbd] px-2 py-2" />
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Товар</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Ед.изм</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Количество</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Сумма учетная</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Сумма продажная</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Прибыль</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="border border-[#bdbdbd] px-3 py-8 text-center">
                    Загрузка...
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-[#bdbdbd] px-3 py-8 text-center">
                    Нет данных за выбранный период
                  </td>
                </tr>
              ) : (
                groups.map((group) => {
                  const isExpanded = expandedGroupKeys.includes(group.rowKey);
                  const isGroupSelected = selectedRowKey === group.rowKey;
                  const groupSelectedClassName = isGroupSelected ? 'bg-accent' : '';

                  return (
                    <Fragment key={group.rowKey}>
                      <tr
                        className="bg-background hover:bg-muted/50 hover:bg-muted/80"
                        onClick={() => setSelectedRowKey(group.rowKey)}
                      >
                        <td className={`border border-[#bdbdbd] px-2 py-1 text-center ${groupSelectedClassName}`}>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleExpanded(group.rowKey);
                            }}
                            className="inline-flex h-5 w-5 items-center justify-center border border-border bg-background text-[12px] leading-none"
                          >
                            {isExpanded ? '−' : '+'}
                          </button>
                        </td>
                        <td className={`border border-[#bdbdbd] px-3 py-1 ${groupSelectedClassName}`}>
                          {group.itemName}
                        </td>
                        <td className={`border border-[#bdbdbd] px-3 py-1 ${groupSelectedClassName}`}>
                          {group.unit}
                        </td>
                        <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${groupSelectedClassName}`}>
                          {formatQuantity(group.quantity)}
                        </td>
                        <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${groupSelectedClassName}`}>
                          {formatAmount(group.cost)}
                        </td>
                        <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${groupSelectedClassName}`}>
                          {formatAmount(group.sale)}
                        </td>
                        <td
                          className={`border border-[#bdbdbd] px-3 py-1 text-right ${
                            group.profit < 0 ? 'text-[#c40000]' : ''
                          } ${groupSelectedClassName}`}
                        >
                          {formatAmount(group.profit)}
                        </td>
                      </tr>

                      {isExpanded
                        ? group.children.map((child) => {
                            const isChildSelected = selectedRowKey === child.rowKey;
                            const childSelectedClassName = isChildSelected ? 'bg-accent' : '';

                            return (
                              <tr
                                key={child.rowKey}
                                className="bg-background hover:bg-muted/50 hover:bg-muted/80"
                                onClick={() => setSelectedRowKey(child.rowKey)}
                                onDoubleClick={() => router.push(`/documents/sales/${child.documentId}`)}
                              >
                                <td className={`border border-[#bdbdbd] px-2 py-1 ${childSelectedClassName}`} />
                                <td className={`border border-[#bdbdbd] px-3 py-1 text-[#204db4] ${childSelectedClassName}`}>
                                  {child.label}
                                </td>
                                <td className={`border border-[#bdbdbd] px-3 py-1 ${childSelectedClassName}`} />
                                <td className={`border border-[#bdbdbd] px-3 py-1 text-right text-[#204db4] ${childSelectedClassName}`}>
                                  {formatQuantity(child.quantity)}
                                </td>
                                <td className={`border border-[#bdbdbd] px-3 py-1 text-right text-[#204db4] ${childSelectedClassName}`}>
                                  {formatAmount(child.cost)}
                                </td>
                                <td className={`border border-[#bdbdbd] px-3 py-1 text-right text-[#204db4] ${childSelectedClassName}`}>
                                  {formatAmount(child.sale)}
                                </td>
                                <td
                                  className={`border border-[#bdbdbd] px-3 py-1 text-right ${
                                    child.profit < 0 ? 'text-[#c40000]' : 'text-[#204db4]'
                                  } ${childSelectedClassName}`}
                                >
                                  {formatAmount(child.profit)}
                                </td>
                              </tr>
                            );
                          })
                        : null}
                    </Fragment>
                  );
                })
              )}

              {groups.length > 0 ? (
                <tr className="bg-[#ecf6f7]">
                  <td className="border border-[#bdbdbd] px-2 py-2" />
                  <td className="border border-[#bdbdbd] px-3 py-2 font-semibold">Итог</td>
                  <td className="border border-[#bdbdbd] px-3 py-2" />
                  <td className="border border-[#bdbdbd] px-3 py-2 text-right font-semibold">{formatQuantity(totals.quantity)}</td>
                  <td className="border border-[#bdbdbd] px-3 py-2 text-right font-semibold">{formatAmount(totals.cost)}</td>
                  <td className="border border-[#bdbdbd] px-3 py-2 text-right font-semibold">{formatAmount(totals.sale)}</td>
                  <td className="border border-[#bdbdbd] px-3 py-2 text-right font-semibold">{formatAmount(totals.profit)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
