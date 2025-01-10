import React from 'react';
import styled from 'styled-components';

interface CheckboxProps {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  disabled?: boolean;
}

interface ContainerProps {
  $disabled?: boolean;
}

const Container = styled.label<ContainerProps>`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-family: 'Courier New', monospace;
  color: ${props => props.theme.colors.text};
  opacity: ${props => props.$disabled ? 0.5 : 1};
`;

const Input = styled.input`
  appearance: none;
  width: 16px;
  height: 16px;
  border: 2px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  background-color: ${props => props.theme.colors.background};
  cursor: pointer;
  position: relative;

  &:checked {
    background-color: ${props => props.theme.colors.primary};
    border-color: ${props => props.theme.colors.primary};
  }

  &:checked::after {
    content: '✓';
    position: absolute;
    color: white;
    font-size: 12px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  &:focus {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false
}) => {
  return (
    <Container $disabled={disabled}>
      <Input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      {label}
    </Container>
  );
};

export default Checkbox; 