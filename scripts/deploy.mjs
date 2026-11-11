import { spawnSync } from "node:child_process";
// Targets are configured by the organiser in protected GitLab environment variables.
const {
  DEPLOY_HOST: host,
  DEPLOY_PATH: path,
  CI_COMMIT_SHA: revision,
} = process.env;
if (
  !host ||
  !/^[a-zA-Z0-9_.@-]+$/.test(host) ||
  !path ||
  !/^\/[a-zA-Z0-9_./-]+$/.test(path) ||
  !/^[a-f0-9]{40}$/.test(revision || "")
)
  throw new Error(
    "Provide a valid deployment host, absolute deployment path and commit SHA.",
  );
const script = `set -eu
cd "$1"
previous=$(git rev-parse HEAD)
printf '%s\\n' "$previous" > .last-deployed-revision
git fetch origin "$2"
git checkout --detach "$2"
npm ci
npm run services:up
npm run build
systemctl --user restart flagheist-web
curl --fail --retry 10 --retry-delay 2 http://127.0.0.1:8180/healthz
curl --fail --retry 10 --retry-delay 2 http://127.0.0.1:3000/ -o /dev/null
`;
const result = spawnSync("ssh", [host, "sh", "-s", "--", path, revision], {
  input: script,
  stdio: ["pipe", "inherit", "inherit"],
});
process.exit(result.status ?? 1);
