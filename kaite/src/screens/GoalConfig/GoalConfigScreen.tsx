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
import { Goal, USER_GOALS_KEY } from './GoalConfigTypes'
import ScrollableGoalList from './ScrollableGoalList';
import SelectedGoalPane from './SelectedGoalPane';
import NewGoalPane from './NewGoalPane';

interface GoalConfigScreenProps {
    screenSetter: React.Dispatch<React.SetStateAction<number>>;
    messageSetter: React.Dispatch<React.SetStateAction<string>>;
    message?: string;
}

function loadUserGoals(): Goal[] {
    const goalsString: string = localStorage.getItem(USER_GOALS_KEY) ?? '[]'
    return JSON.parse(goalsString);
}

function GoalConfigScreen({ screenSetter, messageSetter, message }: GoalConfigScreenProps): React.JSX.Element {
    const [goals, setGoals] = React.useState<Goal[]>(loadUserGoals());
    const [selected, setSelected] = React.useState<number|null>( goals.length === 0 ? null : goals.length-1);
    const [isCreateMode, setIsCreateMode] = React.useState<boolean>( goals.length === 0);

    function goalsSetter(newGoals: Goal[]): void {
        setGoals(newGoals);
    }
    function selectedSetter(newSelected: number): void {
        setSelected(newSelected);
    }
    function isCreateModeSwapper(newSelected: number | null): void {
        if(isCreateMode && !(goals.length>0)) { return }
        setSelected(newSelected);
        setIsCreateMode(!isCreateMode);
    }
    
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
            <ScrollableGoalList
              goals={goals}
              selected={selected}
              selectedSetter={selectedSetter}
              isCreateMode={isCreateMode}
              isCreateModeSwapper={isCreateModeSwapper}
            />
            </MDBCol>
            <MDBCol md="8" lg="9" className="goal-config-detail-col">
            {isCreateMode ? 
            <NewGoalPane
              goals={goals}
              goalsSetter={goalsSetter}
              isCreateModeSwapper={isCreateModeSwapper}
            /> :
            <SelectedGoalPane
              goals={goals}
              goalsSetter={goalsSetter}
              selected={selected ?? goals.length-1}
              isCreateMode={isCreateMode}
            />}
            </MDBCol>
        </MDBRow>
        </MDBContainer>
    );
}
export default GoalConfigScreen;