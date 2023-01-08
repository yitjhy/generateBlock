#! /usr/bin/env node
const chalk = require('chalk')
const { existsSync, rmSync } = require('fs')
const ora = require('ora')
const { tmpPath } = require('./constant')
const {
  getGitUrl,
  goInstallDependencies,
  insertInFile,
  getBlockCode,
  envCheck,
  clearEnv,
  syncCode,
  getInstallDependencies,
} = require('./utils/index')

const generateBlock = async () => {
  await envCheck()
  try {
    const gitUrl = await getGitUrl()
    getBlockCode(gitUrl)
    const installDependencies = getInstallDependencies()
    goInstallDependencies(installDependencies)
    syncCode()
    clearEnv()
    insertInFile(process.argv[2])
  } catch (e) {
    if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true })
    process.exit(1)
  }
}

if (process.argv[2]) {
  generateBlock().then()
} else {
  ora({ text: chalk.red('请输入代码片段名称'), color: 'red', isEnabled: true }).fail()
  process.exit(1)
}
