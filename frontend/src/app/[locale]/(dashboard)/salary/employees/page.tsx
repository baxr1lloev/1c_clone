'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBar } from '@/components/ui/status-bar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PiPencilBold, PiTrashBold, PiArrowsDownUpBold, PiUserCircleBold } from 'react-icons/pi';
import { useRouter } from 'next/navigation';
import type { Employee, PaginatedResponse } from '@/types';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';

export default function EmployeesPage() {
    const tc = useTranslations('common');
    const tf = useTranslations('fields');
    const router = useRouter();
    const queryClient = useQueryClient();

    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Employee | null>(null);
    const [searchValue, setSearchValue] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const response = await api.get<PaginatedResponse<Employee>>('/directories/employees/');
            return response.results;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/directories/employees/${id}/`),
        onSuccess: () => {
            toast.success('Employee deleted');
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            setIsDeleteOpen(false);
            setSelectedItem(null);
        },
        onError: () => toast.error('Failed to delete employee'),
    });

    const handleCreate = () => router.push('/directories/employees/new');
    const handleEdit = (emp: Employee) => router.push(`/directories/employees/${emp.id}`);

    // Filter data
    const filteredData = data?.filter(emp => {
        const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? emp.is_active : !emp.is_active);
        const matchesSearch = !searchValue ||
            `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchValue.toLowerCase()) ||
            emp.position?.toLowerCase().includes(searchValue.toLowerCase()) ||
            emp.email?.toLowerCase().includes(searchValue.toLowerCase());
        return matchesStatus && matchesSearch;
    }) || [];

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

    const columns: ColumnDef<Employee>[] = [
        {
            accessorKey: 'first_name',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4 h-8 text-xs">
                    Full Name <PiArrowsDownUpBold className="ml-2 h-3 w-3" />
                </Button>
            ),
            cell: ({ row }) => {
                const fullName = `${row.original.first_name} ${row.original.last_name}`;
                return (
                    <ReferenceLink
                        id={row.original.id}
                        type="employee"
                        label={fullName}
                        className="font-bold"
                    />
                );
            },
        },
        {
            accessorKey: 'position',
            header: 'Position',
            cell: ({ row }) => <span className="text-sm">{row.getValue('position') || '-'}</span>,
        },
        {
            accessorKey: 'email',
            header: 'Email',
            cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.getValue('email') || '-'}</span>,
        },
        {
            accessorKey: 'phone',
            header: 'Phone',
            cell: ({ row }) => <span className="text-sm font-mono">{row.getValue('phone') || '-'}</span>,
        },
        {
            accessorKey: 'base_salary',
            header: 'Salary',
            cell: ({ row }) => {
                const salary = parseFloat(row.getValue('base_salary') || '0');
                return <span className="font-mono">{salary ? `$${salary.toLocaleString()}` : '-'}</span>;
            },
        },
        {
            accessorKey: 'is_active',
            header: tc('status'),
            cell: ({ row }) => {
                const isActive = row.getValue('is_active');
                return (
                    <Badge variant={isActive ? 'posted' : 'deleted'}>
                        {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                );
            },
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* Status Filter */}
            <div className="border-b px-4 py-2 bg-muted/20">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Status:</span>
                    <Button
                        variant={statusFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setStatusFilter('all')}
                    >
                        All
                    </Button>
                    <Button
                        variant={statusFilter === 'active' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setStatusFilter('active')}
                    >
                        Active
                    </Button>
                    <Button
                        variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setStatusFilter('inactive')}
                    >
                        Inactive
                    </Button>
                </div>
            </div>

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
                        onRefresh={() => refetch()}
                        onSearch={setSearchValue}
                        searchValue={searchValue}
                        searchPlaceholder="Search employees..."
                    />
                }
            />

            <StatusBar
                totalRecords={data?.length || 0}
                filteredCount={statusFilter !== 'all' || searchValue ? filteredData.length : undefined}
                selectedCount={selectedItem ? 1 : 0}
                isLoading={isLoading}
            />

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete {selectedItem?.first_name} {selectedItem?.last_name}?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)} className="bg-destructive text-destructive-foreground">
                            {deleteMutation.isPending ? 'Deleting...' : tc('delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
