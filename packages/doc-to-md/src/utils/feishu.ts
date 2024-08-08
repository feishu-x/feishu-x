import {
  addTabSpace,
  bold,
  bullet,
  codeBlock,
  divider,
  equation,
  heading,
  image,
  inlineCode,
  italic,
  link,
  quote,
  strikethrough,
  table,
  todo,
  underline,
} from './md'
import {
  IBlock,
  IBlockType,
  IBlockTypeText,
  out,
  ICodeStyle,
  codeLanguageMap,
  IBaseData,
  ITODOStyle,
  ITableData,
} from '@feishux/shared'
import { Transform, TransformPrams } from '../types'
import { EMOJIS, getEmojiChar } from './emoji'

export const _unsupported = (type: IBlockType) => {
  return ({ pageTitle }: TransformPrams) => {
    out.debug(`【${pageTitle}】存在暂不支持的块类型: ${IBlockTypeText[type]}`)
    return ''
  }
}

const getBaseTextValue = (pageTitle: string, baseData?: IBaseData) => {
  let str = ''
  baseData?.elements.forEach((item) => {
    if (item.text_run) {
      const textRun = item.text_run
      const textStyle = textRun.text_element_style
      let content = textRun.content
      if (textStyle.link) {
        // url 解码
        content = link(content, decodeURIComponent(textStyle.link.url))
        str += content
        // 跳出本次循环
        return
      }
      // 文字
      if (textStyle.bold) {
        // 加粗
        content = bold(content)
      }
      if (textStyle.underline) {
        // 下划线
        content = underline(content)
      }
      if (textStyle.italic) {
        // 斜体
        content = italic(content)
      }
      if (textStyle.strikethrough) {
        // 删除线
        content = strikethrough(content)
      }
      if (textStyle.inline_code) {
        // 行内代码
        content = inlineCode(content)
      }
      str += content
    } else if (item.equation) {
      // let content = textRun.content
      // 行内公式
      str += equation(item.equation.content)
    } else if (item.reminder) {
      // 日期提醒
      out.debug(`【${pageTitle}】存在暂不支持的块类型: 日期提醒`)
    } else {
      out.debug(`【${pageTitle}】存在暂不支持的块类型，已忽略`)
    }
  })
  return str
}

/**
 * 文字
 * @param block
 * @param pageTitle
 */
export const getTextValue = ({ block, pageTitle }: TransformPrams) => {
  return getBaseTextValue(pageTitle, block.text)
}

/**
 * 待办事项
 * @param block
 * @param pageTitle
 */
export const getTodoValue = ({ block, pageTitle }: TransformPrams) => {
  const todoStr = getBaseTextValue(pageTitle, block.todo)
  return todo(todoStr, (block.todo?.style as ITODOStyle)?.done)
}

/**
 * 无序列表
 * @param block
 * @param blocks
 * @param pageTitle
 */
export const getBulletValue = ({ block, blocks, pageTitle }: TransformPrams) => {
  let childrenStr = '\n'
  const childrenIds = block.children
  childrenIds?.forEach((id) => {
    const childBlock = blocks.find((item) => item.block_id === id) as IBlock
    childrenStr += addTabSpace(
      transform[childBlock.block_type]({ block: childBlock, blocks, pageTitle }),
      1,
    )
  })
  const bulletStr = getBaseTextValue(pageTitle, block.bullet)
  return bullet(bulletStr) + childrenStr
}

/**
 * 有序列表
 * @param block
 * @param blocks
 * @param pageTitle
 */
export const getOrderedValue = ({ block, blocks, pageTitle }: TransformPrams) => {
  let childrenStr = '\n'
  const childrenIds = block.children
  childrenIds?.forEach((id) => {
    const childBlock = blocks.find((item) => item.block_id === id) as IBlock
    childrenStr += addTabSpace(
      transform[childBlock.block_type]({ block: childBlock, blocks, pageTitle }),
      1,
    )
  })
  const orderedStr = getBaseTextValue(pageTitle, block.ordered)
  return bullet(orderedStr, 1) + childrenStr
}

/**
 * 标题
 * @param level
 */
export const getTitleValue = (level: number) => {
  return ({ block, pageTitle }: TransformPrams) => {
    const key = `heading${level}` as string
    // @ts-ignore
    const headingText = getBaseTextValue(pageTitle, block[key] as IBaseData)
    return heading(headingText, level)
  }
}

/**
 * 分割线
 */
export const getDividingValue = () => {
  return divider()
}

/**
 * 引用
 * @param block
 * @param blocks
 * @param pageTitle
 */
export const getQuoteValue = ({ block, blocks, pageTitle }: TransformPrams) => {
  if (block.block_type === IBlockType.quote) {
    const quoteStr = getBaseTextValue(pageTitle, block.quote)
    return quote(quoteStr)
  } else {
    const str = block.children
      ?.map((id, index) => {
        const childBlock = blocks.find((item) => item.block_id === id) as IBlock
        const childText = transform[childBlock.block_type]({ block: childBlock, blocks, pageTitle })
        if (index === 0 && block.block_type === IBlockType.callout && block.callout?.emoji_id) {
          const emoji = getEmojiChar(block.callout?.emoji_id as keyof typeof EMOJIS)
          return emoji + ' ' + childText
        }
        return childText
      })
      .join('\n') as string
    return quote(str)
  }
}

