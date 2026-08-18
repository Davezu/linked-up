export const PALETTE_IDS = [
  'velvet',
  'amber',
  'slate',
  'teal',
  'rose',
] as const

export type ColorPalette = (typeof PALETTE_IDS)[number]

export interface PaletteMeta {
  id: ColorPalette
  label: string
  swatch: string
}

export const PALETTES: PaletteMeta[] = [
  { id: 'velvet', label: 'Velvet', swatch: '#7C5CFC' },
  { id: 'amber', label: 'Warm Amber', swatch: '#E07B39' },
  { id: 'slate', label: 'Slate', swatch: '#6B4EE8' },
  { id: 'teal', label: 'Midnight Teal', swatch: '#2A9D8F' },
  { id: 'rose', label: 'Rose Quartz', swatch: '#E879A0' },
]

export function isColorPalette(value: string): value is ColorPalette {
  return (PALETTE_IDS as readonly string[]).includes(value)
}
