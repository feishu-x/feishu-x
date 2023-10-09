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
    if (!this.config.appId || !this.config.appSecret) {
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
    const url = `${this.config.baseUrl}/auth/v3/tenant_access_token/internal`
    const res = await request<any>(url, {
      data: {
        app_id: this.config.appId,
        app_secret: this.config.appSecret,
      },
      method: 'post',
    })
    // @ts-ignore
    this.tenantAccessToken = res.data.tenant_access_token
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
    await this.initPromise
    // https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/document/list
    const getData = async (pageId: string, page_token?: string, result: IBlock[] = []) => {
      const res = await this._fetch<IResponseData>(`docx/v1/documents/${pageId}/blocks`, {
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

  /**
   * 获取素材
   * @private
   */

  public async getResourceItem(file_token: string) {
    await this.initPromise
    // https://open.feishu.cn/document/server-docs/docs/drive-v1/media/download
    return this._fetch<Buffer>(`drive/v1/medias/${file_token}/download`, {
      dataType: 'buffer',
    })
  }
}
