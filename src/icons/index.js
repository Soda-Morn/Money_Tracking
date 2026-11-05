/**
 * FinanceFlow icon system — single source of truth.
 *
 * Library: Lucide (lucide-vue-next). Outline icons only, rendered through
 * <AppIcon>, which applies the shared size scale and stroke width below.
 *
 * Two kinds of icons live in the app:
 *  1. UI icons (nav, buttons, cards) — import the Lucide component directly
 *     and pass it to <AppIcon :icon="X" />.
 *  2. Data icons (categories, savings goals) — the user picks one, and its KEY
 *     (e.g. 'utensils') is saved in the existing `icon` string field in
 *     Firestore. Older records saved an emoji there instead; `resolveIcon()`
 *     maps those emoji to the matching Lucide icon, so no data migration is needed.
 */
import {
  // Food & drink
  Utensils, Pizza, Coffee, CupSoda, Beer, CakeSlice, Sandwich, Apple, ShoppingCart,
  // Transport
  Car, Bus, Bike, Plane, TrainFront, Fuel, Ship, CarTaxiFront,
  // Shopping
  ShoppingBag, Shirt, Gem, Glasses, Footprints,
  // Home & bills
  House, Lightbulb, Zap, Droplets, Wifi, Smartphone, Receipt, CreditCard, KeyRound, FileText,
  // Health
  HeartPulse, Pill, Stethoscope, Dumbbell, Hospital,
  // Entertainment
  Clapperboard, Gamepad2, Music, Ticket, Tv, PartyPopper, Dices, Drama,
  // Education & work
  BookOpen, GraduationCap, Pencil, Laptop, Monitor, Microscope, Briefcase,
  // Money
  Banknote, TrendingUp, Landmark, Coins, HandCoins, Handshake, PiggyBank, Wallet, Gift,
  // Lifestyle & misc
  Star, Heart, Sparkles, Flame, Trophy, Target, Leaf, Dog, Cat, Baby, Tag, Globe,
  Umbrella, Wrench, Scissors, Shield, TreePalm, Guitar, Camera, Waves, Rocket,
  Palette, Rainbow, Clover, Luggage, Cake, Flower2,
} from 'lucide-vue-next'

// ── Size scale (px) ───────────────────────────────────────────────────────────
// Use these names instead of raw numbers so every screen stays consistent.
export const ICON_SIZE = {
  xs: 14,      // inline hints, chips
  action: 16,  // small row actions (edit / delete / menu), inline with text
  button: 18,  // icons inside buttons and inputs
  nav: 20,     // sidebar + bottom navigation
  card: 24,    // dashboard / summary card icons
  hero: 40,    // empty states, celebration states
}

// Lucide's default stroke is 2. 1.75 reads lighter and more premium at
// 18px+; small icons keep 2 so they don't look faint.
export const strokeFor = (px) => (px <= 16 ? 2 : 1.75)

// ── Data icons (keys are stored in Firestore — never rename a key) ────────────
export const DATA_ICONS = {
  utensils: Utensils, pizza: Pizza, coffee: Coffee, 'cup-soda': CupSoda, beer: Beer,
  'cake-slice': CakeSlice, sandwich: Sandwich, apple: Apple, 'shopping-cart': ShoppingCart,
  car: Car, bus: Bus, bike: Bike, plane: Plane, 'train-front': TrainFront, fuel: Fuel,
  ship: Ship, 'car-taxi-front': CarTaxiFront,
  'shopping-bag': ShoppingBag, shirt: Shirt, gem: Gem, glasses: Glasses, footprints: Footprints,
  house: House, lightbulb: Lightbulb, zap: Zap, droplets: Droplets, wifi: Wifi,
  smartphone: Smartphone, receipt: Receipt, 'credit-card': CreditCard, 'key-round': KeyRound,
  'file-text': FileText,
  'heart-pulse': HeartPulse, pill: Pill, stethoscope: Stethoscope, dumbbell: Dumbbell, hospital: Hospital,
  clapperboard: Clapperboard, 'gamepad-2': Gamepad2, music: Music, ticket: Ticket, tv: Tv,
  'party-popper': PartyPopper, dices: Dices, drama: Drama,
  'book-open': BookOpen, 'graduation-cap': GraduationCap, pencil: Pencil, laptop: Laptop,
  monitor: Monitor, microscope: Microscope, briefcase: Briefcase,
  banknote: Banknote, 'trending-up': TrendingUp, landmark: Landmark, coins: Coins,
  'hand-coins': HandCoins, handshake: Handshake, 'piggy-bank': PiggyBank, wallet: Wallet, gift: Gift,
  star: Star, heart: Heart, sparkles: Sparkles, flame: Flame, trophy: Trophy, target: Target,
  leaf: Leaf, dog: Dog, cat: Cat, baby: Baby, tag: Tag, globe: Globe, umbrella: Umbrella,
  wrench: Wrench, scissors: Scissors, shield: Shield, 'tree-palm': TreePalm, guitar: Guitar,
  camera: Camera, waves: Waves, rocket: Rocket, palette: Palette, rainbow: Rainbow,
  clover: Clover, luggage: Luggage, cake: Cake, 'flower-2': Flower2,
}

