"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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

type HistoryScope = "day" | "week" | "month" | "all";

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

function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getHistoryBounds(anchorDate: string, scope: HistoryScope): {
  start: string | null;
  end: string | null;
} {
  if (!anchorDate) {
    return { start: null, end: null };
  }

  if (scope === "all") {
    return { start: null, end: null };
  }

  if (scope === "day") {
    return { start: anchorDate, end: anchorDate };
  }

  if (scope === "month") {
    const monthStart = parseIsoDate(`${anchorDate.slice(0, 7)}-01`);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    return {
      start: toIsoDate(monthStart),
      end: toIsoDate(monthEnd),
    };
  }

  const current = parseIsoDate(anchorDate);
  const dayOfWeek = (current.getDay() + 6) % 7;
  const weekStart = new Date(current);
  weekStart.setDate(current.getDate() - dayOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    start: toIsoDate(weekStart),
    end: toIsoDate(weekEnd),
  };
}

function formatHistoryDateTime(value?: string | null): string {
  if (!value) return "-";

  const hasTime = value.length > 10;
  const parsed = new Date(hasTime ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(hasTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }
      : {}),
  });
}

function getCashOrderDocumentTypeLabel(doc: CashOrder): string {
  return doc.order_type === "incoming"
    ? "Приходный кассовый ордер"
    : "Расходный кассовый ордер";
}

function getCashOrderDirectionLabel(doc: CashOrder): string {
  const paymentKind = (doc as CashOrder & {
    payment_kind?: "supplier" | "salary" | "tax" | "other";
  }).payment_kind;

  switch (paymentKind) {
    case "supplier":
      return "Поставщик";
    case "salary":
      return "Зарплата";
    case "tax":
      return "Налоги";
    default:
      return doc.order_type === "incoming" ? "Покупатель" : "Прочие";
  }
}

