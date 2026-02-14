'use client';

import { useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { LinkableCell } from '@/components/ui/linkable-cell';
import { CopyLinkButton } from '@/components/ui/copy-link-button';
import { Loader2 } from 'lucide-react';
import type { Contract, Counterparty, Currency, PaginatedResponse } from '@/types';

type ContractApi = Contract & {
  date?: string | null;
  contract_type?: string | null;
  contract_type_display?: string | null;
  counterparty_name?: string | null;
  currency_code?: string | null;
};

interface RelatedDocument {
  id: number;
  type: string;
  number: string;
  date: string;
  total?: number;
  amount?: number;
}

interface ContractDocumentsResponse {
  documents: RelatedDocument[];
}

type LinkableDocumentType =
  | 'sales-document'
  | 'purchase-document'
  | 'payment-document'
  | 'transfer-document';

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

function mapRelatedDocumentType(type: unknown): LinkableDocumentType | null {
  const value = String(type ?? '').toLowerCase();
  if (value === 'sales') return 'sales-document';
  if (value === 'purchase') return 'purchase-document';
  if (value === 'payment') return 'payment-document';
  if (value === 'transfer') return 'transfer-document';
  return null;
}

function extractContractId(
  paramsId: string | string[] | undefined,
  pathname: string | null
): string {
  const fromParams = Array.isArray(paramsId) ? paramsId[0] : paramsId;

  const browserPath =
    typeof window !== 'undefined' ? window.location.pathname : '';
  const sources = [fromParams, pathname || '', browserPath];

  for (const source of sources) {
    const raw = String(source || '').trim();
    if (!raw) continue;

    const directNumeric = raw.match(/^\d+$/);
    if (directNumeric) return directNumeric[0];

    const routeMatch = raw.match(/\/directories\/contracts\/(\d+)(?:\/|$)/);
    if (routeMatch?.[1]) return routeMatch[1];

    const trailingMatch = raw.match(/(\d+)(?:\/)?$/);
    if (trailingMatch?.[1]) return trailingMatch[1];
  }

  return '';
}

async function findContractInPagedList(idValue: string): Promise<ContractApi | null> {
  let url: string | null = '/directories/contracts/';

  for (let page = 0; page < 20 && url; page += 1) {
    const response: PaginatedResponse<ContractApi> | ContractApi[] = await api.get(url);

    if (Array.isArray(response)) {
      return response.find((item) => String(item.id) === idValue) || null;
    }

    const match = (response?.results || []).find((item) => String(item.id) === idValue);
    if (match) return match;
    url = response?.next || null;
  }

  return null;
}

async function fetchContractById(idValue: string): Promise<ContractApi | null> {
  try {
    return await api.get<ContractApi>(`/directories/contracts/${idValue}/`);
  } catch {
    return null;
  }
}

export default function ContractDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const locale = useLocale();
  const tNav = useTranslations('nav');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');
  const tDetail = useTranslations('directories.contractDetail');
  const idValue = useMemo(
    () => extractContractId(params.id, pathname),
    [params.id, pathname]
  );

  const id = Number(idValue);
  const hasId = idValue.length > 0;
  const numericId = Number.isFinite(id) && id > 0 ? id : 0;

  const { data: contract, isLoading } = useQuery<ContractApi | null>({
    queryKey: ['contract', idValue],
    queryFn: async () => {
      try {
        const direct = await fetchContractById(idValue);
        if (direct) return direct;

        const cached = queryClient.getQueryData<ContractApi[]>(['contracts']);
        const cachedMatch = cached?.find((item) => String(item.id) === idValue);
        if (cachedMatch) return cachedMatch;

        return await findContractInPagedList(idValue);
      } catch {
        return null;
      }
    },
    enabled: hasId,
  });

  const { data: counterparties = [] } = useQuery<Counterparty[]>({
    queryKey: ['contract-counterparties'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<Counterparty> | Counterparty[]>(
          '/directories/counterparties/'
        );
        if (Array.isArray(response)) return response;
        return response?.results || [];
      } catch {
        return [];
      }
    },
    initialData: [],
  });

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['contract-currencies'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<Currency> | Currency[]>(
          '/directories/currencies/'
        );
        if (Array.isArray(response)) return response;
        return response?.results || [];
      } catch {
        return [];
      }
    },
    initialData: [],
  });

  const { data: documentsData } = useQuery<ContractDocumentsResponse>({
    queryKey: ['contract', idValue, 'documents'],
    queryFn: async () => {
      try {
        const response = await api.get<ContractDocumentsResponse | RelatedDocument[]>(
          `/directories/contracts/${idValue}/documents/`
        );
        if (Array.isArray(response)) return { documents: response };
        if (Array.isArray(response?.documents)) return response;
        return { documents: [] };
      } catch {
        return { documents: [] };
      }
    },
    initialData: { documents: [] },
    enabled: hasId,
  });

  const counterpartiesById = useMemo(
    () => new Map(counterparties.map((item) => [item.id, item.name])),
    [counterparties]
  );
  const currenciesById = useMemo(
    () => new Map(currencies.map((item) => [item.id, item.code])),
    [currencies]
  );

  const breadcrumbs = [
    { label: tNav('main'), href: '/' },
    { label: tNav('directories'), href: '/directories' },
    { label: tNav('contracts'), href: '/directories/contracts' },
    { label: contract?.number || tDetail('fallback', { id: numericId || idValue }) },
  ];

  if (!hasId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="container mx-auto py-6">
        <p>{tDetail('notFound')}</p>
      </div>
    );
  }

  const counterpartyName =
    contract.counterparty_detail?.name ||
    contract.counterparty_name ||
    counterpartiesById.get(contract.counterparty) ||
    `${tf('counterparty')} #${contract.counterparty}`;
  const currencyCode =
    contract.currency_detail?.code ||
    contract.currency_code ||
    currenciesById.get(contract.currency) ||
    `${tf('currency')} #${contract.currency}`;
  const contractDate = getContractDateValue(contract);
  const contractTerms =
    contract.terms ||
    contract.contract_type_display ||
    contract.contract_type ||
    tDetail('na');

  const documentColumns: ColumnDef<RelatedDocument>[] = [
    {
      accessorKey: 'date',
      header: tc('date'),
      cell: ({ row }) => formatDateValue(row.getValue('date'), locale),
    },
    {
      accessorKey: 'type',
      header: tf('type'),
      cell: ({ row }) => <Badge variant="outline">{String(row.original.type || '-')}</Badge>,
    },
    {
      accessorKey: 'number',
      header: tc('number'),
      cell: ({ row }) => {
        const linkType = mapRelatedDocumentType(row.original.type);
        if (!linkType) return <span className="font-medium">{row.original.number}</span>;
        return <LinkableCell id={row.original.id} type={linkType} label={row.original.number} />;
      },
    },
    {
      accessorKey: 'total',
      header: tc('amount'),
      cell: ({ row }) => {
        const amount = Number(row.original.total ?? row.original.amount ?? 0);
        return Number.isFinite(amount) ? amount.toLocaleString(locale) : '0';
      },
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Breadcrumbs segments={breadcrumbs} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{contract.number}</h1>
          <p className="text-muted-foreground">{counterpartyName}</p>
        </div>
        <div className="flex gap-2">
          <CopyLinkButton entityType="contract" entityId={numericId || Number(contract.id)} />
          <Badge variant={contract.is_active ? 'default' : 'secondary'}>
            {contract.is_active ? tDetail('status.active') : tDetail('status.inactive')}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">{tDetail('tabs.details')}</TabsTrigger>
          <TabsTrigger value="documents">{tDetail('tabs.documents')}</TabsTrigger>
          <TabsTrigger value="audit">{tDetail('tabs.audit')}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tDetail('contractInformation')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{tc('number')}</p>
                <p className="font-medium">{contract.number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{tf('counterparty')}</p>
                <p className="font-medium">{counterpartyName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{tf('currency')}</p>
                <p className="font-medium">{currencyCode}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{tf('startDate')}</p>
                <p className="font-medium">{formatDateValue(contractDate, locale, tDetail('na'))}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{tf('endDate')}</p>
                <p className="font-medium">
                  {contract.end_date
                    ? formatDateValue(contract.end_date, locale, tDetail('na'))
                    : tDetail('openEnded')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{tf('isActive')}</p>
                <p className="font-medium">{contract.is_active ? tc('yes') : tc('no')}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">{tf('terms')}</p>
                <p className="font-medium">{contractTerms}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>{tDetail('relatedDocuments')}</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={documentColumns} data={documentsData?.documents || []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>{tDetail('auditTrail')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">{tDetail('audit.created')}</p>
                  <p className="font-medium">
                    {formatDateValue(contract.created_at, locale, tDetail('na'))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tDetail('audit.lastModified')}</p>
                  <p className="font-medium">
                    {formatDateValue(contract.updated_at, locale, tDetail('na'))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
