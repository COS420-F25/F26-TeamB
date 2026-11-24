export const USER_GOALS_KEY: string = 'kaite-user-goals';

export interface GoalUpdate {
    updateDesc: string
    completed: Date
}

export interface Goal {
    title: string
    description: string
    created: Date
    updates: GoalUpdate[]
}

export function goalReviver(key: string, value: unknown): unknown {
    if ((key === 'completed' || key === 'created') && typeof value === 'string') {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? value : parsed;
    }
    return value;
}
