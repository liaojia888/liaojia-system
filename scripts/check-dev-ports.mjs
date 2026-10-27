import net from "node:net";

function probe(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.setTimeout(1500);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const p3000 = await probe(3000);
const p3001 = await probe(3001);

console.log(`localhost:3000 → ${p3000 ? "有程序在聽（dev 應在此）" : "無（請 npm run dev）"}`);
console.log(`localhost:3001 → ${p3001 ? "⚠ 仍有程序在聽（不應使用）" : "無（正常，3001 不應有 server）"}`);

if (p3001) process.exit(1);
