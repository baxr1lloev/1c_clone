'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Counterparty, PaginatedResponse } from '@/types';

type CounterpartyListResponse = PaginatedResponse<Counterparty> | Counterparty[];

interface SettlementRow {
  counterparty_id: number;
  counterparty_name: string;
  currency?: string;
  amount?: number;
}

const buttonClassName =
  'h-9 rounded-sm border border-[#bcbcbc] bg-white px-4 text-sm text-black hover:bg-[#f3f3f3]';

function formatAmount(value: number): string {
  if (!value) return '';
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CustomersReportPage() {
  const router = useRouter();
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [counterpartyId, setCounterpartyId] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-02-28');
  const [dateTo, setDateTo] = useState('2026-02-28');
  const [reportType, setReportType] = useState<'saldo' | 'turnover'>('saldo');

  const { data: counterparties = [] } = useQuery({
    queryKey: ['counterparties-customers-report'],
    queryFn: async () => {
      const response = await api.get<CounterpartyListResponse>('/directories/counterparties/');
      return Array.isArray(response) ? response : response.results;
    },
  });

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['customers-report', dateTo, counterpartyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateTo) params.append('date', dateTo);
      if (counterpartyId) params.append('counterparty', counterpartyId);
      return api.get(`/reports/settlements-as-of-date/?${params.toString()}`);
    },
  });

  const customerMap = useMemo(() => {
    return new Map(counterparties.map((item) => [item.id, item]));
  }, [counterparties]);

  const rows = useMemo(() => {
    const source = Array.isArray(report?.counterparties)
      ? (report.counterparties as SettlementRow[])
      : [];

    return source
      .filter((entry) => {
        const counterparty = customerMap.get(entry.counterparty_id);
        return counterparty?.type === 'customer' || !counterparty?.type;
      })
      .map((entry) => {
        const amount = Number(entry.amount) || 0;
        const currency = entry.currency || 'USD';
        const counterparty = customerMap.get(entry.counterparty_id);

        return {
          counterpartyId: entry.counterparty_id,
          name: entry.counterparty_name,
          phone: counterparty?.phone || '',
          uzs: currency === 'UZS' || currency === 'UZB' ? amount : 0,
          usd: currency === 'USD' ? amount : 0,
          rub: currency === 'RUB' ? amount : 0,
        };
      })
      .sort((left, right) => right.usd + right.uzs + right.rub - (left.usd + left.uzs + left.rub));
  }, [customerMap, report]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          uzs: acc.uzs + row.uzs,
          usd: acc.usd + row.usd,
          rub: acc.rub + row.rub,
        }),
        { uzs: 0, usd: 0, rub: 0 },
      ),
    [rows],
  );

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
            <h1 className="text-[18px] font-medium text-black">Отчет по покупателям</h1>
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
            <span className="text-sm">Вид отчета:</span>
            <button
              type="button"
              onClick={() => setReportType('saldo')}
              className={`h-9 border px-3 text-sm ${
                reportType === 'saldo'
                  ? 'border-[#76b46f] bg-[#eef9ee] text-[#198f38]'
                  : 'border-[#bcbcbc] bg-white'
              }`}
            >
              Сальдовая
            </button>
            <button
              type="button"
              onClick={() => setReportType('turnover')}
              className={`h-9 border px-3 text-sm ${
                reportType === 'turnover'
                  ? 'border-[#76b46f] bg-[#eef9ee] text-[#198f38]'
                  : 'border-[#bcbcbc] bg-white'
              }`}
            >
              Оборотно-сальдовая
            </button>
          </div>

          <div className="grid grid-cols-[110px_360px] items-center gap-2">
            <span className="text-sm">Контрагент:</span>
            <select
              value={counterpartyId}
              onChange={(event) => setCounterpartyId(event.target.value)}
              className="h-9 rounded-none border border-[#bcbcbc] bg-white px-2 text-sm"
            >
              <option value=""> </option>
              {counterparties
                .filter((item) => item.type === 'customer' || !item.type)
                .map((counterparty) => (
                  <option key={counterparty.id} value={String(counterparty.id)}>
                    {counterparty.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="h-[calc(100%-118px)] overflow-auto px-2 py-3">
          <div className="mb-2 text-[15px] text-black">ООО &quot;XUSHNUR SHOHNUR OMAD OPTOVIY BAZA&quot;</div>
          <div className="mb-4 text-center text-[15px] font-semibold text-black">
            Остаточная ведомость по покупателям на {dateTo.split('-').reverse().join('.')}
          </div>

          <table className="min-w-[950px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#f3f3f3]">
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Контрагент</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Телефон</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">UZB</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">USD</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">RUB</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="border border-[#bdbdbd] px-3 py-8 text-center">
                    Загрузка...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-[#bdbdbd] px-3 py-8 text-center">
                    Нет данных за выбранный период
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isSelected = selectedRowId === row.counterpartyId;
                  const selectedClassName = isSelected ? 'bg-[#f8efba]' : '';

                  return (
                    <tr
                      key={row.counterpartyId}
                      className="bg-white hover:bg-[#fbf7da]"
                      onClick={() => setSelectedRowId(row.counterpartyId)}
                      onDoubleClick={() => router.push(`/directories/counterparties/${row.counterpartyId}`)}
                    >
                      <td className={`border border-[#bdbdbd] px-3 py-1 ${selectedClassName}`}>
                        {row.name}
                      </td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 ${selectedClassName}`}>
                        {row.phone}
                      </td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${row.uzs < 0 ? 'text-[#c40000]' : ''} ${selectedClassName}`}>
                        {formatAmount(row.uzs)}
                      </td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${row.usd < 0 ? 'text-[#c40000]' : ''} ${selectedClassName}`}>
                        {formatAmount(row.usd)}
                      </td>
                      <td className={`border border-[#bdbdbd] px-3 py-1 text-right ${row.rub < 0 ? 'text-[#c40000]' : ''} ${selectedClassName}`}>
                        {formatAmount(row.rub)}
                      </td>
                    </tr>
                  );
                })
              )}

              {rows.length > 0 ? (
                <tr className="bg-[#ecf6f7]">
                  <td className="border border-[#bdbdbd] px-3 py-2 font-semibold">Итог</td>
                  <td className="border border-[#bdbdbd] px-3 py-2" />
                  <td className="border border-[#bdbdbd] px-3 py-2 text-right font-semibold">{formatAmount(totals.uzs)}</td>
                  <td className="border border-[#bdbdbd] px-3 py-2 text-right font-semibold">{formatAmount(totals.usd)}</td>
                  <td className="border border-[#bdbdbd] px-3 py-2 text-right font-semibold">{formatAmount(totals.rub)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
