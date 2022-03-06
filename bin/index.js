#! /usr/bin/env node
const { cat, rm, mkdir, exec, cd, cp, mv } = require("shelljs");
const $ = require("gogocode");
const { writeFileSync, existsSync } = require("fs");
const ora = require('ora');
const glob = require('glob');
const acorn = require("acorn");
const jsx = require("acorn-jsx");

const parser = acorn.Parser.extend(jsx());

const copyFolder = 'src';
const argv = process.argv;
let gitUrl = argv[2];

let dependenciesFromPackageJson = [];
let installDependencies = [];

const getDependenciesFromPackageJson = fileName => {
    const packageJsonStr = cat(`${fileName}/package.json`).stdout;
    const dependenciesSource= ['dependencies', 'peerDependencies', 'devDependencies']
    const packageJson = JSON.parse(packageJsonStr);
    return dependenciesSource.reduce((pre, cur) => {
        if (packageJson[cur]) return [...pre, ...Object.keys(packageJson[cur])];
        return pre
    }, [])
}

const generateBlock = async () => {
    const dirPath = 'tmp';
    await rm('-rf', dirPath);
    await mkdir('-p', [dirPath]);
    const fileName = gitUrl.split('/').reverse()[0].split('.')[0];
    await cd(dirPath);
    exec(`git clone ${gitUrl}`, async (code, stdout, stderr) => {
        if (code === 0) {
            console.log('模块生成成功');
            dependenciesFromPackageJson = getDependenciesFromPackageJson(fileName);
            await rm('-rf', `../${fileName}`);
            await cp('-R', [`${fileName}/${copyFolder}/`], `../`);
            await cd(`../`);
            await mv([copyFolder], fileName);
            await rm('-rf', `${dirPath}`);

            installDependencies = await getInstallDependenciesList(fileName);

            insertInFile(fileName)
        } else {
            console.log('Exit code:', code);
            console.log('Program output:', stdout);
            console.log('Program stderr:', stderr);
            process.exit(1)
        }
    });
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

const goInstallDependencies = dependenciesList => {
    const spinner = ora({text: `模块相关依赖正在下载中...\n`, color: 'red'}).start();
    exec(`npm install ${dependenciesList.join('  ')}  --save`, async (code, stdout, stderr) => {
        spinner.stop();
        if (code === 0) {
            console.log('模块相关依赖下载成功');
        } else {
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

const getInstallDependenciesList = fileName => {
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
    if (!existsSync('./index.jsx')) {
        console.log('当前目录下无index.jsx文件，无法向其插入代码');
        process.exit(1)
        return false
    }
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
    console.log('模块插入成功');
    goInstallDependencies(installDependencies)
}

if (gitUrl) {
    generateBlock().then();
} else {
    console.log('请输入url地址');
    process.exit(1)
}