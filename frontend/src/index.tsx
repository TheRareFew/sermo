import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import { store } from './store';
import App from './App';
import './styles/global/index.css';
import { Auth0ProviderWithConfig } from './providers/Auth0Provider';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <Auth0ProviderWithConfig>
        <Router>
          <App />
        </Router>
      </Auth0ProviderWithConfig>
    </Provider>
  </React.StrictMode>
); 