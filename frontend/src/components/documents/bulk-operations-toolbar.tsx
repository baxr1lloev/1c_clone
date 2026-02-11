"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PiCheckBold, PiArrowCounterClockwiseBold, PiCaretDownBold, PiEyeBold, PiPrinterBold, PiTrashBold } from "react-icons/pi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";

interface BulkOperationsToolbarProps {
    selectedIds: number[];
    documentType: 'sales' | 'purchase' | 'transfer' | 'inventory';
    onSuccess?: () => void;
    onClearSelection?: () => void;
}

interface BulkOperationResult {
    success: number[];
    failed: Array<{ id: number; error: string }>;
}

/**
 * ENTERPRISE: Bulk Operations Toolbar
 * 
 * Enables bухгалтер to post 50 documents in under 1 minute.
 * Backend exists (bulk_operations.py), this is the missing UX layer!
 */
export function BulkOperationsToolbar({
    selectedIds,
    documentType,
    onSuccess,
    onClearSelection
}: BulkOperationsToolbarProps) {
    const queryClient = useQueryClient();
    const [showProgress, setShowProgress] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, failed: [] as any[] });

    const { mutate: bulkPost, isPending: isPosting } = useMutation({
        mutationFn: async (ids: number[]) => {
            const response = await api.post<BulkOperationResult>('/documents/bulk-post/', {
                document_type: documentType,
                document_ids: ids
            });
            return response;
        },
        onSuccess: (data) => {
            toast.success(`✅ Posted ${data.success.length} documents`, {
                description: data.failed.length > 0 ? `${data.failed.length} failed` : undefined
            });

            if (data.failed.length > 0) {
                // Show first few errors
                data.failed.slice(0, 3).forEach(f => {
                    toast.error(`Document #${f.id}: ${f.error}`);
                });
            }

            queryClient.invalidateQueries({ queryKey: ['documents', documentType] });
            onSuccess?.();
            onClearSelection?.();
        },
        onError: (error: any) => {
            toast.error('Bulk operation failed', {
                description: error.response?.data?.error || error.message
            });
        }
    });

    const { mutate: bulkUnpost, isPending: isUnposting } = useMutation({
        mutationFn: async (ids: number[]) => {
            const response = await api.post<BulkOperationResult>('/documents/bulk-unpost/', {
                document_type: documentType,
                document_ids: ids
            });
            return response;
        },
        onSuccess: (data) => {
            toast.success(`✅ Unposted ${data.success.length} documents`, {
                description: data.failed.length > 0 ? `${data.failed.length} failed` : undefined
            });

            queryClient.invalidateQueries({ queryKey: ['documents', documentType] });
            onSuccess?.();
            onClearSelection?.();
        }
    });

    const { mutate: bulkDelete, isPending: isDeleting } = useMutation({
        mutationFn: async (ids: number[]) => {
            const response = await api.post<BulkOperationResult>('/documents/bulk-delete/', {
                document_type: documentType,
                document_ids: ids
            });
            return response;
        },
        onSuccess: (data) => {
            toast.success(`✅ Marked ${data.success.length} documents for deletion`);
            queryClient.invalidateQueries({ queryKey: ['documents', documentType] });
            onSuccess?.();
            onClearSelection?.();
        }
    });

    const handleBulkPost = () => {
        if (selectedIds.length === 0) {
            toast.error('No documents selected');
            return;
        }

        bulkPost(selectedIds);
    };

    const handleBulkUnpost = () => {
        if (selectedIds.length === 0) {
            toast.error('No documents selected');
            return;
        }

        bulkUnpost(selectedIds);
    };

    const handleBulkDelete = () => {
        if (selectedIds.length === 0) {
            toast.error('No documents selected');
            return;
        }

        if (!confirm(`Mark ${selectedIds.length} documents for deletion?`)) {
            return;
        }

        bulkDelete(selectedIds);
    };

    const isPending = isPosting || isUnposting || isDeleting;

    if (selectedIds.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Badge variant="default" className="px-3 py-1 text-base">
                {selectedIds.length} selected
            </Badge>

            <Separator orientation="vertical" className="h-6" />

            <Button
                size="sm"
                onClick={handleBulkPost}
                disabled={isPending}
            >
                <PiCheckBold className="mr-2 h-4 w-4" />
                Post Selected
            </Button>

            <Button
                size="sm"
                variant="outline"
                onClick={handleBulkUnpost}
                disabled={isPending}
            >
                <PiArrowCounterClockwiseBold className="mr-2 h-4 w-4" />
                Unpost Selected
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" disabled={isPending}>
                        More Actions <PiCaretDownBold className="ml-2 h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toast.info('Preview feature coming soon')}>
                        <PiEyeBold className="mr-2 h-4 w-4" />
                        Preview Changes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info('Bulk print feature coming soon')}>
                        <PiPrinterBold className="mr-2 h-4 w-4" />
                        Print All
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleBulkDelete}
                        className="text-destructive focus:text-destructive"
                    >
                        <PiTrashBold className="mr-2 h-4 w-4" />
                        Mark for Deletion
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-6" />

            <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
                disabled={isPending}
            >
                Clear Selection
            </Button>
        </div>
    );
}
