"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useHotkeys } from "react-hotkeys-hook";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PiArrowLeftBold,
  PiArrowRightBold,
  PiPrinterBold,
  PiXBold,
} from "react-icons/pi";

import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReferenceSelector } from "@/components/ui/reference-selector";
import { PrintPreviewDialog } from "@/components/documents/print-preview-dialog";
import { DocumentPostings } from "@/components/documents/document-postings";
import { DocumentHistoryPanel } from "@/components/documents/document-history-panel";
import { cn } from "@/lib/utils";
import { mapApiError } from "@/lib/error-mapper";
import type { Currency, PaymentDocument } from "@/types";

interface PaymentDocumentFormProps {
  mode: "create" | "edit";
  initialData?: PaymentDocument;
  initialType?: "INCOMING" | "OUTGOING";
}

type BankOperationTypeOption = {
  id: number;
  code: string;
  debit_account: number;
  credit_account: number;
};

type PostingPreview = {
  debit_account: { id: number; code: string; name: string };
  credit_account: { id: number; code: string; name: string };
  amount: number | string;
  payment_type: string;
};

type PaymentDirection =
  | "Покупатель"
  | "Поставщик"
  | "Учредитель"
  | "Внутренний перевод"
  | "Прочие"
  | "Зарплата";

const DEFAULT_PAYMENT_DATE = "2026-03-01T00:00:00";
const DEFAULT_DEPARTMENT = "Оптовая торговля (общая)";

function toDateTimeInputValue(value?: string | null): string {
  if (!value) return "2026-03-01T00:00";

  if (value.includes("T")) {
    return value.slice(0, 16);
  }

  return `${value.slice(0, 10)}T00:00`;
}

