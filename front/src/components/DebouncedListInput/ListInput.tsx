import React, {useState, useEffect, useCallback} from "react";

import {ListInput} from "@components";

import {debounce} from "@utils";
import type {ListInputType} from "../ListInput/ListInput.types";

interface DebouncedListInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: ListInputType;
  after?: React.ReactNode
  delay?: number; // debounce delay
  showClearButton?: boolean;
}

export const DebouncedListInput: React.FC<DebouncedListInputProps> = ({
  value,
  onChange,
  after,
  placeholder,
  type = "text",
  delay = 2000,
  showClearButton = false,
}) => {
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const debouncedChange = useCallback(
    debounce((val: string) => {
      onChange(val);
    }, delay),
    [onChange, delay]
  );

  const handleChange = (val: string) => {
    setInternalValue(val);
    debouncedChange(val);
  };

  return (
    <ListInput
      showClearButton={showClearButton}
      value={internalValue}
      onChange={handleChange}
      placeholder={placeholder}
      after={after}
      type={type}
    />
  );
};
