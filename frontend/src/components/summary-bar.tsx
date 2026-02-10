import { cn } from '@/lib/utils';

interface SummaryBarProps {
    data: {
        label: string;
        value: number;
        currency?: string;
        variant?: 'default' | 'positive' | 'negative';
    }[];
    className?: string;
}

/**
 * Summary/Status Bar Component (1C style)
 * Fixed at bottom of screen showing real-time totals
 */
export function SummaryBar({ data, className }: SummaryBarProps) {
    return (
        <div
            className={cn(
                'sticky bottom-0 left-0 right-0 bg-muted/95 backdrop-blur border-t shadow-lg p-3 z-10',
                className
            )}
        >
            <div className="flex justify-between items-center gap-6">
                {data.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{item.label}:</span>
                        <span
                            className={cn(
                                'font-mono font-bold text-base',
                                item.variant === 'positive' && 'text-green-600 dark:text-green-400',
                                item.variant === 'negative' && 'text-red-600 dark:text-red-400'
                            )}
                        >
                            {item.value.toLocaleString()} {item.currency || '₸'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Example usage:
 * 
 * <SummaryBar
 *   data={[
 *     { label: 'Доходы', value: 15000000, variant: 'positive' },
 *     { label: 'Доходы', value: 12000000, variant: 'negative' },
 *     { label: 'Прибыль', value: 3000000, variant: 'positive' },
 *     { label: 'Клиенты', value: 5 }
 *   ]}
 * />
 */
