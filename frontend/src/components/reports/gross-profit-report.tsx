"use client"

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

// Mock Data for Gross Profit
const mockGrossProfitData = [
    {
        id: 1,
        manager: 'John Doe',
        item: 'Item #1 (Goods)',
        quantity: 100,
        revenue: 12000,
        cogs: 8000,
        grossProfit: 4000
    },
    {
        id: 2,
        manager: 'John Doe',
        item: 'Service #1 (Hourly)',
        quantity: 20,
        revenue: 2000,
        cogs: 0, // Services usually have 0 direct COGS in simple accounting
        grossProfit: 2000
    },
    {
        id: 3,
        manager: 'Jane Smith',
        item: 'Item #2 (Premium)',
        quantity: 5,
        revenue: 5000,
        cogs: 2500,
        grossProfit: 2500
    },
]

export function GrossProfitReport() {
    // Helper to calculate margin
    const calculateMargin = (revenue: number, profit: number) => {
        if (revenue === 0) return 0;
        return (profit / revenue) * 100;
    };

    return (
        <div className="space-y-4">
            {/* Sales Mode enables Manager/Item filters */}
            <ReportFilterBar reportType="sales" />

            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
                        Gross Profit Analysis (Валовая прибыль)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent bg-muted/50">
                                <TableHead className="w-[150px]">Manager</TableHead>
                                <TableHead className="w-[200px]">Item</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Revenue (Sales)</TableHead>
                                <TableHead className="text-right">COGS (Cost)</TableHead>
                                <TableHead className="text-right font-bold text-primary">Gross Profit</TableHead>
                                <TableHead className="text-right">Margin %</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockGrossProfitData.map((row) => {
                                const margin = calculateMargin(row.revenue, row.grossProfit);
                                return (
                                    <TableRow key={row.id} className="group hover:bg-muted/5">
                                        <TableCell className="font-medium">{row.manager}</TableCell>
                                        <TableCell>{row.item}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">{row.quantity}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">
                                            {row.revenue.toLocaleString()} USD
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                            {row.cogs.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 bg-emerald-50/10">
                                            {row.grossProfit.toLocaleString()} USD
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={margin > 40 ? 'outline' : 'secondary'} className={margin > 40 ? "text-emerald-600 border-emerald-200" : (margin < 20 ? "text-rose-600 bg-rose-50" : "")}>
                                                {margin.toFixed(1)}%
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}

                            {/* Summary Row */}
                            <TableRow className="font-bold border-t-2">
                                <TableCell colSpan={3}>TOTAL</TableCell>
                                <TableCell className="text-right font-mono text-xs">19,000 USD</TableCell>
                                <TableCell className="text-right font-mono text-xs">10,500</TableCell>
                                <TableCell className="text-right font-mono text-xs text-emerald-700">8,500 USD</TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                    44.7%
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
