/**
 * 釋放本機 3000 / 3001，並結束此專案目錄下所有 Next dev 相關 node 程序。
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORTS = [3000, 3001];
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const PROJECT_MARKER = "Accounting Management System";

function killListenersOnPort(port) {
  if (process.platform !== "win32") {
    console.warn(
      `[free-dev-ports] 非 Windows，請手動確認埠 ${port} 未被佔用。`,
    );
    return;
  }

  let out = "";
  try {
    out = execSync(`netstat -ano | findstr ":${port} "`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch {
    return;
  }

  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes("LISTENING")) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts.at(-1);
    if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`[free-dev-ports] 已結束 PID ${pid}（埠 ${port}）`);
    } catch {
      console.warn(`[free-dev-ports] 無法結束 PID ${pid}（埠 ${port}）`);
    }
  }
}

function killProjectNextProcesses() {
  if (process.platform !== "win32") return;

  let lines = "";
  try {
    lines = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name=\'node.exe\'\\" | Select-Object ProcessId,CommandLine | ForEach-Object { $_.ProcessId.ToString() + \\"|\\" + ($_.CommandLine -replace \\"`n\\",\\" \\") }"',
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
    );
  } catch {
    return;
  }

  const pids = new Set();
  for (const line of lines.split(/\r?\n/)) {
    if (!line.includes(PROJECT_MARKER)) continue;
    if (!/next dev|start-server\.js/i.test(line)) continue;
    const pid = line.split("|")[0]?.trim();
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
      console.log(
        `[free-dev-ports] 已結束此專案 Next 程序 PID ${pid}（${PROJECT_ROOT}）`,
      );
    } catch {
      console.warn(`[free-dev-ports] 無法結束 PID ${pid}`);
    }
  }
}

killProjectNextProcesses();
for (const port of PORTS) {
  killListenersOnPort(port);
}
