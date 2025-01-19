import React from 'react';
import styled from 'styled-components';

interface RetroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
}

const StyledButton = styled.button<RetroButtonProps>`
  padding: 10px;
  margin: 10px 0;
  font-family: 'VT323', monospace;
  font-size: 1.2rem;
  background-color: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.primary};
  border: 2px solid ${props => props.theme.colors.border};
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s;
  width: ${props => props.fullWidth ? '100%' : 'auto'};

  &:hover {
    background-color: ${props => props.theme.colors.primary};
    color: ${props => props.theme.colors.background};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const RetroButton: React.FC<RetroButtonProps> = ({ children, fullWidth = false, ...props }) => {
  return (
    <StyledButton fullWidth={fullWidth} {...props}>
      {children}
    </StyledButton>
  );
};

export default RetroButton; 