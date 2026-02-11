import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number with specified decimal places
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 */
export function formatNumber(value: number | string | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return '0';
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format a currency value
 * @param value - Amount to format
 * @param currency - Currency code (default: 'USD')
 */
export function formatCurrency(value: number | string | null | undefined, currency: string = 'USD'): string {
  if (value === null || value === undefined || value === '') {
    return '0.00';
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return '0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
