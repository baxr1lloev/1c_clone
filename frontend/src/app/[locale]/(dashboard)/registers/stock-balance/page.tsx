'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';
import { ReferenceLink } from '@/components/ui/reference-link';
import { StockBalance, PaginatedResponse } from '@/types';
import { PiArrowsClockwiseBold, PiPrinterBold } from 'react-icons/pi';

export default function StockBalanceRegisterPage() {
    const t = useTranslations('registers'); // Assuming 'registers' namespace exists
    const tc = useTranslations('common');
    const tf = useTranslations('fields');

    const [searchValue, setSearchValue] = useState('');

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['stock-balance', searchValue],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (searchValue) params.append('search', searchValue);

            const response = await api.get<PaginatedResponse<StockBalance>>(`/registers/stock-balances/?${params.toString()}`);
            return response.results;
        },
    });

    const columns: ColumnDef<StockBalance>[] = [
        {
            accessorKey: 'item',
            header: tf('item'),
            cell: ({ row }) => (
                <ReferenceLink
                    id={row.original.item}
                    type="item"
                    label={row.original.item_detail?.name || `Item #${row.original.item}`}
                    showIcon={true}
                    className="font-medium"
                />
            ),
        },
        {
            accessorKey: 'warehouse',
            header: tf('warehouse'),
            cell: ({ row }) => (
                <ReferenceLink
                    id={row.original.warehouse}
                    type="warehouse"
                    label={row.original.warehouse_detail?.name || `WH #${row.original.warehouse}`}
                />
            ),
        },
        {
            accessorKey: 'quantity',
            header: tf('quantity'),
            cell: ({ row }) => (
                <span className="font-mono font-bold text-emerald-600">
                    {row.getValue<number>('quantity').toLocaleString()} <span className="text-xs text-muted-foreground font-normal">{row.original.item_detail?.base_unit || 'pcs'}</span>
                </span>
            ),
        },
        {
            accessorKey: 'reserved_quantity',
            header: "Reserved",
            cell: ({ row }) => {
                const val = row.getValue<number>('reserved_quantity');
                return val > 0 ? <span className="font-mono text-orange-600">{val.toLocaleString()}</span> : <span className="text-muted-foreground">-</span>;
            }
        },
        {
            accessorKey: 'available_quantity',
            header: "Available",
            cell: ({ row }) => (
                <span className="font-mono font-bold text-blue-600">
                    {row.getValue<number>('available_quantity').toLocaleString()}
                </span>
            ),
        }
    ];

    const actions: CommandBarAction[] = [
        {
            label: tc('refresh'),
            icon: <PiArrowsClockwiseBold />,
            onClick: () => refetch(),
            variant: 'ghost',
            shortcut: 'F5'
        },
        {
            label: tc('print'),
            icon: <PiPrinterBold />,
            onClick: () => window.print(),
            variant: 'ghost'
        }
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <DataTable
                columns={columns}
                data={data || []}
                isLoading={isLoading}
                commandBar={
                    <CommandBar
                        mainActions={actions}
                        onSearch={setSearchValue}
                        searchValue={searchValue}
                        searchPlaceholder="Search Item..."
                    />
                }
            />
        </div>
    );
}

