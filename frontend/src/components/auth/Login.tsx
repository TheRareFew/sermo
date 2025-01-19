import React from 'react';
import styled from 'styled-components';
import RetroButton from '../../components/common/RetroButton';

interface LoginProps {
  onLoginWithAuth0: () => void;
}

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
  background-color: ${props => props.theme.colors.backgroundSecondary};

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

const AsciiArt = styled.pre`
  font-family: monospace;
  color: ${props => props.theme.colors.text};
  text-align: center;
  margin-bottom: 20px;
  font-size: 12px;
  line-height: 1.2;
  white-space: pre;
  padding-right: 0;
  margin-right: 0;
  
  & > span {
    display: inline-block;
    text-align: left;
  }
`;

const Login: React.FC<LoginProps> = ({ onLoginWithAuth0 }) => {
  return (
    <LoginContainer>
      <LoginBox>
        <AsciiArt>
          <span>{`
 ____  _____ ____  __  __  ___  
/ ___|| ____|  _ \\|  \\/  |/ _ \\ 
\\___ \\|  _| | |_) | |\\/| | | | |
 ___) | |___|  _ <| |  | | |_| |
|____/|_____|_| \\_\\_|  |_|\\___/ `}</span>
        </AsciiArt>
        <Title>Welcome Home</Title>
        <RetroButton onClick={onLoginWithAuth0} fullWidth>
          Submit Credential
        </RetroButton>
      </LoginBox>
    </LoginContainer>
  );
};

export default Login; 