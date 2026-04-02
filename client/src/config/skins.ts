// ============================================================
// Snake Skin Definitions
// ============================================================

export interface SkinDef {
  id: number;
  name: string;
  colors: string[]; // alternating segment colors
  headColor: string;
  glowColor: string;
  eyeColor: string;
}

export const SKINS: SkinDef[] = [
  {
    id: 0, name: 'Emerald',
    colors: ['#00ff88', '#00cc66'],
    headColor: '#00ff88', glowColor: '#00ff8855', eyeColor: '#fff',
  },
  {
    id: 1, name: 'Ruby',
    colors: ['#ff4466', '#cc2244'],
    headColor: '#ff4466', glowColor: '#ff446655', eyeColor: '#fff',
  },
  {
    id: 2, name: 'Sapphire',
    colors: ['#4488ff', '#2266dd'],
    headColor: '#4488ff', glowColor: '#4488ff55', eyeColor: '#fff',
  },
  {
    id: 3, name: 'Gold',
    colors: ['#ffcc00', '#ddaa00'],
    headColor: '#ffcc00', glowColor: '#ffcc0055', eyeColor: '#333',
  },
  {
    id: 4, name: 'Amethyst',
    colors: ['#aa44ff', '#8822dd'],
    headColor: '#aa44ff', glowColor: '#aa44ff55', eyeColor: '#fff',
  },
  {
    id: 5, name: 'Coral',
    colors: ['#ff8844', '#dd6622'],
    headColor: '#ff8844', glowColor: '#ff884455', eyeColor: '#fff',
  },
  {
    id: 6, name: 'Cyan',
    colors: ['#00ddff', '#00bbdd'],
    headColor: '#00ddff', glowColor: '#00ddff55', eyeColor: '#222',
  },
  {
    id: 7, name: 'Magenta',
    colors: ['#ff44cc', '#dd22aa'],
    headColor: '#ff44cc', glowColor: '#ff44cc55', eyeColor: '#fff',
  },
  {
    id: 8, name: 'Lime',
    colors: ['#aaff00', '#88dd00'],
    headColor: '#aaff00', glowColor: '#aaff0055', eyeColor: '#333',
  },
  {
    id: 9, name: 'Ice',
    colors: ['#aaeeff', '#88ccdd'],
    headColor: '#aaeeff', glowColor: '#aaeeff55', eyeColor: '#335',
  },
  {
    id: 10, name: 'Lava',
    colors: ['#ff2200', '#ff6600', '#ff2200'],
    headColor: '#ff4400', glowColor: '#ff220066', eyeColor: '#ff0',
  },
  {
    id: 11, name: 'Phantom',
    colors: ['#888899', '#555566'],
    headColor: '#aaaabb', glowColor: '#88889944', eyeColor: '#f00',
  },
];

export function getSkin(id: number): SkinDef {
  return SKINS[id % SKINS.length];
}
