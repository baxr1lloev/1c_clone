import { cn } from '@/lib/utils';

/**
 * Get row className based on status for conditional highlighting (1C-style)
 */
export function getDocumentRowClassName(status: string): string {
    switch (status) {
        case 'posted':
            return 'bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/30';
        case 'cancelled':
            return 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50 dark:hover:bg-red-950/30';
        case 'draft':
            return 'hover:bg-muted/50';
        default:
            return 'hover:bg-muted/50';
    }
}

/**
 * Get row className for counterparties based on is_active status
 */
export function getCounterpartyRowClassName(isActive: boolean): string {
    if (!isActive) {
        return 'bg-gray-50/50 dark:bg-gray-950/20 text-muted-foreground hover:bg-gray-100/50 dark:hover:bg-gray-950/30';
    }
    return 'hover:bg-muted/50';
}

/**
 * Get row className for items based on stock status
 */
export function getItemRowClassName(stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock'): string {
    switch (stockStatus) {
        case 'out_of_stock':
            return 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50 dark:hover:bg-red-950/30';
        case 'low_stock':
            return 'bg-yellow-50/50 dark:bg-yellow-950/20 hover:bg-yellow-100/50 dark:hover:bg-yellow-950/30';
        case 'in_stock':
            return 'hover:bg-muted/50';
        default:
            return 'hover:bg-muted/50';
    }
}

/**
 * Get row className for overdue items
 */
export function getOverdueRowClassName(isOverdue: boolean): string {
    if (isOverdue) {
        return 'bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/30';
    }
    return 'hover:bg-muted/50';
}

/**
 * Generic row className builder
 */
export function buildRowClassName(
    baseClassName: string,
    conditionalClassName?: string,
    isFocused?: boolean,
    isSelected?: boolean
): string {
    return cn(
        baseClassName,
        conditionalClassName,
        isSelected && 'bg-primary/10',
        isFocused && 'outline outline-2 outline-primary -outline-offset-2 z-10 bg-accent/50'
    );
}
