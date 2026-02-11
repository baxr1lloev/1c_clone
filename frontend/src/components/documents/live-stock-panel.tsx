'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    PiPackageBold,
    PiWarningCircleBold,
    PiCheckCircleBold,
    PiArrowRightBold
} from 'react-icons/pi';
import { cn } from '@/lib/utils';

interface StockItem {
    item_id: number;
    item_name: string;
    item_sku?: string;
    on_stock: number;
    reserved: number;
    available: number;
}

interface PredictionItem extends StockItem {
    change: number;
    after_posting: number;
    is_negative: boolean;
}

interface LiveStockPanelProps {
    warehouseId: number | null;
    lines: Array<{ item: number; quantity: number }>;
    operation?: 'IN' | 'OUT';
}

export function LiveStockPanel({ warehouseId, lines, operation = 'OUT' }: LiveStockPanelProps) {
    const itemIds = lines.map(l => l.item).filter(Boolean);

    // Fetch current stock
    const { data: stockData, isLoading } = useQuery({
        queryKey: ['operational-stock', warehouseId, itemIds.join(',')],
        queryFn: async () => {
            if (!warehouseId || itemIds.length === 0) return { items: [] };
            const response = await api.get('/registers/operational/stock-info/', {
                params: { warehouse: warehouseId, items: itemIds.join(',') }
            });
            return response as { items: StockItem[] };
        },
        enabled: !!warehouseId && itemIds.length > 0,
        refetchInterval: 10000, // Refresh every 10 seconds
    });

    // Fetch prediction (after posting)
    const { data: predictionData } = useQuery({
        queryKey: ['operational-stock-predict', warehouseId, lines, operation],
        queryFn: async () => {
            if (!warehouseId || lines.length === 0) return { items: [] };
            const response = await api.post('/registers/operational/stock-predict/', {
                warehouse: warehouseId,
                lines: lines.filter(l => l.item && l.quantity),
                operation
            });
            return response as { items: PredictionItem[] };
        },
        enabled: !!warehouseId && lines.some(l => l.item && l.quantity),
    });

    if (!warehouseId || itemIds.length === 0) {
        return null;
    }

    const hasNegative = predictionData?.items?.some(item => item.is_negative);

    return (
        <Card className={cn(
            "mt-4 border-l-4",
            hasNegative ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20" : "border-l-blue-500"
        )}>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <PiPackageBold className="h-4 w-4" />
                    Stock Availability
                    {hasNegative && (
                        <Badge variant="destructive" className="ml-auto">
                            <PiWarningCircleBold className="h-3 w-3 mr-1" />
                            Insufficient Stock
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-muted-foreground">
                                    <th className="text-left py-1 font-medium">Item</th>
                                    <th className="text-right py-1 font-medium">On Stock</th>
                                    <th className="text-right py-1 font-medium">Reserved</th>
                                    <th className="text-right py-1 font-medium">Available</th>
                                    <th className="text-center py-1 font-medium px-2">→</th>
                                    <th className="text-right py-1 font-medium">After</th>
                                </tr>
                            </thead>
                            <tbody>
                                {predictionData?.items?.map(item => (
                                    <tr key={item.item_id} className="border-b border-dashed last:border-0">
                                        <td className="py-1.5">
                                            <span className="font-medium">{item.item_name}</span>
                                            {item.item_sku && (
                                                <span className="text-xs text-muted-foreground ml-1">({item.item_sku})</span>
                                            )}
                                        </td>
                                        <td className="text-right py-1.5 font-mono">{item.on_stock.toFixed(0)}</td>
                                        <td className="text-right py-1.5 font-mono text-amber-600">{item.reserved.toFixed(0)}</td>
                                        <td className="text-right py-1.5 font-mono font-medium">{item.available.toFixed(0)}</td>
                                        <td className="text-center py-1.5">
                                            <span className={cn(
                                                "text-xs font-mono",
                                                item.change < 0 ? "text-red-600" : "text-green-600"
                                            )}>
                                                {item.change > 0 ? '+' : ''}{item.change.toFixed(0)}
                                            </span>
                                        </td>
                                        <td className={cn(
                                            "text-right py-1.5 font-mono font-bold",
                                            item.is_negative ? "text-red-600" : "text-green-600"
                                        )}>
                                            {item.after_posting.toFixed(0)}
                                            {item.is_negative && <PiWarningCircleBold className="inline h-3 w-3 ml-1" />}
                                            {!item.is_negative && <PiCheckCircleBold className="inline h-3 w-3 ml-1" />}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default LiveStockPanel;
