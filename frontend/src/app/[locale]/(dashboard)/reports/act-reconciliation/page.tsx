'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CashOrder, Counterparty, PaginatedResponse } from '@/types';

type CashOrderListResponse = PaginatedResponse<CashOrder> | CashOrder[];
type CounterpartyListResponse = PaginatedResponse<Counterparty> | Counterparty[];
type PartyFilter = 'all' | 'customers' | 'suppliers' | 'founders';

interface ReconciliationRow {
  kind: 'opening' | 'document' | 'turnover' | 'closing';
  id: string;
  documentId?: number;
  label: string;
  date: string;
  debit: number;
  credit: number;
  note: string;
}

const buttonClassName =
  'h-9 rounded-sm border border-[#bcbcbc] bg-white px-4 text-sm text-black hover:bg-[#f3f3f3]';

function formatDate(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 10).split('-').reverse().join('.');
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

function formatAmount(value: number): string {
  if (!value) return '';
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function fetchAllCashOrders(): Promise<CashOrder[]> {
  const result: CashOrder[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext && page <= 100) {
    const response = await api.get<CashOrderListResponse>(`/documents/cash-orders/?page=${page}`);

    if (Array.isArray(response)) {
      result.push(...response);
      break;
    }

    result.push(...response.results);
    hasNext = Boolean(response.next);
    page += 1;
  }

  return result;
}

export default function ActReconciliationPage() {
  const router = useRouter();
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [counterpartyId, setCounterpartyId] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-02-26');
  const [dateTo, setDateTo] = useState('2026-03-01');
  const [partyFilter, setPartyFilter] = useState<PartyFilter>('all');

  const { data: cashOrders = [], isLoading } = useQuery({
    queryKey: ['cash-orders-reconciliation'],
    queryFn: fetchAllCashOrders,
  });

  const { data: counterparties = [] } = useQuery({
    queryKey: ['counterparties-reconciliation'],
    queryFn: async () => {
      const response = await api.get<CounterpartyListResponse>('/directories/counterparties/');
      return Array.isArray(response) ? response : response.results;
    },
  });

  const filteredDocuments = useMemo(() => {
    const counterpartyMap = new Map(counterparties.map((item) => [item.id, item]));

    return cashOrders
      .filter((doc) => doc.order_type === 'incoming')
      .filter((doc) => (counterpartyId ? String(doc.counterparty ?? '') === counterpartyId : true))
      .filter((doc) => {
        if (!dateFrom && !dateTo) return true;
        const docDate = doc.date?.slice(0, 10) ?? '';
        if (dateFrom && docDate < dateFrom) return false;
        if (dateTo && docDate > dateTo) return false;
        return true;
      })
      .filter((doc) => {
        if (partyFilter === 'all') return true;
        const counterparty = counterpartyMap.get(doc.counterparty ?? 0);

        if (partyFilter === 'customers') return counterparty?.type === 'customer';
        if (partyFilter === 'suppliers') return counterparty?.type === 'supplier';
        return counterparty?.type === 'agent' || !counterparty?.type;
      })
      .sort((left, right) => String(right.date).localeCompare(String(left.date)));
  }, [cashOrders, counterparties, counterpartyId, dateFrom, dateTo, partyFilter]);

  const rows = useMemo<ReconciliationRow[]>(() => {
    const totalCredit = filteredDocuments.reduce((sum, doc) => sum + Number(doc.amount || 0), 0);

    return [
      {
        kind: 'opening',
        id: 'opening',
        label: `Сальдо на ${formatDate(dateFrom)}`,
        date: '',
        debit: 0,
        credit: 0,
        note: '',
      },
      ...filteredDocuments.map((doc) => ({
        kind: 'document' as const,
        id: `doc-${doc.id}`,
        documentId: doc.id,
        label: `Приходный кассовый ордер ${doc.number ?? doc.id} от ${formatDateTime(doc.date)}`,
        date: formatDate(doc.date),
        debit: 0,
        credit: Number(doc.amount || 0),
        note: doc.purpose || doc.basis || '',
      })),
      {
        kind: 'turnover',
        id: 'turnover',
        label: `Обороты за ${formatDate(dateFrom)} - ${formatDate(dateTo)}`,
        date: '',
        debit: 0,
        credit: totalCredit,
        note: '',
      },
      {
        kind: 'closing',
        id: 'closing',
        label: `Сальдо на ${formatDate(dateTo)}`,
        date: '',
        debit: 0,
        credit: totalCredit,
        note: '',
      },
    ];
  }, [filteredDocuments, dateFrom, dateTo]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#e9e9e9] px-1 py-1 text-[#3e3e3e]">
      <div className="mx-auto h-[calc(100vh-4.6rem)] w-full overflow-hidden border border-[#c9c9c9] bg-[#efefef] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between border-b border-[#d2d2d2] px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-white text-sm">←</button>
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-white text-sm">→</button>
            </div>
            <span className="text-2xl leading-none text-[#c3c3c3]">☆</span>
            <h1 className="text-[18px] font-medium text-black">Акт сверки</h1>
          </div>
          <div className="flex items-center gap-3 text-lg text-[#777]">
            <span>💾</span>
            <span>🖨</span>
            <span>🔍</span>
            <span>🔗</span>
            <span>⋮</span>
            <span>×</span>
          </div>
        </div>

        <div className="space-y-3 border-b border-[#d7d7d7] px-2 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value=""
              readOnly
              className="h-9 w-[140px] rounded-none border border-[#bcbcbc] bg-white shadow-none focus-visible:ring-0"
            />
            <span className="text-sm">Период с:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9 w-[150px] rounded-none border border-[#bcbcbc] bg-white shadow-none focus-visible:ring-0"
            />
            <span className="text-sm">по:</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9 w-[150px] rounded-none border border-[#bcbcbc] bg-white shadow-none focus-visible:ring-0"
            />
            {[
              { id: 'all' as const, label: 'Все' },
              { id: 'customers' as const, label: 'Покупатели' },
              { id: 'suppliers' as const, label: 'Поставщики' },
              { id: 'founders' as const, label: 'Учредители' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPartyFilter(option.id)}
                className={`h-9 border px-3 text-sm ${
                  partyFilter === option.id
                    ? 'border-[#76b46f] bg-[#eef9ee] text-[#198f38]'
                    : 'border-[#bcbcbc] bg-white'
                }`}
              >
                {option.label}
              </button>
            ))}
            <Button type="button" className={buttonClassName}>
              Отправить по телеграму
            </Button>
          </div>

          <div className="grid grid-cols-[110px_360px_180px_1fr] items-center gap-2">
            <span className="text-sm">Контрагент:</span>
            <select
              value={counterpartyId}
              onChange={(event) => setCounterpartyId(event.target.value)}
              className="h-9 rounded-none border border-[#bcbcbc] bg-white px-2 text-sm"
            >
              <option value=""> </option>
              {counterparties.map((counterparty) => (
                <option key={counterparty.id} value={String(counterparty.id)}>
                  {counterparty.name}
                </option>
              ))}
            </select>
            <span className="text-sm">Валюта регламента:</span>
            <label className="flex h-9 items-center">
              <input type="checkbox" className="h-4 w-4" />
            </label>
          </div>
        </div>

        <div className="h-[calc(100%-118px)] overflow-auto px-2 py-3">
          <div className="mb-3 border border-[#bdbdbd] bg-white p-4">
            <div className="mb-4 text-center text-[16px] font-semibold text-black">
              АКТ СВЕРКИ ВЗАИМОРАСЧЕТОВ
            </div>

            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#f3f3f3]">
                  <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Документ</th>
                  <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Дата</th>
                  <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Дебет</th>
                  <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Кредит</th>
                  <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Примечание</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="border border-[#bdbdbd] px-3 py-8 text-center">
                      Загрузка...
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const isSelected = selectedRowId === row.id;
                    const isDocument = row.kind === 'document';

                    return (
                      <tr
                        key={row.id}
                        className={isDocument ? 'bg-white hover:bg-[#fbf7da]' : 'bg-white'}
                        onClick={() => setSelectedRowId(row.id)}
                        onDoubleClick={() => {
                          if (isDocument && row.documentId) {
                            router.push(`/documents/cash-orders/${row.documentId}`);
                          }
                        }}
                      >
                        <td
                          className={`border border-[#bdbdbd] px-3 py-2 ${
                            isSelected ? 'bg-[#f8efba]' : ''
                          }`}
                        >
                          <span className={row.kind === 'turnover' ? 'text-[#2e56a6]' : isDocument ? 'text-[#2e56a6]' : 'font-semibold'}>
                            {row.label}
                          </span>
                        </td>
                        <td className={`border border-[#bdbdbd] px-3 py-2 ${isSelected ? 'bg-[#f8efba]' : ''}`}>
                          {row.date}
                        </td>
                        <td className={`border border-[#bdbdbd] px-3 py-2 text-right ${isSelected ? 'bg-[#f8efba]' : ''}`}>
                          {formatAmount(row.debit)}
                        </td>
                        <td className={`border border-[#bdbdbd] px-3 py-2 text-right ${isSelected ? 'bg-[#f8efba]' : ''}`}>
                          {formatAmount(row.credit)}
                        </td>
                        <td className={`border border-[#bdbdbd] px-3 py-2 ${isSelected ? 'bg-[#f8efba]' : ''}`}>
                          {row.note}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
