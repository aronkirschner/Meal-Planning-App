import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Recipe, WeekPlan, AppUser, Family } from './types';

// Collection names
const USERS_COLLECTION = 'users';
const FAMILIES_COLLECTION = 'families';

// Generate unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Generate a short invite code
export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
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

// ============ User Operations ============

export async function getUser(uid: string): Promise<AppUser | null> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) {
    return snapshot.data() as AppUser;
  }
  return null;
}

export async function createUser(user: AppUser): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  await setDoc(userRef, cleanForFirestore(user));
}

export async function updateUserFamily(uid: string, familyId: string): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  await setDoc(userRef, { familyId }, { merge: true });
}

// ============ Family Operations ============

export async function getFamily(familyId: string): Promise<Family | null> {
  const familyRef = doc(db, FAMILIES_COLLECTION, familyId);
  const snapshot = await getDoc(familyRef);
  if (snapshot.exists()) {
    return snapshot.data() as Family;
  }
  return null;
}

export async function getFamilyByInviteCode(inviteCode: string): Promise<Family | null> {
  const familiesRef = collection(db, FAMILIES_COLLECTION);
  const q = query(familiesRef, where('inviteCode', '==', inviteCode.toUpperCase()));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return snapshot.docs[0].data() as Family;
  }
  return null;
}

export async function createFamily(name: string, creatorUid: string): Promise<Family> {
  const family: Family = {
    id: generateId(),
    name,
    createdBy: creatorUid,
    members: [creatorUid],
    inviteCode: generateInviteCode(),
    createdAt: new Date().toISOString(),
  };

  const familyRef = doc(db, FAMILIES_COLLECTION, family.id);
  await setDoc(familyRef, family);

  // Update user's familyId
  await updateUserFamily(creatorUid, family.id);

  return family;
}

export async function joinFamily(family: Family, userUid: string): Promise<void> {
  // Add user to family members if not already present
  if (!family.members.includes(userUid)) {
    const updatedMembers = [...family.members, userUid];
    const familyRef = doc(db, FAMILIES_COLLECTION, family.id);
    await setDoc(familyRef, { members: updatedMembers }, { merge: true });
  }

  // Update user's familyId
  await updateUserFamily(userUid, family.id);
}

export function subscribeToFamily(
  familyId: string,
  callback: (family: Family | null) => void
): () => void {
  const familyRef = doc(db, FAMILIES_COLLECTION, familyId);
  return onSnapshot(familyRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as Family);
    } else {
      callback(null);
    }
  });
}

// ============ Recipe Operations (scoped by family) ============

function getRecipesCollection(familyId: string) {
  return collection(db, FAMILIES_COLLECTION, familyId, 'recipes');
}

export async function getRecipes(familyId: string): Promise<Recipe[]> {
  const recipesRef = getRecipesCollection(familyId);
  const snapshot = await getDocs(recipesRef);
  const recipes = snapshot.docs.map((doc) => doc.data() as Recipe);
  // Sort by createdAt descending
  return recipes.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function addRecipe(familyId: string, recipe: Recipe): Promise<void> {
  try {
    const recipeRef = doc(getRecipesCollection(familyId), recipe.id);
    await setDoc(recipeRef, cleanForFirestore(recipe));
    console.log('Recipe saved successfully:', recipe.name);
  } catch (error) {
    console.error('Error saving recipe:', error);
    throw error;
  }
}

export async function updateRecipe(familyId: string, recipe: Recipe): Promise<void> {
  try {
    const recipeRef = doc(getRecipesCollection(familyId), recipe.id);
    await setDoc(recipeRef, cleanForFirestore(recipe));
  } catch (error) {
    console.error('Error updating recipe:', error);
    throw error;
  }
}

export async function deleteRecipe(familyId: string, id: string): Promise<void> {
  try {
    const recipeRef = doc(getRecipesCollection(familyId), id);
    await deleteDoc(recipeRef);
  } catch (error) {
    console.error('Error deleting recipe:', error);
    throw error;
  }
}

// Subscribe to real-time recipe updates
export function subscribeToRecipes(
  familyId: string,
  callback: (recipes: Recipe[]) => void
): () => void {
  const recipesRef = getRecipesCollection(familyId);

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

// ============ Week Plan Operations (scoped by family) ============

function getWeekPlansCollection(familyId: string) {
  return collection(db, FAMILIES_COLLECTION, familyId, 'weekPlans');
}

export async function getWeekPlans(familyId: string): Promise<WeekPlan[]> {
  const plansRef = getWeekPlansCollection(familyId);
  const snapshot = await getDocs(plansRef);
  return snapshot.docs.map((doc) => doc.data() as WeekPlan);
}

export async function getWeekPlan(familyId: string, weekStart: string): Promise<WeekPlan | undefined> {
  const plans = await getWeekPlans(familyId);
  return plans.find((p) => p.weekStart === weekStart);
}

export async function saveWeekPlan(familyId: string, plan: WeekPlan): Promise<void> {
  try {
    const planRef = doc(getWeekPlansCollection(familyId), plan.id);
    await setDoc(planRef, plan);
    console.log('Week plan saved successfully');
  } catch (error) {
    console.error('Error saving week plan:', error);
    throw error;
  }
}

// Subscribe to real-time week plan updates
export function subscribeToWeekPlans(
  familyId: string,
  callback: (plans: WeekPlan[]) => void
): () => void {
  const plansRef = getWeekPlansCollection(familyId);

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
