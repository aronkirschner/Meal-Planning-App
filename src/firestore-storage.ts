import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Recipe, WeekPlan } from './types';

const RECIPES_COLLECTION = 'recipes';
const WEEK_PLANS_COLLECTION = 'weekPlans';

// Generate unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Recipes
export async function getRecipes(): Promise<Recipe[]> {
  const recipesRef = collection(db, RECIPES_COLLECTION);
  const q = query(recipesRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as Recipe);
}

export async function addRecipe(recipe: Recipe): Promise<void> {
  const recipeRef = doc(db, RECIPES_COLLECTION, recipe.id);
  await setDoc(recipeRef, recipe);
}

export async function updateRecipe(recipe: Recipe): Promise<void> {
  const recipeRef = doc(db, RECIPES_COLLECTION, recipe.id);
  await setDoc(recipeRef, recipe);
}

export async function deleteRecipe(id: string): Promise<void> {
  const recipeRef = doc(db, RECIPES_COLLECTION, id);
  await deleteDoc(recipeRef);
}

// Subscribe to real-time recipe updates
export function subscribeToRecipes(
  callback: (recipes: Recipe[]) => void
): () => void {
  const recipesRef = collection(db, RECIPES_COLLECTION);
  const q = query(recipesRef, orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const recipes = snapshot.docs.map((doc) => doc.data() as Recipe);
    callback(recipes);
  });

  return unsubscribe;
}

// Week Plans
export async function getWeekPlans(): Promise<WeekPlan[]> {
  const plansRef = collection(db, WEEK_PLANS_COLLECTION);
  const snapshot = await getDocs(plansRef);
  return snapshot.docs.map((doc) => doc.data() as WeekPlan);
}

export async function getWeekPlan(weekStart: string): Promise<WeekPlan | undefined> {
  const plans = await getWeekPlans();
  return plans.find((p) => p.weekStart === weekStart);
}

export async function saveWeekPlan(plan: WeekPlan): Promise<void> {
  const planRef = doc(db, WEEK_PLANS_COLLECTION, plan.id);
  await setDoc(planRef, plan);
}

// Subscribe to real-time week plan updates
export function subscribeToWeekPlans(
  callback: (plans: WeekPlan[]) => void
): () => void {
  const plansRef = collection(db, WEEK_PLANS_COLLECTION);

  const unsubscribe = onSnapshot(plansRef, (snapshot) => {
    const plans = snapshot.docs.map((doc) => doc.data() as WeekPlan);
    callback(plans);
  });

  return unsubscribe;
}
