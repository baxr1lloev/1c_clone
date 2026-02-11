import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { ReferenceLink } from './reference-link';
import api from '@/lib/api';

interface DrillDownModalProps {
    title: string;
    description?: string;
    endpoint: string;
    isOpen: boolean;
    onClose: () => void;
}

interface DrillDownDocument {
    id: number;
    type: string;
    number: string;
    date: string;
    amount: number;
    description?: string;
    counterparty_name?: string;
}

const getDocumentUrl = (type: string, id: number) => {
    // Map backend model names to frontend routes
    const typeMap: Record<string, string> = {
        'salesdocument': 'sales',
        'purchasedocument': 'purchases',
        'transferdocument': 'transfers',
        'inventorydocument': 'inventories',
        'sales': 'sales',       // Fallback for simple types
        'purchase': 'purchases'
    };

    const route = typeMap[type.toLowerCase()] || type.toLowerCase() + 's';
    return `/documents/${route}/${id}`;
};

const drillDownColumns: ColumnDef<DrillDownDocument>[] = [
    {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ row }) => (
            <span className="font-mono text-xs">
                {new Date(row.getValue('date')).toLocaleDateString()}
            </span>
        ),
    },
    {
        accessorKey: 'number',
        header: 'Document',
        cell: ({ row }) => (
            <ReferenceLink
                id={row.original.id}
                type={row.original.type as any}
                label={row.getValue('number')}
                className="font-mono font-medium"
                href={getDocumentUrl(row.original.type, row.original.id)}
            />
        ),
    },
    {
        accessorKey: 'counterparty_name',
        header: 'Counterparty',
        cell: ({ row }) => (
            <span className="text-sm">{row.getValue('counterparty_name') || '-'}</span>
        ),
    },
    {
        accessorKey: 'amount',
        header: 'Qty / Amount',
        cell: ({ row }) => (
            <span className="font-mono font-medium">
                {parseFloat(row.getValue('amount')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
            </span>
        ),
    },
    {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
            <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                {row.getValue('description') || '-'}
            </span>
        ),
    },
];

export function DrillDownModal({ title, description, endpoint, isOpen, onClose }: DrillDownModalProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['drilldown', endpoint],
        queryFn: async () => {
            const response = await api.get(endpoint);
            return response.data;
        },
        enabled: isOpen
    });

    const handleRowClick = (row: DrillDownDocument) => {
        const url = getDocumentUrl(row.type, row.id);
        window.open(url, '_blank');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>

                <div className="flex-1 overflow-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : error ? (
                        <div className="text-center text-muted-foreground py-8">
                            Failed to load drill-down data
                        </div>
                    ) : (
                        <DataTable
                            columns={drillDownColumns}
                            data={data?.documents || []}
                            onRowDoubleClick={handleRowClick}
                        />
                    )}
                </div>

                {data?.total_amount && (
                    <div className="border-t pt-4 flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                            {data.documents?.length || 0} document(s)
                        </span>
                        <div className="text-right">
                            <div className="text-xs text-muted-foreground">Total Amount</div>
                            <div className="text-lg font-bold font-mono">
                                ${parseFloat(data.total_amount).toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
