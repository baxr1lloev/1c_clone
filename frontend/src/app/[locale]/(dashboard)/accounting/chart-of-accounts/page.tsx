'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { PiDotsThreeOutlineBold, PiPencilBold, PiArrowsDownUpBold, PiCalculatorBold } from 'react-icons/pi';
import type { Account, PaginatedResponse, AccountType } from '@/types';

const demoAccounts: Account[] = [
  { id: 1, tenant: 1, code: '1000', name: 'Cash', description: 'Cash on hand and in bank', type: 'asset', parent: null, is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 2, tenant: 1, code: '1100', name: 'Accounts Receivable', description: 'Trade receivables', type: 'asset', parent: null, is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 3, tenant: 1, code: '1200', name: 'Inventory', description: 'Stock on hand', type: 'asset', parent: null, is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 4, tenant: 1, code: '2000', name: 'Accounts Payable', description: 'Trade payables', type: 'liability', parent: null, is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 5, tenant: 1, code: '3000', name: 'Share Capital', description: 'Issued capital', type: 'equity', parent: null, is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 6, tenant: 1, code: '4000', name: 'Sales Revenue', description: 'Revenue from sales', type: 'revenue', parent: null, is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 7, tenant: 1, code: '5000', name: 'Cost of Goods Sold', description: 'COGS', type: 'expense', parent: null, is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 8, tenant: 1, code: '5100', name: 'Operating Expenses', description: 'General expenses', type: 'expense', parent: null, is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
];

const typeColors: Record<AccountType, string> = {
  asset: 'bg-blue-100 text-blue-800',
  liability: 'bg-rose-100 text-rose-800',
  equity: 'bg-violet-100 text-violet-800',
  revenue: 'bg-emerald-100 text-emerald-800',
  expense: 'bg-amber-100 text-amber-800',
};

type AccountFormData = Omit<Account, 'id' | 'tenant' | 'created_at' | 'updated_at'>;
const defaultFormData: AccountFormData = { code: '', name: '', description: '', type: 'asset', parent: null, is_active: true };

export default function ChartOfAccountsPage() {
  const t = useTranslations('accounting');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');
  const queryClient = useQueryClient();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Account | null>(null);
  const [formData, setFormData] = useState<AccountFormData>(defaultFormData);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<Account>>('/accounting/accounts/');
        return response.results;
      } catch { return demoAccounts; }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      if (selectedItem) return api.put(`/accounting/accounts/${selectedItem.id}/`, data);
      return api.post('/accounting/accounts/', data);
    },
    onSuccess: () => {
      toast.success(selectedItem ? 'Account updated' : 'Account created');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      handleCloseForm();
    },
    onError: () => toast.error('Failed to save account'),
  });

  const handleOpenCreate = () => { setSelectedItem(null); setFormData(defaultFormData); setIsFormOpen(true); };
  const handleOpenEdit = (item: Account) => {
    setSelectedItem(item);
    setFormData({ code: item.code, name: item.name, description: item.description, type: item.type, parent: item.parent, is_active: item.is_active });
    setIsFormOpen(true);
  };
  const handleCloseForm = () => { setIsFormOpen(false); setSelectedItem(null); setFormData(defaultFormData); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); saveMutation.mutate(formData); };

  const columns: ColumnDef<Account>[] = [
    {
      accessorKey: 'code',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4">
          {tc('code')} <PiArrowsDownUpBold className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PiCalculatorBold className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono font-bold">{row.getValue('code')}</span>
        </div>
      ),
    },
    { accessorKey: 'name', header: tc('name'), cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span> },
    { accessorKey: 'description', header: tc('description'), cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.getValue('description')}</span> },
    {
      accessorKey: 'type',
      header: tf('type'),
      cell: ({ row }) => {
        const type = row.getValue('type') as AccountType;
        return <Badge className={typeColors[type]}>{type.charAt(0).toUpperCase() + type.slice(1)}</Badge>;
      },
    },
    { accessorKey: 'is_active', header: tf('isActive'), cell: ({ row }) => <Badge variant={row.getValue('is_active') ? 'default' : 'outline'}>{row.getValue('is_active') ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><PiDotsThreeOutlineBold className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleOpenEdit(row.original)}><PiPencilBold className="mr-2 h-4 w-4" />{tc('edit')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('chartOfAccounts')}</h1>
        <p className="text-muted-foreground">Manage your general ledger accounts</p>
      </div>

      <DataTable columns={columns} data={data || []} isLoading={isLoading} searchColumn="name" searchPlaceholder="Search accounts..." onRefresh={() => refetch()} onAdd={handleOpenCreate} addLabel={t('addAccount')} />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedItem ? t('editAccount') : t('addAccount')}</DialogTitle>
            <DialogDescription>{selectedItem ? 'Update account details' : 'Add a new general ledger account'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">{tc('code')}</Label>
                  <Input id="code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="1000" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{tf('type')}</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as AccountType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{tc('name')}</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Account name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{tc('description')}</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Account description" rows={2} />
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
    </div>
  );
}

