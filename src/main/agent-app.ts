import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const AGENT_APPS = new Set(['Codex', 'ChatGPT', 'Claude', 'T3 Code'])
const FRONTMOST_SCRIPT =
  'tell application "System Events" to get name of first application process whose frontmost is true'

export function isAgentApp(name: string): boolean {
  return AGENT_APPS.has(name)
}

/** Nieudany odczyt oznacza zwykle aplikacje, nie powod dyktowania. */
export async function frontmostIsAgent(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', FRONTMOST_SCRIPT], { timeout: 300 })
    return isAgentApp(stdout.trim())
  } catch {
    return false
  }
}
