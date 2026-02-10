'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { TreeView } from '@/components/ui/tree-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from "@/components/ui/resizable";
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';
import { PiPlusBold, PiPencilBold, PiTrashBold, PiFolderPlusBold } from 'react-icons/pi';
import { toast } from 'sonner';

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
}

export default function ItemCategoriesPage() {
    const queryClient = useQueryClient();
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);

    // Fetch Tree
    const { data: treeData } = useQuery({
        queryKey: ['categories-tree'],
        queryFn: async () => {
            // Assuming endpoint returns hierarchical structure using 'root_only=true' logic
            // OR entire list and we build tree here.
            // For now assume API returns tree for root items.
            const res = await api.get('/directories/categories/?root_only=true');
            if (Array.isArray(res.data)) return res.data;
            if (res.data && Array.isArray(res.results)) return res.results;
            return [];
        }
    });

    // Fetch Items for Category
    const { data: items, isLoading } = useQuery({
        queryKey: ['items', selectedCategory?.id],
        queryFn: async () => {
            let url = '/directories/items/';
            if (selectedCategory) {
                // Filter by category
                url += `?category=${selectedCategory.id}`;
            }
            const res = await api.get(url);
            if (Array.isArray(res.data)) return res.data;
            if (res.data && Array.isArray(res.results)) return res.results;
            return [];
        }
    });

    const columns: ColumnDef<Item>[] = [
        { accessorKey: 'sku', header: 'Article' },
        { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-bold">{row.original.name}</span> },
        {
            accessorKey: 'selling_price',
            header: 'Price',
            cell: ({ row }) => <span className="font-mono">{Number(row.original.selling_price).toFixed(2)}</span>
        },
    ];

    const mainActions: CommandBarAction[] = [
        { label: 'New Item', icon: <PiPlusBold />, onClick: () => { }, shortcut: 'Ins' },
        { label: 'New Group', icon: <PiFolderPlusBold />, onClick: () => { }, variant: 'outline' },
    ];

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <div className="border-b p-2 flex items-center justify-between bg-muted/20">
                <h1 className="font-bold text-lg px-2">Nomenclature (Items)</h1>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline">Import</Button>
                    <Button size="sm" variant="outline">Export</Button>
                </div>
            </div>

            <ResizablePanelGroup direction="horizontal" id="categories-group">
                {/* Left Panel: Tree */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={40} className="bg-muted/5" id="categories-tree-panel">
                    <div className="p-2 border-b text-xs font-semibold uppercase text-muted-foreground">
                        Categories
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
                        commandBar={
                            <CommandBar
                                mainActions={mainActions}
                                selectionActions={[]}
                                onSearch={() => { }}
                            />
                        }
                    />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}

