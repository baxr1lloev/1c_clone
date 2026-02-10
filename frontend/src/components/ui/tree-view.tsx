'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { PiCaretRightBold, PiFolderBold, PiFolderOpenBold } from 'react-icons/pi';

interface TreeNode {
    id: number;
    name: string;
    children?: TreeNode[];
}

interface TreeViewProps {
    data: TreeNode[];
    onSelect: (node: TreeNode) => void;
    selectedId?: number | null;
    className?: string;
}

const TreeNodeItem = ({
    node,
    level = 0,
    onSelect,
    selectedId
}: {
    node: TreeNode;
    level: number;
    onSelect: (n: TreeNode) => void;
    selectedId?: number | null;
}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedId === node.id;

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-accent/50 rounded-sm select-none",
                    isSelected && "bg-primary/10 text-primary font-medium"
                )}
                style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
                onClick={() => {
                    onSelect(node);
                    if (hasChildren) setIsOpen(!isOpen);
                }}
            >
                <div
                    className={cn(
                        "p-0.5 rounded-sm hover:bg-accent transition-transform duration-200",
                        isOpen && "rotate-90"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }}
                >
                    {hasChildren ? (
                        <PiCaretRightBold className="h-3 w-3 text-muted-foreground" />
                    ) : (
                        <div className="w-3" /> // Spacer
                    )}
                </div>

                {isOpen ? (
                    <PiFolderOpenBold className="h-4 w-4 text-amber-400" />
                ) : (
                    <PiFolderBold className="h-4 w-4 text-amber-400" />
                )}

                <span className="text-sm truncate">{node.name}</span>
            </div>

            {isOpen && hasChildren && (
                <div>
                    {node.children!.map(child => (
                        <TreeNodeItem
                            key={child.id}
                            node={child}
                            level={level + 1}
                            onSelect={onSelect}
                            selectedId={selectedId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export function TreeView({ data, onSelect, selectedId, className }: TreeViewProps) {
    return (
        <div className={cn("border rounded-md py-2 overflow-auto bg-background", className)}>
            {data.map(node => (
                <TreeNodeItem
                    key={node.id}
                    node={node}
                    level={0}
                    onSelect={onSelect}
                    selectedId={selectedId}
                />
            ))}
            {data.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No categories found.
                </div>
            )}
        </div>
    );
}
