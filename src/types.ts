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

export type ProteinType =
  | 'Beef'
  | 'Chicken'
  | 'Pork'
  | 'Seafood'
  | 'Lamb'
  | 'Turkey'
  | 'Vegetarian'
  | 'Vegan';

export const PROTEIN_TYPES: ProteinType[] = [
  'Beef',
  'Chicken',
  'Lamb',
  'Pork',
  'Seafood',
  'Turkey',
  'Vegetarian',
  'Vegan',
];

export interface Recipe {
  id: string;
  name: string;
  url: string;
  category: RecipeCategory;
  cuisineType?: CuisineType;
  proteinType?: ProteinType; // only relevant for mains
  ingredients: Ingredient[];
  directions: string[];
  notes?: string;
  rating?: number; // 1-5 stars, undefined = unrated
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

/**
 * Infer a protein type from a main dish recipe's name and ingredients.
 */
export function inferProteinType(recipe: Recipe): ProteinType | undefined {
  if (recipe.category !== 'main') return undefined;

  const text = [recipe.name, ...recipe.ingredients.map((i) => i.name)]
    .join(' ')
    .toLowerCase();

  if (/\bturkey\b/.test(text)) return 'Turkey';

  if (/\blamb\b|\bmutton\b/.test(text)) return 'Lamb';

  if (
    /\bbeef\b|\bsteak\b|\bbrisket\b|\bchuck\b|\bribeye\b|\bsirloin\b|\bground beef\b|\bpot roast\b|\bcorned beef\b|\bshort rib/.test(
      text
    )
  )
    return 'Beef';

  if (/\bchicken\b|\bpoultry\b|\bhen\b|\brotisserie\b/.test(text))
    return 'Chicken';

  if (
    /\bpork\b|\bbacon\b|\b(ham)\b|\bsausage\b|\bchorizo\b|\bprosciutto\b|\bpancetta\b/.test(
      text
    )
  )
    return 'Pork';

  if (
    /\bsalmon\b|\btuna\b|\bshrimp\b|\bprawns?\b|\bcod\b|\btilapia\b|\bhalibut\b|\bcrab\b|\blobster\b|\bclam\b|\boyster\b|\bscallop\b|\bmussels?\b|\bsea bass\b|\btrout\b|\bflounder\b|\banchov\b|\bsardin\b|\bsquid\b|\bcalamari\b|\bseafood\b|\bfish\b/.test(
      text
    )
  )
    return 'Seafood';

  if (/\bvegan\b/.test(text)) return 'Vegan';

  if (
    /\btofu\b|\btempeh\b|\blentil\b|\bchickpea\b|\bblack bean\b|\bkidney bean\b|\bvegetarian\b|\bveggie\b/.test(
      text
    )
  )
    return 'Vegetarian';

  return undefined;
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
