const fs = require('fs')
const path = require('path')

const getPackageManager = () => {
  let relPath = 'package.json'
  let packageManager = 'npm'
  let findNumber = 0
  const getPath = (rPath) => path.resolve(process.cwd(), rPath)
  while (!fs.existsSync(getPath(relPath))) {
    findNumber++
    relPath = `../${relPath}`
    if (findNumber === 10) {
      break
    }
  }
  const packagejsonPath = getPath(relPath)
  const noPackagejsonPathArr = packagejsonPath.split('/').reverse().slice(1).reverse()
  if (fs.existsSync(packagejsonPath)) {
    const yarnLockPath = [...noPackagejsonPathArr, 'yarn.lock'].join('/')
    const pnpmLockPath = [...noPackagejsonPathArr, 'pnpm-lock.yaml'].join('/')
    if (fs.existsSync(yarnLockPath)) packageManager = 'yarn'
    if (fs.existsSync(pnpmLockPath)) packageManager = 'pnpm'
  }
  return packageManager
}

module.exports = getPackageManager
