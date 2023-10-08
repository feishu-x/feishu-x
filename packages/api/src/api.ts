import { FeiShuConfig } from './types'
import { IBlock, IResponseData, out } from '@feishux/shared'
import { request, RequestOptions } from '@feishux/shared'

/**
 * FeiShu API
 */
export class FeiShuClient {
  private readonly config: FeiShuConfig
  private tenantAccessToken: string | undefined
  private initPromise: Promise<void>
  constructor(config: FeiShuConfig) {
    this.config = config
    this.config.baseUrl = config?.baseUrl || 'https://open.feishu.cn/open-apis'
    this.config.app_id = config.app_id || (process.env.FEISHU_APP_ID as string)
    this.config.app_secret = config.app_id || (process.env.FEISHU_APP_SECRET as string)
    if (!this.config.app_id || !this.config.app_secret) {
      out.err('缺少参数', '缺少飞书 应用ID 或 应用密钥')
      process.exit(-1)
    }
    this.initPromise = this.init()
  }

  public init = async () => {
    if (!this.initPromise) {
      this.initPromise = this.getAccessToken()
    }
    return await this.initPromise
  }

  private async getAccessToken() {
    // https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal
    const res = await this._fetch<{ tenant_access_token: string }>(
      '/auth/v3/tenant_access_token/internal',
      {
        data: {
          app_id: this.config.app_id,
          app_secret: this.config.app_secret,
        },
        method: 'post',
      },
    )
    this.tenantAccessToken = res.tenant_access_token
  }

  private async _fetch<T>(endpoint: string, reqOpts?: RequestOptions): Promise<T> {
    const url = `${this.config.baseUrl}/${endpoint}`
    const res = await request<T>(url, {
      ...reqOpts,
      headers: {
        Authorization: `Bearer ${this.tenantAccessToken}`,
      },
    })
    return res.data.data
  }

  /**
   * 获取页面所有Block
   * @param pageId
   * @param page_token
   */
  public async getPageBlocks(pageId: string, page_token?: string) {
    // https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/document/list
    const getData = async (pageId: string, page_token?: string, result: IBlock[] = []) => {
      const res = await this._fetch<IResponseData>(`/docx/v1/documents/${pageId}/blocks`, {
        method: 'GET',
        data: {
          page_token,
        },
      })
      result.push(...res.items)
      if (res.has_more) {
        await getData(pageId, res.page_token, result)
      }
      return result
    }
    return getData(pageId, page_token)
  }

  // /**
  //  * 替换所有素材
  //  * @private
  //  * @param pageBlocks
  //  */
  //
  // private async replaceResource(pageBlocks: IBlock[]) {
  //   const images = pageBlocks.map(async (block) => {
  //     if (block.block_type === IBlockType.image) {
  //       // 获取图片
  //       const token = (block.image as IImageData).token
  //
  //       const media = await this.getResourceItem(token)
  //       // 上传到图床
  //     }
  //   })
  // }

  /**
   * 获取素材
   * @private
   */

  public async getResourceItem(file_token: string) {
    // https://open.feishu.cn/document/server-docs/docs/drive-v1/media/download
    return this._fetch<Buffer>(`/drive/v1/medias/${file_token}/download`, {
      dataType: 'buffer',
    })
  }
}
