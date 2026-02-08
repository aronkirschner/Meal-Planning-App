import { useState, useEffect, useCallback } from 'react';
import type { Recipe, WeekPlan, Family } from './types';
import {
  addRecipe,
  updateRecipe,
  deleteRecipe,
  saveWeekPlan,
  getRecipes,
  getWeekPlans,
  getWeekPlan,
  getFamily,
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
import './App.css';

type Tab = 'recipes' | 'planner' | 'shopping' | 'community';

function getSunday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPaprikaImport, setShowPaprikaImport] = useState(false);

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
      const weekStart = formatDate(getSunday(new Date()));
      const plan = fetchedPlans.find((p) => p.weekStart === weekStart);
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
          className={`nav-btn ${activeTab === 'community' ? 'active' : ''}`}
          onClick={() => setActiveTab('community')}
        >
          Community Recipes
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
              onLoadWeekPlan={handleLoadWeekPlan}
            />
          </div>
        )}

        {activeTab === 'shopping' && (
          <div className="shopping-tab">
            <ShoppingList recipes={recipes} weekPlan={currentWeekPlan} />
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
