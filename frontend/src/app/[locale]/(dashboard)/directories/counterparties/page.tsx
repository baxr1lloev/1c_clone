'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBar } from '@/components/ui/status-bar';
import { QuickFilters } from '@/components/ui/quick-filters';
import { getCounterpartyRowClassName } from '@/components/data-table/row-styles';
import { GroupBySelector } from '@/components/data-table/group-by-selector';
import { SavedViews, SavedView } from '@/components/data-table/saved-views';
import { HelpPanel } from '@/components/layout/help-panel';
import { ColumnCustomization } from '@/components/data-table/column-customization';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PiPencilBold, PiTrashBold, PiArrowsDownUpBold } from 'react-icons/pi';
import type { Counterparty, PaginatedResponse, CounterpartyType } from '@/types';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';

const typeColors: Record<CounterpartyType, string> = {
    customer: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    supplier: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    agent: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

export default function CounterpartiesPage() {
    const t = useTranslations('directories');
    const tc = useTranslations('common');
    const tf = useTranslations('fields');
    const router = useRouter();
    const queryClient = useQueryClient();

    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Counterparty | null>(null);
    const [searchValue, setSearchValue] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [groupBy, setGroupBy] = useState<string | null>(null);
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
    const [sorting, setSorting] = useState<any>([]);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['counterparties'],
        queryFn: async () => {
            const response = await api.get<PaginatedResponse<Counterparty>>('/directories/counterparties/');
            return response.results;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return api.delete(`/directories/counterparties/${id}/`);
        },
        onSuccess: () => {
            toast.success('Counterparty deleted');
            queryClient.invalidateQueries({ queryKey: ['counterparties'] });
            setIsDeleteOpen(false);
            setSelectedItem(null);
        },
        onError: () => {
            toast.error('Failed to delete counterparty');
        },
    });

    const handleCreate = () => router.push('/directories/counterparties/new');
    const handleEdit = (item: Counterparty) => router.push(`/directories/counterparties/${item.id}`);
    const handleView = (item: Counterparty) => router.push(`/directories/counterparties/${item.id}`);

    // Load saved view
    const handleLoadView = (view: SavedView) => {
        setTypeFilter(view.filters.type || 'all');
        setSorting(view.sorting);
        setColumnVisibility(view.columnVisibility);
        setGroupBy(view.groupBy);
    };

    // Filtering
    const filteredData = useMemo(() => {
        if (!data) return [];
        let filtered = data;

        if (typeFilter !== 'all') {
            filtered = filtered.filter(item => item.type === typeFilter);
        }

        if (searchValue) {
            filtered = filtered.filter(item =>
                item.name.toLowerCase().includes(searchValue.toLowerCase())
            );
        }

        return filtered;
    }, [data, typeFilter, searchValue]);

    const mainActions: CommandBarAction[] = [
        {
            label: tc('create'),
            icon: <PiPencilBold />,
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
            shortcut: 'F2'
        },
        {
            label: tc('delete'),
            icon: <PiTrashBold />,
            onClick: () => setIsDeleteOpen(true),
            variant: 'destructive',
            shortcut: 'Del'
        }
    ] : [];

    const columns: ColumnDef<Counterparty>[] = [
        {
            accessorKey: 'name',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4 h-8 text-xs">
                    {tc('name')} <PiArrowsDownUpBold className="ml-2 h-3 w-3" />
                </Button>
            ),
            cell: ({ row }) => (
                <ReferenceLink
                    id={row.original.id}
                    type="counterparty"
                    label={row.getValue('name')}
                    showIcon={true}
                    className="font-medium"
                />
            ),
        },
        {
            accessorKey: 'inn',
            header: tf('inn'),
            cell: ({ row }) => (
                <span className="font-mono text-sm">{row.getValue('inn')}</span>
            ),
        },
        {
            accessorKey: 'type',
            header: tf('type'),
            cell: ({ row }) => {
                const type = row.getValue('type') as CounterpartyType;
                return (
                    <Badge variant="outline" className={cn("text-[10px] h-5 px-1", typeColors[type])}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'phone',
            header: tf('phone'),
            cell: ({ row }) => <span className="text-xs">{row.getValue('phone')}</span>,
        },
        {
            accessorKey: 'email',
            header: tf('email') || 'Email',
            cell: ({ row }) => (
                <a href={`mailto:${row.getValue('email')}`} className="text-primary hover:underline text-xs">
                    {row.getValue('email')}
                </a>
            ),
        },
        {
            accessorKey: 'is_active',
            header: tf('isActive'),
            cell: ({ row }) => {
                const isActive = row.getValue('is_active') as boolean;
                return (
                    <Badge variant={isActive ? 'default' : 'outline'} className="text-[10px] h-5 px-1">
                        {isActive ? 'Active' : 'Inactive'}
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
                onRowDoubleClick={handleView}
                commandBar={
                    <div className="flex items-center justify-between w-full">
                        <CommandBar
                            mainActions={mainActions}
                            selectionActions={selectionActions}
                            onRefresh={() => refetch()}
                            onSearch={setSearchValue}
                            searchValue={searchValue}
                            searchPlaceholder="Search counterparties..."
                        />
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                                <Button
                                    variant={typeFilter === 'all' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-3"
                                    onClick={() => setTypeFilter('all')}
                                >
                                    All
                                </Button>
                                <Button
                                    variant={typeFilter === 'customer' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-3"
                                    onClick={() => setTypeFilter('customer')}
                                >
                                    Customers
                                </Button>
                                <Button
                                    variant={typeFilter === 'supplier' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-3"
                                    onClick={() => setTypeFilter('supplier')}
                                >
                                    Suppliers
                                </Button>
                                <Button
                                    variant={typeFilter === 'agent' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-3"
                                    onClick={() => setTypeFilter('agent')}
                                >
                                    Agents
                                </Button>
                                <Button
                                    variant={typeFilter === 'other' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-3"
                                    onClick={() => setTypeFilter('other')}
                                >
                                    Other
                                </Button>
                                {typeFilter !== 'all' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => setTypeFilter('all')}
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>
                            <GroupBySelector
                                columns={columns}
                                groupBy={groupBy}
                                onGroupByChange={setGroupBy}
                                tableName="counterparties"
                            />
                            <SavedViews
                                tableName="counterparties"
                                currentState={{
                                    filters: { type: typeFilter },
                                    sorting,
                                    columnVisibility,
                                    groupBy
                                }}
                                onLoadView={handleLoadView}
                            />
                            <ColumnCustomization
                                columns={columns}
                                columnVisibility={columnVisibility}
                                onColumnVisibilityChange={setColumnVisibility}
                                tableName="counterparties"
                            />
                            <HelpPanel context="counterparty-list" />
                        </div>
                    </div>
                }
                getRowClassName={(row) => getCounterpartyRowClassName(row.is_active)}
            />

            {/* Status Bar */}
            <StatusBar
                totalRecords={data?.length || 0}
                filteredCount={typeFilter !== 'all' || searchValue ? filteredData.length : undefined}
                selectedCount={selectedItem ? 1 : 0}
                isLoading={isLoading}
            />

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Counterparty</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteMutation.isPending ? 'Deleting...' : tc('delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

