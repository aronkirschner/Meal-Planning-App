import { useState, useEffect } from 'react';
import type { Recipe, WeekPlan, Family } from './types';
import {
  addRecipe,
  updateRecipe,
  deleteRecipe,
  saveWeekPlan,
  subscribeToRecipes,
  subscribeToWeekPlans,
  getFamily,
  subscribeToFamily,
} from './firestore-storage';
import { AuthProvider, useAuth } from './AuthContext';
import { Login } from './components/Login';
import { FamilyManager } from './components/FamilyManager';
import { RecipeForm } from './components/RecipeForm';
import { RecipeList } from './components/RecipeList';
import { WeekPlanner } from './components/WeekPlanner';
import { ShoppingList } from './components/ShoppingList';
import './App.css';

type Tab = 'recipes' | 'planner' | 'shopping';

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function MealPlannerApp() {
  const { appUser, family, setFamily, logOut, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('planner');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentWeekPlan, setCurrentWeekPlan] = useState<WeekPlan | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [showInviteCode, setShowInviteCode] = useState(false);

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

  // Subscribe to family updates and data once family is set
  useEffect(() => {
    if (!family) {
      setDataLoading(false);
      return;
    }

    let unsubRecipes: (() => void) | undefined;
    let unsubPlans: (() => void) | undefined;
    let unsubFamily: (() => void) | undefined;

    // Subscribe to family updates
    unsubFamily = subscribeToFamily(family.id, (updatedFamily) => {
      if (updatedFamily) {
        setFamily(updatedFamily);
      }
    });

    // Subscribe to recipes
    unsubRecipes = subscribeToRecipes(family.id, (updatedRecipes) => {
      setRecipes(updatedRecipes);
      setDataLoading(false);
    });

    // Subscribe to week plans
    unsubPlans = subscribeToWeekPlans(family.id, (updatedPlans) => {
      const weekStart = formatDate(getMonday(new Date()));
      const plan = updatedPlans.find((p) => p.weekStart === weekStart);
      if (plan) {
        setCurrentWeekPlan(plan);
      }
    });

    return () => {
      if (unsubRecipes) unsubRecipes();
      if (unsubPlans) unsubPlans();
      if (unsubFamily) unsubFamily();
    };
  }, [family, setFamily]);

  const handleAddRecipe = async (recipe: Recipe) => {
    if (!family) return;
    try {
      await addRecipe(family.id, recipe);
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
    } catch (error) {
      console.error('Failed to update recipe:', error);
      alert('Failed to update recipe. Check console for details.');
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!family) return;
    try {
      await deleteRecipe(family.id, id);
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

  const handleFamilySelected = (selectedFamily: Family) => {
    setFamily(selectedFamily);
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
          onClick={() => setShowInviteCode(!showInviteCode)}
          className="btn-link invite-toggle"
        >
          {showInviteCode ? 'Hide Invite Code' : 'Invite Family Members'}
        </button>
        {showInviteCode && (
          <div className="invite-code-display">
            <p>Share this code with family members:</p>
            <code className="invite-code">{family.inviteCode}</code>
          </div>
        )}
      </header>

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
      </nav>

      <main className="app-content">
        {activeTab === 'recipes' && (
          <div className="recipes-tab">
            <div className="tab-header">
              <h2>Your Recipes</h2>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="btn-primary"
              >
                {showAddForm ? 'Cancel' : '+ Add Recipe'}
              </button>
            </div>

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
            />
          </div>
        )}

        {activeTab === 'shopping' && (
          <div className="shopping-tab">
            <ShoppingList recipes={recipes} weekPlan={currentWeekPlan} />
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
