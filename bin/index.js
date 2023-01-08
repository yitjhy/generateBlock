#! /usr/bin/env node
const { existsSync, rmSync } = require('fs')
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
  getBlockList,
  selectBlock,
} = require('./utils/index')

const generateBlock = async (blockName) => {
  await envCheck(blockName)
  try {
    const gitUrl = await getGitUrl()
    getBlockCode(gitUrl, blockName)
    const installDependencies = getInstallDependencies(blockName)
    goInstallDependencies(installDependencies, blockName)
    syncCode(blockName)
    clearEnv(blockName)
    insertInFile(blockName)
  } catch (e) {
    if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true })
    process.exit(1)
  }
}

if (process.argv[2]) {
  generateBlock(process.argv[2]).then()
} else {
  const fn = async () => {
    const gitUrl = await getGitUrl()
    const blockList = getBlockList(gitUrl)
    const blockName = await selectBlock(blockList)
    generateBlock(blockName).then()
  }
  fn().then()
}
