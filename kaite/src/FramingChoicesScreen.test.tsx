import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FramingChoicesScreen from './FramingChoicesScreen';

//Test for rendering framing choices component
test('renders framing choices', () => {
    render(<FramingChoicesScreen />)

    //Verify a framing choices component renderd
    const framingChoices = screen.getByRole('framingChoices',{});
    expect(framingChoices).toBeInTheDocument();
})
//Test for rendering timer component 
test('renders timerSetter component', () => {
    render(<FramingChoicesScreen />)

    //Verify a timer component renderd
    const timerSetter = screen.getByRole('timerSetter',{});
    expect(timerSetter).toBeInTheDocument();
})
//Test for rendering goals components
test('renders goalSetter components', () => {
    render(<FramingChoicesScreen />)

    //Verify a goalSetter component renderd
    const goalSetter = screen.getByRole('goalSetter',{});
    expect(goalSetter).toBeInTheDocument();
})
