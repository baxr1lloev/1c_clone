'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { PiDotsThreeOutlineBold, PiPencilBold, PiTrashBold, PiArrowsDownUpBold, PiFilesBold } from 'react-icons/pi';
import type { Contract, Counterparty, Currency, PaginatedResponse } from '@/types';

type ContractApi = Contract & {
  date?: string | null;
  contract_type?: string | null;
  contract_type_display?: string | null;
  counterparty_name?: string | null;
  currency_code?: string | null;
};

const demoContracts: Contract[] = [
  { id: 1, tenant: 1, number: 'CNT-2024-001', counterparty: 1, currency: 1, start_date: '2024-01-01', end_date: '2024-12-31', terms: 'Net 30', is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 2, tenant: 1, number: 'CNT-2024-002', counterparty: 2, currency: 1, start_date: '2024-02-01', end_date: null, terms: 'Net 15', is_active: true, created_at: '2024-02-01', updated_at: '2024-02-01' },
  { id: 3, tenant: 1, number: 'CNT-2024-003', counterparty: 3, currency: 2, start_date: '2024-01-15', end_date: '2024-06-30', terms: 'Prepaid', is_active: false, created_at: '2024-01-15', updated_at: '2024-01-15' },
];

type ContractFormData = { number: string; counterparty: number; currency: number; start_date: string; end_date: string; terms: string; is_active: boolean; };
const defaultFormData: ContractFormData = { number: '', counterparty: 1, currency: 1, start_date: '', end_date: '', terms: '', is_active: true };

