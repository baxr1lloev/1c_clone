import { useState, useEffect } from 'react';
import { ReferenceLink } from './reference-link';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

type ReferenceType =
    | 'counterparty' | 'item' | 'warehouse' | 'contract'
    | 'sales-document' | 'purchase-document' | 'payment-document' | 'transfer-document';

interface LinkableCellProps {
    id: number;
    type: ReferenceType;
    label: string | number;
    className?: string;
    showIcon?: boolean;
}

interface PreviewData {
    id: number;
    type: string;
    name?: string;
    summary?: {
        balance?: number;
        stock?: number;
        status?: string;
        last_document?: string;
        last_document_date?: string;
    };
}

function PreviewCard({ data, type }: { data: PreviewData | null; type: ReferenceType }) {
    if (!data) {
        return (
            <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-2 min-w-[250px]">
            <div className="font-semibold text-sm">{data.name || `#${data.id}`}</div>

            {data.summary && (
                <div className="space-y-1 text-xs text-muted-foreground">
                    {data.summary.balance !== undefined && (
                        <div className="flex justify-between">
                            <span>Balance:</span>
                            <span className={data.summary.balance < 0 ? 'text-red-600' : 'text-green-600'}>
                                ${Math.abs(data.summary.balance).toFixed(2)}
                            </span>
                        </div>
                    )}

                    {data.summary.stock !== undefined && (
                        <div className="flex justify-between">
                            <span>Stock:</span>
                            <span className="font-mono">{data.summary.stock}</span>
                        </div>
                    )}

                    {data.summary.status && (
                        <div className="flex justify-between">
                            <span>Status:</span>
                            <span className="capitalize">{data.summary.status}</span>
                        </div>
                    )}

                    {data.summary.last_document && (
                        <div className="pt-1 border-t">
                            <div className="text-[10px] text-muted-foreground">Last Activity</div>
                            <div>{data.summary.last_document}</div>
                            {data.summary.last_document_date && (
                                <div className="text-[10px]">{new Date(data.summary.last_document_date).toLocaleDateString()}</div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function LinkableCell({ id, type, label, className, showIcon = false }: LinkableCellProps) {
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isHovering && !preview && !isLoading) {
            setIsLoading(true);

            // Lazy load preview data
            const entityType = type.replace('-document', '');
            api.get(`/api/${entityType}s/${id}/preview`)
                .then(response => {
                    setPreview(response.data);
                })
                .catch(() => {
                    // Fallback preview if endpoint doesn't exist yet
                    setPreview({
                        id,
                        type,
                        name: String(label),
                        summary: {}
                    });
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [isHovering, preview, isLoading, id, type, label]);

    return (
        <HoverCard openDelay={300} closeDelay={100}>
            <HoverCardTrigger
                asChild
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <span className="inline-block">
                    <ReferenceLink
                        id={id}
                        type={type}
                        label={label}
                        className={className}
                        showIcon={showIcon}
                    />
                </span>
            </HoverCardTrigger>
            <HoverCardContent side="right" align="start" className="w-auto">
                <PreviewCard data={preview} type={type} />
            </HoverCardContent>
        </HoverCard>
    );
}
