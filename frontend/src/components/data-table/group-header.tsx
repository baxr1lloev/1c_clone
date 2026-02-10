import React from 'react';
import { Button } from '@/components/ui/button';
import { PiCaretDownBold, PiCaretRightBold } from 'react-icons/pi';
import { cn } from '@/lib/utils';

interface GroupHeaderProps {
    label: string;
    count: number;
    isExpanded: boolean;
    onToggle: () => void;
}

export function GroupHeader({ label, count, isExpanded, onToggle }: GroupHeaderProps) {
    return (
        <div
            className={cn(
                "sticky top-0 z-10 flex items-center gap-2 px-4 py-2",
                "bg-muted/80 backdrop-blur-sm border-y border-border",
                "hover:bg-muted cursor-pointer select-none"
            )}
            onClick={onToggle}
        >
            <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                }}
            >
                {isExpanded ? (
                    <PiCaretDownBold className="h-4 w-4" />
                ) : (
                    <PiCaretRightBold className="h-4 w-4" />
                )}
            </Button>
            <span className="font-semibold text-sm">{label}</span>
            <span className="text-xs text-muted-foreground">({count} records)</span>
        </div>
    );
}
