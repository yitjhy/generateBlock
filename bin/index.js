#! /usr/bin/env node
const { cat, rm, mkdir, exec, cd, cp, mv } = require("shelljs");
const inquirer = require('inquirer');
const chalk = require('chalk');
const $ = require("gogocode");
const { writeFileSync, existsSync } = require("fs");
const ora = require('ora');
const glob = require('glob');
const acorn = require("acorn");
const jsx = require("acorn-jsx");
const config = require('./constant');
const parser = acorn.Parser.extend(jsx());

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

const getDependenciesFromPackageJson = fileName => {
    if (!existsSync(`${fileName}/package.json`)) {
        ora({text: chalk.yellow(`代码块中${fileName}/package.json 不存在, 无法自动解析代码块依赖, 可能需要手动下载代码块依赖`), color: 'yellow', isEnabled: true}).warn();
        return []
    }
    const packageJsonStr = cat(`${fileName}/package.json`).stdout;
    const dependenciesSource= ['dependencies', 'peerDependencies', 'devDependencies']
    const packageJson = JSON.parse(packageJsonStr);
    return dependenciesSource.reduce((pre, cur) => {
        if (packageJson[cur]) return [...pre, ...Object.keys(packageJson[cur])];
        return pre
    }, [])
}

const ToUpperCase = str => {
    let res;
    if (str.indexOf('-') !== -1) {
        const arr = str.split('-');
        res = arr.reduce((pre, cur) => {
            pre += cur.slice(0,1).toUpperCase() +cur.slice(1);
            return pre
        }, '');
    } else {
        res = str.slice(0,1).toUpperCase() +str.slice(1);
    }
    return res
}

const haveImport = (ast, targetBlock) => {
    let flag = false
    ast
        .find(`import "$_$source"`)
        .each(item => {
            if(item.match['source'][0].value === `./${targetBlock}`) {
                flag = true
            }
        })
    return flag
}

const goInstallDependencies = (dependenciesList, callback) => {
    let spinner = ora({text: `代码片段相关依赖正在下载中...`, color: 'red', isEnabled: true}).start();
    exec(`npm install ${dependenciesList.join('  ')}  --save`, async (code, stdout, stderr) => {
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
}

const getDependenciesFromFile = rootAst => {
    const dependenciesFromFile = [];
    rootAst.find(`import $_$name from '$_$source'`).each(importNode => {
        const dependencies = importNode.match['source'][0].value;
        dependenciesFromFile.push(dependencies)
    })
    rootAst.find(`import { $_$name } from '$_$source'`).each(importNode => {
        const dependencies = importNode.match['source'][0].value;
        dependenciesFromFile.push(dependencies)
    })
    rootAst.find(`import '$_$source'`).each(importNode => {
        const dependencies = importNode.match['source'][0].value;
        dependenciesFromFile.push(dependencies)
    })
    return Array.from(new Set(dependenciesFromFile))
}

const getInstallDependenciesList = (fileName, dependenciesFromPackageJson) => {
    const dependenciesFromFile = [];
    return new Promise((resolve) => {
        glob(`./${fileName}/**/*.js*`,  (err, files) => {
            files.forEach(file => {
                dependenciesFromFile.push(...getDependenciesFromFile($.loadFile(file, {})))
            })
            const installDependencies = dependenciesFromFile.filter(dependencies => dependenciesFromPackageJson.some(dependencies2 => dependencies2 === dependencies));
            resolve(installDependencies);
        })
    })
}

const insertComponentAst = (rootAst, componentName) => {
    const exportDefaultAst = rootAst.find(`export default $_$exportDefaultName`);
    const exportDefaultName = exportDefaultAst['0'].match['exportDefaultName'][0].value;

    const functionDeclarationAst = rootAst.find(`function $_$funcName () {$_$return}`);
    const varExpressionFnAst = rootAst.find(`const $_$funcName = () => "$_$return"`);
    let isInVarExpressionFn = true;
    [functionDeclarationAst, varExpressionFnAst].forEach((fnAst, fnAstIndex) => {
        fnAst.each(item => {
            const funcName = item.match['funcName'][0].value;
            if (exportDefaultName === funcName) {
                const insertComponentNodeAst = parser.parse(`<${ToUpperCase(componentName)} />`).body[0].expression;
                const brAst = parser.parse(`<>
</>`).body[0].expression.children[0];
                fnAstIndex === 0 ? isInVarExpressionFn = false : isInVarExpressionFn = true;
                const returnBody = item[0].match['return'][0].node.body;
                const length = returnBody.length;
                // TODO 后面要根据类型去判断
                const returnChildrenAst = returnBody[length - 1]['argument'].children;
                for (let i = 0; i < returnChildrenAst.length; i++ ) {
                    if (returnChildrenAst[i].type === "JSXElement") {
                        returnChildrenAst.splice(i + 1, 0, brAst, insertComponentNodeAst);
                        i += 2;
                    }
                }
                returnChildrenAst.unshift(brAst, insertComponentNodeAst);
            }
        })
    })

    if (isInVarExpressionFn) return varExpressionFnAst.root();
    return functionDeclarationAst.root()
}

const insertInFile = fileName => {
    let newContent = '';
    let rootAst = $.loadFile('./index.jsx', {});

    rootAst = insertComponentAst(rootAst, fileName);

    rootAst = rootAst.replace(`<UIFlag />`, `<${ToUpperCase(fileName)} />`).root();
    if (haveImport(rootAst, fileName)) {
        newContent = rootAst.generate();
    } else {
        const importAst = rootAst.find(`import '$_$source'`);
        importAst.each((importNode, index) => {
            if (importAst.length - 1  === index) {
                newContent = importNode.after(`import ${ToUpperCase(fileName)} from './${fileName}'; \n`).root().generate();
            }
        })
    }
    writeFileSync('./index.jsx', newContent, 'utf-8');
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
    exec(`git clone ${config.gitUrl}`, async (code, stdout, stderr) => {
        if (code === 0) {
            if (!existsSync(`${gitSourceName}/${config.rootFolder}/${blockName}`)) {
                ora({text: chalk.red(`${blockName} 片段不存在, 请检查片段名是否有误`), color: 'red', isEnabled: true}).fail();
                await cd(`../`);
                await rm('-rf', `${tmpPath}`);
                return false
            }
            ora({text: `代码片段生成成功`, color: 'gray', isEnabled: true}).succeed();
            const dependenciesFromPackageJson = getDependenciesFromPackageJson(`${gitSourceName}/${config.rootFolder}/${blockName}`);
            await rm('-rf', `../${gitSourceName}`);
            await cp('-R', [`${gitSourceName}/${config.rootFolder}/${blockName}/${config.demoFolder}/`], `../${blockName}`);
            await cd(`../`);
            await rm('-rf', `${tmpPath}`);
            // await mv(['demo'], blockName);
            const installDependencies = await getInstallDependenciesList(blockName, dependenciesFromPackageJson);
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