export const theme = {
  colors: {
    background: '#000000',
    text: '#33FF33',
    primary: '#00FF00',
    secondary: '#0000FF',
    accent: '#FF00FF',
    error: '#FF0000',
    success: '#00FF00',
    warning: '#FFFF00',
    border: '#33FF33',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  typography: {
    fontFamily: "'VT323', monospace",
    fontSize: {
      small: '0.875rem',
      medium: '1rem',
      large: '1.25rem',
      xlarge: '1.5rem',
    },
    lineHeight: {
      small: 1.2,
      medium: 1.5,
      large: 1.8,
    },
  },
  borders: {
    width: '2px',
    style: 'solid',
    radius: '0',
  },
  effects: {
    boxShadow: 'none',
    transition: '0.2s ease-in-out',
  },
  breakpoints: {
    mobile: '320px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1280px',
  },
  zIndex: {
    modal: 1000,
    dropdown: 100,
    header: 50,
    default: 1,
  },
} as const;

export type Theme = typeof theme; 