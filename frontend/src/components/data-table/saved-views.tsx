import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PiBookmarkSimpleBold, PiStarBold, PiTrashBold, PiCheckBold } from 'react-icons/pi';
import { SortingState } from '@tanstack/react-table';
import { toast } from 'sonner';

export interface SavedView {
    id: string;
    name: string;
    tableName: string;
    filters: Record<string, any>;
    sorting: SortingState;
    columnVisibility: Record<string, boolean>;
    groupBy: string | null;
    isDefault: boolean;
    createdAt: string;
}

interface SavedViewsProps {
    tableName: string;
    currentState: {
        filters: Record<string, any>;
        sorting: SortingState;
        columnVisibility: Record<string, boolean>;
        groupBy: string | null;
    };
    onLoadView: (view: SavedView) => void;
}

export function SavedViews({ tableName, currentState, onLoadView }: SavedViewsProps) {
    const [views, setViews] = useState<SavedView[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newViewName, setNewViewName] = useState('');

    // Load views from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(`saved_views_${tableName}`);
        if (saved) {
            try {
                setViews(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load saved views:', e);
            }
        }
    }, [tableName]);

    // Save views to localStorage
    const saveViews = (updatedViews: SavedView[]) => {
        localStorage.setItem(`saved_views_${tableName}`, JSON.stringify(updatedViews));
        setViews(updatedViews);
    };

    // Save current view
    const handleSaveView = () => {
        if (!newViewName.trim()) {
            toast.error('Please enter a view name');
            return;
        }

        const newView: SavedView = {
            id: Date.now().toString(),
            name: newViewName,
            tableName,
            filters: currentState.filters,
            sorting: currentState.sorting,
            columnVisibility: currentState.columnVisibility,
            groupBy: currentState.groupBy,
            isDefault: views.length === 0, // First view is default
            createdAt: new Date().toISOString()
        };

        saveViews([...views, newView]);
        setNewViewName('');
        setIsDialogOpen(false);
        toast.success(`View "${newViewName}" saved`);
    };

    // Load view
    const handleLoadView = (view: SavedView) => {
        onLoadView(view);
        toast.success(`Loaded view "${view.name}"`);
    };

    // Delete view
    const handleDeleteView = (viewId: string) => {
        const updatedViews = views.filter(v => v.id !== viewId);
        saveViews(updatedViews);
        toast.success('View deleted');
    };

    // Set default view
    const handleSetDefault = (viewId: string) => {
        const updatedViews = views.map(v => ({
            ...v,
            isDefault: v.id === viewId
        }));
        saveViews(updatedViews);
        toast.success('Default view updated');
    };

    const defaultView = views.find(v => v.isDefault);

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                        <PiBookmarkSimpleBold className="mr-1.5 h-3.5 w-3.5" />
                        {defaultView ? defaultView.name : 'Views'}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {views.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                            No saved views
                        </div>
                    ) : (
                        views.map(view => (
                            <DropdownMenuItem
                                key={view.id}
                                className="flex items-center justify-between"
                                onClick={() => handleLoadView(view)}
                            >
                                <span className="flex items-center gap-2">
                                    {view.isDefault && <PiStarBold className="h-3 w-3 text-yellow-500" />}
                                    {view.name}
                                </span>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    {!view.isDefault && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => handleSetDefault(view.id)}
                                            title="Set as default"
                                        >
                                            <PiCheckBold className="h-3 w-3" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-destructive"
                                        onClick={() => handleDeleteView(view.id)}
                                        title="Delete view"
                                    >
                                        <PiTrashBold className="h-3 w-3" />
                                    </Button>
                                </div>
                            </DropdownMenuItem>
                        ))
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
                        + Save Current View
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save Current View</DialogTitle>
                        <DialogDescription>
                            Save your current filters, sorting, columns, and grouping settings.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="view-name">View Name</Label>
                            <Input
                                id="view-name"
                                placeholder="e.g., My Active Documents"
                                value={newViewName}
                                onChange={(e) => setNewViewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveView();
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveView}>Save View</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
