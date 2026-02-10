import { usePathname } from 'next/navigation';

interface BreadcrumbSegment {
    label: string;
    href?: string;
}

/**
 * Builds breadcrumb segments from the current pathname
 * Example: /documents/sales/123 => Home > Documents > Sales > #123
 */
export function useBreadcrumbBuilder(): BreadcrumbSegment[] {
    const pathname = usePathname();

    if (!pathname) return [{ label: 'Home', href: '/' }];

    const segments: BreadcrumbSegment[] = [{ label: 'Home', href: '/' }];
    const parts = pathname.split('/').filter(Boolean);

    // Remove locale if present
    const startIndex = parts[0]?.match(/^[a-z]{2}(-[A-Z]{2})?$/) ? 1 : 0;
    const relevantParts = parts.slice(startIndex);

    let currentPath = '';

    for (let i = 0; i < relevantParts.length; i++) {
        const part = relevantParts[i];
        currentPath += `/${part}`;

        // Skip dashboard segment
        if (part === '(dashboard)') continue;

        // Check if this is an ID (numeric or UUID)
        const isId = /^\d+$/.test(part) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part);

        if (isId) {
            // For IDs, show as #ID without link (current page)
            segments.push({ label: `#${part}` });
        } else {
            // Capitalize and format the segment
            const label = part
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            // Add link if not the last segment
            const href = i < relevantParts.length - 1 ? currentPath : undefined;
            segments.push({ label, href });
        }
    }

    return segments;
}

/**
 * Builds custom breadcrumbs for specific entity types
 */
export function buildEntityBreadcrumbs(
    entityType: 'item' | 'counterparty' | 'warehouse' | 'contract' | 'bank-account' | 'document',
    entityName: string,
    entityId: number
): BreadcrumbSegment[] {
    const typeMap: Record<string, { section: string; list: string }> = {
        item: { section: 'Directories', list: 'Items' },
        counterparty: { section: 'Directories', list: 'Counterparties' },
        warehouse: { section: 'Directories', list: 'Warehouses' },
        contract: { section: 'Directories', list: 'Contracts' },
        'bank-account': { section: 'Directories', list: 'Bank Accounts' },
        document: { section: 'Documents', list: 'All Documents' },
    };

    const config = typeMap[entityType];
    if (!config) {
        return [{ label: 'Home', href: '/' }, { label: entityName }];
    }

    return [
        { label: 'Home', href: '/' },
        { label: config.section, href: `/${config.section.toLowerCase()}` },
        { label: config.list, href: `/${config.section.toLowerCase()}/${entityType}s` },
        { label: entityName },
    ];
}
