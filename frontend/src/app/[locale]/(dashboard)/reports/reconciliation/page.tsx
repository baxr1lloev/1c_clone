'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DrillDownCell } from '@/components/ui/drill-down-cell';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

export default function ReconciliationReportPage() {
    const { data: report, isLoading, refetch } = useQuery({
        queryKey: ['reconciliation-report'],
        queryFn: async () => {
            // In prod add ?type=full
            return api.get('/reports/reconciliation/');
        },
    });

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!report) return null;

    const StatusIcon = ({ status }: { status: boolean }) => {
        return status ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
        );
    };

    const StatusBadge = ({ status }: { status: boolean }) => {
        return status ? (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">Reconciled</Badge>
        ) : (
            <Badge variant="destructive">Discrepancy</Badge>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reconciliation Report</h1>
                    <p className="text-muted-foreground">
                        Level 6: «Residues converge everywhere» — Automated cross-check for accountant trust.
                    </p>
                </div>
                <Button onClick={() => refetch()}>Refresh Check</Button>
            </div>

            {/* Overall Status */}
            {report.overall_status === 'OK' ? (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800 dark:text-green-300">Great Job! All Systems Clean.</AlertTitle>
                    <AlertDescription className="text-green-700 dark:text-green-400">
                        Registers match Accounting. Internal consistency verified.
                    </AlertDescription>
                </Alert>
            ) : (
                <Alert variant="destructive">
                    <AlertOctagon className="h-4 w-4" />
                    <AlertTitle>Attention Required</AlertTitle>
                    <AlertDescription>
                        Discrepancies found between operational registers and accounting data. Drill down below to fix.
                    </AlertDescription>
                </Alert>
            )}

            {/* 1. Stock Register vs Accounting (Account 41xx) */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <StatusIcon status={report.stock_check.is_reconciled} />
                                Stock Register vs Accounting (41xx)
                            </CardTitle>
                            <CardDescription>
                                Compares Total Stock Balance cache vs Account 41xx balance
                            </CardDescription>
                        </div>
                        <StatusBadge status={report.stock_check.is_reconciled} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-muted/50 p-4 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Stock Register (Qty)</div>
                            <div className="text-2xl font-mono font-medium">
                                {report.stock_check.register_cache_qty.toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Accounting Balance 41xx</div>
                            <div className="text-2xl font-mono font-medium">
                                <DrillDownCell
                                    value={report.stock_check.accounting_balance}
                                    steps={[{ label: 'Trial Balance 41', url: '/accounting/trial-balance?account=41' }]}
                                />
                            </div>
                        </div>
                        <div className={`p-4 rounded-lg ${report.stock_check.register_vs_accounting_diff === 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                            <div className="text-sm text-muted-foreground mb-1">Difference</div>
                            <div className={`text-2xl font-mono font-bold ${report.stock_check.register_vs_accounting_diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {report.stock_check.register_vs_accounting_diff === 0 ? '0.00' : report.stock_check.register_vs_accounting_diff.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {!report.stock_check.is_reconciled && (
                        <div className="mt-4">
                            <h4 className="text-sm font-semibold mb-2">Detailed Breakdown (Top 50)</h4>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Warehouse</TableHead>
                                        <TableHead className="text-right">Register Qty</TableHead>
                                        <TableHead className="text-right">Register Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report.stock_check.items.map((item: any) => (
                                        <TableRow key={`${item.item_id}-${item.warehouse_id}`}>
                                            <TableCell>{item.item_name}</TableCell>
                                            <TableCell>{item.warehouse_name}</TableCell>
                                            <TableCell className="text-right font-mono">{item.register_qty}</TableCell>
                                            <TableCell className="text-right font-mono">{item.register_amount.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 2. Settlements vs Accounting (Account 60/62) */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <StatusIcon status={report.settlements_check.is_reconciled} />
                                Settlements vs Accounting (60xx/62xx)
                            </CardTitle>
                            <CardDescription>
                                Compares Settlement Register vs Accounts 60 (Payables) & 62 (Receivables)
                            </CardDescription>
                        </div>
                        <StatusBadge status={report.settlements_check.is_reconciled} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-muted/50 p-4 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Register Total</div>
                            <div className="text-xl font-mono font-medium">
                                {report.settlements_check.register_total.toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Receivables (62xx)</div>
                            <div className="text-xl font-mono font-medium">
                                {report.settlements_check.receivables_balance.toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Payables (60xx)</div>
                            <div className="text-xl font-mono font-medium text-red-500">
                                {report.settlements_check.payables_balance.toLocaleString()}
                            </div>
                        </div>
                        <div className={`p-4 rounded-lg ${report.settlements_check.is_reconciled ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                            <div className="text-sm text-muted-foreground mb-1">Accounting Net</div>
                            <div className={`text-xl font-mono font-bold ${report.settlements_check.is_reconciled ? 'text-green-600' : 'text-red-600'}`}>
                                {report.settlements_check.accounting_net.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 3. Internal Consistency (Movement vs Cache) */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <StatusIcon status={report.consistency_check.is_consistent} />
                                Internal Consistency Check
                            </CardTitle>
                            <CardDescription>
                                Verifies that StockBalance cache matches sum of StockMovements
                            </CardDescription>
                        </div>
                        <StatusBadge status={report.consistency_check.is_consistent} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-8 mb-4">
                        <div>
                            <span className="text-sm text-muted-foreground">Checked Records: </span>
                            <span className="font-mono font-medium">{report.consistency_check.total_checked}</span>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Discrepancies: </span>
                            <span className={`font-mono font-medium ${report.consistency_check.discrepancies_count > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {report.consistency_check.discrepancies_count}
                            </span>
                        </div>
                    </div>

                    {report.consistency_check.discrepancies.length > 0 && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead className="text-right">Cache Qty</TableHead>
                                    <TableHead className="text-right">Movement Sum</TableHead>
                                    <TableHead className="text-right">Diff</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {report.consistency_check.discrepancies.map((d: any, i: number) => (
                                    <TableRow key={i}>
                                        <TableCell>{d.item_name}</TableCell>
                                        <TableCell>{d.warehouse_name}</TableCell>
                                        <TableCell className="text-right font-mono">{d.cache_qty}</TableCell>
                                        <TableCell className="text-right font-mono">{d.movement_qty}</TableCell>
                                        <TableCell className="text-right font-mono text-red-500">{d.difference}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
