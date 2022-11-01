const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { cat } = require("shelljs");

const getDependenciesFromFile = filePath => {
    const dependentcies = [];
    const code = cat(filePath).stdout;
    const ast = parser.parse(code, {
        sourceType: 'unambiguous',
        plugins: ['jsx']
    });
    traverse(ast, {
        ImportDeclaration (path) {
            const requirePath = path.get('source').node.value;
            if (!requirePath.startsWith('.')) {
                if (requirePath.startsWith('@')) {
                    dependentcies.push(requirePath);
                } else {
                    if (requirePath.split('/').length > 1) {
                        dependentcies.push(requirePath.split('/')[0]);
                    } else {
                        dependentcies.push(requirePath);
                    }
                }
            }
        },
    });
    return dependentcies
}

module.exports = getDependenciesFromFile
