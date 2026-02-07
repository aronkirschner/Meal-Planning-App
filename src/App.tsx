import { useState, useEffect } from 'react';
import type { Recipe, WeekPlan } from './types';
import {
  addRecipe,
  updateRecipe,
  deleteRecipe,
  saveWeekPlan,
  subscribeToRecipes,
  subscribeToWeekPlans,
} from './firestore-storage';
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

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('planner');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentWeekPlan, setCurrentWeekPlan] = useState<WeekPlan | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubRecipes = subscribeToRecipes((updatedRecipes) => {
      setRecipes(updatedRecipes);
      setLoading(false);
    });

    const unsubPlans = subscribeToWeekPlans((updatedPlans) => {
      // Find the current week's plan
      const weekStart = formatDate(getMonday(new Date()));
      const plan = updatedPlans.find((p) => p.weekStart === weekStart);
      if (plan) {
        setCurrentWeekPlan(plan);
      }
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubRecipes();
      unsubPlans();
    };
  }, []);

  const handleAddRecipe = async (recipe: Recipe) => {
    await addRecipe(recipe);
    setShowAddForm(false);
  };

  const handleUpdateRecipe = async (recipe: Recipe) => {
    await updateRecipe(recipe);
  };

  const handleDeleteRecipe = async (id: string) => {
    await deleteRecipe(id);
  };

  const handleSaveWeekPlan = async (plan: WeekPlan) => {
    await saveWeekPlan(plan);
    setCurrentWeekPlan(plan);
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Meal Planner</h1>
        <p className="subtitle">Plan your weekly meals together</p>
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

export default App;
