'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PiCaretLeftBold,
  PiCaretRightBold,
  PiCaretDoubleLeftBold,
  PiCaretDoubleRightBold,
  PiArrowsClockwiseBold,
  PiPlusBold,
} from 'react-icons/pi';
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchColumn?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  getRowClassName?: (row: TData) => string; // For conditional row highlighting
}

// 1C-Style Data Table with Keyboard Navigation
export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  searchPlaceholder,
  searchColumn,
  onRefresh,
  onExport,
  onAdd, // Deprecated in favor of commandBarActions
  addLabel,

  // New props
  onRowClick,
  onRowDoubleClick,
  commandBar,
  getRowClassName, // For conditional highlighting
}: DataTableProps<TData, TValue> & {
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  commandBar?: React.ReactNode;
  getRowClassName?: (row: TData) => string;
}) {
  const t = useTranslations('common');
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  // Keyboard Navigation State
  const [focusedRowIndex, setFocusedRowIndex] = React.useState<number>(-1);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const rows = table.getRowModel().rows;

  // Handle Keyboard Navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if we are inside an input/textarea
      const target = e.target as HTMLElement;
      const isInputField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      // F5 - Refresh (prevent browser default)
      if (e.key === 'F5' && !e.ctrlKey && onRefresh) {
        e.preventDefault();
        onRefresh();
        return;
      }

      // Ctrl+F - Focus search (if commandBar has search)
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        searchInput?.focus();
        return;
      }

      // Escape - Clear selection
      if (e.key === 'Escape') {
        setFocusedRowIndex(-1);
        onRowClick?.(null as any);
        return;
      }

      // Don't handle other keys if in input field
      if (!rows.length || isInputField) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedRowIndex(prev => Math.min(prev + 1, rows.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedRowIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        setFocusedRowIndex(prev => Math.min(prev + 10, rows.length - 1));
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        setFocusedRowIndex(prev => Math.max(prev - 10, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setFocusedRowIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setFocusedRowIndex(rows.length - 1);
      } else if (e.key === 'Enter') {
        // Edit/View Action
        if (focusedRowIndex >= 0 && focusedRowIndex < rows.length) {
          e.preventDefault();
          onRowDoubleClick?.(rows[focusedRowIndex].original);
        }
      } else if (e.key === ' ') {
        // Space to select (Checkbox)
        if (focusedRowIndex >= 0 && focusedRowIndex < rows.length) {
          e.preventDefault();
          rows[focusedRowIndex].toggleSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rows, focusedRowIndex, onRowDoubleClick, onRefresh, onRowClick]);

  // Sync focus with selection (optional, but 1C usually selects the focused row)
  React.useEffect(() => {
    if (focusedRowIndex >= 0 && focusedRowIndex < rows.length) {
      onRowClick?.(rows[focusedRowIndex].original);

      // Try to scroll into view
      const rowElement = tableContainerRef.current?.querySelector(`[data-row-index="${focusedRowIndex}"]`);
      rowElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedRowIndex, rows, onRowClick]);


  return (
    <div className="space-y-0 border rounded-md overflow-hidden bg-background">
      {/* 1C Style: Toolbar is strictly attached to the table */}
      {commandBar && (
        <div className="border-b">
          {commandBar}
        </div>
      )}

      {/* Toolbar integrated via commandBar prop */}

      {/* Table Area */}
      <div
        ref={tableContainerRef}
        className="relative min-h-[400px] h-[calc(100vh-140px)] overflow-auto bg-white dark:bg-zinc-950 border-b"
        tabIndex={0} // Make container focusable
      >
        <Table>
          <TableHeader className="sticky top-0 z-20 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-border/60">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 15 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row, index) => {
                const isFocused = index === focusedRowIndex;
                const isSelected = row.getIsSelected(); // Or custom selection logic
                const conditionalClassName = getRowClassName?.(row.original) || '';

                return (
                  <TableRow
                    key={row.id}
                    data-row-index={index}
                    data-state={isSelected && 'selected'}
                    data-focused={isFocused}
                    className={cn(
                      "cursor-pointer even:bg-muted/10 border-b border-transparent", // Base styles
                      conditionalClassName, // Conditional highlighting
                      isSelected && "bg-primary/10", // Selection style
                      isFocused && "outline outline-2 outline-primary -outline-offset-2 z-10 bg-accent/50" // High contrast focus ring
                    )}
                    onClick={() => {
                      setFocusedRowIndex(index);
                      onRowClick?.(row.original);
                    }}
                    onDoubleClick={() => onRowDoubleClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {t('noData')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter className="sticky bottom-0 z-20 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]">
            {table.getFooterGroups().map((footerGroup) => (
              <TableRow key={footerGroup.id} className="hover:bg-transparent border-t-2 border-border">
                {footerGroup.headers.map((header) => (
                  <TableCell key={header.id} className="font-bold bg-muted/95 text-foreground h-8 border-r last:border-r-0 border-border/50">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.footer, header.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableFooter>
        </Table>
      </div>

      {/* Compact Footer / Pagination */}
      <div className="flex items-center justify-between px-2 py-1 bg-muted/20 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{rows.length} {t('entries')}</span>
          {/* Pagination Controls optional for infinity scroll, usually 1C uses huge pages or infinity */}
        </div>
      </div>
    </div>
  );
}
