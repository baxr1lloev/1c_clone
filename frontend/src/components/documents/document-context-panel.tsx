'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ReferenceLink } from '@/components/ui/reference-link';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
    PiWarningCircleBold,
    PiXCircleBold
} from 'react-icons/pi';

interface DocumentContextPanelProps {
    customerId?: number;
    itemId?: number;
    warehouseId?: number;
}

// PHASE D: Risk level calculation
function getRiskLevel(debt: number, limit: number, overdueDays: number) {
    if (overdueDays > 30) return 'critical';
    if (debt > limit) return 'danger';
    if (debt > limit * 0.8) return 'warning';
    return 'ok';
}

function getRiskColor(level: string) {
    switch (level) {
        case 'critical':
            return 'bg-red-100 border-red-500 text-red-900';
        case 'danger':
            return 'bg-orange-100 border-orange-500 text-orange-900';
        case 'warning':
            return 'bg-yellow-100 border-yellow-500 text-yellow-900';
        default:
            return 'bg-green-100 border-green-500 text-green-900';
    }
}

export function DocumentContextPanel({
    customerId,
    itemId,
    warehouseId
}: DocumentContextPanelProps) {
    const tFields = useTranslations('fields');
    const tContext = useTranslations('documents.detail.context');

    // Fetch customer context
    const { data: customerInfo, isLoading: loadingCustomer } = useQuery({
        queryKey: ['customer-context', customerId],
        queryFn: async () => {
            const response = await api.get(`/counterparties/${customerId}/context`);
            return response;
        },
        enabled: !!customerId,
    });

    // Fetch item stock context
    const { data: itemStock, isLoading: loadingStock } = useQuery({
        queryKey: ['item-stock-context', itemId, warehouseId],
        queryFn: async () => {
            const response = await api.get(`/items/${itemId}/stock`, {
                params: { warehouse: warehouseId }
            });
            return response;
        },
        enabled: !!itemId && !!warehouseId,
    });

    if (!customerId && !itemId) {
        return null;
    }

    // PHASE D: Calculate risk
    const riskLevel = customerInfo
        ? getRiskLevel(
            customerInfo.debt || 0,
            customerInfo.credit_limit || 0,
            customerInfo.overdue_days || 0
        )
        : 'ok';

    return (
        <Card className="sticky top-20">
            <CardHeader>
                <CardTitle className="text-sm uppercase text-muted-foreground">{tContext('title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Customer Context */}
                {customerId && (
                    <div className="space-y-4">
                        {loadingCustomer ? (
                            <>
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </>
                        ) : customerInfo ? (
                            <>
                                {/* PHASE D: Risk Alert */}
                                {riskLevel !== 'ok' && (
                                    <Alert className={cn("border-2", getRiskColor(riskLevel))}>
                                        {riskLevel === 'critical' && <PiXCircleBold className="h-5 w-5" />}
                                        {riskLevel === 'danger' && <PiWarningCircleBold className="h-5 w-5" />}
                                        {riskLevel === 'warning' && <PiWarningCircleBold className="h-5 w-5" />}
                                        <AlertTitle className="font-bold">
                                            {riskLevel === 'critical' && tContext('risk.blocked')}
                                            {riskLevel === 'danger' && tContext('risk.limitExceeded')}
                                            {riskLevel === 'warning' && tContext('risk.attention')}
                                        </AlertTitle>
                                        <AlertDescription>
                                            {customerInfo.overdue_days > 30 && (
                                                <div className="font-bold">
                                                    {tContext('risk.overdue')}: {customerInfo.overdue_days} {tContext('days')}
                                                </div>
                                            )}
                                            {customerInfo.debt > customerInfo.credit_limit && (
                                                <div>
                                                    {tContext('risk.debtExceededBy')}{' '}
                                                    {(customerInfo.debt - customerInfo.credit_limit).toFixed(2)} UZS
                                                </div>
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase">
                                        {tContext('customerDebt')}
                                    </Label>
                                    <div className={cn(
                                        "text-3xl font-bold font-mono mt-1",
                                        customerInfo.debt > 0 ? "text-red-600" : "text-green-600"
                                    )}>
                                        {customerInfo.debt?.toLocaleString('en-US', {
                                            minimumFractionDigits: 2
                                        })} UZS
                                    </div>
                                    {customerInfo.overdue_days > 0 && (
                                        <Badge variant="destructive" className="mt-2">
                                            ⚠️ {customerInfo.overdue_days} {tContext('daysOverdue')}
                                        </Badge>
                                    )}
                                </div>

                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase">
                                        {tContext('creditLimit')}
                                    </Label>
                                    <Progress
                                        value={(customerInfo.used_credit / customerInfo.credit_limit) * 100}
                                        className={cn(
                                            "mt-2 h-3",
                                            customerInfo.used_credit > customerInfo.credit_limit && "bg-red-200"
                                        )}
                                    />
                                    <div className="text-xs mt-1 font-mono flex justify-between">
                                        <span>{customerInfo.used_credit?.toFixed(2)}</span>
                                        <span className="text-muted-foreground">
                                            / {customerInfo.credit_limit?.toFixed(2)}
                                        </span>
                                    </div>
                                    {customerInfo.used_credit > customerInfo.credit_limit && (
                                        <Badge variant="destructive" className="mt-2 w-full justify-center">
                                            {tContext('overLimit')}
                                        </Badge>
                                    )}
                                </div>

                                {/* PHASE D: Last payment */}
                                {customerInfo.last_payment_date && (
                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <Label className="text-xs text-muted-foreground uppercase">
                                            {tContext('lastPayment')}
                                        </Label>
                                        <div className="text-sm font-medium mt-1">
                                            {new Date(customerInfo.last_payment_date).toLocaleDateString()}
                                        </div>
                                        {customerInfo.last_payment_amount && (
                                            <div className="font-mono text-sm text-green-600">
                                                {customerInfo.last_payment_amount.toLocaleString()} UZS
                                            </div>
                                        )}
                                    </div>
                                )}

                                {customerInfo.recent_docs && customerInfo.recent_docs.length > 0 && (
                                    <div>
                                        <Label className="text-xs text-muted-foreground uppercase">
                                            {tContext('recentDocuments')}
                                        </Label>
                                        <div className="space-y-1 mt-2">
                                            {customerInfo.recent_docs.slice(0, 5).map((doc: {
                                                id: number;
                                                type: string;
                                                number: string;
                                                amount?: number;
                                            }) => (
                                                <div key={doc.id} className="flex items-center justify-between text-sm p-2 hover:bg-gray-50 rounded">
                                                    <ReferenceLink
                                                        id={doc.id}
                                                        type={doc.type}
                                                        label={doc.number}
                                                    />
                                                    <span className="text-muted-foreground font-mono text-xs">
                                                        {doc.amount?.toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                )}

                {/* Item Stock Context */}
                {itemId && warehouseId && (
                    <div className="space-y-4">
                        {loadingStock ? (
                            <>
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                            </>
                        ) : itemStock ? (
                            <>
                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase">
                                        {tContext('stockBalance')}
                                    </Label>
                                    <div className="space-y-2 mt-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm">{tContext('onHand')}:</span>
                                            <span className="font-mono font-bold text-lg">{itemStock.on_hand}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-muted-foreground">
                                            <span className="text-sm">{tFields('reserved')}:</span>
                                            <span className="font-mono">{itemStock.reserved}</span>
                                        </div>
                                        <div className="border-t pt-2 flex justify-between items-center">
                                            <span className="text-sm font-bold">{tFields('available')}:</span>
                                            <span className={cn(
                                                "font-mono font-bold text-xl",
                                                itemStock.available > 0 ? "text-green-600" : "text-red-600"
                                            )}>
                                                {itemStock.available}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
