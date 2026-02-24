import { useState } from 'react';
import type { Recipe, DayMeal, DayOfWeek } from '../types';

interface AIPlannerInputProps {
  recipes: Recipe[];
  cookCounts?: Map<string, number>;
  lastCookedDates?: Map<string, string>;
  onPlanGenerated: (plan: Record<DayOfWeek, DayMeal>) => void;
}

interface GeneratedPlan {
  monday: DayMeal;
  tuesday: DayMeal;
  wednesday: DayMeal;
  thursday: DayMeal;
  friday: DayMeal;
  saturday: DayMeal;
  sunday: DayMeal;
}

export function AIPlannerInput({ recipes, cookCounts, lastCookedDates, onPlanGenerated }: AIPlannerInputProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description of your meal plan');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log('Sending request to /api/generate-plan...');
      const response = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          recipes: recipes.map(r => ({
            id: r.id,
            name: r.name,
            category: r.category,
            cuisineType: r.cuisineType,
            cookCount: cookCounts?.get(r.id) ?? 0,
            lastCookedDate: lastCookedDates?.get(r.id),
          })),
        }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error:', errorData);
        throw new Error(errorData.error || 'Failed to generate plan');
      }

      const data = await response.json();
      console.log('Generated plan:', data.plan);
      const plan = data.plan as GeneratedPlan;

      // Build a lookup map from recipe name (lowercase) to ID
      const nameToId: Record<string, string> = {};
      recipes.forEach(r => {
        nameToId[r.name.toLowerCase()] = r.id;
      });

      // Normalize a string for fuzzy matching: lowercase, strip non-alphanumeric, collapse whitespace
      const normalize = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

      // Build a normalized lookup map
      const normalizedNameToId: Record<string, string> = {};
      recipes.forEach(r => {
        normalizedNameToId[normalize(r.name)] = r.id;
      });

      // Convert recipe names to IDs in the plan
      const convertMeal = (meal: DayMeal): DayMeal => {
        const converted: DayMeal = {};
        for (const key of ['main', 'vegetable', 'grain', 'other'] as const) {
          const value = meal[key];
          if (value) {
            // Check if it's already an ID (exists in recipes)
            const existingRecipe = recipes.find(r => r.id === value);
            if (existingRecipe) {
              converted[key] = value;
            } else {
              // Try to find by name (case-insensitive exact match)
              const id = nameToId[value.toLowerCase()];
              if (id) {
                converted[key] = id;
              } else {
                // Try normalized match (handles accents, punctuation differences)
                const normalizedId = normalizedNameToId[normalize(value)];
                if (normalizedId) {
                  converted[key] = normalizedId;
                } else {
                  // Fallback: use as custom entry so AI suggestion is still visible
                  converted[key] = 'custom:' + value;
                }
              }
            }
          }
        }
        return converted;
      };

      const convertedPlan: GeneratedPlan = {
        monday: convertMeal(plan.monday),
        tuesday: convertMeal(plan.tuesday),
        wednesday: convertMeal(plan.wednesday),
        thursday: convertMeal(plan.thursday),
        friday: convertMeal(plan.friday),
        saturday: convertMeal(plan.saturday),
        sunday: convertMeal(plan.sunday),
      };

      console.log('Converted plan:', convertedPlan);
      onPlanGenerated(convertedPlan);
      setPrompt('');
      setSuccess(true);

      // Auto-close after showing success
      setTimeout(() => {
        setIsExpanded(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('Error generating plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate meal plan');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="btn-ai-planner"
      >
        <span className="ai-icon">✨</span>
        AI Plan My Week
      </button>
    );
  }

  return (
    <div className="ai-planner-input">
      <div className="ai-planner-header">
        <h4>
          <span className="ai-icon">✨</span>
          AI Meal Planner
        </h4>
        <button
          onClick={() => setIsExpanded(false)}
          className="btn-close-ai"
        >
          &times;
        </button>
      </div>

      <p className="ai-planner-hint">
        Describe your meal plan in natural language. Examples:
      </p>
      <ul className="ai-examples">
        <li>"Salmon on Monday, tacos Tuesday, leftovers Wednesday"</li>
        <li>"Light meals during the week, something special for Saturday"</li>
        <li>"Kid-friendly meals, no seafood"</li>
      </ul>

      {error && <div className="ai-error">{error}</div>}
      {success && <div className="ai-success">Plan generated! Check the week below.</div>}

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your ideal meal plan for the week..."
        rows={3}
        disabled={isLoading}
        className="ai-prompt-input"
      />

      <div className="ai-planner-actions">
        <button
          onClick={() => setIsExpanded(false)}
          className="btn-secondary"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          onClick={handleGenerate}
          className="btn-primary"
          disabled={isLoading || !prompt.trim()}
        >
          {isLoading ? 'Generating...' : 'Generate Plan'}
        </button>
      </div>

      {recipes.length === 0 && (
        <p className="ai-warning">
          Tip: Add some recipes first for better suggestions!
        </p>
      )}
    </div>
  );
}
