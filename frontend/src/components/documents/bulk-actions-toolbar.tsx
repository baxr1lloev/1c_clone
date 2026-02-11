'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PiCheckBold, PiXBold, PiTrashBold, PiPrinterBold, PiDotsThreeBold } from 'react-icons/pi';

interface BulkActionsToolbarProps {
    selectedIds: number[];
    documentType: 'sales' | 'purchase';
    onClearSelection?: () => void;
}

export function BulkActionsToolbar({
    selectedIds,
    documentType,
    onClearSelection
}: BulkActionsToolbarProps) {
    const queryClient = useQueryClient();
    const selectedCount = selectedIds.length;

    // Bulk post mutation
    const { mutate: bulkPost, isPending: isPosting } = useMutation({
        mutationFn: async (ids: number[]) => {
            const response = await api.post('/documents/bulk-post', {
                document_type: documentType,
                document_ids: ids
            });
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(`Posted ${data.success.length} documents`);
            if (data.failed.length > 0) {
                data.failed.forEach((f: any) => {
                    toast.error(`Failed #${f.id}: ${f.error}`);
                });
            }
            queryClient.invalidateQueries({ queryKey: [`${documentType}-documents`] });
            onClearSelection?.();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Bulk post failed');
        }
    });

    // Bulk unpost mutation
    const { mutate: bulkUnpost } = useMutation({
        mutationFn: async (ids: number[]) => {
            const response = await api.post('/documents/bulk-unpost', {
                document_type: documentType,
                document_ids: ids
            });
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(`Unposted ${data.success.length} documents`);
            if (data.failed.length > 0) {
                data.failed.forEach((f: any) => {
                    toast.error(`Failed #${f.id}: ${f.error}`);
                });
            }
            queryClient.invalidateQueries({ queryKey: [` ${documentType}-documents`] });
            onClearSelection?.();
        },
    });

    // Bulk delete mutation
    const { mutate: bulkDelete } = useMutation({
        mutationFn: async (ids: number[]) => {
            const response = await api.post('/documents/bulk-delete', {
                document_type: documentType,
                document_ids: ids
            });
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(`Marked ${data.success.length} documents for deletion`);
            if (data.failed.length > 0) {
                data.failed.forEach((f: any) => {
                    toast.error(`Failed #${f.id}: ${f.error}`);
                });
            }
            queryClient.invalidateQueries({ queryKey: [`${documentType}-documents`] });
            onClearSelection?.();
        },
    });

    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border-b border-blue-200">
            <Badge variant="default" className="bg-blue-600">
                {selectedCount} selected
            </Badge>

            <Separator orientation="vertical" className="h-6" />

            {/* Post selected */}
            <Button
                size="sm"
                onClick={() => bulkPost(selectedIds)}
                disabled={isPosting}
                className="bg-green-600 hover:bg-green-700"
            >
                <PiCheckBold className="mr-2 h-4 w-4" />
                Post Selected
            </Button>

            {/* Unpost selected */}
            <Button
                size="sm"
                variant="outline"
                onClick={() => bulkUnpost(selectedIds)}
            >
                <PiXBold className="mr-2 h-4 w-4" />
                Unpost Selected
            </Button>

            <Separator orientation="vertical" className="h-6" />

            {/* Print all */}
            <Button
                size="sm"
                variant="outline"
                onClick={() => {
                    toast.info('Bulk print not yet implemented');
                }}
            >
                <PiPrinterBold className="mr-2 h-4 w-4" />
                Print All
            </Button>

            {/* More actions */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                        <PiDotsThreeBold className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => {
                        toast.info('Bulk date change not yet implemented');
                    }}>
                        Change Date
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => bulkDelete(selectedIds)}
                        className="text-destructive"
                    >
                        <PiTrashBold className="mr-2 h-4 w-4" />
                        Mark for Deletion
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            {/* Clear selection */}
            <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
            >
                Clear Selection
            </Button>
        </div>
    );
}
