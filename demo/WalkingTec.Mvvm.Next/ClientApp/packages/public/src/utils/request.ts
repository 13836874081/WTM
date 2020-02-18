/**
 * @author 冷 (https://github.com/LengYXin)
 * @email lengyingxin8966@gmail.com
 * @create date 2018-09-12 18:52:37
 * @modify date 2018-09-12 18:52:37
 * @desc [description]
*/
import lodash from 'lodash';
import NProgress from 'nprogress';
import { Observable, of, TimeoutError, interval } from "rxjs";
import { ajax, AjaxError, AjaxResponse, AjaxRequest } from "rxjs/ajax";
import { catchError, filter, map, timeout } from "rxjs/operators";
/** 缓存 Request 请求 */
const CacheRequest = new Map<string, Promise<any>>();
/** 缓存数据 */
const Cache = new Map<string, any>();
// 10秒一清理 
interval(10000).subscribe(obs => {
    CacheRequest.clear();
    Cache.clear();
})
export interface IRequestOptions {
    target?: string;
    timeout?: number;
}
export class Request {
    /**
     * 
     * @param target 
     */
    constructor(options?: IRequestOptions) {
        lodash.merge(this.options, options);
    }
    // static target = "";
    static responseStatus: { [key: string]: (res: AjaxResponse) => any } = {
        'default': (res: AjaxResponse) => {
            return res
        },
        '200': (res: AjaxResponse) => {
            if (lodash.toLower(res.responseType) === "blob") {
                return res;
            }
            return res.response
        }
    }
    static filter(ajax): boolean {
        // 数据 Response 
        if (ajax instanceof AjaxResponse) {
            // 无 响应 数据
            if (lodash.isNil(ajax.response)) {
                console.error('ajax response undefined', lodash.merge(ajax, { message: 'ajax response undefined' }))
                // throw lodash.merge(ajax, { message: 'ajax response undefined' })
            } else if (!lodash.eq(lodash.get(ajax.response, 'Code', 200), 200)) {
                throw lodash.merge(ajax, { message: lodash.get(ajax.response, 'Msg') })
            }
        }
        // 错误 超时
        if (ajax instanceof AjaxError || ajax instanceof TimeoutError) {
            throw ajax
        }
        return true
    }
    static Error(error) {
        console.error("TCL: Error -> error", error)
    }
    /**
     * 请求头
     * @type {*}
     * @memberof Request
     */
    static headers: any = {
        'Content-Type': 'application/json'
    };
    options: IRequestOptions = {
        target: "/",
        timeout: 10000,
    }
    /**
     * ajax Observable 管道
     * @param Observable 
     */
    protected AjaxObservable(Obs: Observable<AjaxResponse>) {
        return new Observable<any>(sub => {
            // 加载进度条
            Request.NProgress();
            Obs.pipe(
                // 超时时间
                timeout(this.options.timeout || 10000),
                // 错误处理
                catchError((err) => of(err)),
                // 过滤请求
                filter((ajax) => {
                    try {
                        Request.NProgress("done");
                        return Request.filter(ajax);
                    } catch (error) {
                        Request.Error(error);
                        sub.error(error);
                        return false
                    }
                }),
                // 数据过滤
                map(this.responseMap.bind(this))
            ).subscribe(obs => {
                sub.next(obs)
                sub.complete()
            })
        })
    }
    /**
     * 请求 map 转换
     * @param res 
     */
    responseMap(res: AjaxResponse) {
        // console.log(`TCL: Response ${res.request.url}`, res.response)
        const defaultFn = lodash.get(Request.responseStatus, 'default', () => res);
        const statusFn = lodash.get(Request.responseStatus, res.status, defaultFn);
        return statusFn(res);
    }
    /**
     * 返回请求头
     */
    getHeaders() {
        return lodash.merge({}, Request.headers)
    }
    /**
     * url 参数 注入
     * @param url 
     * @param body 
     */
    static parameterTemplate(url, request: AjaxRequest) {
        try {
            if (lodash.isObject(request.body) && /{([\s\S]+?)}/g.test(url)) {
                url = lodash.template(url, { interpolate: /{([\s\S]+?)}/g })(request.body);
                request.body = {}
            }
        } catch (error) { }
        return url
    }
    /**
     *  请求数据 缓存数据
     * @param params 
     */
    async cache(urlOrRequest: string | AjaxRequest) {
        const key = lodash.isString(urlOrRequest) ? urlOrRequest : `${urlOrRequest.url}_${JSON.stringify(urlOrRequest.body)}`
        if (Cache.has(key)) {
            return Cache.get(key);
        }
        let ajaxPromise: Promise<any>;
        // 读缓存
        if (CacheRequest.has(key)) {
            ajaxPromise = CacheRequest.get(key) as Promise<any>;
        } else {
            // 设缓存
            ajaxPromise = this.ajax(urlOrRequest).toPromise();
            CacheRequest.set(key, ajaxPromise);
        }
        const data = await ajaxPromise;
        Cache.set(key, data);
        return data;
    }
    /**
     * ajax
     * @param urlOrRequest 
     */
    ajax(urlOrRequest: string | AjaxRequest) {
        if (lodash.isString(urlOrRequest)) {
            urlOrRequest = {
                url: urlOrRequest
            };
        }
        urlOrRequest = lodash.cloneDeep(urlOrRequest);
        const url = Request.parameterTemplate(urlOrRequest.url, urlOrRequest)
        urlOrRequest.headers = { ...this.getHeaders(), ...urlOrRequest.headers };
        switch (lodash.toUpper(urlOrRequest.method)) {
            case 'POST':
            case 'PUT':
                urlOrRequest.body = Request.formatBody(urlOrRequest.body, "body", urlOrRequest.headers);
                urlOrRequest.url = Request.compatibleUrl(this.options.target || '', url);
                break;
            default:
                urlOrRequest.url = Request.compatibleUrl(this.options.target || '', url, Request.formatBody(urlOrRequest.body));
                break;
        }
        // console.log("TCL: Request -> ajax -> urlOrRequest", urlOrRequest)
        return this.AjaxObservable(ajax(urlOrRequest))
    }
    /**
     * url 兼容处理 
     * @param address 前缀
     * @param url url
     * @param endStr 结尾，参数等
     */
    static compatibleUrl(address: string, url: string, endStr?: string) {
        endStr = endStr || ''
        if (/^((https|http|ftp|rtsp|mms)?:\/\/)[^\s]+/.test(url)) {
            return `${url}${endStr}`;
        }
        else {
            // address  / 结尾  url / 开头
            const isAddressWith = lodash.endsWith(address, "/")
            const isUrlWith = lodash.startsWith(url, "/")
            // debugger
            if (isAddressWith) {
                if (isUrlWith) {
                    url = lodash.trimStart(url, "/")
                }
            } else {
                if (isUrlWith) {

                } else {
                    url = "/" + url;
                }
            }
        }
        return `${address}${url}${endStr}`
    }
    /**
     * 格式化 参数
     * @param body  参数 
     * @param type  参数传递类型
     * @param headers 请求头 type = body 使用
     */
    static formatBody(
        body?: { [key: string]: any } | any[] | string,
        type: "url" | "body" = "url",
        headers: Object = {}
    ): any {

        if (type === "url") {
            let param = "";
            if (typeof body != 'string') {
                let parlist: any[] = [];
                lodash.forEach(body, (value, key) => {
                    if (!lodash.isNil(value) && value != "") {
                        parlist.push(`${key}=${value}`);
                    }
                });
                if (parlist.length) {
                    param = "?" + parlist.join("&");
                }
            } else {
                param = body;
            }
            return param;
        } else {
            // 处理 Content-Type body 类型 
            switch (headers["Content-Type"]) {
                case 'application/json;charset=UTF-8':
                    body = JSON.stringify(body)
                    break;
                case 'application/json':
                    if (lodash.isArray(body)) {
                        body = [...body]
                    }
                    if (lodash.isPlainObject(body)) {
                        body = { ...body as any }
                    }
                    break;
                case 'application/x-www-form-urlencoded':

                    break;
                case 'form-data':
                case 'multipart/form-data':

                    break;
                case null:
                    delete headers["Content-Type"];
                    break;
                default:
                    break;
            }
            return body;
        }
    }
    /** 日志 */
    // protected log(url, body, headers) {

    // }
    /**
     *  加载进度条
     * @param type 
     */
    static NProgress(type: 'start' | 'done' = 'start') {
        if (type == "start") {
            NProgress.start();
        } else {
            NProgress.done();
        }
    }
}
export default new Request();
