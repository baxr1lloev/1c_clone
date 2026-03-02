'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { PiCaretLeftBold, PiPlusBold } from 'react-icons/pi';

import api from '@/lib/api';
import { PurchaseDocumentForm } from '@/components/documents/purchase-document-form';
import { PeriodStatusBanner } from '@/components/documents/period-status-banner';
import { Button } from '@/components/ui/button';

function formatDocumentDate(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return null;
  }

  const response = (error as { response?: { status?: unknown } }).response;
  const status = Number(response?.status);
  return Number.isFinite(status) ? status : null;
}

function getErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return null;
  }

  const response = (error as { response?: { data?: { detail?: unknown } } }).response;
  const detail = response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail.trim() : null;
}

export default function PurchaseDocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const isValidId = Number.isInteger(id) && id > 0;

  const {
    data: doc,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['purchase', id],
    enabled: isValidId,
    retry: false,
    queryFn: async () => api.get(`/documents/purchases/${id}/`),
  });

  const errorStatus = getErrorStatus(error);
  const errorDetail = getErrorMessage(error);
  const isMissingDocument =
    !isValidId || errorStatus === 404 || (!isLoading && !error && !doc);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!doc) {
    const title = isMissingDocument
      ? 'Документ не найден'
      : 'Не удалось загрузить документ';
    const description = !isValidId
      ? 'Некорректный номер документа в адресе.'
      : isMissingDocument
        ? `В базе сейчас нет документа поступления с ID ${id}.`
        : errorDetail || 'Проверьте доступ к API и попробуйте повторить загрузку.';

    return (
      <div className="flex h-full items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-xl rounded-lg border border-[#d7d7d7] bg-background p-6 text-[#2f2f2f] shadow-sm">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm text-[#666]">{description}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/documents/purchases')}>
              <PiCaretLeftBold className="h-4 w-4" />
              К списку
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/documents/purchases/new')}>
              <PiPlusBold className="h-4 w-4" />
              Создать
            </Button>
            {!isMissingDocument ? (
              <Button type="button" variant="outline" onClick={() => refetch()}>
                Повторить
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const dateLabel = formatDocumentDate(doc.date);
  const documentTitle = dateLabel
    ? `Поступление номенклатуры ${doc.number} от ${dateLabel}`
    : `Поступление номенклатуры ${doc.number}`;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b bg-muted/20 px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => router.push('/documents/purchases')}
            >
              <PiCaretLeftBold className="h-4 w-4" />
            </Button>
            <div className="truncate text-lg font-semibold">{documentTitle}</div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => router.push('/documents/purchases/new')}
          >
            <PiPlusBold className="h-4 w-4" />
            Создать
          </Button>
        </div>
      </div>

      {doc.date ? (
        <div className="px-6">
          <PeriodStatusBanner date={doc.date} className="mt-4" />
        </div>
      ) : null}

      <div className="flex-1 overflow-hidden">
        <PurchaseDocumentForm mode="edit" initialData={doc} />
      </div>
    </div>
  );
}
