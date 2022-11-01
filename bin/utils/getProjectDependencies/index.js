const fs = require('fs');
const path = require('path');

const getProjectDependencies = () => {
    let relPath = 'package.json';
    let sourcePackageJson = {};
    let findNumber = 0;
    const getPath = rPath => path.resolve(process.cwd(), rPath);
    while (!fs.existsSync(getPath(relPath))) {
        findNumber++;
        relPath = `../${relPath}`;
        if (findNumber === 10) {
            break;
        }
    }
    const packagejsonPath = getPath(relPath);
    if (fs.existsSync(packagejsonPath)) {
        const packageJson = require(packagejsonPath);
        sourcePackageJson = {...packageJson.dependencies, ...packageJson.devDependencies};
    }
    return sourcePackageJson
}

module.exports = getProjectDependencies