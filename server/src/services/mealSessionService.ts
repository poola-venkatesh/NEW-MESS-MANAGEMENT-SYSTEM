import { prisma } from '../prisma';
import { config } from '../config';

export const DEFAULT_MEAL_DEFINITIONS = [
  {
    name: 'BREAKFAST',
    startTime: '07:30',
    endTime: '09:30',
    defaultPrice: 30.0,
    description: 'Fresh Idli, Medu Vada, Sambar, Coconut Chutney, and Tea/Coffee',
  },
  {
    name: 'LUNCH',
    startTime: '12:30',
    endTime: '14:30',
    defaultPrice: 50.0,
    description: 'Steamed Basmati Rice, Phulka Roti, Dal Tadka, Paneer Curry, Fresh Curd & Salad',
  },
  {
    name: 'SNACKS',
    startTime: '17:00',
    endTime: '18:30',
    defaultPrice: 20.0,
    description: 'Hot Vegetable Samosa / Cutlets, Mint Chutney, and Masala Chai',
  },
  {
    name: 'DINNER',
    startTime: '19:30',
    endTime: '21:30',
    defaultPrice: 50.0,
    description: 'Tawa Paratha, Veg Dum Biryani, Mixed Dal Fry, Aloo Gobi, and Gulab Jamun',
  },
];

/**
 * Returns the current date in YYYY-MM-DD format based on college timezone
 */
export function getCurrentDateStr(dateObj?: Date): string {
  const d = dateObj || new Date();
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: config.hostelTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().split('T')[0];
  }
}

/**
 * Returns the current time in HH:mm format based on college timezone
 */
export function getCurrentTimeStr(dateObj?: Date): string {
  const d = dateObj || new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: config.hostelTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    return `${hour}:${minute}`;
  } catch {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * Ensure the default 4 meal definitions exist in database
 */
export async function ensureMealDefinitions() {
  for (const def of DEFAULT_MEAL_DEFINITIONS) {
    const existing = await prisma.mealDefinition.findUnique({
      where: { name: def.name },
    });
    if (!existing) {
      await prisma.mealDefinition.create({
        data: {
          name: def.name,
          startTime: def.startTime,
          endTime: def.endTime,
          defaultPrice: def.defaultPrice,
          description: def.description,
          isActive: true,
        },
      });
    }
  }
}

/**
 * Ensures that MealSession records exist for the specified date
 */
export async function getOrCreateTodayMealSessions(dateStr?: string) {
  const targetDate = dateStr || getCurrentDateStr();
  await ensureMealDefinitions();

  const definitions = await prisma.mealDefinition.findMany({
    where: { isActive: true },
  });

  const sessions = [];
  for (const def of definitions) {
    let session = await prisma.mealSession.findUnique({
      where: {
        mealDefinitionId_date: {
          mealDefinitionId: def.id,
          date: targetDate,
        },
      },
    });

    if (!session) {
      session = await prisma.mealSession.create({
        data: {
          mealDefinitionId: def.id,
          date: targetDate,
          name: def.name,
          startTime: def.startTime,
          endTime: def.endTime,
          price: def.defaultPrice,
          menuDescription: def.description,
          status: 'ACTIVE',
        },
      });
    }
    sessions.push(session);
  }

  return sessions;
}

/**
 * Resolves the currently active meal session based on server time & college timezone
 */
export async function getCurrentActiveMealSession(
  overrideDate?: string,
  overrideTime?: string
) {
  const currentDate = overrideDate || getCurrentDateStr();
  const currentTime = overrideTime || getCurrentTimeStr();

  const sessions = await getOrCreateTodayMealSessions(currentDate);

  // Find session where startTime <= currentTime <= endTime and status is ACTIVE
  const activeSession = sessions.find((session) => {
    if (session.status !== 'ACTIVE') return false;
    return session.startTime <= currentTime && currentTime <= session.endTime;
  });

  return {
    activeSession: activeSession || null,
    currentDate,
    currentTime,
    allTodaySessions: sessions,
  };
}
