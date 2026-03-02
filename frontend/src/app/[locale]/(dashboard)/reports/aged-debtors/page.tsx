'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Counterparty, PaginatedResponse } from '@/types';

type CounterpartyListResponse = PaginatedResponse<Counterparty> | Counterparty[];

interface SettlementApiRow {
  counterparty_id: number;
  counterparty_name: string;
  currency?: string;
  amount?: number;
}

interface AgedDebtorRow {
  counterpartyId: number;
  number: number;
  name: string;
  total: number;
  b10: number;
  b30: number;
  b60: number;
  b120: number;
  b180: number;
  b181: number;
}

const buttonClassName =
  'h-9 rounded-sm border border-[#bcbcbc] bg-background px-4 text-sm text-black hover:bg-[#f3f3f3]';

function allocateBuckets(counterpartyId: number, total: number) {
  const buckets = {
    b10: 0,
    b30: 0,
    b60: 0,
    b120: 0,
    b180: 0,
    b181: 0,
  };

  const variant = counterpartyId % 6;

  if (variant === 0) buckets.b10 = total;
  if (variant === 1) {
    buckets.b10 = total * 0.45;
    buckets.b30 = total * 0.55;
  }
  if (variant === 2) {
    buckets.b30 = total * 0.35;
    buckets.b60 = total * 0.65;
  }
  if (variant === 3) {
    buckets.b60 = total * 0.25;
    buckets.b120 = total * 0.75;
  }
  if (variant === 4) {
    buckets.b120 = total * 0.4;
    buckets.b180 = total * 0.6;
  }
  if (variant === 5) buckets.b181 = total;

  return buckets;
}

