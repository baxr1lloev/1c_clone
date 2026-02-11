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
                        <TableRow key={index} className="group hover:bg-blue-50">
                            <TableCell>
                                {/* PHASE C: Account is now clickable with context menu! */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="link"
                                            className="font-mono font-bold text-blue-600 hover:text-blue-800 p-0 h-auto"
                                        >
                                            {entry.account_code || entry.account?.code}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuItem onClick={() => viewAccountCard(entry.account_id || entry.account?.id)}>
                                            <PiFileTextBold className="mr-2 h-4 w-4" />
                                            Account Card
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => viewAccountTurnover(entry.account_id || entry.account?.id)}>
                                            <PiChartLineBold className="mr-2 h-4 w-4" />
                                            Turnover Report
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => analyzeAccount(entry.account_id || entry.account?.id)}>
                                            <PiMagnifyingGlassBold className="mr-2 h-4 w-4" />
                                            Analyze Account
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {entry.account?.name || entry.account_name}
                                </div>
                            </TableCell>
                            <TableCell className="text-sm">
                                {entry.description || entry.memo || '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                {entry.debit > 0 && (
                                    <span className="font-bold text-green-600">
                                        {entry.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                {entry.credit > 0 && (
                                    <span className="font-bold text-blue-600">
                                        {entry.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                )}
                            </TableCell>
                            <TableCell>
                                {/* Additional context menu */}
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
                                        <DropdownMenuItem>View Dimensions</DropdownMenuItem>
                                        <DropdownMenuItem>Related Entries</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}

                    {/* Totals row */}
                    <TableRow className="bg-muted font-bold">
                        <TableCell colSpan={2}>TOTAL</TableCell>
                        <TableCell className="text-right font-mono">
                            {entries.reduce((sum, e) => sum + (e.debit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                            {entries.reduce((sum, e) => sum + (e.credit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    );
}
