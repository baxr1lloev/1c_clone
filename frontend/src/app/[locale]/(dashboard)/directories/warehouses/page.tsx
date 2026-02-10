'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { PiDotsThreeOutlineBold, PiPencilBold, PiTrashBold, PiArrowsDownUpBold, PiBuildingsBold } from 'react-icons/pi';
import type { Warehouse, PaginatedResponse, WarehouseType } from '@/types';

const demoWarehouses: Warehouse[] = [
  { id: 1, tenant: 1, name: 'Main Warehouse', code: 'WH-001', type: 'physical', address: '100 Industrial Blvd', is_active: true, created_at: '2024-01-15', updated_at: '2024-01-15' },
  { id: 2, tenant: 1, name: 'Downtown Store', code: 'WH-002', type: 'physical', address: '50 Main Street', is_active: true, created_at: '2024-01-16', updated_at: '2024-01-16' },
  { id: 3, tenant: 1, name: 'Virtual Storage', code: 'VW-001', type: 'virtual', address: '', is_active: true, created_at: '2024-01-17', updated_at: '2024-01-17' },
  { id: 4, tenant: 1, name: 'Transit Zone', code: 'TZ-001', type: 'transit', address: '', is_active: true, created_at: '2024-01-18', updated_at: '2024-01-18' },
];

type WarehouseFormData = Omit<Warehouse, 'id' | 'tenant' | 'created_at' | 'updated_at'>;

const defaultFormData: WarehouseFormData = {
  name: '',
  code: '',
  type: 'physical',
  address: '',
  is_active: true,
};

const typeColors: Record<WarehouseType, string> = {
  physical: 'bg-emerald-100 text-emerald-800',
  virtual: 'bg-blue-100 text-blue-800',
  transit: 'bg-amber-100 text-amber-800',
};

export default function WarehousesPage() {
  const t = useTranslations('directories');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState<WarehouseFormData>(defaultFormData);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<Warehouse>>('/directories/warehouses/');
        return response.results;
      } catch {
        return demoWarehouses;
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: WarehouseFormData) => {
      if (selectedItem) return api.put(`/directories/warehouses/${selectedItem.id}/`, data);
      return api.post('/directories/warehouses/', data);
    },
    onSuccess: () => {
      toast.success(selectedItem ? 'Warehouse updated' : 'Warehouse created');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      handleCloseForm();
    },
    onError: () => toast.error('Failed to save warehouse'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/directories/warehouses/${id}/`),
    onSuccess: () => {
      toast.success('Warehouse deleted');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setIsDeleteOpen(false);
    },
    onError: () => toast.error('Failed to delete warehouse'),
  });

  const handleOpenCreate = () => { setSelectedItem(null); setFormData(defaultFormData); setIsFormOpen(true); };
  const handleOpenEdit = (item: Warehouse) => {
    setSelectedItem(item);
    setFormData({ name: item.name, code: item.code, type: item.type, address: item.address, is_active: item.is_active });
    setIsFormOpen(true);
  };
  const handleCloseForm = () => { setIsFormOpen(false); setSelectedItem(null); setFormData(defaultFormData); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); saveMutation.mutate(formData); };

  const columns: ColumnDef<Warehouse>[] = [
    {
      accessorKey: 'code',
      header: tc('code'),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue('code')}</span>,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4">
          {tf('name')} <PiArrowsDownUpBold className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PiBuildingsBold className="h-4 w-4 text-muted-foreground" />
          <ReferenceLink
            id={row.original.id}
            type="warehouse"
            label={row.getValue('name')}
            showIcon={false}
            className="font-medium"
          />
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: tf('type'),
      cell: ({ row }) => {
        const type = row.getValue('type') as WarehouseType | undefined;
        if (!type) return <Badge variant="outline">Unknown</Badge>;
        return <Badge className={typeColors[type] || 'bg-gray-100 text-gray-800'}>{type.charAt(0).toUpperCase() + type.slice(1)}</Badge>;
      },
    },
    {
      accessorKey: 'address',
      header: tf('address'),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.getValue('address') || '-'}</span>,
    },
    {
      accessorKey: 'is_active',
      header: tf('isActive'),
      cell: ({ row }) => {
        const isActive = row.getValue('is_active') as boolean;
        return <Badge variant={isActive ? 'default' : 'outline'}>{isActive ? 'Active' : 'Inactive'}</Badge>;
      },
    },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">{tc('actions')}</span>
              <PiDotsThreeOutlineBold className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleOpenEdit(row.original)}>
              <PiPencilBold className="mr-2 h-4 w-4" />
              {tc('edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedItem(row.original); setIsDeleteOpen(true); }} className="text-destructive">
              <PiTrashBold className="mr-2 h-4 w-4" />
              {tc('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('warehouses')}</h1>
          <p className="text-muted-foreground">Manage your storage locations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Import
          </Button>
          <Button variant="outline" size="sm">
            Export
          </Button>
          <Button onClick={handleOpenCreate}>
            + New Warehouse
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={data || []} isLoading={isLoading} searchColumn="name" searchPlaceholder="Search warehouses..." onRefresh={() => refetch()} />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedItem ? t('editWarehouse') : t('addWarehouse')}</DialogTitle>
            <DialogDescription>{selectedItem ? 'Update warehouse details' : 'Add a new warehouse'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">{tc('code')}</Label>
                  <Input id="code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="WH-001" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{tf('type')}</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as WarehouseType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="virtual">Virtual</SelectItem>
                      <SelectItem value="transit">Transit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{tc('name')}</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Main Warehouse" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{tf('address')}</Label>
                <Textarea id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Full address" rows={2} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                <Label htmlFor="is_active">{tf('isActive')}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseForm}>{tc('cancel')}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : tc('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Warehouse</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedItem?.name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? 'Deleting...' : tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

