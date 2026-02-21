"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PiArrowClockwiseBold,
  PiArrowDownLeftBold,
  PiArrowLeftBold,
  PiArrowRightBold,
  PiCalendarBlankBold,
  PiCheckCircleBold,
  PiClockCounterClockwiseBold,
  PiEyeBold,
  PiMinusBold,
  PiPencilBold,
  PiPlusBold,
  PiTrashBold,
  PiXBold,
  PiXCircleBold,
} from "react-icons/pi";

import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { mapApiError } from "@/lib/error-mapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReferenceSelector } from "@/components/ui/reference-selector";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type {
  CashOrder,
  CashOrderType,
  Currency,
  PaginatedResponse,
} from "@/types";

const DEFAULT_CASH_DESK = "Main Cash Desk";

type CashOrderListResponse = PaginatedResponse<CashOrder> | CashOrder[];

interface QuickCreateResult {
  created: CashOrder;
  posted: boolean;
  postError?: unknown;
}

type CurrencyListResponse =
  | PaginatedResponse<Currency>
  | Currency[]
  | {
      results?: Currency[];
      data?: Currency[];
      items?: Currency[];
    };

type CurrencyOption = {
  id: number;
  code: string;
  name: string;
  is_base: boolean;
};

function normalizeDate(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function normalizeCurrenciesResponse(response: CurrencyListResponse | undefined): Currency[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  const candidate = response as {
    results?: Currency[];
    data?: Currency[];
    items?: Currency[];
  };
  if (Array.isArray(candidate.results)) return candidate.results;
  if (Array.isArray(candidate.data)) return candidate.data;
  if (Array.isArray(candidate.items)) return candidate.items;
  return [];
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : null;
}

function signedAmount(doc: CashOrder): number {
  return doc.order_type === "incoming"
    ? toNumber(doc.amount)
    : -toNumber(doc.amount);
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

async function fetchAllCashOrders(): Promise<CashOrder[]> {
  const all: CashOrder[] = [];
  let page = 1;
  let hasNext = true;
  const maxPages = 100;

  while (hasNext && page <= maxPages) {
    const response = await api.get<CashOrderListResponse>(
      `/documents/cash-orders/?page=${page}`,
    );

    if (Array.isArray(response)) {
      all.push(...response);
      break;
    }

    all.push(...(response.results || []));
    hasNext = Boolean(response.next);
    page += 1;
  }

  return all;
}

export default function CashOrdersPage() {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const tf = useTranslations("fields");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("main");
  const [workDate, setWorkDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [cashDesk, setCashDesk] = useState(DEFAULT_CASH_DESK);
  const [direction, setDirection] = useState<CashOrderType>("incoming");
  const [counterpartyId, setCounterpartyId] = useState<number | null>(null);
  const [counterpartyName, setCounterpartyName] = useState("");
  const [basis, setBasis] = useState("");
  const [purpose, setPurpose] = useState("");
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [amountInput, setAmountInput] = useState("0");
  const [rateInput, setRateInput] = useState("1");
  const [historySearch, setHistorySearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<CashOrder | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const amount = useMemo(
    () => Number.parseFloat(amountInput.replace(",", ".")) || 0,
    [amountInput],
  );
  const rate = useMemo(() => {
    const parsed = Number.parseFloat(rateInput.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
    return parsed;
  }, [rateInput]);
  const totalInBase = amount * rate;

  const { data: documents = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["cash-orders"],
    queryFn: fetchAllCashOrders,
  });

  const {
    data: currenciesResponse,
    isError: isCurrenciesError,
    refetch: refetchCurrencies,
  } = useQuery<CurrencyListResponse>({
    queryKey: ["cash-orders-workspace-currencies"],
    queryFn: () => api.get<CurrencyListResponse>("/directories/currencies/"),
  });
  const currencies = useMemo(
    () => normalizeCurrenciesResponse(currenciesResponse),
    [currenciesResponse],
  );

  const currencyOptions = useMemo<CurrencyOption[]>(() => {
    const byId = new Map<number, CurrencyOption>();

    for (const currency of currencies) {
      const id = toPositiveInt(currency.id);
      if (!id) continue;

      const code = String(currency.code || "").trim();
      const name = String(currency.name || "").trim();
      byId.set(id, {
        id,
        code: code || `CUR-${id}`,
        name: name || code || `Валюта #${id}`,
        is_base: Boolean(currency.is_base),
      });
    }

    // Fallback: if currencies directory is temporarily unavailable, keep selector usable
    // using currency ids/codes from already loaded cash orders.
    for (const doc of documents) {
      const id = toPositiveInt(doc.currency);
      if (!id || byId.has(id)) continue;
      const code = String(doc.currency_code || "").trim();
      byId.set(id, {
        id,
        code: code || `CUR-${id}`,
        name: code || `Валюта #${id}`,
        is_base: false,
      });
    }

    return Array.from(byId.values()).sort((left, right) =>
      left.code.localeCompare(right.code),
    );
  }, [currencies, documents]);

  const defaultCurrencyId = useMemo(() => {
    if (currencyOptions.length === 0) return null;
    const preferred =
      currencyOptions.find((currency) => currency.is_base) || currencyOptions[0];
    return preferred.id;
  }, [currencyOptions]);
  const effectiveCurrencyId = currencyId ?? defaultCurrencyId;

  const selectedCurrency = useMemo(
    () =>
      currencyOptions.find((currency) => currency.id === effectiveCurrencyId) || null,
    [currencyOptions, effectiveCurrencyId],
  );

  const baseCurrency = useMemo(() => {
    if (currencyOptions.length === 0) return null;
    return currencyOptions.find((currency) => currency.is_base) || currencyOptions[0];
  }, [currencyOptions]);

  const selectedCashDesk = useMemo(() => {
    const trimmed = cashDesk.trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_CASH_DESK;
  }, [cashDesk]);

  const cashDesks = useMemo(() => {
    const deskSet = new Set<string>();

    for (const doc of documents) {
      const name = doc.cash_desk?.trim();
      if (name) deskSet.add(name);
    }

    if (selectedCashDesk) deskSet.add(selectedCashDesk);
    if (deskSet.size === 0) deskSet.add(DEFAULT_CASH_DESK);
    return Array.from(deskSet).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [documents, selectedCashDesk]);

  const postedByScope = useMemo(
    () =>
      documents.filter((doc) => {
        if (doc.status !== "posted") return false;
        if (normalizeDate(doc.date) > workDate) return false;
        if ((doc.cash_desk?.trim() || DEFAULT_CASH_DESK) !== selectedCashDesk) {
          return false;
        }
        if (
          effectiveCurrencyId !== null &&
          toPositiveInt(doc.currency) !== effectiveCurrencyId
        ) {
          return false;
        }
        return true;
      }),
    [documents, workDate, selectedCashDesk, effectiveCurrencyId],
  );

  const openingBalance = useMemo(
    () =>
      postedByScope
        .filter((doc) => normalizeDate(doc.date) < workDate)
        .reduce((sum, doc) => sum + signedAmount(doc), 0),
    [postedByScope, workDate],
  );

  const incomingTotal = useMemo(
    () =>
      postedByScope
        .filter(
          (doc) =>
            normalizeDate(doc.date) === workDate && doc.order_type === "incoming",
        )
        .reduce((sum, doc) => sum + toNumber(doc.amount), 0),
    [postedByScope, workDate],
  );

  const outgoingTotal = useMemo(
    () =>
      postedByScope
        .filter(
          (doc) =>
            normalizeDate(doc.date) === workDate && doc.order_type === "outgoing",
        )
        .reduce((sum, doc) => sum + toNumber(doc.amount), 0),
    [postedByScope, workDate],
  );

  const closingBalance = openingBalance + incomingTotal - outgoingTotal;

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return [...documents]
      .sort((left, right) => {
        const leftDate = normalizeDate(left.date);
        const rightDate = normalizeDate(right.date);
        if (leftDate !== rightDate) return leftDate < rightDate ? 1 : -1;
        return right.id - left.id;
      })
      .filter((doc) => {
        if (!query) return true;
        return [
          doc.number,
          doc.counterparty_name,
          doc.purpose,
          doc.cash_desk,
          doc.currency_code,
        ].some((value) => String(value || "").toLowerCase().includes(query));
      });
  }, [documents, historySearch]);

  const postMutation = useMutation({
    mutationFn: async (id: number) =>
      api.post<CashOrder>(`/documents/cash-orders/${id}/post_document/`),
    onSuccess: () => {
      toast.success(t("postedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["cash-orders"] });
    },
    onError: (error: unknown) => {
      const { title, description } = mapApiError(error);
      toast.error(title, { description });
    },
  });

  const unpostMutation = useMutation({
    mutationFn: async (id: number) =>
      api.post<CashOrder>(`/documents/cash-orders/${id}/unpost_document/`),
    onSuccess: () => {
      toast.success(tc("updatedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["cash-orders"] });
    },
    onError: (error: unknown) => {
      const { title, description } = mapApiError(error);
      toast.error(title, { description });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/documents/cash-orders/${id}/`),
    onSuccess: () => {
      toast.success(tc("deletedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["cash-orders"] });
      setSelectedItem(null);
      setIsDeleteOpen(false);
    },
    onError: (error: unknown) => {
      const { title, description } = mapApiError(error);
      toast.error(title, { description });
    },
  });

  const quickCreateMutation = useMutation({
    mutationFn: async (type: CashOrderType): Promise<QuickCreateResult> => {
      const payload = {
        date: workDate,
        order_type: type,
        counterparty: counterpartyId,
        counterparty_name: counterpartyName.trim(),
        amount,
        currency: effectiveCurrencyId,
        cash_desk: selectedCashDesk,
        basis: basis.trim(),
        purpose:
          purpose.trim() ||
          basis.trim() ||
          (type === "incoming"
            ? "Поступление наличных в кассу"
            : "Выдача наличных из кассы"),
      };

      const created = await api.post<CashOrder>("/documents/cash-orders/", payload);

      try {
        const posted = await api.post<CashOrder>(
          `/documents/cash-orders/${created.id}/post_document/`,
        );
        return { created: posted, posted: true };
      } catch (postError) {
        return { created, posted: false, postError };
      }
    },
    onSuccess: (result, type) => {
      queryClient.invalidateQueries({ queryKey: ["cash-orders"] });
      setSelectedItem(result.created);
      setActiveTab("history");
      setHistorySearch(result.created.number || "");

      if (result.posted) {
        toast.success(
          `${type === "incoming" ? t("cashOrders.actions.newPko") : t("cashOrders.actions.newRko")} ${
            result.created.number || ""
          }`,
        );
        return;
      }

      const { description } = mapApiError(result.postError);
      toast.warning("Документ создан, но не проведен", { description });
      router.push(`/documents/cash-orders/${result.created.id}/edit`);
    },
    onError: (error: unknown) => {
      const { title, description } = mapApiError(error);
      toast.error(title, { description });
    },
  });

  const validateQuickAction = (): boolean => {
    if (currencyOptions.length === 0) {
      toast.error("Валюты не настроены. Добавьте валюту в справочнике.");
      return false;
    }

    if (!effectiveCurrencyId) {
      toast.error("Выберите валюту.");
      return false;
    }

    if (amount <= 0) {
      toast.error("Сумма должна быть больше нуля.");
      return false;
    }

    if (!counterpartyId || !counterpartyName.trim()) {
      toast.error("Выберите контрагента.");
      return false;
    }

    return true;
  };

  const handleQuickAction = (type: CashOrderType) => {
    setDirection(type);
    if (!validateQuickAction()) return;
    quickCreateMutation.mutate(type);
  };

  const handleOpenCounterpartyHistory = () => {
    setActiveTab("history");
    if (counterpartyName.trim()) {
      setHistorySearch(counterpartyName.trim());
      toast.success("Открыта история операций выбранного контрагента.");
      return;
    }
    toast.info("Переключено на историю кассовых ордеров.");
  };

  const canEditDocument = (doc: CashOrder | null | undefined): boolean => {
    if (!doc) return false;
    if (typeof doc.can_edit === "boolean") return doc.can_edit;
    return doc.status === "draft";
  };

  const canPostDocument = (doc: CashOrder | null | undefined): boolean => {
    if (!doc) return false;
    if (typeof doc.can_post === "boolean") return doc.can_post;
    return doc.status === "draft";
  };

  const canUnpostDocument = (doc: CashOrder | null | undefined): boolean => {
    if (!doc) return false;
    if (typeof doc.can_unpost === "boolean") return doc.can_unpost;
    return doc.status === "posted";
  };

  const isBusy =
    quickCreateMutation.isPending ||
    postMutation.isPending ||
    unpostMutation.isPending ||
    deleteMutation.isPending;

  const fieldClass =
    "h-11 rounded-sm border-[#b8b8b8] bg-white text-[#1f2937] placeholder:text-[#7b8591]";
  const selectClass =
    "h-11 rounded-sm border border-[#b8b8b8] bg-white px-3 text-sm text-[#1f2937]";

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden bg-[#e6e7ea] p-4 text-[#1f2937] md:p-6">
      <div className="flex h-full flex-col rounded-md border border-[#acb0b7] bg-[#f4f5f7] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#bcc1c9] px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-sm border-[#9fa4ae] bg-white text-[#1f2937]"
              onClick={() => router.back()}
            >
              <PiArrowLeftBold className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-sm border-[#9fa4ae] bg-white text-[#1f2937]"
              onClick={() => router.forward()}
            >
              <PiArrowRightBold className="h-4 w-4" />
            </Button>
          </div>
          <h1 className="text-lg font-semibold text-[#1f2937] md:text-3xl">Рабочий стол КАССА</h1>
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-[#9fa4ae] bg-white text-[#1f2937]"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <PiArrowClockwiseBold className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Обновить
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col p-3 md:p-4"
        >
          <TabsList className="h-auto w-fit rounded-none border border-[#aeb4bd] bg-[#e8ebf0] p-0 text-[#1f2937]">
            <TabsTrigger
              value="main"
              className="rounded-none border-r border-[#aeb4bd] px-6 !text-[#4b5563] data-[state=active]:!bg-white data-[state=active]:!text-[#111827] data-[state=active]:font-semibold data-[state=active]:shadow-none"
            >
              Основной
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-none px-6 !text-[#4b5563] data-[state=active]:!bg-white data-[state=active]:!text-[#111827] data-[state=active]:font-semibold data-[state=active]:shadow-none"
            >
              История
            </TabsTrigger>
          </TabsList>

          <TabsContent value="main" className="mt-3 min-h-0 flex-1 overflow-auto">
            <div className="space-y-3 rounded-sm border border-[#b8bec8] bg-white p-3 text-[#1f2937] md:p-4">
              <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                <div className="relative">
                  <PiCalendarBlankBold className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={workDate}
                    onChange={(event) => setWorkDate(event.target.value)}
                    className={cn(fieldClass, "pl-10")}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    value={cashDesk}
                    onChange={(event) => setCashDesk(event.target.value)}
                    list="cash-desk-options"
                    placeholder="Касса"
                    className={fieldClass}
                  />
                  <datalist id="cash-desk-options">
                    {cashDesks.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                <div className="text-sm text-[#4a4a4a]">Направление:</div>
                <select
                  className={selectClass}
                  value={direction}
                  onChange={(event) => setDirection(event.target.value as CashOrderType)}
                >
                  <option value="incoming">{tf("incoming")}</option>
                  <option value="outgoing">{tf("outgoing")}</option>
                </select>
              </div>

              <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                <div className="text-sm text-[#4a4a4a]">Контрагент:</div>
                <div className="flex items-end gap-2">
                  <ReferenceSelector
                    value={counterpartyId}
                    onSelect={(value, item) => {
                      setCounterpartyId((value as number | null) || null);
                      const name = typeof item?.name === "string" ? item.name : "";
                      setCounterpartyName(name);
                    }}
                    apiEndpoint="/directories/counterparties/"
                    label=""
                    placeholder="Выберите контрагента"
                    className="w-full [&_button]:h-11 [&_button]:rounded-sm [&_button]:justify-start [&_button]:!border-[#d0d5dd] [&_button]:!bg-white [&_button]:!text-[#111827] [&_button_svg]:!text-[#6b7280]"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-sm border-[#b8b8b8] bg-white text-[#1f2937]"
                    onClick={() => {
                      setCounterpartyId(null);
                      setCounterpartyName("");
                    }}
                    disabled={isBusy}
                  >
                    <PiXBold className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                <div className="text-sm text-[#4a4a4a]">Основание:</div>
                <Input
                  value={basis}
                  onChange={(event) => setBasis(event.target.value)}
                  placeholder="Основание документа"
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                <div className="text-sm text-[#4a4a4a]">Назначение:</div>
                <Input
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  placeholder="Назначение платежа"
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[100px_1fr_180px]">
                <select
                  className={selectClass}
                  value={effectiveCurrencyId ? String(effectiveCurrencyId) : ""}
                  onChange={(event) => setCurrencyId(toPositiveInt(event.target.value))}
                  disabled={currencyOptions.length === 0}
                >
                  {currencyOptions.length === 0 ? (
                    <option value="">Нет валют</option>
                  ) : (
                    currencyOptions.map((currency) => (
                      <option key={currency.id} value={String(currency.id)}>
                        {currency.code || currency.name || `Валюта #${currency.id}`}
                      </option>
                    ))
                  )}
                </select>

                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  className={cn(fieldClass, "text-right font-mono text-xl")}
                />

                <Button
                  variant="outline"
                  className="h-11 rounded-sm border-[#b8b8b8] bg-white text-[#1f2937]"
                  onClick={handleOpenCounterpartyHistory}
                >
                  Акт сверка
                </Button>
              </div>
              {isCurrenciesError ? (
                <div className="flex items-center gap-2 text-xs text-amber-700">
                  <span>Не удалось загрузить справочник валют.</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-amber-800"
                    onClick={() => refetchCurrencies()}
                  >
                    Повторить
                  </Button>
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="grid gap-2 md:grid-cols-[120px_1fr] md:items-center">
                  <div className="text-sm text-[#4a4a4a]">Всего:</div>
                  <Input
                    value={`${formatAmount(totalInBase)} ${
                      baseCurrency?.code || selectedCurrency?.code || ""
                    }`}
                    readOnly
                    className={cn(fieldClass, "text-right font-mono text-xl")}
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-[70px_1fr] md:items-center">
                  <div className="text-sm text-[#4a4a4a]">Курс:</div>
                  <Input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={rateInput}
                    onChange={(event) => setRateInput(event.target.value)}
                    className={cn(fieldClass, "text-right font-mono text-xl")}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleQuickAction("incoming")}
                  disabled={isBusy || quickCreateMutation.isPending}
                  className={cn(
                    "group rounded-sm border border-[#c0c0c0] bg-[#f5f5f5] p-4 transition-colors",
                    direction === "incoming" && "border-[#61bb56] bg-[#eef9ee]",
                    (isBusy || quickCreateMutation.isPending) && "cursor-not-allowed opacity-70",
                  )}
                >
                  <div className="mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-full border-[10px] border-[#36b440] bg-[radial-gradient(circle_at_30%_25%,#c8ffba_0%,#78e76e_45%,#52cf49_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
                    <PiPlusBold className="h-24 w-24 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]" />
                  </div>
                  <div className="mt-3 text-center text-base font-semibold text-[#1b6a1f]">
                    {t("cashOrders.actions.newPko")}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickAction("outgoing")}
                  disabled={isBusy || quickCreateMutation.isPending}
                  className={cn(
                    "group rounded-sm border border-[#c0c0c0] bg-[#f5f5f5] p-4 transition-colors",
                    direction === "outgoing" && "border-[#d56a6a] bg-[#fff1f1]",
                    (isBusy || quickCreateMutation.isPending) && "cursor-not-allowed opacity-70",
                  )}
                >
                  <div className="mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-full border-[10px] border-[#b84545] bg-[radial-gradient(circle_at_30%_25%,#ffd0d0_0%,#f38c8c_45%,#df6262_100%)] shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
                    <PiMinusBold className="h-24 w-24 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]" />
                  </div>
                  <div className="mt-3 text-center text-base font-semibold text-[#8f2222]">
                    {t("cashOrders.actions.newRko")}
                  </div>
                </button>
              </div>

              <div className="rounded-sm border border-[#c8c8c8] bg-[#f9f9f9] p-3 text-[#0d5567]">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <span>Начало остатка:</span>
                  <span className="font-mono text-lg">{formatAmount(openingBalance)}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <span className="flex items-center gap-2">
                    <PiArrowDownLeftBold className="h-4 w-4 text-[#2b9a45]" />
                    Приход:
                  </span>
                  <span className="font-mono text-lg text-[#2b9a45]">
                    +{formatAmount(incomingTotal)}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <span className="flex items-center gap-2">
                    <PiMinusBold className="h-4 w-4 text-[#b23b3b]" />
                    Расход:
                  </span>
                  <span className="font-mono text-lg text-[#b23b3b]">
                    -{formatAmount(outgoingTotal)}
                  </span>
                </div>
                <div className="grid gap-2 border-t border-[#d6d6d6] pt-2 sm:grid-cols-[1fr_auto]">
                  <span className="font-semibold">Конец остатка:</span>
                  <span className="font-mono text-lg font-semibold">
                    {formatAmount(closingBalance)} {selectedCurrency?.code || ""}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-3 min-h-0 flex-1 overflow-auto">
            <div className="space-y-3 rounded-sm border border-[#b8bec8] bg-white p-3 text-[#1f2937] md:p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <Input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder={tc("searchNumberCounterparty")}
                  className="h-10 rounded-sm border-[#b8b8b8] bg-white text-[#1f2937] placeholder:text-[#7b8591] md:max-w-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-sm border-[#b8b8b8] bg-white text-[#1f2937]"
                    onClick={() => refetch()}
                    disabled={isFetching}
                  >
                    <PiArrowClockwiseBold
                      className={cn("h-4 w-4", isFetching && "animate-spin")}
                    />
                    {tc("refresh")}
                  </Button>
                  {selectedItem ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-sm border-[#b8b8b8] bg-white text-[#1f2937]"
                        onClick={() => router.push(`/documents/cash-orders/${selectedItem.id}`)}
                      >
                        <PiEyeBold className="h-4 w-4" />
                        {tc("view")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-sm border-[#b8b8b8] bg-white text-[#1f2937]"
                        onClick={() => router.push(`/documents/cash-orders/${selectedItem.id}/edit`)}
                        disabled={!canEditDocument(selectedItem)}
                      >
                        <PiPencilBold className="h-4 w-4" />
                        {tc("edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-sm border-[#b8b8b8] bg-white text-[#1f2937]"
                        onClick={() => postMutation.mutate(selectedItem.id)}
                        disabled={!canPostDocument(selectedItem) || postMutation.isPending}
                      >
                        <PiCheckCircleBold className="h-4 w-4" />
                        {t("post")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-sm border-[#b8b8b8] bg-white text-[#1f2937]"
                        onClick={() => unpostMutation.mutate(selectedItem.id)}
                        disabled={!canUnpostDocument(selectedItem) || unpostMutation.isPending}
                      >
                        <PiXCircleBold className="h-4 w-4" />
                        {t("unpost")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-10 rounded-sm"
                        onClick={() => setIsDeleteOpen(true)}
                        disabled={!canEditDocument(selectedItem)}
                      >
                        <PiTrashBold className="h-4 w-4" />
                        {tc("delete")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="overflow-x-auto rounded-sm border border-[#b8b8b8]">
                <table className="w-full min-w-[960px] border-collapse text-sm text-[#1f2937]">
                  <thead className="bg-[#ededed] text-left">
                    <tr className="[&>th]:border-b [&>th]:border-r [&>th]:border-[#d0d0d0] [&>th]:px-3 [&>th]:py-2 [&>th:last-child]:border-r-0">
                      <th>{tc("date")}</th>
                      <th>{tc("number")}</th>
                      <th>{tf("type")}</th>
                      <th>{tf("counterparty")}</th>
                      <th>{tc("amount")}</th>
                      <th>{tf("description")}</th>
                      <th>{tc("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                          Загрузка...
                        </td>
                      </tr>
                    ) : filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                          {tc("noData")}
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((doc) => {
                        const isIncoming = doc.order_type === "incoming";
                        const isSelected = selectedItem?.id === doc.id;
                        return (
                          <tr
                            key={doc.id}
                            onClick={() => setSelectedItem(doc)}
                            onDoubleClick={() =>
                              router.push(
                                canEditDocument(doc)
                                  ? `/documents/cash-orders/${doc.id}/edit`
                                  : `/documents/cash-orders/${doc.id}`,
                              )
                            }
                            className={cn(
                              "cursor-pointer border-b border-[#ececec] hover:bg-[#f7f7f7]",
                              isSelected && "bg-[#eef4ff]",
                            )}
                          >
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                              {new Date(normalizeDate(doc.date)).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2 font-mono font-semibold text-primary">
                              {doc.number}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-sm",
                                  isIncoming
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                    : "border-amber-300 bg-amber-50 text-amber-700",
                                )}
                              >
                                {isIncoming ? tf("incoming") : tf("outgoing")}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">{doc.counterparty_name}</td>
                            <td
                              className={cn(
                                "px-3 py-2 text-right font-mono font-semibold",
                                isIncoming ? "text-emerald-700" : "text-rose-700",
                              )}
                            >
                              {isIncoming ? "+" : "-"}
                              {formatAmount(toNumber(doc.amount))} {doc.currency_code || ""}
                            </td>
                            <td className="max-w-[340px] truncate px-3 py-2" title={doc.purpose}>
                              {doc.purpose}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-sm",
                                  doc.status === "posted" &&
                                    "border-emerald-300 bg-emerald-50 text-emerald-700",
                                  doc.status === "draft" &&
                                    "border-slate-300 bg-slate-50 text-slate-700",
                                  doc.status === "cancelled" &&
                                    "border-rose-300 bg-rose-50 text-rose-700",
                                )}
                              >
                                {t(doc.status)}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between rounded-sm border border-[#d6d6d6] bg-[#fafafa] px-3 py-2 text-sm text-muted-foreground">
                <span>
                  {tc("entries")}: {filteredHistory.length}
                </span>
                <span className="flex items-center gap-2">
                  <PiClockCounterClockwiseBold className="h-4 w-4" />
                  Касса: {selectedCashDesk}
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cashOrders.alerts.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich("cashOrders.alerts.deleteConfirmation", {
                number: selectedItem?.number || "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? tc("deleting") : tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
