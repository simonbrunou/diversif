import { Home, Apple, Plus, ShieldCheck, Sparkles, type Icon as LucideIcon } from 'lucide-svelte';

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LucideIcon;
  primary?: boolean;
};

export function getChildNavItems(childId: number): NavItem[] {
  return [
    { href: `/child/${childId}`, label: 'Tableau', icon: Home },
    { href: `/child/${childId}/foods`, label: 'Aliments', icon: Apple },
    { href: `/child/${childId}/log`, label: 'Logguer', icon: Plus, primary: true },
    { href: `/child/${childId}/allergens`, label: 'Allergènes', icon: ShieldCheck },
    { href: `/child/${childId}/suggestions`, label: 'Idées', icon: Sparkles }
  ];
}

export function isNavItemActive(href: string, pathname: string, childId: number): boolean {
  if (href === `/child/${childId}`) return pathname === href;
  return pathname.startsWith(href);
}
