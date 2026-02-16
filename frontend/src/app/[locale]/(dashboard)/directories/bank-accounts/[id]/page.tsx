'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyLinkButton } from '@/components/ui/copy-link-button';
import { Loader2 } from 'lucide-react';

export default function BankAccountDetailPage() {
    const params = useParams();
    const id = parseInt(params.id as string);

    const { data: account, isLoading } = useQuery({
        queryKey: ['bank-account', id],
        queryFn: async () => {
            const response = await api.get(`/directories/bank-accounts/${id}/`);
            return response;
        },
    });

    const breadcrumbs = [
        { label: 'Home', href: '/' },
        { label: 'Directories', href: '/directories' },
        { label: 'Bank Accounts', href: '/directories/bank-accounts' },
        { label: account?.name || `Account #${id}` },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <Breadcrumbs segments={breadcrumbs} />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{account?.name}</h1>
                    <p className="text-muted-foreground">{account?.bank_name}</p>
                </div>
                <div className="flex gap-2">
                    <CopyLinkButton entityType="bank-account" entityId={id} />
                    <Badge variant={account?.is_active ? 'default' : 'secondary'}>
                        {account?.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
            </div>

            <Tabs defaultValue="details" className="w-full">
                <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="audit">Audit</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Account Name</p>
                                <p className="font-medium">{account?.name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Bank Name</p>
                                <p className="font-medium">{account?.bank_name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Account Number</p>
                                <p className="font-medium">{account?.account_number}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Currency</p>
                                <p className="font-medium">{account?.currency_code || account?.currency}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Account Type</p>
                                <p className="font-medium">{account?.account_type_display || account?.account_type || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">BIK</p>
                                <p className="font-medium">{account?.bik || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Correspondent Account</p>
                                <p className="font-medium">{account?.correspondent_account || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">SWIFT</p>
                                <p className="font-medium">{account?.swift_code || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Accounting Account</p>
                                <p className="font-medium">{account?.accounting_account_code || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Default</p>
                                <p className="font-medium">{account?.is_default ? 'Yes' : 'No'}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm text-muted-foreground">Comment</p>
                                <p className="font-medium">{account?.comment || 'N/A'}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="transactions">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Transactions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">Transaction history will be displayed here</p>
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
                                    <p className="font-medium">{account?.created_at}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Last Modified</p>
                                    <p className="font-medium">{account?.updated_at}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
