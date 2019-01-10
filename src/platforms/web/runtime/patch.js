/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
// 返回当前平台(web,weex,node)的模块,结合了baseModules
const modules = platformModules.concat(baseModules)
//运用了函数柯里化,对应不同平台(web,weex,node)执行不同的path函数
export const patch: Function = createPatchFunction({ nodeOps, modules })
