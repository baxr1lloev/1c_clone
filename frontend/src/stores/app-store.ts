import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Tenant } from '@/types';

interface AppState {
    // Sidebar state
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (collapsed: boolean) => void;
    toggleSidebar: () => void;

    // User state
    user: User | null;
    setUser: (user: User | null) => void;

    // Tenant state
    currentTenant: Tenant | null;
    setCurrentTenant: (tenant: Tenant | null) => void;

    // Theme
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;

    // Language
    locale: 'en' | 'ru' | 'uz';
    setLocale: (locale: 'en' | 'ru' | 'uz') => void;

    // Auth state
    isAuthenticated: boolean;
    setIsAuthenticated: (isAuthenticated: boolean) => void;

    // Reset store
    reset: () => void;

    // Tabs
    tabs: Tab[];
    addTab: (tab: Tab) => void;
    removeTab: (path: string) => void;
    closeAllTabs: () => void;
}

export interface Tab {
    id: string;
    label: string;
    path: string;
    icon?: string;
    translationKey?: string;
}


const initialState = {
    sidebarCollapsed: false,
    user: null,
    currentTenant: null,
    theme: 'light' as const,
    locale: 'en' as const,
    isAuthenticated: false,
    tabs: [],
};

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            ...initialState,

            setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
            toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

            setUser: (user) => set({ user }),
            setCurrentTenant: (tenant) => set({ currentTenant: tenant }),

            setTheme: (theme) => set({ theme }),
            setLocale: (locale) => set({ locale }),

            setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

            // Tabs Logic
            tabs: [],
            addTab: (tab) => set((state) => {
                const existingIndex = state.tabs.findIndex(t => t.path === tab.path);
                if (existingIndex !== -1) {
                    const newTabs = [...state.tabs];
                    // Only update if properties changed to avoid unnecessary re-renders if possible, 
                    // but for now simple spread is fine.
                    newTabs[existingIndex] = { ...newTabs[existingIndex], ...tab };
                    return { tabs: newTabs };
                }
                return { tabs: [...state.tabs, tab] };
            }),
            removeTab: (path) => set((state) => ({
                tabs: state.tabs.filter(t => t.path !== path)
            })),
            closeAllTabs: () => set({ tabs: [] }),

            reset: () => set(initialState),
        }),
        {
            name: 'erp-app-storage',
            partialize: (state) => ({
                sidebarCollapsed: state.sidebarCollapsed,
                theme: state.theme,
                locale: state.locale,
                tabs: state.tabs, // Persist tabs
            }),
        }
    )
);
