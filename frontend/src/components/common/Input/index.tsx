import React, { useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`;

const InputWrapper = styled.div<{ fullWidth?: boolean }>`
  display: flex;
  flex-direction: column;
  width: ${props => props.fullWidth ? '100%' : 'auto'};
  margin-bottom: 16px;
`;

const Label = styled.label`
  font-family: 'VT323', monospace;
  color: ${props => props.theme.colors.text};
  margin-bottom: 4px;
  text-transform: uppercase;
`;

const InputContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const StyledInput = styled.input<{ hasError?: boolean }>`
  font-family: 'VT323', monospace;
  font-size: 1rem;
  padding: 8px;
  width: 100%;
  background-color: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  border: 2px solid ${props => props.hasError ? props.theme.colors.error : props.theme.colors.border};
  outline: none;
  caret-color: transparent;

  &:focus {
    border-color: ${props => props.hasError ? props.theme.colors.error : props.theme.colors.primary};
  }

  &::placeholder {
    color: ${props => props.theme.colors.text}80;
  }
`;

const Cursor = styled.span<{ isVisible: boolean }>`
  position: absolute;
  display: ${props => props.isVisible ? 'block' : 'none'};
  color: ${props => props.theme.colors.text};
  animation: ${blink} 1s step-end infinite;
  pointer-events: none;
  user-select: none;
  font-family: monospace;
  height: 1.2em;
  top: 50%;
  transform: translateY(-50%);
  transition: left 0.05s ease;
  font-size: 1.2rem;
  line-height: 1;
  margin-left: -2px;
`;

const ErrorText = styled.span`
  font-family: 'VT323', monospace;
  color: ${props => props.theme.colors.error};
  margin-top: 4px;
  font-size: 0.875rem;
`;

const Input: React.FC<InputProps> = ({
  label,
  error,
  fullWidth = false,
  ...props
}) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const [cursorPosition, setCursorPosition] = React.useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateCursorPosition = () => {
    if (!inputRef.current) return;
    const selectionStart = inputRef.current.selectionStart || 0;
    setCursorPosition(selectionStart);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    updateCursorPosition();
    if (props.onFocus) props.onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (props.onBlur) props.onBlur(e);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    updateCursorPosition();
    if (props.onKeyUp) props.onKeyUp(e);
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    updateCursorPosition();
    if (props.onClick) props.onClick(e);
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    updateCursorPosition();
    if (props.onInput) props.onInput(e);
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement === inputRef.current) {
        updateCursorPosition();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const calculateCursorPosition = () => {
    if (!inputRef.current || !containerRef.current) return { left: '8px' };
    
    const text = inputRef.current.value.substring(0, cursorPosition);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (context) {
      context.font = '16px VT323';
      const textWidth = context.measureText(text).width;
      const padding = 8; // match the input padding
      return { left: `${textWidth + padding}px` };
    }
    
    return { left: '8px' };
  };

  return (
    <InputWrapper fullWidth={fullWidth}>
      {label && <Label>{label}</Label>}
      <InputContainer ref={containerRef}>
        <StyledInput
          ref={inputRef}
          hasError={!!error}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyUp={handleKeyUp}
          onClick={handleClick}
          onInput={handleInput}
          {...props}
        />
        <Cursor 
          isVisible={isFocused}
          style={calculateCursorPosition()}
        >
          ▌
        </Cursor>
      </InputContainer>
      {error && <ErrorText>{error}</ErrorText>}
    </InputWrapper>
  );
};

export default Input; 