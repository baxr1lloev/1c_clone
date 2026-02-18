'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef, SortingState } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { Button } from '@/components/ui/button';
import { StatusBar } from '@/components/ui/status-bar';
import { GroupBySelector } from '@/components/data-table/group-by-selector';
import { SavedViews, SavedView } from '@/components/data-table/saved-views';
import { HelpPanel } from '@/components/layout/help-panel';
import { ColumnCustomization } from '@/components/data-table/column-customization';
import { CommandBar, CommandBarAction } from '@/components/ui/command-bar';
import { PiPlusBold, PiPencilBold } from 'react-icons/pi';
import type { Item, PaginatedResponse } from '@/types';

export default function ItemsPage() {
  const tc = useTranslations('common');
  const router = useRouter();
  const [searchValue, setSearchValue] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Item>>('/directories/items/');
      return response.results;
    },
  });

  // Actions
  const handleCreate = () => router.push('/directories/items/new');
  const handleEdit = (item: Item) => router.push(`/directories/items/${item.id}/edit`);
  const handleView = (item: Item) => router.push(`/directories/items/${item.id}`);

  // Load saved view
  const handleLoadView = (view: SavedView) => {
    setActiveFilter(view.filters.active || 'all');
    setSorting(view.sorting);
    setColumnVisibility(view.columnVisibility);
    setGroupBy(view.groupBy);
  };

  // Filtering
  const filteredData = useMemo(() => {
    if (!data) return [];
    let filtered = data;

    if (activeFilter === 'active') {
      filtered = filtered.filter(item => item.is_active);
    } else if (activeFilter === 'inactive') {
      filtered = filtered.filter(item => !item.is_active);
    }

    if (searchValue) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    return filtered;
  }, [data, activeFilter, searchValue]);

  const mainActions: CommandBarAction[] = [
    {
      label: tc('create'),
      icon: <PiPlusBold />,
      onClick: handleCreate,
      variant: 'default',
      shortcut: 'Ctrl+N'
    }
  ];

  const selectionActions: CommandBarAction[] = selectedItem ? [
    {
      label: tc('edit'),
      icon: <PiPencilBold />,
      onClick: () => handleEdit(selectedItem),
      variant: 'ghost',
      shortcut: 'Enter'
    }
  ] : [];

  // Row className for conditional highlighting
  const getItemRowClassName = (item: Item) => {
    if (!item.is_active) return 'bg-gray-50 dark:bg-gray-900/50 text-muted-foreground';
    // Could add low stock highlighting here if needed
    return '';
  };

  const columns: ColumnDef<Item>[] = [
    {
      accessorKey: 'sku',
      header: 'Article',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue('sku')}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <ReferenceLink
          id={row.original.id}
          type="item"
          label={row.getValue('name')}
          showIcon={true}
          className="font-medium"
        />
      ),
    },
    {
      accessorKey: 'sale_price',
      header: 'Price',
      cell: ({ row }) => {
        const rawPrice = row.getValue('sale_price');
        const price = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);
        return Number.isFinite(price) ? `$${price.toFixed(2)}` : '-';
      },
    },
    {
      accessorKey: 'base_unit',
      header: 'Base Unit',
      cell: ({ row }) => row.original.base_unit || row.original.unit || '-',
    },
    {
      id: 'packages',
      header: 'Packaging',
      cell: ({ row }) => {
        const units = row.original.units || row.original.packages || [];
        if (!units.length) return '-';
        const defaultUnit = units.find((u) => u.is_default) || units[0];
        return `${units.length} (${defaultUnit.name})`;
      },
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        onRowClick={setSelectedItem}
        onRowDoubleClick={handleView}
        getRowClassName={getItemRowClassName}
        commandBar={
          <div className="flex items-center justify-between w-full">
            <CommandBar
              mainActions={mainActions}
              selectionActions={selectionActions}
              onRefresh={() => refetch()}
              onSearch={setSearchValue}
              searchValue={searchValue}
              searchPlaceholder="Search items..."
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant={activeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setActiveFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={activeFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setActiveFilter('active')}
                >
                  Active
                </Button>
                <Button
                  variant={activeFilter === 'inactive' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setActiveFilter('inactive')}
                >
                  Inactive
                </Button>
                {activeFilter !== 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setActiveFilter('all')}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <GroupBySelector
                columns={columns}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
                tableName="items"
              />
              <SavedViews
                tableName="items"
                currentState={{
                  filters: { active: activeFilter },
                  sorting,
                  columnVisibility,
                  groupBy
                }}
                onLoadView={handleLoadView}
              />
              <ColumnCustomization
                columns={columns}
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
                tableName="items"
              />
              <HelpPanel context="item-list" />
            </div>
          </div>
        }
      />

      {/* Status Bar */}
      <StatusBar
        totalRecords={data?.length || 0}
        filteredCount={activeFilter !== 'all' || searchValue ? filteredData.length : undefined}
        selectedCount={selectedItem ? 1 : 0}
        isLoading={isLoading}
      />
    </div>
  );
}

