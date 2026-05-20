import { Gift } from '../types';

export const CULTURAL_GIFTS: Gift[] = [
  {
    id: 'marimba',
    name: 'Marimba Serrana',
    emoji: '🎶',
    cost: 10,
    description: 'Alegra la transmisión con sones mixes tradicionales de marimba.',
  },
  {
    id: 'mezcalito',
    name: 'Mezcalito Tolín',
    emoji: '🥃',
    cost: 25,
    description: 'Un caballito de mezcal artesanal silvestre para brindar en vivo.',
  },
  {
    id: 'huipil',
    name: 'Huipil Bordado',
    emoji: '👚',
    cost: 50,
    description: 'Un elegante textil tejido en telar de cintura de Santa María Tlahuitoltepec.',
  },
  {
    id: 'tlayuda',
    name: 'Tlayuda Suprema',
    emoji: '🫓',
    cost: 100,
    description: 'La reina de la gastronomía: con asiento, tasajo, quesillo y aguacate.',
  },
  {
    id: 'jaguar',
    name: 'Jaguar Mixe',
    emoji: '🐆',
    cost: 250,
    description: 'Fuerza espiritual y protector sagrado de los bosques de la Sierra.',
  },
  {
    id: 'banda',
    name: 'Banda de Viento',
    emoji: '🎺',
    cost: 500,
    description: '¡La máxima fiesta! Una banda completa tocando el "Bajo el Sol de la Sierra".',
  },
];

export interface CoinPackage {
  id: string;
  coins: number;
  bonusCoins: number;
  priceUSD: number;
  title: string;
  badge?: string;
}

export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'pkg_small',
    coins: 100,
    bonusCoins: 0,
    priceUSD: 1.99,
    title: 'Semilla de Maíz',
  },
  {
    id: 'pkg_medium',
    coins: 500,
    bonusCoins: 50,
    priceUSD: 4.99,
    title: 'Cesta de Barro',
    badge: 'Popular',
  },
  {
    id: 'pkg_large',
    coins: 1200,
    bonusCoins: 150,
    priceUSD: 9.99,
    title: 'Jarrito de Cobre',
    badge: 'Recomendado',
  },
  {
    id: 'pkg_mega',
    coins: 3000,
    bonusCoins: 500,
    priceUSD: 22.99,
    title: 'Sol Resplandeciente',
    badge: 'Mejor Valor',
  },
];
