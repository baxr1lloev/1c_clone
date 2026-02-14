'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, ArrowLeft, Filter } from 'lucide-react';
import api from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

interface AccountEntry {
  id: number;
  date: string;
  document: string;
  document_url: string | null;
  corr_account: string;
  debit: number;
  credit: number;
  current_balance: number;
  description: string;
}

interface AccountCardReport {
  account_code: string;
  account_name: string;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  entries: AccountEntry[];
}

function firstDayOfMonthISO(): string {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return first.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AccountCardClient({
  initialAccountId,
  initialStartDate,
  initialEndDate,
}: {
  initialAccountId?: string | null;
  initialStartDate?: string | null;
  initialEndDate?: string | null;
}) {
  const router = useRouter();

  const [accountId, setAccountId] = useState(initialAccountId ?? '');
  const [startDate, setStartDate] = useState(initialStartDate ?? firstDayOfMonthISO());
  const [endDate, setEndDate] = useState(initialEndDate ?? todayISO());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['account-card', accountId, startDate, endDate],
    queryFn: async () => {
      if (!accountId) return null;
      const report = await api.get<AccountCardReport | null>('/reports/account-card-report/', {
        params: { account_id: accountId, start_date: startDate, end_date: endDate },
      });
      return report ?? null;
    },
    enabled: !!accountId,
  });

  const nm = (val: number) =>
    val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Карточка счета (Account Card)</h1>
            <p className="text-muted-foreground">
              {data ? `${data.account_code} - ${data.account_name}` : 'Select an account'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Report Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2 min-w-[200px]">
            <label className="text-sm font-medium">Account</label>
            <input
              type="text"
              placeholder="Account ID (Temp)"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Period</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
              <span>-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>

          <Button onClick={() => refetch()}>Generate</Button>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead className="w-[250px]">Document</TableHead>
                  <TableHead className="w-[100px]">Corr. Acc</TableHead>
                  <TableHead className="text-right w-[120px]">Debit</TableHead>
                  <TableHead className="text-right w-[120px]">Credit</TableHead>
                  <TableHead className="text-right w-[120px]">Balance</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-blue-50/50 font-medium">
                  <TableCell colSpan={3}>Opening Balance</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right font-bold">{nm(data.opening_balance)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>

                {data.entries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-muted/50">
                    <TableCell>{format(new Date(entry.date), 'dd.MM.yyyy')}</TableCell>
                    <TableCell>
                      {entry.document_url ? (
                        <span
                          className="text-primary hover:underline cursor-pointer"
                          onClick={() => router.push(entry.document_url!)}
                        >
                          {entry.document}
                        </span>
                      ) : (
                        entry.document
                      )}
                    </TableCell>
                    <TableCell>{entry.corr_account}</TableCell>
                    <TableCell className="text-right">
                      {entry.debit !== 0 ? nm(entry.debit) : ''}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.credit !== 0 ? nm(entry.credit) : ''}
                    </TableCell>
                    <TableCell className="text-right font-bold">{nm(entry.current_balance)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{entry.description}</TableCell>
                  </TableRow>
                ))}

                <TableRow className="bg-gray-100 font-bold border-t-2 border-black">
                  <TableCell colSpan={3}>Turnovers & Closing Balance</TableCell>
                  <TableCell className="text-right">{nm(data.total_debit)}</TableCell>
                  <TableCell className="text-right">{nm(data.total_credit)}</TableCell>
                  <TableCell className="text-right">{nm(data.closing_balance)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
    </div>
  );
}
