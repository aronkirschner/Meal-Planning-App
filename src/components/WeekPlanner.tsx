import { useState, useMemo, useEffect, useRef } from 'react';
import type { Recipe, WeekPlan, DayMeal, DayOfWeek } from '../types';
import { DAYS_OF_WEEK } from '../types';
import { generateId } from '../firestore-storage';
import { AIPlannerInput } from './AIPlannerInput';

interface WeekPlannerProps {
  recipes: Recipe[];
  weekPlan: WeekPlan | null;
  onSave: (plan: WeekPlan) => void;
  onLoadWeekPlan?: (weekStart: string) => Promise<WeekPlan | undefined>;
  cookCounts?: Map<string, number>;
  lastCookedDates?: Map<string, string>;
  onViewRecipe?: (recipeId: string) => void;
}

function getSaturday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day + 1) % 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

const CUSTOM_PREFIX = 'custom:';

function parseCustomValue(value: string): { name: string; url: string } {
  const raw = value.slice(CUSTOM_PREFIX.length);
  try {
    const parsed = JSON.parse(raw);
    return { name: parsed.name ?? '', url: parsed.url ?? '' };
  } catch {
    return { name: raw, url: '' };
  }
}

function buildCustomValue(name: string, url: string): string {
  return CUSTOM_PREFIX + JSON.stringify({ name, url });
}

interface MealSelectorProps {
  label: string;
  value: string;
  recipes: Recipe[];
  onChange: (value: string) => void;
}