// Picker sets, grouped roughly by theme so related icons sit together.
export const CATEGORY_ICON_KEYS = [
  'utensils', 'pizza', 'coffee', 'cup-soda', 'beer', 'sandwich', 'apple', 'shopping-cart',
  'car', 'bus', 'bike', 'plane', 'train-front', 'fuel', 'car-taxi-front', 'ship',
  'shopping-bag', 'shirt', 'gem', 'glasses', 'footprints',
  'house', 'lightbulb', 'zap', 'droplets', 'wifi', 'smartphone', 'receipt', 'credit-card', 'file-text',
  'heart-pulse', 'pill', 'stethoscope', 'dumbbell',
  'clapperboard', 'gamepad-2', 'music', 'ticket', 'tv', 'drama',
  'book-open', 'graduation-cap', 'laptop', 'microscope',
  'briefcase', 'banknote', 'trending-up', 'landmark', 'coins', 'hand-coins', 'handshake', 'gift',
  'heart', 'star', 'dog', 'cat', 'baby', 'leaf', 'wrench', 'scissors', 'umbrella', 'tag',
]

export const GOAL_ICON_KEYS = [
  'target', 'piggy-bank', 'house', 'car', 'plane', 'smartphone', 'laptop', 'graduation-cap',
  'gem', 'party-popper', 'dumbbell', 'tree-palm', 'guitar', 'camera', 'waves', 'rocket',
  'palette', 'globe', 'dog', 'gamepad-2', 'trophy', 'star', 'key-round', 'luggage',
  'shopping-bag', 'cake', 'flower-2', 'baby', 'bike', 'ship', 'heart', 'shield',
]

// ── Legacy emoji → icon key (covers every emoji the old pickers/defaults offered) ─
const EMOJI_TO_KEY = {
  // food
  '🍔': 'utensils', '🍕': 'pizza', '🍜': 'utensils', '🍣': 'utensils', '🥗': 'leaf', '🍰': 'cake-slice',
  '☕': 'coffee', '🥤': 'cup-soda', '🍺': 'beer', '🥩': 'utensils',
  // transport
  '🚗': 'car', '🚌': 'bus', '🚲': 'bike', '✈': 'plane', '🚂': 'train-front', '🛵': 'bike',
  '🚕': 'car-taxi-front', '🛳': 'ship',
  // shopping
  '🛍': 'shopping-bag', '👗': 'shirt', '💎': 'gem', '🛒': 'shopping-cart', '👟': 'footprints', '🕶': 'glasses',
  // home & bills
  '📄': 'receipt', '🏠': 'house', '🏡': 'house', '💡': 'lightbulb', '📱': 'smartphone', '💳': 'credit-card', '🔑': 'key-round',
  // health
  '🏥': 'hospital', '💊': 'pill', '🏃': 'footprints', '🧘': 'heart-pulse', '💪': 'dumbbell', '🦷': 'stethoscope',
  '🏋': 'dumbbell',
  // entertainment
  '🎬': 'clapperboard', '🎮': 'gamepad-2', '🎵': 'music', '🎭': 'drama', '🎪': 'ticket', '🎲': 'dices',
  '🎸': 'guitar', '🎹': 'music', '📷': 'camera', '🎨': 'palette', '🏄': 'waves', '🤿': 'waves',
  // education & work
  '📚': 'book-open', '📖': 'book-open', '🎓': 'graduation-cap', '✏': 'pencil', '🔬': 'microscope',
  '🖥': 'monitor', '💻': 'laptop', '💼': 'briefcase',
  // money
  '💰': 'piggy-bank', '📈': 'trending-up', '🏦': 'landmark', '💵': 'banknote', '🤝': 'handshake', '🎁': 'gift',
  // misc
  '🎯': 'target', '⭐': 'star', '🌟': 'star', '✨': 'sparkles', '❤': 'heart', '🔥': 'flame', '🏆': 'trophy',
  '🌿': 'leaf', '🍀': 'clover', '🐶': 'dog', '🐱': 'cat', '🎉': 'party-popper', '🎂': 'cake',
  '🌈': 'rainbow', '📌': 'tag', '⚡': 'zap', '💍': 'gem', '🌴': 'tree-palm', '🚀': 'rocket',
  '🌎': 'globe', '🧳': 'luggage', '🌺': 'flower-2', '🦄': 'sparkles', '🦋': 'sparkles',
}

/**
 * Resolve a stored icon value (Lucide key OR legacy emoji) to a component.
 * Unknown values (e.g. a custom emoji a user typed) fall back to `fallback`.
 */
export function resolveIcon(value, fallback = 'tag') {
  if (!value) return DATA_ICONS[fallback]
  if (DATA_ICONS[value]) return DATA_ICONS[value]
  // Strip the emoji variation selector (U+FE0F) so '🛍️' and '🛍' match.
  const key = EMOJI_TO_KEY[String(value).replace(/️/g, '').trim()]
  return DATA_ICONS[key] || DATA_ICONS[fallback]
}
