import { EntitiesPageStore } from '@leng/public/src';
import lodash from 'lodash';
export class PageStore extends EntitiesPageStore {
    constructor() {
        super({
            target: '/api',
            Search: { url: '/_FrameworkUserBase/Search', },
            Details: { url: '/_FrameworkUserBase/{ID}' },
            Insert: { url: '/_FrameworkUserBase/Add' },
            Update: { url: '/_FrameworkUserBase/Edit' },
            Delete: { url: '/_FrameworkUserBase/BatchDelete' },
            Export: { url: '/_FrameworkUserBase/ExportExcel' },
        });
        this.DeBugLog = true;
        this.ColumnDefs = [
            {
                headerName: "账号", field: "ITCode",
                // 自定义 多语言 
                // headerValueGetter: (params) => ({ 'zh-CN': '姓名', 'en-US': "Name" }[lodash.get(params, 'context.locale')])
            },
            {
                headerName: "姓名", field: "Name",
            },
            {
                headerName: "性别", field: "Sex",
            },
            {
                headerName: "照片", field: "PhotoId", cellRenderer: "avatar"
            },
            {
                headerName: "是否有效", field: "IsValid", cellRenderer: "switch"
            },
            {
                headerName: "角色", field: "RoleName_view",
            },
            {
                headerName: "用户组", field: "GroupName_view",
            }
        ];
        /**
         * 创建订阅事件处理 不使用  EventSubject 处理事件 直接调用函数执行。 EventSubject 只是方便集中处理 逻辑 
         * 默认只处理 内置 事件 'onSearch', 'onDetails', 'onDelete', 'onInsert', 'onUpdate', 'onImport', 'onExport'
         * @memberof PageStore
         */
        this.onCreateSubscribe();
    }
}
export default PageStore