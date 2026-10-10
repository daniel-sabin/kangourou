export namespace api {
	
	export class SaveInput {
	    config: connections.Config;
	    password: string;
	    passwordChanged: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SaveInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.config = this.convertValues(source["config"], connections.Config);
	        this.password = source["password"];
	        this.passwordChanged = source["passwordChanged"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace browse {
	
	export class Filter {
	    column: string;
	    op: string;
	    value: string;
	    value2: string;
	
	    static createFrom(source: any = {}) {
	        return new Filter(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.column = source["column"];
	        this.op = source["op"];
	        this.value = source["value"];
	        this.value2 = source["value2"];
	    }
	}
	export class Sort {
	    column: string;
	    desc: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Sort(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.column = source["column"];
	        this.desc = source["desc"];
	    }
	}
	export class Request {
	    schema: string;
	    table: string;
	    filters: Filter[];
	    sort?: Sort;
	    page: number;
	
	    static createFrom(source: any = {}) {
	        return new Request(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.schema = source["schema"];
	        this.table = source["table"];
	        this.filters = this.convertValues(source["filters"], Filter);
	        this.sort = this.convertValues(source["sort"], Sort);
	        this.page = source["page"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result {
	    columns: string[];
	    rows: string[][];
	    primaryKey: string[];
	    total: number;
	    totalIsEstimate: boolean;
	    hasMore: boolean;
	    page: number;
	    pageSize: number;
	
	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = source["columns"];
	        this.rows = source["rows"];
	        this.primaryKey = source["primaryKey"];
	        this.total = source["total"];
	        this.totalIsEstimate = source["totalIsEstimate"];
	        this.hasMore = source["hasMore"];
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	    }
	}

}

export namespace connections {
	
	export class Config {
	    id: string;
	    name: string;
	    host: string;
	    port: number;
	    user: string;
	    database: string;
	    sslMode: string;
	    statementTimeoutSeconds: number;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.database = source["database"];
	        this.sslMode = source["sslMode"];
	        this.statementTimeoutSeconds = source["statementTimeoutSeconds"];
	    }
	}

}

export namespace schema {
	
	export class Column {
	    name: string;
	    type: string;
	    castType: string;
	    category: string;
	    nullable: boolean;
	    sortable: boolean;
	    enumValues: string[];
	
	    static createFrom(source: any = {}) {
	        return new Column(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.castType = source["castType"];
	        this.category = source["category"];
	        this.nullable = source["nullable"];
	        this.sortable = source["sortable"];
	        this.enumValues = source["enumValues"];
	    }
	}
	export class ForeignKey {
	    name: string;
	    fromSchema: string;
	    fromTable: string;
	    fromColumns: string[];
	    toSchema: string;
	    toTable: string;
	    toColumns: string[];
	
	    static createFrom(source: any = {}) {
	        return new ForeignKey(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.fromSchema = source["fromSchema"];
	        this.fromTable = source["fromTable"];
	        this.fromColumns = source["fromColumns"];
	        this.toSchema = source["toSchema"];
	        this.toTable = source["toTable"];
	        this.toColumns = source["toColumns"];
	    }
	}
	export class Table {
	    schema: string;
	    name: string;
	    kind: string;
	    columns: Column[];
	    primaryKey: string[];
	    foreignKeys: ForeignKey[];
	    referencedBy: ForeignKey[];
	
	    static createFrom(source: any = {}) {
	        return new Table(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.schema = source["schema"];
	        this.name = source["name"];
	        this.kind = source["kind"];
	        this.columns = this.convertValues(source["columns"], Column);
	        this.primaryKey = source["primaryKey"];
	        this.foreignKeys = this.convertValues(source["foreignKeys"], ForeignKey);
	        this.referencedBy = this.convertValues(source["referencedBy"], ForeignKey);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Schema {
	    tables: Table[];
	
	    static createFrom(source: any = {}) {
	        return new Schema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tables = this.convertValues(source["tables"], Table);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace sqlexec {
	
	export class Result {
	    columns: string[];
	    rows: string[][];
	    commandTag: string;
	    rowsAffected: number;
	    hasRows: boolean;
	    truncated: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = source["columns"];
	        this.rows = source["rows"];
	        this.commandTag = source["commandTag"];
	        this.rowsAffected = source["rowsAffected"];
	        this.hasRows = source["hasRows"];
	        this.truncated = source["truncated"];
	    }
	}

}

