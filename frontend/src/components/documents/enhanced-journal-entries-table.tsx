'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { PiDotsThreeBold, PiChartLineBold, PiFileTextBold, PiMagnifyingGlassBold } from 'react-icons/pi';
import { useRouter } from 'next/navigation';

interface EnhancedJournalEntriesTableProps {
    entries: any[];
    locale: string;
}

// PHASE C: Clickable journal entries with drill-down!
export function EnhancedJournalEntriesTable({ entries, locale }: EnhancedJournalEntriesTableProps) {
    const router = useRouter();

    if (!entries || entries.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No journal entries yet. Post the document to see accounting entries.
            </div>
        );
    }

    // PHASE C: Navigate to account card
    const viewAccountCard = (accountId: number) => {
        router.push(`/${locale}/directories/accounts/${accountId}`);
    };

    // PHASE C: Navigate to turnover report
    const viewAccountTurnover = (accountId: number) => {
        router.push(`/${locale}/reports/account-turnover?account=${accountId}`);
    };

    // PHASE C: Analyze account
    const analyzeAccount = (accountId: number) => {
        router.push(`/${locale}/reports/account-analysis?account=${accountId}`);
    };

    return (
        <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[150px]">Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-[150px]">Debit</TableHead>
                        <TableHead className="text-right w-[150px]">Credit</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entries.map((entry, index) => (
                        <TableRow key={index} className="group hover:bg-blue-50/50">
                            {/* Date (if needed, otherwise assumed document date) */}

                            {/* Debit Account */}
                            <TableCell className="align-top">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg font-mono text-primary">
                                            {entry.debit_account_code || entry.debit_account?.code}
                                        </span>
                                        {/* Future: Subconto Drill-down */}
                                    </div>
                                    <span className="text-xs text-muted-foreground line-clamp-1">
                                        {entry.debit_account_name || entry.debit_account?.name}
                                    </span>
                                    {/* Debit Subconto/Analytics */}
                                    {(entry.debit_subconto || entry.debit_analytics) && (
                                        <div className="mt-1 text-xs bg-slate-100 p-1 rounded">
                                            {entry.debit_subconto || entry.debit_analytics}
                                        </div>
                                    )}
                                </div>
                            </TableCell>

                            {/* Credit Account */}
                            <TableCell className="align-top">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg font-mono text-primary">
                                            {entry.credit_account_code || entry.credit_account?.code}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground line-clamp-1">
                                        {entry.credit_account_name || entry.credit_account?.name}
                                    </span>
                                    {/* Credit Subconto/Analytics */}
                                    {(entry.credit_subconto || entry.credit_analytics) && (
                                        <div className="mt-1 text-xs bg-slate-100 p-1 rounded">
                                            {entry.credit_subconto || entry.credit_analytics}
                                        </div>
                                    )}
                                </div>
                            </TableCell>

                            {/* Amount */}
                            <TableCell className="text-right align-top">
                                <span className="font-mono text-base font-bold">
                                    {/* Handle pure amount or debit/credit specific if data structure differs */}
                                    {Number(entry.amount || entry.debit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                                {entry.currency && entry.currency !== 'UZS' && (
                                    <div className="text-xs text-muted-foreground">
                                        {Number(entry.currency_amount).toFixed(2)} {entry.currency}
                                    </div>
                                )}
                            </TableCell>

                            {/* Content / Description */}
                            <TableCell className="align-top text-sm text-gray-600">
                                {entry.description || entry.content || '-'}
                            </TableCell>

                            <TableCell className="align-top">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <PiDotsThreeBold className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => viewAccountCard(entry.debit_account_id)}>
                                            Debit Account Card
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => viewAccountCard(entry.credit_account_id)}>
                                            Credit Account Card
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}

                    {/* Totals row */}
                    <TableRow className="bg-muted font-bold border-t-2 border-slate-300">
                        <TableCell colSpan={2} className="text-right">TOTAL:</TableCell>
                        <TableCell className="text-right font-mono text-lg">
                            {entries.reduce((sum, e) => sum + Number(e.amount || e.debit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    );
}
