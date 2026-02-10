"use client";

import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

import api from "@/lib/api";
import type { User, Role } from "@/types";

const formSchema = z.object({
    email: z.string().email("Invalid email"),
    first_name: z.string().min(1, "Required"),
    last_name: z.string().min(1, "Required"),
    role: z.coerce.number().min(1, "Required"),
    password: z.string().optional(),
    is_active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface UserFormProps {
    initialData?: User | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function UserForm({ initialData, open, onOpenChange, onSuccess }: UserFormProps) {
    const t = useTranslations("admin");
    const tc = useTranslations("common");
    const queryClient = useQueryClient();

    // Fetch Roles
    const { data: roles } = useQuery<Role[]>({
        queryKey: ["roles"],
        queryFn: async () => (await api.get("/accounts/roles/")).data.results,
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: {
            email: "",
            first_name: "",
            last_name: "",
            role: 0,
            password: "",
            is_active: true,
        },
    });

    // Reset form when opening
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    email: initialData.email,
                    first_name: initialData.first_name,
                    last_name: initialData.last_name,
                    role: initialData.role?.id || (initialData as any).role, // Handle if role is object or ID
                    password: "", // Don't show password
                    is_active: initialData.is_active,
                });
            } else {
                form.reset({
                    email: "",
                    first_name: "",
                    last_name: "",
                    role: 0,
                    password: "",
                    is_active: true,
                });
            }
        }
    }, [open, initialData, form]);

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            const payload = { ...values };
            if (!payload.password) delete payload.password; // Don't send empty password on update

            if (initialData) {
                return api.patch(`/accounts/users/${initialData.id}/`, payload);
            } else {
                return api.post("/accounts/users/", payload);
            }
        },
        onSuccess: () => {
            toast.success(tc("savedSuccessfully"));
            queryClient.invalidateQueries({ queryKey: ["users"] });
            onSuccess();
            onOpenChange(false);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || Object.values(error.response?.data || {}).flat().join(", ") || tc("errorSaving"));
        },
    });

    const onSubmit = (values: FormValues) => {
        mutation.mutate(values);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {initialData ? "Edit User" : "New User"}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled={!!initialData} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="first_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>First Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="last_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Last Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select
                                        onValueChange={(val) => field.onChange(Number(val))}
                                        value={field.value?.toString()}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Role" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {roles?.map((role) => (
                                                <SelectItem key={role.id} value={role.id.toString()}>
                                                    {role.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" {...field} placeholder={initialData ? "Leave empty to keep current" : ""} />
                                    </FormControl>
                                    <FormDescription>
                                        {initialData ? "Optional: Enter only if you want to change it" : "Required for new users"}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="is_active"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>
                                            Active
                                        </FormLabel>
                                        <FormDescription>
                                            User can login to the system
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
