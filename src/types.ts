export type RecipeCategory = 'main' | 'vegetable' | 'grain' | 'other';

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
  weekStart: string; // ISO date string for the Monday of the week
  days: {
    monday: DayMeal;
    tuesday: DayMeal;
    wednesday: DayMeal;
    thursday: DayMeal;
    friday: DayMeal;
    saturday: DayMeal;
    sunday: DayMeal;
  };
}

export type DayOfWeek = keyof WeekPlan['days'];

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
