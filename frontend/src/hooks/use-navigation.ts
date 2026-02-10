import { useEffect } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';

/**
 * Hook to persist and restore active tab state across navigation
 * Stores tab state in URL query parameters
 */
export function useTabPersistence(defaultTab: string = 'details') {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const currentTab = searchParams.get('tab') || defaultTab;

    const setTab = (tab: string) => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.pushState({}, '', url.toString());
    };

    return { currentTab, setTab };
}

/**
 * Hook to handle browser back/forward navigation
 * Ensures proper state restoration when using browser navigation
 */
export function useBrowserNavigation() {
    useEffect(() => {
        const handlePopState = () => {
            // Force re-render on browser back/forward
            window.location.reload();
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);
}
