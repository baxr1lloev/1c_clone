'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import api from '@/lib/api';
import type { Warehouse } from '@/types';
import { WarehouseEditor } from '@/components/directories/warehouse-editor';

export default function WarehouseDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const { data: warehouse, isLoading } = useQuery({
    queryKey: ['warehouse', id],
    queryFn: async () => {
      return api.get(`/directories/warehouses/${id}/`) as Promise<Warehouse>;
    },
    enabled: Number.isFinite(id) && id > 0,
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
        Неверный идентификатор склада.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
        Загрузка склада...
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
        Склад не найден.
      </div>
    );
  }

  return <WarehouseEditor mode="edit" warehouseId={id} initialData={warehouse} />;
}