function MealSelector({ label, value, recipes, onChange }: MealSelectorProps) {
  const isCustom = value.startsWith(CUSTOM_PREFIX);
  const { name: customName, url: customUrl } = isCustom ? parseCustomValue(value) : { name: '', url: '' };
  const [showCustomInput, setShowCustomInput] = useState(isCustom);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync showCustomInput when value prop changes externally (e.g., AI plan generation)
  useEffect(() => {
    setShowCustomInput(value.startsWith(CUSTOM_PREFIX));
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleCustomTextChange = (text: string) => {
    onChange(buildCustomValue(text, customUrl));
  };

  const handleCustomUrlChange = (url: string) => {
    onChange(buildCustomValue(customName, url));
  };

  const handleSelect = (newValue: string) => {
    if (newValue === '__custom__') {
      setShowCustomInput(true);
      onChange(buildCustomValue('', ''));
    } else {
      setShowCustomInput(false);
      onChange(newValue);
    }
    setIsOpen(false);
    setSearch('');
  };

  const selectedName = useMemo(() => {
    if (!value || isCustom) return null;
    const recipe = recipes.find((r) => r.id === value);
    return recipe?.name || null;
  }, [value, recipes, isCustom]);

  const filteredRecipes = useMemo(() => {
    if (!search) return recipes;
    const lower = search.toLowerCase();
    return recipes.filter((r) => r.name.toLowerCase().includes(lower));
  }, [recipes, search]);

  return (
    <div className="meal-selector" ref={containerRef}>
      <label>{label}</label>
      {showCustomInput ? (
        <div className="custom-input-group">
          <input
            type="text"
            value={customName}
            onChange={(e) => handleCustomTextChange(e.target.value)}
            placeholder="Enter custom item..."
            className="custom-meal-input"
          />
          <div className="custom-meal-url-row">
            <input
              type="url"
              value={customUrl}
              onChange={(e) => handleCustomUrlChange(e.target.value)}
              placeholder="URL (optional)"
              className="custom-meal-url-input"
            />
            {customUrl && (
              <a
                href={customUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="custom-meal-url-open"
                title="Open URL"
              >
                ↗
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCustomInput(false);
              onChange('');
            }}
            className="btn-switch-to-dropdown"
          >
            ↩ Use recipe instead
          </button>
        </div>
      ) : (
        <div className="searchable-select">
          <button
            type="button"
            className="searchable-select-trigger"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className={selectedName ? 'select-value' : 'select-placeholder'}>
              {selectedName || '-- Select --'}
            </span>
            <span className="select-arrow">{isOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
          {isOpen && (
            <div className="searchable-select-dropdown">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="searchable-select-search"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                    setSearch('');
                  }
                }}
              />
              <div className="searchable-select-options">
                <button
                  type="button"
                  className="searchable-select-option option-clear"
                  onClick={() => handleSelect('')}
                >
                  -- Clear --
                </button>
                <button
                  type="button"
                  className="searchable-select-option option-custom"
                  onClick={() => handleSelect('__custom__')}
                >
                  Custom...
                </button>
                {filteredRecipes.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    className={`searchable-select-option${r.id === value ? ' option-selected' : ''}`}
                    onClick={() => handleSelect(r.id)}
                  >
                    {r.name}
                    {r.cookTime && r.cookTime > 45 && (
                      <span className="cook-time-badge" title={`${r.cookTime} min cook time`}>
                        ⏱ {r.cookTime}m
                      </span>
                    )}
                  </button>
                ))}
                {filteredRecipes.length === 0 && search && (
                  <div className="searchable-select-empty">No recipes found</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WeekPlanner({ recipes, weekPlan, onSave, onLoadWeekPlan, cookCounts, lastCookedDates, onViewRecipe }: WeekPlannerProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    if (weekPlan) {
      return parseLocalDate(weekPlan.weekStart);
    }
    return getSaturday(new Date());
  });

  const emptyDays: WeekPlan['days'] = {
    monday: {},
    tuesday: {},
    wednesday: {},
    thursday: {},
    friday: {},
    saturday: {},
    sunday: {},
  };

  const [days, setDays] = useState<WeekPlan['days']>(
    weekPlan?.days || emptyDays
  );
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(
    weekPlan?.id || null
  );
  const [isDirty, setIsDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync days when weekPlan prop loads asynchronously
  useEffect(() => {
    if (weekPlan?.days) {
      setDays(weekPlan.days);
      setCurrentPlanId(weekPlan.id);
      setCurrentWeekStart(parseLocalDate(weekPlan.weekStart));
      setIsDirty(false);
    }
  }, [weekPlan]);

  const mainRecipes = useMemo(
    () => recipes.filter((r) => r.category === 'main'),
    [recipes]
  );
  const vegetableRecipes = useMemo(
    () => recipes.filter((r) => r.category === 'vegetable'),
    [recipes]
  );
  const grainRecipes = useMemo(
    () => recipes.filter((r) => r.category === 'grain'),
    [recipes]
  );


  const handleMealChange = (
    day: DayOfWeek,
    mealType: keyof DayMeal,
    value: string
  ) => {
    setDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [mealType]: value,
      },
    }));
    setIsDirty(true);
    setSavedFlash(false);
  };

  const handleSave = () => {
    const plan: WeekPlan = {
      id: currentPlanId || generateId(),
      weekStart: formatDate(currentWeekStart),
      days,
    };
    setCurrentPlanId(plan.id);
    onSave(plan);
    setIsDirty(false);
    setSavedFlash(true);
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 2500);
  };

  const navigateToWeek = async (newWeekStart: Date) => {
    setCurrentWeekStart(newWeekStart);
    setIsDirty(false);
    setSavedFlash(false);
    if (onLoadWeekPlan) {
      const plan = await onLoadWeekPlan(formatDate(newWeekStart));
      setDays(plan?.days || emptyDays);
      setCurrentPlanId(plan?.id || null);
    } else {
      setDays(emptyDays);
      setCurrentPlanId(null);
    }
  };

  const handlePreviousWeek = () => {
    navigateToWeek(addDays(currentWeekStart, -7));
  };

  const handleNextWeek = () => {
    navigateToWeek(addDays(currentWeekStart, 7));
  };

  const handleCurrentWeek = () => {
    navigateToWeek(getSaturday(new Date()));
  };

  const handleAIPlanGenerated = (plan: Record<DayOfWeek, DayMeal>) => {
    setDays(plan);
    setIsDirty(true);
    setSavedFlash(false);
  };

  const weekEnd = addDays(currentWeekStart, 6);

  return (
    <div className="week-planner">
      <div className="week-navigation">
        <button onClick={handlePreviousWeek} className="btn-secondary">
          Previous Week
        </button>
        <div className="week-display">
          <h3>
            {formatDisplayDate(currentWeekStart)} -{' '}
            {formatDisplayDate(weekEnd)}
          </h3>
          <button onClick={handleCurrentWeek} className="btn-link">
            Go to Current Week
          </button>
        </div>
        <button onClick={handleNextWeek} className="btn-secondary">
          Next Week
        </button>
      </div>

      <div className="ai-planner-section">
        <AIPlannerInput
          recipes={recipes}
          cookCounts={cookCounts}
          lastCookedDates={lastCookedDates}
          onPlanGenerated={handleAIPlanGenerated}
        />
      </div>

      <div className="week-grid">
        {DAYS_OF_WEEK.map((day, index) => {
          const dayDate = addDays(currentWeekStart, index);
          return (
            <div key={day} className="day-column">
              <div className="day-header">
                <strong>{DAY_LABELS[day]}</strong>
                <span className="day-date">{formatDisplayDate(dayDate)}</span>
              </div>

              <MealSelector
                label="Main Dish"
                value={days[day].main || ''}
                recipes={mainRecipes}
                onChange={(value) => handleMealChange(day, 'main', value)}
              />

              <MealSelector
                label="Vegetable"
                value={days[day].vegetable || ''}
                recipes={vegetableRecipes}
                onChange={(value) => handleMealChange(day, 'vegetable', value)}
              />

              <MealSelector
                label="Grain"
                value={days[day].grain || ''}
                recipes={grainRecipes}
                onChange={(value) => handleMealChange(day, 'grain', value)}
              />

              <MealSelector
                label="Other"
                value={days[day].other || ''}
                recipes={recipes}
                onChange={(value) => handleMealChange(day, 'other', value)}
              />
            </div>
          );
        })}
      </div>

      <div className="planner-actions">
        <button
          onClick={() => {
            if (window.confirm('Clear all meals for this week?')) {
              setDays({ ...emptyDays });
            }
          }}
          className="btn-secondary"
        >
          Clear Week
        </button>
        <div className="planner-save-group">
          {isDirty && (
            <span className="unsaved-badge">● Unsaved changes</span>
          )}
          {savedFlash && !isDirty && (
            <span className="saved-badge">✓ Saved!</span>
          )}
          <button onClick={handleSave} className={`btn-primary${isDirty ? ' btn-dirty' : ''}`}>
            Save Week Plan
          </button>
        </div>
      </div>

      <div className="week-glance">
        <h3 className="week-glance-title">Week at a Glance</h3>
        <div className="week-glance-grid">
          {DAYS_OF_WEEK.map((day, index) => {
            const dayDate = addDays(currentWeekStart, index);
            const dayPlan = days[day];
            const meals: { label: string; value: string }[] = [
              { label: 'Main', value: dayPlan.main || '' },
              { label: 'Veg', value: dayPlan.vegetable || '' },
              { label: 'Grain', value: dayPlan.grain || '' },
              { label: 'Other', value: dayPlan.other || '' },
            ].filter((m) => m.value);

            return (
              <div key={day} className="week-glance-day">
                <div className="week-glance-day-header">
                  <span className="week-glance-day-name">{DAY_LABELS[day].slice(0, 3)}</span>
                  <span className="week-glance-day-date">{formatDisplayDate(dayDate)}</span>
                </div>
                {meals.length === 0 ? (
                  <span className="week-glance-empty">—</span>
                ) : (
                  <ul className="week-glance-meals">
                    {meals.map((m) => {
                      const isCustom = m.value.startsWith(CUSTOM_PREFIX);
                      const { name: customName, url: customUrl } = isCustom ? parseCustomValue(m.value) : { name: '', url: '' };
                      const recipe = !isCustom ? recipes.find((r) => r.id === m.value) : null;
                      const displayName = recipe ? recipe.name : customName;
                      return (
                        <li key={m.label} className="week-glance-meal">
                          <span className="week-glance-meal-label">{m.label}</span>
                          <span className="week-glance-recipe-row">
                            {recipe && onViewRecipe ? (
                              <button
                                className="week-glance-recipe-link"
                                onClick={() => onViewRecipe(recipe.id)}
                                title={`View ${recipe.name}`}
                              >
                                {displayName}
                              </button>
                            ) : isCustom && customUrl ? (
                              <a
                                href={customUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="week-glance-recipe-link"
                                title={customUrl}
                              >
                                {displayName}
                              </a>
                            ) : (
                              <span className="week-glance-recipe-name">{displayName}</span>
                            )}
                            {recipe && recipe.cookTime && recipe.cookTime > 45 && (
                              <span className="cook-time-badge glance-cook-time" title={`${recipe.cookTime} min cook time`}>
                                ⏱ {recipe.cookTime}m
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
