#! /usr/bin/env node
const { rm, mkdir, exec, cd, cp, mv } = require("shelljs");
const inquirer = require('inquirer');
const chalk = require('chalk');
const { writeFileSync, existsSync } = require("fs");
const ora = require('ora');
const glob = require('glob');
const path = require('path');
const config = require('./constant');
const { transform, getDependenciesFromFile, getPackageManager, getProjectDependencies } = require('./utils/index');

const projectDependencies = getProjectDependencies();
const argv = process.argv;
const blockName = argv[2];

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

const goInstallDependencies = (dependenciesList, callback) => {
    if (dependenciesList.length) {
        const packageManager = getPackageManager();
        const execStr = packageManager === 'yarn' ? 'add' : 'i';
        let spinner = ora({text: `代码片段相关依赖正在下载中...`, color: 'red', isEnabled: true}).start();
        exec(`${packageManager} ${execStr} ${dependenciesList.join('  ')}  --force`, async (code, stdout, stderr) => {
            if (code === 0) {
                spinner.succeed('代码片段相关依赖下载完成');
                callback && callback();
            } else {
                spinner.stop();
                console.log('Exit code:', code);
                console.log('Program output:', stdout);
                console.log('Program stderr:', stderr);
                process.exit(1)
            }
        });
    } else {
        callback && callback();
    }
}

const getInstallDependenciesList = (fileName, dependenciesFromPackageJson) => {
    const dependenciesFromFile = [];
    return new Promise((resolve) => {
        glob(`./${fileName}/**/*.js*`,  (err, files) => {
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

const generateBlock = async () => {
    const tmpPath = 'tmp';
    // 环境准备start
    let isJustGetCode = false;
    if (!existsSync('./index.jsx')) {
        isJustGetCode = await promptIsJustGetCode();
        if (!isJustGetCode) return false
    }
    if (existsSync(tmpPath)) {
        await rm('-rf', tmpPath);
    }
    if (existsSync(blockName)) {
        const isOverWriteBlock = await verifyIsRemoveBlockName(blockName);
        if (!isOverWriteBlock) return false
    }
    await rm('-rf', blockName);
    // 环境准备end

    await mkdir('-p', [tmpPath]);
    const gitSourceName = config.gitUrl.split('/').reverse()[0].split('.')[0];
    await cd(tmpPath);

    exec(`git clone ${config.gitUrl} --depth=1`, async (code, stdout, stderr) => {
        if (code === 0) {
            if (!existsSync(`${gitSourceName}/${config.rootFolder}/${blockName}`)) {
                ora({text: chalk.red(`${blockName} 片段不存在, 请检查片段名是否有误`), color: 'red', isEnabled: true}).fail();
                await cd(`../`);
                await rm('-rf', `${tmpPath}`);
                return false
            }

            const packageJsonPath = path.join(process.cwd(), `./${gitSourceName}/package.json`)
            const packageJson = require(packageJsonPath);
            const sourcePackageJson = {...packageJson.dependencies, ...packageJson.devDependencies};


            ora({text: `代码片段生成成功`, color: 'gray', isEnabled: true}).succeed();
            await rm('-rf', `../${gitSourceName}`);
            await cp('-R', [`${gitSourceName}/${config.rootFolder}/${blockName}/${config.demoFolder}/`], `../${blockName}`);
            await cd(`../`);
            await rm('-rf', `${tmpPath}`);
            // await mv(['demo'], blockName);
            const installDependencies = await getInstallDependenciesList(blockName, sourcePackageJson);
            const callback = () => {!isJustGetCode && insertInFile(blockName)};
            goInstallDependencies(Array.from(new Set(installDependencies)), callback)
        } else {
            await cd(`../`);
            await rm('-rf', `${tmpPath}`);
            console.log('Exit code:', code);
            console.log('Program output:', stdout);
            console.log('Program stderr:', stderr);
            process.exit(1)
        }
    });
}

if (blockName) {
    generateBlock().then();
} else {
    ora({text: chalk.red('请输入代码片段名称'), color: 'red', isEnabled: true}).fail();
    process.exit(1)
}