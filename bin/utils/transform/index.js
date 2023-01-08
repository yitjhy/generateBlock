const { transformFileSync } = require('@babel/core')
const generatePlugin = require('./plugin/generate-plugin.js')

const insertFn = (insertFileName, codes) => {
  const { code } = transformFileSync(codes, {
    plugins: [
      [
        generatePlugin,
        {
          insertFileName: insertFileName,
        },
      ],
    ],
    parserOpts: {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript'],
    },
  })
  return code
}
module.exports = insertFn