function getHistoryScopeLabel(scope: HistoryScope): string {
  switch (scope) {
    case "day":
      return "Сегодня";
    case "week":
      return "Эта неделя";
    case "month":
      return "Этот месяц";
    default:
      return "Все документы";
  }
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
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const localePath = (path: string) =>
    `/${locale}${path.startsWith("/") ? path : `/${path}`}`;

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
  const [historyScope, setHistoryScope] = useState<HistoryScope>("week");
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
    const bounds = getHistoryBounds(workDate, historyScope);

    return [...documents]
      .sort((left, right) => {
        const leftTime = Date.parse(left.date || "");
        const rightTime = Date.parse(right.date || "");
        if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
          return rightTime - leftTime;
        }
        const leftDate = normalizeDate(left.date);
        const rightDate = normalizeDate(right.date);
        if (leftDate !== rightDate) return leftDate < rightDate ? 1 : -1;
        return right.id - left.id;
      })
      .filter((doc) => {
        const docCashDesk = doc.cash_desk?.trim() || DEFAULT_CASH_DESK;
        if (docCashDesk !== selectedCashDesk) {
          return false;
        }

        const docDate = normalizeDate(doc.date);
        if (bounds.start && docDate < bounds.start) {
          return false;
        }
        if (bounds.end && docDate > bounds.end) {
          return false;
        }

        if (!query) return true;
        return [
          doc.number,
          doc.counterparty_name,
          doc.basis,
          doc.purpose,
          doc.cash_desk,
          doc.currency_code,
          getCashOrderDocumentTypeLabel(doc),
          getCashOrderDirectionLabel(doc),
        ].some((value) => String(value || "").toLowerCase().includes(query));
      });
  }, [documents, historyScope, historySearch, selectedCashDesk, workDate]);

  const activeHistorySelection = useMemo(() => {
    if (filteredHistory.length === 0) return null;
    if (!selectedItem) return filteredHistory[0];
    return filteredHistory.find((doc) => doc.id === selectedItem.id) || filteredHistory[0];
  }, [filteredHistory, selectedItem]);

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
      router.push(localePath(`/documents/cash-orders/${result.created.id}/edit`));
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
    setHistoryScope("all");
    if (counterpartyName.trim()) {
      setHistorySearch(counterpartyName.trim());
      toast.success("Открыта история операций выбранного контрагента.");
      return;
    }
    toast.info("Переключено на историю кассовых ордеров.");
  };

  const openCashOrderDocument = (doc: CashOrder) => {
    router.push(localePath(`/documents/cash-orders/${doc.id}/edit`));
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
    "h-11 rounded-sm border-border bg-background text-foreground placeholder:text-muted-foreground";
  const selectClass =
    "h-11 rounded-sm border border-border bg-background px-3 text-sm text-foreground";

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden bg-background p-4 text-foreground md:p-6">
      <div className="flex h-full flex-col rounded-md border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-sm border-border bg-background text-foreground"
              onClick={() => router.back()}
            >
              <PiArrowLeftBold className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-sm border-border bg-background text-foreground"
              onClick={() => router.forward()}
            >
              <PiArrowRightBold className="h-4 w-4" />
            </Button>
          </div>
          <h1 className="text-lg font-semibold text-foreground md:text-3xl">Рабочий стол КАССА</h1>
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-border bg-background text-foreground"
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
          <TabsList className="h-auto w-fit rounded-none border border-border bg-muted p-0 text-foreground">
            <TabsTrigger
              value="main"
              className="rounded-none border-r border-border px-6 !text-muted-foreground data-[state=active]:!bg-background data-[state=active]:!text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none"
            >
              Основной
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-none px-6 !text-muted-foreground data-[state=active]:!bg-background data-[state=active]:!text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none"
            >
              История
            </TabsTrigger>
          </TabsList>

          <TabsContent value="main" className="mt-3 min-h-0 flex-1 overflow-auto">
            <div className="space-y-3 rounded-sm border border-border bg-background p-3 text-foreground md:p-4">
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
                <div className="text-sm text-muted-foreground">Направление:</div>
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
                <div className="text-sm text-muted-foreground">Контрагент:</div>
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
                    className="w-full [&_button]:h-11 [&_button]:rounded-sm [&_button]:justify-start [&_button]:!border-border [&_button]:!bg-background [&_button]:!text-foreground [&_button_svg]:!text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-sm border-border bg-background text-foreground"
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
                <div className="text-sm text-muted-foreground">Основание:</div>
                <Input
                  value={basis}
                  onChange={(event) => setBasis(event.target.value)}
                  placeholder="Основание документа"
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                <div className="text-sm text-muted-foreground">Назначение:</div>
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
                  className="h-11 rounded-sm border-border bg-background text-foreground"
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
                  <div className="text-sm text-muted-foreground">Всего:</div>
                  <Input
                    value={`${formatAmount(totalInBase)} ${
                      baseCurrency?.code || selectedCurrency?.code || ""
                    }`}
                    readOnly
                    className={cn(fieldClass, "text-right font-mono text-xl")}
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-[70px_1fr] md:items-center">
                  <div className="text-sm text-muted-foreground">Курс:</div>
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
                    "group rounded-sm border border-border bg-muted/50 p-4 transition-colors",
                    direction === "incoming" && "border-[#61bb56] bg-emerald-50 dark:bg-emerald-950",
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
                    "group rounded-sm border border-border bg-muted/50 p-4 transition-colors",
                    direction === "outgoing" && "border-[#d56a6a] bg-rose-50 dark:bg-rose-950",
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

              <div className="rounded-sm border border-border bg-card p-3 text-foreground">
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
                <div className="grid gap-2 border-t border-border pt-2 sm:grid-cols-[1fr_auto]">
                  <span className="font-semibold">Конец остатка:</span>
                  <span className="font-mono text-lg font-semibold">
                    {formatAmount(closingBalance)} {selectedCurrency?.code || ""}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-3 min-h-0 flex-1 overflow-auto">
            <div className="space-y-3 rounded-sm border border-border bg-background p-3 text-foreground md:p-4">
              <div className="space-y-2">
                <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-sm border-border bg-background text-foreground"
                      onClick={() =>
                        router.push(localePath(`/documents/cash-orders/new?type=${direction}`))
                      }
                    >
                      <PiPlusBold className="h-4 w-4" />
                      Создать
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-sm border-border bg-background text-foreground"
                      onClick={() => refetch()}
                      disabled={isFetching}
                    >
                      <PiArrowClockwiseBold
                        className={cn("h-4 w-4", isFetching && "animate-spin")}
                      />
                      Обновить
                    </Button>
                    {([
                      ["day", "День"],
                      ["week", "Неделя"],
                      ["month", "Месяц"],
                      ["all", "Все"],
                    ] as Array<[HistoryScope, string]>).map(([scope, label]) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => setHistoryScope(scope)}
                        className={cn(
                          "h-8 rounded-sm border px-3 text-xs",
                          historyScope === scope
                            ? "border-accent bg-accent font-semibold text-accent-foreground"
                            : "border-border bg-background text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-8 items-center rounded-sm border border-accent bg-accent px-3 text-xs font-medium text-accent-foreground">
                      {getHistoryScopeLabel(historyScope)}
                    </span>
                    <Input
                      value={historySearch}
                      onChange={(event) => setHistorySearch(event.target.value)}
                      placeholder="Поиск (Ctrl+F)"
                      className="h-8 rounded-sm border-border bg-background text-foreground placeholder:text-muted-foreground md:w-[280px]"
                    />
                  </div>
                </div>

                {activeHistorySelection ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-sm border-border bg-background text-foreground"
                      onClick={() => openCashOrderDocument(activeHistorySelection)}
                    >
                      <PiEyeBold className="h-4 w-4" />
                      Открыть
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-sm border-border bg-background text-foreground"
                      onClick={() =>
                        router.push(
                          localePath(
                            `/documents/cash-orders/${activeHistorySelection.id}/edit`,
                          ),
                        )
                      }
                      disabled={!canEditDocument(activeHistorySelection)}
                    >
                      <PiPencilBold className="h-4 w-4" />
                      Изменить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-sm border-border bg-background text-foreground"
                      onClick={() => postMutation.mutate(activeHistorySelection.id)}
                      disabled={
                        !canPostDocument(activeHistorySelection) || postMutation.isPending
                      }
                    >
                      <PiCheckCircleBold className="h-4 w-4" />
                      Провести
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-sm border-border bg-background text-foreground"
                      onClick={() => unpostMutation.mutate(activeHistorySelection.id)}
                      disabled={
                        !canUnpostDocument(activeHistorySelection) || unpostMutation.isPending
                      }
                    >
                      <PiXCircleBold className="h-4 w-4" />
                      Отмена проведения
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 rounded-sm"
                      onClick={() => setIsDeleteOpen(true)}
                      disabled={!canEditDocument(activeHistorySelection)}
                    >
                      <PiTrashBold className="h-4 w-4" />
                      Удалить
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="overflow-auto rounded-sm border border-border">
                <table className="w-full min-w-[1480px] border-collapse text-sm text-foreground">
                  <thead className="bg-muted text-left">
                    <tr className="[&>th]:border-b [&>th]:border-r [&>th]:border-border [&>th]:px-3 [&>th]:py-2 [&>th:last-child]:border-r-0">
                      <th className="w-[34px] px-2" />
                      <th>Дата</th>
                      <th>Номер</th>
                      <th>Тип документа</th>
                      <th>Касса</th>
                      <th>Направление</th>
                      <th>Корреспондент</th>
                      <th>Основание</th>
                      <th>Вал.</th>
                      <th className="text-right">Приход</th>
                      <th className="text-right">Расход</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">
                          Загрузка...
                        </td>
                      </tr>
                    ) : filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">
                          Для выбранной кассы и периода записи не найдены.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((doc) => {
                        const isIncoming = doc.order_type === "incoming";
                        const isSelected = activeHistorySelection?.id === doc.id;
                        return (
                          <tr
                            key={doc.id}
                            onClick={() => setSelectedItem(doc)}
                            onDoubleClick={() => openCashOrderDocument(doc)}
                            className={cn(
                              "cursor-pointer border-b border-border hover:bg-muted",
                              isSelected && "bg-accent",
                            )}
                          >
                            <td
                              className={cn(
                                "w-[34px] px-2 py-2 text-center text-xs",
                                doc.status === "posted" && "text-[#5f9f5f]",
                                doc.status === "draft" && "text-[#9c8b4a]",
                                doc.status === "cancelled" && "text-[#b45b5b]",
                              )}
                            >
                              {doc.status === "posted"
                                ? "▣"
                                : doc.status === "cancelled"
                                  ? "×"
                                  : "▢"}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                              {formatHistoryDateTime(doc.date)}
                            </td>
                            <td className="px-3 py-2 font-mono font-semibold text-primary">
                              {doc.number || "-"}
                            </td>
                            <td className="max-w-[210px] truncate px-3 py-2" title={getCashOrderDocumentTypeLabel(doc)}>
                              {getCashOrderDocumentTypeLabel(doc)}
                            </td>
                            <td className="max-w-[150px] truncate px-3 py-2">
                              {doc.cash_desk || DEFAULT_CASH_DESK}
                            </td>
                            <td className="max-w-[130px] truncate px-3 py-2">
                              {getCashOrderDirectionLabel(doc)}
                            </td>
                            <td className="max-w-[220px] truncate px-3 py-2" title={doc.counterparty_name || ""}>
                              {doc.counterparty_name || "-"}
                            </td>
                            <td className="max-w-[320px] truncate px-3 py-2" title={doc.basis || doc.purpose || ""}>
                              {doc.basis || doc.purpose || "-"}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {doc.currency_code || selectedCurrency?.code || "-"}
                            </td>
                            <td
                              className={cn(
                                "px-3 py-2 text-right font-mono font-semibold",
                                isIncoming && "text-emerald-700",
                              )}
                            >
                              {isIncoming ? formatAmount(toNumber(doc.amount)) : ""}
                            </td>
                            <td
                              className={cn(
                                "px-3 py-2 text-right font-mono font-semibold",
                                !isIncoming && "text-rose-700",
                              )}
                            >
                              {!isIncoming ? formatAmount(toNumber(doc.amount)) : ""}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                <span>
                  Записей: {filteredHistory.length}
                  {activeHistorySelection
                    ? ` | Выбрано: ${activeHistorySelection.number || ""}`
                    : ""}
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
                number: activeHistorySelection?.number || selectedItem?.number || "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                activeHistorySelection && deleteMutation.mutate(activeHistorySelection.id)
              }
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
