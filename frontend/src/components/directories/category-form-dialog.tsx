'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';

interface CategoryFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When creating: null = root category, number = subcategory under this parent */
    parentId?: number | null;
    /** Optional label for subcategory mode (e.g. parent category name) */
    parentName?: string | null;
    initialData?: { id: number; name: string; code: string; parent: number | null };
    onCreated?: (id: number) => void;
}

export function CategoryFormDialog({
    open,
    onOpenChange,
    parentId,
    parentName,
    initialData,
    onCreated,
}: CategoryFormDialogProps) {
    const queryClient = useQueryClient();
    const [name, setName] = useState(initialData?.name || '');
    const [code, setCode] = useState(initialData?.code || '');
    const [parent, setParent] = useState<number | null>(parentId ?? initialData?.parent ?? null);

    useEffect(() => {
        if (open) {
            if (initialData) {
                setName(initialData.name);
                setCode(initialData.code);
                setParent(initialData.parent);
            } else {
                setName('');
                setCode('');
                setParent(parentId ?? null);
            }
        }
    }, [open, initialData, parentId]);

    const { data: categories } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await api.get('/directories/categories/');
            return Array.isArray(res) ? res : (res.results || []);
        },
    });

    const saveMutation = useMutation({
        mutationFn: async (data: { name: string; code: string; parent: number | null }) => {
            if (initialData) {
                return api.put(`/directories/categories/${initialData.id}/`, data);
            }
            return api.post('/directories/categories/', data);
        },
        onSuccess: (data: { id?: number }) => {
            toast.success(initialData ? 'Category updated' : 'Category created');
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            queryClient.invalidateQueries({ queryKey: ['categories-tree'] });
            if (!initialData && data?.id != null) {
                onCreated?.(data.id);
            }
            onOpenChange(false);
            setName('');
            setCode('');
            setParent(parentId ?? null);
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { detail?: string } } };
            const message =
                err.response?.data?.detail || (err as Error).message || 'Failed to save category';
            toast.error(message);
        },
    });

    const handleSubmit = () => {
        if (!name.trim()) {
            toast.error('Category name is required');
            return;
        }
        saveMutation.mutate({ name: name.trim(), code: code.trim(), parent });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {initialData
                            ? 'Edit Category'
                            : parentId != null && parentName
                              ? `New subcategory under "${parentName}"`
                              : 'New root category'}
                    </DialogTitle>
                    <DialogDescription>
                        {initialData
                            ? 'Update category details'
                            : parentId != null
                              ? 'Create a child category under the selected parent.'
                              : 'Create a top-level category for organizing items.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="category-name">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="category-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Electronics"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="category-code">Code</Label>
                        <Input
                            id="category-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="ELEC"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="category-parent">Parent Category</Label>
                        <Select
                            value={parent != null ? parent.toString() : '__none__'}
                            onValueChange={(value) =>
                                setParent(value === '__none__' ? null : parseInt(value))
                            }
                        >
                            <SelectTrigger id="category-parent">
                                <SelectValue placeholder="None (root category)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">None (root category)</SelectItem>
                                {categories
                                    ?.filter(
                                        (cat: { id: number }) =>
                                            !initialData || cat.id !== initialData.id
                                    )
                                    .map((cat: { id: number; name: string }) => (
                                        <SelectItem key={cat.id} value={cat.id.toString()}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                        {saveMutation.isPending
                            ? 'Saving...'
                            : initialData
                              ? 'Update'
                              : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
