import { config } from "dotenv";

// .env.test overrides .env so the test suite always runs against the
// isolated samepath_test database, never the local dev database.
config({ path: ".env.test", override: true });
