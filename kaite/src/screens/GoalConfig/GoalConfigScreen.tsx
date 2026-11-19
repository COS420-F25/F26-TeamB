import React from 'react';
import './GoalConfigScreen.css';
import {
  MDBBtn,
  MDBContainer,
  MDBRow,
  MDBCol,
  MDBCard,
  MDBCardBody,
  MDBInput,
  MDBIcon
} from 'mdb-react-ui-kit';
import 'mdb-react-ui-kit/dist/css/mdb.min.css';
import ScrollableGoalList from './ScrollableGoalList';
import SelectedGoalPane from './SelectedGoalPane';

function GoalConfigScreen(): React.JSX.Element {
    return (
        <MDBContainer fluid className="goal-config-page">
        <header className="goal-config-navbar">
            <div className="goal-config-navbar-brand">KAIte</div>
            <nav className="goal-config-navbar-links" aria-label="Main navigation">
            <a href="#home">Home</a>
            <a href="#chat-history">Chat History</a>
            <a href="#settings">Settings</a>
            <div className="goal-config-avatar" aria-label="User profile">NM</div>
            </nav>
        </header>

        <MDBRow className="goal-config-body">
            <MDBCol md="4" lg="3" className="goal-config-list-col">
            <ScrollableGoalList />
            </MDBCol>
            <MDBCol md="8" lg="9" className="goal-config-detail-col">
            <SelectedGoalPane />
            </MDBCol>
        </MDBRow>
        </MDBContainer>
    );
}
export default GoalConfigScreen;