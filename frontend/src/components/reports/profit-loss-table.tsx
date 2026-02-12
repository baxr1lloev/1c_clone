'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { DrillDownCell } from '@/components/ui/drill-down-cell';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import { PiInfo, PiCaretRight, PiCaretDown } from 'react-icons/pi';
import { cn } from '@/lib/utils';

interface PLItem {
    id: string;
    name: string;
    level: number;
    type: 'income' | 'expense' | 'total' | 'group_header' | 'final_total';
    amount: number;
    amount_prev: number;
    change_percent: number;
    formula?: string;
    is_calculated?: boolean;
    is_group?: boolean;
    drill_down_filter?: {
        account: string;
        type: 'debit' | 'credit';
    };
}

interface ProfitLossTableProps {
    data: PLItem[];
    startDate: string;
    endDate: string;
}

export function ProfitLossTable({ data, startDate, endDate }: ProfitLossTableProps) {
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const tPlTable = useTranslations('reports.profitLossPage.table');

    // Toggle group collapse
    const toggleGroup = (id: string) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const visibleData = data.reduce(
        (acc, item) => {
            if (item.type === 'group_header') {
                const isCollapsed = collapsedGroups[item.id] || false;
                return {
                    currentGroupCollapsed: isCollapsed,
                    rows: [...acc.rows, item],
                };
            }

            if (item.level > 0 && acc.currentGroupCollapsed) {
                return acc;
            }

            const nextCollapsed = item.level === 0 ? false : acc.currentGroupCollapsed;
            return {
                currentGroupCollapsed: nextCollapsed,
                rows: [...acc.rows, item],
            };
        },
        {
            currentGroupCollapsed: false,
            rows: [] as PLItem[],
        }
    ).rows;

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[400px]">{tPlTable('indicator')}</TableHead>
                        <TableHead className="text-right">{tPlTable('currentPeriod')}</TableHead>
                        <TableHead className="text-right text-muted-foreground">{tPlTable('previousPeriod')}</TableHead>
                        <TableHead className="text-right text-muted-foreground">{tPlTable('change')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visibleData.map((row) => (
                        <TableRow
                            key={row.id}
                            className={cn(
                                row.type === 'final_total' && "bg-muted/30 font-bold text-lg border-t-2 border-black",
                                row.type === 'total' && "font-bold border-t border-gray-300",
                                row.type === 'group_header' && "bg-gray-50/50 cursor-pointer hover:bg-gray-100"
                            )}
                            onClick={() => row.type === 'group_header' && toggleGroup(row.id)}
                        >
                            <TableCell>
                                <div
                                    className="flex items-center gap-2"
                                    style={{ paddingLeft: `${row.level * 24}px` }}
                                >
                                    {row.type === 'group_header' && (
                                        <div className="w-4 h-4 flex items-center justify-center">
                                            {collapsedGroups[row.id] ? <PiCaretRight /> : <PiCaretDown />}
                                        </div>
                                    )}

                                    <span className={cn(
                                        row.type === 'income' && "text-emerald-700",
                                        row.type === 'expense' && "text-slate-700",
                                        row.type === 'final_total' && row.amount < 0 && "text-red-600"
                                    )}>
                                        {row.name}
                                    </span>

                                    {row.formula && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <PiInfo className="h-4 w-4 text-muted-foreground/50 hover:text-primary transition-colors" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="font-mono text-xs">{row.formula}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </div>
                            </TableCell>

                            <TableCell className="text-right font-mono">
                                {row.drill_down_filter ? (
                                    <DrillDownCell
                                        value={row.amount}
                                        steps={[
                                            { label: tPlTable('report'), onClick: () => { } },
                                            {
                                                label: tPlTable('journalEntries'),
                                                url: `/registers/journal-entries?account=${row.drill_down_filter.account}&type=${row.drill_down_filter.type}&from=${startDate}&to=${endDate}`
                                            }
                                        ]}
                                        className={cn(
                                            row.amount < 0 && "text-red-600",
                                            row.amount > 0 && row.type === 'income' && "text-emerald-600"
                                        )}
                                    />
                                ) : (
                                    <span className={cn(
                                        row.amount < 0 && "text-red-600",
                                        row.amount > 0 && row.type === 'income' && "text-emerald-600"
                                    )}>
                                        {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                )}
                            </TableCell>

                            <TableCell className="text-right font-mono text-muted-foreground">
                                {row.amount_prev !== 0 ? row.amount_prev.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                            </TableCell>

                            <TableCell className="text-right font-mono text-xs">
                                {row.change_percent !== 0 && (
                                    <span className={cn(
                                        row.change_percent > 0 ? "text-green-600" : "text-red-600"
                                    )}>
                                        {row.change_percent > 0 ? '+' : ''}{row.change_percent.toFixed(1)}%
                                    </span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
