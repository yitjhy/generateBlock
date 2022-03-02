#! /usr/bin/env node
const shell = require('shelljs');
const { cat } = require("shelljs");
const $ = require("gogocode");
const { writeFileSync } = require("fs");

const copyFolder = 'bin';
const argv = process.argv;
let gitUrl = argv[2];
const generateBlock = () => {
    const dirPath = 'tmp';
    shell.rm('-rf', dirPath);
    shell.mkdir('-p', [dirPath]);
    const fileName = gitUrl.split('/').reverse()[0].split('.')[0];
    shell.cd(dirPath);
    shell.exec(`git clone ${gitUrl}`, (code, stdout, stderr) => {
        if (code === 0) {
            console.log('模块生成成功');
            shell.rm('-rf', `../${fileName}`);
            shell.cp('-R', [`${fileName}/bin/`],`../`);
            shell.cd(`../`);
            shell.mv([copyFolder], fileName);
            shell.rm('-rf', `${dirPath}`);
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

const writeInParseFile = fileName => {
    const targetContent = cat('./index.jsx').stdout;
    if (targetContent) {
        const newContent = $(targetContent).replace(`<UiFlag />`, `<${ToUpperCase(fileName)} />`)
            .root()
            .before(`import ${ToUpperCase(fileName)} from './${fileName}'; \n`)
            .generate()
        writeFileSync('./index.jsx', newContent, 'utf-8');
        console.log('模块插入成功');
    } else {
        console.log('当前目录下无index.jsx文件，无法向其插入代码');
    }
}

if (gitUrl) {
    generateBlock();
} else {
    console.log('请输入url地址');
}
