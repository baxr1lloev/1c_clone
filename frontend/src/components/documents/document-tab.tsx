import { ReactNode, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { CopyLinkButton } from '@/components/ui/copy-link-button';
import { DocumentChain } from '@/components/documents/document-chain';
import { PiCheckCircleBold, PiXCircleBold, PiWarningCircleBold } from 'react-icons/pi';
import { toast } from 'sonner';
import api from '@/lib/api';

type DocumentType = 'sales' | 'purchase' | 'payment' | 'transfer' | 'inventory';

interface DocumentTabProps {
    documentId: number;
    documentType: DocumentType;
    defaultTab?: string;
}

interface DocumentData {
    id: number;
    number: string;
    date: string;
    status: 'draft' | 'posted' | 'cancelled';
    [key: string]: any;
}

// Movement interface
interface Movement {
    id: number;
    item_id: number;
    item_name: string;
    warehouse_id: number;
    warehouse_name: string;
    quantity: number;
    cost: number;
    batch_id?: number;
}

// JournalEntry interface
interface JournalEntry {
    id: number;
    debit_account: string;
    credit_account: string;
    amount: number;
    description: string;
}

// Status badge helper
function getStatusBadge(status: string) {
    switch (status) {
        case 'posted':
            return <Badge variant="default" className="bg-green-600"><PiCheckCircleBold className="mr-1 h-3 w-3" />Posted</Badge>;
        case 'cancelled':
            return <Badge variant="destructive"><PiXCircleBold className="mr-1 h-3 w-3" />Cancelled</Badge>;
        default:
            return <Badge variant="outline"><PiWarningCircleBold className="mr-1 h-3 w-3" />Draft</Badge>;
    }
}

// Map DocumentType to chain API endpoint format
function getChainDocumentType(type: DocumentType): 'sales-documents' | 'purchase-documents' | 'payments' | 'sales-orders' | 'transfers' {
    switch (type) {
        case 'sales': return 'sales-documents';
        case 'purchase': return 'purchase-documents';
        case 'payment': return 'payments';
        case 'transfer': return 'transfers';
        default: return 'sales-documents';
    }
}

function DocumentMainForm({ data, type }: { data: DocumentData; type: DocumentType }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium text-muted-foreground">Number</label>
                    <div className="mt-1 font-mono font-bold">{data.number}</div>
                </div>
                <div>
                    <label className="text-sm font-medium text-muted-foreground">Date</label>
                    <div className="mt-1 font-mono">{new Date(data.date).toLocaleDateString()}</div>
                </div>
                {type !== 'inventory' && data.counterparty_id && (
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">
                            {type === 'purchase' ? 'Supplier' : type === 'sales' ? 'Customer' : 'Counterparty'}
                        </label>
                        <div className="mt-1">
                            <ReferenceLink
                                id={data.counterparty_id}
                                type="counterparty"
                                label={data.counterparty_name || `#${data.counterparty_id}`}
                            />
                        </div>
                    </div>
                )}
                {data.warehouse_id && (
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">Warehouse</label>
                        <div className="mt-1">
                            <ReferenceLink
                                id={data.warehouse_id}
                                type="warehouse"
                                label={data.warehouse_name || `#${data.warehouse_id}`}
                            />
                        </div>
                    </div>
                )}
                {type === 'inventory' && data.responsible && (
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">Responsible</label>
                        <div className="mt-1">{data.responsible}</div>
                    </div>
                )}
                {data.total && (
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">Total</label>
                        <div className="mt-1 text-lg font-bold font-mono">${data.total.toFixed(2)}</div>
                    </div>
                )}
            </div>

            {data.comment && (
                <div>
                    <label className="text-sm font-medium text-muted-foreground">Comment</label>
                    <div className="mt-1 text-sm">{data.comment}</div>
                </div>
            )}
        </div>
    );
}

function MovementsTable({ movements }: { movements: Movement[] }) {
    const columns: ColumnDef<Movement>[] = [
        {
            accessorKey: 'item_name',
            header: 'Item',
            cell: ({ row }) => (
                <ReferenceLink
                    id={row.original.item_id}
                    type="item"
                    label={row.getValue('item_name')}
                />
            ),
        },
        {
            accessorKey: 'warehouse_name',
            header: 'Warehouse',
            cell: ({ row }) => (
                <ReferenceLink
                    id={row.original.warehouse_id}
                    type="warehouse"
                    label={row.getValue('warehouse_name')}
                />
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ row }) => (
                <span className="font-mono">{row.getValue('quantity')}</span>
            ),
        },
        {
            accessorKey: 'cost',
            header: 'Cost',
            cell: ({ row }) => (
                <span className="font-mono">${parseFloat(row.getValue('cost')).toFixed(2)}</span>
            ),
        },
        {
            accessorKey: 'batch_id',
            header: 'Batch',
            cell: ({ row }) => {
                const batchId = row.getValue('batch_id');
                return batchId ? (
                    <span className="font-mono text-xs">#{batchId}</span>
                ) : (
                    <span className="text-muted-foreground">-</span>
                );
            },
        },
    ];

    return <DataTable columns={columns} data={movements} />;
}

