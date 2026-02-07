import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Recipe, WeekPlan } from './types';

const RECIPES_COLLECTION = 'recipes';
const WEEK_PLANS_COLLECTION = 'weekPlans';

// Generate unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Remove undefined values from object (Firestore doesn't accept undefined)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanForFirestore(obj: any): any {
  const cleaned = { ...obj };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
}

// Recipes
export async function getRecipes(): Promise<Recipe[]> {
  const recipesRef = collection(db, RECIPES_COLLECTION);
  const snapshot = await getDocs(recipesRef);
  const recipes = snapshot.docs.map((doc) => doc.data() as Recipe);
  // Sort by createdAt descending
  return recipes.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function addRecipe(recipe: Recipe): Promise<void> {
  try {
    const recipeRef = doc(db, RECIPES_COLLECTION, recipe.id);
    await setDoc(recipeRef, cleanForFirestore(recipe));
    console.log('Recipe saved successfully:', recipe.name);
  } catch (error) {
    console.error('Error saving recipe:', error);
    throw error;
  }
}

export async function updateRecipe(recipe: Recipe): Promise<void> {
  try {
    const recipeRef = doc(db, RECIPES_COLLECTION, recipe.id);
    await setDoc(recipeRef, cleanForFirestore(recipe));
  } catch (error) {
    console.error('Error updating recipe:', error);
    throw error;
  }
}

export async function deleteRecipe(id: string): Promise<void> {
  try {
    const recipeRef = doc(db, RECIPES_COLLECTION, id);
    await deleteDoc(recipeRef);
  } catch (error) {
    console.error('Error deleting recipe:', error);
    throw error;
  }
}

// Subscribe to real-time recipe updates
export function subscribeToRecipes(
  callback: (recipes: Recipe[]) => void
): () => void {
  const recipesRef = collection(db, RECIPES_COLLECTION);

  const unsubscribe = onSnapshot(
    recipesRef,
    (snapshot) => {
      const recipes = snapshot.docs.map((doc) => doc.data() as Recipe);
      // Sort by createdAt descending
      const sorted = recipes.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      callback(sorted);
    },
    (error) => {
      console.error('Error subscribing to recipes:', error);
    }
  );

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
  try {
    const planRef = doc(db, WEEK_PLANS_COLLECTION, plan.id);
    await setDoc(planRef, plan);
    console.log('Week plan saved successfully');
  } catch (error) {
    console.error('Error saving week plan:', error);
    throw error;
  }
}

// Subscribe to real-time week plan updates
export function subscribeToWeekPlans(
  callback: (plans: WeekPlan[]) => void
): () => void {
  const plansRef = collection(db, WEEK_PLANS_COLLECTION);

  const unsubscribe = onSnapshot(
    plansRef,
    (snapshot) => {
      const plans = snapshot.docs.map((doc) => doc.data() as WeekPlan);
      callback(plans);
    },
    (error) => {
      console.error('Error subscribing to week plans:', error);
    }
  );

  return unsubscribe;
}
