'use client'

import Select, { MultiValue, StylesConfig } from 'react-select'

export interface SelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: SelectOption[]
  value: SelectOption[]
  onChange: (selected: SelectOption[]) => void
  placeholder?: string
  isLoading?: boolean
  isDisabled?: boolean
  noOptionsMessage?: string
}

const selectStyles: StylesConfig<SelectOption, true> = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.75rem',
    borderColor: state.isFocused ? '#6366f1' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(99, 102, 241, 0.1)' : 'none',
    '&:hover': { borderColor: '#6366f1' },
    fontSize: '0.875rem',
    minHeight: '42px',
    backgroundColor: 'white',
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: '#eef2ff',
    borderRadius: '0.375rem',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#4f46e5',
    fontSize: '0.75rem',
    fontWeight: '600',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#4f46e5',
    borderRadius: '0 0.375rem 0.375rem 0',
    '&:hover': { backgroundColor: '#c7d2fe', color: '#3730a3' },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.75rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
    zIndex: 50,
    overflow: 'hidden',
  }),
  menuList: (base) => ({
    ...base,
    padding: '4px',
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: '0.5rem',
    backgroundColor: state.isSelected ? '#6366f1' : state.isFocused ? '#eef2ff' : 'white',
    color: state.isSelected ? 'white' : '#1e293b',
    fontSize: '0.875rem',
    cursor: 'pointer',
    padding: '8px 12px',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#94a3b8',
    fontSize: '0.875rem',
  }),
  noOptionsMessage: (base) => ({
    ...base,
    fontSize: '0.875rem',
    color: '#94a3b8',
  }),
}

export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  isLoading = false,
  isDisabled = false,
  noOptionsMessage = 'Tidak ada opsi tersedia',
}: MultiSelectProps) {
  return (
    <Select<SelectOption, true>
      isMulti
      options={options}
      value={value}
      onChange={(selected: MultiValue<SelectOption>) => onChange(selected as SelectOption[])}
      placeholder={placeholder}
      isLoading={isLoading}
      isDisabled={isDisabled}
      styles={selectStyles}
      noOptionsMessage={() => noOptionsMessage}
      loadingMessage={() => 'Memuat...'}
      closeMenuOnSelect={false}
      isClearable={false}
      instanceId="multi-select-students"
    />
  )
}
