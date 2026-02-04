import cn from 'classnames'
import React from 'react'
import type { ChangeEvent } from 'react'

import styles from './ListInput.module.scss'
import { Icon } from '../Icon'

export interface ListInputProps {
  textColor?: 'primary' | 'secondary' | 'tertiary'
  value?: string | number
  onChange?: (value: string) => void
  onBlur?: () => void
  type?: 'text' | 'number' | 'password' | 'email' | 'tel' | 'url' | 'search'
  placeholder?: string
  disabled?: boolean
  className?: string
  autoComplete?: 'on' | 'off'
  maxLength?: number
  minLength?: number
  pattern?: string
  required?: boolean
  readOnly?: boolean
  name?: string
  id?: string
  step?: string | number
  min?: string | number
  max?: string | number
  inputMode?:
    | 'none'
    | 'text'
    | 'decimal'
    | 'numeric'
    | 'tel'
    | 'search'
    | 'email'
    | 'url'
  after?: React.ReactNode
  before?: React.ReactNode
  showClearButton?: boolean
}

export const ListInput: React.FC<ListInputProps> = ({
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled = false,
  className,
  autoComplete = 'off',
  maxLength,
  minLength,
  pattern,
  required = false,
  readOnly = false,
  name,
  id,
  step,
  min,
  max,
  textColor = 'primary',
  inputMode,
  after,
  before,
  showClearButton = false,
  onBlur,
}) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value)
    }
  }

  const handleClear = () => {
    if (onChange && !disabled) {
      onChange('')
    }
  }

  const hasValue = value !== undefined && value !== null && value !== ''

  return (
    <div className={styles.listInputContainer}>
      {before && <div className={styles.before}>{before}</div>}
      <input
        className={cn(
          styles.listInput,
          textColor && styles[`listInput-${textColor}`],
          className
        )}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        maxLength={maxLength}
        minLength={minLength}
        pattern={pattern}
        required={required}
        readOnly={readOnly}
        name={name}
        id={id}
        step={step}
        min={min}
        max={max}
        inputMode={inputMode}
      />
      {showClearButton && hasValue && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={styles.clearButton}
          aria-label="Clear input"
        >
          <Icon name="cross" size={16} color="tertiary" />
        </button>
      )}
      {after && <div>{after}</div>}
    </div>
  )
}
