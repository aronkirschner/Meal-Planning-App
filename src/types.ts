export type RecipeCategory = 'main' | 'vegetable' | 'grain' | 'other';

export type CuisineType =
  | 'American'
  | 'Italian'
  | 'Mexican'
  | 'Asian'
  | 'Mediterranean'
  | 'Indian'
  | 'Other';

export const CUISINE_TYPES: CuisineType[] = [
  'American',
  'Asian',
  'Indian',
  'Italian',
  'Mediterranean',
  'Mexican',
  'Other',
];

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  url: string;
  category: RecipeCategory;
  cuisineType?: CuisineType;
  ingredients: Ingredient[];
  directions: string[];
  notes?: string;
  rating?: number; // 1-5 stars, undefined = unrated
  cookTime?: number; // total cook time in minutes
  createdAt: string;
}

/**
 * Infer a cuisine type from a recipe's name and ingredients using keyword matching.
 * Used to auto-assign cuisine types to existing recipes.
 */
export function inferCuisineType(recipe: Recipe): CuisineType {
  const text = [recipe.name, ...recipe.ingredients.map((i) => i.name)]
    .join(' ')
    .toLowerCase();

  if (
    /pasta|pizza|risotto|parmesan|mozzarella|lasagna|fettuccine|penne|spaghetti|marinara|alfredo|tiramisu|gnocchi|bruschetta|pesto|carbonara|bolognese|ravioli|prosciutto|ricotta|italian/.test(
      text
    )
  ) {
    return 'Italian';
  }

  if (
    /taco|burrito|enchilada|quesadilla|guacamole|salsa|jalape|cilantro|tortilla|fajita|nacho|chimichanga|carnitas|pozole|tamale|elote|mexican/.test(
      text
    )
  ) {
    return 'Mexican';
  }

  if (
    /stir.?fry|soy sauce|teriyaki|sushi|ramen|pho|pad thai|fried rice|lo mein|udon|tempura|edamame|kimchi|bulgogi|bibimbap|spring roll|dumpling|dim sum|hoisin|sesame|sriracha|miso|bok choy|daikon|lemongrass|fish sauce|thai|chinese|japanese|korean|vietnamese|asian/.test(
      text
    )
  ) {
    return 'Asian';
  }

  if (
    /curry|tikka|masala|\bdal\b|naan|biryani|samosa|paneer|tandoori|garam masala|turmeric|\bcumin\b|cardamom|chutney|korma|vindaloo|indian/.test(
      text
    )
  ) {
    return 'Indian';
  }

  if (
    /hummus|falafel|\bpita\b|tahini|shawarma|gyro|tzatziki|baba ganoush|tabbouleh|fattoush|halloumi|greek salad|couscous|kebab|moussaka|spanakopita|baklava|\bfeta\b|mediterranean|middle eastern/.test(
      text
    )
  ) {
    return 'Mediterranean';
  }

  if (
    /burger|bbq|barbecue|hot dog|mac.?and.?cheese|buffalo|coleslaw|biscuit|cornbread|pot roast|meatloaf|clam chowder|pulled pork|american/.test(
      text
    )
  ) {
    return 'American';
  }

  return 'Other';
}

export interface DayMeal {
  main?: string; // Recipe ID or "custom:text"
  vegetable?: string; // Recipe ID or "custom:text"
  grain?: string; // Recipe ID or "custom:text"
  other?: string; // Recipe ID or "custom:text"
}

export interface WeekPlan {
  id: string;
  weekStart: string; // ISO date string for the Sunday of the week
  days: {
    sunday: DayMeal;
    monday: DayMeal;
    tuesday: DayMeal;
    wednesday: DayMeal;
    thursday: DayMeal;
    friday: DayMeal;
    saturday: DayMeal;
  };
}

export type DayOfWeek = keyof WeekPlan['days'];

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

// User and Family types for multi-family support
export interface AppUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  familyId: string | null; // null if user hasn't joined a family yet
}

export interface Family {
  id: string;
  name: string;
  createdBy: string; // uid of the user who created the family
  members: string[]; // array of user uids
  inviteCode: string; // unique code to join the family
  createdAt: string;
}
