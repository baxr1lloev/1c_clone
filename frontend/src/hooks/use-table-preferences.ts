'use client';

import { useState, useCallback, useEffect } from 'react';

export interface TablePreferences {
    columnWidths: Record<string, number>;
    hiddenColumns: string[];
    sortBy?: { id: string; desc: boolean };
}

interface UseTablePreferencesReturn {
    prefs: TablePreferences;
    savePreferences: (newPrefs: Partial<TablePreferences>) => void;
    resetPreferences: () => void;
    setColumnWidth: (columnId: string, width: number) => void;
    toggleColumnVisibility: (columnId: string) => void;
    setSorting: (columnId: string, desc: boolean) => void;
}

const DEFAULT_PREFERENCES: TablePreferences = {
    columnWidths: {},
    hiddenColumns: [],
    sortBy: undefined,
};

export function useTablePreferences(tableId: string): UseTablePreferencesReturn {
    const [prefs, setPrefs] = useState<TablePreferences>(() => {
        if (typeof window === 'undefined') return DEFAULT_PREFERENCES;

        try {
            const saved = localStorage.getItem(`table_prefs_${tableId}`);
            return saved ? JSON.parse(saved) : DEFAULT_PREFERENCES;
        } catch (e) {
            console.error('Failed to load table preferences:', e);
            return DEFAULT_PREFERENCES;
        }
    });

    const savePreferences = useCallback((newPrefs: Partial<TablePreferences>) => {
        setPrefs(current => {
            const updated = { ...current, ...newPrefs };

            try {
                localStorage.setItem(`table_prefs_${tableId}`, JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to save table preferences:', e);
            }

            return updated;
        });
    }, [tableId]);

    const resetPreferences = useCallback(() => {
        setPrefs(DEFAULT_PREFERENCES);
        try {
            localStorage.removeItem(`table_prefs_${tableId}`);
        } catch (e) {
            console.error('Failed to reset table preferences:', e);
        }
    }, [tableId]);

    const setColumnWidth = useCallback((columnId: string, width: number) => {
        savePreferences({
            columnWidths: { ...prefs.columnWidths, [columnId]: width }
        });
    }, [prefs.columnWidths, savePreferences]);

    const toggleColumnVisibility = useCallback((columnId: string) => {
        const isHidden = prefs.hiddenColumns.includes(columnId);
        savePreferences({
            hiddenColumns: isHidden
                ? prefs.hiddenColumns.filter(id => id !== columnId)
                : [...prefs.hiddenColumns, columnId]
        });
    }, [prefs.hiddenColumns, savePreferences]);

    const setSorting = useCallback((columnId: string, desc: boolean) => {
        savePreferences({
            sortBy: { id: columnId, desc }
        });
    }, [savePreferences]);

    return {
        prefs,
        savePreferences,
        resetPreferences,
        setColumnWidth,
        toggleColumnVisibility,
        setSorting,
    };
}
