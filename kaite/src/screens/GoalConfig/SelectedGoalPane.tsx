import React from 'react';
import { MDBCard, MDBCardBody, MDBBtn, MDBTextArea, MDBInput } from 'mdb-react-ui-kit';
import { Goal, GoalUpdate } from './GoalConfigTypes'

interface SelectedGoalPaneProps {
    goals: Goal[],
    goalsSetter: (newGoals: Goal[]) => void,
    selected: number,
    isCreateMode: boolean
}

function SelectedGoalPane({ goals, goalsSetter, selected, isCreateMode}: SelectedGoalPaneProps): React.JSX.Element {
    const [newUpdate, setNewUpdate] = React.useState<string>('');
    const [updateTimestamp, setUpdateTimestamp] = React.useState<string>('');

    let currentGoal: Goal = goals[selected];

    function updateNewUpdate(event: React.ChangeEvent<HTMLTextAreaElement>): void {
        setNewUpdate(event.target.value);
    }
    function updateUpdateTimestamp(event: React.ChangeEvent<HTMLInputElement>): void {
        setUpdateTimestamp(event.target.value);
    }

    function parseCustomTimestamp(): Date | null {
        if(updateTimestamp.length === 10) {
            let month: number = parseInt(updateTimestamp.slice(0, 2));
            let day: number = parseInt(updateTimestamp.slice(3, 5));
            let year: number = parseInt(updateTimestamp.slice(6));
            if (month === month && day === day && year === year) { // This checks for NaN
                return new Date(year, month, day);
            }
        }
        return new Date(); // Defaults to right now
    }
    function addGoalUpdate(): void {
        const newUpdateCreated: Date = parseCustomTimestamp() ?? new Date();
        const newUpdateList: GoalUpdate[] = [...currentGoal.updates, {updateDesc: newUpdate, completed: newUpdateCreated}];
        const goalsWithUpdate: Goal[] = goals.map((goal, index): Goal => {
            return index === selected ? {...goal, updates: newUpdateList} : goal
        });
        goalsSetter(goalsWithUpdate);
    }
  
    return (
        <MDBCard className="goal-detail-card">
        <MDBCardBody className="goal-detail-body">
            <h1 className="goal-detail-title">{currentGoal.title}</h1>
            <p className="goal-detail-description">
              {currentGoal.description}
            </p>

            <h3 className="goal-detail-subheading">Progress updates</h3>
            <div className="goal-update-scroll">
            <ul className="goal-update-list">
                {currentGoal.updates.map((update) => (
                <li key={update.updateDesc} className="goal-update-item">
                    <span className="goal-update-timestamp">{update.completed.toDateString()}</span>
                    <p className="goal-update-text">{update.updateDesc}</p>
                </li>
                ))}
            </ul>
            </div>

            <div className="goal-update-form">
            <MDBTextArea
                className="goal-config-input"
                placeholder="Add a progress update..."
                label="New update"
                labelClass="goal-config-input-label"
                rows={3}
                value={newUpdate}
                onChange={updateNewUpdate}
            />
            <div className="goal-update-form-row">
                <MDBInput
                  type="text"
                  className="goal-update-timestamp-input"
                  label="Custom date (optional)"
                  labelClass="goal-config-input-label"
                  placeholder="MM/DD/YYYY"
                  value={updateTimestamp}
                  onChange={updateUpdateTimestamp}
                />
                <MDBBtn type="button" onClick={addGoalUpdate} className="goal-config-cta-button">
                  Add progress update
                </MDBBtn>
            </div>
            </div>
        </MDBCardBody>
        </MDBCard>
    );
}

export default SelectedGoalPane;
