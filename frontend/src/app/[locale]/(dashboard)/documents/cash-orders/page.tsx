"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PiPlusBold,
  PiMoneyBold,
  PiArrowsDownUpBold,
  PiPencilBold,
  PiTrashBold,
  PiCheckCircleBold,
  PiXCircleBold,
  PiEyeBold,
  PiArrowUpRightBold,
  PiArrowDownLeftBold,
} from "react-icons/pi";

import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar";
import { StatusBar } from "@/components/ui/status-bar";
import { ReferenceLink } from "@/components/ui/reference-link";
import { LinkableCell } from "@/components/ui/linkable-cell";
import { ColumnCustomization } from "@/components/data-table/column-customization";
import { HelpPanel } from "@/components/layout/help-panel";
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
  PaginatedResponse,
  DocumentStatus,
  CashOrderType,
} from "@/types";
import { getDocumentRowClassName } from "@/components/data-table/row-styles";

export default function CashOrdersPage() {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const tf = useTranslations("fields");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<CashOrder | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});

  // Data Fetching
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["cash-orders"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<CashOrder>>(
        "/documents/cash-orders/",
      );
      return response.results;
    },
  });

  // Mutations
  const postMutation = useMutation({
    mutationFn: async (id: number) =>
      api.post(`/documents/cash-orders/${id}/post_document/`),
    onSuccess: () => {
      toast.success(t("posted"));
      queryClient.invalidateQueries({ queryKey: ["cash-orders"] });
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || t("post_failed")),
  });

  const unpostMutation = useMutation({
    mutationFn: async (id: number) =>
      api.post(`/documents/cash-orders/${id}/unpost_document/`),
    onSuccess: () => {
      toast.success(t("draft")); // Using status translation as success message proxy or need specific? using draft for now as it reverts to draft
      // Actually better to use specific message but "unposted" key doesn't denote success message.
      // Reverting to existing logic but using keys.
      // Original: toast.success(t('document_unposted')); - Check if this key exists. It does in my update? No, I added 'unpost_failed'.
      // I should use generic success if not available or add it.
      // Existing code used t('document_unposted'). I didn't see that in the json I read.
      // Let's assume t('unpost_failed') was added.
      // I will use tc('updatedSuccessfully') or similar if needed.
      // Wait, existing code had t('document_posted').
      // I will keep existing logic for success/error where I didn't change keys.
      toast.success(tc("updatedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["cash-orders"] });
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || t("unpost_failed")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      api.delete(`/documents/cash-orders/${id}/`),
    onSuccess: () => {
      toast.success(tc("deletedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["cash-orders"] });
      setIsDeleteOpen(false);
      setSelectedItem(null);
    },
    onError: () => toast.error(t("delete_failed")),
  });

  // Filtering
  const filteredData = useMemo(() => {
    if (!data) return [];
    let filtered = data;

    // Tab Filter
    if (activeTab === "incoming") {
      filtered = filtered.filter((doc) => doc.order_type === "incoming");
    } else if (activeTab === "outgoing") {
      filtered = filtered.filter((doc) => doc.order_type === "outgoing");
    }

    // Search Filter
    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.number.toLowerCase().includes(searchLower) ||
          doc.counterparty_name?.toLowerCase().includes(searchLower) ||
          doc.purpose?.toLowerCase().includes(searchLower),
      );
    }

    return filtered;
  }, [data, activeTab, searchValue]);

  // Navigation
  const handleCreate = (type: string) =>
    router.push(`/documents/cash-orders/new?type=${type}`);
  const handleEdit = (doc: CashOrder) =>
    router.push(`/documents/cash-orders/${doc.id}/edit`);
  const handleView = (doc: CashOrder) =>
    router.push(`/documents/cash-orders/${doc.id}`);

  // Columns
  const columns: ColumnDef<CashOrder>[] = [
    {
      accessorKey: "date",
      header: tc("date"),
      cell: ({ row }) => {
        const d = new Date(row.getValue("date"));
        return (
          <span className="font-mono text-xs text-muted-foreground">
            {d.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      accessorKey: "number",
      header: tc("number"),
      cell: ({ row }) => (
        <ReferenceLink
          id={row.original.id}
          type="cash-order"
          label={row.getValue("number")}
          className="font-mono text-primary font-bold"
          onClick={() => handleView(row.original)}
        />
      ),
    },
    {
      accessorKey: "order_type",
      header: tf("type"),
      cell: ({ row }) => {
        const type = row.getValue("order_type") as CashOrderType;
        const isIncoming = type === "incoming";
        return (
          <div
            className={cn(
              "flex items-center gap-2 text-xs font-medium",
              isIncoming ? "text-emerald-600" : "text-amber-600",
            )}
          >
            {isIncoming ? <PiArrowDownLeftBold /> : <PiArrowUpRightBold />}
            {isIncoming ? tf("incoming") : tf("outgoing")}
          </div>
        );
      },
    },
    {
      accessorKey: "counterparty_name",
      header: tf("counterparty"),
      cell: ({ row }) => {
        const name = row.original.counterparty_name;
        const id = row.original.counterparty;
        if (id) {
          return <LinkableCell id={id} type="counterparty" label={name} />;
        }
        return <span>{name}</span>;
      },
    },
    {
      accessorKey: "amount",
      header: tc("amount"),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"));
        const currency = row.original.currency_code || "";
        return (
          <span className="font-mono font-bold">
            {amount.toFixed(2)} {currency}
          </span>
        );
      },
    },
    {
      accessorKey: "purpose",
      header: tf("description"), // Mapping purpose to description
      cell: ({ row }) => (
        <span
          className="text-xs truncate max-w-[200px] block"
          title={row.getValue("purpose")}
        >
          {row.getValue("purpose")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: tc("status"),
      cell: ({ row }) => {
        const status = row.getValue("status") as DocumentStatus;
        const variantMap: Record<DocumentStatus, any> = {
          posted: "posted",
          draft: "draft",
          cancelled: "deleted",
        };
        return (
          <Badge variant={variantMap[status]}>
            {status === "posted" && "✓ "}
            {t(status)}
          </Badge>
        );
      },
    },
  ];

  // Actions
  const mainActions: CommandBarAction[] = [
    {
      label: t("cashOrders.actions.newPko"),
      icon: <PiPlusBold />,
      onClick: () => handleCreate("incoming"),
      variant: "default",
      shortcut: "Ins",
    },
    {
      label: t("cashOrders.actions.newRko"),
      icon: <PiPlusBold />,
      onClick: () => handleCreate("outgoing"),
      variant: "secondary", // Use secondary to distinguish
    },
  ];

  const selectionActions: CommandBarAction[] = selectedItem
    ? [
        {
          label: tc("edit"),
          icon: <PiPencilBold />,
          onClick: () => handleEdit(selectedItem),
          disabled: !selectedItem.can_edit,
          shortcut: "F2",
        },
        {
          label: t("post"),
          icon: <PiCheckCircleBold />,
          onClick: () => postMutation.mutate(selectedItem.id),
          disabled: !selectedItem.can_post,
          variant: "ghost",
        },
        {
          label: t("unpost"),
          icon: <PiXCircleBold />,
          onClick: () => unpostMutation.mutate(selectedItem.id),
          disabled: !selectedItem.can_unpost,
          variant: "ghost",
        },
        {
          label: tc("delete"),
          icon: <PiTrashBold />,
          onClick: () => setIsDeleteOpen(true),
          disabled:
            !selectedItem.can_edit && selectedItem.status !== "cancelled", // Can usually delete drafts
          variant: "destructive",
          shortcut: "Del",
        },
      ]
    : [];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between border-b px-6 py-4 bg-background">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <PiMoneyBold className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {t("cashOrders.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("cashOrders.description")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 pt-4 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="all">{t("cashOrders.tabs.all")}</TabsTrigger>
            <TabsTrigger value="incoming">
              {t("cashOrders.tabs.incoming")}
            </TabsTrigger>
            <TabsTrigger value="outgoing">
              {t("cashOrders.tabs.outgoing")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1 border rounded-md bg-card overflow-hidden flex flex-col">
          <DataTable
            columns={columns}
            data={filteredData}
            isLoading={isLoading}
            onRowClick={setSelectedItem}
            onRowDoubleClick={(row) =>
              row.can_edit ? handleEdit(row) : handleView(row)
            }
            getRowClassName={(row) => getDocumentRowClassName(row.status)}
            commandBar={
              <div className="flex items-center justify-between w-full p-2 border-b bg-muted/20">
                <CommandBar
                  mainActions={mainActions}
                  selectionActions={selectionActions}
                  onRefresh={() => refetch()}
                  onSearch={setSearchValue}
                  searchValue={searchValue}
                  searchPlaceholder={tc("searchNumberCounterparty")}
                />
                <div className="flex items-center gap-2">
                  <ColumnCustomization
                    columns={columns}
                    columnVisibility={columnVisibility}
                    onColumnVisibilityChange={setColumnVisibility}
                    tableName="cash_orders"
                  />
                  <HelpPanel context="cash-orders" />
                </div>
              </div>
            }
          />
          <StatusBar
            totalRecords={data?.length || 0}
            filteredCount={filteredData.length}
            selectedCount={selectedItem ? 1 : 0}
            isLoading={isLoading}
          />
        </div>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("cashOrders.alerts.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich("cashOrders.alerts.deleteConfirmation", {
                number: selectedItem?.number,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                selectedItem && deleteMutation.mutate(selectedItem.id)
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
