"use client";

import { Copy, Pipette } from "lucide-react";
import * as React from "react";
import { HexColorPicker } from "react-colorful";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Select } from "@/shared/ui/select/select";
import type { SelectOption } from "@/shared/ui/select/types";
import { cn } from "@/shared/utils/cn";
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, rgbToCmyk, cmykToRgb } from "@/shared/utils/color-utils";

type ColorFormat = "hex" | "rgb" | "hsl" | "cmyk";

interface ColorPickerContextValue {
  color: string;
  format: ColorFormat;
  onColorChange: (color: string) => void;
  onFormatChange: (format: ColorFormat) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ColorPickerContext = React.createContext<ColorPickerContextValue | null>(null);

function useColorPicker() {
  const context = React.useContext(ColorPickerContext);
  if (!context) {
    throw new Error("ColorPicker components must be used within ColorPicker");
  }
  return context;
}

interface ColorPickerProps {
  value?: string;
  onChange?: (color: string) => void;
  defaultFormat?: ColorFormat;
  children: React.ReactNode;
}

function ColorPicker({ value = "#000000", onChange, defaultFormat = "hex", children }: ColorPickerProps) {
  const [color, setColor] = React.useState(value);
  const [format, setFormat] = React.useState<ColorFormat>(defaultFormat);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setColor(value);
  }, [value]);

  const handleColorChange = React.useCallback(
    (newColor: string) => {
      setColor(newColor);
      onChange?.(newColor);
    },
    [onChange]
  );

  const contextValue = React.useMemo(
    () => ({
      color,
      format,
      onColorChange: handleColorChange,
      onFormatChange: setFormat,
      open,
      onOpenChange: setOpen,
    }),
    [color, format, handleColorChange, open]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ColorPickerContext.Provider value={contextValue}>{children}</ColorPickerContext.Provider>
    </Popover>
  );
}

interface ColorPickerTriggerProps extends React.ComponentPropsWithoutRef<"button"> {
  asChild?: boolean;
}

const ColorPickerTrigger = React.forwardRef<HTMLButtonElement, ColorPickerTriggerProps>(
  ({ className, asChild, ...props }, ref) => {
    const { color } = useColorPicker();

    if (asChild) {
      return <PopoverTrigger ref={ref} asChild {...props} />;
    }

    return (
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          className={cn(
            "h-9 w-9 rounded-md border-2 border-border transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            className
          )}
          style={{ backgroundColor: color }}
          {...props}
        />
      </PopoverTrigger>
    );
  }
);
ColorPickerTrigger.displayName = "ColorPickerTrigger";

const ColorPickerSwatch = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { color } = useColorPicker();
    return (
      <div
        ref={ref}
        className={cn("h-9 w-9 rounded-md border-2 border-border", className)}
        style={{ backgroundColor: color }}
        {...props}
      />
    );
  }
);
ColorPickerSwatch.displayName = "ColorPickerSwatch";

type ColorPickerContentProps = React.ComponentPropsWithoutRef<typeof PopoverContent>;

const ColorPickerContent = React.forwardRef<React.ElementRef<typeof PopoverContent>, ColorPickerContentProps>(
  ({ className, ...props }, ref) => {
    return <PopoverContent ref={ref} className={cn("w-auto p-4", className)} align="start" {...props} />;
  }
);
ColorPickerContent.displayName = "ColorPickerContent";

const ColorPickerArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { color, onColorChange } = useColorPicker();

    return (
      <div ref={ref} className={cn("space-y-3 w-full", className)} {...props}>
        <HexColorPicker color={color} onChange={onColorChange} style={{ width: "100%", height: "200px" }} />
      </div>
    );
  }
);
ColorPickerArea.displayName = "ColorPickerArea";

const ColorPickerHueSlider = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { color, onColorChange } = useColorPicker();
    const rgb = React.useMemo(() => hexToRgb(color) || { r: 0, g: 0, b: 0 }, [color]);
    const hsl = React.useMemo(() => rgbToHsl(rgb), [rgb]);

    const handleHueChange = React.useCallback(
      (h: number) => {
        const newHsl = { ...hsl, h };
        const newRgb = hslToRgb(newHsl);
        onColorChange(rgbToHex(newRgb));
      },
      [hsl, onColorChange]
    );

    return (
      <div ref={ref} className={cn("space-y-2", className)} {...props}>
        <Label className="text-xs">Hue</Label>
        <div className="relative h-4 w-full rounded border">
          <div
            className="absolute inset-0 rounded"
            style={{
              background:
                "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
            }}
          />
          <input
            type="range"
            min="0"
            max="360"
            value={hsl.h}
            onChange={(e) => handleHueChange(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
            style={{
              background: "transparent",
            }}
          />
          <div
            className="pointer-events-none absolute top-0 h-full w-0.5 border border-white shadow-sm"
            style={{
              left: `${(hsl.h / 360) * 100}%`,
              transform: "translateX(-50%)",
            }}
          />
        </div>
      </div>
    );
  }
);
ColorPickerHueSlider.displayName = "ColorPickerHueSlider";

