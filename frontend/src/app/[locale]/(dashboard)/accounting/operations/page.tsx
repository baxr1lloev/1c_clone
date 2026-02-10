"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import api from "@/lib/api";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar";
import type { Operation, PaginatedResponse } from "@/types";

export default function OperationsPage() {
    const t = useTranslations("accounting");
    const tc = useTranslations("common");
    const router = useRouter();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["operations"],
        queryFn: async () => {
            const res = await api.get<PaginatedResponse<Operation>>("/accounting/operations/");
            return res.results;
        },
    });

    const handleDelete = async (id: number) => {
        if (!confirm(tc("confirmDelete"))) return;
        try {
            await api.delete(`/accounting/operations/${id}/`);
            toast.success(tc("deletedSuccessfully"));
            refetch();
        } catch (error) {
            toast.error(tc("errorDeleting"));
        }
    }

    const columns: ColumnDef<Operation>[] = [
        {
            accessorKey: "number",
            header: tc("number"),
            cell: ({ row }) => <span className="font-mono font-medium">{row.original.number}</span>,
        },
        {
            accessorKey: "date",
            header: tc("date"),
            cell: ({ row }) => format(new Date(row.original.date), "dd.MM.yyyy"),
        },
        {
            accessorKey: "amount",
            header: tc("amount"),
            cell: ({ row }) => (
                <span className="font-mono font-bold">
                    {Number(row.original.amount).toFixed(2)}
                </span>
            ),
        },
        {
            accessorKey: "comment",
            header: tc("comment"),
        },
        {
            accessorKey: "created_by_name",
            header: t("author"),
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/accounting/operations/${row.original.id}`)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(row.original.id)}
                    >
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            ),
        },
    ];

    const mainActions: CommandBarAction[] = [
        {
            label: tc("create"),
            icon: <Plus className="w-4 h-4" />,
            onClick: () => router.push("/accounting/operations/new"),
            variant: "default",
            shortcut: "Ctrl+N",
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <CommandBar mainActions={mainActions} className="border-b shrink-0" />

            <div className="flex-1 overflow-auto p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">{t("manualOperations")}</h1>
                    <p className="text-muted-foreground">{t("manualOperationsDescription")}</p>
                </div>

                <DataTable
                    columns={columns}
                    data={data || []}
                    isLoading={isLoading}
                    searchColumn="number"
                    searchPlaceholder={tc("search")}
                />
            </div>
        </div>
    );
}

