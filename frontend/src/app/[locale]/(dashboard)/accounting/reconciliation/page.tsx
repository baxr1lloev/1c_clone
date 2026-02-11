'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { PiArrowsClockwiseBold } from 'react-icons/pi';

export default function ReconciliationPage() {
    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['reconciliation'],
        queryFn: async () => {
            const res = await api.get('/reports/reconciliation/check/');
            return res.data;
        }
    });

    const StatusBadge = ({ isOk }: { isOk: boolean }) => (
        <Badge variant={isOk ? 'default' : 'destructive'} className={isOk ? 'bg-green-600' : ''}>
            {isOk ? <><CheckCircle className="w-3 h-3 mr-1" /> OK</> : <><AlertTriangle className="w-3 h-3 mr-1" /> DISCREPANCY</>}
        </Badge>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Reconciliation Center (Level 6)</h1>
                <Button onClick={() => refetch()} disabled={isLoading || isRefetching}>
                    {(isLoading || isRefetching) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PiArrowsClockwiseBold className="w-4 h-4 mr-2" />}
                    Run Checks
                </Button>
            </div>

            {data && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Stock Check */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Stock vs Accounting (41)</CardTitle>
                            <StatusBadge isOk={data.stock_check.is_reconciled} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.stock_check.register_vs_accounting_diff === 0 ? "Matched" : `Diff: ${data.stock_check.register_vs_accounting_diff}`}</div>
                            <p className="text-xs text-muted-foreground">
                                Register: {data.stock_check.register_cache_amount} <br />
                                Accounting: {data.stock_check.accounting_balance}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Settlements Check */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Settlements vs Accounting</CardTitle>
                            <StatusBadge isOk={data.settlements_check.is_reconciled} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.settlements_check.accounting_net === data.settlements_check.register_total ? "Matched" : "Review Needed"}</div>
                            <p className="text-xs text-muted-foreground">
                                Register: {data.settlements_check.register_total} <br />
                                Accounting Net: {data.settlements_check.accounting_net}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Movement Consistency */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Register Integrity</CardTitle>
                            <StatusBadge isOk={data.consistency_check.is_consistent} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.consistency_check.discrepancies_count} Issues</div>
                            <p className="text-xs text-muted-foreground">
                                Checked {data.consistency_check.total_checked} balances.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {data?.stock_check?.items?.length > 0 && (
                <Card className="border-red-200">
                    <CardHeader>
                        <CardTitle className="text-red-700">Stock Discrepancies Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                            {JSON.stringify(data.stock_check.items, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
