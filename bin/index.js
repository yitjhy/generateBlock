#! /usr/bin/env node
const { rm, mkdir, exec, cd, cp, mv } = require("shelljs");
const inquirer = require('inquirer');
const chalk = require('chalk');
const { writeFileSync, existsSync, cpSync } = require("fs");
const ora = require('ora');
const glob = require('glob');
const path = require('path');
const child_process = require('child_process');
const config = require('./constant');
const { transform, getDependenciesFromFile, getPackageManager, getProjectDependencies } = require('./utils/index');

const projectDependencies = getProjectDependencies();
const argv = process.argv;
const blockName = argv[2];
const gitSourceName = config.gitUrl.split('/').reverse()[0].split('.')[0];
const tmpPath = 'tmp';

const verifyIsRemoveBlockName = async blockName => {
    const { isOverWriteBlock } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'isOverWriteBlock',
            message: `当前文件夹已经有同名模块 ${chalk.red(blockName)}, 是否覆盖?`,
            default: false
        }
    ])
    return isOverWriteBlock
}

const promptIsJustGetCode = async () => {
    const { isJustGetCode } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'isJustGetCode',
            message: `当前目录下无index.jsx文件，无法向其插入代码, 继续则只获取片段代码, 是否继续?`,
            default: true
        }
    ])
    return isJustGetCode
}

const goInstallDependencies = dependenciesList => {
    if (dependenciesList.length) {
        const packageManager = getPackageManager();
        const execStr = packageManager === 'yarn' ? 'add' : 'i';
        let spinner = ora({text: `代码片段相关依赖正在下载中...`, color: 'red', isEnabled: true}).start();
        child_process.execSync(`${packageManager} ${execStr} ${dependenciesList.join('  ')}  --force`);
        spinner.succeed('代码片段相关依赖下载完成');
    }
}

const getInstallDependenciesList = (globPath, dependenciesFromPackageJson) => {
    const dependenciesFromFile = [];
    return new Promise((resolve) => {
        glob(globPath,  (err, files) => {
            files.forEach(file => {
                dependenciesFromFile.push(...getDependenciesFromFile(path.join(process.cwd(), file)))
            })
            const installDependencies = Object.keys(dependenciesFromPackageJson).reduce((pre, cur) => {
                if (dependenciesFromFile.includes(cur) && !Object.keys(projectDependencies).includes(cur)) {
                    const dependenciesVersion = dependenciesFromPackageJson[cur].replace('^', '');
                    pre.push(`${cur}@${dependenciesVersion}`);
                }
                return pre
            }, [])
            resolve(installDependencies);
        })
    })
}

const insertInFile = fileName => {
    const code = transform(fileName, path.join(process.cwd(), './index.jsx'));
    writeFileSync(path.join(process.cwd(), './index.jsx'), code, 'utf-8');
    ora({text: `代码片段插入成功`, color: 'yellow', isEnabled: true}).succeed();
}

const fetchBlockCode = () => {
    let spinner = ora({text: `代码片段正在生成中...`, color: 'red', isEnabled: true}).start();
    child_process.execSync(`git clone ${config.gitUrl} --depth=1`);
    if (!existsSync(`${gitSourceName}/${config.rootFolder}/${blockName}`)) {
        ora({text: chalk.red(`${blockName} 片段不存在, 请检查片段名是否有误`), color: 'red', isEnabled: true}).fail();
        cd(`../`);
        rm('-rf', `${tmpPath}`);
        process.exit(1)
    }
    spinner.succeed('代码片段生成成功');
}

const getInstallDependencies = async () => {
    const packageJsonPath = path.join(process.cwd(), `./${gitSourceName}/package.json`)
    const packageJson = require(packageJsonPath);
    const sourcePackageJson = {...packageJson.dependencies, ...packageJson.devDependencies};

    const globPath = `./${gitSourceName}/${config.rootFolder}/${blockName}/**/*.js*`
    const installDependencies = await getInstallDependenciesList(globPath, sourcePackageJson);
    return installDependencies
}

const envCheck = async () => {
    if (!existsSync('./index.jsx')) {
        const isJustGetCode = await promptIsJustGetCode();
        if (!isJustGetCode) process.exit(1)
    }
    if (existsSync(tmpPath)) rm('-rf', tmpPath);
    if (existsSync(blockName)) {
        const isOverWriteBlock = await verifyIsRemoveBlockName(blockName);
        if (isOverWriteBlock) {
            rm('-rf', blockName);
        } else {
            console.log('333',333)
            process.exit(1)
        }
    }
}

const generateBlock = async () => {
    await envCheck();

    mkdir('-p', [tmpPath]);
    cd(tmpPath);

    try {
        fetchBlockCode();
        const installDependencies = await getInstallDependencies();
        cpSync(`${gitSourceName}/${config.rootFolder}/${blockName}/${config.demoFolder}/`, `../${blockName}`, {
            recursive: true
        });
        goInstallDependencies(Array.from(new Set(installDependencies)));
        cd(`../`);
        rm('-rf', `${tmpPath}`);
        insertInFile(blockName);
    } catch (e) {
        cd(`../`);
        rm('-rf', `${tmpPath}`);
        process.exit(1)
    }
}

if (blockName) {
    generateBlock().then();
} else {
    ora({text: chalk.red('请输入代码片段名称'), color: 'red', isEnabled: true}).fail();
    process.exit(1)
}