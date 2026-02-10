import { cn } from '@/lib/utils';

/**
 * Color-coded profit/loss cell component
 * Green for positive, Red for negative (1C style)
 */
export function ProfitCell({ value, currency = 'сўм' }: { value: number; currency?: string }) {
    return (
        <span
            className={cn(
                'font-mono font-bold',
                value > 0
                    ? 'text-green-600 dark:text-green-400'
                    : value < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
            )}
        >
            {value > 0 ? '+' : ''}
            {value.toLocaleString()} {currency}
        </span>
    );
}

/**
 * Multi-currency display component
 * Shows: Foreign Amount × Rate = Base Amount
 */
export function MultiCurrencyCell({
    amountForeign,
    rate,
    amountBase,
    currencyCode,
}: {
    amountForeign: number;
    rate: number;
    amountBase: number;
    currencyCode: string;
}) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="font-mono">{amountForeign.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">{currencyCode}</span>
            <span className="text-xs text-muted-foreground">×</span>
            <span className="text-xs">{rate.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground">=</span>
            <span className="font-mono font-bold">{amountBase.toLocaleString()} сўм</span>
        </div>
    );
}

/**
 * Status badge component (1C style)
 */
export function StatusBadge({ status }: { status: string }) {
    const variants = {
        draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
        posted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
        cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
        confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
        shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                variants[status as keyof typeof variants] || variants.draft
            )}
        >
            {status}
        </span>
    );
}

/**
 * Subtotal row component (yellow background like 1C)
 */
export function SubtotalRow({ label, values }: { label: string; values: Record<string, number> }) {
    return (
        <tr className="bg-yellow-100 dark:bg-yellow-900/20 font-semibold">
            <td className="px-4 py-2" colSpan={2}>
                {label}
            </td>
            {Object.entries(values).map(([key, value]) => (
                <td key={key} className="px-4 py-2 text-right font-mono">
                    {value.toLocaleString()}
                </td>
            ))}
        </tr>
    );
}

/**
 * Grand total row component (bold, bottom border)
 */
export function GrandTotalRow({ values }: { values: Record<string, number> }) {
    return (
        <tr className="border-t-2 border-primary font-bold bg-muted">
            <td className="px-4 py-3" colSpan={2}>
                ИТОГО / TOTAL
            </td>
            {Object.entries(values).map(([key, value]) => (
                <td key={key} className="px-4 py-3 text-right font-mono text-lg">
                    {value.toLocaleString()}
                </td>
            ))}
        </tr>
    );
}

/**
 * Percentage badge (for inventory remaining %)
 */
export function PercentageBadge({ value }: { value: number }) {
    const variant =
        value >= 75 ? 'bg-green-100 text-green-800' : value >= 25 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';

    return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', variant)}>
            {value.toFixed(0)}%
        </span>
    );
}

/**
 * Editable cell component (inline editing)
 */
import { useState } from 'react';

export function EditableCell({
    value,
    onSave,
    type = 'text',
}: {
    value: string | number;
    onSave: (newValue: string | number) => void;
    type?: 'text' | 'number';
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);

    if (isEditing) {
        return (
            <input
                type={type}
                value={editValue}
                onChange={(e) => setEditValue(type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                onBlur={() => {
                    onSave(editValue);
                    setIsEditing(false);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        onSave(editValue);
                        setIsEditing(false);
                    } else if (e.key === 'Escape') {
                        setEditValue(value);
                        setIsEditing(false);
                    }
                }}
                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
            />
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            onDoubleClick={() => setIsEditing(true)}
            className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
        >
            {value}
        </div>
    );
}
