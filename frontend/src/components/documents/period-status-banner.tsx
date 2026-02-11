"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePeriodStatus } from "@/hooks/use-period-status";
import { PiLockKeyBold } from "react-icons/pi";
import { useState } from "react";

interface PeriodStatusBannerProps {
    date: string | Date;
    className?: string;
}

/**
 * ENTERPRISE: Period Closed Indicator
 * 
 * Shows banner when period is closed to prevent user from trying to edit.
 * This makes backend protection VISIBLE to avoid "Что за фигня?" moments.
 */
export function PeriodStatusBanner({ date, className }: PeriodStatusBannerProps) {
    const { data: periodStatus, isLoading } = usePeriodStatus(date);
    const [showReopenModal, setShowReopenModal] = useState(false);

    // Don't show anything if loading or period is open
    if (isLoading || !periodStatus?.is_closed) {
        return null;
    }

    return (
        <Alert variant="destructive" className={className}>
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    <PiLockKeyBold className="h-5 w-5 mt-0.5" />
                    <div>
                        <AlertTitle className="text-base font-bold mb-2">
                            🔒 Period {periodStatus.period} is CLOSED
                        </AlertTitle>
                        <AlertDescription className="space-y-1 text-sm">
                            {periodStatus.accounting_closed && (
                                <div className="flex items-center gap-2">
                                    <Badge variant="destructive">Accounting Closed</Badge>
                                    <span className="text-muted-foreground">
                                        Cannot post/unpost documents or create movements
                                    </span>
                                </div>
                            )}
                            {periodStatus.operational_closed && (
                                <div className="flex items-center gap-2">
                                    <Badge variant="destructive">Operational Closed</Badge>
                                    <span className="text-muted-foreground">
                                        Cannot modify stock or settlements
                                    </span>
                                </div>
                            )}

                            <div className="mt-3 pt-2 border-t text-xs text-muted-foreground">
                                <div>Closed by: <span className="font-medium text-foreground">{periodStatus.closed_by}</span></div>
                                <div>Date: <span className="font-medium text-foreground">
                                    {periodStatus.closed_at ? new Date(periodStatus.closed_at).toLocaleString() : 'Unknown'}
                                </span></div>
                            </div>
                        </AlertDescription>
                    </div>
                </div>

                {periodStatus.can_reopen && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="ml-4"
                        onClick={() => setShowReopenModal(true)}
                    >
                        ⚠️ Reopen Period
                    </Button>
                )}
            </div>
        </Alert>
    );
}
