import { beforeEach, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoalConfigScreen from './GoalConfigScreen';
import { Goal, GoalUpdate, USER_GOALS_KEY, goalReviver } from './GoalConfigGlobals';

const populatedGoals: Goal[] = [
    {
        title: "Test Goal 1",
        description: "Very thorough description of the goal",
        created: new Date(2026, 10, 19),
        updates: []
    },
    {
        title: "Test Goal 2",
        description: "Another very informative description",
        created: new Date(2026, 10, 20),
        updates: [{updateDesc: "Made progress on the goal", completed: new Date(2026, 10, 21)}]
    }
]

const newGoal: Goal = {
    title: "New goal added during test",
    description: "This is a new goal that will be added during the test",
    created: new Date(),
    updates: []
}

async function expectNewGoalPane(expectCancelButton: boolean): Promise<void> {
    expect(screen.getByLabelText(/new goal title/i)).toBeTruthy();
    expect(screen.getByLabelText(/new goal description/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /add new goal/i })).toBeTruthy();
    if(expectCancelButton) {
        expect(screen.queryByRole('button', { name: /cancel/i })).toBeTruthy(); }
    else {
        expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
    }
}

async function expectSelectedGoalPane(expectedGoal: Goal): Promise<void> {
    expect(screen.getByRole('heading', { name: expectedGoal.title })).toBeTruthy();
    expect(screen.getByLabelText(expectedGoal.description)).toBeTruthy();
    if(expectedGoal.updates.length > 0) {
        expect(screen.getByLabelText(expectedGoal.updates[0].updateDesc)).toBeTruthy(); }
    expect(screen.getByLabelText(/new update/i)).toBeTruthy();
    expect(screen.getByLabelText(/custom date/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /add progress update/i})).toBeTruthy();
}

beforeEach(() => {
    window.localStorage.clear();
});

test('renders the goal list', async () => {
    // setup
    localStorage.setItem(USER_GOALS_KEY, JSON.stringify(populatedGoals))
    render(<GoalConfigScreen screenSetter={() => {}} messageSetter={() => {}} message={""}/>);
    // assertion
    expect(screen.getByRole('heading', { name: /your goals/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /create new goal/i })).toBeTruthy();
    expect(screen.getByLabelText(/test goal 1/i)).toBeTruthy();
    expect(screen.getByLabelText(/test goal 2/i)).toBeTruthy();
});

test('when user has no goals, displays goal creation pane', async () => {
    // setup
    render(<GoalConfigScreen screenSetter={() => {}} messageSetter={() => {}} message={""}/>);
    // assertion
    expectNewGoalPane(false); // `Cancel` button shouldn't display when the user has no goals
});

test('when user has goals, displays selected goal pane', async () => {
    // setup
    localStorage.setItem(USER_GOALS_KEY, JSON.stringify(populatedGoals));
    render(<GoalConfigScreen screenSetter={() => {}} messageSetter={() => {}} message={""}/>);
    // assertion
    expectSelectedGoalPane(populatedGoals[-1]);
});

test('when selected pane is displayed and user clicks Create New Goal button, displays goal creation pane', async () => {
    // setup
    localStorage.setItem(USER_GOALS_KEY, JSON.stringify(populatedGoals));
    render(<GoalConfigScreen screenSetter={() => {}} messageSetter={() => {}} message={""}/>);
    // user action
    await userEvent.click(screen.getByRole('button', { name: /create new goal/i }));
    // assertion
    expectNewGoalPane(true);
});

test('when goal creation pane is displayed and user clicks Cancel button, displays selected goal pane', async () => {
    // setup
    localStorage.setItem(USER_GOALS_KEY, JSON.stringify(populatedGoals));
    render(<GoalConfigScreen screenSetter={() => {}} messageSetter={() => {}} message={""}/>);
    await userEvent.click(screen.getByRole('button', { name: /create new goal/i }));
    // user action
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    // assertion
    expectSelectedGoalPane(populatedGoals[-1]);
});

test('when goal creation pane is displayed and user clicks Add New Goal button, adds and selects the goal', async () => {
    // setup
    render(<GoalConfigScreen screenSetter={() => {}} messageSetter={() => {}} message={""}/>);
    const user = userEvent.setup();
    // user action
    await user.type(screen.getByPlaceholderText(/title for new goal/i), newGoal.title);
    await user.type(screen.getByPlaceholderText(/description for new goal/i), newGoal.description);
    await user.click(screen.getByRole('button', { name: /add new goal/i }));
    // assertion
    const newGoalInLocalStorage: Goal = JSON.parse(localStorage.getItem(USER_GOALS_KEY) ?? '[]', goalReviver).filter((goal: Goal): boolean => {return goal.title === newGoal.title})[0];
    expect(newGoalInLocalStorage.title).toEqual(newGoal.title);
    expect(newGoalInLocalStorage.description).toEqual(newGoal.description);
    expect(newGoalInLocalStorage.created.toDateString()).toEqual(newGoal.created.toDateString());
    expect(newGoalInLocalStorage.updates).toEqual(newGoal.updates);
    expectSelectedGoalPane(newGoal);
});

test('when selected goal pane is displayed and user clicks a different goal, displays that goal', async () => {
    // setup
    localStorage.setItem(USER_GOALS_KEY, JSON.stringify(populatedGoals));
    render(<GoalConfigScreen screenSetter={() => {}} messageSetter={() => {}} message={""}/>);
    const user = userEvent.setup();
    // user action
    await user.click(screen.getByLabelText(populatedGoals[0].title));
    // assertion
    expectSelectedGoalPane(populatedGoals[0]);
});

test('when selected goal pane is displayed and user clicks Add Progress Update button, adds the progress update', async () => {
    // setup
    localStorage.setItem(USER_GOALS_KEY, JSON.stringify(populatedGoals));
    render(<GoalConfigScreen screenSetter={() => {}} messageSetter={() => {}} message={""}/>);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(populatedGoals[0].title));
    // user action
    await user.type(screen.getByPlaceholderText(/add a progress update/i), "Added a new update for testing");
    await user.click(screen.getByRole('button', { name: /add progress update/i}));
    // assertion
    expect(JSON.parse(localStorage.getItem(USER_GOALS_KEY) ?? '')[0].updates
        .filter((update: GoalUpdate): boolean => {return update.updateDesc === "Added a new update for testing"})
        .length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/new update for testing/i)).toBeTruthy();
});