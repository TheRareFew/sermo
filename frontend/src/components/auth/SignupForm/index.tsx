import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import Button from '../../common/Button';
import Input from '../../common/Input';
import { signupStart, signupSuccess, signupFailure } from '../../../store/auth/authSlice';
import { RootState } from '../../../types';
import * as authService from '../../../services/api/auth';

const SignupContainer = styled.div`
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

const SignupBox = styled.div`
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

const Header = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
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
  gap: 8px;

  /* Add some space before the submit button */
  & > button {
    margin-top: 8px;
  }
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

interface SignupFormProps {
  onLoginClick: () => void;
}

const SignupForm: React.FC<SignupFormProps> = ({ onLoginClick }) => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      dispatch(signupFailure('Passwords do not match'));
      return;
    }

    dispatch(signupStart());

    try {
      const response = await authService.signup({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
      });
      const userData = await authService.getCurrentUser();
      dispatch(signupSuccess({ ...response, user: userData }));
    } catch (error) {
      dispatch(signupFailure(error instanceof Error ? error.message : 'Failed to sign up'));
    }
  };

  return (
    <SignupContainer>
      <SignupBox>
        <Header>
          <StyledButton onClick={onLoginClick}>
            Back to Login
          </StyledButton>
        </Header>
        <AsciiArt>
          {`
   ____  _____ ____  __  __  ___  
  / ___|| ____|  _ \\|  \\/  |/ _ \\ 
  \\___ \\|  _| | |_) | |\\/| | | | |
   ___) | |___|  _ <| |  | | |_| |
  |____/|_____|_| \\_\\_|  |_|\\___/ 
          `}
        </AsciiArt>
        <Title>Create Account</Title>
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
            label="Full Name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            fullWidth
            required
          />
          <Input
            label="Email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            fullWidth
            required
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
          <Input
            label="Confirm Password"
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            fullWidth
            required
          />
          <Button
            type="submit"
            fullWidth
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
          {error && <ErrorMessage>{error}</ErrorMessage>}
        </Form>
      </SignupBox>
    </SignupContainer>
  );
};

export default SignupForm; 