'use client';

import { useEffect } from 'react';

interface UseDocumentKeyboardShortcutsProps {
    onAddLine?: () => void;
    onDeleteLine?: (lineId?: number) => void;
    onOpenSelector?: () => void;
    onSaveAndClose?: () => void;
    onDuplicateLine?: (lineId?: number) => void;
    onPost?: () => void;
    onSave?: () => void;
    onCancel?: () => void;
    selectedLineId?: number;
    enabled?: boolean;
}

/**
 * Enhanced keyboard shortcuts for document forms (1C-style)
 * 
 * Shortcuts:
 * - F9: Post document
 * - Ctrl+S: Save
 * - Ins: Add new line
 * - Del: Delete selected line
 * - F4: Open item selector
 * - Ctrl+Enter: Save and close
 * - Ctrl+D: Duplicate selected line
 * - Esc: Cancel/close
 */
export function useDocumentKeyboardShortcuts({
    onAddLine,
    onDeleteLine,
    onOpenSelector,
    onSaveAndClose,
    onDuplicateLine,
    onPost,
    onSave,
    onCancel,
    selectedLineId,
    enabled = true,
}: UseDocumentKeyboardShortcutsProps) {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            // Ignore if we are inside an input/textarea
            const target = event.target as HTMLElement;
            const isInputField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

            // F9 - Post document
            if (event.key === 'F9') {
                event.preventDefault();
                if (onPost) onPost();
                return;
            }

            // Ctrl+S - Save
            if (event.ctrlKey && event.key === 's') {
                event.preventDefault();
                if (onSave) onSave();
                return;
            }

            // Ctrl+Enter - Save and close
            if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault();
                if (onSaveAndClose) onSaveAndClose();
                return;
            }

            // Escape - Cancel
            if (event.key === 'Escape') {
                event.preventDefault();
                if (onCancel) onCancel();
                return;
            }

            // Don't handle other keys if in input field
            if (isInputField) return;

            // Insert - Add new line
            if (event.key === 'Insert') {
                event.preventDefault();
                if (onAddLine) onAddLine();
                return;
            }

            // Delete - Delete selected line
            if (event.key === 'Delete' && selectedLineId) {
                event.preventDefault();
                if (onDeleteLine) onDeleteLine(selectedLineId);
                return;
            }

            // F4 - Open selector
            if (event.key === 'F4') {
                event.preventDefault();
                if (onOpenSelector) onOpenSelector();
                return;
            }

            // Ctrl+D - Duplicate line
            if (event.ctrlKey && event.key === 'd' && selectedLineId) {
                event.preventDefault();
                if (onDuplicateLine) onDuplicateLine(selectedLineId);
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        onAddLine,
        onDeleteLine,
        onOpenSelector,
        onSaveAndClose,
        onDuplicateLine,
        onPost,
        onSave,
        onCancel,
        selectedLineId,
        enabled
    ]);
}
