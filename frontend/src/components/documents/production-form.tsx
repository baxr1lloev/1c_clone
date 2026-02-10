"use client";

import { useForm, useFieldArray, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Loader2, Plus, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar";
import api from "@/lib/api";
import type { ProductionDocument, Item, Warehouse } from "@/types";

// Schema
const productLineSchema = z.object({
    item: z.coerce.number().min(1, "Required"),
    quantity: z.coerce.number().min(0.001, "Qty > 0"),
    price: z.coerce.number().min(0, "Price >= 0"), // Planned cost
});

const materialLineSchema = z.object({
    item: z.coerce.number().min(1, "Required"),
    quantity: z.coerce.number().min(0.001, "Qty > 0"),
    cost_price: z.coerce.number().optional(), // Estimated
});

const formSchema = z.object({
    number: z.string().min(1, "Required"),
    date: z.string().min(1, "Required"),
    warehouse: z.coerce.number().min(1, "Required"),
    materials_warehouse: z.coerce.number().optional(),
    production_account_code: z.string().default("20.01"),
    comment: z.string().optional(),
    products: z.array(productLineSchema).min(1, "At least one product required"),
    materials: z.array(materialLineSchema).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ProductionFormProps {
    initialData?: ProductionDocument;
    mode: "create" | "edit";
}

export function ProductionForm({ initialData, mode }: ProductionFormProps) {
    const t = useTranslations("documents");
    const tc = useTranslations("common");
    const td = useTranslations("directories");
    const router = useRouter();
    const queryClient = useQueryClient();

    // Fetch Data
    const { data: warehouses } = useQuery<Warehouse[]>({
        queryKey: ["warehouses"],
        queryFn: async () => (await api.get("/directories/warehouses/")).data.results,
    });

    const { data: items } = useQuery<Item[]>({
        queryKey: ["items"],
        queryFn: async () => (await api.get("/directories/items/")).data.results,
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: {
            number: initialData?.number || "",
            date: initialData?.date
                ? new Date(initialData.date).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0],
            warehouse: initialData?.warehouse || undefined,
            materials_warehouse: initialData?.materials_warehouse || undefined,
            production_account_code: initialData?.production_account_code || "20.01",
            comment: initialData?.comment || "",
            products: initialData?.products?.map((p) => ({
                item: p.item,
                quantity: Number(p.quantity),
                price: Number(p.price),
            })) || [{ item: 0, quantity: 1, price: 0 }],
            materials: initialData?.materials?.map((m) => ({
                item: m.item,
                quantity: Number(m.quantity),
                cost_price: Number(m.cost_price || 0),
            })) || [],
        },
    });

    const productsField = useFieldArray({
        control: form.control,
        name: "products",
    });

    const materialsField = useFieldArray({
        control: form.control,
        name: "materials",
    });

    // Calculate Totals (Informational)
    const productTotal = form.watch("products").reduce((sum, line) => sum + ((line.quantity || 0) * (line.price || 0)), 0);


    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            const payload = { ...values };
            if (mode === "create") {
                return api.post("/documents/production/", payload);
            } else {
                return api.put(`/documents/production/${initialData!.id}/`, payload);
            }
        },
        onSuccess: () => {
            toast.success(tc("savedSuccessfully"));
            queryClient.invalidateQueries({ queryKey: ["production"] });
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
            onSuccess: () => router.push("/documents/production"),
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
            onClick: () => router.push("/documents/production"),
            variant: "ghost",
            shortcut: "Esc",
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <CommandBar mainActions={actions} className="border-b shrink-0" />

            <div className="flex-1 overflow-auto p-6">
                <Form {...form}>
                    <form className="space-y-8 max-w-5xl mx-auto">
                        {/* Header */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <FormField
                                control={form.control}
                                name="number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc("number")}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc("date")}</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="warehouse"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Output Warehouse</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(Number(val))}
                                            value={field.value?.toString()}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={tc("selectWarehouse")} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {warehouses?.map((w) => (
                                                    <SelectItem key={w.id} value={w.id.toString()}>
                                                        {w.name}
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
                                name="materials_warehouse"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Materials Warehouse (Optional)</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(Number(val))}
                                            value={field.value?.toString()}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Same as Output" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {warehouses?.map((w) => (
                                                    <SelectItem key={w.id} value={w.id.toString()}>
                                                        {w.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="comment"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{tc("comment")}</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Tabs defaultValue="products">
                            <TabsList>
                                <TabsTrigger value="products">Products (Output)</TabsTrigger>
                                <TabsTrigger value="materials">Materials (Input)</TabsTrigger>
                            </TabsList>

                            {/* Products Tab */}
                            <TabsContent value="products" className="border rounded-md p-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[300px]">{td("item")}</TableHead>
                                            <TableHead>{tc("quantity")}</TableHead>
                                            <TableHead>Planned Price</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {productsField.fields.map((field, index) => {
                                            const qty = form.watch(`products.${index}.quantity`) || 0;
                                            const price = form.watch(`products.${index}.price`) || 0;
                                            return (
                                                <TableRow key={field.id}>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`products.${index}.item`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <Select
                                                                        onValueChange={(val) => field.onChange(Number(val))}
                                                                        value={field.value?.toString()}
                                                                    >
                                                                        <FormControl>
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder={td("selectItem")} />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            {items?.map((item) => (
                                                                                <SelectItem key={item.id} value={item.id.toString()}>
                                                                                    {item.name}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`products.${index}.quantity`}
                                                            render={({ field }) => (
                                                                <Input type="number" step="0.001" {...field} />
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`products.${index}.price`}
                                                            render={({ field }) => (
                                                                <Input type="number" step="0.01" {...field} />
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {(qty * price).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => productsField.remove(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                                <div className="pt-4 flex justify-between">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => productsField.append({ item: 0, quantity: 1, price: 0 })}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Product
                                    </Button>
                                    <div className="font-bold">
                                        Total Planned Cost: {productTotal.toFixed(2)}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Materials Tab */}
                            <TabsContent value="materials" className="border rounded-md p-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[300px]">{td("item")}</TableHead>
                                            <TableHead>{tc("quantity")}</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materialsField.fields.map((field, index) => (
                                            <TableRow key={field.id}>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`materials.${index}.item`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <Select
                                                                    onValueChange={(val) => field.onChange(Number(val))}
                                                                    value={field.value?.toString()}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder={td("selectItem")} />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {items?.map((item) => (
                                                                            <SelectItem key={item.id} value={item.id.toString()}>
                                                                                {item.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`materials.${index}.quantity`}
                                                        render={({ field }) => (
                                                            <Input type="number" step="0.001" {...field} />
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => materialsField.remove(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <div className="pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => materialsField.append({ item: 0, quantity: 1 })}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Material
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>

                    </form>
                </Form>
            </div>
        </div>
    );
}
