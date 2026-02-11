'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProfitCell } from '@/components/table-cells';
import { Download, Filter, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrialBalanceItem {
    id: number;
    code: string;
    name: string;
    level: number;
    type: string;
    opening_debit: number;
    opening_credit: number;
    turnover_debit: number;
    turnover_credit: number;
    closing_debit: number;
    closing_credit: number;
    has_children: boolean;
}

import { useRouter } from 'next/navigation';

export default function TrialBalancePage() {
    const router = useRouter();
    const [startDate, setStartDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    );
    const [endDate, setEndDate] = useState(
        new Date().toISOString().slice(0, 10)
    );
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const { data: reportData, isLoading } = useQuery({
        queryKey: ['trial-balance', startDate, endDate],
        queryFn: async () => {
            const response = await api.get(`/reports/trial-balance/?start_date=${startDate}&end_date=${endDate}`);
            return response.data as TrialBalanceItem[];
        }
    });

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Columns definition with 1C styling
    const columns: ColumnDef<TrialBalanceItem>[] = [
        {
            accessorKey: 'code',
            header: 'Счет',
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div
                        className="flex items-center gap-1 font-mono hover:text-primary cursor-pointer"
                        style={{ paddingLeft: `${item.level * 1.5}rem` }}
                        onClick={() => item.has_children && toggleRow(item.code)}
                    >
                        {item.has_children && (
                            expandedRows[item.code] ?
                                <ChevronDown className="h-4 w-4 text-muted-foreground" /> :
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={cn(item.level === 0 ? "font-bold" : "")}>
                            {item.code}
                        </span>
                    </div>
                );
            }
        },
        {
            accessorKey: 'name',
            header: 'Наименование',
            cell: ({ row }) => (
                <div className={cn(row.original.level === 0 ? "font-bold" : "")}>
                    {row.original.name}
                </div>
            )
        },
        // Opening Balance
        {
            header: 'Сальдо на начало',
            columns: [
                {
                    accessorKey: 'opening_debit',
                    header: 'Дебет',
                    cell: ({ row }) => (
                        <div className="font-mono text-right text-muted-foreground">
                            {row.original.opening_debit ? row.original.opening_debit.toLocaleString() : '-'}
                        </div>
                    )
                },
                {
                    accessorKey: 'opening_credit',
                    header: 'Кредит',
                    cell: ({ row }) => (
                        <div className="font-mono text-right text-muted-foreground">
                            {row.original.opening_credit ? row.original.opening_credit.toLocaleString() : '-'}
                        </div>
                    )
                }
            ]
        },
        // Turnover
        {
            header: 'Обороты за период',
            columns: [
                {
                    accessorKey: 'turnover_debit',
                    header: 'Дебет',
                    cell: ({ row }) => (
                        <div className="font-mono text-right font-medium">
                            {row.original.turnover_debit ? row.original.turnover_debit.toLocaleString() : '-'}
                        </div>
                    )
                },
                {
                    accessorKey: 'turnover_credit',
                    header: 'Кредит',
                    cell: ({ row }) => (
                        <div className="font-mono text-right font-medium">
                            {row.original.turnover_credit ? row.original.turnover_credit.toLocaleString() : '-'}
                        </div>
                    )
                }
            ]
        },
        // Closing Balance
        {
            header: 'Сальдо на конец',
            columns: [
                {
                    accessorKey: 'closing_debit',
                    header: 'Дебет',
                    cell: ({ row }) => (
                        <div className="font-mono text-right font-bold text-gray-900 dark:text-gray-100">
                            {row.original.closing_debit > 0 ? (
                                row.original.closing_debit.toLocaleString()
                            ) : '-'}
                        </div>
                    )
                },
                {
                    accessorKey: 'closing_credit',
                    header: 'Кредит',
                    cell: ({ row }) => (
                        <div className="font-mono text-right font-bold text-gray-900 dark:text-gray-100">
                            {row.original.closing_credit > 0 ? (
                                row.original.closing_credit.toLocaleString()
                            ) : '-'}
                        </div>
                    )
                }
            ]
        }
    ];

    // Export handler
    const handleExport = () => {
        window.open(`/api/reports/trial-balance/export/?start_date=${startDate}&end_date=${endDate}`, '_blank');
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Оборотно-сальдовая ведомость</h1>
                    <p className="text-muted-foreground">Trial Balance (1C Style)</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Excel
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Период отчета
                    </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                    <div className="flex items-center gap-4">
                        <div className="grid gap-1.5">
                            <label htmlFor="start_date" className="text-sm font-medium">С:</label>
                            <input
                                id="start_date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-2 border rounded-md w-40"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <label htmlFor="end_date" className="text-sm font-medium">По:</label>
                            <input
                                id="end_date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-2 border rounded-md w-40"
                            />
                        </div>
                        <Button className="mt-6" onClick={() => { }}>Сформировать</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Report Table */}
            <Card className="overflow-hidden">
                <div className="p-0">
                    <DataTable
                        columns={columns}
                        data={reportData || []}
                        isLoading={isLoading}
                        onRowDoubleClick={(row) => {
                            // Drill down to Account Card (Карточка счета)
                            const params = new URLSearchParams({
                                account_id: row.id.toString(),
                                code: row.code,
                                from: startDate,
                                to: endDate
                            });
                            router.push(`/reports/account-card?${params.toString()}`);
                        }}
                    />
                </div>
            </Card>
        </div>
    );
}
