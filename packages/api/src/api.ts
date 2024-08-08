import { FeiShuConfig } from './types'
import {
  IBlock,
  IFolderData,
  IResponseData,
  IResponseFolderData,
  IWikiNode,
  out,
  request,
  RequestOptions,
} from '@feishux/shared'
import { getErrorDesc } from './utils'
import * as process from 'node:process'

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
    if (res.data.code !== 0) {
      out.debug('飞书 API 请求失败： ', JSON.stringify(res.data))
      out.err(`飞书 API 请求失败: ${getErrorDesc(res)}`)
      out.warning(
        '请检查飞书应用配置（机器人、wikiId/folderToken）是否配置正常\n配置文档：https://elog.1874.cool/notion/gvnxobqogetukays#%E9%A3%9E%E4%B9%A6',
      )
      process.exit()
    }
    return res.data.data
  }

  /**
   * 获取页面所有Block
   * @param pageId
   */
  public async getPageBlocks(pageId: string) {
    await this.initPromise
    // https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/document/list
    const getData = async (pageId: string, page_token?: string, result: IBlock[] = []) => {
      const res = await this._fetch<IResponseData<IBlock>>(`docx/v1/documents/${pageId}/blocks`, {
        method: 'GET',
        data: {
          page_token,
          page_size: 200,
        },
      })
      result.push(...res.items)
      if (res.has_more) {
        await getData(pageId, res.page_token, result)
      }
      return result
    }
    return getData(pageId)
  }

  /**
   * 获取素材
   * @private
   */
  public async getResourceItem(file_token: string) {
    await this.initPromise
    // https://open.feishu.cn/document/server-docs/docs/drive-v1/media/download
    const url = `${this.config.baseUrl}/drive/v1/medias/${file_token}/download`
    const res = await request<Buffer>(url, {
      dataType: 'buffer',
      headers: {
        Authorization: `Bearer ${this.tenantAccessToken}`,
      },
    })
    const type = res.headers['content-type']!.split('/')[1]
    return {
      buffer: res.data,
      type,
      name: file_token + '.' + type,
    }
  }

  /**
   * 获取文件夹下的文档树（Tree 结构）
   * @param folder_token
   */
  public async getFolderTree(folder_token: string) {
    await this.initPromise
    const getData = async (
      folder_token: string,
      page_token?: string,
      result: IFolderData[] = [],
    ) => {
      // https://open.feishu.cn/document/server-docs/docs/drive-v1/folder/list
      const res = await this._fetch<IResponseFolderData>('drive/v1/files', {
        method: 'get',
        data: {
          page_token,
          page_size: 200,
          folder_token,
        },
      })
      result.push(...res.files)
      if (res.has_more) {
        await getData(folder_token, res.page_token, result)
      }
      for (const item of result) {
        if (item.type === 'folder') {
          // 重新getData获取文件夹下的文档
          item.children = await getData(item.token)
        }
      }
      return result
    }
    return getData(folder_token)
  }

  /**
   * 获取文件夹下的文档列表
   * @param folder_token
   */
  public async getFolderList(folder_token: string) {
    await this.initPromise
    const getData = async (page_token?: string, result: IFolderData[] = []) => {
      // https://open.feishu.cn/document/server-docs/docs/drive-v1/folder/list
      const res = await this._fetch<IResponseFolderData>('drive/v1/files', {
        method: 'get',
        data: {
          page_token,
          page_size: 200,
          folder_token,
        },
      })
      result.push(...res.files)
      if (res.has_more) {
        await getData(res.page_token, result)
      }
      return result
    }
    return getData()
  }

  /**
   * 获取知识库下的子节点列表
   * @param spaceId 空间 ID
   * @param parent_node_token 父级 Node 节点
   */
  public async getReposNodes(spaceId: string, parent_node_token?: string) {
    await this.initPromise
    const getData = async (page_token?: string, result: IWikiNode[] = []) => {
      const res = await this._fetch<IResponseData<IWikiNode>>(`wiki/v2/spaces/${spaceId}/nodes`, {
        method: 'GET',
        data: {
          parent_node_token,
          page_token,
          page_size: 50,
        },
      })
      result.push(...res.items)
      if (res.has_more) {
        await getData(res.page_token, result)
      }
      return result
    }
    return getData()
  }

  /**
   * 获取知识库下的子节点列表(Tree 结构)
   * @param spaceId
   * @param parent_node_token
   */
  public async getReposNodesTree(spaceId: string, parent_node_token?: string) {
    await this.initPromise
    const getData = async (nodeToken?: string, page_token?: string, result: IWikiNode[] = []) => {
      const res = await this._fetch<IResponseData<IWikiNode>>(`wiki/v2/spaces/${spaceId}/nodes`, {
        method: 'GET',
        data: {
          parent_node_token: nodeToken,
          page_token,
          page_size: 50,
        },
      })
      result.push(...res.items)
      if (res.has_more) {
        await getData(parent_node_token, res.page_token, result)
      }
      for (const item of result) {
        if (item.has_child) {
          // 重新getData获取文件夹下的文档
          item.children = await getData(item.node_token)
        }
      }
      return result
    }
    return getData()
  }
}
