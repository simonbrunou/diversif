import {
  Apple,
  Carrot,
  Drumstick,
  Droplet,
  Egg,
  Fish,
  Leaf,
  Milk,
  Ellipsis,
  ShieldAlert,
  Sprout,
  Utensils,
  Wheat,
  type Icon as LucideIcon
} from 'lucide-svelte';

export type CategoryColor = 'mint' | 'peach' | 'butter' | 'sky' | 'lilac' | 'primary';

export const CATEGORIES = [
  { id: 'legumes', label: 'Légumes', color: 'mint', icon: Carrot },
  { id: 'fruits', label: 'Fruits', color: 'peach', icon: Apple },
  { id: 'feculents', label: 'Féculents', color: 'butter', icon: Wheat },
  { id: 'legumineuses', label: 'Légumineuses', color: 'mint', icon: Sprout },
  { id: 'viandes', label: 'Viandes', color: 'peach', icon: Drumstick },
  { id: 'poissons', label: 'Poissons', color: 'sky', icon: Fish },
  { id: 'oeufs', label: 'Œufs', color: 'butter', icon: Egg },
  { id: 'produits_laitiers', label: 'Produits laitiers', color: 'sky', icon: Milk },
  { id: 'allergenes', label: 'Allergènes', color: 'primary', icon: ShieldAlert },
  { id: 'matieres_grasses', label: 'Matières grasses', color: 'butter', icon: Droplet },
  { id: 'aromates', label: 'Aromates', color: 'lilac', icon: Leaf },
  { id: 'autre', label: 'Autre', color: 'lilac', icon: Ellipsis }
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  color: CategoryColor;
  icon: typeof LucideIcon;
}>;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as readonly string[];

export function getCategoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function getCategoryColor(id: string): CategoryColor {
  return CATEGORIES.find((c) => c.id === id)?.color ?? 'primary';
}

export function getCategoryIcon(id: string): typeof LucideIcon {
  return CATEGORIES.find((c) => c.id === id)?.icon ?? Utensils;
}

export type CategoryClasses = {
  tint: string;
  ring: string;
  text: string;
  dot: string;
  borderLeft: string;
};

const CLASS_MAP: Record<CategoryColor, CategoryClasses> = {
  mint: {
    tint: 'bg-accent-mint/30 dark:bg-accent-mint/20',
    ring: 'ring-1 ring-accent-mint/40 dark:ring-accent-mint/30',
    text: 'text-[hsl(155_45%_22%)] dark:text-accent-mint',
    dot: 'bg-accent-mint',
    borderLeft: 'border-l-accent-mint'
  },
  peach: {
    tint: 'bg-accent-peach/30 dark:bg-accent-peach/20',
    ring: 'ring-1 ring-accent-peach/40 dark:ring-accent-peach/30',
    text: 'text-[hsl(20_60%_28%)] dark:text-accent-peach',
    dot: 'bg-accent-peach',
    borderLeft: 'border-l-accent-peach'
  },
  butter: {
    tint: 'bg-accent-butter/40 dark:bg-accent-butter/20',
    ring: 'ring-1 ring-accent-butter/50 dark:ring-accent-butter/30',
    text: 'text-[hsl(35_70%_24%)] dark:text-accent-butter',
    dot: 'bg-accent-butter',
    borderLeft: 'border-l-accent-butter'
  },
  sky: {
    tint: 'bg-accent-sky/30 dark:bg-accent-sky/20',
    ring: 'ring-1 ring-accent-sky/40 dark:ring-accent-sky/30',
    text: 'text-[hsl(200_55%_28%)] dark:text-accent-sky',
    dot: 'bg-accent-sky',
    borderLeft: 'border-l-accent-sky'
  },
  lilac: {
    tint: 'bg-accent-lilac/30 dark:bg-accent-lilac/20',
    ring: 'ring-1 ring-accent-lilac/40 dark:ring-accent-lilac/30',
    text: 'text-[hsl(280_35%_32%)] dark:text-accent-lilac',
    dot: 'bg-accent-lilac',
    borderLeft: 'border-l-accent-lilac'
  },
  primary: {
    tint: 'bg-primary/10',
    ring: 'ring-1 ring-primary/30',
    text: 'text-primary',
    dot: 'bg-primary',
    borderLeft: 'border-l-primary'
  }
};

export function getCategoryClasses(id: string): CategoryClasses {
  return CLASS_MAP[getCategoryColor(id)];
}
