/**
 * Built-in categories, shared by the Vue app and the Telegram Worker.
 * Icons are Lucide keys (see src/icons). Values are stored on transactions — never rename them.
 */
export const defaultExpenseCategories = [
  { value: 'food', label: 'Food & Dining', icon: 'utensils', isDefault: true },
  { value: 'transport', label: 'Transportation', icon: 'car', isDefault: true },
  { value: 'shopping', label: 'Shopping', icon: 'shopping-bag', isDefault: true },
  { value: 'bills', label: 'Bills & Utilities', icon: 'receipt', isDefault: true },
  { value: 'entertainment', label: 'Entertainment', icon: 'clapperboard', isDefault: true },
  { value: 'health', label: 'Health', icon: 'heart-pulse', isDefault: true },
  { value: 'education', label: 'Education', icon: 'graduation-cap', isDefault: true },
  { value: 'other', label: 'Other', icon: 'tag', isDefault: true }
]

export const defaultIncomeCategories = [
  { value: 'salary', label: 'Salary', icon: 'briefcase', isDefault: true },
  { value: 'freelance', label: 'Freelance', icon: 'laptop', isDefault: true },
  { value: 'investment', label: 'Investment', icon: 'trending-up', isDefault: true },
  { value: 'gift', label: 'Gift', icon: 'gift', isDefault: true },
  { value: 'other', label: 'Other', icon: 'tag', isDefault: true }
]

/** { icon, label } for a category value — same lookup order as useCategories().getCategoryInfo. */
export function categoryInfo(value, type, customCategories = []) {
  const defaults = type === 'expense' ? defaultExpenseCategories : defaultIncomeCategories
  const list = [...defaults, ...customCategories.filter(c => c.type === type)]
  return list.find(c => c.value === value) || { icon: 'tag', label: value }
}
