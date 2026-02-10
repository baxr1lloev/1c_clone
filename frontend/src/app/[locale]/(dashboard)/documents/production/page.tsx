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
import type { ProductionDocument, PaginatedResponse } from "@/types";

export default function ProductionPage() {
    const t = useTranslations("documents");
    const tc = useTranslations("common");
    const router = useRouter();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["production"],
        queryFn: async () => {
            const res = await api.get<PaginatedResponse<ProductionDocument>>("/documents/production/");
            return res.results;
        },
    });

    const handleDelete = async (id: number) => {
        if (!confirm(tc("confirmDelete"))) return;
        try {
            await api.delete(`/documents/production/${id}/`);
            toast.success(tc("deletedSuccessfully"));
            refetch();
        } catch (error) {
            toast.error(tc("errorDeleting"));
        }
    }

    const columns: ColumnDef<ProductionDocument>[] = [
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
            accessorKey: "warehouse_name",
            header: t("warehouse"),
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
                        onClick={() => router.push(`/documents/production/${row.original.id}`)}
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
            onClick: () => router.push("/documents/production/new"),
            variant: "default",
            shortcut: "Ctrl+N",
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <CommandBar mainActions={mainActions} className="border-b shrink-0" />

            <div className="flex-1 overflow-auto p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Production Documents</h1>
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

