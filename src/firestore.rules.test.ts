import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import * as fs from "fs";

/**
 * Basic security rules test suite.
 */
describe("Firestore Security Rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "voz-mixe-test",
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  test("unauthenticated user cannot write to users", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const userDoc = doc(unauthedDb, "users/hackerman");
    await assertFails(setDoc(userDoc, { displayName: "Hacker" }));
  });

  test("user can create their own profile", async () => {
    const authedDb = testEnv.authenticatedContext("user123", { email: "user@example.com", email_verified: true }).firestore();
    const userDoc = doc(authedDb, "users/user123");
    await assertSucceeds(setDoc(userDoc, {
      uid: "user123",
      displayName: "User One",
      email: "user@example.com",
      role: "user",
      createdAt: new Date()
    }));
  });

  test("user cannot set themselves as admin", async () => {
    const authedDb = testEnv.authenticatedContext("user123", { email: "user@example.com", email_verified: true }).firestore();
    const userDoc = doc(authedDb, "users/user123");
    await assertFails(setDoc(userDoc, {
      uid: "user123",
      displayName: "User One",
      email: "user@example.com",
      role: "admin",
      createdAt: new Date()
    }));
  });

  test("unverified email user cannot create stream", async () => {
    const authedDb = testEnv.authenticatedContext("user123", { email: "user@example.com", email_verified: false }).firestore();
    const streamDoc = doc(authedDb, "streams/stream1");
    await assertFails(setDoc(streamDoc, {
      userId: "user123",
      userName: "User One",
      title: "My Stream",
      status: "live",
      startedAt: new Date(),
      viewerCount: 0,
      likes: 0
    }));
  });
});
