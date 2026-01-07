export interface SelectOption<TValue extends string | number = string> {
  value: TValue;
  label: string;
  isTemporary?: boolean;
}

export type RenderOptionProps<TValue extends string | number = string> = {
  option: SelectOption<TValue>;
  props: SelectSheetProps<TValue>;
  selected: boolean;
};

export type RenderOption<TValue extends string | number = string> = (
  props: RenderOptionProps<TValue>
) => React.ReactNode;

export type SelectValueProps<TValue extends string | number = string> =
  | {
      multiple: false;
      value?: TValue;
      onChange?: (value: TValue) => void;
    }
  | {
      multiple: true;
      value?: TValue[];
      onChange?: (value: TValue[]) => void;
    };

export type SelectProps<TValue extends string | number = string> = {
  options: SelectOption<TValue>[];
  label?: string;
  placeholder?: string;
  allowClear?: boolean;
  valueLabel?: string;
  renderOption?: RenderOption<TValue>;
  filter?: (search: string) => void;
  disabled?: boolean;
} & SelectValueProps<TValue>;

export type SelectSheetProps<TValue extends string | number = string> = SelectProps<TValue>;

export type SelectDropdownProps<TValue extends string | number = string> = SelectProps<TValue>;
