'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Calendar, Package, Search } from 'lucide-react';
import { DrillDownCell } from '@/components/ui/drill-down-cell';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

import { StockHistoryTable } from '@/components/reports/stock-history-table';

export default function StockAsOfDatePage() {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [warehouseId, setWarehouseId] = useState('');
    const [itemId, setItemId] = useState('');
    const [selectedItemHistory, setSelectedItemHistory] = useState<{ item: any, warehouseId: string } | null>(null);

    const { data: report, isLoading, refetch } = useQuery({
        queryKey: ['stock-as-of-date', date, warehouseId, itemId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (date) params.append('date', date);
            if (warehouseId) params.append('warehouse', warehouseId);
            if (itemId) params.append('item', itemId);
            return api.get(`/reports/stock-as-of-date/?${params.toString()}`);
        },
    });

    const handleItemClick = (item: any) => {
        setSelectedItemHistory({
            item,
            warehouseId: item.warehouse_id
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Stock Balance (As Of Date)</h1>
                <p className="text-muted-foreground">
                    Level 7: «I can restore history» — View stock balances at any point in the past.
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
                            <Label>Warehouse ID (Optional)</Label>
                            <Input
                                placeholder="ID"
                                value={warehouseId}
                                onChange={(e) => setWarehouseId(e.target.value)}
                                className="w-24"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Item ID (Optional)</Label>
                            <Input
                                placeholder="ID"
                                value={itemId}
                                onChange={(e) => setItemId(e.target.value)}
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
                                <TableHead>Item</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Warehouse</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {report?.items?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No stock found for this date.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                report?.items?.map((item: any, i: number) => (
                                    <TableRow key={i} className="group hover:bg-muted/50">
                                        <TableCell className="font-medium">
                                            <Button
                                                variant="link"
                                                className="p-0 h-auto font-medium decoration-dashed underline-offset-4"
                                                onClick={() => handleItemClick(item)}
                                            >
                                                {item.item_name}
                                            </Button>
                                        </TableCell>
                                        <TableCell>{item.item_sku || '-'}</TableCell>
                                        <TableCell>{item.warehouse_name}</TableCell>
                                        <TableCell className="text-right font-mono text-primary">
                                            {item.quantity.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {item.amount.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* History Modal */}
            <Dialog open={!!selectedItemHistory} onOpenChange={(open) => !open && setSelectedItemHistory(null)}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Stock Movement History</DialogTitle>
                        <DialogDescription>
                            Detailed history for {selectedItemHistory?.item.item_name} (Up to {date})
                        </DialogDescription>
                    </DialogHeader>
                    {selectedItemHistory && (
                        <StockHistoryTable
                            itemId={selectedItemHistory.item.item_id}
                            warehouseId={selectedItemHistory.warehouseId}
                            endDate={date}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
