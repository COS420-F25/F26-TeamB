import React from 'react';
import {
  MDBCard,
  MDBCardHeader,
  MDBCardBody,
  MDBCardFooter,
  MDBBtn,
  MDBListGroup,
  MDBListGroupItem,
} from 'mdb-react-ui-kit';
import { Goal } from './GoalConfigTypes'

interface ScrollableGoalListProps {
    goals: Goal[],
    selected: number | null,
    selectedSetter: (newSelected: number) => void,
    isCreateMode: boolean,
    isCreateModeSwapper: () => void
}

function ScrollableGoalList({goals, selected, selectedSetter, isCreateMode, isCreateModeSwapper}: ScrollableGoalListProps): React.JSX.Element {
  return (
    <MDBCard className="goal-list-card">
      <MDBCardHeader className="goal-list-header">
        <h2>Your Goals</h2>
      </MDBCardHeader>

      <MDBCardBody className="goal-list-scroll">
        <MDBListGroup className="goal-list-group">
          {goals.map((goal, index) => (
            <MDBListGroupItem
              key={goal.title}
              onClick={() => {selectedSetter(index)}}
              className={`goal-list-item${isCreateMode ? '-disabled' : ''} ${index===selected ? 'goal-list-item--selected' : ''}`}
            >
              {goal.title}
            </MDBListGroupItem>
          ))}
        </MDBListGroup>
      </MDBCardBody>

      <MDBCardFooter className="goal-list-footer">
        <MDBBtn type="button" onClick={isCreateModeSwapper} disabled={isCreateMode} className="goal-config-outline-button w-100">
          + Create New Goal
        </MDBBtn>
      </MDBCardFooter>
    </MDBCard>
  );
}

export default ScrollableGoalList;
