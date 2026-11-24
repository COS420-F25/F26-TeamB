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
import { Goal, USER_GOALS_KEY, goalReviver } from './GoalConfigGlobals'
import ScrollableGoalList from './ScrollableGoalList';
import SelectedGoalPane from './SelectedGoalPane';
import NewGoalPane from './NewGoalPane';
import KaiteNavBar from '../../components/KaiteNavBar/KaiteNavBar';

interface GoalConfigScreenProps {
    screenSetter: React.Dispatch<React.SetStateAction<number>>;
    messageSetter: React.Dispatch<React.SetStateAction<string>>;
    message?: string;
}

function loadUserGoals(): Goal[] {
    const goalsString: string = localStorage.getItem(USER_GOALS_KEY) ?? '[]'
    return JSON.parse(goalsString, goalReviver);
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
        setSelected(newSelected);
        setIsCreateMode(!isCreateMode);
    }
    
    return (
        <>
        <KaiteNavBar screenSetter={screenSetter} />
        <MDBContainer fluid className="goal-config-page">

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
        </>
    );
}
export default GoalConfigScreen;