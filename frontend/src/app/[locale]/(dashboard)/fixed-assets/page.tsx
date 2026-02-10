"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { PiPlusBold } from "react-icons/pi"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"

interface FixedAsset {
    id: number
    inventory_number: string
    name: string
    category: number
    category_name: string
    initial_cost: string
    accumulated_depreciation: string
    current_value: string
    status: string
    location: string
    commissioning_date: string
}

export default function FixedAssetsPage() {
    const t = useTranslations('common')
    const router = useRouter()

    const { data, isLoading } = useQuery({
        queryKey: ['fixed-assets'],
        queryFn: async () => {
            const res = await api.get('/fixed-assets/assets/')
            return res.data
        }
    })

    const columns: ColumnDef<FixedAsset>[] = [
        {
            accessorKey: 'inventory_number',
            header: 'Inventory #',
            cell: ({ row }) => (
                <Button
                    variant="link"
                    className="p-0 h-auto font-mono"
                    onClick={() => router.push(`/fixed-assets/${row.original.id}`)}
                >
                    {row.original.inventory_number}
                </Button>
            ),
        },
        {
            accessorKey: 'name',
            header: 'Name',
        },
        {
            accessorKey: 'category_name',
            header: 'Category',
        },
        {
            accessorKey: 'initial_cost',
            header: 'Initial Cost',
            cell: ({ row }) => `$${parseFloat(row.original.initial_cost).toLocaleString()}`,
        },
        {
            accessorKey: 'accumulated_depreciation',
            header: 'Depreciation',
            cell: ({ row }) => `$${parseFloat(row.original.accumulated_depreciation).toLocaleString()}`,
        },
        {
            accessorKey: 'current_value',
            header: 'Book Value',
            cell: ({ row }) => (
                <span className="font-semibold">
                    ${parseFloat(row.original.current_value).toLocaleString()}
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const statusColors = {
                    IN_USE: 'default',
                    MOTHBALLED: 'secondary',
                    DISPOSED: 'destructive',
                }
                return (
                    <Badge variant={statusColors[row.original.status as keyof typeof statusColors] as any}>
                        {row.original.status.replace('_', ' ')}
                    </Badge>
                )
            },
        },
        {
            accessorKey: 'location',
            header: 'Location',
        },
        {
            accessorKey: 'commissioning_date',
            header: 'Commissioned',
            cell: ({ row }) => row.original.commissioning_date ? new Date(row.original.commissioning_date).toLocaleDateString() : '-',
        },
    ]

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-6 border-b">
                <div>
                    <h1 className="text-2xl font-bold">Fixed Assets</h1>
                    <p className="text-sm text-muted-foreground">Manage your company's fixed assets</p>
                </div>
                <Button onClick={() => router.push('/fixed-assets/new')}>
                    <PiPlusBold className="mr-2 h-4 w-4" />
                    New Asset
                </Button>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <DataTable
                    columns={columns}
                    data={data || []}
                    isLoading={isLoading}
                />
            </div>
        </div>
    )
}
