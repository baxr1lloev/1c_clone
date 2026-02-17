'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { TreeView } from '@/components/ui/tree-view';
import { Button } from '@/components/ui/button';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from "@/components/ui/resizable";
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';
import { PiPlusBold, PiFolderPlusBold, PiPencilBold } from 'react-icons/pi';
import { CategoryFormDialog } from '@/components/directories/category-form-dialog';

interface Category {
    id: number;
    name: string;
    code: string;
    children: Category[];
}

interface Item {
    id: number;
    name: string;
    sku: string;
    category: number;
    selling_price: number;
    base_unit?: string;
    unit?: string;
    units?: Array<{ id: number; name: string; coefficient: number; is_default?: boolean }>;
    packages?: Array<{ id: number; name: string; coefficient: number; is_default?: boolean }>;
}

export default function ItemCategoriesPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [categoryDialogParent, setCategoryDialogParent] = useState<number | null>(null);
    const [categoryDialogParentName, setCategoryDialogParentName] = useState<string | null>(null);

    // Fetch Tree - build hierarchy from flat list
    const { data: treeData } = useQuery({
        queryKey: ['categories-tree'],
        queryFn: async () => {
            const res = await api.get('/directories/categories/');
            const all = Array.isArray(res) ? res : (res.results || []);
            const map = new Map<number, Category>();
            const roots: Category[] = [];
            all.forEach((c: { id: number; name: string; code?: string; parent?: number }) => {
                map.set(c.id, { id: c.id, name: c.name, code: c.code || '', children: [] });
            });
            all.forEach((c: { id: number; parent?: number }) => {
                const node = map.get(c.id)!;
                if (c.parent != null && map.has(c.parent)) {
                    map.get(c.parent)!.children.push(node);
                } else {
                    roots.push(node);
                }
            });
            return roots;
        }
    });

    // Fetch Items for Category
    const { data: items, isLoading } = useQuery({
        queryKey: ['items', selectedCategory?.id],
        queryFn: async () => {
            let url = '/directories/items/';
            if (selectedCategory) url += `?category=${selectedCategory.id}`;
            const res = await api.get(url);
            return Array.isArray(res) ? res : (res.results || []);
        }
    });

    const createSampleMutation = useMutation({
        mutationFn: () => api.post('/directories/items/create_sample/'),
        onSuccess: (data: { created?: { name: string }[]; message?: string }) => {
            const count = data?.created?.length ?? 0;
            toast.success(data?.message ?? `Created ${count} sample items. You can now use them in Sales and Purchases.`);
            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['categories-tree'] });
        },
        onError: (err: { response?: { data?: { error?: string } } }) => {
            toast.error(err?.response?.data?.error ?? 'Failed to create sample items');
        },
    });

    const handleNewItem = () => router.push('/directories/items/new');
    const handleEditItem = (item: Item) => router.push(`/directories/items/${item.id}/edit`);
    const handleNewGroup = () => {
        setCategoryDialogParent(selectedCategory?.id ?? null);
        setCategoryDialogParentName(selectedCategory?.name ?? null);
        setIsCategoryDialogOpen(true);
    };

    const columns: ColumnDef<Item>[] = [
        { accessorKey: 'sku', header: 'Article' },
        { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-bold">{row.original.name}</span> },
        {
            accessorKey: 'selling_price',
            header: 'Price',
            cell: ({ row }) => <span className="font-mono">{Number(row.original.selling_price).toFixed(2)}</span>
        },
        {
            id: 'unit',
            header: 'Unit',
            cell: ({ row }) => row.original.base_unit || row.original.unit || '-',
        },
        {
            id: 'packages',
            header: 'Packaging',
            cell: ({ row }) => {
                const units = row.original.units || row.original.packages || [];
                if (!units.length) return '-';
                const defaultUnit = units.find((u) => u.is_default) || units[0];
                return `${units.length} (${defaultUnit.name})`;
            },
        },
    ];

    const mainActions: CommandBarAction[] = [
        { label: 'New Item', icon: <PiPlusBold />, onClick: handleNewItem, shortcut: 'Ins' },
        { label: 'New Group', icon: <PiFolderPlusBold />, onClick: handleNewGroup, variant: 'outline' },
    ];
    const selectionActions: CommandBarAction[] = selectedItem ? [
        { label: 'Edit Item', icon: <PiPencilBold />, onClick: () => handleEditItem(selectedItem) },
    ] : [];

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <div className="border-b p-2 flex items-center justify-between bg-muted/20">
                <h1 className="font-bold text-lg px-2">Nomenclature (Items)</h1>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="default"
                        onClick={() => createSampleMutation.mutate()}
                        disabled={createSampleMutation.isPending}
                    >
                        {createSampleMutation.isPending ? 'Creating...' : 'Create sample items'}
                    </Button>
                    <Button size="sm" variant="outline">Import</Button>
                    <Button size="sm" variant="outline">Export</Button>
                </div>
            </div>

            <ResizablePanelGroup direction="horizontal" id="categories-group">
                {/* Left Panel: Tree */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={40} className="bg-muted/5" id="categories-tree-panel">
                    <div className="p-2 border-b flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">Categories</span>
                        <div className="flex gap-1 shrink-0">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => { setCategoryDialogParent(null); setCategoryDialogParentName(null); setIsCategoryDialogOpen(true); }}
                                title="New root category"
                            >
                                <PiFolderPlusBold className="h-3.5 w-3 mr-1" />
                                New
                            </Button>
                            {selectedCategory && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => { setCategoryDialogParent(selectedCategory.id); setCategoryDialogParentName(selectedCategory.name); setIsCategoryDialogOpen(true); }}
                                    title={`New subcategory under "${selectedCategory.name}"`}
                                >
                                    <PiPlusBold className="h-3.5 w-3 mr-1" />
                                    Subcategory
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="p-2 h-full overflow-auto">
                        <TreeView
                            data={treeData || []}
                            onSelect={(node) => setSelectedCategory(node as unknown as Category)}
                            selectedId={selectedCategory?.id}
                        />
                    </div>
                </ResizablePanel>

                <ResizableHandle id="categories-handle" />

                {/* Right Panel: List */}
                <ResizablePanel defaultSize={80} id="categories-list-panel">
                    <DataTable
                        columns={columns}
                        data={items || []}
                        isLoading={isLoading}
                        onRowClick={setSelectedItem}
                        onRowDoubleClick={handleEditItem}
                        commandBar={
                            <CommandBar
                                mainActions={mainActions}
                                selectionActions={selectionActions}
                                onSearch={() => { }}
                            />
                        }
                    />
                </ResizablePanel>
            </ResizablePanelGroup>

            <CategoryFormDialog
                open={isCategoryDialogOpen}
                onOpenChange={setIsCategoryDialogOpen}
                parentId={categoryDialogParent}
                parentName={categoryDialogParentName}
            />
        </div>
    );
}

