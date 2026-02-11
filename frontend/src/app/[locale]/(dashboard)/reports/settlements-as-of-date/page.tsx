'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Calendar, Search, ArrowRightLeft } from 'lucide-react';
import { DrillDownCell } from '@/components/ui/drill-down-cell';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export default function SettlementsAsOfDatePage() {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [counterpartyId, setCounterpartyId] = useState('');
    const [selectedHistory, setSelectedHistory] = useState<{ item: any, counterpartyId: string } | null>(null);

    const { data: report, isLoading, refetch } = useQuery({
        queryKey: ['settlements-as-of-date', date, counterpartyId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (date) params.append('date', date);
            if (counterpartyId) params.append('counterparty', counterpartyId);
            return api.get(`/reports/settlements-as-of-date/?${params.toString()}`);
        },
    });

    const handleHistoryClick = (item: any) => {
        setSelectedHistory({
            item,
            counterpartyId: item.counterparty_id
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Settlements Balance (As Of Date)</h1>
                <p className="text-muted-foreground">
                    Level 7: «I can restore history» — View debt status at any point in the past.
                </p>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Filter Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> As Of Date
                            </Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-40"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Counterparty ID (Optional)</Label>
                            <Input
                                placeholder="ID"
                                value={counterpartyId}
                                onChange={(e) => setCounterpartyId(e.target.value)}
                                className="w-24"
                            />
                        </div>

                        <Button onClick={() => refetch()} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Update Report
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Counterparty</TableHead>
                                <TableHead>Contract</TableHead>
                                <TableHead>Currency</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {report?.counterparties?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No settlements found for this date.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                report?.counterparties?.map((item: any, i: number) => (
                                    <TableRow key={i} className="group hover:bg-muted/50">
                                        <TableCell className="font-medium">
                                            <Button
                                                variant="link"
                                                className="p-0 h-auto font-medium decoration-dashed underline-offset-4"
                                                onClick={() => handleHistoryClick(item)}
                                            >
                                                {item.counterparty_name}
                                            </Button>
                                        </TableCell>
                                        <TableCell>{item.contract_name || '-'}</TableCell>
                                        <TableCell>{item.currency}</TableCell>
                                        <TableCell className={`text-right font-mono ${item.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            {item.amount > 0 ? (
                                                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Receivable</span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">Payable</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* History Modal */}
            <Dialog open={!!selectedHistory} onOpenChange={(open) => !open && setSelectedHistory(null)}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Settlement History</DialogTitle>
                        <DialogDescription>
                            Detailed history for {selectedHistory?.item.counterparty_name} (Up to {date})
                        </DialogDescription>
                    </DialogHeader>
                    {selectedHistory && (
                        <SettlementHistoryTable
                            counterpartyId={selectedHistory.counterpartyId}
                            endDate={date}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SettlementHistoryTable({ counterpartyId, endDate }: { counterpartyId: string, endDate: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['settlement-history', counterpartyId, endDate],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (counterpartyId) params.append('counterparty', counterpartyId);
            if (endDate) params.append('end', endDate);
            params.append('start', '2020-01-01');
            return api.get(`/reports/settlement-history/?${params.toString()}`);
        },
    });

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data?.movements?.map((m: any) => (
                    <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">
                            {format(new Date(m.date), 'yyyy-MM-dd HH:mm')}
                        </TableCell>
                        <TableCell>
                            <DrillDownCell
                                value={`${m.document_type} #${m.document_number}`}
                                steps={[{ label: 'Open Document', url: m.document_url }]}
                            />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.contract_name}</TableCell>
                        <TableCell className={`text-right font-mono ${m.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {m.amount > 0 ? '+' : ''}{m.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                            {m.running_balance.toLocaleString()}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
