import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PiListBold, PiXBold } from 'react-icons/pi';
import { ColumnDef } from '@tanstack/react-table';

interface GroupBySelectorProps {
    columns: ColumnDef<any>[];
    groupBy: string | null;
    onGroupByChange: (field: string | null) => void;
    tableName: string;
}

export function GroupBySelector({
    columns,
    groupBy,
    onGroupByChange,
    tableName
}: GroupBySelectorProps) {
    // Load saved grouping preference from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(`group_by_${tableName}`);
        if (saved && saved !== 'null') {
            onGroupByChange(saved);
        }
    }, [tableName]);

    // Save grouping preference to localStorage
    useEffect(() => {
        localStorage.setItem(`group_by_${tableName}`, groupBy || 'null');
    }, [groupBy, tableName]);

    const handleGroupByChange = (field: string | null) => {
        onGroupByChange(field);
    };

    // Get groupable columns (exclude actions, checkboxes, etc.)
    const groupableColumns = columns.filter((col: any) =>
        col.accessorKey &&
        col.accessorKey !== 'actions' &&
        col.accessorKey !== 'select'
    );

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                        <PiListBold className="mr-1.5 h-3.5 w-3.5" />
                        {groupBy ? `Grouped by: ${groupBy}` : 'Group by'}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Group by field</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleGroupByChange(null)}>
                        <span className="font-medium">None</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {groupableColumns.map((column: any) => {
                        const columnId = column.accessorKey;
                        const header = typeof column.header === 'string'
                            ? column.header
                            : columnId;

                        return (
                            <DropdownMenuItem
                                key={columnId}
                                onClick={() => handleGroupByChange(columnId)}
                                className={groupBy === columnId ? 'bg-accent' : ''}
                            >
                                {header}
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>

            {groupBy && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => handleGroupByChange(null)}
                    title="Clear grouping"
                >
                    <PiXBold className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>
    );
}
