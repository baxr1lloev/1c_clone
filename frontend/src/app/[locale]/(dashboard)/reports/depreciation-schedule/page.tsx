"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import api from "@/lib/api"

interface DepreciationScheduleItem {
    id: number
    asset: number
    asset_name: string
    asset_inventory_number: string
    period: string
    amount: string
    posted_at: string
}

export default function DepreciationSchedulePage() {
    const t = useTranslations('common')

    const { data, isLoading } = useQuery({
        queryKey: ['depreciation-schedule'],
        queryFn: async () => {
            const res = await api.get('/fixed-assets/depreciation-schedule/')
            return res.data
        }
    })

    // Calculate totals
    const totalDepreciation = data?.reduce((sum: number, item: DepreciationScheduleItem) =>
        sum + parseFloat(item.amount), 0) || 0

    const columns: ColumnDef<DepreciationScheduleItem>[] = [
        {
            accessorKey: 'period',
            header: 'Period',
            cell: ({ row }) => {
                const date = new Date(row.original.period)
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
            },
        },
        {
            accessorKey: 'asset_inventory_number',
            header: 'Inventory #',
            cell: ({ row }) => (
                <span className="font-mono">{row.original.asset_inventory_number}</span>
            ),
        },
        {
            accessorKey: 'asset_name',
            header: 'Asset Name',
        },
        {
            accessorKey: 'amount',
            header: 'Depreciation Amount',
            cell: ({ row }) => (
                <span className="font-semibold">
                    ${parseFloat(row.original.amount).toLocaleString()}
                </span>
            ),
        },
        {
            accessorKey: 'posted_at',
            header: 'Posted At',
            cell: ({ row }) => new Date(row.original.posted_at).toLocaleString(),
        },
    ]

    return (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b">
                <h1 className="text-2xl font-bold">Depreciation Schedule</h1>
                <p className="text-sm text-muted-foreground">Monthly depreciation postings</p>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Summary Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Depreciation</p>
                                <p className="text-2xl font-bold">
                                    ${totalDepreciation.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Entries</p>
                                <p className="text-2xl font-bold">{data?.length || 0}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Unique Assets</p>
                                <p className="text-2xl font-bold">
                                    {new Set(data?.map((item: DepreciationScheduleItem) => item.asset)).size || 0}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Depreciation Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Depreciation History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                columns={columns}
                                data={data || []}
                                isLoading={isLoading}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
