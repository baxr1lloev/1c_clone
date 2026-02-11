'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AuditTrailTable } from './audit-trail-table';
import { Loader2 } from 'lucide-react';

interface DocumentHistoryPanelProps {
    documentId: number;
    documentType: string;
}

export function DocumentHistoryPanel({ documentId, documentType }: DocumentHistoryPanelProps) {
    const { data: auditTrail, isLoading, error } = useQuery({
        queryKey: ['audit-trail', documentType, documentId],
        queryFn: async () => {
            const response = await api.get(`/documents/${documentType}/${documentId}/audit/`);
            return response;
        },
        enabled: !!documentId,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
                Failed to load audit history.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Document History</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Track all changes made to this document, including creation, updates, posting, and unposting.
            </p>
            <AuditTrailTable trail={auditTrail} />
        </div>
    );
}
