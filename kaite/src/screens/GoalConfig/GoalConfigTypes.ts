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