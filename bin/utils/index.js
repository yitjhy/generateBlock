const transform = require('./transform/index')
const getDependenciesFromFile = require('./getDependenciesFromFile/index')
const getPackageManager = require('./getPackageManager/index')
const getProjectDependencies = require('./getProjectDependencies/index')

module.exports = {
  transform,
  getDependenciesFromFile,
  getPackageManager,
  getProjectDependencies,
}
