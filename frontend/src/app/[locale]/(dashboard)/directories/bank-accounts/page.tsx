'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PiArrowsDownUpBold, PiDotsThreeOutlineBold, PiPencilBold, PiTrashBold } from 'react-icons/pi';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { BankAccount, Currency, PaginatedResponse } from '@/types';
type ChartOfAccountOption = { id: number; code: string; name: string };

type AccountForm = {
  name: string;
  bank_name: string;
  account_number: string;
  account_type: 'settlement' | 'foreign' | 'deposit';
  currency: number;
  accounting_account: number | null;
  bik: string;
  correspondent_account: string;
  swift_code: string;
  is_active: boolean;
  is_default: boolean;
  opening_date: string;
  overdraft_allowed: boolean;
  overdraft_limit: number;
  minimum_balance: number;
  comment: string;
};

const defaultForm: AccountForm = {
  name: '',
  bank_name: '',
  account_number: '',
  account_type: 'settlement',
  currency: 1,
  accounting_account: null,
  bik: '',
  correspondent_account: '',
  swift_code: '',
  is_active: true,
  is_default: false,
  opening_date: '',
  overdraft_allowed: false,
  overdraft_limit: 0,
  minimum_balance: 0,
  comment: '',
};

function extractResults<T>(payload: PaginatedResponse<T> | T[]): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.results || [];
}

export default function BankAccountsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState<AccountForm>(defaultForm);

  const { data: bankAccounts = [], isLoading, refetch } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts'],
    queryFn: async () => extractResults(await api.get('/directories/bank-accounts/')),
  });

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['bank-accounts-currencies'],
    queryFn: async () => extractResults(await api.get('/directories/currencies/')),
    initialData: [],
  });

  const { data: accounts = [] } = useQuery<ChartOfAccountOption[]>({
    queryKey: ['bank-accounts-coa'],
    queryFn: async () => extractResults(await api.get('/accounting/chart-of-accounts/')),
    initialData: [],
  });

  const currencyById = useMemo(() => new Map(currencies.map((c) => [c.id, c.code])), [currencies]);

  const saveMutation = useMutation({
    mutationFn: async (data: AccountForm) => {
      const payload = {
        ...data,
        accounting_account: data.accounting_account || null,
        opening_date: data.opening_date || null,
        overdraft_limit: data.overdraft_allowed ? data.overdraft_limit : 0,
      };
      if (selected?.id) return api.put(`/directories/bank-accounts/${selected.id}/`, payload);
      return api.post('/directories/bank-accounts/', payload);
    },
    onSuccess: () => {
      toast.success(selected ? 'Bank account updated' : 'Bank account created');
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      setIsFormOpen(false);
      setSelected(null);
      setFormData(defaultForm);
    },
    onError: () => toast.error('Failed to save bank account'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/directories/bank-accounts/${id}/`),
    onSuccess: () => {
      toast.success('Bank account deleted');
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      setIsDeleteOpen(false);
      setSelected(null);
    },
    onError: () => toast.error('Failed to delete bank account'),
  });

  const openCreate = () => {
    setSelected(null);
    setFormData(defaultForm);
    setIsFormOpen(true);
  };

  const openEdit = (item: BankAccount) => {
    setSelected(item);
    setFormData({
      name: item.name || '',
      bank_name: item.bank_name || '',
      account_number: item.account_number || '',
      account_type: item.account_type || 'settlement',
      currency: item.currency,
      accounting_account: item.accounting_account || null,
      bik: item.bik || '',
      correspondent_account: item.correspondent_account || '',
      swift_code: item.swift_code || '',
      is_active: Boolean(item.is_active),
      is_default: Boolean(item.is_default),
      opening_date: item.opening_date || '',
      overdraft_allowed: Boolean(item.overdraft_allowed),
      overdraft_limit: Number(item.overdraft_limit || 0),
      minimum_balance: Number(item.minimum_balance || 0),
      comment: item.comment || '',
    });
    setIsFormOpen(true);
  };

  const columns: ColumnDef<BankAccount>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" className="-ml-4" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name <PiArrowsDownUpBold className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    { accessorKey: 'bank_name', header: 'Bank' },
    { accessorKey: 'account_number', header: 'Account Number' },
    {
      accessorKey: 'currency',
      header: 'Currency',
      cell: ({ row }) => row.original.currency_code || currencyById.get(row.original.currency) || row.original.currency,
    },
    {
      accessorKey: 'account_type',
      header: 'Type',
      cell: ({ row }) => row.original.account_type_display || row.original.account_type || '-',
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex gap-2 items-center">
          <Badge variant={row.original.is_active ? 'default' : 'outline'}>
            {row.original.is_active ? 'Active' : 'Inactive'}
          </Badge>
          {row.original.is_default ? <Badge variant="secondary">Default</Badge> : null}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><PiDotsThreeOutlineBold className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.original)}><PiPencilBold className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => { setSelected(row.original); setIsDeleteOpen(true); }}>
              <PiTrashBold className="mr-2 h-4 w-4" />Delete
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
          <h1 className="text-3xl font-bold tracking-tight">Bank Accounts</h1>
          <p className="text-muted-foreground">Manage bank account master data and compliance fields.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/directories/bank-exchange-settings')}>
            Exchange Settings
          </Button>
          <Button onClick={openCreate}>+ Add Bank Account</Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={bankAccounts}
        isLoading={isLoading}
        searchColumn="name"
        searchPlaceholder="Search bank accounts..."
        onRefresh={() => refetch()}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>{selected ? 'Edit Bank Account' : 'New Bank Account'}</DialogTitle>
            <DialogDescription>Required fields and bank exchange compliance metadata.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input value={formData.account_number} onChange={(e) => setFormData({ ...formData, account_number: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value as AccountForm['account_type'] })}
                >
                  <option value="settlement">Settlement</option>
                  <option value="foreign">Foreign Currency</option>
                  <option value="deposit">Deposit</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: Number(e.target.value) })}
                >
                  {currencies.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Accounting Account</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formData.accounting_account || ''}
                  onChange={(e) => setFormData({ ...formData, accounting_account: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Not set</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>BIK</Label>
                <Input value={formData.bik} onChange={(e) => setFormData({ ...formData, bik: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Correspondent Account</Label>
                <Input value={formData.correspondent_account} onChange={(e) => setFormData({ ...formData, correspondent_account: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>SWIFT</Label>
                <Input value={formData.swift_code} onChange={(e) => setFormData({ ...formData, swift_code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Opening Date</Label>
                <Input type="date" value={formData.opening_date} onChange={(e) => setFormData({ ...formData, opening_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Overdraft Limit</Label>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!formData.overdraft_allowed}
                  value={formData.overdraft_limit}
                  onChange={(e) => setFormData({ ...formData, overdraft_limit: Number(e.target.value || 0) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.minimum_balance}
                  onChange={(e) => setFormData({ ...formData, minimum_balance: Number(e.target.value || 0) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Comment</Label>
              <Textarea rows={2} value={formData.comment} onChange={(e) => setFormData({ ...formData, comment: e.target.value })} />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.is_default} onCheckedChange={(v) => setFormData({ ...formData, is_default: v })} />
                <Label>Default</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.overdraft_allowed} onCheckedChange={(v) => setFormData({ ...formData, overdraft_allowed: v })} />
                <Label>Overdraft Allowed</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bank account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove account {selected?.name || ''}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selected?.id && deleteMutation.mutate(selected.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
