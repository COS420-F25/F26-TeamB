import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WeflectFlow } from "./WeflectFlow";
import type { ReflectionServer } from "../server/types";
import type { ConversationLog } from "../logic/types";
import { fireEvent } from "@testing-library/react";

/**
 * Creates a mock server for testing.
 */
const mockServer: ReflectionServer = {
    createSession: jest.fn().mockResolvedValue("test-session"),
    sendMessage: jest.fn().mockResolvedValue(undefined),
};

/**
 * Creating a mock conversation for testing without importing files.
 */
const validLog: ConversationLog = { source: "unknown", conversations: [{
    id: "test-1",
    title: "Learning TypeScript?",
    turns: [
        {role: "user", text: "Can you explain TypeScript?"},
        {role: "assistant", text: "TypeScript adds types to JavaScript."}
        ],
    metadata: { 
        userPromptCount: 1,
        turnCount: 2, 
        multiTurn: false,
        avgUserPromptLength: 27},
}]};

/**
 * Test checks for if the conversation is invalid.
 */
test("Does not display the summary when there is no log provided", async () => {
    render(<WeflectFlow server={mockServer} />);
    expect(screen.queryByRole("heading", { name: /logs display/i })).not.toBeInTheDocument();
});

/**
 * Simulates clicking the "Get detailed AI usage summary" button.
 * This is at the end of the reflection conversation.
 */
fireEvent.click(screen.getByRole("button", {name: "Get detailed AI usage summary"}));