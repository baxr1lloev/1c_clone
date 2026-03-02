"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useHotkeys } from "react-hotkeys-hook";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/data-table/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import api from "@/lib/api";
import { PaginatedResponse, SalesDocument, SalesDocumentLine } from "@/types";
import {
  PiFloppyDiskBold,
  PiCheckCircleBold,
  PiFilePlusBold,
  PiPrinterBold,
  PiXBold,
  PiPlusBold,
  PiTrashBold,
  PiClockCounterClockwiseBold,
  PiLockKeyBold,
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { mapApiError } from "@/lib/error-mapper";
import { PrintPreviewDialog } from "@/components/documents/print-preview-dialog";
import { useAppStore } from "@/stores/app-store";
import { UnitSelector } from "@/components/ui/unit-selector";
import { InterfaceModeToggle } from "@/components/interface-mode-toggle";
import { ReferenceLink } from "@/components/ui/reference-link";
import { ReferenceSelector } from "@/components/ui/reference-selector";
import { DocumentPostings } from "@/components/documents/document-postings";
import { LiveStockPanel } from "@/components/documents/live-stock-panel";
import { LiveSettlementPanel } from "@/components/documents/live-settlement-panel";
import { DocumentHistoryPanel } from "@/components/documents/document-history-panel";

interface SalesDocumentFormProps {
  mode: "create" | "edit";
  initialData?: SalesDocument;
}

interface CurrencyOption {
  id: number;
  code: string;
  name: string;
}

interface ExchangeRateOption {
  id: number;
  currency: number;
  date: string;
  rate: string | number;
}

type CurrencyListResponse =
  | PaginatedResponse<CurrencyOption>
  | CurrencyOption[];
type ExchangeRateListResponse =
  | PaginatedResponse<ExchangeRateOption>
  | ExchangeRateOption[];

function normalizeCurrenciesResponse(
  response: CurrencyListResponse,
): CurrencyOption[] {
  if (Array.isArray(response)) return response;
  return response?.results || [];
}

function normalizeExchangeRatesResponse(
  response: ExchangeRateListResponse,
): ExchangeRateOption[] {
  if (Array.isArray(response)) return response;
  return response?.results || [];
}

function toDateOnly(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function formatBaseQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

// Helper: Transform DB Line (Base) to UI Line (Package)
const toUiLine = (line: SalesDocumentLine): SalesDocumentLine => {
  const coef = Number(line.coefficient) || 1;
  return {
    ...line,
    quantity: Number(line.quantity) / coef, // Display Qty = Base / Coef
    price: Number(line.price) * coef, // Display Price = BasePrice * Coef
  };
};

// Helper: Transform UI Line (Package) to DB Line (Base)
const toDbLine = (line: SalesDocumentLine) => {
  const coef = Number(line.coefficient) || 1;
  return {
    item: line.item,
    quantity: (Number(line.quantity) || 0) * coef, // Base Qty = Display * Coef
    package: line.package ?? null,
    coefficient: coef,
    price: (Number(line.price) || 0) / coef, // Base Price = Display / Coef
    vat_rate: Number(line.vat_rate) || 0,
  };
};

export function SalesDocumentForm({
  initialData,
  mode,
}: SalesDocumentFormProps) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const tf = useTranslations("fields");
  const tsf = useTranslations("documents.salesForm");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [printOpen, setPrintOpen] = useState(false);
  const promptedRateKeysRef = useRef<Set<string>>(new Set());
  const initializedCurrencyRef = useRef(false);
  const [rateDialogState, setRateDialogState] = useState<{
    currencyCode: string;
    date: string;
  } | null>(null);
  const [rateDialogInput, setRateDialogInput] = useState("");
  const [rateDialogError, setRateDialogError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<SalesDocument>>(
    initialData || {
      date: new Date().toISOString(),
      status: "draft",
      lines: [],
      currency: undefined,
      exchange_rate: 1,
      contract: 1,
    },
  );
  const latestExchangeRateRef = useRef(formData.exchange_rate);

  useEffect(() => {
    latestExchangeRateRef.current = formData.exchange_rate;
  }, [formData.exchange_rate]);

  const { currentTenant } = useAppStore();
  const isPosted = initialData?.is_posted ?? initialData?.status === "posted";
  const canEdit =
    mode === "create" ? true : !isPosted && (initialData?.can_edit ?? true);
  const isPeriodClosed = initialData?.period_is_closed ?? false;

  // Lines State (UI Units)
  const [lines, setLines] = useState<SalesDocumentLine[]>(
    initialData?.lines?.map(toUiLine) || [],
  );

  const { data: currencies = [] } = useQuery<CurrencyOption[]>({
    queryKey: ["sales-form-currencies"],
    queryFn: async () => {
      const response = await api.get<CurrencyListResponse>(
        "/directories/currencies/",
      );
      return normalizeCurrenciesResponse(response);
    },
    initialData: [],
  });

  const currenciesById = useMemo(
    () => new Map(currencies.map((item) => [item.id, item])),
    [currencies],
  );
  const usdCurrency = useMemo(
    () =>
      currencies.find(
        (item) => String(item.code || "").toUpperCase() === "USD",
      ) || null,
    [currencies],
  );
  const usdCurrencyId = usdCurrency?.id || null;
  const selectedCurrency = formData.currency
    ? currenciesById.get(Number(formData.currency))
    : null;
  const selectedCurrencyCode = selectedCurrency?.code || "USD";
  const documentDate = useMemo(
    () => toDateOnly(formData.date),
    [formData.date],
  );

  useEffect(() => {
    if (initializedCurrencyRef.current || !usdCurrencyId) return;
    setFormData((prev) => {
      if (mode === "create") {
        return {
          ...prev,
          currency: usdCurrencyId,
          exchange_rate: 1,
        };
      }

      if (!prev.currency) {
        return {
          ...prev,
          currency: usdCurrencyId,
          exchange_rate: 1,
        };
      }

      return prev;
    });
    initializedCurrencyRef.current = true;
  }, [mode, usdCurrencyId]);

  useEffect(() => {
    const currencyId = Number(formData.currency || 0);
    if (!currencyId || !usdCurrencyId || !canEdit) return;

    if (currencyId === usdCurrencyId) {
      setRateDialogState(null);
      setRateDialogError(null);
      if (Number(latestExchangeRateRef.current || 0) !== 1) {
        setFormData((prev) => ({ ...prev, exchange_rate: 1 }));
      }
      return;
    }

    const promptKey = `${currencyId}:${documentDate}`;
    let isCancelled = false;

    const resolveRateForDate = async () => {
      const openRateDialog = () => {
        if (promptedRateKeysRef.current.has(promptKey)) return;
        promptedRateKeysRef.current.add(promptKey);
        setRateDialogInput(String(latestExchangeRateRef.current || ""));
        setRateDialogError(null);
        setRateDialogState({
          currencyCode: selectedCurrencyCode,
          date: documentDate,
        });
      };

      try {
        const response = await api.get<ExchangeRateListResponse>(
          "/directories/exchange-rates/",
          {
            params: {
              currency: currencyId,
              date: documentDate,
            },
          },
        );
        if (isCancelled) return;

        const rates = normalizeExchangeRatesResponse(response);
        const rateValue = Number(rates[0]?.rate || 0);
        if (Number.isFinite(rateValue) && rateValue > 0) {
          setFormData((prev) => ({ ...prev, exchange_rate: rateValue }));
          return;
        }

        openRateDialog();
      } catch {
        if (isCancelled) return;
        openRateDialog();
      }
    };

    resolveRateForDate();
    return () => {
      isCancelled = true;
    };
  }, [
    canEdit,
    documentDate,
    formData.currency,
    selectedCurrencyCode,
    usdCurrencyId,
  ]);

  // Dynamic Item Fetcher Hook
  const useItemDetails = (itemId: number) => {
    return useQuery({
      queryKey: ["item", itemId],
      queryFn: async () => {
        const res = await api.get(`/directories/items/${itemId}/`);
        return res;
      },
      enabled: !!itemId,
      staleTime: 1000 * 60 * 5, // Cache for 5 mins
    });
  };

  // Prepare Payload for Save/Post
  const preparePayload = () => {
    const dbLines = lines.map(toDbLine);
    return {
      ...formData,
      rate: formData.exchange_rate,
      lines: dbLines,
    };
  };

  const validateExchangeRateBeforeSave = (): boolean => {
    const currencyId = Number(formData.currency || 0);
    if (!currencyId) {
      toast.error(tsf("currencyRequired"));
      return false;
    }

    if (usdCurrencyId && currencyId === usdCurrencyId) {
      return true;
    }

    const rate = Number(formData.exchange_rate || 0);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error(tsf("rateRequiredToday"));
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (!validateExchangeRateBeforeSave()) return;
    saveMutation.mutate(preparePayload());
  };

  const handleRateDialogSave = () => {
    const parsedRate = Number(String(rateDialogInput).replace(",", "."));
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      setRateDialogError(tsf("rateRequiredToday"));
      return;
    }

    setFormData((prev) => ({ ...prev, exchange_rate: parsedRate }));
    setRateDialogState(null);
    setRateDialogError(null);
  };

  // Actions
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (mode === "create") return api.post("/documents/sales/", data);
      return api.put(`/documents/sales/${initialData!.id}/`, data);
    },
    onSuccess: () => {
      toast.success(tc("savedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["sales-documents"] });
      if (mode === "create") router.push("/documents/sales");
    },
    onError: (err) => {
      const { title, description } = mapApiError(err);
      toast.error(title, { description });
    },
  });

  const postMutation = useMutation({
    mutationFn: async () =>
      api.post(`/documents/sales/${initialData!.id}/post/`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["sales-documents"] });
      const previousData = queryClient.getQueryData(["sales-documents"]);
      setFormData({ ...formData, status: "posted" });
      toast.success(t("postedSuccessfully"));
      return { previousData };
    },
    onError: (err: any) => {
      setFormData({ ...formData, status: "draft" });
      const { title, description } = mapApiError(err);
      toast.error(title, { description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-documents"] });
      router.refresh();
    },
  });

  const unpostMutation = useMutation({
    mutationFn: async () =>
      api.post(`/documents/sales/${initialData!.id}/unpost/`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["sales-documents"] });
      setFormData({ ...formData, status: "draft" });
      toast.success(t("unpostedSuccessfully"));
    },
    onError: () => {
      setFormData({ ...formData, status: "posted" });
      toast.error(t("unpost_failed"));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-documents"] });
      router.refresh();
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async () =>
      api.post<{ id: number; url?: string }>(
        `/documents/sales/${initialData!.id}/create_on_basis/`,
        { target_type: "paymentdocument" },
      ),
    onSuccess: (response) => {
      toast.success("Payment document created");
      queryClient.invalidateQueries({ queryKey: ["sales-documents"] });
      if (response?.url) {
        router.push(response.url);
        return;
      }
      if (response?.id) {
        router.push(`/documents/payments/${response.id}`);
      }
    },
    onError: (err) => {
      const { title, description } = mapApiError(err);
      toast.error(title, { description });
    },
  });

  // Formatting Shortcuts
  useHotkeys(
    "ctrl+s",
    (e) => {
      e.preventDefault();
      if (!isPosted) {
        handleSave();
        toast.info(tsf("saving"));
      }
    },
    { enableOnFormTags: true },
    [formData, lines, isPosted, usdCurrencyId],
  );

  useHotkeys(
    "ctrl+enter, f9",
    (e) => {
      e.preventDefault();
      if (!isPosted && initialData?.id) {
        postMutation.mutate();
      }
    },
    { enableOnFormTags: true },
    [isPosted, initialData],
  );

  useHotkeys("esc", (e) => router.back(), { enableOnFormTags: true });

  // Actions
  const canCreatePayment = Boolean(
    mode === "edit" && initialData?.id && (initialData?.status === "posted" || initialData?.is_posted),
  );

  const actions: CommandBarAction[] = [
    ...(initialData?.can_post
      ? [
          {
            label: t("post"),
            icon: <PiCheckCircleBold />,
            onClick: () => postMutation.mutate(),
            disabled: mode === "create",
            shortcut: "F9",
            variant: "default" as const,
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            label: tc("save"),
            icon: <PiFloppyDiskBold />,
            onClick: () => handleSave(),
            shortcut: "Ctrl+S",
            variant: "secondary" as const,
          },
        ]
      : []),
    ...(initialData?.can_unpost
      ? [
          {
            label: t("unpost"),
            icon: <PiXBold />,
            onClick: () => unpostMutation.mutate(),
            variant: "destructive" as const,
          },
        ]
      : []),
    ...(canCreatePayment
      ? [
          {
            label: "Create Payment",
            icon: <PiFilePlusBold />,
            onClick: () => createPaymentMutation.mutate(),
            disabled: createPaymentMutation.isPending,
            variant: "default" as const,
          },
        ]
      : []),
    {
      label: tc("print"),
      icon: <PiPrinterBold />,
      onClick: () => setPrintOpen(true),
      variant: "ghost" as const,
    },
  ];

  // Totals
  const totals = useMemo(() => {
    const totalAmount = lines.reduce(
      (sum, line) => sum + (Number(line.amount) || 0),
      0,
    );
    const tax = lines.reduce(
      (sum, line) => sum + (Number(line.vat_amount) || 0),
      0,
    );
    const exchangeRate = Number(formData.exchange_rate) || 1;
    const grandTotal = totalAmount + tax;
    const isUsdCurrency = usdCurrencyId
      ? Number(formData.currency) === usdCurrencyId
      : true;
    const grandTotalUsd = isUsdCurrency
      ? grandTotal
      : grandTotal / exchangeRate;

    return {
      total: totalAmount,
      tax: tax,
      grandTotal: grandTotal,
      grandTotalUsd: Number.isFinite(grandTotalUsd) ? grandTotalUsd : 0,
    };
  }, [formData.currency, formData.exchange_rate, lines, usdCurrencyId]);

  const [activeCell, setActiveCell] = useState<{
    row: number;
    col: string;
  } | null>(null);

  // Helper: Recalculate Line Totals
  const recalculateLine = (line: SalesDocumentLine): SalesDocumentLine => {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.price) || 0;
    const rate = Number(line.vat_rate) || 0; // Default 0 if undefined, but we'll default 20

    const amount = qty * price;
    const vatAmount = amount * (rate / 100);
    const total = amount + vatAmount;

    return {
      ...line,
      amount: amount,
      vat_amount: vatAmount,
      total_with_vat: total,
    };
  };

  // Columns
  const columns: ColumnDef<SalesDocumentLine>[] = [
    {
      accessorKey: "item",
      header: tf("item"),
      cell: ({ row }) => (
        <div
          className={cn(
            "h-full w-full p-1",
            activeCell?.row === row.index &&
              activeCell?.col === "item" &&
              "ring-2 ring-primary inset-0",
          )}
        >
          <ReferenceSelector
            label=""
            value={row.original.item}
            onSelect={(val) => {
              const newLines = [...lines];
              let newLine = {
                ...newLines[row.index],
                item: val as number,
                package: null,
              };
              // TODO: Fetch default VAT from item? For now default 20
              if (newLine.vat_rate === undefined) newLine.vat_rate = 20;
              newLines[row.index] = recalculateLine(newLine);
              setLines(newLines);
            }}
            apiEndpoint="/directories/items/"
            className="border-none shadow-none bg-transparent"
          />
        </div>
      ),
    },
    {
      accessorKey: "package",
      header: tf("unit"),
      cell: ({ row }) => {
        const { data: item } = useItemDetails(row.original.item);
        const units = useMemo(() => {
          if (!item) return [];
          const baseUnitName = item.base_unit || item.unit || "pcs";
          const base = { id: null, name: baseUnitName, coefficient: 1 };
          const sourceUnits = item.units || item.packages || [];
          const pkgs = sourceUnits.map((p: any) => ({
            id: p.id,
            name: p.name,
            coefficient: Number(p.coefficient),
          }));
          return [base, ...pkgs];
        }, [item]);

        return (
          <div
            className={cn(
              "h-full w-full",
              activeCell?.row === row.index &&
                activeCell?.col === "package" &&
                "ring-2 ring-primary z-10 relative",
            )}
          >
            <UnitSelector
              value={row.original.package || null}
              units={units}
              baseUnit={item?.base_unit || item?.unit || "pcs"}
              onChange={(unitId, coefficient) => {
                const newLines = [...lines];
                const oldCoef = Number(newLines[row.index].coefficient) || 1;
                const currentPrice = Number(newLines[row.index].price) || 0;
                // Recalculate Price: BasePrice = Price / OldCoef. NewPrice = BasePrice * NewCoef
                // This ensures 1 Box ($100) -> 1 Pc ($10).
                const newPrice = (currentPrice / oldCoef) * coefficient;

                let newLine = {
                  ...newLines[row.index],
                  package: unitId,
                  coefficient: coefficient,
                  price: parseFloat(newPrice.toFixed(2)), // Round to 2 decimals for UI
                };
                newLines[row.index] = recalculateLine(newLine);
                setLines(newLines);
              }}
              disabled={!canEdit}
            />
          </div>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: tf("quantity"),
      cell: ({ row }) => {
        const item = row.original.item;
        const { data: itemData } = useItemDetails(item);
        const coef = Number(row.original.coefficient) || 1;
        const baseQty = Number(row.original.quantity || 0) * coef;

        return (
          <div className="flex gap-1 h-full items-center">
            <Input
              type="number"
              disabled={!canEdit}
              className="h-8 w-20 text-right font-bold border-transparent focus:border-primary bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background"
              value={row.original.quantity}
              onChange={(e) => {
                const newLines = [...lines];
                let newLine = {
                  ...newLines[row.index],
                  quantity: parseFloat(e.target.value),
                };
                newLines[row.index] = recalculateLine(newLine);
                setLines(newLines);
              }}
            />
            <div className="flex flex-col justify-center px-1 border-l border-dashed min-w-[3rem]">
              <span className="text-[9px] text-muted-foreground leading-none">
                {tsf("base")}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground text-right font-bold">
                {formatBaseQuantity(baseQty)}{" "}
                <span className="text-[8px] font-normal">
                  {itemData?.base_unit || itemData?.unit || "pcs"}
                </span>
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "price",
      header: tf("price"),
      cell: ({ row }) => (
        <Input
          type="number"
          disabled={isPosted}
          className="h-8 w-full text-right border-transparent focus:border-primary bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background"
          value={row.original.price}
          onChange={(e) => {
            const newLines = [...lines];
            let newLine = {
              ...newLines[row.index],
              price: parseFloat(e.target.value),
            };
            newLines[row.index] = recalculateLine(newLine);
            setLines(newLines);
          }}
        />
      ),
    },
    {
      id: "amount",
      header: tf("amount"),
      cell: ({ row }) => (
        <span className="font-mono font-bold block text-right px-2">
          {(Number(row.original.amount) || 0).toFixed(2)}
        </span>
      ),
    },
    {
      id: "vat_rate",
      header: tsf("vatPercent"),
      cell: ({ row }) => (
        <select
          className="h-8 w-full bg-transparent border-none text-right px-2 text-xs"
          disabled={!canEdit}
          value={row.original.vat_rate ?? 20}
          onChange={(e) => {
            const newLines = [...lines];
            let newLine = {
              ...newLines[row.index],
              vat_rate: parseInt(e.target.value),
            };
            newLines[row.index] = recalculateLine(newLine);
            setLines(newLines);
          }}
        >
          <option value="0">0%</option>
          <option value="12">12%</option>
          <option value="20">20%</option>
        </select>
      ),
    },
    {
      id: "vat_amount",
      header: tsf("vatSum"),
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground block text-right px-2 text-xs">
          {(Number(row.original.vat_amount) || 0).toFixed(2)}
        </span>
      ),
    },
    {
      id: "total_line",
      header: tc("total"),
      cell: ({ row }) => (
        <span className="font-mono font-bold block text-right px-2">
          {(Number(row.original.total_with_vat) || 0).toFixed(2)}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) =>
        !isPosted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={() => setLines(lines.filter((_, i) => i !== row.index))}
          >
            <PiTrashBold className="h-4 w-4" />
          </Button>
        ),
    },
  ];

  return (
    <Tabs
      defaultValue="main"
      className="h-[calc(100vh-4rem)] flex flex-col bg-background"
    >
      {/* Header / Tabs List */}
      <div className="border-b px-4 flex items-center justify-between shrink-0 bg-muted/10">
        <TabsList className="bg-transparent p-0">
          <TabsTrigger
            value="main"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            {tsf("tabs.main")}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            {tsf("tabs.history")}
          </TabsTrigger>
          <TabsTrigger
            value="postings"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            disabled={!isPosted}
          >
            {tsf("tabs.postings")}
          </TabsTrigger>
        </TabsList>
        <InterfaceModeToggle />
      </div>

      <TabsContent
        value="main"
        className="flex-1 flex flex-col h-full m-0 p-0 outline-none"
      >
        <CommandBar mainActions={actions} className="border-b shrink-0" />
        <PrintPreviewDialog
          document={{ ...formData, lines }}
          tenant={currentTenant}
          open={printOpen}
          onOpenChange={setPrintOpen}
        />
        <Dialog
          open={Boolean(rateDialogState)}
          onOpenChange={(open) => {
            if (!open) {
              setRateDialogState(null);
              setRateDialogError(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{tsf("rateRequiredToday")}</DialogTitle>
              <DialogDescription>
                {rateDialogState
                  ? tsf("ratePrompt", {
                      currency: rateDialogState.currencyCode,
                      date: rateDialogState.date,
                    })
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                {rateDialogState?.currencyCode || selectedCurrencyCode} @ 1 USD
              </Label>
              <Input
                autoFocus
                type="number"
                min="0"
                step="0.000001"
                value={rateDialogInput}
                onChange={(e) => {
                  setRateDialogInput(e.target.value);
                  if (rateDialogError) setRateDialogError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleRateDialogSave();
                  }
                }}
              />
              {rateDialogError ? (
                <p className="text-xs text-destructive">{rateDialogError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRateDialogState(null);
                  setRateDialogError(null);
                }}
              >
                {tc("cancel")}
              </Button>
              <Button onClick={handleRateDialogSave}>{tc("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Fixed Header Fields */}
        <div className="flex flex-col gap-4 border-b bg-muted/10 shrink-0">
          {/* Top Bar for Operation and Invoice Status */}
          <div className="flex items-center justify-between px-4 pt-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                {tsf("operation")}
              </Label>
              <select
                className="h-7 text-xs bg-transparent border-none font-medium focus:ring-0 cursor-pointer hover:bg-muted/50 rounded px-1"
                value={formData.operation_type || "goods"}
                disabled={!canEdit}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    operation_type: e.target
                      .value as SalesDocument["operation_type"],
                  })
                }
              >
                <option value="goods">{tsf("operationTypes.goods")}</option>
                <option value="services">
                  {tsf("operationTypes.services")}
                </option>
                <option value="goods_services">
                  {tsf("operationTypes.goodsServices")}
                </option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {tsf("invoiceStatusLabel")}
              </span>
              <button
                className="text-xs text-blue-600 hover:underline font-medium"
                onClick={() => toast.info(tsf("invoiceTodo"))}
              >
                {tsf("invoiceNotIssued")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4 px-4 pb-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {tc("number")}
              </Label>
              <Input
                disabled={!canEdit}
                value={formData.number || ""}
                onChange={(e) =>
                  setFormData({ ...formData, number: e.target.value })
                }
                className="h-8 font-mono bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {tc("date")}
              </Label>
              <Input
                type="datetime-local"
                disabled={!canEdit}
                value={
                  formData.date
                    ? new Date(formData.date).toISOString().slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="h-8 bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {tsf("organization")}
              </Label>
              <Input
                disabled
                value={currentTenant?.name || tsf("organizationDefault")}
                className="h-8 bg-muted/50 border-transparent text-muted-foreground"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {tf("counterparty")}
              </Label>
              <ReferenceSelector
                label=""
                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                value={formData.counterparty as number}
                onSelect={(val) =>
                  setFormData({ ...formData, counterparty: val as number })
                }
                apiEndpoint="/directories/counterparties/"
                placeholder={tsf("placeholders.counterparty")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {tf("warehouse")}
              </Label>
              <ReferenceSelector
                label=""
                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                value={formData.warehouse as number}
                onSelect={(val) =>
                  setFormData({ ...formData, warehouse: val as number })
                }
                apiEndpoint="/directories/warehouses/"
                placeholder={tsf("placeholders.warehouse")}
              />
            </div>
            <div className="space-y-1">
              <ReferenceSelector
                label=""
                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                value={formData.contract as number}
                onSelect={(val) =>
                  setFormData({ ...formData, contract: val as number })
                }
                apiEndpoint="/directories/contracts/"
                placeholder={tsf("placeholders.contract")}
                displayField="number"
              />
            </div>

            {/* Analytics Fields */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {tsf("project")}
              </Label>
              <ReferenceSelector
                label=""
                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                value={formData.project as number}
                onSelect={(val) =>
                  setFormData({ ...formData, project: val as number })
                }
                apiEndpoint="/directories/projects/"
                placeholder={tsf("placeholders.project")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {tsf("department")}
              </Label>
              <ReferenceSelector
                label=""
                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                value={formData.department as number}
                onSelect={(val) =>
                  setFormData({ ...formData, department: val as number })
                }
                apiEndpoint="/directories/departments/"
                placeholder={tsf("placeholders.department")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {tsf("manager")}
              </Label>
              <ReferenceSelector
                label=""
                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                value={formData.manager as number}
                onSelect={(val) =>
                  setFormData({ ...formData, manager: val as number })
                }
                apiEndpoint="/directories/employees/"
                placeholder={tsf("placeholders.manager")}
                displayField="last_name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {tf("currency")}
              </Label>
              <div className="flex gap-2">
                <ReferenceSelector
                  label=""
                  className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent w-[170px]"
                  value={formData.currency as number}
                  onSelect={(val) =>
                    setFormData({ ...formData, currency: val as number })
                  }
                  apiEndpoint="/directories/currencies/"
                  placeholder={tsf("placeholders.currency")}
                  displayField="code"
                  disabled={!canEdit}
                />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  @
                  <Input
                    className="h-8 w-24 bg-muted/50"
                    type="number"
                    min="0"
                    step="0.000001"
                    value={formData.exchange_rate || ""}
                    readOnly={
                      Number(formData.currency || 0) ===
                      Number(usdCurrencyId || 0)
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        exchange_rate: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {tsf("baseCurrencyUsd")}
              </p>
            </div>
          </div>
        </div>

        {/* 1C-Style Operational Panels */}
        <div className="grid grid-cols-2 gap-4 px-4">
          <LiveStockPanel
            warehouseId={formData.warehouse as number | null}
            lines={lines.map((l) => ({
              item: l.item,
              quantity:
                (Number(l.quantity) || 0) * (Number(l.coefficient) || 1),
            }))}
            operation="OUT"
          />
          <LiveSettlementPanel
            counterpartyId={formData.counterparty as number | null}
            contractId={formData.contract as number | null}
            currencyId={formData.currency as number | null}
            amount={totals.grandTotal}
            operation="ACCRUAL"
          />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-background dark:bg-zinc-950 relative">
          <DataTable columns={columns} data={lines} />
          {!isPosted && (
            <div className="p-2 border-t bg-muted/5">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLines([
                    ...lines,
                    {
                      id: Date.now(),
                      item: 1,
                      quantity: 1,
                      package: null,
                      coefficient: 1,
                      price: 0,
                      amount: 0,
                      vat_rate: 20,
                      vat_amount: 0,
                      total_with_vat: 0,
                      document: initialData?.id || 0,
                      warehouse: formData.warehouse || 1,
                    },
                  ])
                }
              >
                <PiPlusBold className="mr-2 h-4 w-4" /> {tc("add")}
              </Button>
            </div>
          )}
        </div>

        {/* Footer Totals */}
        <div className="shrink-0 border-t bg-muted/90 p-2 backdrop-blur">
          <div className="flex items-center justify-end gap-6 text-sm">
            <div className="flex flex-col items-end">
              <span className="text-muted-foreground text-xs font-bold">
                {tc("total")}
              </span>
              <span className="font-mono font-bold text-lg text-primary">
                {totals.grandTotal.toFixed(2)} {selectedCurrencyCode}
              </span>
            </div>
            <div className="flex flex-col items-end border-l pl-4 ml-4">
              <span className="text-muted-foreground text-xs font-bold">
                {tsf("baseValue")}
              </span>
              <span className="font-mono font-bold text-lg">
                {totals.grandTotalUsd.toFixed(2)} USD
              </span>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="history" className="p-8">
        {initialData?.id ? (
          <DocumentHistoryPanel
            documentId={initialData.id}
            documentType="sales"
          />
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            {tsf("saveToViewHistory")}
          </div>
        )}
      </TabsContent>

      <TabsContent value="postings" className="flex-1 p-8 m-0 overflow-auto">
        {initialData?.id ? (
          <DocumentPostings documentId={initialData.id} endpoint="sales" />
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            {tsf("saveToViewPostings")}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
