"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { format } from "date-fns";
import { toast } from "sonner";
import { PiPlusBold } from "react-icons/pi";

interface ItemPriceDialogProps {
  itemId: number;
}

interface Currency {
  id: number;
  code: string;
  name: string;
}

export function ItemPriceDialog({ itemId }: ItemPriceDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [priceType, setPriceType] = useState("selling");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("");

  const { data: currenciesData } = useQuery<{ results: Currency[] }>({
    queryKey: ["currencies"],
    queryFn: () => api.get("/directories/currencies/"),
    enabled: open,
  });

  const currencies = currenciesData?.results || [];

  const mutation = useMutation({
    mutationFn: async () => {
      return api.post("/registers/item-prices/", {
        item: itemId,
        date: date,
        price_type: priceType,
        price: Number(price),
        currency: Number(currency),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item", itemId, "prices"] });
      toast.success("Price updated", {
        description: "New price has been set successfully.",
      });
      setOpen(false);
      // reset form
      setPrice("");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error("Error", {
        description: err?.response?.data?.detail || "Failed to set price.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currency) {
      toast.error("Error", { description: "Select a currency" });
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PiPlusBold className="mr-2" />
          Set New Price
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set New Price</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Effective Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Price Type</Label>
            <Select value={priceType} onValueChange={setPriceType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="selling">Selling (Sale Price)</SelectItem>
                <SelectItem value="purchase">Purchase Cost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((curr) => (
                  <SelectItem key={curr.id} value={curr.id.toString()}>
                    {curr.code} - {curr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Price</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Price"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
