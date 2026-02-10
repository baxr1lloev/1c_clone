/**
 * Grouping utilities for data tables
 * Adds subtotal rows and grand totals (1C style)
 */

export interface SubtotalRow {
    isSubtotal: true;
    group: string;
    [key: string]: any;
}

export interface GrandTotalRow {
    isGrandTotal: true;
    [key: string]: any;
}

/**
 * Group data by a field and add subtotal rows
 */
export function groupDataWithSubtotals<T extends Record<string, any>>(
    data: T[],
    groupByField: keyof T,
    sumFields: (keyof T)[]
): (T | SubtotalRow | GrandTotalRow)[] {
    const result: (T | SubtotalRow | GrandTotalRow)[] = [];
    const groups = new Map<string, T[]>();

    // Group data
    data.forEach((item) => {
        const groupKey = String(item[groupByField]);
        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(item);
    });

    // Add items and subtotals
    const grandTotals: Record<string, number> = {};
    sumFields.forEach((field) => {
        grandTotals[String(field)] = 0;
    });

    groups.forEach((items, groupKey) => {
        // Add all items in group
        result.push(...items);

        // Calculate subtotals
        const subtotals: Record<string, any> = {
            isSubtotal: true,
            group: groupKey,
        };

        sumFields.forEach((field) => {
            const sum = items.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
            subtotals[String(field)] = sum;
            grandTotals[String(field)] += sum;
        });

        result.push(subtotals as SubtotalRow);
    });

    // Add grand total row
    const grandTotalRow: GrandTotalRow = {
        isGrandTotal: true,
        ...grandTotals,
    };
    result.push(grandTotalRow);

    return result;
}

/**
 * Calculate totals for multiple fields
 */
export function calculateTotals<T extends Record<string, any>>(data: T[], fields: (keyof T)[]): Record<string, number> {
    const totals: Record<string, number> = {};

    fields.forEach((field) => {
        totals[String(field)] = data.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
    });

    return totals;
}

/**
 * Check if row is a subtotal row
 */
export function isSubtotalRow(row: any): row is SubtotalRow {
    return row && row.isSubtotal === true;
}

/**
 * Check if row is a grand total row
 */
export function isGrandTotalRow(row: any): row is GrandTotalRow {
    return row && row.isGrandTotal === true;
}

/**
 * Example usage:
 * 
 * const salesData = [
 *   { item: 'Apples', category: 'Fruits', quantity: 100, amount: 500000 },
 *   { item: 'Oranges', category: 'Fruits', quantity: 150, amount: 750000 },
 *   { item: 'Tomatoes', category: 'Vegetables', quantity: 200, amount: 400000 },
 * ];
 * 
 * const grouped = groupDataWithSubtotals(
 *   salesData,
 *   'category',
 *   ['quantity', 'amount']
 * );
 * 
 * // Result will include:
 * // - Original items
 * // - Subtotal row for 'Fruits' category
 * // - Subtotal row for 'Vegetables' category
 * // - Grand total row
 */
