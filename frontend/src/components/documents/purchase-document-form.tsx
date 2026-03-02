"use client"

import { useEffect, useRef, useState, useMemo, useSyncExternalStore, type Dispatch, type SetStateAction } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useHotkeys } from "react-hotkeys-hook"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import api from "@/lib/api"
import {
    PurchaseDocument,
    PurchaseDocumentLine
} from "@/types"
import {
    PiFloppyDiskBold,
    PiCaretDownBold,
    PiCheckCircleBold,
    PiMagnifyingGlassBold,
    PiPrinterBold,
    PiXBold,
    PiPlusBold,
    PiTrashBold,
    PiLockKeyBold
} from "react-icons/pi"
import { cn } from "@/lib/utils"
import { mapApiError } from "@/lib/error-mapper"
import { PrintPreviewDialog } from "@/components/documents/print-preview-dialog"
import { useAppStore } from "@/stores/app-store"
import { UnitSelector } from "@/components/ui/unit-selector"
import { InterfaceModeToggle } from "@/components/interface-mode-toggle"
import { ReferenceSelector } from "@/components/ui/reference-selector"
import { LiveStockPanel } from "@/components/documents/live-stock-panel"
import { LiveSettlementPanel } from "@/components/documents/live-settlement-panel"
import { DocumentPostings } from "@/components/documents/document-postings"
import { DocumentHistoryPanel } from "@/components/documents/document-history-panel"

type PurchaseFormInitialData = Omit<
    Partial<PurchaseDocument>,
    'contract' | 'warehouse' | 'currency' | 'project' | 'department'
> & {
    supplier?: number | null;
    counterparty?: number | { id?: unknown } | null;
    contract?: number | { id?: unknown } | null;
    warehouse?: number | { id?: unknown } | null;
    currency?: number | { id?: unknown } | null;
    project?: number | { id?: unknown } | null;
    department?: number | { id?: unknown } | null;
    rate?: number;
    exchange_rate?: number;
    lines?: PurchaseDocumentLine[];
};

interface PurchaseDocumentFormProps {
    initialData?: PurchaseFormInitialData;
    mode: 'create' | 'edit'
}

type PurchaseFormData = Partial<PurchaseDocument> & {
    counterparty?: number | null;
    rate?: number;
};

type PurchasePayload = {
    number?: string;
    date?: string;
    comment?: string;
    counterparty?: number | null;
    contract?: number | null;
    warehouse?: number | null;
    currency?: number | null;
    rate?: number;
    project?: number | null;
    department?: number | null;
    lines: Array<{
        item: number;
        quantity: number;
        package: number | null;
        coefficient: number;
        price: number;
        vat_rate: number;
    }>;
};

type ActiveCell = { row: number, col: string } | null;
type PurchaseLineRow = {
    index: number;
    original: PurchaseDocumentLine;
};
type ItemPackageOption = {
    id: number | null;
    name: string;
    coefficient: number;
};
type ItemReferenceData = {
    id?: number;
    name?: string;
    sku?: string;
    item_type?: "GOODS" | "SERVICE";
    unit?: string;
    base_unit?: string;
    purchase_price?: number | string;
    selling_price?: number | string;
    packages?: Array<{
        id: number;
        name: string;
        coefficient: number | string;
    }>;
};

type CurrencyOption = {
    id: number;
    code: string;
    name: string;
};

type ListResponse<T> = { results?: T[] } | T[];

type PurchaseSourceMode =
    | "production"
    | "semifinished"
    | "suppliers"
    | "return"
    | "opening"
    | "inventory";

type MovementMode = "direct" | "converted";

type PurchaseLineUiState = {
    itemName: string;
    itemTypeLabel: string;
    unitLabel: string;
    m3Value: string;
    note: string;
    recipeId: string | null;
    recipeName: string;
};

type ItemDraft = {
    code: string;
    name: string;
    sku: string;
    weight: string;
    productType: "production" | "material" | "fixed_asset" | "goods" | "service";
    size: string;
    itemType: "GOODS" | "SERVICE";
    unit: string;
    itemKind: string;
    manufacturer: string;
    parentCategoryId: number | null;
    currencyId: number | null;
    expiryDate: string;
    barcode: string;
    packageOneQuantity: string;
    packageOneLabel: string;
    packageTwoQuantity: string;
    packageTwoLabel: string;
    calcMethod: "quantity" | "package_one" | "package_two";
    stockMin: string;
    stockAvg: string;
    purchasePrice: string;
    sellingPrice: string;
};

type ItemCreateTab = "main" | "norm" | "work_price";
type ItemCreateTableTab = "norm" | "prices" | "barcodes";

type ItemMetaOption = {
    id: string;
    code: number;
    name: string;
    fullName?: string;
    maxDiscount?: string;
};

type ItemCategoryOption = {
    id: number;
    name: string;
    code?: string;
    parent?: number | null;
};

type ItemNormDraftLine = {
    id: string;
    itemName: string;
    code: string;
    unit: string;
    quantity: string;
    productType: string;
};

type ItemPriceDraftLine = {
    id: string;
    name: string;
    price: string;
};

type ItemBarcodeDraftLine = {
    id: string;
    barcode: string;
};

type UnitDraft = {
    name: string;
    fullName: string;
};

type ItemKindDraft = {
    name: string;
};

type ManufacturerDraft = {
    name: string;
    maxDiscount: string;
};

type CounterpartyReferenceData = {
    id: number;
    name: string;
    inn?: string;
    type?: "CUSTOMER" | "SUPPLIER" | "AGENT";
    phone?: string;
    email?: string;
    address?: string;
};

type CounterpartyGroupOption = {
    id: string;
    name: string;
    type: CounterpartyReferenceData["type"] | null;
};

type CounterpartyDraft = {
    name: string;
    inn: string;
    type: "CUSTOMER" | "SUPPLIER" | "AGENT";
    phone: string;
    email: string;
    address: string;
    groupId: string | null;
};

type CategoryDraft = {
    name: string;
    code: string;
};

type RecipeLineDraft = {
    id: string;
    itemId: number | null;
    quantity: string;
};

type RecipeOption = {
    id: string;
    code: number;
    name: string;
    owner: string;
    comment: string;
    lines: Array<{
        itemId: number;
        itemName: string;
        unitLabel: string;
        quantity: number;
    }>;
};

type RecipeDraft = {
    name: string;
    owner: string;
    comment: string;
};

const RECIPE_STORAGE_KEY = "purchase-form-recipes";
const UNIT_OPTIONS_STORAGE_KEY = "purchase-form-unit-options";
const ITEM_KIND_OPTIONS_STORAGE_KEY = "purchase-form-item-kind-options";
const MANUFACTURER_OPTIONS_STORAGE_KEY = "purchase-form-manufacturer-options";
const COUNTERPARTY_GROUPS_STORAGE_KEY = "purchase-form-counterparty-groups";
const COUNTERPARTY_GROUP_ASSIGNMENTS_STORAGE_KEY = "purchase-form-counterparty-group-assignments";
const DEFAULT_RECIPE_DRAFT: RecipeDraft = {
    name: "",
    owner: "",
    comment: "",
};
const DEFAULT_ITEM_DRAFT: ItemDraft = {
    code: "0",
    name: "",
    sku: "",
    weight: "0,000",
    productType: "production",
    size: "",
    itemType: "GOODS",
    itemKind: "",
    manufacturer: "",
    parentCategoryId: null,
    currencyId: null,
    expiryDate: "",
    barcode: "",
    packageOneQuantity: "0,000000",
    packageOneLabel: "",
    packageTwoQuantity: "0,000000",
    packageTwoLabel: "",
    calcMethod: "quantity",
    stockMin: "0,00",
    stockAvg: "0,00",
    unit: "шт",
    purchasePrice: "0",
    sellingPrice: "0",
};

const DEFAULT_UNIT_OPTIONS: ItemMetaOption[] = [
    { id: "unit-1", code: 1, name: "шт", fullName: "Штука" },
    { id: "unit-2", code: 2, name: "пач", fullName: "Пачка" },
    { id: "unit-3", code: 3, name: "кг", fullName: "Килограмм" },
    { id: "unit-4", code: 4, name: "м3", fullName: "Кубический метр" },
];

const DEFAULT_ITEM_KIND_OPTIONS: ItemMetaOption[] = [
    { id: "kind-1", code: 1, name: "Оптовый товар" },
    { id: "kind-2", code: 2, name: "Розничный товар" },
    { id: "kind-3", code: 3, name: "ОС" },
    { id: "kind-4", code: 4, name: "Услуги" },
];

const DEFAULT_MANUFACTURER_OPTIONS: ItemMetaOption[] = [
    { id: "manufacturer-1", code: 1, name: "LesTex", maxDiscount: "0,00" },
];

const DEFAULT_COUNTERPARTY_GROUPS: CounterpartyGroupOption[] = [
    { id: "cp-group-suppliers", name: "Поставщики", type: "SUPPLIER" },
    { id: "cp-group-customers", name: "Покупатели", type: "CUSTOMER" },
    { id: "cp-group-other", name: "Прочие", type: "AGENT" },
];

const DEFAULT_COUNTERPARTY_DRAFT: CounterpartyDraft = {
    name: "",
    inn: "",
    type: "SUPPLIER",
    phone: "",
    email: "",
    address: "",
    groupId: "cp-group-suppliers",
};

const sourceOptions: Array<{ id: PurchaseSourceMode; label: string }> = [
    { id: "production", label: "Производство" },
    { id: "semifinished", label: "Полуфабрикат" },
    { id: "suppliers", label: "Поставщики" },
    { id: "return", label: "Возврат складу" },
    { id: "opening", label: "Ввод остатков" },
    { id: "inventory", label: "Инвентаризация" },
];

function formatBaseQuantity(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
}

function normalizeReferenceId(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'object' && value && 'id' in value) {
        const maybeId = Number((value as { id?: unknown }).id);
        return Number.isFinite(maybeId) ? maybeId : null;
    }

    const maybeId = Number(value);
    return Number.isFinite(maybeId) ? maybeId : null;
}

function createDefaultPurchaseFormData(): PurchaseFormData {
    return {
        date: new Date().toISOString(),
        status: 'draft',
        lines: [],
        currency: 1,
        rate: 1,
        contract: null,
        counterparty: null,
    };
}

function normalizePurchaseFormData(initialData?: PurchaseFormInitialData): PurchaseFormData {
    if (!initialData) {
        return createDefaultPurchaseFormData();
    }

    return {
        ...initialData,
        counterparty: normalizeReferenceId(initialData.counterparty ?? initialData.supplier),
        contract: normalizeReferenceId(initialData.contract),
        warehouse: normalizeReferenceId(initialData.warehouse) ?? undefined,
        currency: normalizeReferenceId(initialData.currency) ?? 1,
        project: normalizeReferenceId(initialData.project),
        department: normalizeReferenceId(initialData.department),
        rate: Number(initialData.rate ?? initialData.exchange_rate ?? 1) || 1,
    };
}

function normalizeListResponse<T>(response: ListResponse<T> | undefined): T[] {
    if (!response) return [];
    return Array.isArray(response) ? response : response.results || [];
}

function normalizeUiNumber(value: string): number {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function createDefaultLineUiState(): PurchaseLineUiState {
    return {
        itemName: "",
        itemTypeLabel: "",
        unitLabel: "",
        m3Value: "0,0000",
        note: "",
        recipeId: null,
        recipeName: "",
    };
}

function getStoredRecipes(): RecipeOption[] {
    if (typeof window === "undefined") {
        return [];
    }

    try {
        const rawValue = window.localStorage.getItem(RECIPE_STORAGE_KEY);
        if (!rawValue) {
            return [];
        }

        const parsed = JSON.parse(rawValue) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map((item, index) => {
                if (!item || typeof item !== "object") {
                    return null;
                }

                const raw = item as Record<string, unknown>;
                const name = String(raw.name || "").trim();
                if (!name) {
                    return null;
                }

                const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
                return {
                    id: String(raw.id || `recipe-${index + 1}`),
                    code: Number(raw.code || index + 1),
                    name,
                    owner: String(raw.owner || ""),
                    comment: String(raw.comment || ""),
                    lines: rawLines
                        .map((line, lineIndex) => {
                            if (!line || typeof line !== "object") {
                                return null;
                            }

                            const rawLine = line as Record<string, unknown>;
                            const itemId = Number(rawLine.itemId || 0);
                            if (!itemId) {
                                return null;
                            }

                            return {
                                itemId,
                                itemName: String(rawLine.itemName || `#${itemId}`),
                                unitLabel: String(rawLine.unitLabel || ""),
                                quantity: Number(rawLine.quantity || 0),
                                id: lineIndex,
                            };
                        })
                        .filter(Boolean)
                        .map((line) => ({
                            itemId: (line as { itemId: number }).itemId,
                            itemName: (line as { itemName: string }).itemName,
                            unitLabel: (line as { unitLabel: string }).unitLabel,
                            quantity: (line as { quantity: number }).quantity,
                        })),
                } satisfies RecipeOption;
            })
            .filter((item): item is RecipeOption => Boolean(item));
    } catch {
        return [];
    }
}

function getStoredItemMetaOptions(storageKey: string, fallback: ItemMetaOption[]): ItemMetaOption[] {
    if (typeof window === "undefined") {
        return fallback
    }

    try {
        const rawValue = window.localStorage.getItem(storageKey)
        if (!rawValue) {
            return fallback
        }

        const parsed = JSON.parse(rawValue) as unknown
        if (!Array.isArray(parsed)) {
            return fallback
        }

        const items = parsed
            .map((item, index) => {
                if (!item || typeof item !== "object") {
                    return null
                }

                const raw = item as Record<string, unknown>
                const name = String(raw.name || "").trim()
                if (!name) {
                    return null
                }

                return {
                    id: String(raw.id || `meta-${index + 1}`),
                    code: Number(raw.code || index + 1),
                    name,
                    fullName: raw.fullName ? String(raw.fullName) : undefined,
                    maxDiscount: raw.maxDiscount ? String(raw.maxDiscount) : undefined,
                } satisfies ItemMetaOption
            })
            .filter(Boolean) as ItemMetaOption[]

        return items.length > 0 ? items : fallback
    } catch {
        return fallback
    }
}

function getStoredCounterpartyGroups(): CounterpartyGroupOption[] {
    if (typeof window === "undefined") {
        return DEFAULT_COUNTERPARTY_GROUPS
    }

    try {
        const rawValue = window.localStorage.getItem(COUNTERPARTY_GROUPS_STORAGE_KEY)
        if (!rawValue) {
            return DEFAULT_COUNTERPARTY_GROUPS
        }

        const parsed = JSON.parse(rawValue) as unknown
        if (!Array.isArray(parsed)) {
            return DEFAULT_COUNTERPARTY_GROUPS
        }

        const groups = parsed
            .map((item, index) => {
                if (!item || typeof item !== "object") {
                    return null
                }

                const raw = item as Record<string, unknown>
                const name = String(raw.name || "").trim()
                if (!name) {
                    return null
                }

                const type = raw.type
                return {
                    id: String(raw.id || `counterparty-group-${index + 1}`),
                    name,
                    type: type === "CUSTOMER" || type === "SUPPLIER" || type === "AGENT" ? type : null,
                } satisfies CounterpartyGroupOption
            })
            .filter(Boolean) as CounterpartyGroupOption[]

        return groups.length > 0 ? groups : DEFAULT_COUNTERPARTY_GROUPS
    } catch {
        return DEFAULT_COUNTERPARTY_GROUPS
    }
}

function getStoredCounterpartyGroupAssignments(): Record<number, string> {
    if (typeof window === "undefined") {
        return {}
    }

    try {
        const rawValue = window.localStorage.getItem(COUNTERPARTY_GROUP_ASSIGNMENTS_STORAGE_KEY)
        if (!rawValue) {
            return {}
        }

        const parsed = JSON.parse(rawValue) as unknown
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {}
        }

        const next: Record<number, string> = {}
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            const numericKey = Number(key)
            if (!Number.isFinite(numericKey) || typeof value !== "string" || !value.trim()) {
                continue
            }
            next[numericKey] = value
        }

        return next
    } catch {
        return {}
    }
}

