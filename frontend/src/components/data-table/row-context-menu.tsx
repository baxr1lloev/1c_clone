import React from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
    ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { PiPencilBold, PiTrashBold, PiEyeBold, PiCopyBold } from 'react-icons/pi';

export interface ContextMenuAction {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    shortcut?: string;
    variant?: 'default' | 'destructive';
    separator?: boolean;
}

interface DataTableRowContextMenuProps {
    children: React.ReactNode;
    actions: ContextMenuAction[];
}

export function DataTableRowContextMenu({ children, actions }: DataTableRowContextMenuProps) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
                {actions.map((action, index) => (
                    <React.Fragment key={index}>
                        {action.separator && index > 0 && <ContextMenuSeparator />}
                        <ContextMenuItem
                            onClick={action.onClick}
                            className={action.variant === 'destructive' ? 'text-destructive focus:text-destructive' : ''}
                        >
                            {action.icon && <span className="mr-2">{action.icon}</span>}
                            {action.label}
                            {action.shortcut && <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut>}
                        </ContextMenuItem>
                    </React.Fragment>
                ))}
            </ContextMenuContent>
        </ContextMenu>
    );
}

// Default actions builder
export function buildDefaultContextActions(
    onView?: () => void,
    onEdit?: () => void,
    onDelete?: () => void,
    onCopy?: () => void
): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];

    if (onView) {
        actions.push({
            label: 'View',
            icon: <PiEyeBold className="h-4 w-4" />,
            onClick: onView,
            shortcut: 'Enter'
        });
    }

    if (onEdit) {
        actions.push({
            label: 'Edit',
            icon: <PiPencilBold className="h-4 w-4" />,
            onClick: onEdit,
            shortcut: 'F2'
        });
    }

    if (onCopy) {
        actions.push({
            label: 'Copy',
            icon: <PiCopyBold className="h-4 w-4" />,
            onClick: onCopy,
            shortcut: 'Ctrl+C',
            separator: true
        });
    }

    if (onDelete) {
        actions.push({
            label: 'Delete',
            icon: <PiTrashBold className="h-4 w-4" />,
            onClick: onDelete,
            shortcut: 'Del',
            variant: 'destructive',
            separator: !onCopy
        });
    }

    return actions;
}
