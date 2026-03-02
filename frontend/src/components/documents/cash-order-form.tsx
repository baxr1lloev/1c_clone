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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReferenceSelector } from "@/components/ui/reference-selector";
import { PrintPreviewDialog } from "@/components/documents/print-preview-dialog";
import { DocumentPostings } from "@/components/documents/document-postings";
import { cn } from "@/lib/utils";
import { mapApiError } from "@/lib/error-mapper";
import type { CashOrder, CashOrderType, Currency } from "@/types";

interface CashOrderFormProps {
  mode: "create" | "edit";
  initialData?: CashOrder;
  initialType?: CashOrderType;
}

const DEFAULT_CASH_ORDER_DATE = "2026-03-01T00:00:00";
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

export function CashOrderForm({
  initialData,
  mode,
  initialType = "incoming",
}: CashOrderFormProps) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const tf = useTranslations("fields");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const localePath = (path: string) =>
    `/${locale}${path.startsWith("/") ? path : `/${path}`}`;

  const [printOpen, setPrintOpen] = useState(false);
  const [activePane, setActivePane] = useState<"main" | "postings">("main");
  const [directionLabel, setDirectionLabel] = useState(() =>
    initialType === "incoming" ? "Покупатель" : "Поставщик",
  );
  const [rateValue, setRateValue] = useState("1.00");

  const [formData, setFormData] = useState<Partial<CashOrder>>(
    initialData || {
      date: DEFAULT_CASH_ORDER_DATE,
      status: "draft",
      order_type: initialType,
      currency: undefined,
      amount: 0,
      purpose: "",
      basis: "",
      cash_desk: "Fayoz Kassa",
      counterparty_name: "",
      counterparty: null,
      number: "",
    },
  );

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ["cash-order-form-currencies"],
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

  const defaultCurrencyId = useMemo(() => {
    if (currencies.length === 0) return null;
    return (currencies.find((currency) => currency.is_base) || currencies[0])?.id ?? null;
  }, [currencies]);

  const effectiveCurrencyId = formData.currency || defaultCurrencyId || undefined;
  const currentCurrencyCode = useMemo(() => {
    return (
      currencies.find((currency) => currency.id === effectiveCurrencyId)?.code ||
      initialData?.currency_code ||
      "USD"
    );
  }, [currencies, effectiveCurrencyId, initialData?.currency_code]);

  const isPosted = initialData?.is_posted ?? formData.status === "posted";
  const canEdit =
    mode === "create" ? true : !isPosted && (initialData?.can_edit ?? true);
  const isIncoming = formData.order_type === "incoming";

  const totalAmount = useMemo(() => {
    const amount = Number(formData.amount || 0);
    const rate = Number.parseFloat(rateValue.replace(",", "."));
    const normalizedRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
    return amount * normalizedRate;
  }, [formData.amount, rateValue]);

  const headerTitle = useMemo(() => {
    const baseTitle = isIncoming
      ? "Приходный кассовый ордер"
      : "Расходный кассовый ордер";

    if (mode === "create") {
      return `${baseTitle} (создание)`;
    }

    const numberLabel = formData.number || initialData?.number || "0";
    return `${baseTitle} ${numberLabel} от ${toHeaderDateLabel(formData.date || initialData?.date)}`;
  }, [formData.date, formData.number, initialData?.date, initialData?.number, isIncoming, mode]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<CashOrder>) => {
      const payload = {
        ...data,
        currency: data.currency || defaultCurrencyId || undefined,
        counterparty_name:
          data.counterparty_name ||
          (data.counterparty ? `ID:${data.counterparty}` : "Unknown"),
      };

      if (mode === "create") {
        return api.post<{ id: number }>("/documents/cash-orders/", payload);
      }

      return api.put(`/documents/cash-orders/${initialData!.id}/`, payload);
    },
    onSuccess: (response: { id?: number }) => {
      toast.success(tc("savedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["cash-orders"] });
      if (mode === "create" && response?.id) {
        router.push(localePath(`/documents/cash-orders/${response.id}/edit`));
      }
    },
    onError: (error: unknown) => {
      const { title, description } = mapApiError(error);
      toast.error(title, { description });
    },
  });

  const postMutation = useMutation({
    mutationFn: async () =>
      api.post(`/documents/cash-orders/${initialData!.id}/post_document/`),
    onMutate: async () => {
      setFormData((current) => ({ ...current, status: "posted" }));
      toast.success(t("postedSuccessfully"));
    },
    onError: (error: unknown) => {
      setFormData((current) => ({ ...current, status: "draft" }));
      const { title, description } = mapApiError(error);
      toast.error(title, { description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-orders"] });
      router.refresh();
    },
  });

  const unpostMutation = useMutation({
    mutationFn: async () =>
      api.post(`/documents/cash-orders/${initialData!.id}/unpost_document/`),
    onMutate: async () => {
      setFormData((current) => ({ ...current, status: "draft" }));
      toast.success(t("unpostedSuccessfully"));
    },
    onError: () => {
      setFormData((current) => ({ ...current, status: "posted" }));
      toast.error("Не удалось отменить проведение");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-orders"] });
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

  const directionOptions = isIncoming
    ? ["Покупатель", "Прочие"]
    : ["Покупатель", "Поставщик", "Прочие"];

  const normalizedDirection = directionOptions.includes(directionLabel)
    ? directionLabel
    : directionOptions[0];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-card p-3 text-foreground">
      <div className="rounded-sm border border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-background"
            onClick={() => router.back()}
          >
            <PiArrowLeftBold className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-background"
            onClick={() => router.forward()}
          >
            <PiArrowRightBold className="h-4 w-4" />
          </button>
          <div className="ml-2 text-[26px] font-semibold tracking-tight">{headerTitle}</div>
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
            {isIncoming ? "Покупатели" : "Поставщики"}
          </span>
          {!isIncoming ? (
            <span className="px-3 py-2 text-[#315d96] underline decoration-dotted underline-offset-2">
              Прочие расходы
            </span>
          ) : null}
          {initialData?.id ? (
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
                className="h-10 rounded-sm border-border bg-background px-5"
                onClick={() => saveMutation.mutate(formData)}
                disabled={!canEdit || saveMutation.isPending}
              >
                Записать
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-sm border-border bg-background px-5"
                onClick={() => postMutation.mutate()}
                disabled={mode === "create" || isPosted || postMutation.isPending}
              >
                Провести
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-sm border-border bg-background px-5"
                onClick={() => setPrintOpen(true)}
              >
                <PiPrinterBold className="mr-2 h-4 w-4" />
                {tc("print")}
              </Button>
              {initialData?.can_unpost ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-sm border-border bg-background px-5"
                  onClick={() => unpostMutation.mutate()}
                  disabled={unpostMutation.isPending}
                >
                  <PiXBold className="mr-2 h-4 w-4" />
                  {t("unpost")}
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_1.15fr_1fr] xl:items-center">
              <div className="grid gap-2 md:grid-cols-[80px_1fr] md:items-center">
                <div className="text-sm">{tc("number")}:</div>
                <Input
                  value={formData.number || "0"}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, number: event.target.value }))
                  }
                  disabled={!canEdit}
                  className="h-9 rounded-sm border-border bg-background font-mono"
                />
              </div>

              <div className="grid gap-2 md:grid-cols-[60px_1fr] md:items-center">
                <div className="text-sm">{tc("date")}:</div>
                <Input
                  type="datetime-local"
                  value={toDateTimeInputValue(formData.date)}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, date: event.target.value }))
                  }
                  disabled={!canEdit}
                  className="h-9 rounded-sm border-[#d7b84c] bg-[#fffef6] font-mono"
                />
              </div>

              <div className="grid gap-2 md:grid-cols-[60px_1fr] md:items-center">
                <div className="text-sm">Касса:</div>
                <Input
                  value={formData.cash_desk || ""}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, cash_desk: event.target.value }))
                  }
                  disabled={!canEdit}
                  className="h-9 rounded-sm border-border bg-background"
                />
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.15fr_1fr_1fr] xl:items-center">
              <div className="grid gap-2 md:grid-cols-[110px_1fr] md:items-center">
                <div className="text-sm">Направление:</div>
                <select
                  value={normalizedDirection}
                  onChange={(event) => setDirectionLabel(event.target.value)}
                  className="h-9 rounded-sm border border-border bg-background px-3 text-sm outline-none"
                >
                  {directionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2 md:grid-cols-[60px_1fr] md:items-center">
                <div className="text-sm">Касса:</div>
                <Input
                  value={formData.cash_desk || ""}
                  readOnly
                  className="h-9 rounded-sm border-border bg-muted/30"
                />
              </div>

              <div className="grid gap-2 md:grid-cols-[95px_1fr] md:items-center">
                <div className="text-sm">Статус:</div>
                <div
                  className={cn(
                    "h-9 rounded-sm border px-3 py-2 text-sm",
                    isPosted
                      ? "border-[#9ec99e] bg-[#f1fbf1] text-[#2d7a2d]"
                      : "border-accent bg-[#fff8de] text-accent-foreground",
                  )}
                >
                  {isPosted ? "Проведен" : "Черновик"}
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.15fr_300px] xl:items-center">
              <div className="grid gap-2 md:grid-cols-[110px_1fr] md:items-center">
                <div className="text-sm">{tf("counterparty")}:</div>
                <ReferenceSelector
                  value={formData.counterparty as number}
                  onSelect={(value) =>
                    setFormData((current) => ({ ...current, counterparty: value as number }))
                  }
                  apiEndpoint="/directories/counterparties/"
                  placeholder="Выберите контрагента"
                  disabled={!canEdit}
                  className="h-9 rounded-sm border-border bg-background"
                />
              </div>

              <div className="rounded-sm border border-border bg-muted/30 px-3 py-2 text-sm">
                {normalizedDirection === "Покупатель" ? "Покупатели" : normalizedDirection}
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[90px_280px_70px_280px_70px_1fr] xl:items-center">
              <div className="text-sm">{currentCurrencyCode}</div>
              <Input
                type="number"
                value={String(formData.amount ?? 0)}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    amount: Number.parseFloat(event.target.value) || 0,
                  }))
                }
                disabled={!canEdit}
                className="h-9 rounded-sm border-border bg-background text-right font-mono"
              />
              <div className="text-sm">Всего:</div>
              <Input
                value={totalAmount.toFixed(2)}
                readOnly
                className="h-9 rounded-sm border-border bg-muted/30 text-right font-mono"
              />
              <div className="text-sm">Курс:</div>
              <Input
                value={rateValue}
                onChange={(event) => setRateValue(event.target.value)}
                className="h-9 rounded-sm border-border bg-background text-right font-mono"
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-[110px_1fr_90px_200px] xl:items-center">
              <div className="text-sm">Валюта:</div>
              <select
                value={effectiveCurrencyId || ""}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    currency: Number(event.target.value) || undefined,
                  }))
                }
                disabled={!canEdit}
                className="h-9 rounded-sm border border-border bg-background px-3 text-sm outline-none"
              >
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.id}>
                    {currency.code}
                  </option>
                ))}
              </select>
              <div className="text-sm">Основание:</div>
              <Input
                value={formData.basis || ""}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, basis: event.target.value }))
                }
                disabled={!canEdit}
                className="h-9 rounded-sm border-border bg-background"
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-[110px_1fr_120px_1fr] xl:items-center">
              <div className="text-sm">Примечание:</div>
              <Input
                value={formData.purpose || ""}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, purpose: event.target.value }))
                }
                disabled={!canEdit}
                className="h-9 rounded-sm border-border bg-background"
              />
              <div className="text-sm">Организация:</div>
              <Input
                value={DEFAULT_DEPARTMENT}
                readOnly
                className="h-9 rounded-sm border-border bg-muted/30"
              />
            </div>

            <div className="grid gap-3 border-t border-[#e5e7eb] pt-3 xl:grid-cols-[110px_1fr_130px_1fr] xl:items-center">
              <div className="text-sm">Создатель:</div>
              <Input
                value="Admin"
                readOnly
                className="h-9 rounded-sm border-border bg-muted/30"
              />
              <div className="text-sm">Подразделение:</div>
              <Input
                value={DEFAULT_DEPARTMENT}
                readOnly
                className="h-9 rounded-sm border-border bg-muted/30"
              />
            </div>
          </div>
        ) : (
          <div className="min-h-[420px] p-6">
            {initialData?.id ? (
              <DocumentPostings documentId={initialData.id} endpoint="cash-orders" />
            ) : (
              <div className="rounded-sm border border-border bg-card p-6 text-center text-sm text-muted-foreground">
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
