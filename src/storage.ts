import type { Recipe, WeekPlan } from './types';

const RECIPES_KEY = 'mealplanner_recipes';
const WEEK_PLANS_KEY = 'mealplanner_weekplans';

export function getRecipes(): Recipe[] {
  const data = localStorage.getItem(RECIPES_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveRecipes(recipes: Recipe[]): void {
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
}

export function addRecipe(recipe: Recipe): void {
  const recipes = getRecipes();
  recipes.push(recipe);
  saveRecipes(recipes);
}

export function updateRecipe(recipe: Recipe): void {
  const recipes = getRecipes();
  const index = recipes.findIndex((r) => r.id === recipe.id);
  if (index !== -1) {
    recipes[index] = recipe;
    saveRecipes(recipes);
  }
}

export function deleteRecipe(id: string): void {
  const recipes = getRecipes().filter((r) => r.id !== id);
  saveRecipes(recipes);
}

export function getWeekPlans(): WeekPlan[] {
  const data = localStorage.getItem(WEEK_PLANS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveWeekPlans(plans: WeekPlan[]): void {
  localStorage.setItem(WEEK_PLANS_KEY, JSON.stringify(plans));
}

function legacySundayKey(saturdayKey: string): string {
  const d = new Date(saturdayKey + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getWeekPlan(weekStart: string): WeekPlan | undefined {
  const legacyKey = legacySundayKey(weekStart);
  return getWeekPlans().find((p) => p.weekStart === weekStart || p.weekStart === legacyKey);
}

export function saveWeekPlan(plan: WeekPlan): void {
  const plans = getWeekPlans();
  const index = plans.findIndex((p) => p.id === plan.id);
  if (index !== -1) {
    plans[index] = plan;
  } else {
    plans.push(plan);
  }
  saveWeekPlans(plans);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
