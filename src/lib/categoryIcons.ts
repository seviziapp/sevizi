// Lucide icon for each service category. Replaces the old emoji glyphs —
// emoji as UI icons read as cheap next to the rest of the line-icon system.
// When adding a ServiceCategory, add its icon here too.
import {
  Wrench, Zap, PaintRoller, Hammer, Scissors, Cog, Shirt, SprayCan, ChefHat,
  Car, Drill, GraduationCap, Sprout, Truck, Shield, Camera, Recycle, BrickWall,
  Flame, AppWindow, Palette, Bike, Sofa, Footprints, Hand, Printer, Sparkles,
  Snowflake,
} from 'lucide-react-native';
import type { ServiceCategory } from './types';

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export const CATEGORY_ICONS: Record<ServiceCategory, IconComponent> = {
  plomberie: Wrench,
  electricite: Zap,
  peinture: PaintRoller,
  menuiserie: Hammer,
  coiffure: Scissors,
  mecanique: Cog,
  couture: Shirt,
  menage: SprayCan,
  cuisine: ChefHat,
  transport: Car,
  reparation: Drill,
  cours: GraduationCap,
  jardinage: Sprout,
  demenagement: Truck,
  securite: Shield,
  photographe: Camera,
  ferrailleur: Recycle,
  macon: BrickWall,
  soudeur: Flame,
  alu: AppWindow,
  serigraphie: Palette,
  coursier: Bike,
  tapissier: Sofa,
  cordonnier: Footprints,
  onglerie: Hand,
  impression: Printer,
  esthetique: Sparkles,
  froid: Snowflake,
};

export function categoryIcon(key?: ServiceCategory | string | null): IconComponent {
  return (key && CATEGORY_ICONS[key as ServiceCategory]) || Wrench;
}
