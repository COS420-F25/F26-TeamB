import React from 'react';
import { MDBCard, MDBCardBody, MDBBtn, MDBTextArea, MDBInput, MDBRow, MDBCol } from 'mdb-react-ui-kit';
import { Goal, GoalUpdate } from './GoalConfigTypes'

interface NewGoalPaneProps {
    goals: Goal[],
    goalsSetter: (newGoals: Goal[]) => void,
    isCreateModeSwapper: (newSelected: number) => void
}

function NewGoalPane({ goals, goalsSetter, isCreateModeSwapper}: NewGoalPaneProps): React.JSX.Element {
    const [goalTitle, setGoalTitle] = React.useState<string>('');
    const [goalDesc, setGoalDesc] = React.useState<string>('');

    function updateGoalTitle(event: React.ChangeEvent<HTMLInputElement>): void {
        setGoalTitle(event.target.value);
    }
    function updateGoalDesc(event: React.ChangeEvent<HTMLTextAreaElement>): void {
        setGoalDesc(event.target.value);
    }

    function addNewGoal(): void {
        const newGoals: Goal[] = [...goals, {title: goalTitle, description: goalDesc, created: new Date(), updates: []}]
        goalsSetter(newGoals);
        isCreateModeSwapper(goals.length);
    }
  
    return (
        <MDBCard className="goal-detail-card">
        <MDBCardBody className="goal-detail-body">
            <div className="goal-detail-title">
                <MDBInput
                  type="text"
                  size="lg"
                  className="goal-config-input"
                  labelClass="goal-config-input-label"
                  label="New Goal Title"
                  placeholder="Title for new goal"
                  value={goalTitle}
                  onChange={updateGoalTitle}
                />
            </div>
            <div className="goal-detail-description">
              <MDBTextArea
                className="goal-config-input"
                labelClass="goal-config-input-label"
                label="New Goal Description"
                placeholder="Description for new goal"
                rows={3}
                value={goalDesc}
                onChange={updateGoalDesc}
              />
            </div>
            <MDBRow>
              <MDBCol size="sm" className="d-flex gap-2"><MDBBtn type="button" onClick={addNewGoal} className="goal-config-cta-button">
                Add new goal
              </MDBBtn>
              {goals.length > 0 &&
              <MDBBtn type="button" onClick={() => {isCreateModeSwapper(goals.length-1)}} className="goal-config-cta-button">
                Cancel
              </MDBBtn>}</MDBCol>
            </MDBRow>

            {/* <h3 className="goal-detail-subheading">Progress updates</h3>
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
                className="goal-update-input"
                placeholder="Add a progress update..."
                rows={3}
                value={newUpdate}
                onChange={updateNewUpdate}
            />
            <div className="goal-update-form-row">
                <MDBInput
                  type="text"
                  className="goal-update-timestamp-input"
                  label="Custom date (optional)"
                  placeholder="MM/DD/YYYY"
                  value={updateTimestamp}
                  onChange={updateUpdateTimestamp}
                />
                <MDBBtn type="button" onClick={addGoalUpdate} className="goal-config-cta-button">
                  Add progress update
                </MDBBtn>
            </div>
            </div> */}
        </MDBCardBody>
        </MDBCard>
    );
}

export default NewGoalPane;
