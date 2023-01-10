const path = require('path')
const config = {
  rootFolder: 'docs',
  demoFolder: 'demo',
}
const tmpPathName = 'tmp'
const tmpPath = path.join(process.cwd(), `./${tmpPathName}`)
const blockGitUrl = 'https://gitee.com/yitjhy/generate-block-static-site.git'

module.exports = {
  config,
  tmpPathName,
  tmpPath,
  blockGitUrl
}
