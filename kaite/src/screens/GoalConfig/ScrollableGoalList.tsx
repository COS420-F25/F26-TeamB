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

const PLACEHOLDER_GOALS = [
  { id: 1, title: 'Reduce reliance on AI for first drafts', selected: true },
  { id: 2, title: 'Verify AI-generated citations', selected: false },
  { id: 3, title: 'Use AI for brainstorming only', selected: false },
];

function ScrollableGoalList(): React.JSX.Element {
  return (
    <MDBCard className="goal-list-card">
      <MDBCardHeader className="goal-list-header">
        <h2>Your Goals</h2>
      </MDBCardHeader>

      <MDBCardBody className="goal-list-scroll">
        <MDBListGroup className="goal-list-group">
          {PLACEHOLDER_GOALS.map((goal) => (
            <MDBListGroupItem
              key={goal.id}
              className={`goal-list-item ${goal.selected ? 'goal-list-item--selected' : ''}`}
            >
              {goal.title}
            </MDBListGroupItem>
          ))}
        </MDBListGroup>
      </MDBCardBody>

      <MDBCardFooter className="goal-list-footer">
        <MDBBtn type="button" className="goal-config-outline-button w-100">
          + Create New Goal
        </MDBBtn>
      </MDBCardFooter>
    </MDBCard>
  );
}

export default ScrollableGoalList;
