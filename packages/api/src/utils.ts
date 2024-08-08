/**
 * 获取错误描述
 * @param res
 */
export const getErrorDesc = (res: any) => {
  const helps = res.data.error?.helps
  if (helps?.length) {
    return helps.map((h: any) => h.description).join('\n')
  }
  return res.data.msg
}
