import { useState, useMemo } from 'react';
import type { Recipe, WeekPlan, DayMeal, DayOfWeek } from '../types';
import { DAYS_OF_WEEK } from '../types';
import { generateId } from '../firestore-storage';
import { AIPlannerInput } from './AIPlannerInput';

interface WeekPlannerProps {
  recipes: Recipe[];
  weekPlan: WeekPlan | null;
  onSave: (plan: WeekPlan) => void;
}

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

  const handleSelectChange = (newValue: string) => {
    if (newValue === '__custom__') {
      setShowCustomInput(true);
      onChange(CUSTOM_PREFIX);
    } else {
      setShowCustomInput(false);
      onChange(newValue);
    }
  };

  const handleCustomTextChange = (text: string) => {
    onChange(CUSTOM_PREFIX + text);
  };

  return (
    <div className="meal-selector">
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
        <select
          value={value || ''}
          onChange={(e) => handleSelectChange(e.target.value)}
        >
          <option value="">-- Select --</option>
          <option value="__custom__">Custom...</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function WeekPlanner({ recipes, weekPlan, onSave }: WeekPlannerProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    if (weekPlan) {
      return new Date(weekPlan.weekStart);
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
        [mealType]: value || undefined,
      },
    }));
  };

  const handleSave = () => {
    const plan: WeekPlan = {
      id: weekPlan?.id || generateId(),
      weekStart: formatDate(currentWeekStart),
      days,
    };
    onSave(plan);
  };

  const handlePreviousWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, -7));
    setDays(emptyDays);
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, 7));
    setDays(emptyDays);
  };

  const handleCurrentWeek = () => {
    setCurrentWeekStart(getSunday(new Date()));
    setDays(emptyDays);
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
        <button onClick={handleSave} className="btn-primary">
          Save Week Plan
        </button>
      </div>
    </div>
  );
}
