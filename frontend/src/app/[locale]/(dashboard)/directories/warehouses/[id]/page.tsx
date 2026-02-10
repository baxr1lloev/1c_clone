'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { LinkableCell } from '@/components/ui/linkable-cell';
import { CopyLinkButton } from '@/components/ui/copy-link-button';
import { Loader2 } from 'lucide-react';

interface Warehouse {
    id: number;
    name: string;
    address: string;
    warehouse_type: string;
    is_active: boolean;
}

interface StockBalance {
    item_id: number;
    item_name: string;
    item_sku: string;
    quantity: number;
    amount: number;
}

export default function WarehouseDetailPage() {
    const params = useParams();
    const t = useTranslations();
    const id = parseInt(params.id as string);

    const { data: warehouse, isLoading } = useQuery({
        queryKey: ['warehouse', id],
        queryFn: () => api.get(`/api/warehouses/${id}/`),
    });

    const { data: balancesData } = useQuery({
        queryKey: ['warehouse', id, 'balances'],
        queryFn: () => api.get(`/api/warehouses/${id}/balances/`),
    });

    const breadcrumbs = [
        { label: 'Home', href: '/' },
        { label: 'Directories', href: '/directories' },
        { label: 'Warehouses', href: '/directories/warehouses' },
        { label: warehouse?.name || `Warehouse #${id}` },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const balanceColumns: ColumnDef<StockBalance>[] = [
        {
            accessorKey: 'item_name',
            header: 'Item',
            cell: ({ row }) => (
                <LinkableCell
                    id={row.original.item_id}
                    type="item"
                    label={row.original.item_name}
                />
            ),
        },
        {
            accessorKey: 'item_sku',
            header: 'SKU',
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ row }) => row.original.quantity.toFixed(3),
        },
        {
            accessorKey: 'amount',
            header: 'Value',
            cell: ({ row }) => `$${row.original.amount.toFixed(2)}`,
        },
    ];

    const totalValue = balancesData?.balances?.reduce((sum: number, b: StockBalance) => sum + b.amount, 0) || 0;

    return (
        <div className="container mx-auto py-6 space-y-6">
            <Breadcrumbs segments={breadcrumbs} />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{warehouse?.name}</h1>
                    <p className="text-muted-foreground">{warehouse?.address}</p>
                </div>
                <div className="flex gap-2">
                    <CopyLinkButton entityType="warehouse" entityId={id} />
                    <Badge variant={warehouse?.is_active ? 'default' : 'secondary'}>
                        {warehouse?.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Stock Overview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Items</p>
                            <p className="text-2xl font-bold">{balancesData?.balances?.length || 0}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Value</p>
                            <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="details" className="w-full">
                <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="balances">Stock Balances</TabsTrigger>
                    <TabsTrigger value="audit">Audit</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Warehouse Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Name</p>
                                <p className="font-medium">{warehouse?.name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Type</p>
                                <p className="font-medium">{warehouse?.warehouse_type}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm text-muted-foreground">Address</p>
                                <p className="font-medium">{warehouse?.address}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="balances">
                    <Card>
                        <CardHeader>
                            <CardTitle>Stock Balances</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                columns={balanceColumns}
                                data={balancesData?.balances || []}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="audit">
                    <Card>
                        <CardHeader>
                            <CardTitle>Audit Trail</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div>
                                    <p className="text-sm text-muted-foreground">Created</p>
                                    <p className="font-medium">{warehouse?.created_at}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Last Modified</p>
                                    <p className="font-medium">{warehouse?.updated_at}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
