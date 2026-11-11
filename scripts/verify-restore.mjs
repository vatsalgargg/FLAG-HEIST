import { execFileSync } from "node:child_process";
execFileSync("docker", ["compose", "exec", "-T", "platform", "node", "dist/db/backupRestoreTest.js"], { stdio: "inherit" });
