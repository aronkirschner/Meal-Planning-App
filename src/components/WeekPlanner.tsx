import { useState, useMemo, useEffect, useRef } from 'react';
import type { Recipe, WeekPlan, DayMeal, DayOfWeek } from '../types';
import { DAYS_OF_WEEK } from '../types';
import { generateId } from '../firestore-storage';
import { AIPlannerInput } from './AIPlannerInput';

interface RecipeCookInfo {
  timesCooked: number;
  lastCooked: string | null;
}

interface WeekPlannerProps {
  recipes: Recipe[];
  weekPlan: WeekPlan | null;
  onSave: (plan: WeekPlan) => void;
  onLoadWeekPlan?: (weekStart: string) => Promise<WeekPlan | undefined>;
  cookInfo?: Map<string, RecipeCookInfo>;
}

function getSunday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
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

interface MealSelectorProps {
  label: string;
  value: string;
  recipes: Recipe[];
  onChange: (value: string) => void;
}

function MealSelector({ label, value, recipes, onChange }: MealSelectorProps) {
  const isCustom = value.startsWith(CUSTOM_PREFIX);
  const customText = isCustom ? value.slice(CUSTOM_PREFIX.length) : '';
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
    onChange(CUSTOM_PREFIX + text);
  };

  const handleSelect = (newValue: string) => {
    if (newValue === '__custom__') {
      setShowCustomInput(true);
      onChange(CUSTOM_PREFIX);
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
            value={customText}
            onChange={(e) => handleCustomTextChange(e.target.value)}
            placeholder="Enter custom item..."
            className="custom-meal-input"
          />
          <button
            type="button"
            onClick={() => {
              setShowCustomInput(false);
              onChange('');
            }}
            className="btn-cancel-custom"
            title="Back to dropdown"
          >
            &times;
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

export function WeekPlanner({ recipes, weekPlan, onSave, onLoadWeekPlan, cookInfo }: WeekPlannerProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    if (weekPlan) {
      return parseLocalDate(weekPlan.weekStart);
    }
    return getSunday(new Date());
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

  // Sync days when weekPlan prop loads asynchronously
  useEffect(() => {
    if (weekPlan?.days) {
      setDays(weekPlan.days);
      setCurrentPlanId(weekPlan.id);
      setCurrentWeekStart(parseLocalDate(weekPlan.weekStart));
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
  const otherRecipes = useMemo(
    () => recipes.filter((r) => r.category === 'other'),
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
  };

  const handleSave = () => {
    const plan: WeekPlan = {
      id: currentPlanId || generateId(),
      weekStart: formatDate(currentWeekStart),
      days,
    };
    setCurrentPlanId(plan.id);
    onSave(plan);
  };

  const navigateToWeek = async (newWeekStart: Date) => {
    setCurrentWeekStart(newWeekStart);
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
    navigateToWeek(getSunday(new Date()));
  };

  const handleAIPlanGenerated = (plan: Record<DayOfWeek, DayMeal>) => {
    // Merge AI-generated plan with current days
    setDays(plan);
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
          onPlanGenerated={handleAIPlanGenerated}
          cookInfo={cookInfo}
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
                recipes={otherRecipes}
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
        <button onClick={handleSave} className="btn-primary">
          Save Week Plan
        </button>
      </div>
    </div>
  );
}
