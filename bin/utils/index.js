const transform = require('./transform/index');
const getDependenciesFromFile = require('./getDependencies/index');
const getPackageManager = require('./getPackageManager/index');

module.exports = {
    transform,
    getDependenciesFromFile,
    getPackageManager
}