// Helper: Transform DB Line (Base) to UI Line (Package)
const toUiLine = (line: PurchaseDocumentLine): PurchaseDocumentLine => {
    const coef = Number(line.coefficient) || 1;
    return {
        ...line,
        quantity: Number(line.quantity) / coef,
        price: Number(line.price) * coef,
    }
}

// Helper: Transform UI Line (Package) to DB Line (Base)
const toDbLine = (line: PurchaseDocumentLine) => {
    const coef = Number(line.coefficient) || 1;
    return {
        item: line.item,
        quantity: (Number(line.quantity) || 0) * coef,
        package: line.package ?? null,
        coefficient: coef,
        price: (Number(line.price) || 0) / coef,
        vat_rate: Number(line.vat_rate) || 0,
    }
}

// Helper component to fetch item details for the Unit cell
function UnitCell({ row, activeCell, isPosted, onUpdate }: { row: PurchaseLineRow, activeCell: ActiveCell, isPosted: boolean, onUpdate: (updates: Partial<PurchaseDocumentLine>) => void }) {
    const itemId = row.original.item;
    const { data: item } = useQuery<ItemReferenceData | null>({
        queryKey: ['items', itemId, 'detail'],
        queryFn: async () => {
            if (!itemId) return null;
            const res = await api.get<ItemReferenceData>(`/directories/items/${itemId}/`);
            return res;
        },
        enabled: !!itemId
    });

    if (!item) return <div className="h-full w-full p-2 text-xs text-muted-foreground">Select Item...</div>;

    // Always include base unit
    const baseUnit: ItemPackageOption = { id: null, name: item.unit || 'units', coefficient: 1 };
    const packages = Array.isArray(item.packages) ? item.packages : [];
    const units: ItemPackageOption[] = [
        baseUnit,
        ...packages.map((p) => ({
            id: p.id,
            name: p.name,
            coefficient: Number(p.coefficient)
        }))
    ];

    // Construct units list including base
    // If item.unit is "pcs", we should probably have a "base" option.
    // But UnitSelector usually takes "packages".
    // If no package selected, it's base unit.

    return (
        <div className={cn("h-full w-full", activeCell?.row === row.index && activeCell?.col === 'package' && "ring-2 ring-primary z-10 relative")}>
            <UnitSelector
                value={row.original.package || null}
                units={units}
                baseUnit={item.unit || 'units'}
                onChange={(unitId, coefficient) => {
                    onUpdate({
                        package: unitId,
                        coefficient: coefficient // Store coefficient!
                    });
                }}
                disabled={isPosted}
            />
        </div>
    );
}

// Helper to calculate base quantity display
function BaseQtyCell({ row, activeCell, isPosted, onUpdate }: { row: PurchaseLineRow, activeCell: ActiveCell, isPosted: boolean, onUpdate: (val: number) => void }) {
    // We need current coefficient to display base qty
    // Since we store coefficient in line, we use it.
    // Fallback to 1 if missing.
    const coef = Number(row.original.coefficient) || 1;
    const qty = Number(row.original.quantity) || 0;
    const baseQty = qty * coef;

    // We need item base unit name
    const itemId = row.original.item;
    const { data: item } = useQuery<ItemReferenceData | null>({
        queryKey: ['items', itemId, 'minimal'],
        queryFn: async () => {
            if (!itemId) return null;
            const res = await api.get<ItemReferenceData>(`/directories/items/${itemId}/`);
            return res;
        },
        enabled: !!itemId,
        staleTime: 60000 // Cache for a bit
    });

    const baseUnitName = item?.unit || item?.base_unit || '';

    return (
        <div className="flex gap-1">
            <Input
                id={`p-cell-${row.index}-quantity`}
                type="number"
                step="0.001"
                min="0"
                disabled={isPosted}
                className={cn("h-8 w-20 text-right px-1 border-transparent focus:border-transparent focus:ring-0 rounded-none bg-transparent hover:bg-muted/10 transition-colors", activeCell?.row === row.index && activeCell?.col === 'quantity' && "bg-background ring-2 ring-primary z-20 relative font-bold")}
                value={row.original.quantity}
                // onKeyDown handled in parent
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    onUpdate(Number.isFinite(value) ? value : 0);
                }}
            />
            <div className="flex flex-col justify-center px-1 border-l border-dashed min-w-[3rem]">
                <span className="text-[9px] text-muted-foreground leading-none">Base</span>
                <span className="text-[10px] font-mono text-muted-foreground text-right font-bold">{formatBaseQuantity(baseQty)} <span className="text-[8px] font-normal">{baseUnitName}</span></span>
            </div>
        </div>
    )
}


