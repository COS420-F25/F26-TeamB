import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FramingScreen } from "./FramingChoicesScreen";
import { FRAMING_DIMENSIONS, FramingPreferences } from "./Logic/framingIndex";

//Test for rendering framing choices component
test('renders framing choices', () => {
    render(<FramingScreen onStart={function (framing: FramingPreferences): void {
        throw new Error('Function not implemented.');
    } } onBack={function (): void {
        throw new Error('Function not implemented.');
    } } />)

    //Verify a framing choices component renderd
    const framingChoices = screen.getByRole('framingChoices',{});
    expect(framingChoices).toBeInTheDocument();
})
//Test for rendering timer component 
test('renders timerSetter component', () => {
    render(<FramingScreen onStart={function (framing: FramingPreferences): void {
        throw new Error('Function not implemented.');
    } } onBack={function (): void {
        throw new Error('Function not implemented.');
    } } />)

    //Verify a timer component renderd
    const timerSetter = screen.getByRole('timerSetter',{});
    expect(timerSetter).toBeInTheDocument();
})
//Test for rendering goals components
test('renders goalSetter components', () => {
    render(<FramingScreen onStart={function (framing: FramingPreferences): void {
        throw new Error('Function not implemented.');
    } } onBack={function (): void {
        throw new Error('Function not implemented.');
    } } />)

    //Verify a goalSetter component renderd
    const goalSetter = screen.getByRole('goalSetter',{});
    expect(goalSetter).toBeInTheDocument();
})
