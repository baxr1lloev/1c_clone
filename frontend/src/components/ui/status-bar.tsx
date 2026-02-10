import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBarProps {
    totalRecords: number;
    filteredCount?: number;
    selectedCount?: number;
    isLoading?: boolean;
    className?: string;
}

export function StatusBar({
    totalRecords,
    filteredCount,
    selectedCount = 0,
    isLoading = false,
    className
}: StatusBarProps) {
    const showFiltered = filteredCount !== undefined && filteredCount < totalRecords;

    return (
        <div className={cn(
            "border-t bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground flex justify-between items-center",
            className
        )}>
            <div className="flex items-center gap-4">
                <span>
                    <span className="font-medium">{totalRecords}</span> {totalRecords === 1 ? 'record' : 'records'}
                </span>

                {showFiltered && (
                    <>
                        <span className="text-muted-foreground/50">|</span>
                        <span>
                            <span className="font-medium">{filteredCount}</span> filtered
                        </span>
                    </>
                )}

                {selectedCount > 0 && (
                    <>
                        <span className="text-muted-foreground/50">|</span>
                        <span className="text-primary">
                            <span className="font-medium">{selectedCount}</span> selected
                        </span>
                    </>
                )}
            </div>

            <div className="flex items-center gap-2">
                {isLoading ? (
                    <span className="text-amber-600 dark:text-amber-400">Loading...</span>
                ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">Ready</span>
                )}
            </div>
        </div>
    );
}