function toHeaderDateLabel(value?: string | null): string {
  if (!value) return "01.03.2026 00:00:00";

  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function deriveInitialDirection(
  initialType: "INCOMING" | "OUTGOING",
  initialData?: PaymentDocument,
): PaymentDirection {
  const kind = initialData?.payment_kind;

  if (kind === "supplier") return "Поставщик";
  if (kind === "salary") return "Зарплата";
  if (initialType === "INCOMING") return "Покупатель";
  return "Прочие";
}

export function PaymentDocumentForm({
  initialData,
  mode,
  initialType = "INCOMING",
}: PaymentDocumentFormProps) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const localePath = (path: string) =>
    `/${locale}${path.startsWith("/") ? path : `/${path}`}`;

  const [printOpen, setPrintOpen] = useState(false);
  const [activePane, setActivePane] = useState<"main" | "history" | "postings">("main");
  const [directionLabel, setDirectionLabel] = useState<PaymentDirection>(() =>
    deriveInitialDirection(initialType, initialData),
  );

  const [formData, setFormData] = useState<Partial<PaymentDocument>>(
    initialData || {
      date: DEFAULT_PAYMENT_DATE,
      status: "draft",
      payment_type: initialType,
      currency: 1,
      rate: 1,
      amount: 0,
      vat_amount: 0,
      payment_priority: 5,
      payment_kind: "other",
      purpose: "",
      basis: "",
      number: "",
    },
  );

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ["payment-form-currencies"],
    queryFn: async () => {
      try {
        const response = (await api.get("/directories/currencies/")) as
          | { results?: Currency[] }
          | Currency[];
        return Array.isArray(response) ? response : response.results || [];
      } catch {
        return [];
      }
    },
    initialData: [],
  });

  const { data: postingPreview } = useQuery<PostingPreview | null>({
    queryKey: [
      "payment-posting-preview",
      formData.bank_operation_type,
      formData.debit_account,
      formData.credit_account,
      formData.payment_type,
      formData.counterparty,
      formData.amount,
    ],
    queryFn: async () => {
      try {
        const payload = {
          bank_operation_type: formData.bank_operation_type || null,
          debit_account: formData.debit_account || null,
          credit_account: formData.credit_account || null,
          payment_type: formData.payment_type || "INCOMING",
          counterparty: formData.counterparty || null,
          amount: formData.amount || 0,
        };
        return (await api.post(
          "/documents/payments/posting-preview/",
          payload,
        )) as PostingPreview;
      } catch {
        return null;
      }
    },
    enabled: Boolean(
      formData.amount &&
        (formData.payment_type ||
          formData.debit_account ||
          formData.credit_account ||
          formData.bank_operation_type),
    ),
  });

  const effectiveCurrencyId = useMemo(() => {
    if (formData.currency) return formData.currency;
    return (currencies.find((currency) => currency.is_base) || currencies[0])?.id;
  }, [currencies, formData.currency]);

  const currencyCode = useMemo(() => {
    return (
      currencies.find((currency) => currency.id === effectiveCurrencyId)?.code ||
      initialData?.currency_code ||
      "USD"
    );
  }, [currencies, effectiveCurrencyId, initialData?.currency_code]);

  const isPosted = initialData?.is_posted ?? formData.status === "posted";
  const canEdit =
    mode === "create" ? true : !isPosted && (initialData?.can_edit ?? true);
  const isIncoming = formData.payment_type === "INCOMING";

  const incomingAmount = isIncoming ? Number(formData.amount || 0) : 0;
  const outgoingAmount = isIncoming ? 0 : Number(formData.amount || 0);
  const rowPercent = "100,00";
  const accountDelta = incomingAmount - outgoingAmount;

  const title = useMemo(() => {
    const base = "Безналичные операции";

    if (mode === "create") {
      return `${base} (создание)`;
    }

    const numberLabel = formData.number || initialData?.number || "0";
    return `${base} ${numberLabel} от ${toHeaderDateLabel(formData.date || initialData?.date)}`;
  }, [formData.date, formData.number, initialData?.date, initialData?.number, mode]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<PaymentDocument>) => {
      if (mode === "create") {
        return api.post<{ id: number }>("/documents/payments/", data);
      }
      return api.put(`/documents/payments/${initialData!.id}/`, data);
    },
    onSuccess: (response: { id?: number }) => {
      toast.success(tc("savedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      if (initialData?.id) {
        queryClient.invalidateQueries({ queryKey: ["payment-document", initialData.id] });
      }
      if (mode === "create" && response?.id) {
        router.push(localePath(`/documents/payments/${response.id}`));
      }
    },
    onError: (error: unknown) => {
      const { title: errorTitle, description } = mapApiError(error);
      toast.error(errorTitle, { description });
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => api.post(`/documents/payments/${initialData!.id}/post/`),
    onMutate: async () => {
      setFormData((current) => ({ ...current, status: "posted" }));
      toast.success(t("postedSuccessfully"));
    },
    onError: (error: unknown) => {
      setFormData((current) => ({ ...current, status: "draft" }));
      const { title: errorTitle, description } = mapApiError(error);
      toast.error(errorTitle, { description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      if (initialData?.id) {
        queryClient.invalidateQueries({ queryKey: ["payment-document", initialData.id] });
      }
      router.refresh();
    },
  });

  const unpostMutation = useMutation({
    mutationFn: async () => api.post(`/documents/payments/${initialData!.id}/unpost/`),
    onMutate: async () => {
      setFormData((current) => ({ ...current, status: "draft" }));
      toast.success(t("unpostedSuccessfully"));
    },
    onError: () => {
      setFormData((current) => ({ ...current, status: "posted" }));
      toast.error("Не удалось отменить проведение");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      if (initialData?.id) {
        queryClient.invalidateQueries({ queryKey: ["payment-document", initialData.id] });
      }
      router.refresh();
    },
  });

  useHotkeys(
    "ctrl+s",
    (event) => {
      event.preventDefault();
      if (canEdit) saveMutation.mutate(formData);
    },
    { enableOnFormTags: true },
    [canEdit, formData],
  );

  useHotkeys(
    "ctrl+enter, f9",
    (event) => {
      event.preventDefault();
      if (!isPosted && initialData?.id) postMutation.mutate();
    },
    { enableOnFormTags: true },
    [initialData, isPosted],
  );

  useHotkeys("esc", () => router.back(), { enableOnFormTags: true });

  const applyDirection = (nextDirection: PaymentDirection) => {
    const nextData: Partial<PaymentDocument> = { ...formData };

    if (nextDirection === "Покупатель") {
      nextData.payment_type = "INCOMING";
      nextData.payment_kind = "other";
    } else if (nextDirection === "Поставщик") {
      nextData.payment_type = "OUTGOING";
      nextData.payment_kind = "supplier";
    } else if (nextDirection === "Зарплата") {
      nextData.payment_type = "OUTGOING";
      nextData.payment_kind = "salary";
    } else {
      nextData.payment_type = "OUTGOING";
      nextData.payment_kind = "other";
    }

    setDirectionLabel(nextDirection);
    setFormData(nextData);
  };

  const handlePrimaryAction = () => {
    if (mode === "create") {
      saveMutation.mutate(formData);
      return;
    }

    if (!isPosted && initialData?.can_post) {
      postMutation.mutate();
      return;
    }

    router.back();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#efefef] p-3 text-[#1f2937]">
      <div className="rounded-sm border border-[#bfc4cc] bg-white">
        <div className="flex items-center gap-2 border-b border-[#d6d6d6] px-4 py-3">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#b8b8b8] bg-white"
            onClick={() => router.back()}
          >
            <PiArrowLeftBold className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#b8b8b8] bg-white"
            onClick={() => router.forward()}
          >
            <PiArrowRightBold className="h-4 w-4" />
          </button>
          <div className="ml-2 text-[26px] font-semibold tracking-tight">{title}</div>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-[#e5e7eb] px-4 py-2 text-sm">
          <button
            type="button"
            onClick={() => setActivePane("main")}
            className={cn(
              "rounded-sm px-3 py-2",
              activePane === "main"
                ? "bg-[#ececec] font-medium"
                : "text-[#315d96] underline decoration-dotted underline-offset-2",
            )}
          >
            Основное
          </button>
          <span className="px-3 py-2 text-[#315d96] underline decoration-dotted underline-offset-2">
            Касса
          </span>
          <span className="px-3 py-2 text-[#315d96] underline decoration-dotted underline-offset-2">
            Курсовая разница контрагента
          </span>
          <span className="px-3 py-2 text-[#315d96] underline decoration-dotted underline-offset-2">
            Курсовая разница счета
          </span>
          <span className="px-3 py-2 text-[#315d96] underline decoration-dotted underline-offset-2">
            Начисление зарплаты
          </span>
          <span className="px-3 py-2 text-[#315d96] underline decoration-dotted underline-offset-2">
            Покупатели
          </span>
          <span className="px-3 py-2 text-[#315d96] underline decoration-dotted underline-offset-2">
            Поставщики
          </span>
          <span className="px-3 py-2 text-[#315d96] underline decoration-dotted underline-offset-2">
            Прочие доходы
          </span>
          <span className="px-3 py-2 text-[#315d96] underline decoration-dotted underline-offset-2">
            Прочие расходы
          </span>
          {initialData?.id ? (
            <>
              <button
                type="button"
                onClick={() => setActivePane("history")}
                className={cn(
                  "rounded-sm px-3 py-2",
                  activePane === "history"
                    ? "bg-[#ececec] font-medium"
                    : "text-[#315d96] underline decoration-dotted underline-offset-2",
                )}
              >
                История
              </button>
              <button
                type="button"
                onClick={() => setActivePane("postings")}
                className={cn(
                  "rounded-sm px-3 py-2",
                  activePane === "postings"
                    ? "bg-[#ececec] font-medium"
                    : "text-[#315d96] underline decoration-dotted underline-offset-2",
                )}
              >
                Проводки
              </button>
            </>
          ) : null}
        </div>

        {activePane === "main" ? (
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="h-10 rounded-sm bg-[#f5d400] px-5 text-black hover:bg-[#e5c500]"
                onClick={handlePrimaryAction}
              >
                Провести и закрыть
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-sm border-[#b8b8b8] bg-white px-5"
                onClick={() => postMutation.mutate()}
                disabled={mode === "create" || isPosted || postMutation.isPending}
              >
                Провести
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-sm border-[#b8b8b8] bg-white px-5"
                onClick={() => saveMutation.mutate(formData)}
                disabled={!canEdit || saveMutation.isPending}
              >
                Записать
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-sm border-[#b8b8b8] bg-white px-5"
                onClick={() => router.back()}
              >
                Отменить
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-sm border-[#b8b8b8] bg-white px-5"
                onClick={() => setPrintOpen(true)}
              >
                <PiPrinterBold className="mr-2 h-4 w-4" />
                {tc("print")}
              </Button>
              {initialData?.can_unpost ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-sm border-[#b8b8b8] bg-white px-5"
                  onClick={() => unpostMutation.mutate()}
                  disabled={unpostMutation.isPending}
                >
                  <PiXBold className="mr-2 h-4 w-4" />
                  {t("unpost")}
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 xl:grid-cols-[110px_180px_70px_220px_80px_1fr] xl:items-center">
              <div className="text-sm">Номер:</div>
              <Input
                value={formData.number || "0"}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, number: event.target.value }))
                }
                disabled={!canEdit}
                className="h-9 rounded-sm border-[#b8b8b8] bg-white font-mono"
              />
              <div className="text-sm">Дата:</div>
              <Input
                type="datetime-local"
                value={toDateTimeInputValue(formData.date)}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, date: event.target.value }))
                }
                disabled={!canEdit}
                className="h-9 rounded-sm border-[#d7b84c] bg-[#fffef6] font-mono"
              />
              <div className="text-sm">Касса:</div>
              <ReferenceSelector
                value={formData.bank_account as number}
                onSelect={(value) =>
                  setFormData((current) => ({ ...current, bank_account: value as number }))
                }
                apiEndpoint="/directories/bank-accounts/"
                placeholder="Выберите кассу"
                displayField="name"
                disabled={!canEdit}
                className="h-9 rounded-sm border-[#b8b8b8] bg-white"
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-[110px_260px_80px_1fr_70px_140px] xl:items-center">
              <div className="text-sm">Валюта:</div>
              <select
                value={effectiveCurrencyId || ""}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    currency: Number(event.target.value),
                  }))
                }
                disabled={!canEdit}
                className="h-9 rounded-sm border border-[#b8b8b8] bg-white px-3 text-sm outline-none"
              >
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.id}>
                    {currency.code}
                  </option>
                ))}
              </select>
              <div className="text-sm">Курс:</div>
              <Input
                type="number"
                value={String(formData.rate ?? 1)}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    rate: Number.parseFloat(event.target.value) || 0,
                  }))
                }
                disabled={!canEdit}
                className="h-9 rounded-sm border-[#b8b8b8] bg-white text-right font-mono"
              />
              <div className="text-sm">Статус:</div>
              <div
                className={cn(
                  "h-9 rounded-sm border px-3 py-2 text-sm",
                  isPosted
                    ? "border-[#9ec99e] bg-[#f1fbf1] text-[#2d7a2d]"
                    : "border-[#d7c37a] bg-[#fff8de] text-[#6c5b1f]",
                )}
              >
                {isPosted ? "Проведен" : "Черновик"}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-sm border-[#b8b8b8] bg-white"
              >
                Добавить
              </Button>
            </div>

            <div className="overflow-auto rounded-sm border border-[#b8b8b8]">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead className="bg-[#ededed] text-left">
                  <tr className="[&>th]:border-b [&>th]:border-r [&>th]:border-[#d0d0d0] [&>th]:px-3 [&>th]:py-2 [&>th:last-child]:border-r-0">
                    <th className="w-[60px]">N</th>
                    <th className="w-[150px]">Направление</th>
                    <th>Контрагент</th>
                    <th className="w-[120px] text-right">Приход</th>
                    <th className="w-[120px] text-right">Расход</th>
                    <th>Основание</th>
                    <th className="w-[90px] text-right">%</th>
                    <th className="w-[140px] text-right">Приход всего</th>
                    <th className="w-[140px] text-right">Расход всего</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#ececec] bg-[#fffbe6]">
                    <td className="px-3 py-2">1</td>
                    <td className="px-3 py-2">
                      <select
                        value={directionLabel}
                        onChange={(event) =>
                          applyDirection(event.target.value as PaymentDirection)
                        }
                        className="h-8 w-full rounded-sm border border-[#b8b8b8] bg-white px-2 text-sm outline-none"
                      >
                        {(
                          [
                            "Покупатель",
                            "Поставщик",
                            "Учредитель",
                            "Внутренний перевод",
                            "Прочие",
                            "Зарплата",
                          ] as PaymentDirection[]
                        ).map((direction) => (
                          <option key={direction} value={direction}>
                            {direction}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <ReferenceSelector
                        value={formData.counterparty as number}
                        onSelect={(value) =>
                          setFormData((current) => ({
                            ...current,
                            counterparty: value as number,
                          }))
                        }
                        apiEndpoint="/directories/counterparties/"
                        placeholder="Контрагент"
                        disabled={!canEdit}
                        className="h-8 rounded-sm border-[#b8b8b8] bg-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={String(incomingAmount)}
                        onChange={(event) =>
                          setFormData((current) => ({
                            ...current,
                            amount: Number.parseFloat(event.target.value) || 0,
                            payment_type: "INCOMING",
                          }))
                        }
                        disabled={!canEdit || !isIncoming}
                        className="h-8 rounded-sm border-[#b8b8b8] bg-white text-right font-mono"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={String(outgoingAmount)}
                        onChange={(event) =>
                          setFormData((current) => ({
                            ...current,
                            amount: Number.parseFloat(event.target.value) || 0,
                            payment_type: "OUTGOING",
                          }))
                        }
                        disabled={!canEdit || isIncoming}
                        className="h-8 rounded-sm border-[#b8b8b8] bg-white text-right font-mono"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={formData.basis || ""}
                        onChange={(event) =>
                          setFormData((current) => ({ ...current, basis: event.target.value }))
                        }
                        disabled={!canEdit}
                        className="h-8 rounded-sm border-[#b8b8b8] bg-white"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{rowPercent}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {incomingAmount.toLocaleString("ru-RU", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {outgoingAmount.toLocaleString("ru-RU", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 xl:grid-cols-[100px_1fr_110px_1fr] xl:items-center">
              <div className="text-sm">Назначение:</div>
              <Input
                value={formData.purpose || ""}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, purpose: event.target.value }))
                }
                disabled={!canEdit}
                className="h-9 rounded-sm border-[#b8b8b8] bg-white"
              />
              <div className="text-sm">Операция:</div>
              <ReferenceSelector
                value={formData.bank_operation_type as number}
                onSelect={(value, item) => {
                  const operation = item as BankOperationTypeOption | undefined;
                  const nextData: Partial<PaymentDocument> = {
                    ...formData,
                    bank_operation_type: value as number,
                  };

                  if (operation) {
                    nextData.debit_account = operation.debit_account;
                    nextData.credit_account = operation.credit_account;
                  }

                  setFormData(nextData);
                }}
                apiEndpoint="/directories/bank-operation-types/"
                placeholder="Тип операции"
                displayField="name"
                disabled={!canEdit}
                className="h-9 rounded-sm border-[#b8b8b8] bg-white"
              />
            </div>

            <div className="rounded-sm border border-[#e4dbb4] bg-[#f8f1ce] px-4 py-3 text-sm">
              <div className="grid gap-2 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
                <div>Остаток на начало: 0</div>
                <div>Остаток на конец: {accountDelta.toLocaleString("ru-RU")}</div>
                <div>Приход: {incomingAmount.toLocaleString("ru-RU")}</div>
                <div>Расход: {outgoingAmount.toLocaleString("ru-RU")}</div>
                <div>Разница счета: {accountDelta.toLocaleString("ru-RU")}</div>
              </div>
              <div className="mt-2 text-xs text-[#5f4c14]">
                Валюта: {currencyCode}
                {postingPreview
                  ? ` | Дт ${postingPreview.debit_account.code} Кт ${postingPreview.credit_account.code}`
                  : ""}
              </div>
            </div>

            <div className="grid gap-3 border-t border-[#e5e7eb] pt-3 xl:grid-cols-[100px_1fr_130px_1fr] xl:items-center">
              <div className="text-sm">Создатель:</div>
              <Input
                value="Admin"
                readOnly
                className="h-9 rounded-sm border-[#b8b8b8] bg-[#f8f8f8]"
              />
              <div className="text-sm">Подразделение:</div>
              <Input
                value={DEFAULT_DEPARTMENT}
                readOnly
                className="h-9 rounded-sm border-[#b8b8b8] bg-[#f8f8f8]"
              />
            </div>
          </div>
        ) : activePane === "history" ? (
          <div className="min-h-[420px] p-6">
            {initialData?.id ? (
              <DocumentHistoryPanel documentId={initialData.id} documentType="payments" />
            ) : (
              <div className="rounded-sm border border-[#d0d0d0] bg-[#fafafa] p-6 text-center text-sm text-muted-foreground">
                Сохраните документ, чтобы посмотреть историю.
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-[420px] p-6">
            {initialData?.id ? (
              <DocumentPostings documentId={initialData.id} endpoint="payments" />
            ) : (
              <div className="rounded-sm border border-[#d0d0d0] bg-[#fafafa] p-6 text-center text-sm text-muted-foreground">
                Сохраните документ, чтобы посмотреть проводки.
              </div>
            )}
          </div>
        )}
      </div>

      <PrintPreviewDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        document={initialData}
        tenant={initialData?.tenant}
      />
    </div>
  );
}
