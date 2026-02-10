"use client";

import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar";
import api from "@/lib/api";
import type { Employee } from "@/types";

const formSchema = z.object({
    first_name: z.string().min(1, "Required"),
    last_name: z.string().min(1, "Required"),
    middle_name: z.string().optional(),
    inn: z.string().optional(),
    position: z.string().optional(),
    hiring_date: z.string().optional(),
    base_salary: z.coerce.number().min(0),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    address: z.string().optional(),
    is_active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface EmployeeFormProps {
    initialData?: Employee;
    mode: "create" | "edit";
}

export function EmployeeForm({ initialData, mode }: EmployeeFormProps) {
    const t = useTranslations("directories"); // Assuming translations are here or in common
    const tc = useTranslations("common");
    const router = useRouter();
    const queryClient = useQueryClient();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: {
            first_name: initialData?.first_name || "",
            last_name: initialData?.last_name || "",
            middle_name: initialData?.middle_name || "",
            inn: initialData?.inn || "",
            position: initialData?.position || "",
            hiring_date: initialData?.hiring_date || "",
            base_salary: Number(initialData?.base_salary) || 0,
            phone: initialData?.phone || "",
            email: initialData?.email || "",
            address: initialData?.address || "",
            is_active: initialData?.is_active ?? true,
        },
    });

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            // Clean up empty strings for optional fields if needed
            const payload = { ...values };
            if (!payload.hiring_date) delete (payload as any).hiring_date;

            if (mode === "create") {
                return api.post("/directories/employees/", payload);
            } else {
                return api.put(`/directories/employees/${initialData!.id}/`, payload);
            }
        },
        onSuccess: () => {
            toast.success(tc("savedSuccessfully"));
            queryClient.invalidateQueries({ queryKey: ["employees"] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || tc("errorSaving"));
        },
    });

    const onSubmit = (values: FormValues) => {
        mutation.mutate(values);
    };

    const onSaveAndClose = (values: FormValues) => {
        mutation.mutate(values, {
            onSuccess: () => router.push("/directories/employees"),
        });
    };

    const actions: CommandBarAction[] = [
        {
            label: tc("save"),
            icon: <Save className="w-4 h-4" />,
            onClick: form.handleSubmit(onSubmit),
            variant: "default",
            shortcut: "Ctrl+S",
        },
        {
            label: tc("saveAndClose"),
            icon: <Save className="w-4 h-4" />,
            onClick: form.handleSubmit(onSaveAndClose),
            variant: "secondary",
            shortcut: "Ctrl+Enter",
        },
        {
            label: tc("cancel"),
            icon: <X className="w-4 h-4" />,
            onClick: () => router.push("/directories/employees"),
            variant: "ghost",
            shortcut: "Esc",
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <CommandBar mainActions={actions} className="border-b shrink-0" />

            <div className="flex-1 overflow-auto p-6">
                <Form {...form}>
                    <form className="space-y-8 max-w-2xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="last_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc("lastName")}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="first_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc("firstName")}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="middle_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc("middleName")}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="inn"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("inn")}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="position"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("position")}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="hiring_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("hiringDate")}</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="base_salary"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("baseSalary")}</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc("phone")}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc("email")}</FormLabel>
                                        <FormControl>
                                            <Input type="email" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{tc("address")}</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="is_active"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-4 border rounded-md">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>
                                            {tc("isActive")}
                                        </FormLabel>
                                    </div>
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>
            </div>
        </div>
    );
}
