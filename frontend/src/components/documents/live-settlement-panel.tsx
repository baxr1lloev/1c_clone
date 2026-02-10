'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
    PiMoneyBold,
    PiWarningCircleBold,
    PiCheckCircleBold,
    PiArrowRightBold
} from 'react-icons/pi';
import { cn } from '@/lib/utils';

interface SettlementInfo {
    counterparty_id: number;
    counterparty_name: string;
    debt_now: number;
    credit_limit: number;
    credit_remaining: number | null;
    is_over_limit: boolean;
}

interface SettlementPrediction extends SettlementInfo {
    change: number;
    debt_after: number;
}

interface LiveSettlementPanelProps {
    counterpartyId: number | null;
    contractId?: number | null;
    currencyId?: number | null;
    amount: number;
    operation?: 'ACCRUAL' | 'PAYMENT';
    currencyCode?: string;
}

export function LiveSettlementPanel({
    counterpartyId,
    contractId,
    currencyId,
    amount = 0,
    operation = 'ACCRUAL',
    currencyCode = 'USD'
}: LiveSettlementPanelProps) {

    // Fetch current settlement info
    const { data: settleData, isLoading } = useQuery({
        queryKey: ['operational-settlement', counterpartyId, contractId, currencyId],
        queryFn: async () => {
            if (!counterpartyId) return null;
            const response = await api.get('/registers/operational/settlement-info/', {
                params: {
                    counterparty: counterpartyId,
                    ...(contractId && { contract: contractId }),
                    ...(currencyId && { currency: currencyId })
                }
            });
            return response.data as SettlementInfo;
        },
        enabled: !!counterpartyId,
        refetchInterval: 10000,
    });

    // Fetch prediction (after posting)
    const { data: predictionData } = useQuery({
        queryKey: ['operational-settlement-predict', counterpartyId, contractId, currencyId, amount, operation],
        queryFn: async () => {
            if (!counterpartyId || !amount) return null;
            const response = await api.post('/registers/operational/settlement-predict/', {
                counterparty: counterpartyId,
                ...(contractId && { contract: contractId }),
                ...(currencyId && { currency: currencyId }),
                amount,
                operation
            });
            return response.data as SettlementPrediction;
        },
        enabled: !!counterpartyId && amount > 0,
    });

    if (!counterpartyId) {
        return null;
    }

    const formatAmount = (val: number) =>
        val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const creditLimit = settleData?.credit_limit || 0;
    const debtNow = settleData?.debt_now || 0;
    const debtAfter = predictionData?.debt_after ?? debtNow;
    const isOverLimit = predictionData?.is_over_limit || false;
    const creditUsageNow = creditLimit > 0 ? (debtNow / creditLimit) * 100 : 0;
    const creditUsageAfter = creditLimit > 0 ? (debtAfter / creditLimit) * 100 : 0;

    return (
        <Card className={cn(
            "mt-4 border-l-4",
            isOverLimit ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20" : "border-l-green-500"
        )}>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <PiMoneyBold className="h-4 w-4" />
                    Settlement Status
                    {isOverLimit && (
                        <Badge variant="destructive" className="ml-auto">
                            <PiWarningCircleBold className="h-3 w-3 mr-1" />
                            Over Credit Limit
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Counterparty Name */}
                        <div className="text-sm text-muted-foreground">
                            {settleData?.counterparty_name}
                        </div>

                        {/* Current Debt */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <div className="text-muted-foreground text-xs uppercase tracking-wide">Debt Now</div>
                                <div className="font-mono font-medium text-lg">
                                    {formatAmount(debtNow)} {currencyCode}
                                </div>
                            </div>

                            {creditLimit > 0 && (
                                <div>
                                    <div className="text-muted-foreground text-xs uppercase tracking-wide">Credit Limit</div>
                                    <div className="font-mono font-medium text-lg">
                                        {formatAmount(creditLimit)} {currencyCode}
                                    </div>
                                </div>
                            )}

                            {creditLimit > 0 && (
                                <div>
                                    <div className="text-muted-foreground text-xs uppercase tracking-wide">Available</div>
                                    <div className={cn(
                                        "font-mono font-medium text-lg",
                                        (settleData?.credit_remaining || 0) < 0 ? "text-red-600" : "text-green-600"
                                    )}>
                                        {formatAmount(settleData?.credit_remaining || 0)} {currencyCode}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Credit Usage Progress */}
                        {creditLimit > 0 && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Credit Usage</span>
                                    <span className="font-mono">{creditUsageNow.toFixed(0)}%</span>
                                </div>
                                <Progress
                                    value={Math.min(creditUsageNow, 100)}
                                    className={cn(
                                        "h-2",
                                        creditUsageNow > 80 ? "[&>div]:bg-amber-500" : "",
                                        creditUsageNow >= 100 ? "[&>div]:bg-red-500" : ""
                                    )}
                                />
                            </div>
                        )}

                        {/* After Posting Prediction */}
                        {amount > 0 && predictionData && (
                            <div className="pt-2 border-t">
                                <div className="flex items-center gap-2 mb-2">
                                    <PiArrowRightBold className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">After Posting</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-muted-foreground text-xs">Change</div>
                                        <div className={cn(
                                            "font-mono font-medium",
                                            predictionData.change > 0 ? "text-red-600" : "text-green-600"
                                        )}>
                                            {predictionData.change > 0 ? '+' : ''}{formatAmount(predictionData.change)} {currencyCode}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-muted-foreground text-xs">Debt After</div>
                                        <div className={cn(
                                            "font-mono font-bold text-lg",
                                            isOverLimit ? "text-red-600" : "text-green-600"
                                        )}>
                                            {formatAmount(debtAfter)} {currencyCode}
                                            {isOverLimit && <PiWarningCircleBold className="inline h-4 w-4 ml-1" />}
                                            {!isOverLimit && creditLimit > 0 && <PiCheckCircleBold className="inline h-4 w-4 ml-1" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Updated Credit Usage */}
                                {creditLimit > 0 && (
                                    <div className="space-y-1 mt-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Credit After</span>
                                            <span className={cn("font-mono", isOverLimit ? "text-red-600" : "")}>
                                                {creditUsageAfter.toFixed(0)}%
                                            </span>
                                        </div>
                                        <Progress
                                            value={Math.min(creditUsageAfter, 100)}
                                            className={cn(
                                                "h-2",
                                                creditUsageAfter > 80 ? "[&>div]:bg-amber-500" : "",
                                                creditUsageAfter >= 100 ? "[&>div]:bg-red-500" : ""
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default LiveSettlementPanel;
