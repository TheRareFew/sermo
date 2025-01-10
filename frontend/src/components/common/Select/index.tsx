// @ts-nocheck
/* TODO: Fix TypeScript types for react-select
 * Current issues:
 * 1. Type mismatch between react-select's value type and our component's props
 * 2. Styled-components generic type issues with react-select
 * 3. Need to properly type the onChange handler
 */

import React from 'react';
import styled from 'styled-components';
import Select from 'react-select';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  label: string;
  options: Option[];
  value: string[];
  onChange: (values: string[]) => void;
  isMulti?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-family: 'Courier New', monospace;
  color: ${props => props.theme.colors.text};
  font-size: 14px;
`;

const StyledSelect = styled(Select)`
  .select__control {
    background-color: ${props => props.theme.colors.background};
    border: 2px solid ${props => props.theme.colors.border};
    border-radius: 4px;
    min-height: 38px;
    font-family: 'Courier New', monospace;

    &:hover {
      border-color: ${props => props.theme.colors.primary};
    }

    &--is-focused {
      border-color: ${props => props.theme.colors.primary};
      box-shadow: 0 0 0 1px ${props => props.theme.colors.primary};
    }
  }

  .select__menu {
    background-color: ${props => props.theme.colors.background};
    border: 2px solid ${props => props.theme.colors.border};
    font-family: 'Courier New', monospace;
  }

  .select__option {
    background-color: transparent;
    color: ${props => props.theme.colors.text};
    cursor: pointer;
    padding: 8px 12px;

    &:hover {
      background-color: ${props => props.theme.colors.hover};
    }

    &--is-selected {
      background-color: ${props => props.theme.colors.primary};
      color: white;
    }
  }

  .select__multi-value {
    background-color: ${props => props.theme.colors.hover};
    border-radius: 4px;
    margin: 2px;

    &__label {
      color: ${props => props.theme.colors.text};
      font-size: 12px;
      padding: 2px 6px;
    }

    &__remove {
      color: ${props => props.theme.colors.text};
      padding: 0 4px;
      cursor: pointer;

      &:hover {
        background-color: ${props => props.theme.colors.error};
        color: white;
        border-radius: 0 4px 4px 0;
      }
    }
  }

  .select__placeholder {
    color: ${props => props.theme.colors.textLight};
  }
`;

const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  options,
  value,
  onChange,
  isMulti = false,
  placeholder,
  disabled = false
}) => {
  const handleChange = (newValue: any) => {
    if (Array.isArray(newValue)) {
      onChange(newValue.map((option: Option) => option.value));
    } else if (newValue) {
      onChange([newValue.value]);
    } else {
      onChange([]);
    }
  };

  const selectedOptions = options.filter(option => value.includes(option.value));

  return (
    <Container>
      <Label>{label}</Label>
      <StyledSelect
        isMulti={isMulti}
        options={options}
        value={selectedOptions}
        onChange={handleChange}
        placeholder={placeholder}
        isDisabled={disabled}
        classNamePrefix="select"
      />
    </Container>
  );
};

export default CustomSelect; 