#! /usr/bin/env node
const { cat, rm, mkdir, exec, cd, cp, mv } = require("shelljs");
const $ = require("gogocode");
const { writeFileSync } = require("fs");
const ora = require('ora');
const glob = require('glob');

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

const insertInFile = fileName => {
    let rootAst = $.loadFile('./index.jsx', {})
    if (rootAst) {
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
        writeFileSync('./index.jsx', newContent, 'utf-8');
        console.log('模块插入成功');
        goInstallDependencies(installDependencies)
    } else {
        console.log('当前目录下无index.jsx文件，无法向其插入代码');
    }
}

if (gitUrl) {
    generateBlock().then();
} else {
    console.log('请输入url地址');
}