const ColorPickerEyeDropper = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<"button">>(
  ({ className, ...props }, ref) => {
    const { onColorChange } = useColorPicker();

    const handleEyeDropper = React.useCallback(async () => {
      try {
        // @ts-expect-error - EyeDropper API may not be in types
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        onColorChange(result.sRGBHex);
      } catch {
        // User cancelled or browser doesn't support
      }
    }, [onColorChange]);

    return (
      <Button
        ref={ref}
        type="button"
        variant="outline"
        size="icon"
        onClick={handleEyeDropper}
        className={className}
        {...props}
      >
        <Pipette className="h-4 w-4" />
      </Button>
    );
  }
);
ColorPickerEyeDropper.displayName = "ColorPickerEyeDropper";

const ColorPickerFormatSelect = React.forwardRef<HTMLDivElement, { className?: string }>(({ className }, ref) => {
  const { format, onFormatChange } = useColorPicker();

  const formatOptions: SelectOption<ColorFormat>[] = [
    { value: "hex", label: "HEX" },
    { value: "rgb", label: "RGB" },
    { value: "hsl", label: "HSL" },
    { value: "cmyk", label: "CMYK" },
  ];

  return (
    <div ref={ref} className={className}>
      <Select<ColorFormat>
        options={formatOptions}
        value={format}
        onChange={(value) => onFormatChange(value)}
        multiple={false}
      />
    </div>
  );
});
ColorPickerFormatSelect.displayName = "ColorPickerFormatSelect";

const ColorPickerInput = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<typeof Input>>(
  ({ className, ...props }, ref) => {
    const { color, format, onColorChange } = useColorPicker();
    const [inputValue, setInputValue] = React.useState("");

    React.useEffect(() => {
      const rgb = hexToRgb(color);
      if (!rgb) {
        setInputValue(color);
        return;
      }

      switch (format) {
        case "hex":
          setInputValue(color);
          break;
        case "rgb":
          setInputValue(`${rgb.r}, ${rgb.g}, ${rgb.b}`);
          break;
        case "hsl": {
          const hsl = rgbToHsl(rgb);
          setInputValue(`${hsl.h}, ${hsl.s}%, ${hsl.l}%`);
          break;
        }
        case "cmyk": {
          const cmyk = rgbToCmyk(rgb);
          setInputValue(`${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%`);
          break;
        }
      }
    }, [color, format]);

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);

        try {
          switch (format) {
            case "hex": {
              const cleanValue = value.replace(/^#/, "");
              if (/^[0-9A-Fa-f]{6}$/i.test(cleanValue)) {
                const hexValue = `#${cleanValue}`;
                setInputValue(hexValue);
                onColorChange(hexValue);
              } else if (/^#[0-9A-Fa-f]{6}$/i.test(value)) {
                onColorChange(value);
              } else if (/^[0-9A-Fa-f]{0,6}$/i.test(cleanValue)) {
                setInputValue(cleanValue);
              }
              break;
            }
            case "rgb": {
              const match = value.match(/(\d+),\s*(\d+),\s*(\d+)/);
              if (match) {
                const r = parseInt(match[1], 10);
                const g = parseInt(match[2], 10);
                const b = parseInt(match[3], 10);
                if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
                  onColorChange(rgbToHex({ r, g, b }));
                }
              }
              break;
            }
            case "hsl": {
              const match = value.match(/(\d+),\s*(\d+)%,\s*(\d+)%/);
              if (match) {
                const h = parseInt(match[1], 10);
                const s = parseInt(match[2], 10);
                const l = parseInt(match[3], 10);
                if (h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100) {
                  const rgb = hslToRgb({ h, s, l });
                  onColorChange(rgbToHex(rgb));
                }
              }
              break;
            }
            case "cmyk": {
              const match = value.match(/(\d+)%,\s*(\d+)%,\s*(\d+)%,\s*(\d+)%/);
              if (match) {
                const c = parseInt(match[1], 10);
                const m = parseInt(match[2], 10);
                const y = parseInt(match[3], 10);
                const k = parseInt(match[4], 10);
                if (c >= 0 && c <= 100 && m >= 0 && m <= 100 && y >= 0 && y <= 100 && k >= 0 && k <= 100) {
                  const rgb = cmykToRgb({ c, m, y, k });
                  onColorChange(rgbToHex(rgb));
                }
              }
              break;
            }
          }
        } catch {
          // Invalid input, ignore
        }
      },
      [format, onColorChange]
    );

    const handleBlur = React.useCallback(() => {
      if (format === "hex") {
        const value = inputValue.replace(/^#/, "");
        if (/^[0-9A-Fa-f]{6}$/i.test(value)) {
          const hexValue = `#${value}`;
          setInputValue(hexValue);
          onColorChange(hexValue);
        }
      }
    }, [format, inputValue, onColorChange]);

    const handleCopy = React.useCallback(() => {
      navigator.clipboard.writeText(inputValue);
    }, [inputValue]);

    return (
      <div className="flex gap-1">
        <Input
          ref={ref}
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn("h-8 text-xs font-mono", className)}
          {...props}
        />
        <Button type="button" size="icon-sm" variant="outline" onClick={handleCopy} title="Копировать">
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    );
  }
);
ColorPickerInput.displayName = "ColorPickerInput";

export {
  ColorPicker,
  ColorPickerTrigger,
  ColorPickerSwatch,
  ColorPickerContent,
  ColorPickerArea,
  ColorPickerEyeDropper,
  ColorPickerFormatSelect,
  ColorPickerInput,
};
