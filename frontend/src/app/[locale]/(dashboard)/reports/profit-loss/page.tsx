'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Filter, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import api from '@/lib/api';
import { ProfitLossTable } from '@/components/reports/profit-loss-table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

export default function ProfitLossPage() {
    const router = useRouter();

    // Dates
    const [startDate, setStartDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    );
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

    // Comparison Dates (Previous Month by default)
    const [compareStart, setCompareStart] = useState(
        subMonths(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 1).toISOString().slice(0, 10)
    );
    const [compareEnd, setCompareEnd] = useState(
        subMonths(new Date(), 1).toISOString().slice(0, 10)
    );

    const { data: reportData, isLoading, refetch } = useQuery({
        queryKey: ['profit-loss', startDate, endDate, compareStart, compareEnd],
        queryFn: async () => {
            const response = await api.get('/reports/profit-loss/', {
                params: {
                    start_date: startDate,
                    end_date: endDate,
                    compare_start_date: compareStart,
                    compare_end_date: compareEnd
                }
            });
            return response.data;
        }
    });

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Отчет о прибылях и убытках</h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        Profit & Loss (P&L)
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            1C-Style
                        </span>
                    </p>
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

            {/* Filter Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4" /> Report Parameters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-6 items-end">
                        {/* Current Period */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Period</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="h-9 w-[130px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                                />
                                <span className="text-muted-foreground">-</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="h-9 w-[130px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Comparison Period */}
                        <div className="space-y-2 border-l pl-6">
                            <label className="text-sm font-medium text-muted-foreground">Compare With</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={compareStart}
                                    onChange={e => setCompareStart(e.target.value)}
                                    className="h-9 w-[130px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-muted-foreground"
                                />
                                <span className="text-muted-foreground">-</span>
                                <input
                                    type="date"
                                    value={compareEnd}
                                    onChange={e => setCompareEnd(e.target.value)}
                                    className="h-9 w-[130px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-muted-foreground"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="mt-4 pt-4 border-t text-xs text-muted-foreground flex gap-6">
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Income (Credit Turnovers)</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                            <span>Expense (Debit Turnovers)</span>
                        </div>
                        <div className="ml-auto italic">
                            Built from: ✔ Posted documents only • ✔ Accrual method
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Report Table */}
            <Card className="min-h-[400px]">
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">Loading...</div>
                    ) : (
                        <ProfitLossTable
                            data={reportData || []}
                            startDate={startDate}
                            endDate={endDate}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
