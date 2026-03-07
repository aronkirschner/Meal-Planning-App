import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Recipe, WeekPlan, Family, DayMeal, DayOfWeek } from './types';
import { inferCuisineType, inferProteinType } from './types';
import {
  addRecipe,
  updateRecipe,
  deleteRecipe,
  saveWeekPlan,
  getRecipes,
  getWeekPlans,
  getWeekPlan,
  getFamily,
  generateId,
} from './firestore-storage';
import { AuthProvider, useAuth } from './AuthContext';
import { Login } from './components/Login';
import { FamilyManager } from './components/FamilyManager';
import { InviteModal } from './components/InviteModal';
import { PaprikaImport } from './components/PaprikaImport';
import { RecipeForm } from './components/RecipeForm';
import { RecipeList } from './components/RecipeList';
import { WeekPlanner } from './components/WeekPlanner';
import { ShoppingList } from './components/ShoppingList';
import { CommunityRecipes } from './components/CommunityRecipes';
import { CookingAnalytics } from './components/CookingAnalytics';
import { XLSRecipeImport } from './components/XLSRecipeImport';
import './App.css';

type Tab = 'recipes' | 'planner' | 'shopping' | 'community' | 'analytics';

function getSaturday(date: Date): Date {
  const d = new Date(date);
  const offset = (d.getDay() + 1) % 7;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function MealPlannerApp() {
  const { appUser, family, setFamily, logOut, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('planner');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentWeekPlan, setCurrentWeekPlan] = useState<WeekPlan | null>(null);
  const [allWeekPlans, setAllWeekPlans] = useState<WeekPlan[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPaprikaImport, setShowPaprikaImport] = useState(false);
  const [showXLSImport, setShowXLSImport] = useState(false);

  // Load family data if user has a familyId
  useEffect(() => {
    if (appUser?.familyId && !family) {
      getFamily(appUser.familyId).then((loadedFamily) => {
        if (loadedFamily) {
          setFamily(loadedFamily);
        }
      });
    }
  }, [appUser?.familyId, family, setFamily]);

  // Function to load data (can be called to refresh)
  const loadData = useCallback(async () => {
    if (!family) {
      setDataLoading(false);
      return;
    }

    try {
      // Fetch recipes
      const fetchedRecipes = await getRecipes(family.id);
      setRecipes(fetchedRecipes);

      // Fetch week plans
      const fetchedPlans = await getWeekPlans(family.id);
      setAllWeekPlans(fetchedPlans);
      const weekStart = formatDate(getSaturday(new Date()));
      // Use getWeekPlan which deduplicates if multiple docs exist for the same week
      const plan = await getWeekPlan(family.id, weekStart);
      if (plan) {
        setCurrentWeekPlan(plan);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setDataLoading(false);
    }
  }, [family]);

  // Load data when family changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute recipe cook counts from all week plans
  const recipeCookCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const plan of allWeekPlans) {
      for (const dayMeals of Object.values(plan.days)) {
        const meal = dayMeals as DayMeal;
        for (const key of ['main', 'vegetable', 'grain', 'other'] as const) {
          const value = meal[key];
          if (value && !value.startsWith('custom:')) {
            counts.set(value, (counts.get(value) || 0) + 1);
          }
        }
      }
    }
    return counts;
  }, [allWeekPlans]);

  // Compute the most recent week each recipe was cooked
  const recipeLastCookedDates = useMemo(() => {
    const dates = new Map<string, string>();
    for (const plan of allWeekPlans) {
      for (const dayMeals of Object.values(plan.days)) {
        const meal = dayMeals as DayMeal;
        for (const key of ['main', 'vegetable', 'grain', 'other'] as const) {
          const value = meal[key];
          if (value && !value.startsWith('custom:')) {
            const existing = dates.get(value);
            if (!existing || plan.weekStart > existing) {
              dates.set(value, plan.weekStart);
            }
          }
        }
      }
    }
    return dates;
  }, [allWeekPlans]);

  // Auto-migrate: assign cuisine types to existing recipes that don't have one
  const cuisineMigrationDone = useRef(false);
  useEffect(() => {
    if (cuisineMigrationDone.current || !family || recipes.length === 0) return;
    cuisineMigrationDone.current = true;

    const toUpdate = recipes
      .filter(r => !r.cuisineType)
      .map(r => ({ ...r, cuisineType: inferCuisineType(r) }));

    if (toUpdate.length === 0) return;

    Promise.all(toUpdate.map(r => updateRecipe(family.id, r)))
      .then(() => {
        setRecipes(prev => prev.map(r => toUpdate.find(u => u.id === r.id) ?? r));
      })
      .catch(err => console.error('Failed to auto-assign cuisine types:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id, recipes.length]);

  // Auto-migrate: infer protein types for existing main dish recipes that don't have one
  const proteinMigrationDone = useRef(false);
  useEffect(() => {
    if (proteinMigrationDone.current || !family || recipes.length === 0) return;
    proteinMigrationDone.current = true;

    const toUpdate = recipes
      .filter(r => r.category === 'main' && !r.proteinType)
      .flatMap(r => {
        const inferred = inferProteinType(r);
        return inferred ? [{ ...r, proteinType: inferred }] : [];
      });

    if (toUpdate.length === 0) return;

    Promise.all(toUpdate.map(r => updateRecipe(family.id, r)))
      .then(() => {
        setRecipes(prev => prev.map(r => toUpdate.find(u => u.id === r.id) ?? r));
      })
      .catch(err => console.error('Failed to auto-assign protein types:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id, recipes.length]);

  const handleAddRecipe = async (recipe: Recipe) => {
    if (!family) return;
    try {
      await addRecipe(family.id, recipe);
      // Refresh data after adding
      const fetchedRecipes = await getRecipes(family.id);
      setRecipes(fetchedRecipes);
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add recipe:', error);
      alert('Failed to save recipe. Check console for details.');
    }
  };

  const handleUpdateRecipe = async (recipe: Recipe) => {
    if (!family) return;
    try {
      await updateRecipe(family.id, recipe);
      // Refresh data after updating
      const fetchedRecipes = await getRecipes(family.id);
      setRecipes(fetchedRecipes);
    } catch (error) {
      console.error('Failed to update recipe:', error);
      alert('Failed to update recipe. Check console for details.');
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!family) return;
    try {
      await deleteRecipe(family.id, id);
      // Refresh data after deleting
      const fetchedRecipes = await getRecipes(family.id);
      setRecipes(fetchedRecipes);
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      alert('Failed to delete recipe. Check console for details.');
    }
  };

  const handleSaveWeekPlan = async (plan: WeekPlan) => {
    if (!family) return;
    try {
      await saveWeekPlan(family.id, plan);
      setCurrentWeekPlan(plan);
    } catch (error) {
      console.error('Failed to save week plan:', error);
      alert('Failed to save week plan. Check console for details.');
    }
  };

  const handleLoadWeekPlan = async (weekStart: string) => {
    if (!family) return undefined;
    return await getWeekPlan(family.id, weekStart);
  };

  const handleAddRecipeToWeek = async (recipeId: string, day: DayOfWeek, mealType: keyof DayMeal, weekStart: string) => {
    if (!family) return;
    const existingPlan = currentWeekPlan?.weekStart === weekStart
      ? currentWeekPlan
      : await getWeekPlan(family.id, weekStart);

    const emptyDays: WeekPlan['days'] = {
      sunday: {}, monday: {}, tuesday: {}, wednesday: {},
      thursday: {}, friday: {}, saturday: {},
    };

    const plan: WeekPlan = {
      id: existingPlan?.id || generateId(),
      weekStart,
      days: existingPlan?.days || emptyDays,
    };

    plan.days[day] = { ...plan.days[day], [mealType]: recipeId };

    try {
      await saveWeekPlan(family.id, plan);
      setCurrentWeekPlan(plan);
    } catch (error) {
      console.error('Failed to add recipe to week:', error);
      alert('Failed to add recipe to week plan.');
    }
  };

  const handleFamilySelected = (selectedFamily: Family) => {
    setFamily(selectedFamily);
  };

  const handleCommunityRecipeAdded = async () => {
    if (!family) return;
    const fetchedRecipes = await getRecipes(family.id);
    setRecipes(fetchedRecipes);
  };

  const handleImportRecipes = async (recipesToImport: Recipe[]) => {
    if (!family) return;

    // Import recipes one by one
    for (const recipe of recipesToImport) {
      await addRecipe(family.id, recipe);
    }

    // Refresh the recipes list
    const fetchedRecipes = await getRecipes(family.id);
    setRecipes(fetchedRecipes);
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!appUser) {
    return <Login />;
  }

  // Show family manager if no family
  if (!family) {
    return <FamilyManager onFamilySelected={handleFamilySelected} />;
  }

  // Show loading while data loads
  if (dataLoading) {
    return (
      <div className="app">
        <div className="loading">Loading your family's data...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <div className="user-info">
            {appUser.photoURL && (
              <img
                src={appUser.photoURL}
                alt=""
                className="user-avatar"
              />
            )}
            <span className="user-name">{appUser.displayName}</span>
          </div>
          <button onClick={logOut} className="btn-secondary btn-sm">
            Sign Out
          </button>
        </div>
        <h1>Meal Planner</h1>
        <p className="subtitle">{family.name}</p>
        <button
          onClick={() => setShowInviteModal(true)}
          className="btn-link invite-toggle"
        >
          Invite Family Members
        </button>
      </header>

      {showInviteModal && (
        <InviteModal
          inviteCode={family.inviteCode}
          familyName={family.name}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === 'planner' ? 'active' : ''}`}
          onClick={() => setActiveTab('planner')}
        >
          Week Planner
        </button>
        <button
          className={`nav-btn ${activeTab === 'recipes' ? 'active' : ''}`}
          onClick={() => setActiveTab('recipes')}
        >
          Recipes
        </button>
        <button
          className={`nav-btn ${activeTab === 'shopping' ? 'active' : ''}`}
          onClick={() => setActiveTab('shopping')}
        >
          Shopping List
        </button>
        <button
          className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
        <button
          className={`nav-btn ${activeTab === 'community' ? 'active' : ''}`}
          onClick={() => setActiveTab('community')}
        >
          Community
        </button>
      </nav>

      <main className="app-content">
        {activeTab === 'recipes' && (
          <div className="recipes-tab">
            <div className="tab-header">
              <h2>Your Recipes</h2>
              <div className="tab-header-actions">
                <button
                  onClick={() => setShowPaprikaImport(true)}
                  className="btn-secondary"
                >
                  Import from Paprika
                </button>
                <button
                  onClick={() => setShowXLSImport(true)}
                  className="btn-secondary"
                >
                  Import from XLS
                </button>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="btn-primary"
                >
                  {showAddForm ? 'Cancel' : '+ Add Recipe'}
                </button>
              </div>
            </div>

            {showPaprikaImport && (
              <PaprikaImport
                onImport={handleImportRecipes}
                onClose={() => setShowPaprikaImport(false)}
              />
            )}

            {showXLSImport && (
              <XLSRecipeImport
                existingRecipes={recipes}
                onImport={handleImportRecipes}
                onClose={() => setShowXLSImport(false)}
              />
            )}

            {showAddForm && (
              <RecipeForm
                onSave={handleAddRecipe}
                onCancel={() => setShowAddForm(false)}
              />
            )}

            <RecipeList
              recipes={recipes}
              onUpdate={handleUpdateRecipe}
              onDelete={handleDeleteRecipe}
              cookCounts={recipeCookCounts}
              onAddToWeek={handleAddRecipeToWeek}
            />
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="planner-tab">
            <h2>Weekly Meal Planner</h2>
            <WeekPlanner
              recipes={recipes}
              weekPlan={currentWeekPlan}
              onSave={handleSaveWeekPlan}
              onLoadWeekPlan={handleLoadWeekPlan}
              cookCounts={recipeCookCounts}
              lastCookedDates={recipeLastCookedDates}
            />
          </div>
        )}

        {activeTab === 'shopping' && (
          <div className="shopping-tab">
            <ShoppingList recipes={recipes} weekPlan={currentWeekPlan} onLoadWeekPlan={handleLoadWeekPlan} />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="analytics-tab">
            <h2>Cooking Analytics</h2>
            <CookingAnalytics
              recipes={recipes}
              familyId={family.id}
            />
          </div>
        )}

        {activeTab === 'community' && (
          <div className="community-tab">
            <h2>Community Recipes</h2>
            <CommunityRecipes
              familyId={family.id}
              onRecipeAdded={handleCommunityRecipeAdded}
            />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Data syncs across all your devices</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MealPlannerApp />
    </AuthProvider>
  );
}

export default App;
