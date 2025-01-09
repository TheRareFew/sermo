import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Modal from '../../common/Modal';
import { loginStart, loginSuccess, loginFailure } from '../../../store/auth/authSlice';
import { RootState } from '../../../store/types';
import * as authService from '../../../services/api/auth';

const LoginContainer = styled.div`
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

const LoginBox = styled.div`
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
  justify-content: space-between;
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

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  text-align: center;
  margin-top: 16px;
  font-family: 'VT323', monospace;
`;

interface LoginFormProps {
  onSignupClick: () => void;
  onForgotPasswordClick: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSignupClick, onForgotPasswordClick }) => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(loginStart());

    try {
      const response = await authService.login(formData);
      dispatch(loginSuccess(response));
    } catch (error) {
      dispatch(loginFailure(error instanceof Error ? error.message : 'Failed to login'));
    }
  };

  return (
    <LoginContainer>
      <LoginBox>
        <AsciiArt>
          {`
   ____  _____ ____  __  __  ___  
  / ___|| ____|  _ \\|  \\/  |/ _ \\ 
  \\___ \\|  _| | |_) | |\\/| | | | |
   ___) | |___|  _ <| |  | | |_| |
  |____/|_____|_| \\_\\_|  |_|\\___/ 
          `}
        </AsciiArt>
        <Title>Login</Title>
        <Form onSubmit={handleSubmit}>
          <Input
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            fullWidth
            required
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            fullWidth
            required
          />
          <Button
            type="submit"
            fullWidth
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
          {error && <ErrorMessage>{error}</ErrorMessage>}
        </Form>
        <Links>
          <StyledButton onClick={onForgotPasswordClick}>
            Forgot Password?
          </StyledButton>
          <StyledButton onClick={onSignupClick}>
            Create Account
          </StyledButton>
        </Links>
      </LoginBox>
    </LoginContainer>
  );
};

export default LoginForm; 