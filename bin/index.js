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
    const dependenciesFromPackageJson = dependenciesSource.reduce((pre, cur) => {
        if (packageJson[cur]) return [...pre, ...Object.keys(packageJson[cur])];
        return pre
    }, []);
    return dependenciesFromPackageJson
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
    let res = '';
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

    const exportDefaultAst = rootAst.find(`export default $_$exportDefaultName`)
    const exportDefaultName = exportDefaultAst['0'].match['exportDefaultName'][0].value

    const res6 = rootAst.find(`function $_$funcName () {}`);

    let targetFuncAst = null;
    res6.each(item => {
        const funcName = item.match['funcName'][0].value;
        console.log(11);
        console.log(funcName)
        if (exportDefaultName === funcName) {
            targetFuncAst = item;
        }
    })
    const res7 = rootAst.find(`const $_$funcName = () => "$_$return"`)

    res7.each(item => {
        const funcName = item.match['funcName'][0].value;
        if (exportDefaultName === funcName) {
            const length = item[0].match['return'][0].node.body.length;
            const returnChildrenAst = item[0].match['return'][0].node.body[length - 1]['argument'].children;
            for (let i = 0; i < returnChildrenAst.length; i++ ) {
                if (returnChildrenAst[i].type === "JSXElement") {
                    const uiFlagAst = parser.parse(`<${ToUpperCase(componentName)} />`).body[0].expression;
                    returnChildrenAst.splice(i + 1, 0, uiFlagAst);
                    i++;
                }
            }
            returnChildrenAst.unshift(parser.parse(`<${ToUpperCase(componentName)} />`).body[0].expression);
        }
    })
    return res7.root()
}

const insertInFile = fileName => {
    if (!existsSync('./App.jsx')) {
        console.log('当前目录下无index.jsx文件，无法向其插入代码');
        process.exit(1)
        return false
    }
    let rootAst = $.loadFile('./App.jsx', {});

    rootAst = insertComponentAst(rootAst, fileName);


    let newContent = '';
    rootAst = rootAst.replace(`<UIFlag />`, `<${ToUpperCase(fileName)} />`).root();
    if (haveImport(rootAst, fileName)) {
        newContent = rootAst.generate();
    } else {
        const importAst = rootAst.find(`import '$_$1'`);
        rootAst.find(`import '$_$source'`).each((importNode, index) => {
            if (importAst.length - 1  === index) {
                newContent = importNode.after(`import ${ToUpperCase(fileName)} from './${fileName}'; \n`).root().generate();
            }
        })
    }
    writeFileSync('./index2.jsx', newContent, 'utf-8');
    console.log('模块插入成功');
    goInstallDependencies(installDependencies)
}

if (gitUrl) {
    generateBlock().then();
} else {
    console.log('请输入url地址');
    process.exit(1)
}

// const res5 = $(source).find(`export default $_$value`)
// console.log(3333333)
// console.log(res5['0'].match['value'][0].value)
// const res6 = $(source).find(`function $_$() {}`)
// console.log(5555)
// console.log(res6)
// const res7 = $(source).find(`const $_$1 = () => "$_$2"`)
// console.log(7777)
// console.log(res7)
