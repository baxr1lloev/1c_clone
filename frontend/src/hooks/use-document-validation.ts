'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useEffect } from 'react';

interface ValidationError {
    type: string;
    message: string;
    line_id?: number | string;
    severity: 'error' | 'warning';  // Match DetailedValidationPanel interface
    field?: string;
    details?: {
        item_name?: string;
        required?: number;
        available?: number;
        shortage?: number;
        line_number?: number;
    };
    [key: string]: any;
}

interface ValidationWarning {
    type: string;
    message: string;
    line_id?: number | string;
    severity: 'error' | 'warning';  // Match DetailedValidationPanel interface
    field?: string;
    details?: any;
    [key: string]: any;
}

interface ValidationResult {
    is_valid: boolean;
    can_post: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

interface UseDocumentValidationProps {
    documentType: 'sales' | 'purchase';
    documentId?: number;
    document?: any;
    lines?: any[];
    enabled?: boolean;
}

export function useDocumentValidation({
    documentType,
    documentId,
    document,
    lines,
    enabled = true
}: UseDocumentValidationProps) {
    const { data: validation, refetch, isLoading } = useQuery<ValidationResult>({
        queryKey: ['validate-document', documentType, documentId, document, lines],
        queryFn: async () => {
            const payload = documentId
                ? { document_id: documentId }
                : { ...document, lines };

            const response = await api.post(
                `/documents/${documentType}/validate`,
                payload
            );
            return response;
        },
        enabled: enabled && (!!documentId || !!document),
        refetchInterval: 5000, // Re-validate every 5 seconds
        staleTime: 0, // Always consider stale for fresh validation
    });

    return {
        validation,
        isValid: validation?.is_valid ?? false,
        canPost: validation?.can_post ?? false,
        errors: validation?.errors ?? [],
        warnings: validation?.warnings ?? [],
        refetch,
        isValidating: isLoading
    };
}
