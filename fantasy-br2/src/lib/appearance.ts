// Appearance configuration types and defaults
// Admin can change these via the Appearance Editor panel

export interface AppearanceConfig {
  // Branding
  logoUrl: string;
  logoText: string;
  siteName: string;

  // Colors (CSS hex)
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardColor: string;
  textColor: string;

  // Typography
  fontFamily: string;
  headingSize: 'sm' | 'md' | 'lg' | 'xl';
  bodySize: 'sm' | 'md' | 'lg';

  // League
  leagueName: string;
  seasonYear: number;
}

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  logoUrl: '',
  logoText: 'FB',
  siteName: 'Fantasy BR',
  primaryColor: '#10b981', // emerald-500
  secondaryColor: '#059669', // emerald-600
  accentColor: '#f59e0b', // amber-500
  backgroundColor: '#09090b', // zinc-950
  cardColor: '#18181b', // zinc-800
  textColor: '#fafafa', // zinc-50
  fontFamily: 'system-ui',
  headingSize: 'lg',
  bodySize: 'md',
  leagueName: 'Brasileirao',
  seasonYear: new Date().getFullYear(),
};

export function appearanceToCssVars(config: AppearanceConfig): Record<string, string> {
  const headingSizes = { sm: '1.25rem', md: '1.5rem', lg: '1.875rem', xl: '2.25rem' };
  const bodySizes = { sm: '0.813rem', md: '0.875rem', lg: '1rem' };

  return {
    '--color-primary': config.primaryColor,
    '--color-secondary': config.secondaryColor,
    '--color-accent': config.accentColor,
    '--background': config.backgroundColor,
    '--card': config.cardColor,
    '--foreground': config.textColor,
    '--font-family': config.fontFamily,
    '--heading-size': headingSizes[config.headingSize],
    '--body-size': bodySizes[config.bodySize],
  };
}
