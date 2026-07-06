const { exec, execSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");

function isWsl() {
  try {
    return fs.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

function getLocalIPv4() {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const net of interfaces || []) {
      const isIPv4 = net.family === "IPv4" || net.family === 4;
      if (isIPv4 && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => tester.close(() => resolve(true)))
      .listen(port, "0.0.0.0");
  });
}

function canWindowsReach(url) {
  if (!isWsl()) {
    return true;
  }

  try {
    const escaped = url.replace(/'/g, "''");
    const result = execSync(
      `powershell.exe -NoProfile -Command "try { (Invoke-WebRequest -Uri '${escaped}' -UseBasicParsing -TimeoutSec 4).StatusCode } catch { 0 }"`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    return result === "200";
  } catch {
    return false;
  }
}

function openInWindowsBrowser(url) {
  exec(`cmd.exe /c start "" "${url}"`, { windowsHide: true });
}

function announceDevUrls(port) {
  const localIp = getLocalIPv4();
  const localhostUrl = `http://localhost:${port}`;
  const wslUrl = localIp ? `http://${localIp}:${port}` : null;
  const localhostWorks = canWindowsReach(localhostUrl);
  const wslWorks = wslUrl ? canWindowsReach(wslUrl) : false;

  console.log("\n  Dev server ready:");

  if (localhostWorks) {
    console.log(`  → ${localhostUrl}  (Windows browser)`);
  } else {
    console.log(`  → ${localhostUrl}  (not reachable from Windows on this machine)`);
  }

  if (wslUrl) {
    console.log(`  → ${wslUrl}  (Windows browser${wslWorks ? "" : " — test this URL"})`);
  }

  if (isWsl() && !localhostWorks && wslWorks) {
    console.log("\n  WSL localhost forwarding is off. Use the WSL IP URL above.");
    console.log("  Opening it in your Windows browser now...\n");
    openInWindowsBrowser(wslUrl);
    return;
  }

  if (isWsl() && wslWorks) {
    console.log("\n  Opening site in your Windows browser...\n");
    openInWindowsBrowser(localhostWorks ? localhostUrl : wslUrl);
    return;
  }

  console.log("");
}

module.exports = {
  isWsl,
  getLocalIPv4,
  isPortAvailable,
  announceDevUrls,
};
