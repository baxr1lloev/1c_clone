'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PiDotsThreeOutlineBold, PiPencilBold, PiTrashBold } from 'react-icons/pi';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { BankAccount, BankExchangeSettings, PaginatedResponse } from '@/types';

type FormState = Omit<BankExchangeSettings, 'id' | 'created_at' | 'updated_at'>;

const defaultForm: FormState = {
  bank_account: 0,
  exchange_format: 'CSV',
  bank_program_name: '',
  encoding: 'UTF-8',
  auto_create_counterparties: true,
  new_counterparty_group_name: '',
  auto_detect_bank_fees: true,
  auto_post_incoming: false,
  auto_post_outgoing: false,
  show_form_before_import: true,
  export_payment_orders: true,
  export_payment_claims: false,
  validate_document_number: true,
  validate_exchange_security: true,
};

function extractResults<T>(payload: PaginatedResponse<T> | T[]): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.results || [];
}

export default function BankExchangeSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<BankExchangeSettings | null>(null);
  const [formData, setFormData] = useState<FormState>(defaultForm);

  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['exchange-settings-accounts'],
    queryFn: async () => extractResults(await api.get('/directories/bank-accounts/')),
    initialData: [],
  });

  const { data: settings = [], isLoading, refetch } = useQuery<BankExchangeSettings[]>({
    queryKey: ['bank-exchange-settings'],
    queryFn: async () => extractResults(await api.get('/directories/bank-exchange-settings/')),
  });
  const noBankAccounts = bankAccounts.length === 0;

  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      if (selected?.id) return api.put(`/directories/bank-exchange-settings/${selected.id}/`, data);
      return api.post('/directories/bank-exchange-settings/', data);
    },
    onSuccess: () => {
      toast.success(selected ? 'Settings updated' : 'Settings created');
      queryClient.invalidateQueries({ queryKey: ['bank-exchange-settings'] });
      setIsFormOpen(false);
      setSelected(null);
      setFormData(defaultForm);
    },
    onError: () => toast.error('Failed to save exchange settings'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/directories/bank-exchange-settings/${id}/`),
    onSuccess: () => {
      toast.success('Settings deleted');
      queryClient.invalidateQueries({ queryKey: ['bank-exchange-settings'] });
      setIsDeleteOpen(false);
      setSelected(null);
    },
    onError: () => toast.error('Failed to delete settings'),
  });

  const openCreate = () => {
    setSelected(null);
    setFormData({
      ...defaultForm,
      bank_account: bankAccounts[0]?.id || 0,
    });
    setIsFormOpen(true);
  };

  const openEdit = (item: BankExchangeSettings) => {
    setSelected(item);
    setFormData({
      bank_account: item.bank_account,
      exchange_format: item.exchange_format,
      bank_program_name: item.bank_program_name || '',
      encoding: item.encoding,
      auto_create_counterparties: item.auto_create_counterparties,
      new_counterparty_group_name: item.new_counterparty_group_name || '',
      auto_detect_bank_fees: item.auto_detect_bank_fees,
      auto_post_incoming: item.auto_post_incoming,
      auto_post_outgoing: item.auto_post_outgoing,
      show_form_before_import: item.show_form_before_import,
      export_payment_orders: item.export_payment_orders,
      export_payment_claims: item.export_payment_claims,
      validate_document_number: item.validate_document_number,
      validate_exchange_security: item.validate_exchange_security,
    });
    setIsFormOpen(true);
  };

  const columns: ColumnDef<BankExchangeSettings>[] = [
    { accessorKey: 'bank_account_name', header: 'Bank Account' },
    { accessorKey: 'exchange_format', header: 'Format' },
    { accessorKey: 'encoding', header: 'Encoding' },
    {
      id: 'automation',
      header: 'Automation',
      cell: ({ row }) => (
        <div className="flex gap-2">
          {row.original.auto_create_counterparties ? <Badge variant="secondary">Auto CP</Badge> : null}
          {row.original.auto_detect_bank_fees ? <Badge variant="secondary">Fee Detect</Badge> : null}
          {row.original.auto_post_incoming || row.original.auto_post_outgoing ? <Badge variant="secondary">Auto Post</Badge> : null}
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
          <h1 className="text-3xl font-bold tracking-tight">Bank Exchange Settings</h1>
          <p className="text-muted-foreground">Configure import/export format, encoding and automation rules.</p>
        </div>
        <Button onClick={openCreate} disabled={noBankAccounts}>
          + Add Settings
        </Button>
      </div>

      {noBankAccounts && (
        <div className="rounded-lg border border-dashed p-4 bg-muted/20 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Create at least one bank account before adding exchange settings.
          </p>
          <Button variant="outline" onClick={() => router.push('/directories/bank-accounts')}>
            Go to Bank Accounts
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={settings}
        isLoading={isLoading}
        searchColumn="bank_account_name"
        searchPlaceholder="Search by bank account..."
        onRefresh={() => refetch()}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[820px]">
          <DialogHeader>
            <DialogTitle>{selected ? 'Edit Exchange Settings' : 'New Exchange Settings'}</DialogTitle>
            <DialogDescription>Set import and export behavior for selected bank account.</DialogDescription>
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
                <Label>Bank Account</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formData.bank_account}
                  onChange={(e) => setFormData({ ...formData, bank_account: Number(e.target.value) })}
                  required
                >
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} - {a.account_number}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formData.exchange_format}
                  onChange={(e) => setFormData({ ...formData, exchange_format: e.target.value as FormState['exchange_format'] })}
                >
                  <option value="CSV">CSV</option>
                  <option value="CLIENT_BANK_1C">1C ClientBank</option>
                  <option value="ISO20022">ISO20022</option>
                  <option value="API">API</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Bank Program Name</Label>
                <Input value={formData.bank_program_name} onChange={(e) => setFormData({ ...formData, bank_program_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Encoding</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formData.encoding}
                  onChange={(e) => setFormData({ ...formData, encoding: e.target.value as FormState['encoding'] })}
                >
                  <option value="UTF-8">UTF-8</option>
                  <option value="WINDOWS-1251">WINDOWS-1251</option>
                  <option value="DOS-866">DOS-866</option>
                </select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Group For New Counterparties</Label>
                <Input value={formData.new_counterparty_group_name} onChange={(e) => setFormData({ ...formData, new_counterparty_group_name: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2"><Switch checked={formData.auto_create_counterparties} onCheckedChange={(v) => setFormData({ ...formData, auto_create_counterparties: v })} /><Label>Auto-create counterparties</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.auto_detect_bank_fees} onCheckedChange={(v) => setFormData({ ...formData, auto_detect_bank_fees: v })} /><Label>Auto-detect bank fees</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.auto_post_incoming} onCheckedChange={(v) => setFormData({ ...formData, auto_post_incoming: v })} /><Label>Auto-post incoming</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.auto_post_outgoing} onCheckedChange={(v) => setFormData({ ...formData, auto_post_outgoing: v })} /><Label>Auto-post outgoing</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.show_form_before_import} onCheckedChange={(v) => setFormData({ ...formData, show_form_before_import: v })} /><Label>Show form before import</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.export_payment_orders} onCheckedChange={(v) => setFormData({ ...formData, export_payment_orders: v })} /><Label>Export payment orders</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.export_payment_claims} onCheckedChange={(v) => setFormData({ ...formData, export_payment_claims: v })} /><Label>Export payment claims</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.validate_document_number} onCheckedChange={(v) => setFormData({ ...formData, validate_document_number: v })} /><Label>Validate document number</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.validate_exchange_security} onCheckedChange={(v) => setFormData({ ...formData, validate_exchange_security: v })} /><Label>Validate exchange security</Label></div>
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
            <AlertDialogTitle>Delete exchange settings?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes exchange settings for {selected?.bank_account_name || 'selected account'}.
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
