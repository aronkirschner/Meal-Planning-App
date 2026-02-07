export type RecipeCategory = 'main' | 'vegetable' | 'grain';

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
  notes?: string;
  createdAt: string;
}

export interface DayMeal {
  main?: string; // Recipe ID
  vegetable?: string; // Recipe ID
  grain?: string; // Recipe ID
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
