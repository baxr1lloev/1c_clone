'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface StockMovement {
    id: number;
    date: string;
    item: {
        id: number;
        name: string;
        sku: string;
    };
    warehouse: {
        id: number;
        name: string;
    };
    movement_type: string;
    direction: 'in' | 'out';
    quantity: number;
    unit_cost: number;
    total_cost: number;
}

interface MovementsTableProps {
    movements: StockMovement[] | undefined;
}

export function MovementsTable({ movements }: MovementsTableProps) {
    // Query logic removed, data passed from parent

    if (!movements) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!movements || movements.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                No stock movements found
            </div>
        );
    }

    const getDirectionIcon = (direction: 'in' | 'out') => {
        if (direction === 'in') {
            return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
        }
        return <ArrowDownCircle className="h-4 w-4 text-red-600" />;
    };

    const getMovementTypeBadge = (type: string) => {
        const typeMap: Record<string, { label: string; variant: any }> = {
            'receipt': { label: 'Receipt', variant: 'default' },
            'dispatch': { label: 'Dispatch', variant: 'secondary' },
            'transfer_out': { label: 'Transfer Out', variant: 'outline' },
            'transfer_in': { label: 'Transfer In', variant: 'outline' },
            'adjustment': { label: 'Adjustment', variant: 'destructive' },
        };

        const config = typeMap[type] || { label: type, variant: 'outline' };
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead className="w-[150px]">Date</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="w-[120px]">Type</TableHead>
                        <TableHead className="text-right w-[120px]">Quantity</TableHead>
                        <TableHead className="text-right w-[120px]">Unit Cost</TableHead>
                        <TableHead className="text-right w-[120px]">Total Cost</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {movements.map((movement) => (
                        <TableRow key={movement.id}>
                            <TableCell>
                                {getDirectionIcon(movement.direction)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                                {new Date(movement.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">{movement.item.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {movement.item.sku}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>{movement.warehouse.name}</TableCell>
                            <TableCell>
                                {getMovementTypeBadge(movement.movement_type)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                <span className={movement.direction === 'in' ? 'text-green-600' : 'text-red-600'}>
                                    {movement.direction === 'in' ? '+' : '-'}
                                    {formatNumber(movement.quantity)}
                                </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                {formatNumber(movement.unit_cost, 2)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                                {formatNumber(movement.total_cost, 2)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
