// Simple context menu wrapper - will be replaced with shadcn later
import React from 'react';

export const ContextMenu = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const ContextMenuTrigger = ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>;
export const ContextMenuContent = ({ children, className }: { children: React.ReactNode; className?: string }) => null;
export const ContextMenuItem = ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => null;
export const ContextMenuSeparator = () => null;
export const ContextMenuShortcut = ({ children }: { children: React.ReactNode }) => null;
