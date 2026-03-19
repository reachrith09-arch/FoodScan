/**
 * Common food and product terms for instant search autocomplete.
 * Sorted for consistent ordering; filtered by user input as they type.
 */
export const SEARCH_SUGGESTION_TERMS = [
  "Apple", "Avocado", "Almond milk", "Almond butter", "Artisan bread",
  "Banana", "Bacon", "Bagel", "Beef", "Beer", "Bread", "Butter", "Broccoli",
  "Cereal", "Cheese", "Chicken", "Chocolate", "Coca-Cola", "Coffee", "Cookies", "Crackers", "Croissant", "Chips", "Cottage cheese", "Cream cheese",
  "Dark chocolate", "Diet soda", "Doughnut", "Dressing",
  "Eggs", "Energy drink", "English muffin",
  "Fish", "Flour", "French fries", "French toast", "Frozen pizza", "Frozen yogurt", "Fruit juice", "Fruit salad", "Fritos",
  "Granola", "Greek yogurt", "Green tea", "Ground beef",
  "Ham", "Honey", "Hot dog", "Hummus",
  "Ice cream", "Iced coffee", "Instant noodles",
  "Jam", "Juice",
  "Ketchup", "Kombucha",
  "Lactose-free milk", "Latte", "Lemonade", "Lentils",
  "Mac and cheese", "Mango", "Maple syrup", "Mayonnaise", "Milk", "Muffin", "Mustard",
  "Nutella", "Nuts",
  "Oatmeal", "Olive oil", "Orange juice", "Organic milk",
  "Pasta", "Peanut butter", "Pizza", "Popcorn", "Potato chips", "Protein bar", "Pudding",
  "Quinoa",
  "Rice", "Rice milk", "Roll",
  "Salad", "Salmon", "Salsa", "Sandwich", "Sausage", "Smoothie", "Soda", "Sour cream", "Soy milk", "Spaghetti", "Sparkling water", "Steak", "Sugar",
  "Taco", "Tea", "Toast", "Tofu", "Tomato sauce", "Tortilla", "Tuna", "Turkey",
  "Vegan cheese", "Vegetable oil", "Vinegar",
  "Waffle", "Water", "Whole milk", "Wine",
  "Yogurt",
  "Zucchini",
];

/**
 * Filter terms that match the query (case-insensitive).
 * Matches terms where any word starts with the query.
 */
export function getMatchingSuggestions(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const results: string[] = [];
  for (const term of SEARCH_SUGGESTION_TERMS) {
    const lower = term.toLowerCase();
    const words = lower.split(/\s+/);
    const matches = words.some((w) => w.startsWith(q) || (q.length >= 2 && w.includes(q)));
    if (matches) {
      results.push(term);
      if (results.length >= limit) break;
    }
  }
  return results;
}
