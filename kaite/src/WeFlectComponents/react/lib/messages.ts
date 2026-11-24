// KAIte/react/lib/messages.ts
//
// The two canned student messages the chat sends on the student's behalf.

/**
 * Hidden opening turn that makes the agent produce its reflection summary.
 * In the weflect repo this must stay byte-identical to the kickoff used by its
 * original client and its eval harness, so all three exercise the same opening
 * (a test there checks it). Another project is free to change the wording.
 */
export const KICKOFF_MESSAGE =
  "I'm ready to start the reflection. I've set aside plenty of time, so I'd like to go through this thoroughly and touch on the different parts of my profile before we wrap up.";

/** Sent by the "Skip this one" button; no user bubble is shown for it. */
export const SKIP_MESSAGE = "I'd like to skip this one — let's move on.";
