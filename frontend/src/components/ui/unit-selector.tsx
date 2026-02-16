import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface ItemUnit {
    id: number | null;
    name: string;
    coefficient: number;
}

interface UnitSelectorProps {
    value: number | null;
    onChange: (value: number | null, coefficient: number) => void;
    units?: ItemUnit[];
    baseUnit?: string;
    disabled?: boolean;
}

const defaultUnits: ItemUnit[] = [
    { id: null, name: 'pcs', coefficient: 1 }, // Base Unit
]

export function UnitSelector({ value, onChange, units = defaultUnits, baseUnit = 'pcs', disabled }: UnitSelectorProps) {
    // Handle null explicitly
    const selectedUnit = units.find(u => u.id === value) || units[0];

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div>
                        <Select
                            value={value === null ? "null" : value.toString()}
                            onValueChange={(val) => {
                                const id = val === "null" ? null : Number(val);
                                const unit = units.find(u => u.id === id);
                                if (unit) onChange(unit.id, unit.coefficient);
                            }}
                            disabled={disabled}
                        >
                            <SelectTrigger className="h-6 w-16 text-xs px-1 border-none focus:ring-0 shadow-none bg-transparent">
                                <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                                {units.map(unit => (
                                    <SelectItem key={String(unit.id)} value={unit.id === null ? "null" : unit.id.toString()} className="text-xs flex justify-between">
                                        <span>{unit.name}</span>
                                        {unit.coefficient > 1 && <span className="ml-2 text-muted-foreground opacity-50 text-[10px]">x{unit.coefficient}</span>}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </TooltipTrigger>
                {selectedUnit && selectedUnit.coefficient > 1 ? (
                    <TooltipContent>
                        <p className="text-xs">1 {selectedUnit.name} = {selectedUnit.coefficient} {baseUnit}</p>
                    </TooltipContent>
                ) : (
                    <TooltipContent>
                        <p className="text-xs">Base Unit ({baseUnit})</p>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    )
}
