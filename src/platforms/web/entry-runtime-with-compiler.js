/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})
/**
 * 缓存了运行时版本定义的mount
 * 为的是让完整版和运行时解耦
 * 运行时只接受 render 函数，完整版本会将 template/外部 html/render 函数统一变成 render 函数再运行运行时版本
 * **/
const mount = Vue.prototype.$mount

// 完整构建版本的$mount(没有render函数会调用编译,最后再运行运行时版本的mount函数)
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // query方法将字符串形式的el变为一个dom节点(document.querySelector)
  el = el && query(el)

  // vue会覆盖挂载的节点,所以不能是body/html
  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  //优先使用render属性,没有就走下面逻辑
  if (!options.render) {
    let template = options.template
    if (template) {
      // 当template是字符串的时候(一般写的template模板字符串都会进入这个逻辑)
      if (typeof template === 'string') {
        //当template是以#开头,Vue会将它认为是一个id选择器,在HTML中寻找响应的DOM元素(一般为false)
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
        // 如果template是一个dom节点
      } else if (template.nodeType) {
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
      // 使用html作为模板时将template属性等于html形式(outerHTML即innerHTML+当前节点,返回的是一个字符串)
    } else if (el) {
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      /**没有render函数Vue会调用编译器从template中生成render函数*/
      //compileToFunctions定义在src/compiler/to-function.js:23
      const { render, staticRenderFns } = compileToFunctions(template, {
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments

      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  //最终执行runtime/index中的mount方法(即执行src/core/instance/lifecycle.js中mountComponent:155)
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    //创建一个div节点返回内部的innerHTML(outerHTML的polyfill)
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
