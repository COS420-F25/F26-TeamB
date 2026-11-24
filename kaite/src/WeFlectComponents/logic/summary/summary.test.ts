import { summarize } from "./index";
import { Conversation, ConversationLog } from "../types";

/**
 * Tests summarize function for an empty conversation log.
 */
test("Returns zero conversations for an empty log", () => {
    const log: ConversationLog =
{    source: "unknown",
    conversations: [],
};
    const result = summarize(log);

    expect(result.intensity.conversationCount).toBe(0);
    expect(result.domains).toEqual([]);
    expect(result.purposes).toEqual([]);
});

/**
 * Mock conversation for testing without importing files. 
 * Duplicate of WeflectFlow.test.tsx's mock for testing the summary generation. 
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
 * Tests that summarizing/using a mock conversation (above) will produce an 
 * expected (non-empty) summary. 
 */
test("Returns a summary for a conversation with content", () => {
    const result = summarize(validLog);
    expect(result.intensity.conversationCount).toBe(1);
})
