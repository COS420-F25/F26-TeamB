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
