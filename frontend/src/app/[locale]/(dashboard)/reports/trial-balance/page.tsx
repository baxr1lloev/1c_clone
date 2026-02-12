'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Filter } from 'lucide-react';
import api from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface TrialBalanceItem {
    id: number;
    code: string;
    name: string;
    level: number;
    has_children: boolean;
    opening_debit: number;
    opening_credit: number;
    turnover_debit: number;
    turnover_credit: number;
    closing_debit: number;
    closing_credit: number;
}

export default function TrialBalancePage() {
    const router = useRouter();
    const tReports = useTranslations('reports');
    const tFields = useTranslations('fields');
    const tCommon = useTranslations('common');
    const [startDate, setStartDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    );
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

    const { data: reportData = [], isLoading, refetch } = useQuery<TrialBalanceItem[]>({
        queryKey: ['trial-balance', startDate, endDate],
        queryFn: async () => {
            try {
                const res = await api.get<TrialBalanceItem[] | { results?: TrialBalanceItem[] }>(
                    '/reports/trial-balance/',
                    { params: { start_date: startDate, end_date: endDate } }
                );
                if (Array.isArray(res)) return res;
                if (Array.isArray(res?.results)) return res.results;
                return [];
            } catch {
                return [];
            }
        },
        initialData: [],
    });

    const goToAccountCard = (accountId: number) => {
        router.push(`/reports/account-card?account_id=${accountId}&start_date=${startDate}&end_date=${endDate}`);
    };

    const nm = (val: number) => {
        if (Math.abs(val) < 0.01) return '-';
        return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{tReports('trialBalance')}</h1>
                    <p className="text-muted-foreground">{tReports('trialBalancePage.subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => refetch()}>
                        <RefreshCw className="mr-2 h-4 w-4" /> {tCommon('refresh')}
                    </Button>
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" /> {tReports('trialBalancePage.excel')}
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4" /> {tReports('trialBalancePage.reportParameters')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4 items-end">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{tFields('period')}</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                            />
                            <span>-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <Button onClick={() => refetch()}>{tReports('trialBalancePage.generate')}</Button>
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    <div className="max-h-[70vh] overflow-auto">
                        <Table className="border-collapse">
                            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[300px] border-r">{tFields('account')}</TableHead>
                                    <TableHead className="text-center border-r bg-blue-50/30" colSpan={2}>{tReports('trialBalancePage.openingBalance')}</TableHead>
                                    <TableHead className="text-center border-r bg-emerald-50/30" colSpan={2}>{tReports('trialBalancePage.turnover')}</TableHead>
                                    <TableHead className="text-center bg-purple-50/30" colSpan={2}>{tReports('trialBalancePage.closingBalance')}</TableHead>
                                </TableRow>
                                <TableRow>
                                    <TableHead className="border-r"></TableHead>
                                    <TableHead className="text-right w-[120px] bg-blue-50/30 text-xs">{tReports('trialBalancePage.debit')}</TableHead>
                                    <TableHead className="text-right w-[120px] border-r bg-blue-50/30 text-xs">{tReports('trialBalancePage.credit')}</TableHead>
                                    <TableHead className="text-right w-[120px] bg-emerald-50/30 text-xs">{tReports('trialBalancePage.debit')}</TableHead>
                                    <TableHead className="text-right w-[120px] border-r bg-emerald-50/30 text-xs">{tReports('trialBalancePage.credit')}</TableHead>
                                    <TableHead className="text-right w-[120px] bg-purple-50/30 text-xs">{tReports('trialBalancePage.debit')}</TableHead>
                                    <TableHead className="text-right w-[120px] bg-purple-50/30 text-xs">{tReports('trialBalancePage.credit')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-20">{tReports('trialBalancePage.loading')}</TableCell>
                                    </TableRow>
                                ) : reportData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-20">{tCommon('noData')}</TableCell>
                                    </TableRow>
                                ) : (
                                    reportData?.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className={cn(
                                                "hover:bg-muted/50 cursor-pointer transition-colors",
                                                row.has_children && "font-bold bg-gray-50/50"
                                            )}
                                            onClick={() => goToAccountCard(row.id)}
                                        >
                                            <TableCell className="border-r font-medium">
                                                <div style={{ paddingLeft: `${row.level * 20}px` }}>
                                                    {row.code} {row.name}
                                                </div>
                                            </TableCell>

                                            {/* Opening */}
                                            <TableCell className="text-right border-r font-mono bg-blue-50/10 active:bg-blue-100">
                                                {nm(row.opening_debit)}
                                            </TableCell>
                                            <TableCell className="text-right border-r font-mono bg-blue-50/10">
                                                {nm(row.opening_credit)}
                                            </TableCell>

                                            {/* Turnover */}
                                            <TableCell className="text-right border-r font-mono bg-emerald-50/10">
                                                {nm(row.turnover_debit)}
                                            </TableCell>
                                            <TableCell className="text-right border-r font-mono bg-emerald-50/10">
                                                {nm(row.turnover_credit)}
                                            </TableCell>

                                            {/* Closing */}
                                            <TableCell className="text-right border-r font-mono bg-purple-50/10">
                                                {nm(row.closing_debit)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono bg-purple-50/10">
                                                {nm(row.closing_credit)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
