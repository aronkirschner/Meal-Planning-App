export type RecipeCategory = 'main' | 'vegetable' | 'grain' | 'other';

export type CuisineType =
  | 'american'
  | 'italian'
  | 'mexican'
  | 'asian'
  | 'indian'
  | 'mediterranean'
  | 'middle-eastern'
  | 'french'
  | 'japanese'
  | 'chinese'
  | 'thai'
  | 'korean'
  | 'other';

export const CUISINE_LABELS: Record<CuisineType, string> = {
  american: 'American',
  italian: 'Italian',
  mexican: 'Mexican',
  asian: 'Asian',
  indian: 'Indian',
  mediterranean: 'Mediterranean',
  'middle-eastern': 'Middle Eastern',
  french: 'French',
  japanese: 'Japanese',
  chinese: 'Chinese',
  thai: 'Thai',
  korean: 'Korean',
  other: 'Other',
};

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
  ingredients: Ingredient[];
  directions: string[];
  notes?: string;
  rating?: number; // 1-5 stars, undefined = unrated
  cuisine?: CuisineType;
  createdAt: string;
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
