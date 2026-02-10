import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface EditableCellProps {
    value: string | number;
    onSave: (value: string | number) => void;
    type?: 'text' | 'number' | 'date';
    className?: string;
    disabled?: boolean;
}

export function EditableCell({
    value,
    onSave,
    type = 'text',
    className,
    disabled = false
}: EditableCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);

    const handleSave = () => {
        if (editValue !== value) {
            onSave(editValue);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditValue(value);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        } else if (e.key === 'Tab') {
            handleSave();
            // Tab will naturally move to next cell
        }
    };

    if (disabled) {
        return (
            <div className={cn("px-2 py-1", className)}>
                {value}
            </div>
        );
    }

    if (isEditing) {
        return (
            <Input
                type={type}
                value={editValue}
                onChange={(e) => setEditValue(type === 'number' ? Number(e.target.value) : e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={cn("h-8 px-2 py-1", className)}
                autoFocus
            />
        );
    }

    return (
        <div
            className={cn(
                "px-2 py-1 cursor-pointer hover:bg-accent/50 rounded",
                "transition-colors duration-150",
                className
            )}
            onDoubleClick={() => !disabled && setIsEditing(true)}
            title="Double-click to edit"
        >
            {value}
        </div>
    );
}
