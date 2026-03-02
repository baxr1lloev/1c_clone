'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import api from '@/lib/api';
import type { PaginatedResponse, Warehouse } from '@/types';

type WarehouseUiMeta = {
  department: string;
  counterpartyId: number | null;
  counterpartyName: string;
};

type WarehouseUiMetaRecord = Record<string, WarehouseUiMeta>;

const STORAGE_KEY = 'warehouse_directory_meta_v1';
const EMPTY_WAREHOUSE_META: WarehouseUiMetaRecord = {};
const EMPTY_WAREHOUSE_META_SNAPSHOT = '{}';
const DEFAULT_DEPARTMENT = 'Оптовая торговля (общая)';

const demoWarehouses: Warehouse[] = [
  { id: 4, name: 'BOZOR 4 QATOR', warehouse_type: 'PHYSICAL', address: '', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 5, name: 'TAMOJNI SKLAD', warehouse_type: 'PHYSICAL', address: '', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 6, name: 'BOZOR 6 QATOR', warehouse_type: 'PHYSICAL', address: '', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 7, name: 'BOZOR 7 QATOR', warehouse_type: 'PHYSICAL', address: '', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 17, name: 'Prochi Sklad', warehouse_type: 'PHYSICAL', address: '', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
];

function parseWarehouseMeta(rawValue: string | null): WarehouseUiMetaRecord {
  if (!rawValue) return EMPTY_WAREHOUSE_META;

  try {
    const parsed = JSON.parse(rawValue) as WarehouseUiMetaRecord;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : EMPTY_WAREHOUSE_META;
  } catch {
    return EMPTY_WAREHOUSE_META;
  }
}

function readWarehouseMetaSnapshot(): string {
  if (typeof window === 'undefined') return EMPTY_WAREHOUSE_META_SNAPSHOT;
  return window.localStorage.getItem(STORAGE_KEY) || EMPTY_WAREHOUSE_META_SNAPSHOT;
}

function saveWarehouseMeta(meta: WarehouseUiMetaRecord) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  window.dispatchEvent(new Event('warehouse-meta-change'));
}

function subscribeWarehouseMeta(onChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = () => onChange();
  window.addEventListener('storage', handler);
  window.addEventListener('warehouse-meta-change', handler);

  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('warehouse-meta-change', handler);
  };
}

