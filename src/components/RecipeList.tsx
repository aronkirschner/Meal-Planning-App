import { useState, useMemo, useRef, useEffect } from 'react';
import type { Recipe, RecipeCategory, CuisineType, DayOfWeek, DayMeal } from '../types';
import { DAYS_OF_WEEK, CUISINE_TYPES } from '../types';
import { RecipeForm } from './RecipeForm';
import { extractRecipeFromUrl } from '../api';

type SortOption = 'az' | 'rating' | 'cooked';

interface RecipeListProps {
  recipes: Recipe[];
  onUpdate: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  cookCounts?: Map<string, number>;
  onAddToWeek?: (recipeId: string, day: DayOfWeek, mealType: keyof DayMeal, weekStart: string) => void;
}

function StarRating({ rating, onRate }: { rating: number | undefined; onRate: (rating: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? (rating || 0);

  return (
    <div className="star-rating" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          className={`star-btn ${star <= display ? 'star-filled' : 'star-empty'}`}
          onMouseEnter={() => setHovered(star)}
          onClick={(e) => {
            e.stopPropagation();
            // Click same rating to clear it
            onRate(rating === star ? 0 : star);
          }}
          title={rating === star ? 'Clear rating' : `Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          {star <= display ? '\u2605' : '\u2606'}
        </button>
      ))}
    </div>
  );
}

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  main: 'Main Dishes',
  vegetable: 'Vegetables',
  grain: 'Grains',
  other: 'Other',
};

const DAY_LABELS: Record<DayOfWeek, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

const SLOT_LABELS: Record<keyof DayMeal, string> = {
  main: 'Main',
  vegetable: 'Vegetable',
  grain: 'Grain',
  other: 'Other',
};

function getSunday(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function AddToWeekPicker({ recipe, onAdd, onClose }: {
  recipe: Recipe;
  onAdd: (day: DayOfWeek, mealType: keyof DayMeal, weekStart: string) => void;
  onClose: () => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = next week
  const [day, setDay] = useState<DayOfWeek>(DAYS_OF_WEEK[0]);
  const [slot, setSlot] = useState<keyof DayMeal>(recipe.category);
  const ref = useRef<HTMLDivElement>(null);

  const thisSunday = getSunday(new Date());
  const selectedSunday = useMemo(() => {
    const d = new Date(thisSunday);
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [thisSunday.getTime(), weekOffset]);

  const weekStart = formatDateISO(selectedSunday);

  const dayDates = useMemo(() => {
    return DAYS_OF_WEEK.map((d, i) => {
      const date = new Date(selectedSunday);
      date.setDate(date.getDate() + i);
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { key: d, label: `${DAY_LABELS[d]} ${label}` };
    });
  }, [selectedSunday.getTime()]);

  const weekEnd = new Date(selectedSunday);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${selectedSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div className="add-to-week-picker" ref={ref}>
      <div className="add-to-week-header">
        <div className="add-to-week-tabs">
          <button
            className={`add-to-week-tab ${weekOffset === 0 ? 'active' : ''}`}
            onClick={() => setWeekOffset(0)}
          >
            This Week
          </button>
          <button
            className={`add-to-week-tab ${weekOffset === 1 ? 'active' : ''}`}
            onClick={() => setWeekOffset(1)}
          >
            Next Week
          </button>
        </div>
        <span className="add-to-week-dates">{weekLabel}</span>
      </div>
      <div className="add-to-week-row">
        <select value={day} onChange={(e) => setDay(e.target.value as DayOfWeek)}>
          {dayDates.map((d) => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>
        <select value={slot} onChange={(e) => setSlot(e.target.value as keyof DayMeal)}>
          {(['main', 'vegetable', 'grain', 'other'] as const).map((s) => (
            <option key={s} value={s}>{SLOT_LABELS[s]}</option>
          ))}
        </select>
        <button
          className="btn-primary btn-sm"
          onClick={() => {
            onAdd(day, slot, weekStart);
            onClose();
          }}
        >
          Add
        </button>
        <button className="btn-secondary btn-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function RecipeList({ recipes, onUpdate, onDelete, cookCounts, onAddToWeek }: RecipeListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addToWeekId, setAddToWeekId] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<RecipeCategory | 'all'>(
    'all'
  );
  const [filterCuisine, setFilterCuisine] = useState<CuisineType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('az');

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesCategory =
      filterCategory === 'all' || recipe.category === filterCategory;
    const matchesCuisine =
      filterCuisine === 'all' || recipe.cuisineType === filterCuisine;
    const matchesSearch = recipe.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesCategory && matchesCuisine && matchesSearch;
  });

  const sortedRecipes = useMemo(() => {
    const sorted = [...filteredRecipes];
    switch (sortBy) {
      case 'az':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'rating':
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name));
        break;
      case 'cooked':
        sorted.sort((a, b) => (cookCounts?.get(b.id) || 0) - (cookCounts?.get(a.id) || 0) || a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [filteredRecipes, sortBy, cookCounts]);

  const groupedRecipes = sortedRecipes.reduce(
    (acc, recipe) => {
      if (!acc[recipe.category]) {
        acc[recipe.category] = [];
      }
      acc[recipe.category].push(recipe);
      return acc;
    },
    {} as Record<RecipeCategory, Recipe[]>
  );

  const handleUpdate = (recipe: Recipe) => {
    onUpdate(recipe);
    setEditingId(null);
  };

  const recipesToBackfill = recipes.filter((r) => r.url && !r.cookTime);

  const handleBackfill = async () => {
    if (recipesToBackfill.length === 0) return;
    setBackfilling(true);
    setBackfillStatus(`Fetching cook times for ${recipesToBackfill.length} recipe${recipesToBackfill.length > 1 ? 's' : ''}…`);
    let updated = 0;
    let failed = 0;
    for (const recipe of recipesToBackfill) {
      try {
        const data = await extractRecipeFromUrl(recipe.url);
        if (data.readyInMinutes && data.readyInMinutes > 0) {
          onUpdate({ ...recipe, cookTime: data.readyInMinutes });
          updated++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      setBackfillStatus(
        `Processing… ${updated + failed} / ${recipesToBackfill.length} done`
      );
    }
    setBackfilling(false);
    const parts = [];
    if (updated > 0) parts.push(`${updated} updated`);
    if (failed > 0) parts.push(`${failed} couldn't be fetched`);
    setBackfillStatus(parts.join(', '));
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="recipe-list">
      <div className="recipe-filters">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search recipes..."
          className="search-input"
        />
        <select
          value={filterCategory}
          onChange={(e) =>
            setFilterCategory(e.target.value as RecipeCategory | 'all')
          }
        >
          <option value="all">All Categories</option>
          <option value="main">Main Dishes</option>
          <option value="vegetable">Vegetables</option>
          <option value="grain">Grains</option>
          <option value="other">Other</option>
        </select>
        <select
          value={filterCuisine}
          onChange={(e) => setFilterCuisine(e.target.value as CuisineType | 'all')}
        >
          <option value="all">All Cuisines</option>
          {CUISINE_TYPES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="sort-select"
        >
          <option value="az">Sort: A-Z</option>
          <option value="rating">Sort: Rating</option>
          <option value="cooked">Sort: Times Cooked</option>
        </select>
      </div>

      {recipesToBackfill.length > 0 && (
        <div className="backfill-banner">
          <span>
            {recipesToBackfill.length} recipe{recipesToBackfill.length > 1 ? 's' : ''} with a URL {recipesToBackfill.length > 1 ? 'have' : 'has'} no cook time set.
          </span>
          <button
            className="btn-secondary btn-sm"
            onClick={handleBackfill}
            disabled={backfilling}
          >
            {backfilling ? 'Fetching…' : 'Backfill cook times'}
          </button>
          {backfillStatus && <span className="backfill-status">{backfillStatus}</span>}
        </div>
      )}

      {filteredRecipes.length === 0 ? (
        <p className="no-recipes">
          No recipes found. Add some recipes to get started!
        </p>
      ) : (
        (['main', 'vegetable', 'grain', 'other'] as RecipeCategory[]).map((category) =>
          groupedRecipes[category]?.length > 0 ? (
            <div key={category} className="recipe-category-group">
              <h3>{CATEGORY_LABELS[category]}</h3>
              <div className="recipe-grid">
                {groupedRecipes[category].map((recipe) =>
                  editingId === recipe.id ? (
                    <div key={recipe.id} className="recipe-card editing">
                      <RecipeForm
                        editRecipe={recipe}
                        onSave={handleUpdate}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <div key={recipe.id} className={`recipe-card ${expandedId === recipe.id ? 'expanded' : ''}`}>
                      <h4>{recipe.name}</h4>
                      {recipe.cuisineType && (
                        <span className="cuisine-badge">{recipe.cuisineType}</span>
                      )}
                      <div className="recipe-meta">
                        <StarRating
                          rating={recipe.rating}
                          onRate={(r) => onUpdate({ ...recipe, rating: r || undefined })}
                        />
                        <span className="cook-count" title="Times cooked">
                          {cookCounts?.get(recipe.id) || 0}x cooked
                        </span>
                      </div>
                      <a
                        href={recipe.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="recipe-link"
                      >
                        View Original Recipe
                      </a>

                      {expandedId === recipe.id ? (
                        <>
                          {recipe.ingredients.length > 0 && (
                            <div className="recipe-section">
                              <strong>Ingredients:</strong>
                              <ul className="recipe-ingredients-full">
                                {recipe.ingredients.map((ing, i) => (
                                  <li key={i}>
                                    {ing.amount} {ing.unit} {ing.name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {recipe.directions && recipe.directions.length > 0 && (
                            <div className="recipe-section">
                              <strong>Directions:</strong>
                              <ol className="recipe-directions-full">
                                {recipe.directions.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {recipe.notes && (
                            <div className="recipe-section">
                              <strong>Notes:</strong>
                              <p className="recipe-notes">{recipe.notes}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {recipe.ingredients.length > 0 && (
                            <div className="recipe-ingredients-preview">
                              <strong>Ingredients:</strong>
                              <ul>
                                {recipe.ingredients.slice(0, 3).map((ing, i) => (
                                  <li key={i}>
                                    {ing.amount} {ing.unit} {ing.name}
                                  </li>
                                ))}
                                {recipe.ingredients.length > 3 && (
                                  <li className="more-items">...and {recipe.ingredients.length - 3} more</li>
                                )}
                              </ul>
                            </div>
                          )}

                          {recipe.directions && recipe.directions.length > 0 && (
                            <div className="recipe-directions-preview">
                              <strong>Directions:</strong> {recipe.directions.length} steps
                            </div>
                          )}
                        </>
                      )}

                      {addToWeekId === recipe.id && onAddToWeek && (
                        <AddToWeekPicker
                          recipe={recipe}
                          onAdd={(day, mealType, weekStart) => onAddToWeek(recipe.id, day, mealType, weekStart)}
                          onClose={() => setAddToWeekId(null)}
                        />
                      )}

                      <div className="recipe-actions">
                        {onAddToWeek && (
                          <button
                            onClick={() => setAddToWeekId(addToWeekId === recipe.id ? null : recipe.id)}
                            className="btn-primary btn-sm"
                          >
                            + Add to Week
                          </button>
                        )}
                        <button
                          onClick={() => toggleExpanded(recipe.id)}
                          className="btn-secondary btn-sm"
                        >
                          {expandedId === recipe.id ? 'Collapse' : 'Expand'}
                        </button>
                        <button
                          onClick={() => setEditingId(recipe.id)}
                          className="btn-secondary btn-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                'Are you sure you want to delete this recipe?'
                              )
                            ) {
                              onDelete(recipe.id);
                            }
                          }}
                          className="btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null
        )
      )}
    </div>
  );
}
