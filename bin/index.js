#! /usr/bin/env node
const { existsSync, rmSync } = require('fs')
const { tmpPath, blockGitUrl } = require('./constant')
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
  confirmIsRemoveBlockName,
} = require('./utils/index')

const generateBlock = async (blockName) => {
  try {
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
  const start = async () => {
    try {
      await envCheck(process.argv[2])
      // const gitUrl = await getGitUrl()
      getBlockCode(blockGitUrl, process.argv[2])
      generateBlock(process.argv[2]).then()
    } catch (e) {
      if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true })
      process.exit(1)
    }
  }
  start().then()
} else {
  const start = async () => {
    try {
      await envCheck()
      // const gitUrl = await getGitUrl()
      const blockList = getBlockList(blockGitUrl)
      const blockName = await selectBlock(blockList)
      if (existsSync(blockName)) {
        const isOverWriteBlock = await confirmIsRemoveBlockName(blockName)
        if (isOverWriteBlock) {
          rmSync(blockName, { recursive: true })
        } else {
          process.exit(1)
        }
      }
      generateBlock(blockName).then()
    } catch (e) {
      if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true })
      process.exit(1)
    }
  }
  start().then()
}