export default function WarehousesPage() {
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const localePath = (path: string) => `/${locale}${path.startsWith('/') ? path : `/${path}`}`;

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const metaSnapshot = useSyncExternalStore(
    subscribeWarehouseMeta,
    readWarehouseMetaSnapshot,
    () => EMPTY_WAREHOUSE_META_SNAPSHOT,
  );
  const metaByWarehouse = useMemo(
    () => parseWarehouseMeta(metaSnapshot),
    [metaSnapshot],
  );

  const { data: warehouses = [], isLoading, refetch } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<Warehouse>>('/directories/warehouses/');
        return response.results || [];
      } catch {
        return demoWarehouses;
      }
    },
  });

  const filteredWarehouses = useMemo(() => {
    if (!searchValue.trim()) return warehouses;
    const term = searchValue.toLowerCase();
    return warehouses.filter((warehouse) =>
      warehouse.name.toLowerCase().includes(term) ||
      String(warehouse.id || '').toLowerCase().includes(term) ||
      (metaByWarehouse[String(warehouse.id)]?.counterpartyName || '').toLowerCase().includes(term),
    );
  }, [metaByWarehouse, searchValue, warehouses]);

  const effectiveSelectedWarehouseId = selectedWarehouseId ?? filteredWarehouses[0]?.id ?? null;

  const selectedWarehouse = useMemo(
    () => filteredWarehouses.find((warehouse) => warehouse.id === effectiveSelectedWarehouseId) || null,
    [effectiveSelectedWarehouseId, filteredWarehouses],
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/directories/warehouses/${id}/`),
    onSuccess: (_, deletedId) => {
      const nextMeta = { ...metaByWarehouse };
      delete nextMeta[String(deletedId)];
      saveWarehouseMeta(nextMeta);
      toast.success('Склад удален');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setSelectedWarehouseId(null);
    },
    onError: () => {
      toast.error('Не удалось удалить склад');
    },
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#e9e9e9] px-1 py-1 text-[#3e3e3e]">
      <div className="mx-auto h-[calc(100vh-4.6rem)] w-full overflow-hidden border border-[#c9c9c9] bg-[#efefef] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between border-b border-[#d2d2d2] px-2 py-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none text-[#c3c3c3]">☆</span>
            <h1 className="text-[18px] font-medium text-black">Склады</h1>
          </div>
          <div className="flex items-center gap-3 text-lg text-[#777]">
            <span>🔗</span>
            <span>⋮</span>
            <span>▢</span>
            <span>×</span>
          </div>
        </div>

        <div className="border-b border-[#d4d4d4] px-2 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-10 rounded-sm border border-[#b99800] bg-[#f5d90a] px-5 text-sm font-medium text-black hover:bg-[#f0d000]"
              onClick={() => router.push(localePath('/directories/warehouses/new'))}
            >
              Создать
            </button>
            <button
              type="button"
              className="h-10 rounded-sm border border-[#bcbcbc] bg-background px-4 text-sm text-black hover:bg-[#f3f3f3]"
              onClick={() => selectedWarehouse && router.push(localePath(`/directories/warehouses/${selectedWarehouse.id}`))}
              disabled={!selectedWarehouse}
            >
              Изменить
            </button>
            <button
              type="button"
              className="h-10 rounded-sm border border-[#bcbcbc] bg-background px-4 text-sm text-black hover:bg-[#f3f3f3] disabled:opacity-50"
              onClick={() => refetch()}
            >
              Обновить
            </button>
            <button
              type="button"
              className="h-10 rounded-sm border border-[#bcbcbc] bg-background px-4 text-sm text-black hover:bg-[#f3f3f3] disabled:opacity-50"
              onClick={() => selectedWarehouse && deleteMutation.mutate(selectedWarehouse.id)}
              disabled={!selectedWarehouse || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </button>

            <div className="ml-auto flex items-center gap-2">
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Поиск (Ctrl+F)"
                className="h-10 w-[300px] rounded-none border border-[#bcbcbc] bg-background px-3 text-sm"
              />
              <button
                type="button"
                className="h-10 rounded-sm border border-[#bcbcbc] bg-background px-4 text-sm text-black hover:bg-[#f3f3f3]"
              >
                Еще ▾
              </button>
            </div>
          </div>
        </div>

        <div className="h-[calc(100%-108px)] overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#f3f3f3]">
                <th className="w-10 border border-[#bdbdbd] px-2 py-2 text-left font-normal" />
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Наименование</th>
                <th className="w-[140px] border border-[#bdbdbd] px-3 py-2 text-left font-normal">Код</th>
                <th className="w-[300px] border border-[#bdbdbd] px-3 py-2 text-left font-normal">Подразделение</th>
                <th className="w-[260px] border border-[#bdbdbd] px-3 py-2 text-left font-normal">Контрагент</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="border border-[#bdbdbd] px-3 py-10 text-center text-[#666]">
                    Загрузка...
                  </td>
                </tr>
              ) : filteredWarehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-[#bdbdbd] px-3 py-10 text-center text-[#666]">
                    Склады не найдены.
                  </td>
                </tr>
              ) : (
                filteredWarehouses.map((warehouse) => {
                  const isSelected = effectiveSelectedWarehouseId === warehouse.id;
                  const meta = metaByWarehouse[String(warehouse.id)];

                  return (
                    <tr
                      key={warehouse.id}
                      className={isSelected ? 'bg-[#f8efba]' : 'bg-background hover:bg-[#fbf7da]'}
                      onClick={() => setSelectedWarehouseId(warehouse.id)}
                      onDoubleClick={() => router.push(localePath(`/directories/warehouses/${warehouse.id}`))}
                    >
                      <td className="border border-[#bdbdbd] px-2 py-2 text-center text-[#4a89b3]">▬</td>
                      <td className="border border-[#bdbdbd] px-3 py-2">{warehouse.name}</td>
                      <td className="border border-[#bdbdbd] px-3 py-2 font-mono">{warehouse.id || '0'}</td>
                      <td className="border border-[#bdbdbd] px-3 py-2">{meta?.department || DEFAULT_DEPARTMENT}</td>
                      <td className="border border-[#bdbdbd] px-3 py-2">{meta?.counterpartyName || ''}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
