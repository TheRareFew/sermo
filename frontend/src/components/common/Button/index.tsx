import React from 'react';
import styled from 'styled-components';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

const StyledButton = styled.button<ButtonProps>`
  font-family: 'VT323', monospace;
  font-size: ${props => {
    switch (props.size) {
      case 'small': return '0.875rem';
      case 'large': return '1.25rem';
      default: return '1rem';
    }
  }};
  padding: ${props => {
    switch (props.size) {
      case 'small': return '4px 8px';
      case 'large': return '12px 24px';
      default: return '8px 16px';
    }
  }};
  width: ${props => props.fullWidth ? '100%' : 'auto'};
  color: ${props => props.theme.colors.text};
  background-color: ${props => props.theme.colors.background};
  border: 2px solid ${props => {
    switch (props.variant) {
      case 'secondary': return props.theme.colors.secondary;
      case 'danger': return props.theme.colors.error;
      default: return props.theme.colors.primary;
    }
  }};
  cursor: pointer;
  text-transform: uppercase;
  position: relative;
  outline: none;

  &:before {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    border: 2px solid ${props => {
      switch (props.variant) {
        case 'secondary': return props.theme.colors.secondary;
        case 'danger': return props.theme.colors.error;
        default: return props.theme.colors.primary;
      }
    }};
    pointer-events: none;
  }

  &:hover {
    background-color: ${props => {
      switch (props.variant) {
        case 'secondary': return props.theme.colors.secondary;
        case 'danger': return props.theme.colors.error;
        default: return props.theme.colors.primary;
      }
    }};
    color: ${props => props.theme.colors.background};
  }

  &:active {
    transform: translateY(2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  ...props
}) => {
  return (
    <StyledButton
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      {...props}
    >
      {children}
    </StyledButton>
  );
};

export default Button; 