export const primaryPalette: Record<string, { base: string; hover: string; active: string }> = {
  blue: { base: '#2F6BFF', hover: '#2558D9', active: '#1C46B3' },
  cyan: { base: '#0EA5E9', hover: '#0284C7', active: '#0369A1' },
  red: { base: '#DC2626', hover: '#B91C1C', active: '#991B1B' },
  orange: { base: '#F97316', hover: '#EA580C', active: '#C2410C' },
  gold: { base: '#F59E0B', hover: '#D97706', active: '#B45309' },
  teal: { base: '#14B8A6', hover: '#0D9488', active: '#0F766E' },
  green: { base: '#16A34A', hover: '#15803D', active: '#166534' },
  indigo: { base: '#4F46E5', hover: '#4338CA', active: '#3730A3' },
  purple: { base: '#7C3AED', hover: '#6D28D9', active: '#5B21B6' },
};

export const primarySwatches = Object.entries(primaryPalette).map(([key, palette]) => ({
  key,
  value: palette.base,
}));
