#! /usr/bin/env node
const shell = require('shelljs');
const { cat } = require("shelljs");
const $ = require("gogocode");
const { writeFileSync } = require("fs");
const ora = require('ora');

const copyFolder = 'bin';
const argv = process.argv;
let gitUrl = argv[2];
const generateBlock = async () => {
    const dirPath = 'tmp';
    await shell.rm('-rf', dirPath);
    await shell.mkdir('-p', [dirPath]);
    const fileName = gitUrl.split('/').reverse()[0].split('.')[0];
    await shell.cd(dirPath);
    shell.exec(`git clone ${gitUrl}`, async (code, stdout, stderr) => {
        if (code === 0) {
            console.log('模块生成成功');
            await shell.rm('-rf', `../${fileName}`);
            await shell.cp('-R', [`${fileName}/bin/`],`../`);
            await shell.cd(`../`);
            await shell.mv([copyFolder], fileName);
            await shell.rm('-rf', `${dirPath}`);
            writeInParseFile(fileName)
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

const haveImport = (code, targetBlock) => {
    let flag = false
    code
        .find(`import $_$1 from "$_$2"`)
        .each(item => {
            if(item.match[2][0].value === `./${targetBlock}`) {
                flag = true
            }
        })
    return flag
}

const installDependencies = dependenciesList => {
    const spinner = ora({text: `模块相关依赖正在下载中...\n`, color: 'red'});
    spinner.start();
    shell.exec(`npm install ${dependenciesList.join('  ')} --save`, async (code, stdout, stderr) => {
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

const judgeIsDependencies = depStr => {
    const reg = new RegExp(/^[a-zA-Z]*$/g);
    if (reg.test(depStr.split('')[0])) return depStr
}

const writeInParseFile = fileName => {
    const targetContent = cat('./App.jsx').stdout;
    if (targetContent) {
        let newContent = '';
        const dependencies = [];
        let rootAst = $(targetContent).replace(`<UIFlag />`, `<${ToUpperCase(fileName)} />`).root();
        if (haveImport(rootAst, fileName)) {
            newContent = rootAst.generate();
        } else {
            const importAst = rootAst.find(`import $_$0 from '$_$1'`);
            rootAst.find(`import $_$name from '$_$source'`).each((importNode, index) => {
                if (importAst.length -1  === index) {
                    newContent = importNode.after(`import ${ToUpperCase(fileName)} from './${fileName}'; \n`).root().generate();
                }
                const depend = judgeIsDependencies(importNode.match['source'][0].value)
                dependencies.push(depend)
            })
        }
        writeFileSync('./index2.jsx', newContent, 'utf-8');
        console.log('模块插入成功');
        installDependencies(dependencies)
    } else {
        console.log('当前目录下无index.jsx文件，无法向其插入代码');
    }
}

if (gitUrl) {
    generateBlock().then();
} else {
    console.log('请输入url地址');
}
