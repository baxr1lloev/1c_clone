'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PackageDisplayProps {
    packageName?: string;
    packageQty: number;
    baseUnit: string;
    baseQty: number;
    coefficient?: number;
    showMode?: 'auto' | 'package' | 'base';
    className?: string;
}

/**
 * Package Display Component for Tables
 * 
 * Shows quantity in both package and base units:
 * - "5 Box = 60 pcs"
 * - Can toggle between package/base view
 */
export function PackageDisplay({
    packageName,
    packageQty,
    baseUnit,
    baseQty,
    coefficient,
    showMode = 'auto',
    className
}: PackageDisplayProps) {
    const hasPackage = packageName && coefficient && coefficient > 1;

    // Auto mode: show package if available, otherwise base
    const displayMode = showMode === 'auto'
        ? (hasPackage ? 'package' : 'base')
        : showMode;

    if (displayMode === 'package' && hasPackage) {
        return (
            <div className={cn("text-sm", className)}>
                <div className="font-medium">
                    {packageQty} {packageName}
                </div>
                <div className="text-xs text-muted-foreground">
                    = {baseQty} {baseUnit}
                </div>
            </div>
        );
    }

    // Base mode or no package
    return (
        <div className={cn("text-sm font-medium", className)}>
            {baseQty} {baseUnit}
        </div>
    );
}

/**
 * Compact inline version for tight spaces
 */
export function PackageDisplayInline({
    packageName,
    packageQty,
    baseUnit,
    baseQty,
    coefficient,
}: Omit<PackageDisplayProps, 'showMode' | 'className'>) {
    const hasPackage = packageName && coefficient && coefficient > 1;

    if (hasPackage) {
        return (
            <span className="text-sm">
                <span className="font-medium">{packageQty} {packageName}</span>
                <span className="text-xs text-muted-foreground ml-1">
                    ({baseQty} {baseUnit})
                </span>
            </span>
        );
    }

    return (
        <span className="text-sm font-medium">
            {baseQty} {baseUnit}
        </span>
    );
}
