import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

export interface BreadcrumbSegment {
    label: string;
    href?: string;
}

interface BreadcrumbsProps {
    segments: BreadcrumbSegment[];
    className?: string;
}

export function Breadcrumbs({ segments, className = '' }: BreadcrumbsProps) {
    return (
        <nav
            className={`flex items-center space-x-1 text-sm text-muted-foreground ${className}`}
            aria-label="Breadcrumb"
        >
            {segments.map((segment, index) => (
                <Fragment key={index}>
                    {index > 0 && (
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                    )}

                    {segment.href ? (
                        <Link
                            href={segment.href}
                            className="hover:text-foreground transition-colors truncate max-w-[200px]"
                        >
                            {segment.label}
                        </Link>
                    ) : (
                        <span className="text-foreground font-medium truncate max-w-[200px]">
                            {segment.label}
                        </span>
                    )}
                </Fragment>
            ))}
        </nav>
    );
}

// Helper function to build breadcrumbs from route
export function buildBreadcrumbs(pathname: string, params?: Record<string, string>): BreadcrumbSegment[] {
    const segments: BreadcrumbSegment[] = [
        { label: 'Home', href: '/' }
    ];

    // Remove locale prefix if present
    const cleanPath = pathname.replace(/^\/[a-z]{2}\//, '/');
    const parts = cleanPath.split('/').filter(Boolean);

    let currentPath = '';

    parts.forEach((part, index) => {
        currentPath += `/${part}`;

        // Check if this is a dynamic segment (ID)
        if (/^\d+$/.test(part) && params) {
            // This is an ID, use a more descriptive label if available
            const label = params[part] || `#${part}`;
            segments.push({ label });
        } else {
            // Regular path segment
            const label = part
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            // Add href only if not the last segment
            const href = index < parts.length - 1 ? currentPath : undefined;
            segments.push({ label, href });
        }
    });

    return segments;
}
