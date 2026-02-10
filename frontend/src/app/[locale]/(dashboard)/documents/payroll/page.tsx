"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import api from "@/lib/api";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar";
import { Badge } from "@/components/ui/badge";
import type { PayrollDocument, PaginatedResponse } from "@/types";

export default function PayrollPage() {
    const t = useTranslations("documents");
    const tc = useTranslations("common");
    const router = useRouter();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["payroll"],
        queryFn: async () => {
            const res = await api.get<PaginatedResponse<PayrollDocument>>("/documents/payroll/");
            return res.results;
        },
    });

    const handleDelete = async (id: number) => {
        if (!confirm(tc("confirmDelete"))) return;
        try {
            await api.delete(`/documents/payroll/${id}/`);
            toast.success(tc("deletedSuccessfully"));
            refetch();
        } catch (error) {
            toast.error(tc("errorDeleting"));
        }
    }

    const columns: ColumnDef<PayrollDocument>[] = [
        {
            accessorKey: "date",
            header: tc("date"),
            cell: ({ row }) => format(new Date(row.original.date), "dd.MM.yyyy"),
        },
        {
            accessorKey: "number",
            header: tc("number"),
        },
        {
            accessorKey: "period_start",
            header: t("periodStart"),
            cell: ({ row }) => format(new Date(row.original.period_start), "dd.MM.yyyy"),
        },
        {
            accessorKey: "period_end",
            header: t("periodEnd"),
            cell: ({ row }) => format(new Date(row.original.period_end), "dd.MM.yyyy"),
        },
        {
            accessorKey: "amount",
            header: tc("amount"),
            cell: ({ row }) => Number(row.original.amount).toFixed(2),
        },
        {
            accessorKey: "status",
            header: tc("status"),
            cell: ({ row }) => (
                <Badge variant={row.original.status === "posted" ? "default" : "secondary"}>
                    {row.original.status_display}
                </Badge>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/documents/payroll/${row.original.id}`)}
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
            onClick: () => router.push("/documents/payroll/new"),
            variant: "default",
            shortcut: "Ctrl+N",
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <CommandBar mainActions={mainActions} className="border-b shrink-0" />

            <div className="flex-1 overflow-auto p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">{t("payroll")}</h1>
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