/**
 * 媒体
 * @param block
 */
export const getMediaValue = ({ block }: TransformPrams) => {
  return image('image', block.image?.token)
}

/**
 * 代码块
 * @param block
 */
export const getCodeValue = ({ block }: TransformPrams) => {
  const code = block.code

  // @ts-ignore
  const language = codeLanguageMap[(code.style as ICodeStyle).language]
  const text = code?.elements
    .map((item) => {
      return item.text_run.content
    })
    .join('')

  return codeBlock(text, language)
}

/**
 * 表格
 * @param block
 * @param blocks
 * @param pageTitle
 */
export const getTableValue = ({ block, blocks, pageTitle }: TransformPrams) => {
  const tableProp = block.table as ITableData
  const tableCells = tableProp.cells
  // const rowSize = tableProp.property.row_size
  const columnSize = tableProp.property.column_size
  // 二维行数组
  const cells: string[][] = []
  let cellString: string[] = []
  tableCells.forEach((cellId, index) => {
    const cellBlock = blocks.find((item) => item.block_id === cellId) as IBlock
    let text = ''
    cellBlock.children?.forEach((id) => {
      const childBlock = blocks.find((item) => item.block_id === id) as IBlock
      text += getTextValue({ block: childBlock, blocks, pageTitle })
    })
    cellString.push(text)
    if ((index + 1) % columnSize === 0) {
      // 生成二维行数组
      cells.push(cellString)
      cellString = []
    }
  })
  // 转Table
  return '\n' + table(cells) + '\n'
}

export const getChildren = ({ block, blocks, pageTitle }: TransformPrams) => {
  const children = block.children
  if (children?.length) {
    return children
      .map((id) => {
        const childBlock = blocks.find((item) => item.block_id === id) as IBlock
        return transform[childBlock.block_type]({ block: childBlock, blocks, pageTitle })
      })
      .join('\n')
  }
  return ''
}

export const transform: Transform = {
  [IBlockType.page]: _unsupported(IBlockType.page),
  [IBlockType.text]: getTextValue,
  // [IBlockType.Toggle]: getToggleValue,
  [IBlockType.heading1]: getTitleValue(1),
  [IBlockType.heading2]: getTitleValue(2),
  [IBlockType.heading3]: getTitleValue(3),
  [IBlockType.heading4]: getTitleValue(4),
  [IBlockType.heading5]: getTitleValue(5),
  [IBlockType.heading6]: getTitleValue(6),
  [IBlockType.heading7]: getTitleValue(7),
  [IBlockType.heading8]: getTitleValue(8),
  [IBlockType.heading9]: getTitleValue(9),
  [IBlockType.bullet]: getBulletValue,
  [IBlockType.ordered]: getOrderedValue,
  [IBlockType.code]: getCodeValue,
  [IBlockType.quote]: getQuoteValue,
  [IBlockType.quote_container]: getQuoteValue,
  [IBlockType.todo]: getTodoValue,
  [IBlockType.bitable]: _unsupported(IBlockType.bitable),
  [IBlockType.callout]: getQuoteValue,
  [IBlockType.chat_card]: _unsupported(IBlockType.chat_card),
  [IBlockType.diagram]: _unsupported(IBlockType.diagram),
  [IBlockType.divider]: getDividingValue,
  [IBlockType.file]: _unsupported(IBlockType.file),
  [IBlockType.grid]: _unsupported(IBlockType.grid),
  [IBlockType.grid_column]: _unsupported(IBlockType.grid_column),
  [IBlockType.iframe]: _unsupported(IBlockType.iframe),
  [IBlockType.image]: getMediaValue,
  [IBlockType.isv]: _unsupported(IBlockType.isv),
  [IBlockType.mindnote]: _unsupported(IBlockType.mindnote),
  [IBlockType.sheet]: _unsupported(IBlockType.sheet),
  [IBlockType.table]: getTableValue,
  [IBlockType.table_cell]: _unsupported(IBlockType.table_cell),
  [IBlockType.view]: getChildren,
  [IBlockType.task]: _unsupported(IBlockType.task),
  [IBlockType.okr]: _unsupported(IBlockType.okr),
  [IBlockType.okr_objective]: _unsupported(IBlockType.okr),
  [IBlockType.okr_key_result]: _unsupported(IBlockType.okr),
  [IBlockType.okr_progress]: _unsupported(IBlockType.okr),
  [IBlockType.add_ons]: _unsupported(IBlockType.add_ons),
  [IBlockType.jira_issue]: _unsupported(IBlockType.jira_issue),
  [IBlockType.wiki_catalog]: _unsupported(IBlockType.wiki_catalog),
}
