"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ReportFilterBar } from "@/components/ui/report-filter-bar"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Mock Data for Bank Balance
const mockBankData = [
    { currency: 'USD', opening: 10000, debit: 5000, credit: 2000, closing: 13000 },
    { currency: 'UZS', opening: 5000000, debit: 12000000, credit: 10000000, closing: 7000000 },
    { currency: 'EUR', opening: 0, debit: 1000, credit: 0, closing: 1000 },
]

export function BankBalanceReport() {
    // const t = useTranslations('reports') // Assuming reports namespace exists

    return (
        <div className="space-y-4">
            <ReportFilterBar />

            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
                        Bank Accounts Balance (Statement)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[200px]">Currency / Account</TableHead>
                                <TableHead className="text-right">Opening Balance</TableHead>
                                <TableHead className="text-right text-emerald-600">Debit (In)</TableHead>
                                <TableHead className="text-right text-rose-600">Credit (Out)</TableHead>
                                <TableHead className="text-right font-bold">Closing Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockBankData.map((row) => (
                                <TableRow key={row.currency} className="group">
                                    <TableCell className="font-medium">{row.currency} - Main Account</TableCell>
                                    <TableCell className="text-right font-mono text-xs">
                                        {row.opening.toLocaleString()} {row.currency}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs text-emerald-600">
                                        +{row.debit.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs text-rose-600">
                                        -{row.credit.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-xs bg-muted/10 group-hover:bg-muted/20">
                                        {row.closing.toLocaleString()} {row.currency}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {/* Total Row (Conceptual - hard to sum different currencies) */}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
