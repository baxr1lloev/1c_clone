"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Check, Ban } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import api from "@/lib/api";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar";
import { Badge } from "@/components/ui/badge";
import { UserForm } from "@/components/admin/user-form";
import type { User, PaginatedResponse } from "@/types";

export default function UsersPage() {
    const t = useTranslations("admin");
    const tc = useTranslations("common");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["users"],
        queryFn: async () => {
            const res = await api.get<PaginatedResponse<User>>("/accounts/users/");
            return res.results;
        },
    });

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setIsFormOpen(true);
    };

    const handleCreate = () => {
        setSelectedUser(null);
        setIsFormOpen(true);
    };

    const handleToggleStatus = async (user: User) => {
        try {
            const action = user.is_active ? "deactivate" : "activate";
            await api.post(`/accounts/users/${user.id}/${action}/`);
            toast.success(`User ${action}d successfully`);
            refetch();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error updating status");
        }
    }

    const columns: ColumnDef<User>[] = [
        {
            accessorKey: "email",
            header: "Email",
        },
        {
            accessorKey: "first_name",
            header: "First Name",
        },
        {
            accessorKey: "last_name",
            header: "Last Name",
        },
        {
            accessorKey: "role_name",
            header: "Role",
            cell: ({ row }) => (
                <Badge variant="outline">{row.original.role_name || "No Role"}</Badge>
            ),
        },
        {
            accessorKey: "is_active",
            header: "Status",
            cell: ({ row }) => (
                <Badge variant={row.original.is_active ? "default" : "secondary"}>
                    {row.original.is_active ? "Active" : "Inactive"}
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
                        onClick={() => handleToggleStatus(row.original)}
                        title={row.original.is_active ? "Deactivate" : "Activate"}
                    >
                        {row.original.is_active ? <Ban className="h-4 w-4 text-orange-500" /> : <Check className="h-4 w-4 text-green-500" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(row.original)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    const mainActions: CommandBarAction[] = [
        {
            label: "New User",
            icon: <Plus className="w-4 h-4" />,
            onClick: handleCreate,
            variant: "default",
            shortcut: "Ctrl+N",
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <CommandBar mainActions={mainActions} className="border-b shrink-0" />

            <div className="flex-1 overflow-auto p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground">Manage users, roles and permissions.</p>
                </div>

                <DataTable
                    columns={columns}
                    data={data || []}
                    isLoading={isLoading}
                    searchColumn="email"
                    searchPlaceholder="Search by email..."
                />

                <UserForm
                    open={isFormOpen}
                    onOpenChange={setIsFormOpen}
                    initialData={selectedUser}
                    onSuccess={refetch}
                />
            </div>
        </div>
    );
}

