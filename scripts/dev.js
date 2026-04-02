const { spawn } = require("node:child_process")
const http = require("node:http")

const RENDERER_URL = "http://localhost:5173"
const MAX_WAIT_MS = 30000
const POLL_MS = 500

const children = []

function run(command) {
  const child = spawn(command, {
    shell: true,
    stdio: "inherit",
    env: process.env
  })

  children.push(child)
  return child
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM")
    }
  }
}

function waitForRenderer(url, timeoutMs) {
  const start = Date.now()

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume()
        resolve()
      })

      req.on("error", () => {
        if (Date.now() - start >= timeoutMs) {
          reject(new Error(`Renderer did not start at ${url} within ${timeoutMs}ms`))
          return
        }
        setTimeout(check, POLL_MS)
      })
    }

    check()
  })
}

async function main() {
  const renderer = run("npm run dev:renderer")

  renderer.on("exit", (code) => {
    if (code !== 0) {
      console.error(`Renderer exited with code ${code}`)
    }
    stopAll()
    process.exit(code ?? 1)
  })

  console.log("Waiting for renderer server...")
  await waitForRenderer(RENDERER_URL, MAX_WAIT_MS)
  console.log("Renderer is ready. Starting Electron...")

  const electron = run("npm run dev:electron")
  electron.on("exit", (code) => {
    stopAll()
    process.exit(code ?? 0)
  })
}

process.on("SIGINT", () => {
  stopAll()
  process.exit(0)
})

process.on("SIGTERM", () => {
  stopAll()
  process.exit(0)
})

main().catch((error) => {
  console.error(error.message)
  stopAll()
  process.exit(1)
})
