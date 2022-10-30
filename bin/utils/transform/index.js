const { transformFileSync } = require('@babel/core');
const generatePlugin = require('./plugin/generate-plugin.js');
// const highlight = require("@babel/highlight").default;

const insertFn = (insertFileName, codes) => {
    const { code } = transformFileSync(codes, {
        plugins: [[generatePlugin, {
            insertFileName: insertFileName
        }]],
        parserOpts: {
            sourceType: 'unambiguous',
            plugins: ['jsx']       
        }
    });
    // console.log(highlight(code, { forceColor: true }));
    return code
}
// insertFn('drag', './sourceCode.js')
module.exports = insertFn;