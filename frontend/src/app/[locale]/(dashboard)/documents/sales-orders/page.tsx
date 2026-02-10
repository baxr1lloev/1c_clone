'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';
import { ReferenceLink } from '@/components/ui/reference-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import {
    PiPencilBold,
    PiTrashBold,
    PiArrowsDownUpBold,
    PiCheckCircleBold,
    PiXCircleBold,
    PiFilePlusBold, // for Create Based On
    PiPaperPlaneTiltBold
} from 'react-icons/pi';

// Define type locally if needed or import
interface SalesOrder {
    id: number;
    number: string;
    date: string;
    status: 'draft' | 'confirmed' | 'shipped' | 'cancelled';
    counterparty: number;
    warehouse: number;
    total: number;
    currency: number;
    is_fully_shipped: boolean;
}

export default function SalesOrdersPage() {
    const t = useTranslations('documents');
    const tc = useTranslations('common');
    const router = useRouter();
    const queryClient = useQueryClient();

    const [selectedItem, setSelectedItem] = useState<SalesOrder | null>(null);
    const [searchValue, setSearchValue] = useState('');

    // Fetch Orders
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['sales-orders'],
        queryFn: async () => {
            const response = await api.get('/documents/sales-orders/');
            return response.results as SalesOrder[];
        },
    });

    // Post Mutation (Confirm)
    const postMutation = useMutation({
        mutationFn: async (id: number) => api.post(`/documents/sales-orders/${id}/post/`),
        onSuccess: () => {
            toast.success('Order confirmed & stock reserved');
            queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to post order'),
    });

    // Unpost Mutation
    const unpostMutation = useMutation({
        mutationFn: async (id: number) => api.post(`/documents/sales-orders/${id}/unpost/`),
        onSuccess: () => {
            toast.success('Order unposted (reservations released)');
            queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
        },
        onError: (err: any) => toast.error('Failed to unpost order'),
    });

    // Create Based On: Sales Document
    const createDocumentMutation = useMutation({
        mutationFn: async (id: number) => api.post(`/documents/sales-orders/${id}/create_sales_document/`),
        onSuccess: (data: any) => {
            toast.success(data.data.message);
            // Redirect to the new document
            router.push(`/documents/sales/${data.data.id}`);
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create document'),
    });

    // Actions
    const handleCreate = () => router.push('/documents/sales-orders/new');
    const handleEdit = (doc: SalesOrder) => router.push(`/documents/sales-orders/${doc.id}`);

    const mainActions: CommandBarAction[] = [
        {
            label: 'Create Order', // Using raw string if translation missing
            icon: <PiPencilBold />,
            onClick: handleCreate,
            variant: 'default',
            shortcut: 'Ins',
        },
    ];

    const selectionActions: CommandBarAction[] = selectedItem ? [
        // 1C Style: "Create Based On" is prominent
        {
            label: 'Create Invoice', // Реализация
            icon: <PiFilePlusBold />,
            onClick: () => createDocumentMutation.mutate(selectedItem.id),
            disabled: selectedItem.status !== 'confirmed', // Must be confirmed/posted to ship? 
            // Actually typically you can create from draft too but logic usually requires reservation.
            // SalesOrder.create_sales_document checks can_create_sales_document which usually means posted.
            variant: 'default', // Highlighted
        },
        {
            label: tc('edit'),
            icon: <PiPencilBold />,
            onClick: () => handleEdit(selectedItem),
            disabled: selectedItem.status === 'shipped',
            shortcut: 'F2'
        },
        {
            label: 'Confirm (Reserve)',
            icon: <PiCheckCircleBold />,
            onClick: () => postMutation.mutate(selectedItem.id),
            disabled: selectedItem.status !== 'draft',
            variant: 'ghost'
        },
        {
            label: 'Cancel (Release)',
            icon: <PiXCircleBold />,
            onClick: () => unpostMutation.mutate(selectedItem.id),
            disabled: selectedItem.status === 'draft' || selectedItem.status === 'shipped',
            variant: 'ghost'
        },
    ] : [];

    const columns: ColumnDef<SalesOrder>[] = [
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ row }) => <span className="font-mono">{new Date(row.getValue('date')).toLocaleDateString()}</span>,
        },
        {
            accessorKey: 'number',
            header: 'Number',
            cell: ({ row }) => (
                <ReferenceLink
                    id={row.original.id}
                    type="sales_order"
                    label={row.getValue('number')}
                    className="font-mono text-primary font-bold"
                />
            ),
        },
        {
            accessorKey: 'counterparty',
            header: 'Customer',
            cell: ({ row }) => {
                const val = row.getValue('counterparty');
                return <ReferenceLink id={val as number} type="counterparty" label={`Customer #${val}`} />;
            },
        },
        {
            accessorKey: 'warehouse',
            header: 'Warehouse',
            cell: ({ row }) => {
                const val = row.getValue('warehouse');
                return <ReferenceLink id={val as number} type="warehouse" label={`WH-#${val}`} />;
            },
        },
        {
            accessorKey: 'total',
            header: 'Total',
            cell: ({ row }) => <span className="font-mono font-bold">{Number(row.getValue('total')).toLocaleString()}</span>,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const val = row.getValue('status') as string;
                let variant: "default" | "secondary" | "destructive" | "outline" | "posted" | "draft" | "deleted" = 'outline';

                if (val === 'draft') variant = 'draft';
                if (val === 'confirmed') variant = 'posted'; // Green
                if (val === 'shipped') variant = 'secondary'; // Grey/Done
                if (val === 'cancelled') variant = 'deleted';

                return <Badge variant={variant}>{val}</Badge>;
            }
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <DataTable
                columns={columns}
                data={data || []}
                isLoading={isLoading}
                onRowClick={setSelectedItem}
                onRowDoubleClick={(row) => handleEdit(row)}
                commandBar={
                    <CommandBar
                        mainActions={mainActions}
                        selectionActions={selectionActions}
                        onRefresh={() => refetch()}
                        onSearch={setSearchValue}
                        searchValue={searchValue}
                        searchPlaceholder="Search orders..."
                    />
                }
            />
        </div>
    );
}

