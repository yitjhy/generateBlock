#! /usr/bin/env node
const shell = require('shelljs');

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
        } else {
            console.log('Exit code:', code);
            console.log('Program output:', stdout);
            console.log('Program stderr:', stderr);
        }
    });
}

if (gitUrl) {
    generateBlock();
} else {
    console.log('请输入url地址');
}
