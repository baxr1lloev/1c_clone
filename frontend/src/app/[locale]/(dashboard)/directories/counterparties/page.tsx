"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { DataTable } from "@/components/data-table/data-table";
import { ReferenceLink } from "@/components/ui/reference-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBar } from "@/components/ui/status-bar";
import { getCounterpartyRowClassName } from "@/components/data-table/row-styles";
import { GroupBySelector } from "@/components/data-table/group-by-selector";
import { SavedViews, SavedView } from "@/components/data-table/saved-views";
import { HelpPanel } from "@/components/layout/help-panel";
import { ColumnCustomization } from "@/components/data-table/column-customization";
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
import { toast } from "sonner";
import {
  PiPencilBold,
  PiTrashBold,
  PiArrowsDownUpBold,
  PiPlusBold,
  PiXBold,
  PiUsersBold,
} from "react-icons/pi";
import type {
  Counterparty,
  PaginatedResponse,
  CounterpartyType,
} from "@/types";
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar";

const typeColors: Record<CounterpartyType, string> = {
  customer:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  supplier: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  agent:
    "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

function normalizeCounterpartyType(type: unknown): CounterpartyType {
  const value = String(type ?? "").toLowerCase();
  if (value === "customer" || value === "supplier" || value === "agent") {
    return value;
  }
  return "other";
}

export default function CounterpartiesPage() {
  const t = useTranslations("directories");
  const tc = useTranslations("common");
  const tf = useTranslations("fields");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Counterparty | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["counterparties"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Counterparty>>(
        "/directories/counterparties/",
      );
      return response.results;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/directories/counterparties/${id}/`);
    },
    onSuccess: () => {
      toast.success(tc("deletedSuccessfully"));
      queryClient.invalidateQueries({ queryKey: ["counterparties"] });
      setIsDeleteOpen(false);
      setSelectedItem(null);
    },
    onError: () => {
      toast.error(tc("errorDeleting"));
    },
  });

  const handleCreate = () => router.push("/directories/counterparties/new");
  const handleEdit = (item: Counterparty) =>
    router.push(`/directories/counterparties/${item.id}`);
  const handleView = (item: Counterparty) =>
    router.push(`/directories/counterparties/${item.id}`);

  // Load saved view
  const handleLoadView = (view: SavedView) => {
    setTypeFilter(view.filters.type || "all");
    setSorting(view.sorting);
    setColumnVisibility(view.columnVisibility);
    setGroupBy(view.groupBy);
  };

  // Filtering
  const filteredData = useMemo(() => {
    if (!data) return [];
    let filtered = data;

    if (typeFilter !== "all") {
      filtered = filtered.filter(
        (item) => normalizeCounterpartyType(item.type) === typeFilter,
      );
    }

    if (searchValue) {
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(searchValue.toLowerCase()),
      );
    }

    return filtered;
  }, [data, typeFilter, searchValue]);

  const mainActions: CommandBarAction[] = [
    {
      label: t("addCounterparty"),
      icon: <PiPlusBold />,
      onClick: handleCreate,
      variant: "default",
      shortcut: "Ins",
    },
  ];

  const selectionActions: CommandBarAction[] = selectedItem
    ? [
        {
          label: tc("edit"),
          icon: <PiPencilBold />,
          onClick: () => handleEdit(selectedItem),
          shortcut: "F2",
        },
        {
          label: tc("delete"),
          icon: <PiTrashBold />,
          onClick: () => setIsDeleteOpen(true),
          variant: "destructive",
          shortcut: "Del",
        },
      ]
    : [];

  const columns: ColumnDef<Counterparty>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4 h-8 text-xs"
        >
          {tc("name")} <PiArrowsDownUpBold className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <ReferenceLink
          id={row.original.id}
          type="counterparty"
          label={row.getValue("name")}
          showIcon={true}
          className="font-medium"
        />
      ),
    },
    {
      accessorKey: "inn",
      header: tf("inn"),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("inn")}</span>
      ),
    },
    {
      accessorKey: "type",
      header: tf("type"),
      cell: ({ row }) => {
        const type = normalizeCounterpartyType(row.getValue("type"));
        return (
          <Badge
            variant="outline"
            className={cn("text-[10px] h-5 px-1", typeColors[type])}
          >
            {t(`counterpartiesPage.filters.${type}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "phone",
      header: tf("phone"),
      cell: ({ row }) => (
        <span className="text-xs">{row.getValue("phone")}</span>
      ),
    },
    {
      accessorKey: "email",
      header: tf("email"),
      cell: ({ row }) => (
        <a
          href={`mailto:${row.getValue("email")}`}
          className="text-primary hover:underline text-xs"
        >
          {row.getValue("email")}
        </a>
      ),
    },
    {
      accessorKey: "is_active",
      header: tf("isActive"),
      cell: ({ row }) => {
        const isActive = row.getValue("is_active") as boolean;
        return (
          <Badge
            variant={isActive ? "default" : "outline"}
            className="text-[10px] h-5 px-1"
          >
            {isActive ? tc("yes") : tc("no")}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between border-b px-6 py-4 bg-background">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <PiUsersBold className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("counterparties")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 pt-4 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Button
            variant={typeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("all")}
            className="h-8"
          >
            {t("counterpartiesPage.filters.all")}
          </Button>
          <Button
            variant={typeFilter === "customer" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("customer")}
            className="h-8"
          >
            {t("counterpartiesPage.filters.customer")}
          </Button>
          <Button
            variant={typeFilter === "supplier" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("supplier")}
            className="h-8"
          >
            {t("counterpartiesPage.filters.supplier")}
          </Button>
          <Button
            variant={typeFilter === "agent" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("agent")}
            className="h-8"
          >
            {t("counterpartiesPage.filters.agent")}
          </Button>
          <Button
            variant={typeFilter === "other" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("other")}
            className="h-8"
          >
            {t("counterpartiesPage.filters.other")}
          </Button>
          {typeFilter !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTypeFilter("all")}
              className="h-8 px-2 lg:px-3"
            >
              {t("counterpartiesPage.filters.clear")}
              <PiXBold className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex-1 border rounded-md bg-card overflow-hidden flex flex-col">
          <DataTable
            columns={columns}
            data={filteredData}
            isLoading={isLoading}
            onRowClick={setSelectedItem}
            onRowDoubleClick={handleEdit}
            commandBar={
              <div className="flex items-center justify-between w-full p-2 border-b bg-muted/20">
                <CommandBar
                  mainActions={mainActions}
                  selectionActions={selectionActions}
                  onRefresh={() => refetch()}
                  onSearch={setSearchValue}
                  searchValue={searchValue}
                  searchPlaceholder={tc("searchCounterparties")}
                />
                <div className="flex items-center gap-2">
                  <ColumnCustomization
                    columns={columns}
                    columnVisibility={columnVisibility}
                    onColumnVisibilityChange={setColumnVisibility}
                    tableName="counterparties"
                  />
                  <HelpPanel context="counterparties" />
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
              {t("counterpartiesPage.alerts.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich("counterpartiesPage.alerts.deleteConfirmation", {
                name: selectedItem?.name,
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
