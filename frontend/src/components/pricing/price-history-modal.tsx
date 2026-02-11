'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, DollarSign, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import { formatNumber, formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface PriceHistoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemId: number;
    item Name ?: string;
}

interface PriceHistoryEntry {
    date: string;
    price: string;
    document_type: 'sale' | 'purchase';
    document_number: string;
    document_id: number;
    counterparty_name: string;
}

export function PriceHistoryModal({ open, onOpenChange, itemId, itemName }: PriceHistoryModalProps) {
    const { data: history, isLoading } = useQuery({
        queryKey: ['price-history', itemId],
        queryFn: async () => {
            const response = await api.get<PriceHistoryEntry[]>(`/documents/api/items/${itemId}/price-history/`);
            return response;
        },
        enabled: open
    });

    const getDocumentUrl = (entry: PriceHistoryEntry) => {
        return entry.document_type === 'sale'
            ? `/documents/sales/${entry.document_id}`
            : `/documents/purchases/${entry.document_id}`;
    };

    const getPriceChange = (index: number) => {
        if (!history || index === history.length - 1) return null;

        const current = parseFloat(history[index].price);
        const previous = parseFloat(history[index + 1].price);
        const change = ((current - previous) / previous) * 100;

        return {
            percent: change,
            isIncrease: change > 0
        };
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        История цен {itemName && `- ${itemName}`}
                    </DialogTitle>
                    <DialogDescription>
                        Полная история цен товара по всем документам
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[500px] overflow-y-auto">
                    {isLoading && (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {!isLoading && history && history.length === 0 && (
                        <div className="text-center p-8 text-muted-foreground">
                            Нет истории цен для этого товара
                        </div>
                    )}

                    {!isLoading && history && history.length > 0 && (
                        <div className="space-y-2">
                            {history.map((entry, index) => {
                                const change = getPriceChange(index);

                                return (
                                    <div
                                        key={`${entry.document_type}-${entry.document_id}`}
                                        className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant={entry.document_type === 'sale' ? 'default' : 'secondary'}
                                                        className="text-xs"
                                                    >
                                                        {entry.document_type === 'sale' ? 'Продажа' : 'Закупка'}
                                                    </Badge>
                                                    <Link
                                                        href={getDocumentUrl(entry)}
                                                        className="font-mono text-sm font-medium text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        {entry.document_number}
                                                        <ExternalLink className="h-3 w-3" />
                                                    </Link>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {entry.counterparty_name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(entry.date).toLocaleDateString('ru-RU', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="text-lg font-bold font-mono">
                                                    ${formatNumber(entry.price, 2)}
                                                </div>
                                                {change && (
                                                    <div className={`flex items-center gap-1 text-sm ${change.isIncrease ? 'text-red-600' : 'text-green-600'
                                                        }`}>
                                                        {change.isIncrease ? (
                                                            <TrendingUp className="h-3 w-3" />
                                                        ) : (
                                                            <TrendingDown className="h-3 w-3" />
                                                        )}
                                                        {Math.abs(change.percent).toFixed(1)}%
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
