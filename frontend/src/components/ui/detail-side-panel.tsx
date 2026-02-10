import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Badge } from './badge';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

type EntityType = 'item' | 'counterparty' | 'warehouse' | 'contract' | 'document';

interface DetailSidePanelProps {
    entityType: EntityType;
    entityId: number;
    isOpen: boolean;
    onClose: () => void;
}

interface EntityDetail {
    id: number;
    name?: string;
    number?: string;
    status?: string;
    details: Record<string, any>;
    related_documents?: any[];
    balances?: any[];
}

function ItemDetail({ data }: { data: EntityDetail }) {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-medium text-muted-foreground">Details</h3>
                <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>SKU:</span>
                        <span className="font-mono">{data.details.sku}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Type:</span>
                        <Badge variant="outline">{data.details.type}</Badge>
                    </div>
                    <div className="flex justify-between">
                        <span>Sale Price:</span>
                        <span className="font-mono">${data.details.sale_price?.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {data.balances && data.balances.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Stock Balance</h3>
                    <div className="mt-2 space-y-1">
                        {data.balances.map((balance: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span>{balance.warehouse_name}</span>
                                <span className="font-mono">{balance.quantity}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function CounterpartyDetail({ data }: { data: EntityDetail }) {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-medium text-muted-foreground">Details</h3>
                <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>INN:</span>
                        <span className="font-mono">{data.details.inn}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Type:</span>
                        <Badge variant="outline">{data.details.type}</Badge>
                    </div>
                    {data.details.phone && (
                        <div className="flex justify-between">
                            <span>Phone:</span>
                            <span>{data.details.phone}</span>
                        </div>
                    )}
                </div>
            </div>

            {data.balances && data.balances.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Balance</h3>
                    <div className="mt-2">
                        <div className="text-2xl font-bold">
                            ${Math.abs(data.balances[0].amount).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {data.balances[0].amount < 0 ? 'Receivable' : 'Payable'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DocumentDetail({ data }: { data: EntityDetail }) {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-medium text-muted-foreground">Details</h3>
                <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>Date:</span>
                        <span className="font-mono">{data.details.date}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={data.status === 'posted' ? 'default' : 'secondary'}>
                            {data.status}
                        </Badge>
                    </div>
                    {data.details.total && (
                        <div className="flex justify-between">
                            <span>Total:</span>
                            <span className="font-mono font-bold">${data.details.total.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function DetailSidePanel({ entityType, entityId, isOpen, onClose }: DetailSidePanelProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: [entityType, entityId, 'detail'],
        queryFn: async () => {
            const response = await api.get(`/api/${entityType}s/${entityId}/detail`);
            return response.data as EntityDetail;
        },
        enabled: isOpen
    });

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            );
        }

        if (error || !data) {
            return (
                <div className="text-center text-muted-foreground py-8">
                    Failed to load details
                </div>
            );
        }

        switch (entityType) {
            case 'item':
                return <ItemDetail data={data} />;
            case 'counterparty':
                return <CounterpartyDetail data={data} />;
            case 'document':
                return <DocumentDetail data={data} />;
            default:
                return (
                    <div className="space-y-2 text-sm">
                        <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
                    </div>
                );
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle>{data?.name || data?.number || `${entityType} #${entityId}`}</SheetTitle>
                    <SheetDescription>
                        Quick preview - Click to open full details
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6">
                    {renderContent()}
                </div>

                {data?.related_documents && data.related_documents.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Recent Documents</h3>
                        <div className="space-y-1">
                            {data.related_documents.slice(0, 5).map((doc: any, i: number) => (
                                <div key={i} className="flex justify-between text-sm py-1 border-b">
                                    <span className="text-primary">{doc.number}</span>
                                    <span className="text-muted-foreground">{doc.date}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
