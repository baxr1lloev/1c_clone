"use client"

import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { Loader2 } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReferenceLink } from "@/components/ui/reference-link"

interface DocumentPostingsProps {
    documentId: number
    endpoint: string // e.g. "sales", "payments"
}

export function DocumentPostings({ documentId, endpoint }: DocumentPostingsProps) {
    const { data: postings, isLoading } = useQuery({
        queryKey: ['postings', endpoint, documentId],
        queryFn: async () => {
            const res = await api.get(`/documents/${endpoint}/${documentId}/postings/`)
            return res
        }
    })

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
    }

    if (!postings) return null

    const hasStock = postings.stock && postings.stock.length > 0
    const hasSettlements = postings.settlement && postings.settlement.length > 0
    const hasAccounting = postings.accounting && postings.accounting.length > 0

    if (!hasStock && !hasSettlements && !hasAccounting) {
        return <div className="p-8 text-center text-muted-foreground">No postings found.</div>
    }

    return (
        <div className="space-y-8">
            {/* Accounting Entries (The Truth) */}
            {hasAccounting && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Accounting Journal (Ledger)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Debit</TableHead>
                                    <TableHead>Credit</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Description</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {postings.accounting.map((entry: any) => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="font-mono text-xs">{entry.period}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 border-blue-200">
                                                <ReferenceLink type="account" id={entry.debit_account} label={entry.debit_account__code} showIcon={false} />
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 border-blue-200">
                                                <ReferenceLink type="account" id={entry.credit_account} label={entry.credit_account__code} showIcon={false} />
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-bold font-mono">
                                            {Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{entry.description}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Settlements */}
            {hasSettlements && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Settlements (Debt Register)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Counterparty</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Currency</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {postings.settlement.map((mov: any) => (
                                    <TableRow key={mov.id}>
                                        <TableCell className="font-mono text-xs">{new Date(mov.date).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <ReferenceLink
                                                type="counterparty"
                                                id={mov.counterparty}
                                                label={mov.counterparty__name}
                                            />
                                        </TableCell>
                                        <TableCell className={cn("text-right font-bold font-mono", Number(mov.amount) < 0 ? "text-red-600" : "text-green-600")}>
                                            {Number(mov.amount) > 0 ? "+" : ""}{Number(mov.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-xs">{mov.currency__code}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Stock Movements */}
            {hasStock && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Stock Movements (Inventory)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Cost Sum</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {postings.stock.map((mov: any) => (
                                    <TableRow key={mov.id}>
                                        <TableCell>
                                            <Badge variant={mov.movement_type === 'receipt' ? 'default' : 'secondary'} className="text-[10px]">
                                                {mov.movement_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <ReferenceLink
                                                type="item"
                                                id={mov.item}
                                                label={mov.item__name}
                                            />
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            <ReferenceLink
                                                type="warehouse"
                                                id={mov.warehouse}
                                                label={mov.warehouse__name}
                                            />
                                        </TableCell>
                                        <TableCell className={cn("text-right font-bold font-mono", Number(mov.quantity) < 0 ? "text-red-600" : "text-green-600")}>
                                            {Number(mov.quantity) > 0 ? "+" : ""}{Number(mov.quantity)}
                                        </TableCell>
                                        <TableCell className="text-right text-xs font-mono text-muted-foreground">
                                            {Number(mov.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}
