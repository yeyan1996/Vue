/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'

// Regular Expressions for parsing tags and attributes
//属性的正则
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

//HTML解析器
export function parseHTML (html, options) {

  /**通过一个栈的结构来匹配是否正确闭合标签**/
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    //父元素不能是一个纯文本内容（script/style/textarea）
    if (!lastTag || !isPlainTextElement(lastTag)) {
      //textEnd会匹配"<"符号的位置
      let textEnd = html.indexOf('<')
      /**模版只有4种情况
       * 1：开始标签（"<"开头）
       * 2：闭合标签（"<"开头）
       * 3：文本节点（非"<"开头，或者含有"<"开头但是不符合开始/闭合的正则匹配的文本）
       * 4：注释/文档/环境注释节点（"<"开头）
       * **/
      //上个">"符号到下个"<"符号之间的间隔是0，代表是一个非文本节点("<ul><li>") ("<ul>abc</ul>")
      //有可能是一个含有"<"的文本节点，也会执行下面逻辑，但不会进入任何一个钩子，会继续执行到处理文本节点的逻辑
      if (textEnd === 0) {
        // 注释节点（<!-- abc>）
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            //根据传入的配置项选择是否保留注释节点（执行注释节点的钩子）
            if (options.shouldKeepComment) {
              options.comment(html.substring(4, commentEnd))
            }
            //跳过注释节点将template字符串向后移动3位('-->')继续解析后面的字符串
            advance(commentEnd + 3)
            continue
          }
        }

        //判断浏览器环境的注释(<!--[if !IE]>-->)不会执行任何钩子，保留
        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // 文档
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        //匹配结束标签
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        //startTagMatch返回一个attrs属性，保存当前开始标签的每个属性match正则后返回的值（数组）组成的二维数组
        //以及tagName，end/start的位置
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          //处理startTagMatch
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next

      //文本节点/换行符
      if (textEnd >= 0) {
        //rest为下个"<"符号到结束的模版字符串
        rest = html.slice(textEnd)
        //判断rest是否是一个标签作为开头(而不是文本节点中含有"<"字符串)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          //处理在文本节点中的"<"符号，vue会把他当作一个文本继续往前选择文本节点
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          //继续搜索是否有下一个文本节点的"<"
          rest = html.slice(textEnd)
        }
        //返回正确的完整的文本节点
        text = html.substring(0, textEnd)
        advance(textEnd)
      }

      if (textEnd < 0) {
        text = html
        html = ''
      }
      //处理文本节点（执行文本节点的钩子）
      if (options.chars && text) {
        options.chars(text)
      }
    } else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  //截断html，index向前移动n位
  //@see https://ustbhuangyi.github.io/vue-analysis/compile/parse.html#%E6%95%B4%E4%BD%93%E6%B5%81%E7%A8%8B
  function advance (n) {
    index += n
    html = html.substring(n)
  }

  //匹配开始标签,将开始标签的所有属性放入match数组
  function parseStartTag () {
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      //匹配当前标签的所有属性
      while (/*尝试匹配">"并赋值给end*/!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        //依次前进
        advance(attr[0].length)
        //将属性放入match.attrs数组中
        match.attrs.push(attr)
      }
      if (end) {
        //如果是自闭合标签unarySlash属性为"/"（捕获组捕获到"/"）
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  //处理startTagMatch(整理/格式化属性值,放入栈)
  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {
      //p标签内不能放入的元素(p标签里不能放div元素,header,body,.........)
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        //直接闭合p标签(最后会多一个</p>,但parseEndTag对特殊的闭合标签做了处理使得能够正确闭合)
        parseEndTag(lastTag)
      }
      //允许只有一个开始标签的标签
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        //手动生成一个闭合标签
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || !!unarySlash

    //格式化attrs数组，返回一个对象数组
    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      //args为标签中某个属性表达式match正则返回的数组
      //args[0]是整个表达式exp，args[1]为属性,args[2]为等号符号
      //args[3]保存着当前属性的值（没有就依次往后推移）

      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      //将属性和值作为对象保存在attrs数组中用来之后创建当前节点的AST对象
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
    }
    //推入栈作为起始标签
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }

    //执行开始标签的钩子，生成AST节点
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      //将这个闭合标签匹配栈顶的元素
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      //判断是否正确闭合标签
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`
          )
        }
        //执行闭合标签的钩子函数，建立父子关系
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      //手动创建一个开始标签闭合这个p标签
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
