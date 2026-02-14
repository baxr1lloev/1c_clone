'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { PiPencilBold, PiTrashBold, PiPlusBold, PiArrowsDownUpBold } from 'react-icons/pi';
import { toast } from 'sonner';

import api from '@/lib/api';
import { IAReceiptDocument, PaginatedResponse, DocumentStatus } from '@/types';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBar } from '@/components/ui/status-bar';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';
import { cn } from '@/lib/utils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const statusColors: Record<DocumentStatus, string> = {
    draft: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    posted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    cancelled: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
};

export default function IAReceiptsPage() {
    const t = useTranslations('documents.iaReceipts');
    const tc = useTranslations('common');
    const router = useRouter();
    const queryClient = useQueryClient();

    const [searchValue, setSearchValue] = useState('');
    const [selectedItem, setSelectedItem] = useState<IAReceiptDocument | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Fetch Data
    const { data, isLoading } = useQuery({
        queryKey: ['ia-receipts'],
        queryFn: async () => {
            const response = await api.get<PaginatedResponse<IAReceiptDocument>>('/fixed-assets/ia/receipts/');
            return response.results;
        },
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/fixed-assets/ia/receipts/${id}/`),
        onSuccess: () => {
            toast.success(tc('deletedSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['ia-receipts'] });
            setIsDeleteOpen(false);
            setSelectedItem(null);
        },
        onError: () => toast.error(tc('errorDeleting')),
    });

    // Filter Data
    const filteredData = useMemo(() => {
        if (!data) return [];
        if (!searchValue) return data;
        const lowerSearch = searchValue.toLowerCase();
        return data.filter(doc =>
            doc.number.toLowerCase().includes(lowerSearch) ||
            doc.supplier_name?.toLowerCase().includes(lowerSearch)
        );
    }, [data, searchValue]);

    const handleCreate = () => router.push('/documents/ia-receipts/new');
    const handleEdit = (doc: IAReceiptDocument) => router.push(`/documents/ia-receipts/${doc.id}`);

    // Actions
    const mainActions: CommandBarAction[] = [
        {
            label: tc('create'),
            icon: <PiPlusBold />,
            onClick: handleCreate,
            variant: 'default',
            shortcut: 'Ins',
        },
    ];

    const selectionActions: CommandBarAction[] = selectedItem ? [
        {
            label: tc('edit'),
            icon: <PiPencilBold />,
            onClick: () => handleEdit(selectedItem),
            shortcut: 'F2',
        },
        {
            label: tc('delete'),
            icon: <PiTrashBold />,
            onClick: () => setIsDeleteOpen(true),
            variant: 'destructive',
            shortcut: 'Del',
        },
    ] : [];

    // Columns
    const columns: ColumnDef<IAReceiptDocument>[] = [
        {
            accessorKey: 'date',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4 h-8 text-xs">
                    {t('date')} <PiArrowsDownUpBold className="ml-2 h-3 w-3" />
                </Button>
            ),
            cell: ({ row }) => <span className="font-mono">{row.getValue('date')}</span>,
        },
        {
            accessorKey: 'number',
            header: t('number'),
            cell: ({ row }) => <span className="font-medium">{row.getValue('number')}</span>,
        },
        {
            accessorKey: 'supplier_name',
            header: t('supplier'),
        },
        {
            accessorKey: 'asset_name',
            header: t('asset'),
        },
        {
            accessorKey: 'status',
            header: tc('status'),
            cell: ({ row }) => {
                const status = (row.getValue('status') as string).toLowerCase() as DocumentStatus;
                return (
                    <Badge variant="outline" className={cn("text-[10px] h-5 px-1", statusColors[status] || statusColors.draft)}>
                        {status.toUpperCase()}
                    </Badge>
                );
            },
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <DataTable
                columns={columns}
                data={filteredData}
                isLoading={isLoading}
                onRowClick={setSelectedItem}
                onRowDoubleClick={handleEdit}
                commandBar={
                    <CommandBar
                        mainActions={mainActions}
                        selectionActions={selectionActions}
                        onSearch={setSearchValue}
                        searchValue={searchValue}
                        searchPlaceholder={t('searchPlaceholder')}
                    />
                }
            />

            <StatusBar
                totalRecords={data?.length || 0}
                filteredCount={searchValue ? filteredData.length : undefined}
                selectedCount={selectedItem ? 1 : 0}
                isLoading={isLoading}
            />

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{tc('confirmDelete')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {tc('deleteWarning', { item: selectedItem?.number ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)}
                            className="bg-destructive text-destructive-foreground"
                        >
                            {deleteMutation.isPending ? tc('deleting') : tc('delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

