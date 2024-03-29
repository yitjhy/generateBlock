const { declare } = require('@babel/helper-plugin-utils')
// const importModule = require('@babel/helper-module-imports');

const ToUpperCase = (str) => {
  let res
  if (str.indexOf('-') !== -1) {
    const arr = str.split('-')
    res = arr.reduce((pre, cur) => {
      pre += cur.slice(0, 1).toUpperCase() + cur.slice(1)
      return pre
    }, '')
  } else {
    res = str.slice(0, 1).toUpperCase() + str.slice(1)
  }
  return res
}

const generatePlugin = declare((api, options, dirname) => {
  return {
    visitor: {
      Program: {
        enter(path, state) {
          path.traverse({
            ImportDeclaration(curPath) {
              const requirePath = curPath.get('source').node.value
              if (requirePath === `./${options.insertFileName}`) {
                const specifierPath = curPath.get('specifiers.0')
                if (specifierPath.isImportSpecifier() || specifierPath.isImportDefaultSpecifier()) {
                  state.componentName = specifierPath.toString()
                } else if (specifierPath.isImportNamespaceSpecifier()) {
                  state.componentName = specifierPath.get('local').toString()
                }
                // path.stop();
              }
            },
            JSXElement(curPath) {
              const elementLabel = curPath.get('openingElement').get('name').toString()
              if (elementLabel === state.componentName) {
                state.hadInsertComponent = true
              }
            },
          })

          if (!state.componentName) {
            // 生成唯一的组件名 start
            const baseComponentName = ToUpperCase(options.insertFileName)
            let componentName = baseComponentName
            let index = 1
            const { bindings } = path.scope
            while (Object.keys(bindings).includes(componentName)) {
              index++
              componentName = `${baseComponentName}${index}`
            }
            // 生成唯一的组件名 end

            const importAst = api.template.ast(`import ${componentName} from "./${options.insertFileName}/demo"`)
            path.node.body.unshift(importAst)
            state.componentName = componentName
          }

          path.traverse({
            JSXElement(curPath) {
              const elementLabel = curPath.get('openingElement').get('name').toString()
              if (elementLabel === state.componentName) {
                state.hadInsertComponent = true
              }
              if (elementLabel === 'UIFlag') {
                state.hadUIFlag = true
              }
            },
          })

          // 如果没被使用并且没有 UIFlag 则在首行插入
          if (!state.hadInsertComponent && !state.hadUIFlag) {
            path.traverse({
              JSXElement(path) {
                if (path.parentPath.isReturnStatement()) {
                  const componentAst = api.template.expression(`<${state.componentName} />`, { plugins: ['jsx'] })()
                  const brAst = api.types.jSXText('\n        ')
                  path.node.children.unshift(brAst, componentAst)
                }
              },
              JSXFragment(path) {
                if (path.parentPath.isReturnStatement()) {
                  const componentAst = api.template.expression(`<${state.componentName} />`, { plugins: ['jsx'] })()
                  const brAst = api.types.jSXText('\n        ')
                  path.node.children.unshift(brAst, componentAst)
                }
              },
            })
          }
        },
      },
      JSXElement(path, state) {
        const elementLabel = path.get('openingElement').get('name').toString()
        if (elementLabel === 'UIFlag') {
          const componentAst = api.template.expression(`<${state.componentName} />`, { plugins: ['jsx'] })()
          path.replaceWith(componentAst)
        }
      },
    },
  }
})

module.exports = generatePlugin
