/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(
  /**真正的编译函数**/
  function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
    //生成AST抽象语法树
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    //标记静态节点
    optimize(ast, options)
  }
  //生成render属性和staticRenderFns组成的对象
  const code = generate(ast, options)
  return {
    ast,
    //render是字符串需要用new Function编译
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
