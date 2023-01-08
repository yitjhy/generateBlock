const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const { readFileSync } = require('fs')

const getDependenciesFromFile = (filePath) => {
  const dependencies = []
  const code = readFileSync(filePath, 'utf-8')
  const ast = parser.parse(code, {
    sourceType: 'unambiguous',
    plugins: ['jsx', 'typescript'],
  })
  traverse(ast, {
    ImportDeclaration(path) {
      const requirePath = path.get('source').node.value
      if (!requirePath.startsWith('.')) {
        if (requirePath.startsWith('@')) {
          dependencies.push(requirePath)
        } else {
          if (requirePath.split('/').length > 1) {
            dependencies.push(requirePath.split('/')[0])
          } else {
            dependencies.push(requirePath)
          }
        }
      }
    },
  })
  return dependencies
}

module.exports = getDependenciesFromFile
