import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WeflectFlow } from "./WeflectFlow";
import type { ReflectionServer } from "../server/types";

/**
 * Creates a mock server for testing.
 */
const mockServer: ReflectionServer = {
    createSession: jest.fn().mockResolvedValue("test-session"),
    sendMessage: jest.fn().mockResolvedValue(undefined),
};

/**
 * Test checks for if the conversation is invalid.
 */
test("Does not display the summary when there is no log provided", async () => {
    render(<WeflectFlow server={mockServer} />);
    expect(screen.queryByRole("heading", { name: /logs display/i })).not.toBeInTheDocument();
});