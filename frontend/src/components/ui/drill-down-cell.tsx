'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

interface DrillDownStep {
    label: string;
    url?: string;
    onClick?: () => void;
}

interface DrillDownCellProps {
    value: string | number;
    steps: DrillDownStep[];
    className?: string;
}

/**
 * Universal Drill-Down Cell - 1C Philosophy
 * 
 * Every number should be drill-down-able to its source.
 * 
 * Usage:
 *   <DrillDownCell
 *       value={50000}
 *       steps={[
 *           { label: 'P&L', url: '/reports/profit-loss' },
 *           { label: 'Journal Entries', url: '/registers/journal-entries?filter=...' },
 *           { label: 'Document', url: '/documents/sales/123' }
 *       ]}
 *   />
 */
export function DrillDownCell({ value, steps, className = '' }: DrillDownCellProps) {
    const router = useRouter();
    const [showBreadcrumb, setShowBreadcrumb] = useState(false);

    // Get the deepest (most specific) step
    const mainStep = steps[steps.length - 1];

    const handleClick = () => {
        if (mainStep.onClick) {
            mainStep.onClick();
        } else if (mainStep.url) {
            router.push(mainStep.url);
        }
    };

    return (
        <div
            className={`group relative ${className}`}
            onMouseEnter={() => setShowBreadcrumb(true)}
            onMouseLeave={() => setShowBreadcrumb(false)}
        >
            {/* Main clickable value */}
            <button
                onClick={handleClick}
                className="font-mono text-sm font-medium text-primary hover:underline cursor-pointer transition-colors"
            >
                {typeof value === 'number' ? value.toLocaleString() : value}
            </button>

            {/* Breadcrumb trail on hover */}
            {showBreadcrumb && steps.length > 1 && (
                <div className="absolute bottom-full left-0 mb-2 z-50 bg-popover border rounded-md shadow-lg p-2 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {steps.map((step, index) => (
                            <span key={index} className="flex items-center gap-1">
                                {step.url ? (
                                    <Link
                                        href={step.url}
                                        className="hover:text-primary hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {step.label}
                                    </Link>
                                ) : (
                                    <span>{step.label}</span>
                                )}
                                {index < steps.length - 1 && (
                                    <span className="text-muted-foreground/50">→</span>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