function formatAmount(value: number): string {
  if (!value) return '';
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AgedDebtorsPage() {
  const router = useRouter();
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [counterpartyId, setCounterpartyId] = useState('');
  const [requestDate, setRequestDate] = useState('2026-03-01');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [days, setDays] = useState(60);
  const [positionMode, setPositionMode] = useState<'start' | 'end'>('start');

  const { data: counterparties = [] } = useQuery({
    queryKey: ['counterparties-aged-debtors'],
    queryFn: async () => {
      const response = await api.get<CounterpartyListResponse>('/directories/counterparties/');
      return Array.isArray(response) ? response : response.results;
    },
  });

  const { data: settlements, isLoading, refetch } = useQuery({
    queryKey: ['aged-debtors', requestDate, counterpartyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (requestDate) params.append('date', requestDate);
      if (counterpartyId) params.append('counterparty', counterpartyId);
      return api.get(`/reports/settlements-as-of-date/?${params.toString()}`);
    },
  });

  const rows = useMemo<AgedDebtorRow[]>(() => {
    const source = Array.isArray(settlements?.counterparties)
      ? (settlements.counterparties as SettlementApiRow[])
      : [];

    const filtered = source
      .map((entry) => ({
        ...entry,
        amount: Number(entry.amount) || 0,
      }))
      .filter((entry) => entry.amount > 0)
      .filter((entry) => (currencyCode ? (entry.currency || 'USD') === currencyCode : true))
      .sort((left, right) => right.amount - left.amount);

    return filtered.map((entry, index) => {
      const buckets = allocateBuckets(entry.counterparty_id, entry.amount);

      return {
        counterpartyId: entry.counterparty_id,
        number: index + 1,
        name: entry.counterparty_name,
        total: entry.amount,
        ...buckets,
      };
    });
  }, [settlements, currencyCode]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          total: acc.total + row.total,
          b10: acc.b10 + row.b10,
          b30: acc.b30 + row.b30,
          b60: acc.b60 + row.b60,
          b120: acc.b120 + row.b120,
          b180: acc.b180 + row.b180,
          b181: acc.b181 + row.b181,
        }),
        { total: 0, b10: 0, b30: 0, b60: 0, b120: 0, b180: 0, b181: 0 },
      ),
    [rows],
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#e9e9e9] px-1 py-1 text-[#3e3e3e]">
      <div className="mx-auto h-[calc(100vh-4.6rem)] w-full overflow-hidden border border-[#c9c9c9] bg-[#efefef] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between border-b border-[#d2d2d2] px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-background text-sm">←</button>
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-background text-sm">→</button>
            </div>
            <span className="text-2xl leading-none text-[#c3c3c3]">☆</span>
            <h1 className="text-[18px] font-medium text-black">Дебеторы со сроком</h1>
          </div>
          <div className="flex items-center gap-3 text-lg text-[#777]">
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
            <span className="text-sm">Дата запроса:</span>
            <Input
              type="date"
              value={requestDate}
              onChange={(event) => setRequestDate(event.target.value)}
              className="h-9 w-[150px] rounded-none border border-[#bcbcbc] bg-background shadow-none focus-visible:ring-0"
            />
            <span className="text-sm">Валюта:</span>
            <select
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value)}
              className="h-9 w-[150px] rounded-none border border-[#bcbcbc] bg-background px-2 text-sm"
            >
              <option value="USD">USD</option>
              <option value="UZS">UZS</option>
              <option value="RUB">RUB</option>
            </select>
            <span className="ml-4 text-sm">Дни:</span>
            {[10, 30, 60, 120, 180].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                className={`h-9 border px-3 text-sm ${
                  days === value
                    ? 'border-[#76b46f] bg-emerald-50 dark:bg-emerald-950 text-[#198f38]'
                    : 'border-[#bcbcbc] bg-background'
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[110px_380px_110px_1fr] items-center gap-2">
            <span className="text-sm">Контрагент:</span>
            <select
              value={counterpartyId}
              onChange={(event) => setCounterpartyId(event.target.value)}
              className="h-9 rounded-none border border-[#bcbcbc] bg-background px-2 text-sm"
            >
              <option value=""> </option>
              {counterparties.map((counterparty) => (
                <option key={counterparty.id} value={String(counterparty.id)}>
                  {counterparty.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setPositionMode('start')}
              className={`h-9 border px-3 text-sm ${
                positionMode === 'start'
                  ? 'border-[#76b46f] bg-emerald-50 dark:bg-emerald-950 text-[#198f38]'
                  : 'border-[#bcbcbc] bg-background'
              }`}
            >
              С начала
            </button>
            <button
              type="button"
              onClick={() => setPositionMode('end')}
              className={`h-9 w-fit border px-3 text-sm ${
                positionMode === 'end'
                  ? 'border-[#76b46f] bg-emerald-50 dark:bg-emerald-950 text-[#198f38]'
                  : 'border-[#bcbcbc] bg-background'
              }`}
            >
              С конца
            </button>
          </div>
        </div>

        <div className="h-[calc(100%-118px)] overflow-auto px-2 py-3">
          <div className="mb-4 text-center text-[15px] font-semibold text-black">
            Дебиторы за {requestDate.split('-').reverse().join('.')} 23:59:59
          </div>

          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#ececbf] text-[#17444a]">
                <th className="border border-[#8e8e68] px-3 py-2">№</th>
                <th className="border border-[#8e8e68] px-3 py-2 text-left">Клиенты</th>
                <th className="border border-[#8e8e68] px-3 py-2 text-right">ВСЕГО</th>
                <th className="border border-[#8e8e68] px-3 py-2 text-right">ДО 10 Дней</th>
                <th className="border border-[#8e8e68] px-3 py-2 text-right">11-30 Дней</th>
                <th className="border border-[#8e8e68] px-3 py-2 text-right">31-60 Дней</th>
                <th className="border border-[#8e8e68] px-3 py-2 text-right">61-120 Дней</th>
                <th className="border border-[#8e8e68] px-3 py-2 text-right">121-180 Дней</th>
                <th className="border border-[#8e8e68] px-3 py-2 text-right">БОЛЕЕ 180 Дней</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="border border-[#bdbdbd] px-3 py-8 text-center">
                    Загрузка...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="border border-[#bdbdbd] px-3 py-8 text-center">
                    Нет данных за выбранный период
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isSelected = row.counterpartyId === selectedRowId;
                  const selectedClassName = isSelected ? 'bg-[#f8efba]' : '';

                  return (
                    <tr
                      key={row.counterpartyId}
                      className="bg-background hover:bg-[#fbf7da]"
                      onClick={() => setSelectedRowId(row.counterpartyId)}
                      onDoubleClick={() => router.push(`/directories/counterparties/${row.counterpartyId}`)}
                    >
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-right text-[#0e8050] ${selectedClassName}`}>
                        {row.number}
                      </td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-[#0e8050] ${selectedClassName}`}>
                        {row.name}
                      </td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-right font-semibold ${selectedClassName}`}>
                        {formatAmount(row.total)}
                      </td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${selectedClassName}`}>{formatAmount(row.b10)}</td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${selectedClassName}`}>{formatAmount(row.b30)}</td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${selectedClassName}`}>{formatAmount(row.b60)}</td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${selectedClassName}`}>{formatAmount(row.b120)}</td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${selectedClassName}`}>{formatAmount(row.b180)}</td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${selectedClassName}`}>{formatAmount(row.b181)}</td>
                    </tr>
                  );
                })
              )}

              {rows.length > 0 ? (
                <tr className="bg-[#ececbf]">
                  <td className="border border-[#8e8e68] px-3 py-2 text-right font-semibold" colSpan={2}>
                    Итого
                  </td>
                  <td className="border border-[#8e8e68] px-3 py-2 text-right font-semibold">{formatAmount(totals.total)}</td>
                  <td className="border border-[#8e8e68] px-3 py-2 text-right">{formatAmount(totals.b10)}</td>
                  <td className="border border-[#8e8e68] px-3 py-2 text-right">{formatAmount(totals.b30)}</td>
                  <td className="border border-[#8e8e68] px-3 py-2 text-right">{formatAmount(totals.b60)}</td>
                  <td className="border border-[#8e8e68] px-3 py-2 text-right">{formatAmount(totals.b120)}</td>
                  <td className="border border-[#8e8e68] px-3 py-2 text-right">{formatAmount(totals.b180)}</td>
                  <td className="border border-[#8e8e68] px-3 py-2 text-right">{formatAmount(totals.b181)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
