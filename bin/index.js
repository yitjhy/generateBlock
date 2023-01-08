#! /usr/bin/env node
const inquirer = require('inquirer')
const chalk = require('chalk')
const { writeFileSync, existsSync, cpSync, rmSync } = require('fs')
const ora = require('ora')
const glob = require('glob')
const path = require('path')
const child_process = require('child_process')
const config = require('./constant')
const { transform, getDependenciesFromFile, getPackageManager, getProjectDependencies } = require('./utils/index')

const tmpPath = 'tmp'
const blockName = process.argv[2]

const selectGitRepository = async () => {
  const { gitUrlBySelect } = await inquirer.prompt([
    {
      name: 'gitUrlBySelect',
      type: 'list',
      message: '选择仓库来源：',
      choices: ['github', 'gitee', '自定义'],
      default: 'gitee',
    },
  ])
  return gitUrlBySelect
}
const inputGitRepository = async () => {
  const { gitUrlByInput } = await inquirer.prompt([
    {
      name: 'gitUrlByInput',
      type: 'input',
      message: '输入仓库地址：',
    },
  ])
  return gitUrlByInput
}
const confirmIsRemoveBlockName = async (blockName) => {
  const { isOverWriteBlock } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'isOverWriteBlock',
      message: `当前文件夹已经有同名模块 ${chalk.red(blockName)}, 是否覆盖?`,
      default: false,
    },
  ])
  return isOverWriteBlock
}
const confirmIsJustGetCode = async () => {
  const { isJustGetCode } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'isJustGetCode',
      message: `当前目录下无 ${chalk.yellow('index.jsx')} 或 ${chalk.yellow(
        'index.tsx'
      )} 文件，无法向其插入代码, 继续则只获取片段代码, 是否继续?`,
      default: true,
    },
  ])
  return isJustGetCode
}

const goInstallDependencies = (dependenciesList) => {
  if (dependenciesList.length) {
    const packageManager = getPackageManager()
    const execStr = packageManager === 'yarn' ? 'add' : 'i'
    let spinner = ora({
      text: `代码片段相关依赖 ${chalk.yellow(dependenciesList.join(' '))} 正在下载中...`,
      color: 'red',
      isEnabled: true,
    }).start()
    child_process.execSync(`${packageManager} ${execStr} ${dependenciesList.join('  ')}  --force`)
    spinner.succeed(`代码片段相关依赖 ${chalk.yellow(dependenciesList.join(' '))} 下载完成`)
  }
}

const getInstallDependenciesList = (globPath, dependenciesFromSourcePackageJson) => {
  const dependenciesFromProjectPackageJson = getProjectDependencies()
  const dependenciesFromDemoFile = glob.sync(globPath).reduce((pre, file) => {
    pre.push(...getDependenciesFromFile(path.join(process.cwd(), file)))
    return pre
  }, [])
  return Object.keys(dependenciesFromSourcePackageJson).reduce((pre, cur) => {
    // if (dependenciesFromFile.includes(cur) && !Object.keys(dependenciesFromProjectPackageJson).includes(cur)) {
    //   const dependenciesVersion = dependenciesFromSourcePackageJson[cur].replace('^', '')
    //   pre.push(`${cur}@${dependenciesVersion}`)
    // }
    if (cur.includes('@types')) {
      if (
        dependenciesFromDemoFile.includes(cur.split('/').slice(1).join('/')) &&
        !Object.keys(dependenciesFromProjectPackageJson).includes(cur.split('/').slice(1).join('/'))
      ) {
        const dependenciesVersion = dependenciesFromSourcePackageJson[cur].replace('^', '')
        pre.push(`${cur}@${dependenciesVersion}`)
      }
    }
    dependenciesFromDemoFile.map((item) => {
      const dependenciesFromFilePrefix = item.split('/')[0]
      const projectDependenciesPrefix = cur.split('/')[0]
      if (
        projectDependenciesPrefix === dependenciesFromFilePrefix &&
        projectDependenciesPrefix !== '@types' &&
        !Object.keys(dependenciesFromProjectPackageJson).includes(cur)
      ) {
        const dependenciesVersion = dependenciesFromSourcePackageJson[cur].replace('^', '')
        pre.push(`${cur}@${dependenciesVersion}`)
      }
    })
    return pre
  }, [])
}

