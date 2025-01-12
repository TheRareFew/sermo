import React, { useState } from 'react';
import styled from 'styled-components';
import Button from '../../common/Button';
import Input from '../../common/Input';
import * as authService from '../../../services/api/auth';

const ForgotContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  margin: 0;
  padding: 0;
  background-color: ${props => props.theme.colors.background};
  position: fixed;
  top: 0;
  left: 0;
  overflow: hidden;
`;

const ForgotBox = styled.div`
  width: 100%;
  max-width: 400px;
  border: 2px solid ${props => props.theme.colors.border};
  padding: 20px;
  position: relative;
  margin: 0;
  max-height: calc(100vh - 40px);
  overflow-y: auto;

  /* Hide scrollbar but keep functionality */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }

  &:before {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    border: 2px solid ${props => props.theme.colors.border};
    pointer-events: none;
  }

  @media (max-width: 440px) {
    max-width: calc(100vw - 40px);
  }
`;

const Title = styled.h1`
  font-family: 'VT323', monospace;
  color: ${props => props.theme.colors.text};
  text-align: center;
  margin-bottom: 20px;
  text-transform: uppercase;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Links = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 16px;
`;

const StyledButton = styled.button`
  background: none;
  border: none;
  font-family: 'VT323', monospace;
  color: ${props => props.theme.colors.primary};
  text-decoration: none;
  text-transform: uppercase;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: ${props => props.theme.colors.text};
  }
`;

const AsciiArt = styled.pre`
  font-family: monospace;
  color: ${props => props.theme.colors.text};
  text-align: center;
  margin-bottom: 20px;
  font-size: 12px;
  line-height: 1.2;
  white-space: pre;
`;

const Message = styled.div<{ isError?: boolean }>`
  color: ${props => props.isError ? props.theme.colors.error : props.theme.colors.success};
  text-align: center;
  margin-top: 16px;
  font-family: 'VT323', monospace;
`;

interface ForgotPasswordProps {
  onLoginClick: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onLoginClick }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await authService.forgotPassword(email);
      setMessage({
        text: 'Password reset instructions have been sent to your email',
        isError: false,
      });
      setTimeout(onLoginClick, 3000); // Redirect to login after 3 seconds
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to send reset email',
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ForgotContainer>
      <ForgotBox>
        <AsciiArt>
          {`
   ____  _____ ____  __  __  ___  
  / ___|| ____|  _ \\|  \\/  |/ _ \\ 
  \\___ \\|  _| | |_) | |\\/| | | | |
   ___) | |___|  _ <| |  | | |_| |
  |____/|_____|_| \\_\\_|  |_|\\___/ 
          `}
        </AsciiArt>
        <Title>Reset Password</Title>
        <Form onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            autoFocus
          />
          <Button
            type="submit"
            fullWidth
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Instructions'}
          </Button>
          {message && (
            <Message isError={message.isError}>
              {message.text}
            </Message>
          )}
        </Form>
        <Links>
          <StyledButton onClick={onLoginClick}>
            Back to Login
          </StyledButton>
        </Links>
      </ForgotBox>
    </ForgotContainer>
  );
};

export default ForgotPassword; 