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

const gitUrlObj = {
  github: 'https://github.com/yitjhy/generate-block-static-site.git',
  gitee: 'https://gitee.com/yitjhy/block.git',
}
const projectDependencies = getProjectDependencies()
const argv = process.argv
const blockName = argv[2]
let gitUrl = argv[3]
let gitSourceName = gitUrl
const tmpPath = 'tmp'
if (gitUrl && Object.keys(gitUrlObj).includes(gitUrl)) gitUrl = gitUrlObj[gitUrl]
if (!gitUrl) gitUrl = gitUrlObj['github']
gitSourceName = gitUrl.split('/').reverse()[0].split('.')[0]

const verifyIsRemoveBlockName = async (blockName) => {
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

const promptIsJustGetCode = async () => {
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

const getInstallDependenciesList = (globPath, dependenciesFromPackageJson) => {
  const dependenciesFromFile = []
  glob.sync(globPath).map((file) => {
    dependenciesFromFile.push(...getDependenciesFromFile(path.join(process.cwd(), file)))
  })
  return Object.keys(dependenciesFromPackageJson).reduce((pre, cur) => {
    // if (dependenciesFromFile.includes(cur) && !Object.keys(projectDependencies).includes(cur)) {
    //   const dependenciesVersion = dependenciesFromPackageJson[cur].replace('^', '')
    //   pre.push(`${cur}@${dependenciesVersion}`)
    // }
    if (cur.includes('@types')) {
      if (
        dependenciesFromFile.includes(cur.split('/').slice(1).join('/')) &&
        !Object.keys(projectDependencies).includes(cur.split('/').slice(1).join('/'))
      ) {
        const dependenciesVersion = dependenciesFromPackageJson[cur].replace('^', '')
        pre.push(`${cur}@${dependenciesVersion}`)
      }
    }
    dependenciesFromFile.map((item) => {
      const dependenciesFromFilePrefix = item.split('/')[0]
      const projectDependenciesPrefix = cur.split('/')[0]
      if (
        projectDependenciesPrefix === dependenciesFromFilePrefix &&
        projectDependenciesPrefix !== '@types' &&
        !Object.keys(projectDependencies).includes(cur)
      ) {
        const dependenciesVersion = dependenciesFromPackageJson[cur].replace('^', '')
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
  ora({ text: `代码片段插入成功`, color: 'yellow', isEnabled: true }).succeed()
}

const fetchBlockCode = () => {
  let spinner = ora({ text: `代码片段正在生成中...`, color: 'red', isEnabled: true }).start()
  child_process.execSync(`git clone ${gitUrl} --depth=1 ${tmpPath}/${gitSourceName}`)
  if (!existsSync(`${tmpPath}/${gitSourceName}/${config.rootFolder}/${blockName}`)) {
    ora({ text: chalk.red(`${blockName} 片段不存在, 请检查片段名是否有误`), color: 'red', isEnabled: true }).fail()
    rmSync(tmpPath, { recursive: true })
    process.exit(1)
  }
  spinner.succeed('代码片段生成成功')
}

const getInstallDependencies = () => {
  const packageJsonPath = path.join(process.cwd(), `./${tmpPath}/${gitSourceName}/package.json`)
  const packageJson = require(packageJsonPath)
  const sourcePackageJson = { ...packageJson.dependencies, ...packageJson.devDependencies }
  const globTsTsxPath = `./${tmpPath}/${gitSourceName}/${config.rootFolder}/${blockName}/**/*.ts*`
  const globJsJsxPath = `./${tmpPath}/${gitSourceName}/${config.rootFolder}/${blockName}/**/*.js*`
  const tsDependenciesList = getInstallDependenciesList(globTsTsxPath, sourcePackageJson)
  const jsDependenciesList = getInstallDependenciesList(globJsJsxPath, sourcePackageJson)
  return Array.from(new Set([...tsDependenciesList, ...jsDependenciesList]))
}

const envCheck = async () => {
  const indexJsxPath = path.join(process.cwd(), './index.jsx')
  const indexTsxPath = path.join(process.cwd(), './index.tsx')
  if (!existsSync(indexJsxPath) && !existsSync(indexTsxPath)) {
    const isJustGetCode = await promptIsJustGetCode()
    if (!isJustGetCode) process.exit(1)
  }
  if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true })
  if (existsSync(blockName)) {
    const isOverWriteBlock = await verifyIsRemoveBlockName(blockName)
    if (isOverWriteBlock) {
      rmSync(blockName, { recursive: true })
    } else {
      process.exit(1)
    }
  }
}

const generateBlock = async () => {
  await envCheck()
  try {
    fetchBlockCode()
    const installDependencies = getInstallDependencies()
    cpSync(`${tmpPath}/${gitSourceName}/${config.rootFolder}/${blockName}/${config.demoFolder}/`, blockName, {
      recursive: true,
    })
    rmSync(tmpPath, { recursive: true })
    glob.sync(`./${blockName}/**/*.md`).map((filePath) => {
      rmSync(filePath, { recursive: true })
    })
    goInstallDependencies(installDependencies)
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