const insertInFile = (fileName) => {
  const indexJsxPath = path.join(process.cwd(), './index.jsx')
  const indexTsxPath = path.join(process.cwd(), './index.tsx')
  let transformPath = indexJsxPath
  if (existsSync(indexTsxPath)) transformPath = indexTsxPath
  const code = transform(fileName, transformPath)
  writeFileSync(transformPath, code, 'utf-8')
  ora({ text: `代码片段 ${chalk.yellow(blockName)} 插入成功`, color: 'yellow', isEnabled: true }).succeed()
}

const fetchBlockCode = (gitUrl) => {
  let spinner = ora({
    text: `代码片段 ${chalk.yellow(blockName)} 正在生成中...`,
    color: 'red',
    isEnabled: true,
  }).start()
  child_process.execSync(`git clone ${gitUrl} --depth=1 ${tmpPath}`)
  if (!existsSync(`${tmpPath}/${config.rootFolder}/${blockName}`)) {
    ora({ text: chalk.red(`${blockName} 片段不存在, 请检查片段名是否有误`), color: 'red', isEnabled: true }).fail()
    rmSync(tmpPath, { recursive: true })
    process.exit(1)
  }
  spinner.succeed(`代码片段 ${chalk.yellow(blockName)} 生成成功`)
}

const getInstallDependencies = () => {
  const sourcePackageJsonPath = path.join(process.cwd(), `./${tmpPath}/package.json`)
  const sourcePackageJson = require(sourcePackageJsonPath)
  const dependenciesFromPackageJson = { ...sourcePackageJson.dependencies, ...sourcePackageJson.devDependencies }
  const globTsTsxPath = `./${tmpPath}/${config.rootFolder}/${blockName}/**/*.ts*`
  const globJsJsxPath = `./${tmpPath}/${config.rootFolder}/${blockName}/**/*.js*`
  const tsDependenciesList = getInstallDependenciesList(globTsTsxPath, dependenciesFromPackageJson)
  const jsDependenciesList = getInstallDependenciesList(globJsJsxPath, dependenciesFromPackageJson)
  return Array.from(new Set([...tsDependenciesList, ...jsDependenciesList]))
}

const envCheck = async () => {
  const indexJsxPath = path.join(process.cwd(), './index.jsx')
  const indexTsxPath = path.join(process.cwd(), './index.tsx')
  if (!existsSync(indexJsxPath) && !existsSync(indexTsxPath)) {
    const isJustGetCode = await confirmIsJustGetCode()
    if (!isJustGetCode) process.exit(1)
  }
  if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true })
  if (existsSync(blockName)) {
    const isOverWriteBlock = await confirmIsRemoveBlockName(blockName)
    if (isOverWriteBlock) {
      rmSync(blockName, { recursive: true })
    } else {
      process.exit(1)
    }
  }
}

const getGitUrl = async () => {
  const gitRepositoryObj = {
    github: 'https://github.com/yitjhy/generate-block-static-site.git',
    gitee: 'https://gitee.com/yitjhy/block.git',
  }
  const gitUrlBySelect = await selectGitRepository()
  let gitUrl = gitRepositoryObj[gitUrlBySelect]
  if (gitUrl === '自定义') gitUrl = await inputGitRepository()
  return gitUrl
}

const clearEnv = () => {
  rmSync(tmpPath, { recursive: true })
  glob.sync(`./${blockName}/**/*.md`).map((filePath) => {
    rmSync(filePath, { recursive: true })
  })
}

const syncCode = () => {
  cpSync(`${tmpPath}/${config.rootFolder}/${blockName}/${config.demoFolder}/`, blockName, {
    recursive: true,
  })
}

const generateBlock = async () => {
  await envCheck()
  try {
    const gitUrl = await getGitUrl()
    fetchBlockCode(gitUrl)
    const installDependencies = getInstallDependencies()
    goInstallDependencies(installDependencies)
    syncCode()
    clearEnv()
    insertInFile(blockName)
  } catch (e) {
    if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true })
    process.exit(1)
  }
}

if (blockName) {
  generateBlock().then()
} else {
  ora({ text: chalk.red('请输入代码片段名称'), color: 'red', isEnabled: true }).fail()
  process.exit(1)
}
