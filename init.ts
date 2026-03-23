#!/usr/bin/env bun

import { existsSync, readFileSync, appendFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const HOME = homedir()
const AM_DIR = join(HOME, "am")

const ENV: Record<string, string> = {
  PATH: `${AM_DIR}/bin:$PATH`,
}

const SHELLS: Record<string, string> = {
  zsh: join(HOME, ".zshrc"),
  bash: join(HOME, ".bashrc"),
}

const shell = process.env.SHELL?.split("/").pop() ?? "zsh"
const rcFile = SHELLS[shell] ?? SHELLS.zsh

function exportLine(key: string, value: string): string {
  return `export ${key}="${value}"`
}

function alreadySet(rc: string, line: string): boolean {
  if (!existsSync(rc)) return false
  return readFileSync(rc, "utf8").includes(line)
}

console.log(`Configuring environment in ${rcFile}\n`)

const lines: string[] = []

for (const [key, value] of Object.entries(ENV)) {
  const line = exportLine(key, value)
  if (alreadySet(rcFile, line)) {
    console.log(`  already set: ${line}`)
  } else {
    appendFileSync(rcFile, `\n# am\n${line}\n`)
    lines.push(line)
    console.log(`  added: ${line}`)
  }
}

if (lines.length > 0) {
  console.log(`\nDone. Reload your shell or run:\n\n  source ${rcFile}\n`)
} else {
  console.log("\nNothing to do — already configured.")
}
