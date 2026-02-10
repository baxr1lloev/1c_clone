import React from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PiGearBold } from 'react-icons/pi';

interface QuickFiltersProps {
    filters: Record<string, any>;
    onFilterChange: (key: string, value: any) => void;
    filterOptions: {
        key: string;
        label: string;
        options: { value: any; label: string }[];
    }[];
    className?: string;
}

export function QuickFilters({ filters, onFilterChange, filterOptions, className }: QuickFiltersProps) {
    const activeFilterCount = Object.values(filters).filter(v => v !== 'all' && v !== null && v !== undefined).length;

    return (
        <div className={`flex items-center gap-2 ${className || ''}`}>
            {filterOptions.map(filterGroup => (
                <div key={filterGroup.key} className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{filterGroup.label}:</span>
                    <div className="flex gap-1">
                        {filterGroup.options.map(option => (
                            <Button
                                key={option.value}
                                variant={filters[filterGroup.key] === option.value ? 'default' : 'outline'}
                                size="sm"
                                className="h-7 text-xs px-2"
                                onClick={() => onFilterChange(filterGroup.key, option.value)}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                </div>
            ))}

            {activeFilterCount > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                        filterOptions.forEach(fg => onFilterChange(fg.key, 'all'));
                    }}
                >
                    Clear ({activeFilterCount})
                </Button>
            )}
        </div>
    );
}
