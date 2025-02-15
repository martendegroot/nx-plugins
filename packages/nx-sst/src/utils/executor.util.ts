import { exec } from "child_process"

import { SSTRunExecutorSchema } from "../executors/sst/schema"
import { ParsedExecutorInterface } from "../interfaces/parsed-executor.interface"
import { logger, workspaceRoot } from "@nx/devkit"

export const executorPropKeys = ["stacks"]
export const LARGE_BUFFER = 1024 * 1000000

export function parseArgs(options: SSTRunExecutorSchema): Record<string, string> {
  const keys = Object.keys(options)
  return keys
    .filter((prop) => executorPropKeys.indexOf(prop) < 0)
    .reduce((acc, key) => ((acc[key] = options[key]), acc), {})
}

export function createCommand(command: string, options: ParsedExecutorInterface): string {
  let sst: string
  if (options.polyfills && options.polyfills.length) {
    const a = ["node"]
    options.polyfills.forEach((pf) => {
      a.push(`-r ${pf}`)
    })
    a.push(`${workspaceRoot}/node_modules/sst/cli/sst.js`)
    sst = a.join(" ")
  } else {
    sst = "sst"
  }
  const commands = [`${sst} ${command}`]

  for (const arg in options.parseArgs) {
    commands.push(`--${arg} ${options.parseArgs[arg]}`)
  }

  if (options.stacks && options.stacks.length) {
    commands.push(options.stacks.join(" "))
  }

  return commands.join(" ")
}

export function runCommandProcess(command: string, cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    logger.debug(`Executing command: ${command}`)

    const childProcess = exec(command, {
      maxBuffer: LARGE_BUFFER,
      env: process.env,
      cwd: cwd,
    })

    // Ensure the child process is killed when the parent exits
    const processExitListener = () => childProcess.kill()
    process.on("exit", processExitListener)
    process.on("SIGTERM", processExitListener)

    process.stdin.on("data", (data) => {
      childProcess.stdin.write(data)
      childProcess.stdin.end()
    })

    childProcess.stdout.on("data", (data) => {
      process.stdout.write(data)
    })

    childProcess.stderr.on("data", (err) => {
      process.stderr.write(err)
    })

    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve(true)
      } else {
        resolve(false)
      }

      process.removeListener("exit", processExitListener)

      process.stdin.removeListener("data", processExitListener)
    })
  })
}