export function PurchaseDocumentForm({ initialData, mode }: PurchaseDocumentFormProps) {
    const t = useTranslations('documents')
    const tc = useTranslations('common')
    const tf = useTranslations('fields')
    const router = useRouter()
    const queryClient = useQueryClient()
    const tempLineIdRef = useRef(-1)
    const tempRecipeLineIdRef = useRef(1)
    const tempRecipeIdRef = useRef(1)
    const tempSkuRef = useRef(1)
    const tempItemCreateRowIdRef = useRef(1)

    const hasMounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    )
    const [printOpen, setPrintOpen] = useState(false)
    const [sourceMode, setSourceMode] = useState<PurchaseSourceMode>("production")
    const [invoiceNumber, setInvoiceNumber] = useState("")
    const [invoiceDate, setInvoiceDate] = useState("")
    const [vehicleNumber, setVehicleNumber] = useState("")
    const [formation, setFormation] = useState("")
    const [materialsWarehouseId, setMaterialsWarehouseId] = useState<number | null>(null)
    const [movementMode, setMovementMode] = useState<MovementMode>("direct")
    const [priceListName, setPriceListName] = useState("")
    const [createSearchValue, setCreateSearchValue] = useState("")
    const [lineUiState, setLineUiState] = useState<Record<number, PurchaseLineUiState>>({})
    const [recipes, setRecipes] = useState<RecipeOption[]>(() => getStoredRecipes())
    const [activeItemRowId, setActiveItemRowId] = useState<number | null>(null)
    const [isItemListOpen, setIsItemListOpen] = useState(false)
    const [isItemCreateOpen, setIsItemCreateOpen] = useState(false)
    const [itemCreateMode, setItemCreateMode] = useState<"item" | "group">("item")
    const [itemSearch, setItemSearch] = useState("")
    const [itemSelectionId, setItemSelectionId] = useState<number | null>(null)
    const [itemDraft, setItemDraft] = useState<ItemDraft>(DEFAULT_ITEM_DRAFT)
    const [itemCreateTab, setItemCreateTab] = useState<ItemCreateTab>("main")
    const [itemCreateTableTab, setItemCreateTableTab] = useState<ItemCreateTableTab>("norm")
    const [unitOptions, setUnitOptions] = useState<ItemMetaOption[]>(() => getStoredItemMetaOptions(UNIT_OPTIONS_STORAGE_KEY, DEFAULT_UNIT_OPTIONS))
    const [itemKindOptions, setItemKindOptions] = useState<ItemMetaOption[]>(() => getStoredItemMetaOptions(ITEM_KIND_OPTIONS_STORAGE_KEY, DEFAULT_ITEM_KIND_OPTIONS))
    const [manufacturerOptions, setManufacturerOptions] = useState<ItemMetaOption[]>(() => getStoredItemMetaOptions(MANUFACTURER_OPTIONS_STORAGE_KEY, DEFAULT_MANUFACTURER_OPTIONS))
    const [itemNormLines, setItemNormLines] = useState<ItemNormDraftLine[]>([])
    const [activeItemNormRowId, setActiveItemNormRowId] = useState<string | null>(null)
    const [itemNormPopoverOpenFor, setItemNormPopoverOpenFor] = useState<string | null>(null)
    const [itemNormSearch, setItemNormSearch] = useState("")
    const [isItemNormListOpen, setIsItemNormListOpen] = useState(false)
    const [itemNormListSelectionId, setItemNormListSelectionId] = useState<number | null>(null)
    const [itemPriceLines, setItemPriceLines] = useState<ItemPriceDraftLine[]>([])
    const [itemBarcodeLines, setItemBarcodeLines] = useState<ItemBarcodeDraftLine[]>([])
    const [isUnitListOpen, setIsUnitListOpen] = useState(false)
    const [isUnitCreateOpen, setIsUnitCreateOpen] = useState(false)
    const [unitSelectionId, setUnitSelectionId] = useState<string | null>(null)
    const [unitSearch, setUnitSearch] = useState("")
    const [isItemKindCreateOpen, setIsItemKindCreateOpen] = useState(false)
    const [isManufacturerListOpen, setIsManufacturerListOpen] = useState(false)
    const [isManufacturerCreateOpen, setIsManufacturerCreateOpen] = useState(false)
    const [manufacturerSelectionId, setManufacturerSelectionId] = useState<string | null>(null)
    const [manufacturerSearch, setManufacturerSearch] = useState("")
    const [isParentListOpen, setIsParentListOpen] = useState(false)
    const [isCategoryCreateOpen, setIsCategoryCreateOpen] = useState(false)
    const [parentSearch, setParentSearch] = useState("")
    const [parentSelectionId, setParentSelectionId] = useState<number | null>(null)
    const [unitDraft, setUnitDraft] = useState<UnitDraft>({ name: "", fullName: "" })
    const [itemKindDraft, setItemKindDraft] = useState<ItemKindDraft>({ name: "" })
    const [manufacturerDraft, setManufacturerDraft] = useState<ManufacturerDraft>({ name: "", maxDiscount: "0,00" })
    const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({ name: "", code: "" })
    const [counterpartySearch, setCounterpartySearch] = useState("")
    const [counterpartySelectionId, setCounterpartySelectionId] = useState<number | null>(null)
    const [isCounterpartyListOpen, setIsCounterpartyListOpen] = useState(false)
    const [isCounterpartyCreateOpen, setIsCounterpartyCreateOpen] = useState(false)
    const [counterpartyCreateMode, setCounterpartyCreateMode] = useState<"item" | "group">("item")
    const [counterpartyDraft, setCounterpartyDraft] = useState<CounterpartyDraft>(DEFAULT_COUNTERPARTY_DRAFT)
    const [counterpartyGroups, setCounterpartyGroups] = useState<CounterpartyGroupOption[]>(() => getStoredCounterpartyGroups())
    const [counterpartyGroupAssignments, setCounterpartyGroupAssignments] = useState<Record<number, string>>(() => getStoredCounterpartyGroupAssignments())
    const [activeNoteRowId, setActiveNoteRowId] = useState<number | null>(null)
    const [isNotePopoverOpen, setIsNotePopoverOpen] = useState(false)
    const [noteDraft, setNoteDraft] = useState("")
    const [activeRecipeRowId, setActiveRecipeRowId] = useState<number | null>(null)
    const [isRecipePopoverOpen, setIsRecipePopoverOpen] = useState(false)
    const [isRecipeListOpen, setIsRecipeListOpen] = useState(false)
    const [isRecipeCreateOpen, setIsRecipeCreateOpen] = useState(false)
    const [recipeSearch, setRecipeSearch] = useState("")
    const [recipeSelectionId, setRecipeSelectionId] = useState<string | null>(null)
    const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>(DEFAULT_RECIPE_DRAFT)
    const [recipeDraftLines, setRecipeDraftLines] = useState<RecipeLineDraft[]>([
        { id: "recipe-line-initial", itemId: null, quantity: "1" },
    ])

    const { data: itemsRaw = [] } = useQuery<ListResponse<ItemReferenceData>>({
        queryKey: ["purchase-form-items"],
        queryFn: () => api.get<ListResponse<ItemReferenceData>>("/directories/items/"),
        initialData: [],
    })
    const items = useMemo(() => normalizeListResponse(itemsRaw), [itemsRaw])

    const { data: currenciesRaw = [] } = useQuery<ListResponse<CurrencyOption>>({
        queryKey: ["purchase-form-currencies"],
        queryFn: () => api.get<ListResponse<CurrencyOption>>("/directories/currencies/"),
        initialData: [],
    })
    const currencies = useMemo(() => normalizeListResponse(currenciesRaw), [currenciesRaw])

    const { data: categoriesRaw = [] } = useQuery<ListResponse<ItemCategoryOption>>({
        queryKey: ["purchase-form-categories"],
        queryFn: () => api.get<ListResponse<ItemCategoryOption>>("/directories/categories/"),
        initialData: [],
    })
    const categories = useMemo(() => normalizeListResponse(categoriesRaw), [categoriesRaw])

    const { data: counterpartiesRaw = [] } = useQuery<ListResponse<CounterpartyReferenceData>>({
        queryKey: ["purchase-form-counterparties"],
        queryFn: () => api.get<ListResponse<CounterpartyReferenceData>>("/directories/counterparties/"),
        initialData: [],
    })
    const counterparties = useMemo(() => normalizeListResponse(counterpartiesRaw), [counterpartiesRaw])

    const nextTemporaryLineId = () => {
        const currentValue = tempLineIdRef.current
        tempLineIdRef.current -= 1
        return currentValue
    }

    const nextRecipeLineId = () => {
        const currentValue = tempRecipeLineIdRef.current
        tempRecipeLineIdRef.current += 1
        return `recipe-line-${currentValue}`
    }

    const nextRecipeId = () => {
        const currentValue = tempRecipeIdRef.current
        tempRecipeIdRef.current += 1
        return `recipe-${currentValue}`
    }

    const nextGeneratedSku = () => {
        const currentValue = tempSkuRef.current
        tempSkuRef.current += 1
        return `ITEM-${String(currentValue).padStart(6, "0")}`
    }

    const nextItemCreateRowId = (prefix: string) => {
        const currentValue = tempItemCreateRowIdRef.current
        tempItemCreateRowIdRef.current += 1
        return `${prefix}-${currentValue}`
    }

    // Form State
    const [formData, setFormData] = useState<PurchaseFormData>(() =>
        normalizePurchaseFormData(initialData)
    )

    // Derived State
    const { currentTenant } = useAppStore();
    const isPeriodClosed = false; // closingDate not available in store yet
    const isPosted = formData.status === 'posted' || isPeriodClosed;

    // Lines State (UI Units)
    const [lines, setLines] = useState<PurchaseDocumentLine[]>(
        initialData?.lines?.map(toUiLine) || []
    )

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(recipes))
    }, [recipes])

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        window.localStorage.setItem(UNIT_OPTIONS_STORAGE_KEY, JSON.stringify(unitOptions))
    }, [unitOptions])

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        window.localStorage.setItem(ITEM_KIND_OPTIONS_STORAGE_KEY, JSON.stringify(itemKindOptions))
    }, [itemKindOptions])

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        window.localStorage.setItem(MANUFACTURER_OPTIONS_STORAGE_KEY, JSON.stringify(manufacturerOptions))
    }, [manufacturerOptions])

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        window.localStorage.setItem(COUNTERPARTY_GROUPS_STORAGE_KEY, JSON.stringify(counterpartyGroups))
    }, [counterpartyGroups])

    useEffect(() => {
        if (typeof window === "undefined") {
            return
        }

        window.localStorage.setItem(COUNTERPARTY_GROUP_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(counterpartyGroupAssignments))
    }, [counterpartyGroupAssignments])

    const selectedCurrencyCode = useMemo(() => {
        const selectedCurrencyId = normalizeReferenceId(formData.currency)
        return currencies.find((currency) => currency.id === selectedCurrencyId)?.code || "USD"
    }, [currencies, formData.currency])

    const itemDraftCurrencyCode = useMemo(() => {
        if (!itemDraft.currencyId) {
            return selectedCurrencyCode
        }

        return currencies.find((currency) => currency.id === itemDraft.currencyId)?.code || selectedCurrencyCode
    }, [currencies, itemDraft.currencyId, selectedCurrencyCode])

    const selectedParentCategoryName = useMemo(() => {
        if (!itemDraft.parentCategoryId) {
            return ""
        }

        return categories.find((category) => category.id === itemDraft.parentCategoryId)?.name || ""
    }, [categories, itemDraft.parentCategoryId])

    const selectedCounterparty = useMemo(
        () => counterparties.find((counterparty) => counterparty.id === Number(formData.counterparty || 0)) || null,
        [counterparties, formData.counterparty]
    )

    const filteredUnitOptions = useMemo(() => {
        const query = unitSearch.trim().toLowerCase()
        if (!query) {
            return unitOptions
        }

        return unitOptions.filter((option) => {
            const searchable = `${option.name} ${option.fullName || ""} ${option.code}`.toLowerCase()
            return searchable.includes(query)
        })
    }, [unitOptions, unitSearch])

    const filteredManufacturerOptions = useMemo(() => {
        const query = manufacturerSearch.trim().toLowerCase()
        if (!query) {
            return manufacturerOptions
        }

        return manufacturerOptions.filter((option) => {
            const searchable = `${option.name} ${option.maxDiscount || ""} ${option.code}`.toLowerCase()
            return searchable.includes(query)
        })
    }, [manufacturerOptions, manufacturerSearch])

    const filteredCounterparties = useMemo(() => {
        const query = counterpartySearch.trim().toLowerCase()
        if (!query) {
            return counterparties
        }

        return counterparties.filter((counterparty) => {
            const searchable = `${counterparty.name || ""} ${counterparty.inn || ""} ${counterparty.phone || ""}`.toLowerCase()
            return searchable.includes(query)
        })
    }, [counterparties, counterpartySearch])

    const groupedCounterparties = useMemo(() => {
        return counterpartyGroups
            .map((group) => ({
                group,
                items: filteredCounterparties.filter((counterparty) => {
                    const assignedGroupId =
                        counterpartyGroupAssignments[counterparty.id] ||
                        counterpartyGroups.find((entry) => entry.type === counterparty.type)?.id ||
                        DEFAULT_COUNTERPARTY_GROUPS[0].id
                    return assignedGroupId === group.id
                }),
            }))
            .filter((entry) => entry.items.length > 0 || !counterpartySearch.trim())
    }, [counterpartyGroupAssignments, counterpartyGroups, counterpartySearch, filteredCounterparties])

    const filteredItems = useMemo(() => {
        const query = itemSearch.trim().toLowerCase()
        if (!query) {
            return items
        }

        return items.filter((item) => {
            const searchable = `${item.name || ""} ${item.sku || ""}`.toLowerCase()
            return searchable.includes(query)
        })
    }, [itemSearch, items])

    const filteredItemNormItems = useMemo(() => {
        const query = itemNormSearch.trim().toLowerCase()
        if (!query) {
            return items
        }

        return items.filter((item) => {
            const searchable = `${item.name || ""} ${item.sku || ""}`.toLowerCase()
            return searchable.includes(query)
        })
    }, [itemNormSearch, items])

    const filteredCategories = useMemo(() => {
        const query = parentSearch.trim().toLowerCase()
        if (!query) {
            return categories
        }

        return categories.filter((category) => {
            const searchable = `${category.name || ""} ${category.code || ""}`.toLowerCase()
            return searchable.includes(query)
        })
    }, [categories, parentSearch])

    const filteredCreateLines = useMemo(() => {
        const query = createSearchValue.trim().toLowerCase()
        if (!query) {
            return lines
        }

        return lines.filter((line) => {
            const ui = lineUiState[line.id] || createDefaultLineUiState()
            const searchable = `${ui.itemName} ${ui.note} ${ui.recipeName}`.toLowerCase()
            return searchable.includes(query)
        })
    }, [createSearchValue, lineUiState, lines])

    const filteredRecipes = useMemo(() => {
        const query = recipeSearch.trim().toLowerCase()
        if (!query) {
            return recipes
        }

        return recipes.filter((recipe) => {
            const searchable = `${recipe.name} ${recipe.owner} ${recipe.code}`.toLowerCase()
            return searchable.includes(query)
        })
    }, [recipeSearch, recipes])

    // Prepare Payload for Save/Post
    const preparePayload = (): PurchasePayload => {
        const dbLines = lines.map(toDbLine);
        return {
            number: formData.number || '',
            date: formData.date,
            comment: formData.comment || '',
            counterparty: formData.counterparty ?? null,
            contract: formData.contract ?? null,
            warehouse: formData.warehouse ?? null,
            currency: formData.currency ?? null,
            rate: Number(formData.rate || 1),
            project: formData.project ?? null,
            department: formData.department ?? null,
            lines: dbLines
        };
    }

    const createEmptyLine = (): PurchaseDocumentLine => ({
        id: nextTemporaryLineId(),
        item: 0,
        quantity: 1,
        package: null,
        coefficient: 1,
        price: 0,
        amount: 0,
        vat_rate: 12,
        vat_amount: 0,
        total_with_vat: 0,
        document: initialData?.id || 0,
        warehouse: Number(formData.warehouse) || 1,
        price_base: 0,
        amount_base: 0,
    } as PurchaseDocumentLine)

    const updateLineUi = (
        lineId: number,
        updates: Partial<PurchaseLineUiState> | ((prev: PurchaseLineUiState) => Partial<PurchaseLineUiState>)
    ) => {
        setLineUiState((prev) => {
            const current = prev[lineId] || createDefaultLineUiState()
            const nextUpdates = typeof updates === "function" ? updates(current) : updates
            return {
                ...prev,
                [lineId]: {
                    ...current,
                    ...nextUpdates,
                },
            }
        })
    }

    const removeLineUi = (lineId: number) => {
        setLineUiState((prev) => {
            if (!(lineId in prev)) {
                return prev
            }

            const next = { ...prev }
            delete next[lineId]
            return next
        })
    }

    const applyItemSelection = (lineId: number, item: ItemReferenceData) => {
        const nextItemId = Number(item.id || 0)
        if (!nextItemId) {
            return
        }

        setLines((prev) =>
            prev.map((line) => {
                if (line.id !== lineId) {
                    return line
                }

                const nextLine = {
                    ...line,
                    item: nextItemId,
                    package: null,
                    coefficient: 1,
                    warehouse: Number(formData.warehouse) || line.warehouse || 1,
                    price: Number(item.purchase_price) || 0,
                    vat_rate: Number(line.vat_rate) || 12,
                }

                return recalculateLine(nextLine)
            })
        )

        updateLineUi(lineId, {
            itemName: String(item.name || ""),
            itemTypeLabel: item.item_type === "SERVICE" ? "Услуга" : "Материал",
            unitLabel: String(item.base_unit || item.unit || "шт"),
        })

        setItemPopoverOpenFor(null)
        setItemSearch("")
    }

    const [itemPopoverOpenFor, setItemPopoverOpenFor] = useState<number | null>(null)

    const openItemListDialog = (lineId: number) => {
        setActiveItemRowId(lineId)
        setItemSelectionId(null)
        setItemPopoverOpenFor(null)
        setIsItemListOpen(true)
    }

    const openUnitListDialog = () => {
        setUnitSelectionId(unitOptions.find((option) => option.name === itemDraft.unit)?.id || null)
        setUnitSearch("")
        setIsUnitListOpen(true)
    }

    const openManufacturerListDialog = () => {
        setManufacturerSelectionId(manufacturerOptions.find((option) => option.name === itemDraft.manufacturer)?.id || null)
        setManufacturerSearch("")
        setIsManufacturerListOpen(true)
    }

    const openCounterpartyListDialog = () => {
        setCounterpartySelectionId(selectedCounterparty?.id || null)
        setCounterpartySearch("")
        setIsCounterpartyListOpen(true)
    }

    const openCounterpartyCreateDialog = (mode: "item" | "group") => {
        setCounterpartyCreateMode(mode)
        setCounterpartyDraft({
            ...DEFAULT_COUNTERPARTY_DRAFT,
            groupId:
                selectedCounterparty?.type
                    ? counterpartyGroups.find((group) => group.type === selectedCounterparty.type)?.id || DEFAULT_COUNTERPARTY_DRAFT.groupId
                    : DEFAULT_COUNTERPARTY_DRAFT.groupId,
        })
        setIsCounterpartyCreateOpen(true)
    }

    const applyItemProductType = (nextValue: ItemDraft["productType"]) => {
        setItemDraft((prev) => ({
            ...prev,
            productType: nextValue,
            itemType: nextValue === "service" ? "SERVICE" : "GOODS",
        }))
    }

    const addItemMetaOption = (
        setter: Dispatch<SetStateAction<ItemMetaOption[]>>,
        draftName: string,
        extra: Partial<ItemMetaOption> = {},
        onSelect?: (name: string) => void
    ) => {
        const trimmedName = draftName.trim()
        if (!trimmedName) {
            toast.error("Введите наименование")
            return
        }

        setter((prev) => {
            const nextCode = prev.reduce((maxValue, option) => Math.max(maxValue, option.code), 0) + 1
            const nextOption: ItemMetaOption = {
                id: nextItemCreateRowId("item-meta"),
                code: nextCode,
                name: trimmedName,
                ...extra,
            }
            onSelect?.(nextOption.name)
            return [...prev, nextOption]
        })
    }

    const selectParentCategory = (categoryId: number) => {
        setItemDraft((prev) => ({
            ...prev,
            parentCategoryId: categoryId,
        }))
        setParentSelectionId(categoryId)
        setIsParentListOpen(false)
    }

    const confirmSelectedUnit = () => {
        if (!unitSelectionId) {
            return
        }

        const selectedUnit = unitOptions.find((option) => option.id === unitSelectionId)
        if (!selectedUnit) {
            return
        }

        setItemDraft((prev) => ({ ...prev, unit: selectedUnit.name }))
        setIsUnitListOpen(false)
    }

    const confirmSelectedManufacturer = () => {
        if (!manufacturerSelectionId) {
            return
        }

        const selectedManufacturer = manufacturerOptions.find((option) => option.id === manufacturerSelectionId)
        if (!selectedManufacturer) {
            return
        }

        setItemDraft((prev) => ({ ...prev, manufacturer: selectedManufacturer.name }))
        setIsManufacturerListOpen(false)
    }

    const confirmSelectedCounterparty = () => {
        if (!counterpartySelectionId) {
            return
        }

        setFormData((prev) => ({ ...prev, counterparty: counterpartySelectionId }))
        setIsCounterpartyListOpen(false)
    }

    const applyItemNormSelection = (rowId: string, item: ItemReferenceData) => {
        const itemName = String(item.name || "")
        const itemCode = String(item.sku || item.id || "")
        const unitName = String(item.base_unit || item.unit || "")
        const itemType = item.item_type === "SERVICE" ? "Услуга" : "Материал"

        setItemNormLines((prev) =>
            prev.map((line) =>
                line.id === rowId
                    ? {
                        ...line,
                        itemName,
                        code: itemCode,
                        unit: unitName,
                        productType: itemType,
                    }
                    : line
            )
        )

        setItemNormPopoverOpenFor(null)
        setItemNormSearch("")
    }

    const openItemNormListDialog = (rowId: string) => {
        setActiveItemNormRowId(rowId)
        setItemNormListSelectionId(null)
        setItemNormPopoverOpenFor(null)
        setIsItemNormListOpen(true)
    }

    const confirmSelectedItemNorm = () => {
        if (!activeItemNormRowId || !itemNormListSelectionId) {
            return
        }

        const selectedItem = items.find((item) => Number(item.id) === itemNormListSelectionId)
        if (!selectedItem) {
            return
        }

        applyItemNormSelection(activeItemNormRowId, selectedItem)
        setIsItemNormListOpen(false)
    }

    const openItemCreateDialog = (lineId: number) => {
        const defaultCurrencyId = normalizeReferenceId(formData.currency) ?? currencies[0]?.id ?? null
        setActiveItemRowId(lineId)
        setItemCreateMode("item")
        setItemDraft({
            ...DEFAULT_ITEM_DRAFT,
            code: String(items.length + 1),
            name: itemSearch.trim(),
            sku: nextGeneratedSku(),
            unit: "шт",
            currencyId: defaultCurrencyId,
        })
        setItemCreateTab("main")
        setItemCreateTableTab("norm")
        setItemNormLines([
            {
                id: nextItemCreateRowId("item-norm"),
                itemName: "",
                code: "",
                unit: "",
                quantity: "0,0000",
                productType: "Материал",
            },
        ])
        setItemPriceLines([
            {
                id: nextItemCreateRowId("item-price"),
                name: "Цена работ",
                price: "0",
            },
        ])
        setItemBarcodeLines([
            {
                id: nextItemCreateRowId("item-barcode"),
                barcode: "",
            },
        ])
        setUnitDraft({ name: "", fullName: "" })
        setItemKindDraft({ name: "" })
        setManufacturerDraft({ name: "", maxDiscount: "0,00" })
        setCategoryDraft({ name: "", code: "" })
        setParentSearch("")
        setParentSelectionId(null)
        setItemPopoverOpenFor(null)
        setIsItemCreateOpen(true)
    }

    const openItemGroupCreateDialog = (lineId: number | null) => {
        const defaultCurrencyId = normalizeReferenceId(formData.currency) ?? currencies[0]?.id ?? null
        if (lineId) {
            setActiveItemRowId(lineId)
        }
        setItemCreateMode("group")
        setItemDraft({
            ...DEFAULT_ITEM_DRAFT,
            code: String(categories.length + 1),
            name: itemSearch.trim(),
            sku: "",
            currencyId: defaultCurrencyId,
        })
        setItemCreateTab("main")
        setItemCreateTableTab("norm")
        setUnitDraft({ name: "", fullName: "" })
        setItemKindDraft({ name: "" })
        setManufacturerDraft({ name: "", maxDiscount: "0,00" })
        setCategoryDraft({ name: "", code: "" })
        setParentSearch("")
        setParentSelectionId(itemDraft.parentCategoryId)
        setItemPopoverOpenFor(null)
        setIsItemCreateOpen(true)
    }

    const confirmSelectedItem = () => {
        if (!activeItemRowId || !itemSelectionId) {
            return
        }

        const selectedItem = items.find((item) => Number(item.id) === itemSelectionId)
        if (!selectedItem) {
            return
        }

        applyItemSelection(activeItemRowId, selectedItem)
        setIsItemListOpen(false)
    }

    const createItemMutation = useMutation({
        mutationFn: async () => {
            const packages = [
                itemDraft.packageOneLabel.trim() && normalizeUiNumber(itemDraft.packageOneQuantity) > 0
                    ? {
                        name: itemDraft.packageOneLabel.trim(),
                        coefficient: normalizeUiNumber(itemDraft.packageOneQuantity),
                        is_default: true,
                    }
                    : null,
                itemDraft.packageTwoLabel.trim() && normalizeUiNumber(itemDraft.packageTwoQuantity) > 0
                    ? {
                        name: itemDraft.packageTwoLabel.trim(),
                        coefficient: normalizeUiNumber(itemDraft.packageTwoQuantity),
                        is_default: false,
                    }
                    : null,
            ].filter(Boolean)

            return api.post<ItemReferenceData>("/directories/items/", {
                name: itemDraft.name.trim(),
            sku: itemDraft.sku.trim(),
            item_type: itemDraft.itemType,
            unit: itemDraft.unit.trim() || "шт",
            purchase_price: normalizeUiNumber(itemDraft.purchasePrice),
            selling_price: normalizeUiNumber(itemDraft.sellingPrice),
            category: itemDraft.parentCategoryId,
            packages,
            })
        },
        onSuccess: (createdItem) => {
            queryClient.invalidateQueries({ queryKey: ["purchase-form-items"] })
            toast.success("Номенклатура создана")
            if (activeItemRowId) {
                applyItemSelection(activeItemRowId, createdItem)
            }
            setIsItemCreateOpen(false)
            setItemCreateMode("item")
        },
        onError: (error) => {
            const { title, description } = mapApiError(error)
            toast.error(title, { description })
        },
    })

    const createItemGroupMutation = useMutation({
        mutationFn: async () => {
            const trimmedName = itemDraft.name.trim()
            if (!trimmedName) {
                throw new Error("Введите наименование группы")
            }

            return api.post<ItemCategoryOption>("/directories/categories/", {
                name: trimmedName,
                code: itemDraft.code.trim(),
                parent: itemDraft.parentCategoryId,
            })
        },
        onSuccess: (createdCategory) => {
            queryClient.invalidateQueries({ queryKey: ["purchase-form-categories"] })
            if (createdCategory?.id) {
                setItemDraft((prev) => ({ ...prev, parentCategoryId: createdCategory.id }))
            }
            setIsItemCreateOpen(false)
            setItemCreateMode("item")
            toast.success("Группа номенклатуры создана")
        },
        onError: (error) => {
            const { title, description } =
                error instanceof Error
                    ? { title: error.message, description: "" }
                    : mapApiError(error)
            toast.error(title, description ? { description } : undefined)
        },
    })

    const createCategoryMutation = useMutation({
        mutationFn: async () => {
            const trimmedName = categoryDraft.name.trim()
            if (!trimmedName) {
                throw new Error("Введите наименование группы")
            }

            return api.post<ItemCategoryOption>("/directories/categories/", {
                name: trimmedName,
                code: categoryDraft.code.trim(),
                parent: null,
            })
        },
        onSuccess: (createdCategory) => {
            queryClient.invalidateQueries({ queryKey: ["purchase-form-categories"] })
            if (createdCategory?.id) {
                selectParentCategory(createdCategory.id)
            }
            setIsCategoryCreateOpen(false)
            setCategoryDraft({ name: "", code: "" })
            toast.success("Группа создана")
        },
        onError: (error) => {
            const { title, description } = mapApiError(error)
            toast.error(title, { description })
        },
    })

    const createCounterpartyMutation = useMutation({
        mutationFn: async () => {
            const trimmedName = counterpartyDraft.name.trim()
            if (!trimmedName) {
                throw new Error("Введите наименование контрагента")
            }

            if (counterpartyCreateMode === "group") {
                return {
                    mode: "group" as const,
                    group: {
                        id: `cp-group-custom-${Date.now()}`,
                        name: trimmedName,
                        type: counterpartyDraft.type,
                    } satisfies CounterpartyGroupOption,
                }
            }

            const createdCounterparty = await api.post<CounterpartyReferenceData>("/directories/counterparties/", {
                name: trimmedName,
                inn: counterpartyDraft.inn.trim() || String(Date.now()),
                type: counterpartyDraft.type,
                phone: counterpartyDraft.phone.trim(),
                email: counterpartyDraft.email.trim(),
                address: counterpartyDraft.address.trim(),
            })

            return {
                mode: "item" as const,
                counterparty: createdCounterparty,
            }
        },
        onSuccess: (result) => {
            if (result.mode === "group") {
                setCounterpartyGroups((prev) => {
                    if (prev.some((group) => group.id === result.group.id)) {
                        return prev
                    }
                    return [...prev, result.group]
                })
                setCounterpartyDraft(DEFAULT_COUNTERPARTY_DRAFT)
                setIsCounterpartyCreateOpen(false)
                toast.success("Группа контрагентов создана")
                return
            }

            queryClient.invalidateQueries({ queryKey: ["purchase-form-counterparties"] })
            if (result.counterparty?.id) {
                const resolvedGroupId =
                    counterpartyDraft.groupId ||
                    counterpartyGroups.find((group) => group.type === counterpartyDraft.type)?.id ||
                    DEFAULT_COUNTERPARTY_DRAFT.groupId ||
                    DEFAULT_COUNTERPARTY_GROUPS[0].id
                setCounterpartyGroupAssignments((prev) => ({
                    ...prev,
                    [result.counterparty.id]: resolvedGroupId,
                }))
                setFormData((prev) => ({ ...prev, counterparty: result.counterparty.id }))
            }
            setCounterpartyDraft(DEFAULT_COUNTERPARTY_DRAFT)
            setIsCounterpartyCreateOpen(false)
            toast.success("Контрагент создан")
        },
        onError: (error) => {
            const { title, description } =
                error instanceof Error
                    ? { title: error.message, description: "" }
                    : mapApiError(error)
            toast.error(title, description ? { description } : undefined)
        },
    })

    const openNotePopover = (lineId: number) => {
        const ui = lineUiState[lineId] || createDefaultLineUiState()
        setActiveNoteRowId(lineId)
        setNoteDraft(ui.note)
        setIsNotePopoverOpen(true)
    }

    const saveNote = () => {
        if (!activeNoteRowId) {
            return
        }

        updateLineUi(activeNoteRowId, { note: noteDraft })
        setIsNotePopoverOpen(false)
    }

    const openRecipeListDialog = (lineId: number) => {
        setActiveRecipeRowId(lineId)
        setRecipeSelectionId(null)
        setIsRecipePopoverOpen(false)
        setIsRecipeListOpen(true)
    }

    const openRecipeCreateDialog = (lineId: number) => {
        setActiveRecipeRowId(lineId)
        setRecipeDraft(DEFAULT_RECIPE_DRAFT)
        setRecipeDraftLines([
            { id: nextRecipeLineId(), itemId: null, quantity: "1" },
        ])
        setIsRecipePopoverOpen(false)
        setIsRecipeCreateOpen(true)
    }

    const applyRecipeSelection = (lineId: number, recipe: RecipeOption) => {
        updateLineUi(lineId, {
            recipeId: recipe.id,
            recipeName: recipe.name,
        })
        setIsRecipeListOpen(false)
        setIsRecipePopoverOpen(false)
        setRecipeSearch("")
    }

    const confirmSelectedRecipe = () => {
        if (!activeRecipeRowId || !recipeSelectionId) {
            return
        }

        const selectedRecipe = recipes.find((recipe) => recipe.id === recipeSelectionId)
        if (!selectedRecipe) {
            return
        }

        applyRecipeSelection(activeRecipeRowId, selectedRecipe)
    }

    const saveRecipe = () => {
        const name = recipeDraft.name.trim()
        if (!name) {
            toast.error("Введите название нормы")
            return
        }

        const normalizedLines = recipeDraftLines
            .map((line) => {
                const itemId = Number(line.itemId || 0)
                if (!itemId) {
                    return null
                }

                const item = items.find((candidate) => Number(candidate.id) === itemId)
                if (!item) {
                    return null
                }

                return {
                    itemId,
                    itemName: String(item.name || `#${itemId}`),
                    unitLabel: String(item.base_unit || item.unit || "шт"),
                    quantity: normalizeUiNumber(line.quantity),
                }
            })
            .filter((line): line is RecipeOption["lines"][number] => Boolean(line))

        if (normalizedLines.length === 0) {
            toast.error("Добавьте хотя бы одну строку в норму")
            return
        }

        const nextRecipe: RecipeOption = {
            id: nextRecipeId(),
            code: recipes.reduce((maxValue, recipe) => Math.max(maxValue, recipe.code), 0) + 1,
            name,
            owner: recipeDraft.owner.trim(),
            comment: recipeDraft.comment.trim(),
            lines: normalizedLines,
        }

        setRecipes((prev) => [...prev, nextRecipe])
        setIsRecipeCreateOpen(false)
        if (activeRecipeRowId) {
            applyRecipeSelection(activeRecipeRowId, nextRecipe)
        }
        toast.success("Норма создана")
    }

    const createAndPostMutation = useMutation({
        mutationFn: async (closeAfter: boolean) => {
            const created = await api.post<{ id: number }>("/documents/purchases/", preparePayload())
            await api.post(`/documents/purchases/${created.id}/post/`)
            return { ...created, closeAfter }
        },
        onSuccess: (result) => {
            toast.success("Поступление создано и проведено")
            queryClient.invalidateQueries({ queryKey: ["purchases"] })
            router.push(result.closeAfter ? "/documents/purchases" : `/documents/purchases/${result.id}`)
        },
        onError: (error) => {
            const { title, description } = mapApiError(error)
            toast.error(title, { description })
        },
    })

    // Actions
    const saveMutation = useMutation({
        mutationFn: async (data: PurchasePayload) => {
            if (mode === 'create') return api.post('/documents/purchases/', data);
            return api.put(`/documents/purchases/${initialData!.id}/`, data);
        },
        onSuccess: () => {
            toast.success(tc('savedSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            if (initialData?.id) {
                queryClient.invalidateQueries({ queryKey: ['purchase', initialData.id] });
            }
            if (mode === 'create') router.push('/documents/purchases');
        },
        onError: (err) => {
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        }
    })

    const postMutation = useMutation({
        mutationFn: async () => api.post(`/documents/purchases/${initialData!.id}/post/`),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['purchases'] });
            setFormData({ ...formData, status: 'posted' });
            toast.success(t('postedSuccessfully'));
        },
        onError: (err: unknown) => {
            setFormData({ ...formData, status: 'draft' });
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['purchase', initialData?.id] });
            router.refresh();
        }
    })

    const unpostMutation = useMutation({
        mutationFn: async () => api.post(`/documents/purchases/${initialData!.id}/unpost/`),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['purchases'] });
            setFormData({ ...formData, status: 'draft' });
            toast.success(t('unpostedSuccessfully'));
        },
        onError: () => {
            setFormData({ ...formData, status: 'posted' });
            toast.error("Failed to unpost");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['purchase', initialData?.id] });
            router.refresh();
        }
    })

    // Shortcuts
    useHotkeys('ctrl+s', (e) => { e.preventDefault(); if (!isPosted) saveMutation.mutate(preparePayload()); }, { enableOnFormTags: true }, [formData, lines, isPosted]);
    useHotkeys('ctrl+enter', (e) => { e.preventDefault(); if (!isPosted && initialData?.id) postMutation.mutate(); }, { enableOnFormTags: true }, [isPosted, initialData]);
    useHotkeys('esc', (e) => { e.preventDefault(); router.back(); }, { enableOnFormTags: true }, []);

    const actions: CommandBarAction[] = [
        ...(!isPosted ? [{
            label: t('post'),
            icon: <PiCheckCircleBold />,
            onClick: () => postMutation.mutate(),
            disabled: mode === 'create',
            shortcut: 'Ctrl+Ent',
            variant: 'default' as const
        }] : []),
        ...(!isPosted ? [{
            label: tc('save'),
            icon: <PiFloppyDiskBold />,
            onClick: () => saveMutation.mutate(preparePayload()),
            shortcut: 'Ctrl+S',
            variant: 'secondary' as const
        }] : []),
        ...(!isPosted ? [{
            label: tc('saveAndClose'),
                onClick: () => {
                    saveMutation.mutate(preparePayload());
                    router.push('/documents/purchases');
                },
            variant: 'outline' as const
        }] : []),
        ...(isPosted ? [{
            label: t('unpost'),
            icon: <PiXBold />,
            onClick: () => unpostMutation.mutate(),
            variant: 'destructive' as const
        }] : []),
        {
            label: tc('print'),
            icon: <PiPrinterBold />,
            onClick: () => setPrintOpen(true),
            variant: 'ghost' as const
        },
        ...(!isPosted ? [{
            label: tc('add'), // "Add Line"
            icon: <PiPlusBold />,
            onClick: () => setLines([...lines, createEmptyLine()]),
            shortcut: 'Ins',
            variant: 'secondary' as const
        }] : [])
    ]

    const totals = useMemo(() => {
        const totalAmount = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
        const tax = lines.reduce((sum, line) => sum + (Number(line.vat_amount) || 0), 0);
        const exchangeRate = Number(formData.rate) || 1;
        const grandTotal = lines.reduce((sum, line) => sum + (Number(line.total_with_vat) || 0), 0) || (totalAmount + tax);

        return {
            total: totalAmount,
            tax: tax,
            grandTotal: grandTotal,
            grandTotalBase: grandTotal * exchangeRate
        }
    }, [lines, formData.rate]);

    const [activeCell, setActiveCell] = useState<ActiveCell>(null);

    const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colId: string) => {
        if (!['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F2'].includes(e.key)) return;

        const cols = ['item', 'package', 'quantity', 'price'];
        const colIndex = cols.indexOf(colId);

        if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'Tab') {
            e.preventDefault();
            if (colIndex < cols.length - 1) {
                const nextCol = cols[colIndex + 1];
                setActiveCell({ row: rowIndex, col: nextCol });
                setTimeout(() => document.getElementById(`p-cell-${rowIndex}-${nextCol}`)?.focus(), 0);
            } else if (rowIndex < lines.length - 1) {
                setActiveCell({ row: rowIndex + 1, col: cols[0] });
                setTimeout(() => document.getElementById(`p-cell-${rowIndex + 1}-${cols[0]}`)?.focus(), 0);
            } else if (!isPosted) {
                const newLine = createEmptyLine();
                setLines([...lines, newLine]);
                setActiveCell({ row: rowIndex + 1, col: cols[0] });
            }
        }
    };

    // Helper: Recalculate Line Totals (Mirrors Backend Logic)
    const recalculateLine = (line: PurchaseDocumentLine): PurchaseDocumentLine => {
        const qty = Number(line.quantity) || 0;
        const price = Number(line.price) || 0;
        const rate = Number(line.vat_rate) || 0;

        const amount = qty * price;
        const vatAmount = amount * (rate / 100);
        const total = amount + vatAmount;

        return {
            ...line,
            amount: amount,
            vat_amount: vatAmount,
            total_with_vat: total
        };
    };

    const columns: ColumnDef<PurchaseDocumentLine>[] = [
        {
            accessorKey: 'item', header: tf('item'),
            cell: ({ row }) => (
                <div className={cn("h-full w-full p-1", activeCell?.row === row.index && activeCell?.col === 'item' && "ring-2 ring-primary inset-0")}>
                    <ReferenceSelector
                        apiEndpoint="/directories/items/"
                        value={row.original.item}
                        displayField="name"
                        placeholder="Select Item"
                        onSelect={(val, item) => {
                            const newLines = [...lines];
                            // Reset package and price when item changes
                            const newLine = {
                                ...newLines[row.index],
                                item: val as number,
                                package: null,
                                coefficient: 1,
                                price: Number(item?.purchase_price) || 0, // Auto-fill price
                                vat_rate: 12 // Default to 12% or fetch from item if available
                            };
                            newLines[row.index] = recalculateLine(newLine);
                            setLines(newLines);
                        }}
                        disabled={isPosted}
                        className="h-full border-none"
                    />
                </div>
            )
        },
        {
            accessorKey: 'package', header: "Unit",
            cell: ({ row }) => (
                <UnitCell
                    row={row}
                    activeCell={activeCell}
                    isPosted={isPosted}
                    onUpdate={(updates) => {
                        const newLines = [...lines];

                        // Smart Price Recalculation if coef changes
                        const oldCoef = Number(newLines[row.index].coefficient) || 1;
                        const newCoef = Number(updates.coefficient) || 1;

                        let newPrice = Number(newLines[row.index].price) || 0;
                        if (oldCoef !== newCoef && oldCoef !== 0) {
                            newPrice = (newPrice / oldCoef) * newCoef;
                        }

                        const newLine = {
                            ...newLines[row.index],
                            ...updates,
                            price: parseFloat(newPrice.toFixed(2))
                        };
                        newLines[row.index] = recalculateLine(newLine);
                        setLines(newLines);
                    }}
                />
            )
        },
        {
            accessorKey: 'quantity', header: tf('quantity'),
            cell: ({ row }) => (
                <BaseQtyCell
                    row={row}
                    activeCell={activeCell}
                    isPosted={isPosted}
                    onUpdate={(val) => {
                        const newLines = [...lines];
                        const newLine = { ...newLines[row.index], quantity: val };
                        newLines[row.index] = recalculateLine(newLine);
                        setLines(newLines);
                    }}
                />
            )
        },
        {
            accessorKey: 'price', header: tf('price'),
            cell: ({ row }) => (
                <Input
                    id={`p-cell-${row.index}-price`}
                    type="number"
                    disabled={isPosted}
                    className={cn("h-8 w-full text-right px-1 border-transparent focus:border-transparent focus:ring-0 rounded-none bg-transparent hover:bg-muted/10 transition-colors", activeCell?.row === row.index && activeCell?.col === 'price' && "bg-background ring-2 ring-primary z-20 relative font-bold")}
                    value={row.original.price}
                    onKeyDown={(e) => handleCellKeyDown(e, row.index, 'price')}
                    onFocus={() => setActiveCell({ row: row.index, col: 'price' })}
                    onClick={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                        const newLines = [...lines];
                        const newLine = { ...newLines[row.index], price: parseFloat(e.target.value) };
                        newLines[row.index] = recalculateLine(newLine);
                        setLines(newLines);
                    }}
                />
            )
        },
        {
            accessorKey: 'amount', header: tf('amount'),
            cell: ({ row }) => <span className="font-mono font-bold block text-right px-2">{(Number(row.original.amount) || 0).toFixed(2)}</span>
        },
        {
            id: 'vat_rate',
            header: '% VAT',
            cell: ({ row }) => (
                <select
                    className="h-8 w-full bg-transparent border-none text-right px-2 text-xs text-muted-foreground focus:text-foreground"
                    disabled={isPosted}
                    value={row.original.vat_rate ?? 12}
                    onChange={(e) => {
                        const newLines = [...lines];
                        const newLine = { ...newLines[row.index], vat_rate: parseInt(e.target.value) };
                        newLines[row.index] = recalculateLine(newLine);
                        setLines(newLines);
                    }}
                >
                    <option value="0">0%</option>
                    <option value="12">12%</option>
                    <option value="20">20%</option>
                </select>
            )
        },
        {
            id: 'vat_amount', header: 'VAT Sum',
            cell: ({ row }) => <span className="font-mono text-muted-foreground block text-right px-2 text-xs">{(Number(row.original.vat_amount) || 0).toFixed(2)}</span>
        },
        {
            id: 'total_line', header: 'Total',
            cell: ({ row }) => <span className="font-mono font-bold block text-right px-2">{(Number(row.original.total_with_vat) || 0).toFixed(2)}</span>
        },
        {
            id: 'actions',
            cell: ({ row }) => !isPosted && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={() => setLines(lines.filter((_, i) => i !== row.index))} tabIndex={-1}>
                    <PiTrashBold className="h-4 w-4" />
                </Button>
            )
        }
    ]

    const resolvedItemCreateTableTab: ItemCreateTableTab =
        itemCreateTab === "norm"
            ? "norm"
            : itemCreateTab === "work_price"
              ? "prices"
              : itemCreateTableTab

    const renderItemCreateTable = (tableTab: ItemCreateTableTab) => {
        if (tableTab === "prices") {
            return (
                <div className="space-y-2">
                    <div className="grid grid-cols-[48px_minmax(0,1fr)_180px] border-b bg-muted/30 text-xs font-medium">
                        <div className="px-2 py-2">N</div>
                        <div className="border-l px-2 py-2">Наименование</div>
                        <div className="border-l px-2 py-2">Цена</div>
                    </div>
                    {itemPriceLines.map((line, index) => (
                        <div key={line.id} className="grid grid-cols-[48px_minmax(0,1fr)_180px] border-b text-sm">
                            <div className="px-2 py-2 text-center">{index + 1}</div>
                            <div className="border-l px-1 py-1">
                                <Input value={line.name} onChange={(e) => setItemPriceLines((prev) => prev.map((entry) => entry.id === line.id ? { ...entry, name: e.target.value } : entry))} className="h-8 border-none px-1 shadow-none" />
                            </div>
                            <div className="border-l px-1 py-1">
                                <Input value={line.price} onChange={(e) => setItemPriceLines((prev) => prev.map((entry) => entry.id === line.id ? { ...entry, price: e.target.value } : entry))} className="h-8 border-none px-1 text-right shadow-none" />
                            </div>
                        </div>
                    ))}
                </div>
            )
        }

        if (tableTab === "barcodes") {
            return (
                <div className="space-y-2">
                    <div className="grid grid-cols-[48px_minmax(0,1fr)] border-b bg-muted/30 text-xs font-medium">
                        <div className="px-2 py-2">N</div>
                        <div className="border-l px-2 py-2">Штрихкод</div>
                    </div>
                    {itemBarcodeLines.map((line, index) => (
                        <div key={line.id} className="grid grid-cols-[48px_minmax(0,1fr)] border-b text-sm">
                            <div className="px-2 py-2 text-center">{index + 1}</div>
                            <div className="border-l px-1 py-1">
                                <Input value={line.barcode} onChange={(e) => setItemBarcodeLines((prev) => prev.map((entry) => entry.id === line.id ? { ...entry, barcode: e.target.value } : entry))} className="h-8 border-none px-1 shadow-none" />
                            </div>
                        </div>
                    ))}
                </div>
            )
        }

        return (
            <div className="space-y-2">
                <div className="grid grid-cols-[48px_minmax(0,1fr)_110px_180px_180px_150px] border-b bg-muted/30 text-xs font-medium">
                    <div className="px-2 py-2">N</div>
                    <div className="border-l px-2 py-2">Номенклатура</div>
                    <div className="border-l px-2 py-2">Код</div>
                    <div className="border-l px-2 py-2">Единица измерения</div>
                    <div className="border-l px-2 py-2">Количество</div>
                    <div className="border-l px-2 py-2">Тип товара</div>
                </div>
                {itemNormLines.map((line, index) => (
                    <div key={line.id} className="grid grid-cols-[48px_minmax(0,1fr)_110px_180px_180px_150px] border-b text-sm">
                        <div className="px-2 py-2 text-center">{index + 1}</div>
                        <div className="border-l px-1 py-1">
                            <Popover
                                open={itemNormPopoverOpenFor === line.id}
                                onOpenChange={(open) => {
                                    setItemNormPopoverOpenFor(open ? line.id : null)
                                    if (open) {
                                        setActiveItemNormRowId(line.id)
                                    }
                                }}
                            >
                                <PopoverTrigger asChild>
                                    <button type="button" className="flex h-8 w-full items-center justify-between rounded border bg-background px-2 text-left">
                                        <span className="truncate">{line.itemName || "Выберите"}</span>
                                        <PiCaretDownBold className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-[420px] p-0">
                                    <div className="border-b px-3 py-3">
                                        <div className="relative">
                                            <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input value={itemNormSearch} onChange={(e) => setItemNormSearch(e.target.value)} className="h-9 pl-8" placeholder="Введите строку для поиска" />
                                        </div>
                                    </div>
                                    <div className="max-h-48 overflow-auto px-3 py-2">
                                        {filteredItemNormItems.length > 0 ? filteredItemNormItems.slice(0, 8).map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className="flex w-full items-center rounded px-2 py-2 text-left text-sm hover:bg-accent"
                                                onClick={() => applyItemNormSelection(line.id, item)}
                                            >
                                                <span className="truncate">{item.name}</span>
                                            </button>
                                        )) : (
                                            <div className="px-2 py-3 text-xs text-muted-foreground">Ничего не найдено</div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between border-t px-3 py-3">
                                        <Button type="button" variant="link" className="h-auto px-0" onClick={() => openItemNormListDialog(line.id)}>
                                            Показать все
                                        </Button>
                                        <Button type="button" variant="outline" size="icon-sm" onClick={() => openItemNormListDialog(line.id)}>
                                            <PiPlusBold className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="border-l px-2 py-2 font-mono">{line.code || ""}</div>
                        <div className="border-l px-2 py-2">{line.unit || ""}</div>
                        <div className="border-l px-1 py-1">
                            <Input value={line.quantity} onChange={(e) => setItemNormLines((prev) => prev.map((entry) => entry.id === line.id ? { ...entry, quantity: e.target.value } : entry))} className="h-8 border-none px-1 text-right shadow-none" />
                        </div>
                        <div className="border-l px-2 py-2">{line.productType || ""}</div>
                    </div>
                ))}
            </div>
        )
    }

    if (!hasMounted) {
        return (
            <div
                className="h-[calc(100vh-4rem)] rounded-md border bg-background"
                aria-busy="true"
            />
        )
    }

    return (
        <Tabs defaultValue="main" className="h-[calc(100vh-4rem)] flex flex-col bg-background">
            <div className="border-b px-4 flex items-center justify-between shrink-0 bg-muted/10">
                <TabsList className="bg-transparent p-0">
                    <TabsTrigger value="main" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Основное</TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">История</TabsTrigger>
                    <TabsTrigger value="postings" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" disabled={!isPosted}>Проводки</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-2">Interface Mode:</span>
                    <InterfaceModeToggle />
                </div>
            </div>

            <TabsContent value="main" className="flex-1 flex flex-col h-full m-0 p-0 outline-none data-[state=inactive]:hidden">
                <PrintPreviewDialog document={{ ...formData, lines }} tenant={currentTenant} open={printOpen} onOpenChange={setPrintOpen} />
                {mode === "create" && (
                    <>
                        <div className="border-b bg-muted/10 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    className="bg-yellow-400 text-foreground hover:bg-yellow-300"
                                    onClick={() => createAndPostMutation.mutate(true)}
                                    disabled={createAndPostMutation.isPending}
                                >
                                    Провести и закрыть
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => createAndPostMutation.mutate(false)}
                                    disabled={createAndPostMutation.isPending}
                                >
                                    Провести
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setPrintOpen(true)}>
                                    Печать
                                </Button>
                            </div>
                        </div>

                        <div className="border-b bg-muted/5 px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_420px]">
                                <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
                                    <Label className="self-center text-xs text-muted-foreground">Номер:</Label>
                                    <Input
                                        value={formData.number || ""}
                                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                        placeholder="0"
                                        className="h-8 font-mono"
                                    />
                                    <Label className="self-center text-xs text-muted-foreground">Дата:</Label>
                                    <Input
                                        type="datetime-local"
                                        value={formData.date ? new Date(formData.date).toISOString().slice(0, 16) : ""}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="h-8"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Label className="text-xs text-muted-foreground">Источник:</Label>
                                        {sourceOptions.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                className={cn(
                                                    "rounded-sm border px-2 py-1 text-xs",
                                                    sourceMode === option.id
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-border bg-background"
                                                )}
                                                onClick={() => setSourceMode(option.id)}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Склад:</Label>
                                            <ReferenceSelector
                                                apiEndpoint="/directories/warehouses/"
                                                value={formData.warehouse || null}
                                                displayField="name"
                                                placeholder="Выберите склад"
                                                onSelect={(val) => setFormData({ ...formData, warehouse: val as number })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Склад материалов:</Label>
                                            <ReferenceSelector
                                                apiEndpoint="/directories/warehouses/"
                                                value={materialsWarehouseId}
                                                displayField="name"
                                                placeholder="Выберите склад"
                                                onSelect={(val) => setMaterialsWarehouseId(val as number)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Номер авто:</Label>
                                            <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} className="h-8" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Формование:</Label>
                                            <Input value={formation} onChange={(e) => setFormation(e.target.value)} className="h-8" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 border-l pl-4">
                                    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2">
                                        <Label className="self-center text-xs text-muted-foreground">Счет фактура №:</Label>
                                        <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="h-8" />
                                        <Label className="self-center text-xs text-muted-foreground">от:</Label>
                                        <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="h-8" />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Label className="text-xs text-muted-foreground">Движение валюты:</Label>
                                        <button
                                            type="button"
                                            className={cn("rounded-sm border px-3 py-1 text-xs", movementMode === "direct" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background")}
                                            onClick={() => setMovementMode("direct")}
                                        >
                                            Прямой
                                        </button>
                                        <button
                                            type="button"
                                            className={cn("rounded-sm border px-3 py-1 text-xs", movementMode === "converted" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background")}
                                            onClick={() => setMovementMode("converted")}
                                        >
                                            С конвертацией
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2">
                                        <Label className="self-center text-xs text-muted-foreground">Список типов цен:</Label>
                                        <Input value={priceListName} onChange={(e) => setPriceListName(e.target.value)} className="h-8" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
                <CommandBar mainActions={actions} className={cn("border-b shrink-0", mode === "create" && "hidden")} />

                {mode === "create" && (
                    <div className="flex-1 overflow-hidden bg-background">
                        <div className="border-b px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, createEmptyLine()])}>
                                    <PiPlusBold className="mr-2 h-4 w-4" /> Добавить
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["purchase-form-items"] })}>
                                    Обновить
                                </Button>
                                <div className="ml-auto relative">
                                    <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={createSearchValue}
                                        onChange={(e) => setCreateSearchValue(e.target.value)}
                                        className="h-8 w-[220px] pl-8"
                                        placeholder="Поиск (Ctrl+F)"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="h-full overflow-auto px-4 py-3">
                            <div className="min-w-[1200px] overflow-hidden rounded-sm border">
                                <div className="grid grid-cols-[48px_250px_110px_110px_90px_110px_110px_120px_140px_140px_120px_110px] border-b bg-muted/30 text-xs font-medium">
                                    <div className="px-2 py-2">N</div>
                                    <div className="border-l px-2 py-2">Номенклатура</div>
                                    <div className="border-l px-2 py-2">Тип</div>
                                    <div className="border-l px-2 py-2">Ед.изм</div>
                                    <div className="border-l px-2 py-2">Валюта</div>
                                    <div className="border-l px-2 py-2">M3</div>
                                    <div className="border-l px-2 py-2">Количество</div>
                                    <div className="border-l px-2 py-2">Цена (учетн.)</div>
                                    <div className="border-l px-2 py-2">Сумма (учетн.)</div>
                                    <div className="border-l px-2 py-2">Примечание</div>
                                    <div className="border-l px-2 py-2">Рецепт</div>
                                    <div className="border-l px-2 py-2">Действия</div>
                                </div>

                                {filteredCreateLines.length > 0 ? filteredCreateLines.map((line, index) => {
                                    const ui = lineUiState[line.id] || createDefaultLineUiState()

                                    return (
                                        <div key={line.id} className="grid grid-cols-[48px_250px_110px_110px_90px_110px_110px_120px_140px_140px_120px_110px] border-b text-sm hover:bg-yellow-50">
                                            <div className="px-2 py-2 text-center">{index + 1}</div>
                                            <div className="border-l px-1 py-1">
                                                <Popover
                                                    open={itemPopoverOpenFor === line.id}
                                                    onOpenChange={(open) => {
                                                        setItemPopoverOpenFor(open ? line.id : null)
                                                        if (open) {
                                                            setActiveItemRowId(line.id)
                                                        }
                                                    }}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <button type="button" className="flex h-8 w-full items-center justify-between rounded border bg-background px-2 text-left">
                                                            <span className="truncate">{ui.itemName || "Выберите товар"}</span>
                                                            <PiCaretDownBold className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent align="start" className="w-[340px] p-0">
                                                        <div className="border-b px-3 py-3">
                                                            <div className="relative">
                                                                <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                                <Input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} className="h-9 pl-8" placeholder="Введите строку для поиска" />
                                                            </div>
                                                        </div>
                                                        <div className="max-h-48 overflow-auto px-3 py-2">
                                                            {filteredItems.length > 0 ? filteredItems.slice(0, 8).map((item) => (
                                                                <button
                                                                    key={item.id}
                                                                    type="button"
                                                                    className="flex w-full items-center rounded px-2 py-2 text-left text-sm hover:bg-accent"
                                                                    onClick={() => applyItemSelection(line.id, item)}
                                                                >
                                                                    <span className="truncate">{item.name}</span>
                                                                </button>
                                                            )) : (
                                                                <div className="px-2 py-3 text-xs text-muted-foreground">Ничего не найдено</div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between border-t px-3 py-3">
                                                            <Button type="button" variant="link" className="h-auto px-0" onClick={() => openItemListDialog(line.id)}>
                                                                Показать все
                                                            </Button>
                                                            <Button type="button" variant="outline" size="icon-sm" onClick={() => openItemCreateDialog(line.id)}>
                                                                <PiPlusBold className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="border-l px-2 py-2">{ui.itemTypeLabel || "-"}</div>
                                            <div className="border-l px-2 py-2">{ui.unitLabel || "-"}</div>
                                            <div className="border-l px-2 py-2 font-mono">{selectedCurrencyCode}</div>
                                            <div className="border-l px-1 py-1">
                                                <Input value={ui.m3Value} onChange={(e) => updateLineUi(line.id, { m3Value: e.target.value })} className="h-8 border-none px-1 text-right shadow-none" />
                                            </div>
                                            <div className="border-l px-1 py-1">
                                                <Input
                                                    type="number"
                                                    step="0.0001"
                                                    value={line.quantity}
                                                    onChange={(e) => {
                                                        const nextLine = recalculateLine({ ...line, quantity: Number(e.target.value) || 0 })
                                                        setLines((prev) => prev.map((entry) => entry.id === line.id ? nextLine : entry))
                                                    }}
                                                    className="h-8 border-none px-1 text-right shadow-none"
                                                />
                                            </div>
                                            <div className="border-l px-1 py-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={line.price}
                                                    onChange={(e) => {
                                                        const nextLine = recalculateLine({ ...line, price: Number(e.target.value) || 0 })
                                                        setLines((prev) => prev.map((entry) => entry.id === line.id ? nextLine : entry))
                                                    }}
                                                    className="h-8 border-none px-1 text-right shadow-none"
                                                />
                                            </div>
                                            <div className="border-l px-2 py-2 text-right font-mono">{Number(line.amount || 0).toFixed(2)}</div>
                                            <div className="border-l px-1 py-1">
                                                <button type="button" className="flex h-8 w-full items-center rounded border bg-background px-2 text-left text-xs" onClick={() => openNotePopover(line.id)}>
                                                    <span className="truncate">{ui.note || "Добавить"}</span>
                                                </button>
                                            </div>
                                            <div className="border-l px-1 py-1">
                                                <Popover
                                                    open={isRecipePopoverOpen && activeRecipeRowId === line.id}
                                                    onOpenChange={(open) => {
                                                        setActiveRecipeRowId(open ? line.id : activeRecipeRowId)
                                                        setIsRecipePopoverOpen(open)
                                                    }}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <button type="button" className="flex h-8 w-full items-center justify-between rounded border bg-background px-2 text-left">
                                                            <span className="truncate text-xs">{ui.recipeName || "..."}</span>
                                                            <PiCaretDownBold className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent align="start" className="w-[340px] p-0">
                                                        <div className="border-b px-3 py-3">
                                                            <div className="relative">
                                                                <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                                <Input value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="h-9 pl-8" placeholder="Введите строку для поиска" />
                                                            </div>
                                                            <div className="mt-3 text-sm leading-6">
                                                                <button type="button" className="text-primary hover:underline" onClick={() => openRecipeListDialog(line.id)}>
                                                                    Показать все для выбора
                                                                </button>
                                                                <br />
                                                                <button type="button" className="flex items-center gap-1 text-primary hover:underline" onClick={() => openRecipeCreateDialog(line.id)}>
                                                                    <PiPlusBold className="h-4 w-4" />
                                                                    <span>(создать) для добавления</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="max-h-40 overflow-auto px-3 py-2">
                                                            {filteredRecipes.length > 0 ? filteredRecipes.slice(0, 6).map((recipe) => (
                                                                <button
                                                                    key={recipe.id}
                                                                    type="button"
                                                                    className="flex w-full items-center rounded px-2 py-2 text-left text-sm hover:bg-accent"
                                                                    onClick={() => applyRecipeSelection(line.id, recipe)}
                                                                >
                                                                    <span className="truncate">{recipe.name}</span>
                                                                </button>
                                                            )) : (
                                                                <div className="px-2 py-3 text-xs text-muted-foreground">Норм пока нет</div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between border-t px-3 py-3">
                                                            <Button type="button" variant="link" className="h-auto px-0" onClick={() => openRecipeListDialog(line.id)}>
                                                                Показать все
                                                            </Button>
                                                            <Button type="button" variant="outline" size="icon-sm" onClick={() => openRecipeCreateDialog(line.id)}>
                                                                <PiPlusBold className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="border-l px-1 py-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => {
                                                        setLines((prev) => prev.filter((entry) => entry.id !== line.id))
                                                        removeLineUi(line.id)
                                                    }}
                                                >
                                                    <PiTrashBold className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                }) : (
                                    <div className="px-4 py-10 text-sm text-muted-foreground">Добавьте строку, затем выберите номенклатуру.</div>
                                )}
                            </div>
                        </div>

                        <div className="shrink-0 border-t bg-muted/90 p-2 backdrop-blur">
                            <div className="flex items-center justify-end gap-6 text-sm">
                                <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs">{tf('subtotal')}</span><span className="font-mono">{totals.total.toFixed(2)}</span></div>
                                <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs">VAT (12%)</span><span className="font-mono">{totals.tax.toFixed(2)}</span></div>
                                <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs font-bold">{tc('total')}</span><span className="font-mono font-bold text-lg text-primary">{totals.grandTotal.toFixed(2)} {selectedCurrencyCode}</span></div>
                            </div>
                        </div>
                    </div>
                )}

                <div className={cn("grid grid-cols-4 gap-4 p-4 border-b bg-muted/10 shrink-0 relative", mode === "create" && "hidden")}>
                    <div className="absolute top-2 right-4 flex gap-2">
                        {isPeriodClosed && <div className="flex items-center gap-2 text-red-600 font-bold border border-red-200 bg-red-50 px-3 py-1 rounded-sm shadow-sm"><PiLockKeyBold /> Period Closed</div>}
                        {isPosted && !isPeriodClosed ? <div className="flex items-center gap-2 text-emerald-600 font-bold border border-emerald-200 bg-emerald-50 px-3 py-1 rounded-sm shadow-sm"><PiCheckCircleBold /> {t('posted')}</div> : <div className="flex items-center gap-2 text-muted-foreground font-medium border border-border px-3 py-1 rounded-sm bg-background">{t('draft')}</div>}
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{tc('number')}</Label>
                        <Input disabled={isPosted} value={formData.number || ''} onChange={e => setFormData({ ...formData, number: e.target.value })} className="h-8 font-mono disabled:opacity-100" placeholder="Auto" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{tc('date')}</Label>
                        <Input type="datetime-local" disabled={isPosted} value={formData.date ? new Date(formData.date).toISOString().slice(0, 16) : ''} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-8 disabled:opacity-100" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Контрагент</Label>
                        <div className="grid grid-cols-[minmax(0,1fr)_36px_36px] gap-1">
                            <ReferenceSelector
                            apiEndpoint="/directories/counterparties/"
                            value={formData.counterparty || null}
                            displayField="name"
                            placeholder="Выберите поставщика..."
                            onSelect={(val) => setFormData({ ...formData, counterparty: val as number })}
                            disabled={isPosted}
                            label=""
                        />
                        <Button type="button" variant="outline" size="icon-sm" onClick={openCounterpartyListDialog} disabled={isPosted}>
                            <PiCaretDownBold className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon-sm" onClick={() => openCounterpartyCreateDialog("item")} disabled={isPosted}>
                            <PiPlusBold className="h-4 w-4" />
                        </Button>
                    </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{tf('warehouse')}</Label>
                        <ReferenceSelector
                            apiEndpoint="/directories/warehouses/"
                            value={formData.warehouse || null}
                            displayField="name"
                            placeholder="Select Warehouse"
                            onSelect={(val) => setFormData({ ...formData, warehouse: val as number })}
                            disabled={isPosted}
                        />
                    </div>

                    {/* Analytics Fields */}
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Project</Label>
                        <ReferenceSelector
                            apiEndpoint="/directories/projects/"
                            value={formData.project as number || null}
                            displayField="name"
                            placeholder="Select Project"
                            onSelect={(val) => setFormData({ ...formData, project: val as number })}
                            disabled={isPosted}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Department</Label>
                        <ReferenceSelector
                            apiEndpoint="/directories/departments/"
                            value={formData.department as number || null}
                            displayField="name"
                            placeholder="Select Department"
                            onSelect={(val) => setFormData({ ...formData, department: val as number })}
                            disabled={isPosted}
                        />
                    </div>
                </div>

                {/* 1C-Style Operational Panels */}
                <div className={cn("grid grid-cols-2 gap-4 px-4", mode === "create" && "hidden")}>
                    <LiveStockPanel
                        warehouseId={formData.warehouse as number | null}
                        lines={lines.map(l => ({ item: l.item, quantity: (Number(l.quantity) || 0) * (Number(l.coefficient) || 1) }))}
                        operation="IN"
                    />
                    <LiveSettlementPanel
                        counterpartyId={formData.counterparty as number | null}
                        contractId={formData.contract as number | null}
                        currencyId={formData.currency as number | null}
                        amount={totals.grandTotal}
                        operation="ACCRUAL"
                    />
                </div>

                <div className={cn("flex-1 overflow-auto bg-background dark:bg-zinc-950 relative data-table", mode === "create" && "hidden")}>
                    <DataTable
                        columns={columns}
                        data={lines}
                        onAdd={!isPosted ? () => setLines([...lines, createEmptyLine()]) : undefined}
                        addLabel={!isPosted ? "Add Line" : undefined}
                    />
                    {!isPosted && (
                        <div className="p-2 border-t bg-muted/5">
                            <Button variant="outline" size="sm" onClick={() => setLines([...lines, createEmptyLine()])}>
                                <PiPlusBold className="mr-2 h-4 w-4" /> {tc('add')}
                            </Button>
                        </div>
                    )}
                </div>

                <div className={cn("shrink-0 border-t bg-muted/90 p-2 backdrop-blur", mode === "create" && "hidden")}>
                    <div className="flex items-center justify-end gap-6 text-sm">
                        <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs">{tf('subtotal')}</span><span className="font-mono">{totals.total.toFixed(2)}</span></div>
                        <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs">VAT (12%)</span><span className="font-mono">{totals.tax.toFixed(2)}</span></div>
                        <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs font-bold">{tc('total')}</span><span className="font-mono font-bold text-lg text-primary">${totals.grandTotal.toFixed(2)}</span></div>
                        <div className="flex flex-col items-end border-l pl-4 ml-4">
                            <span className="text-muted-foreground text-xs font-bold">Total (Base Val)</span>
                            <span className="font-mono font-bold text-lg">{totals.grandTotalBase.toLocaleString()} UZS</span>
                        </div>
                    </div>
                </div>
            </TabsContent>

            <Dialog open={isItemListOpen} onOpenChange={setIsItemListOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader className="hidden">
                        <DialogTitle>Номенклатура</DialogTitle>
                        <DialogDescription>Выберите товар для строки документа.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Button type="button" onClick={confirmSelectedItem}>Выбрать</Button>
                            <Button type="button" variant="outline" onClick={() => activeItemRowId && openItemCreateDialog(activeItemRowId)}>Создать</Button>
                            <Button type="button" variant="outline" onClick={() => openItemGroupCreateDialog(activeItemRowId)}>РЎРѕР·РґР°С‚СЊ РіСЂСѓРїРїСѓ</Button>
                            <div className="relative flex-1">
                                <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} className="pl-8" placeholder="Поиск (Ctrl+F)" />
                            </div>
                        </div>
                        <div className="max-h-[320px] overflow-auto rounded border">
                            {filteredItems.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={cn(
                                        "grid w-full grid-cols-[minmax(0,1fr)_140px_90px] items-center border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                                        itemSelectionId === Number(item.id) && "bg-yellow-50 dark:bg-yellow-950/30"
                                    )}
                                    onClick={() => setItemSelectionId(Number(item.id))}
                                    onDoubleClick={() => {
                                        if (activeItemRowId) {
                                            applyItemSelection(activeItemRowId, item)
                                        }
                                        setIsItemListOpen(false)
                                    }}
                                >
                                    <span className="truncate">{item.name}</span>
                                    <span className="font-mono text-xs">{item.sku || "-"}</span>
                                    <span>{item.item_type === "SERVICE" ? "Услуга" : "Материал"}</span>
                                </button>
                            ))}
                            {filteredItems.length === 0 && (
                                <div className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isItemCreateOpen} onOpenChange={setIsItemCreateOpen}>
                <DialogContent className="sm:max-w-6xl">
                    <DialogHeader className="hidden">
                        <DialogTitle>Номенклатура (создание)</DialogTitle>
                        <DialogDescription>Созданная позиция сразу подставится в текущую строку.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="text-lg font-semibold">Номенклатура (создание)</div>
                        {itemCreateMode === "group" && (
                            <div className="text-sm text-muted-foreground">Р РµР¶РёРј: РЎРѕР·РґР°РЅРёРµ РіСЂСѓРїРїС‹</div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" className={cn("rounded-sm border px-3 py-1 text-sm", itemCreateTab === "main" ? "border-primary bg-muted font-medium" : "border-border bg-background text-primary underline-offset-2 hover:underline")} onClick={() => setItemCreateTab("main")}>
                                Основное
                            </button>
                            <button type="button" className={cn("rounded-sm border px-3 py-1 text-sm", itemCreateTab === "norm" ? "border-primary bg-muted font-medium" : "border-border bg-background text-primary underline-offset-2 hover:underline")} onClick={() => setItemCreateTab("norm")}>
                                Норма
                            </button>
                            <button type="button" className={cn("rounded-sm border px-3 py-1 text-sm", itemCreateTab === "work_price" ? "border-primary bg-muted font-medium" : "border-border bg-background text-primary underline-offset-2 hover:underline")} onClick={() => setItemCreateTab("work_price")}>
                                Цена работ
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                className="bg-yellow-400 text-foreground hover:bg-yellow-300"
                                onClick={() => itemCreateMode === "group" ? createItemGroupMutation.mutate() : createItemMutation.mutate()}
                                disabled={itemCreateMode === "group" ? createItemGroupMutation.isPending : createItemMutation.isPending}
                            >
                                Записать и закрыть
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => itemCreateMode === "group" ? createItemGroupMutation.mutate() : createItemMutation.mutate()}
                                disabled={itemCreateMode === "group" ? createItemGroupMutation.isPending : createItemMutation.isPending}
                            >
                                Записать
                            </Button>
                            <div className="ml-auto">
                                <Button type="button" variant="outline">Еще</Button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-12">
                                <div className="md:col-span-3 grid grid-cols-[100px_minmax(0,1fr)] items-center gap-2">
                                    <Label>Код:</Label>
                                    <Input value={itemDraft.code} onChange={(e) => setItemDraft((prev) => ({ ...prev, code: e.target.value }))} className="h-8" />
                                </div>
                                <div className="md:col-span-3 grid grid-cols-[100px_minmax(0,1fr)] items-center gap-2">
                                    <Label>Вес:</Label>
                                    <Input value={itemDraft.weight} onChange={(e) => setItemDraft((prev) => ({ ...prev, weight: e.target.value }))} className="h-8 text-right" />
                                </div>
                                <div className="md:col-span-6 grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2">
                                    <Label>Тип товара:</Label>
                                    <select className="h-8 rounded-md border bg-background px-3 text-sm" value={itemDraft.productType} onChange={(e) => applyItemProductType(e.target.value as ItemDraft["productType"])}>
                                        <option value="production">Продукция</option>
                                        <option value="material">Материал</option>
                                        <option value="fixed_asset">ОС</option>
                                        <option value="goods">Товар</option>
                                        <option value="service">Услуга / Работа</option>
                                    </select>
                                </div>

                                <div className="md:col-span-7 grid grid-cols-[100px_minmax(0,1fr)] items-center gap-2">
                                    <Label>Артикул:</Label>
                                    <Input value={itemDraft.sku} onChange={(e) => setItemDraft((prev) => ({ ...prev, sku: e.target.value }))} className="h-8" />
                                </div>
                                <div className="md:col-span-5 grid grid-cols-[100px_minmax(0,1fr)] items-center gap-2">
                                    <Label>Размер:</Label>
                                    <Input value={itemDraft.size} onChange={(e) => setItemDraft((prev) => ({ ...prev, size: e.target.value }))} className="h-8" />
                                </div>

                                <div className="md:col-span-8 grid grid-cols-[100px_minmax(0,1fr)] items-center gap-2">
                                    <Label>Наименование:</Label>
                                    <Input value={itemDraft.name} onChange={(e) => setItemDraft((prev) => ({ ...prev, name: e.target.value }))} className="h-8" />
                                </div>
                                <div className="md:col-span-4 grid grid-cols-[100px_minmax(0,1fr)] items-center gap-2">
                                    <Label>Валюта:</Label>
                                    <select className="h-8 rounded-md border bg-background px-3 text-sm" value={itemDraft.currencyId ? String(itemDraft.currencyId) : ""} onChange={(e) => setItemDraft((prev) => ({ ...prev, currencyId: Number(e.target.value) || null }))}>
                                        <option value="">Выберите</option>
                                        {currencies.map((currency) => (
                                            <option key={currency.id} value={currency.id}>{currency.code}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-8 grid grid-cols-[100px_minmax(0,1fr)_40px_40px] items-center gap-2">
                                    <Label>Ед.изм:</Label>
                                    <select className="h-8 rounded-md border bg-background px-3 text-sm" value={itemDraft.unit} onChange={(e) => setItemDraft((prev) => ({ ...prev, unit: e.target.value }))}>
                                        <option value="">Выберите</option>
                                        {unitOptions.map((option) => (
                                            <option key={option.id} value={option.name}>{option.name}</option>
                                        ))}
                                    </select>
                                    <Button type="button" variant="outline" size="icon-sm" onClick={openUnitListDialog}>
                                        <PiCaretDownBold className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="outline" size="icon-sm" onClick={() => setIsUnitCreateOpen(true)}>
                                        <PiPlusBold className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="md:col-span-4 grid grid-cols-[100px_minmax(0,1fr)] items-center gap-2">
                                    <Label>Срок:</Label>
                                    <Input type="date" value={itemDraft.expiryDate} onChange={(e) => setItemDraft((prev) => ({ ...prev, expiryDate: e.target.value }))} className="h-8" />
                                </div>

                                <div className="md:col-span-6 grid grid-cols-[100px_minmax(0,1fr)_40px] items-center gap-2">
                                    <Label>Вид товара:</Label>
                                    <select className="h-8 rounded-md border bg-background px-3 text-sm" value={itemDraft.itemKind} onChange={(e) => setItemDraft((prev) => ({ ...prev, itemKind: e.target.value }))}>
                                        <option value="">Выберите</option>
                                        {itemKindOptions.map((option) => (
                                            <option key={option.id} value={option.name}>{option.name}</option>
                                        ))}
                                    </select>
                                    <Button type="button" variant="outline" size="icon-sm" onClick={() => setIsItemKindCreateOpen(true)}>
                                        <PiPlusBold className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="md:col-span-6 grid grid-cols-[130px_minmax(0,1fr)_40px_40px] items-center gap-2">
                                    <Label>Производитель:</Label>
                                    <select className="h-8 rounded-md border bg-background px-3 text-sm" value={itemDraft.manufacturer} onChange={(e) => setItemDraft((prev) => ({ ...prev, manufacturer: e.target.value }))}>
                                        <option value="">Выберите</option>
                                        {manufacturerOptions.map((option) => (
                                            <option key={option.id} value={option.name}>{option.name}</option>
                                        ))}
                                    </select>
                                    <Button type="button" variant="outline" size="icon-sm" onClick={openManufacturerListDialog}>
                                        <PiCaretDownBold className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="outline" size="icon-sm" onClick={() => setIsManufacturerCreateOpen(true)}>
                                        <PiPlusBold className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="md:col-span-6 grid grid-cols-[100px_minmax(0,1fr)] items-center gap-2">
                                    <Label>Штрих код:</Label>
                                    <Input value={itemDraft.barcode} onChange={(e) => setItemDraft((prev) => ({ ...prev, barcode: e.target.value }))} className="h-8" />
                                </div>
                                <div className="md:col-span-6 grid grid-cols-[100px_minmax(0,1fr)_40px] items-center gap-2">
                                    <Label>Родитель:</Label>
                                    <Input value={selectedParentCategoryName} readOnly className="h-8" />
                                    <Button type="button" variant="outline" size="icon-sm" onClick={() => setIsParentListOpen(true)}>
                                        <PiCaretDownBold className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-3">
                                <div className="space-y-2 rounded-md border p-3">
                                    <div className="text-sm font-medium text-emerald-700">Упаковка 1-го уровня</div>
                                    <Input value={itemDraft.packageOneLabel} onChange={(e) => setItemDraft((prev) => ({ ...prev, packageOneLabel: e.target.value }))} placeholder="Наименование" className="h-8" />
                                    <Input value={itemDraft.packageOneQuantity} onChange={(e) => setItemDraft((prev) => ({ ...prev, packageOneQuantity: e.target.value }))} className="h-8 text-right" />
                                    <Input value={itemDraft.stockMin} onChange={(e) => setItemDraft((prev) => ({ ...prev, stockMin: e.target.value }))} className="h-8 text-right" placeholder="Товарный запас (минимум)" />
                                </div>
                                <div className="space-y-2 rounded-md border p-3">
                                    <div className="text-sm font-medium text-emerald-700">Упаковка 2-го уровня</div>
                                    <Input value={itemDraft.packageTwoLabel} onChange={(e) => setItemDraft((prev) => ({ ...prev, packageTwoLabel: e.target.value }))} placeholder="Наименование" className="h-8" />
                                    <Input value={itemDraft.packageTwoQuantity} onChange={(e) => setItemDraft((prev) => ({ ...prev, packageTwoQuantity: e.target.value }))} className="h-8 text-right" />
                                    <Input value={itemDraft.stockAvg} onChange={(e) => setItemDraft((prev) => ({ ...prev, stockAvg: e.target.value }))} className="h-8 text-right" placeholder="Товарный запас (средний)" />
                                </div>
                                <div className="space-y-2 rounded-md border p-3">
                                    <div className="text-sm font-medium text-emerald-700">Метод расчета</div>
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" className={cn("rounded-sm border px-3 py-1 text-xs", itemDraft.calcMethod === "quantity" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background")} onClick={() => setItemDraft((prev) => ({ ...prev, calcMethod: "quantity" }))}>по кол-во</button>
                                        <button type="button" className={cn("rounded-sm border px-3 py-1 text-xs", itemDraft.calcMethod === "package_one" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background")} onClick={() => setItemDraft((prev) => ({ ...prev, calcMethod: "package_one" }))}>по уп. 1-го</button>
                                        <button type="button" className={cn("rounded-sm border px-3 py-1 text-xs", itemDraft.calcMethod === "package_two" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background")} onClick={() => setItemDraft((prev) => ({ ...prev, calcMethod: "package_two" }))}>по уп. 2-го</button>
                                    </div>
                                    <Input value={itemDraft.purchasePrice} onChange={(e) => setItemDraft((prev) => ({ ...prev, purchasePrice: e.target.value }))} className="h-8 text-right" placeholder="Цена закупки" />
                                    <Input value={itemDraft.sellingPrice} onChange={(e) => setItemDraft((prev) => ({ ...prev, sellingPrice: e.target.value }))} className="h-8 text-right" placeholder="Цена продажи" />
                                    <div className="text-xs text-muted-foreground">Валюта: {itemDraftCurrencyCode}</div>
                                </div>
                            </div>

                            <div className="space-y-3 rounded-md border p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <button type="button" className={cn("rounded-sm border px-3 py-1 text-sm", resolvedItemCreateTableTab === "norm" ? "border-primary bg-muted font-medium" : "border-border bg-background")} onClick={() => setItemCreateTableTab("norm")}>Норма</button>
                                    <button type="button" className={cn("rounded-sm border px-3 py-1 text-sm", resolvedItemCreateTableTab === "prices" ? "border-primary bg-muted font-medium" : "border-border bg-background")} onClick={() => setItemCreateTableTab("prices")}>Цены работ</button>
                                    <button type="button" className={cn("rounded-sm border px-3 py-1 text-sm", resolvedItemCreateTableTab === "barcodes" ? "border-primary bg-muted font-medium" : "border-border bg-background")} onClick={() => setItemCreateTableTab("barcodes")}>Штрихкоды</button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            if (resolvedItemCreateTableTab === "prices") {
                                                setItemPriceLines((prev) => [...prev, { id: nextItemCreateRowId("item-price"), name: "", price: "0" }])
                                                return
                                            }
                                            if (resolvedItemCreateTableTab === "barcodes") {
                                                setItemBarcodeLines((prev) => [...prev, { id: nextItemCreateRowId("item-barcode"), barcode: "" }])
                                                return
                                            }
                                            setItemNormLines((prev) => [...prev, { id: nextItemCreateRowId("item-norm"), itemName: "", code: "", unit: "", quantity: "0,0000", productType: "Материал" }])
                                        }}
                                    >
                                        <PiPlusBold className="mr-2 h-4 w-4" /> Добавить
                                    </Button>
                                </div>
                                {renderItemCreateTable(resolvedItemCreateTableTab)}
                            </div>
                        </div>
                    </div>

                    <div className="hidden grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                        <Label>Наименование:</Label>
                        <Input value={itemDraft.name} onChange={(e) => setItemDraft((prev) => ({ ...prev, name: e.target.value }))} />
                        <Label>Артикул:</Label>
                        <Input value={itemDraft.sku} onChange={(e) => setItemDraft((prev) => ({ ...prev, sku: e.target.value }))} />
                        <Label>Тип:</Label>
                        <select className="h-9 rounded-md border bg-background px-3 text-sm" value={itemDraft.itemType} onChange={(e) => setItemDraft((prev) => ({ ...prev, itemType: e.target.value as ItemDraft["itemType"] }))}>
                            <option value="GOODS">Материал</option>
                            <option value="SERVICE">Услуга</option>
                        </select>
                        <Label>Ед.изм:</Label>
                        <Input value={itemDraft.unit} onChange={(e) => setItemDraft((prev) => ({ ...prev, unit: e.target.value }))} />
                        <Label>Закуп. цена:</Label>
                        <Input value={itemDraft.purchasePrice} onChange={(e) => setItemDraft((prev) => ({ ...prev, purchasePrice: e.target.value }))} />
                        <Label>Цена продажи:</Label>
                        <Input value={itemDraft.sellingPrice} onChange={(e) => setItemDraft((prev) => ({ ...prev, sellingPrice: e.target.value }))} />
                    </div>
                    <DialogFooter className="hidden">
                        <Button type="button" onClick={() => createItemMutation.mutate()} disabled={createItemMutation.isPending}>
                            Записать и выбрать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCounterpartyListOpen} onOpenChange={setIsCounterpartyListOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Контрагенты</DialogTitle>
                        <DialogDescription>Выберите контрагента, создайте нового или создайте группу.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Button type="button" onClick={confirmSelectedCounterparty} disabled={!counterpartySelectionId}>Выбрать</Button>
                            <Button type="button" variant="outline" onClick={() => openCounterpartyCreateDialog("item")}>Создать</Button>
                            <Button type="button" variant="outline" onClick={() => openCounterpartyCreateDialog("group")}>Создать группу</Button>
                            <div className="relative flex-1">
                                <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input value={counterpartySearch} onChange={(e) => setCounterpartySearch(e.target.value)} className="pl-8" placeholder="Поиск (Ctrl+F)" />
                            </div>
                        </div>
                        <div className="max-h-[360px] overflow-auto rounded border">
                            {groupedCounterparties.map((section) => (
                                <div key={section.group.id}>
                                    <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">{section.group.name}</div>
                                    {section.items.map((counterparty) => (
                                        <button
                                            key={counterparty.id}
                                            type="button"
                                            className={cn(
                                                "grid w-full grid-cols-[minmax(0,1fr)_140px_120px] items-center border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                                                counterpartySelectionId === counterparty.id && "bg-yellow-50 dark:bg-yellow-950/30"
                                            )}
                                            onClick={() => setCounterpartySelectionId(counterparty.id)}
                                            onDoubleClick={() => {
                                                setFormData((prev) => ({ ...prev, counterparty: counterparty.id }))
                                                setIsCounterpartyListOpen(false)
                                            }}
                                        >
                                            <span className="truncate">{counterparty.name}</span>
                                            <span className="font-mono text-xs">{counterparty.inn || "-"}</span>
                                            <span className="truncate text-xs text-muted-foreground">{counterparty.phone || "-"}</span>
                                        </button>
                                    ))}
                                </div>
                            ))}
                            {groupedCounterparties.length === 0 && (
                                <div className="px-3 py-8 text-center text-sm text-muted-foreground">Контрагенты не найдены.</div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isCounterpartyCreateOpen} onOpenChange={setIsCounterpartyCreateOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{counterpartyCreateMode === "group" ? "Контрагенты (создание группы)" : "Контрагенты (создание)"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" className="rounded-sm border border-primary bg-muted px-3 py-1 text-sm font-medium">Основное</button>
                            <button type="button" className="rounded-sm border border-border bg-background px-3 py-1 text-sm text-primary underline-offset-2 hover:underline">Цены поставщиков</button>
                            <div className="ml-auto">
                                <Button type="button" variant="outline">Еще</Button>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" className="bg-yellow-400 text-foreground hover:bg-yellow-300" onClick={() => createCounterpartyMutation.mutate()} disabled={createCounterpartyMutation.isPending}>Записать и закрыть</Button>
                            <Button type="button" variant="outline" onClick={() => createCounterpartyMutation.mutate()} disabled={createCounterpartyMutation.isPending}>Записать</Button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-12">
                            <div className="md:col-span-3 grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
                                <Label>Код:</Label>
                                <Input value={String(counterparties.length + counterpartyGroups.length + 1)} readOnly className="h-8" />
                            </div>
                            <div className="md:col-span-9 grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
                                <Label>ИНН/ПИНФЛ:</Label>
                                <Input value={counterpartyDraft.inn} onChange={(e) => setCounterpartyDraft((prev) => ({ ...prev, inn: e.target.value }))} className="h-8" />
                            </div>
                            <div className="md:col-span-12 grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
                                <Label>Наименование:</Label>
                                <Input value={counterpartyDraft.name} onChange={(e) => setCounterpartyDraft((prev) => ({ ...prev, name: e.target.value }))} className="h-8" />
                            </div>
                            <div className="md:col-span-12 grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
                                <Label>Тип:</Label>
                                <select className="h-8 rounded-md border bg-background px-3 text-sm" value={counterpartyDraft.type} onChange={(e) => setCounterpartyDraft((prev) => ({ ...prev, type: e.target.value as CounterpartyDraft["type"] }))}>
                                    <option value="SUPPLIER">Поставщик</option>
                                    <option value="CUSTOMER">Покупатель</option>
                                    <option value="AGENT">Прочие</option>
                                </select>
                            </div>
                            <div className="md:col-span-12 grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
                                <Label>Телефон:</Label>
                                <Input value={counterpartyDraft.phone} onChange={(e) => setCounterpartyDraft((prev) => ({ ...prev, phone: e.target.value }))} className="h-8" />
                            </div>
                            <div className="md:col-span-12 grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
                                <Label>Адрес:</Label>
                                <Input value={counterpartyDraft.address} onChange={(e) => setCounterpartyDraft((prev) => ({ ...prev, address: e.target.value }))} className="h-8" />
                            </div>
                            <div className="md:col-span-12 grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
                                <Label>Родитель:</Label>
                                <select className="h-8 rounded-md border bg-background px-3 text-sm" value={counterpartyDraft.groupId || ""} onChange={(e) => setCounterpartyDraft((prev) => ({ ...prev, groupId: e.target.value || null }))}>
                                    <option value="">Без группы</option>
                                    {counterpartyGroups.map((group) => (
                                        <option key={group.id} value={group.id}>{group.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isUnitListOpen} onOpenChange={setIsUnitListOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Единицы измерения</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Button type="button" onClick={confirmSelectedUnit} disabled={!unitSelectionId}>Выбрать</Button>
                            <Button type="button" variant="outline" onClick={() => setIsUnitCreateOpen(true)}>Создать</Button>
                            <div className="relative flex-1">
                                <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} className="pl-8" placeholder="Поиск (Ctrl+F)" />
                            </div>
                        </div>
                        <div className="max-h-[320px] overflow-auto rounded border">
                            {filteredUnitOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={cn(
                                        "grid w-full grid-cols-[minmax(0,1fr)_160px_100px] items-center border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                                        unitSelectionId === option.id && "bg-yellow-50 dark:bg-yellow-950/30"
                                    )}
                                    onClick={() => setUnitSelectionId(option.id)}
                                    onDoubleClick={() => {
                                        setItemDraft((prev) => ({ ...prev, unit: option.name }))
                                        setIsUnitListOpen(false)
                                    }}
                                >
                                    <span className="truncate">{option.name}</span>
                                    <span className="truncate text-xs text-muted-foreground">{option.fullName || option.name}</span>
                                    <span className="font-mono text-xs">{option.code}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isUnitCreateOpen} onOpenChange={setIsUnitCreateOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Единицы измерения (создание)</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
                        <Label>Код:</Label>
                        <Input value={String(unitOptions.reduce((maxValue, option) => Math.max(maxValue, option.code), 0) + 1)} readOnly />
                        <Label>Наименование:</Label>
                        <Input value={unitDraft.name} onChange={(e) => setUnitDraft((prev) => ({ ...prev, name: e.target.value }))} />
                        <Label>Полное наименование:</Label>
                        <Input value={unitDraft.fullName} onChange={(e) => setUnitDraft((prev) => ({ ...prev, fullName: e.target.value }))} />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            onClick={() => {
                                addItemMetaOption(
                                    setUnitOptions,
                                    unitDraft.name,
                                    { fullName: unitDraft.fullName.trim() || unitDraft.name.trim() },
                                    (name) => setItemDraft((prev) => ({ ...prev, unit: name }))
                                )
                                setUnitDraft({ name: "", fullName: "" })
                                setIsUnitCreateOpen(false)
                            }}
                        >
                            Записать и закрыть
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isItemKindCreateOpen} onOpenChange={setIsItemKindCreateOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Вид товара (создание)</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
                        <Label>Код:</Label>
                        <Input value={String(itemKindOptions.reduce((maxValue, option) => Math.max(maxValue, option.code), 0) + 1)} readOnly />
                        <Label>Наименование:</Label>
                        <Input value={itemKindDraft.name} onChange={(e) => setItemKindDraft({ name: e.target.value })} />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            onClick={() => {
                                addItemMetaOption(setItemKindOptions, itemKindDraft.name, {}, (name) => setItemDraft((prev) => ({ ...prev, itemKind: name })))
                                setItemKindDraft({ name: "" })
                                setIsItemKindCreateOpen(false)
                            }}
                        >
                            Записать и закрыть
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isManufacturerListOpen} onOpenChange={setIsManufacturerListOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Производитель</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Button type="button" onClick={confirmSelectedManufacturer} disabled={!manufacturerSelectionId}>Выбрать</Button>
                            <Button type="button" variant="outline" onClick={() => setIsManufacturerCreateOpen(true)}>Создать</Button>
                            <div className="relative flex-1">
                                <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input value={manufacturerSearch} onChange={(e) => setManufacturerSearch(e.target.value)} className="pl-8" placeholder="Поиск (Ctrl+F)" />
                            </div>
                        </div>
                        <div className="max-h-[320px] overflow-auto rounded border">
                            {filteredManufacturerOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={cn(
                                        "grid w-full grid-cols-[minmax(0,1fr)_140px_140px] items-center border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                                        manufacturerSelectionId === option.id && "bg-yellow-50 dark:bg-yellow-950/30"
                                    )}
                                    onClick={() => setManufacturerSelectionId(option.id)}
                                    onDoubleClick={() => {
                                        setItemDraft((prev) => ({ ...prev, manufacturer: option.name }))
                                        setIsManufacturerListOpen(false)
                                    }}
                                >
                                    <span className="truncate">{option.name}</span>
                                    <span className="font-mono text-xs">{option.code}</span>
                                    <span className="truncate text-xs text-muted-foreground">{option.maxDiscount || "0,00"}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isManufacturerCreateOpen} onOpenChange={setIsManufacturerCreateOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Производитель (создание)</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                        <Label>Код:</Label>
                        <Input value={String(manufacturerOptions.reduce((maxValue, option) => Math.max(maxValue, option.code), 0) + 1)} readOnly />
                        <Label>Наименование:</Label>
                        <Input value={manufacturerDraft.name} onChange={(e) => setManufacturerDraft((prev) => ({ ...prev, name: e.target.value }))} />
                        <Label>Максимальная скидка:</Label>
                        <Input value={manufacturerDraft.maxDiscount} onChange={(e) => setManufacturerDraft((prev) => ({ ...prev, maxDiscount: e.target.value }))} />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            onClick={() => {
                                addItemMetaOption(
                                    setManufacturerOptions,
                                    manufacturerDraft.name,
                                    { maxDiscount: manufacturerDraft.maxDiscount },
                                    (name) => setItemDraft((prev) => ({ ...prev, manufacturer: name }))
                                )
                                setManufacturerDraft({ name: "", maxDiscount: "0,00" })
                                setIsManufacturerCreateOpen(false)
                            }}
                        >
                            Записать и закрыть
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isParentListOpen} onOpenChange={setIsParentListOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Номенклатура</DialogTitle>
                        <DialogDescription>Выберите родительскую группу для номенклатуры.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Button type="button" onClick={() => parentSelectionId && selectParentCategory(parentSelectionId)} disabled={!parentSelectionId}>
                                Выбрать
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsCategoryCreateOpen(true)}>
                                Создать группу
                            </Button>
                            <div className="relative flex-1">
                                <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input value={parentSearch} onChange={(e) => setParentSearch(e.target.value)} className="pl-8" placeholder="Поиск (Ctrl+F)" />
                            </div>
                        </div>
                        <div className="max-h-[320px] overflow-auto rounded border">
                            {filteredCategories.map((category) => (
                                <button
                                    key={category.id}
                                    type="button"
                                    className={cn(
                                        "grid w-full grid-cols-[minmax(0,1fr)_140px] items-center border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                                        parentSelectionId === category.id && "bg-yellow-50 dark:bg-yellow-950/30"
                                    )}
                                    onClick={() => setParentSelectionId(category.id)}
                                    onDoubleClick={() => selectParentCategory(category.id)}
                                >
                                    <span className="truncate">{category.name}</span>
                                    <span className="font-mono text-xs">{category.code || "-"}</span>
                                </button>
                            ))}
                            {filteredCategories.length === 0 && (
                                <div className="px-3 py-8 text-center text-sm text-muted-foreground">Группы пока не созданы.</div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isCategoryCreateOpen} onOpenChange={setIsCategoryCreateOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Группа номенклатуры (создание)</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
                        <Label>Код:</Label>
                        <Input value={categoryDraft.code} onChange={(e) => setCategoryDraft((prev) => ({ ...prev, code: e.target.value }))} />
                        <Label>Наименование:</Label>
                        <Input value={categoryDraft.name} onChange={(e) => setCategoryDraft((prev) => ({ ...prev, name: e.target.value }))} />
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={() => createCategoryMutation.mutate()} disabled={createCategoryMutation.isPending}>
                            Записать и закрыть
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isItemNormListOpen} onOpenChange={setIsItemNormListOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Номенклатура</DialogTitle>
                        <DialogDescription>Выберите номенклатуру для строки нормы.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Button type="button" onClick={confirmSelectedItemNorm} disabled={!itemNormListSelectionId}>
                                Выбрать
                            </Button>
                            <div className="relative flex-1">
                                <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input value={itemNormSearch} onChange={(e) => setItemNormSearch(e.target.value)} className="pl-8" placeholder="Поиск (Ctrl+F)" />
                            </div>
                        </div>
                        <div className="max-h-[320px] overflow-auto rounded border">
                            {filteredItemNormItems.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={cn(
                                        "grid w-full grid-cols-[minmax(0,1fr)_140px_110px] items-center border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                                        itemNormListSelectionId === Number(item.id) && "bg-yellow-50 dark:bg-yellow-950/30"
                                    )}
                                    onClick={() => setItemNormListSelectionId(Number(item.id))}
                                    onDoubleClick={() => {
                                        if (activeItemNormRowId) {
                                            applyItemNormSelection(activeItemNormRowId, item)
                                        }
                                        setIsItemNormListOpen(false)
                                    }}
                                >
                                    <span className="truncate">{item.name}</span>
                                    <span className="font-mono text-xs">{item.sku || "-"}</span>
                                    <span>{item.item_type === "SERVICE" ? "Услуга" : "Материал"}</span>
                                </button>
                            ))}
                            {filteredItemNormItems.length === 0 && (
                                <div className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isNotePopoverOpen} onOpenChange={setIsNotePopoverOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Примечание</DialogTitle>
                    </DialogHeader>
                    <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        className="min-h-[160px] w-full rounded-md border bg-background p-3 text-sm outline-none"
                    />
                    <DialogFooter>
                        <Button type="button" onClick={saveNote}>Сохранить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRecipeListOpen} onOpenChange={setIsRecipeListOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Норма</DialogTitle>
                        <DialogDescription>Выберите норму или создайте новую.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Button type="button" onClick={confirmSelectedRecipe}>Выбрать</Button>
                            <Button type="button" variant="outline" onClick={() => activeRecipeRowId && openRecipeCreateDialog(activeRecipeRowId)}>Создать</Button>
                            <div className="relative flex-1">
                                <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="pl-8" placeholder="Поиск (Ctrl+F)" />
                            </div>
                        </div>
                        <div className="max-h-[320px] overflow-auto rounded border">
                            {filteredRecipes.map((recipe) => (
                                <button
                                    key={recipe.id}
                                    type="button"
                                    className={cn(
                                        "grid w-full grid-cols-[minmax(0,1fr)_120px_160px] items-center border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                                        recipeSelectionId === recipe.id && "bg-yellow-50 dark:bg-yellow-950/30"
                                    )}
                                    onClick={() => setRecipeSelectionId(recipe.id)}
                                    onDoubleClick={() => activeRecipeRowId && applyRecipeSelection(activeRecipeRowId, recipe)}
                                >
                                    <span className="truncate">{recipe.name}</span>
                                    <span className="font-mono text-xs">{String(recipe.code).padStart(8, "0")}</span>
                                    <span className="truncate text-xs text-muted-foreground">{recipe.comment || "-"}</span>
                                </button>
                            ))}
                            {filteredRecipes.length === 0 && (
                                <div className="px-3 py-8 text-center text-sm text-muted-foreground">Норм пока нет.</div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isRecipeCreateOpen} onOpenChange={setIsRecipeCreateOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Норма (создание)</DialogTitle>
                        <DialogDescription>Создайте норму и сразу привяжите ее к строке.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                        <Label>Код:</Label>
                        <Input value={String(recipes.reduce((maxValue, recipe) => Math.max(maxValue, recipe.code), 0) + 1).padStart(8, "0")} readOnly />
                        <Label>Наименование:</Label>
                        <Input value={recipeDraft.name} onChange={(e) => setRecipeDraft((prev) => ({ ...prev, name: e.target.value }))} />
                        <Label>Владелец:</Label>
                        <Input value={recipeDraft.owner} onChange={(e) => setRecipeDraft((prev) => ({ ...prev, owner: e.target.value }))} />
                        <Label>Комментарий:</Label>
                        <Input value={recipeDraft.comment} onChange={(e) => setRecipeDraft((prev) => ({ ...prev, comment: e.target.value }))} />
                    </div>
                    <div className="space-y-2 rounded border p-3">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">Состав нормы</div>
                            <Button type="button" variant="outline" size="sm" onClick={() => setRecipeDraftLines((prev) => [...prev, { id: nextRecipeLineId(), itemId: null, quantity: "1" }])}>
                                <PiPlusBold className="mr-2 h-4 w-4" /> Добавить
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {recipeDraftLines.map((line) => {
                                const selectedItem = items.find((item) => Number(item.id) === Number(line.itemId || 0))
                                return (
                                    <div key={line.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_40px]">
                                        <select
                                            className="h-9 rounded-md border bg-background px-3 text-sm"
                                            value={line.itemId || ""}
                                            onChange={(e) => setRecipeDraftLines((prev) => prev.map((entry) => entry.id === line.id ? { ...entry, itemId: Number(e.target.value) || null } : entry))}
                                        >
                                            <option value="">Выберите номенклатуру</option>
                                            {items.map((item) => (
                                                <option key={item.id} value={item.id}>{item.name}</option>
                                            ))}
                                        </select>
                                        <Input value={line.quantity} onChange={(e) => setRecipeDraftLines((prev) => prev.map((entry) => entry.id === line.id ? { ...entry, quantity: e.target.value } : entry))} placeholder={selectedItem?.base_unit || selectedItem?.unit || "Количество"} />
                                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setRecipeDraftLines((prev) => prev.length > 1 ? prev.filter((entry) => entry.id !== line.id) : prev)}>
                                            <PiTrashBold className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={saveRecipe}>Записать и выбрать</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <TabsContent value="history" className="p-8">
                {initialData?.id ? (
                    <DocumentHistoryPanel documentId={initialData.id} documentType="purchases" />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Save the document to view history.</div>
                )}
            </TabsContent>

            <TabsContent value="postings" className="flex-1 p-8 m-0 overflow-auto">
                {initialData?.id ? (
                    <DocumentPostings documentId={initialData.id} endpoint="purchases" />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Save the document to view postings.</div>
                )}
            </TabsContent>
        </Tabs>
    )
}
