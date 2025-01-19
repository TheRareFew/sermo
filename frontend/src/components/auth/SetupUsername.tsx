import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { loginSuccess, setAuth0Token, setUser } from '../../store/auth/authSlice';
import { setChannels, setActiveChannel, setUsers } from '../../store/chat/chatSlice';
import { UserStatus, UserResponse, Channel, User } from '../../types';
import { setAuth0Token as setApiAuth0Token, apiRequest, decodeJwt } from '../../services/api/utils';
import WebSocketService from '../../services/websocket';
import { getChannels, getChannelUsers, joinChannel } from '../../services/api/chat';
import { logout } from '../../store/auth/authSlice';

const Container = styled.div`
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

const Box = styled.div`
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

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px;
  background-color: ${props => props.theme.colors.background};
  border: 2px solid ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.text};
  font-family: 'VT323', monospace;
  font-size: 1.2rem;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 10px;
  background-color: ${props => props.theme.colors.primary};
  border: 2px solid ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.text};
  font-family: 'VT323', monospace;
  font-size: 1.2rem;
  cursor: pointer;
  text-transform: uppercase;

  &:hover {
    background-color: ${props => props.theme.colors.primaryHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  text-align: center;
  margin-top: 16px;
  font-family: 'VT323', monospace;
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

const SetupUsername: React.FC = () => {
  const { user, getAccessTokenSilently } = useAuth0();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Always get a fresh token for this request
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: 'http://localhost:8000/api',
          scope: 'openid profile email offline_access'
        }
      });
      
      // Add detailed token debugging
      const decodedToken = decodeJwt(token);
      console.log('Token details:', {
        configuredAudience: 'http://localhost:8000/api',
        tokenAudience: decodedToken?.aud,
        tokenIssuer: decodedToken?.iss,
        tokenScope: decodedToken?.scope
      });
      
      // Set up token for API and WebSocket
      setApiAuth0Token(token);
      dispatch(setAuth0Token(token));
      WebSocketService.setAuth0Token(token);
      WebSocketService.connect();
      
      // Create user in database
      console.log('Creating user in database');
      const newUser = await apiRequest<UserResponse>('/users/auth0', {
        method: 'POST',
        body: JSON.stringify({ 
          username,
          email: user?.email 
        })
      });

      console.log('User created:', newUser);
      
      // Transform the backend user model to match our frontend User type
      dispatch(setUser({
        id: newUser.id,
        username: newUser.username,
        status: newUser.status || 'online',
        avatar_url: newUser.profile_picture_url,
        isBot: false
      }));

      // Get a fresh token before loading channels
      console.log('Getting fresh token for channels request...');
      const channelsToken = await getAccessTokenSilently({
        authorizationParams: {
          audience: 'http://localhost:8000/api',
          scope: 'openid profile email offline_access'
        },
        cacheMode: 'off'
      });
      
      // Add detailed token debugging
      const decodedChannelsToken = decodeJwt(channelsToken);
      console.log('Channels token details:', {
        configuredAudience: 'http://localhost:8000/api',
        tokenAudience: decodedChannelsToken?.aud,
        tokenIssuer: decodedChannelsToken?.iss,
        tokenScope: decodedChannelsToken?.scope
      });
      
      // Set up fresh token for API and WebSocket
      setApiAuth0Token(channelsToken);
      dispatch(setAuth0Token(channelsToken));
      WebSocketService.setAuth0Token(channelsToken);
      WebSocketService.connect();

      // Add a small delay to ensure token propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Load initial channels
      console.log("Loading initial channels...");
      const channels = await getChannels();
      console.log("Channels loaded:", channels);

      // Find first public channel or default to first channel
      const publicChannel = channels.find(channel => channel.is_public) || channels[0];
      if (publicChannel) {
          console.log("Found public channel:", publicChannel);
          
          try {
              // For public channels, we can access users directly
              console.log("Fetching channel users...");
              const users = await getChannelUsers(publicChannel.id);
              console.log("Channel users loaded:", users);
              
              // Convert users array to object
              const usersObject = users.reduce((acc: Record<string, User>, user: User) => ({
                  ...acc,
                  [user.id]: user
              }), {});
              
              // Update Redux store
              dispatch(setChannels(channels));
              dispatch(setActiveChannel(publicChannel.id));
              dispatch(setUsers(usersObject));
              
              // Navigate to home
              navigate("/");
          } catch (error) {
              console.error("Error in channel setup:", error);
              setError("Failed to set up channels. Please try again.");
          }
      } else {
          console.error("No channels available");
          setError("No channels available. Please try again.");
      }
    } catch (error) {
      console.error('Error setting username:', error);
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          // Try one more time with a fresh token
          try {
            const newToken = await getAccessTokenSilently({
              authorizationParams: {
                audience: 'http://localhost:8000/api',
                scope: 'openid profile email offline_access'
              },
              cacheMode: 'off'
            });
            
            // Add detailed token debugging for retry
            const decodedNewToken = decodeJwt(newToken);
            console.log('Retry token details:', {
              configuredAudience: 'http://localhost:8000/api',
              tokenAudience: decodedNewToken?.aud,
              tokenIssuer: decodedNewToken?.iss,
              tokenScope: decodedNewToken?.scope
            });
            
            setApiAuth0Token(newToken);
            dispatch(setAuth0Token(newToken));
            WebSocketService.setAuth0Token(newToken);
            WebSocketService.connect();
            
            const newUser = await apiRequest<UserResponse>('/users/auth0', {
              method: 'POST',
              body: JSON.stringify({ 
                username,
                email: user?.email 
              })
            });
            
            dispatch(setUser({
              id: newUser.id,
              username: newUser.username,
              status: newUser.status || 'online',
              avatar_url: newUser.profile_picture_url,
              isBot: false
            }));

            // Load initial channels
            console.log('Loading initial channels...');
            const channels = await getChannels();
            dispatch(setChannels(channels));

            if (channels.length > 0) {
              // Find the first public channel or default to first channel
              const firstPublicChannel = channels.find((ch: Channel) => ch.is_public) || channels[0];
              dispatch(setActiveChannel(firstPublicChannel.id));
              
              // Load channel users
              const channelUsers = await getChannelUsers(firstPublicChannel.id);
              const usersObject = channelUsers.reduce((acc: Record<string, User>, user: User) => ({
                ...acc,
                [user.id]: user
              }), {});
              dispatch(setUsers(usersObject));
            }

            navigate('/');
            return;
          } catch (retryError) {
            console.error('Error retrying with fresh token:', retryError);
            setError('Session expired. Please try logging in again.');
            dispatch(logout());
          }
        } else if (error.message.includes('400')) {
          setError(error.message);
        } else {
          setError('Failed to set username. Please try again.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <Box>
        <AsciiArt>
          {`
    ____  _____ ____  __  __  ___  
   / ___|| ____|  _ \\|  \\/  |/ _ \\ 
   \\___ \\|  _| | |_) | |\\/| | | | |
    ___) | |___|  _ <| |  | | |_| |
   |____/|_____|_| \\_\\_|  |_|\\___/ 
          `}
        </AsciiArt>
        <Title>Set Your Username</Title>
        <Form onSubmit={handleSubmit}>
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            minLength={3}
            disabled={isLoading}
            autoFocus
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Setting Username...' : 'Continue'}
          </Button>
          {error && <ErrorMessage>{error}</ErrorMessage>}
        </Form>
      </Box>
    </Container>
  );
};

export default SetupUsername; 