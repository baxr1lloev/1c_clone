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
import { Badge } from "@/components/ui/badge"

// Mock Data for AR/AP
const mockAgingData = [
    { id: 1, counterparty: 'Client A LLC', contract: 'Main Contract', type: 'receivable', amount: 5000, currency: 'USD', days: 12 },
    { id: 2, counterparty: 'Supplier Corp', contract: 'Supply Agmt 2024', type: 'payable', amount: 12000, currency: 'USD', days: 5 },
    { id: 3, counterparty: 'Client B Ltd', contract: 'Service Contract', type: 'receivable', amount: 1500, currency: 'USD', days: 45 },
]

export function ArApAgingReport() {
    return (
        <div className="space-y-4">
            <ReportFilterBar />

            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
                        AR/AP Aging (Settlements)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Counterparty</TableHead>
                                <TableHead>Contract</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-right">Overdue (Days)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockAgingData.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="font-medium">{row.counterparty}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{row.contract}</TableCell>
                                    <TableCell>
                                        <Badge variant={row.type === 'receivable' ? 'outline' : 'secondary'} className={row.type === 'receivable' ? 'text-emerald-600 border-emerald-200' : 'text-rose-600 bg-rose-50'}>
                                            {row.type === 'receivable' ? 'Receivable (We are owed)' : 'Payable (We owe)'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={`text-right font-mono font-bold ${row.type === 'receivable' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {row.amount.toLocaleString()} {row.currency}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className={row.days > 30 ? "text-rose-600 font-bold" : "text-muted-foreground"}>
                                            {row.days} days
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
