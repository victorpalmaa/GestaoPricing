import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  multiSelect = false,
  multiSelectLabel,
}) => {
  const [open, setOpen] = useState(false);
  const selectedValues = multiSelect ? (Array.isArray(value) ? value : []) : [];

  // Find label for current value
  const selectedLabel = options.find(opt => opt.value === value)?.label || '';
  const selectedLabels = useMemo(
    () => options.filter((opt) => selectedValues.includes(opt.value)).map((opt) => opt.label),
    [options, selectedValues]
  );
  const triggerLabel = multiSelect
    ? (selectedLabels.length > 0
        ? (multiSelectLabel
            ? multiSelectLabel(selectedLabels)
            : `${selectedLabels.length} selecionado(s)`)
        : placeholder)
    : (value ? selectedLabel : placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between flex items-center px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
          style={{}}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.keywords || ''}`}
                  onSelect={() => {
                    if (multiSelect) {
                      const nextValues = selectedValues.includes(option.value)
                        ? selectedValues.filter((item) => item !== option.value)
                        : [...selectedValues, option.value];
                      onChange(nextValues);
                      return;
                    }
                    onChange(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      (multiSelect ? selectedValues.includes(option.value) : value === option.value)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SearchableSelect;
