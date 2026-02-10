/**
 * Grouping utilities for DataTable
 * Provides functions to group data by fields and manage group state
 */

export interface GroupedData<T> {
    key: string;
    label: string;
    items: T[];
    count: number;
    isExpanded: boolean;
}

/**
 * Group data by a specific field
 */
export function groupData<T>(
    data: T[],
    groupByField: keyof T,
    getLabel?: (key: any) => string
): GroupedData<T>[] {
    const groups = new Map<string, T[]>();

    // Group items by field value
    data.forEach(item => {
        const key = String(item[groupByField] ?? 'Unknown');
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(item);
    });

    // Convert to array and sort
    const groupedArray: GroupedData<T>[] = Array.from(groups.entries())
        .map(([key, items]) => ({
            key,
            label: getLabel ? getLabel(key) : key,
            items,
            count: items.length,
            isExpanded: true // Default to expanded
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    return groupedArray;
}

/**
 * Get label for common grouping fields
 */
export function getGroupLabel(field: string, value: any): string {
    // Status labels
    if (field === 'status') {
        const statusLabels: Record<string, string> = {
            draft: 'Draft',
            posted: 'Posted',
            cancelled: 'Cancelled'
        };
        return statusLabels[value] || value;
    }

    // Date labels (group by month)
    if (field === 'date' && value) {
        try {
            const date = new Date(value);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        } catch {
            return value;
        }
    }

    return String(value);
}

/**
 * Toggle group expansion state
 */
export function toggleGroupExpansion<T>(
    groups: GroupedData<T>[],
    groupKey: string
): GroupedData<T>[] {
    return groups.map(group =>
        group.key === groupKey
            ? { ...group, isExpanded: !group.isExpanded }
            : group
    );
}

/**
 * Expand all groups
 */
export function expandAllGroups<T>(groups: GroupedData<T>[]): GroupedData<T>[] {
    return groups.map(group => ({ ...group, isExpanded: true }));
}

/**
 * Collapse all groups
 */
export function collapseAllGroups<T>(groups: GroupedData<T>[]): GroupedData<T>[] {
    return groups.map(group => ({ ...group, isExpanded: false }));
}

/**
 * Get total count across all groups
 */
export function getTotalCount<T>(groups: GroupedData<T>[]): number {
    return groups.reduce((sum, group) => sum + group.count, 0);
}
