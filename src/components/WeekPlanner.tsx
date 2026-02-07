import { useState, useMemo } from 'react';
import type { Recipe, WeekPlan, DayMeal, DayOfWeek } from '../types';
import { DAYS_OF_WEEK } from '../types';
import { generateId } from '../storage';

interface WeekPlannerProps {
  recipes: Recipe[];
  weekPlan: WeekPlan | null;
  onSave: (plan: WeekPlan) => void;
}

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

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export function WeekPlanner({ recipes, weekPlan, onSave }: WeekPlannerProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    if (weekPlan) {
      return new Date(weekPlan.weekStart);
    }
    return getMonday(new Date());
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

  const handleMealChange = (
    day: DayOfWeek,
    mealType: keyof DayMeal,
    recipeId: string
  ) => {
    setDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [mealType]: recipeId || undefined,
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
    setCurrentWeekStart(getMonday(new Date()));
    setDays(emptyDays);
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

      <div className="week-grid">
        {DAYS_OF_WEEK.map((day, index) => {
          const dayDate = addDays(currentWeekStart, index);
          return (
            <div key={day} className="day-column">
              <div className="day-header">
                <strong>{DAY_LABELS[day]}</strong>
                <span className="day-date">{formatDisplayDate(dayDate)}</span>
              </div>

              <div className="meal-selector">
                <label>Main Dish</label>
                <select
                  value={days[day].main || ''}
                  onChange={(e) => handleMealChange(day, 'main', e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {mainRecipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="meal-selector">
                <label>Vegetable</label>
                <select
                  value={days[day].vegetable || ''}
                  onChange={(e) =>
                    handleMealChange(day, 'vegetable', e.target.value)
                  }
                >
                  <option value="">-- Select --</option>
                  {vegetableRecipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="meal-selector">
                <label>Grain</label>
                <select
                  value={days[day].grain || ''}
                  onChange={(e) => handleMealChange(day, 'grain', e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {grainRecipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
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
