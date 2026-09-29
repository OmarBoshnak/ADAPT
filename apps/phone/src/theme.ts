export const colors = {
  floor: '#050B0E',
  petrol: '#0E2A38',
  surface: '#163542',
  surfaceRaised: '#1E4252',
  border: '#2A4A5C',
  accent: '#FF6B2C',
  volt: '#B8FF3C',
  amber: '#FFC53D',
  text: '#FFFFFF',
  textMuted: '#A8C2CE',
  textDim: '#7FA0B0',
};

export const space = { xs: 6, sm: 12, md: 20, lg: 32, xl: 48 };

export const radius = { md: 16, lg: 24, pill: 999 };

export const type = {
  display: { fontSize: 44, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  body: { fontSize: 17, fontWeight: '400', color: colors.textMuted, lineHeight: 24 },
  eyebrow: { fontSize: 13, fontWeight: '700', color: colors.textDim, letterSpacing: 1.6, textTransform: 'uppercase' },
} as const;
