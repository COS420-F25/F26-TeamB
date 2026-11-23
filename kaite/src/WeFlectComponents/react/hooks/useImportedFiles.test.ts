import { buildImportView } from "./useImportedFiles";

/**
 * Test checks for if the conversation logs can be extracted.
 */
test("Returns no log when no conversations are parsed.", () => {
    const result = buildImportView([]);
    expect(result.log).toBeNull();
});
test("Returns no log with a blank conversation file.", () => {
    const result = buildImportView([
        { row: {
            path: "empty.json",
            format: "unknown",
            count: 0,
        }, conversations: [], 
    }]);
    expect(result.log).toBeNull();
    expect(result.summary).toContain("No conversations could be parsed");
});