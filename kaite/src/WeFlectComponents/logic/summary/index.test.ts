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

