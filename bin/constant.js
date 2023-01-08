const path = require('path')
const config = {
  rootFolder: 'docs',
  demoFolder: 'demo',
}
const tmpPathName = 'tmp'
const tmpPath = path.join(process.cwd(), `./${tmpPathName}`)

module.exports = {
  config,
  tmpPathName,
  tmpPath,
}
