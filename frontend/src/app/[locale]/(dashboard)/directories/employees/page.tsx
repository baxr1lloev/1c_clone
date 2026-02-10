"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import api from "@/lib/api";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar";
import type { Employee, PaginatedResponse } from "@/types";

export default function EmployeesPage() {
    const t = useTranslations("directories");
    const tc = useTranslations("common");
    const router = useRouter();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["employees"],
        queryFn: async () => {
            const res = await api.get<PaginatedResponse<Employee>>("/directories/employees/");
            return res.results; // Make sure API returns PaginatedResponse or list
        },
    });

    const handleDelete = async (id: number) => {
        if (!confirm(tc("confirmDelete"))) return;
        try {
            await api.delete(`/directories/employees/${id}/`);
            toast.success(tc("deletedSuccessfully"));
            refetch();
        } catch (error) {
            toast.error(tc("errorDeleting"));
        }
    }

    const columns: ColumnDef<Employee>[] = [
        {
            accessorKey: "last_name",
            header: tc("fullName"),
            cell: ({ row }) => <span className="font-medium">{row.original.last_name} {row.original.first_name} {row.original.middle_name}</span>,
        },
        {
            accessorKey: "position",
            header: t("position"),
        },
        {
            accessorKey: "phone",
            header: tc("phone"),
        },
        {
            accessorKey: "email",
            header: tc("email"),
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/directories/employees/${row.original.id}`)}
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
            onClick: () => router.push("/directories/employees/new"),
            variant: "default",
            shortcut: "Ctrl+N",
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <CommandBar mainActions={mainActions} className="border-b shrink-0" />

            <div className="flex-1 overflow-auto p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">{t("employees")}</h1>
                </div>

                <DataTable
                    columns={columns}
                    data={data || []}
                    isLoading={isLoading}
                    searchColumn="last_name"
                    searchPlaceholder={tc("search")}
                />
            </div>
        </div>
    );
}

