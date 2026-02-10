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

interface Counterparty {
    id: number;
    name: string;
    inn: string;
    type: string;
    email: string;
    phone: string;
    is_active: boolean;
}

interface BalanceDetail {
    contract_id: number;
    contract_number: string;
    currency: string;
    amount: number;
}

interface RelatedDocument {
    id: number;
    type: string;
    number: string;
    date: string;
    total?: number;
    amount?: number;
}

export default function CounterpartyDetailPage() {
    const params = useParams();
    const t = useTranslations();
    const id = parseInt(params.id as string);

    const { data: counterparty, isLoading } = useQuery({
        queryKey: ['counterparty', id],
        queryFn: () => api.get(`/api/counterparties/${id}/`),
    });

    const { data: balanceData } = useQuery({
        queryKey: ['counterparty', id, 'balance'],
        queryFn: () => api.get(`/api/counterparties/${id}/balance/`),
    });

    const { data: documentsData } = useQuery({
        queryKey: ['counterparty', id, 'documents'],
        queryFn: () => api.get(`/api/counterparties/${id}/documents/`),
    });

    const breadcrumbs = [
        { label: 'Home', href: '/' },
        { label: 'Directories', href: '/directories' },
        { label: 'Counterparties', href: '/directories/counterparties' },
        { label: counterparty?.name || `Counterparty #${id}` },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const balanceColumns: ColumnDef<BalanceDetail>[] = [
        {
            accessorKey: 'contract_number',
            header: 'Contract',
        },
        {
            accessorKey: 'currency',
            header: 'Currency',
        },
        {
            accessorKey: 'amount',
            header: 'Balance',
            cell: ({ row }) => {
                const amount = row.original.amount;
                const isDebt = amount > 0;
                return (
                    <span className={isDebt ? 'text-green-600' : 'text-red-600'}>
                        ${amount.toFixed(2)}
                    </span>
                );
            },
        },
    ];

    const documentColumns: ColumnDef<RelatedDocument>[] = [
        {
            accessorKey: 'date',
            header: 'Date',
        },
        {
            accessorKey: 'type',
            header: 'Type',
            cell: ({ row }) => (
                <Badge variant="outline">{row.original.type}</Badge>
            ),
        },
        {
            accessorKey: 'number',
            header: 'Number',
            cell: ({ row }) => (
                <LinkableCell
                    id={row.original.id}
                    type={row.original.type as any}
                    label={row.original.number}
                />
            ),
        },
        {
            accessorKey: 'total',
            header: 'Amount',
            cell: ({ row }) => {
                const amount = row.original.total || row.original.amount || 0;
                return `$${amount.toFixed(2)}`;
            },
        },
    ];

    const totalBalance = balanceData?.total_balance || 0;

    return (
        <div className="container mx-auto py-6 space-y-6">
            <Breadcrumbs segments={breadcrumbs} />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{counterparty?.name}</h1>
                    <p className="text-muted-foreground">INN: {counterparty?.inn}</p>
                </div>
                <div className="flex gap-2">
                    <CopyLinkButton entityType="counterparty" entityId={id} />
                    <Badge variant={counterparty?.is_active ? 'default' : 'secondary'}>
                        {counterparty?.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Settlement Balance</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">
                        <span className={totalBalance > 0 ? 'text-green-600' : totalBalance < 0 ? 'text-red-600' : ''}>
                            ${totalBalance.toFixed(2)}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        {totalBalance > 0 ? 'Customer owes us' : totalBalance < 0 ? 'We owe customer' : 'No debt'}
                    </p>
                </CardContent>
            </Card>

            <Tabs defaultValue="details" className="w-full">
                <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="balance">Balance Details</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="audit">Audit</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Counterparty Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Name</p>
                                <p className="font-medium">{counterparty?.name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">INN</p>
                                <p className="font-medium">{counterparty?.inn}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Type</p>
                                <p className="font-medium">{counterparty?.type}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Email</p>
                                <p className="font-medium">{counterparty?.email}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Phone</p>
                                <p className="font-medium">{counterparty?.phone}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="balance">
                    <Card>
                        <CardHeader>
                            <CardTitle>Balance by Contract</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                columns={balanceColumns}
                                data={balanceData?.balances || []}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="documents">
                    <Card>
                        <CardHeader>
                            <CardTitle>Related Documents</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                columns={documentColumns}
                                data={documentsData?.documents || []}
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
                                    <p className="font-medium">{counterparty?.created_at}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Last Modified</p>
                                    <p className="font-medium">{counterparty?.updated_at}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