function pickString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function getContractDateValue(contract: Partial<ContractApi>): string | null {
  return pickString(contract.start_date) || pickString(contract.date);
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = raw.match(/^(\d{2})[./-](\d{2})[./-](\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;

  const [, dd, mm, yyyy, hh = '0', min = '0'] = match;
  const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDateValue(value: unknown, locale: string, fallback = '-'): string {
  const parsed = parseDateValue(value);
  if (!parsed) return fallback;
  return new Intl.DateTimeFormat(locale).format(parsed);
}

export default function ContractsPage() {
  const t = useTranslations('directories');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Contract | null>(null);
  const [formData, setFormData] = useState<ContractFormData>(defaultFormData);

  const { data, isLoading, refetch } = useQuery<ContractApi[]>({
    queryKey: ['contracts'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<ContractApi> | ContractApi[]>('/directories/contracts/');
        if (Array.isArray(response)) return response;
        return response?.results || [];
      } catch {
        return demoContracts as ContractApi[];
      }
    },
  });

  const { data: counterparties = [] } = useQuery<Counterparty[]>({
    queryKey: ['contracts-counterparties'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<Counterparty> | Counterparty[]>('/directories/counterparties/');
        if (Array.isArray(response)) return response;
        return response?.results || [];
      } catch {
        return [];
      }
    },
    initialData: [],
  });

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['contracts-currencies'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<Currency> | Currency[]>('/directories/currencies/');
        if (Array.isArray(response)) return response;
        return response?.results || [];
      } catch {
        return [];
      }
    },
    initialData: [],
  });

  const counterpartiesById = useMemo(
    () => new Map(counterparties.map((item) => [item.id, item.name])),
    [counterparties]
  );
  const currenciesById = useMemo(
    () => new Map(currencies.map((item) => [item.id, item.code])),
    [currencies]
  );

  const saveMutation = useMutation({
    mutationFn: async (data: ContractFormData) => {
      const payload = {
        number: data.number,
        counterparty: data.counterparty,
        currency: data.currency,
        is_active: data.is_active,
        date: data.start_date,
        start_date: data.start_date,
        end_date: data.end_date || null,
        terms: data.terms,
        contract_type: (selectedItem as ContractApi | null)?.contract_type || 'SALES',
      };
      if (selectedItem) return api.put(`/directories/contracts/${selectedItem.id}/`, payload);
      return api.post('/directories/contracts/', payload);
    },
    onSuccess: () => {
      toast.success(selectedItem ? tc('updatedSuccessfully') : tc('createdSuccessfully'));
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      handleCloseForm();
    },
    onError: () => toast.error(tc('errorSaving')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/directories/contracts/${id}/`),
    onSuccess: () => {
      toast.success(tc('deletedSuccessfully'));
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setIsDeleteOpen(false);
    },
    onError: () => toast.error(tc('errorDeleting')),
  });

  const handleOpenCreate = () => { setSelectedItem(null); setFormData(defaultFormData); setIsFormOpen(true); };
  const handleOpenEdit = (item: Contract) => {
    const contract = item as ContractApi;
    const startDate = getContractDateValue(contract) || '';
    setSelectedItem(item);
    setFormData({
      number: item.number,
      counterparty: item.counterparty,
      currency: item.currency,
      start_date: startDate,
      end_date: item.end_date || '',
      terms: item.terms || contract.contract_type_display || contract.contract_type || '',
      is_active: item.is_active,
    });
    setIsFormOpen(true);
  };
  const handleCloseForm = () => { setIsFormOpen(false); setSelectedItem(null); setFormData(defaultFormData); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); saveMutation.mutate(formData); };

  const columns: ColumnDef<Contract>[] = [
    {
      accessorKey: 'number',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4">
          {tc('number')} <PiArrowsDownUpBold className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PiFilesBold className="h-4 w-4 text-muted-foreground" />
          <ReferenceLink
            id={row.original.id}
            type="contract"
            label={row.getValue('number')}
            className="font-mono font-medium"
          />
        </div>
      ),
    },
    {
      accessorKey: 'counterparty',
      header: tf('counterparty'),
      cell: ({ row }) => {
        const val = Number(row.getValue('counterparty'));
        const apiLabel = pickString((row.original as ContractApi).counterparty_name);
        const label = apiLabel || counterpartiesById.get(val) || `${tf('counterparty')} #${val}`;
        return <ReferenceLink id={val} type="counterparty" label={label} />;
      }
    },
    {
      accessorKey: 'currency',
      header: tf('currency'),
      cell: ({ row }) => {
        const currencyId = Number(row.getValue('currency'));
        const apiCode = pickString((row.original as ContractApi).currency_code);
        return apiCode || currenciesById.get(currencyId) || `${tf('currency')} #${currencyId}`;
      }
    },
    {
      id: 'start_date',
      accessorFn: (row) => getContractDateValue(row as ContractApi),
      header: tf('startDate'),
      cell: ({ row }) => formatDateValue(row.getValue('start_date'), locale),
    },
    {
      accessorKey: 'end_date',
      header: tf('endDate'),
      cell: ({ row }) => {
        const value = row.getValue('end_date');
        if (!value) return t('contractsPage.openEnded');
        return formatDateValue(value, locale, t('contractsPage.openEnded'));
      },
    },
    { accessorKey: 'terms', header: tf('terms') },
    {
      accessorKey: 'is_active',
      header: tf('isActive'),
      cell: ({ row }) => (
        <Badge variant={row.getValue('is_active') ? 'default' : 'outline'}>
          {row.getValue('is_active') ? t('contractsPage.active') : t('contractsPage.inactive')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><PiDotsThreeOutlineBold className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleOpenEdit(row.original)}><PiPencilBold className="mr-2 h-4 w-4" />{tc('edit')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedItem(row.original); setIsDeleteOpen(true); }} className="text-destructive"><PiTrashBold className="mr-2 h-4 w-4" />{tc('delete')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('contracts')}</h1>
          <p className="text-muted-foreground">{t('contractsPage.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            {tc('import')}
          </Button>
          <Button variant="outline" size="sm">
            {tc('export')}
          </Button>
          <Button onClick={handleOpenCreate}>
            + {t('addContract')}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        searchColumn="number"
        searchPlaceholder={t('contractsPage.searchPlaceholder')}
        onRefresh={() => refetch()}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedItem ? t('editContract') : t('addContract')}</DialogTitle>
            <DialogDescription>
              {selectedItem ? t('contractsPage.updateDescription') : t('contractsPage.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="number">{tc('number')}</Label>
                <Input
                  id="number"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder={t('contractsPage.numberPlaceholder')}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">{tf('startDate')}</Label>
                  <Input id="start_date" type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">{tf('endDate')}</Label>
                  <Input id="end_date" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">{tf('terms')}</Label>
                <Textarea
                  id="terms"
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                  placeholder={t('contractsPage.termsPlaceholder')}
                  rows={2}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                <Label htmlFor="is_active">{tf('isActive')}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseForm}>{tc('cancel')}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t('contractsPage.saving') : tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('contractsPage.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('contractsPage.deleteDescription', { number: selectedItem?.number || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)} className="bg-destructive text-destructive-foreground">
              {deleteMutation.isPending ? t('contractsPage.deleting') : tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