function JournalEntriesTable({ entries }: { entries: JournalEntry[] }) {
    const columns: ColumnDef<JournalEntry>[] = [
        {
            accessorKey: 'debit_account',
            header: 'Debit',
            cell: ({ row }) => (
                <span className="font-mono text-sm">{row.getValue('debit_account')}</span>
            ),
        },
        {
            accessorKey: 'credit_account',
            header: 'Credit',
            cell: ({ row }) => (
                <span className="font-mono text-sm">{row.getValue('credit_account')}</span>
            ),
        },
        {
            accessorKey: 'amount',
            header: 'Amount',
            cell: ({ row }) => (
                <span className="font-mono font-medium">${parseFloat(row.getValue('amount')).toFixed(2)}</span>
            ),
        },
        {
            accessorKey: 'description',
            header: 'Description',
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground">{row.getValue('description')}</span>
            ),
        },
    ];

    return <DataTable columns={columns} data={entries} />;
}

export function DocumentTab({ documentId, documentType, defaultTab = 'main' }: DocumentTabProps) {
    const queryClient = useQueryClient();

    const { data: document, isLoading } = useQuery({
        queryKey: [documentType, documentId],
        queryFn: async () => {
            const response = await api.get(`/api/documents/${documentType}/${documentId}`);
            return response.data as DocumentData;
        },
    });

    const { data: movements } = useQuery({
        queryKey: [documentType, documentId, 'movements'],
        queryFn: async () => {
            const response = await api.get(`/api/documents/${documentType}/${documentId}/movements`);
            return response.data.movements as Movement[];
        },
        enabled: document?.status === 'posted',
    });

    const { data: journal } = useQuery({
        queryKey: [documentType, documentId, 'journal'],
        queryFn: async () => {
            const response = await api.get(`/api/documents/${documentType}/${documentId}/journal`);
            return response.data.entries as JournalEntry[];
        },
        enabled: document?.status === 'posted',
    });

    const postMutation = useMutation({
        mutationFn: async () => {
            return api.post(`/api/documents/${documentType}/${documentId}/post/`);
        },
        onSuccess: () => {
            toast.success('Документ проведён успешно');
            queryClient.invalidateQueries({ queryKey: [documentType, documentId] });
        },
        onError: () => {
            toast.error('Ошибка при проведении документа');
        },
    });

    const unpostMutation = useMutation({
        mutationFn: async () => {
            return api.post(`/api/documents/${documentType}/${documentId}/unpost/`);
        },
        onSuccess: () => {
            toast.success('Проведение отменено');
            queryClient.invalidateQueries({ queryKey: [documentType, documentId] });
        },
        onError: () => {
            toast.error('Ошибка при отмене проведения');
        },
    });

    if (isLoading || !document) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header with Status and Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold">{document.number}</h2>
                    {getStatusBadge(document.status)}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                        💾 Сохранить
                    </Button>
                    {document.status === 'draft' && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => postMutation.mutate()}
                            disabled={postMutation.isPending}
                        >
                            ✅ Провести
                        </Button>
                    )}
                    {document.status === 'posted' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unpostMutation.mutate()}
                            disabled={unpostMutation.isPending}
                        >
                            ⛔ Отменить проведение
                        </Button>
                    )}
                    <CopyLinkButton entityType={`documents/${documentType}`} entityId={documentId} />
                </div>
            </div>

            {/* Context Information Bar */}
            {document.counterparty_name && (
                <div className="bg-muted/30 border rounded-lg p-3 text-sm flex items-center gap-6">
                    <div>
                        <span className="text-muted-foreground">Контрагент:</span>{' '}
                        <span className="font-medium">{document.counterparty_name}</span>
                    </div>
                    {document.warehouse_name && (
                        <div>
                            <span className="text-muted-foreground">Склад:</span>{' '}
                            <span className="font-medium">{document.warehouse_name}</span>
                        </div>
                    )}
                    {document.total && (
                        <div>
                            <span className="text-muted-foreground">Сумма:</span>{' '}
                            <span className="font-bold">${document.total.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            )}


            {/* Tabs */}
            <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList>
                    <TabsTrigger value="main">Main</TabsTrigger>
                    <TabsTrigger value="lines">Lines</TabsTrigger>
                    {document.status === 'posted' && (
                        <>
                            <TabsTrigger value="movements">Movements</TabsTrigger>
                            <TabsTrigger value="journal">Postings</TabsTrigger>
                        </>
                    )}
                    <TabsTrigger value="audit">Audit</TabsTrigger>
                    <TabsTrigger value="chain">Chain</TabsTrigger>
                </TabsList>

                <TabsContent value="main" className="mt-4">
                    <DocumentMainForm data={document} type={documentType} />
                </TabsContent>

                <TabsContent value="lines" className="mt-4">
                    {document.lines && document.lines.length > 0 ? (
                        <div className="text-sm text-muted-foreground">
                            {document.lines.length} line(s)
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-8">
                            No lines
                        </div>
                    )}
                </TabsContent>

                {document.status === 'posted' && (
                    <>
                        <TabsContent value="movements" className="mt-4">
                            {movements && movements.length > 0 ? (
                                <MovementsTable movements={movements} />
                            ) : (
                                <div className="text-center text-muted-foreground py-8">
                                    No movements
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="journal" className="mt-4">
                            {journal && journal.length > 0 ? (
                                <JournalEntriesTable entries={journal} />
                            ) : (
                                <div className="text-center text-muted-foreground py-8">
                                    No journal entries
                                </div>
                            )}
                        </TabsContent>
                    </>
                )}

                <TabsContent value="audit" className="mt-4">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Created:</span>
                            <span>{document.created_at ? new Date(document.created_at).toLocaleString() : '-'}</span>
                        </div>
                        {document.posted_at && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Posted:</span>
                                <span>{new Date(document.posted_at).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="chain" className="mt-4">
                    <DocumentChain
                        documentType={getChainDocumentType(documentType)}
                        documentId={documentId}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
